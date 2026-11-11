// Painted Cosmos physics: draw kits. OWNER: PHYSICS. The ONLY part of src/physics that imports
// three (COORDINATOR, section E): geometry, attribute layout and per-frame updates for what the
// physics simulates. The look is PAINTER's: every kit takes a material factory and never
// assumes a built-in material. PAINTER may replace any kit with its own.
//
//   const kits = createPhysicsKits(physics, { makeMaterial });      // or one kit at a time
//   // every frame, after physics.update and after the body roots are placed:
//   kits.update(bodyRoot, camera, viewportHeightPx);   // bodyRoot: the root Object3D of physics.here.bodyId;
//                                                      // the height in pixels you render at (for least sizes)
//
// makeMaterial(kind, info) -> THREE.Material
//   kind: 'rain' | 'snow' | 'hail' | 'dust' | 'sand' | 'ash' | 'spores' | 'leaves' | 'spray' |
//         'ring' | 'mark' | 'water'
//   info: { shape: 'streak' | 'dab' | 'ring' | 'mark' | 'surface', attributes: [...names],
//           draw (the DRAW entry in use), uniforms (gpu mode: uniform objects to put in your
//           material), chunk (gpu mode: the GLSL to paste) }
// Every object is a THREE.Mesh of triangles with `position` and `uv` (and `color` or `normal`
// where info.attributes says so): makeWashMaterial from src/render/index.js works as it is.
//
// Coordinates (C3): each object sits at its buffer's origin, a body-local point, as a child of
// the body root; vertices are relative to it in body-local axes. Nothing here knows about the
// scene origin, so nothing swims when it shifts or the planet turns.
// Depth (C7): the kits write no depth of their own; the material does (include three's
// logdepthbuf chunks in a ShaderMaterial, as everywhere else).
import * as THREE from 'three';
import { PARTICLES } from '../particles.js';
import { DRAW, makeEye, expandStreaks, expandDabs, expandShades, expandMarks, expandRings, expandWater, quadIndices, quadUvs, gridIndices } from './expand.js';
import { PARTICLE_GLSL } from './chunks.glsl.js';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();

// The eye in body-local coordinates: position, picture-plane axes, velocity (from its own
// motion between calls on the physics clock; teleports are ignored).
function trackEye(T, physics, bodyRoot, camera) {
  bodyRoot.updateWorldMatrix(true, false); camera.updateWorldMatrix(true, false);
  _m.copy(bodyRoot.matrixWorld).invert();
  _v.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(_m);
  const t = physics.time, dt = t - T.t;
  if (T.body === bodyRoot && dt > 1e-4 && dt < 0.5) {
    const k = Math.min(1, dt / 0.15);                                  // a little smoothing: frame times jitter
    const vx = (_v.x - T.x) / dt, vy = (_v.y - T.y) / dt, vz = (_v.z - T.z) / dt;
    if (Math.hypot(vx, vy, vz) < 400) { T.vx += (vx - T.vx) * k; T.vy += (vy - T.vy) * k; T.vz += (vz - T.vz) * k; }
  } else if (T.body !== bodyRoot || dt >= 0.5 || dt < 0) { T.vx = T.vy = T.vz = 0; }
  if (dt !== 0) { T.x = _v.x; T.y = _v.y; T.z = _v.z; T.t = t; }
  T.body = bodyRoot;
  // picture-plane axes: the camera's X and Y, turned into the body's frame
  bodyRoot.getWorldQuaternion(_q).invert(); camera.getWorldQuaternion(_q2); _q.multiply(_q2);
  _v.set(1, 0, 0).applyQuaternion(_q); T.rx = _v.x; T.ry = _v.y; T.rz = _v.z;
  _v.set(0, 1, 0).applyQuaternion(_q); T.ux = _v.x; T.uy = _v.y; T.uz = _v.z;
  return T;
}
const makeTrack = () => ({ body: null, t: -1e9, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 1, ry: 0, rz: 0, ux: 0, uy: 1, uz: 0 });

function adopt(obj, bodyRoot) { if (obj.parent !== bodyRoot) bodyRoot.add(obj); }
function dyn(arr, size) { const a = new THREE.BufferAttribute(arr, size); a.setUsage(THREE.DynamicDrawUsage); return a; }
function send(attr, count) { attr.clearUpdateRanges(); if (count > 0) attr.addUpdateRange(0, count); attr.needsUpdate = true; }

// ---- rain, snow and the loose kinds, plus the rings their impacts leave -----------------------
// options: makeMaterial (required); kinds (default: all nine); rings (default true);
//   draw: { <kind>: { ...overrides of DRAW[kind] } };
//   expand: 'cpu' (default: quads built here; any material) | 'gpu' (instanced straight from
//           the physics buffers, zero copies; your material must paste PARTICLE_GLSL and take
//           info.uniforms; see chunks.glsl.js)
export function createWeatherKit(physics, { makeMaterial, kinds = PARTICLES.kinds, rings = true, draw = {}, expand = 'cpu' } = {}) {
  if (typeof makeMaterial !== 'function') throw new Error('createWeatherKit: makeMaterial(kind, info) is required');
  const gpu = expand === 'gpu';
  const eye = makeEye(), track = makeTrack();
  const U = gpu ? { uPcEye: { value: new THREE.Vector3() }, uPcEyeVel: { value: new THREE.Vector3() }, uPcRight: { value: new THREE.Vector3(1, 0, 0) }, uPcUp: { value: new THREE.Vector3(0, 1, 0) }, uPcFocus: { value: new THREE.Vector4() } } : null;
  const parts = [];
  for (const kind of kinds) {
    const buf = physics.particles[kind];
    if (!buf) continue;
    const D = { ...DRAW[kind], ...(draw[kind] || {}) };
    const cap = buf.capacity || buf.pos.length / 3;
    let geo, posA = null, colA = null, uniforms = null;
    if (gpu) {
      geo = new THREE.InstancedBufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(quadUvs(1), 2));
      geo.setIndex(new THREE.BufferAttribute(quadIndices(1), 1));
      // the physics arrays themselves: nothing is copied, three uploads them as they are
      for (const [name, arr, size] of [['aPcPos', buf.pos, 3], ['aPcVel', buf.vel, 3], ['aPcSize', buf.size, 1], ['aPcAge', buf.age, 1]]) {
        const a = new THREE.InstancedBufferAttribute(arr, size); a.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(name, a);
      }
      uniforms = { ...U, uPcPixel: { value: new THREE.Vector2(0, D.minPx || 0) }, uPcDraw: { value: new THREE.Vector4(D.shape === 'streak' ? D.width : D.size, D.shape === 'streak' ? D.exposure : D.grow, D.shape === 'streak' ? D.min : D.spin, D.fadeIn) } };
    } else {
      geo = new THREE.BufferGeometry();
      posA = dyn(new Float32Array(cap * 12), 3);
      geo.setAttribute('position', posA);
      geo.setAttribute('uv', new THREE.BufferAttribute(quadUvs(cap), 2));
      if (D.vary > 0) { colA = dyn(new Float32Array(cap * 12).fill(1), 3); geo.setAttribute('color', colA); }
      geo.setIndex(new THREE.BufferAttribute(quadIndices(cap), 1));
      geo.setDrawRange(0, 0);
    }
    const info = { shape: D.shape, draw: D, attributes: gpu ? ['position', 'uv', 'aPcPos', 'aPcVel', 'aPcSize', 'aPcAge'] : (colA ? ['position', 'uv', 'color'] : ['position', 'uv']), uniforms, chunk: gpu ? PARTICLE_GLSL : null };
    const mesh = new THREE.Mesh(geo, makeMaterial(kind, info));
    mesh.name = 'pc-physics-' + kind; mesh.frustumCulled = false; mesh.visible = false; mesh.matrixAutoUpdate = true;
    parts.push({ kind, buf, D, mesh, geo, posA, colA, cap, uniforms, drawn: 0 });
  }
  // rings
  let ring = null;
  if (rings) {
    const E = physics.particles.events, cap = E.capacity;
    const geo = new THREE.BufferGeometry();
    const posA = dyn(new Float32Array(cap * 12), 3), dataA = dyn(new Float32Array(cap * 16), 4);
    geo.setAttribute('position', posA); geo.setAttribute('uv', new THREE.BufferAttribute(quadUvs(cap), 2)); geo.setAttribute('aPcRing', dataA);
    geo.setIndex(new THREE.BufferAttribute(quadIndices(cap), 1)); geo.setDrawRange(0, 0);
    const mesh = new THREE.Mesh(geo, makeMaterial('ring', { shape: 'ring', attributes: ['position', 'uv', 'aPcRing'], draw: null, uniforms: null, chunk: null }));
    mesh.name = 'pc-physics-ring'; mesh.frustumCulled = false; mesh.visible = false;
    ring = { E, mesh, geo, posA, dataA, cap, drawn: 0 };
  }
  const objects = parts.map((p) => p.mesh); if (ring) objects.push(ring.mesh);
  const stats = { ms: 0, drawCalls: 0, vertices: 0, triangles: 0, particles: 0 };
  return {
    objects, stats, eye,
    // bodyRoot: root Object3D of the body the physics is active on; camera: the scene camera;
    // viewportHeight: pixels (default 720).
    update(bodyRoot, camera, viewportHeight = 720) {
      const t0 = now();
      stats.drawCalls = 0; stats.vertices = 0; stats.triangles = 0; stats.particles = 0;
      const active = physics.here.bodyId != null && bodyRoot;
      if (!active) { for (const o of objects) o.visible = false; stats.ms = now() - t0; return; }
      trackEye(track, physics, bodyRoot, camera);
      // metres per pixel at one metre: 2 tan(fov / 2) / height = 2 / (P[1][1] height)
      const pix = 2 / (Math.abs(camera.projectionMatrix.elements[5]) * viewportHeight || 1e9);
      const F = physics.focus;
      for (const P of parts) {
        const b = P.buf, n = Math.min(b.count, P.cap);
        P.mesh.visible = n > 0; P.drawn = n;
        if (!n) continue;
        adopt(P.mesh, bodyRoot);
        const O = b.origin; P.mesh.position.set(O.x, O.y, O.z);
        // the eye relative to this buffer's origin
        eye.x = track.x - O.x; eye.y = track.y - O.y; eye.z = track.z - O.z;
        eye.vx = track.vx; eye.vy = track.vy; eye.vz = track.vz;
        eye.rx = track.rx; eye.ry = track.ry; eye.rz = track.rz; eye.ux = track.ux; eye.uy = track.uy; eye.uz = track.uz;
        eye.fx = F.x - O.x; eye.fy = F.y - O.y; eye.fz = F.z - O.z; eye.radius = PARTICLES.radius; eye.pix = pix;
        if (gpu) {
          U.uPcEye.value.set(eye.x, eye.y, eye.z); U.uPcEyeVel.value.set(eye.vx, eye.vy, eye.vz);
          U.uPcRight.value.set(eye.rx, eye.ry, eye.rz); U.uPcUp.value.set(eye.ux, eye.uy, eye.uz);
          U.uPcFocus.value.set(eye.fx, eye.fy, eye.fz, eye.radius); P.uniforms.uPcPixel.value.x = pix;
          P.geo.instanceCount = n;
          send(P.geo.attributes.aPcPos, n * 3); send(P.geo.attributes.aPcVel, n * 3); send(P.geo.attributes.aPcSize, n); send(P.geo.attributes.aPcAge, n);
        } else {
          if (P.D.shape === 'streak') expandStreaks(b, P.D, eye, P.posA.array); else expandDabs(b, P.D, eye, P.posA.array);
          send(P.posA, n * 12);
          if (P.colA) { expandShades(b, P.D.vary, P.colA.array); send(P.colA, n * 12); }
          P.geo.setDrawRange(0, n * 6);
        }
        stats.drawCalls++; stats.vertices += n * 4; stats.triangles += n * 2; stats.particles += n;
      }
      if (ring) {
        const O = ring.E.origin;
        const n = expandRings(ring.E, physics.fields.frame, physics.time, 0.012, ring.posA.array, ring.dataA.array);
        ring.mesh.visible = n > 0; ring.drawn = n;
        if (n) {
          adopt(ring.mesh, bodyRoot); ring.mesh.position.set(O.x, O.y, O.z);
          send(ring.posA, n * 12); send(ring.dataA, n * 16); ring.geo.setDrawRange(0, n * 6);
          stats.drawCalls++; stats.vertices += n * 4; stats.triangles += n * 2;
        }
      }
      stats.ms = now() - t0;
    },
    drawn(kind) { if (kind === 'ring') return ring ? ring.drawn : 0; const p = parts.find((x) => x.kind === kind); return p ? p.drawn : 0; },
    dispose() { for (const o of objects) { o.removeFromParent(); o.geometry.dispose(); } },
  };
}

// ---- marks in the ground: footprints, gear pads, scour dishes -----------------------------------
// One quad per live mark, laid on the ground the near field knows (within 16 m of the focus)
// and in the mark's own tangent plane beyond. Rebuilt when a mark is added, when the frame
// re-anchors, and a few times a second so that fading and filling show.
// Attributes: position, uv (u across, v along the mark's direction), color (grey: darker where
// deeper and fresher; for stand-ins), aPcMark (depth m, rim m, kind as in MARK, fade 0..1).
// Give the material a polygon offset (or depthWrite: false): the quads lie `lift` above the ground.
export function createMarksKit(physics, { makeMaterial, lift = 0.015, refresh = 0.25 } = {}) {
  if (typeof makeMaterial !== 'function') throw new Error('createMarksKit: makeMaterial(kind, info) is required');
  const M = physics.fields.deform.marks, cap = M.capacity;
  const geo = new THREE.BufferGeometry();
  const posA = dyn(new Float32Array(cap * 12), 3), colA = dyn(new Float32Array(cap * 12).fill(1), 3), dataA = dyn(new Float32Array(cap * 16), 4);
  geo.setAttribute('position', posA); geo.setAttribute('uv', new THREE.BufferAttribute(quadUvs(cap), 2));
  geo.setAttribute('color', colA); geo.setAttribute('aPcMark', dataA);
  geo.setIndex(new THREE.BufferAttribute(quadIndices(cap), 1)); geo.setDrawRange(0, 0);
  const mesh = new THREE.Mesh(geo, makeMaterial('mark', { shape: 'mark', attributes: ['position', 'uv', 'color', 'aPcMark'], draw: null, uniforms: null, chunk: null }));
  mesh.name = 'pc-physics-marks'; mesh.frustumCulled = false; mesh.visible = false;
  const near = physics.fields.near, heightAt = (x, z) => near.heightAt(x, z, NaN);
  const stats = { ms: 0, drawCalls: 0, vertices: 0, triangles: 0, marks: 0, rebuilt: false };
  let seenTotal = -1, seenVersion = -1, seenT = -1e9, n = 0;
  return {
    objects: [mesh], stats,
    update(bodyRoot) {
      const t0 = now();
      stats.rebuilt = false;
      if (physics.here.bodyId == null || !bodyRoot) { mesh.visible = false; stats.drawCalls = 0; stats.vertices = 0; stats.triangles = 0; stats.ms = now() - t0; return; }
      const frame = physics.fields.frame, t = physics.time;
      if (M.total !== seenTotal || frame.version !== seenVersion || Math.abs(t - seenT) >= refresh) {
        seenTotal = M.total; seenVersion = frame.version; seenT = t;
        n = expandMarks(M, frame, heightAt, t, lift, posA.array, dataA.array, colA.array);
        send(posA, n * 12); send(colA, n * 12); send(dataA, n * 16); geo.setDrawRange(0, n * 6);
        stats.rebuilt = true;
      }
      mesh.visible = n > 0;
      if (n) { adopt(mesh, bodyRoot); mesh.position.set(M.origin.x, M.origin.y, M.origin.z); }
      stats.marks = n; stats.drawCalls = n ? 1 : 0; stats.vertices = n * 4; stats.triangles = n * 2;
      stats.ms = now() - t0;
    },
    dispose() { mesh.removeFromParent(); geo.dispose(); },
  };
}

// ---- the liquid surface near the focus ------------------------------------------------------------
// A square of (N+1)^2 vertices, `step` metres apart, that follows the focus in whole steps and
// rides the physics' waves (the same three trains the explorer floats on). Attributes:
// position, normal, uv (0..1 across the square).
// PAINTER already draws liquid everywhere with its own patches; the better wiring there is to
// paste physics.glsl.water into that material (see docs/notes/physics.md). This kit is for the
// lab, for a near-field patch over a hole in the far water, and as the reference of what the
// chunk computes.
export function createWaterKit(physics, { makeMaterial, N = 40, step = 1.5 } = {}) {
  if (typeof makeMaterial !== 'function') throw new Error('createWaterKit: makeMaterial(kind, info) is required');
  const nv = (N + 1) * (N + 1);
  const geo = new THREE.BufferGeometry();
  const posA = dyn(new Float32Array(nv * 3), 3), nrmA = dyn(new Float32Array(nv * 3), 3);
  const uv = new Float32Array(nv * 2);
  for (let j = 0, k = 0; j <= N; j++) for (let i = 0; i <= N; i++, k += 2) { uv[k] = i / N; uv[k + 1] = j / N; }
  geo.setAttribute('position', posA); geo.setAttribute('normal', nrmA); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(gridIndices(N), 1));
  const mesh = new THREE.Mesh(geo, makeMaterial('water', { shape: 'surface', attributes: ['position', 'normal', 'uv'], draw: null, uniforms: null, chunk: physics.glsl.water }));
  mesh.name = 'pc-physics-water'; mesh.frustumCulled = false; mesh.visible = false;
  const stats = { ms: 0, drawCalls: 0, vertices: 0, triangles: 0 };
  return {
    objects: [mesh], stats,
    update(bodyRoot) {
      const t0 = now();
      const W = physics.fields.water.field, frame = physics.fields.frame;
      const on = physics.here.bodyId != null && bodyRoot && W.present;
      mesh.visible = !!on;
      if (on) {
        const F = physics.focus;
        expandWater(W, frame, frame.lx(F.x, F.y, F.z), frame.lz(F.x, F.y, F.z), N, step, posA.array, nrmA.array);
        posA.needsUpdate = true; nrmA.needsUpdate = true;
        adopt(mesh, bodyRoot); mesh.position.set(frame.ox, frame.oy, frame.oz);
      }
      stats.drawCalls = on ? 1 : 0; stats.vertices = on ? nv : 0; stats.triangles = on ? N * N * 2 : 0;
      stats.ms = now() - t0;
    },
    dispose() { mesh.removeFromParent(); geo.dispose(); },
  };
}

// ---- all of them ------------------------------------------------------------------------------------
// options: makeMaterial (required), weather / marks / water: options for each kit, or false to
// leave one out.
export function createPhysicsKits(physics, { makeMaterial, weather = {}, marks = {}, water = {} } = {}) {
  const kits = {};
  if (weather) kits.weather = createWeatherKit(physics, { makeMaterial, ...weather });
  if (marks) kits.marks = createMarksKit(physics, { makeMaterial, ...marks });
  if (water) kits.water = createWaterKit(physics, { makeMaterial, ...water });
  const list = Object.values(kits);
  const stats = { ms: 0, drawCalls: 0, vertices: 0, triangles: 0 };
  return {
    ...kits, stats,
    objects: list.flatMap((k) => k.objects),
    update(bodyRoot, camera, viewportHeight) {
      stats.ms = 0; stats.drawCalls = 0; stats.vertices = 0; stats.triangles = 0;
      for (const k of list) { k.update(bodyRoot, camera, viewportHeight); stats.ms += k.stats.ms; stats.drawCalls += k.stats.drawCalls; stats.vertices += k.stats.vertices; stats.triangles += k.stats.triangles; }
    },
    dispose() { for (const k of list) k.dispose(); },
  };
}
