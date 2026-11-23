// Painted Cosmos: which animals are near, in which drawing, and the instance buffers that carry them.
// OWNER: PAINTER.
//
// Nothing here is loaded unless MODE.beasts is on: the world imports this file dynamically behind the flag,
// exactly as no module of the powers is loaded without ?powers=1. With the flag off the live watercolour
// game does not fetch a byte of it.
//
// WHAT THIS FILE IS FOR, and why it is shaped the way it is.
//
// THE DRAW CALL IS THE WHOLE BILL. The owner's phone measured 0.107 ms a draw call (3 ms in 28 far-tree
// meshes, the v27 table) and its frame is 13.6 ms of the 16.7 it has. So this file's first duty is to keep
// the number of meshes DOWN, and it does it the way the far trees already do (materials.js:2402-2414):
//   * ONE mesh for each species that has an animal in the NEAR field. Its geometry is the full one, and the
//     coat is dropped for the whole mesh by setDrawRange when the nearest of them is far enough off that a
//     4 cm stroke is under a pixel -- the same trick flora.js:371 uses for leaves, and it costs nothing.
//   * ONE mesh for EVERY far walker on the world, whatever its species: one geometry at a median shape, the
//     species chosen per instance out of a uniform table (aSpec.x), the size by the instance's own scale.
// So the bill is (species with an animal within about 50 m) + 1. In a wood that is 3 to 6 draws, 0.3 to
// 0.6 ms on the owner's phone -- against the 8 to 12 draws a mesh-per-species-per-tier would have cost.
// This is a DISAGREEMENT with the design's three tiers of mesh, taken after reading the draw-call number
// the design itself says is the only thing that matters. Said plainly so the coordinator can judge it.
//
// THE HAND-OVER IS IN PIXELS, NEVER IN METRES. The painter's own notes record that the trees' first ranges
// were set in metres and were wrong on the phone, whose picture is a third the height of a desktop's. So
// every range here is worked out from the animal's height on the picture the game is ACTUALLY drawing
// (beastkit.js distanceForPixels, from SCREEN.outH and the camera's own field).
//
// NOTHING IS ALLOCATED AFTER THE FIRST FRAME. The buffers are made once at their cap and written in place,
// PHYSICS' particles' own discipline. One pass over the agents, no Vector3, no Matrix4, no closures.
import * as THREE from 'three';
import { QUALITY, SCREEN } from '../render/shared.js';
import { mulberry32 } from './noise.js';
import { BEAST_ATTRS, SHAPES, beastGeometry, beastFarGeometry, beastPlan, planUniforms, speciesUniforms, distanceForPixels, FAR_SHAPE } from './beastkit.js';
// one source for the state codes and the shape rows: the routines and the material read them from here too
export { STATE, SHAPES, MAX_PARTS, MAX_SPECIES, BEAST_ATTRS } from './beastkit.js';

// ---- the switches, read once from the address, so the owner can be shown A and B of the same still ------
const Q = typeof location !== 'undefined' && location.search ? new URLSearchParams(location.search) : null;
const num = (k, d, lo, hi) => { const v = Q ? +Q.get(k) : NaN; return isFinite(v) && v >= lo && v <= hi ? v : d; };
// HOW TALL AN ANIMAL MUST BE ON THE PICTURE to keep its own mesh -- which is to say its own proportions,
// its own markings and its coat. Below it, it joins the one far mesh and is drawn on a MEDIAN body scaled
// to its own height, which is honest only once proportion has stopped reading. 12 px: a deer's own body
// then reaches 89 m on a 1080-line picture and 40 m on the phone's 480, which is about where the design's
// own ladder put the hand-over (45 m near, 180 m middle). Raise it and the draw calls fall and a fox at
// 30 m is drawn on the median body; lower it and the near meshes carry more animals and more triangles.
const NEAR_PX = num('beastpx', 12, 4, 200);
// below this it stops being drawn at all. 1.1 px: the design's own arithmetic says a 1.5 m animal is 1.1 px
// at 600 m on the phone and 0.4 px at a mile, and a mark under a pixel is the sparkle the look forbids.
const CULL_PX = num('beastcullpx', 1.6, 0.4, 20);
// THE COAT IS DROPPED for a whole mesh once its nearest animal is shorter than this on the picture. A coat
// stroke is about 7.5 per cent of the body, so at 20 px an animal's stroke is 1.5 px -- the last size at
// which a flat stroke is a stroke and not a speck. On a 1080-line picture that is 54 m for a deer.
const COAT_PX = num('beastcoatpx', 20, 6, 400);
const COAT_ON = !(Q && Q.get('beastcoat') === '0');            // ?beastcoat=0: the same animals with no coat
const ALL_NEAR = Q && Q.get('beastlod') === 'near';            // ?beastlod=near: every animal in the near mesh
const CAP_NEAR = num('beastcap', 32, 1, 256);                  // instances a species may have in the near mesh
const CAP_FAR = num('beastfarcap', 320, 1, 2048);
const WASH_T = 0.55;                                           // seconds an animal takes to wash in (flora.js' own)
const ORIGIN_STEP = 64;                                        // metres the eye moves before the instances' origin follows

export const BEAST_SWITCHES = { NEAR_PX, CULL_PX, COAT_PX, COAT_ON, ALL_NEAR, CAP_NEAR, CAP_FAR };

// ---- the crowd ---------------------------------------------------------------------------------------
export class Beasts {
  // opts:
  //   group        an Object3D the meshes are added to (the world's own, so it is hidden and freed with it)
  //   species      the rows, in the order the routines use: names out of SHAPES, or rows of the same shape
  //   makeMaterial (kind, info) -> ShaderMaterial. kind is 'near' or 'far'. info carries everything the
  //                material needs and nothing it does not: see _material below. REQUIRED, and injected
  //                rather than imported so that this file does not fall over if the material is not there
  //                yet -- and so the gallery can paint the same geometry in a plain material to look at it.
  //   fov          the camera's vertical field in degrees (the game's own: 58 on foot)
  //   budgetOne    build at most one species' geometry a frame (the world's 5 ms slice: world/index.js:118)
  constructor(opts = {}) {
    this.group = opts.group || new THREE.Group();
    if (typeof opts.makeMaterial !== 'function') throw new Error('Beasts: makeMaterial is required (src/render/beastmat.js makeBeastMaterial)');
    this.makeMaterial = opts.makeMaterial;
    this.fov = opts.fov || 58;
    this.rows = (opts.species || ['deer', 'fox', 'hare', 'badger']).map((s) => (typeof s === 'string' ? SHAPES[s] : s));
    this.names = (opts.species || []).map((s) => (typeof s === 'string' ? s : s.name || '?'));
    this.capNear = opts.capNear || CAP_NEAR;
    this.capFar = opts.capFar || CAP_FAR;
    this.budgetOne = opts.budgetOne !== false;
    this.sp = this.rows.map(() => null);          // one entry a species, built when it is first wanted
    this.far = null;
    this.origin = new THREE.Vector3();
    this.clock = 0;
    this.table = speciesUniforms(this.rows);      // the washes and proportions the far material reads
    this.prof = { near: 0, far: 0, draws: 0, over: 0, built: 0, ms: 0 };
    // the hand-over distances, one a species, worked out from the picture: filled by _ranges
    this.dNear = new Float32Array(this.rows.length);
    this.dCull = new Float32Array(this.rows.length);
    this.dCoat = new Float32Array(this.rows.length);
    // WHICH SPECIES HAS A BODY YET. beastkit.js builds ONE body plan, the walker; a row whose `plan` says
    // bird or fish would be built as a four-legged animal, which is worse than not drawing it. Its routines
    // still run (it lives, it is hunted, it is counted), it simply is not painted until its plan is cut.
    // Coordinator, 2026-11-23, wiring stage one: the heron and the trout are in this case.
    this.drawable = this.rows.map((r) => !r || !r.plan || r.plan === 'walker');
    this._lastH = -1; this._lastQ = -1;
    this._counts = new Int32Array(this.rows.length);
    this._nearest = new Float32Array(this.rows.length);
  }

  // How far each species hands over, in metres, from its own height on the picture the game is drawing.
  // Re-worked only when the picture changes size, not every frame.
  _ranges() {
    if (SCREEN.outH === this._lastH && QUALITY.level === this._lastQ) return;
    this._lastH = SCREEN.outH; this._lastQ = QUALITY.level;
    for (let i = 0; i < this.rows.length; i++) {
      if (!this.drawable[i]) { this.dNear[i] = 0; this.dCull[i] = 0; this.dCoat[i] = 0; continue; }
      const h = this.rows[i].high;
      this.dNear[i] = ALL_NEAR ? 1e6 : distanceForPixels(h, NEAR_PX, SCREEN.outH, this.fov);
      this.dCull[i] = distanceForPixels(h, CULL_PX, SCREEN.outH, this.fov);
      // the coat's own stroke is about 7.5 per cent of the body; it is dropped when IT is under a pixel
      this.dCoat[i] = COAT_ON ? distanceForPixels(h, COAT_PX, SCREEN.outH, this.fov) : 0;
    }
  }

  // ---- the meshes ------------------------------------------------------------------------------------
  _instanced(geo, mat, cap, far) {
    const g = new THREE.BufferGeometry();
    for (const k of BEAST_ATTRS) if (geo.attributes[k]) g.setAttribute(k, geo.attributes[k]);
    g.setIndex(geo.index);
    g.boundingSphere = geo.boundingSphere ? geo.boundingSphere.clone() : null;
    const mesh = new THREE.InstancedMesh(g, mat, cap);
    mesh.count = 0;
    mesh.visible = false;        // a mesh built this frame has nothing in it until the next one
    mesh.frustumCulled = true;
    mesh.matrixAutoUpdate = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const add = (name, w) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * w), w); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(name, a); return a; };
    const inst = add('aInst', 4), gait = add('aGait', 4), spec = add('aSpec', 4);
    // the far mesh carries every walker on the world, so its bounds are the whole far field; a near mesh's
    // are its own hand-over distance. Set here and kept up to date in update().
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1);
    const self = this;
    mesh.onBeforeRender = function (renderer, scene, camera, geometry, material) {
      const u = material.uniforms; if (!u) return;
      if (u.uOrigin) u.uOrigin.value.copy(self.origin);
      // a new animal washes in rather than popping; its own birth is in aGait.w (flora.js' uWashIn)
      if (u.uWashIn) u.uWashIn.value.set(self.clock, 0, WASH_T);
      if (u.uTime) u.uTime.value = self.clock;
      material.uniformsNeedUpdate = true;
    };
    mesh.userData.inst = inst; mesh.userData.gait = gait; mesh.userData.spec = spec;
    mesh.userData.far = !!far;
    mesh.renderOrder = far ? 8 : 0;      // the far animals after the near ones: most of their paint is covered
    this.group.add(mesh);
    return mesh;
  }

  // Build one species' near mesh. Called at most once a frame (the world's shared 5 ms slice).
  ensure(i) {
    if (this.sp[i]) return false;
    const row = this.rows[i], plan = beastPlan(row);
    const geo = beastGeometry(row, (i + 1) * 7919, 0, { coat: COAT_ON ? undefined : 0 });
    const mat = this.makeMaterial('near', {
      plan, uniforms: planUniforms(plan), geometry: geo, species: i, row,
      scale: geo.userData.scale, parts: plan.count, table: this.table, washWeights: false,
    });
    const mesh = this._instanced(geo, mat, this.capNear, false);
    mesh.userData.coatStart = geo.userData.coatStart;
    mesh.userData.indexCount = geo.userData.indexCount;
    this.sp[i] = { geo, mat, mesh, row, plan, h: row.high, reach: row.high * 0.6 + row.len * 0.7 };
    this.prof.built++;
    return true;
  }

  ensureFar() {
    if (this.far) return false;
    const geo = beastFarGeometry(7);
    const plan = beastPlan(FAR_SHAPE);
    const mat = this.makeMaterial('far', {
      plan, uniforms: planUniforms(plan), geometry: geo, species: -1, row: FAR_SHAPE,
      scale: geo.userData.scale, parts: plan.count, table: this.table, washWeights: true,
      unitHeight: geo.userData.unitHeight,
    });
    const mesh = this._instanced(geo, mat, this.capFar, true);
    this.far = { geo, mat, mesh, plan };
    this.prof.built++;
    return true;
  }

  // ---- the frame -------------------------------------------------------------------------------------
  // agents: the routines' struct-of-arrays (src/physics/fauna.js). The contract is in the report and at the
  // head of _write below; every array is read, none is written.
  update(dt, camLocal, agents, now) {
    const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    this.clock = now == null ? this.clock + Math.min(0.1, Math.max(0, dt || 0)) : now;
    this._ranges();
    this.prof.near = 0; this.prof.far = 0; this.prof.over = 0; this.prof.draws = 0;
    if (!this.far) this.ensureFar();
    if (!agents || !agents.n) { this._hideAll(); this.prof.ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0; return; }
    // the instances' origin follows the eye in steps, so a position written into a Float32Array keeps its
    // millimetres at four kilometres from the planet's centre (the engine's own habit: flora.js uOrigin)
    if (camLocal && this.origin.distanceToSquared(camLocal) > ORIGIN_STEP * ORIGIN_STEP) {
      this.origin.set(Math.round(camLocal.x / ORIGIN_STEP) * ORIGIN_STEP, Math.round(camLocal.y / ORIGIN_STEP) * ORIGIN_STEP, Math.round(camLocal.z / ORIGIN_STEP) * ORIGIN_STEP);
    }
    this._write(camLocal, agents);
    this.prof.ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
  }

  _hideAll() {
    for (const s of this.sp) if (s) { s.mesh.count = 0; s.mesh.visible = false; }
    if (this.far) { this.far.mesh.count = 0; this.far.mesh.visible = false; }
  }

  // THE CONTRACT WITH THE ROUTINES (src/physics/fauna.js). A struct of arrays, every one read and none
  // written. `n` is how many are alive; index k runs 0..n-1.
  //   pos   Float32Array(3n)  where it stands, in the body's own local frame (metres, the frame the world
  //                           and flora already use: the planet's centre is the origin)
  //   fwd   Float32Array(3n)  the way it faces, a unit vector; it is made tangent here, so it need not be
  //   up    Float32Array(3n)  optional. Left out, the planet's own up is used (the place, normalised),
  //                           which is exact on a sphere and saves the routines three floats an animal
  //   phase Float32Array(n)   the stride, 0..1, advanced by GROUND COVERED and not by time
  //   speed Float32Array(n)   metres a second over the ground
  //   state Uint8Array(n)     beastkit.js STATE: 0 stand 1 walk 2 trot 3 graze 4 alert 5 flee 6 hunt 7 rest
  //   head  Float32Array(n)   0 head up .. 1 head down to the grass, smoothed by the routines
  //   alert Float32Array(n)   0..1 how much the ears and the tail are working
  //   sp    Uint8Array(n)     which species row (the index into the rows this was built with)
  //   size  Float32Array(n)   this individual's size against its row (a yearling is 0.8)
  //   seed  Float32Array(n)   0..1, constant for its life: its hue, its value and its own clock offset
  //   born  Float32Array(n)   the clock when it appeared, so it washes in instead of popping
  //   shade Float32Array(n)   optional, 0..1 how deep under a canopy it stands
  _write(camLocal, agents) {
    const rows = this.rows, nr = rows.length, counts = this._counts, nearest = this._nearest;
    for (let i = 0; i < nr; i++) { counts[i] = 0; nearest[i] = 1e9; }
    const cx = camLocal.x, cy = camLocal.y, cz = camLocal.z;
    const ox = this.origin.x, oy = this.origin.y, oz = this.origin.z;
    const pos = agents.pos, fwd = agents.fwd, aup = agents.up || null, shade = agents.shade || null;
    const phase = agents.phase, speed = agents.speed, state = agents.state;
    // head, alert, size, seed, born and shade are the ones a half-built routines file may not have yet:
    // left out, an animal still stands, walks and is painted. pos, fwd, phase, speed, state and sp are not
    // optional -- without them there is nothing to draw.
    const head = agents.head || null, alert = agents.alert || null;
    const asp = agents.sp, size = agents.size || null, seed = agents.seed || null, born = agents.born || null;
    const far = this.far, fm = far ? far.mesh : null;
    const fe = fm ? fm.instanceMatrix.array : null, fi = fm ? fm.userData.inst.array : null;
    const fg = fm ? fm.userData.gait.array : null, fs = fm ? fm.userData.spec.array : null;
    const farUnit = FAR_SHAPE.high;
    let farN = 0, want = -1, wantD = 1e9;
    for (let k = 0; k < agents.n; k++) {
      const s = asp[k]; if (s >= nr || !this.drawable[s]) continue;
      const px = pos[k * 3], py = pos[k * 3 + 1], pz = pos[k * 3 + 2];
      const dx = px - cx, dy = py - cy, dz = pz - cz;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > this.dCull[s]) continue;
      const own = this.sp[s];
      const isNear = d < this.dNear[s];
      if (isNear && !own) { if (d < wantD) { wantD = d; want = s; } }      // its mesh is not built yet: it
      let e, ai, gi, si, slot, unit = 1;                                   // goes in the far mesh for a frame
      if (isNear && own && counts[s] < this.capNear) {
        const m = own.mesh; slot = counts[s]++;
        e = m.instanceMatrix.array; ai = m.userData.inst.array; gi = m.userData.gait.array; si = m.userData.spec.array;
        if (d < nearest[s]) nearest[s] = d;
      } else if (fm && farN < this.capFar) {
        slot = farN++; e = fe; ai = fi; gi = fg; si = fs;
        unit = rows[s].high / farUnit;        // one median body: the species' own size is its instance scale
      } else { this.prof.over++; continue; }
      // the frame it stands in: up from the planet, forward made tangent, and X = forward x up (right-handed
      // with Y up and Z back, because every model in this game faces -Z)
      let ux, uy, uz;
      if (aup) { ux = aup[k * 3]; uy = aup[k * 3 + 1]; uz = aup[k * 3 + 2]; }
      else { const l = 1 / (Math.hypot(px, py, pz) || 1); ux = px * l; uy = py * l; uz = pz * l; }
      let fx = fwd[k * 3], fy = fwd[k * 3 + 1], fz = fwd[k * 3 + 2];
      const dpr = fx * ux + fy * uy + fz * uz;
      fx -= ux * dpr; fy -= uy * dpr; fz -= uz * dpr;
      let fl = Math.hypot(fx, fy, fz);
      if (fl < 1e-4) { fx = uy; fy = -ux; fz = 0; fl = Math.hypot(fx, fy, fz) || 1; }     // facing straight up: any tangent
      fl = 1 / fl; fx *= fl; fy *= fl; fz *= fl;
      const sc = (size ? size[k] : 1) * unit;
      const o = slot * 16;
      e[o] = (fy * uz - fz * uy) * sc; e[o + 1] = (fz * ux - fx * uz) * sc; e[o + 2] = (fx * uy - fy * ux) * sc; e[o + 3] = 0;
      e[o + 4] = ux * sc; e[o + 5] = uy * sc; e[o + 6] = uz * sc; e[o + 7] = 0;
      e[o + 8] = -fx * sc; e[o + 9] = -fy * sc; e[o + 10] = -fz * sc; e[o + 11] = 0;
      e[o + 12] = px - ox; e[o + 13] = py - oy; e[o + 14] = pz - oz; e[o + 15] = 1;
      // aInst: the flora's own four, so a herd gets its variety from one geometry (materials.js:2150)
      const sd = seed ? seed[k] : (k * 0.618) % 1, sd2 = (sd * 7.13) % 1;
      const q = slot * 4;
      ai[q] = (sd - 0.5) * 0.10; ai[q + 1] = (sd2 - 0.5) * 0.16; ai[q + 2] = sd; ai[q + 3] = shade ? shade[k] : 0;
      gi[q] = phase[k]; gi[q + 1] = speed[k]; gi[q + 2] = state[k]; gi[q + 3] = born ? born[k] : 0;
      si[q] = s; si[q + 1] = size ? size[k] : 1; si[q + 2] = head ? head[k] : 0; si[q + 3] = alert ? alert[k] : 0;
    }
    // the meshes: how many, how much of the index, and bounds that hug the eye
    const bx = cx - ox, by = cy - oy, bz = cz - oz;
    for (let i = 0; i < nr; i++) {
      const own = this.sp[i]; if (!own) continue;
      const m = own.mesh, c = counts[i];
      m.count = c; m.visible = c > 0;
      if (!c) continue;
      this.prof.near += c; this.prof.draws++;
      // THE COAT IS DROPPED FOR THE WHOLE MESH once its nearest animal's 4 cm strokes are under a pixel.
      // The mesh owns its own draw range (its geometry shares the kit's buffers but not its range), so this
      // costs nothing at all -- the trick flora.js:371 already uses for the trees' leaves.
      m.geometry.setDrawRange(0, nearest[i] <= this.dCoat[i] ? own.mesh.userData.indexCount : own.mesh.userData.coatStart);
      m.position.copy(this.origin); m.updateMatrix();
      m.boundingSphere.center.set(bx, by, bz);
      m.boundingSphere.radius = this.dNear[i] + own.reach;
      m.instanceMatrix.needsUpdate = true;
      m.userData.inst.needsUpdate = true; m.userData.gait.needsUpdate = true; m.userData.spec.needsUpdate = true;
    }
    if (fm) {
      fm.count = farN; fm.visible = farN > 0;
      if (farN) {
        this.prof.far = farN; this.prof.draws++;
        let r = 0; for (let i = 0; i < nr; i++) if (this.dCull[i] > r) r = this.dCull[i];
        fm.position.copy(this.origin); fm.updateMatrix();
        fm.boundingSphere.center.set(bx, by, bz);
        fm.boundingSphere.radius = r + 4;
        fm.instanceMatrix.needsUpdate = true;
        fm.userData.inst.needsUpdate = true; fm.userData.gait.needsUpdate = true; fm.userData.spec.needsUpdate = true;
      }
    }
    // one species' body is built a frame at most, out of the world's own shared 5 ms slice: the nearest
    // animal without a mesh is the one that wants it (world/index.js:118, and flora.js' RANK is the habit)
    if (want >= 0) { this.ensure(want); if (!this.budgetOne) for (let i = 0; i < nr; i++) if (!this.sp[i]) this.ensure(i); }
  }
  dispose() {
    for (const s of this.sp) if (s) { this.group.remove(s.mesh); s.mesh.geometry.dispose(); s.geo.dispose(); if (s.mat.dispose) s.mat.dispose(); }
    if (this.far) { this.group.remove(this.far.mesh); this.far.mesh.geometry.dispose(); this.far.geo.dispose(); if (this.far.mat.dispose) this.far.mat.dispose(); }
    this.sp = this.rows.map(() => null); this.far = null;
  }
}

// =================================================================================================
// PLACEMENT: which animals are born where, worked out once per cell and always the same.
// =================================================================================================
// floraplace.js' rule, and the only one that matters: THE SAME CELL ALWAYS YIELDS THE SAME ANIMALS,
// whatever order the cells are built in and however often they are thrown away and built again. So
// everything below is drawn from one stream seeded by the cell's own key and nothing else.
//
// This is the stage-one stand-in for the full placer the design puts in beastplace.js. It places a BIRTH
// and the STATION it belongs to (a feeding ground, a water's edge, a den), because a routine needs
// somewhere to be; it does NOT yet read the biome's own flora, nor share obstacles.js' cell cache, so what
// an animal walks round is not yet exactly what is painted. Said plainly: that is the next step, not this one.
//
//   key     the cell's own integer key (the caller's; the same key must give the same animals)
//   cx,cy,cz  the cell's centre in the body's local frame   size  the cell's span in metres
//   roster  rows of { sp, perKm2, herd: [min, max], hours: [from, to], wants: 'open'|'wood'|'water'|'any' }
//   probe   (x, y, z) -> { ground: [x, y, z], open, wood, water, slope } or null if nothing lives there.
//           Injected, so this file needs neither surface.js nor the world's build queue to be tested.
//   hour    the hour of the day, 0..24, so what is abroad at dawn is not what is abroad at noon
//   out     pushed with { sp, x, y, z, size, seed, sx, sy, sz } -- the station is where its routine starts
export function beastBirths(key, cx, cy, cz, size, roster, probe, hour, out) {
  const rnd = mulberry32((key | 0) ^ 0x9e3779b9);
  const km2 = (size * size) / 1e6;
  for (let r = 0; r < roster.length; r++) {
    const row = roster[r];
    // how many this cell holds: the whole part always, the fraction decided by this cell's own stream, so
    // a density under one to a cell still comes out right over a wood
    const want = row.perKm2 * km2;
    let n = Math.floor(want) + (rnd() < want - Math.floor(want) ? 1 : 0);
    if (!n) continue;
    // what keeps other hours is still here, it is just lying up: the routines decide, not the placer
    if (row.hours && !hoursHold(row.hours, hour)) n = Math.max(0, Math.round(n * 0.35));
    for (let g = 0; g < n; g++) {
      // the station first, then the animals about it: a herd is born together or it is not a herd
      const sx = cx + (rnd() - 0.5) * size, sy = cy + (rnd() - 0.5) * size, sz = cz + (rnd() - 0.5) * size;
      const st = probe ? probe(sx, sy, sz) : { ground: [sx, sy, sz], open: 1, wood: 0, water: 0, slope: 0 };
      if (!st || !st.ground) continue;
      if (st.slope > 0.62) continue;                       // nothing is born on a cliff (35 degrees)
      if (row.wants === 'open' && st.open < 0.35) continue;
      if (row.wants === 'wood' && st.wood < 0.35) continue;
      if (row.wants === 'water' && st.water < 0.2) continue;
      const herd = row.herd ? Math.round(row.herd[0] + rnd() * (row.herd[1] - row.herd[0])) : 1;
      for (let i = 0; i < herd; i++) {
        const spread = row.spread == null ? 9 : row.spread;
        const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * spread;
        const bx = st.ground[0] + Math.cos(a) * rr, by = st.ground[1], bz = st.ground[2] + Math.sin(a) * rr;
        const b = probe ? probe(bx, by, bz) : { ground: [bx, by, bz] };
        const p = b && b.ground ? b.ground : [bx, by, bz];
        out.push({ sp: row.sp, x: p[0], y: p[1], z: p[2], size: 0.86 + rnd() * 0.28, seed: rnd(), sx: st.ground[0], sy: st.ground[1], sz: st.ground[2] });
      }
    }
  }
  return out;
}
// an hour window that may run through midnight (an owl's 20 to 5)
export function hoursHold(h, hour) {
  if (hour == null) return true;
  const a = h[0], b = h[1];
  return a <= b ? hour >= a && hour <= b : hour >= a || hour <= b;
}
