// Painted Cosmos: THE UNDERGROWTH WITH A BODY (package O / F4 of docs/lead/FLORA-DESIGN.md, the flora lane).
// OWNER: PAINTER. `?under=1`, the oil look only, OFF by default until the look director passes it.
//
// The plants that stand above the sward with a body of their own -- heather and gorse on the cliff tops first, then
// the wetland's iris and cotton grass, the autumn wood's bracken, logs and toadstools, as each is built -- in this
// game's own hand, from the kit pieces every plant is made of (world/kitbuild.js: strokes and leaf-shaped pieces of
// flat colour; no leaf cards' dear paint, no pictures from anywhere). Kept in a file of their own so the trees' kits
// (world/florakit.js) are not touched.
//   Placed by world/floraplace.js (placeKits: a grid of their own in each undergrowth cell, in patches, from a biome's
//   `oil.flora.plants`), meshed by world/flora.js _buildUnder (a list of their own per kit, one instanced mesh each),
//   coloured by their own material per kit and biome, from the plant's NAMED-PIGMENT colours in the data
//   (`c: { leaf: [three], accent }`), named pc-prop-under2-<kit>-<biome> so a speed-test row can show or hide them.
//   Budget (the design, 8.2): at most about 4,000 triangles and 20,000 fragments in view at the landing.
import { Builder, stroke, leafCards, V } from './kitbuild.js';
import { mulberry32 } from './noise.js';
import { makePropMaterial } from '../render/materials.js';
import { U_KIT0, UNDER_KITS } from './floraplace.js';

// a small upright touch of the accent colour (part 3, as a flower's head): a lozenge facing out from the plant's middle
function touch(B, c, up, w, h, out, hash) {
  const ux = out.x, uz = out.z, l = Math.hypot(ux, uz) || 1, sx = -uz / l, sz = ux / l;
  const nx = ux / l * 0.6, ny = 0.8, nz = uz / l * 0.6;
  const a = B.vert(c.x, c.y - h * 0.5, c.z, nx, ny, nz, out.x, out.y, out.z, 0.5, 0, 0.5, 3, 0, hash);
  const b = B.vert(c.x + sx * w, c.y + up * 0.1, c.z + sz * w, nx, ny, nz, out.x, out.y, out.z, 1, 0.5, 0.5, 3, 0, hash);
  const t = B.vert(c.x, c.y + h * 0.5, c.z, nx, ny, nz, out.x, out.y, out.z, 0.5, 1, 0.5, 3, 0, hash);
  const d = B.vert(c.x - sx * w, c.y + up * 0.1, c.z - sz * w, nx, ny, nz, out.x, out.y, out.z, 0, 0.5, 0.5, 3, 0, hash);
  B.tri(a, b, t); B.tri(a, t, d);
}

// HEATHER: a low cushion about 0.6 m across and 0.35 m high: a dome of small dark scale-leaves (the leaf-shaped pieces,
// small) with a few wiry shoots standing out of it, and its top strewn with upright spikes of flower (the accent, upright
// lozenges), so that in bloom it reads as a pink-violet cushion. About 140 triangles. (The first form, ten bare shoots
// each with one small touch, SEEN 24 Nov from inside the coast's densest patch: a few thin dark sticks and tiny pink
// flecks lost in the grass; 1.4 per cent of the picture changed with 66 kits in view.)
export function heatherGeometry(seed) {
  const rnd = mulberry32(seed), B = new Builder();
  const c = V(0, 0.15, 0), rx = 0.30, ry = 0.17, rz = 0.28;
  leafCards(B, c, rx, ry, rz, rnd, { n: 26, len: 0.10, wid: 0.04, massC: c, massK: 0.75, sway: 0.2, shade0: 0.15, shadeK: 0.6, droop: 0.1 });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * 6.2832 + rnd() * 0.6, rr = rnd() * 0.10;
    const dir = V(Math.cos(a), 0, Math.sin(a)), len = 0.24 + rnd() * 0.12, arch = 0.25 + rnd() * 0.25;
    stroke(B, V(dir.x * rr, 0, dir.z * rr), dir, len, 0.03, arch, rnd, { segs: 2, sway: 0.4 });
  }
  // the flowering tops: spikes over the upper half of the dome, more of them toward its crown
  for (let i = 0; i < 22; i++) {
    const a = rnd() * 6.2832, r = Math.sqrt(rnd()) * 0.92, x = Math.cos(a) * r, z = Math.sin(a) * r;
    const y = Math.sqrt(Math.max(0, 1 - r * r));
    const p = V(c.x + x * rx, c.y + y * ry + 0.035, c.z + z * rz);
    touch(B, p, 0.04, 0.026 + rnd() * 0.01, 0.09 + rnd() * 0.04, V(x, 0.5 + y, z), rnd());
  }
  return B.build();
}

// GORSE: a dense, spiny mound about 1 m across and 0.7 m high: dark narrow spines lying every way on its skin (the
// leaf-shaped pieces, narrow), thick with lemon-yellow flowers on the outside, as gorse in bloom is. About 140 triangles.
export function gorseGeometry(seed) {
  const rnd = mulberry32(seed), B = new Builder();
  const c = V(0, 0.36, 0), rx = 0.50, ry = 0.36, rz = 0.48;
  leafCards(B, c, rx, ry, rz, rnd, { n: 40, len: 0.17, wid: 0.035, massC: c, massK: 0.7, sway: 0.15, shade0: 0.1, shadeK: 0.6, droop: 0.15 });
  for (let i = 0; i < 30; i++) {
    let x, y, z, l2;
    do { x = rnd() * 2 - 1; y = rnd() * 1.6 - 0.4; z = rnd() * 2 - 1; l2 = x * x + y * y + z * z; } while (l2 > 1 || l2 < 0.3);
    const l = Math.sqrt(l2);
    x /= l; y /= l; z /= l;
    const p = V(c.x + x * rx * 1.02, c.y + y * ry * 1.02, c.z + z * rz * 1.02);
    touch(B, p, 0.0, 0.038 + rnd() * 0.012, 0.06 + rnd() * 0.02, V(x, y, z), rnd());
  }
  return B.build();
}

const GEO = { heather: heatherGeometry, gorse: gorseGeometry };
const HEIGHT = { heather: 0.38, gorse: 0.75 };
const REACH = 40;
// (shown unless a speed test placed them without ?under=1, for its row to ask the other way: world/floraplace.js under2On)
const SHOWN = (() => { try { return new URLSearchParams(location.search).get('under') === '1'; } catch (e) { return true; } })();        // (metres: no far form; past it the near ring's touches and the ground's colour carry the plant)

// The kit for an undergrowth kind (U_KIT0 + k) in a biome: { geo, mat, lod }, made once and kept on the flora layer.
// null for a kind that is not a kit, or a biome without that plant's data.
export function underKit(flora, kind, bi) {
  const name = UNDER_KITS[kind - U_KIT0];
  if (!name || !GEO[name]) return null;
  const C = flora._u2 || (flora._u2 = { geo: new Map(), mat: new Map() });
  let geo = C.geo.get(name);
  if (!geo) { geo = GEO[name](211 + 17 * (kind - U_KIT0)); C.geo.set(name, geo); }
  const key = name + '-' + bi;
  let mat = C.mat.get(key);
  if (!mat) {
    const b = flora.S.biomes[bi], P = b && b.oil && b.oil.flora && b.oil.flora.plants;
    const pl = P && P.find((q) => q.kit === name);
    if (!pl || !pl.c) return null;
    const L = pl.c.leaf;
    mat = makePropMaterial(flora.bodyUniforms, { name: 'under2-' + key, leafA: L[0], leafB: L[1], leafC: L[2], accent: pl.c.accent,
      wind: 0.05, doubleSide: true, phys: 'lite', stiff: 0.35, plantHeight: HEIGHT[name] });
    mat.visible = SHOWN;
    C.mat.set(key, mat);
  }
  return { geo, mat, lod: [0, REACH, 0.3, 0.8] };
}
