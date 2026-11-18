"""Build index2.html with Phil, Shay and Rose (Kim's passing car remains).
The existing index.html and source files are never modified.
Requires Node for syntax validation, standard Python 3 for the build.
"""
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "source/game.js"
OUT = ROOT / "index2.html"
MARKER = "CURBS_THREE_CHARACTER_EDITION_V1"
base = SRC.read_text()

def replace_once(s, old, new, label):
    n = s.count(old)
    if n != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {n}")
    return s.replace(old, new, 1)

variant = base
variant = replace_once(variant,
    "  { name: 'KIM', desc: 'Dark brown hair, coral top and gold earrings' },\n",
    "", "remove Kim selectable entry")
variant = replace_once(variant,
    "const Select = { locked: false, reveal: null, timers: [], picks: [0, 1], angles: [0, Math.PI / 2],",
    "const Select = { locked: false, reveal: null, timers: [], picks: [0, 1], angles: [0, 2 * Math.PI / 3],",
    "initial carousel")
variant = replace_once(variant,
    "    for (let k = 0; k < 4; k++) {\n      const b = document.createElement('button');",
    "    for (let k = 0; k < 3; k++) {\n      const b = document.createElement('button');",
    "three character buttons")
variant = replace_once(variant,
    "Select.picks[p] = ((k % 4) + 4) % 4;",
    "Select.picks[p] = ((k % 3) + 3) % 3;",
    "character selection wrap")
variant = replace_once(variant,
    "Select.angles[p] = g.start - dx / Math.max(100, stage.clientWidth * .5) * Math.PI / 2;",
    "Select.angles[p] = g.start - dx / Math.max(100, stage.clientWidth * .5) * (2 * Math.PI / 3);",
    "carousel drag")
variant = replace_once(variant,
    "choose(p, Math.round(g.start / (Math.PI / 2)) + step);",
    "choose(p, Math.round(g.start / (2 * Math.PI / 3)) + step);",
    "carousel drag finish")
variant = replace_once(variant,
    "const pool = [0, 1, 2, 3].filter((i) => i !== G.avatars[0]);",
    "const pool = [0, 1, 2].filter((i) => i !== G.avatars[0]);",
    "exclude Kim from CPU")
variant = replace_once(variant,
    "Select.angles[1] = G.avatars[1] * Math.PI / 2;",
    "Select.angles[1] = G.avatars[1] * (2 * Math.PI / 3);",
    "CPU reveal angle")
variant = replace_once(variant,
    "const target = Select.picks[p] * Math.PI / 2;",
    "const target = Select.picks[p] * (2 * Math.PI / 3);",
    "carousel target angle")
variant = replace_once(variant,
    "const a = k * Math.PI / 2 - Select.angles[p], front = Math.cos(a),",
    "const a = k * (2 * Math.PI / 3) - Select.angles[p], front = Math.cos(a),",
    "carousel draw angle")
variant = replace_once(variant,
    "const winAv = G.avatars[Cele.winner], others = [0, 1, 2, 3].filter((k) => k !== winAv);",
    "const winAv = G.avatars[Cele.winner], others = [0, 1, 2].filter((k) => k !== winAv);",
    "celebration lineup")
variant = replace_once(variant,
    "[165, 295, 652].forEach((x, k) => {",
    "[225, 635].forEach((x, k) => {",
    "celebration side positions")
# Intentionally preserve Kim's Qashqai passing car as requested.
assert "if (!G.avatars.includes(3)) trafficCars.push(3); // Kim" in variant
# Keep embedded audio asset as-is, even if some recordings are unused.
variant = "// " + MARKER + " — character edition without Kim.\n" + variant
assert "name: 'KIM'" not in variant
assert "const pool = [0, 1, 2].filter" in variant
assert "const winAv = G.avatars[Cele.winner], others = [0, 1, 2].filter" in variant

# The repository's builder creates a standalone document. Generate to index2,
# then replace the exactly-matching original JS within that output.
# There are no writes to root index.html or any source files.
subprocess.run([sys.executable, str(ROOT/'tools/build.py'), str(OUT)], check=True)
html = OUT.read_text()
assert html.count(base) == 1, "Unable to isolate original game JS within standalone HTML"
html = html.replace(base, variant, 1)
assert html.count(MARKER) == 1
assert html.count("if (!G.avatars.includes(3)) trafficCars.push(3); // Kim") == 1
assert "name: 'KIM'" not in html
OUT.write_text(html)
# Syntax validate variant using an isolated temp file in a system temporary directory.
import tempfile
with tempfile.TemporaryDirectory() as folder:
    js = Path(folder) / "variant.js"
    js.write_text(variant)
    subprocess.run(["node", "--check", str(js)], check=True)
print(f"Created {OUT.name}: Phil, Shay, Rose selectable; Kim's passing car retained.")
