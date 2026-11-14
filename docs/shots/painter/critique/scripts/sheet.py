# sheet.py out.jpg "title" cols tilew [--crop x,y,w,h] label=path ... : a labelled contact sheet. Each tile is the frame
# (or its crop, in pixels of the source) scaled to tilew wide. Labels are printed above each tile.
import sys
from PIL import Image, ImageDraw, ImageFont
args = sys.argv[1:]
crop = None
if '--crop' in args:
    i = args.index('--crop'); crop = tuple(int(v) for v in args[i + 1].split(',')); del args[i:i + 2]
out, title, cols, tw, *items = args
cols = int(cols); W = int(tw)
try: f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 12)
except Exception: f = ImageFont.load_default()
ims = []
for it in items:
    lab, p = it.split('=', 1)
    im = Image.open(p).convert('RGB')
    if crop: im = im.crop((crop[0], crop[1], crop[0] + crop[2], crop[1] + crop[3]))
    if im.width != W: im = im.resize((W, round(im.height * W / im.width)), Image.LANCZOS if im.width > W else Image.BICUBIC)
    ims.append((lab, im))
rows = (len(ims) + cols - 1) // cols
rh = max(im.height for _, im in ims) + 20
lines = title.split('\\n')
top = 10 + 16 * len(lines)
sheet = Image.new('RGB', (cols * (W + 10) + 10, rows * rh + top + 6), (244, 239, 228)); d = ImageDraw.Draw(sheet)
for k, ln in enumerate(lines): d.text((10, 6 + 16 * k), ln, fill=(30, 30, 50), font=f)
for k, (lab, im) in enumerate(ims):
    x = 10 + (k % cols) * (W + 10); y = top + (k // cols) * rh
    d.text((x, y), lab, fill=(60, 60, 80), font=f); sheet.paste(im, (x, y + 16))
sheet.save(out, quality=88); print('saved', out, sheet.size)
