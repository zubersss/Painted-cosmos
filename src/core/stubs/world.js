// STUB world: every body as a plain shaded noise sphere, behind the exact contract of
// src/world/index.js (plus COORDINATOR.md C1-C5 and C11). It exists so that Pilot never waits
// for Painter. It is not art and is never shown to players once the real world loads.
//
// Terrain is a small cube-sphere quadtree: chunks are built on the CPU from the same height
// function sampleSurface uses, so what you walk on is what you see.
import * as THREE from 'three';
import { BODIES, BODY_IDS, SUN } from '../../data/bodies.js';
import { stubSurface, stubHeight, stubParams, stubSpawn, stubVistas, noise3 } from './surface.js';

const N = 24;                       // quads per chunk side
const SPLIT = 1.9;                  // split a node when the camera is closer than SPLIT * its size
const LEAF_METRES = 26;             // stop splitting at about this chunk size
const BUILD_MS = 5;                 // CPU budget per frame for building chunks
const MAX_CHUNKS = 520;             // cache size before old chunks are disposed

// Paper-toned mock palette per body: [low, high, liquid]. Just enough to tell them apart.
const TINT = {
  mercury: [0xb9a58a, 0xd9cdb8, 0x000000], venus: [0xcdb267, 0xe6d6a0, 0xc28a3a],
  earth: [0x9db38a, 0xcfc9b2, 0x8fb2c4], moon: [0xb8b8b4, 0xdcdad2, 0x000000],
  mars: [0xc58f6c, 0xe0c0a2, 0x000000], jupiter: [0xd9b98c, 0xeedfc4, 0xd6a36a],
  saturn: [0xdcc88e, 0xf0e6c4, 0xd9bd72], uranus: [0xa9d2c8, 0xdcefe8, 0x7fbfc0],
  neptune: [0x8fa6cf, 0xcdd8ea, 0x4f6fb0], pluto: [0xc9bfc9, 0xe8e2e6, 0x000000],
};

const FACES = [
  [[1, 0, 0], [0, 0, -1], [0, 1, 0]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
  [[0, 1, 0], [1, 0, 0], [0, 0, -1]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
  [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
];

function cubeDir(face, u, v, out) {
  const [n, a, b] = FACES[face];
  const x = n[0] + a[0] * u + b[0] * v, y = n[1] + a[1] * u + b[1] * v, z = n[2] + a[2] * u + b[2] * v;
  const l = Math.hypot(x, y, z);
  out[0] = x / l; out[1] = y / l; out[2] = z / l;
  return out;
}

class Node {
  constructor(face, level, ix, iy) {
    this.face = face; this.level = level; this.ix = ix; this.iy = iy;
    this.children = null; this.mesh = null; this.water = null; this.used = 0;
    const span = 2 / (1 << level);
    this.u0 = -1 + ix * span; this.v0 = -1 + iy * span; this.span = span;
    const c = cubeDir(face, this.u0 + span / 2, this.v0 + span / 2, [0, 0, 0]);
    this.centerDir = new THREE.Vector3(c[0], c[1], c[2]);
  }
}

function buildChunk(body, node, materials) {
  const P = stubParams(body.id);
  const R = P.R;
  const M = N + 3;                                  // one extra ring for seamless normals
  const pos = new Float64Array(M * M * 3);
  const hgt = new Float32Array(M * M);
  const d = [0, 0, 0];
  const step = node.span / N;
  let minH = Infinity;
  for (let j = 0; j < M; j++) {
    for (let i = 0; i < M; i++) {
      cubeDir(node.face, node.u0 + (i - 1) * step, node.v0 + (j - 1) * step, d);
      const h = stubHeight(body.id, d[0], d[1], d[2]);
      const k = (j * M + i) * 3;
      pos[k] = d[0] * (R + h); pos[k + 1] = d[1] * (R + h); pos[k + 2] = d[2] * (R + h);
      hgt[j * M + i] = h;
      if (h < minH) minH = h;
    }
  }
  const cx = node.centerDir.x * R, cy = node.centerDir.y * R, cz = node.centerDir.z * R;
  const V1 = N + 1;
  const vcount = V1 * V1 + 4 * V1;                  // grid + skirts
  const positions = new Float32Array(vcount * 3);
  const normals = new Float32Array(vcount * 3);
  const colors = new Float32Array(vcount * 3);
  const tint = TINT[body.id] || TINT.moon;
  const lo = new THREE.Color(tint[0]), hi = new THREE.Color(tint[1]);
  const col = new THREE.Color();
  for (let j = 0; j < V1; j++) {
    for (let i = 0; i < V1; i++) {
      const m = (j + 1) * M + (i + 1), k = m * 3, o = (j * V1 + i) * 3;
      positions[o] = pos[k] - cx; positions[o + 1] = pos[k + 1] - cy; positions[o + 2] = pos[k + 2] - cz;
      // Normal from the neighbours on the extended grid.
      const l = k - 3, r = k + 3, dn = k - M * 3, up = k + M * 3;
      const ax = pos[r] - pos[l], ay = pos[r + 1] - pos[l + 1], az = pos[r + 2] - pos[l + 2];
      const bx = pos[up] - pos[dn], by = pos[up + 1] - pos[dn + 1], bz = pos[up + 2] - pos[dn + 2];
      let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl; ny /= nl; nz /= nl;
      const pl = Math.hypot(pos[k], pos[k + 1], pos[k + 2]);
      if (nx * pos[k] + ny * pos[k + 1] + nz * pos[k + 2] < 0) { nx = -nx; ny = -ny; nz = -nz; }
      normals[o] = nx; normals[o + 1] = ny; normals[o + 2] = nz;
      // Mock wash: value by height and slope, with a mottle that is fixed to the ground so
      // movement is readable.
      const h = hgt[m];
      const upDot = (nx * pos[k] + ny * pos[k + 1] + nz * pos[k + 2]) / pl;
      const t = Math.min(1, Math.max(0, (h + P.relief * 0.4) / (P.relief * 1.6 + P.ridge * 0.6)));
      col.copy(lo).lerp(hi, t);
      const mott = 0.92 + 0.08 * noise3(pos[k] * 0.35, pos[k + 1] * 0.35, pos[k + 2] * 0.35, 9)
        + 0.05 * noise3(pos[k] * 0.02, pos[k + 1] * 0.02, pos[k + 2] * 0.02, 5);
      const steep = 1 - 0.45 * Math.min(1, Math.max(0, (1 - upDot) * 3.2));
      const polar = Math.max(0, Math.min(1, (Math.abs(pos[k + 1] / pl) - 0.72) / 0.18));
      const s = mott * steep;
      colors[o] = Math.min(1, col.r * s + polar * 0.25);
      colors[o + 1] = Math.min(1, col.g * s + polar * 0.25);
      colors[o + 2] = Math.min(1, col.b * s + polar * 0.27);
    }
  }
  // Skirts hide the cracks between chunks of different detail.
  const drop = Math.max(2, (node.span * R * 0.5) * 0.12);
  let sv = V1 * V1;
  const addSkirt = (gi) => {
    const o = gi * 3, k = sv * 3;
    const px = positions[o] + cx, py = positions[o + 1] + cy, pz = positions[o + 2] + cz;
    const pl = Math.hypot(px, py, pz), f = (pl - drop) / pl;
    positions[k] = px * f - cx; positions[k + 1] = py * f - cy; positions[k + 2] = pz * f - cz;
    normals[k] = normals[o]; normals[k + 1] = normals[o + 1]; normals[k + 2] = normals[o + 2];
    colors[k] = colors[o]; colors[k + 1] = colors[o + 1]; colors[k + 2] = colors[o + 2];
    return sv++;
  };
  const index = [];
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const a = j * V1 + i, b = a + 1, c = a + V1, e = c + 1;
      index.push(a, b, c, b, e, c);
    }
  }
  const strip = (list, flip) => {
    const sk = list.map(addSkirt);
    for (let i = 0; i < list.length - 1; i++) {
      const a = list[i], b = list[i + 1], c = sk[i], e = sk[i + 1];
      if (flip) index.push(a, c, b, b, c, e); else index.push(a, b, c, b, e, c);
    }
  };
  const row = (j) => Array.from({ length: V1 }, (_, i) => j * V1 + i);
  const colm = (i) => Array.from({ length: V1 }, (_, j) => j * V1 + i);
  strip(row(0), true); strip(row(N), false); strip(colm(0), false); strip(colm(N), true);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(index);
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, materials.land);
  mesh.position.set(cx, cy, cz);
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  mesh.visible = false;
  node.mesh = mesh;

  if (P.seaLevel !== null && minH < P.seaLevel) {
    const wpos = new Float32Array(V1 * V1 * 3), wnor = new Float32Array(V1 * V1 * 3);
    const RW = R + P.seaLevel;
    for (let j = 0; j < V1; j++) {
      for (let i = 0; i < V1; i++) {
        const k = ((j + 1) * M + (i + 1)) * 3, o = (j * V1 + i) * 3;
        const pl = Math.hypot(pos[k], pos[k + 1], pos[k + 2]);
        const x = pos[k] / pl, y = pos[k + 1] / pl, z = pos[k + 2] / pl;
        wpos[o] = x * RW - cx; wpos[o + 1] = y * RW - cy; wpos[o + 2] = z * RW - cz;
        wnor[o] = x; wnor[o + 1] = y; wnor[o + 2] = z;
      }
    }
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.BufferAttribute(wpos, 3));
    wg.setAttribute('normal', new THREE.BufferAttribute(wnor, 3));
    wg.setIndex(index.slice(0, N * N * 6));
    wg.computeBoundingSphere();
    const water = new THREE.Mesh(wg, materials.water);
    water.position.set(cx, cy, cz);
    water.matrixAutoUpdate = false;
    water.updateMatrix();
    water.visible = false;
    node.water = water;
  }
}

class StubBody {
  constructor(id, scene) {
    this.id = id;
    this.data = BODIES[id];
    this.root = new THREE.Group();
    this.root.name = 'stub-body-' + id;
    scene.add(this.root);
    const tint = TINT[id] || TINT.moon;
    this.materials = {
      land: new THREE.MeshLambertMaterial({ vertexColors: true }),
      water: new THREE.MeshLambertMaterial({ color: tint[2] || 0x8fb2c4 }),
    };
    this.maxLevel = Math.max(1, Math.round(Math.log2(((Math.PI / 2) * this.data.radius) / LEAF_METRES)));
    this.roots = [];
    for (let f = 0; f < 6; f++) {
      const n = new Node(f, 0, 0, 0);
      buildChunk(this, n, this.materials);
      this.attach(n);
      this.roots.push(n);
    }
    this.queue = [];
    this.chunks = 6;
    this.pending = 0;
  }

  attach(n) { this.root.add(n.mesh); if (n.water) this.root.add(n.water); }

  show(n, on, frame) {
    n.mesh.visible = on;
    if (n.water) n.water.visible = on;
    if (on) n.used = frame;
  }

  hideTree(n) {
    if (n.mesh) this.show(n, false);
    if (n.children) for (const c of n.children) this.hideTree(c);
  }

  // Returns true when this node (or its descendants) fully covers its area with ready meshes.
  visit(n, cam, frame) {
    const size = (Math.PI / 2) * this.data.radius * n.span * 0.5;
    const R = this.data.radius;
    const dx = cam.x - n.centerDir.x * R, dy = cam.y - n.centerDir.y * R, dz = cam.z - n.centerDir.z * R;
    const dist = Math.hypot(dx, dy, dz);
    const wantSplit = n.level < this.maxLevel && dist < size * SPLIT;
    if (wantSplit) {
      if (!n.children) {
        n.children = [];
        for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
          n.children.push(new Node(n.face, n.level + 1, n.ix * 2 + i, n.iy * 2 + j));
        }
      }
      let ready = true;
      for (const c of n.children) {
        if (!c.mesh) { ready = false; if (!c.queued) { c.queued = true; this.queue.push({ node: c, dist }); } }
      }
      if (ready) {
        this.show(n, false);
        for (const c of n.children) this.visit(c, cam, frame);
        return;
      }
      this.pending++;
    }
    this.show(n, true, frame);
    if (n.children) for (const c of n.children) this.hideTree(c);
  }

  update(camLocal, frame, deadline) {
    this.pending = 0;
    for (const q of this.queue) q.node.queued = false;     // only build what is still wanted
    this.queue.length = 0;
    for (const n of this.roots) this.visit(n, camLocal, frame);
    if (this.queue.length) {
      this.queue.sort((a, b) => b.dist - a.dist);            // nearest last, popped first
      while (this.queue.length && performance.now() < deadline) {
        const { node } = this.queue.pop();
        node.queued = false;
        if (!node.mesh) { buildChunk(this, node, this.materials); this.attach(node); this.chunks++; }
      }
    }
    if (this.chunks > MAX_CHUNKS) this.prune(frame);
  }

  prune(frame) {
    const walk = (n) => {
      if (!n.children) return;
      let leafKids = true;
      for (const c of n.children) { walk(c); if (c.children) leafKids = false; }
      if (leafKids && n.children.every((c) => !c.mesh || (!c.mesh.visible && frame - c.used > 240 && !c.queued))) {
        for (const c of n.children) {
          if (c.mesh) { this.root.remove(c.mesh); c.mesh.geometry.dispose(); this.chunks--; }
          if (c.water) { this.root.remove(c.water); c.water.geometry.dispose(); }
        }
        n.children = null;
      }
    };
    for (const n of this.roots) walk(n);
  }
}

export function createWorld(scene) {
  const bodies = new Map();
  const stubBodies = new Map();
  for (const id of BODY_IDS) {
    const sb = new StubBody(id, scene);
    stubBodies.set(id, sb);
    bodies.set(id, sb.root);
  }

  // The sun: bare paper. It carries the stub's only strong light, so every body is lit from
  // the direction of the sun as seen from that body (phases come out right).
  const sun = new THREE.Group();
  sun.name = 'stub-sun';
  sun.add(new THREE.Mesh(new THREE.SphereGeometry(SUN.radius, 32, 16), new THREE.MeshBasicMaterial({ color: 0xfff7e2 })));
  const light = new THREE.PointLight(0xfff4e0, 3.0, 0, 0);
  sun.add(light);
  scene.add(sun);
  const fill = new THREE.HemisphereLight(0xdfe4f2, 0x8a8478, 0.9);
  scene.add(fill);

  // Spattered stars so that turning in space can be seen. They ride with the camera.
  const starPos = new Float32Array(900 * 3);
  let rng = 12345;
  const rand = () => { rng = (Math.imul(rng, 1664525) + 1013904223) | 0; return (rng >>> 0) / 4294967296; };
  for (let i = 0; i < 900; i++) {
    const y = rand() * 2 - 1, a = rand() * Math.PI * 2, r = Math.sqrt(1 - y * y);
    starPos.set([Math.cos(a) * r * 9e5, y * 9e5, Math.sin(a) * r * 9e5], i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  const starMat = new THREE.PointsMaterial({ color: 0xf4efe4, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false });
  const stars = new THREE.Points(starGeo, starMat);
  stars.name = 'stub-stars';
  stars.renderOrder = -10;
  scene.add(stars);

  let frame = 0;
  const camLocal = new THREE.Vector3();
  const forcedTime = {};
  const found = {};
  let settled = false;

  return {
    isStub: true,
    bodies,
    sun,
    // Stub extra, read by the stub painter only: how much of the sky is space (0..1).
    setSpaceAmount(a) { starMat.opacity = Math.max(0, Math.min(1, a)); stars.visible = a > 0.01; },
    update(dt, cameraPos, activeBodyId) {
      frame++;
      stars.position.copy(cameraPos);
      const deadline = performance.now() + BUILD_MS;
      let pending = 0;
      // The active body first so its chunks get the build budget.
      const order = activeBodyId && stubBodies.has(activeBodyId)
        ? [activeBodyId, ...BODY_IDS.filter((i) => i !== activeBodyId)] : BODY_IDS;
      for (const id of order) {
        const sb = stubBodies.get(id);
        sb.root.updateMatrixWorld(true);
        camLocal.copy(cameraPos);
        sb.root.worldToLocal(camLocal);
        sb.update(camLocal, frame, deadline);
        pending += sb.pending + sb.queue.length;
      }
      settled = pending === 0;
    },
    // Additive suggestion for the real world too: true when no terrain work is outstanding.
    isSettled() { return settled; },
    sampleSurface(bodyId, unitDir) {
      const s = stubSurface(bodyId, unitDir);
      s.normal = new THREE.Vector3(s.normal.x, s.normal.y, s.normal.z);
      return s;
    },
    getVistas(bodyId) { return stubVistas(bodyId).map((v) => ({ ...v, unitDir: new THREE.Vector3(v.unitDir.x, v.unitDir.y, v.unitDir.z) })); },
    getSpawn(bodyId) { const s = stubSpawn(bodyId).unitDir; return { unitDir: new THREE.Vector3(s.x, s.y, s.z) }; },
    setTime(bodyId, hours) { forcedTime[bodyId] = hours; },
    setVistaFound(bodyId, vistaId, isFound) { found[bodyId + ':' + vistaId] = !!isFound; },
    _debug: { stubBodies, forcedTime, found },
  };
}
