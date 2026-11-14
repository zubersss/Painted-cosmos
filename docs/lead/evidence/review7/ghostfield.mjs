// Review 7 (code), finding 1: the explorer's ghost run (src/physics/explorer.js wayAhead -> probeTrial -> ghostCrosses ->
// stepExplorerBody) overwrites the step's own module scratch (_dir, _gnd). A run at 6 m/s through a row of eight boulders
// (PILOT's scrambleSample, as the game builds the explorer's ground: src/core/sim.js:509), at three places on a 4 km sphere.
// Prints, per tree: the worst speed lost in one step, the largest radial speed while grounded (0 on a sphere of level
// ground: the velocity lies in the ground), how far the run strays sideways off its line, and the grounded steps whose
// reported material is not the ground under the feet (rock on a boulder, sand elsewhere).
//   node docs/lead/evidence/review7/ghostfield.mjs [tree ...]     (default: this repository; a tree = a folder with src/)
// Measured 2026-11-12 on a clean export of 98edfcd: see docs/lead/REVIEW.md, "Review 7 (code)".
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const trees = process.argv.slice(2).length ? process.argv.slice(2).map((t) => path.resolve(t)) : [path.resolve(here, '../../../..')];
const V = (x = 0, y = 0, z = 0) => ({ x, y, z });
const norm = (v) => { const l = Math.hypot(v.x, v.y, v.z); return V(v.x / l, v.y / l, v.z / l); };
const cross = (a, b) => V(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const ROCK = { material: 'rock', friction: 0.9, kinetic: 0.7, foothold: 0.4, restitution: 0.1, sink: 0, drag: 0, dust: 0.03 };
const SAND = { material: 'sand', friction: 0.6, kinetic: 0.5, foothold: 0.2, restitution: 0.05, sink: 0.05, drag: 0.25, dust: 0.6 };
const R = 4000;
// boulders [metres along the line, metres off it, height, radius]
const FIELD = [[6, 0, 1, 0.6], [8.6, 0.3, 0.9, 0.6], [11.4, -0.4, 1.1, 0.6], [14.0, 0.5, 1, 0.6], [16.6, 0, 0.8, 0.6], [19.4, -0.3, 1.2, 0.6], [22.2, 0.2, 1, 0.6], [25, 0, 1, 0.6]];
const PLACES = { '(0.3, 0.9, 0.3)': V(0.3, 0.9, 0.3), '(0.8, 0.2, -0.55)': V(0.8, 0.2, -0.55), '(0, 0, 1): the plane PHYSICS\' P17 test runs in': V(0, 0, 1) };

async function run(tree, place, g) {
  const E = await import(pathToFileURL(path.join(tree, 'src/physics/explorer.js')).href);
  const P = await import(pathToFileURL(path.join(tree, 'src/player/explorer.js')).href);
  const u0 = norm(place), h0 = norm(cross(cross(u0, V(0.2, 1, 0.1)), u0)), n0 = cross(u0, h0);
  const at = (s, o) => { const c = Math.cos(s / R), sn = Math.sin(s / R); return norm(V(u0.x * c + h0.x * sn + n0.x * o / R, u0.y * c + h0.y * sn + n0.y * o / R, u0.z * c + h0.z * sn + n0.z * o / R)); };
  const obs = FIELD.map(([s, o, h, r]) => ({ unitDir: at(s, o), radius: r, height: h }));
  const sample = P.scrambleSample((d) => ({ radius: R, normal: V(d.x, d.y, d.z), liquidRadius: 0 }), () => obs);
  const env = { sample, gravity: g, ground: (s, out) => Object.assign(out, s.radius > R + 0.01 ? ROCK : SAND) };
  const p0 = at(0, 0), st = { p: V(p0.x * R, p0.y * R, p0.z * R), v: V(), grounded: true };
  let worst = 0, vPrev = 0, radial = 0, side = 0, wrong = 0, air = 0;
  for (let i = 0; i < 60 * 9; i++) {
    const u = norm(st.p), t = Math.atan2(dot(u, h0), dot(u, u0));
    const tg = V(-u0.x * Math.sin(t) + h0.x * Math.cos(t), -u0.y * Math.sin(t) + h0.y * Math.cos(t), -u0.z * Math.sin(t) + h0.z * Math.cos(t));
    E.stepExplorerBody(st, { wish: V(tg.x * 6, tg.y * 6, tg.z * 6) }, 1 / 60, env);
    const B = st.phys, v = B.speedGround, uu = norm(st.p);
    if (t * R > 2) {
      worst = Math.max(worst, vPrev - v);
      if (st.grounded) radial = Math.max(radial, Math.abs(dot(st.v, uu))); else air++;
      side = Math.max(side, Math.abs(dot(uu, n0)) * R);
      if (st.grounded && B.material !== (sample(uu).radius > R + 0.01 ? 'rock' : 'sand')) wrong++;
    }
    vPrev = v;
  }
  return { worstStepLoss: +worst.toFixed(2), radialWhileGrounded: +radial.toFixed(2), offLine: +side.toFixed(2), wrongMaterialSteps: wrong, stepsInAir: air };
}
for (const [name, pl] of Object.entries(PLACES)) for (const g of [9.81, 1.62]) {
  console.log(`\nplace ${name}, g ${g}`);
  for (const tree of trees) console.log(`  ${path.basename(tree).padEnd(12)} ${JSON.stringify(await run(tree, pl, g))}`);
}
