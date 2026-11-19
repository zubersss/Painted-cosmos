// ONE TREE ON ITS OWN, drawn from the side, in Node: no browser, no graphics card, seconds not
// half an hour. Built 2026-11-19 after the owner said the branches "look like spiders not trees":
// a thicket in a game still cannot be read, and a picture of the real page costs 12 to 34 minutes
// on this machine, so the SHAPE of a tree needed somewhere cheap to be looked at.
//
//   node tools/treeshape.mjs [kit=maple] [seeds=1,2,3] [lod=0] [w=420] [h=560] [out=/tmp/tree.png]
//   node tools/treeshape.mjs kit=all seeds=3 out=/tmp/trees.png
//
// It builds the real geometry the game builds (src/world/kits/*, through florakit's own builders),
// throws away the leaves, and fills the remaining triangles -- the trunk, the boughs and the twigs
// -- flat black on white, orthographically from the side. So what it shows is exactly the WOOD of
// the tree and nothing else: its fork height, the width it keeps as it goes out, whether it
// divides again, and whether it ends in a haze or a point. Shade (0 at the trunk, up at every
// fork) is drawn as a lighter grey, so the hierarchy of widths can be read at a glance.
//
// It draws SHAPE, not paint: nothing here says what a tree looks like in the game's own light.
import fs from 'node:fs';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const three = pathToFileURL(path.resolve(REPO, 'vendor/three/three.module.js')).href;
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(s, c, n) { if (s === 'three') return { url: '${three}', shortCircuit: true }; return n(s, c); }`), import.meta.url);
globalThis.location = { search: '?look=oil' };

const { writePng } = await import(pathToFileURL(path.resolve(REPO, 'tests/stationlib/png.mjs')).href);
const FK = await import(pathToFileURL(path.resolve(REPO, 'src/world/florakit.js')).href);

const A = Object.fromEntries(process.argv.slice(2).map((s) => s.split('=')));
const KITS = FK.TALL_KITS || {};
const want = (A.kit || 'maple') === 'all' ? Object.keys(KITS) : (A.kit || 'maple').split(',');
const seeds = (A.seeds || '1,2,3').split(',').map(Number);
const LOD = +(A.lod || 0), W = +(A.w || 420), H = +(A.h || 560);
const OUT = A.out || '/tmp/tree.png';

// the leaves are parts 4 and 5 (florakit: a leaf card, a shingle); the wood is everything else
const WOOD = (part) => part < 4.5;

function draw(geo, px, x0, W, H, TURN) {
  const pos = geo.attributes.position.array, idx = geo.index ? geo.index.array : null;
  const data = geo.attributes.aData ? geo.attributes.aData.array : null;   // y: the part, z: shade
  const n = idx ? idx.length : pos.length / 3;
  // the tree's own bounds, so every kit is drawn to the same height on the page
  let yMax = 0, xMin = 1e9, xMax = -1e9;
  for (let i = 0; i < pos.length; i += 3) { if (pos[i+1] > yMax) yMax = pos[i+1]; const q = Math.hypot(pos[i], pos[i+2]); if (-q < xMin) xMin = -q; if (q > xMax) xMax = q; }
  const span = Math.max(yMax * 1.04, (xMax - xMin) * 1.04, 1e-3);
  const sc = Math.min(W * 0.92 / span, H * 0.94 / span);
  const cx = x0 + W * 0.5, by = H - 8;
  const put = (x, y, v) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= px.W || y >= H) return; const o = (y * px.W + x) * 3; if (v < px.a[o]) { px.a[o] = v; px.a[o+1] = v; px.a[o+2] = v; } };
  const tri = (ax, ay, bx, by2, cx2, cy, v) => {
    const x0i = Math.max(0, Math.floor(Math.min(ax, bx, cx2))), x1i = Math.min(px.W - 1, Math.ceil(Math.max(ax, bx, cx2)));
    const y0i = Math.max(0, Math.floor(Math.min(ay, by2, cy))), y1i = Math.min(H - 1, Math.ceil(Math.max(ay, by2, cy)));
    const d = (by2 - cy) * (ax - cx2) + (cx2 - bx) * (ay - cy);
    if (Math.abs(d) < 1e-9) return;
    for (let y = y0i; y <= y1i; y++) for (let x = x0i; x <= x1i; x++) {
      const pxx = x + 0.5, pyy = y + 0.5;
      const l1 = ((by2 - cy) * (pxx - cx2) + (cx2 - bx) * (pyy - cy)) / d;
      const l2 = ((cy - ay) * (pxx - cx2) + (ax - cx2) * (pyy - cy)) / d;
      if (l1 >= -0.002 && l2 >= -0.002 && l1 + l2 <= 1.002) put(x, y, v);
    }
  };
  for (let t = 0; t < n; t += 3) {
    const i0 = idx ? idx[t] : t, i1 = idx ? idx[t+1] : t+1, i2 = idx ? idx[t+2] : t+2;
    if (data && !WOOD(data[i0 * 4 + 1])) continue;
    const shade = data ? Math.max(0, Math.min(1, data[i0 * 4 + 2])) : 0;
    const v = Math.round(20 + shade * 150);
    const ca = Math.cos(TURN), sa = Math.sin(TURN);
    const X = (i) => cx + (pos[i*3] * ca - pos[i*3+2] * sa) * sc, Y = (i) => by - pos[i*3+1] * sc;
    tri(X(i0), Y(i0), X(i1), Y(i1), X(i2), Y(i2), v);
  }
  return { height: yMax, width: xMax - xMin };
}

// (turn=: the same tree drawn from several ways round, because ONE SIDE VIEW LIES -- a bough that
//  swings away from the eye foreshortens into a stub and reads as a right angle that is not there.)
const TURNS = (A.turn || '0,55,110').split(',').map(Number);
const cells = want.length * seeds.length * TURNS.length;
const PW = W * cells;
const px = { W: PW, a: new Uint8Array(PW * H).fill(255) };
px.a = new Uint8Array(PW * H * 3).fill(255);
let k = 0; const notes = [];
for (const kit of want) {
  const build = KITS[kit];
  if (!build) { console.log('no kit called ' + kit + '; the tall kits are: ' + Object.keys(KITS).join(', ')); continue; }
  for (const s of seeds) {
    const g = build(s, LOD, {});
    for (const t of TURNS) {
      const r = draw(g, px, k * W, W, H, t * Math.PI / 180);
      if (t === TURNS[0]) notes.push(kit + ' seed ' + s + ': ' + r.height.toFixed(1) + ' m tall, ' + r.width.toFixed(1) + ' m across');
      k++;
    }
  }
}
fs.writeFileSync(OUT, writePng(px.a, PW, H, 3));
for (const s of notes) console.log(s);
console.log('wrote ' + OUT + ' (' + PW + 'x' + H + ')');
