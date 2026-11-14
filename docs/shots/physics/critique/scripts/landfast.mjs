// E pressed at full speed low over the wood (the prompt "Land here" shows at 45 m/s): what the hull does
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
const pad = new Pad(), RAD = Math.PI / 180; sim.t = 14.8; play(sim, pad, 0.5);
pad.dx += (sim.info().shipBearingDeg * RAD) / FEEL.mouseFoot; play(sim, pad, 0.1);
pad.press('KeyW'); play(sim, pad, 30, { until: () => sim.info().canBoard }); pad.release('KeyW');
pad.tap('KeyE'); play(sim, pad, 6, { until: () => sim.sm.state === S.LANDED }); play(sim, pad, 1);
pad.tap('Space'); play(sim, pad, 6);
const holdPitch = (deg) => { const e = deg - sim.info().ship.pitchDeg; pad.dy -= Math.max(-40, Math.min(40, (e * RAD / FEEL.mouseShip) * 0.12)); };
pad.press('KeyW'); play(sim, pad, 5, { each: () => { holdPitch(0); if (sim.sh.throttle >= 0.999) pad.release('KeyW'); } });
const i0 = sim.info();
console.log('before E: speed', sim.sh.speed.toFixed(1), 'hAG', sim.sh.altGround.toFixed(1), 'prompt', i0.prompt, 'canLand', i0.ship.canLand);
pad.tap('KeyE'); let lastV = { ...sim.sh.v }, n = 0, amax = 0;
play(sim, pad, 12, { each: () => { const v = sim.sh.v, a = len(sub(v, lastV)) * 60; lastV = { ...v }; amax = Math.max(amax, a);
  if (n++ % 6 === 0 || a > 50) console.log(sim.t.toFixed(2), sim.sm.state, 'v', sim.sh.speed.toFixed(2), 'hAG', sim.sh.altGround.toFixed(2), '|a|', a.toFixed(1), sim.sh.landing ? sim.sh.landing.phase : '-', sim.notice ? sim.notice.text : ''); },
  until: () => sim.sm.state === S.LANDED });
console.log('max |a|', amax.toFixed(1), 'state', sim.sm.state);
