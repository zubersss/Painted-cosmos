// On foot in the weather, as a player meets it (Node, PILOT's Sim with PHYSICS, 30 Hz, the game's
// weather seed): at a place and a clock, from a stand, W for 8 s and Shift+W for 8 s on four headings
// (metres made, slowest second), standing still 10 s (metres moved), a jump and a 2 s jetpack burn
// (height, and how far from the take-off the feet come down).
// node stormwalk.mjs <root> <body> <place|spawn> <clock>
const [root, body, place, clockS] = process.argv.slice(2);
const { Sim } = await import(root + '/src/core/sim.js');
const surface = await import(root + '/src/world/surface.js');
const obstacles = await import(root + '/src/world/obstacles.js');
const P = await import(root + '/src/physics/index.js');
const { Pad, play } = await import(root + '/tests/helpers.mjs');
const V = await import(root + '/src/core/vec.js');
const ss = (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z);
const d0 = place === 'spawn' ? null : surface.getStandPure(body, place).unitDir;
const make = (h) => {
  const physics = P.createPhysics({ sampleSurface: ss });
  const sim = new Sim({ sampleSurface: ss, getSpawn: (id) => surface.getSurface(id).getSpawn(), sampleObstacles: (id, d, r) => obstacles.sampleObstaclesPure(id, d.x, d.y, d.z, r), physics, body });
  sim.t = +clockS; sim.teleport(d0 ? { body, dir: [d0.x, d0.y, d0.z], heading: h } : { body, heading: h });
  const pad = new Pad(); play(sim, pad, 1, { fps: 30 });
  return { sim, physics, pad };
};
{
  const { sim, physics } = make(0), h = physics.here;
  console.log(`# ${body} ${place} clock ${clockS}: weather ${h.weather.kind} (${h.weather.intensity01.toFixed(2)}), rain ${h.weather.precipitation.rate.toFixed(1)} mm/h, wind at the walker ${h.air.speed.toFixed(1)} m/s, gust01 ${(h.air.gust01 || 0).toFixed(2)}`);
}
for (const [name, keys] of [['W', ['KeyW']], ['Shift+W', ['KeyW', 'ShiftLeft']]]) {
  const row = [];
  for (const hd of [0, 90, 180, 270]) {
    const { sim, pad } = make(hd); const p0 = { ...sim.ex.p }; for (const k of keys) pad.press(k);
    const ds = []; let last = { ...sim.ex.p }, n = 0, wmax = 0, lean = 0;
    play(sim, pad, 8, { fps: 30, each: () => { if (++n % 30 === 0) { ds.push(V.len(V.sub(sim.ex.p, last))); last = { ...sim.ex.p }; } const B = sim.ex.phys || {}; if (B.lean != null) lean = Math.max(lean, Math.abs(B.lean)); } });
    row.push(`h${hd}: ${V.len(V.sub(sim.ex.p, p0)).toFixed(1)} m (slowest second ${Math.min(...ds.slice(1)).toFixed(1)} m/s)`);
  }
  console.log(`  ${name.padEnd(8)} 8 s: ${row.join(', ')}`);
}
{
  const { sim, pad } = make(0); const p0 = { ...sim.ex.p }; let far = 0;
  play(sim, pad, 10, { fps: 30, each: () => { far = Math.max(far, V.len(V.sub(sim.ex.p, p0))); } });
  console.log(`  standing still 10 s: moved ${V.len(V.sub(sim.ex.p, p0)).toFixed(2)} m (farthest ${far.toFixed(2)} m)`);
}
for (const [name, hold] of [['a jump', 0.1], ['the jetpack held 2 s', 2]]) {
  const { sim, pad } = make(0); const p0 = { ...sim.ex.p }; let top = 0;
  pad.press('Space'); play(sim, pad, hold, { fps: 30, each: () => { top = Math.max(top, sim.ex.altitude); } }); pad.release('Space');
  const t = play(sim, pad, 40, { fps: 30, each: () => { top = Math.max(top, sim.ex.altitude); }, until: () => sim.ex.grounded });
  const up = V.norm(p0), dv = V.sub(sim.ex.p, p0), hz = V.len(V.sub(dv, V.scale(up, V.dot(dv, up))));
  console.log(`  ${name}: ${top.toFixed(1)} m up, ${(hold + t).toFixed(1)} s off the ground, down ${hz.toFixed(1)} m from the take-off`);
}
