// P25: the whole game played with keys and mouse through PILOT's Sim (pure, Node) on the real world, PHYSICS and
// obstacles, 60 Hz unless HZ is set. Logs every phase with the numbers a player feels.
// Usage: ROOT=<tree> [HZ=60] node journey.mjs [phase,...]   phases: foot, ship, trip, swim, storm (default all)
const R = process.env.ROOT, HZ = Number(process.env.HZ || 60);
const { Sim, FEEL } = await import(R + '/src/core/sim.js');
const { S } = await import(R + '/src/core/state.js');
const { Pad, play, len, dot, norm, sub } = await import(R + '/tests/helpers.mjs');
const surface = await import(R + '/src/world/surface.js');
const obstacles = await import(R + '/src/world/obstacles.js');
const { createPhysics } = await import(R + '/src/physics/index.js');
const { BODIES, spaceAltitude } = await import(R + '/src/data/bodies.js');
const RAD = Math.PI / 180;
const ss = (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z);
const obs = (id, d, r) => obstacles.sampleObstaclesPure(id, d.x, d.y, d.z, r);
const want = (process.argv[2] || 'foot,ship,trip,swim,storm').split(',');
const f2 = (x) => (x == null ? '-' : (+x).toFixed(2));
function mkSim(body = 'earth') {
  const physics = createPhysics({ sampleSurface: ss });
  const sim = new Sim({ sampleSurface: ss, getSpawn: (id) => surface.getSurface(id).getSpawn(), sampleObstacles: obs, physics, body });
  return sim;
}
const P = (sim, pad, s, o = {}) => play(sim, pad, s, { fps: HZ, ...o });
const holdPitch = (sim, pad, deg, g = 0.12) => { const e = deg - sim.info().ship.pitchDeg; pad.dy -= Math.max(-40, Math.min(40, (e * RAD / FEEL.mouseShip) * g)); };
const aimAt = (sim, pad, id) => { const a = sim.aimAt(id); pad.dx += Math.max(-60, Math.min(60, a.yawDeg * RAD / FEEL.mouseShip * 0.12)); pad.dy -= Math.max(-60, Math.min(60, a.pitchDeg * RAD / FEEL.mouseShip * 0.12)); };
// a recorder: rows of the explorer or the ship, each step; accel from velocity differences
function rec(sim) {
  const rows = []; let lastV = null, lastT = null;
  return { rows, each: () => {
    const ex = sim.ex, sh = sim.sh, st = sim.sm.state, onFoot = st === S.ON_FOOT;
    const v = onFoot ? ex.v : sh.v, p = onFoot ? ex.p : sh.p, up = norm(p), t = sim.t;
    let a = 0, aUp = 0, aH = 0;
    if (lastV && t > lastT) { const dv = sub(v, lastV), dt = t - lastT; a = len(dv) / dt; aUp = dot(dv, up) / dt; aH = Math.hypot(...['x', 'y', 'z'].map((k) => dv[k] - dot(dv, up) * up[k])) / dt; }
    lastV = { ...v }; lastT = t;
    const B = ex.phys || {}, info = onFoot ? null : sim.info().ship;
    rows.push({ t, st, a, aUp, aH, speed: len(v), vUp: dot(v, up), exAlt: ex.altitude, exSpeed: ex.speed, fuel: ex.fuel, mode: ex.mode, gait: B.gait, grounded: ex.grounded,
      shAlt: sh.altGround, shAltitude: info ? info.altitude : null, pitch: info ? info.pitchDeg : null, throttle: sh.throttle, r: len(p) });
  } };
}
const summ = (rows, k) => { const v = rows.map((r) => r[k]).filter((x) => x != null && isFinite(x)); return v.length ? { min: Math.min(...v), max: Math.max(...v), mean: v.reduce((s, x) => s + x, 0) / v.length } : null; };
const firstAt = (rows, pred) => { const r = rows.find(pred); return r ? r.t - rows[0].t : null; };
const out = (...a) => console.log(...a);

if (want.includes('foot') || want.includes('ship') || want.includes('trip')) {
  const sim = mkSim('earth'), pad = new Pad();
  P(sim, pad, 1.5);
  out(`# spawn: ${sim.bodyId} state ${sim.sm.state} biome ${sim.info().mood && sim.info().mood.biome} ship ${f2(sim.info().shipDistance)} m away, bearing ${f2(sim.info().shipBearingDeg)}`);
  if (want.includes('foot')) {
    // walk from a stand
    let R1 = rec(sim); pad.press('KeyW'); P(sim, pad, 4, { each: R1.each }); pad.release('KeyW');
    const vw = summ(R1.rows.slice(-60), 'exSpeed');
    out(`walk W: 90% of pace in ${f2(firstAt(R1.rows, (r) => r.exSpeed > 0.9 * vw.mean))} s, pace ${f2(vw.mean)} m/s (last second ${f2(vw.min)}-${f2(vw.max)})`);
    let R2 = rec(sim); P(sim, pad, 2.5, { each: R2.each });
    let dist = 0; for (let i = 1; i < R2.rows.length; i++) dist += R2.rows[i].exSpeed / HZ;
    out(`  release: stopped (<0.1 m/s) in ${f2(firstAt(R2.rows, (r) => r.exSpeed < 0.1))} s, slid ${f2(dist)} m`);
    // run
    R1 = rec(sim); pad.press('KeyW'); pad.press('ShiftLeft'); P(sim, pad, 5, { each: R1.each });
    const vr = summ(R1.rows.slice(-60), 'exSpeed');
    out(`run Shift+W: 90% of pace in ${f2(firstAt(R1.rows, (r) => r.exSpeed > 0.9 * vr.mean))} s, pace ${f2(vr.mean)} m/s (${f2(vr.min)}-${f2(vr.max)}), peak accel ${f2(summ(R1.rows.slice(2), 'aH').max)} m/s2`);
    // a hard 180 turn at a run by mouse (as fast as a player flicks: 0.25 s)
    R2 = rec(sim); const flick = Math.round(0.25 * HZ);
    P(sim, pad, 2.5, { each: (t) => { if (Math.round(t * HZ) < flick) pad.dx += (Math.PI / flick) / FEEL.mouseFoot; R2.each(); } });
    out(`  run, flick 180 deg in 0.25 s: slowest ${f2(summ(R2.rows, 'exSpeed').min)} m/s, back to 90% at ${f2(firstAt(R2.rows.slice(20), (r) => r.exSpeed > 0.9 * vr.mean))} s after the flick ends`);
    pad.release('KeyW'); pad.release('ShiftLeft');
    R2 = rec(sim); P(sim, pad, 3, { each: R2.each });
    dist = 0; for (let i = 1; i < R2.rows.length; i++) dist += R2.rows[i].exSpeed / HZ;
    out(`  release from a run: stopped in ${f2(firstAt(R2.rows, (r) => r.exSpeed < 0.1))} s, slid ${f2(dist)} m, peak decel ${f2(summ(R2.rows.slice(1), 'aH').max)}`);
    // jump from a stand
    R1 = rec(sim); const r0 = len(sim.ex.p); pad.tap('Space'); P(sim, pad, 2.5, { each: R1.each });
    out(`jump (tap Space): peak feet ${f2(summ(R1.rows, 'exAlt').max)} m, airborne ${f2(R1.rows.filter((r) => !r.grounded).length / HZ)} s, takeoff delay ${f2(firstAt(R1.rows, (r) => r.vUp > 0.5))} s`);
    // jetpack: hold Space 8 s
    R1 = rec(sim); pad.press('Space'); P(sim, pad, 8, { each: R1.each }); pad.release('Space');
    const fuel0 = R1.rows[0].fuel, emptyAt = firstAt(R1.rows, (r) => r.fuel <= 0.001);
    out(`jetpack (hold Space 8 s): peak feet ${f2(summ(R1.rows, 'exAlt').max)} m, peak climb ${f2(summ(R1.rows, 'vUp').max)} m/s, peak up-accel ${f2(summ(R1.rows.slice(2), 'aUp').max)}, fuel ${f2(fuel0)} -> ${f2(R1.rows.at(-1).fuel)}, empty at ${f2(emptyAt)} s`);
    R2 = rec(sim); P(sim, pad, 8, { each: R2.each, until: () => sim.ex.grounded });
    const land = R2.rows.at(-1);
    out(`  fall: landed after ${f2(R2.rows.length / HZ)} s, at ${f2(Math.min(...R2.rows.map((r) => r.vUp)))} m/s down (max), feet then ${f2(land.exAlt)}`);
    // refuel time
    R2 = rec(sim); P(sim, pad, 10, { each: R2.each });
    out(`  refuel: ${f2(R2.rows[0].fuel)} -> 90% at ${f2(firstAt(R2.rows, (r) => r.fuel > 0.9))} s, full at ${f2(firstAt(R2.rows, (r) => r.fuel > 0.999))} s`);
  }
  // walk to the ship and board
  pad.dx += (sim.info().shipBearingDeg * RAD) / FEEL.mouseFoot; P(sim, pad, 0.2);
  pad.press('KeyW'); const tw = P(sim, pad, 60, { each: () => { const b = sim.info().shipBearingDeg; if (b != null) pad.dx += (b * RAD / FEEL.mouseFoot) * 0.1; }, until: () => sim.info().canBoard }); pad.release('KeyW');
  out(`walk to the ship: ${f2(tw)} s until the board prompt (${f2(sim.info().shipDistance)} m)`);
  pad.tap('KeyE'); const tb = P(sim, pad, 6, { until: () => sim.sm.state === S.LANDED });
  out(`board (E): seated in ${f2(tb)} s, state ${sim.sm.state}`);
  if (want.includes('ship') || want.includes('trip')) {
    // lift off
    let R1 = rec(sim); pad.tap('Space'); P(sim, pad, 6, { each: R1.each });
    out(`lift-off (Space): state ${sim.sm.state}; hover ${f2(sim.sh.altGround)} m after 6 s; 8 m at ${f2(firstAt(R1.rows, (r) => r.shAlt > 8))} s; peak up-accel ${f2(summ(R1.rows.slice(2), 'aUp').max)}, peak climb ${f2(summ(R1.rows, 'vUp').max)} m/s`);
    // throttle up level: hold W until full, then keep 12 s; hold the nose level
    R1 = rec(sim); pad.press('KeyW');
    P(sim, pad, 14, { each: () => { holdPitch(sim, pad, 0); if (sim.sh.throttle >= 0.999) pad.release('KeyW'); R1.each(); } });
    const top = summ(R1.rows.slice(-120), 'speed');
    out(`full throttle, nose level, 14 s: throttle 1 at ${f2(firstAt(R1.rows, (r) => r.throttle >= 0.999))} s; speed 20 m/s at ${f2(firstAt(R1.rows, (r) => r.speed > 20))} s, 40 at ${f2(firstAt(R1.rows, (r) => r.speed > 40))}; top ${f2(top.mean)} m/s; peak horizontal accel ${f2(summ(R1.rows.slice(2), 'aH').max)} m/s2 (${f2(summ(R1.rows.slice(2), 'aH').max / 9.81)} g); height over ground ${f2(summ(R1.rows, 'shAlt').min)}-${f2(summ(R1.rows, 'shAlt').max)} m`);
    // low flight: nose down to skim, 20 s; the height and the vertical accelerations (the ride)
    R1 = rec(sim);
    P(sim, pad, 20, { each: () => { holdPitch(sim, pad, sim.sh.altGround > 12 ? -12 : 0); R1.each(); } });
    const ride = R1.rows.slice(Math.round(4 * HZ));
    const jerk = []; for (let i = 1; i < ride.length; i++) jerk.push(Math.abs(ride[i].aUp - ride[i - 1].aUp) * HZ);
    out(`low flight 20 s: height ${f2(summ(ride, 'shAlt').min)}-${f2(summ(ride, 'shAlt').max)} m (mean ${f2(summ(ride, 'shAlt').mean)}), speed ${f2(summ(ride, 'speed').mean)} m/s, vertical accel ${f2(summ(ride, 'aUp').min)}..${f2(summ(ride, 'aUp').max)} m/s2, |jerk| max ${f2(Math.max(...jerk))} m/s3, bounces ${sim.sh.bounces}`);
    // a hard turn: mouse right at the most the ship turns, 4 s
    R1 = rec(sim); const fw0 = norm(sub(sim.sh.v, { x: 0, y: 0, z: 0 }));
    P(sim, pad, 4, { each: () => { pad.dx += 40; holdPitch(sim, pad, 0); R1.each(); } });
    const fw1 = norm(sim.sh.v);
    out(`hard turn 4 s (mouse right): heading change ${f2(Math.acos(Math.max(-1, Math.min(1, dot(fw0, fw1)))) / RAD)} deg (velocity), speed ${f2(R1.rows[0].speed)} -> min ${f2(summ(R1.rows, 'speed').min)}, lateral accel max ${f2(summ(R1.rows.slice(2), 'aH').max)} m/s2`);
    // brake X
    R1 = rec(sim); pad.press('KeyX'); P(sim, pad, 6, { each: () => { holdPitch(sim, pad, 0); R1.each(); } }); pad.release('KeyX');
    out(`brake X 6 s: ${f2(R1.rows[0].speed)} -> under 2 m/s at ${f2(firstAt(R1.rows, (r) => r.speed < 2))} s; peak decel ${f2(summ(R1.rows.slice(2), 'a').max)} m/s2; throttle after ${f2(sim.sh.throttle)}`);
    // throttle back up and climb to space at 55 degrees
    R1 = rec(sim); pad.press('KeyW');
    const tSpace = P(sim, pad, 240, { each: () => { holdPitch(sim, pad, 55); R1.each(); }, until: () => sim.sm.state === S.SPACE });
    out(`climb to space at 55 deg, full throttle: ${f2(tSpace)} s; top speed ${f2(summ(R1.rows, 'speed').max)} m/s; peak accel ${f2(summ(R1.rows.slice(2), 'a').max)}`);
    if (want.includes('trip')) {
      P(sim, pad, 60, { each: () => holdPitch(sim, pad, 55), until: () => sim.info().ship.altitude > 3 * spaceAltitude(BODIES[sim.shFrame.id]) });
      pad.release('KeyW');
      const to = 'mars'; sim.setTarget(to);
      const ta = P(sim, pad, 20, { each: () => aimAt(sim, pad, to), until: () => Math.abs(sim.aimAt(to).yawDeg) < 4 && Math.abs(sim.aimAt(to).pitchDeg) < 4 });
      out(`aim at Mars: ${f2(ta)} s; prompt "${sim.promptNow && sim.promptNow.text}"`);
      pad.tap('KeyF'); P(sim, pad, 0.2);
      let vMax = 0; R1 = rec(sim);
      const tp = P(sim, pad, 400, { each: () => { vMax = Math.max(vMax, sim.sh.speed); R1.each(); }, until: () => sim.sm.state === S.SPACE });
      out(`pulse to Mars: ${f2(tp)} s, peak ${(vMax / 1000).toFixed(0)} km/s, state ${sim.sm.state}`);
      P(sim, pad, 12);
      pad.press('KeyW'); P(sim, pad, 1.5); pad.release('KeyW');
      R1 = rec(sim);
      const td = P(sim, pad, 300, { each: () => { holdPitch(sim, pad, -60); R1.each(); }, until: () => sim.sm.state === S.ATMOSPHERE });
      out(`descend to Mars' air at -60 deg: ${f2(td)} s`);
      const tl = P(sim, pad, 300, { each: () => { holdPitch(sim, pad, -35); R1.each(); }, until: () => sim.sh.altGround < 170 });
      pad.press('KeyS');
      const tl2 = P(sim, pad, 300, { each: () => { holdPitch(sim, pad, sim.sh.altGround > 110 ? -18 : -7); if (sim.sh.throttle < 0.25) pad.release('KeyS'); R1.each(); }, until: () => sim.info().ship.canLand });
      pad.release('KeyS');
      out(`  to 170 m: ${f2(tl)} s; to the landing prompt ${f2(tl2)} s more; canLand ${sim.info().ship.canLand}`);
      const RL = rec(sim); pad.tap('KeyE');
      const tland = P(sim, pad, 90, { each: RL.each, until: () => sim.sm.state === S.LANDED });
      out(`  landing assist: ${f2(tland)} s to LANDED; touchdown at ${f2(Math.min(...RL.rows.slice(-30).map((r) => r.vUp)))} m/s; bounces ${sim.sh.bounces}; peak decel ${f2(summ(RL.rows.slice(2), 'a').max)}`);
      pad.tap('KeyE'); P(sim, pad, 4, { until: () => sim.sm.state === S.ON_FOOT });
      out(`  out on ${sim.bodyId}: biome ${sim.info().mood && sim.info().mood.biome}`);
      let R2 = rec(sim); pad.press('KeyW'); pad.press('ShiftLeft'); P(sim, pad, 5, { each: R2.each }); pad.release('KeyW'); pad.release('ShiftLeft');
      out(`  Mars run: pace ${f2(summ(R2.rows.slice(-60), 'exSpeed').mean)} m/s`);
      P(sim, pad, 3);
      R2 = rec(sim); pad.press('Space'); P(sim, pad, 8, { each: R2.each }); pad.release('Space');
      out(`  Mars jetpack 8 s: peak feet ${f2(summ(R2.rows, 'exAlt').max)} m, climb ${f2(summ(R2.rows, 'vUp').max)} m/s`);
      R2 = rec(sim); P(sim, pad, 20, { each: R2.each, until: () => sim.ex.grounded });
      out(`  Mars fall: ${f2(R2.rows.length / HZ)} s, hits at ${f2(Math.min(...R2.rows.map((r) => r.vUp)))} m/s`);
    }
  }
}
// a stand: teleport there, find the waterline by marching out in 32 directions; face it
function toCoast(sim, body, biome, out = -12) {
  const st = surface.getStandPure(body, biome), d0 = st.unitDir;
  const ref = Math.abs(d0.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  const cr = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
  const e = norm(cr(ref, d0)), n = cr(d0, e), Rr = ss(body, d0).radius;
  const at = (E, N) => norm({ x: d0.x * Rr + e.x * E + n.x * N, y: d0.y * Rr + e.y * E + n.y * N, z: d0.z * Rr + e.z * E + n.z * N });
  const wet = (E, N) => { const s = ss(body, at(E, N)); return (s.liquidRadius || 0) - s.radius > 0; };
  const w0 = wet(0, 0); let hit = null;
  for (let r = 4; r <= 900 && !hit; r += 4) for (let k = 0; k < 32 && !hit; k++) { const a = k / 32 * 2 * Math.PI; if (wet(Math.cos(a) * r, Math.sin(a) * r) !== w0) hit = { a, r }; }
  const sg = w0 ? -1 : 1, rr = hit.r + sg * out;   // `out` < 0: on the beach, that far from the waterline
  const q = at(Math.cos(hit.a) * rr, Math.sin(hit.a) * rr);
  const heading = Math.atan2(Math.sin(hit.a) * sg, Math.cos(hit.a) * sg) ;  // toward the sea, from east-north angle
  // compass heading (from north toward east) of the direction (cos a, sin a) in (east, north): atan2(east, north)
  const hdeg = Math.atan2(Math.cos(hit.a) * sg, Math.sin(hit.a) * sg) / RAD;
  sim.teleport({ body, dir: [q.x, q.y, q.z], hour: 11, heading: hdeg, lookPitch: -8, firstPerson: false });
  return { waterline: hit.r, wetStand: w0, heading: hdeg };
}
if (want.includes('swim')) {
  for (const [body, biome, T] of [['earth', 'sea_coast', 8850 - 15], ['earth', 'sea_coast', 60]]) {
    const sim = mkSim(body), pad = new Pad();
    sim.t = T; const c = toCoast(sim, body, biome, -12); P(sim, pad, 1);
    out(`# swim ${body} ${biome} clock ${T}: ${JSON.stringify(c)}; state ${sim.sm.state}; wind ${f2(sim.physics.here && sim.physics.here.air && sim.physics.here.air.speed)}`);
    const R1 = rec(sim); pad.press('KeyW');
    P(sim, pad, 30, { each: R1.each });
    pad.release('KeyW');
    const rows = R1.rows.filter((_, i) => i % (HZ / 2) === 0);
    for (const r of rows) out(`   ${f2(r.t - R1.rows[0].t)} s v ${f2(r.exSpeed)} vUp ${f2(r.vUp)} alt ${f2(r.exAlt)} mode ${r.mode} gait ${r.gait} depth ${f2(sim.ex.liquidDepth)}`);
    // the swim: a jump out of the water, the jetpack from the water
    const R2 = rec(sim); pad.tap('Space'); P(sim, pad, 2, { each: R2.each });
    out(`  jump from the water: peak vUp ${f2(summ(R2.rows, 'vUp').max)}, mode ${sim.ex.mode}`);
    const R3 = rec(sim); pad.press('Space'); P(sim, pad, 3, { each: R3.each }); pad.release('Space');
    out(`  jetpack from the water 3 s: climb ${f2(summ(R3.rows, 'vUp').max)} m/s, alt ${f2(sim.ex.altitude)}`);
  }
}
if (want.includes('storm')) {
  // the ship in a storm: Neptune's squall at the storm stand, hovering 20 m up, 20 s; Earth's spawn storm at 170 s
  for (const [body, biome, T] of [['neptune', 'storm_seas', 222], ['earth', null, 165]]) {
    const sim = mkSim(body), pad = new Pad();
    sim.t = T;
    const d = biome ? surface.getStandPure(body, biome).unitDir : surface.getSurface(body).getSpawn().unitDir || surface.getSurface(body).getSpawn();
    sim.teleport({ body, dir: [d.x, d.y, d.z], hour: 11, ship: true, altitude: 20, heading: 90 });
    const p0 = { ...sim.sh.p }, R1 = rec(sim);
    P(sim, pad, 20, { each: R1.each });
    const ph = sim.sh.phys || {};
    out(`# ship hover in ${body}'s storm (clock ${T}): wind at the ship ${f2(sim.physics.here && sim.physics.here.air && sim.physics.here.air.speed)}; drift ${f2(len(sub(sim.sh.p, p0)))} m in 20 s; speed ${f2(summ(R1.rows, 'speed').mean)} (max ${f2(summ(R1.rows, 'speed').max)}); |a| max ${f2(summ(R1.rows.slice(2), 'a').max)} m/s2; height ${f2(summ(R1.rows, 'shAlt').min)}-${f2(summ(R1.rows, 'shAlt').max)}`);
    // forward flight into it: full throttle 10 s
    const R2 = rec(sim); pad.press('KeyW'); P(sim, pad, 10, { each: R2.each }); pad.release('KeyW');
    out(`  full throttle 10 s: speed ${f2(summ(R2.rows.slice(-120), 'speed').mean)}, |a| max ${f2(summ(R2.rows.slice(2), 'a').max)}, vertical a ${f2(summ(R2.rows.slice(2), 'aUp').min)}..${f2(summ(R2.rows.slice(2), 'aUp').max)}`);
  }
}
