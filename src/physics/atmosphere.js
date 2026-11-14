// Painted Cosmos physics: the air of every body, and how things fall through it.
// OWNER: PHYSICS. Pure (no three, no DOM). Units: SI (kg, m, s, K, Pa).
//
// REAL VALUES, GAME SCALE. Gas properties at the ground are the real ones (sources in the table).
// Only the vertical scale is compressed, because the game's bodies are 2-5 km in radius and
// their atmospheres end 120-1400 m up (src/data/bodies.js `atmosphereHeight`):
//   density(h) = rho0 * exp(-h / H),  H = atmosphereHeight / SCALE_HEIGHTS
// SCALE_HEIGHTS = 2.5 puts the top of the atmosphere at 8.2 % of ground density. That number is
// not arbitrary: with drag ~ rho v^2 a ship of constant thrust is then 1/sqrt(0.082) = 3.5 times
// faster at the top than at the ground, which is exactly the 46 -> 160 m/s that PILOT tuned by
// hand (src/ship/flight.js speedGround / speedAtmoTop). Above the top the air fades to vacuum.
import { BODIES } from '../data/bodies.js';
import { clamp, clamp01, smoothstep } from './util.js';

export const SCALE_HEIGHTS = 2.5;
export const R_GAS = 8.314462;          // J/(mol K)

// rho0: density at the base radius (kg/m^3).  T0: mean temperature there (K).
// mu: dynamic viscosity (Pa s).  c: speed of sound (m/s).  M: molar mass (kg/mol).
// p0: pressure (Pa).  dTpole: how much colder the poles are than the equator (K).
// dTday: half the day-night swing (K).  lapse: K per metre of GAME altitude.
export const ATMOSPHERES = {
  // Mercury, the Moon: surface-bounded exospheres (1e-14 bar and less). For every model in the
  // game that is a vacuum: no drag, no wind, no sound. Temperatures are real surface values.
  mercury: { rho0: 0, T0: 440, mu: 0, c: 0, M: 0.023, p0: 0, dTpole: 150, dTday: 250, lapse: 0, gas: 'vacuum' },
  moon: { rho0: 0, T0: 250, mu: 0, c: 0, M: 0.004, p0: 0, dTpole: 120, dTday: 140, lapse: 0, gas: 'vacuum' },
  // Venus at the surface: 92 bar of CO2 at 737 K -> 65 kg/m^3 (NASA Venus fact sheet). The air is
  // a twentieth of the density of water; surface winds are 0.3-1 m/s (Venera landers).
  venus: { rho0: 65, T0: 737, mu: 3.3e-5, c: 410, M: 0.04345, p0: 9.2e6, dTpole: 5, dTday: 1, lapse: 0.016, gas: 'CO2' },
  // Earth, ICAO standard atmosphere at sea level. The lapse rate is the real 6.5 K/km times the
  // game's vertical compression, chosen so the snow line (273 K) sits near 275 m where PAINTER's
  // alpine recipe turns white.
  earth: { rho0: 1.225, T0: 288, mu: 1.81e-5, c: 340, M: 0.02897, p0: 101325, dTpole: 45, dTday: 5, lapse: 0.055, gas: 'N2/O2' },
  // Mars: 610 Pa of CO2 at 210 K -> 0.020 kg/m^3 (NASA Mars fact sheet); speed of sound 240 m/s.
  mars: { rho0: 0.020, T0: 213, mu: 1.08e-5, c: 240, M: 0.04334, p0: 610, dTpole: 60, dTday: 35, lapse: 0.012, gas: 'CO2' },
  // The giants have no ground. The game's imagined surfaces are placed at real pressure levels:
  // Jupiter's sky-islands just under the water-cloud deck at 6 bar (290 K; the Galileo probe
  // measured 273 K at 5 bar and 300 K at 7), Saturn's at 10 bar (290 K), Uranus at 2 bar (90 K,
  // methane-ice clouds), Neptune at 3 bar (95 K, where methane is liquid: its seas and its
  // rain). rho = p M / (R T). Viscosity and sound speed are for H2/He. Warm enough on Jupiter
  // and Saturn for the storms to rain water.
  jupiter: { rho0: 0.57, T0: 290, mu: 8.8e-6, c: 1210, M: 0.0023, p0: 6e5, dTpole: 4, dTday: 1, lapse: 0.006, gas: 'H2/He' },
  saturn: { rho0: 0.91, T0: 290, mu: 8.8e-6, c: 1240, M: 0.0022, p0: 1e6, dTpole: 4, dTday: 1, lapse: 0.006, gas: 'H2/He' },
  uranus: { rho0: 0.70, T0: 90, mu: 3.9e-6, c: 660, M: 0.0026, p0: 2e5, dTpole: 3, dTday: 0.5, lapse: 0.004, gas: 'H2/He/CH4' },
  neptune: { rho0: 0.99, T0: 95, mu: 4.0e-6, c: 675, M: 0.0026, p0: 3e5, dTpole: 3, dTday: 0.5, lapse: 0.004, gas: 'H2/He/CH4' },
  // Pluto: about 1 Pa of N2 at 40 K (New Horizons) -> 8.4e-5 kg/m^3. Almost nothing, but a gas:
  // the mean free path is 0.4 mm, so fine frost crystals do drift down slowly (see slip below).
  pluto: { rho0: 8.4e-5, T0: 40, mu: 2.7e-6, c: 129, M: 0.028, p0: 1.0, dTpole: 4, dTday: 3, lapse: 0.002, gas: 'N2' },
};

// What the liquid on each body is (density kg/m^3, viscosity Pa s, surface tension N/m).
// Earth: water at 15 C. Venus: sulphuric acid. Neptune: liquid methane at 95 K. The gas giants'
// and Uranus' pools are water-ammonia brine. Anything else falls back to water.
export const LIQUIDS = {
  earth: { name: 'water', density: 999, viscosity: 1.14e-3, tension: 0.073 },
  venus: { name: 'sulphuric acid', density: 1830, viscosity: 0.024, tension: 0.055 },
  jupiter: { name: 'ammonia brine', density: 950, viscosity: 2.0e-3, tension: 0.065 },
  saturn: { name: 'ammonia brine', density: 950, viscosity: 2.0e-3, tension: 0.065 },
  uranus: { name: 'methane slush', density: 480, viscosity: 3.0e-4, tension: 0.017 },
  neptune: { name: 'liquid methane', density: 450, viscosity: 1.9e-4, tension: 0.017 },
  default: { name: 'water', density: 999, viscosity: 1.14e-3, tension: 0.073 },
  // liquids that belong to a biome, not to a whole world (see ground.js BIOME_LIQUID)
  // lava: basalt near its vent. Two and a half times as dense as water and a hundred thousand
  // times as viscous: a body floats high in it and wades as through cold honey.
  lava: { name: 'lava', density: 2600, viscosity: 100, tension: 0.35 },
  // the cloud seas of the giants: a froth of droplets dense enough to carry a trimmed suit.
  // An eighth of water's density, so it barely drags and its billows run high and slow.
  cloud: { name: 'cloud froth', density: 120, viscosity: 1e-4, tension: 0.01 },
};
export const liquidOf = (bodyId) => LIQUIDS[bodyId] || LIQUIDS.default;

export function atmosphereOf(bodyId) {
  const a = ATMOSPHERES[bodyId];
  if (!a) throw new Error('unknown body id: ' + bodyId);
  return a;
}
export function scaleHeight(bodyId) {
  const h = BODIES[bodyId].atmosphereHeight || 0;
  return h > 0 ? h / SCALE_HEIGHTS : 1;
}

// Air density (kg/m^3) at `altitude` metres above the base radius. Smooth, never negative.
export function airDensity(bodyId, altitude) {
  const a = ATMOSPHERES[bodyId];
  if (!a || a.rho0 <= 0) return 0;
  const top = BODIES[bodyId].atmosphereHeight || 0;
  if (top <= 0) return 0;
  const h = altitude < -200 ? -200 : altitude;
  if (h >= top * 1.3) return 0;
  const rho = a.rho0 * Math.exp(-h * SCALE_HEIGHTS / top);
  return h > top ? rho * (1 - smoothstep(top, top * 1.3, h)) : rho;
}

// Air temperature (K). latSin = sin(latitude) = unitDir.y. sun01 = cosine of the sun's zenith
// angle at the point (dot(up, sunDir)), or null when unknown (then the daily mean is returned).
export function airTemperature(bodyId, altitude, latSin, sun01) {
  const a = ATMOSPHERES[bodyId];
  const top = BODIES[bodyId].atmosphereHeight || 0;
  // equator warmer, poles colder; the mean over the sphere is T0 (cos^2 averages 2/3)
  let T = a.T0 + a.dTpole * ((1 - latSin * latSin) - 2 / 3);
  // the lapse stops at the top of the weather layer (60 % of the atmosphere)
  const h = clamp(altitude, -100, top > 0 ? top * 0.6 : 0);
  T -= a.lapse * h;
  if (sun01 != null) T += a.dTday * clamp(sun01 * 1.3 - 0.15, -1, 1);
  return T < 20 ? 20 : T;
}

// Gravity (m/s^2) at radius r from the centre: inverse square from the surface value.
export function gravityAt(bodyId, r) {
  const b = BODIES[bodyId];
  const k = b.radius / (r > b.radius * 0.5 ? r : b.radius * 0.5);
  return b.gravity * k * k;
}

// ---- falling through air -------------------------------------------------------------------
// Drag coefficient of a sphere against Reynolds number: Schiller-Naumann (1933),
//   Cd = 24/Re (1 + 0.15 Re^0.687) for Re < 1000, then 0.44 (Newton regime).
export function sphereCd(Re) {
  if (Re < 1e-9) return 1e12;
  return Re < 1000 ? (24 / Re) * (1 + 0.15 * Math.pow(Re, 0.687)) : 0.44;
}

// Kinds of particle. d: diameter (m). rho: density (kg/m^3). shape: multiplies the sphere drag
// (flakes and plates fall flat and slow). tension: surface tension when liquid (N/m), 0 for
// solids. Liquid drops flatten as they fall, which raises their drag: Cd *= 1 + 0.147 Eo, with
// the Eotvos number Eo = rho g d^2 / tension. That one term reproduces the measured terminal
// speeds of raindrops (Gunn and Kinzer 1949: 4.03, 6.49, 8.06, 9.09 m/s at 1, 2, 3, 5 mm) to
// about 5 %, and carries to other gravities and other liquids unchanged.
export const SPECIES = {
  drizzle: { d: 0.0004, rho: 999, shape: 1, tension: 0.073 },
  rain: { d: 0.002, rho: 999, shape: 1, tension: 0.073 },
  heavyRain: { d: 0.0035, rho: 999, shape: 1, tension: 0.073 },
  hail: { d: 0.012, rho: 900, shape: 1.1, tension: 0 },
  // Snow aggregates: density falls with size (about 30-50 kg/m^3 at 5 mm) and they fall
  // broadside. Observed 0.8-1.5 m/s (Locatelli and Hobbs 1974).
  snow: { d: 0.005, rho: 32, shape: 2.2, tension: 0 },
  blizzardSnow: { d: 0.0025, rho: 70, shape: 1.8, tension: 0 },   // small, dense, wind-broken
  iceCrystal: { d: 0.0006, rho: 500, shape: 2.5, tension: 0 },    // plates and needles
  frost: { d: 0.00001, rho: 900, shape: 1.5, tension: 0 },        // 10 micron haze frost (Pluto)
  dust: { d: 0.00003, rho: 2600, shape: 1.3, tension: 0 },        // 30 micron silt
  marsDust: { d: 0.000003, rho: 2700, shape: 1.3, tension: 0 },   // 3 micron: hangs for days
  sand: { d: 0.00025, rho: 2650, shape: 1.2, tension: 0 },        // 250 micron dune sand
  ash: { d: 0.0003, rho: 1100, shape: 2.0, tension: 0 },
  spore: { d: 0.00006, rho: 600, shape: 1.5, tension: 0 },
  leaf: { d: 0.05, rho: 9, shape: 2.6, tension: 0 },              // a 5 cm leaf: about 1.5 m/s on Earth
  spray: { d: 0.001, rho: 999, shape: 1, tension: 0.073 },
  acid: { d: 0.0006, rho: 1830, shape: 1, tension: 0.055 },       // Venus sulphuric acid drizzle
  methaneRain: { d: 0.003, rho: 450, shape: 1, tension: 0.017 },  // Neptune
  methaneSnow: { d: 0.004, rho: 60, shape: 2.2, tension: 0 },     // Uranus
};

// Terminal fall speed (m/s) of a particle: weight minus buoyancy against drag,
//   v = sqrt( 4 g d (rho_p - rho_a) / (3 Cd rho_a) ),  Cd = Cd(Re), Re = rho_a v d / mu,
// solved by fixed-point iteration. In thin air a small particle is no longer in a continuum:
// the Cunningham slip correction Cc = 1 + Kn (1.257 + 0.4 exp(-1.1 / Kn)), Kn = 2 lambda / d,
// divides the drag (lambda: mean free path). In a vacuum there is no terminal speed: Infinity.
export function terminalVelocity(species, g, rhoAir, mu, meanFreePath = 0) {
  const sp = typeof species === 'string' ? SPECIES[species] : species;
  if (!(rhoAir > 0) || !(mu > 0)) return Infinity;
  const d = sp.d, drho = sp.rho - rhoAir;
  if (drho <= 0) return 0;                                  // floats
  let shape = sp.shape || 1;
  if (sp.tension > 0) shape *= 1 + 0.147 * (sp.rho * g * d * d / sp.tension);
  const Cc = meanFreePath > 0 ? 1 + (2 * meanFreePath / d) * (1.257 + 0.4 * Math.exp(-1.1 * d / (2 * meanFreePath))) : 1;
  // start from Stokes: v = d^2 drho g / (18 mu)
  let v = Cc * d * d * drho * g / (18 * mu);
  for (let i = 0; i < 40; i++) {
    const Re = rhoAir * v * d / mu;
    const Cd = sphereCd(Re) * shape / Cc;
    const vn = Math.sqrt(4 * g * d * drho / (3 * Cd * rhoAir));
    if (Math.abs(vn - v) < 1e-6 * vn) { v = vn; break; }
    v = 0.5 * (v + vn);
  }
  return v;
}

// Mean free path of the gas (m): lambda = (mu / p) sqrt(pi R T / (2 M)).
export function meanFreePath(bodyId, rho, T) {
  const a = ATMOSPHERES[bodyId];
  if (!(rho > 0) || !(a.mu > 0)) return Infinity;
  const p = rho * R_GAS * T / a.M;
  return (a.mu / p) * Math.sqrt(Math.PI * R_GAS * T / (2 * a.M));
}

// Terminal speed of a species on a body at an altitude, with that body's gravity and air.
export function fallSpeed(bodyId, species, altitude = 0) {
  const a = ATMOSPHERES[bodyId];
  const rho = airDensity(bodyId, altitude);
  const T = airTemperature(bodyId, altitude, 0.5, null);
  return terminalVelocity(species, BODIES[bodyId].gravity, rho, a.mu, meanFreePath(bodyId, rho, T));
}

// Terminal speed of a blunt body from its mass and drag area (CdA, m^2):
//   v = sqrt(2 m g / (rho CdA))
export function bluntTerminal(mass, g, rho, CdA) {
  return rho > 0 ? Math.sqrt(2 * mass * g / (rho * CdA)) : Infinity;
}

// Dynamic pressure (Pa) of air moving at `speed`: q = rho v^2 / 2.
export const dynamicPressure = (rho, speed) => 0.5 * rho * speed * speed;

// How far the top of the weather layer is (clouds form and rain starts below it).
export function cloudBase(bodyId) {
  return (BODIES[bodyId].atmosphereHeight || 0) * 0.45;
}
export { clamp01 };
