// Painted Cosmos: instanced flora in streamed chunks. OWNER: PAINTER.
//
// Cost is the design constraint here (lead review 1): every tree is submitted exactly once,
// in the tier its own distance puts it in.
//   tier 0  near: the full tree (about 650 triangles)
//   tier 1  mid: a trunk and two washes (about 180 triangles)
//   far     one shared 26-triangle form for every species; beyond the thinning distance only
//           one tree in three is kept and drawn larger ("fewer, larger, softer strokes")
// Tiers are assigned per tree on the CPU whenever the camera has moved a few metres, into
// dynamic instance buffers, so nothing is drawn collapsed. Undergrowth lives in 25 m cells,
// one mesh per kind, and grows in stroke by stroke as you approach.
import * as THREE from 'three';
import { getSurface } from './surface.js';
import { dirToFace, faceToDir, nodeSize } from './cubesphere.js';
import { INST_STRIDE, U_GRASS, U_FERN, U_BUSH, U_ROCK, U_FLOWER, U_STONE, U_REED, U_SHARD } from './floraplace.js';
import { TALL_KITS, farTreeGeometry, grassGeometry, reedGeometry, fernGeometry, bushGeometry, rockGeometry, flowerGeometry, shardGeometry } from './florakit.js';
import { makePropMaterial } from '../render/materials.js';
import { treeCell, underCell, hasCell, TREE_LEVEL, UNDER_LEVEL } from './obstacles.js';
import { QUALITY } from '../render/shared.js';

// tier ranges in metres at quality 2; scaled by RANGE_SCALE at lower tiers
const T0 = 52, T1 = 128, T_THIN = 300, T_FAR = 470;
const UNDER_FAR = 60, GRASS_NEAR = 15;
const RANGE_SCALE = [0.42, 0.82, 1.0];
const JIT = 0.3;                       // each tree switches tier at its own distance
const SHARED = ['position', 'normal', 'uv', 'aMass', 'aData'];
// the shared far form sized per kit: width, height (metres at instance scale 1), taper
const FAR_DIMS = { broadleaf: [13.5, 11.8, 0], conifer: [14.5, 16.5, 0.8], fungus: [12, 14, 0.1], crystal: [5, 6.5, 0.85], spire: [6.5, 13, 0.86], kelp: [4, 10, 0.5], wave: [8, 7.5, 0.5] };

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3();
const _Y = new THREE.Vector3(0, 1, 0);
const _ff = {}, _dd = [0, 0, 0];

export class Flora {
  constructor(bodyId, root, bodyUniforms) {
    this.S = getSurface(bodyId);
    this.R = this.S.R;
    this.group = new THREE.Group();
    this.group.name = 'flora-' + bodyId;
    root.add(this.group);
    this.camLocal = new THREE.Vector3();
    this.treeChunks = new Map(); this.farChunks = new Map(); this.underChunks = new Map(); this.under2Chunks = new Map();
    this.treeList = [];
    this.queue = [];
    this.lastTreeEval = new THREE.Vector3(1e9, 0, 0); this.lastUnderEval = new THREE.Vector3(1e9, 0, 0);
    this.treeSize = nodeSize(this.R, TREE_LEVEL); this.underSize = nodeSize(this.R, UNDER_LEVEL);
    this.farSize = this.treeSize * 2;       // far trees are batched in cells twice as large
    this.rangeScale = 1; this.lastScale = -1;
    this.retierCursor = 0;
    this.starved = 0;
    this.hidden = false;
    this.prof = { wanted: 0, build: 0, retier: 0 };

    this.bodyUniforms = bodyUniforms;
    this.look = this.S.look.flora || { tall: [], under: null };
    this.ready = false;
  }

  // Kits and materials are made the first time the body is visited.
  _init() {
    this.ready = true;
    const bodyUniforms = this.bodyUniforms, L = this.look;
    this.species = L.tall.map((sp, i) => {
      const mat = makePropMaterial(bodyUniforms, { name: 'tall-' + sp.kit + i, barkA: sp.bark[0], barkB: sp.bark[1], leafA: sp.leaf[0], leafB: sp.leaf[1], leafC: sp.leaf[2], barkP: sp.barkP, leafP: sp.leafP, wind: sp.wind == null ? 0.03 : sp.wind, doubleSide: !!sp.double });
      const gen = TALL_KITS[sp.kit];
      const fd = sp.kit === 'crystal' && sp.thin ? [1.8, 8, 0.9] : FAR_DIMS[sp.kit];
      return { mat, geo0: [gen(11 + i * 10, 0, sp), gen(12 + i * 10, 0, sp)], geo1: gen(13 + i * 10, 1, sp), far: fd, pine: sp.kit === 'conifer' };
    });
    const U = L.under || { leaf: [[0.8, 0.85, 0.4], [0.55, 0.7, 0.3], [0.35, 0.5, 0.3]], accent: [0.86, 0.29, 0.17], bush: [[0.64, 0.77, 0.37], [0.45, 0.63, 0.36], [0.24, 0.41, 0.36]], rock: [[0.8, 0.79, 0.83], [0.47, 0.45, 0.55]] };
    const sh = U.shard || U.rock;
    this.mats = {
      far: L.tall.length ? makePropMaterial(bodyUniforms, {
        name: 'far-tree', leafP: [0.9, 0.12, 1.0, 0.45], wind: 0.04,
        far: L.tall.map((sp, i) => ({ leafA: sp.leaf[0], leafB: sp.leaf[1], leafC: sp.leaf[2], barkA: sp.bark[0], barkB: sp.bark[1], taper: this.species[i].far[2], trunk: sp.kit === 'broadleaf' || sp.kit === 'conifer' || sp.kit === 'fungus' })),
      }) : null,
      under: makePropMaterial(bodyUniforms, { name: 'under', leafA: U.leaf[0], leafB: U.leaf[1], leafC: U.leaf[2], accent: U.accent, wind: 0.07, doubleSide: true }),
      bush: makePropMaterial(bodyUniforms, { name: 'bush', leafA: U.bush[0], leafB: U.bush[1], leafC: U.bush[2], leafP: [0.85, 0.3, 1.0, 0.25], wind: 0.04 }),
      rock: makePropMaterial(bodyUniforms, { name: 'rock', barkA: U.rock[0], barkB: U.rock[1], wind: 0 }),
      shard: makePropMaterial(bodyUniforms, { name: 'shard', barkA: sh[0], barkB: sh[1], wind: 0 }),
    };
    this.kit = {
      far: farTreeGeometry(5),
      grass: grassGeometry(31), fern: fernGeometry(41), reed: reedGeometry(81), bush: bushGeometry(51),
      rock: rockGeometry(61), flower: flowerGeometry(71), shard: shardGeometry(91),
    };
  }

  get busy() { return this.queue.length; }

  // An InstancedMesh with room for `cap` instances that shares the kit geometry's buffers.
  _instanced(chunk, geo, mat, cap, lod, far) {
    const g = new THREE.BufferGeometry();
    for (const k of SHARED) g.setAttribute(k, geo.attributes[k]);
    g.setIndex(geo.index);
    const inst = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    g.setAttribute('aInst', inst);
    let inst2 = null;
    if (far) { inst2 = new THREE.InstancedBufferAttribute(new Float32Array(cap * 2), 2); g.setAttribute('aInst2', inst2); }
    const mesh = new THREE.InstancedMesh(g, mat, cap);
    mesh.count = 0;
    mesh.position.copy(chunk.origin);
    mesh.matrixAutoUpdate = false; mesh.updateMatrix();
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), chunk.size * 0.75 + 24);
    const origin = chunk.origin, flora = this, camRel = new THREE.Vector3(), lodv = new THREE.Vector4().fromArray(lod);
    mesh.onBeforeRender = function (renderer, scene, camera, geometry, material) {
      const u = material.uniforms, k = flora.rangeScale;
      u.uOrigin.value.copy(origin);
      u.uCamLocal.value.copy(camRel.subVectors(flora.camLocal, origin));
      u.uLod.value.set(lodv.x * k, lodv.y * k, lodv.z, lodv.w);
      material.uniformsNeedUpdate = true;
    };
    mesh.userData.inst = inst; mesh.userData.inst2 = inst2;
    this.group.add(mesh);
    chunk.meshes.push(mesh);
    return mesh;
  }

  // ---- trees ----------------------------------------------------------------------------------
  _buildTrees(chunk) {
    let n = 0, d;
    if (chunk.kind === 'far') {
      // the four tree cells under this far cell, concatenated
      const parts = [];
      for (let b = 0; b < 2; b++) for (let a = 0; a < 2; a++) { const t = treeCell(this.S, chunk.face, chunk.ix * 2 + a, chunk.iy * 2 + b); parts.push(t); n += t.count; }
      d = new Float32Array(n * INST_STRIDE);
      let o = 0;
      for (const t of parts) { d.set(t.data.subarray(0, t.count * INST_STRIDE), o); o += t.count * INST_STRIDE; }
    } else {
      const t = treeCell(this.S, chunk.face, chunk.ix, chunk.iy);
      n = t.count; d = t.data;
    }
    chunk.n = n; chunk.data = d;
    chunk.mat = new Float32Array(n * 16);
    chunk.rel = new Float32Array(n * 3);
    chunk.tier = new Int8Array(n).fill(-2);
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
      if (chunk.kind === 'far') add('2', i, this.kit.far, this.mats.far, true);
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
  _retier(chunk) {
    const n = chunk.n;
    if (!n) return;
    const k = this.rangeScale;
    const cx = this.camLocal.x - chunk.origin.x, cy = this.camLocal.y - chunk.origin.y, cz = this.camLocal.z - chunk.origin.z;
    const d = chunk.data, rel = chunk.rel, tier = chunk.tier;
    let changed = false;
    for (let i = 0; i < n; i++) {
      const dx = rel[i * 3] - cx, dy = rel[i * 3 + 1] - cy, dz = rel[i * 3 + 2] - cz;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const seed = d[i * INST_STRIDE + 7];
      const j = (1 + (seed - 0.5) * JIT) * k;
      let t;
      if (dist < T0 * j) t = 0;
      else if (dist < T1 * j) t = 1;
      else if (dist < T_THIN * j) t = 2;
      else if (dist < T_FAR * j && (seed * 13.37) % 1 < 0.34) t = 3;   // thinned: one in three, drawn larger
      else t = -1;
      if (t !== tier[i]) { tier[i] = t; changed = true; }
    }
    chunk.tierPos.copy(this.camLocal);
    if (!changed) return;
    const mat = chunk.mat;
    for (const g of chunk.groups) {
      const want = g.tierKey === '0' ? 0 : g.tierKey === '1' ? 1 : 2;
      let c = 0;
      const list = g.list;
      for (let a = 0; a < list.length; a++) { const t = tier[list[a]]; if (t === want || (want === 2 && t === 3)) c++; }
      if (c === 0) { if (g.mesh) { g.mesh.count = 0; g.mesh.visible = false; } continue; }
      if (!g.mesh) g.mesh = this._instanced(chunk, g.geo, g.mat, list.length, g.far ? [0, T_FAR, JIT, 0.88] : [0, 1e7, 0, 0.999], g.far);
      const mesh = g.mesh, im = mesh.instanceMatrix.array, ia = mesh.userData.inst.array, ib = g.far ? mesh.userData.inst2.array : null;
      let w = 0;
      for (let a = 0; a < list.length; a++) {
        const i = list[a], t = tier[i];
        if (!(t === want || (want === 2 && t === 3))) continue;
        const o = i * INST_STRIDE, mo = i * 16, wo = w * 16;
        if (g.far) {
          // the unit far tree: size it to the species; thinned ones stand in for three
          const fd = this.species[d[o + 5]].far;
          const big = t === 3 ? 1.5 : 1;
          const sxz = fd[0] * big, sy = fd[1] * (t === 3 ? 1.15 : 1);
          for (let q = 0; q < 4; q++) { im[wo + q] = mat[mo + q] * sxz; im[wo + 4 + q] = mat[mo + 4 + q] * sy; im[wo + 8 + q] = mat[mo + 8 + q] * sxz; im[wo + 12 + q] = mat[mo + 12 + q]; }
          ib[w * 2] = d[o + 5]; ib[w * 2 + 1] = 0;
        } else {
          for (let q = 0; q < 16; q++) im[wo + q] = mat[mo + q];
        }
        ia[w * 4] = d[o + 8]; ia[w * 4 + 1] = d[o + 9]; ia[w * 4 + 2] = d[o + 7]; ia[w * 4 + 3] = d[o + 10];
        w++;
      }
      mesh.count = w; mesh.visible = true;
      mesh.instanceMatrix.needsUpdate = true; mesh.userData.inst.needsUpdate = true;
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
    const lists = { gn: [], gf: [], fern: [], reed: [], flower: [], bush: [], rock: [], shard: [] };
    const grass = chunk.kind === 'under';
    for (let i = 0; i < n; i++) {
      const o = i * INST_STRIDE, kind = d[o + 5];
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
      const mesh = this._instanced(chunk, geo, mat, list.length, lod, false);
      const im = mesh.instanceMatrix.array, ia = mesh.userData.inst.array;
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
      }
      mesh.count = list.length;
      mesh.instanceMatrix.needsUpdate = true; mesh.userData.inst.needsUpdate = true;
      mesh.userData.near = near; mesh.userData.skipLow = !!skipLow;
      if (skipLow && QUALITY.level === 0) mesh.visible = false;
    };
    // grass: the seed (0..1) sets how far each tuft is drawn; short-range tufts get their own
    // mesh so cells beyond that range do not submit them at all
    make(lists.gn, this.kit.grass, this.mats.under, [0, GRASS_NEAR / 0.775, 1.0, 0.6], GRASS_NEAR);
    make(lists.gf, this.kit.grass, this.mats.under, [0, 30, 0.9, 0.6], 0);
    make(lists.fern, this.kit.fern, this.mats.under, [0, UNDER_FAR, 0.5, 0.75], 0);
    make(lists.reed, this.kit.reed, this.mats.under, [0, UNDER_FAR, 0.4, 0.8], 0);
    make(lists.flower, this.kit.flower, this.mats.under, [0, UNDER_FAR * 0.8, 0.5, 0.75], 0);
    make(lists.bush, this.kit.bush, this.mats.bush, [0, UNDER_FAR, 0.3, 0.8], 0, true);
    make(lists.rock, this.kit.rock, this.mats.rock, [0, UNDER_FAR, 0.3, 0.85], 0);
    make(lists.shard, this.kit.shard, this.mats.shard, [0, UNDER_FAR, 0.3, 0.85], 0);
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
  _wanted(level, size, radius, map, kind) {
    const R = this.R, cam = this.camLocal;
    const c = _up.copy(cam).normalize();
    const e = new THREE.Vector3().crossVectors(_Y, c); if (e.lengthSq() < 1e-6) e.set(1, 0, 0); e.normalize();
    const n = new THREE.Vector3().crossVectors(c, e);
    const step = size * 0.5, K = Math.ceil(radius / step), cells = 1 << level;
    const seen = new Set();
    for (let j = -K; j <= K; j++) for (let i = -K; i <= K; i++) {
      if ((i * i + j * j) * step * step > (radius + step) * (radius + step)) continue;
      const x = c.x * R + e.x * i * step + n.x * j * step, y = c.y * R + e.y * i * step + n.y * j * step, z = c.z * R + e.z * i * step + n.z * j * step;
      const l = 1 / Math.hypot(x, y, z);
      dirToFace(x * l, y * l, z * l, _ff);
      const ix = Math.min(cells - 1, Math.max(0, Math.floor((_ff.u + 1) * 0.5 * cells))), iy = Math.min(cells - 1, Math.max(0, Math.floor((_ff.v + 1) * 0.5 * cells)));
      const key = _ff.face * 1e8 + ix * 1e4 + iy;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!map.has(key)) {
        const span = 2 / cells;
        faceToDir(_ff.face, -1 + (ix + 0.5) * span, -1 + (iy + 0.5) * span, _dd);
        const h = this.S.heightAt(_dd[0], _dd[1], _dd[2]);
        map.set(key, { key, face: _ff.face, ix, iy, size, kind, isTree: kind === 'near' || kind === 'far', origin: new THREE.Vector3(_dd[0], _dd[1], _dd[2]).multiplyScalar(R + h), meshes: [], built: false, queued: false, dead: false });
      }
    }
    for (const [key, ch] of map) {
      if (seen.has(key)) continue;
      if (ch.origin.distanceTo(cam) > radius + size * 2.2) { this._disposeChunk(ch); map.delete(key); }
    }
    for (const ch of map.values()) if (!ch.built && !ch.queued) { ch.queued = true; this.queue.push(ch); }
  }

  // budgetMs: time this call may spend building and re-tiering.
  update(camLocal, active, budgetMs) {
    this.camLocal.copy(camLocal);
    this.rangeScale = RANGE_SCALE[QUALITY.level] || 1;
    const alt = camLocal.length() - this.R;
    const show = active && alt < 2500;
    this.group.visible = show && !this.hidden;
    if (!show) return;
    if (!this.ready) this._init();
    const k = this.rangeScale;
    const t0 = performance.now();
    const prof = this.prof;
    if (k !== this.lastScale) {
      // quality changed: re-evaluate everything
      this.lastScale = k; this.lastTreeEval.set(1e9, 0, 0); this.lastUnderEval.set(1e9, 0, 0);
      for (const ch of this.treeChunks.values()) if (ch.tierPos) ch.tierPos.set(1e9, 0, 0);
      for (const ch of this.farChunks.values()) if (ch.tierPos) ch.tierPos.set(1e9, 0, 0);
    }
    if (this.lastTreeEval.distanceTo(camLocal) > 20) {
      this.lastTreeEval.copy(camLocal);
      if (this.species.length) {
        this._wanted(TREE_LEVEL, this.treeSize, T1 * k * (1 + JIT * 0.5) + this.treeSize * 0.75, this.treeChunks, 'near');
        this._wanted(TREE_LEVEL - 1, this.farSize, T_FAR * k * (1 + JIT * 0.5) + this.farSize * 0.75, this.farChunks, 'far');
      }
      this.treeList = Array.from(this.treeChunks.values()).concat(Array.from(this.farChunks.values()));
    }
    if (this.lastUnderEval.distanceTo(camLocal) > 8) {
      this.lastUnderEval.copy(camLocal);
      if (alt < 400) {
        this._wanted(UNDER_LEVEL, this.underSize, 44 * k + this.underSize * 0.6, this.underChunks, 'under');
        this._wanted(UNDER_LEVEL - 1, this.underSize * 2, UNDER_FAR * k * 1.25 + this.underSize * 1.2, this.under2Chunks, 'under2');
      }
    }
    let t1 = performance.now(); if (t1 - t0 > prof.wanted) prof.wanted = t1 - t0;
    // short-range grass is only submitted from cells close enough to show it
    for (const ch of this.underChunks.values()) {
      if (!ch.built) continue;
      const d = ch.origin.distanceTo(camLocal) - ch.size * 0.75;
      for (const m of ch.meshes) if (m.userData.near) m.visible = d < m.userData.near * k * 1.5;
    }
    // the low tier leaves out the bushes
    if (QUALITY.level !== this.lastQ) {
      this.lastQ = QUALITY.level;
      for (const ch of this.under2Chunks.values()) for (const m of ch.meshes) if (m.userData.skipLow) m.visible = QUALITY.level > 0;
    }
    // build queue: nearest first; always allowed one item when nothing was built for a while
    let spent = false;
    if (this.queue.length) {
      const q = this.queue, cam = this.camLocal;
      for (const ch of q) ch.dist = ch.origin.distanceTo(cam) - (ch.isTree ? 0 : 60);
      q.sort((a, b) => b.dist - a.dist);
      let built = 0;
      while (q.length && (performance.now() - t0 < budgetMs || (built === 0 && this.starved > 3))) {
        const ch = q[q.length - 1];
        if (ch.dead || ch.built) { q.pop(); ch.queued = false; continue; }
        // big cells are assembled from four placement cells: prepare one missing cell per
        // step, so no single step is long
        if (ch.kind === 'far' || ch.kind === 'under2') {
          const ck = ch.kind === 'far' ? 't' : 'u';
          let missing = false;
          for (let b = 0; b < 2 && !missing; b++) for (let a = 0; a < 2 && !missing; a++) {
            if (!hasCell(ck, this.S, ch.face, ch.ix * 2 + a, ch.iy * 2 + b)) {
              if (ck === 't') treeCell(this.S, ch.face, ch.ix * 2 + a, ch.iy * 2 + b); else underCell(this.S, ch.face, ch.ix * 2 + a, ch.iy * 2 + b);
              missing = true;
            }
          }
          if (missing) { built++; continue; }
        }
        q.pop();
        ch.queued = false;
        if (ch.isTree) { this._buildTrees(ch); this._retier(ch); } else this._buildUnder(ch);
        ch.built = true; built++;
      }
      this.starved = built ? 0 : this.starved + 1;
      spent = performance.now() - t0 >= budgetMs;
    }
    let t2 = performance.now(); if (t2 - t1 > prof.build) prof.build = t2 - t1;
    // re-tier: chunks near a tier boundary react to a few metres of travel, far ones to more
    if (!spent) {
      const list = this.treeList, n = list.length;
      const nearR = T1 * k * (1 + JIT * 0.5) + this.treeSize;
      for (let c = 0; c < n; c++) {
        const ch = list[(this.retierCursor + c) % n];
        if (!ch.built || !ch.n) continue;
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
