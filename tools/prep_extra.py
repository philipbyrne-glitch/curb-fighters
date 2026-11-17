"""Second asset pass, run after prep_assets.py:
darker road, van re-angled to the isometric road (plus a side-on van for the race),
head-only portraits for every pose, an ice-cream eating pose, and bitten-cone stages."""
import json
import numpy as np
from PIL import Image
from scipy import ndimage

from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
A = str(ROOT / 'assets' / 'original') + '/'
G = str(ROOT / 'assets' / 'built') + '/'
meta = json.load(open(G + 'meta.json'))
actors = np.array(Image.open(G + 'actors.png').convert('RGBA'))
COLS = 10
IDX = meta['actors']['index']

def cell(n): return actors[(n // COLS) * 112:(n // COLS) * 112 + 112, (n % COLS) * 128:(n % COLS) * 128 + 128].copy()
def threshold(a, cut=144):
    a = a.copy(); a[..., 3] = np.where(a[..., 3] < cut, 0, 255); a[a[..., 3] == 0] = 0; return a
def nearest(img, w, h): return img.resize((max(1, round(w)), max(1, round(h))), Image.NEAREST)

# ---------------------------------------------------------------- road
ter = Image.open(A + 'terrain.png').convert('RGB')
tw, th = ter.width // 2, ter.height // 2
tiles = Image.new('RGB', (128, 32))
for k in range(4):
    q = nearest(ter.crop(((k % 2) * tw, (k // 2) * th, (k % 2) * tw + tw, (k // 2) * th + th)), 32, 32)
    if k == 1:  # the road: about a fifth darker, a touch cooler
        a = np.array(q).astype(float) * np.array([.78, .79, .83]); q = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    tiles.paste(q, (k * 32, 0))
tiles.save(G + 'tiles.png')

# ---------------------------------------------------------------- van
pin = Image.open(A + 'pinky-sprites.png').convert('RGBA')
pf = json.load(open(A + 'pinky-sprites.json'))
def crop(k): x, y, w, h = pf[k]; return pin.crop((x, y, x + w, y + h))
def shear(img, k):
    """Vertical shear about the centre column: columns slide, every pixel stays square."""
    w, h = img.size; pad = int(abs(k) * w / 2) + 2
    a = np.array(img); out = np.zeros((h + 2 * pad, w, 4), np.uint8)
    for x in range(w):
        dy = int(round(k * (x - w / 2))); out[pad + dy:pad + dy + h, x] = a[:, x]
    return Image.fromarray(out), pad
def match_offset(small, big):
    """Where frame 0 sits inside frame 1 (both 1/4 scale), by brute-force alpha+colour match."""
    s = np.array(small.resize((small.width // 4, small.height // 4))).astype(int)
    b = np.array(big.resize((big.width // 4, big.height // 4))).astype(int)
    best = None
    for dy in range(-12, 13):
        for dx in range(0, b.shape[1] - s.shape[1] + 1):
            sy0, by0 = max(0, -dy), max(0, dy)
            hh = min(s.shape[0] - sy0, b.shape[0] - by0)
            sa, ba = s[sy0:sy0 + hh], b[by0:by0 + hh, dx:dx + s.shape[1]]
            m = (sa[..., 3] > 0) & (ba[..., 3] > 0)
            score = np.abs(sa[..., :3] - ba[..., :3]).sum(-1)[m].mean() + 400 * (1 - m.mean())
            if best is None or score < best[0]: best = (score, dx * 4, dy * 4)
    return best[1], best[2]

f0, f1 = crop(0), crop(1)
ox, oy = match_offset(f0, f1)
import sys; sys.path.insert(0, str(ROOT / 'tools'))
# Pinky's van is used exactly as drawn. Shearing it and re-projecting it in 3D were both tried and
# rejected (they warp the art); new van art at the street's angle is the real fix (docs/VAN-ART-BRIEF.md).
S0 = 246 / f0.width
anchors = [[round(f0.width * S0 / 2), round(f0.height * S0 - 12)], [round((f0.width / 2 + ox) * S0), round((f0.height + oy) * S0 - 12)]]
exhaust = [round((24 - f0.width / 2) * S0), round((350 - f0.height) * S0 + 12)]     # the rear bumper, from the anchor
# Front-on scenes: the serving frame as drawn, at the race's 2px-per-art-pixel scale.
RS = .47                     # sized so Pinky's bubble clears the race titles above the roof
side = Image.fromarray(threshold(np.array(nearest(f1, f1.width * RS, f1.height * RS))))
bb = side.getbbox(); side = side.crop(bb)
pinky_face = [round(232 * RS) - bb[0], round(150 * RS) - bb[1]]

# ---------------------------------------------------------------- heads
CUT = [64, 63, 65, 67]   # chin/neck row of each neutral pose (Phil, Shay, Rose, Kim)
HW, HH = 52, 46
char_cells = {i: IDX['base%d' % i] + IDX['wait%d' % i] + IDX['alt%d' % i] + IDX['emote%d' % i] for i in range(4)}
heads, offs = {}, {}
for i in range(4):
    T = cell(IDX['base%d' % i][0])
    Tm = (T[..., 3] > 0); Tm[CUT[i] + 1:] = False
    ys, xs = np.nonzero(Tm)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    hx = (HW - (x1 - x0 + 1)) // 2 - x0
    hy = HH - (y1 - y0 + 1) - 1 - y0
    Td = ndimage.binary_dilation(Tm, iterations=1)
    dys, dxs = np.nonzero(Td)
    for n in char_cells[i]:
        C = cell(n)
        best = (1e9, 0, 0)
        for dy in range(-30, 9):
            for dx in range(-16, 17):
                yy, xx = ys + dy, xs + dx
                ok = (yy >= 0) & (yy < 112) & (xx >= 0) & (xx < 128)
                a = C[yy[ok], xx[ok]]; t = T[ys[ok], xs[ok]]
                opaque = a[:, 3] > 0
                diff = np.minimum(np.abs(a[:, :3].astype(int) - t[:, :3].astype(int)).sum(1) / 200, 1)
                score = ((~opaque).sum() + (~ok).sum() + diff[opaque].sum()) / len(ys)
                if score < best[0]: best = (score, dx, dy)
        _, dx, dy = best
        out = np.zeros((HH, HW, 4), np.uint8)
        yy, xx = dys + dy, dxs + dx
        ok = (yy >= 0) & (yy < 112) & (xx >= 0) & (xx < 128) & (dys + hy >= 0) & (dys + hy < HH) & (dxs + hx >= 0) & (dxs + hx < HW)
        out[dys[ok] + hy, dxs[ok] + hx] = C[yy[ok], xx[ok]]
        lab, nlab = ndimage.label(out[..., 3] > 0, structure=np.ones((3, 3)))
        if nlab > 1:
            sizes = ndimage.sum(np.ones_like(lab), lab, range(1, nlab + 1)); keep = 1 + int(np.argmax(sizes))
            out[lab != keep] = 0
        heads[n] = out
        offs[n] = [int(dx - hx), int(dy - hy)]   # cell coords of the head box's top-left

# ---------------------------------------------------------------- eating pose
# Each character's phone-scroll pose, phone swapped for a 99 held at the chest.
def is_skin(c): return (c[..., 0] > 170) & (c[..., 1] > 120) & (c[..., 2] > 95) & (c[..., 0] > c[..., 1]) & (c[..., 1] > c[..., 2]) & ((c[..., 0] - c[..., 2]) > 35)
eat_bodies, eat_hands, eat_meta = [], [], []
for i in range(4):
    n = IDX['emote%d' % i][3]; C = cell(n).astype(int)
    r, g, b, al = C[..., 0], C[..., 1], C[..., 2], C[..., 3] > 0
    region = np.zeros_like(al); region[50:78, 50:88] = True
    if i in (0, 1): phone = (b > 140) & (b > r + 40) & (b > g - 10) & region & al
    else: phone = (r > 200) & (b > 110) & (g < 135) & region & al
    lab, nl = ndimage.label(phone)
    if nl > 1:
        sizes = ndimage.sum(np.ones_like(lab), lab, range(1, nl + 1)); phone = lab == (1 + int(np.argmax(sizes)))
    py, px = np.nonzero(phone)
    pb = [px.min(), py.min(), px.max(), py.max()]
    box = np.zeros_like(al); box[pb[1] - 1:pb[3] + 2, pb[0] - 1:pb[2] + 2] = True
    dark = (C[..., :3].sum(-1) < 210) & al
    phone_all = (phone | (dark & box & ~ndimage.binary_dilation(is_skin(C), iterations=1)))
    near = np.zeros_like(al); near[pb[1] - 5:pb[3] + 6, pb[0] - 6:pb[2] + 7] = True
    skin = is_skin(C) & near & ~phone
    hands = skin | (dark & near & ndimage.binary_dilation(skin, iterations=1) & ~phone)
    body = C.copy().astype(np.uint8)
    # Paint the phone out with the shirt colour just beside it.
    shirt_samples = C[pb[1]:pb[3] + 1, max(0, pb[0] - 5):pb[0] - 1].reshape(-1, 4)
    shirt_samples = shirt_samples[(shirt_samples[:, 3] > 0) & ~is_skin(shirt_samples[None])[0] & (shirt_samples[:, :3].sum(1) > 210)]
    fill = np.median(shirt_samples[:, :3], 0).astype(np.uint8) if len(shirt_samples) else np.array([200, 200, 200], np.uint8)
    # Inpaint: grow the surrounding shirt colours inward, never skin or outline.
    todo = phone_all.copy(); src_ok = al & ~phone_all & ~is_skin(C) & (C[..., :3].sum(-1) >= 210)
    for _ in range(12):
        if not todo.any(): break
        for dy_, dx_ in ((0, -1), (0, 1), (-1, 0), (1, 0), (-1, -1), (1, 1), (-1, 1), (1, -1)):
            sh_ok = np.roll(np.roll(src_ok, dy_, 0), dx_, 1); sh_col = np.roll(np.roll(body, dy_, 0), dx_, 1)
            take = todo & sh_ok
            body[take] = sh_col[take]; body[take, 3] = 255; src_ok = src_ok | take; todo = todo & ~take
    body[todo, :3] = fill; body[todo, 3] = 255
    # Headless body: the head is drawn separately so it can dip to bite.
    hx_, hy_ = offs[n]; hmask = heads[n][..., 3] > 0
    for v, u in zip(*np.nonzero(hmask)):
        cy, cx = v + hy_, u + hx_
        if 0 <= cy < 112 and 0 <= cx < 128: body[cy, cx] = 0
    hl = np.zeros((112, 128, 4), np.uint8); hl[hands] = C[hands].astype(np.uint8)
    eat_bodies.append(body); eat_hands.append(hl)
    chin = int(CUT[i] + offs[n][1] - offs[IDX['base%d' % i][0]][1])
    body[:chin + 1] = 0  # everything above the chin is redrawn by the head and hand layers
    eat_bodies[-1] = body
    eat_meta.append({'cx': int((pb[0] + pb[2]) / 2 + .5), 'grip': int(pb[3]), 'chin': chin, 'head': 'eat%d' % i})
    # Eating head: the looking-down face without the phone or the hands under the chin.
    eh = heads[n].copy(); hx_, hy_ = offs[n]
    vv, uu = np.mgrid[0:HH, 0:HW]
    cyy, cxx = vv + hy_, uu + hx_
    inb = (cyy >= 0) & (cyy < 112) & (cxx >= 0) & (cxx < 128)
    ph = np.zeros((HH, HW), bool); ph[inb] = ndimage.binary_dilation(phone_all, iterations=1)[cyy[inb], cxx[inb]]
    eh[ph | (cyy > chin)] = 0
    heads['eat%d' % i] = eh; offs['eat%d' % i] = offs[n]

# ---------------------------------------------------------------- bitten cones
cone = crop(3)
CH_ = 28; CW_ = round(CH_ * cone.width / cone.height)
ca = np.array(cone).astype(int)
H0, W0 = ca.shape[:2]
inside = ndimage.binary_fill_holes(ca[..., 3] > 150)
flake = (ca[..., 0] > 70) & (ca[..., 0] < 175) & (ca[..., 1] < 115) & (ca[..., 2] < 90) & inside
flake[int(H0 * .4):] = False
yy, xx = np.mgrid[0:H0, 0:W0]
def bite_mask(stage):
    keep = inside.copy()
    if stage == 0: return keep
    if stage >= 2: keep &= ~ndimage.binary_dilation(flake, iterations=6)
    if stage == 1:
        cx, cy, rr = W0 * .82, H0 * .1, W0 * .34
        keep &= (xx - cx) ** 2 + (yy - cy) ** 2 > rr ** 2
        for t in (-.6, 0, .6):  # tooth scallops along the bite
            keep &= (xx - (cx + rr * np.cos(np.pi * .75 + t))) ** 2 + (yy - (cy + rr * np.sin(np.pi * .75 + t))) ** 2 > (W0 * .07) ** 2
        return keep
    line = {2: .2, 3: .33, 4: .47, 5: .6, 6: .74, 7: .87}.get(stage, 1.1) * H0
    R = W0 / 6
    scallop = line + R * np.sqrt(np.clip(1 - ((xx % (2 * R)) - R) ** 2 / R ** 2, 0, 1)) * .55
    tilt = (xx - W0 / 2) / W0 * H0 * .06
    keep &= yy > scallop + tilt
    return keep
stage_imgs = []
for s in range(9):
    m = bite_mask(s) if s < 8 else np.zeros_like(inside)
    img = np.zeros((H0, W0, 4), np.uint8)
    base = Image.new('RGBA', cone.size, (240, 225, 190, 255)); base.alpha_composite(cone)
    img[m] = np.array(base)[m]
    small = np.array(nearest(Image.fromarray(img), CW_, CH_)).astype(int)
    small[..., 3] = np.where(small[..., 3] > 127, 255, 0)
    full = np.array(nearest(Image.fromarray((inside * 255).astype(np.uint8)), CW_, CH_)) > 127
    op = small[..., 3] > 0
    edge = op & full & ~ndimage.binary_erosion(op | ~full, iterations=1)  # pixels bordering a bite
    small[edge, :3] = (small[edge, :3] * .68).astype(int)
    small[~op] = 0
    stage_imgs.append(small.astype(np.uint8))
cream = [int(v) for v in np.median(ca[int(H0 * .3):int(H0 * .45), int(W0 * .3):int(W0 * .7)][..., :3].reshape(-1, 3), 0)]
wafer = [int(v) for v in np.median(ca[int(H0 * .7):int(H0 * .8), int(W0 * .4):int(W0 * .6)][..., :3].reshape(-1, 3), 0)]

# ---------------------------------------------------------------- the trophy
# Our football in gold on a little stand, and each character lifting it in place of the ball.
from ballgen import make as make_ball
RAMP = np.array([[74, 42, 10], [138, 88, 22], [204, 148, 36], [240, 198, 64], [255, 238, 156]])
def goldify(img):
    a = np.array(img).astype(int); lum = a[..., :3].mean(-1)
    out = a.copy(); idx = np.clip((lum / 256 * len(RAMP)).astype(int), 0, len(RAMP) - 1)
    out[..., :3] = RAMP[idx]; out[(lum < 55) & (a[..., 3] > 0), :3] = [56, 30, 8]
    return out.astype(np.uint8)
gold_ball = goldify(make_ball(26))
TW, TH = 26, 40
trophy = np.zeros((TH, TW, 4), np.uint8)
def rect(x0, y0, x1, y1, col): trophy[y0:y1, x0:x1, :3] = col; trophy[y0:y1, x0:x1, 3] = 255
rect(10, 25, 16, 31, RAMP[2]); rect(11, 25, 13, 31, RAMP[3])                 # stem, lit on the left
rect(7, 31, 19, 33, RAMP[3])                                                  # collar
rect(4, 33, 22, 39, RAMP[2]); rect(4, 35, 22, 37, RAMP[1]); rect(5, 33, 9, 35, RAMP[4])   # plinth with a band
ink = ndimage.binary_dilation(trophy[..., 3] > 0) & ~(trophy[..., 3] > 0)
trophy[ink] = [56, 30, 8, 255]
gb = gold_ball; m = gb[..., 3] > 0
trophy[0:26, 0:26][m] = gb[m]
HOLD = [[52, 32], [52, 32], [54, 33], [67, 33]]
trophy_cells = []
stand = trophy.copy(); stand[:26] = 0                                          # stem and plinth only
for i in range(4):
    C = cell(IDX['base%d' % i][1])
    hx, hy = HOLD[i]; ox_, oy_ = hx - 13, hy - 13
    out = np.zeros_like(C)
    def stamp(img, mask_only=False):
        for v in range(img.shape[0]):
            for u in range(img.shape[1]):
                if img[v, u, 3] and 0 <= oy_ + v < 112 and 0 <= ox_ + u < 128: out[oy_ + v, ox_ + u] = img[v, u]
    stamp(stand)                                                 # the stand sits behind them...
    m = C[..., 3] > 0; out[m] = C[m]                             # ...the character in front...
    g28 = goldify(make_ball(28)); m2 = g28[..., 3] > 0
    for v, u in zip(*np.nonzero(m2)):
        if 0 <= hy - 14 + v < 112 and 0 <= hx - 14 + u < 128: out[hy - 14 + v, hx - 14 + u] = g28[v, u]   # ...the gold ball held aloft
    trophy_cells.append(out)
tro = Image.new('RGBA', (5 * 128, 112))
for i, c_ in enumerate(trophy_cells): tro.alpha_composite(Image.fromarray(c_), (i * 128, 0))
tro.alpha_composite(Image.fromarray(trophy), (4 * 128, 0))
tro.save(G + 'trophy.png')

# ---------------------------------------------------------------- icons: the yellow ball
make_ball(32).save(G + 'favicon.png')
touch = Image.new('RGBA', (180, 180), (24, 37, 78, 255))
tb = make_ball(40).resize((160, 160), Image.NEAREST); touch.alpha_composite(tb, (10, 10))
touch.save(G + 'apple-touch-icon.png')

# ---------------------------------------------------------------- write
def strip(name, arrays, gap=2):
    w = sum(a.shape[1] for a in arrays) + gap * len(arrays); h = max(a.shape[0] for a in arrays)
    s = Image.new('RGBA', (w, h)); x = 0; rects = []
    for a in arrays: s.alpha_composite(Image.fromarray(a), (x, 0)); rects.append([x, 0, a.shape[1], a.shape[0]]); x += a.shape[1] + gap
    s.save(G + name + '.png'); return rects
order = sorted(heads, key=lambda k: (isinstance(k, str), str(k).zfill(4)))
hcols = 10
hs = Image.new('RGBA', (hcols * HW, ((len(order) + hcols - 1) // hcols) * HH))
head_index = {}
for k, n in enumerate(order):
    hs.alpha_composite(Image.fromarray(heads[n]), ((k % hcols) * HW, (k // hcols) * HH)); head_index[str(n)] = k
hs.save(G + 'heads.png')
eat = Image.new('RGBA', (8 * 128, 112))
for i in range(4):
    eat.alpha_composite(Image.fromarray(eat_bodies[i]), (i * 128, 0)); eat.alpha_composite(Image.fromarray(eat_hands[i]), ((4 + i) * 128, 0))
eat.save(G + 'eat.png')
cone_rects = strip('cones', stage_imgs)
# ---------------------------------------------------------------- the spurl
# A comic frustration scribble for a bad miss: zigzag strokes tangling down into a corkscrew,
# drawn in plain ink with no outline. Three jittered frames make it fizz.
def spurl_frame(seed):
    rng = np.random.default_rng(seed)
    SW, SH = 32, 42
    ink = np.zeros((SH, SW), bool)
    def jit(p): return (p[0] + int(rng.integers(-1, 2)) * (seed > 0), p[1] + int(rng.integers(-1, 2)) * (seed > 0))
    def line(a, b):
        (x0, y0), (x1, y1) = a, b; n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for t in range(n + 1):
            x = round(x0 + (x1 - x0) * t / n); y = round(y0 + (y1 - y0) * t / n)
            ink[max(0, y):y + 2, max(0, x):x + 2] = True          # a 2px pen
    top = [(3, 6), (8, 2), (13, 6), (18, 2), (23, 6), (28, 3)]  # the wavy top stroke
    zig = [(28, 3), (3, 11), (28, 14), (5, 20), (25, 23), (15, 27)]
    pts = [jit(p) for p in top] + [jit(p) for p in zig[1:]]
    for a, b in zip(pts, pts[1:]): line(a, b)
    cx, cy, r = 15, 32, 4.5                                       # the corkscrew loop, then a curl of tail
    prev = pts[-1]
    for k in range(0, 24):
        a = -np.pi / 2 + k / 22 * 2 * np.pi * 1.05
        q = (round(cx + np.cos(a) * r), round(cy + np.sin(a) * r)); line(prev, q); prev = q
    line(prev, (17, 38)); line((17, 38), (14, 40))
    out = np.zeros((SH, SW, 4), np.uint8)
    out[ink] = [40, 26, 58, 255]                               # plain ink, no outline
    return out
spurl_rects = strip('spurl', [spurl_frame(k) for k in range(3)])
side.save(G + 'van_side.png')
meta['heads'] = {'w': HW, 'h': HH, 'cols': hcols, 'index': head_index, 'offset': {str(k): v for k, v in offs.items()}}
meta['eat'] = eat_meta
tops = [int(np.nonzero(a[..., 3].any(1))[0][0]) if a[..., 3].any() else CH_ for a in stage_imgs]
meta['cones'] = {'rects': cone_rects, 'tops': tops, 'cream': cream, 'wafer': wafer}
meta['pinkyArt'] = {'anchors': anchors, 'exhaust': exhaust}
meta['vanSide'] = {'w': side.width, 'h': side.height, 'face': pinky_face}
meta['trophy'] = {'w': TW, 'h': TH}
meta['spurl'] = spurl_rects
json.dump(meta, open(G + 'meta.json', 'w'))
# Palette-quantise the atlases the page embeds (lossless-looking, a fraction of the size).
for name in ['actors', 'pinky', 'cars', 'plants', 'collector', 'heads', 'eat', 'van_side', 'trophy']:
    Image.open(G + name + '.png').convert('RGBA').quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(G + name + '_q.png', optimize=True)
print('heads', len(heads), 'eat', eat_meta, '\nanchors', anchors, 'exhaust', exhaust, 'frame offset', (ox, oy), '\ncone', CW_, CH_, 'side', side.size, 'face', pinky_face)
