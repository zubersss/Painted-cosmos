// Painted Cosmos: terrain patch mesher (pure JS, no three). OWNER: PAINTER.
// Builds the vertex data of one quadtree node of the cube-sphere. Kept free of three so it can
// be unit-tested in Node and moved into a worker later without changes.
import { faceToDir } from './cubesphere.js';
import { makeSample, NOLQ } from './surface.js';
import { MODE } from '../data/mode.js';
import { BODIES } from '../data/bodies.js';

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
const CS = 24;   // floats kept per sample: wash, far wash, parameters, liquid look, strata, the current, the fall, (21, 22: the far
                 // view's stand, branch farview), how still
const _col = new Float32Array(E * E * CS);
let _s = null;
let _stillGrid = new Float32Array(0), _stillSamp = null;      // (scratch: the water's section, how still, on a coarse grid)

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
        _col[c + 23] = s.still || 0;                              // (the water's: how still, where a water part says; 0 otherwise)
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
      col2[q] = b8(_col[c + 3]); col2[q + 1] = b8(_col[c + 4]); col2[q + 2] = b8(_col[c + 5]); col2[q + 3] = 255;
      par[q] = b8(_col[c + 6]); par[q + 1] = b8(_col[c + 7]); par[q + 2] = b8(_col[c + 8]); par[q + 3] = b8(_col[c + 9]);
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
    // HOW STILL THE WATER IS (the water's new paint, ?wpaint=1, the default: lane W3, docs/lead/WATER-DESIGN.md 3.4), into the spare
    // byte aTurb.w: 0 water with a current .. 1 a pond, a lake, the sea. The paint lays still water's strokes along the
    // wind's crests, long and level, and never runs them; a current's along it, running. Three things say still:
    //  - the surface says so (s.still: the lakes, ponds and puddles of the bodies-of-water lane, when it is attached);
    //  - there is water and no current at all (the sea, a marsh's pools);
    //  - the water reaches far ACROSS its current, both ways: a river is long along its current and narrow across it,
    //    a pool is wide every way. v37's rivers (surface.js _riversOil) give every point of a channel a "current" that
    //    is the tangent of a field's contours, and where the river and its island arm spread into one pool those
    //    contours close: the junction pond by the landing was painted as a whorl (the design's still w06). MEASURED in
    //    Node, 1.2 km round the landing at 2 m: neither how fast the current turns (the river's own bends turn as fast as
    //    the pond's rings over a tenth of its points) nor how well it agrees with itself within 8 or 14 m (0.97 in the
    //    pond's middle, 0.998 in the river's) tells the pond from the river. Across the current does: the river is at
    //    most about 44 m wide (_riversOil: half width 2.5 m times 8.9 at its widest pool), so water found WIDE_R = 27 m to
    //    BOTH sides across the current is a pool. Asked of the surface itself (two samples), on a grid of about 6 m over
    //    the patch and laid between, so a patch at any level gives about the same answer.
    // (Only with the switch: without it the byte stays 0, as it was, and nothing reads it.)
    if (wturb && MODE.water && MODE.water.wpaint >= 1) {
      const st = (_stillSamp && _stillSamp.w.length >= S.nB) ? _stillSamp : (_stillSamp = makeSample(S.nB));
      const gs = Math.max(1, Math.round(6 / cellM)), G = Math.ceil((V - 1) / gs) + 1;
      if (_stillGrid.length < G * G) _stillGrid = new Float32Array(G * G);
      const grid = _stillGrid, WR = 27 / R;
      const wetCur = (k) => _lq[k] > -1e5 && _lq[k] > _hh[k] - 0.5 && (_col[k * CS + 17] !== 0 || _col[k * CS + 18] !== 0);
      for (let gj = 0; gj < G; gj++) for (let gi = 0; gi < G; gi++) {
        const i = Math.min(V - 1, gi * gs), j = Math.min(V - 1, gj * gs), k = (j + 1) * E + (i + 1);
        let v = 0;
        if (wetCur(k)) {
          // the place, its two tangent axes as surface.js hands the current in, and the way across the current
          const l0 = Math.sqrt(_px[k] * _px[k] + _py[k] * _py[k] + _pz[k] * _pz[k]), x = _px[k] / l0, y = _py[k] / l0, z = _pz[k] / l0;
          let ux, uy, uz;
          if (Math.abs(y) < 0.9) { ux = -z; uy = 0; uz = x; } else { ux = 0; uy = z; uz = -y; }
          const lu = 1 / Math.sqrt(ux * ux + uy * uy + uz * uz); ux *= lu; uy *= lu; uz *= lu;
          const vx = y * uz - z * uy, vy = z * ux - x * uz, vz = x * uy - y * ux;
          const fu = _col[k * CS + 17], fv = _col[k * CS + 18];
          const ax = -fv * ux + fu * vx, ay = -fv * uy + fu * vy, az = -fv * uz + fu * vz;
          let both = 1;
          for (let sgn = -1; sgn <= 1 && both; sgn += 2) {
            let qx = x + ax * WR * sgn, qy = y + ay * WR * sgn, qz = z + az * WR * sgn; const lq = 1 / Math.sqrt(qx * qx + qy * qy + qz * qz);
            S.sample(qx * lq, qy * lq, qz * lq, st, false);
            if (!(st.lq !== NOLQ && st.lq > st.h)) both = 0;
          }
          v = both;
        }
        grid[gj * G + gi] = v;
      }
      for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) {
        const k = (j + 1) * E + (i + 1), q = (j * V + i) * 4;
        let sv = _col[k * CS + 23];
        if (_lq[k] > -1e5 && _lq[k] > _hh[k] - 0.5) {
          if (_col[k * CS + 17] === 0 && _col[k * CS + 18] === 0) sv = 1;
          else {
            const gx = Math.min(i / gs, G - 1), gy = Math.min(j / gs, G - 1), x0 = Math.min(G - 2, Math.floor(gx)), y0 = Math.min(G - 2, Math.floor(gy));
            const fx = G > 1 ? gx - x0 : 0, fy = G > 1 ? gy - y0 : 0, X0 = Math.max(0, x0), Y0 = Math.max(0, y0), X1 = Math.min(G - 1, X0 + 1), Y1 = Math.min(G - 1, Y0 + 1);
            const a = grid[Y0 * G + X0] + (grid[Y0 * G + X1] - grid[Y0 * G + X0]) * fx, b = grid[Y1 * G + X0] + (grid[Y1 * G + X1] - grid[Y1 * G + X0]) * fx;
            sv = Math.max(sv, a + (b - a) * fy);
          }
        }
        wturb[q + 3] = b8(sv);
      }
    }
    const widx = [];
    // (NO BLUE CURTAIN AT A FALL, for the bodies-of-water lane's waterfalls, E-W2: a cell with one wet corner is kept, so a
    // cell across a lip -- the river cut at 19.6 m, the sea at 0 -- was one water quad as tall as the cliff, painted with
    // the water's dashes: a flat blue curtain behind every fall. A cell whose four corners all hold liquid but whose
    // levels spread over 2 m AND over half the cell's width (a face steeper than 1 in 2) is a fall, and the falls' own
    // sheet draws it. Today's staircase lips, about 0.17 m a metre, are kept. MEASURED, all 30,720 patches of levels 5
    // and 6 and 800 of 7 and 8 over Earth: today's oil world 0 cells dropped; with the drainage (?flow=1) 32, which is
    // why it waits for a water part's switch.)
    // (Only with a water part that changes the world, MODE.water.on: rivers=tree, lakes, falls, fjord ...; without one
    // nothing is dropped and the mesh is as it was.)
    let dropped = 0;
    const fallCut = !!(MODE.water && MODE.water.on);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = j * V + i, b = a + 1, c = a + V, d = c + 1;
      const k0 = (j + 1) * E + (i + 1), l0 = _lq[k0], l1 = _lq[k0 + 1], l2 = _lq[k0 + E], l3 = _lq[k0 + E + 1];
      if (fallCut && l0 > -1e5 && l1 > -1e5 && l2 > -1e5 && l3 > -1e5) {
        const sp = Math.max(l0, l1, l2, l3) - Math.min(l0, l1, l2, l3);
        if (sp > 2.0 && sp > 0.5 * cellM) { dropped++; continue; }
      }
      if (wdep[a] > -0.45 || wdep[b] > -0.45 || wdep[c] > -0.45 || wdep[d] > -0.45) widx.push(a, b, d, a, d, c);
    }
    stepPatch.fallCells = (stepPatch.fallCells || 0) + dropped;      // (counted for the test that proves none drop where nothing falls)
    // thin water (a brook) is left to the terrain's far colour on coarse patches
    if (widx.length && (level >= 5 || widx.length > N * N * 6 * 0.08)) water = { positions: wpos, depth: wdep, liq: wliq, liqP: wlp, turb: wturb, indices: new Uint16Array(widx) };
  }
  return {
    origin: [ox, oy, oz], positions: pos, normals: nor, morph: mor, colors: col, colors2: col2, params: par,
    colorsP: colP, colors2P: col2P, paramsP: parP, normalsP: norP,
    water, boundR: Math.sqrt(boundR2) + drop, minH, maxH, size,
  };
}

// Build a whole patch in one go (tests, the six root patches).
export function buildPatchData(S, face, level, ix, iy) {
  return stepPatch(beginPatch(S, face, level, ix, iy), Infinity);
}
