"""Two surgical fixes: restore calibrated mouth y values + add hidden pinkys test sequence.
Does NOT touch either van shadow or the VS/victory audio update.
Standard library only.
"""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
path=ROOT/'source/game.js'
assert path.is_file(), 'Expected source/game.js in Curb Fighters repo'
s=path.read_text()
mouth_marker='CURBS_EXACT_CALIBRATED_MOUTHS_V1'
secret_marker='PINKYS_KEYBOARD_SECRET_V2'
if mouth_marker in s and secret_marker in s:
    print('Both fixes already applied.')
    raise SystemExit(0)

old="const mx = [28, 33, 32, 31][av], my = [44, 39, 46, 45][av];"
new="// CURBS_EXACT_CALIBRATED_MOUTHS_V1: exactly the Sprite Lab values; Phil, Shay, Rose, Kim.\n  const mx = [28, 33, 32, 31][av], my = [39, 34, 41, 40][av];"
if mouth_marker not in s:
    assert s.count(old)==1, 'Mouth anchor changed: refusing to overwrite newer positioning'
    s=s.replace(old,new,1)

# This listener observes the secret sequence BEFORE the existing gameplay keyboard
# handler. It does not swallow arbitrary keys or make P2's P action lag.
# Once "pi" has been typed, later letters in "pinkys" are swallowed to prevent
# 'n' from triggering NOODLES. The initial P may still be a normal P2 action.
# Sequence times out after 1.2 seconds between letters.
needle="document.addEventListener('keydown', (e) => {\n  if (e.metaKey || e.ctrlKey || e.altKey) return;"
insert="""// PINKYS_KEYBOARD_SECRET_V2: hidden playtest encounter by typing 'pinkys'.
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
  if (detectPinkySecret(e)) return;"""
if secret_marker not in s:
    assert s.count(needle)==1, 'Keyboard handler changed: refusing to patch blindly'
    s=s.replace(needle,insert,1)

assert s.count("c.ellipse(418, 372, 150, 9, 0, 0, Math.PI * 2); c.fill();")==2, 'Existing race/celebration shadow differs'
assert "PINKY_ISO_SHADOW_CALIBRATED_V1" in s, 'Expected latest isometric van shadow not present'
assert "CURBS_VICTORY_AUDIO_FLOW_V1" in s, 'Expected latest victory audio integration not present'
assert mouth_marker in s and secret_marker in s
path.write_text(s)
print('Updated mouths to exact calibrated positions and added hidden pinkys trigger.')
print('Isometric shadow, race/celebration shadows and victory audio unchanged.')
