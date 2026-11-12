// P25: phase details step by step (PILOT's Sim in Node, the real world). Usage: ROOT=<tree> [HZ=60] node detail.mjs <jet|liftoff|low|land|turn>
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
const what = process.argv[2] || 'jet', every = Number(process.argv[3] || 1);
const f2 = (x) => (x == null ? '-' : (+x).toFixed(2));
const physics = createPhysics({ sampleSurface: ss });
const sim = new Sim({ sampleSurface: ss, getSpawn: (id) => surface.getSurface(id).getSpawn(), sampleObstacles: obs, physics, body: 'earth' });
const pad = new Pad();
const P = (s, o = {}) => play(sim, pad, s, { fps: HZ, ...o });
const holdPitch = (deg, g = 0.12) => { const e = deg - sim.info().ship.pitchDeg; pad.dy -= Math.max(-40, Math.min(40, (e * RAD / FEEL.mouseShip) * g)); };
let lastV = null, lastT = null, n = 0;
function row(tag = '') {
  const st = sim.sm.state, onFoot = st === S.ON_FOOT || st === S.BOARDING, v = onFoot ? sim.ex.v : sim.sh.v, p = onFoot ? sim.ex.p : sim.sh.p, up = norm(p);
  let aUp = 0, aH = 0;
  if (lastV && sim.t > lastT) { const dv = sub(v, lastV), dt = sim.t - lastT; aUp = dot(dv, up) / dt; aH = Math.sqrt(Math.max(0, len(dv) ** 2 - dot(dv, up) ** 2)) / dt; }
  lastV = { ...v }; lastT = sim.t;
  if (n++ % every) return;
  const B = sim.ex.phys || {}, sh = sim.sh, ph = sh.phys || {};
  if (onFoot) console.log(`${f2(sim.t)} ${st} alt ${f2(sim.ex.altitude)} vUp ${f2(dot(v, up))} vh ${f2(sim.ex.speed)} aUp ${f2(aUp)} aH ${f2(aH)} gnd ${sim.ex.grounded ? 1 : 0} fuel ${f2(sim.ex.fuel)} mode ${sim.ex.mode} ride ${f2(B.ride)} ${tag}`);
  else { const i = sim.info().ship; console.log(`${f2(sim.t)} ${st} hAG ${f2(sh.altGround)} v ${f2(sh.speed)} vUp ${f2(dot(v, up))} aUp ${f2(aUp)} aH ${f2(aH)} pitch ${f2(i.pitchDeg)} thr ${f2(sh.throttle)} lift ${sh.liftoff ? 'L' : '-'} land ${sh.landing ? sh.landing.phase || 'y' : '-'} gear ${f2(sh.gear01)} contacts ${ph.contacts == null ? '-' : ph.contacts} ${tag}`); }
}
P(1.5);
if (what === 'jet') {
  pad.press('Space'); P(7.5, { each: () => row() }); pad.release('Space'); P(8, { each: () => row(), until: () => sim.ex.grounded && sim.ex.speed < 0.5 }); P(0.5, { each: () => row() });
} else {
  pad.dx += (sim.info().shipBearingDeg * RAD) / FEEL.mouseFoot; P(0.2);
  pad.press('KeyW'); P(60, { each: () => { const b = sim.info().shipBearingDeg; if (b != null) pad.dx += (b * RAD / FEEL.mouseFoot) * 0.1; }, until: () => sim.info().canBoard }); pad.release('KeyW');
  pad.tap('KeyE'); P(6, { until: () => sim.sm.state === S.LANDED });
  if (what === 'liftoff') { pad.tap('Space'); P(8, { each: () => row() }); }
  else {
    pad.tap('Space'); P(6);
    pad.press('KeyW'); P(14, { each: () => { holdPitch(0); if (sim.sh.throttle >= 0.999) pad.release('KeyW'); if (what === 'level') row(); } });
    if (what === 'low') P(20, { each: () => { holdPitch(sim.sh.altGround > 12 ? -12 : 0); row(); } });
    if (what === 'turn') { P(20, { each: () => { holdPitch(sim.sh.altGround > 12 ? -12 : 0); } }); P(4, { each: () => { pad.dx += 40; holdPitch(0); row(); } }); }
    if (what === 'land') {
      // slow down, then the landing prompt and E
      pad.press('KeyS'); P(6, { each: () => { holdPitch(-5); if (sim.sh.throttle <= 0.05) pad.release('KeyS'); } }); pad.release('KeyS');
      P(20, { each: () => { holdPitch(-5); pad.press('KeyC'); }, until: () => sim.info().ship.canLand }); pad.release('KeyC');
      console.log('canLand', sim.info().ship.canLand, 'hAG', f2(sim.sh.altGround), 'v', f2(sim.sh.speed));
      pad.tap('KeyE'); P(20, { each: () => row(), until: () => sim.sm.state === S.LANDED }); P(2, { each: () => row() });
    }
  }
}
