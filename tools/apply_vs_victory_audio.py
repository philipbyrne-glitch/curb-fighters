"""Center VS; street yeah; sequential celebration-only name+WINS. stdlib only."""
from pathlib import Path
import shutil
ROOT=Path(__file__).resolve().parents[1]
game=ROOT/'source/game.js'; css=ROOT/'source/style.css'; build=ROOT/'tools/build.py'; audio=ROOT/'tools/audio/yeah.mp3'
assert all(p.is_file() for p in [game,css,build,audio]), 'Must run in existing curb-fighters repository'
s=game.read_text(); c=css.read_text(); b=build.read_text()
marker='CURBS_VICTORY_AUDIO_FLOW_V1'
if marker in s:
    print('Already applied'); raise SystemExit(0)
def once(text, old, new, label):
    n=text.count(old)
    assert n==1, f'{label}: expected one anchor, found {n}: {old[:100]}'
    return text.replace(old,new,1)
shutil.copyfile(audio,ROOT/'assets/built/sfx-yeah.mp3')
b=once(b,"'sfx-family-beep', 'voice-bounce'", "'sfx-family-beep', 'sfx-yeah', 'voice-bounce'",'manifest')
c=once(c,'.vs.slam { animation: slam .32s steps(4); }',
'''.vs.slam { transform-origin: 50% 50%; animation: vs-center-zoom .32s steps(4) both; }
@keyframes vs-center-zoom {
  from { transform: translate(-50%, -50%) rotate(-6deg) scale(.2); opacity: 0; }
  to   { transform: translate(-50%, -50%) rotate(-6deg) scale(1); opacity: 1; }
}''','VS')
s=once(s,"'sfx-miss': 0.35, 'sfx-family-beep': 0.26,", "'sfx-miss': 0.35, 'sfx-family-beep': 0.26, 'sfx-yeah': 0.55,",'MIX')
method='''    // CURBS_VICTORY_AUDIO_FLOW_V1: sequence by actual sample length, not a fixed delay.
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
'''
s=once(s,'    forget(key) { delete resumeAt[key]; },',method+'    forget(key) { delete resumeAt[key]; },','Sound.sequence')
s=once(s,"""  $('#winner').hidden = false;
  Sound.sfx('fanfare');
  // Spoken win cue: champion's recorded name, then WINS!
  Sound.say('voice-' + G.names[p].toLowerCase(), 'victory-name');
  const winningName = G.names[p];
  setTimeout(() => {
    if (G.match.winner === p && G.names[p] === winningName) Sound.say('voice-wins', 'victory-wins');
  }, 950);
""", """  $('#winner').hidden = false;
  // The winning hit on the street gets ONLY the recorded 'yeah!'.
  Sound.say('sfx-yeah', 'victory-street');
""",'beginVictory')
s=once(s,"    if (!Sound.say('voice-double-trouble', 'double-trouble')) Sound.sfx('double');", "    if (G.victor === null && !Sound.say('voice-double-trouble', 'double-trouble')) Sound.sfx('double');",'winning double')
s=once(s,"  setScreen('celebrate');\n}\nconst CELE_CHANTS", """  setScreen('celebrate');
  // Start the spoken name, then WINS, only once the celebration is visible.
  Sound.sequence(['voice-' + G.names[w].toLowerCase(), 'voice-wins'],
    () => G.screen === 'celebrate' && Cele.winner === w);
}
const CELE_CHANTS""",'openCelebration')
s=once(s,"return G.victor !== null ? 'win' : 'game'; // the winning hit swaps in the winning music", "return G.victor !== null ? null : 'game'; // win music begins on celebration only",'winning music')
s=once(s,"['pinky', 'win', 'voice-noodles', 'voice-pinkys', 'voice-wins', 'voice-double-trouble'].forEach((k) => Sound.decode(k))", "['pinky', 'win', 'voice-noodles', 'voice-pinkys', 'voice-wins', 'voice-double-trouble', 'sfx-yeah'].forEach((k) => Sound.decode(k))",'preload')
assert s.count(marker)==1
assert s.count("Sound.sequence(['voice-' + G.names[w].toLowerCase(), 'voice-wins']")==1
game.write_text(s);css.write_text(c);build.write_text(b)
print('Installed VS centred zoom + recorded street yeah + sequential celebration voices')
