// The head's behaviour from Earth's orbit with the mark behind: where does F take the ship?
const ROOT = process.env.ROOT;
const { Sim } = await import(ROOT + '/src/core/sim.js');
const { S } = await import(ROOT + '/src/core/state.js');
const { BODIES, spaceAltitude } = await import(ROOT + '/src/data/bodies.js');
const { stubSurface, stubSpawn } = await import(ROOT + '/src/core/stubs/surface.js');
const { Pad, play, V, sub, norm, len } = await import(ROOT + '/tests/helpers.mjs');
const { qLook, cross } = await import(ROOT + '/src/core/vec.js');
for (const to of ['mars', 'saturn', 'neptune']) for (const where of ['behind', 'above', 'beside']) {
  const sim = new Sim({ sampleSurface: stubSurface, getSpawn: (id) => stubSpawn(id).unitDir });
  const pad = new Pad();
  sim.teleport({ body: 'earth', lat: 10, lon: 30, ship: true, altitude: 3 * spaceAltitude(BODIES.earth) });
  play(sim, pad, 0.2);
  const t = norm(sub(sim.bodyInShipFrame(to), sim.sh.p));
  const side = norm(cross(t, Math.abs(t.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0)));
  if (where === 'behind') sim.sh.q = qLook(V(-t.x, -t.y, -t.z), side); else if (where === 'above') sim.sh.q = qLook(side, t); else sim.sh.q = qLook(side, cross(t, side));
  sim.sh.v = V(); sim.setTarget(to); play(sim, pad, 0.1);
  const d0 = len(sub(sim.bodyInShipFrame(to), sim.sh.p)); const prompt = sim.promptNow && sim.promptNow.text;
  pad.tap('KeyF'); let pulsed = false; const said = [];
  play(sim, pad, 420, { fps: 30, each: () => { if (sim.sm.state === S.PULSE) pulsed = true; if (sim.notice && !said.includes(sim.notice.text)) said.push(sim.notice.text); }, until: () => pulsed && sim.sm.state === S.SPACE });
  if (sim.notice && !said.includes(sim.notice.text)) said.push(sim.notice.text);
  const d1 = len(sub(sim.bodyInShipFrame(to), sim.sh.p));
  console.log(`${to} ${where}: prompt "${prompt}", ${(d0 / 1000).toFixed(0)} -> ${(d1 / 1000).toFixed(0)} km, pulsed ${pulsed}, said ${JSON.stringify(said)}`);
}
