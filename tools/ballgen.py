"""Small balls by area-averaging, snapped to the ball's own colours, with a navy outline ring."""
from PIL import Image
import numpy as np
from scipy import ndimage
from pathlib import Path
A = str(Path(__file__).resolve().parents[1] / 'assets' / 'original') + '/'

def source():
    im = Image.open(A + 'yellow-ball.png').convert('RGBA'); w, h = im.size
    crop = im.crop((int(w * .115), int(h * .11), int(w * .115 + w * .77), int(h * .11 + h * .78)))
    inside = ndimage.binary_fill_holes(np.array(crop)[..., 3] > 150)
    base = Image.new('RGBA', crop.size, (246, 228, 22, 255)); base.alpha_composite(crop)
    return base.convert('RGB'), inside

def palette(rgb, n=12):
    # The art's dominant colours, plus pink forced in so it survives at 24px.
    q = rgb.resize((60, 60), Image.NEAREST).quantize(colors=n, method=Image.Quantize.MEDIANCUT)
    pal = np.array(q.getpalette()[:n * 3]).reshape(-1, 3)
    return np.vstack([pal, [[236, 72, 160]]])

def make(size, outline=True):
    rgb, inside = source()
    pal = palette(rgb)
    small = np.array(rgb.resize((size, size), Image.BOX)).astype(float)
    mask = np.array(Image.fromarray((inside * 255).astype(np.uint8)).resize((size, size), Image.BOX)) >= 128
    d = ((small[:, :, None, :] - pal[None, None]) ** 2).sum(-1)
    out = pal[d.argmin(-1)].astype(np.uint8)
    rgba = np.dstack([out, np.where(mask, 255, 0).astype(np.uint8)])
    if outline:
        ring = mask & ~ndimage.binary_erosion(mask)
        rgba[ring] = [27, 20, 56, 255]
    return Image.fromarray(rgba)
