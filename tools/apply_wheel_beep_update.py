"""Add 2-frame family-car wheel motion and the supplied 0.3-level passing horn.
Safe to apply after balancing changes: edit anchored snippets only, never replace source/game.js wholesale.
"""
from pathlib import Path
from PIL import Image
import json, shutil, math
ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT/'source/game.js'; BUILD = ROOT/'tools/build.py'; PREP = ROOT/'tools/prep_assets.py'
G = ROOT/'assets/built'; audio = ROOT/'assets/original/audio'
A = ROOT/'assets/built/cars.png'; meta_path=G/'meta.json'
if not (ROOT/'assets/original/family-cars.png').exists(): raise SystemExit('First install the family cars update.')
if not A.exists(): raise SystemExit('Missing built car atlas.')
if not (ROOT/'tools/wheel-spin.py').exists():
    shutil.copyfile(Path(__file__).with_name('wheel-spin.py'), ROOT/'tools/wheel-spin.py')

# build.py explicitly embeds both the extra car frame sheet and the supplied horn.
s=BUILD.read_text()
old="'actors': 'actors_q.png', 'ball24': 'ball24.png'"
assert old in s or "'carsSpin': 'cars_spin.png'" in s
if "'carsSpin': 'cars_spin.png'" not in s:
    s=s.replace("'cars': 'cars_q.png',", "'cars': 'cars_q.png', 'carsSpin': 'cars_spin.png',")
    s=s.replace("'sfx-miss',", "'sfx-miss', 'sfx-family-beep',")
    BUILD.write_text(s)

# Rebuild the animated atlas whenever artwork is regenerated.
s=PREP.read_text()
marker="strip('cars', car_imgs)"
assert marker in s or 'wheel-spin.py' in s
if "wheel-spin.py" not in s:
    s=s.replace(marker,marker+"\n# The car wheel spin atlas is generated after the standard car atlas + metadata.\n")
    # The prep script writes meta at the end, so call the spinner only AFTER that write.
    s += "\n# Generate 2-frame rims for the personal cars; do not alter the generic cars.\nimport subprocess as _sp\n_sp.run([sys.executable, str(ROOT / 'tools' / 'wheel-spin.py')], check=True)\n"
    # sys is not necessarily imported by prep_assets.py.
    s=s.replace('import subprocess as _sp\n_sp.run([sys.executable', 'import subprocess as _sp, sys as _sys\n_sp.run([_sys.executable')
    PREP.write_text(s)

# game: two-frame animation only for color >= 2, using a second static atlas.
s=SRC.read_text()
old="""  c.save(); c.translate(Math.round(x), Math.round(y)); if (left) c.scale(-1, 1); blit(c, IMG.cars, r, -Math.round(w / 2), -h + Math.round(9 * zoom), w, h); c.restore();"""
new="""  // Personal cars: swap wheel-spoke positions every 110 ms. Generic traffic stays unchanged.
  const spin = color >= 2 && Math.floor((G.clock - G.carStart) / 110) % 2 === 1;
  const atlas = spin && IMG.carsSpin ? IMG.carsSpin : IMG.cars;
  const frame = spin && PR.carsSpin ? PR.carsSpin[color * 2 + (towards ? 0 : 1)] : r;
  c.save(); c.translate(Math.round(x), Math.round(y)); if (left) c.scale(-1, 1); blit(c, atlas, frame, -Math.round(w / 2), -h + Math.round(9 * zoom), w, h); c.restore();"""
assert old in s or 'const spin = color >= 2' in s
if 'const spin = color >= 2' not in s: s=s.replace(old,new)
# Single beep at closest approach: avoid playing on event initiation.
anchor="""  G.phase = 'traffic'; G.engineAt = 0;"""
assert anchor in s or 'G.carBeeped = false;' in s
if 'G.carBeeped = false;' not in s:
    s=s.replace(anchor,"""  G.phase = 'traffic'; G.engineAt = 0; G.carBeeped = false;""")
# Trigger passing beep once as cars approach midfield. Event begins at x=-13 or +13 and takes 9 sec.
anchor="""  const el = van ? G.clock - pk.stageStart : G.clock - G.carStart, u = clamp(el / (van ? PD[pk.stage] : CAR_MS));
  Sound.engine(van ? 'van' : 'car', u, el);"""
new="""  const el = van ? G.clock - pk.stageStart : G.clock - G.carStart, u = clamp(el / (van ? PD[pk.stage] : CAR_MS));
  // Only Phil's VW and Kim's Qashqai use the recorded two-beep sample, once near the players.
  if (car && G.carColor >= 2 && !G.carBeeped && u >= .46) {
    G.carBeeped = true;
    Sound.say('sfx-family-beep', 'family-car-horn');
  }
  Sound.engine(van ? 'van' : 'car', u, el);"""
assert anchor in s or "Sound.say('sfx-family-beep'" in s
if "Sound.say('sfx-family-beep'" not in s: s=s.replace(anchor,new)
# Exact sample amplitude ratio = 0.3; no further normalization.
anchor="""'sfx-miss': 0.35,"""
assert anchor in s or "'sfx-family-beep': 0.3" in s
if "'sfx-family-beep': 0.3" not in s: s=s.replace(anchor,"""'sfx-miss': 0.35, 'sfx-family-beep': 0.3,""")
SRC.write_text(s)

# Place the supplied compressed audio as a build input; preserve the original for provenance.
audio.mkdir(exist_ok=True, parents=True)
shutil.copyfile(Path(__file__).with_name('beep.wav'),audio/'family-car-beep.wav')
shutil.copyfile(Path(__file__).with_name('beep.mp3'),G/'sfx-family-beep.mp3')
# Build wheel spin sheet without otherwise regenerating art (preserves Pinky etc.).
import subprocess,sys
subprocess.run([sys.executable,str(ROOT/'tools/wheel-spin.py')],check=True)
print('Wheel-spin and 0.3-level family horn applied. Run python3 tools/build.py.')
