const R = process.env.ROOT || '/home/user/painted-cosmos';
const { plantKit } = await import(R + '/src/core/sim.js');
const surface = await import(R + '/src/world/surface.js');
const obstacles = await import(R + '/src/world/obstacles.js');
const { crownShape } = await import(R + '/src/player/camera.js');
for (const [body, place] of [['earth', 'spawn'], ['earth', 'autumn_woodland'], ['saturn', 'crystal_reeds'], ['neptune', 'kelp_forests'], ['venus', 'fungal_towers'], ['mars', 'dry_riverbeds'], ['neptune', 'spawn'], ['saturn', 'spawn'], ['mercury', 'crystal_gardens'], ['uranus', 'frozen_waves'], ['pluto', 'long_shadow_plain'], ['jupiter', 'hanging_gardens']]) {
  const d = place === 'spawn' ? surface.getSurface(body).getSpawn() : surface.getStandPure(body, place).unitDir;
  const list = obstacles.sampleObstaclesPure(body, d.x, d.y, d.z, 30).filter((o) => o.height >= 4);
  const tally = {};
  for (const o of list) { const k = plantKit(body, o); const c = crownShape(k, o.radius); const key = `${k}:${c ? 'crown' : 'none'}`; tally[key] = (tally[key] || 0) + 1; }
  console.log(body.padEnd(8), place.padEnd(18), list.length, JSON.stringify(tally));
}
