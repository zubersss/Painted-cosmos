// Swimming, as a player meets it (Node, PILOT's Sim with PHYSICS, 30 Hz, the real Earth): from the
// sea_coast stand walk into the sea (W toward the nearest water 2 m deep), swim out 12 s, let go 10 s,
// Shift+W 6 s, Space held 2 s, then turn round and swim and wade back out. At each clock: the weather,
// the wind, the sea's significant height; per phase the pace, the feet's rise and fall, the drift.
// node swim.mjs <root> [body=earth] [place=sea_coast] [clocks=30,8835]
const [root, body = 'earth', place = 'sea_coast', clocksS = '30,8835'] = process.argv.slice(2);
const { Sim, FEEL } = await import(root + '/src/core/sim.js');
const surface = await import(root + '/src/world/surface.js');
const obstacles = await import(root + '/src/world/obstacles.js');
const P = await import(root + '/src/physics/index.js');
const { Pad, play } = await import(root + '/tests/helpers.mjs');
const V = await import(root + '/src/core/vec.js');
const ss = (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z);
const st = surface.getStandPure(body, place).unitDir;
const R0 = ss(body, st).radius;
// bearing (compass degrees) and distance of the nearest water 2 m deep
const up = V.norm(st), east = V.norm(V.cross({ x: 0, y: 1, z: 0 }, up)), north = V.cross(up, east);
let water = null;
for (let r = 6; r <= 200 && !water; r += 3) for (let a = 0; a < 360; a += 15) {
  const c = Math.cos(a * Math.PI / 180), s = Math.sin(a * Math.PI / 180);
  const d = V.norm(V.add(up, V.scale(V.add(V.scale(north, c), V.scale(east, s)), r / R0)));
  const q = ss(body, d);
  if (q.isLiquid && q.liquidRadius - q.radius > 2) { water = { bearing: a, r }; break; }
}
console.log(`# ${body} ${place}: nearest water 2 m deep ${water ? water.r + ' m away, bearing ' + water.bearing : 'NONE'}`);
if (!water) process.exit(0);
for (const clock of clocksS.split(',').map(Number)) {
  const physics = P.createPhysics({ sampleSurface: ss });
  const sim = new Sim({ sampleSurface: ss, getSpawn: (id) => surface.getSurface(id).getSpawn(), sampleObstacles: (id, d, r) => obstacles.sampleObstaclesPure(id, d.x, d.y, d.z, r), physics, body });
  sim.t = clock;
  sim.teleport({ body, dir: [st.x, st.y, st.z], heading: water.bearing, hour: 11 });
  const pad = new Pad(); play(sim, pad, 1, { fps: 30 });
  const h = physics.here, w = {};
  physics.water(body, sim.ex.p, w);
  console.log(`## clock ${clock}: weather ${h.weather.kind} (${h.weather.intensity01.toFixed(2)}), wind ${h.air.speed.toFixed(1)} m/s, sea Hs ${w.present ? w.significant.toFixed(2) : '-'} m, period ${w.present && w.period ? w.period.toFixed(1) : '-'} s`);
  const phase = (name, secs, keys, opts = {}) => {
    pad.releaseAll(); for (const k of keys) pad.press(k);
    const p0 = { ...sim.ex.p }; const rs = [], vs = [], modes = {}; let swimT = 0, grT = 0, n = 0, maxV = 0, liqR = 0;
    const t = play(sim, pad, secs, { fps: 30, each: () => {
      const s = ss(body, V.norm(sim.ex.p)); liqR = s.liquidRadius || 0;
      rs.push(V.len(sim.ex.p) - liqR); vs.push(sim.ex.speed); modes[sim.ex.mode] = (modes[sim.ex.mode] || 0) + 1; n++;
      if (sim.ex.swimming) swimT++; if (sim.ex.grounded) grT++; maxV = Math.max(maxV, sim.ex.speed);
    }, until: opts.until });
    const made = V.len(V.sub(sim.ex.p, p0));
    const mean = vs.reduce((a, b) => a + b, 0) / Math.max(1, vs.length);
    const lo = Math.min(...rs), hi = Math.max(...rs);
    console.log(`  ${name.padEnd(26)} ${t.toFixed(1)} s: ${made.toFixed(1)} m made, pace mean ${mean.toFixed(2)} max ${maxV.toFixed(2)} m/s; feet ${lo.toFixed(2)} .. ${hi.toFixed(2)} m against the still level; swimming ${(100 * swimT / n).toFixed(0)} %, grounded ${(100 * grT / n).toFixed(0)} %; modes ${JSON.stringify(modes)}; depth ${sim.ex.liquidDepth.toFixed(2)}`);
    return { t, made };
  };
  phase('walk in (W) until afloat', 60, ['KeyW'], { until: () => sim.ex.swimming });
  phase('swim out (W)', 12, ['KeyW']);
  phase('let go', 10, []);
  phase('swim (Shift+W)', 6, ['KeyW', 'ShiftLeft']);
  phase('Space held', 2, ['Space']);
  phase('after Space, let go', 4, []);
  pad.dx += Math.PI / FEEL.mouseFoot;      // turn round
  phase('back to the shore (W)', 90, ['KeyW'], { until: () => sim.ex.grounded && sim.ex.liquidDepth < 0.05 });
}
