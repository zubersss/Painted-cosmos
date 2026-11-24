// Painted Cosmos: terrain patch mesher (pure JS, no three). OWNER: PAINTER.
// Builds the vertex data of one quadtree node of the cube-sphere. Kept free of three so it can
// be unit-tested in Node and moved into a worker later without changes.
import { faceToDir } from './cubesphere.js';
import { makeSample, NOLQ, SNOW } from './surface.js';
import { MODE } from '../data/mode.js';
import { BODIES } from '../data/bodies.js';
import { canopyOn, groundSeasonOn, rockfieldOn, standAt, bloomFarOn } from './farstand.js';

export const PATCH_N = 32;                 // cells per patch edge (even, for geomorphing)
const N = PATCH_N, V = N + 1, E = N + 3;   // E: sample grid with a one-vertex apron for normals

// Shared index buffers. Cells are split along the (i,j)->(i+1,j+1) diagonal everywhere, which
// is what makes the morph targets of the "odd/odd" vertices land exactly on the parent mesh.
let _indices = null;
export function patchIndices() {
  if (_indices) return _indices;
  const idx = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const a = j * V + i, b = a + 1, c = a + V, d = c + 1;
    idx.push(a, b, d, a, d, c);
  }
  // skirts: four strips hanging from the border
  const S0 = V * V;
  const strip = (get, s0, flip) => {
    for (let k = 0; k < N; k++) {
      const a = get(k), b = get(k + 1), c = s0 + k, d = s0 + k + 1;
      if (flip) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
    }
  };
  strip((k) => k, S0, true);                          // v = 0 edge
  strip((k) => N * V + k, S0 + V, false);             // v = 1 edge
  strip((k) => k * V, S0 + 2 * V, false);             // u = 0 edge
  strip((k) => k * V + N, S0 + 3 * V, true);          // u = 1 edge
  _indices = new Uint16Array(idx);
  return _indices;
}
export const PATCH_VERTS = V * V + 4 * V;

const _d = [0, 0, 0];
const _px = new Float64Array(E * E), _py = new Float64Array(E * E), _pz = new Float64Array(E * E);
const _hh = new Float32Array(E * E), _lq = new Float32Array(E * E);
const CS = 24;   // floats kept per sample: wash, far wash, parameters, liquid look, strata, the current, the fall, the stand, the snow
const _col = new Float32Array(E * E * CS);
const _fs = [0, 0];     // (the stand and its needle share at a sample: world/farstand.js)
const _bl = new Float32Array(E * E * 2);      // (the flower drift at a sample, FV6(b): its cover and its palette index; kept apart from _col so it takes no sample slot)
let _s = null;

function b8(v) { v = v * 255 + 0.5; return v < 0 ? 0 : v > 255 ? 255 : v | 0; }
function sstep(a, b, x) { const t = (x - a) / (b - a); return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t); }

// THE WATER KNOWS ITS OWN FALL (the owner, 2026-11-23: the water should be "constantly moving the way water would be
// naturally", and there should be "airration"). Two numbers are measured at every water vertex and packed into one
// byte each for the paint (render/materials.js, the attribute aTurb): how fast the water runs here, and how aerated
// it is. Both come out of the sample grid the patch already has -- the liquid's own surface and the bed under it --
// so they cost no new sampling and no new memory beyond the four bytes. Only in the oil look.
//
// WHAT THE SURFACE MAY HAND OVER, AND WHAT HAPPENS WITHOUT IT. The drainage work (surface.js, drainage.js) knows the
// fall and the pooling of the water properly, which a patch's own grid can only guess at. Two OPTIONAL fields on the
// sample are read here, and nothing breaks when a surface sets neither:
//   s.fspd  how fast the water runs at this point, metres a second, 0 to about 8. Above 0 it is used in place of the
//           Manning estimate below. 0 or absent: the estimate stands.
//   s.turb  how aerated this point is, 0 (clear) to 1 (the foot of a fall). It is taken as a FLOOR under the churn
//           measured here, so a surface can make white water where the grid cannot see why (a plunge pool, a weir).
//           It also lets standing water churn: everywhere else the churn is held to water that has a current, so
//           that a pond, a lake and the sea keep the wind-raised whitecaps they already have.
// With neither, a patch of the oil look still gets a speed from its own liquid surface and a churn from its own bed,
// and when the levels start to fall the same arithmetic lights up by itself with nothing more to write here.
const FLOW_VMAX = 5.0;      // m/s the speed byte runs to; one byte is 0.0196 m/s. A brook runs 1-2 m/s (MEASURED
                            // below), the foot of a fall several; past 5 the dashes would outrun the eye.
// Manning's open channel, v = R^(2/3) sqrt(fall) / n, is what sets the speed. n 0.063 is a mountain stream with
// cobbles (Chow's table gives 0.04 to 0.07 for one). It was picked so that the speed MEASURED on Earth's own brook
// -- 1.2 % of fall, 0.54 m deep -- comes out at 1.16 m/s, the middle of the fixed 0.9 to 1.4 m/s band that v33 ran
// every dash at and that the owner accepted (task 23). So a typical reach looks as it did; what changes is that a
// shallow edge now crawls at a quarter of that and a steep stretch races.
const MANNING_N = 0.063;
// The hydraulic radius is the depth, held to 0.55 m: in Manning a deeper channel runs FASTER (less of it is rubbing
// the bed), which is right for a uniform channel but wrong for a pool, where the water is slow because the channel
// is wide -- and the width is the one thing a patch cannot see. The cap stands in for it, so that past half a metre
// the depth stops mattering. MEASURED: Earth's channel at the spawn runs 0.8 to 1.1 m deep at 1.2 % of fall, which
// with this cap comes out at 1.18 m/s -- the middle of the old fixed band. A cap of 0.80 put it at 1.51, just above
// the band, and every vertex of the channel at the cap anyway.
const MANNING_RMAX = 0.55;

// A patch is built as a resumable job so that terrain generation never takes more than its
// time slice: beginPatch() -> stepPatch(job, deadline) until it returns the data.
// (Only one job may be in progress at a time: the sample grid is shared scratch memory.)
export function beginPatch(S, face, level, ix, iy) {
  return { S, face, level, ix, iy, row: 0, minH: 1e9, maxH: -1e9, anyWater: false };
}

export function stepPatch(job, deadline) {
  const { S, face, level, ix, iy } = job;
  if (!_s || _s.w.length < S.nB) _s = makeSample(S.nB);
  const s = _s, R = S.R;
  const span = 2 / (1 << level);
  const u0 = -1 + ix * span, v0 = -1 + iy * span, du = span / N;
  let minH = job.minH, maxH = job.maxH, anyWater = job.anyWater;
  // (THE PAINTED CANOPY, group C: on a world whose wood is painted as a roof of crowns from the air, each vertex is
  // told how many trees the placer keeps there and how many are needle trees -- world/farstand.js, render/farground.js.
  // Off, or on any other world, nothing is computed and the bytes are the ones they always were.)
  const can = canopyOn(S.id);
  // (and the floor that follows the year, FV3: the trees here in woods painted in an autumn palette and in a summer one
  // (surface.js canA, canS), in the parameters' first and second bytes -- the dry and wet washes', which the oil look's
  // ground never reads)
  const gse = groundSeasonOn(S.id);
  // (and the rock, FV4: how much snow the surface laid over each wash, so that it can be shed off the steep faces once
  // the patch's normals are known, below)
  const rkf = rockfieldOn(S.id);
  // (and the flower drifts from the air, FV6(b), ?bloomfar=1: world/bloom.js's cover and palette index at each sample,
  // packed in a byte each into an attribute of their own, aBloom; without the switch nothing is computed or built)
  const blm = bloomFarOn(S);
  // 1. sample the surface on the apron grid, a row at a time
  // (S.foot: how far apart this patch's samples lie, in metres, while they are taken: the oil look's surface draws a
  // river into the far colour as wide as that, so that a river is still a line on the land from high up, where the
  // samples are coarser than the river is wide; nothing else reads it, and it is 0 for every other caller)
  S.foot = du * R * 0.785;
  for (let j = job.row; j < E; j++) {
    if (j > job.row && performance.now() >= deadline) { job.row = j; job.minH = minH; job.maxH = maxH; job.anyWater = anyWater; S.foot = 0; return null; }
    for (let i = 0; i < E; i++) {
      const k = j * E + i;
      faceToDir(face, u0 + (i - 1) * du, v0 + (j - 1) * du, _d);
      const inner = i >= 1 && i <= V && j >= 1 && j <= V;
      S.sample(_d[0], _d[1], _d[2], s, inner);
      const rr = R + s.h;
      _px[k] = _d[0] * rr; _py[k] = _d[1] * rr; _pz[k] = _d[2] * rr;
      _hh[k] = s.h; _lq[k] = s.lq === NOLQ ? -1e6 : s.lq;
      if (inner) {
        if (s.h < minH) minH = s.h; if (s.h > maxH) maxH = s.h;
        if (s.lq !== NOLQ && s.lq > s.h - 0.5) anyWater = true;
        const c = k * CS;
        _col[c] = s.r; _col[c + 1] = s.g; _col[c + 2] = s.b;
        _col[c + 3] = s.r2; _col[c + 4] = s.g2; _col[c + 5] = s.b2;
        _col[c + 6] = s.dry; _col[c + 7] = s.wet; _col[c + 8] = s.canopy; _col[c + 9] = s.aux;
        _col[c + 10] = s.qr; _col[c + 11] = s.qg; _col[c + 12] = s.qb; _col[c + 13] = s.qk; _col[c + 14] = s.qglow; _col[c + 15] = s.qcloud; _col[c + 16] = s.strata;
        _col[c + 17] = s.fu || 0; _col[c + 18] = s.fv || 0;      // (the oil look's rivers: the current, surface.js; 0 everywhere else)
        _col[c + 19] = s.fspd || 0; _col[c + 20] = s.turb || 0;  // (the drainage field's own speed and churn, where a surface gives them; 0 otherwise)
        if (can) { standAt(S, _d[0], _d[1], _d[2], s, _fs); _col[c + 21] = _fs[0]; _col[c + 22] = _fs[1]; }
        if (gse) { _col[c + 6] = s.canA || 0; _col[c + 7] = s.canS || 0; }
        _col[c + 23] = rkf ? s.snowK || 0 : 0;
        if (blm) { _bl[k * 2] = s.fd || 0; _bl[k * 2 + 1] = s.fi || 0; }
      }
    }
  }
  job.row = E;
  S.foot = 0;
  // 2. origin: the patch centre, so vertex coordinates stay small
  const kc = (1 + N / 2) * E + (1 + N / 2);
  const ox = _px[kc], oy = _py[kc], oz = _pz[kc];
  const nv = PATCH_VERTS;
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), mor = new Float32Array(nv * 3);
  const col = new Uint8Array(nv * 4), col2 = new Uint8Array(nv * 4), par = new Uint8Array(nv * 4);
  // the same vertex as the parent's (half resolution) mesh paints it: its washes, its parameters and its
  // normal there, so a patch can show exactly what its parent showed and slide to its own look
  const colP = new Uint8Array(nv * 4), col2P = new Uint8Array(nv * 4), parP = new Uint8Array(nv * 4), norP = new Float32Array(nv * 3);
  const blo = blm ? new Uint8Array(nv * 4) : null, bloP = blm ? new Uint8Array(nv * 4) : null;
  let boundR2 = 0;
  for (let j = 0; j < V; j++) {
    for (let i = 0; i < V; i++) {
      const k = (j + 1) * E + (i + 1), o = (j * V + i) * 3;
      const x = _px[k] - ox, y = _py[k] - oy, z = _pz[k] - oz;
      pos[o] = x; pos[o + 1] = y; pos[o + 2] = z;
      const r2 = x * x + y * y + z * z; if (r2 > boundR2) boundR2 = r2;
      // normal: cross(dP/du, dP/dv), which points outward for our face frames
      const ax = _px[k + 1] - _px[k - 1], ay = _py[k + 1] - _py[k - 1], az = _pz[k + 1] - _pz[k - 1];
      const bx = _px[k + E] - _px[k - E], by = _py[k + E] - _py[k - E], bz = _pz[k + E] - _pz[k - E];
      let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
      const il = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      nor[o] = nx * il; nor[o + 1] = ny * il; nor[o + 2] = nz * il;
      // SNOW DOES NOT LIE ON A CLIFF (the far view, FV4; the references: the snow mountains the lightest thing in the
      // picture, on ledges and in gullies, with dark rock ribs between). The surface lays snow by height and noise alone,
      // so a face of 60 degrees above the snowline was as white as a ledge, and a range from the air was a white cone.
      // Where the face is steeper than about 50 degrees most of the snow is taken off it again -- the wash under the snow is found
      // by undoing the surface's own mix (it laid SNOW over it by snowK), and laid again with less of it -- in both washes.
      if (rkf) {
        const sk = _col[(k) * CS + 23];
        if (sk > 0.01) {
          const pr = 1 / Math.sqrt(_px[k] * _px[k] + _py[k] * _py[k] + _pz[k] * _pz[k]);
          const upn = (nor[o] * _px[k] + nor[o + 1] * _py[k] + nor[o + 2] * _pz[k]) * pr;
          // (from about 49 degrees, all but a fifth of it by 61: MEASURED from 400 m, shedding from 38 degrees took the snow
          // off nearly every summit -- at a far patch's spacing a summit's faces all read steep -- and the range went grey)
          const st = sstep(0.66, 0.48, upn);
          if (st > 0) {
            const k2 = sk * (1 - 0.8 * st), cc = k * CS, iv = 1 / (1 - sk);
            for (let t = 0; t < 3; t++) {
              const base = (_col[cc + t] - SNOW[t] * sk) * iv, base2 = (_col[cc + 3 + t] - SNOW[t] * sk) * iv;
              _col[cc + t] = base + (SNOW[t] - base) * k2;
              _col[cc + 3 + t] = base2 + (SNOW[t] - base2) * k2;
            }
          }
        }
      }
      // morph target: where this vertex sits on the parent's (half resolution) mesh
      const io = i & 1, jo = j & 1;
      if (io || jo) {
        let k1, k2;
        if (io && !jo) { k1 = k - 1; k2 = k + 1; }
        else if (!io && jo) { k1 = k - E; k2 = k + E; }
        else { k1 = k - E - 1; k2 = k + E + 1; }
        mor[o] = (_px[k1] + _px[k2]) * 0.5 - _px[k];
        mor[o + 1] = (_py[k1] + _py[k2]) * 0.5 - _py[k];
        mor[o + 2] = (_pz[k1] + _pz[k2]) * 0.5 - _pz[k];
      }
      const c = k * CS, q = (j * V + i) * 4;
      col[q] = b8(_col[c]); col[q + 1] = b8(_col[c + 1]); col[q + 2] = b8(_col[c + 2]); col[q + 3] = b8(1 - _col[c + 16]);
      // (the painted canopy, where it is on: the far wash's spare byte carries the stand, and the parameters' fourth -- a
      // crack's depth, which the oil look's ground never paints -- the needle share; world/farstand.js)
      col2[q] = b8(_col[c + 3]); col2[q + 1] = b8(_col[c + 4]); col2[q + 2] = b8(_col[c + 5]); col2[q + 3] = can ? b8(_col[c + 21]) : 255;
      par[q] = b8(_col[c + 6]); par[q + 1] = b8(_col[c + 7]); par[q + 2] = b8(_col[c + 8]); par[q + 3] = b8(_col[c + (can ? 22 : 9)]);
      if (blo) { blo[q] = b8(_bl[k * 2]); blo[q + 1] = b8(_bl[k * 2 + 1] / 15); }
      if (!io && !jo) {
        // the parent's own normal here: its grid is twice as wide (at the border the apron is one cell deep)
        const il2 = i > 0 ? k - 2 : k - 1, ir2 = i < N ? k + 2 : k + 1, jl2 = j > 0 ? k - 2 * E : k - E, jr2 = j < N ? k + 2 * E : k + E;
        const ax2 = _px[ir2] - _px[il2], ay2 = _py[ir2] - _py[il2], az2 = _pz[ir2] - _pz[il2];
        const bx2 = _px[jr2] - _px[jl2], by2 = _py[jr2] - _py[jl2], bz2 = _pz[jr2] - _pz[jl2];
        const mx = ay2 * bz2 - az2 * by2, my = az2 * bx2 - ax2 * bz2, mz = ax2 * by2 - ay2 * bx2;
        const im = 1 / Math.sqrt(mx * mx + my * my + mz * mz);
        norP[o] = mx * im; norP[o + 1] = my * im; norP[o + 2] = mz * im;
      }
    }
  }
  // the parent's look at every vertex: its own at the vertices they share, halfway between two of them elsewhere
  for (let j = 0; j < V; j++) {
    for (let i = 0; i < V; i++) {
      const v = j * V + i, io = i & 1, jo = j & 1;
      const v1 = io && !jo ? v - 1 : !io && jo ? v - V : io ? v - V - 1 : v, v2 = io && !jo ? v + 1 : !io && jo ? v + V : io ? v + V + 1 : v;
      for (let t = 0; t < 4; t++) {
        colP[v * 4 + t] = (col[v1 * 4 + t] + col[v2 * 4 + t] + 1) >> 1;
        col2P[v * 4 + t] = (col2[v1 * 4 + t] + col2[v2 * 4 + t] + 1) >> 1;
        parP[v * 4 + t] = (par[v1 * 4 + t] + par[v2 * 4 + t] + 1) >> 1;
      }
      // (the drift's cover halfway, its colour the stronger neighbour's: an index is a name, not a number to average)
      if (bloP) { bloP[v * 4] = (blo[v1 * 4] + blo[v2 * 4] + 1) >> 1; bloP[v * 4 + 1] = blo[(blo[v1 * 4] >= blo[v2 * 4] ? v1 : v2) * 4 + 1]; }
      if (io || jo) for (let t = 0; t < 3; t++) norP[v * 3 + t] = (norP[v1 * 3 + t] + norP[v2 * 3 + t]) * 0.5;
    }
  }
  // (kept as the difference from the vertex's own normal, like the morph of its place)
  for (let v = 0; v < V * V * 3; v++) norP[v] -= nor[v];
  // 3. skirts: copies of the border pulled toward the planet centre
  const size = (Math.PI * 0.5 * R) / (1 << level);
  const drop = Math.max(0.4, (size / N) * 0.75);
  const S0 = V * V;
  const skirt = (dst, src) => {
    const o = dst * 3, p = src * 3;
    const x = pos[p] + ox, y = pos[p + 1] + oy, z = pos[p + 2] + oz;
    const il = drop / Math.sqrt(x * x + y * y + z * z);
    pos[o] = pos[p] - x * il; pos[o + 1] = pos[p + 1] - y * il; pos[o + 2] = pos[p + 2] - z * il;
    nor[o] = nor[p]; nor[o + 1] = nor[p + 1]; nor[o + 2] = nor[p + 2];
    mor[o] = mor[p]; mor[o + 1] = mor[p + 1]; mor[o + 2] = mor[p + 2];
    const a = dst * 4, b = src * 4;
    norP[o] = norP[p]; norP[o + 1] = norP[p + 1]; norP[o + 2] = norP[p + 2];
    for (let t = 0; t < 4; t++) { col[a + t] = col[b + t]; col2[a + t] = col2[b + t]; par[a + t] = par[b + t]; colP[a + t] = colP[b + t]; col2P[a + t] = col2P[b + t]; parP[a + t] = parP[b + t]; }
    if (blo) for (let t = 0; t < 4; t++) { blo[a + t] = blo[b + t]; bloP[a + t] = bloP[b + t]; }
  };
  for (let k = 0; k < V; k++) {
    skirt(S0 + k, k); skirt(S0 + V + k, N * V + k); skirt(S0 + 2 * V + k, k * V); skirt(S0 + 3 * V + k, k * V + N);
  }
  // 4. water surface, only where liquid reaches the ground
  let water = null;
  if (anyWater) {
    const wpos = new Float32Array(V * V * 3), wdep = new Float32Array(V * V);
    const wliq = new Uint8Array(V * V * 4), wlp = new Uint8Array(V * V * 4);
    // THE FALL AND THE CHURN, one byte each (the paint's attribute aTurb; see the note by FLOW_VMAX above):
    //   x  the current's speed, 0 .. FLOW_VMAX m/s. A byte of 0 means NO NUMBER WAS GIVEN -- a mesh built before
    //      this, or the attribute not bound -- and the paint then keeps v33's fixed dash rate, so nothing of the
    //      look changes until the byte arrives. Still water that was measured gets 1, not 0.
    //   y  how aerated the water is, 0 .. 1. 0 is clear water, which is what all of it was.
    //   z, w  spare, and left at 0.
    // Nothing is built outside the oil look (the watercolour game has no dashes to run and no churn to paint), so
    // `turb` is null there and terrain.js attaches nothing.
    const wturb = MODE.oil ? new Uint8Array(V * V * 4) : null;
    const cellM = size / N;                                        // this patch's sample spacing, metres (= S.foot)
    const grav = (BODIES[S.id] && BODIES[S.id].gravity) || 9.0;    // for the Froude number below
    // The bed is FRACTAL and the water's surface is not. MEASURED at the spawn, the same 60 wet points read at every
    // patch level's own spacing: the water's own fall is 0.01202 at 0.77 m and 0.01201 at 24.5 m -- the same number,
    // so the SPEED does not change when a patch splits. The bed's slope goes 0.199 at 0.77 m to 0.047 at 24.5 m, a
    // factor of 4.2, which would make the white edge below jump every time a patch split. So the bed's slope is
    // carried to one reference spacing by its own measured exponent (0.42, fitted to those six readings, reference
    // 1.53 m): normalised, the same six come out 0.149 to 0.207 instead of 0.047 to 0.199. One pow a patch.
    const bedK = Math.pow(cellM / 1.53, 0.42);
    for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) {
      const k = (j + 1) * E + (i + 1), o = (j * V + i) * 3;
      const h = _hh[k], lq = _lq[k];
      const has = lq > -1e5;
      const hw = has ? lq : h - 1.5;
      const sc = (R + hw) / (R + h);
      wpos[o] = _px[k] * sc - ox; wpos[o + 1] = _py[k] * sc - oy; wpos[o + 2] = _pz[k] * sc - oz;
      wdep[j * V + i] = has ? lq - h : -1.5;
      const c = k * CS, q = (j * V + i) * 4;
      wliq[q] = b8(_col[c + 10]); wliq[q + 1] = b8(_col[c + 11]); wliq[q + 2] = b8(_col[c + 12]); wliq[q + 3] = b8(_col[c + 13]);
      wlp[q] = b8(_col[c + 14]); wlp[q + 1] = b8(_col[c + 15]);
      // (the current's direction as two bytes about 128; 0, 0: still water, and everything outside the oil look.
      // It stays a UNIT direction: the paint's own test for a current that two triangles disagree about reads its
      // length, so the speed is carried beside it and not in it)
      const fu = _col[c + 17], fv = _col[c + 18];
      if (fu !== 0 || fv !== 0) { wlp[q + 2] = Math.max(1, Math.min(255, Math.round(128 + 127 * fu))); wlp[q + 3] = Math.max(1, Math.min(255, Math.round(128 + 127 * fv))); }
      // Every vertex of the water grid is given a speed of 1 (a measured, standing still), and only the ones the
      // water really reaches are measured properly -- the same test the water's cells are kept by below, because in
      // a wood the liquid level is set for every point of the biome and most of it lies well under the ground.
      // The 1 matters: a byte of 0 tells the paint NO NUMBER WAS GIVEN, and a dry corner of a triangle at the
      // water's edge would then drag the speed under the paint's floor and the dashes there would jump back to the
      // old fixed rate -- a band of faster water along every margin.
      if (wturb) { wturb[q] = 1; if (has && lq > h - 0.5) {
        // THE FALL of the water's own surface across this cell. A neighbour with no liquid is read as this vertex's
        // own level, so the fall eases to nothing at the bank instead of jumping off the end of the water.
        const lw = _lq[k - 1] > -1e5 ? _lq[k - 1] : lq, le = _lq[k + 1] > -1e5 ? _lq[k + 1] : lq;
        const ld = _lq[k - E] > -1e5 ? _lq[k - E] : lq, lu = _lq[k + E] > -1e5 ? _lq[k + E] : lq;
        const gu = (le - lw) * 0.5, gv = (lu - ld) * 0.5;
        const fall = Math.sqrt(gu * gu + gv * gv) / cellM;        // metres of fall to the metre
        const dep = lq - h;
        const rr = dep < 0.05 ? 0.05 : dep > MANNING_RMAX ? MANNING_RMAX : dep;
        let v = Math.cbrt(rr * rr) * Math.sqrt(fall) / MANNING_N;
        if (_col[c + 19] > 0) v = _col[c + 19];                   // the drainage field's own speed, where there is one
        if (v > FLOW_VMAX) v = FLOW_VMAX;
        // AND THE CHURN. Three things make white water, and the whitest of the three wins:
        //  - the Froude number past about 0.8: the flow is near or over critical and breaks over itself (a rapid);
        //  - the water's own face falling more than a few per cent in the cell: the lace under a lip;
        //  - thin water over a tilted bed: the stirred white edge where a brook runs over its stones.
        // MEASURED on Earth's spawn brook today: Froude 0.35 to 0.56 and the fall a flat 1.2 % at every patch level,
        // so the first two are ZERO until the levels themselves fall. The third is what shows now, at the edges.
        const bu = (_hh[k + 1] - _hh[k - 1]) * 0.5, bv = (_hh[k + E] - _hh[k - E]) * 0.5;
        const bedS = Math.sqrt(bu * bu + bv * bv) * bedK / cellM;
        const fr = v / Math.sqrt(grav * (dep > 0.05 ? dep : 0.05));
        const hint = _col[c + 20];
        let aer = Math.max(sstep(0.80, 1.35, fr), sstep(0.035, 0.16, fall),
          sstep(0.55, 0.06, dep) * sstep(0.12, 0.45, bedS) * (0.35 + 0.65 * sstep(0.15, 0.80, v)));
        // only running water churns of itself: a pond, a lake and the sea have no current here, and their own
        // whitecaps are raised by the wind and already painted. A surface that says otherwise (`turb`) is believed.
        if (fu === 0 && fv === 0) aer = 0;
        if (hint > aer) aer = hint;
        wturb[q] = v >= FLOW_VMAX ? 255 : Math.max(1, Math.round(255 * v / FLOW_VMAX));
        wturb[q + 1] = aer <= 0 ? 0 : aer >= 1 ? 255 : Math.round(255 * aer);
      } }
    }
    const widx = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = j * V + i, b = a + 1, c = a + V, d = c + 1;
      if (wdep[a] > -0.45 || wdep[b] > -0.45 || wdep[c] > -0.45 || wdep[d] > -0.45) widx.push(a, b, d, a, d, c);
    }
    // thin water (a brook) is left to the terrain's far colour on coarse patches
    if (widx.length && (level >= 5 || widx.length > N * N * 6 * 0.08)) water = { positions: wpos, depth: wdep, liq: wliq, liqP: wlp, turb: wturb, indices: new Uint16Array(widx) };
  }
  return {
    origin: [ox, oy, oz], positions: pos, normals: nor, morph: mor, colors: col, colors2: col2, params: par,
    colorsP: colP, colors2P: col2P, paramsP: parP, normalsP: norP, bloom: blo, bloomP: bloP,
    water, boundR: Math.sqrt(boundR2) + drop, minH, maxH, size,
  };
}

// Build a whole patch in one go (tests, the six root patches).
export function buildPatchData(S, face, level, ix, iy) {
  return stepPatch(beginPatch(S, face, level, ix, iy), Infinity);
}
