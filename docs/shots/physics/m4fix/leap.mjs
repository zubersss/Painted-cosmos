// After a leap inside one body (a debug teleport): is anything of PHYSICS' left hanging in the air at the new place?
// node leap.mjs <root> [from=spawn] [to=sea_coast] [clock=60]
const [root, from = 'spawn', to = 'sea_coast', clockS = '60'] = process.argv.slice(2);
const { Sim } = await import(root + '/src/core/sim.js');
const surface = await import(root + '/src/world/surface.js');
const obstacles = await import(root + '/src/world/obstacles.js');
const P = await import(root + '/src/physics/index.js');
const { Pad, play } = await import(root + '/tests/helpers.mjs');
const V = await import(root + '/src/core/vec.js');
const body = 'earth', ss = (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z);
const at = (pl) => { if (pl.startsWith('east:')) { const d = surface.getSurface(body).getSpawn(), m = +pl.slice(5) / 4000; let ex = d.z, ez = -d.x; const el = Math.hypot(ex, ez); ex /= el; ez /= el; return V.norm({ x: d.x + ex * m, y: d.y, z: d.z + ez * m }); } return pl === 'spawn' ? surface.getSurface(body).getSpawn() : surface.getStandPure(body, pl).unitDir; };
const physics = P.createPhysics({ sampleSurface: ss, timeBudget: false });
const sim = new Sim({ sampleSurface: ss, getSpawn: (id) => surface.getSurface(id).getSpawn(), sampleObstacles: (id, d, r) => obstacles.sampleObstaclesPure(id, d.x, d.y, d.z, r), physics, body });
sim.t = +clockS; const a = at(from); sim.teleport({ body, dir: [a.x, a.y, a.z] });
const pad = new Pad(); play(sim, pad, 20, { fps: 30 });
const count = (label) => {
  const B = physics.particles; let out = [];
  for (const k of ['leaves', 'spores', 'dust', 'spray', 'rain', 'snow']) {
    const b = B[k]; if (!b) continue; let hang = 0, far = 0;
    for (let i = 0; i < b.count; i++) {
      const p = { x: b.origin.x + b.pos[i * 3], y: b.origin.y + b.pos[i * 3 + 1], z: b.origin.z + b.pos[i * 3 + 2] }, r = V.len(p), g = ss(body, V.norm(p)), h = r - Math.max(g.radius, g.liquidRadius || 0);
      const sp = Math.hypot(b.vel[i * 3], b.vel[i * 3 + 1], b.vel[i * 3 + 2]);
      if (h > 0.3 && sp < 0.05) hang++;
      if (V.len(V.sub(p, sim.ex.p)) > 60) far++;
    }
    out.push(`${k} ${b.count} (${hang} still and over 0.3 m up, ${far} over 60 m from the explorer)`);
  }
  console.log(`${label}: ` + out.join('; '));
};
count(`at ${from} after 20 s`);
const b = at(to); const dist = Math.acos(Math.min(1, V.dot(V.norm(a), V.norm(b)))) * 4000;
sim.teleport({ body, dir: [b.x, b.y, b.z] });
play(sim, pad, 1 / 30, { fps: 30 }); count(`one frame after the leap of ${dist.toFixed(0)} m to ${to}`);
play(sim, pad, 3, { fps: 30 }); count('3 s after');
