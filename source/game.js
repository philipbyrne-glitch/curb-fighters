'use strict';
(async () => {
/* =====================================================================
   0. UTILITIES
   ===================================================================== */
const CF = window.CF_DATA;
const EXCLAMATIONS = window.CF_EXCLAMATIONS || {};
// Each category has its own shuffled bag: every phrase appears once per cycle.
const phraseBags = new Map();
const phrase = (category, fallback) => {
  const choices = EXCLAMATIONS[category];
  if (!Array.isArray(choices) || !choices.length) return fallback;
  let bag = phraseBags.get(category);
  if (!bag || bag.length === 0) {
    bag = choices.map((_, i) => i);
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    phraseBags.set(category, bag);
  }
  return choices[bag.pop()];
};
const $ = (s) => document.querySelector(s);
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (u) => u * u * (3 - 2 * u);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const COARSE = matchMedia('(pointer: coarse)').matches;
const PORTRAIT = matchMedia('(max-width: 700px) and (orientation: portrait)');
const anyDialog = () => !!document.querySelector('dialog[open]');
const THREE_CHARACTER_VERSION = window.CF_THREE_CHARACTER_VERSION === true;
// Pinky (avatar 4) is implemented but SECRET. Do not include him in the
// selection carousel, CPU pool, or victory crowd until a genuine unlock
// mechanism is designed. Keeping all gameplay assets/code ready for later.
const PINKY_UNLOCKED = false;
const SELECTABLE_AVATARS = THREE_CHARACTER_VERSION
  ? [0, 1, 2, ...(PINKY_UNLOCKED ? [4] : [])]
  : [0, 1, 2, 3, ...(PINKY_UNLOCKED ? [4] : [])];
const SELECT_STEP = Math.PI * 2 / SELECTABLE_AVATARS.length;
const CHARACTERS = [
  { name: 'PHIL', desc: 'Bald, black glasses, white T-shirt and blue trousers' },
  { name: 'SHAY', desc: 'Blond hair, yellow-and-white striped T-shirt, teal shorts and red trainers' },
  { name: 'ROSE', desc: 'Blond hair, sunglasses on her head, purple sporty top' },
  { name: 'KIM', desc: 'Dark brown hair, coral top and gold earrings' },
  { name: 'PINKY', desc: 'Silver hair, white dress shirt, black suit trousers and polished black shoes' },
];
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').imageSmoothingEnabled = false; return c; }

/* =====================================================================
   1. RULES — pure functions; an outcome is decided once per throw.
   ===================================================================== */
const Rules = {
  WIN: 100,
  // A successful 5-pointer makes the next halfway attempt tougher: 15% of the
  // original width per extra shot, capped at 40% to keep a realistic sweet spot.
  halfwayScale: (fiveStreak = 0, leading = false) => Math.max(.4, 1 - (leading ? .225 : .15) * Math.max(0, fiveStreak)),
  green: (halfway, fiveStreak = 0, leading = false) => {
    const base = halfway ? { power: [.42, .64], aim: [.41, .59] } : { power: [.50, .84], aim: [.36, .64] };
    if (!halfway || fiveStreak === 0) return base;
    const scale = Rules.halfwayScale(fiveStreak, leading);
    const shrink = ([lo, hi]) => { const mid = (lo + hi) / 2, half = (hi - lo) * scale / 2; return [mid - half, mid + half]; };
    return { power: shrink(base.power), aim: shrink(base.aim) };
  },
  fringe: (halfway, fiveStreak = 0, leading = false) => halfway ? .03 * Rules.halfwayScale(fiveStreak, leading) : .04,
  gold: (boosted) => boosted ? { power: [.52, .82], aim: [.38, .62] } : { power: [.735, .755], aim: [.475, .525] },
  judge(power, aim, halfway, boosted, roll = Math.random(), fiveStreak = 0, leading = false) {
    const g = Rules.green(halfway, fiveStreak, leading), fr = Rules.fringe(halfway, fiveStreak, leading);
    const inside = (v, [lo, hi]) => v >= lo && v <= hi;
    const near = (v, [lo, hi]) => v >= lo - fr && v <= hi + fr;
    let p = power, a = aim, chance = false;
    const off = Math.max(g.power[0] - p, p - g.power[1], g.aim[0] - a, a - g.aim[1], 0); // how far outside the green
    // Yellow fringes: one 50% roll for the whole throw, never a second chance.
    if (near(p, g.power) && near(a, g.aim) && !(inside(p, g.power) && inside(a, g.aim))) {
      chance = true;
      if (roll < .5) { p = clamp(p, g.power[0], g.power[1]); a = clamp(a, g.aim[0], g.aim[1]); }
    }
    const bad = !chance && off > fr * 1.75; // clearly past the yellow: a stinker
    if (a < g.aim[0] || a > g.aim[1]) return { points: 0, kind: 'wide', side: a < .5 ? -1 : 1, chance, bad };
    if (p < g.power[0]) return { points: 0, kind: 'short', chance, bad };
    if (p > g.power[1]) return { points: 0, kind: 'long', chance, bad };
    if (!halfway) { const d = Rules.gold(boosted); if (inside(p, d.power) && inside(a, d.aim)) return { points: 30, kind: 'double', chance }; }
    return { points: halfway ? 5 : 10, kind: 'hit', chance };
  },
  cpuPlan(halfway, rng = Math.random, fiveStreak = 0, leading = false) {
    const z = Rules.green(halfway, fiveStreak, leading), success = rng() < (halfway ? .53 : .65);
    // Keep the CPU's aiming margins proportional to the increasingly tight zone.
    const pMargin = (z.power[1] - z.power[0]) * .09;
    const aMargin = (z.aim[1] - z.aim[0]) * .14;
    let power = z.power[0] + pMargin + rng() * (z.power[1] - z.power[0] - 2 * pMargin);
    let aim = z.aim[0] + aMargin + rng() * (z.aim[1] - z.aim[0] - 2 * aMargin);
    if (!success) { if (rng() < .55) aim = rng() < .5 ? z.aim[0] - .09 : z.aim[1] + .09; else power = rng() < .5 ? z.power[0] - .08 : z.power[1] + .08; }
    return { power, aim };
  },
};

/* =====================================================================
   2. AUDIO — one Web Audio graph: master → (music bus, sfx bus).
   Music is decoded from the original MP3s and looped sample-accurately.
   ===================================================================== */
const Sound = (() => {
  const AC = window.AudioContext || window.webkitAudioContext;
  const prefs = { music: .7, sfx: .7, on: true }; // the defaults Phil set on the sound desk
  try {
    // v2: everyone starts once on the balanced defaults; older saved sliders were set against the old levels.
    const s = JSON.parse(localStorage.getItem('curb-fighters-audio-v2') || 'null');
    if (s) { if (Number.isFinite(s.music)) prefs.music = clamp(s.music); if (Number.isFinite(s.sfx)) prefs.sfx = clamp(s.sfx); if (typeof s.on === 'boolean') prefs.on = s.on; }
  } catch { /* private mode */ }
  let ctx = null, master, musicBus, sfxBus, unlocked = false, wanted = null, current = null, freeAt = 0;
  const buffers = {}, pending = {}, resumeAt = {}, voices = {};
  function ensure() {
    if (ctx || !AC) return ctx;
    try {
      ctx = new AC();
      master = ctx.createGain(); musicBus = ctx.createGain(); sfxBus = ctx.createGain();
      musicBus.connect(master); sfxBus.connect(master); master.connect(ctx.destination);
      apply(true);
      ctx.onstatechange = () => listeners.forEach((f) => f());
    } catch { ctx = null; }
    return ctx;
  }
  const listeners = [];
  // Phil's balance from the sound desk (tools/mixer.html). 1 = as designed; anything unlisted is 1.
  const MIX = {
    intro: 0.2, select: 0.2, game: 0.2, pinky: 0.2, win: 0.2,
    'voice-curbfighters': 0.4, 'voice-phil': 0.4, 'voice-kim': 0.4, 'voice-rose': 0.4, 'voice-shay': 0.4, 'voice-bounce': 0.4, 'voice-versus': 0.4, 'voice-pinkys': 0.4, 'voice-noodles': 0.4, 'sfx-miss': 0.35, 'sfx-family-beep': 0.182, 'sfx-yeah': 0.55,
    throw: 2, curb: 1.65, bounce: 2, bop: 2, catch: 1.9, hit: 1.25, double: 1.25, fanfare: 1.25, noodle: 2, surprise: 1.15, horn: 1.015, car: 1.25, van: 1.9, screech: 1, raceAway: 1.55, munch: 2, countdown: 1.75, go: 1.3, tick: 1, lock: 1,
  };
  const level = (name) => (MIX[name] ?? 1);
  let mixNow = 1; // the level of the effect being played right now
  function apply(now = false) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const set = (node, v) => { if (now) node.gain.value = v; else node.gain.setTargetAtTime(v, t, .03); };
    set(master, prefs.on ? 1 : 0); set(musicBus, prefs.music); set(sfxBus, prefs.sfx);
  }
  function save() { try { localStorage.setItem('curb-fighters-audio-v2', JSON.stringify(prefs)); } catch { /* ignore */ } }
  function loopPoints(b) {
    const d = b.getChannelData(0), n = d.length, th = .0025;
    let s = 0, e = n - 1;
    while (s < n && Math.abs(d[s]) < th) s++;
    while (e > s && Math.abs(d[e]) < th) e--;
    return { loopStart: s / b.sampleRate, loopEnd: (e + 1) / b.sampleRate };
  }
  function decode(key) {
    if (buffers[key]) return Promise.resolve(buffers[key]);
    if (pending[key]) return pending[key];
    const source = CF.audio[key];
    if (!source || !ensure()) return Promise.resolve(null);
    pending[key] = fetch(source)
      .then((response) => {
        if (!response.ok) throw new Error('Audio failed to load: ' + key);
        return response.arrayBuffer();
      })
      .then((bytes) => new Promise((done, fail) => ctx.decodeAudioData(bytes, done, fail)))
      .then((buffer) => {
        buffers[key] = { buffer, ...loopPoints(buffer) };
        return buffers[key];
      })
      .catch(() => null);
    return pending[key];
  }
  function position() {
    if (!current) return 0;
    const e = current.entry, len = e.loopEnd - e.loopStart;
    let p = current.offset + Math.max(0, ctx.currentTime - current.started);
    if (p > e.loopEnd) p = e.loopStart + ((p - e.loopStart) % len);
    return p;
  }
  function stop() {
    if (!current) return;
    resumeAt[current.key] = position();
    const { src, gain } = current, t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t); gain.gain.setValueAtTime(gain.gain.value, t); gain.gain.linearRampToValueAtTime(0, t + .07);
    try { src.stop(t + .08); } catch { /* already stopped */ }
    freeAt = t + .08; current = null;
  }
  function start(key) {
    const entry = buffers[key];
    if (!entry || !ctx) return;
    const src = ctx.createBufferSource(), gain = ctx.createGain();
    src.buffer = entry.buffer; src.loop = true; src.loopStart = entry.loopStart; src.loopEnd = entry.loopEnd;
    src.connect(gain); gain.connect(musicBus);
    // Tracks never overlap: the next one begins after the last has faded.
    const when = Math.max(ctx.currentTime + .01, freeAt);
    const offset = key === 'game' && resumeAt.game != null ? clamp(resumeAt.game, entry.loopStart, entry.loopEnd - .1) : entry.loopStart;
    gain.gain.setValueAtTime(0, when); gain.gain.linearRampToValueAtTime(level(key), when + .04);
    src.start(when, offset);
    current = { key, src, gain, started: when, offset, entry };
  }
  function sync() {
    if (!ctx) return;
    const key = wanted;
    if (current && current.key === key) return;
    stop();
    if (!key) return;
    decode(key).then(() => { if (wanted === key && !current) start(key); });
  }
  const running = () => !!ctx && ctx.state === 'running' && !document.hidden;
  function voice(type, delay) { const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.connect(g); g.connect(sfxBus); return { t, o, g }; }
  function sweep(from, to, dur, vol = .06, type = 'triangle', delay = 0) {
    if (!running() || !prefs.on || prefs.sfx <= 0) return;
    const { t, o, g } = voice(type, delay);
    o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
    g.gain.setValueAtTime(Math.max(.0001, vol * mixNow), t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.start(t); o.stop(t + dur + .02);
  }
  function tone(freq, dur = .1, type = 'square', delay = 0, vol = .045) {
    if (!running() || !prefs.on || prefs.sfx <= 0) return;
    const { t, o, g } = voice(type, delay);
    o.frequency.value = freq; g.gain.setValueAtTime(Math.max(.0001, vol * mixNow), t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.start(t); o.stop(t + dur + .02);
  }
  const arp = (notes, gap = .12, dur = .18) => notes.forEach((n, i) => tone(n, dur, 'square', i * gap));
  let noiseBuf = null;
  function noise(dur, freq, q, vol, delay = 0) {
    if (!running() || !prefs.on || prefs.sfx <= 0) return;
    if (!noiseBuf) { // sample-and-hold noise: crunchier, more like a 16-bit sound chip
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); let v = 0;
      for (let i = 0; i < d.length; i++) { if (i % 3 === 0) v = Math.random() * 2 - 1; d[i] = v; }
    }
    const t = ctx.currentTime + delay, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; src.loop = true; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(Math.max(.0001, vol * mixNow), t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(sfxBus); src.start(t); src.stop(t + dur + .02);
  }
  function steps(freqs, stepDur, type, vol, delay = 0) { // a pitch line that moves in steps, like a sound chip
    if (!running() || !prefs.on || prefs.sfx <= 0) return;
    const { t, o, g } = voice(type, delay), end = t + freqs.length * stepDur;
    freqs.forEach((f, k) => o.frequency.setValueAtTime(f, t + k * stepDur));
    g.gain.setValueAtTime(Math.max(.0001, vol * mixNow), t); g.gain.exponentialRampToValueAtTime(.0001, end);
    o.start(t); o.stop(end + .02);
  }
  const FX = {
    throw: (half) => { sweep(half ? 340 : 620, 95, half ? .18 : .27, .06, 'triangle'); sweep(160, 500, .09, .028, 'square', .025); },
    curb: () => { sweep(1300, 380, .075, .05, 'square'); sweep(330, 110, .13, .06, 'triangle', .025); },
    bop: () => { sweep(280, 85, .105, .08, 'triangle'); sweep(510, 180, .045, .02, 'square', .008); },
    bounce: () => sweep(185, 72, .14, .06, 'triangle'),
    catch: () => { sweep(300, 520, .05, .04, 'square'); sweep(220, 160, .08, .05, 'triangle', .03); },
    miss: () => { tone(170, .15, 'triangle', .05, .06); tone(130, .22, 'triangle', .2, .06); },
    hit: () => arp([392, 494, 587, 784]),
    double: () => arp([392, 494, 587, 784, 988, 1175, 1568], .1, .2),
    fanfare: () => arp([523, 659, 784, 1047, 784, 1047, 1319, 1568], .13, .2),
    surprise: () => arp([784, 1047, 1568], .075, .09),
    horn: () => { tone(440, .1, 'square', 0, .05); tone(330, .18, 'square', .16, .05); },
    noodle: (underVoice) => { const v = underVoice ? .5 : 1, d = underVoice ? .28 : 0; sweep(170, 65, .28, .08 * v, 'sawtooth', d); sweep(110, 52, .3, .06 * v, 'square', .12 + d); },
    lock: (n) => tone(n === 0 ? 330 : 440, .08, 'square', 0, .05),
    tick: (n) => tone(330 + n * 80, .06, 'square', 0, .04),
    munch: (p, n) => tone(540 + p * 110 + (n % 3) * 70, .035, 'triangle', 0, .07),
    go: () => arp([523, 784, 1047], .07, .12),
    countdown: (n) => { // PINKY_RACE_POLISH_V1: racing start lights
      if (n) { tone(392, .18, 'square', 0, .062); tone(196, .16, 'triangle', 0, .018); }
      else { tone(880, .62, 'square', 0, .065); tone(1760, .48, 'triangle', 0, .022); }
    },
    screech: () => { // tyres: two detuned squares warbling at chip speed over a bright hiss
      const a = [], b = [];
      for (let k = 0; k < 18; k++) { a.push((k % 2 ? 1720 : 1560) - k * 14); b.push((k % 2 ? 1490 : 1640) - k * 12); }
      steps(a, .032, 'square', .035); steps(b, .032, 'square', .022); noise(.6, 2600, 5, .1);
    },
    raceAway: () => { // revs up through two gear changes, then fades into the distance
      const f = []; for (let k = 0; k < 30; k++) { const gear = Math.floor(k / 10); f.push(90 + gear * 70 + (k % 10) * 22); }
      steps(f, .045, 'square', .06, .14); steps(f.map((v) => v / 2), .045, 'triangle', .05, .14); noise(1.4, 420, 1.2, .035, .14);
    },
  };
  return {
    prefs, decode, sweep, tone,
    sfx: (name, ...a) => { if (!ctx || !FX[name]) return; mixNow = level(name); try { FX[name](...a); } finally { mixNow = 1; } },
    // The engine of a passing car or Pinky's arriving van: one pulse, called every 90 ms.
    engine(kind, u, el) {
      const pitch = 62 + Math.sin(u * Math.PI) * 13, pulse = Math.floor(el / 90) % 3;
      const vol = (kind === 'car' ? .03 + .06 * Math.sin(Math.PI * u) : .014 + .026 * Math.sin(Math.PI * u)) * level(kind); // cars: louder, swelling as they pass
      sweep(pitch + pulse * 5, pitch - 8, .115, vol, 'square'); sweep(pitch * .5, pitch * .47, .12, vol * .45, 'triangle');
    },
    level, levels: MIX, effects: () => Object.keys(FX), playing: () => wanted,
    length: (key) => (buffers[key] ? buffers[key].loopEnd - buffers[key].loopStart : null), // seconds of sound, once decoded
    setLevel(name, v) { MIX[name] = v; if (current && current.key === name && ctx) current.gain.gain.setTargetAtTime(v, ctx.currentTime, .03); },
    onChange: (f) => listeners.push(f),
    get locked() { return !ctx || ctx.state !== 'running'; },
    unlock() {
      if (!ensure()) return;
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* Safari only */ }
      unlocked = true;
      if (ctx.state !== 'running' && !document.hidden) ctx.resume().then(sync).catch(() => {});
      try { const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); } catch { /* ignore */ }
      sync();
    },
    music(key) { if (wanted === key) return; wanted = key; if (key) decode(key); sync(); },
    // A recorded sample (names, chants). Returns false when it hasn't been supplied yet,
    // so the caller can play its synth stand-in instead.
    has: (key) => !!buffers[key] || !!CF.audio[key],
    say(key, channel = key) {
      if (!buffers[key] && !CF.audio[key]) return false;
      decode(key).then((e) => {
        if (!e || !running() || !prefs.on || prefs.sfx <= 0) return;
        if (voices[channel]) { try { voices[channel].stop(); } catch { /* done */ } }
        const src = ctx.createBufferSource(), vg = ctx.createGain(); src.buffer = e.buffer; vg.gain.value = level(key); src.connect(vg); vg.connect(sfxBus);
        const t = ctx.currentTime + .01, dur = e.loopEnd - e.loopStart;
        src.start(t, e.loopStart); voices[channel] = src;
        musicBus.gain.cancelScheduledValues(t); musicBus.gain.setTargetAtTime(prefs.music * .4, t, .03); // duck the music under the voice
        musicBus.gain.setTargetAtTime(prefs.music, t + dur, .12);
        src.onended = () => { if (voices[channel] === src) voices[channel] = null; };
      });
      return true;
    },
    // CURBS_VICTORY_AUDIO_FLOW_V1: sequence by actual sample length, not a fixed delay.
    sequence(keys, valid = () => true) {
      Promise.all(keys.map((key) => decode(key))).then((entries) => {
        if (!entries.every(Boolean) || !valid() || !running() || !prefs.on || prefs.sfx <= 0) return;
        // Keep any lingering voice or street cheer out of the winner announcement.
        Object.keys(voices).forEach((k) => {
          const old = voices[k];
          if (old) { try { old.stop(); } catch { /* already ended */ } voices[k] = null; }
        });
        let at = ctx.currentTime + .20;
        const firstAt = at;
        keys.forEach((key, i) => {
          const entry = entries[i], src = ctx.createBufferSource(), gain = ctx.createGain();
          const duration = entry.loopEnd - entry.loopStart;
          src.buffer = entry.buffer;
          gain.gain.value = level(key);
          src.connect(gain); gain.connect(sfxBus);
          src.start(at, entry.loopStart, duration);
          const channel = 'celebration-sequence-' + i;
          voices[channel] = src;
          src.onended = () => { if (voices[channel] === src) voices[channel] = null; };
          at += duration + (i === 0 ? .16 : 0);
        });
        musicBus.gain.cancelScheduledValues(firstAt);
        musicBus.gain.setTargetAtTime(prefs.music * .35, firstAt, .035);
        musicBus.gain.setTargetAtTime(prefs.music, at + .06, .12);
      });
    },
    forget(key) { delete resumeAt[key]; },
    set(kind, value) { prefs[kind] = value; apply(); save(); },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume() { if (ctx && unlocked && !document.hidden && !PORTRAIT.matches) ctx.resume().then(sync).catch(() => {}); },
    init: ensure,
  };
})();

/* =====================================================================
   3. ARTWORK — pre-rendered at in-game size; composites built here.
   ===================================================================== */
const IMG = {};
const [META] = await Promise.all([
  fetch(CF.metaUrl).then((response) => {
    if (!response.ok) throw new Error('Artwork metadata failed to load');
    return response.json();
  }),
  Promise.all(Object.entries(CF.img).map(([k, src]) => new Promise((ok, fail) => {
    const i = new Image(); i.onload = () => { IMG[k] = i; ok(); }; i.onerror = () => fail(new Error('Artwork failed to load: ' + k)); i.src = src;
  }))),
]);
const PR = META.props;
const pinkyPoseStrip = new Image();
pinkyPoseStrip.src = window.CF_PINKY_POSES;
await pinkyPoseStrip.decode();
const pinkyFrame = (n) => {
  const frame = makeCanvas(128, 112), c = frame.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.drawImage(pinkyPoseStrip, n * 40, 0, 40, 48, 24, 4, 80, 96);
  frame.cell = 'pinky';
  return frame;
};
const pinkyHead = makeCanvas(52, 46);
pinkyHead.getContext('2d').drawImage(pinkyPoseStrip, 1, 0, 35, 29, 0, 0, 52, 46);
const cellOf = (n) => { const c = makeCanvas(128, 112), cols = META.actors.cols; c.getContext('2d').drawImage(IMG.actors, (n % cols) * 128, Math.floor(n / cols) * 112, 128, 112, 0, 0, 128, 112); c.cell = n; return c; };
const pickCells = (k) => META.actors.index[k].map(cellOf);
const copyOf = (src) => { const c = makeCanvas(src.width, src.height); c.getContext('2d').drawImage(src, 0, 0); c.cell = src.cell; return c; };
const Art = { base: [], wait: [], alt: [], emote: [], catch: [], react: [], walker: pickCells('walker'), trophy: [] };
const HOLD = [[52, 32], [52, 32], [54, 33], [67, 33], [85, 52]];
for (let i = 0; i < 4; i++) { Art.base[i] = pickCells('base' + i); Art.wait[i] = pickCells('wait' + i); Art.alt[i] = pickCells('alt' + i); Art.emote[i] = pickCells('emote' + i); }
const pinkyFrames = [0, 1, 2, 3, 4].map(pinkyFrame);
Art.base[4] = [pinkyFrames[0], pinkyFrames[2], pinkyFrames[1], pinkyFrames[3]];
Art.wait[4] = [pinkyFrames[0], pinkyFrames[1], pinkyFrames[0], pinkyFrames[1], pinkyFrames[0], pinkyFrames[1]];
Art.alt[4] = [pinkyFrames[1], pinkyFrames[0], pinkyFrames[1], pinkyFrames[0]];
Art.emote[4] = [pinkyFrames[4], pinkyFrames[3], pinkyFrames[3], pinkyFrames[4]];

function drawBall(c, x, y, radius = 12, spin = 0, squash = 0) {
  const img = radius > 18 ? IMG.ball48 : IMG.ball24, size = Math.max(2, Math.round(radius * 2));
  c.save(); c.imageSmoothingEnabled = false;
  if (squash > .05) { // flattened against the road: wider and shorter, bottom edge fixed
    const w = Math.round(size * (1 + .3 * squash)), h = Math.round(size * (1 - .3 * squash));
    c.translate(Math.round(x), Math.round(y + size / 2)); c.scale(w / size, h / size); c.translate(0, -size / 2);
  } else c.translate(Math.round(x), Math.round(y));
  c.rotate(Math.round(spin / (Math.PI / 2)) * (Math.PI / 2)); // quarter turns keep every pixel square
  c.drawImage(img, -Math.round(size / 2), -Math.round(size / 2), size, size); c.restore();
}
for (let i = 0; i < 5; i++) {
  drawBall(Art.base[i][1].getContext('2d'), HOLD[i][0], HOLD[i][1], 12, 0); // our football replaces the atlas ball
  const k = copyOf(Art.base[i][2]), kc = k.getContext('2d');
  drawBall(kc, 94, 46, 12, 0);
  kc.drawImage(Art.base[i][2], 87, 48, 23, 14, 87, 48, 23, 14); // catching hand sits over the ball
  Art.catch[i] = k;
  Art.react[i] = Art.base[i].map((pose) => { const r = copyOf(pose); r.getContext('2d').drawImage(Art.emote[i][0], 48, 42, 34, 20, 48, 42, 34, 20); return r; });
}
for (let i = 0; i < 4; i++) { const c = makeCanvas(128, 112); c.getContext('2d').drawImage(IMG.trophy, i * 128, 0, 128, 112, 0, 0, 128, 112); Art.trophy[i] = c; }
Art.trophy[4] = copyOf(Art.base[4][3]);
drawBall(Art.trophy[4].getContext('2d'), HOLD[4][0], HOLD[4][1] - 10, 17, 0);
const tileCanvases = [0, 1, 2, 3].map((k) => { const c = makeCanvas(32, 32); c.getContext('2d').drawImage(IMG.tiles, k * 32, 0, 32, 32, 0, 0, 32, 32); return c; });
const tileAvg = tileCanvases.map((c) => { // grass, road, paving, river
  const d = c.getContext('2d').getImageData(0, 0, 32, 32).data; let r = 0, g = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
  const n = d.length / 4; return 'rgb(' + Math.round(r / n) + ',' + Math.round(g / n) + ',' + Math.round(b / n) + ')';
});

function poseFrame(i, o = {}) {
  const B = Art.base[i];
  if (o.eating || o.bounce !== undefined) return B[2];
  if (o.arms) return B[3];
  if (o.mood === 'annoyed') return (o.throwing ? Art.react[i][1] : o.follow ? Art.react[i][2] : null) || Art.emote[i][0];
  if (o.catching) return Art.catch[i];
  if (o.punch) return Art.emote[i][1 + Math.floor((o.time || 0) / 240) % 2];
  const pose = o.throwing ? 1 : o.follow ? 2 : 0;
  if (o.waiting && o.waitFor >= 2000 && pose === 0) {
    const t = o.waitFor - 2000, v = o.variant || 0;
    if (i === 0 && v === 3) return Art.emote[0][3];                                   // Phil: phone
    if (v === 1) return Art.alt[i][Math.floor(t / (i === 1 ? 190 : i === 2 ? 300 : 600)) % 4]; // nap, moonwalk, pink phone, Kim's phone
    let f;
    if (i === 3) f = Math.floor(t / 240) % 4;                                          // Kim: dancing
    else if (i === 0) f = v === 2 ? [4, 5, 5, 4][Math.floor(t / 230) % 4] : [2, 3][Math.floor(t / 430) % 2]; // yo-yo or folded arms
    else if (i === 1) f = [2, 4, 3, 4, 2, 3][Math.floor(t / 160) % 6];                 // Shay: thigh drumming
    else f = [2, 3, 4, 4, 5, 2][Math.floor(t / 350) % 6];                             // Rose: bubble gum
    return Art.wait[i][f];
  }
  return B[pose];
}
function drawCharacter(c, x, y, i, o = {}) {
  const img = poseFrame(i, o); if (!img) return;
  const scale = o.scale || 2, f = scale / 2;
  const idle = !o.arms && !o.throwing && !o.follow && !o.catching && !o.punch && !o.mood && !o.eating && o.bounce === undefined;
  const lounging = o.waiting && o.waitFor >= 2000;
  const bob = o.animate && idle && !lounging ? Math.round(Math.sin((o.time || 0) * .003 + i) * 1.5) : 0;
  const slide = lounging && i === 1 && o.variant === 1 ? -Math.sin((o.waitFor - 2000) / 2200 * Math.PI) * 9 : 0;
  c.save(); c.imageSmoothingEnabled = false;
  c.translate(Math.round(x + slide * f), Math.round(y - (o.jump || 0) * scale));
  if (o.flip) c.scale(-1, 1);
  if (bob) c.scale(1, 1 + bob / 100); // breathing squash, anchored at the feet
  c.drawImage(img, -Math.round(64 * f), -Math.round(100 * f), Math.round(128 * f), Math.round(112 * f));
  if (o.eating || o.bounce !== undefined) {
    if (o.bounce !== undefined) { c.fillStyle = '#17372d40'; c.beginPath(); c.ellipse(30 * f, 0, (3 + 4 * o.bounce) * f, (1.5 + 1.5 * o.bounce) * f, 0, 0, Math.PI * 2); c.fill(); }
    if (o.eating) drawCone(c, 30 * f, -88 * f, 49 * f, o.eaten || 0);
    else drawBall(c, 30 * f, (-54 + 42 * o.bounce) * f, 12 * f, o.spin || 0, o.squash || 0);
    if (i !== 4 && (o.eating || o.bounce < .23)) c.drawImage(Art.base[i][2], 87, 48, 23, 14, Math.round(23 * f), Math.round(-52 * f), Math.round(23 * f), Math.round(14 * f));
  }
  c.restore();
}
// Head-only portraits, cut from every pose. The HUD picks the face that matches what each character is doing.
function headKey(i, o) {
  if (i === 4) return 'pinky';
  const I = META.actors.index;
  if (o.mood === 'annoyed') return I['emote' + i][0];                      // missed, NOODLED, or lost
  if (o.arms) return I['base' + i][3];                                     // Double Trouble, a win, Pinky's arrival
  if (o.shout || o.follow) return I['base' + i][2];                        // yelling NOODLES!, gasping, letting fly
  if (o.punch || o.catching || o.eating) return I['emote' + i][1];         // a good curb, a 99
  if (o.waiting && o.waitFor >= 2000) { const f = poseFrame(i, o); if (f && META.heads.index[f.cell] !== undefined) return f.cell; } // nap, phone, gum, dance
  return I['base' + i][0];
}
function blitHead(c, key, x, y, f = 1) {
  if (key === 'pinky') { c.drawImage(pinkyHead, Math.round(x), Math.round(y), 52 * f, 46 * f); return; }
  const H = META.heads, j = H.index[key]; if (j === undefined) return;
  c.drawImage(IMG.heads, (j % H.cols) * H.w, Math.floor(j / H.cols) * H.h, H.w, H.h, Math.round(x), Math.round(y), H.w * f, H.h * f);
}
// Four individual 52x46 mouth-open frames; generated from each character's
// original head sprite so hair, eyes, glasses and outlines remain pixel perfect.
// CURBS_SHADOW_MOUTH_SWAP_V1: user-calibrated mouth geometry + screenshot-guide vertical correction.
const EatOpenHeads = Array.from({ length: 4 }, (_, av) => {
  const canv = makeCanvas(META.heads.w, META.heads.h), cc = canv.getContext('2d');
  cc.imageSmoothingEnabled = false;
  blitHead(cc, META.eat[av].head, 0, 0);
  // Avatar sprite order: Phil, Shay, Rose, Kim.
  // CURBS_EXACT_CALIBRATED_MOUTHS_V1: exactly the Sprite Lab values; Phil, Shay, Rose, Kim.
  const mx = [28, 33, 32, 33][av], my = [39, 40, 41, 34][av]; // KIM_SHAY_MOUTH_POSITION_V2
  const mw = [7, 6, 8, 6][av], mh = [5, 4, 4, 5][av];
  const left = mx - Math.floor(mw / 2), top = my - 1;
  cc.fillStyle = '#3b1c34'; cc.fillRect(left, top, mw, mh);
  cc.fillStyle = '#f9eee4'; cc.fillRect(left + 1, my, Math.max(1, mw - 2), 1);
  cc.fillStyle = '#c85d76'; cc.fillRect(mx - 1, my + mh - 3, Math.min(3, mw - 1), 1);
  return canv;
});
function drawHead(c, i, o = {}, flip = false) {
  const H = META.heads; c.clearRect(0, 0, H.w, H.h);
  c.save(); c.imageSmoothingEnabled = false; if (flip) { c.translate(H.w, 0); c.scale(-1, 1); }
  blitHead(c, headKey(i, o), 0, 0); c.restore();
}
const blit = (c, img, r, x, y, w, h) => c.drawImage(img, r[0], r[1], r[2], r[3], x, y, w, h);
function drawCar(c, x, y, towards, left, color, zoom) {
  // Frame 0 is the front (driving towards us, down-right); frame 1 the back (away, up-right). Mirror for leftward.
  const r = PR.cars[color * 2 + (towards ? 0 : 1)], w = Math.round(r[2] * zoom), h = Math.round(r[3] * zoom);
  // Personal cars: swap wheel-spoke positions every 110 ms. Generic traffic stays unchanged.
  const spin = color >= 2 && Math.floor((G.clock - G.carStart) / 110) % 2 === 1;
  const atlas = spin && IMG.carsSpin ? IMG.carsSpin : IMG.cars;
  const frame = spin && PR.carsSpin ? PR.carsSpin[color * 2 + (towards ? 0 : 1)] : r;
  c.save(); c.translate(Math.round(x), Math.round(y)); if (left) c.scale(-1, 1); blit(c, atlas, frame, -Math.round(w / 2), -h + Math.round(9 * zoom), w, h); c.restore();
}
function drawCollector(c, x, y, picking, time, zoom, reverse) {
  const r = PR.collector[picking ? 2 + Math.floor(time / 650) % 2 : Math.floor(time / 260) % 2], w = Math.round(r[2] * zoom), h = Math.round(r[3] * zoom);
  c.save(); c.translate(Math.round(x), Math.round(y)); if (reverse) c.scale(-1, 1); blit(c, IMG.collector, r, -Math.round(w / 2), -h, w, h); c.restore();
}
function drawTruck(c, x, y, serving, zoom) { // Pinky's van exactly as drawn, both frames on one ground point
  const k = serving ? 1 : 0, r = PR.pinky[k], a = META.pinkyArt.anchors[k];
  blit(c, IMG.pinky, r, Math.round(x - a[0] * zoom), Math.round(y - a[1] * zoom), Math.round(r[2] * zoom), Math.round(r[3] * zoom));
}
function drawExhaust(el, zm) {
  // Puffs leave the rear bumper and hang in the air while the van tears away.
  const ex = META.pinkyArt.exhaust;
  for (let n = 0; n < 20; n++) {
    const born = n * 75, age = el - born; if (age < 0 || age > 650) continue;
    const u = born / PD.depart, a = project(22 * u * u * u, 0), life = age / 650;
    const x = a.x + (ex[0] - age * .035) * zm, y = a.y + (ex[1] - age * .02) * zm, s = Math.round((5 + age * .016) * zm); // from the rear bumper
    ctx.globalAlpha = .85 * (1 - life); ctx.fillStyle = n % 3 ? '#e8e4dc' : '#c9cbc2';
    ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
  }
  ctx.globalAlpha = 1;
}
function drawVendor(c, x, y, height) { const r = PR.pinky[2], w = Math.round(height * r[2] / r[3]); blit(c, IMG.pinky, r, Math.round(x - w / 2), Math.round(y - height), w, height); }
function drawCone(c, x, y, height = 49, eaten = 0) {
  if (eaten >= 1) return;
  const r = PR.pinky[3], w = Math.round(height * r[2] / r[3]), cut = clamp(eaten * .95, 0, .95), sy = Math.floor(r[3] * cut);
  c.drawImage(IMG.pinky, r[0], r[1] + sy, r[2], r[3] - sy, Math.round(x - w / 2), Math.round(y + height * sy / r[3]), w, Math.max(1, Math.round(height * (r[3] - sy) / r[3])));
}
function drawPlant(c, x, y, kind, scale) { const r = PR.plants[kind], w = Math.round(r[2] * scale), h = Math.round(r[3] * scale); blit(c, IMG.plants, r, Math.round(x - w / 2), Math.round(y - h), w, h); }
function drawWalker(c, x, y, time, reverse, zoom) {
  const img = Art.walker[Math.floor(time / 180) % 4];
  c.save(); c.translate(Math.round(x), Math.round(y)); if (reverse) c.scale(-1, 1);
  c.drawImage(img, -Math.round(64 * zoom), -Math.round(100 * zoom), Math.round(128 * zoom), Math.round(112 * zoom)); c.restore();
}

/* =====================================================================
   4. GAME STATE
   ===================================================================== */
const HOME = [2.6, -2.6];        // both families wait on their own pavement
const BALL_Z = 12 / 33;          // a resting ball sits on its own radius
const CONTACT = .57;             // fraction of a throw at which it meets the curb
const CAR_MS = 9000, PREP_MS = 2400;
const G = {
  screen: 'boot', phase: 'idle', clock: 0, lastInput: COARSE ? 'touch' : 'key',
  names: ['PHIL', 'SHAY'], avatars: [0, 1], cpu: false, controlMode: 'timing',
  match: { player: 0, scores: [0, 0], halfway: false, fiveStreak: 0, winner: null },
  power: .01, aim: .01, meterClock: 0, drag: null,
  shot: null, ball: null, caught: false, rest: null,
  throwNo: 0, bombs: [2, 2], noodleUntil: 0, noodleCaller: null, noodleThrow: -1, noodleAt: -1e9,
  nextDog: 0, dogStart: 0, dogUntil: 0, nextCar: 0, carStart: 0, carUntil: 0, carDir: 1, carColor: 0, carCount: 0, waitVariants: [0, 0, 0, 0, 0],
  nextCollector: 0, collectorStart: 0, collectorUntil: 0, collectorPair: false,
  prepStart: 0, prepBops: 0, resultAt: 0, resultHold: 0,
  boost: [false, false], pinkySeen: false, pinky: null,
  victor: null, victoryAt: 0, victoryDone: false, engineAt: 0,
  cpuToken: '', cpuAt: 0, cpuPlan: null, cpuBothered: false, cpuNoodleThrow: -1, cpuNoodleAt: 0, cpuBiteAt: 0,
  actorOpts: [{}, {}],
};
const sign = () => G.match.player === 0 ? 1 : -1;
const prepping = () => G.phase === 'ready' && G.match.halfway && G.clock - G.prepStart < PREP_MS;
const cpuTurn = () => G.cpu && G.match.player === 1;
const surfaceZ = (y) => (y >= 2 && y < 3) || (y >= -3 && y < -2) ? .14 : 0;

/* =====================================================================
   5. WORLD RENDERER — isometric ground, depth-sorted upright sprites.
   ===================================================================== */
const W = 960, H = 440;
const court = $('#court'), ctx = court.getContext('2d');
ctx.imageSmoothingEnabled = false;
const groundLayer = makeCanvas(W, H), gctx = groundLayer.getContext('2d');
let groundKey = '';
const view = { camera: 0, target: 0, zoom: 1, focus: 0, verticalPan: 0 };
function project(x, y, z = 0) {
  y -= view.focus;
  const c = Math.cos(view.camera), s = Math.sin(view.camera), a = x * c - y * s, b = x * s + y * c, zm = view.zoom;
  return { x: 480 + (a - b) * 29 * zm, y: 244 + view.verticalPan + 32 * (zm - 1) + (a + b) * 15 * zm - z * 33 * zm, depth: a + b };
}
function poly(c, pts, fill) { c.beginPath(); pts.forEach((p, i) => c[i ? 'lineTo' : 'moveTo'](Math.round(p.x), Math.round(p.y))); c.closePath(); c.fillStyle = fill; c.fill(); }
function flat(c, x, y, w, h, fill, z = 0) { poly(c, [project(x, y, z), project(x + w, y, z), project(x + w, y + h, z), project(x, y + h, z)], fill); }
function tile(c, x, y, kind, z) {
  const a = project(x, y, z), b = project(x + 1, y, z), d = project(x, y + 1, z);
  c.save(); c.transform((b.x - a.x) / 32, (b.y - a.y) / 32, (d.x - a.x) / 32, (d.y - a.y) / 32, a.x, a.y);
  c.drawImage(tileCanvases[kind], 0, 0, 32.6, 32.6); c.restore(); // overlap so edges never part mid-zoom or mid-swing
}
function curbFaceVisible(roadSide) { const toward = Math.cos(view.camera) - Math.sin(view.camera); return roadSide === 'high' ? toward > 1e-6 : toward < -1e-6; }
function drawCurb(c, y0, y1, roadSide) {
  const roadY = roadSide === 'high' ? y1 : y0;
  if (curbFaceVisible(roadSide)) poly(c, [project(-18, roadY, 0), project(18, roadY, 0), project(18, roadY, .14), project(-18, roadY, .14)], roadSide === 'high' ? '#9aa79e' : '#a8b2a8');
  flat(c, -18, y0, 36, y1 - y0, '#eee8d2', .14);
  c.strokeStyle = '#d4ceba'; c.lineWidth = 1;
  for (let x = -18; x < 18; x++) { const a = project(x, y0, .145), b = project(x, y1, .145); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
}
function renderGround() {
  const key = view.camera.toFixed(4) + '|' + view.zoom.toFixed(4) + '|' + view.focus.toFixed(4) + '|' + view.verticalPan.toFixed(3);
  if (key === groundKey) return;
  groundKey = key;
  const g = gctx;
  g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false; g.fillStyle = tileAvg[0]; g.fillRect(0, 0, W, H);
  // Underlay each zone in its tiles' own average colour, so a tile edge that lands between pixels
  // (while zooming or swinging) blends with matching colour instead of showing a grid line.
  flat(g, -18, -10, 36, 3, tileAvg[3], -.08); flat(g, -18, -2, 36, 4, tileAvg[1]);
  flat(g, -18, -3, 36, 1, tileAvg[2], .14); flat(g, -18, 2, 36, 1, tileAvg[2], .14);
  const tiles = [];
  for (let x = -18; x < 18; x++) for (let y = -17; y < 17; y++) {
    const p = project(x + .5, y + .5);
    if (p.x < -110 || p.x > W + 110 || p.y < -80 || p.y > H + 80) continue;
    const river = y >= -10 && y < -7, road = y >= -2 && y < 2, walk = y === -3 || y === 2;
    tiles.push({ d: p.depth, x, y, kind: river ? 3 : road ? 1 : walk ? 2 : 0, z: walk ? .14 : river ? -.08 : 0 });
  }
  tiles.sort((a, b) => a.d - b.d).forEach((t) => tile(g, t.x, t.y, t.kind, t.z));
  drawCurb(g, -2.13, -2, 'high'); drawCurb(g, 2, 2.13, 'low');
  for (let x = -18; x < 18; x++) { flat(g, x, -7.05, 1, .12, '#c2b870'); flat(g, x, -10.05, 1, .12, '#c2b870'); }
  for (let n = 0; n < 72; n++) flat(g, -18 + n * .5, -6.85 + (n % 3) * .13, .22, .13, n % 2 ? '#47763a' : '#698d3c');
}
function shadow(x, y, rx = 15, ry = 6) {
  const p = project(x, y, surfaceZ(y)); ctx.fillStyle = '#17372d40';
  ctx.beginPath(); ctx.ellipse(p.x, p.y + 2 * view.zoom, rx * view.zoom, ry * view.zoom, 0, 0, Math.PI * 2); ctx.fill();
}
function fenceSegment(n) {
  const x = -18 + n, zm = view.zoom;
  const line = (pts, color, width = 1) => {
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, width * zm); ctx.beginPath();
    pts.forEach((v, i) => { const p = project(v[0], -6.3, v[1]); ctx[i ? 'lineTo' : 'moveTo'](Math.round(p.x), Math.round(p.y)); }); ctx.stroke();
  };
  line([[x, .08], [x + 1, .08]], '#244b3c'); line([[x, .87], [x + 1, .87]], '#244b3c');
  if (n % 3 === 0) line([[x, 0], [x, 1.02]], '#153e32', 2);
  for (let j = 0; j < 2; j++) { const a = x + j * .5; line([[a, 0], [a, .88], [a + .035, .98], [a + .1, 1.04], [a + .18, 1.06], [a + .26, 1.04], [a + .325, .98], [a + .36, .88], [a + .36, 0]], '#1c4937'); }
}

function standPos(i, t) {
  if (G.phase === 'pinky' && G.pinky) return Pinky.player(G.pinky, i, t);
  const m = G.match, here = i === m.player && m.halfway && G.phase !== 'traffic';
  return { x: 0, y: here ? 0 : HOME[i] };
}
function actorOptions(i, t, pos) {
  const m = G.match, me = i === m.player, P = G.phase, s = G.shot, pk = P === 'pinky' ? G.pinky : null;
  const o = { scale: 2 * view.zoom, animate: !REDUCED, time: t };
  if (pk) {
    o.flip = project(0, 0).x < project(pos.x, pos.y).x;
    if (pos.cheer) { o.arms = true; o.jump = Math.max(0, Math.sin(t * .012)) * 7; }
    if (pos.walking) o.jump = Math.abs(Math.sin(t * .018)) * 1.8;
    if (pk.stage === 'serve' && t - pk.stageStart > 900) { o.eating = true; o.eaten = 0; }
    if (pk.stage === 'heard') o.shout = true; // "wait, do you hear…"
    return o;
  }
  const other = standPos(1 - i, t);
  o.flip = project(other.x, other.y).x < project(pos.x, pos.y).x; // face the other player, whichever way the street is turned
  if (G.victor === i) { o.arms = true; o.jump = Math.max(0, Math.sin(t * .017)) * 13; return o; }
  if (G.victor !== null) { o.mood = 'annoyed'; return o; }
  if (P === 'traffic') { o.waiting = true; o.waitFor = t - G.carStart; o.variant = G.waitVariants[G.avatars[i]]; return o; }
  if (!me) { if ((G.noodleCaller === i && t - G.noodleAt < NOODLE_HOLD) || s?.bigCheer) o.shout = true; return o; }
  const bothered = t - G.noodleAt < 1100 && t >= G.noodleAt;
  const elapsed = s ? t - s.start : 0;
  if (P === 'ready' && prepping()) {
    // A real bounce: quickest at the road with a sharp turn there, floating up to the hand at the top.
    const ph = (((t - G.prepStart - 400) % 800) + 800) % 800, rise = 1 - Math.pow((ph - 400) / 400, 2);
    o.bounce = 1 - rise; o.squash = Math.max(0, 1 - Math.min(ph, 800 - ph) / 32); // only while touching the road o.spin = t * .008; return o;
  }
  o.throwing = ['power', 'aim', 'dragging'].includes(P) || (P === 'ready' && m.halfway);
  if (s && (P === 'flight' || P === 'result')) {
    const hit = s.revealed && s.outcome.points > 0, miss = s.revealed && !s.outcome.points;
    o.follow = elapsed < (s.halfway ? 420 : 900) || (s.halfway && hit && elapsed > s.duration * .87);
    if (miss) o.mood = 'annoyed';
    if (hit) {
      if (s.bigCheer) { o.arms = true; o.jump = Math.max(0, Math.sin(t * .012)) * 8; }
      else if (G.caught) o.catching = true;
      else if (!(s.halfway && elapsed > s.duration * .87)) o.punch = true;
    }
  }
  if (bothered) o.mood = 'annoyed';
  return o;
}

// CURBS_SHADOW_MOUTH_SWAP_V1: van-specific main street shadow; no effect on race/celebration.
// PINKY_ISO_SHADOW_CALIBRATED_V1: exact calibrated source-pixel polygon, relative to the
// main gameplay isometric van's shared (123,205) ground anchor.
function drawStreetPinkyShadow(p, zoom) {
  const verts = [[-135,-62],[-12,4],[23,6],[106,-29],[-55,-102]];
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#21233b';
  ctx.beginPath();
  verts.forEach(([localX, localY], i) => {
    const x = Math.round(p.x + localX * zoom);
    const y = Math.round(p.y + localY * zoom);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
function drawScene(t) {
  renderGround();
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
  ctx.drawImage(groundLayer, 0, 0);
  for (let i = 0; i < 26; i++) { // ripples drift downstream
    const x = ((i * 1.73 + t * .00022 + 18) % 36) - 18, y = -9.65 + (i % 5) * .52;
    flat(ctx, x, y, .3 + (i % 3) * .12, .045, i % 2 ? '#45c2d1' : '#8bdbe1', -.07);
  }
  const zm = view.zoom, props = [];
  const add = (x, y, draw) => props.push({ d: project(x, y).depth, draw });
  // Anything standing in front of the thrower and overlapping them is drawn see-through.
  const sp0 = standPos(G.match.player, t), tp = project(sp0.x, sp0.y, surfaceZ(sp0.y));
  const veil = (p, halfW, height) => (G.phase !== 'pinky' && p.depth > tp.depth + .05 && Math.abs(p.x - tp.x) < halfW + 22 * zm && p.y - height < tp.y && p.y > tp.y - 82 * zm) ? .42 : 1;
  for (let n = 0; n < 36; n++) add(-17.5 + n, -6.3, () => fenceSegment(n));
  for (let n = 0; n < 55; n++) { const x = -17.8 + n * .65, y = -6.65 - (n % 4) * .09, k = n % 4 === 0 ? 2 : 3, sc = (k === 2 ? .7 : .38) + (n % 3) * .09; add(x, y, () => { const p = project(x, y); drawPlant(ctx, p.x, p.y, k, sc * zm); }); }
  [-12, -9, -6, -4.6, 4.6, 6.6, 9, 12].forEach((x, i) => { const y = -4.9 - (i % 2) * .45; add(x, y, () => { const p = project(x, y), sc = (.88 + (i % 3) * .09) * zm; ctx.globalAlpha = veil(p, 48 * sc, 110 * sc); drawPlant(ctx, p.x, p.y, i % 2, sc); ctx.globalAlpha = 1; }); });
  for (let i = 0; i < 10; i++) {
    const x = -13 + i * 2.8; add(x, -6.8, () => { const p = project(x, -6.8); drawPlant(ctx, p.x, p.y, 3, .8 * zm); });
    if (i % 3 === 0) add(x, -5.2, () => { const p = project(x, -5.2); drawPlant(ctx, p.x, p.y, 2, .9 * zm); });
  }
  // The family.
  for (let i = 0; i < 2; i++) {
    const pos = standPos(i, t), o = actorOptions(i, t, pos);
    G.actorOpts[i] = o;
    add(pos.x, pos.y, () => {
      const z = surfaceZ(pos.y), p = project(pos.x, pos.y, z);
      shadow(pos.x, pos.y);
      if (i === G.match.player && t - G.noodleAt < 1100 && t >= G.noodleAt && !REDUCED) p.x += Math.round(Math.sin((t - G.noodleAt) * .065) * 3 * zm);
      drawCharacter(ctx, p.x, p.y, G.avatars[i], o);
      const top = p.y - (90 + (o.jump || 0) * 2) * zm;
      if (G.phase === 'pinky' && G.pinky?.stage === 'heard') outlinedText('!', p.x, p.y - 92 * zm, Math.round(24 * zm), '#ffe493', '#374b32');
      if (G.victor === i) drawCrown(p.x, p.y - (85 + (o.jump || 0) * 2) * zm, zm);
      if (G.spurl && G.spurl.p === i && t - G.spurl.at < SPURL_MS) drawSpurl(p.x + (o.flip ? -3 : 3) * zm, p.y - 82 * zm, t - G.spurl.at, zm); // floats just clear of the head
      if (i === G.match.player && G.victor === null && ['ready', 'power', 'aim', 'dragging'].includes(G.phase)) poly(ctx, [{ x: p.x - 5, y: top }, { x: p.x + 5, y: top }, { x: p.x, y: top + 6 }], '#fff7db');
    });
  }
  // Neighbourhood.
  if (t < G.dogUntil) { const u = (t - G.dogStart) / (G.dogUntil - G.dogStart), x = -9 + u * 18, y = -4.25; add(x, y, () => { shadow(x, y, 27, 6); const p = project(x, y), q = project(x + .2, y); ctx.globalAlpha = veil(p, 40 * zm, 76 * zm); drawWalker(ctx, p.x, p.y, t, q.x < p.x, zm); ctx.globalAlpha = 1; }); }
  if (t >= G.carStart && t < G.carUntil) { const x = (-13 + (t - G.carStart) / CAR_MS * 26) * G.carDir; add(x, .5, () => { shadow(x, .5, 45, 13); const p = project(x, .5), q = project(x + .2 * G.carDir, .5); ctx.globalAlpha = veil(p, 52 * zm, 80 * zm); drawCar(ctx, p.x, p.y, q.y > p.y, q.x < p.x, G.carColor, zm); ctx.globalAlpha = 1; }); }
  if (t < G.collectorUntil) {
    for (let k = 0; k < (G.collectorPair ? 2 : 1); k++) {
      const e = t - G.collectorStart - k * 1300; if (e < 0) continue;
      const picking = e > 5000 && e < 17000, x = (e < 5000 ? 12 - e / 5000 * 6 : e < 17000 ? 6 : 6 + (e - 17000) / 5000 * 6) + k * 1.5, y = -5.6 - k * .35;
      add(x, y, () => { shadow(x, y, 18, 6); const p = project(x, y); ctx.globalAlpha = veil(p, 32 * zm, 80 * zm); drawCollector(ctx, p.x, p.y, picking, e, zm, e < 5000); ctx.globalAlpha = 1; });
    }
  }
  if (G.phase === 'pinky' && G.pinky) {
    const tx = Pinky.truckX(G.pinky, t);
    if (tx !== null) add(tx, 0, () => {
      const p = project(tx, 0);
      drawStreetPinkyShadow(p, zm);
      drawTruck(ctx, p.x, p.y, ['serve', 'countdown', 'race', 'result', 'return'].includes(G.pinky.stage), zm);
      if (G.pinky.stage === 'depart') drawExhaust(t - G.pinky.stageStart, zm);
    });
  }
  // The ball, tucked behind the thrower until it clears their face.
  const b = G.ball || G.rest;
  if (b) {
    let d = project(b.x, b.y).depth;
    if (G.ball && G.phase === 'flight' && G.shot && t - G.shot.start < (G.shot.halfway ? 380 : 900)) {
      const air = project(b.x, b.y, b.z), sp = standPos(G.match.player, t), th = project(sp.x, sp.y, surfaceZ(sp.y));
      if (Math.abs(air.x - th.x) < 43 * zm && air.y > th.y - 86 * zm && air.y < th.y + 12 * zm) d = Math.min(d, th.depth - .01);
    }
    props.push({ d, draw: () => { shadow(b.x, b.y, 6, 3); const p = project(b.x, b.y, b.z); drawBall(ctx, p.x, p.y, 12 * zm, b.spin || 0, b.squash || 0); } });
  }
  props.sort((a, c) => a.d - c.d).forEach((o) => o.draw());
  if (G.phase === 'dragging' && G.drag) drawDragGuide();
  if (G.noodleCaller !== null && t >= G.noodleAt && t - G.noodleAt < NOODLE_HOLD + 3 * NOODLE_PUFF) drawNoodleBubble(t - G.noodleAt);
  if (G.victor !== null && G.phase !== 'pinky') drawConfetti(t - G.victoryAt);
}
function outlinedText(text, x, y, size, fill, stroke) {
  ctx.save(); ctx.font = size + 'px "CF Arcade", "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.lineWidth = 4; ctx.strokeStyle = stroke; ctx.lineJoin = 'miter'; ctx.strokeText(text, x, y); ctx.fillStyle = fill; ctx.fillText(text, x, y); ctx.restore();
}
const SPURL_MS = 1800;
function drawSpurl(x, bottom, age, zm) {
  // Fizzes through its three frames, pops up from the head, and fades at the end.
  const r = META.spurl[Math.floor(age / 110) % 3], w = Math.round(r[2] * zm), h = Math.round(r[3] * zm), rise = age < 90 ? Math.round((1 - age / 90) * 6 * zm) : 0;
  ctx.globalAlpha = age > SPURL_MS - 260 ? Math.max(0, (SPURL_MS - age) / 260) : 1;
  ctx.drawImage(IMG.spurl, r[0], r[1], r[2], r[3], Math.round(x - w / 2), Math.round(bottom - h + rise), w, h);
  ctx.globalAlpha = 1;
}
function drawCrown(x, y, zm) {
  const s = zm;
  ctx.save(); poly(ctx, [{ x: x - 10 * s, y }, { x: x - 10 * s, y: y - 8 * s }, { x: x - 5 * s, y: y - 4 * s }, { x, y: y - 11 * s }, { x: x + 5 * s, y: y - 4 * s }, { x: x + 10 * s, y: y - 8 * s }, { x: x + 10 * s, y }], '#f5c84e');
  ctx.strokeStyle = '#a36c36'; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = '#e1495f'; ctx.fillRect(Math.round(x - 1.5 * s), Math.round(y - 5 * s), Math.round(3 * s), Math.round(3 * s)); ctx.restore();
}
function drawConfetti(e) {
  for (let i = 0; i < 60; i++) {
    const x = (i * 173 + Math.sin(e * .001 + i) * 25 + 960) % 960, y = ((e * .065 + i * 47) % 490) - 30;
    ctx.fillStyle = ['#f3ce69', '#ee7998', '#fff3cf', '#7fcaaf', '#8f86ff'][i % 5]; ctx.fillRect(Math.round(x), Math.round(y), 3 + i % 3, 3 + i % 2);
  }
}
const NOODLE_HOLD = 2000, NOODLE_PUFF = 110;   // two seconds up, then three quick frames of cloud
const PUFF = ['..###..', '.#####.', '#######', '#######', '.#####.'];
function puff(x, y, s, alpha) { // a little pixel cloud, outlined like the bubble
  ctx.globalAlpha = alpha;
  for (const [col, grow] of [['#30254f', 1], ['#fff4d2', 0]]) {
    ctx.fillStyle = col;
    PUFF.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') ctx.fillRect(Math.round(x + (i - 3.5) * s - grow * s), Math.round(y + (j - 2.5) * s - grow * s), s + 2 * grow * s, s + 2 * grow * s); });
  }
  ctx.globalAlpha = 1;
}
function drawNoodleBubble(age) {
  const zm = view.zoom, p = project(0, HOME[G.noodleCaller], surfaceZ(HOME[G.noodleCaller])), w = 186, h = 49;
  const x = Math.max(8, Math.min(W - w - 8, p.x - w / 2)), y = Math.max(8, p.y - 92 * zm - h);
  if (age >= NOODLE_HOLD) { // the bubble breaks up into clouds that drift apart and shrink
    const k = Math.min(2, Math.floor((age - NOODLE_HOLD) / NOODLE_PUFF)), n = [5, 6, 7][k], s = [3, 2, 1][k], spread = [0, 9, 18][k], rise = [0, 6, 13][k];
    for (let i = 0; i < n; i++) {
      const u = (i + .5) / n, cx = x + 12 + u * (w - 24) + (u - .5) * spread * 2, cy = y + h / 2 + ((i % 2) ? -1 : 1) * (6 + spread * .5) - rise;
      puff(cx, cy, s, [1, .85, .6][k]);
    }
    return;
  }
  ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = '#30254f'; ctx.fillStyle = '#fff4d2'; ctx.beginPath();
  ctx.moveTo(x + 5, y); ctx.lineTo(x + w - 5, y); ctx.lineTo(x + w, y + 5); ctx.lineTo(x + w, y + h - 5); ctx.lineTo(x + w - 5, y + h);
  ctx.lineTo(Math.min(x + w - 20, Math.max(x + 20, p.x + 10)), y + h); ctx.lineTo(p.x, p.y - 75 * zm); ctx.lineTo(Math.min(x + w - 35, Math.max(x + 10, p.x - 8)), y + h);
  ctx.lineTo(x + 5, y + h); ctx.lineTo(x, y + h - 5); ctx.lineTo(x, y + 5); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#6f2a7e'; ctx.font = '19px "CF Arcade", "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('NOODLES!', x + w / 2, y + h / 2 + 1); ctx.restore();
}
function drawDragGuide() {
  const sg = sign(), m = G.match, start = m.halfway ? 0 : HOME[m.player], range = (m.halfway ? 2.04 : 4.64) * G.power / .67;
  const rel = worldOffset(sg * (HOLD[G.avatars[m.player]][0] - 64), view.target);
  ctx.save();
  for (let i = 0; i < 17; i++) {
    const q = i / 30, p = project(rel.x * (1 - q) + sg * (G.aim - .5) * 6 * q, start + rel.y * (1 - q) - sg * range * q, 2 * (1 - q) + Math.sin(q * Math.PI) * (m.halfway ? .15 : 2.2));
    ctx.globalAlpha = .9 * (1 - i / 17); ctx.fillStyle = '#fff9d4'; ctx.fillRect(Math.round(p.x - 2), Math.round(p.y - 2), 4, 4);
  }
  ctx.restore();
}

/* =====================================================================
   6. THROWS — the outcome is judged once at release, then revealed by
   the ball's flight at the exact contact that decides it.
   ===================================================================== */
function worldOffset(sx, cam) { // a sideways screen offset (zoom 1) as a ground-plane offset for this camera
  const a = sx / 58, b = -sx / 58, c = Math.cos(cam), s = Math.sin(cam);
  return { x: a * c + b * s, y: -a * s + b * c };
}
function makeShot(outcome) {
  const m = G.match, sg = sign(), i = G.avatars[m.player], halfway = m.halfway;
  const startY = halfway ? 0 : HOME[m.player], target = -sg * 2.04;
  const dx = HOLD[i][0] - 64, dy = HOLD[i][1] - 100;
  const rel = worldOffset(sg * dx, view.target), hand = worldOffset(sg * 30, view.target); // P2 faces left, so their release mirrors
  let hitY = target;
  if (outcome.kind === 'short') hitY = target + sg * 1.1;
  if (outcome.kind === 'long') hitY = target - sg * 1.2;
  return {
    outcome, halfway, sg, startY, hitY,
    hitX: outcome.kind === 'wide' ? sg * outcome.side * Math.max(.14, Math.abs(G.aim - .5)) * 6 : 0, // aim left lands screen-left
    x0: rel.x, y0: startY + rel.y, z0: surfaceZ(startY) - dy / 33,
    hand: { x: hand.x, y: startY + hand.y, z: 54 / 33 },
    duration: outcome.kind === 'double' ? 3700 : halfway ? 1250 : 2600,
    contact: halfway ? .42 : CONTACT,   // halfway: about half a second to the curb
    start: G.clock, impact: false, done: false, revealed: false, bigCheer: false,
  };
}
function ballAt(s, f) {
  const o = s.outcome, R = BALL_Z;
  if (f < s.contact) {
    const q = s.halfway ? 1 - Math.pow(1 - f / s.contact, 1.35) : f / s.contact; // halfway throws leave the hand quick
    return { x: lerp(s.x0, s.hitX, q), y: lerp(s.y0, s.hitY, q), z: lerp(s.z0, surfaceZ(s.hitY) + R, q) + Math.sin(q * Math.PI) * (s.halfway ? .15 : 2.2) };
  }
  const q = (f - s.contact) / (1 - s.contact), arc = Math.sin(q * Math.PI);
  if (o.kind === 'double') return { x: s.hitX, y: lerp(s.hitY, s.sg * 2.07, q), z: lerp(R, .14 + R, q) + arc * 2.4 };
  if (o.points && s.halfway) return { x: lerp(s.hitX, s.hand.x, q), y: lerp(s.hitY, s.hand.y, q), z: lerp(R, s.hand.z, q) + arc * .2 };
  if (o.points) return { x: s.hitX, y: lerp(s.hitY, s.hitY + s.sg * 1.7, q), z: R + arc * .8 };
  const endY = s.hitY - s.sg * .4;
  // An extra small bounce as the missed ball settles onto the pavement.
  const smallBounce = q > .65 ? Math.sin((q - .65) / .35 * Math.PI) * .16 : 0;
  return { x: s.hitX + (o.kind === 'wide' ? q * .6 * o.side * s.sg : 0), y: lerp(s.hitY, endY, q), z: surfaceZ(lerp(s.hitY, endY, q)) + R + arc * .5 + smallBounce };
}
const HIT_WORDS = ['LOVELY CURB!', 'CRACKING!', 'GET IN!', 'TEXTBOOK!', 'CLASSIC!'];
const isLeading = () => G.match.scores[G.match.player] > G.match.scores[1 - G.match.player];
function onImpact(s) {
  const o = s.outcome;
  s.revealed = true;
  if (o.points) {
    Sound.sfx('curb');
    const first = o.kind === 'double' ? 10 : o.points; // a Double Trouble looks like any curb until it comes home
    const m = G.match, winning = m.winner === null && m.scores[m.player] + first >= Rules.WIN;
    if (!winning) showFloat('+' + first, s.halfway ? phrase('streak', 'KEEP IT GOING!', G.throwNo) : phrase('hit', HIT_WORDS[G.throwNo % HIT_WORDS.length], G.throwNo)); // a winning hit is announced by the win itself
    addPoints(first);
  } else {
    Sound.sfx('bounce'); if (!Sound.say('sfx-miss', 'miss')) Sound.sfx('miss');
    if (o.bad) G.spurl = { p: G.match.player, at: G.clock }; // a fuming scribble over the thrower's head
    const category = o.chance ? 'near' : o.kind === 'short' ? 'short' : o.kind === 'long' ? 'long' : o.side < 0 ? 'left' : 'right';
    const defaults = { near: 'SO CLOSE!', short: 'NOT ENOUGH!', long: 'TOO MUCH!', left: 'A BIT LEFT!', right: 'A BIT RIGHT!' };
    const words = phrase(category, defaults[category], G.throwNo);
    // Noodles bubble remains legible; retain the smaller NO POINTS line only.
    const noodlesOnThisThrow = G.noodleCaller !== null && G.noodleCaller !== G.match.player && G.noodleThrow === G.throwNo;
    showFloat(noodlesOnThisThrow ? '' : words, 'NO POINTS', true);
  }
}
function onFlightEnd(s) {
  const o = s.outcome;
  if (o.kind === 'double') {
    Sound.sfx('curb');
    s.bigCheer = true;
    addPoints(20, true);
    if (G.victor !== null) $('#winner-sub').textContent = 'DOUBLE TROUBLE! +30'; // one message, not two banners
    else showBanner('DOUBLE<br>TROUBLE!', '<b>+30</b>', 'double', 2600);
    // Use the recorded announcement at the reveal, even when it also wins the match.
    if (G.victor === null && !Sound.say('voice-double-trouble', 'double-trouble')) Sound.sfx('double');
  } else if (o.points && s.halfway) { G.caught = true; G.ball = null; Sound.sfx('catch'); }
  else { Sound.sfx('bounce'); }
  if (G.ball) { G.ball.z = surfaceZ(G.ball.y) + BALL_Z; G.rest = G.ball; G.ball = null; }
  G.phase = 'result'; G.resultAt = G.clock;
  G.resultHold = G.victor !== null ? Infinity : o.kind === 'double' ? 2600 : o.points ? 1000 : 1500;
  hud();
}
function addPoints(n, silent = false) {
  const m = G.match, p = m.player;
  m.scores[p] += n;
  const el = $('#score' + p); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  if (m.scores[p] >= Rules.WIN && m.winner === null) beginVictory(p);
  else if (!silent) Sound.sfx('hit');
  hud();
}
function beginVictory(p) {
  G.match.winner = p; G.victor = p; G.victoryAt = G.clock; G.victoryDone = false;
  $('#winner-name').textContent = G.names[p] + ' WINS!'; $('#winner-sub').textContent = 'STREET CHAMPION';
  $('#winner').hidden = false;
  // The winning hit on the street gets ONLY the recorded 'yeah!'.
  Sound.say('sfx-yeah', 'victory-street');
}

/* =====================================================================
   7. TURN FLOW
   ===================================================================== */
function startMatch() {
  const m = G.match;
  m.player = 0; m.scores = [0, 0]; m.halfway = false; m.fiveStreak = 0; m.winner = null;
  Object.assign(G, {
    phase: 'ready', shot: null, ball: null, rest: null, caught: false, drag: null, throwNo: 0, bombs: [2, 2], boost: [false, false],
    noodleCaller: null, noodleThrow: -1, noodleAt: -1e9, noodleUntil: 0, pinkySeen: false, pinky: null, victor: null, victoryDone: false,
    nextCar: 5 + Math.floor(Math.random() * 3), carUntil: 0, carCount: 0, nextDog: 2 + Math.floor(Math.random() * 3), dogUntil: 0,
    nextCollector: 3 + Math.floor(Math.random() * 3), collectorUntil: 0, cpuToken: '', cpuNoodleThrow: -1, cpuNoodleAt: 0,
  });
  view.camera = view.target = 0; view.zoom = 1; view.focus = 0; view.verticalPan = 0; groundKey = '';
  $('#winner').hidden = true; $('#banner').hidden = true; $('#race').hidden = true;
  Sound.forget('game');
  setScreen('game');
  ready();
}
function ready() {
  const m = G.match, p = m.player;
  Object.assign(G, { noodleCaller: null, noodleThrow: -1, noodleAt: -1e9, noodleUntil: 0, caught: false, shot: null, ball: null, drag: null, power: .01, aim: .01, meterClock: 0, queuedStart: false, spurl: null });
  if (G.boost[p] && m.halfway) { m.halfway = false; m.fiveStreak = 0; } // 99 BOOST always starts a fresh curb streak
  G.rest = m.halfway ? null : { x: sign() * .45, y: HOME[p] - sign() * .18, z: .14 + BALL_Z, spin: 0 };
  view.target = p === 0 ? 0 : Math.PI / 2; if (REDUCED) view.camera = view.target; // P2: bottom-right, throwing right to left
  G.phase = 'ready'; G.prepStart = G.clock; G.prepBops = 0;
  if (Pinky.eligible()) { beginPinky(false); return; }
  if (!m.halfway && G.throwNo >= G.nextCar) { beginTraffic(); return; }
  if (G.throwNo >= G.nextDog && G.clock >= G.dogUntil) { G.nextDog = G.throwNo + 6 + Math.floor(Math.random() * 5); G.dogStart = G.clock; G.dogUntil = G.clock + 12000; }
  if (G.throwNo >= G.nextCollector && G.clock >= G.collectorUntil) { G.nextCollector = G.throwNo + 6 + Math.floor(Math.random() * 5); G.collectorStart = G.clock; G.collectorUntil = G.clock + 24000; G.collectorPair = Math.random() < .5; }
  hud();
}
function backToReady() { // a cancelled drag or rotation: same turn, no new neighbourhood events
  const m = G.match;
  G.drag = null; G.phase = 'ready'; G.power = .01; G.aim = .01;
  G.rest = m.halfway ? null : { x: sign() * .45, y: HOME[m.player] - sign() * .18, z: .14 + BALL_Z, spin: 0 };
  hud();
}
function startPower() { Sound.unlock(); G.phase = 'power'; G.meterClock = 0; G.meterStart = G.clock; G.queuedStart = false; G.rest = null; Sound.sfx('lock', 0); hud(); }
function lockPower() { G.phase = 'aim'; G.meterClock = 0; G.meterStart = G.clock; Sound.sfx('lock', 1); hud(); }
function launch() {
  const m = G.match, boosted = G.boost[m.player] && !m.halfway;
  const outcome = Rules.judge(G.power, G.aim, m.halfway, boosted, Math.random(), m.fiveStreak, isLeading());
  if (G.boost[m.player]) G.boost[m.player] = false; // one throw only
  G.shot = makeShot(outcome); G.rest = null; G.drag = null; G.phase = 'flight';
  Sound.sfx('throw', m.halfway); hud();
}
function endTurn() {
  const m = G.match, o = G.shot?.outcome;
  G.throwNo++;
  if (o && o.points) {
    // 10/30-pointer resets the difficulty; consecutive 5s progressively tighten it.
    m.fiveStreak = o.points === 5 ? m.fiveStreak + 1 : 0;
    m.halfway = true;
  } else {
    m.player = 1 - m.player; m.halfway = false; m.fiveStreak = 0;
  }
  G.shot = null; ready();
}
function act(p) {
  const P = G.phase;
  if (P === 'result') { if (G.victor === null && G.clock - G.resultAt > 350 && p === nextKeyPlayer()) endTurn(); return; }
  if (p !== G.match.player) return;
  if (P === 'ready') { if (G.controlMode === 'drag' && !cpuTurn()) return; if (prepping() && cpuTurn()) return; startPower(); }
  else if (P === 'power') lockPower();
  else if (P === 'aim') launch();
}
function tap(p) {
  // One tap does what the player means: skip the replay pause, then start their throw.
  if (G.phase === 'result') {
    if (G.victor !== null || G.clock - G.resultAt < 350 || p !== nextKeyPlayer()) return;
    endTurn();
    if (G.phase === 'ready') requestStart(p);
    return;
  }
  if (G.phase === 'ready') { requestStart(p); return; }
  if (G.clock - G.meterStart < 220) return; // a quick double tap never locks a meter by accident
  act(p);
}
function requestStart(p) {
  if (p !== G.match.player || cpuTurn() || G.controlMode !== 'timing') return;
  startPower(); // during the practice bounces this cuts them short: the ball snaps back to their hands
}
const nextKeyPlayer = () => G.phase === 'result' && G.shot && !G.shot.outcome.points ? 1 - G.match.player : G.match.player;
function noodle(i) {
  if (i === G.match.player || G.bombs[i] <= 0 || !['power', 'aim', 'dragging'].includes(G.phase) || G.victor !== null || G.clock < G.noodleUntil) return; // one per throw
  G.bombs[i]--; G.noodleUntil = G.clock + 6500; G.noodleCaller = i; G.noodleThrow = G.throwNo; G.noodleAt = G.clock;
  Sound.sfx('noodle', Sound.say('voice-noodles')); hud(); // the kids' shout, with the buzz underneath
}
function beginTraffic() {
  G.nextCar = G.throwNo + 7 + Math.floor(Math.random() * 4);
  G.carStart = G.clock; G.carUntil = G.clock + CAR_MS; G.carDir = Math.random() < .5 ? 1 : -1;
  // Generic cars always available. Phil's VW and Kim's Qashqai are independently
  // eligible only when their respective character is NOT one of the two players.
  // Both may appear if neither is playing; neither if both are playing.
  const familyCars = [];
  if (!G.avatars.includes(0)) familyCars.push(2); // Phil
  if (!G.avatars.includes(3)) familyCars.push(3); // Kim
  // Put absent family members' cars in the first two traffic events.
  G.carColor = G.carCount < familyCars.length ? familyCars[G.carCount] : [0, 1, ...familyCars][Math.floor(Math.random() * (2 + familyCars.length))];
  G.carCount++;
  G.waitVariants = [Math.floor(Math.random() * 4), Math.floor(Math.random() * 2), Math.floor(Math.random() * 2), Math.floor(Math.random() * 2), Math.floor(Math.random() * 2)];
  G.phase = 'traffic'; G.engineAt = 0; G.carBeeped = false;
  showBanner('CAR!', 'EVERYONE ON THE PAVEMENT', '', 1900);
  Sound.sfx('horn'); hud();
}
function completeMatch() {
  if (G.victoryDone) return;
  G.victoryDone = true;
  $('#winner').hidden = true;
  if (!G.pinkySeen) { beginPinky(true); return; } // Pinky never misses a game
  openCelebration();
}
/* The celebration: the front-on street, everyone out, ticker tape that never stops. */
const Cele = { time: 0, winner: 0, ctx: null };
function openCelebration() {
  const w = G.match.winner ?? G.victor ?? 0;
  Object.assign(Cele, { time: 0, winner: w });
  $('#cele-name').textContent = G.names[w] + ' WINS!';
  $('#cele-score').textContent = G.match.scores[w] + ' – ' + G.match.scores[1 - w];
  $('#cele-prompt').hidden = true;
  G.victor = null; G.phase = 'idle'; $('#banner').hidden = true; $('#race').hidden = true; $('#winner').hidden = true;
  setScreen('celebrate');
  // Start the spoken name, then WINS, only once the celebration is visible.
  Sound.sequence(['voice-' + G.names[w].toLowerCase(), 'voice-wins'],
    () => G.screen === 'celebrate' && Cele.winner === w);
}
const CELE_CHANTS = ['WHAT A CHAMP!', 'LEGEND!', '99s ON ME!'];
function renderCelebrate(dt) {
  Cele.time += dt;
  const c = Cele.ctx || (Cele.ctx = $('#celebrate-scene').getContext('2d')), t = Cele.time;
  c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = false;
  drawStreetBackdrop(c, t);
  const hop = (k, amp = 6) => REDUCED ? 0 : Math.round(Math.max(0, Math.sin(t * .011 + k * 1.7)) * amp);
  const shade = (x, y, rx) => { c.fillStyle = '#17372d40'; c.beginPath(); c.ellipse(x, y + 2, rx, rx * .25, 0, 0, Math.PI * 2); c.fill(); };
  // the back row on the pavement: conker collectors waving their grabbers, the dog walker and the dog
  shade(70, 318, 20); drawCollector(c, 70, 318 - hop(1, 4), true, t * 2.2, 1.25, false);
  shade(772, 318, 20); drawCollector(c, 772, 318 - hop(2, 4), true, t * 2.2 + 600, 1.25, true);
  shade(676, 320, 30); drawWalker(c, 676, 320 - hop(3, 5), t, true, 1.25);
  // Pinky's van parked behind, rocking, with Pinky cheering from the window
  const V = META.vanSide, rock = REDUCED ? 0 : Math.floor(t / 260) % 2, vx = Math.round(418 - V.w / 2), vy = 374 - V.h - rock;
  c.fillStyle = '#2a204055'; c.beginPath(); c.ellipse(418, 372, 150, 9, 0, 0, Math.PI * 2); c.fill();
  c.drawImage(IMG.vanSide, vx, vy);
  drawChant(c, vx + V.face[0], vy + V.face[1], vy, CELE_CHANTS[Math.floor(t / 1500) % CELE_CHANTS.length], t, true);
  // the family on the road, everyone celebrating, the winner lifting the golden ball
  const winAv = G.avatars[Cele.winner], others = SELECTABLE_AVATARS.filter((k) => k !== winAv);
  (others.length === 2 ? [215, 652] : others.length === 3 ? [165, 295, 652] : [120, 230, 605, 715]).forEach((x, k) => {
    const av = others[k], arms = Math.floor((t + k * 450) / 900) % 2 === 0;
    shade(x, 452, 26);
    drawCharacter(c, x, 452, av, { scale: 3.6, arms, punch: !arms, time: t + k * 130, jump: hop(k + 4, 3), flip: x > 418 });
  });
  shade(430, 456, 30);
  const tj = REDUCED ? 0 : Math.round(Math.max(0, Math.sin(t * .012)) * 7), tf = 2.1, img = Art.trophy[winAv];
  c.drawImage(img, Math.round(430 - 64 * tf), Math.round(456 - tj * 2 - 100 * tf), Math.round(128 * tf), Math.round(112 * tf));
  const hx = 430 + (HOLD[winAv][0] - 64) * tf, hy = 456 - tj * 2 + (HOLD[winAv][1] - 100) * tf;
  for (let k = 0; k < 6; k++) { // sparkles round the trophy
    if ((Math.floor(t / 160) + k) % 3) continue;
    const a = k / 6 * Math.PI * 2 + t * .001, sx = Math.round(hx + Math.cos(a) * 38), sy = Math.round(hy + Math.sin(a) * 34);
    c.fillStyle = k % 2 ? '#fff6c2' : '#ffe16a'; c.fillRect(sx - 1, sy - 4, 2, 8); c.fillRect(sx - 4, sy - 1, 8, 2);
  }
  // ticker tape, forever
  const cols = ['#f3ce69', '#ee7998', '#fff3cf', '#7fcaaf', '#8f86ff', '#ff9a4a'];
  for (let i = 0; i < 120; i++) {
    const sp = .045 + (i % 7) * .008, x = Math.round((i * 97 + Math.sin(t * .0014 + i) * 26 + 836) % 836), y = Math.round(((t * sp + i * 53) % 520) - 40);
    const turn = (Math.floor(t / 140) + i) % 3; c.fillStyle = cols[i % cols.length];
    c.fillRect(x, y, turn === 0 ? 2 : turn === 1 ? 4 : 6, turn === 0 ? 7 : turn === 1 ? 4 : 2);
  }
  if (t > 2200) $('#cele-prompt').hidden = false;
}
function leaveCelebration() { if (G.screen === 'celebrate' && Cele.time > 1200) { Sound.sfx('go'); returnToSelect(); } }
function returnToSelect() {
  G.victor = null; G.phase = 'idle'; $('#banner').hidden = true; $('#race').hidden = true; $('#winner').hidden = true;
  setScreen('select');
}

/* =====================================================================
   8. PINKY'S ICE CREAM VAN
   ===================================================================== */
const PINKY_BITES = 24;
const PINKY_LEADER_BITE_VALUE = .7; // 30% slower eating when leading by >=20 points
const PD = { heard: 3000, arrive: 4200, walk: 2400, serve: 2300, countdown: 4200, result: 3000, return: 2400, depart: 1500 };
const PNEXT = { heard: 'arrive', arrive: 'walk', walk: 'serve', serve: 'countdown', countdown: 'race', result: 'return', return: 'depart', depart: 'done' };
const PATHS = [[{ x: 0, y: HOME[0] }, { x: -.8, y: 1.5 }], [{ x: 0, y: HOME[1] }, { x: 3.4, y: -1.7 }, { x: 3.4, y: 1.5 }, { x: .9, y: 1.5 }]]; // round the van's nose to its serving side
function along(path, u) {
  const segs = []; let total = 0;
  for (let k = 1; k < path.length; k++) { const l = Math.hypot(path[k].x - path[k - 1].x, path[k].y - path[k - 1].y); segs.push(l); total += l; }
  let d = u * total;
  for (let k = 0; k < segs.length; k++) { if (d <= segs[k] || k === segs.length - 1) { const v = segs[k] ? clamp(d / segs[k]) : 1; return { x: lerp(path[k].x, path[k + 1].x, v), y: lerp(path[k].y, path[k + 1].y, v) }; } d -= segs[k]; }
  return path[path.length - 1];
}
const Pinky = {
  eligible() { const m = G.match; return !G.pinkySeen && m.winner === null && (Math.max(...m.scores) >= 85 || (!m.halfway && m.scores[0] + m.scores[1] > 50 && Math.random() < .06)); },
  truckX(e, now) {
    const u = clamp((now - e.stageStart) / (PD[e.stage] || 1));
    if (e.stage === 'heard' || e.stage === 'done') return null;
    if (e.stage === 'arrive') return -18 * (1 - u) * (1 - u);
    if (e.stage === 'depart') return 22 * u * u * u;
    return 0;
  },
  player(e, i, now) {
    const path = PATHS[i], stage = e.stage;
    if (['heard', 'arrive', 'depart', 'done'].includes(stage)) return { ...path[0], cheer: stage === 'arrive', walking: false };
    if (stage === 'walk' || stage === 'return') {
      let u = smooth(clamp((now - e.stageStart) / PD[stage])); if (stage === 'return') u = 1 - u;
      return { ...along(path, u), cheer: false, walking: true };
    }
    return { ...path[path.length - 1], cheer: false, walking: false };
  },
};
function beginPinky(post) {
  G.pinkySeen = true;
  const scores = G.match.scores;
  const handicapped = Math.abs(scores[0] - scores[1]) >= 20 ? (scores[0] > scores[1] ? 0 : 1) : null;
  G.pinky = { stage: 'heard', stageStart: G.clock, bites: [0, 0], lastTap: [-1e9, -1e9], handicapped, winner: null, wonAt: null, post };
  G.phase = 'pinky'; G.drag = null; G.ball = null; G.rest = null; view.target = 0; G.engineAt = 0;
  G.nextCar = Math.max(G.nextCar, G.throwNo + 2);
  Sound.music('pinky'); // the tune arrives before the van does
  Sound.sfx('surprise');
  showBanner('WAIT, DO YOU HEAR…', '', 'listen', PD.heard);
  hud();
}
function bite(p) {
  const e = G.pinky;
  if (!e || e.stage !== 'race' || e.bites[p] >= PINKY_BITES || G.clock - e.lastTap[p] < 55) return;
  e.lastTap[p] = G.clock;
  // Keep fractional progress for the score bar, cone animation and winner check.
  e.bites[p] = Math.min(PINKY_BITES, e.bites[p] + (e.handicapped === p ? PINKY_LEADER_BITE_VALUE : 1));
  Sound.sfx('munch', p, e.bites[p]);
  if (e.bites[p] >= PINKY_BITES && e.winner === null) { e.winner = p; e.wonAt = G.clock; }
}
function updatePinky() {
  const e = G.pinky; if (!e) return;
  const prev = e.stage, el = G.clock - e.stageStart;
  if (e.stage === 'race') {
    if ((e.wonAt !== null && (e.bites.every((n) => n >= PINKY_BITES) || G.clock - e.wonAt >= 2500)) || el >= 25000) {
      if (e.winner === null) e.winner = e.bites[0] === e.bites[1] ? null : e.bites[0] > e.bites[1] ? 0 : 1;
      e.stage = 'result'; e.stageStart = G.clock;
    }
  } else if (PD[e.stage] && el >= PD[e.stage]) {
    e.stage = PNEXT[e.stage]; e.stageStart = G.clock;
    if (e.stage === 'return') e.bites = [PINKY_BITES, PINKY_BITES];
  }
  // "Pinky's!": once as the van slows to a stop, once as it tears off the edge of the screen.
  const inStage = G.clock - e.stageStart; // fresh: the stage may have just changed above
  if (e.stage === 'arrive' && !e.chantIn && inStage >= PD.arrive * .78) { e.chantIn = true; Sound.say('voice-pinkys'); }
  if (e.stage === 'depart' && !e.chantOut && inStage >= 950) { e.chantOut = true; Sound.say('voice-pinkys'); }
  if (e.stage === prev) { if (['countdown', 'race', 'result'].includes(e.stage)) renderRace(); return; }
  switch (e.stage) {
    case 'arrive': showBanner('PINKY’S!!!', 'THAT CAN ONLY MEAN ONE THING', 'pinky', 2600); if (!Sound.has('voice-pinkys')) Sound.sfx('double'); break;
    case 'serve': Sound.tone(660, .12, 'triangle'); break;
    case 'countdown': $('#race').hidden = false; $('#race-winner').textContent = ''; G.cpuBiteAt = G.clock + PD.countdown; G.lastCount = -1; Race.seen = [0, 0]; Race.crumbs = []; renderRace(); break;
    case 'race': Sound.sfx('countdown', 0); renderRace(); break;
    case 'result':
      if (e.winner !== null && !e.post) G.boost[e.winner] = true;
      Sound.sfx('hit');
      $('#race-winner').textContent = e.winner === null ? 'A PHOTO FINISH! NO BOOST.' : e.post ? G.names[e.winner] + ' WINS THE 99!' : G.names[e.winner] + ' WINS A 99 BOOST!';
      renderRace(); break;
    case 'return': $('#race').hidden = true; break;
    case 'depart': Sound.sfx('screech'); Sound.sfx('raceAway'); break; // music stops; tyres and engine take over
    case 'done':
      G.pinky = null;
      if (e.post || G.match.winner !== null) { openCelebration(); return; }
      ready(); return;
  }
  hud();
}
function renderRace() {
  const e = G.pinky; if (!e) return;
  const el = G.clock - e.stageStart;
  let status = 'MUNCH!';
  const preparing = e.stage === 'countdown';
  const instructions = $('#race-instructions');
  instructions.hidden = !preparing;
  $('#race').classList.toggle('counting-down', preparing);
  $('#race').classList.toggle('nom-start', e.stage === 'race' && el < 750);
  if (preparing) {
    // First a readable instruction panel; only afterwards begin three deliberate beats.
    if (el < 1200) status = 'GET READY!';
    else {
      const n = Math.max(1, 3 - Math.floor((el - 1200) / 1000));
      status = String(n);
      if (G.lastCount !== n) { G.lastCount = n; Sound.sfx('countdown', n); }
    }
  }
  else if (e.stage === 'race' && el < 750) status = 'NOM!';
  else if (e.stage === 'result') status = e.winner === null ? 'DEAD HEAT!' : '99 CHAMPION!';
  else if (e.winner !== null) status = 'LAST LICKS!';
  $('#race-status').textContent = status;
  for (let i = 0; i < 2; i++) {
    const done = e.bites[i] >= PINKY_BITES, cpu = G.cpu && i === 1;
    $('#lane' + i).classList.toggle('won', e.stage === 'result' && e.winner === i);
    $('#eat-bar' + i).style.width = (e.bites[i] / PINKY_BITES * 100) + '%';
    $('#eat-label' + i).textContent = G.names[i];
    $('#eat-key' + i).textContent = done ? 'FINISHED!' : e.stage === 'countdown' ? 'READY…' : cpu ? 'CPU' : G.lastInput === 'touch' ? (G.cpu ? 'TAP ANYWHERE' : i === 0 ? 'TAP LEFT' : 'TAP RIGHT') : (i === 0 ? 'BASH Q' : 'BASH P');
  }
  drawRaceScene(e, G.clock);
}
const raceCtx = $('#race-scene').getContext('2d');
const Race = { seen: [0, 0], crumbs: [] };
function drawRaceScene(e, t) {
  const c = raceCtx; c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = false;
  drawStreetBackdrop(c, t);
  // Pinky's van parked along the road behind them, rocking on its springs while he cheers.
  const V = META.vanSide, rocking = (e.stage === 'race' || e.stage === 'result') && !REDUCED ? Math.floor(t / 260) % 2 : 0;
  const vx = Math.round(418 - V.w / 2), vy = 374 - V.h - rocking;
  // Ice-cream race keeps its original parked-van ellipse.
  c.fillStyle = '#2a204055'; c.beginPath(); c.ellipse(418, 372, 150, 9, 0, 0, Math.PI * 2); c.fill();
  c.drawImage(IMG.vanSide, vx, vy);
  drawChant(c, vx + V.face[0], vy + V.face[1], vy, raceChant(e, t), t);
  for (let i = 0; i < 2; i++) drawEater(c, i === 0 ? 214 : 622, 460, i, e, t);
  Race.crumbs = Race.crumbs.filter((p) => t - p.born < 520);
  for (const p of Race.crumbs) { const a = t - p.born; c.fillStyle = p.col; c.fillRect(Math.round(p.x + p.vx * a), Math.round(p.y + p.vy * a + .0007 * a * a), 2, 2); }
}
function drawEater(c, x, y, i, e, t) {
  const av = G.avatars[i], f = 2, flip = i === 1;
  if (av === 4) {
    const won = e.stage === 'result' && e.winner === i;
    const lost = e.stage === 'result' && e.winner !== null && !won;
    drawCharacter(c, x, y, av, { scale: 4, flip, arms: won, mood: lost ? 'annoyed' : null, eating: !won && !lost, eaten: Math.min(1, e.bites[i] / PINKY_BITES), time: t });
    return;
  }
  const em = META.eat[av], I = META.actors.index;
  const won = e.stage === 'result' && e.winner === i, lost = e.stage === 'result' && e.winner !== null && !won;
  c.fillStyle = '#17372d40'; c.beginPath(); c.ellipse(x, y + 2, 30, 7, 0, 0, Math.PI * 2); c.fill();
  if (won) { drawCharacter(c, x, y, av, { scale: 4, arms: true, jump: Math.max(0, Math.sin(t * .012)) * 5, flip }); return; }
  const bites = e.bites[i], stage = Math.min(8, Math.floor(bites / 3)), since = t - e.lastTap[i];
  let key = em.head, mouthOpen = false;
  if (lost) key = I['emote' + av][0];
  else if (bites >= PINKY_BITES) key = I['emote' + av][1];
  else if (since < 145) mouthOpen = true; // CHOMP: open mouth without shifting the neck seam
  const ho = META.heads.offset[em.head];
  c.save(); c.translate(Math.round(x), Math.round(y)); if (flip) c.scale(-1, 1);
  c.drawImage(IMG.eat, av * 128, 0, 128, 112, -64 * f, -100 * f, 128 * f, 112 * f);             // body
  // PINKY_RACE_ANIMATION_FIX_V1: lower the whole head 1px in the eating pose and
  // paint a tiny bridge under the chin so no transparent neck seam can show through.
  const hx = (ho[0] - 64) * f, hy = (ho[1] - 99) * f;
  const seam = [[27, 43, 10, 2], [27, 43, 10, 2], [27, 43, 10, 2], [27, 43, 10, 2]][av];
  c.fillStyle = '#f3c7a2'; c.fillRect((ho[0] - 64 + seam[0]) * f, (ho[1] - 99 + seam[1]) * f, seam[2] * f, seam[3] * f);
  if (mouthOpen) c.drawImage(EatOpenHeads[av], hx, hy, META.heads.w * f, META.heads.h * f);
  else blitHead(c, key, hx, hy, f);
  const cr = META.cones.rects[0], coneTop = em.chin - 10, wafer = coneTop + Math.round(cr[3] * .48); // the swirl sits at the mouth
  if (stage < 8) { const r = META.cones.rects[stage]; c.drawImage(IMG.cones, r[0], r[1], r[2], r[3], Math.round((em.cx - 64 - r[2] / 2) * f), (coneTop - 100 - (mouthOpen ? 3 : 0)) * f, r[2] * f, r[3] * f); } // the 99, bitten down stage by stage
  c.save(); c.beginPath(); c.rect(-64 * f, (wafer - 100) * f, 128 * f, 112 * f); c.clip();      // only the lower hand grips the wafer, in front
  c.drawImage(IMG.eat, (4 + av) * 128, 0, 128, 112, -64 * f, -100 * f, 128 * f, 112 * f);
  c.restore();
  c.restore();
  if (bites > Race.seen[i]) {
    Race.seen[i] = bites;
    const C = META.cones, rgb = (a) => 'rgb(' + a.join(',') + ')', cols = stage <= 1 ? ['#5a3216', rgb(C.cream)] : stage < 5 ? [rgb(C.cream), '#fff7e6'] : [rgb(C.wafer), '#b5772c'];
    const bx = x + (flip ? -1 : 1) * (em.cx - 64) * f, by = y + (em.chin - 110 + C.tops[Math.min(8, stage)]) * f;
    for (let k = 0; k < 5; k++) Race.crumbs.push({ x: bx, y: by, vx: (Math.random() - .5) * .28, vy: -.06 - Math.random() * .22, born: t, col: cols[k % cols.length] });
  }
}
const CHANTS = ['GO ON!', 'CHOMP CHOMP!', 'NO BRAIN FREEZE!'];
function raceChant(e, t) {
  if (e.stage === 'countdown') return t - e.stageStart < 1200 ? 'GET YOUR 99s!' : 'READY, SET…';
  if (e.stage === 'race' && t - e.stageStart < 750) return 'NOM NOM NOM!';
  if (e.stage === 'result') return e.winner === null ? 'DEAD HEAT!' : 'WELL DONE ' + G.names[e.winner] + '!';
  return Math.max(...e.bites) >= 18 ? 'NEARLY THERE!' : CHANTS[Math.floor((t - e.stageStart) / 1300) % CHANTS.length];
}
function drawChant(c, fx, fy, top, text, t, beside = innerHeight < 520) {
  c.save(); c.font = '10px "CF Arcade", "Press Start 2P", monospace'; c.textBaseline = 'middle'; c.textAlign = 'center';
  const w = Math.ceil(c.measureText(text).width) + 18, h = 24, bob = Math.floor(t / 260) % 2;
  c.fillStyle = '#fff4d2'; c.strokeStyle = '#30254f'; c.lineWidth = 2; c.beginPath();
  if (beside) {
    // Beside the van when the space above the roof is taken (short screens, the celebration's titles).
    const bx = Math.round(Math.max(6, fx - 150 - w)), by = Math.round(fy + 4 - bob), ty = by + h / 2;
    c.moveTo(bx + 3, by); c.lineTo(bx + w - 3, by); c.lineTo(bx + w, by + 3); c.lineTo(bx + w, ty - 5); c.lineTo(bx + w + 10, ty); c.lineTo(bx + w, ty + 5);
    c.lineTo(bx + w, by + h - 3); c.lineTo(bx + w - 3, by + h); c.lineTo(bx + 3, by + h); c.lineTo(bx, by + h - 3); c.lineTo(bx, by + 3); c.closePath();
    c.fill(); c.stroke(); c.fillStyle = '#b14679'; c.fillText(text, bx + w / 2, by + h / 2 + 1); c.restore(); return;
  }
  // Above the roof, clear of the PINKY'S sign, with a short tail down towards him.
  const bx = Math.round(Math.max(6, Math.min(830 - w, fx - w / 2))), by = Math.round(top - h - 12 - bob);
  c.moveTo(bx + 3, by); c.lineTo(bx + w - 3, by); c.lineTo(bx + w, by + 3); c.lineTo(bx + w, by + h - 3); c.lineTo(bx + w - 3, by + h);
  const tx = Math.max(bx + 14, Math.min(bx + w - 14, fx));
  c.lineTo(tx + 6, by + h); c.lineTo(tx, by + h + 9); c.lineTo(tx - 6, by + h); c.lineTo(bx + 3, by + h); c.lineTo(bx, by + h - 3); c.lineTo(bx, by + 3); c.closePath();
  c.fill(); c.stroke(); c.fillStyle = '#b14679'; c.fillText(text, bx + w / 2, by + h / 2 + 1); c.restore();
}

/* =====================================================================
   9. CPU OPPONENT
   ===================================================================== */
function updateCPU() {
  if (!G.cpu || G.victor !== null) return;
  if (G.phase === 'pinky') { if (G.pinky?.stage === 'race' && G.clock >= G.cpuBiteAt) { bite(1); G.cpuBiteAt = G.clock + 125 + Math.random() * 85; } return; }
  if (G.match.player === 0) { // the CPU will happily NOODLES! you
    if (['aim', 'dragging'].includes(G.phase) && G.cpuNoodleThrow !== G.throwNo) { G.cpuNoodleThrow = G.throwNo; if (G.bombs[1] > 0 && Math.random() < .22) G.cpuNoodleAt = G.clock + 200 + Math.random() * 350; }
    if (G.cpuNoodleAt && G.clock >= G.cpuNoodleAt) { G.cpuNoodleAt = 0; noodle(1); }
    return;
  }
  const token = G.throwNo + ':' + G.phase;
  if (token !== G.cpuToken) { G.cpuToken = token; G.cpuAt = G.clock + 850 + Math.random() * 450; if (G.phase === 'ready') { G.cpuPlan = Rules.cpuPlan(G.match.halfway, Math.random, G.match.fiveStreak, isLeading()); G.cpuBothered = false; } }
  if (!G.cpuPlan) return;
  if (G.phase === 'ready' && G.clock >= G.cpuAt && !prepping()) act(1);
  else if (G.phase === 'power' && G.power >= G.cpuPlan.power) act(1);
  else if (G.phase === 'aim') {
    if (!G.cpuBothered && (G.clock < G.noodleUntil || G.clock < G.dogUntil)) { G.cpuPlan.aim = clamp(G.cpuPlan.aim + (Math.random() < .5 ? -.18 : .18), .05, .95); G.cpuBothered = true; }
    if (G.aim >= G.cpuPlan.aim && G.meterClock > 100) act(1);
  }
}

/* =====================================================================
   10. UPDATE LOOP
   ===================================================================== */
function updateEngine() {
  const pk = G.pinky, van = G.phase === 'pinky' && pk && pk.stage === 'arrive', car = G.carStart > 0 && G.clock < G.carUntil; // departure has its own screech
  if ((!van && !car) || G.clock < G.engineAt) return;
  G.engineAt = G.clock + 90;
  const el = van ? G.clock - pk.stageStart : G.clock - G.carStart, u = clamp(el / (van ? PD[pk.stage] : CAR_MS));
  // Only Phil's VW and Kim's Qashqai use the recorded two-beep sample, once near the players.
  if (car && G.carColor >= 2 && !G.carBeeped && u >= .46) {
    G.carBeeped = true;
    Sound.say('sfx-family-beep', 'family-car-horn');
  }
  Sound.engine(van ? 'van' : 'car', u, el);
}
function update(dt) {
  const m = G.match, P = G.phase;
  view.camera += (view.target - view.camera) * Math.min(1, dt * .005);
  if (Math.abs(view.target - view.camera) < .0005) view.camera = view.target;
  const close = m.halfway && !['traffic', 'pinky'].includes(P) && G.victor === null;
  // Physical screen dimensions distinguish phones from iPads, even in landscape.
  const phoneScreen = Math.min(window.screen.width, window.screen.height) <= 600;
  const zt = phoneScreen ? (close ? 2.0 : 1.30) : (close ? 1.5 : 1);
  const panTarget = phoneScreen ? -14 : 0;
  view.verticalPan += (panTarget - view.verticalPan) * Math.min(1, dt * .004);
  if (Math.abs(panTarget - view.verticalPan) < .0005) view.verticalPan = panTarget;
  const ft = close ? (m.player === 0 ? -1 : 1) : 0;
  view.zoom += (zt - view.zoom) * Math.min(1, dt * .004); view.focus += (ft - view.focus) * Math.min(1, dt * .004);
  if (Math.abs(zt - view.zoom) < .0005) view.zoom = zt;
  if (Math.abs(ft - view.focus) < .0005) view.focus = ft;
  if (REDUCED) { view.zoom = zt; view.focus = ft; view.verticalPan = panTarget; }
  const noodled = G.clock < G.noodleUntil, dog = G.clock < G.dogUntil;
  if (P === 'power' || P === 'aim') {
    const speed = P === 'aim' ? (noodled ? 1.7 : dog ? 1.35 : 1) : 1;
    G.meterClock += dt * speed;
    let v = .5 - .49 * Math.cos(G.meterClock / (P === 'power' ? 950 : 850) * Math.PI);
    if (P === 'aim' && (noodled || dog)) v = clamp(v + Math.sin(G.meterClock * .011) * (noodled ? .065 : .04), .01, .99);
    if (P === 'power') G.power = v; else G.aim = v;
  }
  if (P === 'dragging' && G.drag) G.aim = clamp(G.drag.rawAim + (noodled ? Math.sin(G.clock * .018) * .09 : dog ? Math.sin(G.clock * .014) * .05 : 0));
  if (P === 'ready' && m.halfway) { const n = Math.min(3, Math.floor((G.clock - G.prepStart + 400) / 800)); if (n > G.prepBops) { G.prepBops = n; Sound.sfx('bop'); } }
  if (P === 'flight' && G.shot) {
    const s = G.shot, f = clamp((G.clock - s.start) / s.duration);
    G.ball = ballAt(s, f); G.ball.spin = (G.clock - s.start) * .008;
    G.ball.squash = f < 1 ? clamp(1 - (G.ball.z - surfaceZ(G.ball.y) - BALL_Z) / .09) : 0; // flattens as it meets the ground
    if (!s.impact && f >= s.contact) { s.impact = true; onImpact(s); }
    if (f >= 1 && !s.done) { s.done = true; onFlightEnd(s); }
  }
  if (G.phase === 'result' && G.clock - G.resultAt >= G.resultHold) endTurn();
  // The car remains visible, but players can throw once its rear has passed them.
  if (G.phase === 'traffic' && G.clock >= G.carStart + CAR_MS * .68) { G.phase = 'ready'; G.prepStart = G.clock; hud(); }
  if (G.phase === 'pinky') updatePinky();
  if (G.victor !== null && !G.victoryDone && G.phase !== 'flight' && G.clock - G.victoryAt >= 4800) completeMatch();
  updateEngine();
  updateCPU();
}

/* =====================================================================
   11. HUD
   ===================================================================== */
const els = {
  game: $('#game'), meters: $('#meters'), hint: $('#hint'), boostTag: $('#boost-tag'), float: $('#float'), banner: $('#banner'),
  meter: ['power', 'aim'].map((k) => { const r = $('#' + k + '-meter'); return { row: r, fringe: r.querySelector('.fringe'), green: r.querySelector('.green'), gold: r.querySelector('.gold'), needle: r.querySelector('.needle') }; }),
  heads: [$('#head0').getContext('2d'), $('#head1').getContext('2d')],
};
let bannerTimer = 0, floatTimer = 0;
function showBanner(title, sub, variant, ms) {
  const b = els.banner; b.className = 'banner' + (variant ? ' ' + variant : '');
  b.querySelector('strong').innerHTML = title; b.querySelector('small').innerHTML = sub || '';
  b.querySelector('small').hidden = !sub; b.hidden = false;
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => { b.hidden = true; }, ms);
}
function showFloat(text, sub, miss = false) {
  const f = els.float; f.className = 'float' + (miss ? ' miss' : '') + (!text ? ' small-only' : ''); f.innerHTML = text + (sub ? '<small>' + sub + '</small>' : ''); void f.offsetWidth; f.classList.add('show');
  clearTimeout(floatTimer); floatTimer = setTimeout(() => { f.className = 'float'; }, 1700);
}
function setZone(el, lo, hi) { el.style.left = (lo * 100) + '%'; el.style.width = ((hi - lo) * 100) + '%'; }
function hud() {
  const m = G.match, P = G.phase, p = m.player;
  els.game.dataset.phase = P; els.game.dataset.control = G.controlMode;
  const boosted = G.boost[p] && !m.halfway && P !== 'pinky';
  const g = Rules.green(m.halfway, m.fiveStreak, isLeading()), fr = Rules.fringe(m.halfway, m.fiveStreak, isLeading()), d = Rules.gold(boosted);
  ['power', 'aim'].forEach((k, n) => { const e = els.meter[n]; setZone(e.fringe, g[k][0] - fr, g[k][1] + fr); setZone(e.green, g[k][0], g[k][1]); setZone(e.gold, d[k][0], d[k][1]); e.gold.hidden = m.halfway; });
  const showMeters = G.victor === null && ((G.controlMode === 'timing' || cpuTurn()) && ['ready', 'power', 'aim'].includes(P) || P === 'dragging');
  els.meters.hidden = !showMeters;
  els.meters.classList.toggle('boosted', boosted);
  els.meter[0].row.classList.toggle('running', P === 'power'); els.meter[1].row.classList.toggle('running', P === 'aim');
  els.meter[0].row.classList.toggle('dim', P === 'aim');                     // aiming: power steps back
  els.meter[1].row.classList.toggle('dim', P === 'power' || P === 'ready');  // powering: aim steps back
  els.boostTag.hidden = !(boosted && ['ready', 'power', 'aim', 'dragging'].includes(P));
  for (let i = 0; i < 2; i++) {
    $('#score' + i).textContent = String(m.scores[i]).padStart(2, '0');
    $('#card' + i).classList.toggle('active', i === p && G.victor === null && !['pinky', 'traffic'].includes(P));
    $('#badge' + i).hidden = !G.boost[i];
    const b = $('#noodles' + i), can = i !== p && G.bombs[i] > 0 && ['power', 'aim', 'dragging'].includes(P) && !(G.cpu && i === 1) && G.victor === null && G.clock >= G.noodleUntil;
    b.disabled = !can; b.classList.toggle('spent', G.bombs[i] === 0);
    b.querySelector('small').textContent = G.cpu && i === 1 ? 'CPU ×' + G.bombs[i] : '×' + G.bombs[i];
    b.setAttribute('aria-label', G.names[i] + ' NOODLES!, ' + G.bombs[i] + ' left' + (i === 0 ? ', key X' : ', key N'));
  }

  hudFrame();
}
function hintText() {
  const m = G.match, P = G.phase, p = m.player;
  if (G.victor !== null || G.screen !== 'game') return '';
  if (cpuTurn() && ['ready', 'power', 'aim'].includes(P)) return 'CPU ' + G.names[1] + ' IS LINING UP…';
  if (P === 'ready' && prepping()) return '';
  if (G.controlMode === 'drag') {
    if (P === 'ready') return 'P' + (p + 1) + ' · PULL BACK ON THE ' + (G.cpu ? 'SCREEN' : p === 0 ? 'LEFT' : 'RIGHT');
    if (P === 'dragging') return 'PULL = POWER · SIDEWAYS = AIM · LET GO';
    return '';
  }
  if (!['ready', 'power', 'aim'].includes(P)) return '';
  const how = G.lastInput === 'touch' ? (G.cpu ? 'TAP' : 'TAP ' + (p === 0 ? 'LEFT' : 'RIGHT')) : 'PRESS ' + (p === 0 ? 'Q' : 'P');
  return 'P' + (p + 1) + ' · ' + how + (P === 'ready' ? ' TO START' : P === 'power' ? ' TO LOCK POWER' : ' TO LOCK AIM');
}
let lastHint = null;
function hudFrame() {
  els.meter[0].needle.style.left = (G.power * 100) + '%';
  els.meter[1].needle.style.left = (G.aim * 100) + '%';
  const h = hintText();
  if (h !== lastHint) { lastHint = h; els.hint.textContent = h; els.hint.hidden = !h; }
  els.hint.classList.toggle('low', els.meters.hidden);
  for (let i = 0; i < 2; i++) drawHead(els.heads[i], G.avatars[i], G.actorOpts[i] || {}, i === 1);
}

/* =====================================================================
   12. INPUT
   ===================================================================== */
const game = $('#game');
function canvasPoint(e) {
  const r = court.getBoundingClientRect(), s = Math.max(r.width / W, r.height / H);
  return { x: (e.clientX - r.left - (r.width - W * s) / 2) / s, y: (e.clientY - r.top - (r.height - H * s) / 2) / s };
}
function dragValues(pull, dir, halfway) {
  const len = Math.hypot(dir.x, dir.y) || 1, dx = dir.x / len, dy = dir.y / len;
  return { power: clamp((pull.x * dx + pull.y * dy) / ((halfway ? 110 : 160) * view.zoom)), aim: clamp(.5 + (-pull.x * dy + pull.y * dx) / (220 * view.zoom)) };
}
function updateDrag(e) {
  const d = G.drag; if (!d) return;
  const pt = canvasPoint(e), sp = standPos(G.match.player, G.clock), from = project(sp.x, sp.y), to = project(0, -sign() * 2.04);
  const v = dragValues({ x: d.anchor.x - pt.x, y: d.anchor.y - pt.y }, { x: to.x - from.x, y: to.y - from.y }, G.match.halfway);
  G.power = v.power; d.rawAim = v.aim;
}
function tryStartDrag(e) { // a pull can start anywhere on the thrower's half, bounces or not
  if (G.phase !== 'ready' || cpuTurn()) return false;
  const pt = canvasPoint(e);
  e.preventDefault(); Sound.unlock();
  try { game.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  G.drag = { anchor: pt, id: e.pointerId, rawAim: .5 }; G.phase = 'dragging'; G.power = 0; G.aim = .5; G.rest = null; hud();
  return true;
}
game.addEventListener('pointerdown', (e) => {
  G.lastInput = e.pointerType === 'mouse' ? 'mouse' : 'touch';
  const btn = e.target.closest('button'); if (btn && !btn.disabled) return; // live buttons keep their taps; everything else is the player's half
  if (e.target.closest('#sound-panel')) return;
  if (PORTRAIT.matches || anyDialog() || (e.pointerType === 'mouse' && e.button !== 0)) return;
  Sound.unlock();
  const r = game.getBoundingClientRect();
  let p = e.clientX < r.left + r.width / 2 ? 0 : 1;
  if (G.cpu) p = 0; // one human: the whole screen is theirs
  if (G.phase === 'pinky') { if (G.pinky?.stage === 'race') { e.preventDefault(); bite(p); } return; }
  if (G.controlMode === 'drag' && G.phase === 'ready') { if (p === G.match.player) tryStartDrag(e); return; }
  if ((G.controlMode === 'timing' && ['ready', 'power', 'aim'].includes(G.phase)) || G.phase === 'result') { e.preventDefault(); tap(p); }
});
game.addEventListener('pointermove', (e) => { if (G.phase === 'dragging' && G.drag?.id === e.pointerId) { e.preventDefault(); updateDrag(e); } });
game.addEventListener('pointerup', (e) => {
  if (G.phase !== 'dragging' || G.drag?.id !== e.pointerId) return;
  e.preventDefault(); updateDrag(e);
  try { game.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  if (G.power < .08) { backToReady(); return; }
  launch();
});
game.addEventListener('pointercancel', () => { if (G.phase === 'dragging') backToReady(); });
game.addEventListener('contextmenu', (e) => e.preventDefault());
for (let i = 0; i < 2; i++) $('#noodles' + i).addEventListener('click', () => noodle(i));
// PINKYS_KEYBOARD_SECRET_V2: hidden playtest encounter by typing 'pinkys'.
let pinkysSecret = '', pinkysSecretAt = 0;
function detectPinkySecret(e) {
  if (e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey ||
      e.isComposing || e.key.length !== 1 || G.screen !== 'game' ||
      anyDialog() || PORTRAIT.matches || G.victor !== null || G.pinky ||
      e.target.closest?.('input, textarea, select, [contenteditable]')) return false;
  const k = e.key.toLowerCase(), now = performance.now();
  if (now - pinkysSecretAt > 1200) pinkysSecret = '';
  pinkysSecretAt = now;
  const next = pinkysSecret + k;
  pinkysSecret = 'pinkys'.startsWith(next) ? next : k === 'p' ? 'p' : '';
  if (pinkysSecret === 'pinkys') {
    pinkysSecret = '';
    e.preventDefault();
    Sound.unlock();
    beginPinky(false);
    return true;
  }
  // Stop NOODLES! on the 'n' of the cheat; P remains a normal Player 2 key.
  if (pinkysSecret.length >= 2) { e.preventDefault(); return true; }
  return false;
}
document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (anyDialog()) return;
  if (detectPinkySecret(e)) return;
  if (G.screen === 'boot') {
    if (['Tab', 'Shift', 'Escape'].includes(e.key) ||
        (e.target === learnOpen && ['Enter', ' '].includes(e.key))) return;
    e.preventDefault(); bootStart(); return;
  }
  if (PORTRAIT.matches) return;
  if (G.soundOpen) { if (e.key === 'Escape') openSound(false); return; }
  if (G.screen === 'select') { selectKey(e); return; }
  if (G.screen === 'celebrate') { if (!['Tab', 'Shift'].includes(e.key)) { e.preventDefault(); leaveCelebration(); } return; }
  if (G.screen !== 'game' || e.repeat) return;
  const k = e.key.toLowerCase();
  if (!['q', 'p', 'x', 'n', ' '].includes(k)) return;
  e.preventDefault(); G.lastInput = 'key'; Sound.unlock();
  if (k === 'x') { noodle(0); return; }
  if (k === 'n') { if (!G.cpu) noodle(1); return; }
  if (G.phase === 'pinky') { if (k === 'q') bite(0); else if (k === 'p' && !G.cpu) bite(1); return; }
  if (k === ' ') { const p = G.phase === 'result' ? nextKeyPlayer() : G.match.player; if (G.cpu && p === 1) return; tap(p); return; }
  const p = k === 'q' ? 0 : 1; if (G.cpu && p === 1) return; tap(p);
});
function setControlMode(mode) {
  if (['power', 'aim', 'dragging', 'flight', 'traffic', 'pinky'].includes(G.phase)) return;
  G.controlMode = mode; try { localStorage.setItem('curb-fighters-control', mode); } catch { /* ignore */ }
  hud();
}
// Timing is the only supported throw mode; ignore any old drag preference.
G.controlMode = 'timing';
const SND_ON = 'M1 5h3l4-4h1v14H8l-4-4H1z M11 5h1v6h-1z M13 3h1v10h-1z', SND_OFF = 'M1 5h3l4-4h1v14H8l-4-4H1z M10 5h2v2h-2z M14 5h2v2h-2z M12 7h2v2h-2z M10 9h2v2h-2z M14 9h2v2h-2z';
function syncAudioControls() { // the title sliders and the in-game panel share one set of levels
  for (const kind of ['music', 'sfx']) {
    const v = Math.round(Sound.prefs[kind] * 100);
    for (const id of [kind + '-level', 'g-' + kind]) $('#' + id).value = v;
    $('#' + kind + '-out').textContent = v + '%'; $('#g-' + kind + '-out').textContent = v + '%';
  }
  const m = $('#g-mute'); m.setAttribute('aria-pressed', String(!Sound.prefs.on)); m.textContent = Sound.prefs.on ? 'MUTE ALL' : 'SOUND ON';
  syncSoundButton();
}
function syncSoundButton() { const on = Sound.prefs.on; $('#snd-icon').setAttribute('d', on ? SND_ON : SND_OFF); $('#btn-sound').setAttribute('aria-label', on ? 'Turn sound off' : 'Turn sound on'); }
const soundPanel = $('#sound-panel');
function openSound(open) {
  G.soundOpen = open; soundPanel.hidden = !open; $('#btn-sound').setAttribute('aria-expanded', String(open));
  if (open) { syncAudioControls(); $('#g-music').focus({ preventScroll: true }); }
}
$('#btn-sound').addEventListener('click', () => { Sound.unlock(); openSound(!G.soundOpen); });
$('#g-mute').addEventListener('click', () => { Sound.set('on', !Sound.prefs.on); Sound.unlock(); syncAudioControls(); if (Sound.prefs.on) Sound.tone(523, .1, 'triangle'); });
// A tap anywhere else closes the panel, and only closes it: it never becomes a throw.
document.addEventListener('pointerdown', (e) => {
  if (!G.soundOpen || e.target.closest('#sound-panel, #btn-sound')) return;
  e.stopPropagation(); e.preventDefault(); openSound(false);
}, true);
const canFull = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
$('#btn-full').hidden = !canFull;
$('#btn-full').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement || document.webkitFullscreenElement) { await (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
    const root = document.documentElement; await (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
    try { await screen.orientation?.lock?.('landscape'); } catch { /* not all browsers */ }
  } catch { /* the viewer may not allow it */ }
});
$('#btn-help').addEventListener('click', () => $('#help').showModal());
$('#help-close').addEventListener('click', () => $('#help').close());
$('#btn-restart').addEventListener('click', () => $('#restart').showModal());
$('#restart-cancel').addEventListener('click', () => $('#restart').close());
$('#restart-confirm').addEventListener('click', () => { $('#restart').close(); G.victor = null; G.pinky = null; returnToSelect(); });

/* =====================================================================
   13. CHOOSE YOUR CHAMPION
   ===================================================================== */
const Select = { locked: false, reveal: null, timers: [], picks: [0, 1], angles: [0, SELECT_STEP], cheerAt: [-1e9, -1e9], buttons: [[], []], gesture: [null, null], suppress: [false, false], time: 0 };
const outlineTmp = makeCanvas(128, 112), outlineGold = makeCanvas(128, 112);
function buildSelect() {
  for (let p = 0; p < 2; p++) {
    const stage = $('#carousel' + p);
    for (const [index, k] of SELECTABLE_AVATARS.entries()) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'champ';
      b.setAttribute('aria-label', 'Player ' + (p + 1) + ': ' + CHARACTERS[k].name + '. ' + CHARACTERS[k].desc);
      const c = makeCanvas(128, 112); b.append(c);
      b.addEventListener('click', (e) => { if (Select.suppress[p]) { e.preventDefault(); return; } choose(p, index); });
      stage.append(b); Select.buttons[p].push({ b, c, x: c.getContext('2d') });
    }
    stage.addEventListener('pointerdown', (e) => {
      if ((p === 1 && G.cpu) || e.button > 0 || Select.locked) return;
      Select.gesture[p] = { id: e.pointerId, x: e.clientX, start: Select.angles[p], moved: false };
    });
    stage.addEventListener('pointermove', (e) => {
      const g = Select.gesture[p]; if (!g || g.id !== e.pointerId) return;
      const dx = e.clientX - g.x;
      if (!g.moved && Math.abs(dx) > 8) { g.moved = true; try { stage.setPointerCapture(e.pointerId); } catch { /* ignore */ } stage.classList.add('dragging'); }
      if (g.moved) { e.preventDefault(); Select.angles[p] = g.start - dx / Math.max(100, stage.clientWidth * .5) * SELECT_STEP; }
    });
    const finish = (e) => {
      const g = Select.gesture[p]; if (!g || g.id !== e.pointerId) return;
      if (g.moved) {
        const dx = e.clientX - g.x; let step = Math.round(-dx / Math.max(100, stage.clientWidth * .5));
        if (!step && Math.abs(dx) > 28) step = dx < 0 ? 1 : -1;
        choose(p, Math.round(g.start / SELECT_STEP) + step);
        Select.suppress[p] = true; setTimeout(() => { Select.suppress[p] = false; }, 0);
      }
      Select.gesture[p] = null; stage.classList.remove('dragging');
    };
    stage.addEventListener('pointerup', finish);
    stage.addEventListener('pointercancel', () => { Select.gesture[p] = null; stage.classList.remove('dragging'); });
    $('#prev' + p).addEventListener('click', () => choose(p, Select.picks[p] - 1));
    $('#next' + p).addEventListener('click', () => choose(p, Select.picks[p] + 1));
  }
  $('#vs-friend').addEventListener('click', () => setCpu(false));
  $('#vs-cpu').addEventListener('click', () => setCpu(true));
  $('#go').addEventListener('click', go);
  syncNames();
}
function choose(p, k) {
  if ((p === 1 && G.cpu) || Select.locked) return;
  Select.picks[p] = ((k % SELECTABLE_AVATARS.length) + SELECTABLE_AVATARS.length) % SELECTABLE_AVATARS.length; Select.cheerAt[p] = performance.now();
  Sound.unlock(); Sound.sfx('tick', Select.picks[p]); syncNames(); // just a tick: names are called once chosen
}
function setCpu(on) {
  if (Select.locked) return;
  G.cpu = on; Sound.unlock(); Sound.sfx('tick', on ? 3 : 0);
  $('#vs-friend').setAttribute('aria-pressed', !on); $('#vs-cpu').setAttribute('aria-pressed', on);
  $('#prev1').disabled = on; $('#next1').disabled = on; syncNames();
}
function syncNames() {
  $('#champ-name0').textContent = CHARACTERS[SELECTABLE_AVATARS[Select.picks[0]]].name;
  $('#champ-name1').textContent = G.cpu && Select.reveal === null ? '???' : CHARACTERS[SELECTABLE_AVATARS[Select.picks[1]]].name;
}
function selectKey(e) {
  const k = e.key;
  if (k === 'a' || k === 'A') choose(0, Select.picks[0] - 1);
  else if (k === 'd' || k === 'D') choose(0, Select.picks[0] + 1);
  else if (k === 'ArrowLeft') choose(1, Select.picks[1] - 1);
  else if (k === 'ArrowRight') choose(1, Select.picks[1] + 1);
  else if (k === 'Enter' || (k === ' ' && !e.target.closest?.('button'))) go();
  else return;
  e.preventDefault();
}
function go() {
  // Champions chosen: call each name, hold the moment, then fade to black and out onto the road.
  if (Select.locked) return;
  Select.locked = true;
  G.avatars = [SELECTABLE_AVATARS[Select.picks[0]], SELECTABLE_AVATARS[Select.picks[1]]];
  if (G.cpu) {
    const pool = SELECTABLE_AVATARS.filter((i) => i !== G.avatars[0]); G.avatars[1] = pool[Math.floor(Math.random() * pool.length)];
    Select.reveal = G.avatars[1]; Select.picks[1] = SELECTABLE_AVATARS.indexOf(G.avatars[1]); Select.angles[1] = Select.picks[1] * SELECT_STEP; // the CPU steps out of the shadows
  }
  G.names = [CHARACTERS[G.avatars[0]].name, CHARACTERS[G.avatars[1]].name];
  syncNames(); Sound.unlock();
  // The announcer: "LET'S BOUNCE!" ... "ROSE" ... "VERSUS" ... "PHIL!", each timed to its own recording.
  const ms = (key, fallback) => Math.round((Sound.length(key) ?? fallback) * 1000), later = (t, fn) => Select.timers.push(setTimeout(fn, t));
  const call = (p) => {
    const el = $('#champ-name' + p); el.classList.remove('called'); void el.offsetWidth; el.classList.add('called');
    if (!Sound.say('voice-' + G.names[p].toLowerCase(), 'name' + p)) Sound.sfx('tick', G.avatars[p]);
  };
  if (!Sound.say('voice-bounce', 'announce')) Sound.sfx('go');
  let t = ms('voice-bounce', .45) + 150;
  later(t, () => call(0)); t += ms('voice-' + G.names[0].toLowerCase(), .8) + 120;
  later(t, () => { const vs = $('#vs'); vs.hidden = false; vs.classList.remove('slam'); void vs.offsetWidth; vs.classList.add('slam'); Sound.say('voice-versus', 'announce'); });
  t += ms('voice-versus', .7) + 120;
  later(t, () => call(1)); t += ms('voice-' + G.names[1].toLowerCase(), .8) + 550;
  later(t, () => fadeThrough(startMatch));
}
function fadeThrough(middle) { // a stepped fade to black and back, like an old cartridge
  const f = $('#fade'); f.classList.add('on');
  setTimeout(() => { middle(); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on'))); }, 440);
}
function resetSelect() {
  Select.timers.forEach(clearTimeout); Select.timers = []; Select.locked = false; Select.reveal = null;
  ['#champ-name0', '#champ-name1'].forEach((id) => $(id).classList.remove('called')); $('#vs').hidden = true; syncNames();
}
function sizeSelect() {
  const s = $('#select'), px = Math.max(innerWidth / 836, innerHeight / 470);
  s.style.setProperty('--px', px.toFixed(3));
  s.style.setProperty('--cs', Math.min(px, innerWidth / 720).toFixed(3)); // narrow screens keep the rosters apart
}
addEventListener('resize', sizeSelect);
const bg = $('#select-bg').getContext('2d');
function drawStreetBackdrop(c, time) {
  // The front-on street, with two cloud planes drifting behind the tree line.
  c.imageSmoothingEnabled = false; c.drawImage(IMG.backdrop, 0, 0);
  const C = PR.clouds, tm = REDUCED ? 0 : time;
  for (let n = 0; n < 5; n++) { const r = C[1 + n % 2], span = 836 + r[2]; const x = ((n * span / 5 + tm * .004) % span) - r[2]; c.globalAlpha = .88; blit(c, IMG.clouds, r, Math.round(x), 16 + (n % 3) * 24, r[2], r[3]); }
  c.globalAlpha = 1;
  for (let n = 0; n < 3; n++) { const r = C[0], span = 836 + r[2]; const x = ((n * span / 3 + 140 + tm * .011) % span) - r[2]; blit(c, IMG.clouds, r, Math.round(x), 46 + (n % 2) * 40, r[2], r[3]); }
  c.drawImage(IMG.foreground, 0, 0);
}
function renderSelect(dt) {
  Select.time += REDUCED ? 0 : dt;
  drawStreetBackdrop(bg, Select.time);
  // Feet are placed by backdrop rows, so the rosters stand on the road on any screen shape.
  const s = Math.max(innerWidth / 836, innerHeight / 470), top = innerHeight - 470 * s, now = performance.now();
  const rowPct = (yb) => (top + yb * s) / innerHeight * 100;
  for (let p = 0; p < 2; p++) {
    const target = Select.picks[p] * SELECT_STEP;
    if (p === 1 && G.cpu && Select.reveal === null) Select.angles[1] = (Select.angles[1] + dt * .00065) % (Math.PI * 2);
    else if (!Select.gesture[p]?.moved) { const diff = Math.atan2(Math.sin(target - Select.angles[p]), Math.cos(target - Select.angles[p])); Select.angles[p] += REDUCED ? diff : diff * Math.min(1, dt * .012); }
    // Scale the ellipse to the roster: three characters sit symmetrically behind
    // the selected champion, while larger rosters gain room around the arc.
    // Keep the established four-character layout unchanged.
    const count = SELECTABLE_AVATARS.length;
    const radius = count <= 3 ? 19 : count === 4 ? 25 : count === 5 ? 26 : 27;
    const cx = p === 0 ? 46 : 54;
    const skew = (count <= 3 ? 0 : count === 4 ? 7 : 3) * (p === 0 ? 1 : -1);
    Select.buttons[p].forEach(({ b, c, x }, k) => {
      const a = k * SELECT_STEP - Select.angles[p], front = Math.cos(a), side = Math.sin(a), depth = (front + 1) / 2;
      const isFront = front > .92;
      // Shift only the front-most champ inward in the three-character variant.
      const inwardNudgePx = THREE_CHARACTER_VERSION && isFront ? (p === 0 ? 15 : -15) : 0;
      b.style.left = 'calc(' + (cx + side * radius + (1 - front) * skew).toFixed(3) + '% + ' + inwardNudgePx + 'px)';
      b.style.top = rowPct(346 + depth * 58) + '%';
      b.style.transform = 'translate(-50%, -89.3%) scale(' + (1 + depth * .38).toFixed(3) + ')';
      b.style.zIndex = String(10 + Math.round(depth * 20));
      b.style.filter = isFront ? 'none' : 'brightness(' + (.84 + depth * .16).toFixed(2) + ')';
      b.setAttribute('aria-pressed', String(!G.cpu || p === 0 ? Select.picks[p] === k : false));
      const hidden = p === 1 && G.cpu && Select.reveal === null, cheer = Select.picks[p] === k && (Select.locked || now - Select.cheerAt[p] < 900);
      drawChamp(x, SELECTABLE_AVATARS[k], p, isFront && !hidden, cheer, hidden && true);
    });
  }
  const gb = $('#go-ball').getContext('2d'); gb.clearRect(0, 0, 48, 48); drawBall(gb, 24, 24, 24, Math.floor(Select.time / 700) * Math.PI / 2);
}
function drawChamp(x, k, p, highlight, cheering, mystery) {
  const t = Select.time, o = { animate: !REDUCED, time: t + k * 400, punch: cheering, flip: p === 1 };
  const tc = outlineTmp.getContext('2d'); tc.clearRect(0, 0, 128, 112); drawCharacter(tc, 64, 100, k, o);
  x.clearRect(0, 0, 128, 112);
  if (mystery) {
    tc.globalCompositeOperation = 'source-atop'; tc.fillStyle = '#0d1029'; tc.fillRect(0, 0, 128, 112); tc.globalCompositeOperation = 'source-over';
    x.drawImage(outlineTmp, 0, 0);
    x.font = '20px "CF Arcade", "Press Start 2P", monospace'; x.textAlign = 'center'; x.fillStyle = '#6e3782'; x.fillText('?', 66, 58); x.fillStyle = '#ffe16a'; x.fillText('?', 64, 56);
    return;
  }
  if (highlight) {
    const gc = outlineGold.getContext('2d'); gc.clearRect(0, 0, 128, 112); gc.drawImage(outlineTmp, 0, 0);
    gc.globalCompositeOperation = 'source-in'; gc.fillStyle = '#ffe16a'; gc.fillRect(0, 0, 128, 112); gc.globalCompositeOperation = 'source-over';
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) x.drawImage(outlineGold, dx, dy);
  }
  x.drawImage(outlineTmp, 0, 0);
}

/* =====================================================================
   14. SCREENS, TITLE AND MAIN LOOP
   ===================================================================== */
function setScreen(name) {
  G.screen = name; if (G.soundOpen) openSound(false);
  for (const id of ['boot', 'select', 'game', 'celebrate']) $('#' + id).hidden = name !== id;
  if (name === 'select') { resetSelect(); sizeSelect(); Sound.decode('game'); ['phil', 'kim', 'rose', 'shay', 'bounce', 'versus'].forEach((n) => Sound.decode('voice-' + n)); }
  if (name === 'game') { ['pinky', 'win', 'voice-noodles', 'voice-pinkys', 'voice-wins', 'voice-double-trouble', 'sfx-yeah', 'sfx-miss', 'sfx-family-beep'].forEach((k) => Sound.decode(k)); hud(); }
}
function desiredMusic() {
  if (G.screen === 'boot') return 'intro';
  if (G.screen === 'select') return 'select';
  if (G.screen === 'celebrate') return 'win';
  if (G.screen === 'game') {
    if (G.phase === 'pinky' && G.pinky) return ['depart', 'done'].includes(G.pinky.stage) ? null : 'pinky';
    return G.victor !== null ? null : 'game'; // win music begins on celebration only
  }
  return null;
}
// Intro title uses a native media element so the first user gesture can
// start playback immediately, without waiting for Web Audio decoding/resume.
const introVoice = new Audio(CF.audio['voice-curbfighters']);
introVoice.preload = 'auto';
introVoice.volume = 0.28; // Same effective dialogue mix: 0.4 voice * 0.7 SFX.
let introTitleAnnounced = false;
function announceIntroTitle() {
  if (introTitleAnnounced || G.screen !== 'boot' || !Sound.prefs.on || Sound.prefs.sfx <= 0) return;
  introVoice.volume = Math.min(1, 0.4 * Sound.prefs.sfx);
  const attempt = introVoice.play();
  if (attempt && typeof attempt.then === 'function') {
    attempt.then(() => { introTitleAnnounced = true; }).catch(() => {});
  } else introTitleAnnounced = true;
}
function playIntroAfterUnlock() {
  Sound.unlock();
  announceIntroTitle(); // play() happens directly inside the click gesture.
}
let bootTimer = null;
function bootStart() {
  if (G.screen !== 'boot' || !booted || bootTimer !== null || anyDialog()) return;
  playIntroAfterUnlock();
  // Give the title chant time to be heard before leaving the intro.
  bootTimer = setTimeout(() => {
    bootTimer = null;
    if (G.screen !== 'boot') return;
    Sound.sfx('go');
    setScreen('select');
  }, introTitleAnnounced ? 1200 : 1500);
}
let booted = false;
const bootControls = '#audio-panel, #learn-open';
$('#boot').addEventListener('click', (e) => { if (e.target.closest(bootControls)) return; bootStart(); });
const learn = $('#learn');
const learnOpen = $('#learn-open');
function showLearnPage(controls) {
  $('#learn-intro').hidden = controls;
  $('#learn-controls').hidden = !controls;
  $('#learn-close').hidden = controls;
  $('#learn-back').hidden = !controls;
  $('#learn-next').hidden = controls;
  $('#learn-done').hidden = !controls;
  if (!learn.open) learn.showModal();
  learn.querySelector('.learn-pages').scrollTop = 0;
  learn.querySelector('section:not([hidden]) h2').focus({ preventScroll: true });
}
learnOpen.addEventListener('click', () => {
  clearTimeout(bootTimer);
  bootTimer = null;
  showLearnPage(false);
});
$('#learn-next').addEventListener('click', () => showLearnPage(true));
$('#learn-back').addEventListener('click', () => showLearnPage(false));
$('#learn-close').addEventListener('click', () => learn.close());
$('#learn-done').addEventListener('click', () => learn.close());
$('#celebrate').addEventListener('pointerdown', (e) => { G.lastInput = e.pointerType === 'mouse' ? 'mouse' : 'touch'; $('#cele-prompt').textContent = G.lastInput === 'touch' ? 'TAP TO PLAY AGAIN' : 'CLICK OR PRESS ANY KEY'; leaveCelebration(); });
const panel = $('#audio-panel');
['pointerdown', 'click', 'keydown'].forEach((t) => panel.addEventListener(t, (e) => e.stopPropagation()));
for (const kind of ['music', 'sfx']) for (const id of [kind + '-level', 'g-' + kind]) {
  $('#' + id).addEventListener('input', (e) => { Sound.set(kind, Number(e.target.value) / 100); Sound.unlock(); syncAudioControls(); if (kind === 'sfx') Sound.sfx('bop'); });
}
syncAudioControls();
$('#enable-audio').addEventListener('click', playIntroAfterUnlock);
const enableBtn = $('#enable-audio');
function syncEnable() { enableBtn.hidden = !Sound.locked || !Sound.prefs.on; }
Sound.onChange(syncEnable);
document.addEventListener('visibilitychange', () => { if (document.hidden) Sound.suspend(); else Sound.resume(); });
PORTRAIT.addEventListener?.('change', () => {
  if (PORTRAIT.matches) { Sound.suspend(); if (G.phase === 'dragging') backToReady(); } else Sound.resume();
});
// Any first gesture anywhere wakes the audio graph on mobile.
document.addEventListener('pointerdown', () => Sound.unlock(), { capture: true, passive: true });

const bootBall = $('#boot-ball').getContext('2d'), rotateBall = $('#rotate-ball').getContext('2d'), rotateArrows = $('#rotate-arrows').getContext('2d');
function drawRotateArrows(c, ang) {
  // Two white arrows chasing each other round the ball, plotted pixel by pixel so they stay crisp.
  c.clearRect(0, 0, 48, 48);
  const R = 18, plot = (col, half) => {
    c.fillStyle = col;
    for (let k = 0; k < 2; k++) {
      const a0 = ang + k * Math.PI + .5, a1 = a0 + 2.15;
      for (let a = a0; a <= a1; a += .012) for (let r = R - half; r <= R + half; r += .5) c.fillRect(Math.round(24 + Math.cos(a) * r - .5), Math.round(24 + Math.sin(a) * r - .5), 1, 1);
      // arrowhead at the leading (anticlockwise) end
      const tip = [24 + Math.cos(a0 - .55) * R, 24 + Math.sin(a0 - .55) * R], ba = [24 + Math.cos(a0) * (R - 6 - half), 24 + Math.sin(a0) * (R - 6 - half)], bb = [24 + Math.cos(a0) * (R + 6 + half), 24 + Math.sin(a0) * (R + 6 + half)];
      const grow = half > 2 ? 1.25 : 1, cx = (tip[0] + ba[0] + bb[0]) / 3, cy = (tip[1] + ba[1] + bb[1]) / 3, P = [tip, ba, bb].map(([x, y]) => [cx + (x - cx) * grow, cy + (y - cy) * grow]);
      const side = (p, q, x, y) => (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]);
      for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
        const s1 = side(P[0], P[1], x + .5, y + .5), s2 = side(P[1], P[2], x + .5, y + .5), s3 = side(P[2], P[0], x + .5, y + .5);
        if ((s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0)) c.fillRect(x, y, 1, 1);
      }
    }
  };
  plot('#121735', 3.2); plot('#ffffff', 1.6);
}
let last = 0, titleClock = 0;
function frame(now) {
  const dt = last ? Math.min(now - last, 60) : 16; last = now;
  const paused = document.hidden || PORTRAIT.matches || anyDialog() || G.soundOpen; // the street waits while you set the sound
  titleClock += dt;
  if (G.screen === 'boot' || PORTRAIT.matches) {
    const spin = Math.floor(titleClock / 120) * Math.PI / 2;
    bootBall.clearRect(0, 0, 96, 96); drawBall(bootBall, 48, 48, 48, spin);
    rotateBall.clearRect(0, 0, 48, 48); drawBall(rotateBall, 24, 24, 24, spin);
    if (PORTRAIT.matches) drawRotateArrows(rotateArrows, REDUCED ? 0 : -Math.floor(titleClock / 45) * Math.PI / 24);
  }
  if (G.screen === 'select' && !PORTRAIT.matches) renderSelect(dt);
  if (G.screen === 'celebrate' && !PORTRAIT.matches) renderCelebrate(dt);
  if (G.screen === 'game') {
    if (!paused) { G.clock += dt; update(dt); }
    drawScene(G.clock); hudFrame();
  }
  Sound.music(PORTRAIT.matches ? null : desiredMusic());
  syncEnable();
  requestAnimationFrame(frame);
}

// Fonts first, so canvas lettering is never drawn in a fallback face.
try { await Promise.race([Promise.all(['19px "CF Arcade"', '19px "Press Start 2P"', '21px "CF Pixel"'].map((f) => document.fonts.load(f).catch(() => null))), new Promise((r) => setTimeout(r, 2500))]); } catch { /* fallbacks */ }
buildSelect(); syncSoundButton(); Sound.init(); Sound.decode('intro'); Sound.decode('select'); Sound.decode('voice-curbfighters');
booted = true;
// Title animation begins 550ms after the boot screen appears. Browsers that
// allow audio play the voice there; otherwise ENABLE AUDIO plays it on tap.
setTimeout(announceIntroTitle, 550);
const prompt = $('#boot-prompt'); prompt.textContent = COARSE ? 'TAP TO START' : 'HIT ANY KEY TO START'; prompt.classList.add('ready');
if (!learn.open) $('#boot').focus({ preventScroll: true });
requestAnimationFrame(frame);
window.CurbFighters = { G, Rules, view, Select, Sound, startMatch, ready, beginPinky, launch, endTurn };
})().catch((err) => {
  const p = document.getElementById('boot-prompt');
  if (p) p.textContent = 'THE STREET WOULD NOT LOAD. REFRESH TO TRY AGAIN.';
  console.error(err);
});
