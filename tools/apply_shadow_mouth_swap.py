"""Correct Curbs street/race shadow mix-up and apply calibrated mouths.
Targets ONLY the main gameplay street and eating-race views; celebration untouched.
Standard-library-only installation script, run on the latest main branch.
"""
from pathlib import Path
import json, re
ROOT=Path(__file__).resolve().parents[1]
GAME=ROOT/'source/game.js'
assert GAME.is_file(), 'Expected Curb Fighters source/game.js'
s=GAME.read_text()
marker='CURBS_SHADOW_MOUTH_SWAP_V1'
if marker in s:
    print('Already installed. No changes.')
    raise SystemExit(0)
mouth=json.loads((ROOT/'tools/curbs-calibrated-mouths.json').read_text())
shadow=json.loads((ROOT/'tools/curbs-calibrated-street-shadow.json').read_text())
assert mouth['headPixelSize']==[52,46]
assert shadow['appliesTo']==['main-gameplay-street'] and shadow['shape']=='polygon'
assert shadow['sceneSize']==[836,470] and shadow['featherPx']==0
assert len(shadow['points'])==6
assert shadow['tint']=='#21233b' and shadow['opacity']==0.22

# Game avatar sprite order is PHIL, SHAY, ROSE, KIM (not alphabetical).
names=['phil','shay','rose','kim']
p=[mouth['characters'][n] for n in names]
assert all(all(isinstance(row[k],int) for k in ('x','y','w','h')) for row in p)
# The screenshot's pink guide line is approx. 10 head-source pixels below
# the currently rendered mouth. The exported calibration supplies ~5 of
# those pixels; add the remaining 5 to the user's saved locations.
vertical_correction=5
x=json.dumps([a['x'] for a in p])
y=json.dumps([a['y']+vertical_correction for a in p])
w=json.dumps([a['w'] for a in p])
h=json.dumps([a['h'] for a in p])
start=s.index('const EatOpenHeads = Array.from({ length: 4 }, (_, av) => {')
end=s.index('\nfunction drawHead(',start)
old=s[start:end]
assert "const mx = [31, 31, 31, 31][av], my = [34, 33, 34, 34][av];" in old
new=f"""// {marker}: user-calibrated mouth geometry + screenshot-guide vertical correction.
const EatOpenHeads = Array.from({{ length: 4 }}, (_, av) => {{
  const canv = makeCanvas(META.heads.w, META.heads.h), cc = canv.getContext('2d');
  cc.imageSmoothingEnabled = false;
  blitHead(cc, META.eat[av].head, 0, 0);
  // Avatar sprite order: Phil, Shay, Rose, Kim.
  const mx = {x}[av], my = {y}[av];
  const mw = {w}[av], mh = {h}[av];
  const left = mx - Math.floor(mw / 2), top = my - 1;
  cc.fillStyle = '#3b1c34'; cc.fillRect(left, top, mw, mh);
  cc.fillStyle = '#f9eee4'; cc.fillRect(left + 1, my, Math.max(1, mw - 2), 1);
  cc.fillStyle = '#c85d76'; cc.fillRect(mx - 1, my + mh - 3, Math.min(3, mw - 1), 1);
  return canv;
}});"""
s=s[:start]+new+s[end:]

# Restore the OLD ellipse to the ice-cream race. The polygon was mistakenly
# inserted there in the previous update, and belongs to the gameplay street.
race_start=s.index('function drawRaceScene(e, t) {')
race_end=s.index('\nfunction drawEater(',race_start)
race=s[race_start:race_end]
pattern=r"  // PINKY_STREET_SHADOW_POLYGON_V1:.*?\n  c\.save\(\);.*?\n  c\.restore\(\);"
assert len(re.findall(pattern,race,flags=re.S))==1, 'Expected exactly one existing race polygon'
race=re.sub(pattern,"  // Ice-cream race keeps its original parked-van ellipse.\n  c.fillStyle = '#2a204055'; c.beginPath(); c.ellipse(418, 372, 150, 9, 0, 0, Math.PI * 2); c.fill();",race, count=1,flags=re.S)
s=s[:race_start]+race+s[race_end:]

# Main isometric gameplay street: draw the calibrated polygon as a footprint
# relative to the moving van's ground position, scaled to its street sprite.
# This replaces ONLY the van-specific shadow call, not generic shadows.
points=json.dumps(shadow['points'],separators=(',',':'))
helper=f"""// {marker}: van-specific main street shadow; no effect on race/celebration.
function drawStreetPinkyShadow(p, zoom) {{
  const pts = {points};
  // Reference calibration was drawn in the 836x470 street preview around (418,374).
  // Rescale into the perspective street van's footprint and attach to its feet.
  ctx.save();
  ctx.globalAlpha = {shadow['opacity']};
  ctx.fillStyle = '{shadow['tint']}';
  ctx.beginPath();
  pts.forEach(([px, py], i) => {{
    const x = Math.round(p.x + (px - 418) * .65 * zoom);
    const y = Math.round(p.y + (py - 374) * .32 * zoom);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }});
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}}
"""
anchor='function drawScene(t) {'
assert s.count(anchor)==1
s=s.replace(anchor,helper+anchor,1)
oldcall="      shadow(tx, 0, 83, 21); const p = project(tx, 0);"
newcall="      const p = project(tx, 0);\n      drawStreetPinkyShadow(p, zm);"
assert s.count(oldcall)==1, 'Main street van shadow call drifted'
s=s.replace(oldcall,newcall,1)
assert s.count("c.ellipse(418, 372, 150, 9, 0, 0, Math.PI * 2); c.fill();")==2, 'Race and celebration ellipses must both survive'
assert s.count('PINKY_STREET_SHADOW_POLYGON_V1')==0, 'Old mistaken race polygon remains'
assert s.count(marker)==2
GAME.write_text(s)
print('Updated: calibrated mouths, polygon on main gameplay street, ellipse on eating race.')
print('Celebration scene and its ellipse unchanged.')
