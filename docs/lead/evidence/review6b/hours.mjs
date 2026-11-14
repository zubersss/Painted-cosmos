// setSunHour at every spawn: the world's hour and the sun's elevation after it, for 6, 9.5, 10, 12, 18.
const root = (process.argv[2] || new URL('../../../../', import.meta.url).pathname).replace(/\/$/, '');
const { Ephemeris } = await import(root + '/src/core/orbits.js');
const { BODIES, BODY_IDS } = await import(root + '/src/data/bodies.js');
const surface = await import(root + '/src/world/surface.js');
for (const id of BODY_IDS) {
  const sp = surface.getSurface(id).getSpawn(); const l = Math.hypot(sp.x, sp.y, sp.z); const d = { x: sp.x / l, y: sp.y / l, z: sp.z / l };
  const row = [];
  for (const h of [6, 9.5, 10, 12, 18, 0]) {
    const e = new Ephemeris(BODIES); e.setSunHour(id, 0, d, h);
    const s = e.sunDirLocal(id, 0), el = Math.asin(s.x * d.x + s.y * d.y + s.z * d.z) * 57.2958;
    row.push(`${h}->${e.sunHour(id, 0, d).toFixed(2)}(${el.toFixed(0)}°, ha ${e.localSolarTime(id, 0, d).toFixed(1)})`);
  }
  console.log(id.padEnd(8), row.join(' '));
}
const t0 = performance.now(); const e = new Ephemeris(BODIES); for (let i = 0; i < 100; i++) e.setSunHour('earth', 0, { x: 0.5, y: 0.6, z: 0.62 }, 10); console.log('ms per call', ((performance.now() - t0) / 100).toFixed(3));
