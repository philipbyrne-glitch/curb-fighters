"""Pinky race polish: self-contained, standard-library-only game patch.
Copy to tools/ and run on a current Curb Fighters repository.
Will refuse if anchors drift rather than corrupting source.
"""
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
game = ROOT/'source/game.js'; css = ROOT/'source/style.css'; html = ROOT/'source/index.html'
assert all(p.is_file() for p in [game,css,html]), 'Run from existing Curb Fighters tools/ folder'
s=game.read_text(); c=css.read_text(); h=html.read_text()
if 'PINKY_RACE_POLISH_V1' in s:
    raise SystemExit('Pinky race polish already applied.')

def replace(old,new):
    global s
    n=s.count(old)
    if n!=1: raise RuntimeError(f'Game source anchor mismatch ({n}): {old[:100]}')
    s=s.replace(old,new)

# Lower the recorded passing car beep just a little. Does not modify the recording.
replace("'sfx-family-beep': 0.3", "'sfx-family-beep': 0.26")
# 3 low starting-grid tones, one longer high go-tone. Existing SFX mix/mute still applies.
replace("    countdown: (n) => tone(n ? 660 : 1320, n ? .1 : .3, 'square', 0, .05),",
        "    countdown: (n) => { // PINKY_RACE_POLISH_V1: racing start lights\n      if (n) { tone(392, .18, 'square', 0, .062); tone(196, .16, 'triangle', 0, .018); }\n      else { tone(880, .62, 'square', 0, .065); tone(1760, .48, 'triangle', 0, .022); }\n    },")
# 1.2s instructions, then 3 one-second counting beats, NOM on actual race-start.
replace("countdown: 3000, result: 3000", "countdown: 4200, result: 3000")
replace("  let status = 'MUNCH!';\n  if (e.stage === 'countdown') { const n = Math.max(1, 3 - Math.floor(el / 1000)); status = String(n); if (G.lastCount !== n) { G.lastCount = n; Sound.sfx('countdown', n); } }",
"""  let status = 'MUNCH!';
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
  else if (e.stage === 'race' && el < 750) status = 'NOM!';""")
replace("e.stage === 'countdown' ? 'READY…'", "e.stage === 'countdown' ? 'READY…'") if False else None
replace("if (e.stage === 'countdown') return ['READY…', 'STEADY…', 'GO!'][Math.min(2, Math.floor((t - e.stageStart) / 1000))];",
        "if (e.stage === 'countdown') return t - e.stageStart < 1200 ? 'GET YOUR 99s!' : 'READY, SET…';\n  if (e.stage === 'race' && t - e.stageStart < 750) return 'NOM NOM NOM!';")
# Prepare mouth-open frames for each playable character from their exact current eat-head sprite.
# These are cached pixel frames, not redraws of a mismatched face.
needle="function drawHead(c, i, o = {}, flip = false) {"
insert="""// Four individual 52x46 mouth-open frames; generated from each character's
// original head sprite so hair, eyes, glasses and outlines remain pixel perfect.
const EatOpenHeads = Array.from({ length: 4 }, (_, av) => {
  const canv = makeCanvas(META.heads.w, META.heads.h), cc = canv.getContext('2d');
  cc.imageSmoothingEnabled = false;
  const k = META.eat[av].head;
  blitHead(cc, k, 0, 0);
  const mx = [28, 28, 28, 28][av], my = [27, 28, 28, 29][av];
  cc.fillStyle = '#3b1c34'; cc.fillRect(mx - 2, my - 1, 7, 6); // open mouth
  cc.fillStyle = '#f9eee4'; cc.fillRect(mx - 1, my, 5, 1);     // top teeth
  cc.fillStyle = '#c85d76'; cc.fillRect(mx, my + 3, 3, 1);   // tongue
  return canv;
});
"""
replace(needle,insert+needle)
replace("  let key = em.head, dip = 0;", "  let key = em.head, mouthOpen = false;")
replace("  else if (since < 120) { key = I['emote' + av][1]; dip = 2; } // CHOMP: the head dives into the 99",
"  else if (since < 145) mouthOpen = true; // CHOMP: open mouth without shifting the neck seam")
replace("  blitHead(c, key, (ho[0] - 64) * f, (ho[1] - 100 + dip) * f, f);                                // head",
"""  // The head stays anchored to the neck; moving it down exposed a transparent seam.
  if (mouthOpen) c.drawImage(EatOpenHeads[av], (ho[0] - 64) * f, (ho[1] - 100) * f, META.heads.w * f, META.heads.h * f);
  else blitHead(c, key, (ho[0] - 64) * f, (ho[1] - 100) * f, f);""")
replace("(coneTop - 100) * f, r[2] * f, r[3] * f", "(coneTop - 100 - (mouthOpen ? 2 : 0)) * f, r[2] * f, r[3] * f")
# Smooth case for pre-race note and NOM presentation, without permitting early bites.
assert '<strong class="race-status" id="race-status">3</strong>' in h
h=h.replace('<strong class="race-status" id="race-status">3</strong>',
'''<strong class="race-status" id="race-status">3</strong><div class="race-instructions panel" id="race-instructions" hidden>TAP, CLICK OR HIT <b>Q / P</b> TO NOM!</div>''')
# Larger countdown on small displays; instruction pop-up sits directly below headline.
c += """
/* Pinky's starting lights: readable instructions and arcade-scale 3-2-1-NOM. */
.race.counting-down .race-status, .race.nom-start .race-status {
  font-size: clamp(38px, min(10vw, 16vh), 100px);
  line-height: 1.12;
  text-shadow: 4px 4px 0 #c2306f, 8px 8px 0 #2a1030;
}
.race-instructions {
  padding: 11px 18px; max-width: min(82vw, 650px);
  background: #281c44ee; border: 3px solid #fff3c6;
  box-shadow: 5px 5px 0 #191127;
  font: clamp(9px, min(1.8vw, 3vh), 15px)/1.65 var(--arcade);
  color: #fff3c6; text-align: center;
}
.race-instructions b { color: #ffd966; }
@media (max-height: 520px) {
  .race.counting-down .race-status, .race.nom-start .race-status { font-size: clamp(28px, 10vh, 62px); }
  .race-instructions { padding: 5px 10px; font-size: 9px; }
}
"""
game.write_text(s); css.write_text(c); html.write_text(h)
print('Pinky race polish installed. Run: python3 tools/build.py')
