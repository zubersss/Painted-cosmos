// THE TRIANGLE AND SHADED-PIXEL COUNTER (committed 2026-11-18 after an independent reader pointed out that two
// commit messages quoted its tables as the reason for a change and the harness itself was in no file in the
// repository, so nobody could re-run them -- against this project's own rule that a result is read only from this
// run's own files).
//
//   node tools/overdraw.mjs [w=3086] [h=1440] [aspect=screen] [raster=1] [ez=1] [where=autumn|spawn] [screenh=N]
//                           [nearlod=k] [farlod=d0,kmin] [gz=1] [alone=key|key]
//
// It needs no browser and no graphics card. It builds the REAL world in Node, stands the real camera on foot and at
// 150 m, walks the scene with traverseVisible, calls each mesh's own onBeforeRender (so every distance rule and
// every uniform is the game's own), replays the part of each vertex shader that MOVES vertices, and sums the
// clipped on-screen area of every front-facing triangle. With raster=1 it also rasterises them into a buffer of the
// given size and reports, per kind of thing: the fragments drawn, the pixels covered, how many times over its own
// kind covers a pixel (self-lap) and how many pixels of it are on top at the end. ez=1 adds what an early depth
// test would leave, in three's own draw order and front to back.
//
// Reading it: "overdraw" is the share of the whole picture each kind paints, so 2.1 means the far trees alone paint
// twice the screen. The two numbers that matter for the phone are the TOTAL overdraw (how many times an average
// pixel is painted at all) and each kind's self-lap (how much of its own painting it hides from itself).
//
// Measured with it on 2026-11-18 at the phone's own picture (1028 x 480), on foot in the autumn wood: total
// overdraw 6.49; far trees 2.10 with a self-lap of 9.94; the near ground's strokes 1.38; full trees 1.35; the
// ground 0.68; middle trees 0.66. The owner's own phone said the plants' paint was 11.7 ms of a 32.9 ms frame.
// Overdraw measurement for Painted Cosmos. Node only, no browser, no server.
// Reads the repository at /home/user/pc-dev read-only; writes nothing there.
//
// Builds the real world, stands the real camera, walks the scene with traverseVisible, calls each
// mesh's own onBeforeRender, replays the part of each vertex shader that moves vertices, then sums
// the clipped screen area of every front-facing triangle.
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const REPO = '/home/user/pc-dev';
const three = pathToFileURL(path.resolve(REPO, 'vendor/three/three.module.js')).href;
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier === 'three') return { url: '${three}', shortCircuit: true };
  return next(specifier, context);
}`), import.meta.url);

// the game's own switches, read at import time
globalThis.location = { search: '?look=oil&powers=1' + (process.env.PC_EXTRA || '') };   // (PC_EXTRA: extra switches, so a question like ?fartree=blob can be measured here)

const THREE = await import('three');
const { createWorld } = await import(pathToFileURL(path.resolve(REPO, 'src/world/index.js')).href);
const { QUALITY, SCREEN, LOOK, G } = await import(pathToFileURL(path.resolve(REPO, 'src/render/shared.js')).href);
const { sortLeafCards } = await import(pathToFileURL(path.resolve(REPO, 'src/world/florakit.js')).href);
const { BODIES } = await import(pathToFileURL(path.resolve(REPO, 'src/data/bodies.js')).href);

if (!LOOK.oil) throw new Error('the oil look did not come on');
QUALITY.level = 2;

// ---- the screen -------------------------------------------------------------------------------
const ARG = Object.fromEntries(process.argv.slice(2).map((s) => s.split('=')));
const W = +(ARG.w || 3086), H = +(ARG.h || 1440);
const FOV = +(ARG.fov || 55);                       // the gallery's own vertical field of view
const ASPECT = ARG.aspect === 'screen' ? W / H : 16 / 9;
// screenh: what the world is TOLD the picture's height is (the oil look sets a tree's detail by
// its size on the screen, flora.js). Left out, it is the real height.
SCREEN.outW = W; SCREEN.outH = +(ARG.screenh || H);
// one pixel of the scene pass at one metre: what the painter's frame hook computes (world/index.js)
const NEAR_PIXEL = 2 * Math.tan((FOV * Math.PI) / 360) / H;

// the viewport the areas are reckoned in: the phone's own pixel count, at the camera's aspect
const PIX = W * H;
const VW = ARG.aspect === 'screen' ? W : Math.sqrt(PIX * ASPECT), VH = ARG.aspect === 'screen' ? H : Math.sqrt(PIX / ASPECT);

const scene = new THREE.Scene();
const world = createWorld(scene);
world.sun.position.set(2e5, 1e5, 1.5e5);
const camPos = new THREE.Vector3(0, 0, 0);

// ---- standing ---------------------------------------------------------------------------------
function stand(bodyId, unitDir, alt) {
  const sp = new THREE.Vector3(unitDir.x, unitDir.y, unitDir.z).normalize();
  const s = world.sampleSurface(bodyId, sp);
  const r = Math.max(s.radius, s.liquidRadius || 0) + alt;
  let i = 0;
  for (const [id, root] of world.bodies) {
    if (id === bodyId) root.position.set(-sp.x * r, -sp.y * r, -sp.z * r);
    else root.position.set(6e5 * (i + 2), -4e5, -2e6 - i * 9e5);
    root.updateMatrixWorld(true);
    i++;
  }
  return sp;
}
function settle(activeId, maxUpdates) {
  let idle = 0, n = 0;
  while (idle < 3 && n < maxUpdates) { world.update(1 / 60, camPos, activeId); idle = world.busy === 0 ? idle + 1 : 0; n++; }
  return n;
}

// ---- the camera -------------------------------------------------------------------------------
const Y = new THREE.Vector3(0, 1, 0);
function makeCamera(up, yaw, pitchDeg) {
  const east = new THREE.Vector3().crossVectors(Y, up);
  if (east.lengthSq() < 1e-9) east.set(1, 0, 0);
  east.sub(up.clone().multiplyScalar(east.dot(up))).normalize();
  const north = new THREE.Vector3().crossVectors(up, east).normalize();
  const fwd = north.clone().multiplyScalar(Math.cos(yaw)).addScaledVector(east, Math.sin(yaw));
  if (pitchDeg) {
    const p = (pitchDeg * Math.PI) / 180;
    fwd.multiplyScalar(Math.cos(p)).addScaledVector(up, Math.sin(p)).normalize();
  }
  const cam = new THREE.PerspectiveCamera(FOV, ASPECT, 0.1, 400000);
  cam.position.set(0, 0, 0);
  cam.up.copy(up);
  cam.lookAt(fwd);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
  return cam;
}

// ---- clipping and area ------------------------------------------------------------------------
// Triangles are clipped in clip space against the near and far planes (Sutherland-Hodgman), which
// is what handles anything behind the camera: a vertex with z+w <= 0 is behind the near plane and
// the edge is cut there. After the divide the polygon is clipped against the viewport rectangle in
// NDC, and its area is taken by the shoelace rule and scaled to pixels.
const CAP = 64;
const pa = new Float64Array(CAP * 4), pb = new Float64Array(CAP * 4);
function clipPlane(src, n, dst, kind) {
  // kind 0: z + w > 0 (near). kind 1: w - z > 0 (far).
  let m = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ax = src[i * 4], ay = src[i * 4 + 1], az = src[i * 4 + 2], aw = src[i * 4 + 3];
    const bx = src[j * 4], by = src[j * 4 + 1], bz = src[j * 4 + 2], bw = src[j * 4 + 3];
    const fa = kind === 0 ? az + aw : aw - az;
    const fb = kind === 0 ? bz + bw : bw - bz;
    const ia = fa > 0, ib = fb > 0;
    if (ia) { dst[m * 4] = ax; dst[m * 4 + 1] = ay; dst[m * 4 + 2] = az; dst[m * 4 + 3] = aw; m++; }
    if (ia !== ib) {
      const t = fa / (fa - fb);
      dst[m * 4] = ax + (bx - ax) * t; dst[m * 4 + 1] = ay + (by - ay) * t;
      dst[m * 4 + 2] = az + (bz - az) * t; dst[m * 4 + 3] = aw + (bw - aw) * t;
      m++;
    }
    if (m > CAP - 2) break;
  }
  return m;
}
const q0 = new Float64Array(CAP * 2), q1 = new Float64Array(CAP * 2);
function clipRect(src, n, dst, axis, sign) {
  // keep sign*v[axis] <= 1
  let m = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ax = src[i * 2], ay = src[i * 2 + 1], bx = src[j * 2], by = src[j * 2 + 1];
    const fa = 1 - sign * (axis === 0 ? ax : ay);
    const fb = 1 - sign * (axis === 0 ? bx : by);
    const ia = fa >= 0, ib = fb >= 0;
    if (ia) { dst[m * 2] = ax; dst[m * 2 + 1] = ay; m++; }
    if (ia !== ib) { const t = fa / (fa - fb); dst[m * 2] = ax + (bx - ax) * t; dst[m * 2 + 1] = ay + (by - ay) * t; m++; }
    if (m > CAP - 2) break;
  }
  return m;
}
// signed NDC area of the clipped triangle, in pixels. 0 if nothing of it is in the view.
let LAST_N = 0;
function triPixels(c0, c1, c2) {
  LAST_N = 0;
  pa[0] = c0[0]; pa[1] = c0[1]; pa[2] = c0[2]; pa[3] = c0[3];
  pa[4] = c1[0]; pa[5] = c1[1]; pa[6] = c1[2]; pa[7] = c1[3];
  pa[8] = c2[0]; pa[9] = c2[1]; pa[10] = c2[2]; pa[11] = c2[3];
  let n = clipPlane(pa, 3, pb, 0);
  if (n < 3) return 0;
  n = clipPlane(pb, n, pa, 1);
  if (n < 3) return 0;
  LAST_N = n;
  for (let i = 0; i < n; i++) { const w = pa[i * 4 + 3]; q0[i * 2] = pa[i * 4] / w; q0[i * 2 + 1] = pa[i * 4 + 1] / w; }
  let m = clipRect(q0, n, q1, 0, 1); if (m < 3) return 0;
  m = clipRect(q1, m, q0, 0, -1); if (m < 3) return 0;
  m = clipRect(q0, m, q1, 1, 1); if (m < 3) return 0;
  m = clipRect(q1, m, q0, 1, -1); if (m < 3) return 0;
  let a = 0;
  for (let i = 0; i < m; i++) { const j = (i + 1) % m; a += q0[i * 2] * q0[j * 2 + 1] - q0[j * 2] * q0[i * 2 + 1]; }
  return (a * 0.5) * (VW * 0.5) * (VH * 0.5);
}


// ---- the rasteriser ---------------------------------------------------------------------------
// A cross-check on the area sums, and the one thing the sums cannot say: how much of a category's
// work lands on pixels it has already covered itself. Point-sampled at the full 2811 x 1581, so
// triangles smaller than a pixel are undercounted here (the area sum is the unbiased number).
const RW = Math.round(VW), RH = Math.round(VH);
const RZ = new Float32Array(RW * RH);
const RCOV = new Uint32Array(RW * RH);        // one bit a category
const rFrag = [], rCov = [], rVis = [];
let RPASS = 0;                                // 1: fill the depth buffer. 2: count what is on top.
let RCUR = '';
function rasterReset(pass) { RPASS = pass; if (pass === 1 || pass === 3 || pass === 5 || pass === 6) { RZ.fill(1e30); RCOV.fill(0); } }
const sp = new Float64Array(CAP * 3);
function rasterPoly(n, bit) {
  if (RPASS === 3 && RCUR.indexOf('ground') !== 0 && RCUR !== 'water') return [0, 0, 0];
  if (RPASS === 5 && NODEPTH) { /* this draw tests depth but does not write it */ }
  // pa holds the near/far-clipped polygon in clip space
  for (let i = 0; i < n; i++) {
    const w = pa[i * 4 + 3];
    sp[i * 3] = (pa[i * 4] / w * 0.5 + 0.5) * RW;
    sp[i * 3 + 1] = (pa[i * 4 + 1] / w * 0.5 + 0.5) * RH;
    sp[i * 3 + 2] = w;                        // the eye distance along the view axis: a fine depth
  }
  let frag = 0, cov = 0, vis = 0;
  for (let k = 1; k + 1 < n; k++) {
    const ax = sp[0], ay = sp[1], az = sp[2];
    const bx = sp[k * 3], by = sp[k * 3 + 1], bz = sp[k * 3 + 2];
    const cx = sp[(k + 1) * 3], cy = sp[(k + 1) * 3 + 1], cz = sp[(k + 1) * 3 + 2];
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (area === 0) continue;
    const inv = 1 / area;
    let x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
    let x1 = Math.min(RW - 1, Math.ceil(Math.max(ax, bx, cx)));
    let y0 = Math.max(0, Math.floor(Math.min(ay, by, cy)));
    let y1 = Math.min(RH - 1, Math.ceil(Math.max(ay, by, cy)));
    for (let y = y0; y <= y1; y++) {
      const py = y + 0.5, row = y * RW;
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5;
        let w0 = ((bx - ax) * (py - ay) - (by - ay) * (px - ax)) * inv;
        let w1 = ((cx - bx) * (py - by) - (cy - by) * (px - bx)) * inv;
        if (w0 < 0 || w1 < 0 || w0 + w1 > 1) continue;
        const w2 = 1 - w0 - w1;
        // w0 is the weight of c, w1 of a, w2 of b (edge functions)
        const z = w1 * az + w2 * bz + w0 * cz;
        const o = row + x;
        frag++;
        if (RPASS === 1) {
          if (z < RZ[o]) RZ[o] = z;
          if (!(RCOV[o] & bit)) { RCOV[o] |= bit; cov++; }
        } else if (RPASS === 3) { if (z < RZ[o]) RZ[o] = z; }
        else if (RPASS === 5 || RPASS === 6) { if (z <= RZ[o]) { RZ[o] = z; vis++; } }
        else if (z <= RZ[o] * 1.0005 + 1e-4) vis++;
      }
    }
  }
  return [frag, cov, vis];
}

// ---- the vertex replicas ----------------------------------------------------------------------
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// returns a function (vertexIndex, out[3]) -> local position for one instance, set up per instance
function propReplica(mesh, geo, mat) {
  const pos = geo.attributes.position.array;
  const uvA = geo.attributes.uv ? geo.attributes.uv.array : null;
  const dataA = geo.attributes.aData ? geo.attributes.aData.array : null;
  const cardA = geo.attributes.aCard ? geo.attributes.aCard.array : null;
  const u = mat.uniforms, D = mat.defines || {};
  const far = !!D.PC_FAR, oil = !!D.PC_OIL;
  const uLod = u.uLod.value, uLeafLod = u.uLeafLod ? u.uLeafLod.value : null;
  const inst = mesh.userData.inst ? mesh.userData.inst.array : null;
  const inst2 = mesh.userData.inst2 ? mesh.userData.inst2.array : null;
  const im = mesh.instanceMatrix.array;
  const camL = u.uCamLocal.value;
  const tap = far ? u.uFarTaper.value : null, trk = far ? u.uFarTrunk.value : null, drp = far ? u.uFarDrop.value : null;
  const st = { vis: 1, di: 0, keepK: 1, e: -1, leafOn: false, fsi: 0, m: null };
  return {
    dist() { return st.di; },
    setInstance(i) {
      const o = i * 16;
      const iox = im[o + 12], ioy = im[o + 13], ioz = im[o + 14];
      const dx = iox - camL.x, dy = ioy - camL.y, dz = ioz - camL.z;
      const di = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const sz = inst ? inst[i * 4 + 2] : 0.5;
      const j = 1 + (sz - 0.5) * uLod.z;
      const vis = (uLod.x * j <= di ? 1 : 0) * (1 - sstep(uLod.y * j * uLod.w, uLod.y * j, di));
      st.vis = vis; st.di = di; st.m = o;
      st.leafOn = false;
      if (oil && uLeafLod && uLeafLod.x > 0 && cardA) {
        const keep = clamp(Math.pow(uLeafLod.x / Math.max(di, 0.01), 1.2), uLeafLod.y, 1);
        st.keepK = Math.min(1 / Math.sqrt(keep), 2.4);
        st.e = (1 - keep) * 1.06 - 0.03;
        st.leafOn = true;
      }
      if (far && inst2) st.fsi = Math.round(inst2[i * 2]);
      return vis > 1e-6;
    },
    // local position (the chunk's own space) of vertex v of the current instance
    local(v, out) {
      const p3 = v * 3;
      let lx = pos[p3], ly = pos[p3 + 1], lz = pos[p3 + 2];
      const part = dataA ? dataA[v * 4 + 1] : 0;
      if (st.leafOn && part > 4.5 && part < 6.5) {
        const cx = cardA[p3], cy = cardA[p3 + 1], cz = cardA[p3 + 2];
        const k = sstep(st.e - 0.03, st.e + 0.03, dataA[v * 4 + 3]) * st.keepK;
        lx = cx + (lx - cx) * k; ly = cy + (ly - cy) * k; lz = cz + (lz - cz) * k;
      }
      if (far) {
        const fsi = st.fsi, crown = part >= 0.5 ? 1 : 0;
        if (oil) {
          if (part > 4.5) { const k = 1 - tap[fsi] * clamp((pos[p3 + 1] - 0.30) / 0.72, 0, 1); lx *= k; lz *= k; }
          else { const k = 1 - tap[fsi] * (uvA ? uvA[v * 2 + 1] : 0) * crown; lx *= k; lz *= k; }
        } else { const k = 1 - tap[fsi] * (uvA ? uvA[v * 2 + 1] : 0) * crown; lx *= k; lz *= k; }
        const tr = trk[fsi], dr = drp[fsi];
        const foot = crown * (1 - tr) * (1 - dr);
        const yb = ly < 0.66 ? 0.66 - (0.66 - ly) * 0.3 : ly;
        const rx = lx * 1.5, rz = lz * 1.5;
        const ry = (ly - 0.30) * 1.45 + ((yb - 0.566) * 2.23 - (ly - 0.30) * 1.45) * foot;
        const s0 = tr + (1 - tr) * crown, cw = crown * (1 - tr);
        lx = lx * s0 + (rx - lx * s0) * cw;
        ly = ly * s0 + (ry - ly * s0) * cw;
        lz = lz * s0 + (rz - lz * s0) * cw;
        ly -= dr * 0.97;
      }
      // wp = io + im3x3 * lp * vis   (the wind sway is left out: see the report)
      const o = st.m, vis = st.vis;
      out[0] = im[o + 12] + (im[o] * lx + im[o + 4] * ly + im[o + 8] * lz) * vis;
      out[1] = im[o + 13] + (im[o + 1] * lx + im[o + 5] * ly + im[o + 9] * lz) * vis;
      out[2] = im[o + 14] + (im[o + 2] * lx + im[o + 6] * ly + im[o + 10] * lz) * vis;
    },
  };
}

// the terrain's geomorph, replayed exactly
function terrainReplica(geo, mat) {
  const pos = geo.attributes.position.array, mo = geo.attributes.aMorph.array;
  const u = mat.uniforms, camL = u.uCamLocal.value, uM = u.uMorph.value;
  return {
    setInstance() { return true; },
    local(v, out) {
      const p3 = v * 3, x = pos[p3], y = pos[p3 + 1], z = pos[p3 + 2];
      const dx = x - camL.x, dy = y - camL.y, dz = z - camL.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const m = Math.max(clamp((d - uM.x) / (uM.y - uM.x), 0, 1), uM.z);
      out[0] = x + mo[p3] * m; out[1] = y + mo[p3 + 1] * m; out[2] = z + mo[p3 + 2] * m;
    },
  };
}

function plainReplica(geo) {
  const pos = geo.attributes.position.array;
  return { setInstance() { return true; }, local(v, out) { const p3 = v * 3; out[0] = pos[p3]; out[1] = pos[p3 + 1]; out[2] = pos[p3 + 2]; } };
}

// the near-ground strokes: the quad is built in the vertex shader from the instance attributes
function nearReplica(mesh, geo, mat) {
  const pos = geo.attributes.position.array;
  const iRoot = geo.attributes.iRoot.array, iAxis = geo.attributes.iAxis.array;
  const iPar = geo.attributes.iPar.array, iCol = geo.attributes.iCol.array, iExt = geo.attributes.iExt.array;
  const u = mat.uniforms, camL = u.uCamLocal.value, uN = u.uNear.value, uN2 = u.uNear2.value;
  const snowK = 1;         // uWx.z (snow cover) is 0 here
  const st = {};
  return {
    setInstance(i) {
      const rx = iRoot[i * 3], ry = iRoot[i * 3 + 1], rz = iRoot[i * 3 + 2];
      const tx = camL.x - rx, ty = camL.y - ry, tz = camL.z - rz;
      const di = Math.sqrt(tx * tx + ty * ty + tz * tz);
      const h = iPar[i * 4 + 2], kind = iPar[i * 4 + 1];
      const range = uN.x + (uN.y - uN.x) * ((h * 7.31) % 1);
      let vis = (1 - sstep(range * 0.72, range, di)) * sstep(0, 0.7, uN.z - iPar[i * 4 + 3]) * sstep(uN2.x, uN2.y, di);
      const broad = kind > 3.5, fan = broad && kind < 4.5, lying = kind > 5.5, dab = broad && !fan && !lying;
      const flick = kind > 1.5 && kind < 3.5;
      if (broad) vis *= kind > 4.5 ? (snowK >= 0.5 ? 1 : 0) * snowK : snowK;
      const len = iAxis[i * 4 + 3] * vis * (broad ? 1 : snowK);
      Object.assign(st, { i, rx, ry, rz, tx, ty, tz, di, h, kind, vis, len, broad, fan, lying, dab, flick,
        wPx: uN.w * di, grow: Math.min(1, vis * 3) });
      if (vis <= 1e-6) return false;
      // the stroke's own frame: ax, and sd across it toward the eye
      const ax = iAxis[i * 4], ay = iAxis[i * 4 + 1], az = iAxis[i * 4 + 2];
      const il = 1 / Math.max(di, 0.001);
      let sx = ay * (tz * il) - az * (ty * il), sy = az * (tx * il) - ax * (tz * il), sz = ax * (ty * il) - ay * (tx * il);
      const sl = Math.max(Math.hypot(sx, sy, sz), 0.05);
      st.ax = ax; st.ay = ay; st.az = az; st.sx = sx / sl; st.sy = sy / sl; st.sz = sz / sl;
      // a flat-lying touch has its own two tangents
      if (st.lying) {
        let t1x = ay * 0.4671 - az * 0.8271, t1y = az * 0.3126 - ax * 0.4671, t1z = ax * 0.8271 - ay * 0.3126;
        const t1l = Math.hypot(t1x, t1y, t1z) || 1; t1x /= t1l; t1y /= t1l; t1z /= t1l;
        const t2x = ay * t1z - az * t1y, t2y = az * t1x - ax * t1z, t2z = ax * t1y - ay * t1x;
        const c = Math.cos(iCol[i * 4 + 3]), s = Math.sin(iCol[i * 4 + 3]);
        st.dax = t1x * c + t2x * s; st.day = t1y * c + t2y * s; st.daz = t1z * c + t2z * s;
        st.dbx = ay * st.daz - az * st.day; st.dby = az * st.dax - ax * st.daz; st.dbz = ax * st.day - ay * st.dax;
      }
      return true;
    },
    local(v, out) {
      const i = st.i, p3 = v * 3;
      let t = pos[p3 + 1];
      const side = pos[p3];
      const wid0 = iPar[i * 4], curl = iCol[i * 4 + 3];
      let rx = 0, ry = 0, rz = 0;
      if (st.broad) {
        t = Math.min(1, t * 2);
        if (st.lying) {
          const A = Math.max(st.len, st.wPx * 1.2 * st.grow) * (t * 2 - 1);
          const B = side * Math.max(wid0, st.wPx * 0.9) * st.grow;
          rx = st.dax * A + st.dbx * B; ry = st.day * A + st.dby * B; rz = st.daz * A + st.dbz * B;
        } else if (st.dab) {
          const A = curl * (st.len / Math.max(iAxis[i * 4 + 3], 1e-4)) + Math.max(st.len, st.wPx * 1.3 * st.grow) * t;
          const B = side * Math.max(wid0, st.wPx * 1.3) * st.grow;
          rx = st.ax * A + st.sx * B; ry = st.ay * A + st.sy * B; rz = st.az * A + st.sz * B;
        } else {
          const A = st.len * t;
          const B = side * wid0 * (1 + 0.4 * t) * st.grow + curl * st.len * t * t;
          rx = st.ax * A + st.sx * B; ry = st.ay * A + st.sy * B; rz = st.az * A + st.sz * B;
        }
      } else {
        const prof = st.flick ? (t < 0.25 ? 0.40 : (t < 0.75 ? 1.0 : 0.0)) : (t < 0.25 ? 1.0 : (t < 0.75 ? st.kind : 0.0));
        const wid = Math.max(wid0 * (0.42 + 0.58 * sstep(2.0, 7.5, st.di)), st.wPx * (st.flick ? 1.7 : 2.3)) * prof;
        if (st.flick && t > 0.25 && t < 0.75) t = 0.34;
        const A = st.len * t, B = side * wid * st.grow + curl * st.len * t * t;
        rx = st.ax * A + st.sx * B; ry = st.ay * A + st.sy * B; rz = st.az * A + st.sz * B;
      }
      out[0] = st.rx + rx; out[1] = st.ry + ry; out[2] = st.rz + rz;
    },
  };
}

// ---- walking the scene ------------------------------------------------------------------------
const DBG = { n: 0 };
const fakeRenderer = { info: { render: { frame: 1 } }, capabilities: { isWebGL2: true }, getRenderTarget: () => null };

let NODEPTH = false;
const RASTER = ARG.raster === '1';
function measure(cam, label, pass) {
  if (RASTER) rasterReset(pass || 1);
  // what renderer.render() does before it walks the scene: every matrixWorld brought up to date
  scene.updateMatrixWorld(true);
  const vp = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  const e = vp.elements;
  const out = [0, 0, 0];
  const c0 = new Float64Array(4), c1 = new Float64Array(4), c2 = new Float64Array(4);
  const buckets = new Map();
  const bump = (k, f, tri, area, drawn) => {
    let b = buckets.get(k);
    if (!b) { b = { meshes: 0, instances: 0, tris: 0, area: 0, back: 0, out: 0, frag: 0, cov: 0, vis: 0, bit: 0 }; buckets.set(k, b); }
    b.meshes += f; b.instances += drawn; b.tris += tri; b.area += area.a; b.back += area.b; b.out += area.o;
    b.frag += area.frag || 0; b.cov += area.cov || 0; b.vis += area.vis || 0;
  };
  const cat = categorise();
  const meshes = [];
  scene.traverseVisible((o) => { if (o.isMesh) meshes.push(o); });
  if (pass === 5 || pass === 6) {
    // three r187 sorts the opaque list by renderOrder, then the MATERIAL's id, then z
    // (three.module.js painterSortStable, line 7839). Pass 6 puts a coarse distance band first,
    // which is what a front-to-back order would be.
    const zOf = new Map();
    const _v = new THREE.Vector3();
    for (const o of meshes) { _v.setFromMatrixPosition(o.matrixWorld).applyMatrix4(vp); zOf.set(o, _v.z); }
    // coarse distance bands: band i holds everything out to BAND0 * 2^i metres, so `nb` bands
    // cost at most nb material switches a category instead of one
    const nb = +(ARG.bands || 40), BAND0 = +(ARG.band0 || 25);
    const band = (o) => {
      const d = _v.setFromMatrixPosition(o.matrixWorld).length();
      if (nb >= 40) return Math.min(40, Math.floor(Math.log2(Math.max(1, d)) * 4));
      let i = 0;
      while (i < nb - 1 && d > BAND0 * Math.pow(2, i)) i++;
      return i;
    };
    if (pass === 6 && ARG.vb === '1') console.log('  (pass 6: ' + nb + ' bands, first at ' + BAND0 + ' m)');
    meshes.sort((a, b) => {
      if (pass === 6) {
        const ra = a.renderOrder || 0, rb = b.renderOrder || 0;
        if (ra !== rb) return ra - rb;
        const ba = band(a), bb = band(b);
        if (ba !== bb) return ba - bb;
        // inside a band, three's own rule: group by material, then front to back
        if (nb < 40 && a.material.id !== b.material.id) return a.material.id - b.material.id;
      } else {
        const ra = a.renderOrder || 0, rb = b.renderOrder || 0;
        if (ra !== rb) return ra - rb;
        if (a.material.id !== b.material.id) return a.material.id - b.material.id;
      }
      const za = zOf.get(a), zb = zOf.get(b);
      if (za !== zb) return za - zb;
      return a.id - b.id;
    });
  }
  if (ARG.mats === '1' && pass === 1) {
    const seen = new Map();
    for (const o of meshes) { const k = (cat.get(o) || '?') + ' | ' + o.material.name + ' id=' + o.material.id; seen.set(k, (seen.get(k) || 0) + 1); }
    console.log('  materials in view:');
    for (const [k, n] of [...seen.entries()].sort()) console.log('    ' + n + ' x  ' + k);
  }
  const bitOf = new Map();
  let nextBit = 0;
  const bitFor = (k) => { if (!bitOf.has(k)) bitOf.set(k, nextBit < 31 ? (1 << nextBit++) : 0); return bitOf.get(k); };
  for (const mesh of meshes) {
    const geo = mesh.geometry, mat = mesh.material;
    if (!geo || !mat || !geo.attributes.position) continue;
    if (mesh.onBeforeRender) { try { mesh.onBeforeRender(fakeRenderer, scene, cam, geo, mat); } catch (err) { console.error('onBeforeRender failed on ' + (mesh.name || mat.name) + ': ' + err.message); } }
    let key = cat.get(mesh) || ('other:' + (mesh.name || mat.name || 'mesh'));
    if (ARG.detail === '1' && key === 'ground') key = 'ground L' + (mesh.userData.pcLevel != null ? mesh.userData.pcLevel : '?');
    if (ARG.skipother === '1' && key.startsWith('other')) continue;
    // instances
    const isIM = !!mesh.isInstancedMesh;
    let nInst = 1;
    if (isIM) nInst = mesh.count;
    else if (geo.isInstancedBufferGeometry) nInst = geo.instanceCount === Infinity ? 1 : geo.instanceCount;
    if (nInst <= 0) continue;
    // draw range over the index
    const idx = geo.index ? geo.index.array : null;
    const nAll = idx ? idx.length : geo.attributes.position.count;
    const dr = geo.drawRange;
    const start = dr.start | 0;
    const count = dr.count === Infinity || dr.count == null || dr.count > nAll - start ? nAll - start : dr.count;
    if (count < 3) continue;
    // which replica
    let rep;
    const nm = mat.name || '';
    if (geo.attributes.aMorph && mat.uniforms && mat.uniforms.uMorph) rep = terrainReplica(geo, mat);
    else if (geo.attributes.iRoot) rep = nearReplica(mesh, geo, mat);
    else if (geo.attributes.aData && mat.uniforms && mat.uniforms.uLod) rep = propReplica(mesh, geo, mat);
    else rep = plainReplica(geo);
    const m = mesh.matrixWorld.elements;
    // world -> clip, folded together
    const M = new Float64Array(16);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += e[k * 4 + r] * m[c * 4 + k];
      M[c * 4 + r] = s;
    }
    const twoSided = mat.side === THREE.DoubleSide;
    const backOnly = mat.side === THREE.BackSide;
    const acc = { a: 0, b: 0, o: 0, frag: 0, cov: 0, vis: 0 };
    const BIT = RASTER ? bitFor(key) : 0;
    RCUR = key;
    const SKIRT0 = (key === 'ground' || key.startsWith('ground L')) ? 33 * 33 : 0;
    const skirtAcc = { a: 0, b: 0, n: 0 };
    let drawn = 0, tris = 0;
    const toClip = (p, o) => {
      o[0] = M[0] * p[0] + M[4] * p[1] + M[8] * p[2] + M[12];
      o[1] = M[1] * p[0] + M[5] * p[1] + M[9] * p[2] + M[13];
      o[2] = M[2] * p[0] + M[6] * p[1] + M[10] * p[2] + M[14];
      o[3] = M[3] * p[0] + M[7] * p[1] + M[11] * p[2] + M[15];
    };
    const v0 = new Float64Array(3), v1 = new Float64Array(3), v2 = new Float64Array(3);
    for (let i = 0; i < nInst; i++) {
      if (!rep.setInstance(i)) continue;
      drawn++;
      for (let t = start; t + 2 < start + count; t += 3) {
        const a = idx ? idx[t] : t, b = idx ? idx[t + 1] : t + 1, c = idx ? idx[t + 2] : t + 2;
        rep.local(a, v0); rep.local(b, v1); rep.local(c, v2);
        toClip(v0, c0); toClip(v1, c1); toClip(v2, c2);
        tris++;
        const s = triPixels(c0, c1, c2);
        if (SKIRT0 && (a >= SKIRT0 || b >= SKIRT0 || c >= SKIRT0)) { if (s > 0) skirtAcc.a += s; else skirtAcc.b += -s; skirtAcc.n++; continue; }
        if (s === 0) { acc.o++; continue; }
        let drawnTri = true;
        if (s > 0) { if (backOnly) { acc.b += s; drawnTri = false; } else acc.a += s; }
        else if (twoSided || backOnly) acc.a += -s;
        else { acc.b += -s; drawnTri = false; }
        if (RASTER && drawnTri && LAST_N >= 3) { const r = rasterPoly(LAST_N, BIT); acc.frag += r[0]; acc.cov += r[1]; acc.vis += r[2]; }
      }
    }
    if (ARG.dbg && key.indexOf(ARG.dbg) >= 0 && DBG.n < 6) {
      DBG.n++;
      console.log('  dbg ' + key + ' mesh=' + (mesh.name || mat.name) + ' nInst=' + nInst + ' drawn=' + drawn + ' tris=' + tris + ' area=' + acc.a.toFixed(1) + ' back=' + acc.b.toFixed(1) + ' out=' + acc.o
        + ' side=' + mat.side + ' matWorld=' + [m[12].toFixed(1), m[13].toFixed(1), m[14].toFixed(1)].join(','));
      // the first instance that is drawn, its three vertices in clip space
      for (let i = 0; i < nInst && i < 400; i++) {
        if (!rep.setInstance(i)) continue;
        const aa = idx ? idx[start] : start, bb = idx ? idx[start + 1] : start + 1, cc = idx ? idx[start + 2] : start + 2;
        rep.local(aa, v0); rep.local(bb, v1); rep.local(cc, v2);
        console.log('    inst ' + i + ' local ' + [...v0].map((x) => x.toFixed(3)).join(',') + ' | ' + [...v1].map((x) => x.toFixed(3)).join(','));
        toClip(v0, c0); toClip(v1, c1); toClip(v2, c2);
        console.log('      clip w=' + c0[3].toFixed(2) + ' ndc ' + (c0[0] / c0[3]).toFixed(3) + ',' + (c0[1] / c0[3]).toFixed(3)
          + '  /  ' + (c1[0] / c1[3]).toFixed(3) + ',' + (c1[1] / c1[3]).toFixed(3) + '  /  ' + (c2[0] / c2[3]).toFixed(3) + ',' + (c2[1] / c2[3]).toFixed(3)
          + '  px=' + triPixels(c0, c1, c2).toFixed(2));
        break;
      }
    }
    bump(key, 1, tris - skirtAcc.n, acc, drawn);
    if (skirtAcc.n) bump('ground skirts', 0, skirtAcc.n, { a: skirtAcc.a, b: skirtAcc.b, o: 0 }, 0);
  }
  return { label, buckets };
}

// ---- one thing at a time ----------------------------------------------------------------------
// The overlap INSIDE one plant, as against plant behind plant: each instance is drawn alone into a
// cleared buffer, and its own shaded area compared with the pixels it covers.
function alone(cam, want, maxInst) {
  scene.updateMatrixWorld(true);
  const vp = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  const e = vp.elements;
  const cat = categorise();
  const meshes = [];
  scene.traverseVisible((o) => { if (o.isMesh && cat.get(o) === want) meshes.push(o); });
  // the mesh with the most instances in view
  let totalInst = 0;
  for (const mm of meshes) totalInst += mm.count || 0;
  const stride = Math.max(1, Math.floor(totalInst / (maxInst * 2)));
  const out = [];
  for (const mesh of meshes) {
    const geo = mesh.geometry, mat = mesh.material;
    if (mesh.onBeforeRender) mesh.onBeforeRender(fakeRenderer, scene, cam, geo, mat);
    const idx = geo.index ? geo.index.array : null;
    const nAll = idx ? idx.length : geo.attributes.position.count;
    const dr = geo.drawRange, start = dr.start | 0;
    const count = dr.count === Infinity || dr.count == null || dr.count > nAll - start ? nAll - start : dr.count;
    const rep = geo.attributes.aData && mat.uniforms && mat.uniforms.uLod ? propReplica(mesh, geo, mat) : null;
    if (!rep) continue;
    const m = mesh.matrixWorld.elements;
    const M = new Float64Array(16);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { let t = 0; for (let k = 0; k < 4; k++) t += e[k * 4 + r] * m[c * 4 + k]; M[c * 4 + r] = t; }
    const twoSided = mat.side === THREE.DoubleSide;
    const v0 = new Float64Array(3), v1 = new Float64Array(3), v2 = new Float64Array(3);
    const c0 = new Float64Array(4), c1 = new Float64Array(4), c2 = new Float64Array(4);
    const toClip = (p, o) => {
      o[0] = M[0] * p[0] + M[4] * p[1] + M[8] * p[2] + M[12]; o[1] = M[1] * p[0] + M[5] * p[1] + M[9] * p[2] + M[13];
      o[2] = M[2] * p[0] + M[6] * p[1] + M[10] * p[2] + M[14]; o[3] = M[3] * p[0] + M[7] * p[1] + M[11] * p[2] + M[15];
    };
    for (let i = 0; i < mesh.count && out.length < maxInst; i += stride) {
      if (!rep.setInstance(i)) continue;
      rasterReset(1); RCUR = want;
      let area = 0, frag = 0, cov = 0, tri = 0;
      for (let t = start; t + 2 < start + count; t += 3) {
        const a = idx ? idx[t] : t, b = idx ? idx[t + 1] : t + 1, c = idx ? idx[t + 2] : t + 2;
        rep.local(a, v0); rep.local(b, v1); rep.local(c, v2);
        toClip(v0, c0); toClip(v1, c1); toClip(v2, c2);
        const sv = triPixels(c0, c1, c2);
        if (sv === 0) continue;
        if (sv < 0 && !twoSided) continue;
        area += Math.abs(sv); tri++;
        if (LAST_N >= 3) { const r = rasterPoly(LAST_N, 1); frag += r[0]; cov += r[1]; }
      }
      if (cov > 4) out.push({ tri, area, frag, cov, d: Math.round(rep.dist()) });
    }
    if (out.length >= maxInst) break;
  }
  if (!out.length) { console.log('  (nothing of ' + want + ' alone)'); return; }
  const n = out.length;
  const sum = (f) => out.reduce((a, b) => a + f(b), 0);
  console.log('  ' + want + ', one at a time (' + n + ' of them, each drawn alone): mean ' + (sum((o) => o.tri) / n).toFixed(0)
    + ' triangles, covers ' + (sum((o) => o.cov) / n).toFixed(0) + ' px, shades ' + (sum((o) => o.frag) / n).toFixed(0)
    + ' px -> overlap inside one plant x' + (sum((o) => o.frag) / sum((o) => o.cov)).toFixed(2)
    + '; at least 4 fragment runs a triangle -> ' + (sum((o) => o.tri) * 4 / n).toFixed(0) + ' px-equivalent of quad overhead'
    + '; distances ' + Math.min(...out.map((o) => o.d)) + ' to ' + Math.max(...out.map((o) => o.d)) + ' m');
}

// ---- which mesh is what -----------------------------------------------------------------------
function categorise() {
  const cat = new Map();
  const fl = world._flora;
  if (fl) {
    for (const ch of fl.treeChunks.values()) for (const g of (ch.groups || [])) if (g.mesh) cat.set(g.mesh, g.tierKey === '0' ? 'trees near (full)' : 'trees mid');
    for (const ch of fl.farChunks.values()) for (const g of (ch.groups || [])) if (g.mesh) cat.set(g.mesh, 'trees far');
    for (const map of [fl.underChunks, fl.under2Chunks]) for (const ch of map.values()) for (const m of (ch.meshes || [])) if (!cat.has(m)) cat.set(m, 'undergrowth / small plants');
  }
  const nr = world._near;
  if (nr && nr.mesh) nr.mesh.traverse((o) => { if (o.isMesh) cat.set(o, ARG.rings === '1' ? 'near strokes: ' + (o.name || '').replace('near-', '').replace('-earth', '') : 'near-ground strokes'); });
  scene.traverse((o) => {
    if (!o.isMesh || cat.has(o)) return;
    const n = o.material && o.material.name || '';
    if (n.indexOf('pc-terrain') === 0 || (o.geometry.attributes.aMorph && o.geometry.attributes.aColor)) cat.set(o, 'ground');
    else if (n.indexOf('pc-water') === 0 || o.geometry.attributes.aLiq) cat.set(o, 'water');
  });
  return cat;
}

// ---- report -----------------------------------------------------------------------------------
function report(r) {
  const rows = [...r.buckets.entries()].sort((a, b) => b[1].area - a[1].area);
  let tot = 0, totTri = 0, back = 0;
  console.log('\n=== ' + r.label + ' ===');
  console.log('viewport ' + VW.toFixed(0) + ' x ' + VH.toFixed(0) + ' = ' + (PIX / 1e6).toFixed(3) + ' Mpixel, fov ' + FOV + ' deg vertical, aspect ' + ASPECT.toFixed(4));
  console.log('what'.padEnd(30) + 'meshes'.padStart(7) + 'inst'.padStart(9) + 'triangles'.padStart(12) + 'front px'.padStart(16) + 'overdraw'.padStart(10) + 'culled px'.padStart(14)
    + (RASTER ? 'rast frag'.padStart(13) + 'covers px'.padStart(12) + 'self-lap'.padStart(10) + 'on top'.padStart(11) : '')
    + (ARG.gz === '1' ? 'infrontGnd'.padStart(14) : ''));
  for (const [k, b] of rows) {
    tot += b.area; totTri += b.tris; back += b.back;
    console.log(k.padEnd(30) + String(b.meshes).padStart(7) + String(b.instances).padStart(9) + String(b.tris).padStart(12)
      + b.area.toFixed(0).padStart(16) + (b.area / PIX).toFixed(3).padStart(10) + b.back.toFixed(0).padStart(14)
      + (RASTER ? String(b.frag).padStart(13) + String(b.cov).padStart(12) + (b.cov ? (b.frag / b.cov).toFixed(2) : '-').padStart(10) + String(b.vis).padStart(11) : '')
      + (ARG.gz === '1' ? String(b.gz == null ? '-' : b.gz).padStart(14) : ''));
  }
  console.log('-'.repeat(98));
  console.log('TOTAL'.padEnd(30) + ''.padStart(7) + ''.padStart(9) + String(totTri).padStart(12) + tot.toFixed(0).padStart(16) + (tot / PIX).toFixed(3).padStart(10) + back.toFixed(0).padStart(14));
  return { tot, rows };
}

function run(cam, label) {
  const r1 = measure(cam, label, 1);
  if (RASTER) {
    const r2 = measure(cam, label, 2);
    for (const [k, b] of r1.buckets) { const o = r2.buckets.get(k); if (o) b.vis = o.vis; }
    if (ARG.gz === '1') {
      measure(cam, label, 3);                     // depth of the ground and the water alone
      const r4 = measure(cam, label, 4);          // what of each category lies in front of it
      for (const [k, b] of r1.buckets) { const o = r4.buckets.get(k); if (o) b.gz = o.vis; }
    }
  }
  if (RASTER && ARG.ez === '1') {
    const a = measure(cam, label, 5), b = measure(cam, label, 6);
    let t5 = 0, t6 = 0, tAll = 0;
    console.log('\n  early-Z, simulated at ' + RW + 'x' + RH + ' (opaque, depth-writing geometry: the picture is the same whatever the order)');
    console.log('  ' + 'what'.padEnd(30) + 'all fragments'.padStart(15) + "three's order".padStart(15) + 'front to back'.padStart(15));
    for (const [k, bb] of [...r1.buckets.entries()].sort((x, y) => y[1].frag - x[1].frag)) {
      const f5 = a.buckets.get(k), f6 = b.buckets.get(k);
      if (!bb.frag) continue;
      t5 += f5 ? f5.vis : 0; t6 += f6 ? f6.vis : 0; tAll += bb.frag;
      console.log('  ' + k.padEnd(30) + String(bb.frag).padStart(15) + String(f5 ? f5.vis : '-').padStart(15) + String(f6 ? f6.vis : '-').padStart(15));
    }
    console.log('  ' + 'TOTAL'.padEnd(30) + String(tAll).padStart(15) + String(t5).padStart(15) + String(t6).padStart(15));
    console.log('  ' + 'as a share of the screen'.padEnd(30) + (tAll / PIX).toFixed(2).padStart(15) + (t5 / PIX).toFixed(2).padStart(15) + (t6 / PIX).toFixed(2).padStart(15));
  }
  const r = report(r1);
  if (ARG.alone) { console.log(''); for (const k of ARG.alone.split('|')) alone(cam, k, 40); }
  return r;
}

// ---- the experiments (runtime only: no file in the repository is touched) ----------------------
// nearlod=k   : the full and middle trees keep every leaf only within k times the distance they do now
// farlod=d0,kmin : the far trees are given the leaf-by-distance rule the near ones already have
function applyExperiments() {
  const fl = world._flora;
  if (!fl) return;
  if (ARG.nearlod) {
    const k = +ARG.nearlod;
    for (const ch of fl.treeChunks.values()) for (const g of (ch.groups || [])) {
      if (!g.mesh || !g.mesh.userData.leafLod) continue;
      const L = g.mesh.userData.leafLod;
      if (!L.pcTouched) { g.mesh.userData.leafLod = Object.assign([L[0] * k, L[1]], { pcTouched: 1 }); }
    }
    console.log('# experiment: near/mid leafLod distance x ' + k);
  }
  if (ARG.farlod) {
    const [d0, kmin] = ARG.farlod.split(',').map(Number);
    let n = 0;
    for (const ch of fl.farChunks.values()) for (const g of (ch.groups || [])) {
      if (!g.mesh) continue;
      const geo = g.mesh.geometry;
      if (!geo.userData.leaf) { if (!geo.attributes.aData || !geo.index) continue; sortLeafCards(geo); }
      if (!geo.userData.leaf) continue;
      g.mesh.userData.leafLod = [d0, kmin];
      n++;
    }
    console.log('# experiment: far trees given leafLod [' + d0 + ', ' + kmin + '] on ' + n + ' meshes');
  }
}

// ---- the two views ----------------------------------------------------------------------------
function tiers(tag) {
  const fl = world._flora;
  if (!fl) return;
  console.log('# ' + tag + ': treeScale ' + fl.treeScale.toFixed(3) + ', farScale ' + fl.farScale.toFixed(3)
    + ' -> full trees to ' + (90 * fl.treeScale).toFixed(0) + ' m, middle to ' + (190 * fl.treeScale).toFixed(0)
    + ' m, far to ' + (420 * fl.farScale).toFixed(0) + ' m then one in three to ' + (600 * fl.farScale).toFixed(0) + ' m');
}
function setNearPixel() {
  const nr = world._near;
  if (nr && nr.rings) for (const ring of nr.rings) ring.material.uniforms.uNear.value.w = NEAR_PIXEL;
}

const where = ARG.where || 'autumn';
const spawn = world.getSpawn('earth');
const stands = {
  autumn: world.findBiome('earth', 'autumn_woodland'),
  spawn,
};
const stand0 = stands[where] || stands.autumn;
const yaw = stand0.yaw != null ? stand0.yaw : 0;
console.log('# oil look on, powers on, QUALITY.level = ' + QUALITY.level + ', SCREEN ' + SCREEN.outW + 'x' + SCREEN.outH);
console.log('# stand: ' + where + '  unitDir ' + JSON.stringify(stand0.unitDir) + '  yaw ' + ((yaw * 180) / Math.PI).toFixed(1) + ' deg');
console.log('# one pixel at 1 m = ' + NEAR_PIXEL.toExponential(3) + ' (the painter\'s own number for ' + H + ' lines at fov ' + FOV + ')');

world.setBuildBudget(400);
world.setWeather({ cloud: 0.15, haze: 1 });
world.setTime('earth', 15.4);

// on foot
let up = stand(where === 'spawn' ? 'earth' : 'earth', stand0.unitDir, 1.62);
let n = settle('earth', 20000);
console.log('# settled on foot in ' + n + ' world updates, busy = ' + world.busy + ', stats ' + JSON.stringify(world.getStats()));
setNearPixel();
applyExperiments();
tiers('on foot');
let cam = makeCamera(up, yaw, 0);
run(cam, 'ON FOOT, eye 1.62 m, level, ' + where);

// from the air
up = stand('earth', stand0.unitDir, 150);
n = settle('earth', 20000);
console.log('\n# settled at 150 m in ' + n + ' world updates, busy = ' + world.busy + ', stats ' + JSON.stringify(world.getStats()));
setNearPixel();
applyExperiments();
tiers('at 150 m');
cam = makeCamera(up, yaw, -30);
run(cam, 'FROM THE AIR, 150 m, 30 deg down, ' + where);
