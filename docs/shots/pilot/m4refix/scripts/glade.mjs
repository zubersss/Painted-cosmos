// prints the glade stats for several rings (copy of tests/footcam.test.mjs glade())
const R0 = process.env.ROOT || '/home/user/painted-cosmos';
const { Sim } = await import(R0 + '/src/core/sim.js');
const { CAMERA, crownDistance } = await import(R0 + '/src/player/camera.js');
const { stubSurface, stubSpawn } = await import(R0 + '/src/core/stubs/surface.js');
const { Pad, play, norm, dot } = await import(R0 + '/tests/helpers.mjs');
const { V, add, scale, cross, tangent } = await import(R0 + '/src/core/vec.js');
for (const ring of [9.5, 11, 11.5, 12, 12.5, 13]) {
  const spawn = norm(stubSpawn('earth').unitDir), R = stubSurface('earth', spawn).radius;
  const east = tangent(cross(V(0, 1, 0), spawn), spawn, V(1, 0, 0)), north = cross(spawn, east);
  const trees = [];
  for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; trees.push({ unitDir: norm(add(spawn, add(scale(east, Math.cos(a) * ring / R), scale(north, Math.sin(a) * ring / R)))), radius: 0.35, height: 22 }); }
  const sim = new Sim({ sampleSurface: stubSurface, getSpawn: (id) => stubSpawn(id).unitDir, sampleObstacles: (id, d, r) => (id === 'earth' ? trees.filter((t) => Math.acos(Math.min(1, dot(norm(d), t.unitDir))) * R < r + 1) : []) });
  const pad = new Pad(); play(sim, pad, 0.5);
  const crowns = trees.map((t) => ({ base: scale(t.unitDir, stubSurface('earth', t.unitDir).radius), u: t.unitDir, h: t.height, r: t.radius }));
  const s = { worst: Infinity, top: 0, n: 0, cut: 0, hidden: 0, airShort: Infinity, inCrownLong: 0, inCrown: 0, minBoom: 9 };
  const each = () => {
    const up = norm(sim.ex.p), head = add(sim.ex.p, scale(up, CAMERA.pivotHeight));
    s.top = Math.max(s.top, sim.ex.altitude);
    if (!sim.explorerVisible()) s.hidden++;
    s.minBoom = Math.min(s.minBoom, sim.footCam.boomNow);
    if (!sim.ex.grounded && sim.ex.altitude > 3) s.airShort = Math.min(s.airShort, sim.footCam.boomNow);
    if (!sim.camPose || crownDistance(crowns, head) < CAMERA.footThrough) return;
    s.n++;
    const d = crownDistance(crowns, sim.camPose.p);
    s.worst = Math.min(s.worst, d);
    if (d < 0) { s.inCrown++; if (sim.footCam.boomNow > CAMERA.footBoomMin + 0.3) s.inCrownLong++; }
    if (sim.footCam.boomNow < CAMERA.boom - 0.5) s.cut++;
  };
  pad.press('Space'); play(sim, pad, 3.2, { each }); pad.release('Space');
  play(sim, pad, 14, { each, until: () => sim.ex.grounded }); play(sim, pad, 2, { each });
  console.log(ring, JSON.stringify(s, (k, v) => typeof v === 'number' ? +v.toFixed(2) : v), 'end', sim.footCam.boomNow.toFixed(2));
}
