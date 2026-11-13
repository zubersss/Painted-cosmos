// The weather's name and wind at a stand, every 10 s for 600 s (physics.weather at the stand, the game's seed). node names.mjs <root> <body> <place>
const [root, body, place] = process.argv.slice(2);
const surface = await import(root + '/src/world/surface.js');
const P = await import(root + '/src/physics/index.js');
const ss = (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z);
const d = surface.getStandPure(body, place).unitDir, s = ss(body, d), r = Math.max(s.radius, s.liquidRadius || 0) + 1.5, p = { x: d.x * r, y: d.y * r, z: d.z * r };
const physics = P.createPhysics({ sampleSurface: ss, timeBudget: false });
const tally = {}; let changes = 0, prev = null, gm = 0;
for (let t = 0; t <= 600; t += 1) {
  for (let k = 0; k < 4; k++) physics.update(0.25, { bodyId: body, time: t + k * 0.25, focus: p, sunDir: d });
  const h = physics.here, kind = h.weather.kind, w = h.air.speed;
  if (t % 10 === 0) { tally[kind] = (tally[kind] || 0) + 10; if (prev && prev !== kind) changes++; prev = kind; if ((kind === 'mist' || kind === 'fog') && w > 12) gm += 10; }
}
console.log(`${body} ${place}, 600 s: ` + Object.entries(tally).map(([k, v]) => `${k} ${v} s`).join(', ') + `; ${changes} changes of name; called mist or fog with over 12 m/s at the walker: ${gm} s`);
