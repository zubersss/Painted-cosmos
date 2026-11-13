# The tones of a frame against art-bible rule 1 (paper is the light, nothing pure white, nothing pure black):
# for the picture inside the paper border (the middle 86 % by 80 %), CIE L* at the 1st, 50th and 99th percentile,
# the share of pixels under L* 12 (near black) and over L* 96 (whiter than the paper, #F4EFE4 = L* 94.4), and the
# spread between the 10th and 90th percentile (how many values the picture uses). python3 tone.py a.jpg b.jpg ...
import sys
from PIL import Image
import numpy as np
def lstar(rgb):
    c = rgb / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    y = 0.2126 * c[..., 0] + 0.7152 * c[..., 1] + 0.0722 * c[..., 2]
    return np.where(y > 0.008856, 116 * np.cbrt(y) - 16, 903.3 * y)
for f in sys.argv[1:]:
    im = np.asarray(Image.open(f).convert('RGB'), dtype=np.float64)
    h, w, _ = im.shape
    a = im[int(h * 0.10):int(h * 0.90), int(w * 0.07):int(w * 0.93)]
    L = lstar(a).ravel()
    p = np.percentile(L, [1, 10, 50, 90, 99])
    print(f"{f.split('/')[-1]:44s} L* 1% {p[0]:5.1f}  10% {p[1]:5.1f}  median {p[2]:5.1f}  90% {p[3]:5.1f}  99% {p[4]:5.1f}   under 12: {100 * (L < 12).mean():5.1f} %   over 96: {100 * (L > 96).mean():4.1f} %   10-90 spread {p[3] - p[1]:5.1f}")
