// The hour at the spawn over a new game's clock (Node): node hours.mjs <root> [body=earth]
const [root, body = 'earth'] = process.argv.slice(2);
const { Sim } = await import(root + '/src/core/sim.js');
const surface = await import(root + '/src/world/surface.js');
const V = await import(root + '/src/core/vec.js');
const ss = (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z);
const sim = new Sim({ sampleSurface: ss, getSpawn: (id) => surface.getSurface(id).getSpawn(), body });
const d = V.norm(sim.ex.p), out = [];
for (const t of [0, 60, 130, 240, 330, 400, 480, 530, 600, 700, 800, 900, 1200, 1280, 1500]) out.push(`${t} s: ${sim.eph.sunHour(body, t, d).toFixed(1)} h`);
console.log(body + ' spawn, the hour by the game clock of a new game (6 sunrise, 18 sunset): ' + out.join(', '));
