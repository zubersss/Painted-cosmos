// Painted Cosmos: instanced flora in streamed chunks. OWNER: PAINTER.
// Trees live in ~100 m chunks out to about 470 m (full trees near, simplified ones beyond,
// switched per tree at its own distance so nothing pops in step); undergrowth lives in ~25 m
// chunks and grows in stroke by stroke as you approach. Chunks are built in time slices.
import * as THREE from 'three';
import { getSurface } from './surface.js';
import { dirToFace, faceToDir, nodeSize } from './cubesphere.js';
import { placeTrees, placeUnder, INST_STRIDE, K_BIRCH, K_PINE, K_BIRCH_AUTUMN, U_GRASS, U_FERN, U_BUSH, U_ROCK, U_FLOWER, U_STONE, U_REED } from './floraplace.js';
import { birchGeometry, pineGeometry, grassGeometry, reedGeometry, fernGeometry, bushGeometry, rockGeometry, flowerGeometry } from './florakit.js';
import { makePropMaterial } from '../render/materials.js';
import { QUALITY } from '../render/shared.js';

const TREE_LEVEL = 6, UNDER_LEVEL = 8;
const TREE_T0 = 65, TREE_T1 = 175, TREE_FAR = 470, TREE_THIN = 300;
const RANGE_SCALE = [0.62, 0.82, 1.0];   // by quality tier
const UNDER_FAR = 62;
const SHARED = ['position', 'normal', 'uv', 'aMass', 'aData'];

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3();
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
    this.treeChunks = new Map(); this.underChunks = new Map();
    this.queue = [];
    this.lastTreeEval = new THREE.Vector3(1e9, 0, 0); this.lastUnderEval = new THREE.Vector3(1e9, 0, 0);
    this.treeSize = nodeSize(this.R, TREE_LEVEL); this.underSize = nodeSize(this.R, UNDER_LEVEL);
    this.instances = 0;
    this.rangeScale = 1;

    const birch = { barkA: [0.975, 0.965, 0.945], barkB: [0.27, 0.24, 0.26], barkP: [0.675, 0, 1.3, 0.25], leafP: [0.85, 0.40, 1.0, 0.28], wind: 0.10 };
    this.mats = {
      birch: makePropMaterial(bodyUniforms, Object.assign({ name: 'birch', leafA: [0.82, 0.87, 0.40], leafB: [0.60, 0.76, 0.34], leafC: [0.33, 0.53, 0.37] }, birch)),
      birchAutumn: makePropMaterial(bodyUniforms, Object.assign({ name: 'birch-autumn', leafA: [0.96, 0.82, 0.32], leafB: [0.93, 0.64, 0.28], leafC: [0.72, 0.42, 0.26] }, birch)),
      pine: makePropMaterial(bodyUniforms, { name: 'pine', barkA: [0.74, 0.54, 0.42], barkB: [0.40, 0.28, 0.25], barkP: [0.50, 1, 0.9, 0.6], leafA: [0.44, 0.62, 0.43], leafB: [0.31, 0.51, 0.44], leafC: [0.17, 0.28, 0.35], leafP: [0.9, 0.20, 1.0, 0.25], wind: 0.05 }),
      under: makePropMaterial(bodyUniforms, { name: 'under', leafA: [0.80, 0.85, 0.38], leafB: [0.54, 0.71, 0.31], leafC: [0.35, 0.51, 0.31], accent: [0.86, 0.29, 0.17], wind: 0.07, doubleSide: true }),
      bush: makePropMaterial(bodyUniforms, { name: 'bush', leafA: [0.64, 0.77, 0.37], leafB: [0.45, 0.63, 0.36], leafC: [0.24, 0.41, 0.36], leafP: [0.85, 0.3, 1.0, 0.25], wind: 0.04 }),
      rock: makePropMaterial(bodyUniforms, { name: 'rock', barkA: [0.80, 0.79, 0.83], barkB: [0.47, 0.45, 0.55], wind: 0 }),
    };
    // geometry kits (a few variants of each, generated once)
    this.kit = {
      birch: [[birchGeometry(11, 0), birchGeometry(12, 0), birchGeometry(13, 0)], [birchGeometry(11, 1), birchGeometry(12, 1), birchGeometry(13, 1)], [birchGeometry(11, 2)]],
      pine: [[pineGeometry(21, 0), pineGeometry(22, 0), pineGeometry(23, 0)], [pineGeometry(21, 1), pineGeometry(22, 1), pineGeometry(23, 1)], [pineGeometry(21, 2)]],
      grass: [grassGeometry(31), grassGeometry(32), grassGeometry(33)],
      fern: [fernGeometry(41), fernGeometry(42), fernGeometry(43)],
      reed: [reedGeometry(81), reedGeometry(82), reedGeometry(83)],
      bush: [bushGeometry(51), bushGeometry(52), bushGeometry(53)],
      rock: [rockGeometry(61), rockGeometry(62), rockGeometry(63)],
      flower: [flowerGeometry(71), flowerGeometry(72), flowerGeometry(73)],
    };
  }

  get busy() { return this.queue.length; }

  _mesh(chunk, geo, mat, list, data, lod, yScale, thin) {
    const n = list.length;
    const g = new THREE.BufferGeometry();
    for (const k of SHARED) g.setAttribute(k, geo.attributes[k]);
    g.setIndex(geo.index);
    const inst = new Float32Array(n * 4);
    const mesh = new THREE.InstancedMesh(g, mat, n);
    for (let i = 0; i < n; i++) {
      const o = list[i] * INST_STRIDE;
      _p.set(data[o], data[o + 1], data[o + 2]);
      _up.copy(_p).normalize();
      _q.setFromUnitVectors(_Y, _up);
      // lean and turn about the local up
      _q2.setFromEuler(new THREE.Euler(data[o + 11] * Math.cos(data[o + 4] * 3.0), data[o + 4], data[o + 11] * Math.sin(data[o + 4] * 3.0), 'YXZ'));
      _q.multiply(_q2);
      const sc = data[o + 3];
      _s.set(sc, sc * (yScale || 1), sc);
      _m.compose(_p.sub(chunk.origin), _q, _s);
      mesh.setMatrixAt(i, _m);
      inst[i * 4] = data[o + 8]; inst[i * 4 + 1] = data[o + 9]; inst[i * 4 + 2] = data[o + 7]; inst[i * 4 + 3] = data[o + 10];
    }
    g.setAttribute('aInst', new THREE.InstancedBufferAttribute(inst, 4));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.position.copy(chunk.origin);
    mesh.matrixAutoUpdate = false; mesh.updateMatrix();
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), chunk.size * 0.75 + 22);
    const origin = chunk.origin, flora = this, camRel = new THREE.Vector3(), lodv = new THREE.Vector4().fromArray(lod);
    const thinD = thin ? thin[0] : 1e9, thinG = thin ? thin[1] : 0;
    mesh.onBeforeRender = function (renderer, scene, camera, geometry, material) {
      const u = material.uniforms, k = flora.rangeScale;
      u.uOrigin.value.copy(origin);
      u.uCamLocal.value.copy(camRel.subVectors(flora.camLocal, origin));
      u.uLod.value.set(lodv.x * k, lodv.y * k, lodv.z, lodv.w);
      u.uThin.value.set(thinD * k, thinG);
      material.uniformsNeedUpdate = true;
    };
    mesh.userData.lod = lod;
    this.group.add(mesh);
    chunk.meshes.push(mesh);
    this.instances += n;
    return mesh;
  }

  _buildTrees(chunk) {
    const t = placeTrees(this.S, chunk.face, TREE_LEVEL, chunk.ix, chunk.iy, 18);
    // tiers 0 and 1 keep the three variants; the far tier uses one mesh per species
    const groups = [{}, {}, {}];
    for (let i = 0; i < t.count; i++) {
      const o = i * INST_STRIDE, kind = t.data[o + 5], variant = t.data[o + 6];
      const k01 = kind * 10 + variant, k2 = kind * 10;
      (groups[0][k01] || (groups[0][k01] = [])).push(i);
      (groups[1][k01] || (groups[1][k01] = [])).push(i);
      (groups[2][k2] || (groups[2][k2] = [])).push(i);
    }
    const lods = [[0, TREE_T0, 0.3, 0.999], [TREE_T0, TREE_T1, 0.3, 0.999], [TREE_T1, TREE_FAR, 0.3, 0.9]];
    for (let tier = 0; tier < 3; tier++) {
      for (const key of Object.keys(groups[tier])) {
        const kind = Math.floor(key / 10), variant = key % 10, list = groups[tier][key];
        const mat = kind === K_PINE ? this.mats.pine : kind === K_BIRCH_AUTUMN ? this.mats.birchAutumn : this.mats.birch;
        const geo = (kind === K_PINE ? this.kit.pine : this.kit.birch)[tier][variant];
        const m = this._mesh(chunk, geo, mat, list, t.data, lods[tier], 1, tier === 2 ? [TREE_THIN, 0.3] : null);
        m.userData.tier = tier;
      }
    }
  }

  _buildUnder(chunk) {
    const t = placeUnder(this.S, chunk.face, UNDER_LEVEL, chunk.ix, chunk.iy, 17);
    const groups = {};
    for (let i = 0; i < t.count; i++) {
      const o = i * INST_STRIDE, key = t.data[o + 5] * 10 + t.data[o + 6];
      (groups[key] || (groups[key] = [])).push(i);
    }
    for (const key of Object.keys(groups)) {
      const kind = Math.floor(key / 10), variant = key % 10, list = groups[key];
      if (kind === U_GRASS) this._mesh(chunk, this.kit.grass[variant], this.mats.under, list, t.data, [0, 22, 1.5, 0.6]);
      else if (kind === U_REED) this._mesh(chunk, this.kit.reed[variant], this.mats.under, list, t.data, [0, UNDER_FAR, 0.4, 0.8]);
      else if (kind === U_FERN) this._mesh(chunk, this.kit.fern[variant], this.mats.under, list, t.data, [0, UNDER_FAR, 0.5, 0.75]);
      else if (kind === U_FLOWER) this._mesh(chunk, this.kit.flower[variant], this.mats.under, list, t.data, [0, UNDER_FAR * 0.8, 0.5, 0.75]);
      else if (kind === U_BUSH) this._mesh(chunk, this.kit.bush[variant], this.mats.bush, list, t.data, [0, UNDER_FAR, 0.3, 0.8]);
      else if (kind === U_ROCK) this._mesh(chunk, this.kit.rock[variant], this.mats.rock, list, t.data, [0, UNDER_FAR, 0.3, 0.85]);
      else if (kind === U_STONE) this._mesh(chunk, this.kit.rock[variant], this.mats.rock, list, t.data, [0, UNDER_FAR, 0.3, 0.85], 0.55);
    }
  }

  _disposeChunk(chunk) {
    for (const m of chunk.meshes) {
      this.group.remove(m);
      this.instances -= m.count;
      for (const k of SHARED) m.geometry.deleteAttribute(k);
      m.geometry.setIndex(null);
      m.geometry.dispose();
      m.dispose();
    }
    chunk.meshes.length = 0; chunk.built = false; chunk.dead = true;
  }

  // Which chunks should exist around the camera: walk a tangent-plane grid and bucket by cell.
  _wanted(level, size, radius, map, isTree) {
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
        const chunk = { key, face: _ff.face, ix, iy, size, isTree, origin: new THREE.Vector3(_dd[0], _dd[1], _dd[2]).multiplyScalar(R + h), meshes: [], built: false, queued: false, dead: false };
        map.set(key, chunk);
      }
    }
    // drop chunks that are well out of range
    for (const [key, ch] of map) {
      if (seen.has(key)) continue;
      if (ch.origin.distanceTo(cam) > radius + size * 2.2) { this._disposeChunk(ch); map.delete(key); }
    }
    for (const ch of map.values()) if (!ch.built && !ch.queued) { ch.queued = true; this.queue.push(ch); }
  }

  update(camLocal, active, budgetMs) {
    this.camLocal.copy(camLocal);
    this.rangeScale = RANGE_SCALE[QUALITY.level] || 1;
    this.group.visible = active;
    if (!active) return;
    const alt = camLocal.length() - this.R;
    if (alt > 2500) { this.group.visible = false; return; }
    if (this.lastTreeEval.distanceTo(camLocal) > 28) {
      this.lastTreeEval.copy(camLocal);
      this._wanted(TREE_LEVEL, this.treeSize, TREE_FAR * 1.12 + this.treeSize * 0.6, this.treeChunks, true);
    }
    if (this.lastUnderEval.distanceTo(camLocal) > 8) {
      this.lastUnderEval.copy(camLocal);
      if (alt < 400) this._wanted(UNDER_LEVEL, this.underSize, UNDER_FAR * 1.2 + this.underSize * 0.6, this.underChunks, false);
    }
    // near meshes only matter close by; far meshes only beyond the switch distance
    const k = this.rangeScale;
    for (const ch of this.treeChunks.values()) {
      if (!ch.built) continue;
      const d = ch.origin.distanceTo(camLocal), half = ch.size * 0.75;
      for (const m of ch.meshes) {
        const tier = m.userData.tier;
        m.visible = tier === 0 ? d - half < TREE_T0 * k * 1.2
          : tier === 1 ? (d + half > TREE_T0 * k * 0.8 && d - half < TREE_T1 * k * 1.2)
            : (d + half > TREE_T1 * k * 0.8 && d - half < TREE_FAR * k * 1.2);
      }
    }
    if (this.queue.length) {
      const q = this.queue, cam = this.camLocal;
      for (const ch of q) ch.dist = ch.origin.distanceTo(cam) - (ch.isTree ? 0 : 40);
      q.sort((a, b) => b.dist - a.dist);
      const t0 = performance.now();
      let built = 0;
      while (q.length && (built === 0 || performance.now() - t0 < budgetMs)) {
        const ch = q.pop();
        ch.queued = false;
        if (ch.dead || ch.built) continue;
        if (ch.isTree) this._buildTrees(ch); else this._buildUnder(ch);
        ch.built = true; built++;
      }
    }
  }
}
