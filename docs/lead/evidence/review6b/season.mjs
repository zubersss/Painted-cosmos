// The sun's highest and lowest at a body's spawn, stands and vistas over a day at t = 0, with the
// body's tilt as it is and turned the other way (axialTilt sign flipped: the other season, same orbits).
const root = (process.argv[2] || new URL('../../../../', import.meta.url).pathname).replace(/\/$/, ''), id = process.argv[3] || 'neptune';
const { Ephemeris } = await import(root + '/src/core/orbits.js');
const { BODIES } = await import(root + '/src/data/bodies.js');
const S = await import(root + '/src/world/surface.js');
const look = (await import(root + '/src/data/looks.js')).getLook(id);
const places = [['spawn', S.getSurface(id).getSpawn()]];
for (const b of look.biomes || []) { const st = S.getStandPure(id, b.id); if (st && st.unitDir) places.push([b.id, st.unitDir]); }
const flipped = { ...BODIES, [id]: { ...BODIES[id], axialTilt: -BODIES[id].axialTilt } };
const span = (tab, u) => { const e = new Ephemeris(tab); let lo = 90, hi = -90; for (let k = 0; k < 96; k++) { e.spinPhase[id] = k / 96 * Math.PI * 2; const s = e.sunDirLocal(id, 0); const el = Math.asin(s.x * u.x + s.y * u.y + s.z * u.z) * 57.2958; lo = Math.min(lo, el); hi = Math.max(hi, el); } return `${hi.toFixed(0)}/${lo.toFixed(0)}`; };
console.log(id, 'highest/lowest sun over a day: as now | tilt flipped');
for (const [n, u0] of places) { const l = Math.hypot(u0.x, u0.y, u0.z), u = { x: u0.x / l, y: u0.y / l, z: u0.z / l }; console.log(' ', n.padEnd(18), 'lat', (Math.asin(u.y) * 57.3).toFixed(0).padStart(4), '  ', span(BODIES, u).padEnd(8), '|', span(flipped, u)); }
