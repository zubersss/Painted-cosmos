// Painted Cosmos physics: small weather you can walk up to: dust devils. OWNER: PHYSICS. Pure.
//
// A dust devil is a convective vortex: sun-heated ground warms the air above it, a rising
// plume starts to spin, and the spinning column picks up dust. They need a dusty, sunlit
// surface and light winds, last a minute or two, lean and wander with the wind. On Earth they
// are 3-30 m wide and tens of metres tall with 5-25 m/s of swirl; on Mars (weak gravity, thin
// air, strong heating) they are the main way dust gets into the sky and reach hundreds of
// metres (Balme and Greeley 2006). The flow is a Rankine vortex: solid-body rotation inside
// the core radius, v ~ 1/r outside, with inflow at the foot and an updraught in the core.
//
// Like the weather cells they are a pure function of (seed, place, time): the world is cut
// into 260 m cubes and 150 s slots, and a hash decides whether a cube hosts a devil in a slot,
// where it starts, how big it is and which way it spins. No state, same devil on every visit.
import { hash3, hashString, smoothstep, clamp01, mix } from './util.js';
import { windLarge } from './wind.js';

export const DEVILS = Object.freeze({
  cell: 260,              // m: one candidate per cube of this size
  slot: 150,              // s: one candidate per slot
  life: [45, 120],        // s
  radius: [2.5, 10],      // m: core radius
  speed: [7, 20],         // m/s: swirl at the core radius
  up: [3, 9],             // m/s: updraught in the core
  height: [35, 260],      // m
  drift: 0.7,             // they travel at this fraction of the mean wind
  // how readily a body makes them (given dust, sun and light wind)
  chance: { mars: 0.32, earth: 0.2, default: 0 },
  // Mars: weaker gravity and thin air make them several times taller and wider
  scale: { mars: 2.2, earth: 1, default: 1 },
  max: 6,
});

const seedCache = {};
let _sb = null, _ss = NaN, _sv = 0;
function seedFor(bodyId, seed) {
  if (bodyId === _sb && seed === _ss) return _sv;
  const k = bodyId + ':' + seed;
  _sb = bodyId; _ss = seed;
  return (_sv = seedCache[k] || (seedCache[k] = hashString('devils-' + k) | 0));
}

const _wl = new Float64Array(4);

export function makeDevil() {
  return { x: 0, z: 0, p: { x: 0, y: 0, z: 0 }, radius: 0, height: 0, speed: 0, up: 0, spin: 1, strength: 0, age: 0, life: 0, id: 0 };
}

// The dust devils near body-local point (px,py,pz) at time t.
//   env: { dustSource 0..1, sun01 (cos zenith) or null, wind (mean wind speed, m/s), storm01,
//          rho (air density) }
//   frame: LocalFrame (for the grid coordinates x, z of each devil).
//   out: array of objects from makeDevil(); out.count is set. Returns out.
export function devilsNear(bodyId, px, py, pz, t, seed, env, frame, out) {
  out.count = 0;
  const chance = (DEVILS.chance[bodyId] != null ? DEVILS.chance[bodyId] : DEVILS.chance.default);
  if (!(chance > 0) || !(env.rho > 0)) return out;
  const sun = env.sun01 == null ? 0.6 : smoothstep(0.12, 0.5, env.sun01);
  const ready = chance * clamp01(env.dustSource * 1.3) * sun * (1 - smoothstep(7, 12, env.wind || 0)) * (1 - clamp01((env.storm01 || 0) * 2));
  if (!(ready > 0.01)) return out;
  const s = seedFor(bodyId, seed), C = DEVILS.cell, r = Math.hypot(px, py, pz);
  const scale = DEVILS.scale[bodyId] != null ? DEVILS.scale[bodyId] : DEVILS.scale.default;
  const cx = Math.floor(px / C), cy = Math.floor(py / C), cz = Math.floor(pz / C);
  for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const ix = cx + dx, iy = cy + dy, iz = cz + dz;
    // the cube's own point, somewhere inside it
    let qx = (ix + 0.15 + 0.7 * hash3(ix, iy, iz, s)) * C, qy = (iy + 0.15 + 0.7 * hash3(ix, iy, iz, s + 1)) * C, qz = (iz + 0.15 + 0.7 * hash3(ix, iy, iz, s + 2)) * C;
    const qr = Math.hypot(qx, qy, qz);
    // only the layer of cubes that the surface passes through (else stacked cubes would double up)
    if (Math.abs(qr - r) > C * 0.5) continue;
    const phase = hash3(ix, iy, iz, s + 3);
    const n = Math.floor(t / DEVILS.slot + phase);
    if (hash3(ix + n * 7919, iy, iz, s + 4) > ready) continue;
    const life = mix(DEVILS.life[0], DEVILS.life[1], hash3(ix, iy + n * 104729, iz, s + 5));
    const age = t - (n - phase) * DEVILS.slot - 0.05 * DEVILS.slot;
    if (age < 0 || age > life) continue;
    const strength = smoothstep(0, 9, age) * (1 - smoothstep(life - 12, life, age));
    if (strength <= 0) continue;
    // on the ground under that point, drifting with the wind and meandering
    const k = r / qr; qx *= k; qy *= k; qz *= k;
    const h1 = hash3(ix, iy, iz + n * 15485863, s + 6), h2 = hash3(ix, iy, iz + n * 15485863, s + 7);
    const x0 = frame.lx(qx, qy, qz), z0 = frame.lz(qx, qy, qz);
    // It travels with the wind it was born in: the large-scale wind at its birthplace at its
    // birth time, fixed for its whole life (a path that depended on the wind NOW would jump
    // with every gust).
    const tb = t - age;
    windLarge(bodyId, qx / r, qy / r, qz / r, tb, seed, _wl);
    const ve = _wl[0] * frame.ex + _wl[1] * frame.ey + _wl[2] * frame.ez, vn = _wl[0] * frame.nx + _wl[1] * frame.ny + _wl[2] * frame.nz;
    const ts = age - life * 0.5;
    const x = x0 + ve * DEVILS.drift * ts + Math.sin(age * 0.11 + h1 * 6.28) * 14;
    const z = z0 + vn * DEVILS.drift * ts + Math.cos(age * 0.09 + h2 * 6.28) * 14;
    if (out.count >= DEVILS.max) continue;
    const D = out[out.count] || (out[out.count] = makeDevil());
    out.count++;
    D.x = x; D.z = z;
    D.radius = mix(DEVILS.radius[0], DEVILS.radius[1], h1 * h1) * scale;
    D.height = mix(DEVILS.height[0], DEVILS.height[1], h2) * scale;
    D.speed = mix(DEVILS.speed[0], DEVILS.speed[1], hash3(ix, iy, iz, s + 8 + n));
    D.up = mix(DEVILS.up[0], DEVILS.up[1], hash3(ix, iy, iz, s + 9 + n));
    D.spin = hash3(ix, iy, iz, s + 10 + n) < 0.5 ? -1 : 1;          // either way: too small for Coriolis to choose
    D.strength = strength; D.age = age; D.life = life;
    D.id = ((ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791) ^ (n * 2654435761)) >>> 0;
    // body-local foot point (on the frame's tangent plane; the caller may drop it to the ground)
    D.p.x = frame.ox + frame.ex * x + frame.nx * z; D.p.y = frame.oy + frame.ey * x + frame.ny * z; D.p.z = frame.oz + frame.ez * x + frame.nz * z;
  }
  return out;
}

// Wind added by the devils at grid position (x, z), `hz` metres above the ground.
// Writes o[0] = east, o[1] = north, o[2] = up (m/s). Returns true when any devil is felt.
export function devilWind(devils, x, z, hz, o) {
  o[0] = 0; o[1] = 0; o[2] = 0;
  let any = false;
  for (let d = 0; d < devils.count; d++) {
    const D = devils[d];
    const dx = x - D.x, dz = z - D.z, r = Math.hypot(dx, dz);
    if (r > D.radius * 8 || hz > D.height) continue;
    const rc = D.radius, f = (r < rc ? r / rc : rc / r) * D.strength, ir = r > 1e-3 ? 1 / r : 0;
    // swirl plus inflow at the foot (a third of the swirl), updraught in and near the core
    o[0] += (-dz * ir * D.spin - dx * ir * 0.35) * D.speed * f;
    o[1] += (dx * ir * D.spin - dz * ir * 0.35) * D.speed * f;
    o[2] += D.up * D.strength * (r < rc * 1.5 ? 1 : rc * 1.5 / r) * (r < rc * 4 ? 1 : 0);
    any = true;
  }
  return any;
}
