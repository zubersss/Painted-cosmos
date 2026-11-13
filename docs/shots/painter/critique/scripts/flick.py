# flick.py [--crop x,y,w,h] [--out diff.jpg] frame0 frame1 ... : how much the picture changes from one frame to the next.
# For each neighbouring pair: the mean absolute change of L (0..100) and the share of pixels whose L moved by more than 6 and 12;
# with --out, a sheet of the absolute differences (x6, white = no change, dark = change).
import sys
import numpy as np
from PIL import Image
args = sys.argv[1:]
crop = None; out = None
if '--crop' in args:
    i = args.index('--crop'); crop = tuple(int(v) for v in args[i + 1].split(',')); del args[i:i + 2]
if '--out' in args:
    i = args.index('--out'); out = args[i + 1]; del args[i:i + 2]
def L(p):
    im = Image.open(p).convert('RGB')
    if crop: im = im.crop((crop[0], crop[1], crop[0] + crop[2], crop[1] + crop[3]))
    a = np.asarray(im).astype(np.float32) / 255.0
    lin = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    Y = 0.2126 * lin[..., 0] + 0.7152 * lin[..., 1] + 0.0722 * lin[..., 2]
    return np.where(Y > 0.008856, 116 * np.cbrt(Y) - 16, 903.3 * Y)
Ls = [L(p) for p in args]
tiles = []
for k in range(len(Ls) - 1):
    d = np.abs(Ls[k + 1] - Ls[k])
    print(f'{k}->{k+1}: mean dL {d.mean():.2f}  >6: {100 * (d > 6).mean():.1f} %  >12: {100 * (d > 12).mean():.1f} %  p99 {np.percentile(d, 99):.1f}')
    tiles.append(np.clip(255 - d * 6 * 2.55, 0, 255).astype(np.uint8))
if len(Ls) > 2:
    d = np.abs(Ls[-1] - Ls[0]); print(f'first->last: mean dL {d.mean():.2f}  >6: {100 * (d > 6).mean():.1f} %  >12: {100 * (d > 12).mean():.1f} %')
    # flicker: pixels that go there and back again (frame k+2 nearer to k than k+1 is)
    back = []
    for k in range(len(Ls) - 2):
        a = np.abs(Ls[k + 1] - Ls[k]); b = np.abs(Ls[k + 2] - Ls[k])
        back.append(100 * ((a > 6) & (b < a * 0.5)).mean())
    print('there-and-back (moved by more than 6 in one frame, more than half undone in the next): ' + ' '.join(f'{v:.1f} %' for v in back))
if out and tiles:
    h, w = tiles[0].shape
    sheet = Image.new('L', (len(tiles) * (w + 6) + 6, h + 12), 255)
    for k, t in enumerate(tiles): sheet.paste(Image.fromarray(t), (6 + k * (w + 6), 6))
    sheet.save(out, quality=88); print('saved', out)
