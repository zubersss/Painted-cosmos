// Painted Cosmos: instanced flora in streamed chunks. OWNER: PAINTER.
//
// Cost is the design constraint here (lead review 1): every tree is submitted exactly once,
// in the tier its own distance puts it in.
//   tier 0  near: the full tree (about 650 triangles)
//   tier 1  mid: a trunk and two washes (about 180 triangles)
//   far     one shared 26-triangle form for every species, out to 2 km at every tier (R2 W7.1); beyond the
//           thinning distance a share of the trees that falls with the square of the distance is kept, each
//           drawn wider by the inverse root of it ("fewer, larger, softer strokes": the same canopy)
// Tiers are assigned per tree on the CPU whenever the camera has moved a few metres, into
// dynamic instance buffers, so nothing is drawn collapsed. Undergrowth lives in 25 m cells,
// one mesh per kind, and grows in stroke by stroke as you approach.
import * as THREE from 'three';
import { getSurface } from './surface.js';
import { dirToFace, faceToDir, nodeSize } from './cubesphere.js';
import { INST_STRIDE, U_GRASS, U_FERN, U_BUSH, U_ROCK, U_FLOWER, U_STONE, U_REED, U_SHARD } from './floraplace.js';
import { FLORA_PHYS, TALL_KITS, farTreeGeometry, grassGeometry, grassPatchGeometry, reedGeometry, fernGeometry, bushGeometry, rockGeometry, flowerGeometry, shardGeometry } from './florakit.js';
import { makePropMaterial } from '../render/materials.js';
import { treeCell, treeCellThin, underCell, hasCell, TREE_LEVEL, UNDER_LEVEL } from './obstacles.js';
import { QUALITY, G } from '../render/shared.js';

// tier ranges in metres at quality 2; the near and middle tiers scaled by RANGE_SCALE at lower tiers
const T0 = 90, T1 = 190;      // (were 52, 128 while there was a triangle budget)
const UNDER_FAR = 110, GRASS_NEAR = 15;                  // (60 under the budget)
const RELIEF = 250;            // (R1 W2.3) metres the ground in an undergrowth cell's reach may stand above the ground under the eye
const RANGE_SCALE = [0.28, 0.6, 1.0];                    // (the lower tiers keep the ranges they had)
// (R2 W7.1, docs/lead/SHARP-SMOOTH-PLAN.md ruling 6: the far canopy at every tier, out to 2 km. It ended at 600 m at the
// top tier and, scaled by RANGE_SCALE, at 360 m and 168 m below it: from the ship at the lowest tier the forest was the
// terrain's canopy wash, and above about 200 m the trees were gone. Now the far forms come from the same placement at
// every tier and only the near and middle tiers scale; what the tiers trade is how soon the canopy thins.)
const FAR_MAX = 2000;          // m: the far forms are drawn out to here (fading over its last tenth), at every tier
const THIN = [250, 330, 420];  // m, per tier: beyond it the canopy keeps a share (THIN / d)^2 of its trees, each wider by the inverse root (materials.js PROP_VERT, PC_FAR)
const KEEP_M = 0.75;           // a tree is put in its far mesh while the share is over this much of its rank (the shader fades it in as the share passes its rank)
const FAR_SPLIT = 700, FAR_OV = 15;   // m: inner far cells hold the forms nearer than FAR_SPLIT, outer cells those beyond, overlapping by FAR_OV each way (the same form in both: nothing shows the seam)
const FAR_DL = 2, XFAR_DL = 3;        // levels above the tree cells: inner far cells 4 x 4 tree cells (196 m on Earth), outer 8 x 8 (393 m)
const HEADROOM = 1.5;          // a far cell holds the trees under this much more of the share it needs, so that it is not placed again every few metres
const TRIM = [1, 1];          // (was [0.82, 0.88] to pay for a triangle budget; the owner withdrew the budget: trees hand over where they read best)
const WASH_T = 0.55;                   // seconds a new thing takes to wash in, and a tree to change hands between two tiers
const HOLD_MAX = 6;                    // seconds a built cell waits at most for its ground to be on the paper
const RANK = { far: 0, xfar: 0, near: 1, under2: 2, under: 3 };   // what is built first: the far masses, the trees, then what grows under them
const JIT = 0.3;                       // each tree switches tier at its own distance
const SHARED = ['position', 'normal', 'uv', 'aMass', 'aData', 'aBranchId', 'aLeaf01'];     // (the last two: trees only, PHYSICS' crown)
// the shared far form sized per kit: width, height (metres at instance scale 1), taper
const FAR_DIMS = { broadleaf: [13.5, 11.8, 0], conifer: [14.5, 16.5, 0.8], fungus: [12, 14, 0.1], crystal: [5, 6.5, 0.85], spire: [6.5, 13, 0.86], kelp: [4, 10, 0.5], wave: [11, 6.0, 0.12], vine: [7.5, 9, 0.25] };     // (PAINTER 14: a far frozen wave a long low ridge, not a cone: [8, 7.5, 0.5] stood as a row of snow peaks)

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3();
const _Y = new THREE.Vector3(0, 1, 0);
const _ff = {}, _dd = [0, 0, 0];
const FAR_BAND = { lo: 0, hi: FAR_SPLIT + FAR_OV }, XFAR_BAND = { lo: FAR_SPLIT - FAR_OV, hi: Infinity };

export class Flora {
  constructor(bodyId, root, bodyUniforms) {
    this.S = getSurface(bodyId);
    this.R = this.S.R;
    this.group = new THREE.Group();
    this.group.name = 'flora-' + bodyId;
    root.add(this.group);
    this.camLocal = new THREE.Vector3();
    this.treeChunks = new Map(); this.farChunks = new Map(); this.xfarChunks = new Map(); this.underChunks = new Map(); this.under2Chunks = new Map();
    this.treeList = [];
    this.queue = [];
    this.lastTreeEval = new THREE.Vector3(1e9, 0, 0); this.lastUnderEval = new THREE.Vector3(1e9, 0, 0);
    this.treeSize = nodeSize(this.R, TREE_LEVEL); this.underSize = nodeSize(this.R, UNDER_LEVEL);
    this.farSize = this.treeSize * (1 << FAR_DL); this.xfarSize = this.treeSize * (1 << XFAR_DL);     // far trees are batched in larger cells (R2 W7.1)
    this.rangeScale = 1; this.lastScale = -1; this.thinD = THIN[2];
    this.lastLaid = -10; this.washNow = 1; this._washWall = 0;
    this.lastRelease = -10;
    this.held = [];                    // cells that are built and wait for their ground (see update)
    this._origins = new Map();         // (R1 W2.3) where undergrowth cells lie that were looked at and not wanted
    this.groundReady = null;           // (face, u, v) -> is the ground there on the paper as it will stay (set by the world)
    this.focusV = new THREE.Vector4(); this._focusFrame = -1; this._focusCam = null;       // the wash clock (s): real time, in steps of at most 0.1 s (it runs when the wind's clock is frozen too)
    this.retierCursor = 0;
    this.starved = 0;
    this.hidden = false;
    this.prof = { wanted: 0, build: 0, retier: 0 };
    this.est = { near: 1.0, far: 1.0, xfar: 1.0, under: 2.5, under2: 2.5 };   // what one build step of each kind has been costing, ms

    this.bodyUniforms = bodyUniforms;
    this.look = this.S.look.flora || { tall: [], under: null };
    this.ready = false;
  }

  // Kits and materials are made the first time the body is visited.
  _init() {
    this.ready = true;
    const bodyUniforms = this.bodyUniforms, L = this.look;
    this.species = L.tall.map((sp, i) => {
      const mat = makePropMaterial(bodyUniforms, { name: 'tall-' + sp.kit + i, barkA: sp.bark[0], barkB: sp.bark[1], leafA: sp.leaf[0], leafB: sp.leaf[1], leafC: sp.leaf[2], barkP: sp.barkP, leafP: sp.leafP, accent: sp.accent, wind: sp.wind == null ? 0.03 : sp.wind, doubleSide: !!sp.double, phys: sp.kit === 'vine' ? null : 'lite', branch: sp.kit === 'broadleaf' || sp.kit === 'conifer' || sp.kit === 'fungus' || sp.kit === 'kelp', stiff: sp.kit === 'kelp' ? 0.1 : 1, plantHeight: (FAR_DIMS[sp.kit] || [0, 10])[1], gem: sp.kit === 'crystal',
        // (the last fixes: a spire parts round an eye inside it; its girth at the foot, height and lean, florakit.js spireGeometry)
        hollow: sp.kit === 'spire' ? (sp.slim ? [1.3, 10.5, 0.3] : [2.0, 12, 0]) : null });
      const gen = TALL_KITS[sp.kit];
      const fd = sp.kit === 'crystal' && sp.thin ? [1.8, 8, 0.9] : FAR_DIMS[sp.kit];
      return { mat, geo0: [gen(11 + i * 10, 0, sp), gen(12 + i * 10, 0, sp)], geo1: gen(13 + i * 10, 1, sp), far: fd, pine: sp.kit === 'conifer' };
    });
    const U = L.under || { leaf: [[0.8, 0.85, 0.4], [0.55, 0.7, 0.3], [0.35, 0.5, 0.3]], accent: [0.86, 0.29, 0.17], bush: [[0.64, 0.77, 0.37], [0.45, 0.63, 0.36], [0.24, 0.41, 0.36]], rock: [[0.8, 0.79, 0.83], [0.47, 0.45, 0.55]] };
    this.U = U;
    this.pal = new Map();
    this.mats = Object.assign({
      far: L.tall.length ? makePropMaterial(bodyUniforms, {
        name: 'far-tree', leafP: [0.9, 0.12, 1.0, 0.45], wind: 0.04,
        far: L.tall.map((sp, i) => ({ leafA: sp.leaf[0], leafB: sp.leaf[1], leafC: sp.leaf[2], barkA: sp.bark[0], barkB: sp.bark[1], taper: this.species[i].far[2], trunk: sp.kit === 'broadleaf' || sp.kit === 'conifer' || sp.kit === 'fungus', drop: sp.kit === 'vine' })),
      }) : null,
    }, this._underMats(U, ''));
    this.kit = {
      far: farTreeGeometry(5),
      grass: grassGeometry(31), patch: grassPatchGeometry(37), fern: fernGeometry(41), reed: reedGeometry(81), bush: bushGeometry(51),
      rock: rockGeometry(61), flower: flowerGeometry(71), shard: shardGeometry(91),
    };
  }

  // Every wash this world's flora can be drawn with, each with a kit geometry it is drawn on (kits and
  // materials made if they were not; no cell is built), for the prewarm (world.prewarm, PILOT's P3): a
  // program follows the attributes a geometry has as well as the material (three r187 keys it on a normal,
  // for one). A biome's own undergrowth washes differ from the body's only in their uniforms, so they share
  // its programs and are not listed.
  warmSet() {
    if (!this.ready) this._init();
    const K = this.kit, M = this.mats, out = this.species.map((s) => [s.mat, s.geo1]);
    if (M.far) out.push([M.far, K.far]);
    out.push([M.under, K.grass], [M.patch, K.patch], [M.bush, K.bush], [M.rock, K.rock], [M.shard, K.shard]);
    return out;
  }

  // The undergrowth washes: the body's, or a biome's own where it names them (looks: biome.under).
  _underMats(U, tag) {
    const bodyUniforms = this.bodyUniforms, sh = U.shard || U.rock;
    return {
      under: makePropMaterial(bodyUniforms, { name: 'under' + tag, leafA: U.leaf[0], leafB: U.leaf[1], leafC: U.leaf[2], accent: U.accent, wind: 0.07, doubleSide: true, phys: 'full', stiff: 0, plantHeight: 0.5 }),
      // near grass: the same washes, each blade bent about its own root
      patch: makePropMaterial(bodyUniforms, { name: 'patch' + tag, leafA: U.leaf[1], leafB: U.leaf[2], leafC: U.leaf[2].map((x) => x - (x - x * x) * 0.6), accent: U.accent, wind: 0.07, doubleSide: true, phys: 'full', stiff: 0, plantHeight: 0.5, bladeRoot: true }),
      bush: makePropMaterial(bodyUniforms, { name: 'bush' + tag, leafA: U.bush[0], leafB: U.bush[1], leafC: U.bush[2], leafP: [0.85, 0.3, 1.0, 0.25], wind: 0.04, phys: 'lite', stiff: FLORA_PHYS.bush.stiffness, plantHeight: FLORA_PHYS.bush.height }),
      rock: makePropMaterial(bodyUniforms, { name: 'rock' + tag, barkA: U.rock[0], barkB: U.rock[1], wind: 0 }),
      shard: makePropMaterial(bodyUniforms, { name: 'shard' + tag, barkA: sh[0], barkB: sh[1], wind: 0, gem: !!U.shard }),
    };
  }
  _palette(bi) {
    let m = this.pal.get(bi);
    if (!m) { m = this._underMats(Object.assign({}, this.U, this.S.biomes[bi].under), '-' + bi); this.pal.set(bi, m); }
    return m;
  }

  // (still busy while a wash is being laid: a frame taken when this reaches 0 shows nothing half arrived)
  get busy() { return this.queue.length + (this.group.visible ? this.held.length + (this.washNow - this.lastLaid < WASH_T + 0.1 ? 1 : 0) : 0); }

  // An InstancedMesh with room for `cap` instances that shares the kit geometry's buffers.
  _instanced(chunk, geo, mat, cap, lod, far) {
    const g = new THREE.BufferGeometry();
    for (const k of SHARED) if (geo.attributes[k]) g.setAttribute(k, geo.attributes[k]);
    g.setIndex(geo.index);
    const inst = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    g.setAttribute('aInst', inst);
    const born = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
    g.setAttribute('aBorn', born);
    let inst2 = null;
    if (far) { inst2 = new THREE.InstancedBufferAttribute(new Float32Array(cap * 2), 2); g.setAttribute('aInst2', inst2); }
    const mesh = new THREE.InstancedMesh(g, mat, cap);
    mesh.count = 0;
    mesh.position.copy(chunk.origin);
    mesh.matrixAutoUpdate = false; mesh.updateMatrix();
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), chunk.size * 0.75 + (far ? 60 : 24));     // (the far forms drawn wider far off reach out of their cell)
    const origin = chunk.origin, flora = this, camRel = new THREE.Vector3(), lodv = new THREE.Vector4().fromArray(lod);
    mesh.onBeforeRender = function (renderer, scene, camera, geometry, material) {
      const u = material.uniforms, k = far ? 1 : flora.rangeScale;      // (R2 W7.1: the far forms' range is the same at every tier)
      if (u.uThin) u.uThin.value.x = flora.thinD;
      u.uOrigin.value.copy(origin);
      u.uCamLocal.value.copy(camRel.subVectors(flora.camLocal, origin));
      u.uLod.value.set(lodv.x * k, lodv.y * k, lodv.z, lodv.w);
      if (u.uWashIn) u.uWashIn.value.set(flora.washNow, mesh.userData.laid, WASH_T);
      if (u.uFocus) u.uFocus.value.copy(flora._focus(renderer, camera));
      if (u.uPlantHeight && mesh.userData.plantH) u.uPlantHeight.value = mesh.userData.plantH;
      material.uniformsNeedUpdate = true;
    };
    mesh.userData.inst = inst; mesh.userData.inst2 = inst2; mesh.userData.born = born;
    if (!(far || chunk.isTree)) this.lastLaid = this.washNow;
    mesh.userData.laid = far || chunk.isTree ? 0 : this.washNow;       // (trees wash in one by one, see _retier; a cell of undergrowth as one)
    this.group.add(mesh);
    chunk.meshes.push(mesh);
    return mesh;
  }

  // ---- trees ----------------------------------------------------------------------------------
  _buildTrees(chunk) {
    let n = 0, d;
    if (chunk.band) {
      // (R2 W7.1) the tree cells under this far cell, as placed step by step (chunk.next: each the whole cell, or only
      // the trees whose rank is under the share the cell needs), concatenated
      const parts = chunk.next, N = 1 << chunk.dl;
      // (which tree cell each tree came from: while that cell's own trees are not laid, the far form stands in for them)
      chunk.partEnd = []; chunk.partKey = [];
      for (let q = 0; q < parts.length; q++) {
        n += parts[q].count;
        chunk.partEnd.push(n); chunk.partKey.push(chunk.face * 1e8 + (chunk.ix * N + (q % N)) * 1e4 + chunk.iy * N + ((q / N) | 0));
      }
      d = new Float32Array(n * INST_STRIDE);
      let o = 0;
      for (const t of parts) { d.set(t.data.subarray(0, t.count * INST_STRIDE), o); o += t.count * INST_STRIDE; }
      chunk.pHeld = chunk.pTarget; chunk.next = null;
      chunk.laidBuf = new Uint8Array(parts.length);
    } else {
      const t = treeCell(this.S, chunk.face, chunk.ix, chunk.iy);
      n = t.count; d = t.data;
    }
    chunk.n = n; chunk.data = d;
    chunk.mat = new Float32Array(n * 16);
    chunk.rel = new Float32Array(n * 3);
    chunk.tier = new Int8Array(n).fill(-2);
    chunk.prev = new Int8Array(n).fill(-2); chunk.since = new Float32Array(n); chunk.washUntil = 0;
    // groups: which trees can appear in which mesh
    const groups = {};
    const add = (key, i, geo, mat, far) => {
      const g = groups[key] || (groups[key] = { list: [], geo, mat, far: !!far, mesh: null, tierKey: key[0] });
      g.list.push(i);
    };
    for (let i = 0; i < n; i++) {
      const o = i * INST_STRIDE;
      _p.set(d[o], d[o + 1], d[o + 2]);
      _up.copy(_p).normalize();
      _q.setFromUnitVectors(_Y, _up);
      const lean = d[o + 11], yaw = d[o + 4];
      _q2.setFromEuler(_e.set(lean * Math.cos(yaw * 3.0), yaw, lean * Math.sin(yaw * 3.0), 'YXZ'));
      _q.multiply(_q2);
      const sc = d[o + 3];
      // trunks and crowns vary in girth as well as height
      const girth = sc * (0.82 + 0.4 * ((d[o + 7] * 7.31) % 1));
      _m.compose(_p.sub(chunk.origin), _q, _s.set(girth, sc, girth));
      _m.toArray(chunk.mat, i * 16);
      chunk.rel[i * 3] = _p.x; chunk.rel[i * 3 + 1] = _p.y; chunk.rel[i * 3 + 2] = _p.z;
      if (chunk.band) add('2', i, this.kit.far, this.mats.far, true);
      else {
        const kind = d[o + 5], v = d[o + 6] % 2, sp = this.species[kind];
        add('0:' + kind + ':' + v, i, sp.geo0[v], sp.mat);
        add('1:' + kind, i, sp.geo1, sp.mat);
      }
    }
    chunk.groups = Object.values(groups);
    chunk.tierPos = new THREE.Vector3(1e9, 0, 0);
  }

  // Put every tree of a chunk into the tier its distance asks for and refill the buffers.
  // Where the explorer's figure stands in view space (w 1 while it is shown): strokes between the lens and
  // the figure part round the line of sight to it, so a crown never hides the figure. Once a frame.
  _focus(renderer, camera) {
    const fr = renderer.info.render.frame, v = this.focusV;
    if (fr === this._focusFrame && camera === this._focusCam) return v;
    this._focusFrame = fr; this._focusCam = camera;
    let f = G.figure, on = !!f;
    for (let o = f; o && on; o = o.parent) { if (!o.visible) on = false; if (!o.parent && !o.isScene) on = false; }
    if (!on) { v.set(0, 0, 0, 0); return v; }
    const e = f.matrixWorld.elements;
    _p.set(e[12] + e[4] * 0.95, e[13] + e[5] * 0.95, e[14] + e[6] * 0.95).applyMatrix4(camera.matrixWorldInverse);
    v.set(_p.x, _p.y, _p.z, 1);
    return v;
  }

  // adopt (R2 W7.1, a far cell placed again with more of its trees): the trees it held before keep their place on the
  // paper (no wash: they are taken into the new mesh as laid)
  _retier(chunk, force, adopt) {
    const n = chunk.n;
    if (!n) return;
    const now = this.washNow, prev = chunk.prev, since = chunk.since;
    const k = this.rangeScale;
    const cx = this.camLocal.x - chunk.origin.x, cy = this.camLocal.y - chunk.origin.y, cz = this.camLocal.z - chunk.origin.z;
    const d = chunk.data, rel = chunk.rel, tier = chunk.tier, lowQ = QUALITY.level === 0;
    // the middle tier pays for the near ground, the explorer and the ship (the frame budget of
    // 600 k triangles): full trees and middle trees hand over a little sooner
    const trim0 = QUALITY.level === 1 ? TRIM[0] : 1, trim1 = QUALITY.level === 1 ? TRIM[1] : 1;
    let changed = false;
    // an inner far cell: are the trees of its tree cells laid? Where they are not (not built yet, or waiting
    // for their ground), the far form stands in at any distance, and changes hands when they come
    let pe = null, laid = null, part = 0;
    if (chunk.kind === 'far') {
      pe = chunk.partEnd; laid = chunk.laidBuf;
      for (let q = 0; q < laid.length; q++) { const nc = this.treeChunks.get(chunk.partKey[q]); laid[q] = nc && nc.built && !nc.held && !nc.dead ? 1 : 0; }
    }
    // (R2 W7.1) the far band this cell draws, and the canopy's share at a distance: (THIN / d)^2
    const lo = chunk.band ? chunk.band.lo : 0, hi = chunk.band ? chunk.band.hi : Infinity, th2 = this.thinD * this.thinD;
    for (let i = 0; i < n; i++) {
      const dx = rel[i * 3] - cx, dy = rel[i * 3 + 1] - cy, dz = rel[i * 3 + 2] - cz;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const seed = d[i * INST_STRIDE + 7];
      const jj = 1 + (seed - 0.5) * JIT, j = jj * k;
      let t;
      if (dist < T0 * j * trim0) t = lowQ ? 1 : 0;      // the low tier draws no full trees
      else if (dist < T1 * j * trim1) t = 1;
      else if (dist >= lo && dist < hi && dist < FAR_MAX * jj && (seed * 13.37) % 1 < Math.min(1, th2 / (dist * dist)) / KEEP_M) t = 2;
      else t = -1;
      if (pe) { while (i >= pe[part]) part++; if (t >= 0 && t < 2 && !laid[part]) t = 2; }
      if (adopt && adopt[i]) { tier[i] = prev[i] = t; since[i] = -1e9; continue; }
      if (t !== tier[i]) { prev[i] = tier[i]; since[i] = now; tier[i] = t; changed = true; }
    }
    chunk.tierPos.copy(this.camLocal);
    if (!changed && !force) return;
    // (while a tree changes hands both meshes hold it; the chunk is refilled once more when the wash has dried)
    chunk.washUntil = changed ? now + WASH_T + 0.05 : 0;
    if (changed) this.lastLaid = now;
    const mat = chunk.mat;
    for (const g of chunk.groups) {
      const want = g.tierKey === '0' ? 0 : g.tierKey === '1' ? 1 : 2;
      let c = 0;
      const list = g.list;
      const inTier = (t) => t === want;
      // (a tree that left this mesh a moment ago is still in it, being lifted out)
      const leaving = (i) => now - since[i] < WASH_T && inTier(prev[i]) && !inTier(tier[i]);
      for (let a = 0; a < list.length; a++) { const i = list[a]; if (inTier(tier[i]) || leaving(i)) c++; }
      if (c === 0) { if (g.mesh) { g.mesh.count = 0; g.mesh.visible = false; } continue; }
      if (!g.mesh) g.mesh = this._instanced(chunk, g.geo, g.mat, list.length, g.far ? [0, FAR_MAX, JIT, 0.9] : [0, 1e7, 0, 0.999], g.far);
      const mesh = g.mesh, im = mesh.instanceMatrix.array, ia = mesh.userData.inst.array, ib = g.far ? mesh.userData.inst2.array : null, ab = mesh.userData.born.array;
      let w = 0;
      for (let a = 0; a < list.length; a++) {
        const i = list[a], out = !inTier(tier[i]);
        if (out && !leaving(i)) continue;
        // when it came (it washes in), or when it left (it is lifted out); one that only changed within the mesh keeps its place
        ab[w] = out ? -Math.max(since[i], 1e-3) : (inTier(prev[i]) ? 0 : since[i]);
        const o = i * INST_STRIDE, mo = i * 16, wo = w * 16;
        if (g.far) {
          // the unit far tree: size it to the species (R2 W7.1: the thinned canopy's trees are widened in the shader, by the distance)
          const fd = this.species[d[o + 5]].far;
          const sxz = fd[0], sy = fd[1];
          for (let q = 0; q < 4; q++) { im[wo + q] = mat[mo + q] * sxz; im[wo + 4 + q] = mat[mo + 4 + q] * sy; im[wo + 8 + q] = mat[mo + 8 + q] * sxz; im[wo + 12 + q] = mat[mo + 12 + q]; }
          ib[w * 2] = d[o + 5]; ib[w * 2 + 1] = 0;
        } else {
          for (let q = 0; q < 16; q++) im[wo + q] = mat[mo + q];
        }
        ia[w * 4] = d[o + 8]; ia[w * 4 + 1] = d[o + 9]; ia[w * 4 + 2] = d[o + 7]; ia[w * 4 + 3] = d[o + 10];
        w++;
      }
      mesh.count = w; mesh.visible = true;
      mesh.instanceMatrix.needsUpdate = true; mesh.userData.inst.needsUpdate = true; mesh.userData.born.needsUpdate = true;
      if (ib) mesh.userData.inst2.needsUpdate = true;
    }
  }

  // ---- undergrowth ----------------------------------------------------------------------------
  // Grass lives in 25 m cells (two meshes: short-range and long-range tufts). The rarer kinds
  // (ferns, reeds, flowers, bushes, stones) are batched in cells twice as large, one mesh a kind.
  _buildUnder(chunk) {
    let n = 0, d;
    if (chunk.kind === 'under2') {
      const parts = [];
      for (let b = 0; b < 2; b++) for (let a = 0; a < 2; a++) { const t = underCell(this.S, chunk.face, chunk.ix * 2 + a, chunk.iy * 2 + b); parts.push(t); n += t.count; }
      d = new Float32Array(n * INST_STRIDE);
      let o = 0;
      for (const t of parts) { d.set(t.data.subarray(0, t.count * INST_STRIDE), o); o += t.count * INST_STRIDE; }
    } else {
      const t = underCell(this.S, chunk.face, chunk.ix, chunk.iy);
      n = t.count; d = t.data;
    }
    // one set of lists per palette in the cell (nearly always one: two where biomes meet)
    const sets = new Map();
    const grass = chunk.kind === 'under', biomes = this.S.biomes;
    for (let i = 0; i < n; i++) {
      const o = i * INST_STRIDE, kind = d[o + 5];
      const pk = biomes[d[o + 6]] && biomes[d[o + 6]].under ? d[o + 6] : -1;
      let lists = sets.get(pk);
      if (!lists) { lists = { gn: [], gf: [], fern: [], reed: [], flower: [], bush: [], rock: [], shard: [] }; sets.set(pk, lists); }
      if (kind === U_GRASS) { if (grass) (d[o + 7] < 0.55 ? lists.gn : lists.gf).push(i); }
      else if (grass) continue;
      else if (kind === U_FERN) lists.fern.push(i);
      else if (kind === U_REED) lists.reed.push(i);
      else if (kind === U_FLOWER) lists.flower.push(i);
      else if (kind === U_BUSH) lists.bush.push(i);
      else if (kind === U_ROCK || kind === U_STONE) lists.rock.push(i);
      else if (kind === U_SHARD) lists.shard.push(i);
    }
    const make = (list, geo, mat, lod, near, skipLow) => {
      if (!list.length) return;
      // in an order that has nothing to do with place, so that drawing the first share of
      // a mesh thins it evenly (the low tier draws half)
      for (let a = list.length - 1; a > 0; a--) { const b = Math.floor(d[list[a] * INST_STRIDE + 7] * 9973.1 % 1 * (a + 1)); const t = list[a]; list[a] = list[b]; list[b] = t; }
      const mesh = this._instanced(chunk, geo, mat, list.length, lod, false);
      const im = mesh.instanceMatrix.array, ia = mesh.userData.inst.array;
      let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
      for (let a = 0; a < list.length; a++) {
        const o = list[a] * INST_STRIDE;
        _p.set(d[o], d[o + 1], d[o + 2]);
        _up.copy(_p).normalize();
        _q.setFromUnitVectors(_Y, _up);
        _q2.setFromEuler(_e.set(d[o + 11] * Math.cos(d[o + 4] * 3.0), d[o + 4], d[o + 11] * Math.sin(d[o + 4] * 3.0), 'YXZ'));
        _q.multiply(_q2);
        const sc = d[o + 3];
        _m.compose(_p.sub(chunk.origin), _q, _s.set(sc, sc * (d[o + 5] === U_STONE ? 0.55 : 1), sc));
        _m.toArray(im, a * 16);
        ia[a * 4] = d[o + 8]; ia[a * 4 + 1] = d[o + 9]; ia[a * 4 + 2] = d[o + 7]; ia[a * 4 + 3] = d[o + 10];
        if (_p.x < x0) x0 = _p.x; if (_p.x > x1) x1 = _p.x; if (_p.y < y0) y0 = _p.y; if (_p.y > y1) y1 = _p.y; if (_p.z < z0) z0 = _p.z; if (_p.z > z1) z1 = _p.z;
      }
      // (R1 W2.3) where its strokes stand (body-local: the box round their roots, as a sphere) and how far one can be seen
      // at all (PROP_VERT: a stroke is drawn while its root is nearer than uLod.y x (1 + (seed - 0.5) uLod.z), at most
      // lod[1] x (1 + lod[2] / 2), times the tier's range scale): a mesh no stroke of which can be seen is not submitted
      mesh.userData.rootC = new THREE.Vector3((x0 + x1) * 0.5, (y0 + y1) * 0.5, (z0 + z1) * 0.5).add(chunk.origin);
      mesh.userData.rootR = 0.5 * Math.hypot(x1 - x0, y1 - y0, z1 - z0) + 0.01;
      mesh.userData.reach = lod[1] * (1 + 0.5 * lod[2]);
      mesh.userData.full = list.length;
      mesh.count = QUALITY.level === 0 ? Math.ceil(list.length * 0.5) : list.length;
      mesh.instanceMatrix.needsUpdate = true; mesh.userData.inst.needsUpdate = true;
      mesh.userData.near = near; mesh.userData.skipLow = !!skipLow;
      mesh.userData.plantH = geo === this.kit.reed ? FLORA_PHYS.reed.height : geo === this.kit.fern ? FLORA_PHYS.fern.height : geo === this.kit.flower ? FLORA_PHYS.flower.height : FLORA_PHYS.grass.height;
    };
    // grass: the seed (0..1) sets how far each tuft is drawn; short-range tufts get their own
    // mesh so cells beyond that range do not submit them at all
    for (const [pk, lists] of sets) {
      const M = pk < 0 ? this.mats : this._palette(pk);
      // (the near half of the tufts used to be drawn as patches of blades; the near ground layer,
      // src/world/nearground.js, is the sward now)
      make(lists.gf, this.kit.grass, M.under, [0, 30, 0.9, 0.6], 0);
      make(lists.fern, this.kit.fern, M.under, [0, UNDER_FAR, 0.5, 0.75], 0);
      make(lists.reed, this.kit.reed, M.under, [0, UNDER_FAR, 0.4, 0.8], 0);
      make(lists.flower, this.kit.flower, M.under, [0, UNDER_FAR * 0.8, 0.5, 0.75], 0);
      make(lists.bush, this.kit.bush, M.bush, [0, UNDER_FAR, 0.3, 0.8], 0, true);
      make(lists.rock, this.kit.rock, M.rock, [0, UNDER_FAR, 0.3, 0.85], 0);
      make(lists.shard, this.kit.shard, M.shard, [0, UNDER_FAR, 0.3, 0.85], 0);
    }
  }

  _disposeChunk(chunk) {
    for (const m of chunk.meshes) {
      this.group.remove(m);
      for (const k of SHARED) m.geometry.deleteAttribute(k);
      m.geometry.setIndex(null);
      m.geometry.dispose();
      m.dispose();
    }
    chunk.meshes.length = 0; chunk.groups = null; chunk.built = false; chunk.dead = true;
  }

  // Which chunks should exist around the camera: walk a tangent-plane grid and bucket by cell.
  // (R1 W2.3) `reach` (undergrowth): a cell is wanted only while its ground lies within that many metres of the eye
  // itself, not of the ground under it: from the ship at 150 m no stroke of the undergrowth can be seen (PROP_VERT
  // shrinks each away by its root's distance), and they were built and submitted all the same, and kept at any height
  // (98 draws of nothing at 150 m, 303 at 1 km). Walked only while the eye is near enough the ground for any cell to
  // be in reach; a cell beyond reach by more than the old margin is let go at any height.
  // (R2 W7.1) `hole` (the outer far cells): a cell wholly nearer than that many metres is not wanted (the inner cells
  // draw everything there).
  _wanted(level, size, radius, map, kind, reach, hole) {
    const R = this.R, cam = this.camLocal;
    const c = _up.copy(cam).normalize();
    const e = new THREE.Vector3().crossVectors(_Y, c); if (e.lengthSq() < 1e-6) e.set(1, 0, 0); e.normalize();
    const n = new THREE.Vector3().crossVectors(c, e);
    const step = size * 0.5, cells = 1 << level;
    let K = Math.ceil(radius / step);
    const seen = new Set();
    if (reach != null) {
      const above = cam.length() - R - this.S.heightAt(c.x, c.y, c.z);
      if (above > reach + size * 0.75 + RELIEF) K = -1;
    }
    for (let j = -K; j <= K; j++) for (let i = -K; i <= K; i++) {
      if ((i * i + j * j) * step * step > (radius + step) * (radius + step)) continue;
      const x = c.x * R + e.x * i * step + n.x * j * step, y = c.y * R + e.y * i * step + n.y * j * step, z = c.z * R + e.z * i * step + n.z * j * step;
      const l = 1 / Math.hypot(x, y, z);
      dirToFace(x * l, y * l, z * l, _ff);
      const ix = Math.min(cells - 1, Math.max(0, Math.floor((_ff.u + 1) * 0.5 * cells))), iy = Math.min(cells - 1, Math.max(0, Math.floor((_ff.v + 1) * 0.5 * cells)));
      const key = _ff.face * 1e8 + ix * 1e4 + iy;
      if (seen.has(key)) continue;
      const span = 2 / cells;
      let origin = map.has(key) ? map.get(key).origin : null;
      if (!origin && reach != null) origin = this._origins.get(key);
      if (!origin) {
        faceToDir(_ff.face, -1 + (ix + 0.5) * span, -1 + (iy + 0.5) * span, _dd);
        const h = this.S.heightAt(_dd[0], _dd[1], _dd[2]);
        origin = new THREE.Vector3(_dd[0], _dd[1], _dd[2]).multiplyScalar(R + h);
        if (reach != null) { if (this._origins.size > 4096) this._origins.clear(); this._origins.set(key, origin); }
      }
      if (reach != null && origin.distanceTo(cam) - size * 0.75 > reach) continue;
      if (hole != null && !map.has(key) && origin.distanceTo(cam) + size * 0.75 < hole) continue;
      seen.add(key);
      if (!map.has(key)) {
        const ch = { key, face: _ff.face, ix, iy, size, kind, rank: RANK[kind], fu: -1 + (ix + 0.5) * span, fv: -1 + (iy + 0.5) * span, held: false, isTree: kind === 'near' || kind === 'far' || kind === 'xfar', origin, meshes: [], built: false, queued: false, dead: false };
        // (R2 W7.1) a far cell: its band, its level above the tree cells, and the share of its trees it holds
        if (kind === 'far' || kind === 'xfar') Object.assign(ch, { band: kind === 'far' ? FAR_BAND : XFAR_BAND, dl: kind === 'far' ? FAR_DL : XFAR_DL, pHeld: 0, pTarget: 0, next: null, pi: 0, stale: false });
        map.set(key, ch);
      }
    }
    for (const [key, ch] of map) {
      if (seen.has(key)) continue;
      if (ch.origin.distanceTo(cam) > (reach != null ? reach + size * 0.75 : radius) + size * 2.2) {
        if (ch.queued) { const qi = this.queue.indexOf(ch); if (qi >= 0) this.queue.splice(qi, 1); ch.queued = false; }
        this._disposeChunk(ch); map.delete(key);
      }
    }
    for (const ch of map.values()) if (!ch.built && !ch.queued) { ch.queued = true; this.queue.push(ch); }
  }

  // A cell is built when its turn comes and laid on the paper when its ground is there as it will stay
  // (or after HOLD_MAX seconds): on an arrival the far ground settles first, so the far masses wash in
  // first, then the trees round the eye, then what grows under them. Nothing is laid on ground that is
  // still sliding into place.
  _hold(ch) {
    ch.held = true; ch.heldAt = this.washNow;
    for (const m of ch.meshes) m.visible = false;
    this.held.push(ch);
  }
  _release(ch) {
    ch.held = false;
    const now = this.washNow;
    if (now > ch.heldAt) this.lastRelease = now;      // (it did wait: the near ground's strokes come after it)
    if (ch.isTree) {
      this._retier(ch);
      // the far forms that stood in for these trees are lifted out as the trees are laid
      if (ch.kind === 'near') { const far = this.farChunks.get(ch.face * 1e8 + (ch.ix >> FAR_DL) * 1e4 + (ch.iy >> FAR_DL)); if (far && far.built && !far.held && !far.dead) this._retier(far); }
    } else {
      for (const m of ch.meshes) m.userData.laid = now;
      this._showUnder(ch);
      if (ch.meshes.length) this.lastLaid = now;
    }
  }

  // (R1 W2.3) an undergrowth cell's meshes, each submitted only while one of its strokes can be seen (the nearest root
  // nearer than the mesh's reach), and the bushes not at the low tier. A held cell stays hidden (_hold).
  _showUnder(ch) {
    if (!ch.built || ch.held || ch.dead) return;
    const cam = this.camLocal, k = this.rangeScale, low = QUALITY.level === 0;
    for (const m of ch.meshes) {
      const u = m.userData;
      let on = !(u.skipLow && low);
      if (on && u.reach) {
        const reach = u.reach * k, dc = cam.distanceTo(u.rootC);
        if (dc - u.rootR >= reach) on = false;
        else if (dc + u.rootR >= reach) {
          // (the sphere straddles the reach: the strokes drawn, root by root)
          const a = m.instanceMatrix.array, o = ch.origin, r2 = reach * reach;
          const cx = cam.x - o.x, cy = cam.y - o.y, cz = cam.z - o.z;
          on = false;
          for (let i = 0, n = m.count * 16; i < n; i += 16) {
            const dx = a[i + 12] - cx, dy = a[i + 13] - cy, dz = a[i + 14] - cz;
            if (dx * dx + dy * dy + dz * dz < r2) { on = true; break; }
          }
        }
      }
      if (on && u.near) on = ch.origin.distanceTo(cam) - ch.size * 0.75 < u.near * k * 1.5;
      m.visible = on;
    }
  }

  // budgetMs: time this call may spend building and re-tiering. now: the world's wash clock (s).
  // (R2 W7.1) the share of a far cell's trees it must hold: the canopy's share at the nearest of its trees can be, over
  // KEEP_M (a tree goes into its mesh before the shader starts to show it)
  _farNeed(ch) {
    const d = Math.max(ch.origin.distanceTo(this.camLocal) - ch.size * 0.75, ch.band.lo, T1 * this.rangeScale * (1 - JIT * 0.5), 1);
    return Math.min(1, (this.thinD * this.thinD) / (d * d) / KEEP_M);
  }
  // (R2 W7.1) a far cell placed again with more of its trees (the eye came nearer): built anew in the same update, the
  // trees it held before taken over as laid, the new ones washed in (the shader shows them only as the share reaches them)
  _rebuildFar(ch) {
    const old = ch.pHeld, d0 = ch.data;
    for (const m of ch.meshes) {
      this.group.remove(m);
      for (const k of SHARED) m.geometry.deleteAttribute(k);
      m.geometry.setIndex(null); m.geometry.dispose(); m.dispose();
    }
    ch.meshes.length = 0;
    this._buildTrees(ch);
    const d = ch.data, n = ch.n, adopt = new Uint8Array(n);
    for (let i = 0; i < n; i++) adopt[i] = old >= 1 || (d[i * INST_STRIDE + 7] * 13.37) % 1 < old ? 1 : 0;
    ch.stale = false;
    this._retier(ch, true, adopt);
    return d0;
  }

  update(camLocal, active, budgetMs, now) {
    this.camLocal.copy(camLocal);
    this.rangeScale = RANGE_SCALE[QUALITY.level] || 1;
    this.thinD = THIN[QUALITY.level] || THIN[2];
    if (now != null) this.washNow = now;
    else { const w = performance.now(); this.washNow += this._washWall ? Math.min(0.1, Math.max(0.02, (w - this._washWall) / 1000)) : 0; this._washWall = w; }
    const alt = camLocal.length() - this.R;
    const show = active && alt < 2500;
    this.group.visible = show && !this.hidden;
    if (!show) {
      // nothing to build for a body the camera is not on
      if (this.queue.length) { for (const ch of this.queue) ch.queued = false; this.queue.length = 0; }
      if (this.held.length) { for (const ch of this.held) if (!ch.dead) this._release(ch); this.held.length = 0; }
      this.lastTreeEval.set(1e9, 0, 0); this.lastUnderEval.set(1e9, 0, 0);
      return;
    }
    if (!this.ready) this._init();
    const k = this.rangeScale;
    const t0 = performance.now();
    const prof = this.prof;
    if (k !== this.lastScale) {
      // quality changed: re-evaluate everything
      this.lastScale = k; this.lastTreeEval.set(1e9, 0, 0); this.lastUnderEval.set(1e9, 0, 0);
      for (const ch of this.treeChunks.values()) if (ch.tierPos) ch.tierPos.set(1e9, 0, 0);
      for (const ch of this.farChunks.values()) if (ch.tierPos) ch.tierPos.set(1e9, 0, 0);
      for (const ch of this.xfarChunks.values()) if (ch.tierPos) ch.tierPos.set(1e9, 0, 0);
    }
    if (this.lastTreeEval.distanceTo(camLocal) > 20) {
      this.lastTreeEval.copy(camLocal);
      if (this.species.length) {
        this._wanted(TREE_LEVEL, this.treeSize, T1 * k * (1 + JIT * 0.5) + this.treeSize * 0.75, this.treeChunks, 'near');
        // (R2 W7.1) the far canopy: inner cells out to the split, outer cells from it to 2 km, at every tier
        this._wanted(TREE_LEVEL - FAR_DL, this.farSize, FAR_SPLIT + FAR_OV + this.farSize * 0.75, this.farChunks, 'far');
        this._wanted(TREE_LEVEL - XFAR_DL, this.xfarSize, FAR_MAX * (1 + JIT * 0.5) + this.xfarSize * 0.75, this.xfarChunks, 'xfar', null, FAR_SPLIT - FAR_OV);
        // a far cell the eye has come nearer to is placed again with more of its trees
        for (const map of [this.farChunks, this.xfarChunks]) for (const ch of map.values()) {
          if (!ch.built || ch.dead || ch.queued || ch.held) continue;
          if (ch.stale || this._farNeed(ch) > ch.pHeld + 1e-6) { ch.stale = true; ch.queued = true; this.queue.push(ch); }
        }
      }
      this.treeList = Array.from(this.treeChunks.values()).concat(Array.from(this.farChunks.values()), Array.from(this.xfarChunks.values()));
    }
    if (this.lastUnderEval.distanceTo(camLocal) > 8) {
      this.lastUnderEval.copy(camLocal);
      // (R1 W2.3: at every height, by the distance from the eye; the radius at the ground is the reach)
      const rU = 44 * ([0.42, 0.82, 1.0][QUALITY.level] || 1) + this.underSize * 0.6, rU2 = UNDER_FAR * k * 1.25 + this.underSize * 1.2;
      this._wanted(UNDER_LEVEL, this.underSize, rU, this.underChunks, 'under', rU);
      this._wanted(UNDER_LEVEL - 1, this.underSize * 2, rU2, this.under2Chunks, 'under2', rU2);
    }
    let t1 = performance.now(); if (t1 - t0 > prof.wanted) prof.wanted = t1 - t0;
    this.kit.patch.setDrawRange(0, QUALITY.level === 0 ? 60 : Infinity);   // the low tier: five blades a patch
    // the low tier draws half of each undergrowth mesh
    if (QUALITY.level !== this.lastQ) {
      this.lastQ = QUALITY.level;
      for (const ch of this.under2Chunks.values()) for (const m of ch.meshes) if (m.userData.full) m.count = QUALITY.level === 0 ? Math.ceil(m.userData.full * 0.5) : m.userData.full;
      for (const ch of this.underChunks.values()) for (const m of ch.meshes) if (m.userData.full) m.count = QUALITY.level === 0 ? Math.ceil(m.userData.full * 0.5) : m.userData.full;
    }
    // (R1 W2.3) an undergrowth mesh is submitted only while a stroke of it can be seen; the low tier leaves out the bushes
    for (const ch of this.underChunks.values()) this._showUnder(ch);
    for (const ch of this.under2Chunks.values()) this._showUnder(ch);
    // build queue: nearest first; always allowed one item when nothing was built for a while
    let spent = false;
    if (this.queue.length) {
      const q = this.queue, cam = this.camLocal;
      for (const ch of q) ch.dist = ch.origin.distanceTo(cam);
      q.sort((a, b) => (b.rank - a.rank) || (b.dist - a.dist));     // pop() takes the far masses first, then the nearest
      let built = 0;
      while (q.length) {
        const ch = q[q.length - 1];
        if (ch.dead || (ch.built && !ch.stale)) { q.pop(); ch.queued = false; continue; }
        // start a step only if it is likely to fit in what is left of the slice (the first
        // step of a full slice always goes ahead, so the queue cannot stall)
        const el = performance.now() - t0, est = this.est[ch.kind];
        if (el + est > budgetMs && (built > 0 || budgetMs < 2.5) && !(built === 0 && this.starved > 12 && budgetMs > 0)) break;
        const ts = performance.now();
        // (R2 W7.1) a far cell is assembled from its tree cells, one placed per step (the whole cell from the cache, or
        // only the trees whose rank is under the share the cell needs), so no single step is long; then built (or, placed
        // again with more of its trees, built anew in place)
        if (ch.band) {
          if (!ch.next) { ch.pTarget = Math.min(1, this._farNeed(ch) * HEADROOM); if (ch.pTarget > 0.999) ch.pTarget = 1; ch.next = []; ch.pi = 0; }
          const N = 1 << ch.dl;
          if (ch.pi < N * N) {
            ch.next.push(treeCellThin(this.S, ch.face, ch.ix * N + (ch.pi % N), ch.iy * N + ((ch.pi / N) | 0), ch.pTarget));
            ch.pi++; built++;
            this.est[ch.kind] += (Math.min(8, performance.now() - ts) - this.est[ch.kind]) * 0.2;
            continue;
          }
          q.pop(); ch.queued = false;
          if (ch.built) this._rebuildFar(ch);
          else { this._buildTrees(ch); ch.built = true; this._hold(ch); }
          built++;
          continue;
        }
        // big cells are assembled from four placement cells: prepare one missing cell per
        // step, so no single step is long
        if (ch.kind === 'under2') {
          let missing = false;
          for (let b = 0; b < 2 && !missing; b++) for (let a = 0; a < 2 && !missing; a++) {
            if (!hasCell('u', this.S, ch.face, ch.ix * 2 + a, ch.iy * 2 + b)) { underCell(this.S, ch.face, ch.ix * 2 + a, ch.iy * 2 + b); missing = true; }
          }
          if (missing) { built++; this.est[ch.kind] += (Math.min(8, performance.now() - ts) - this.est[ch.kind]) * 0.2; continue; }
        }
        q.pop();
        ch.queued = false;
        if (ch.isTree) this._buildTrees(ch); else this._buildUnder(ch);
        ch.built = true; built++;
        this._hold(ch);
        this.est[ch.kind] += (Math.min(8, performance.now() - ts) - this.est[ch.kind]) * 0.2;
      }
      this.starved = built ? 0 : this.starved + 1;
      spent = performance.now() - t0 >= budgetMs;
    }
    // lay the cells whose ground has come
    if (this.held.length) {
      const h = this.held, ready = this.groundReady, wn = this.washNow;
      let w = 0;
      for (let a = 0; a < h.length; a++) {
        const ch = h[a];
        if (ch.dead) continue;
        if (!ready || wn - ch.heldAt > HOLD_MAX || ready(ch.face, ch.fu, ch.fv)) this._release(ch); else h[w++] = ch;
      }
      h.length = w;
    }
    let t2 = performance.now(); if (t2 - t1 > prof.build) prof.build = t2 - t1;
    // re-tier: chunks near a tier boundary react to a few metres of travel, far ones to more
    if (!spent) {
      const list = this.treeList, n = list.length;
      const nearR = T1 * k * (1 + JIT * 0.5) + this.treeSize;
      for (let c = 0; c < n; c++) {
        const ch = list[(this.retierCursor + c) % n];
        if (!ch.built || !ch.n || ch.held) continue;
        if (ch.washUntil && this.washNow > ch.washUntil) { this._retier(ch, true); continue; }
        const moved = ch.tierPos.distanceTo(camLocal);
        if (moved < 3) continue;
        const d = ch.origin.distanceTo(camLocal);
        if (moved > (ch.kind === 'near' || d < nearR + ch.size ? 3 : 18)) {
          this._retier(ch);
          if (performance.now() - t0 > budgetMs) { this.retierCursor = (this.retierCursor + c + 1) % n; break; }
        }
      }
    }
    const t3 = performance.now(); if (t3 - t2 > prof.retier) prof.retier = t3 - t2;
  }
}
