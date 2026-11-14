// How the ship handles, as a player feels it (Node, PILOT's Sim with PHYSICS, 60 Hz), on a few worlds:
// lift-off to the hover; full throttle low over the land (top speed, time to it); X brake (time, metres);
// a hard turn (A held) at speed (degrees a second, radius); E from a 25 m hover to LANDED (seconds,
// sink at touchdown); the climb to space with the nose 35 degrees up at full throttle.
// node shipfeel.mjs <root>
const [root] = process.argv.slice(2);
const { Sim, FEEL } = await import(root + '/src/core/sim.js');
const surface = await import(root + '/src/world/surface.js');
const obstacles = await import(root + '/src/world/obstacles.js');
const P = await import(root + '/src/physics/index.js');
const { Pad, play } = await import(root + '/tests/helpers.mjs');
const V = await import(root + '/src/core/vec.js');
const ss = (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z);
const make = (body) => {
  const physics = P.createPhysics({ sampleSurface: ss, seed: 1 });
  const sim = new Sim({ sampleSurface: ss, getSpawn: (id) => surface.getSurface(id).getSpawn(), sampleObstacles: (id, d, r) => obstacles.sampleObstaclesPure(id, d.x, d.y, d.z, r), physics, body });
  sim.t = 30; return sim;
};
const RAD = Math.PI / 180;
for (const body of ['earth', 'mars', 'moon', 'jupiter', 'neptune']) {
  const out = [body.padEnd(8)];
  // lift-off from landed at the spawn
  let sim = make(body); sim.teleport({ body, hour: 11 }); let pad = new Pad(); play(sim, pad, 1);
  // board: put the explorer at the hatch
  pad.dx += sim.info().shipBearingDeg * RAD / FEEL.mouseFoot; pad.press('KeyW');
  play(sim, pad, 30, { until: () => sim.info().canBoard }); pad.release('KeyW'); pad.tap('KeyE');
  play(sim, pad, 6, { until: () => sim.sm.state === 'LANDED' });
  pad.tap('Space'); const tl = play(sim, pad, 20, { until: () => !sim.sh.liftoff && sim.sm.state === 'ATMOSPHERE' && sim.sh.altGround > 5 && Math.abs(sim.info().ship.vUp) < 0.3 });
  out.push(`lift-off to a hover ${tl.toFixed(1)} s at ${sim.sh.altGround.toFixed(0)} m`);
  // full throttle low
  sim = make(body); sim.teleport({ body, ship: true, altitude: 40, hour: 11, heading: 30 }); pad = new Pad(); play(sim, pad, 1);
  pad.press('KeyW'); let t90 = null; const vs = [];
  play(sim, pad, 25, { each: (t) => vs.push(sim.sh.speed) }); pad.release('KeyW');
  const top = Math.max(...vs); for (let i = 0; i < vs.length; i++) if (vs[i] > 0.9 * top) { t90 = i / 60; break; }
  out.push(`full throttle low: top ${top.toFixed(0)} m/s, 90 % in ${t90.toFixed(1)} s`);
  // hard turn at that speed: A held 4 s
  const f0 = V.qRotate(sim.sh.q, { x: 0, y: 0, z: -1 });
  pad.press('KeyA'); const v0 = sim.sh.speed; play(sim, pad, 3); pad.release('KeyA');
  const f1 = V.qRotate(sim.sh.q, { x: 0, y: 0, z: -1 }); const turned = Math.acos(Math.max(-1, Math.min(1, V.dot(f0, f1)))) / RAD;
  out.push(`A held 3 s at ${v0.toFixed(0)} m/s: ${(turned / 3).toFixed(0)} deg/s (radius ~${(v0 / (turned / 3 * RAD)).toFixed(0)} m)`);
  // brake
  const p0 = { ...sim.sh.p }; pad.press('KeyX'); let tb = null;
  play(sim, pad, 30, { each: (t) => { if (tb == null && sim.sh.speed < 1) tb = t; }, until: () => sim.sh.speed < 0.5 }); pad.release('KeyX');
  out.push(`X from ${sim.sh.speed < 1 ? v0.toFixed(0) : '?'} m/s: ${tb == null ? '>30' : tb.toFixed(1)} s over ${V.len(V.sub(sim.sh.p, p0)).toFixed(0)} m`);
  // landing from a 25 m hover
  sim = make(body); sim.teleport({ body, ship: true, altitude: 25, hour: 11, throttle: 0 }); sim.sh.v = { x: 0, y: 0, z: 0 }; pad = new Pad(); play(sim, pad, 1);
  pad.tap('KeyE'); let vlast = 0;
  const tland = play(sim, pad, 60, { each: () => { vlast = -sim.info().ship.vUp; }, until: () => sim.sm.state === 'LANDED' });
  out.push(`E at 25 m to LANDED ${tland.toFixed(1)} s (sink ${vlast.toFixed(2)} m/s at the end)`);
  // climb to space, nose 35 up, full throttle
  sim = make(body); sim.teleport({ body, ship: true, altitude: 40, hour: 11, pitchDeg: 35, throttle: 1 }); pad = new Pad(); play(sim, pad, 0.5);
  pad.press('KeyW');
  const tc = play(sim, pad, 400, { each: () => { const e = 35 - sim.info().ship.pitchDeg; pad.dy -= Math.max(-40, Math.min(40, e * RAD / FEEL.mouseShip * 0.12)); }, until: () => sim.sm.state === 'SPACE' });
  out.push(`40 m to space (nose 35 up, full) ${tc.toFixed(0)} s`);
  console.log(out.join('; '));
}
