// The wanderer's own flight (player/explorer.js, data/mode.js), checked in the pure simulation with PHYSICS' body, no browser:
// rise, hover, fly, fast, stop, sink, land. node tests/flycheck.mjs prints a line a step. (A report, not yet a test with asserts.)
const R = new URL('..', import.meta.url).pathname;
const { MODE } = await import(R + 'src/data/mode.js'); MODE.oil = true;
const { Sim } = await import(R + 'src/core/sim.js');
const { stubSurface, stubSpawn } = await import(R + 'src/core/stubs/surface.js');
const { Pad, play, len, norm, dot } = await import(R + 'tests/helpers.mjs');
const P = await import(R + 'src/physics/index.js');
const physics = P.createPhysics({ sampleSurface: stubSurface, seed: 1 });
const sim = new Sim({ sampleSurface: stubSurface, getSpawn: (id) => stubSpawn(id).unitDir, physics });
const pad = new Pad();
const ex = () => sim.ex, vUp = () => dot(ex().v, norm(ex().p));
const say = (what) => console.log(what.padEnd(34), 'alt', ex().altitude.toFixed(1).padStart(6), 'vUp', vUp().toFixed(2).padStart(6), 'speed', ex().speed.toFixed(1).padStart(5),
  'mode', ex().mode, 'flying', !!ex().flying, 'fuel', ex().fuel.toFixed(2), 'fly01', (ex().fly01 || 0).toFixed(2), 'jet01', ex().jet01.toFixed(2));
play(sim, pad, 1.0); say('standing');
pad.press('Space'); play(sim, pad, 3.0); say('Space held 3 s (rise)');
pad.release('Space'); play(sim, pad, 3.0); say('hands off 3 s (hover)');
const a0 = ex().altitude; play(sim, pad, 6.0); say('hands off 6 s more'); console.log('   drift in 6 s:', (ex().altitude - a0).toFixed(2), 'm');
pad.press('KeyW'); play(sim, pad, 5.0); say('W 5 s (fly level)');
pad.press('ShiftLeft'); play(sim, pad, 6.0); say('W + Shift 6 s (fast)');
pad.release('ShiftLeft'); pad.release('KeyW'); play(sim, pad, 4.0); say('let go 4 s (stop, hover)');
pad.press('KeyC'); play(sim, pad, 1.5); say('C 1.5 s (sink)'); 
const t = play(sim, pad, 20, { until: () => ex().grounded }); pad.release('KeyC'); say('C until the ground (' + t.toFixed(1) + ' s)');
play(sim, pad, 1.0); say('on the ground 1 s');
pad.tap('Space'); play(sim, pad, 0.05); play(sim, pad, 1.5); say('a tap of Space (a plain jump)');
