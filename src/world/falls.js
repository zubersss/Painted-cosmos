// Painted Cosmos: WATERFALLS (?falls=1, the oil look): the falling sheets, their plunge pools and spray. OWNER: PAINTER (the
// water group, lane W2). docs/lead/WATER-DESIGN.md, section 3.5. The owner, 23 Nov: "the waterfall off the sea cliff".
//
// What falls is decided by world/hydro.js, at load: wherever a river's cut reaches the coast's wall (or a fjord's head) it
// lists a fall in S.hydro.falls -- the lip's place, the way over it, the width, the level at the lip and at the foot, and the
// water's speed over the lip. This file draws them, near the eye:
//   THE SHEET: a ribbon from the lip to the foot along the path a jet really takes (it leaves the lip at the river's speed and
//     falls in a parabola, so at 2.7 m/s it clears a 19.5 m drop by about 5 m), a little wider at its foot; painted by
//     render/fallmat.js in falling strokes.
//   THE PLUNGE POOL: a disc of churned milk and lace on the sea at the foot, the strokes carried out with the outflow.
//   THE SPRAY: a few hundred dabs thrown up and out from the foot and falling back, and some peeled off the lower sheet.
// Only the falls within 1.5 km are built, with fewer segments and dabs far off; all the sheets and pools are ONE draw and all
// the spray ONE more. It registers itself in world/waterhooks.js WATER_PARTS (stepped once a frame by the world) and puts a
// row in WATER_BENCH for the speed test.
//
// THE PHONE'S BUDGET (docs/lead/WATER-DESIGN.md 3.5): a 21 m fall seen from 60 m covers about 16,700 pixels of 936 x 372 at
// about a water pixel's cost each (14 ns): 0.23 ms, spray 0.05 ms; close under it, a quarter of the picture: 1.2 + 0.2 ms.
// Triangles: a few hundred a fall. Draw calls: +2. Script: the set of falls and their detail is looked at again only when the
// eye has moved 20 m.
import * as THREE from 'three';
import { WATER_PARTS, WATER_BENCH } from './waterhooks.js';
import { getSurface, makeSample, NOLQ } from './surface.js';
import { makeFallSheetMaterial, makeFallSprayMaterial } from '../render/fallmat.js';
import { bindBodyUniforms } from '../render/materials.js';

export const FALLS_DEF = {
  reach: 1500,            // metres: falls beyond this are not drawn
  lod: [260, 700],        // metres: the full detail within the first, half within the second, the least beyond
  sheetU: [4, 8, 14],     // segments across the sheet at each detail (least .. full)
  sheetV: [6, 12, 22],    // ... and down it
  poolRings: [2, 3, 5], poolSec: [12, 18, 28],
  spray: [40, 130, 300],  // dabs a fall
  sheetSpray: 0.22,       // the share of them peeled off the lower sheet (the rest are thrown from the foot)
  lift: 0.12,             // metres the pool's disc lies over the sea's still level
  move: 20,               // metres the eye moves before the set and its detail are looked at again
  g: 9.81,
};

// ---- the shapes (pure arrays: no three.js, so a test can measure them) ----------------------------------------------

// A fall's own frame and path: where the jet is after t seconds, from the lip. Body metres.
export function fallFrame(f, R) {
  const up = f.lip, base = R + f.top;
  const lipP = [up[0] * base, up[1] * base, up[2] * base];
  const drop = Math.max(0.5, f.top - f.foot);
  const T = Math.sqrt(2 * drop / FALLS_DEF.g);
  return { up, dir: f.dir, acr: f.across, lipP, drop, T, v0: f.speed, hw: f.width * 0.5, eU: f.edgeU || null, eT: f.edgeT || null };
}
// (where the lip stands at a place across, u: the coast's wall need not cross the cut square, hydro.js measures its line)
export function edgeAt(F, u) {
  if (!F.eU) return 0;
  const n = F.eU.length, f = (u - F.eU[0]) / (F.eU[n - 1] - F.eU[0]) * (n - 1), i = Math.max(0, Math.min(n - 2, Math.floor(f))), w = Math.max(0, Math.min(1, f - i));
  return F.eT[i] + (F.eT[i + 1] - F.eT[i]) * w;
}
export function fallAt(F, t, u, out) {
  const g = FALLS_DEF.g, hw = F.hw * (1 + 0.12 * (t / F.T)) + 0.02 * F.drop * (t / F.T);
  const a = 0.15 + F.v0 * t + edgeAt(F, u), b = -0.5 * g * t * t, c = u * hw;
  for (let i = 0; i < 3; i++) out[i] = F.lipP[i] + F.dir[i] * a + F.up[i] * b + F.acr[i] * c;
  return out;
}
// the foot: where the jet's middle meets the pool, at the foot's level
export function fallFoot(F, lift, out) {
  const a = 0.15 + F.v0 * F.T, b = -F.drop + (lift || 0);
  for (let i = 0; i < 3; i++) out[i] = F.lipP[i] + F.dir[i] * a + F.up[i] * b;
  return out;
}

// The sheet and the pool of a list of falls, at their levels of detail, positions measured from `org` (body metres).
// Returns plain arrays: position, normal, aF, aG, aP, index.
export function sheetArrays(list, R, org, D = FALLS_DEF) {
  const P = [], N = [], AF = [], AG = [], AP = [], I = [];
  const q = [0, 0, 0], q2 = [0, 0, 0];
  for (const { f, lod, id } of list) {
    const F = fallFrame(f, R), U = D.sheetU[lod], V = D.sheetV[lod];
    const K = Math.sqrt(F.v0 * F.v0 + (D.g * F.T * 0.6) * (D.g * F.T * 0.6));
    const base = P.length / 3;
    for (let j = 0; j <= V; j++) {
      const s = j / V, t = s * F.T;
      // the way the jet goes here (its tangent), and the face's normal: out from the cliff, up at the lip
      const tx = F.dir[0] * F.v0 - F.up[0] * D.g * t, ty = F.dir[1] * F.v0 - F.up[1] * D.g * t, tz = F.dir[2] * F.v0 - F.up[2] * D.g * t;
      let nx = ty * F.acr[2] - tz * F.acr[1], ny = tz * F.acr[0] - tx * F.acr[2], nz = tx * F.acr[1] - ty * F.acr[0];
      const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      for (let i = 0; i <= U; i++) {
        const u = -1 + 2 * i / U;
        fallAt(F, t, u, q);
        P.push(q[0] - org[0], q[1] - org[1], q[2] - org[2]);
        N.push(nx, ny, nz);
        AF.push(u, s, t, 0);
        AG.push(F.hw * (1 + 0.12 * s) + 0.02 * F.drop * s, K, 0, id);
        AP.push(0, 0);
      }
    }
    for (let j = 0; j < V; j++) for (let i = 0; i < U; i++) {
      const a = base + j * (U + 1) + i, b = a + 1, c = a + U + 1, d = c + 1;
      I.push(a, c, b, b, c, d);
    }
    // the pool: a disc on the sea at the foot, its half axes across and out
    fallFoot(F, D.lift, q2);
    const A = F.hw + 0.35 * F.drop + 2, B = 0.6 * A + 0.15 * F.drop, vOut = 0.8 + 0.08 * F.drop;
    const RN = D.poolRings[lod], SN = D.poolSec[lod], pb = P.length / 3;
    P.push(q2[0] - org[0], q2[1] - org[1], q2[2] - org[2]); N.push(F.up[0], F.up[1], F.up[2]); AF.push(0, 0, 0, 1); AG.push(A, B, vOut, id); AP.push(0, 0);
    for (let r = 1; r <= RN; r++) for (let k = 0; k < SN; k++) {
      const rn = r / RN, th = (k / SN) * Math.PI * 2;
      const x = A * rn * Math.sin(th), y = B * rn * Math.cos(th);
      for (let i = 0; i < 3; i++) q[i] = q2[i] + F.acr[i] * x + F.dir[i] * y;
      P.push(q[0] - org[0], q[1] - org[1], q[2] - org[2]); N.push(F.up[0], F.up[1], F.up[2]); AF.push(rn, 0, 0, 1); AG.push(A, B, vOut, id); AP.push(x, y);
    }
    for (let k = 0; k < SN; k++) { const k1 = (k + 1) % SN; I.push(pb, pb + 1 + k, pb + 1 + k1); }
    for (let r = 1; r < RN; r++) for (let k = 0; k < SN; k++) {
      const k1 = (k + 1) % SN, a = pb + 1 + (r - 1) * SN + k, b = pb + 1 + (r - 1) * SN + k1, c = pb + 1 + r * SN + k, d = pb + 1 + r * SN + k1;
      I.push(a, c, b, b, c, d);
    }
  }
  return { P, N, AF, AG, AP, I };
}

// The spray's dabs for a list of falls: per dab its numbers (aS), the foot (aC), the way out (aD), across (aA).
export function sprayArrays(list, R, org, D = FALLS_DEF) {
  const S = [], C = [], Dd = [], A = [];
  const q = [0, 0, 0];
  let seed = 9871;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (const { f, lod } of list) {
    const F = fallFrame(f, R), n = D.spray[lod];
    fallFoot(F, 0, q);
    for (let k = 0; k < n; k++) {
      S.push(rnd(), rnd() * 2 - 1, rnd() < D.sheetSpray ? 1 : 0, 0);
      C.push(q[0] - org[0], q[1] - org[1], q[2] - org[2], F.hw);
      Dd.push(F.dir[0], F.dir[1], F.dir[2], F.drop);
      A.push(F.acr[0], F.acr[1], F.acr[2], F.drop);
    }
  }
  return { S, C, D: Dd, A, n: S.length / 4 };
}

// ---- the layer -----------------------------------------------------------------------------------------------------

const _cam = new THREE.Vector3();
class FallsLayer {
  constructor() {
    this.on = true;            // (the speed test's row turns it off and on: a visibility, never a recompile)
    this.worlds = new Map();
  }

  _world(ctx) {
    let W = this.worlds.get(ctx.bodyId);
    // (made again if the world's falls arrived after it was first asked: the parts attach before the first patch, but a
    //  world asked for before its parts were fetched would otherwise keep an empty list)
    if (W && !W.sheet && W.S && W.S.hydro && W.S.hydro.falls && W.S.hydro.falls.length) W = null;
    if (W) return W;
    const S = getSurface(ctx.bodyId), hy = S && S.hydro;
    W = { S, falls: hy && hy.falls ? hy.falls : [], sheet: null, spray: null, key: '', at: null, org: [0, 0, 0], bu: null };
    this.worlds.set(ctx.bodyId, W);
    if (!W.falls.length || !ctx.root) return W;
    const bu = ctx.st && ctx.st.bu;
    const ms = makeFallSheetMaterial(bu), mp = makeFallSprayMaterial(bu);
    W.bu = bu;
    // the river's own water colour at each fall's lip (asked once, here, outside any sample)
    const o = makeSample(S.nB);
    const f0 = W.falls[0];
    S.sample(f0.lip[0], f0.lip[1], f0.lip[2], o, true);
    if (o.lq !== NOLQ) { ms.uniforms.uFallWash.value.setRGB(o.qr, o.qg, o.qb); mp.uniforms.uFallWash.value.setRGB(o.qr, o.qg, o.qb); }
    W.sheet = new THREE.Mesh(new THREE.BufferGeometry(), ms); W.sheet.name = 'pc-water-falls';
    W.spray = new THREE.Mesh(new THREE.InstancedBufferGeometry(), mp); W.spray.name = 'pc-water-fallspray';
    W.spray.frustumCulled = false;
    W.sheet.visible = W.spray.visible = false;
    ctx.root.add(W.sheet); ctx.root.add(W.spray);
    return W;
  }

  update(ctx) {
    const W = this._world(ctx);
    if (!W.sheet) return;
    const camL = ctx.camL, R = W.S.R, D = FALLS_DEF;
    if (!camL) return;
    _cam.copy(camL);
    // (look at the set again only when the eye has moved)
    if (!W.at || W.at.distanceTo(_cam) > D.move) {
      W.at = (W.at || new THREE.Vector3()).copy(_cam);
      const list = [];
      let best = Infinity;
      for (let id = 0; id < W.falls.length; id++) {
        const f = W.falls[id], b = R + f.top;
        const d = Math.hypot(f.lip[0] * b - _cam.x, f.lip[1] * b - _cam.y, f.lip[2] * b - _cam.z);
        if (d > D.reach) continue;
        list.push({ f, id, lod: d < D.lod[0] ? 2 : d < D.lod[1] ? 1 : 0, d });
        if (d < best) { best = d; W.org = [f.lip[0] * b, f.lip[1] * b, f.lip[2] * b]; }
      }
      const key = list.map((e) => e.id + ':' + e.lod).join(',');
      if (key !== W.key) { W.key = key; this._build(W, list, R); }
    }
    const any = W.key !== '' && this.on;
    W.sheet.visible = W.spray.visible = any;
    if (!any) return;
    if (ctx.st && ctx.st.bu !== W.bu) { bindBodyUniforms(W.sheet.material, ctx.st.bu); bindBodyUniforms(W.spray.material, ctx.st.bu); W.bu = ctx.st.bu; }
    for (const m of [W.sheet.material, W.spray.material]) {
      m.uniforms.uOrgRel.value.set(W.org[0] - _cam.x, W.org[1] - _cam.y, W.org[2] - _cam.z);
      m.uniforms.uOrgB.value.set(W.org[0], W.org[1], W.org[2]);
    }
  }

  _build(W, list, R) {
    const org = W.org;
    const a = sheetArrays(list, R, org);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(a.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(a.N, 3));
    g.setAttribute('aF', new THREE.Float32BufferAttribute(a.AF, 4));
    g.setAttribute('aG', new THREE.Float32BufferAttribute(a.AG, 4));
    g.setAttribute('aP', new THREE.Float32BufferAttribute(a.AP, 2));
    g.setIndex(a.I);
    g.computeBoundingSphere();
    W.sheet.geometry.dispose(); W.sheet.geometry = g;
    const s = sprayArrays(list, R, org);
    const q = new THREE.InstancedBufferGeometry();
    q.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0], 3));
    q.setIndex([0, 1, 2, 1, 3, 2]);
    q.setAttribute('aS', new THREE.InstancedBufferAttribute(new Float32Array(s.S), 4));
    q.setAttribute('aC', new THREE.InstancedBufferAttribute(new Float32Array(s.C), 4));
    q.setAttribute('aD', new THREE.InstancedBufferAttribute(new Float32Array(s.D), 4));
    q.setAttribute('aA', new THREE.InstancedBufferAttribute(new Float32Array(s.A), 4));
    q.instanceCount = s.n;
    W.spray.geometry.dispose(); W.spray.geometry = q;
    W.sheet.position.set(org[0], org[1], org[2]); W.spray.position.set(org[0], org[1], org[2]);
    W.sheet.updateMatrix(); W.spray.updateMatrix();
    W.tris = a.I.length / 3; W.dabs = s.n;
  }
}

export const FALLS = new FallsLayer();
WATER_PARTS.push({ name: 'falls', update: (ctx) => FALLS.update(ctx) });
// (the speed test: a fall in view, with and without its sheets, pools and spray. The view itself is asked of the speed test's
//  owner: core/bench.js has the bank and the shore; the falls view is to be added there, docs/notes/water.md)
// `place` says where that view stands: in the sea 60 m out from the widest fall's foot and 25 m to one side, at the sea's level,
// facing the middle of the sheet (dir: a unit direction; yaw: degrees from north toward east, the frame core/bench.js and the
// gallery use; pitch: radians, as core/bench.js's own views give it). Null on a world with no fall.
export function fallsView(S) {
  const hy = S && S.hydro;
  if (!hy || !hy.falls || !hy.falls.length) return null;
  const f = hy.falls.reduce((a, b) => (b.width > a.width ? b : a)), R = S.R;
  const F = fallFrame(f, R), foot = fallFoot(F, 0, [0, 0, 0]), mid = fallAt(F, F.T * 0.5, 0, [0, 0, 0]);
  const P = [0, 1, 2].map((i) => foot[i] + F.dir[i] * 60 + F.acr[i] * 25);
  const l = Math.hypot(P[0], P[1], P[2]), u = P.map((v) => v / l);
  let ex = u[2], ey = 0, ez = -u[0]; const el = Math.hypot(ex, ey, ez) || 1; ex /= el; ey /= el; ez /= el;
  const nx = u[1] * ez - u[2] * ey, ny = u[2] * ex - u[0] * ez, nz = u[0] * ey - u[1] * ex;
  const eye = R + f.foot + 1.6, v = [mid[0] - u[0] * eye, mid[1] - u[1] * eye, mid[2] - u[2] * eye];
  const ve = v[0] * ex + v[1] * ey + v[2] * ez, vn = v[0] * nx + v[1] * ny + v[2] * nz, vu = v[0] * u[0] + v[1] * u[1] + v[2] * u[2];
  return { dir: u, yaw: Math.atan2(ve, vn) * 180 / Math.PI, pitch: Math.atan2(vu, Math.hypot(ve, vn)) };
}
WATER_BENCH.push({ name: 'no falls', view: 'falls', place: fallsView, on: () => { FALLS.on = false; }, off: () => { FALLS.on = true; } });
