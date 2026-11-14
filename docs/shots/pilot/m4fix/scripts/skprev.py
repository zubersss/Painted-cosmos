# Offline preview of the sketch's hand: frames -> 192x108 -> sketchHand (Node) -> a sheet on paper, multiplied.
import sys, subprocess, os
from PIL import Image, ImageChops
root, out = sys.argv[1], sys.argv[2]
files = sys.argv[3:]
W, H = 256, 144
tiles = []
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB')
    w, h = im.size
    ar = W / H
    sw, sh = (h * ar, h) if w / h > ar else (w, w / ar)
    im = im.crop((int((w - sw) / 2), int((h - sh) / 2), int((w + sw) / 2), int((h + sh) / 2))).resize((W, H), Image.LANCZOS)
    raw = f'/home/user/.pc-scratch/pilot/m4/s14/sk{i}.rgba'
    open(raw, 'wb').write(im.convert('RGBA').tobytes())
    tiles.append((im, raw))
js = """
const { sketchHand } = await import(process.argv[2] + '/src/core/sketches.js');
const fs = await import('node:fs');
for (let i = 3; i < process.argv.length; i++) { const b = fs.readFileSync(process.argv[i]); const px = new Uint8ClampedArray(b.buffer, b.byteOffset, b.length); const t0 = performance.now(); sketchHand(px, 256, 144, 11 + i * 7); console.log('ms', (performance.now() - t0).toFixed(1)); fs.writeFileSync(process.argv[i] + '.out', Buffer.from(px.buffer, px.byteOffset, px.length)); }
"""
open('/home/user/.pc-scratch/pilot/m4/s14/skrun.mjs', 'w').write(js)
print(subprocess.run(['node', '/home/user/.pc-scratch/pilot/m4/s14/skrun.mjs', root] + [t[1] for t in tiles], capture_output=True, text=True).stdout)
S = 2
sheet = Image.new('RGB', ((W * S + 24) * len(tiles) + 24, H * S * 2 + 72), (244, 239, 228))
for i, (im, raw) in enumerate(tiles):
    sk = Image.frombytes('RGBA', (W, H), open(raw + '.out', 'rb').read()).convert('RGB').resize((W * S, H * S), Image.BICUBIC)
    x = 24 + i * (W * S + 24)
    sheet.paste(im.resize((W * S, H * S), Image.BICUBIC), (x, 24))
    paper = Image.new('RGB', (W * S, H * S), (244, 239, 228))
    sheet.paste(ImageChops.multiply(paper, sk), (x, 48 + H * S))
sheet.save(out, quality=90)
