// The wet bank, step by step. node wettrace.mjs <root> <body> <place|spawn> <clock> <heading> [secs=14] [from=4.5] [to=11] [every=1] [keys=KeyW]
const [root, body, place, clockS, hdS, secsS = '14', fromS = '4.5', toS = '11', everyS = '1', keysS = 'KeyW'] = process.argv.slice(2);
const { Sim } = await import(root + '/src/core/sim.js');
const surface = await import(root + '/src/world/surface.js');
const obstacles = await import(root + '/src/world/obstacles.js');
const P = await import(root + '/src/physics/index.js');
const { Pad, play } = await import(root + '/tests/helpers.mjs');
const V = await import(root + '/src/core/vec.js');
const ss = (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z);
const d0 = place === 'spawn' ? null : surface.getStandPure(body, place).unitDir;
const physics = P.createPhysics({ sampleSurface: ss, timeBudget: false });
const sim = new Sim({ sampleSurface: ss, getSpawn: (id) => surface.getSurface(id).getSpawn(), sampleObstacles: (id, d, r) => obstacles.sampleObstaclesPure(id, d.x, d.y, d.z, r), physics, body });
sim.t = +clockS; sim.teleport(d0 ? { body, dir: [d0.x, d0.y, d0.z], heading: +hdS } : { body, heading: +hdS });
const pad = new Pad(); play(sim, pad, 1, { fps: 30 });
console.log('# weather', physics.here.weather.kind, 'wet', physics.here.weather.wetness01 ?? '?');
const p0 = { ...sim.ex.p }; for (const k of keysS.split(',')) pad.press(k);
let n = 0; const f = (x, d = 2) => (x == null ? '-' : x >= 1e8 ? 'inf' : (+x).toFixed(d));
let prev = { ...sim.ex.p };
play(sim, pad, +secsS, { fps: 30, each: (t) => {
  const B = sim.ex.phys || {}; const s = ss(body, V.norm(sim.ex.p));
  if (t >= +fromS && t <= +toS && (n % +everyS === 0)) {
    const moved = V.len(V.sub(sim.ex.p, prev));
    console.log(`${t.toFixed(2)} s  ${V.len(V.sub(sim.ex.p, p0)).toFixed(2)} m  v ${f(sim.ex.speed)} slope ${f(s.slope * 57.3, 0)} ${B.material} mu ${f(B.friction)} slip ${f(B.slip01)} scr ${f(B.scramble01)} grip ${B.grip} cap ${f(B.paceCap)} ahead ${f(B.paceAhead)} crest ${f(B.paceCrest)} wall ${f(B.paceWall)}/${B.wall} hip ${f(B.hip)} hipV ${f(B.hipV)} brace ${f(B.brace)} clamb ${f(B.clamber01)} gait ${B.gait} mode ${sim.ex.mode} gr ${sim.ex.grounded} stuck ${f(sim.ex.stuck ?? 0)}`);
  }
  prev = { ...sim.ex.p }; n++;
} });
