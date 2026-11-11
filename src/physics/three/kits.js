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
//   info: { shape: 'streak' | 'dab' | 'ring' | 'mark' | 'surface',
//           vertexChunk   GLSL for the vertex stage (PAINTER's material contract): declares what
//                         it needs and defines
//                           vec3 pcKitPosition()   the vertex, in the mesh's own coordinates
//                                                  (body-local axes, metres, relative to the mesh,
//                                                  which sits at a body-local point): multiply by
//                                                  modelViewMatrix as for any mesh
//                         and sets three varyings:  vec2 vPcUv, vec4 vPcData (see `data` below),
//                         float vPcMat: the ground the thing came from or was pressed into, as
//                         an index into physics.data.MATERIAL_IDS (round it: floor(vPcMat + 0.5)),
//                         255 = not from the ground. Kicked dust, blown sand, spray and marks
//                         carry it, so the ink can be that ground's own colour; everything else
//                         says 255 (declare the varying in the fragment only if you read it)
//           data          what vPcData holds for this kind (a sentence)
//           uniforms      uniform objects the chunk needs ({} for the cpu kits): put them in
//                         your material's `uniforms`; the kit keeps their values current
//           attributes    the attribute names the mesh carries
//           region        a suggestion for the region id class of PAINTER's second target
//           draw          the DRAW entry in use (sizes, exposure) }
// Every object is a THREE.Mesh of triangles with `position` and `uv` (and `color` or `normal`
// where info.attributes says so). Nothing needs blending: particles fade by shrinking, and
// the shapes inside a quad are cut with `discard`. A material that ignores the chunk and just
// uses `position` (makeWashMaterial from src/render/index.js) also works with the cpu kits.
// Budget (PILOT): all kits together are at most 12 draw calls and, with every buffer full at
// the highest quality, 31 k triangles; they set no render order (the draw order is PAINTER's).
//
// Coordinates (C3): each object sits at its buffer's origin, a body-local point, as a child of
// the body root; vertices are relative to it in body-local axes. Nothing here knows about the
// scene origin, so nothing swims when it shifts or the planet turns.
// Depth (C7): the kits write no depth of their own; the material does (include three's
// logdepthbuf chunks in a ShaderMaterial, as everywhere else).
import * as THREE from 'three';
import { PARTICLES } from '../particles.js';
import { DRAW, makeEye, expandStreaks, expandDabs, dabSize, expandShades, expandMats, expandMarks, expandRings, expandWater, quadIndices, quadUvs, gridIndices } from './expand.js';
import { PARTICLE_GLSL } from './chunks.glsl.js';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// ---- the vertex chunks of the material contract ----------------------------------------------------
const VARYINGS = 'varying vec2 vPcUv;\nvarying vec4 vPcData;\nvarying float vPcMat;\n';
// (three declares `color` itself when material.vertexColors is set)
const COLOR_ATTR = '#if !defined(USE_COLOR) && !defined(USE_COLOR_ALPHA)\nattribute vec3 color;\n#endif\n';
// the material a thing came from: a byte per vertex where the kind can come from the ground, else 255
const MAT_ATTR = 'attribute float aPcMat;\n', matOf = (inked) => (inked ? 'aPcMat' : '255.0');
const chunkPlain = (data, inked) => `${VARYINGS}${inked ? MAT_ATTR : ''}vec3 pcKitPosition() { vPcUv = uv; vPcData = ${data}; vPcMat = ${matOf(inked)}; return position; }\n`;
const chunkShaded = (inked) => `${VARYINGS}${COLOR_ATTR}${inked ? MAT_ATTR : ''}vec3 pcKitPosition() { vPcUv = uv; vPcData = vec4(color.r, 0.0, 0.0, 0.0); vPcMat = ${matOf(inked)}; return position; }\n`;
const chunkData = (name, inked) => `${VARYINGS}attribute vec4 ${name};\n${inked ? MAT_ATTR : ''}vec3 pcKitPosition() { vPcUv = uv; vPcData = ${name}; vPcMat = ${matOf(inked)}; return position; }\n`;
const chunkGpu = (shape, vary) => `${PARTICLE_GLSL}${VARYINGS}vec3 pcKitPosition() { vPcUv = uv; vPcData = vec4(pcPhysShade(${vary.toFixed(3)}), aPcAge, aPcSize, length(aPcVel)); vPcMat = aPcMat; return ${shape === 'streak' ? 'pcPhysStreak' : 'pcPhysDab'}(position.xy); }\n`;
// the kinds that are raised from the ground (their particles carry its material; the others never do)
export const INKED = Object.freeze({ dust: true, sand: true, spray: true });
const REGION = { rain: 2.6, hail: 2.6, spray: 2.7, snow: 2.5, dust: 1.6, sand: 1.6, ash: 1.7, spores: 4.6, leaves: 4.5, ring: 2.8, mark: 1.5, water: 2.0 };
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
  const U = gpu ? { uPcEye: { value: new THREE.Vector3() }, uPcEyeVel: { value: new THREE.Vector3() }, uPcRight: { value: new THREE.Vector3(1, 0, 0) }, uPcUp: { value: new THREE.Vector3(0, 1, 0) }, uPcFocus: { value: new THREE.Vector4() },
    uPcEast: { value: new THREE.Vector3(1, 0, 0) }, uPcNorth: { value: new THREE.Vector3(0, 0, -1) }, uPcShelter: { value: new THREE.Vector4() } } : null;
  eye.shelters = new Float32Array(16);
  const parts = [];
  for (const kind of kinds) {
    const buf = physics.particles[kind];
    if (!buf) continue;
    const D = { ...DRAW[kind], ...(draw[kind] || {}) };
    const cap = buf.capacity || buf.pos.length / 3;
    let geo, posA = null, colA = null, matA = null, uniforms = null;
    const inked = !!INKED[kind] && !!buf.mat;
    if (gpu) {
      geo = new THREE.InstancedBufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(quadUvs(1), 2));
      geo.setIndex(new THREE.BufferAttribute(quadIndices(1), 1));
      // the physics arrays themselves: nothing is copied, three uploads them as they are
      for (const [name, arr, size] of [['aPcPos', buf.pos, 3], ['aPcVel', buf.vel, 3], ['aPcSize', buf.size, 1], ['aPcAge', buf.age, 1], ['aPcMat', buf.mat || new Uint8Array(cap).fill(255), 1]]) {
        const a = new THREE.InstancedBufferAttribute(arr, size); a.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(name, a);
      }
      uniforms = { ...U, uPcPixel: { value: new THREE.Vector4(0, D.minPx || 0, D.maxPx || 0, D.shape === 'dab' ? D.varySize || 0 : 0) }, uPcSmear: { value: 2 * (D.smear != null ? D.smear : 2) }, uPcDraw: { value: new THREE.Vector4(D.shape === 'streak' ? D.width : D.size, D.shape === 'streak' ? D.exposure : D.grow, D.shape === 'streak' ? D.min : D.spin, D.fadeIn) },
        uPcDraw2: { value: new THREE.Vector4(D.shape === 'dab' && !D.spin ? D.exposure || 0 : 0, D.share > 0 && D.share < 1 ? D.share : 1, 1, D.shape === 'dab' ? D.cell || 0 : 0) } };
    } else {
      geo = new THREE.BufferGeometry();
      posA = dyn(new Float32Array(cap * 12), 3);
      geo.setAttribute('position', posA);
      geo.setAttribute('uv', new THREE.BufferAttribute(quadUvs(cap), 2));
      if (D.vary > 0) { colA = dyn(new Float32Array(cap * 12).fill(1), 3); geo.setAttribute('color', colA); }
      if (inked) { matA = dyn(new Uint8Array(cap * 4).fill(255), 1); geo.setAttribute('aPcMat', matA); }
      geo.setIndex(new THREE.BufferAttribute(quadIndices(cap), 1));
      geo.setDrawRange(0, 0);
    }
    const info = { shape: D.shape, draw: D, region: REGION[kind],
      attributes: gpu ? ['position', 'uv', 'aPcPos', 'aPcVel', 'aPcSize', 'aPcAge', 'aPcMat'] : ['position', 'uv'].concat(colA ? ['color'] : [], matA ? ['aPcMat'] : []),
      uniforms: uniforms || {}, inked: gpu || inked,
      vertexChunk: gpu ? chunkGpu(D.shape, D.vary || 0) : (colA ? chunkShaded(inked) : chunkPlain('vec4(1.0, 0.0, 0.0, 0.0)', inked)),
      data: gpu ? 'x: shade 1 - vary .. 1 (stays with the particle), y: age (s), z: grain size (m), w: speed (m/s)' : 'x: shade 1 - vary .. 1 (stays with the particle); y, z, w: 0',
      chunk: gpu ? PARTICLE_GLSL : null };
    const mesh = new THREE.Mesh(geo, makeMaterial(kind, info));
    mesh.name = 'pc-physics-' + kind; mesh.frustumCulled = false; mesh.visible = false; mesh.matrixAutoUpdate = true;
    parts.push({ kind, buf, D, mesh, geo, posA, colA, matA, cap, uniforms, drawn: 0, size: 0 });
  }
  // rings
  let ring = null;
  if (rings) {
    const E = physics.particles.events, cap = E.capacity;
    const geo = new THREE.BufferGeometry();
    const posA = dyn(new Float32Array(cap * 12), 3), dataA = dyn(new Float32Array(cap * 16), 4);
    geo.setAttribute('position', posA); geo.setAttribute('uv', new THREE.BufferAttribute(quadUvs(cap), 2)); geo.setAttribute('aPcRing', dataA);
    geo.setIndex(new THREE.BufferAttribute(quadIndices(cap), 1)); geo.setDrawRange(0, 0);
    const mesh = new THREE.Mesh(geo, makeMaterial('ring', { shape: 'ring', attributes: ['position', 'uv', 'aPcRing'], draw: null, uniforms: {}, region: REGION.ring, chunk: null, inked: false,
      vertexChunk: chunkData('aPcRing', false), data: 'x: kind (0 splash, 1 ripple, 2 settle, 3 bounce), y: strength 0..1, z: age 0..1, w: drop size (m)' }));
    mesh.name = 'pc-physics-ring'; mesh.frustumCulled = false; mesh.visible = false;
    ring = { E, mesh, geo, posA, dataA, cap, drawn: 0 };
  }
  const objects = parts.map((p) => p.mesh); if (ring) objects.push(ring.mesh);
  // cover: per kind, the share of what the physics says the kind hides of the view that its marks
  // paint (1 = all of it). What is missing is haze, and haze is the sky's to paint.
  const stats = { ms: 0, drawCalls: 0, vertices: 0, triangles: 0, particles: 0, cover: {}, size: {} };
  const _c = { cover: 1 };
  // the air a kind is spread through (m3): what falls fills the whole box, dust hugs the ground
  const BOX = 4 * PARTICLES.radius * PARTICLES.radius;
  const AIR = { snow: BOX * (PARTICLES.height + PARTICLES.below), rain: BOX * (PARTICLES.height + PARTICLES.below), dust: BOX * 8 };
  function hiding(kind, wx) {
    const p = wx.precipitation;
    if (kind === 'dust') return wx.dustExtinction || 0;
    if (kind === 'snow') return p && p.frozen01 > 0.5 ? p.extinction || 0 : 0;
    if (kind === 'rain') return p && !(p.frozen01 > 0.5) ? p.extinction || 0 : 0;
    return 0;
  }
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
      const F = physics.focus, fr = physics.fields.frame;
      // the local horizontal axes, and the hull (for kinds shown modulo a cell round the eye)
      eye.ex = fr.ex; eye.ey = fr.ey; eye.ez = fr.ez; eye.nx = fr.nx; eye.ny = fr.ny; eye.nz = fr.nz;
      { const S = physics.particles.system, ns = S.shelterCount || 0, ge = fr.lx(track.x, track.y, track.z), gn = fr.lz(track.x, track.y, track.z), gu = Math.hypot(track.x, track.y, track.z) - fr.r0;
        for (let k = 0; k < ns; k++) { const a = k * 4; eye.shelters[a] = S.shelters[a] - ge; eye.shelters[a + 1] = S.shelters[a + 1] - gn; eye.shelters[a + 2] = S.shelters[a + 2] - gu; eye.shelters[a + 3] = S.shelters[a + 3]; }
        eye.shelterCount = ns;
        if (gpu) { U.uPcEast.value.set(fr.ex, fr.ey, fr.ez); U.uPcNorth.value.set(fr.nx, fr.ny, fr.nz); if (ns) U.uPcShelter.value.set(eye.shelters[0], eye.shelters[1], eye.shelters[2], eye.shelters[3]); else U.uPcShelter.value.set(0, 0, 0, 0); } }
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
        // how large a dab is now: its own size, or what the dust (snow) in the air needs to hide what it hides
        let size = P.D.size, room = 1;
        const ext = AIR[P.kind] ? hiding(P.kind, physics.here.weather) : 0;
        // (a kind shown modulo a cell is spread through the cell's air, not the whole box's)
        const air = (AIR[P.kind] || 1) * (P.D.cell > 0 ? Math.min(1, (P.D.cell * P.D.cell) / (PARTICLES.radius * PARTICLES.radius)) : 1);
        if (P.D.shape === 'dab') {
          size = dabSize(P.D, ext, n, air, _c);
          P.size += (size - P.size) * (P.size > 0 ? 0.05 : 1); size = P.size;                 // (eased: the count jitters)
          if (ext > 0) { stats.cover[P.kind] = _c.cover; room = 1 / Math.max(_c.cover, 1e-3); } else delete stats.cover[P.kind];
          stats.size[P.kind] = size;
        } else if (ext > 0) {
          // a streak inks about half its quad (it tapers); its length is its fall during the exposure
          const c = Math.min(1, n * P.D.width * Math.max(P.D.min || 0, (b.fallSpeed || 6) * P.D.exposure) * 0.5 * (P.D.share || 1) / (ext * air));
          stats.cover[P.kind] = c; room = 1 / Math.max(c, 1e-3);
        } else delete stats.cover[P.kind];
        if (gpu) {
          if (P.D.shape === 'dab') P.uniforms.uPcDraw.value.x = size;
          P.uniforms.uPcDraw2.value.z = room;
          U.uPcEye.value.set(eye.x, eye.y, eye.z); U.uPcEyeVel.value.set(eye.vx, eye.vy, eye.vz);
          U.uPcRight.value.set(eye.rx, eye.ry, eye.rz); U.uPcUp.value.set(eye.ux, eye.uy, eye.uz);
          U.uPcFocus.value.set(eye.fx, eye.fy, eye.fz, eye.radius); P.uniforms.uPcPixel.value.x = pix;
          P.geo.instanceCount = n;
          send(P.geo.attributes.aPcPos, n * 3); send(P.geo.attributes.aPcVel, n * 3); send(P.geo.attributes.aPcSize, n); send(P.geo.attributes.aPcAge, n); send(P.geo.attributes.aPcMat, n);
        } else {
          if (P.D.shape === 'streak') expandStreaks(b, P.D, eye, P.posA.array, room); else expandDabs(b, P.D, eye, P.posA.array, size, room);
          send(P.posA, n * 12);
          if (P.colA) { expandShades(b, P.D.vary, P.colA.array); send(P.colA, n * 12); }
          if (P.matA) { expandMats(b, P.matA.array); send(P.matA, n * 4); }
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
// deeper and fresher; for stand-ins), aPcMark (depth m, rim m, kind as in MARK, fade 0..1),
// aPcMat (a byte: the material it was pressed into, an index into physics.data.MATERIAL_IDS).
// Give the material a polygon offset (or depthWrite: false): the quads lie `lift` above the ground.
export function createMarksKit(physics, { makeMaterial, lift = 0.015, refresh = 0.25 } = {}) {
  if (typeof makeMaterial !== 'function') throw new Error('createMarksKit: makeMaterial(kind, info) is required');
  const M = physics.fields.deform.marks, cap = M.capacity;
  const geo = new THREE.BufferGeometry();
  const posA = dyn(new Float32Array(cap * 12), 3), colA = dyn(new Float32Array(cap * 12).fill(1), 3), dataA = dyn(new Float32Array(cap * 16), 4), matA = dyn(new Uint8Array(cap * 4).fill(255), 1);
  geo.setAttribute('position', posA); geo.setAttribute('uv', new THREE.BufferAttribute(quadUvs(cap), 2));
  geo.setAttribute('color', colA); geo.setAttribute('aPcMark', dataA); geo.setAttribute('aPcMat', matA);
  geo.setIndex(new THREE.BufferAttribute(quadIndices(cap), 1)); geo.setDrawRange(0, 0);
  const mesh = new THREE.Mesh(geo, makeMaterial('mark', { shape: 'mark', attributes: ['position', 'uv', 'color', 'aPcMark', 'aPcMat'], draw: null, uniforms: {}, region: REGION.mark, chunk: null, inked: true,
    vertexChunk: chunkData('aPcMark', true), data: 'x: depth (m), y: rim height (m), z: kind (0, 1 feet; 2 gear pad; 4 scour dish), w: fade 1..0 over its life' }));
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
        n = expandMarks(M, frame, heightAt, t, lift, posA.array, dataA.array, colA.array, matA.array);
        send(posA, n * 12); send(colA, n * 12); send(dataA, n * 16); send(matA, n * 4); geo.setDrawRange(0, n * 6);
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
// NOT the way to draw the sea in the game: PAINTER draws liquid everywhere with its own
// patches, and the delivery for those is the chunk (physics.glsl.water: height, slope, crest
// direction, crests, foam, surf) with its uniforms. This kit is for the debug lab and as the
// reference of what the chunk computes.
export function createWaterKit(physics, { makeMaterial, N = 40, step = 1.5 } = {}) {
  if (typeof makeMaterial !== 'function') throw new Error('createWaterKit: makeMaterial(kind, info) is required');
  const nv = (N + 1) * (N + 1);
  const geo = new THREE.BufferGeometry();
  const posA = dyn(new Float32Array(nv * 3), 3), nrmA = dyn(new Float32Array(nv * 3), 3);
  const uv = new Float32Array(nv * 2);
  for (let j = 0, k = 0; j <= N; j++) for (let i = 0; i <= N; i++, k += 2) { uv[k] = i / N; uv[k + 1] = j / N; }
  geo.setAttribute('position', posA); geo.setAttribute('normal', nrmA); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(gridIndices(N), 1));
  const mesh = new THREE.Mesh(geo, makeMaterial('water', { shape: 'surface', attributes: ['position', 'normal', 'uv'], draw: null, uniforms: {}, region: REGION.water, chunk: physics.glsl.water, inked: false,
    vertexChunk: chunkPlain('vec4(normal, 0.0)', false), data: 'xyz: the surface normal (body-local axes, unit); the mesh also carries `normal`' }));
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
// options: makeMaterial (required), weather / marks: options for each kit, or false to leave
// one out. water: off unless asked for ({} or options): the sea belongs in PAINTER's own
// liquid material through the wave chunk (physics.glsl.water); a second surface laid over
// PAINTER's fights it (docs/notes/physics.md, "The sea").
export function createPhysicsKits(physics, { makeMaterial, weather = {}, marks = {}, water = false } = {}) {
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
