// Where the game says "Too steep to land here" over Saturn (and Mars), on the real surface,
// obstacles and PHYSICS' ground, exactly as sim.js asks (findLandingSite with the friction rule),
// and whether flying on 100 to 150 m (what tests/trip.mjs now does) finds ground that holds.
// Usage: node steep.mjs <tree root> [body] [biome]
import path from 'node:path';
const root = process.argv[2], body = process.argv[3] || 'saturn', want = process.argv[4] || 'honey_mist';
const surface = await import(path.join(root, 'src/world/surface.js'));
const obstacles = await import(path.join(root, 'src/world/obstacles.js'));
const { Sim } = await import(path.join(root, 'src/core/sim.js'));
const { findLandingSite, SHIP } = await import(path.join(root, 'src/ship/flight.js'));
const { BODIES } = await import(path.join(root, 'src/data/bodies.js'));
const P = await import(path.join(root, 'src/physics/index.js'));
const sampleSurface = (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z);
const physics = P.createPhysics({ sampleSurface });
const sim = new Sim({ sampleSurface, getSpawn: (id) => surface.getSurface(id).getSpawn(), sampleObstacles: (id, d, r) => obstacles.sampleObstaclesPure(id, d.x, d.y, d.z, r), physics });
const R = BODIES[body].radius;
const nrm = (v) => { const l = Math.hypot(v.x, v.y, v.z); return { x: v.x / l, y: v.y / l, z: v.z / l }; };
const sp = surface.getSurface(body).getSpawn();
const c = nrm(sp.unitDir || sp);
const east = nrm({ x: c.z, y: 0, z: -c.x }), north = { x: c.y * east.z - c.z * east.y, y: c.z * east.x - c.x * east.z, z: c.x * east.y - c.y * east.x };
const at = (e, n) => nrm({ x: c.x + (east.x * e + north.x * n) / R, y: c.y + (east.y * e + north.y * n) / R, z: c.z + (east.z * e + north.z * n) / R });
const smp = sim.sampler(body);
const G = {};
const holds = (dir, g) => { const q = physics.ground(body, dir, G); return Math.tan(g.slope) < 0.8 * (q.friction || 0.6); };
const site = (d) => {
  const g = sampleSurface(body, d);
  const p = { x: d.x * (g.radius + 60), y: d.y * (g.radius + 60), z: d.z * (g.radius + 60) };
  return findLandingSite(p, smp, SHIP, sim.obstaclesNear(body, p, 80), holds, false);
};
let n = 0, bad = 0, okAfter = 0, headings = 0, headOk = 0;
const STEP = +(process.argv[5] || 60), SPAN = +(process.argv[6] || 3000);
for (let e = -SPAN; e <= SPAN; e += STEP) for (let m = -SPAN; m <= SPAN; m += STEP) {
  const d = at(e, m), g = sampleSurface(body, d);
  if (g.biomeId !== want) continue;
  n++;
  if (site(d)) continue;
  bad++;
  let any = false;
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4;
    let ok = false;
    for (const dist of [100, 130, 160]) if (site(at(e + dist * Math.cos(a), m + dist * Math.sin(a)))) { ok = true; break; }
    headings++; if (ok) { headOk++; any = true; }
  }
  if (any) okAfter++;
}
console.log(`${body} ${want}: ${n} hover spots (60 m up, every ${STEP} m within ${SPAN} m of the spawn); "too steep" at ${bad} (${(100 * bad / Math.max(1, n)).toFixed(1)} %)`);
console.log(`  of those, flying on 100 to 160 m finds ground that holds on ${headOk} of ${headings} headings (${(100 * headOk / Math.max(1, headings)).toFixed(0)} %); on at least one heading at ${okAfter} of ${bad}`);
