// One approach of the verifier's easel.mjs (body, view name, side), traced: the ground along the walk.
import { mk, f2, len, dot, norm, sub, scale, BODIES, surface, vec } from '/home/user/.pc-scratch/verify/pilot/probes/lib.mjs';
const { add, cross, tangent, V } = vec;
const [body, name, hd] = [process.argv[2] || 'neptune', process.argv[3] || 'Ultramarine Storm Seas II', Number(process.argv[4] || 270)];
const getVistas = (id) => surface.getVistasPure(id);
const v = getVistas(body).find((q) => q.name === name);
const o = mk(body, { getVistas }); const { sim, pad, P } = o;
const d = norm(V(v.unitDir.x, v.unitDir.y, v.unitDir.z));
const east = tangent(cross(V(0, 1, 0), d), d, V(1, 0, 0)), north = cross(d, east), a = hd * Math.PI / 180;
const off = add(scale(north, Math.cos(a)), scale(east, Math.sin(a)));
const Rb = BODIES[body].radius, from = norm(add(d, scale(off, 22 / Rb)));
sim.teleport({ body, dir: [from.x, from.y, from.z], heading: (hd + 180) % 360 });
P(1); pad.press('KeyW');
P(25, { each: () => { const nv = sim.nearestVista(); if (nv && Math.abs(nv.bearingDeg) > 3) pad.dx += (nv.bearingDeg * Math.PI / 180 / 0.0023) * 0.2; }, until: () => !!sim.easelOffer });
pad.release('KeyW'); P(0.3);
const p0 = { ...sim.ex.p };
pad.tap('KeyE'); P(1 / 60);
const E = sim.easel;
console.log('walk', f2(len(sub(E.toP, E.fromP))), 'm of', f2(len(sub(scale(d, len(p0)), p0))), 'to the spot');
const sample = sim.sampler(body);
for (let k = 0; k <= 1.0001; k += 0.05) { const u = norm(vec.lerp(E.fromP, E.toP, k)), g = sample(u); console.log(' walk', f2(k), 'ground', f2(g.radius - Rb), 'liquid', f2(g.liquidRadius - Rb), 'slope', (g.slope * 57.3).toFixed(0)); }
const full = scale(d, len(p0));
for (let k = 0; k <= 1.0001; k += 0.1) { const u = norm(vec.lerp(p0, full, k)), g = sample(u); console.log(' line', f2(k), 'ground', f2(g.radius - Rb), 'liquid', f2(g.liquidRadius - Rb), 'slope', (g.slope * 57.3).toFixed(0)); }
let maxS = 0; P(8, { each: () => { if (sim.easel && sim.easel.phase === 'go') { const g = sample(norm(sim.ex.p)); maxS = Math.max(maxS, g.slope); } } });
console.log('max slope during go', (maxS * 57.3).toFixed(0), 'moved', f2(len(sub(sim.ex.p, p0))));
