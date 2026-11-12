// lift-off from the spawn (as play.mjs: walk to the ship, board, Space); the chase camera's height over the ground and
// the ship's, each 1/30 s around the end of the lift-off sequence
const R = process.env.ROOT;
const { Sim, FEEL } = await import(R + '/src/core/sim.js');
const { S } = await import(R + '/src/core/state.js');
const { Pad, play, len, dot, norm, sub } = await import(R + '/tests/helpers.mjs');
const surface = await import(R + '/src/world/surface.js');
const obstacles = await import(R + '/src/world/obstacles.js');
const { createPhysics } = await import(R + '/src/physics/index.js');
const ss = (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z);
const obs = (id, d, r) => obstacles.sampleObstaclesPure(id, d.x, d.y, d.z, r);
const physics = createPhysics({ sampleSurface: ss });
const sim = new Sim({ sampleSurface: ss, getSpawn: (id) => surface.getSurface(id).getSpawn(), sampleObstacles: obs, physics, body: 'earth' });
const pad = new Pad(), RAD = Math.PI / 180; sim.t = 14.8; play(sim, pad, 0.5, { fps: 30 });
pad.dx += (sim.info().shipBearingDeg * RAD) / FEEL.mouseFoot; play(sim, pad, 0.1, { fps: 30 });
pad.press('KeyW'); play(sim, pad, 30, { fps: 30, until: () => sim.info().canBoard }); pad.release('KeyW');
pad.tap('KeyE'); play(sim, pad, 6, { fps: 30, until: () => sim.sm.state === S.LANDED }); play(sim, pad, 1, { fps: 30 });
pad.tap('Space');
const r0 = sim.info();
let prev = null;
play(sim, pad, 7, { fps: 30, each: () => {
  const i = sim.info(), shG = len(sim.sh.p) - ss('earth', norm(sim.sh.p)).radius;
  const cam = sim.lastView && sim.lastView.p ? sim.lastView.p : null;
  const line = `${i.t.toFixed(2)} ${i.state} lift ${sim.sh.liftoff ? 'L' : '-'} ship over ground ${shG.toFixed(2)} hAG ${sim.sh.altGround.toFixed(2)} camera over ground ${i.cameraClearance == null ? '-' : i.cameraClearance.toFixed(2)} lift ${(sim.shipCam.lift || 0).toFixed(2)}`;
  console.log(line);
} });
