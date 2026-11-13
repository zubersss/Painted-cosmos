// A hands-off hover in the game's weather (Node, PILOT's Sim with PHYSICS, 60 Hz): how far the ship is carried, its height's
// range, the hull's accelerations (one frame, and the mean over half a second), the drawn hull's rock.
// node hover.mjs <root> <body> <place|spawn> <clocks,comma> [alt=30] [secs=30] [verbose=0]
const [root, body, place, clocksS, altS = '30', secsS = '30', verbose = '0'] = process.argv.slice(2);
const { Sim } = await import(root + '/src/core/sim.js');
const surface = await import(root + '/src/world/surface.js');
const obstacles = await import(root + '/src/world/obstacles.js');
const P = await import(root + '/src/physics/index.js');
const { Pad, play } = await import(root + '/tests/helpers.mjs');
const V = await import(root + '/src/core/vec.js');
const ss = (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z);
const d0 = place === 'spawn' ? surface.getSurface(body).getSpawn() : surface.getStandPure(body, place).unitDir;
const DEG = 180 / Math.PI;
for (const clock of clocksS.split(',').map(Number)) {
  const physics = P.createPhysics({ sampleSurface: ss, timeBudget: false });
  const sim = new Sim({ sampleSurface: ss, getSpawn: (id) => surface.getSurface(id).getSpawn(), sampleObstacles: (id, d, r) => obstacles.sampleObstaclesPure(id, d.x, d.y, d.z, r), physics, body });
  sim.t = clock; sim.teleport({ body, dir: [d0.x, d0.y, d0.z], ship: true, altitude: +altS, throttle: 0, heading: 0 });
  const pad = new Pad(); play(sim, pad, 1);
  const p0 = { ...sim.sh.p }, a0 = sim.sh.altGround, r0 = V.len(sim.sh.p);
  let pv = { ...sim.sh.v }, gFrame = 0, gHalf = 0, rock = 0, rockSum = 0, n = 0, far = 0, lo = 1e9, hi = -1e9, rlo = 1e9, rhi = -1e9, wmin = 1e9, wmax = 0, upmax = 0, vAcc = { x: 0, y: 0, z: 0 }, k = 0, v30 = { ...sim.sh.v }, rockRate = 0, pb = null, climbMax = 0;
  play(sim, pad, +secsS, { each: (t) => {
    const a = V.len(V.sub(sim.sh.v, pv)) * 60 / 9.81; pv = { ...sim.sh.v }; gFrame = Math.max(gFrame, a);
    const b = sim.sh.phys && sim.sh.phys.buffetAngle, ba = b ? Math.hypot(b.pitch, b.roll, b.yaw) * DEG : 0; rock = Math.max(rock, ba); rockSum += ba; n++;
    if (b && pb) rockRate = Math.max(rockRate, Math.hypot(b.pitch - pb.pitch, b.roll - pb.roll, b.yaw - pb.yaw) * DEG * 60); pb = b ? { ...b } : null;
    far = Math.max(far, V.len(V.sub(sim.sh.p, p0))); lo = Math.min(lo, sim.sh.altGround); hi = Math.max(hi, sim.sh.altGround);
    const r = V.len(sim.sh.p); rlo = Math.min(rlo, r - r0); rhi = Math.max(rhi, r - r0);
    const w = physics.here.air.speed; wmin = Math.min(wmin, w); wmax = Math.max(wmax, w); upmax = Math.max(upmax, Math.abs(V.dot(physics.here.air.wind, V.norm(sim.sh.p))));
    climbMax = Math.max(climbMax, Math.abs(V.dot(sim.sh.v, V.norm(sim.sh.p))));
    if (++k % 30 === 0) { gHalf = Math.max(gHalf, V.len(V.sub(sim.sh.v, v30)) * 2 / 9.81); v30 = { ...sim.sh.v }; if (+verbose) console.log(`   ${t.toFixed(1)} s  ${sim.sh.altGround.toFixed(1)} m up, ${V.len(V.sub(sim.sh.p, p0)).toFixed(1)} m off, ${sim.sh.speed.toFixed(1)} m/s, wind ${w.toFixed(0)}, rock ${ba.toFixed(1)}`); }
  } });
  console.log(`${body} ${place} clock ${clock} (${physics.here.weather.kind}), hands off ${secsS} s from ${altS} m: carried ${far.toFixed(1)} m at most (${V.len(V.sub(sim.sh.p, p0)).toFixed(1)} m at the end), height over the ground ${lo.toFixed(1)} to ${hi.toFixed(1)} m (its own ${rlo.toFixed(1)} to ${rhi.toFixed(1)} m), fastest up or down ${climbMax.toFixed(1)} m/s, ${gFrame.toFixed(2)} g in a frame, ${gHalf.toFixed(2)} g over half a second, rock ${rock.toFixed(1)} deg at most (mean ${(rockSum / n).toFixed(1)}, fastest ${rockRate.toFixed(0)} deg/s), wind at the hull ${wmin.toFixed(0)} to ${wmax.toFixed(0)} m/s (up part to ${upmax.toFixed(0)})`);
}
