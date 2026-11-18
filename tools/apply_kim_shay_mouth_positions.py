"""Update only Kim's and Shay's ice-cream open-mouth positions."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
game = ROOT / "source/game.js"
source = game.read_text()
old = "const mx = [28, 33, 32, 31][av], my = [39, 29, 41, 30][av]; // SHAY_KIM_MOUTH_TUNE_V1"
new = "const mx = [28, 33, 32, 33][av], my = [39, 40, 41, 36][av]; // KIM_SHAY_MOUTH_POSITION_V2"
if new in source:
    print("Already installed.")
    raise SystemExit(0)
assert source.count(old) == 1, "Unexpected existing mouth coordinates; refusing blind replacement"
assert "PINKY_ISO_SHADOW_CALIBRATED_V1" in source
assert "CURBS_VICTORY_AUDIO_FLOW_V1" in source
assert "PINKYS_KEYBOARD_SECRET_V2" in source
changed = source.replace(old, new, 1)
assert changed.replace(new, old, 1) == source
game.write_text(changed)
print("Shay: Y29 -> Y40 (down 11). Kim: X31 -> X33, Y30 -> Y36 (right 2, down 6). Phil and Rose unchanged.")
