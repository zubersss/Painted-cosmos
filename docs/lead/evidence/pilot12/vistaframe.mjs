// Is the figure in the frame at a vista? (Node, PILOT's Sim.) For each vista of a body, stood on as the tour does
// (the painter's yaw and pitch, third person): where the feet and the hat fall in the picture (0 = the bottom edge,
// 1 = the top; 960x540, the sim's own field of view) and the boom's length. node vistaframe.mjs <root> <body,...>
const [root, bodies = 'jupiter'] = process.argv.slice(2);
const { Sim } = await import(root + '/src/core/sim.js');
const surface = await import(root + '/src/world/surface.js');
const obstacles = await import(root + '/src/world/obstacles.js');
const { Pad, play } = await import(root + '/tests/helpers.mjs');
const V = await import(root + '/src/core/vec.js');
const ss = (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z);
for (const body of bodies.split(',')) {
  const vistas = surface.getVistasPure(body);
  for (const v of vistas) {
    const sim = new Sim({ sampleSurface: ss, getSpawn: (id) => surface.getSurface(id).getSpawn(), sampleObstacles: (id, d, r) => obstacles.sampleObstaclesPure(id, d.x, d.y, d.z, r), body });
    const d = V.norm(v.unitDir);
    sim.teleport({ body, dir: [d.x, d.y, d.z], heading: v.yaw == null ? undefined : v.yaw * 180 / Math.PI, lookPitch: v.pitch == null ? undefined : v.pitch * 180 / Math.PI, firstPerson: false });
    const pad = new Pad(); play(sim, pad, 2);
    const cam = sim.camPose, q = cam.q, up = V.norm(sim.ex.p);
    const fwd = V.qRotate(q, { x: 0, y: 0, z: -1 }), cu = V.qRotate(q, { x: 0, y: 1, z: 0 });
    const fov = (sim.lastView && sim.lastView.fov) || 60, t = Math.tan(fov * Math.PI / 360);
    const sy = (p) => { const r = V.sub(p, cam.p), z = V.dot(r, fwd); return z <= 0.05 ? null : 0.5 + 0.5 * (V.dot(r, cu) / z) / t; };
    const feet = sy(sim.ex.p), hat = sy(V.add(sim.ex.p, V.scale(up, 1.9)));
    const boom = V.len(V.sub(cam.p, V.add(sim.ex.p, V.scale(up, 1.5))));
    const f = (x) => (x == null ? 'behind the lens' : x.toFixed(2));
    console.log(`${body} ${String(v.name || v.id).padEnd(34)} feet ${f(feet)}  hat ${f(hat)}  boom ${boom.toFixed(1)} m  pitch ${(sim.footCam.pitch * 57.3).toFixed(0)} deg  slope ${(ss(body, d).slope * 57.3).toFixed(0)}${(feet == null || feet < 0 || hat == null || hat > 1 || hat < 0.05) ? '   <-- OUT OF THE FRAME' : ''}`);
  }
}
