// The ship's ride, measured step by step in PILOT's Sim in Node on the real world, PHYSICS and
// obstacles: PHYSICS' critique items 1 to 3 on PILOT (lift-off under trees, the landing assist,
// the ground assist). For each phase: the largest move of the hull in one step beyond its own
// velocity (a clamp), the largest change of velocity in one step, the accelerations from the
// positions (second differences: what a camera fixed to the hull shows).
// Usage: ROOT=<tree> [HZ=60] node shipfeel.mjs [liftoff,low,landfast,landslow,abort,nepship] [-v]
const R = process.env.ROOT, HZ = Number(process.env.HZ || 60);
const { Sim, FEEL } = await import(R + '/src/core/sim.js');
const { S } = await import(R + '/src/core/state.js');
const { Pad, play, len, dot, norm, sub } = await import(R + '/tests/helpers.mjs');
const surface = await import(R + '/src/world/surface.js');
const obstacles = await import(R + '/src/world/obstacles.js');
const { createPhysics } = await import(R + '/src/physics/index.js');
const RAD = Math.PI / 180;
const ss = (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z);
const obs = (id, d, r) => obstacles.sampleObstaclesPure(id, d.x, d.y, d.z, r);
const want = (process.argv[2] || 'liftoff,low,landfast,landslow,abort,nepship').split(','), verbose = process.argv.includes('-v');
const f2 = (x) => (x == null ? '-' : (+x).toFixed(2));
function mk(body = 'earth') {
  const physics = createPhysics({ sampleSurface: ss, timeBudget: false });
  const sim = new Sim({ sampleSurface: ss, getSpawn: (id) => surface.getSurface(id).getSpawn(), sampleObstacles: obs, physics, body });
  const pad = new Pad();
  const P = (s, o = {}) => play(sim, pad, s, { fps: HZ, ...o });
  const holdPitch = (deg, g = 0.12) => { const e = deg - sim.info().ship.pitchDeg; pad.dy -= Math.max(-40, Math.min(40, (e * RAD / FEEL.mouseShip) * g)); };
  return { sim, pad, P, holdPitch, physics };
}
// a recorder of the hull, step by step
function rec(sim) {
  const R = { rows: [], lastV: null, lastP: null, lastT: null };
  R.each = () => {
    const sh = sim.sh, up = norm(sh.p), t = sim.t, dt = R.lastT == null ? 0 : t - R.lastT;
    const row = { t, st: sim.sm.state, v: len(sh.v), vUp: dot(sh.v, up), hAG: sh.altGround, h: len(sh.p) - ss(sim.shFrame.id, up).radius, dv: 0, dvUp: 0, hop: 0, lift: !!sh.liftoff, land: sh.landing ? sh.landing.phase || 'y' : '-' };
    if (R.lastV && dt > 0) {
      const d = sub(sh.v, R.lastV); row.dv = len(d); row.dvUp = dot(d, up);
      // how far the hull moved this step beyond its own velocity (mean of before and after): a clamp, a teleport
      const mv = sub(sh.p, R.lastP), exp = { x: (sh.v.x + R.lastV.x) * 0.5 * dt, y: (sh.v.y + R.lastV.y) * 0.5 * dt, z: (sh.v.z + R.lastV.z) * 0.5 * dt };
      row.hop = len(sub(mv, exp));
    }
    R.lastV = { ...sh.v }; R.lastP = { ...sh.p }; R.lastT = t;
    R.rows.push(row);
    if (verbose) console.log(`${f2(t)} ${row.st} h ${f2(row.h)} hAG ${f2(row.hAG)} v ${f2(row.v)} vUp ${f2(row.vUp)} dv ${f2(row.dv)} hop ${f2(row.hop)} ${row.lift ? 'L' : '-'} ${row.land}`);
  };
  return R;
}
function report(name, R, extra = '') {
  const rows = R.rows.slice(2), mx = (k) => rows.reduce((m, r) => (Math.abs(r[k]) > Math.abs(m[k]) ? r : m), rows[0]);
  const a = mx('dv'), b = mx('hop'), c = mx('dvUp');
  // accelerations from the positions (what the picture shows): second differences of the height over the ground's datum
  console.log(`${name}: largest velocity step ${f2(a.dv)} m/s (${f2(a.dv * HZ / 9.81)} g) at ${f2(a.t)} s; vertical ${f2(c.dvUp)} m/s (${f2(Math.abs(c.dvUp) * HZ / 9.81)} g); largest move beyond the velocity ${f2(b.hop)} m at ${f2(b.t)} s; vUp ${f2(Math.min(...rows.map((r) => r.vUp)))}..${f2(Math.max(...rows.map((r) => r.vUp)))} m/s; height over the ground ${f2(Math.min(...rows.map((r) => r.h)))}..${f2(Math.max(...rows.map((r) => r.h)))} m ${extra}`);
}
function toShipAndBoard(o) {
  const { sim, pad, P } = o;
  sim.t = 14.8; P(0.5);
  pad.dx += (sim.info().shipBearingDeg * RAD) / FEEL.mouseFoot; P(0.2);
  pad.press('KeyW'); P(60, { each: () => { const b = sim.info().shipBearingDeg; if (b != null) pad.dx += (b * RAD / FEEL.mouseFoot) * 0.1; }, until: () => sim.info().canBoard }); pad.release('KeyW');
  pad.tap('KeyE'); P(6, { until: () => sim.sm.state === S.LANDED }); P(1);
}
if (want.includes('liftoff')) {
  const o = mk(); toShipAndBoard(o);
  const R1 = rec(o.sim); o.pad.tap('Space');
  let tFree = null; const t0 = o.sim.t;
  o.P(14, { each: () => { R1.each(); if (tFree == null && o.sim.sm.state === S.ATMOSPHERE && !o.sim.sh.liftoff) tFree = o.sim.t - t0; } });
  report('lift-off at the spawn (Space, 14 s)', R1, `; free flight after ${f2(tFree)} s at ${f2(R1.rows.find((r) => !r.lift && r.st === S.ATMOSPHERE && r.t - t0 >= tFree - 1e-6).h)} m`);
}
function airborne(o) { toShipAndBoard(o); o.pad.tap('Space'); o.P(9); o.pad.press('KeyW'); o.P(14, { each: () => { o.holdPitch(0); if (o.sim.sh.throttle >= 0.999) o.pad.release('KeyW'); } }); }
if (want.includes('low')) {
  const o = mk(); airborne(o);
  const R1 = rec(o.sim);
  o.P(20, { each: () => { o.holdPitch(o.sim.sh.altGround > 12 ? -12 : 0); R1.each(); } });
  report('low flight, nose 12 degrees down, 20 s at full throttle', R1, `; speed ${f2(Math.min(...R1.rows.map((r) => r.v)))}..${f2(Math.max(...R1.rows.map((r) => r.v)))} m/s; bounces ${o.sim.sh.bounces}`);
}
if (want.includes('landfast')) {
  const o = mk(); airborne(o);
  const i0 = o.sim.info();
  console.log(`  before E: speed ${f2(o.sim.sh.speed)} hAG ${f2(o.sim.sh.altGround)} prompt ${JSON.stringify(i0.prompt)} canLand ${i0.ship.canLand}`);
  const R1 = rec(o.sim); o.pad.tap('KeyE'); const t0 = o.sim.t; let said = '';
  o.P(40, { each: () => { R1.each(); if (o.sim.notice && o.sim.notice.text !== said) { said = o.sim.notice.text; console.log(`  ${f2(o.sim.t - t0)} s: "${said}" state ${o.sim.sm.state}`); } }, until: () => o.sim.sm.state === S.LANDED });
  report('E at full speed low over the wood', R1, `; ${o.sim.sm.state} after ${f2(o.sim.t - t0)} s`);
}
for (const which of ['landslow', 'abort']) {
  if (!want.includes(which)) continue;
  const o = mk(); airborne(o);
  o.pad.press('KeyS'); o.P(6, { each: () => { o.holdPitch(-5); if (o.sim.sh.throttle <= 0.05) o.pad.release('KeyS'); } }); o.pad.release('KeyS');
  o.P(4, { each: () => o.holdPitch(0) });
  console.log(`  before E: speed ${f2(o.sim.sh.speed)} hAG ${f2(o.sim.sh.altGround)} h ${f2(len(o.sim.sh.p) - ss('earth', norm(o.sim.sh.p)).radius)} canLand ${o.sim.info().ship.canLand}`);
  const R1 = rec(o.sim); o.pad.tap('KeyE'); const t0 = o.sim.t;
  if (which === 'landslow') {
    o.P(60, { each: R1.each, until: () => o.sim.sm.state === S.LANDED });
    report('E at a hover over the wood', R1, `; ${o.sim.sm.state} after ${f2(o.sim.t - t0)} s; touch at ${f2(R1.rows.slice(-20).reduce((m, r) => Math.min(m, r.vUp), 0))} m/s`);
  } else {
    // abandon the landing half-way down, among the trees
    o.P(60, { each: R1.each, until: () => o.sim.sm.state === S.LANDING && len(o.sim.sh.p) - ss('earth', norm(o.sim.sh.p)).radius < 12 });
    console.log(`  Space at h ${f2(len(o.sim.sh.p) - ss('earth', norm(o.sim.sh.p)).radius)} m, hAG ${f2(o.sim.sh.altGround)}, state ${o.sim.sm.state}`);
    const R2 = rec(o.sim); o.pad.tap('Space'); o.P(8, { each: R2.each });
    report('a landing abandoned 12 m up among the trees (Space), 8 s', R2, `; state ${o.sim.sm.state}, hAG then ${f2(o.sim.sh.altGround)}`);
  }
}
if (want.includes('nepship')) {
  const o = mk('neptune'); o.sim.t = 222;
  const d = surface.getStandPure('neptune', 'storm_seas').unitDir;
  o.sim.teleport({ body: 'neptune', dir: [d.x, d.y, d.z], hour: 11, ship: true, altitude: 20, heading: 90 });
  const R1 = rec(o.sim); o.P(20, { each: R1.each });
  report('hovering 20 m up in Neptune\'s squall, no input, 20 s', R1, `; bounces ${o.sim.sh.bounces}`);
}
