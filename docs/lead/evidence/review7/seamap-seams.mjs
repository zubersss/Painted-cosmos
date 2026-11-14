// Review 7 (code), findings 2 and 3: the sea map (src/physics/seamap.js, water.js) seen from FIXED places on the ground
// while the focus walks along a coast at 6 m/s for 150 s (two re-anchors of the frame, index.js QUALITY.reanchor 384 m).
//   A. one-frame steps (finding 3): a coast with lagoons behind barriers; physics.water() at a place 60 m out and one in a
//      lagoon, every frame; lists the frames whose significant height steps by more than 0.02 m or whose wave way turns by
//      more than 2.9 degrees, with whether that frame published a build and whether the shown grid moved.
//   B. the warp after a re-anchor (finding 2): an oblique beach (the map turns the waves toward it); the warp at a place
//      50 m out, 40 m behind the walker: how far it moves in the 5 s after each re-anchor against a typical 5 s.
//   node docs/lead/evidence/review7/seamap-seams.mjs [tree ...]   (default: this repository; a tree = a folder with src/)
// Measured 2026-11-12 on a clean export of 98edfcd: see docs/lead/REVIEW.md, "Review 7 (code)".
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const trees = process.argv.slice(2).length ? process.argv.slice(2).map((t) => path.resolve(t)) : [path.resolve(here, '../../../..')];

async function load(tree) {
  const imp = (p) => import(pathToFileURL(path.join(tree, p)).href);
  const [phys, tw, wind, bodies] = await Promise.all(['src/physics/index.js', 'src/physics/testworld.mjs', 'src/physics/wind.js', 'src/data/bodies.js'].map(imp));
  wind.setWindScale('earth', 0.25);
  return { createPhysics: phys.createPhysics, coastWorld: tw.coastWorld, norm: tw.norm, V: tw.V, RE: bodies.BODIES.earth.radius };
}

async function steps(tree) {
  const { createPhysics, coastWorld, norm, V, RE } = await load(tree), C = norm(V(0.6, 0.04, 0.8));
  const inLag = (v) => ((v % 400) + 400) % 400 < 260;
  const f = (u, v) => (u >= 0 && u < 24 && inLag(v) ? 1.5 : u > -160 && u < 0 && inLag(v) ? -3 : u < 0 ? 4 : -Math.min(20, 0.5 + 0.07 * u));
  const probe = createPhysics({ sampleSurface: (id, q) => ({ radius: RE - 30, liquidRadius: RE, normal: q, slope: 0, biomeId: 'sea_coast', biomeWeights: { sea_coast: 1 } }), timeBudget: false });
  const P0 = V(C.x * (RE + 1.5), C.y * (RE + 1.5), C.z * (RE + 1.5));
  for (let i = 0; i < 30; i++) probe.update(1 / 30, { bodyId: 'earth', time: 300 + i / 30, focus: P0 });
  const world = coastWorld(C, f, { R: RE, turn: Math.atan2(-probe.fields.air.cwn, -probe.fields.air.cwe) });
  const physics = createPhysics({ sampleSurface: (id, q) => world(q), timeBudget: false });
  void physics.fields.water.uniforms.uPhysSeaMap;      // as PAINTER's shader will once it reads the map
  const W = physics.fields.water.field, M = physics.fields.water.map;
  const pts = { '60 m out': [60, 0], lagoon: [-80, 100] };
  for (const k of Object.keys(pts)) { const d = world.at(...pts[k]); pts[k] = V(d.x * RE, d.y * RE, d.z * RE); }
  let prev = null, pv = -1, px0 = 0, pz0 = 0, ra = 0;
  const ev = [], other = [];
  for (let i = 0; i < 150 * 30; i++) {
    const t = i / 30, fd = world.at(-6, -380 + 6 * t);
    physics.update(1 / 30, { bodyId: 'earth', time: 300 + t, focus: V(fd.x * (RE + 1.5), fd.y * (RE + 1.5), fd.z * (RE + 1.5)) });
    const g = W.uniforms.uPhysSeaGrid, cur = {};
    for (const [k, p] of Object.entries(pts)) { const o = physics.water('earth', p, {}); cur[k] = { Hs: o.significant, dir: Math.atan2(o.dir.y, o.dir.x) }; }
    const build = M.target.version !== pv, moved = g[0] !== px0 || g[1] !== pz0, re = physics.stats.reanchors !== ra;
    if (prev && t > 30) for (const k of Object.keys(pts)) {
      const dH = cur[k].Hs - prev[k].Hs, dd = Math.atan2(Math.sin(cur[k].dir - prev[k].dir), Math.cos(cur[k].dir - prev[k].dir)) * 180 / Math.PI;
      if (Math.abs(dH) > 0.02 || Math.abs(dd) > 2.9) ev.push({ t: +t.toFixed(2), place: k, dHs: +dH.toFixed(3), dWayDeg: +dd.toFixed(1), publishedBuild: build, shownGridMoved: moved, reanchorThisSecond: re });
      else if (!build) other.push(Math.abs(dH));
    }
    prev = cur; pv = M.target.version; px0 = g[0]; pz0 = g[1]; ra = physics.stats.reanchors;
  }
  other.sort((a, b) => a - b);
  return { stepsOver: ev.length, onABuildFrame: ev.filter((e) => e.publishedBuild).length, p99OtherFramesHs: +other[Math.floor(other.length * 0.99)].toFixed(4), worst: ev.sort((a, b) => Math.abs(b.dHs) * 100 + Math.abs(b.dWayDeg) - Math.abs(a.dHs) * 100 - Math.abs(a.dWayDeg)).slice(0, 4) };
}

async function warp(tree) {
  const { createPhysics, coastWorld, norm, V, RE } = await load(tree), C = norm(V(0.6, 0.04, 0.8));
  const f = (u, v) => { const s = u * 0.8 + v * 0.6; return s < 0 ? 3 : -Math.min(20, 0.3 + 0.03 * s); };
  const world = coastWorld(C, f, { R: RE, turn: 0 });
  const physics = createPhysics({ sampleSurface: (id, q) => world(q), timeBudget: false });
  void physics.fields.water.uniforms.uPhysSeaMap;
  const W = physics.fields.water.field, F = physics.fields.frame;
  let ra = 0, prevW = null;
  const s = [];
  for (let i = 0; i < 150 * 30; i++) {
    const t = i / 30, a = -380 + 6 * t, fd = world.at(-4 * 0.8 - 0.6 * a, -4 * 0.6 + 0.8 * a);
    physics.update(1 / 30, { bodyId: 'earth', time: 300 + t, focus: V(fd.x * (RE + 1.5), fd.y * (RE + 1.5), fd.z * (RE + 1.5)) });
    const b = a - 40, d = world.at(50 * 0.8 - 0.6 * b, 50 * 0.6 + 0.8 * b), p = V(d.x * RE, d.y * RE, d.z * RE);
    const m = W._mapOn ? W._seaAt(F.lx(p.x, p.y, p.z), F.lz(p.x, p.y, p.z)) : null, w = m ? [m[12], m[13]] : null;
    if (w && prevW && t > 30) s.push({ t, dw: Math.hypot(w[0] - prevW[0], w[1] - prevW[1]), re: physics.stats.reanchors !== ra });
    prevW = w; ra = physics.stats.reanchors;
  }
  const reT = s.filter((x) => x.re).map((x) => x.t), sum = (q) => q.reduce((x, y) => x + y, 0);
  const after = reT.map((r) => +sum(s.filter((x) => x.t >= r && x.t < r + 5).map((x) => x.dw)).toFixed(2));
  const rest = s.filter((x) => !reT.some((r) => x.t >= r && x.t < r + 5)).map((x) => x.dw);
  return { reanchorsAt: reT.map((x) => +x.toFixed(1)), warpMovedIn5sAfterEach: after, warpMovedInTypical5s: +(sum(rest) / (rest.length / 150)).toFixed(2) };
}

for (const tree of trees) {
  console.log(`\n== ${tree}`);
  console.log('A. one-frame steps at fixed places:', JSON.stringify(await steps(tree)));
  console.log('B. the warp after a re-anchor (m):', JSON.stringify(await warp(tree)));
}
