const root = process.argv[2];
const { Sim } = await import(root + '/src/core/sim.js');
const { S } = await import(root + '/src/core/state.js');
const { BODIES, spaceAltitude } = await import(root + '/src/data/bodies.js');
const { arrivalRadius } = await import(root + '/src/ship/pulse.js');
const { stubSurface, stubSpawn } = await import(root + '/src/core/stubs/surface.js');
const { Pad, play, V, sub, norm, len } = await import(root + '/tests/helpers.mjs');
const { qLook, cross } = await import(root + '/src/core/vec.js');
const sim = new Sim({ sampleSurface: stubSurface, getSpawn: (id) => stubSpawn(id).unitDir });
sim.t = 0.3; const pad = new Pad();
sim.teleport({ body: 'venus', lat: 10, lon: 30, ship: true, altitude: 945 });
play(sim, pad, 0.2);
const t = norm(sub(sim.bodyInShipFrame('earth'), sim.sh.p));
sim.sh.q = qLook(t, norm(cross(t, V(0, 1, 0)))); sim.sh.v = V(); sim.setTarget('earth'); play(sim, pad, 0.1);
console.log('course around', sim.course().around, 'd0', (len(sub(sim.bodyInShipFrame('earth'), sim.sh.p))/1000).toFixed(0), 'km');
pad.tap('KeyF');
let last = -10, said = [];
play(sim, pad, 300, { fps: 30, each: (tt) => {
  if (sim.notice && !said.includes(sim.notice.text)) { said.push(sim.notice.text); console.log(tt.toFixed(1), 'say', sim.notice.text); }
  if (tt - last >= 5) { last = tt;
    const dE = len(sub(sim.bodyInShipFrame('earth'), sim.sh.p)), dM = len(sub(sim.bodyInShipFrame('mercury'), sim.sh.p));
    console.log(tt.toFixed(0), sim.sm.state, 'v', (sim.pulse ? sim.pulse.v : sim.sh.speed).toFixed(0), 'earth', (dE/1000).toFixed(1), 'km (alt', (dE-4000).toFixed(0), ') mercury', (dM/1000).toFixed(1), 'km block', sim.pulse && sim.pulse.block);
  } }, until: () => sim.sm.state === S.SPACE && sim.t > 60 && sim.sh.speed < 20 });
