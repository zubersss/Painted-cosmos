// Painted Cosmos: where the flora grows (pure JS, no three). OWNER: PAINTER.
// Deterministic placement on jittered grids inside cube-sphere cells. The same cell always
// yields the same plants, independent of LOD or of the order in which cells are built.
import { faceToDir } from './cubesphere.js';
import { makeSample, NOLQ } from './surface.js';
import { hash3i, smoothstep, clamp } from './noise.js';
import { MODE } from '../data/mode.js';

// kinds
export const K_BIRCH = 0, K_PINE = 1, K_BIRCH_AUTUMN = 2;
export const U_GRASS = 0, U_FERN = 1, U_BUSH = 2, U_ROCK = 3, U_FLOWER = 4, U_STONE = 5, U_REED = 6, U_SHARD = 7;
const SMALL = [['grass', U_GRASS], ['fern', U_FERN], ['bush', U_BUSH], ['rock', U_ROCK], ['flower', U_FLOWER], ['reed', U_REED], ['shard', U_SHARD]];

// THE UNDERGROWTH WITH A BODY (package O / F4 of docs/lead/FLORA-DESIGN.md, the flora lane; `?under=1`, the oil look
// only, OFF by default until the look director passes it). Plants with a body -- heather and gorse on the cliff tops,
// and more as they are built -- are kits (world/underkit.js), placed here on a grid of their own in each undergrowth
// cell, in patches, from a biome's `oil.flora.plants` (pure data, data/looks/<world>.js). Each kit is a kind of its
// own, U_KIT0 + its place in UNDER_KITS; world/flora.js meshes each in a list of its own. Off, nothing below runs and
// every cell is placed exactly as before.
export const U_KIT0 = 16;
export const UNDER_KITS = ['heather', 'gorse'];
const KIT_GRID = 9;      // candidates a side in an undergrowth cell (about 2.7 m apart on Earth)
let _u2 = null;
export function under2On() {
  // (?under=1 only: a speed test without it places none, so its 'as set' is the game; its row places them while it runs,
  //  setUnder2 and flora.rebuildUnder2, core/bench.js)
  if (_u2 == null) { try { const q = new URLSearchParams(location.search); _u2 = q.get('under') === '1'; } catch (e) { _u2 = false; } }
  return _u2 && MODE.oil;
}
export function setUnder2(on) { _u2 = !!on; }      // (tests and the speed test: the address is read once)

const STRIDE = 12;   // x y z (body-local position), scale, yaw, kind, variant (trees) or biome index (undergrowth), seed, hue, value, canopy, lean
export const INST_STRIDE = STRIDE;

let _s = null;
const _d = [0, 0, 0];

function cellSeed(face, level, ix, iy, salt) {
  return ((hash3i(ix, iy, face * 31 + level, salt) * 4294967296) | 0);
}

// Trees of one chunk. Returns { count, data } with STRIDE floats per tree.
// Two candidates per grid cell, thinned by a clump field, so trunks gather in groups with
// irregular gaps between them instead of standing in rows.
export function placeTrees(S, face, level, ix, iy, grid) {
  if (!_s || _s.w.length < S.nB) _s = makeSample(S.nB);
  const s = _s, R = S.R;
  const span = 2 / (1 << level), u0 = -1 + ix * span, v0 = -1 + iy * span;
  const seed = cellSeed(face, level, ix, iy, 911);
  const n3 = S.nC.n3, fc = R / 17, fd = R / 52, fg = R / 160;
  const out = [];
  for (let b = 0; b < grid; b++) {
    for (let a = 0; a < grid; a++) {
      for (let c = 0; c < 2; c++) {
        const k = c * 7;
        const r1 = hash3i(a, b, 1 + k, seed), r2 = hash3i(a, b, 2 + k, seed), r3 = hash3i(a, b, 3 + k, seed), r4 = hash3i(a, b, 4 + k, seed), r5 = hash3i(a, b, 5 + k, seed);
        faceToDir(face, u0 + span * (a + r1) / grid, v0 + span * (b + r2) / grid, _d);
        const x = _d[0], y = _d[1], z = _d[2];
        const clump = smoothstep(-0.30, 0.22, n3(x * fc + 3.3, y * fc - 8.1, z * fc + 1.7) + 0.45 * n3(x * fd - 5.0, y * fd, z * fd + 9.0));
        if (r3 >= 0.62 * (0.14 + 0.86 * clump)) continue;
        S.sample(x, y, z, s, true);
        if (r3 >= 0.62 * (0.14 + 0.86 * clump) * s.trees) continue;
        const bi = S.biomes[s.top];
        if (!bi.tall) continue;
        if (!bi.tallWet && s.lq !== NOLQ && s.lq > s.h - 0.15) continue;
        // outside the woods, tall things stand in groups with empty stretches between them
        if (bi.terrain !== 'forest' && (bi.tallD || 0) < 0.36 && r3 >= 0.62 * (0.14 + 0.86 * clump) * s.trees * (0.06 + 0.94 * smoothstep(-0.30, 0.18, n3(x * fg - 4.0, y * fg + 13.0, z * fg + 7.0)) * 1.25)) continue;
        // each species keeps to its own groups: the choice follows the clump field too
        const grove = n3(x * fd + 21.0, y * fd + 4.0, z * fd - 13.0);
        // (2026-11-18, found by an independent reader) A WOOD OF MORE THAN TWO KINDS. This chose between bi.tall[0]
        // and bi.tall[1] and nothing else, so a biome that named four kinds had two of them built at every start-up
        // and standing nowhere at all (the aspen and the tall pine: 26,894 triangles and two shader programs for
        // trees no frame could hold). The grove field, WHICH IS ALREADY DRAWN, now picks which PAIR stands in this
        // grove and the roll below chooses within it exactly as it always has: not one extra random number is taken,
        // so every two-kind wood -- which is every wood of the live watercolour game -- is placed to the digit as
        // before. The first pair keeps about three quarters of the wood, so adding kinds does not halve its character.
        const np = bi.tall.length >> 1;
        const pr = np > 1 && grove > 0.45 ? Math.min(np - 1, 1 + Math.floor(((grove - 0.45) / 0.55) * (np - 1))) : 0;
        const ta = bi.tall[pr * 2], tb = bi.tall[pr * 2 + 1];
        const birch = r4 < clamp(s.birch + grove * 0.55, ta === tb ? 1 : 0.04, ta === tb ? 1 : 0.97);
        const kind = birch ? ta : tb;
        const spec = S.look.flora.tall[kind];
        const rr = R + s.h - 0.12;
        // (`vary`: a stand of all ages: most are young, the middle storey; a few are full grown, one in a while a giant)
        const scale = (spec.vary ? 0.30 + 1.15 * r5 * r5 * (0.75 + 0.5 * r1) : (birch ? 0.74 : 0.80) + 0.56 * r5 * r5 + 0.12 * s.glade) * (spec.scale || 1);
        out.push(x * rr, y * rr, z * rr, scale, (spec.slim || spec.kit === 'wave') ? 0.6 + (r1 - 0.5) * 0.9 : r1 * 6.2831853, kind, (r2 * 3) | 0, hash3i(a, b, 6 + k, seed),
          (r5 - 0.5) * 2, (r4 - 0.5) * 2 * 0.6, s.canopy, birch ? 0.02 + 0.15 * r2 * r2 : 0.02 * r2);
      }
    }
  }
  // hanging gardens: a third candidate per cell, kept only on the lip of a cliff and turned to
  // face out over the drop
  if (S.hangs) {
    const w = _s.w;
    for (let b = 0; b < grid; b++) {
      for (let a = 0; a < grid * 3; a++) {
        const r1 = hash3i(a, b, 21, seed), r2 = hash3i(a, b, 22, seed), r3 = hash3i(a, b, 23, seed), r5 = hash3i(a, b, 25, seed);
        faceToDir(face, u0 + span * (a + r1) / (grid * 3), v0 + span * (b + r2) / grid, _d);
        const x = _d[0], y = _d[1], z = _d[2];
        const bi = S.biomes[S.biomeWeights(x, y, z, w)];
        if (!bi.hang || r3 >= bi.hang.d) continue;
        S.sample(x, y, z, s, true);
        if (s.lip < 0.5) continue;
        // the kit's local axes on the ground (as THREE's setFromUnitVectors(Y, up) lays them)
        const k1 = 1 / (1 + y), ax = y + z * z * k1, ay = -x, az = -x * z * k1, bx = -x * z * k1, by = -z, bz = y + x * x * k1;
        const e = 3 / R;
        const gx = S.heightAt(x + ax * e, y + ay * e, z + az * e) - S.heightAt(x - ax * e, y - ay * e, z - az * e);
        const gz = S.heightAt(x + bx * e, y + by * e, z + bz * e) - S.heightAt(x - bx * e, y - by * e, z - bz * e);
        const rr = R + s.h + 0.2;
        out.push(x * rr, y * rr, z * rr, (0.8 + 0.6 * r5) * (S.look.flora.tall[bi.hang.kit].scale || 1), Math.atan2(-gx, -gz), bi.hang.kit, (r2 * 3) | 0, hash3i(a, b, 26, seed),
          (r5 - 0.5) * 2, (r1 - 0.5) * 1.2, 0, 0);
      }
    }
  }
  return { count: out.length / STRIDE, data: new Float32Array(out) };
}

// Undergrowth of one small cell: grass tufts, ferns, bushes, rocks, flowers, stream stones.
export function placeUnder(S, face, level, ix, iy, grid) {
  if (!_s || _s.w.length < S.nB) _s = makeSample(S.nB);
  const s = _s, R = S.R;
  const span = 2 / (1 << level), u0 = -1 + ix * span, v0 = -1 + iy * span;
  const seed = cellSeed(face, level, ix, iy, 577);
  const out = [];
  for (let b = 0; b < grid; b++) {
    for (let a = 0; a < grid; a++) {
      const r1 = hash3i(a, b, 1, seed), r2 = hash3i(a, b, 2, seed), r3 = hash3i(a, b, 3, seed), r4 = hash3i(a, b, 4, seed), r5 = hash3i(a, b, 5, seed);
      faceToDir(face, u0 + span * (a + 0.05 + 0.9 * r1) / grid, v0 + span * (b + 0.05 + 0.9 * r2) / grid, _d);
      // cheap rejections first (most candidates grow nothing): the biome alone often decides
      const top0 = S.biomeWeights(_d[0], _d[1], _d[2], s.w), b0 = S.biomes[top0];
      let clump = 1;
      if (b0.terrain !== 'forest') {
        if (!b0.small || r4 >= S.smallSum[top0]) continue;
        const fq = R / 21;
        clump = 0.10 + 0.90 * smoothstep(-0.22, 0.24, S.nC.n3(_d[0] * fq + 2.0, _d[1] * fq - 5.0, _d[2] * fq + 9.0));
        if (r3 >= clump) continue;
      }
      S.sample(_d[0], _d[1], _d[2], s, true);
      const bi = S.biomes[s.top];
      const inWater = s.lq !== NOLQ && s.lq > s.h;
      let kind = -1, scale = 1, sink = 0.03;
      if (bi.terrain !== 'forest') {
        // other biomes: a table of densities per kind
        if (!bi.small || inWater) continue;
        if (r3 >= s.under * clump) continue;
        let acc = 0;
        for (let q = 0; q < SMALL.length; q++) {
          const dn = bi.small[SMALL[q][0]];
          if (!dn) continue;
          acc += dn;
          if (r4 < acc) { kind = SMALL[q][1]; break; }
        }
        if (kind < 0) continue;
        // (PAINTER 12, PILOT's review 6b: no boulder or shard within 6 m of a first landing's clearing: the arrival stood the
        // explorer on one, and the view composed there had a stone at the feet)
        if ((kind === U_ROCK || kind === U_SHARD) && S.clearings.length) {
          let d2 = 1e9;
          for (const cl of S.clearings) { const dx = _d[0] - cl.x, dy = _d[1] - cl.y, dz = _d[2] - cl.z, e = (dx * dx + dy * dy + dz * dz) * R * R; if (e < d2) d2 = e; }
          // (PAINTER 14: and fewer of them out to 22 m, so the first view has a calm foreground: Pluto's arrival stood in a
          // field of 37 stones within 20 m, an even scatter of lozenges round the figure, the arrival's failing frame)
          if (d2 < 36 || (d2 < 484 && hash3i(a, b, 8, seed) > smoothstep(6, 22, Math.sqrt(d2)))) continue;
        }
        scale = kind === U_ROCK ? 0.4 + 1.6 * r5 * r5 : kind === U_SHARD ? 0.6 + 1.6 * r5 * r5 : 0.65 + 0.8 * r5;
        // (PAINTER 14: reeds stand in beds a few metres across, with mud and open water between them, tallest in the
        // middle of a bed and short at its ragged edge; the misty wetland's reeds were one even comb over the whole bank,
        // ARTPASS weakest 1)
        if (kind === U_REED) {
          const fr = R / 7.5, fq = R / 2.6, x = _d[0], y = _d[1], z = _d[2];
          const bed = smoothstep(-0.12, 0.22, S.nC.n3(x * fr + 17.0, y * fr - 3.0, z * fr + 29.0) + 0.35 * S.nC.n3(x * fq - 8.0, y * fq + 5.0, z * fq - 2.0));
          if (hash3i(a, b, 7, seed) >= bed) continue;
          scale = (0.50 + 0.80 * bed) * (0.80 + 0.45 * r5);
        }
        sink = kind === U_ROCK ? 0.2 * scale : 0.04;
        const rr = R + s.h - sink;
        out.push(_d[0] * rr, _d[1] * rr, _d[2] * rr, scale, r2 * 6.2831853, kind, s.top, hash3i(a, b, 6, seed), (r5 - 0.5) * 2, (r3 - 0.5) * 1.2, s.canopy, 0.1 * r1);
        continue;
      }
      const edge = s.lq !== NOLQ ? s.lq - s.h : -9;   // > 0 under water
      if (edge > -0.30 && edge < 0.16 && r3 < 0.34 && r4 < 0.62 + 0.3 * Math.sin(r1 * 40)) {
        // reeds crowd the water's edge in clumps
        kind = U_REED; scale = 0.7 + 0.7 * r5; sink = 0.02;
      } else if (inWater) {
        // a few stones break the surface of the stream
        if (r3 < 0.045 && s.lq - s.h < 0.5) { kind = U_STONE; scale = 0.4 + 0.7 * r5; sink = 0.1; }
      } else if (s.rock > 0.35 && r3 < 0.10) { kind = U_ROCK; scale = 0.6 + 1.5 * r5 * r5; sink = 0.25 * scale; }
      else if (s.s < 7 && r3 < 0.010) { kind = U_ROCK; scale = 0.3 + 0.6 * r5; sink = 0.12; }       // bank boulders
      else if (r3 < s.under * 0.62) {
        const damp = s.s < 16 ? 1 - s.s / 16 : 0;
        if (r4 < 0.10 + 0.22 * damp) { kind = U_FERN; scale = 0.7 + 0.7 * r5; }
        else if (r4 < 0.165 + 0.22 * damp && s.trees > 0.2) { kind = U_BUSH; scale = 0.6 + 0.9 * r5; sink = 0.1; }      // (the wood's middle storey: twice the bushes it had)
        else if (r4 > 0.955 - 0.05 * s.glade) { kind = U_FLOWER; scale = 0.7 + 0.6 * r5; }
        else { kind = U_GRASS; scale = 0.65 + 0.8 * r5 + 0.25 * s.glade; }
      }
      if (kind < 0) continue;
      const rr = R + s.h - sink;
      const reed = kind === U_REED;
      out.push(_d[0] * rr, _d[1] * rr, _d[2] * rr, scale, r2 * 6.2831853, kind, s.top, hash3i(a, b, 6, seed),
        reed ? -0.2 - 0.8 * r5 : (r5 - 0.5) * 2 + (s.glade - 0.5) * 0.8, reed ? 0.5 + 0.8 * r4 : (r4 - 0.5) * 2 * 0.6, s.canopy, 0.1 * r1);
    }
  }
  if (under2On()) placeKits(S, face, level, ix, iy, out);
  return { count: out.length / STRIDE, data: new Float32Array(out) };
}

// (the undergrowth with a body, above: each candidate picks one of its biome's plants by their shares; a plant grows in
// PATCHES of about `drift` metres (its own noise, two octaves, so a patch has a ragged edge), as heather and gorse stand
// on a cliff top in clumps with turf between; `hab` keeps it off ground it does not grow on, ramps as bloom.js reads
// them: canopy (the wood's roof), under (open sward), rock, wet (near water), each [a, b] full past b, none before a)
function ramp(r, x) { return r ? smoothstep(r[0], r[1], x) : 1; }
function placeKits(S, face, level, ix, iy, out) {
  const s = _s, R = S.R;
  const span = 2 / (1 << level), u0 = -1 + ix * span, v0 = -1 + iy * span;
  const seed = cellSeed(face, level, ix, iy, 911), g = KIT_GRID;
  for (let b = 0; b < g; b++) {
    for (let a = 0; a < g; a++) {
      const r1 = hash3i(a, b, 1, seed), r2 = hash3i(a, b, 2, seed), r3 = hash3i(a, b, 3, seed), r4 = hash3i(a, b, 4, seed), r5 = hash3i(a, b, 5, seed);
      faceToDir(face, u0 + span * (a + 0.05 + 0.9 * r1) / g, v0 + span * (b + 0.05 + 0.9 * r2) / g, _d);
      const top0 = S.biomeWeights(_d[0], _d[1], _d[2], s.w), b0 = S.biomes[top0];
      const P = b0 && b0.oil && b0.oil.flora && b0.oil.flora.plants;
      if (!P || !P.length) continue;
      let pl = null, acc = 0;
      for (const q of P) { acc += q.share || 0; if (r4 < acc) { pl = q; break; } }
      if (!pl) continue;
      const k = UNDER_KITS.indexOf(pl.kit);
      if (k < 0) continue;
      // the patch first (no sample needed: most candidates fall between patches)
      const d = pl.drift || 12, o = 13.7 * (k + 1), fq = R / d, fq2 = fq * 2.7;
      const n = S.nC.n3(_d[0] * fq + o, _d[1] * fq - o, _d[2] * fq + 0.5 * o) + 0.4 * S.nC.n3(_d[0] * fq2 - o, _d[1] * fq2 + o, _d[2] * fq2 - o);
      const patch = smoothstep(pl.edge != null ? pl.edge : 0.05, (pl.edge != null ? pl.edge : 0.05) + 0.25, n);
      if (r3 >= patch * (pl.dens != null ? pl.dens : 0.8)) continue;
      S.sample(_d[0], _d[1], _d[2], s, true);
      if (s.lq !== NOLQ && s.lq > s.h - 0.05) continue;                 // (nothing with a body stands in water)
      if (S.biomes[s.top] !== b0) continue;                              // (the biome the plant belongs to)
      const h = pl.hab;
      if (h) {
        const wet = s.s == null ? 0 : 1 - smoothstep(1.5, 22, s.s);
        const fit = ramp(h.canopy, Math.min(1, s.canopy || 0)) * ramp(h.under, s.under || 0) * ramp(h.rock, Math.min(1, s.rock || 0)) * ramp(h.wet, wet);
        if (hash3i(a, b, 7, seed) >= fit) continue;
      }
      const sc = (pl.size ? pl.size[0] + (pl.size[1] - pl.size[0]) * r5 : 0.7 + 0.6 * r5) * (0.8 + 0.4 * patch), rr = R + s.h - 0.03;
      out.push(_d[0] * rr, _d[1] * rr, _d[2] * rr, sc, r2 * 6.2831853, U_KIT0 + k, s.top, hash3i(a, b, 6, seed), (r5 - 0.5) * 2, (r3 - 0.5) * 1.2, s.canopy, 0.06 * r1);
    }
  }
}
