"""Inline the stylesheet, script, artwork and music into one self-contained page."""
import base64, json, os, sys

from pathlib import Path
REPO = Path(__file__).resolve().parents[1]
GEN = str(REPO / 'assets' / 'built') + '/'
SRC = str(REPO / 'source') + '/'
OUT = sys.argv[1] if len(sys.argv) > 1 else str(REPO / 'index.html')

images = {
    'actors': 'actors_q.png', 'ball24': 'ball24.png', 'ball48': 'ball48.png', 'cars': 'cars_q.png', 'carsSpin': 'cars_spin.png',
    'collector': 'collector_q.png', 'pinky': 'pinky_q.png', 'plants': 'plants_q.png', 'tiles': 'tiles.png',
    'clouds': 'clouds.png', 'backdrop': 'backdrop.webp', 'foreground': 'foreground.webp',
    'heads': 'heads_q.png', 'eat': 'eat_q.png', 'cones': 'cones.png', 'vanSide': 'van_side_q.png',
    'trophy': 'trophy_q.png', 'spurl': 'spurl.png',
}
mime = {'.png': 'image/png', '.webp': 'image/webp'}

def b64(path):
    with open(path, 'rb') as f:
        return base64.b64encode(f.read()).decode('ascii')

img = {k: 'data:%s;base64,%s' % (mime[os.path.splitext(v)[1]], b64(GEN + v)) for k, v in images.items()}
meta = json.load(open(GEN + 'meta.json'))
missing = [k for k in ['actors', 'props', 'heads', 'eat', 'cones', 'pinkyArt', 'vanSide', 'trophy', 'spurl'] if k not in meta]
if missing: raise SystemExit('assets/built/meta.json is missing %s: run tools/prep_extra.py' % ', '.join(missing))
data = '<script>window.CF_DATA=' + json.dumps({'img': img, 'meta': meta}, separators=(',', ':')) + ';</script>\n'
# Music and voices; the optional ones (win theme, names, chants) are embedded once they exist,
# and until then the game plays its synth stand-ins.
for key in ['intro', 'select', 'game', 'pinky', 'win', 'voice-phil', 'voice-kim', 'voice-rose', 'voice-shay', 'voice-pinkys', 'voice-noodles', 'sfx-miss', 'sfx-family-beep', 'voice-bounce', 'voice-versus']:
    if os.path.exists(GEN + key + '.mp3'):
        data += '<script type="text/plain" id="aud-%s">%s</script>\n' % (key, b64(GEN + key + '.mp3'))
icons = ('<link rel="icon" type="image/png" sizes="32x32" href="data:image/png;base64,%s">\n'
         '<link rel="apple-touch-icon" href="data:image/png;base64,%s">') % (b64(GEN + 'favicon.png'), b64(GEN + 'apple-touch-icon.png'))

html = open(SRC + 'index.html').read()
css = open(SRC + 'style.css').read()
# Both pixel faces (SIL Open Font License) travel inside the page: no font CDN, no fallback flash.
faces = ''
for family, file in [('CF Arcade', 'press-start-2p.woff2'), ('CF Pixel', 'vt323.woff2')]:
    faces += "@font-face{font-family:'%s';src:url(data:font/woff2;base64,%s) format('woff2');font-display:block}\n" % (family, b64(GEN + 'fonts/' + file))
css = faces + css
js = open(SRC + 'game.js').read()
assert '</script' not in js
html = html.replace('/*CSS*/', css).replace('<!--DATA-->', data).replace('/*JS*/', js).replace('<!--ICONS-->', icons)
open(OUT, 'w').write(html)
print(OUT, round(len(html) / 1e6, 2), 'MB')
