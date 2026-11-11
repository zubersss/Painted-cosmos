// Painted Cosmos physics: what the ground is made of and how it meets a boot, a landing leg or
// a grain of sand. OWNER: PHYSICS. Pure (no three, no DOM).
//
// Each material is a row of measured or handbook values (sources in the comments). Each biome
// maps to a material for level ground, one for steep ground and one for the shore. Wetness,
// snow depth and temperature (from weather.js) then change the contact honestly: wet rock
// loses nearly half its grip, soil turns to mud, ice is slippery only near its melting point.
import { clamp, clamp01, mix, smoothstep } from './util.js';
import { fetchOf } from './water.js';

// muS / muK: static and kinetic friction of a lugged rubber boot sole, dry.
// wet: multiplier on both at wetness 1.   foothold: extra holding traction on a slope from
// roughness you can stand IN rather than ON (steps, tufts, ledges); added to muS when standing
// or climbing.   rest: restitution of a rigid body dropped on it.   sink: how deep a 100 kg
// walker's boot presses in (m).   resist: resistance to walking as a fraction of the normal
// force (the cost of deforming the ground each step).   repose: angle of repose (rad) of loose
// material, 0 for solids.   density: bulk density (kg/m^3).   grain: grain diameter (m).
// dust: 0..1 how much fine loose material a step, a jet or a gust can raise.
// z0: aerodynamic roughness length (m).   imprint: 0..1 how well it keeps a footprint.
// mudding: 0..1 how far it turns to mud when soaked.
export const MATERIALS = {
  // Turf: rubber on dry grass about 0.6-0.7, wet grass 0.35-0.4 (sports-surface traction tests).
  grass: { muS: 0.65, muK: 0.50, wet: 0.58, foothold: 0.30, rest: 0.15, sink: 0.010, resist: 0.030, repose: 0, density: 1300, grain: 0, dust: 0.02, z0: 0.03, imprint: 0.35, mudding: 0.25 },
  // Firm earth: 0.6-0.8 dry.
  soil: { muS: 0.70, muK: 0.55, wet: 0.65, foothold: 0.30, rest: 0.12, sink: 0.015, resist: 0.030, repose: 0, density: 1500, grain: 0.0001, dust: 0.15, z0: 0.02, imprint: 0.6, mudding: 0.8 },
  // Forest floor: leaf litter over soil shears on itself.
  litter: { muS: 0.60, muK: 0.45, wet: 0.60, foothold: 0.25, rest: 0.08, sink: 0.025, resist: 0.045, repose: 0, density: 700, grain: 0, dust: 0.06, z0: 0.05, imprint: 0.5, mudding: 0.4 },
  // Mud: 0.2-0.4; walking in it costs about a fifth of your weight in drag.
  mud: { muS: 0.35, muK: 0.25, wet: 0.80, foothold: 0.10, rest: 0.02, sink: 0.08, resist: 0.22, repose: 0, density: 1700, grain: 0, dust: 0, z0: 0.01, imprint: 0.95, mudding: 1 },
  // Dry dune sand: internal friction 34 degrees (tan = 0.67), repose 34 degrees; walking on it
  // costs 2.1-2.7 times the energy of firm ground (Lejeune et al. 1998). Damp sand is firmer.
  sand: { muS: 0.60, muK: 0.48, wet: 1.15, foothold: 0.05, rest: 0.05, sink: 0.06, resist: 0.28, repose: 0.593, density: 1600, grain: 0.00025, dust: 0.6, z0: 0.003, imprint: 0.85, mudding: 0 },
  // Fine dust and regolith: lunar soil has 30-50 degrees of internal friction, bulk density
  // 1500 kg/m^3, and took 1-3 cm bootprints (Apollo soil mechanics reports).
  dust: { muS: 0.62, muK: 0.50, wet: 0.80, foothold: 0.10, rest: 0.05, sink: 0.035, resist: 0.16, repose: 0.61, density: 1500, grain: 0.00005, dust: 1.0, z0: 0.005, imprint: 1.0, mudding: 0.6 },
  gravel: { muS: 0.60, muK: 0.50, wet: 0.90, foothold: 0.20, rest: 0.10, sink: 0.025, resist: 0.12, repose: 0.66, density: 1700, grain: 0.01, dust: 0.2, z0: 0.01, imprint: 0.4, mudding: 0 },
  // Rock: rubber on dry rock 0.8-1.0, wet 0.4-0.5.
  rock: { muS: 0.85, muK: 0.65, wet: 0.55, foothold: 0.40, rest: 0.20, sink: 0, resist: 0.010, repose: 0, density: 2700, grain: 0, dust: 0.03, z0: 0.02, imprint: 0, mudding: 0 },
  // Snow: boots on compacted snow 0.3-0.4; fresh snow 100-150 kg/m^3; walking in 25 cm of it
  // costs about three times firm ground. `sink` here is per metre of depth up to 0.35 m.
  snow: { muS: 0.38, muK: 0.28, wet: 0.80, foothold: 0.25, rest: 0.03, sink: 0.20, resist: 0.40, repose: 0.66, density: 150, grain: 0.001, dust: 0.5, z0: 0.002, imprint: 1.0, mudding: 0 },
  // Ice: see iceFriction() below; these are the values at 263 K (-10 C).
  ice: { muS: 0.15, muK: 0.10, wet: 0.50, foothold: 0.03, rest: 0.10, sink: 0, resist: 0.005, repose: 0, density: 917, grain: 0, dust: 0, z0: 0.0005, imprint: 0, mudding: 0 },
  ash: { muS: 0.50, muK: 0.40, wet: 0.90, foothold: 0.10, rest: 0.03, sink: 0.06, resist: 0.25, repose: 0.61, density: 900, grain: 0.0003, dust: 0.9, z0: 0.004, imprint: 0.9, mudding: 0.5 },
  // Volcanic glass: smooth; grips dry, treacherous wet.
  glass: { muS: 0.55, muK: 0.40, wet: 0.45, foothold: 0.08, rest: 0.30, sink: 0, resist: 0.005, repose: 0, density: 2400, grain: 0, dust: 0.02, z0: 0.001, imprint: 0, mudding: 0 },
  crystal: { muS: 0.60, muK: 0.45, wet: 0.60, foothold: 0.30, rest: 0.30, sink: 0, resist: 0.010, repose: 0, density: 2600, grain: 0, dust: 0.01, z0: 0.05, imprint: 0, mudding: 0 },
  // Moss, fungal mat, the spongy turf of the sky-islands.
  moss: { muS: 0.50, muK: 0.40, wet: 0.60, foothold: 0.20, rest: 0.05, sink: 0.04, resist: 0.08, repose: 0, density: 500, grain: 0, dust: 0.08, z0: 0.05, imprint: 0.5, mudding: 0.2 },
  // The bed of shallow liquid: wet stones and silt. The liquid's own drag is added by the body
  // models from the depth, not here.
  bed: { muS: 0.50, muK: 0.38, wet: 1.0, foothold: 0.15, rest: 0.05, sink: 0.03, resist: 0.08, repose: 0, density: 1900, grain: 0.002, dust: 0, z0: 0.0002, imprint: 0.3, mudding: 0 },
};
export const MATERIAL_IDS = Object.keys(MATERIALS);

// Friction of ice against temperature. Ice is slippery because of a melt-water film; far below
// freezing there is none. Measured sliding friction rises from about 0.03-0.05 at 0 C to 0.1 at
// -10 C, 0.3 near -40 C and 0.5 or more below -70 C. So Earth's glaciers are treacherous and
// the 90 K ice of Uranus grips like rock. Returns the static coefficient.
export function iceFriction(T) {
  if (T >= 272) return 0.06;
  if (T >= 263) return mix(0.15, 0.06, (T - 263) / 9);
  if (T >= 233) return mix(0.35, 0.15, (T - 233) / 30);
  if (T >= 200) return mix(0.55, 0.35, (T - 200) / 33);
  return 0.55;
}

// ---- biomes ---------------------------------------------------------------------------------
// ground: material of level ground.  steep: material where the slope is steep.  shore: material
// just above a liquid.  z0: roughness (m).  canopy / canopyH: closed-canopy fraction and height.
// moist: rain and snow multiplier.  fog: 0..1 tendency to fog.  dT: K warmer than the latitude
// mean.  dustSrc: 0..1 how much dust the wind can lift here.  snowBase: permanent snow (m).
const B = (ground, steep, shore, z0, canopy, canopyH, moist, fog, dT, dustSrc, snowBase = 0) =>
  ({ ground, steep, shore, z0, canopy, canopyH, moist, fog, dT, dustSrc, snowBase });
export const BIOMES = {
  // earth
  temperate_forest: B('litter', 'rock', 'mud', 0.05, 0.75, 14, 1.0, 0.30, 0, 0.02),
  autumn_woodland: B('litter', 'rock', 'mud', 0.05, 0.65, 13, 0.9, 0.40, -4, 0.02),
  alpine_meadow: B('grass', 'rock', 'gravel', 0.03, 0.0, 0, 1.0, 0.15, -4, 0.02),
  sea_coast: B('grass', 'rock', 'sand', 0.01, 0.0, 0, 1.1, 0.30, 1, 0.05),
  desert_canyon: B('sand', 'rock', 'sand', 0.01, 0.0, 0, 0.08, 0.0, 10, 0.7),
  misty_wetland: B('mud', 'soil', 'mud', 0.10, 0.25, 2.2, 1.2, 0.90, 0, 0),
  // mercury
  ochre_basins: B('dust', 'rock', 'dust', 0.005, 0, 0, 0, 0, 0, 0.6),
  obsidian_fields: B('glass', 'glass', 'glass', 0.001, 0, 0, 0, 0, 0, 0.05),
  crystal_gardens: B('gravel', 'crystal', 'gravel', 0.3, 0, 0, 0, 0, -60, 0.1),
  shadow_craters: B('ice', 'rock', 'ice', 0.005, 0, 0, 0, 0, -330, 0.2),
  // venus
  fungal_towers: B('moss', 'rock', 'mud', 0.3, 0.5, 12, 0.6, 0.6, -6, 0.05),
  lava_rivers: B('rock', 'rock', 'ash', 0.02, 0, 0, 0.2, 0.2, 40, 0.3),
  acid_terraces: B('gravel', 'rock', 'mud', 0.02, 0, 0, 0.8, 0.5, 0, 0.05),
  pale_mesas: B('rock', 'rock', 'gravel', 0.02, 0, 0, 0.3, 0.05, -8, 0.2),
  // moon
  mare: B('dust', 'rock', 'dust', 0.005, 0, 0, 0, 0, 0, 0.8),
  highlands: B('dust', 'rock', 'dust', 0.01, 0, 0, 0, 0, 0, 0.7),
  crater_fields: B('dust', 'rock', 'dust', 0.01, 0, 0, 0, 0, 0, 0.7),
  rilles: B('dust', 'rock', 'dust', 0.01, 0, 0, 0, 0, 0, 0.6),
  // mars
  rust_canyons: B('gravel', 'rock', 'sand', 0.02, 0, 0, 0, 0.05, 0, 0.5),
  dust_dunes: B('sand', 'sand', 'sand', 0.003, 0, 0, 0, 0, 2, 1.0),
  polar_frost: B('ice', 'rock', 'ice', 0.001, 0, 0, 0.3, 0.2, -50, 0.1, 0.04),
  dry_riverbeds: B('gravel', 'rock', 'sand', 0.02, 0.1, 3, 0, 0.1, 0, 0.5),
  // jupiter
  sky_islands: B('moss', 'rock', 'moss', 0.05, 0.1, 4, 1.0, 0.4, 0, 0.02),
  storm_wall: B('rock', 'rock', 'gravel', 0.05, 0, 0, 1.4, 0.3, -3, 0.05),
  hanging_gardens: B('moss', 'rock', 'mud', 0.2, 0.4, 5, 1.2, 0.5, 2, 0),
  lightning_plains: B('gravel', 'rock', 'gravel', 0.01, 0, 0, 1.3, 0.2, 0, 0.1),
  // saturn
  gold_islands: B('moss', 'rock', 'moss', 0.05, 0.05, 3, 0.8, 0.5, 0, 0.02),
  crystal_reeds: B('gravel', 'crystal', 'gravel', 0.15, 0.5, 2, 0.6, 0.4, 0, 0.02),
  ring_shadow: B('soil', 'rock', 'gravel', 0.03, 0, 0, 0.6, 0.5, -6, 0.05),
  honey_mist: B('moss', 'rock', 'mud', 0.05, 0.1, 3, 1.0, 1.0, 0, 0),
  // uranus
  ice_shelves: B('ice', 'ice', 'ice', 0.001, 0, 0, 0.6, 0.3, 0, 0, 0.02),
  frozen_waves: B('snow', 'ice', 'ice', 0.4, 0.3, 6, 0.8, 0.3, 0, 0, 0.15),
  pearl_fog: B('snow', 'ice', 'ice', 0.002, 0, 0, 0.8, 1.0, 0, 0, 0.08),
  teal_sinkholes: B('ice', 'ice', 'ice', 0.01, 0, 0, 0.6, 0.5, 2, 0, 0.02),
  // neptune
  storm_seas: B('rock', 'rock', 'gravel', 0.0005, 0, 0, 1.6, 0.4, 0, 0),
  kelp_forests: B('moss', 'rock', 'mud', 0.3, 0.6, 10, 1.2, 0.5, 0, 0),
  ice_spires: B('ice', 'ice', 'ice', 0.2, 0, 0, 0.8, 0.2, -3, 0, 0.03),
  aurora_tundra: B('snow', 'rock', 'gravel', 0.01, 0, 0, 0.7, 0.3, -2, 0, 0.10),
  // pluto
  heart_glacier: B('ice', 'ice', 'ice', 0.001, 0, 0, 0.5, 0.1, 0, 0, 0.02),
  lilac_mountains: B('rock', 'rock', 'gravel', 0.05, 0, 0, 0.3, 0.05, 0, 0.1, 0.01),
  long_shadow_plain: B('dust', 'rock', 'dust', 0.005, 0, 0, 0.3, 0.1, 0, 0.3, 0.01),
  nitrogen_dunes: B('snow', 'ice', 'snow', 0.003, 0, 0, 0.4, 0.1, 0, 0.2, 0.10),
  // PILOT's stub world and test worlds
  'stub-lowland': B('grass', 'rock', 'mud', 0.03, 0.15, 8, 1.0, 0.3, 0, 0.05),
  'stub-highland': B('gravel', 'rock', 'gravel', 0.03, 0, 0, 0.9, 0.1, -4, 0.1),
  'stub-shore': B('sand', 'rock', 'sand', 0.005, 0, 0, 1.0, 0.3, 0, 0.3),
  'stub-polar': B('snow', 'ice', 'ice', 0.002, 0, 0, 0.8, 0.2, -25, 0, 0.3),
};
const DEFAULT_BIOME = B('soil', 'rock', 'mud', 0.03, 0, 0, 1.0, 0.2, 0, 0.1);
// What drifts in the air of a biome, each 0..1: [falling leaves, spores (or seed fluff, pollen,
// glitter off the crystal reeds), ash]. Leaves need a canopy to fall from.
export const AIRBORNE = {
  temperate_forest: [0.25, 0.06, 0], autumn_woodland: [1.0, 0.05, 0], misty_wetland: [0.05, 0.3, 0], alpine_meadow: [0, 0.08, 0],
  fungal_towers: [0, 1.0, 0.05], lava_rivers: [0, 0, 1.0], acid_terraces: [0, 0.1, 0.2],
  dry_riverbeds: [0.25, 0, 0],
  sky_islands: [0.15, 0.15, 0], hanging_gardens: [0.3, 0.5, 0],
  gold_islands: [0.1, 0.2, 0], crystal_reeds: [0, 0.35, 0], honey_mist: [0, 0.5, 0],
  kelp_forests: [0.1, 0.8, 0],
  'stub-lowland': [0.2, 0.05, 0],
};
const NO_AIRBORNE = [0, 0, 0];
// Airless and dry bodies: an unknown biome there is regolith, not garden soil.
const DEFAULT_BY_BODY = {
  venus: B('rock', 'rock', 'gravel', 0.02, 0, 0, 0.5, 0.3, 0, 0.2),
  jupiter: B('moss', 'rock', 'moss', 0.05, 0, 0, 1.0, 0.4, 0, 0.02),
  saturn: B('moss', 'rock', 'moss', 0.05, 0, 0, 0.8, 0.5, 0, 0.02),
  neptune: B('rock', 'rock', 'gravel', 0.01, 0, 0, 1.2, 0.4, 0, 0),
  mercury: B('dust', 'rock', 'dust', 0.005, 0, 0, 0, 0, 0, 0.6),
  moon: B('dust', 'rock', 'dust', 0.005, 0, 0, 0, 0, 0, 0.8),
  mars: B('gravel', 'rock', 'sand', 0.02, 0, 0, 0, 0, 0, 0.6),
  pluto: B('ice', 'rock', 'ice', 0.003, 0, 0, 0.3, 0.1, 0, 0.1, 0.02),
  uranus: B('ice', 'ice', 'ice', 0.003, 0, 0, 0.7, 0.4, 0, 0, 0.05),
};
export function biomePhysics(bodyId, biomeId) {
  // PILOT's stub world uses the same four mock biomes on every body: off Earth they stand for
  // that body's usual ground
  if (biomeId && biomeId.charCodeAt(0) === 115 && biomeId.startsWith('stub-') && DEFAULT_BY_BODY[bodyId]) return DEFAULT_BY_BODY[bodyId];
  return BIOMES[biomeId] || DEFAULT_BY_BODY[bodyId] || DEFAULT_BIOME;
}

export const GROUND = Object.freeze({
  steepStart: 0.52,        // rad (30 deg): where the steep material starts to show
  steepFull: 0.80,         // rad (46 deg): all steep material
  shoreBand: 0.5,          // m above the liquid surface that counts as shore
  snowCover: 0.03,         // m of snow that starts to hide the ground
  snowFull: 0.12,          // m of snow at which you are walking on snow alone
  snowSinkMax: 0.35,       // m: deepest a boot goes into deep snow
  mudStart: 0.55,          // wetness at which soil starts turning to mud
  frostStart: 0.3,         // wetness below freezing that glazes the ground with ice
});

const NUM = ['muS', 'muK', 'wet', 'foothold', 'rest', 'sink', 'resist', 'repose', 'density', 'grain', 'dust', 'z0', 'imprint', 'mudding'];
const _acc = {};
const _w = { names: [], weights: [] };

function addMat(name, w) {
  if (w <= 0) return;
  const m = MATERIALS[name] || MATERIALS.soil;
  for (let i = 0; i < NUM.length; i++) _acc[NUM[i]] += m[NUM[i]] * w;
  const k = _w.names.indexOf(name);
  if (k >= 0) _w.weights[k] += w; else { _w.names.push(name); _w.weights.push(w); }
}

// Contact properties of the ground for one surface sample.
//   surface: a sampleSurface result { radius, slope, liquidRadius, biomeId, biomeWeights }
//   state:   { wetness01, snowDepth (m), temperature (K) } from weather.js (all optional)
// Fills and returns `out`:
//   material      name of the dominant material
//   friction      static friction coefficient for a boot or a landing foot
//   kinetic       kinetic (sliding) friction coefficient
//   foothold      extra holding traction on slopes (add to friction when standing or climbing)
//   restitution   bounce of a rigid body, 0..1
//   sink          m a 100 kg walker's foot presses in
//   drag          resistance to walking or rolling, as a fraction of the normal force
//   repose        angle of repose (rad), 0 for solid ground
//   dust          0..1 loose fines a step or a jet raises (0 when wet or frozen)
//   z0            aerodynamic roughness length (m)
//   imprint       0..1 how well it keeps a footprint
//   density       bulk density (kg/m^3)      grain: grain diameter (m)
//   liquidDepth   m of liquid over the ground (0 when dry)
//   wetness01, snowDepth, temperature        the state that was applied
//   canopy01, canopyHeight, moist, fog, dustSource   blended biome fields (for air.js, weather.js)
export function groundAt(bodyId, surface, state, out = {}) {
  for (let i = 0; i < NUM.length; i++) _acc[NUM[i]] = 0;
  _w.names.length = 0; _w.weights.length = 0;
  const slope = surface.slope || 0;
  const steep = smoothstep(GROUND.steepStart, GROUND.steepFull, slope);
  const liquid = (surface.liquidRadius || 0) > surface.radius ? surface.liquidRadius - surface.radius : 0;
  const above = (surface.liquidRadius || 0) > 0 ? surface.radius - surface.liquidRadius : 1e9;
  const shore = liquid > 0 ? 0 : 1 - smoothstep(0.05, GROUND.shoreBand, above);
  let canopy = 0, canopyH = 0, moist = 0, fog = 0, dustSrc = 0, z0b = 0, snowBase = 0, dT = 0, wsum = 0;
  const bw = surface.biomeWeights;
  let any = false;
  if (bw) {
    for (const id in bw) {
      const w = bw[id];
      if (!(w > 0.02)) continue;
      any = true;
      const b = biomePhysics(bodyId, id);
      wsum += w;
      canopy += b.canopy * w; canopyH += b.canopyH * b.canopy * w; moist += b.moist * w; fog += b.fog * w;
      dustSrc += b.dustSrc * w; z0b += b.z0 * w; snowBase += b.snowBase * w; dT += b.dT * w;
      addMat(b.ground, w * (1 - steep) * (1 - shore));
      addMat(b.steep, w * steep * (1 - shore));
      addMat(b.shore, w * shore);
    }
  }
  if (!any) {
    const b = biomePhysics(bodyId, surface.biomeId);
    wsum = 1;
    canopy = b.canopy; canopyH = b.canopyH * b.canopy; moist = b.moist; fog = b.fog; dustSrc = b.dustSrc; z0b = b.z0; snowBase = b.snowBase; dT = b.dT;
    addMat(b.ground, (1 - steep) * (1 - shore));
    addMat(b.steep, steep * (1 - shore));
    addMat(b.shore, shore);
  }
  const inv = 1 / wsum;
  for (let i = 0; i < NUM.length; i++) _acc[NUM[i]] *= inv;
  canopyH = canopy > 1e-6 ? canopyH / canopy : 0;
  canopy *= inv; moist *= inv; fog *= inv; dustSrc *= inv; z0b *= inv; snowBase *= inv; dT *= inv;
  // PAINTER's own canopy at this very spot, when the surface sample carries it (additive fields)
  if (surface.canopy01 != null) { canopy = surface.canopy01; if (surface.canopyHeight != null) canopyH = surface.canopyHeight; }

  // dominant base material
  let top = 0;
  for (let i = 1; i < _w.names.length; i++) if (_w.weights[i] > _w.weights[top]) top = i;
  let material = _w.names[top] || 'soil';
  const iceShare = (() => { const k = _w.names.indexOf('ice'); return k >= 0 ? _w.weights[k] * inv : 0; })();

  const wet = clamp01(state && state.wetness01 != null ? state.wetness01 : 0);
  const T = state && state.temperature != null ? state.temperature : 288;
  const snow = Math.max(0, (state && state.snowDepth != null ? state.snowDepth : 0));
  let muS = _acc.muS, muK = _acc.muK, foothold = _acc.foothold, rest = _acc.rest, sink = _acc.sink, resist = _acc.resist;
  let dust = _acc.dust, imprint = _acc.imprint, z0 = Math.max(_acc.z0 * 0.3 + z0b * 0.7, 1e-5), repose = _acc.repose, density = _acc.density;

  // ice in the mix takes its friction from the temperature
  if (iceShare > 0) {
    const mi = iceFriction(T), base = MATERIALS.ice;
    muS += (mi - base.muS) * iceShare; muK += (mi * 0.7 - base.muK) * iceShare;
  }
  // rain: wet surfaces grip less; soaked soil becomes mud
  if (wet > 0 && T > 272) {
    const k = mix(1, _acc.wet, wet);
    muS *= k; muK *= k;
    foothold *= 1 - 0.5 * wet;                  // a wet ledge is half the foothold
    const mud = smoothstep(GROUND.mudStart, 1, wet) * _acc.mudding * (1 - steep);
    if (mud > 0) {
      const M = MATERIALS.mud;
      muS = mix(muS, M.muS, mud); muK = mix(muK, M.muK, mud); sink = mix(sink, M.sink, mud); resist = mix(resist, M.resist, mud);
      rest = mix(rest, M.rest, mud); imprint = mix(imprint, M.imprint, mud); foothold = mix(foothold, M.foothold, mud);
      if (mud > 0.5) material = 'mud';
    }
    dust *= 1 - smoothstep(0.05, 0.4, wet);
  } else if (wet > GROUND.frostStart && T <= 272 && snow < GROUND.snowCover) {
    // wet ground that froze: a glaze of ice over whatever is underneath
    const glaze = smoothstep(GROUND.frostStart, 0.8, wet) * (1 - 0.6 * steep);
    const mi = iceFriction(T);
    muS = mix(muS, mi, glaze); muK = mix(muK, mi * 0.7, glaze); foothold = mix(foothold, 0.03, glaze);
    dust *= 1 - glaze;
    if (glaze > 0.5) material = 'ice';
  }
  // snow on top
  if (snow > GROUND.snowCover * 0.2) {
    const c = smoothstep(GROUND.snowCover * 0.2, GROUND.snowFull, snow) * (1 - 0.7 * smoothstep(0.7, 1.0, slope));
    const S = MATERIALS.snow;
    muS = mix(muS, S.muS, c); muK = mix(muK, S.muK, c); foothold = mix(foothold, S.foothold, c); rest = mix(rest, S.rest, c);
    const deep = clamp01(snow / GROUND.snowSinkMax);
    sink = mix(sink, Math.min(snow * 0.8, GROUND.snowSinkMax), c);
    resist = mix(resist, S.resist * (0.25 + 0.75 * deep), c);
    dust = mix(dust, S.dust, c); imprint = mix(imprint, S.imprint, c); z0 = mix(z0, S.z0, c * (1 - canopy));
    repose = mix(repose, S.repose, c); density = mix(density, S.density, c);
    if (c > 0.5) material = 'snow';
  }
  if (liquid > 0.02) {
    // standing in liquid: the bed is what the foot touches
    const k = smoothstep(0.02, 0.25, liquid);
    const Bd = MATERIALS.bed;
    muS = mix(muS, Bd.muS, k); muK = mix(muK, Bd.muK, k); sink = mix(sink, Bd.sink, k); resist = mix(resist, Bd.resist, k);
    foothold = mix(foothold, Bd.foothold, k); dust = mix(dust, 0, k); imprint = mix(imprint, Bd.imprint, k);
    if (k > 0.5) material = 'bed';
  }

  out.material = material;
  out.friction = clamp(muS, 0.02, 1.5);
  out.kinetic = clamp(Math.min(muK, muS), 0.015, 1.5);
  out.foothold = clamp01(foothold);
  out.restitution = clamp01(rest);
  out.sink = Math.max(0, sink);
  out.drag = Math.max(0, resist);
  out.repose = repose;
  out.dust = clamp01(dust);
  out.z0 = z0;
  out.imprint = clamp01(imprint);
  out.density = density;
  out.grain = _acc.grain;
  out.liquidDepth = liquid;
  out.wetness01 = wet;
  out.snowDepth = snow;
  out.temperature = T;
  out.canopy01 = clamp01(canopy);
  out.canopyHeight = canopyH;
  out.moist = moist;
  out.fog = fog;
  out.dustSource = clamp01(dustSrc * (1 - 0.9 * smoothstep(0.05, 0.4, wet)));
  out.snowBase = snowBase;
  out.dT = dT;
  return out;
}

// Climate fields of the ground alone (no wetness or snow applied): what air.js and weather.js
// need to know about a place. Cheaper than groundAt.
export function coverAt(bodyId, surface, out = {}) {
  let canopy = 0, canopyH = 0, moist = 0, fog = 0, dustSrc = 0, z0 = 0, snowBase = 0, dT = 0, wsum = 0, lv = 0, spo = 0, ash = 0, fetch = 0;
  const bw = surface && surface.biomeWeights;
  if (bw) {
    for (const id in bw) {
      const w = bw[id];
      if (!(w > 0.02)) continue;
      const b = biomePhysics(bodyId, id), ab = AIRBORNE[id] || NO_AIRBORNE;
      wsum += w;
      canopy += b.canopy * w; canopyH += b.canopyH * b.canopy * w; moist += b.moist * w; fog += b.fog * w;
      dustSrc += b.dustSrc * w; z0 += b.z0 * w; snowBase += b.snowBase * w; dT += b.dT * w;
      lv += ab[0] * w; spo += ab[1] * w; ash += ab[2] * w; fetch += fetchOf(id) * w;
    }
  }
  if (!(wsum > 0)) {
    const id = surface && surface.biomeId;
    const b = biomePhysics(bodyId, id), ab = AIRBORNE[id] || NO_AIRBORNE;
    wsum = 1; canopy = b.canopy; canopyH = b.canopyH * b.canopy; moist = b.moist; fog = b.fog; dustSrc = b.dustSrc; z0 = b.z0; snowBase = b.snowBase; dT = b.dT;
    lv = ab[0]; spo = ab[1]; ash = ab[2]; fetch = fetchOf(id);
  }
  const inv = 1 / wsum;
  out.canopyHeight = canopy > 1e-6 ? canopyH / canopy : 0;
  out.canopy01 = clamp01(canopy * inv);
  // PAINTER's own canopy at this very spot, when the surface sample carries it (additive fields:
  // canopy01 = closed-canopy fraction 0..1, canopyHeight = metres). Glades then get their wind.
  if (surface && surface.canopy01 != null) { out.canopy01 = clamp01(surface.canopy01); if (surface.canopyHeight != null) out.canopyHeight = surface.canopyHeight; }
  out.moist = moist * inv; out.fog = fog * inv; out.dustSource = dustSrc * inv;
  out.z0 = Math.max(z0 * inv, 1e-5); out.snowBase = snowBase * inv; out.dT = dT * inv;
  out.leaves = lv * inv; out.spores = spo * inv; out.ash = ash * inv; out.fetch = fetch * inv;
  // open liquid is far smoother than any land
  if (surface && (surface.liquidRadius || 0) > surface.radius) { out.z0 = 0.0002; out.canopy01 = 0; out.dustSource = 0; out.leaves = 0; }
  return out;
}

// Largest slope (rad) a walker can hold on this ground: tan(angle) = friction + foothold.
export function holdAngle(g) {
  return Math.atan(g.friction + g.foothold);
}
