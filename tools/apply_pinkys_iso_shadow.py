"""Install calibrated main-gameplay Pinky's van shadow only (no other scenes)."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
game=ROOT/'source/game.js'
config=json.loads((ROOT/'tools/pinkys-isometric-shadow.json').read_text())
assert config['appliesTo']==['main-gameplay-street']
assert config['coordinateSystem']=='van-ground-anchor-local-source-pixels'
assert config['sprite']=='assets/built/pinky.png'
assert config['sourceRect']==[248,0,246,217]
assert config['anchorInSprite']==[123,205]
assert config['featherPx']==0
assert len(config['vertices'])>=3
assert all(len(v)==2 and all(isinstance(n,(int,float)) for n in v) for v in config['vertices'])
assert 0<=config['opacity']<=1
assert len(config['tint'])==7 and config['tint'][0]=='#'
int(config['tint'][1:],16)
source=game.read_text()
marker='PINKY_ISO_SHADOW_CALIBRATED_V1'
if marker in source:
    print('Already applied; no changes.')
    raise SystemExit(0)
old_start='function drawStreetPinkyShadow(p, zoom) {'
old_end='\nfunction drawScene(t) {'
assert source.count(old_start)==1 and source.count(old_end)==1, 'Cannot find expected gameplay shadow helper'
start=source.index(old_start)
end=source.index(old_end,start)
old=source[start:end]
assert 'const pts = [[357,288],[471,316],[531,351],[466,373],[410,375],[238,334]];' in old, 'Existing shadow implementation changed'
pts=json.dumps(config['vertices'],separators=(',',':'))
new=f"""// {marker}: exact calibrated source-pixel polygon, relative to the
// main gameplay isometric van's shared (123,205) ground anchor.
function drawStreetPinkyShadow(p, zoom) {{
  const verts = {pts};
  ctx.save();
  ctx.globalAlpha = {config['opacity']};
  ctx.fillStyle = '{config['tint']}';
  ctx.beginPath();
  verts.forEach(([localX, localY], i) => {{
    const x = Math.round(p.x + localX * zoom);
    const y = Math.round(p.y + localY * zoom);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }});
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}}"""
updated=source[:start]+new+source[end:]
assert updated.count('drawStreetPinkyShadow(p, zm);')==1, 'Gameplay van draw call missing'
assert updated.count('c.ellipse(418, 372, 150, 9, 0, 0, Math.PI * 2); c.fill();')==2, 'Other scenes should remain untouched'
assert updated.count(marker)==1
game.write_text(updated)
print('Installed calibrated isometric gameplay shadow. Race and celebration untouched.')
