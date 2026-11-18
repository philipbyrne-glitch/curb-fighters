"""Apply calibrated Pinky's van shadow to ICE-CREAM RACE only.
Intentionally leaves celebration scene and its ellipse untouched.
Standard library only; requires the current Curb Fighters source layout.
"""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
source=ROOT/'source/game.js'
conf=json.loads((ROOT/'tools/pinky-street-shadow.json').read_text())
assert conf['appliesTo']==['ice-cream-race'], 'Refusing non-race scene changes'
assert conf['sceneSize']==[836,470] and conf['shape']=='polygon'
assert conf['featherPx']==0, 'This version requires zero feather'
points=conf['points']
assert len(points)>=3 and all(len(p)==2 and all(isinstance(v,(int,float)) for v in p) for p in points)
opacity=conf['opacity']
assert 0 <= opacity <= 1
tint=conf['tint']
assert isinstance(tint,str) and len(tint)==7 and tint.startswith('#') and all(c in '0123456789abcdefABCDEF' for c in tint[1:])
s=source.read_text()
marker='PINKY_STREET_SHADOW_POLYGON_V1'
if marker in s: 
    print('Already installed. Nothing to change.')
    raise SystemExit(0)
race='function drawRaceScene(e, t) {'
assert s.count(race)==1, 'Race scene function missing or duplicated'
before, after=s.split(race,1)
end=after.find('\nfunction drawEater(')
assert end>0, 'Cannot safely isolate race-scene drawing'
scene, rest=after[:end],after[end:]
ellipse="  c.fillStyle = '#2a204055'; c.beginPath(); c.ellipse(418, 372, 150, 9, 0, 0, Math.PI * 2); c.fill();"
assert scene.count(ellipse)==1, 'Expected original oval in the race scene'
# The polygon coordinates are native scene coordinates, no additional transformation.
serialized=json.dumps(points,separators=(',',':'))
drawing=f"""  // {marker}: calibrated street/race shadow ONLY (celebration ellipse unchanged).
  c.save();
  c.globalAlpha = {opacity};
  c.fillStyle = '{tint}';
  const streetShadowPoints = {serialized};
  c.beginPath();
  c.moveTo(streetShadowPoints[0][0], streetShadowPoints[0][1]);
  for (let j = 1; j < streetShadowPoints.length; j++) c.lineTo(streetShadowPoints[j][0], streetShadowPoints[j][1]);
  c.closePath();
  c.fill();
  c.restore();"""
scene=scene.replace(ellipse,drawing)
s2=before+race+scene+rest
# Guard rails: the other occurrence MUST remain unchanged.
assert s2.count(ellipse)==1, 'Celebration ellipse was unexpectedly altered'
assert s2.count(marker)==1
source.write_text(s2)
print('Updated only Pinky’s ice-cream race shadow. Celebration ellipse preserved.')
