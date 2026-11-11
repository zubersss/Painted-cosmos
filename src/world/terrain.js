// Painted Cosmos: cube-sphere quadtree terrain with geomorphing. OWNER: PAINTER.
// Patches are generated on demand in small time slices (never more than the frame's budget),
// coarse levels first; a node is only replaced by its children once all four exist, and every
// vertex slides between its own position and its place on the parent mesh, so detail arrives
// without popping.
import * as THREE from 'three';
import { getSurface } from './surface.js';
import { buildPatchData, beginPatch, stepPatch, patchIndices, PATCH_N } from './patchgen.js';
import { faceToDir, nodeSize, FACES } from './cubesphere.js';
import { makeTerrainMaterial, makeWaterMaterial } from '../render/materials.js';
import { QUALITY } from '../render/shared.js';

const SPLIT_BY_QUALITY = [0.75, 1.12, 1.25];   // a node splits when the camera is nearer than this * its size
const MORPH_A = 0.76;       // morph band: [MORPH_A, MORPH_B] * the distance at which it merges
const MORPH_B = 0.98;
const ANCHOR = 64;          // stroke textures repeat with periods that divide this (metres)
const KEEP_FRAMES = 240;    // unused children are disposed after this many updates
const RELIEF_K = 1.6, RELIEF_MAX = 0.7;

let _sharedIndex = null;
function sharedIndex() {
  if (!_sharedIndex) _sharedIndex = new THREE.BufferAttribute(patchIndices(), 1);
  return _sharedIndex;
}

const _v = new THREE.Vector3();
const _dir = [0, 0, 0];

class Node {
  constructor(face, level, ix, iy, R) {
    this.face = face; this.level = level; this.ix = ix; this.iy = iy;
    this.children = null;
    this.mesh = null; this.water = null;
    this.ready = false; this.queued = false;
    this.size = nodeSize(R, level);
    // provisional bounds from the sphere; refined once the patch exists
    const span = 2 / (1 << level);
    faceToDir(face, -1 + (ix + 0.5) * span, -1 + (iy + 0.5) * span, _dir);
    this.center = new THREE.Vector3(_dir[0] * R, _dir[1] * R, _dir[2] * R);
    this.boundR = this.size * 0.9 + 60;
    this.u0 = -1 + ix * span; this.u1 = this.u0 + span; this.v0 = -1 + iy * span; this.v1 = this.v0 + span;
    this.avgR = R;
    this.lastUsed = 0;
    this.dist = 0;
    this.boost = 1;      // steep ground is refined from further away (set once the patch exists)
    this.pBoost = 1;     // the parent's boost: sets where this patch has fully morphed into it
  }
}

export class PlanetTerrain {
  constructor(bodyId, root, bodyUniforms, skyUniforms, opts = {}) {
    this.bodyId = bodyId;
    this.root = root;
    this.S = getSurface(bodyId);
    this.R = this.S.R;
    // finest cells about 0.5 to 0.75 m: one more level on the big bodies, whose cliffs would
    // otherwise show a metre-wide sawtooth at the lip under one's feet
    this.maxLevel = opts.maxLevel != null ? opts.maxLevel : Math.max(4, Math.round(Math.log2((Math.PI * 0.5 * this.R) / (PATCH_N * 0.75))) + (this.S.look.fine ? 1 : 0));
    this.material = makeTerrainMaterial(bodyUniforms);
    this.waterMaterial = makeWaterMaterial(bodyUniforms, skyUniforms);
    this.group = new THREE.Group();
    this.group.name = 'terrain-' + bodyId;
    root.add(this.group);
    this.roots = [];
    for (let f = 0; f < 6; f++) this.roots.push(new Node(f, 0, 0, 0, this.R));
    this.queue = [];
    this.job = null; this.jobNode = null;
    this.frame = 0;
    this.camLocal = new THREE.Vector3(0, this.R * 3, 0);
    this.camDir = new THREE.Vector3(0, 1, 0);
    this.visible = [];
    this.patchCount = 0;
    this.detail = true;        // false: only the six root patches (far bodies)
    this.splitK = 1.12;
    this.boostK = 1;
    for (const n of this.roots) this._build(n);
  }

  get busy() { return this.queue.length + (this.job ? 1 : 0); }

  _build(node, data) {
    const d = data || buildPatchData(this.S, node.face, node.level, node.ix, node.iy);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(d.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(d.normals, 3));
    g.setAttribute('aMorph', new THREE.BufferAttribute(d.morph, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(d.colors, 4, true));
    g.setAttribute('aColor2', new THREE.BufferAttribute(d.colors2, 4, true));
    g.setAttribute('aParams', new THREE.BufferAttribute(d.params, 4, true));
    g.setIndex(sharedIndex());
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), d.boundR);
    const mesh = new THREE.Mesh(g, this.material);
    mesh.position.set(d.origin[0], d.origin[1], d.origin[2]);
    mesh.matrixAutoUpdate = false; mesh.updateMatrix();
    mesh.visible = false;
    const origin = new THREE.Vector3(d.origin[0], d.origin[1], d.origin[2]);
    const anchor = new THREE.Vector3(((d.origin[0] % ANCHOR) + ANCHOR) % ANCHOR, ((d.origin[1] % ANCHOR) + ANCHOR) % ANCHOR, ((d.origin[2] % ANCHOR) + ANCHOR) % ANCHOR);
    const camRel = new THREE.Vector3();
    // level L merges into its parent at the parent's split distance
    const mergeUnit0 = node.level === 0 ? 1e12 : node.size * 2;
    const terrain = this;
    mesh.onBeforeRender = function (renderer, scene, camera, geometry, material) {
      const u = material.uniforms;
      u.uOrigin.value.copy(origin); u.uAnchor.value.copy(anchor);
      u.uCamLocal.value.copy(camRel.subVectors(terrain.camLocal, origin));
      const mergeUnit = mergeUnit0 * (1 + (node.pBoost - 1) * terrain.boostK);
      u.uMorph.value.set(mergeUnit * terrain.splitK * MORPH_A, mergeUnit * terrain.splitK * MORPH_B);
      material.uniformsNeedUpdate = true;
    };
    this.group.add(mesh);
    node.mesh = mesh;
    if (d.water) {
      const wg = new THREE.BufferGeometry();
      wg.setAttribute('position', new THREE.BufferAttribute(d.water.positions, 3));
      wg.setAttribute('aDepth', new THREE.BufferAttribute(d.water.depth, 1));
      wg.setAttribute('aLiq', new THREE.BufferAttribute(d.water.liq, 4, true));
      wg.setAttribute('aLiqP', new THREE.BufferAttribute(d.water.liqP, 4, true));
      wg.setIndex(new THREE.BufferAttribute(d.water.indices, 1));
      wg.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), d.boundR);
      const wm = new THREE.Mesh(wg, this.waterMaterial);
      wm.position.copy(mesh.position);
      wm.matrixAutoUpdate = false; wm.updateMatrix();
      wm.visible = false;
      wm.onBeforeRender = function (renderer, scene, camera, geometry, material) {
        const u = material.uniforms;
        u.uOrigin.value.copy(origin);
        u.uCamLocal.value.copy(camRel.subVectors(terrain.camLocal, origin));
        material.uniformsNeedUpdate = true;
      };
      this.group.add(wm);
      node.water = wm;
    }
    node.center.copy(origin);
    node.boundR = d.boundR;
    node.avgR = this.R + (d.minH + d.maxH) * 0.5;
    // cliffs cut across a coarse grid as a row of teeth: where a patch holds a lot of relief
    // for its size, its children are called for sooner
    node.boost = 1 + Math.min(RELIEF_MAX, Math.max(0, ((d.maxH - d.minH) / node.size - 0.10) * RELIEF_K));
    node.ready = true; node.queued = false;
    this.patchCount++;
  }

  _dispose(node) {
    if (node.children) { for (const c of node.children) this._dispose(c); node.children = null; }
    if (node.mesh) {
      this.group.remove(node.mesh);
      node.mesh.geometry.setIndex(null);
      node.mesh.geometry.dispose();
      node.mesh = null;
      this.patchCount--;
    }
    if (node.water) { this.group.remove(node.water); node.water.geometry.dispose(); node.water = null; }
    node.ready = false; node.queued = false;
  }

  _request(node) {
    if (node.ready || node.queued) return;
    node.queued = true;
    this.queue.push(node);
  }

  // Distance from the camera to the nearest point of a node: clamp the camera's position in
  // the face's (u, v) to the node's rectangle. Far tighter than a bounding sphere, which is
  // what keeps the patch count low.
  _nodeDist(node) {
    const f = FACES[node.face], c = this.camDir;
    const dn = c.x * f.n[0] + c.y * f.n[1] + c.z * f.n[2];
    if (dn > 0.2) {
      let u = Math.atan((c.x * f.u[0] + c.y * f.u[1] + c.z * f.u[2]) / dn) * (4 / Math.PI);
      let v = Math.atan((c.x * f.v[0] + c.y * f.v[1] + c.z * f.v[2]) / dn) * (4 / Math.PI);
      u = u < node.u0 ? node.u0 : u > node.u1 ? node.u1 : u;
      v = v < node.v0 ? node.v0 : v > node.v1 ? node.v1 : v;
      faceToDir(node.face, u, v, _dir);
      const r = node.avgR;
      const dx = this.camLocal.x - _dir[0] * r, dy = this.camLocal.y - _dir[1] * r, dz = this.camLocal.z - _dir[2] * r;
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    return Math.max(0, _v.copy(this.camLocal).sub(node.center).length() - node.boundR);
  }

  _select(node) {
    node.lastUsed = this.frame;
    const d = this._nodeDist(node);
    node.dist = d;
    const split = this.detail && node.level < this.maxLevel && d < this.splitK * (1 + (node.boost - 1) * this.boostK) * node.size;
    if (split) {
      if (!node.children) {
        const l = node.level + 1, x = node.ix * 2, y = node.iy * 2;
        node.children = [new Node(node.face, l, x, y, this.R), new Node(node.face, l, x + 1, y, this.R), new Node(node.face, l, x, y + 1, this.R), new Node(node.face, l, x + 1, y + 1, this.R)];
        for (const c of node.children) { c.avgR = node.avgR; c.pBoost = node.boost; }
      }
      let all = true;
      for (const c of node.children) { if (!c.ready) { all = false; c.dist = d; c.lastUsed = this.frame; this._request(c); } }
      if (all) { for (const c of node.children) this._select(c); return; }
    } else if (node.children) {
      // keep finer patches around for a while, then let them go
      let stale = true;
      for (const c of node.children) if (this.frame - c.lastUsed < KEEP_FRAMES) stale = false;
      if (stale) { for (const c of node.children) this._dispose(c); node.children = null; }
    }
    if (node.ready) this.visible.push(node);
  }

  // camLocal: camera position in this body's local frame. budgetMs: time allowed for building.
  update(camLocal, budgetMs) {
    this.frame++;
    this.splitK = SPLIT_BY_QUALITY[QUALITY.level] || 1.12;
    this.boostK = QUALITY.level === 0 ? 0.3 : 1;      // the low tier spends little on cliffs
    this.camLocal.copy(camLocal);
    this.camDir.copy(camLocal).normalize();
    for (const n of this.visible) { n.mesh.visible = false; if (n.water) n.water.visible = false; }
    this.visible.length = 0;
    for (const r of this.roots) this._select(r);
    for (const n of this.visible) { n.mesh.visible = true; if (n.water) n.water.visible = true; }
    if (!this.detail && (this.queue.length || this.job)) {
      // not the body the camera is on: nothing is wanted beyond the six root patches
      for (const n of this.queue) n.queued = false;
      this.queue.length = 0;
      if (this.jobNode) this.jobNode.queued = false;
      this.job = null; this.jobNode = null;
    }
    if ((this.queue.length || this.job) && budgetMs > 0) {
      // drop requests that are no longer wanted, then build coarse and near first
      const q = this.queue;
      for (let i = q.length - 1; i >= 0; i--) {
        if (this.frame - q[i].lastUsed > 2) { q[i].queued = false; q.splice(i, 1); }
      }
      q.sort((a, b) => (b.level - a.level) || (b.dist - a.dist));   // pop() takes coarse, near
      // patches are resumable jobs: stop the moment the slice is used up
      const deadline = performance.now() + budgetMs;
      for (;;) {
        if (!this.job) {
          let n = null;
          while (q.length && !n) { n = q.pop(); if (n.ready) n = null; }
          if (!n) break;
          this.job = beginPatch(this.S, n.face, n.level, n.ix, n.iy);
          this.jobNode = n;
        }
        const data = stepPatch(this.job, deadline);
        if (!data) break;
        const n = this.jobNode;
        this.job = null; this.jobNode = null;
        if (this.frame - n.lastUsed <= 4) this._build(n, data); else n.queued = false;
        if (performance.now() >= deadline) break;
      }
    }
  }
}
