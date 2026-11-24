#!/usr/bin/env python3
# The look director's numbers for a still (docs/lead/LOOK-RULES.md, R8 checks C6 and C7).
#   python3 docs/lead/lookstats.py A.png B.png ...      (needs numpy and Pillow)
# For each picture, measured on what reached the screen (after the last pass):
#   L     luminance by the game's own weights (0.3, 0.5, 0.2): p5, median, p95
#   V     HSV value (the largest channel), as the owner's reference table is measured: median, share over 0.90
#   S     HSV saturation: median of the whole picture; of the darkest 15 per cent by L (satD); of the lightest
#         15 per cent (satL); and of everything with V under 0.30 (S(V<.3): R2.2 wants it at most 0.50)
# A still with no pixel under V 0.30 prints 0 there.
import sys
import numpy as np
from PIL import Image

def stats(path):
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32) / 255.0
    L = a[..., 0] * 0.3 + a[..., 1] * 0.5 + a[..., 2] * 0.2
    V = a.max(-1)
    S = np.where(V > 1e-4, (V - a.min(-1)) / np.maximum(V, 1e-4), 0.0)
    l, v, s = L.ravel(), V.ravel(), S.ravel()
    q = np.quantile(l, [0.05, 0.5, 0.95])
    dk, lt, dv = l <= np.quantile(l, 0.15), l >= np.quantile(l, 0.85), v < 0.30
    return dict(p5=q[0], med=q[1], p95=q[2], vmed=np.median(v), v90=(v > 0.90).mean(),
                sat=np.median(s), satD=np.median(s[dk]), satL=np.median(s[lt]),
                satDV=np.median(s[dv]) if dv.any() else 0.0)

if __name__ == '__main__':
    for p in sys.argv[1:]:
        d = stats(p)
        print(f"{p.split('/')[-1]:54s} L p5 {d['p5']:.2f} med {d['med']:.2f} p95 {d['p95']:.2f} | "
              f"V med {d['vmed']:.2f} >.90 {d['v90']*100:4.1f}% | S {d['sat']:.2f} satD {d['satD']:.2f} "
              f"satL {d['satL']:.2f} S(V<.3) {d['satDV']:.2f}")
