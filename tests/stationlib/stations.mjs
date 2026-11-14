// The fixed stations of the quality guard (docs/lead/SHARP-SMOOTH-PLAN.md section 5), with the exact
// arguments tests/stationlib/inpage.js places the game with. The first twenty are the sharpness
// audit's (its stations.py, /home/user/.pc-scratch/audit/sharp/bin/), in its order; then the plan's
// additions. A run always keeps this order (a subset too): what a station finds built depends a
// little on where the run stood before it (cells built lower down stay submitted higher up).
//
// Every station: hour 11 (unless named), a fair sky held (`weather=fair`), no weather marks (`kits=0`),
// the cockpit view with the hull hidden in the air, the loop held (`__pc.hold(true)`).
//   where: 'spawn' (world.getSpawn) or a biome id (world.findBiome)
//   foot:  stand there on foot (heading: compass degrees, look level), else the ship hovers `alt` m
//          above the ground with the camera `pitch` degrees below the horizon along `heading`.
export const STATIONS = [];
const add = (o) => STATIONS.push(o);
add({ name: 'E_foot', body: 'earth', where: 'spawn', foot: true, heading: null });
for (const alt of [50, 150, 400, 1000]) for (const pitch of [45, 90]) add({ name: `E_${alt}_${pitch}`, body: 'earth', where: 'spawn', alt, pitch, heading: 0 });
add({ name: 'M_foot', body: 'mars', where: 'rust_canyons', foot: true, heading: 250 });
for (const alt of [50, 150, 400, 1000]) for (const pitch of [45, 90]) add({ name: `M_${alt}_${pitch}`, body: 'mars', where: 'rust_canyons', alt, pitch, heading: 250 });
for (const pitch of [45, 90]) add({ name: `S_150_${pitch}`, body: 'saturn', where: 'spawn', alt: 150, pitch, heading: 15 });
// the plan's additions
add({ name: 'E_foot_night', body: 'earth', where: 'spawn', foot: true, heading: null, hour: 23 });
add({ name: 'E_150_45_dusk', body: 'earth', where: 'spawn', alt: 150, pitch: 45, heading: 0, hour: 18.6 });
// the storm: tests/weather.mjs' forced storm sky (world.setWeather), at hour 11; no rain marks (kits=0)
add({ name: 'E_150_45_storm', body: 'earth', where: 'spawn', alt: 150, pitch: 45, heading: 0, weather: 'storm' });
add({ name: 'N_150_45', body: 'neptune', where: 'spawn', alt: 150, pitch: 45, heading: 0 });
// W2.2's night station ("E_150_45 at night: t2 at least 0.9"), added last so the stations before it keep their order
add({ name: 'E_150_45_night', body: 'earth', where: 'spawn', alt: 150, pitch: 45, heading: 0, hour: 23 });

export const byName = (n) => STATIONS.find((s) => s.name === n);

// Named sets. 'quick' is stations-quick of the plan (W1.2: E_foot, E_150_45, E_1000_45 at q2).
export const SETS = {
  quick: ['E_foot', 'E_150_45', 'E_1000_45'],
  audit: STATIONS.slice(0, 20).map((s) => s.name),
  earth: STATIONS.filter((s) => s.body === 'earth').map((s) => s.name),
  air: STATIONS.filter((s) => !s.foot).map((s) => s.name),
  // the phone profile's stations (run with --device iphone14)
  phone: ['E_foot', 'E_150_45'],
  all: STATIONS.map((s) => s.name),
};

// Pick stations by set names, station names or regular expressions (comma separated), in list order.
export function pick(spec) {
  const want = new Set();
  for (const part of String(spec || 'quick').split(',').map((x) => x.trim()).filter(Boolean)) {
    if (SETS[part]) SETS[part].forEach((n) => want.add(n));
    else if (byName(part)) want.add(part);
    else { const re = new RegExp(part); STATIONS.forEach((s) => { if (re.test(s.name)) want.add(s.name); }); }
  }
  return STATIONS.filter((s) => want.has(s.name));
}

// The tiers of the guard: q2 at 1280x720 and 1920x1080, q1 and q0 at 1280x720 (render scale 1; the
// controller's own pick is not used). A tier pins painter.setQuality and setRenderScale.
export const TIERS = { q2: { q: 2, scale: 1 }, q1: { q: 1, scale: 1 }, q0: { q: 0, scale: 1 } };

// Post-pass experiments on the held scene (the sharpness audit's exp.py, and the lead's x26): each swaps
// uniforms or shader source in the post passes, the post passes run again on the scene in the targets,
// and the final and the abstraction output are measured against the station's own raw scene.
const KEEP_SRC = 'float keep = (1.0 - far) * (cls == 3.0 || cls == 5.0 ? 0.72 : 0.30);';
const keepfar = (k) => `float keep = mix(cls == 3.0 || cls == 5.0 ? 0.72 : 0.30, ${k.toFixed(2)}, far);`;
const SRC_C = 'vec4 c = soft > 0.0 ? mix(texture(tAbs, uv), pcCubic(tAbs, uv, uInTexel), soft) : texture(tAbs, uv);';
const rcas = (sharp) => SRC_C + `
  { vec3 e0 = c.rgb;
    vec3 b0 = texture(tAbs, uv + vec2(0.0, -uInTexel.y)).rgb, d0 = texture(tAbs, uv + vec2(-uInTexel.x, 0.0)).rgb;
    vec3 f0 = texture(tAbs, uv + vec2(uInTexel.x, 0.0)).rgb, h0 = texture(tAbs, uv + vec2(0.0, uInTexel.y)).rgb;
    vec3 mn4 = min(min(b0, d0), min(f0, h0)), mx4 = max(max(b0, d0), max(f0, h0));
    vec3 hitMin = min(mn4, e0) / (4.0 * mx4 + 1e-4);
    vec3 hitMax = (1.0 - max(mx4, e0)) / (4.0 * mn4 - 4.0 - 1e-4);
    vec3 lobeRGB = max(-hitMin, hitMax);
    float lobe = max(-0.1875, min(max(lobeRGB.r, max(lobeRGB.g, lobeRGB.b)), 0.0)) * ${sharp.toFixed(3)};
    c.rgb = clamp((lobe * (b0 + d0 + f0 + h0) + e0) / (4.0 * lobe + 1.0), 0.0, 1.0); }`;
// Each: { uniforms: { pigZ, brushX, brushY, abstraction, bleed }, patches: [[find, replace], ...] }
export const EXPERIMENTS = {
  x00_base: {},
  x01_abs_off: { uniforms: { abstraction: 0 } },
  x03_abs_bleed_off: { uniforms: { abstraction: 0, bleed: 0 } },
  x07_wobble_off: { uniforms: { pigZ: 0 } },
  x21_keepfar1: { patches: [[KEEP_SRC, keepfar(1)]] },
  'x26_keepfar1_wobble0.3': { uniforms: { pigZ: 0.3 }, patches: [[KEEP_SRC, keepfar(1)]] },
  'x23_keepfar1_wobble0.3_rcas0.5': { uniforms: { pigZ: 0.3 }, patches: [[KEEP_SRC, keepfar(1)], [SRC_C, rcas(0.5)]] },
};
