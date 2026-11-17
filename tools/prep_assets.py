"""Pre-render every sprite at its in-game pixel size so the whole world shares one
apparent resolution, then pack compact atlases for embedding in the page."""
import json, base64, io, subprocess
from PIL import Image
import numpy as np

from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
A = str(ROOT / 'assets' / 'original') + '/'
G = str(ROOT / 'assets' / 'built') + '/'

def load(n): return Image.open(A + n).convert('RGBA')

def threshold(im, cut=144):
    a = np.array(im)
    alpha = a[..., 3]
    a[..., 3] = np.where(alpha < cut, 0, 255)
    a[a[..., 3] == 0] = 0
    return Image.fromarray(a)

def nearest(im, w, h):
    return im.resize((max(1, round(w)), max(1, round(h))), Image.NEAREST)

def jsround(v):
    # Math.round semantics (half rounds up) for parity with the approved runtime crops.
    import math
    return math.floor(v + 0.5)

def cache_pose(img, frame, anchor, body_h):
    sx, sy, sw, sh = frame[:4]
    ax, ay = anchor
    r = 72 / body_h
    cell = Image.new('RGBA', (128, 112), (0, 0, 0, 0))
    part = nearest(img.crop((sx, sy, sx + sw, sy + sh)), jsround(sw * r), jsround(sh * r))
    cell.alpha_composite(part, (jsround(64 + (sx - ax) * r), jsround(100 + (sy - ay) * r)))
    return threshold(cell)

frames = [[[88,30,150,272],[367,0,180,302],[668,31,229,271],[973,13,233,285]],[[85,346,145,271],[381,316,166,301],[659,351,224,266],[988,333,194,269]],[[75,654,161,286],[368,630,179,310],[656,660,226,280],[970,644,227,292]]]
anchors = [[[163,302],[465,302],[751,302],[1095,298]],[[159,617],[465,617],[747,617],[1086,602]],[[156,940],[460,940],[744,940],[1088,936]]]
idle = json.load(open(A + 'family-idle.json'))
alts = json.load(open(A + 'family-alternates.json'))
kim = json.load(open(A + 'kim-sprites.json'))
emotes = json.load(open(A + 'champion-emotes.json'))['frames']
walker = json.load(open(A + 'doodle-walker.json'))
cars = json.load(open(A + 'cars.json'))
pinky = json.load(open(A + 'pinky-sprites.json'))

fam, idleA, altA, kimA, emoA, walkA = map(load, ['family-sprites.png','family-idle.png','family-alternates.png','kim-sprites.png','champion-emotes.png','doodle-walker.png'])

cells, index = [], {}
def add(key, imgs):
    index[key] = list(range(len(cells), len(cells) + len(imgs)))
    cells.extend(imgs)

for i in range(3):
    add(f'base{i}', [cache_pose(fam, f, anchors[i][j], frames[i][0][3]) for j, f in enumerate(frames[i])])
add('base3', [cache_pose(kimA, f, f[4:6], kim[0][0][3]) for f in kim[0]])
for i in range(3):
    add(f'wait{i}', [cache_pose(idleA, f, f[4:6], idle[i][0][3]) for f in idle[i]])
    add(f'alt{i}', [cache_pose(altA, f, f[4:6], alts[i][0][3]) for f in alts[i]])
add('wait3', [cache_pose(kimA, f, f[4:6], kim[2][0][3]) for f in kim[2]])
add('alt3', [cache_pose(kimA, f, f[4:6], kim[1][0][3]) for f in kim[1]])
for i in range(4):
    add(f'emote{i}', [cache_pose(emoA, f, f[4:6], emotes[i][0][3]) for f in emotes[i]])
add('walker', [cache_pose(walkA, f, f[4:6], walker[0][3]) for f in walker])

cols = 10
rows = (len(cells) + cols - 1) // cols
atlas = Image.new('RGBA', (cols * 128, rows * 112), (0, 0, 0, 0))
for n, c in enumerate(cells):
    atlas.alpha_composite(c, ((n % cols) * 128, (n // cols) * 112))
atlas.save(G + 'actors.png', optimize=True)

# The yellow football: a crisp 24px in-world ball and a 48px version for big UI moments.
ballA = load('yellow-ball.png')
w, h = ballA.size
crop = ballA.crop((int(w * .115), int(h * .11), int(w * .115 + w * .77), int(h * .11 + h * .78)))
def solid_ball(im):
    # The centre highlight is translucent in the source; lay it over the ball's own yellow.
    from scipy import ndimage
    a = np.array(im)
    inside = ndimage.binary_fill_holes(a[..., 3] > 150)
    base = Image.new('RGBA', im.size, (246, 228, 22, 0))
    b = np.array(base); b[..., 3] = np.where(inside, 255, 0)
    base = Image.fromarray(b); base.alpha_composite(im)
    out = np.array(base); out[..., 3] = np.where(inside, 255, 0)
    return Image.fromarray(out)
import sys; sys.path.insert(0, str(ROOT / 'tools'))
from ballgen import make as make_ball  # area-averaged, palette-snapped, outlined
make_ball(24).save(G + 'ball24.png'); make_ball(60).save(G + 'ball48.png')

# Props drawn straight from their atlases at their zoom-1 sizes; the 1.5x halfway zoom
# upscales these exact pixels, never re-sampling finer detail.
carA = load('cars.png')
props = {}
car_imgs = []
for color in range(2):
    for rev in range(2):
        sx, sy, sw, sh = cars[color][rev][:4]
        car_imgs.append(threshold(nearest(carA.crop((sx, sy, sx + sw, sy + sh)), 104, 104 * sh / sw)))
# Two optional family cars. The original four entries remain unchanged (generic traffic).
# Each row: front/towards, rear/away. Phil = 4-5, Kim = 6-7.
family_car_sheet = load('family-cars.png')
for row in range(2):
    for col in range(2):
        part = family_car_sheet.crop((col * 627, row * 627, (col + 1) * 627, (row + 1) * 627))
        bb = part.getbbox()
        if not bb: raise ValueError('Missing family car frame: %s, %s' % (row, col))
        part = part.crop(bb)
        car_imgs.append(threshold(nearest(part, 104, 104 * part.height / part.width)))
colA = load('conker-collector.png')
cw, ch = colA.width / 4, colA.height
col_imgs = [threshold(nearest(colA.crop((int(k * cw), 0, int((k + 1) * cw), ch)), 78 * cw / ch, 78)) for k in range(4)]
pinA = load('pinky-sprites.png')
def pin(k, width=None, height=None):
    sx, sy, sw, sh = pinky[k]
    part = pinA.crop((sx, sy, sx + sw, sy + sh))
    if width: return threshold(nearest(part, width, width * sh / sw))
    return threshold(nearest(part, height * sw / sh, height))
# New 2:1 isometric van artwork. Both top frames share the same crop and
# only the window interior changes, avoiding a van-wide animation jump.
iso = load('pinky-van-iso.png')
van_drive = iso.crop((32, 65, 615, 580))
van_serving_art = iso.crop((660, 65, 1243, 580))
van_serving = van_drive.copy()
# Serving-window panel and Pinky; preserve every other pixel from the driving frame.
window = (112, 205, 337, 422)
van_serving.paste(van_serving_art.crop(window), window[:2])
truck = [threshold(nearest(frame, 246, 246 * frame.height / frame.width))
         for frame in (van_drive, van_serving)]
vendor = pin(2, height=75)
cone = pin(3, height=49)
plA = load('riverbank-sprites.png')
W, H = plA.size
pf = [[.02,.105,.465,.47],[.51,.027,.465,.545],[.025,.705,.46,.23],[.55,.635,.37,.3]]
plants = []
for k, (fx, fy, fw, fh) in enumerate(pf):
    part = plA.crop((int(fx * W), int(fy * H), int((fx + fw) * W), int((fy + fh) * H)))
    ht = [110, 110, 28, 35][k]
    plants.append(threshold(nearest(part, ht * part.width / part.height, ht)))

def strip(name, imgs):
    """Pack images left-to-right and record their rectangles."""
    width = sum(i.width for i in imgs) + 2 * len(imgs)
    height = max(i.height for i in imgs)
    s = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    x, rects = 0, []
    for i in imgs:
        s.alpha_composite(i, (x, 0)); rects.append([x, 0, i.width, i.height]); x += i.width + 2
    s.save(G + name + '.png', optimize=True)
    props[name] = rects
strip('cars', car_imgs)
strip('collector', col_imgs)
strip('pinky', truck + [vendor, cone])
strip('plants', plants)

# Four 32px ground tiles: grass, road, paving, river.
ter = Image.open(A + 'terrain.png').convert('RGB')
tw, th = ter.width // 2, ter.height // 2
tiles = Image.new('RGB', (128, 32))
for k in range(4):
    q = ter.crop(((k % 2) * tw, (k // 2) * th, (k % 2) * tw + tw, (k // 2) * th + th))
    tiles.paste(nearest(q, 32, 32), (k * 32, 0))
tiles.save(G + 'tiles.png')

# Choose Your Champion backdrop at the court's native pixel scale, split so clouds pass
# behind the trees: the full scene paints first, then the same scene with its sky cut away.
bd = Image.open(A + 'champion-backdrop-fence.png').convert('RGB')
arr = np.array(bd).astype(int)
r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
yy = np.arange(bd.height)[:, None].repeat(bd.width, 1)
sky = (yy < bd.height * .56) & (b > g * 1.12) & (b > r * 1.35)
fg = np.dstack([np.array(bd), np.where(sky, 0, 255).astype(np.uint8)])
half = (bd.width // 2, bd.height // 2)
bd.resize(half, Image.LANCZOS).save(G + 'backdrop.webp', quality=90, method=6)
fgim = Image.fromarray(fg, 'RGBA')
fgim = threshold(fgim.resize(half, Image.LANCZOS), 128)
fgim.save(G + 'foreground.webp', quality=90, method=6, alpha_quality=100)

# Clouds lifted from the cloudy variant of the backdrop.
cl = Image.open(A + 'champion-backdrop.png').convert('RGB')
clouds = []
for (x, y, w2, h2), tw2 in zip([[14,0,490,182],[850,85,448,140],[545,0,310,110]], [70, 64, 46]):
    c = np.array(cl.crop((x, y, x + w2, y + h2))).astype(int)
    alpha = np.where((c[..., 0] > 150) & (c[..., 1] > 170) & (c[..., 2] > 200) & (c[..., 0] > c[..., 2] * .78), 255, 0).astype(np.uint8)
    im = Image.fromarray(np.dstack([c.astype(np.uint8), alpha]), 'RGBA')
    bbox = im.getbbox(); im = im.crop(bbox)
    clouds.append(threshold(nearest(im, tw2, tw2 * im.height / im.width)))
strip('clouds', clouds)

# Merge, never replace: prep_extra.py adds its own keys to the same file.
import os as _os
_meta = json.load(open(G + 'meta.json')) if _os.path.exists(G + 'meta.json') else {}
_meta.update({'actors': {'cols': cols, 'index': index}, 'props': props})
json.dump(_meta, open(G + 'meta.json', 'w'))
# Music: compact mono MP3s, made once (needs ffmpeg). Delete a built track to re-encode it.
import os, shutil, subprocess
for key in ['intro', 'select', 'game', 'pinky']:
    out = G + key + '.mp3'
    if os.path.exists(out): continue
    if not shutil.which('ffmpeg'): raise SystemExit('ffmpeg is needed to encode ' + out)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', A + key + '-theme.mp3', '-ac', '1', '-ar', '44100', '-b:a', '80k', '-codec:a', 'libmp3lame', out], check=True)
# Extra audio Phil supplies: drop any format into assets/original/audio/ with these names.
# Voices are trimmed of silence and levelled; the win theme is kept as music.
EXTRA = {'win': 'win-theme', 'voice-phil': 'voice-phil', 'voice-kim': 'voice-kim', 'voice-rose': 'voice-rose',
         'voice-shay': 'voice-shay', 'voice-pinkys': 'voice-pinkys', 'voice-noodles': 'voice-noodles',
         'sfx-miss': 'sfx-miss', 'voice-bounce': 'voice-bounce', 'voice-versus': 'voice-versus'}
SFX_LEVEL = {'sfx-miss': -24.0}   # the missed-shot sound sits at half the voices' volume (-6 dB)
import glob
for key, stem in EXTRA.items():
    srcs = sorted(glob.glob(A + 'audio/' + stem + '.*'))
    srcs = [f for f in srcs if not f.endswith('.md')]
    out = G + key + '.mp3'
    if not srcs or (os.path.exists(out) and os.path.getmtime(out) >= os.path.getmtime(srcs[0])): continue
    if not shutil.which('ffmpeg'): raise SystemExit('ffmpeg is needed to encode ' + srcs[0])
    if key == 'win':
        # Match the game music's loudness, with a limiter against clipping. ffmpeg's mix-down to mono
        # shifts the level unpredictably, so measure what actually came out and correct it.
        import re
        def mean_db(f):
            res = subprocess.run(['ffmpeg', '-hide_banner', '-i', f, '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True).stderr
            return float(re.search(r'mean_volume: (-?[0-9.]+) dB', res).group(1))
        target, gain = mean_db(G + 'game.mp3'), 0.0
        for _ in range(4):
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', srcs[0], '-af', 'aformat=channel_layouts=mono,volume=%.2fdB,alimiter=limit=0.95:level=false' % gain,
                            '-ar', '44100', '-b:a', '80k', '-codec:a', 'libmp3lame', out], check=True)
            miss = target - mean_db(out)
            if abs(miss) < .3: break
            gain += miss
        print('encoded win from', os.path.basename(srcs[0]), '(%+.1f dB to match the game music)' % gain)
        continue
    if key.startswith('sfx-'):
        # Short effects: no trimming (they're tight already), just levelled to sit with the voices.
        import re
        def mean_db(f):
            res = subprocess.run(['ffmpeg', '-hide_banner', '-i', f, '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True).stderr
            return float(re.search(r'mean_volume: (-?[0-9.]+) dB', res).group(1))
        gain = 0.0
        for _ in range(4):
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', srcs[0], '-af', 'aformat=channel_layouts=mono,volume=%.2fdB,alimiter=limit=0.95:level=false' % gain,
                            '-ar', '44100', '-b:a', '96k', '-codec:a', 'libmp3lame', out], check=True)
            miss = SFX_LEVEL.get(key, -18.0) - mean_db(out)
            if abs(miss) < .4: break
            gain += miss
        print('encoded', key, 'from', os.path.basename(srcs[0]), '(%+.1f dB)' % gain)
        continue
    else:
        # Trim the dead air but keep a breath either side, so no consonant gets clipped.
        trim = ('silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.03,areverse,'
                'silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.06,areverse')
        af = ['-af', trim + ',loudnorm=I=-15:TP=-1.5:LRA=9', '-ac', '1', '-ar', '44100', '-b:a', '96k']
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', srcs[0], *af, '-codec:a', 'libmp3lame', out], check=True)
    print('encoded', key, 'from', os.path.basename(srcs[0]))
print('cells', len(cells), atlas.size)
