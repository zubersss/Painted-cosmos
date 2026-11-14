// Does rain stop a walk? (Node, Sim with PHYSICS, 30 Hz, the game's weather seed.) From a stand, W (or
// the keys given) for 14 s on sixteen headings at each clock: metres made, the slowest second, and the
// seconds spent under 1 m/s with the key held. node wetstall.mjs <root> <body> <place|spawn> <clocks> [keys=KeyW]
const [root, body, place, clocksS, keysS = 'KeyW'] = process.argv.slice(2);
const { Sim } = await import(root + '/src/core/sim.js');
const surface = await import(root + '/src/world/surface.js');
const obstacles = await import(root + '/src/world/obstacles.js');
const P = await import(root + '/src/physics/index.js');
const { Pad, play } = await import(root + '/tests/helpers.mjs');
const V = await import(root + '/src/core/vec.js');
const ss = (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z);
const d0 = place === 'spawn' ? null : surface.getStandPure(body, place).unitDir;
for (const clock of clocksS.split(',').map(Number)) {
  const rows = []; let stuck = 0, tot = 0, kind = '';
  for (let hd = 0; hd < 360; hd += 22.5) {
    const physics = P.createPhysics({ sampleSurface: ss });
    const sim = new Sim({ sampleSurface: ss, getSpawn: (id) => surface.getSurface(id).getSpawn(), sampleObstacles: (id, d, r) => obstacles.sampleObstaclesPure(id, d.x, d.y, d.z, r), physics, body });
    sim.t = clock; sim.teleport(d0 ? { body, dir: [d0.x, d0.y, d0.z], heading: hd } : { body, heading: hd });
    const pad = new Pad(); play(sim, pad, 1, { fps: 30 }); kind = physics.here.weather.kind;
    const p0 = { ...sim.ex.p }; for (const k of keysS.split(',')) pad.press(k);
    let slow = 0, n = 0, last = { ...sim.ex.p }, worst = 99, steep = 0;
    play(sim, pad, 14, { fps: 30, each: () => { if (sim.ex.speed < 1 && n > 30 && sim.ex.liquidDepth < 0.3) { slow++; steep = Math.max(steep, ss(body, V.norm(sim.ex.p)).slope * 57.3); } if (++n % 30 === 0) { if (n > 30) worst = Math.min(worst, V.len(V.sub(sim.ex.p, last))); last = { ...sim.ex.p }; } } });
    const made = V.len(V.sub(sim.ex.p, p0)); tot += made; if (slow / 30 > 2) stuck++;
    rows.push(`h${hd}: ${made.toFixed(0)} m${slow / 30 > 0.5 ? ' (under 1 m/s for ' + (slow / 30).toFixed(1) + ' s, on up to ' + steep.toFixed(0) + ' deg)' : ''}`);
  }
  console.log(`# ${body} ${place} clock ${clock} (${kind}), ${keysS}, 14 s: ${tot.toFixed(0)} m in all; ${stuck} of 16 headings held under 1 m/s for more than 2 s`);
  console.log('  ' + rows.join(', '));
}
