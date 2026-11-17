"""Fix Pinky's race mouth placement and neck seam after the first polish patch."""
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
game = ROOT/'source/game.js'
assert game.is_file(), 'Run from tools/ in the repo'
s = game.read_text()
if 'PINKY_RACE_ANIMATION_FIX_V1' in s:
    raise SystemExit('Pinky race animation fix already applied.')

def replace(old,new):
    global s
    n=s.count(old)
    if n!=1:
        raise RuntimeError(f'Anchor mismatch ({n}): {old[:80]!r}')
    s=s.replace(old,new)

# Reposition open-mouth overlays lower on each face.
replace("  const mx = [28, 28, 28, 28][av], my = [27, 28, 28, 29][av];\n  cc.fillStyle = '#3b1c34'; cc.fillRect(mx - 2, my - 1, 7, 6); // open mouth\n  cc.fillStyle = '#f9eee4'; cc.fillRect(mx - 1, my, 5, 1);     // top teeth\n  cc.fillStyle = '#c85d76'; cc.fillRect(mx, my + 3, 3, 1);   // tongue",
"  // PINKY_RACE_ANIMATION_FIX_V1: tuned per-character mouth anchors\n  const mx = [31, 31, 31, 31][av], my = [34, 33, 34, 34][av];\n  cc.fillStyle = '#3b1c34'; cc.fillRect(mx - 2, my - 1, 6, 5); // open mouth\n  cc.fillStyle = '#f9eee4'; cc.fillRect(mx - 1, my, 4, 1);     // top teeth\n  cc.fillStyle = '#c85d76'; cc.fillRect(mx, my + 2, 2, 1);     // tongue")

# Keep head slightly lower in the eating pose and add a tiny seam cover patch.
replace("  // The head stays anchored to the neck; moving it down exposed a transparent seam.\n  if (mouthOpen) c.drawImage(EatOpenHeads[av], (ho[0] - 64) * f, (ho[1] - 100) * f, META.heads.w * f, META.heads.h * f);\n  else blitHead(c, key, (ho[0] - 64) * f, (ho[1] - 100) * f, f);",
"  // PINKY_RACE_ANIMATION_FIX_V1: lower the whole head 1px in the eating pose and\n  // paint a tiny bridge under the chin so no transparent neck seam can show through.\n  const hx = (ho[0] - 64) * f, hy = (ho[1] - 99) * f;\n  const seam = [[27, 43, 10, 2], [27, 43, 10, 2], [27, 43, 10, 2], [27, 43, 10, 2]][av];\n  c.fillStyle = '#f3c7a2'; c.fillRect((ho[0] - 64 + seam[0]) * f, (ho[1] - 99 + seam[1]) * f, seam[2] * f, seam[3] * f);\n  if (mouthOpen) c.drawImage(EatOpenHeads[av], hx, hy, META.heads.w * f, META.heads.h * f);\n  else blitHead(c, key, hx, hy, f);")

# When chomping, lift the 99 a touch further so it meets the corrected mouth.
replace("(coneTop - 100 - (mouthOpen ? 2 : 0)) * f, r[2] * f, r[3] * f",
        "(coneTop - 100 - (mouthOpen ? 3 : 0)) * f, r[2] * f, r[3] * f")

game.write_text(s)
print('Applied Pinky race animation fix. Run: python3 tools/build.py')
