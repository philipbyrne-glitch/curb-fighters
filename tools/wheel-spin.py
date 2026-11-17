"""Generate an alternate wheel-spoke frame for Phil and Kim's existing car sprites.
Only pixels inside wheel hubs are altered, leaving headlights, body, drivers intact.
"""
from pathlib import Path
from PIL import Image
import json, math
ROOT=Path(__file__).resolve().parents[1]
G=ROOT/'assets/built'
base=Image.open(G/'cars.png').convert('RGBA')
meta_path=G/'meta.json'; meta=json.loads(meta_path.read_text())
rects=meta['props']['cars']
assert len(rects)>=8,'Family cars must be installed before wheel animation.'
# Car frames 4/5 are VW front/back; 6/7 are Qashqai front/back.
# Centre x,y and inner-rim radii are in the corresponding 104px game sprite.
wheels={
 4:[(10,49,5),(49,62,6)],
 5:[(51,63,6),(95,43,6)],
 6:[(10,56,6),(46,65,6)],
 7:[(56,64,7),(95,48,6)],
}
from PIL import ImageDraw
alt=base.copy()
for ci,centres in wheels.items():
 x,y,w,h=rects[ci]
 car=base.crop((x,y,x+w,y+h)); changed=car.copy()
 for cx,cy,rad in centres:
  # Rotate only the inner hub pixels (not the tyre or body/cladding).
  src=car.copy(); overlay=Image.new('RGBA',car.size,(0,0,0,0))
  # Rotate circular center content by 45 degrees, nearest-neighbour only.
  tile=src.crop((cx-rad,cy-rad,cx+rad+1,cy+rad+1))
  rotated=tile.rotate(45, resample=Image.Resampling.NEAREST, expand=False)
  mask=Image.new('L',tile.size,0); draw=ImageDraw.Draw(mask);draw.ellipse((1,1,tile.width-2,tile.height-2),fill=255)
  changed.paste(rotated,(cx-rad,cy-rad),mask)
 alt.paste(changed,(x,y))
alt.save(G/'cars_spin.png',optimize=True)
# Same rects: the additional atlas preserves every sprite's position and size.
meta['props']['carsSpin']=rects
meta_path.write_text(json.dumps(meta,separators=(',',':')))
print('Generated',G/'cars_spin.png')
