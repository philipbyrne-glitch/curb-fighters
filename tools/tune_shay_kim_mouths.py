"""Tweak only Shay's and Kim's eating-mouth vertical offsets.
Source avatar order: Phil, Shay, Rose, Kim.
"""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
path=ROOT/'source/game.js'
assert path.is_file(), 'Expected Curb Fighters source/game.js'
s=path.read_text()
old='const mx = [28, 33, 32, 31][av], my = [39, 34, 41, 40][av];'
new='const mx = [28, 33, 32, 31][av], my = [39, 29, 41, 30][av]; // SHAY_KIM_MOUTH_TUNE_V1'
if new in s:
    print('Mouth adjustment already installed.')
    raise SystemExit(0)
assert s.count(old)==1, 'The mouth positions differ from the verified base; refusing to overwrite newer work.'
before=s
s=s.replace(old,new,1)
assert s.replace(new,old,1)==before, 'Unexpected source modifications'
assert 'PINKY_ISO_SHADOW_CALIBRATED_V1' in s, 'Expected isometric van shadow is missing'
assert 'CURBS_VICTORY_AUDIO_FLOW_V1' in s, 'Expected victory audio update is missing'
assert 'PINKYS_KEYBOARD_SECRET_V2' in s, 'Expected Pinkys shortcut is missing'
path.write_text(s)
print('Adjusted Shay from Y34 to Y29 and Kim from Y40 to Y30; Phil and Rose untouched.')
