const R = process.env.ROOT;
const { Sim, CLOCK } = await import(R + '/src/core/sim.js');
const { stubSurface, stubSpawn } = await import(R + '/src/core/stubs/surface.js');
const { norm } = await import(R + '/src/core/vec.js');
const surface = process.argv[2] === 'real' ? await import(R + '/src/world/surface.js') : null;
const ss = surface ? (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z) : stubSurface;
const gs = surface ? (id) => surface.getSurface(id).getSpawn() : (id) => stubSpawn(id).unitDir;
for (const uneven of [false, true]) {
  const sim = new Sim({ sampleSurface: ss, getSpawn: gs });
  const DEG = 180 / Math.PI;
  const el = () => Math.asin(sim.eph.sunElevationSin('earth', sim.t, norm(sim.ex.p))) * DEG;
  let last = el(), max = -99, min = 99; const ev = [];
  const marks = [12, 8, 0, -3.5, -8, -9.5, -16];
  for (let t = 0; t < 3300; t += 0.25) {
    sim.t += 0.25; if (uneven) sim.stepClock(0.25);
    const e = el(); max = Math.max(max, e); min = Math.min(min, e);
    for (const m of marks) if ((last - m) * (e - m) < 0) ev.push(`${(t / 60).toFixed(2)}min ${e > last ? 'up' : 'down'} through ${m} (hour ${sim.eph.sunHour('earth', sim.t, norm(sim.ex.p)).toFixed(2)})`);
    last = e;
  }
  console.log(uneven ? 'UNEVEN' : 'EVEN', 'max elev', max.toFixed(1), 'min', min.toFixed(1));
  console.log(ev.join('\n'));
}
