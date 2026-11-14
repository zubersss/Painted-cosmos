// Sun elevation at every biome stand and vista at hour 10: the old hour (hour angle) and the new (the world's hour).
const root = (process.argv[2] || new URL('../../../../', import.meta.url).pathname).replace(/\/$/, '');
const H = Number(process.argv[3] || 10);
const { Ephemeris } = await import(root + '/src/core/orbits.js');
const { BODIES, BODY_IDS } = await import(root + '/src/data/bodies.js');
const S = await import(root + '/src/world/surface.js');
const el = (e, id, d) => { const s = e.sunDirLocal(id, 0); return Math.asin(s.x * d.x + s.y * d.y + s.z * d.z) * 57.2958; };
for (const id of BODY_IDS) {
  const look = (await import(root + '/src/data/looks.js')).getLook(id);
  const places = [];
  for (const b of look.biomes || []) { const st = S.getStandPure(id, b.id); if (st && st.unitDir) places.push(['b:' + b.id, st.unitDir]); }
  for (const v of S.getVistasPure(id)) places.push(['v:' + v.id, v.unitDir]);
  const out = [];
  for (const [n, u] of places) {
    const l = Math.hypot(u.x, u.y, u.z), d = { x: u.x / l, y: u.y / l, z: u.z / l };
    const a = new Ephemeris(BODIES); a.setLocalSolarTime(id, 0, d, H);
    const b = new Ephemeris(BODIES); b.setSunHour(id, 0, d, H);
    out.push(`${n.replace(/^b:/, '')} ${el(a, id, d).toFixed(0)}/${el(b, id, d).toFixed(0)}`);
  }
  console.log(id + ':', out.join(', '));
}
