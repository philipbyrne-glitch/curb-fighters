"""Build the temporary sound desk: tools/mixer.html with the game's own sound engine and audio."""
import base64, os, sys
from pathlib import Path
REPO = Path(__file__).resolve().parents[1]
GEN = str(REPO / 'assets' / 'built') + '/'
OUT = sys.argv[1] if len(sys.argv) > 1 else str(REPO / 'sound-desk.html')
b64 = lambda p: base64.b64encode(open(p, 'rb').read()).decode('ascii')

game = open(REPO / 'source' / 'game.js').read()
start = game.index('const Sound = (() => {')
end = game.index('\n})();\n', start) + len('\n})();\n')
sound = game[start:end]          # the exact engine the game uses, levels and all

faces = ''.join("@font-face{font-family:'%s';src:url(data:font/woff2;base64,%s) format('woff2')}\n" % (f, b64(GEN + 'fonts/' + n))
                for f, n in [('CF Arcade', 'press-start-2p.woff2'), ('CF Pixel', 'vt323.woff2')])
audio = ''
for key in ['intro', 'select', 'game', 'pinky', 'win', 'voice-phil', 'voice-kim', 'voice-rose', 'voice-shay', 'voice-pinkys', 'voice-noodles', 'sfx-miss', 'voice-bounce', 'voice-versus']:
    if os.path.exists(GEN + key + '.mp3'):
        audio += '<script type="text/plain" id="aud-%s">%s</script>\n' % (key, b64(GEN + key + '.mp3'))
html = open(REPO / 'tools' / 'mixer.html').read()
assert '</script' not in sound
html = html.replace('/*FONTS*/', faces).replace('<!--AUDIO-->', audio).replace('/*SOUND*/', sound)
open(OUT, 'w').write(html)
print(OUT, round(len(html) / 1e6, 2), 'MB')
