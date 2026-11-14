# How much the picture changes between frames: per pair, the mean |dL*|, the share of pixels whose L* moved by more than 6 and 12.
# python3 flick.py <dir> <name> [crop x,y,w,h]
import sys, glob
import numpy as np
from PIL import Image
d, name = sys.argv[1], sys.argv[2]
crop = [int(v) for v in sys.argv[3].split(',')] if len(sys.argv) > 3 else None
def L(path):
    im = np.asarray(Image.open(path).convert('RGB'), dtype=np.float64) / 255.0
    if crop: x, y, w, h = crop; im = im[y:y + h, x:x + w]
    lin = np.where(im <= 0.04045, im / 12.92, ((im + 0.055) / 1.055) ** 2.4)
    Y = 0.2126 * lin[..., 0] + 0.7152 * lin[..., 1] + 0.0722 * lin[..., 2]
    return np.where(Y > 0.008856, 116 * np.cbrt(Y) - 16, 903.3 * Y)
fs = sorted(glob.glob(f'{d}/{name}-[0-9][0-9].png'))
Ls = [L(f) for f in fs]
out = []
for i in range(len(Ls) - 1):
    dd = np.abs(Ls[i + 1] - Ls[i]); out.append((dd.mean(), 100 * (dd > 6).mean(), 100 * (dd > 12).mean()))
dd = np.abs(Ls[-1] - Ls[0])
print(f"{name}{' crop ' + sys.argv[3] if crop else ''}: {len(fs)} frames; pairs: mean dL {np.mean([o[0] for o in out]):.2f}, >6: {np.mean([o[1] for o in out]):.2f} % (max {max(o[1] for o in out):.2f}), >12: {np.mean([o[2] for o in out]):.2f} %; first->last: mean dL {dd.mean():.2f}, >6: {100 * (dd > 6).mean():.2f} %")
