// Saturn from orbit as tests/tour.mjs captureOrbit frames it: node ringframe.mjs [root] [old|new] [K=1.8 x the outer radius] [EL=25 deg]. Where the ring and the planet fall in a
// 960x540 frame of the ship camera (pure simulation; projection with the pose's fov and quaternion).
const root = (process.argv[2] || new URL('../../../../', import.meta.url).pathname).replace(/\/$/, '');
const mode = process.argv[3] || 'new'; const K = Number(process.argv[4] || 1.8), EL = Number(process.argv[5] || 25);
const { Sim } = await import(root + '/src/core/sim.js');
const surface = await import(root + '/src/world/surface.js');
const { getLook } = await import(root + '/src/data/looks.js');
const V = await import(root + '/src/core/vec.js');
const ss = (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z);
const b = 'saturn', sim = new Sim({ sampleSurface: ss, getSpawn: (id) => surface.getSurface(id).getSpawn(), body: 'earth' });
const sp = surface.getSurface(b).getSpawn(), sl = Math.hypot(sp.x, sp.y, sp.z), u = { x: sp.x / sl, y: sp.y / sl, z: sp.z / sl };
const R = ss(b, u).radius, rings = getLook(b).rings;
if (mode === 'old') sim.teleport({ body: b, dir: [u.x, u.y, u.z], hour: 10, ship: true, altitude: R * 1.15, pitchDeg: -86 });
else { const l = Math.hypot(u.x, u.z), la = (EL * Math.PI / 180) * (u.y < 0 ? -1 : 1); sim.teleport({ body: b, dir: [Math.cos(la) * u.x / l, Math.sin(la), Math.cos(la) * u.z / l], hour: 10, ship: true, altitude: R * (rings.outer * K - 1), pitchDeg: -86, heading: 0 }); }
for (let i = 0; i < 30; i++) sim.view(1 / 30);
const v = sim.view(1 / 30);
const C = sim.eph.position(b, sim.t), q = sim.eph.orientation(b, sim.t);
const W = 960, H = 540, f = (H / 2) / Math.tan((v.fov * Math.PI / 180) / 2);
const proj = (P) => { const d = V.qRotate(V.qConj(v.camQ), V.sub(P, v.camU)); if (d.z >= 0) return null; return [W / 2 + f * d.x / -d.z, H / 2 - f * d.y / -d.z]; };
const box = (pts) => { const p = pts.filter(Boolean); const xs = p.map((a) => a[0]), ys = p.map((a) => a[1]); return `x ${Math.min(...xs).toFixed(0)}..${Math.max(...xs).toFixed(0)}, y ${Math.min(...ys).toFixed(0)}..${Math.max(...ys).toFixed(0)}${p.length < pts.length ? ' (' + (pts.length - p.length) + ' behind)' : ''}`; };
const ring = (k) => { const out = []; for (let i = 0; i < 72; i++) { const a = i / 72 * Math.PI * 2; out.push(proj(V.add(C, V.qRotate(q, V.V(Math.cos(a) * k * R, 0, Math.sin(a) * k * R))))); } return out; };
const planet = []; for (let i = 0; i < 400; i++) { const y = 1 - 2 * (i + 0.5) / 400, r = Math.sqrt(1 - y * y), a = i * 2.39996; const n = V.V(Math.cos(a) * r, y, Math.sin(a) * r); const P = V.add(C, V.qRotate(q, V.scale(n, R))); if (V.dot(V.sub(P, C), V.sub(v.camU, P)) > 0) planet.push(proj(P)); }
console.log(mode, 'fov', v.fov.toFixed(1), 'view', v.view, 'distance', (V.len(V.sub(v.camU, C)) / R).toFixed(2), 'R');
console.log('  outer ring', box(ring(rings.outer)));
console.log('  inner ring', box(ring(rings.inner)));
console.log('  planet    ', box(planet), 'centre', proj(C).map((a) => a.toFixed(0)).join(','));
console.log("  outer ring at 8 angles", ring(rings.outer).filter((_, i) => i % 9 === 0).map((p) => p ? p.map((a) => a.toFixed(0)).join(",") : "-").join("  "));
const pole = proj(V.add(C, V.qRotate(q, V.V(0, R * 1.3, 0)))), spole = proj(V.add(C, V.qRotate(q, V.V(0, -R * 1.3, 0))));
console.log('  north pole at', pole && pole.map((a) => a.toFixed(0)).join(','), ' south pole at', spole && spole.map((a) => a.toFixed(0)).join(','));
const fs = await import(root + '/src/core/frames.js');
console.log('  shFrame', JSON.stringify(sim.shFrame), 'state', sim.sm.state);
