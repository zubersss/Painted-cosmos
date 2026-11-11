// Painted Cosmos: how every body looks. OWNER: PAINTER. Pure data (no three), safe to import in Node.
//
// Colour convention used by the whole painter: a colour is the TRANSMITTANCE of a wash laid on
// paper. (1,1,1) is bare paper, the brightest value there is. Layering two washes multiplies
// them. The final composite multiplies by the paper colour, so nothing is ever brighter than
// paper and "fade to paper" simply means "fade to 1".

export const PAPER = '#F4EFE4';

// Named pigments: the colour of a medium-strength wash of each.
export const PIGMENTS = {
  sapGreen: '#7f9c3d',
  hookersGreen: '#3d6a47',
  viridian: '#3f8c7b',
  oliveGreen: '#8a8a3e',
  quinGold: '#dba436',
  lemonYellow: '#ecdc66',
  yellowOchre: '#d8b56a',
  rawSienna: '#c9914e',
  burntSienna: '#b6623c',
  rawUmber: '#7c644a',
  burntUmber: '#6c4b37',
  sepia: '#584435',
  ultramarine: '#4d60b2',
  cobaltBlue: '#5c82c6',
  cerulean: '#73a9d1',
  cobaltViolet: '#8c7aba',
  paynesGrey: '#4b5669',
  indigo: '#2f3a5d',
  neutralTint: '#6f6b7a',
  cadScarlet: '#da492c',
  cadOrange: '#e8873a',
  alizarin: '#b1364b',
  roseMadder: '#d98a98',
  turquoise: '#4fb3b0',
  mint: '#a8dcc4',
  davysGrey: '#8f9189',
};

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
export function pig(name) {
  const h = PIGMENTS[name];
  if (!h) throw new Error('unknown pigment: ' + name);
  return hexToRgb(h);
}
// Dilute a wash toward paper (t = 0: full strength, t = 1: bare paper).
export function dilute(c, t) { return [c[0] + (1 - c[0]) * t, c[1] + (1 - c[1]) * t, c[2] + (1 - c[2]) * t]; }
export function mixc(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
export function glazec(a, b) { return [a[0] * b[0], a[1] * b[1], a[2] * b[2]]; }

// Sky / light keys. All colours are transmittances over paper.
//   zenith, horizon: sky wash at the top and at the horizon
//   haze: what distance fades to (stays near paper)
//   glaze: the cool transparent shadow glaze
//   light: tint of the sunlit wash (warm paper)
//   grade: a last overall glaze on the whole sheet (night indigo, dusk gold)
const EARTH_SKY = {
  day: { zenith: [0.50, 0.69, 0.90], horizon: [0.90, 0.94, 0.97], haze: [0.93, 0.955, 0.975], glaze: [0.71, 0.72, 0.875], light: [1.0, 0.985, 0.93], grade: [1, 1, 1], cloudShade: [0.80, 0.80, 0.90] },
  dawn: { zenith: [0.66, 0.72, 0.90], horizon: [1.0, 0.80, 0.76], haze: [1.0, 0.90, 0.87], glaze: [0.66, 0.66, 0.88], light: [1.0, 0.90, 0.84], grade: [1.0, 0.965, 0.955], cloudShade: [0.86, 0.72, 0.80] },
  dusk: { zenith: [0.58, 0.63, 0.86], horizon: [1.0, 0.80, 0.50], haze: [1.0, 0.89, 0.70], glaze: [0.60, 0.58, 0.84], light: [1.0, 0.87, 0.62], grade: [1.0, 0.96, 0.90], cloudShade: [0.84, 0.66, 0.66] },
  night: { zenith: [0.17, 0.21, 0.38], horizon: [0.34, 0.39, 0.56], haze: [0.36, 0.41, 0.58], glaze: [0.55, 0.58, 0.80], light: [0.80, 0.86, 1.0], grade: [0.42, 0.48, 0.70], cloudShade: [0.55, 0.58, 0.75] },
};

function skyTint(base, mul) {
  const out = {};
  for (const k of Object.keys(base)) {
    out[k] = {};
    for (const f of Object.keys(base[k])) {
      const c = base[k][f];
      out[k][f] = (f === 'zenith' || f === 'horizon' || f === 'haze') ? [Math.min(1, c[0] * mul[0]), Math.min(1, c[1] * mul[1]), Math.min(1, c[2] * mul[2])] : c.slice();
    }
  }
  return out;
}

// Biome entries. `terrain` selects the height / colour recipe in src/world/surface.js.
// `pigments` is the limited palette (5-7 named pigments) and `accent` the single accent.
// `ground` gives three washes the placeholder recipes blend between (low, mid, high ground).
function B(id, name, terrain, pigments, accent, ground, extra) {
  return Object.assign({ id, name, terrain, pigments, accent, ground }, extra || {});
}

export const LOOKS = {
  earth: {
    seed: 'earth-7',
    seaLevel: 0,
    cloud: 0.45,
    visibility: [250, 2600],   // metres at ground level, and from high up
    sky: EARTH_SKY,
    biomes: [
      B('temperate_forest', 'Temperate Forest', 'forest',
        ['sapGreen', 'hookersGreen', 'quinGold', 'burntSienna', 'rawUmber', 'ultramarine', 'cobaltViolet'], 'cadScarlet',
        ['sapGreen', 'quinGold', 'rawUmber']),
      B('autumn_woodland', 'Autumn Woodland', 'forest',
        ['quinGold', 'burntSienna', 'cadOrange', 'rawUmber', 'oliveGreen', 'ultramarine', 'cobaltViolet'], 'alizarin',
        ['quinGold', 'burntSienna', 'rawUmber'], { autumn: 1 }),
      B('alpine_meadow', 'Alpine Meadow and Snow Peaks', 'alpine',
        ['sapGreen', 'lemonYellow', 'cobaltBlue', 'neutralTint', 'rawUmber', 'cobaltViolet'], 'roseMadder',
        ['sapGreen', 'neutralTint', 'cobaltBlue']),
      B('sea_coast', 'Sea Cliffs and Coast', 'coast',
        ['cerulean', 'ultramarine', 'viridian', 'yellowOchre', 'rawUmber', 'davysGrey'], 'cadOrange',
        ['yellowOchre', 'oliveGreen', 'davysGrey']),
      B('desert_canyon', 'Desert Canyon', 'canyon',
        ['burntSienna', 'rawSienna', 'yellowOchre', 'cobaltViolet', 'ultramarine', 'burntUmber'], 'turquoise',
        ['yellowOchre', 'rawSienna', 'burntSienna']),
      B('misty_wetland', 'Misty Wetland', 'wetland',
        ['oliveGreen', 'viridian', 'rawUmber', 'paynesGrey', 'yellowOchre', 'davysGrey'], 'lemonYellow',
        ['oliveGreen', 'rawUmber', 'davysGrey']),
    ],
    // Hand-placed biome sites: [latitude, longitude, biomeId]. The first one holds the spawn.
    sites: [
      [38, 10, 'temperate_forest'], [46, 62, 'temperate_forest'], [-36, -120, 'temperate_forest'], [30, -150, 'temperate_forest'],
      [52, -42, 'autumn_woodland'], [-46, 30, 'autumn_woodland'], [50, 132, 'autumn_woodland'],
      [66, 16, 'alpine_meadow'], [-62, -60, 'alpine_meadow'], [18, 104, 'alpine_meadow'], [74, -140, 'alpine_meadow'], [-70, 120, 'alpine_meadow'],
      [8, -24, 'sea_coast'], [-10, 150, 'sea_coast'], [34, -84, 'sea_coast'], [-24, -34, 'sea_coast'], [-2, 66, 'sea_coast'], [-40, -170, 'sea_coast'],
      [6, 30, 'desert_canyon'], [-14, -82, 'desert_canyon'], [14, -116, 'desert_canyon'],
      [24, 44, 'misty_wetland'], [-30, 92, 'misty_wetland'], [42, -12, 'misty_wetland'],
    ],
  },

  mercury: {
    seed: 'mercury-2', seaLevel: null, cloud: 0, visibility: [900, 6000],
    sky: skyTint(EARTH_SKY, [1.0, 0.9, 0.78]),
    biomes: [
      B('ochre_basins', 'Cracked Ochre Basins', 'basin', ['yellowOchre', 'rawSienna', 'burntUmber', 'neutralTint', 'sepia'], 'cadOrange', ['yellowOchre', 'rawSienna', 'burntUmber']),
      B('obsidian_fields', 'Obsidian Glass Fields', 'flat', ['indigo', 'paynesGrey', 'neutralTint', 'cobaltViolet', 'sepia'], 'turquoise', ['paynesGrey', 'indigo', 'neutralTint']),
      B('crystal_gardens', 'Twilight Crystal Gardens', 'rolling', ['cobaltViolet', 'roseMadder', 'cerulean', 'neutralTint', 'indigo'], 'lemonYellow', ['cobaltViolet', 'roseMadder', 'neutralTint']),
      B('shadow_craters', 'Frozen Shadow Craters', 'crater', ['davysGrey', 'cobaltBlue', 'neutralTint', 'indigo', 'paynesGrey'], 'mint', ['davysGrey', 'cobaltBlue', 'neutralTint']),
    ],
  },
  venus: {
    seed: 'venus-2', seaLevel: null, cloud: 0.8, visibility: [220, 900],
    sky: skyTint(EARTH_SKY, [1.0, 0.86, 0.55]),
    biomes: [
      B('fungal_towers', 'Fungal Tower Forest', 'rolling', ['quinGold', 'rawSienna', 'burntSienna', 'oliveGreen', 'sepia'], 'roseMadder', ['quinGold', 'rawSienna', 'oliveGreen']),
      B('lava_rivers', 'Lava Rivers', 'ridged', ['sepia', 'burntUmber', 'paynesGrey', 'cadOrange', 'indigo'], 'cadScarlet', ['burntUmber', 'sepia', 'paynesGrey']),
      B('acid_terraces', 'Acid Lake Terraces', 'terraced', ['lemonYellow', 'oliveGreen', 'yellowOchre', 'viridian', 'rawUmber'], 'turquoise', ['lemonYellow', 'yellowOchre', 'oliveGreen']),
      B('pale_mesas', 'Pale Mesas', 'mesa', ['yellowOchre', 'davysGrey', 'rawSienna', 'neutralTint', 'roseMadder'], 'cobaltViolet', ['yellowOchre', 'davysGrey', 'rawSienna']),
    ],
  },
  moon: {
    seed: 'moon-2', seaLevel: null, cloud: 0, visibility: [4000, 20000],
    sky: skyTint(EARTH_SKY, [0.5, 0.52, 0.6]),
    biomes: [
      B('mare', 'Silver Mare', 'flat', ['davysGrey', 'neutralTint', 'paynesGrey', 'indigo', 'sepia'], 'cerulean', ['davysGrey', 'neutralTint', 'paynesGrey']),
      B('highlands', 'Bright Highlands', 'rolling', ['davysGrey', 'neutralTint', 'paynesGrey', 'indigo', 'sepia'], 'cerulean', ['davysGrey', 'davysGrey', 'neutralTint']),
      B('crater_fields', 'Crater Fields', 'crater', ['davysGrey', 'neutralTint', 'paynesGrey', 'indigo', 'sepia'], 'cerulean', ['neutralTint', 'davysGrey', 'paynesGrey']),
      B('rilles', 'Winding Rilles', 'ridged', ['davysGrey', 'neutralTint', 'paynesGrey', 'indigo', 'sepia'], 'cerulean', ['neutralTint', 'paynesGrey', 'davysGrey']),
    ],
  },
  mars: {
    seed: 'mars-2', seaLevel: null, cloud: 0.15, visibility: [700, 5000],
    sky: skyTint(EARTH_SKY, [1.0, 0.88, 0.78]),
    biomes: [
      B('rust_canyons', 'Rust Canyons', 'canyon', ['burntSienna', 'rawSienna', 'burntUmber', 'cobaltViolet', 'yellowOchre'], 'turquoise', ['rawSienna', 'burntSienna', 'burntUmber']),
      B('dust_dunes', 'Dust-Storm Dunes', 'dunes', ['rawSienna', 'yellowOchre', 'burntSienna', 'roseMadder', 'sepia'], 'cerulean', ['yellowOchre', 'rawSienna', 'burntSienna']),
      B('polar_frost', 'Polar Frost Fields', 'flat', ['davysGrey', 'roseMadder', 'cobaltBlue', 'rawSienna', 'neutralTint'], 'cadOrange', ['mint', 'davysGrey', 'roseMadder']),
      B('dry_riverbeds', 'Dry Riverbeds', 'rolling', ['rawSienna', 'burntUmber', 'alizarin', 'yellowOchre', 'sepia'], 'alizarin', ['yellowOchre', 'rawSienna', 'burntUmber']),
    ],
  },
  jupiter: {
    seed: 'jupiter-2', seaLevel: null, cloud: 0.7, visibility: [600, 3000],
    sky: skyTint(EARTH_SKY, [1.0, 0.9, 0.72]),
    biomes: [
      B('sky_islands', 'Cream Sky-Islands', 'islands', ['yellowOchre', 'cadOrange', 'rawSienna', 'sapGreen', 'neutralTint'], 'cadScarlet', ['yellowOchre', 'sapGreen', 'rawSienna']),
      B('storm_wall', 'Storm-Wall Cliffs', 'ridged', ['burntSienna', 'alizarin', 'rawUmber', 'neutralTint', 'cadOrange'], 'lemonYellow', ['burntSienna', 'alizarin', 'rawUmber']),
      B('hanging_gardens', 'Hanging Gardens', 'terraced', ['sapGreen', 'viridian', 'quinGold', 'rawSienna', 'cobaltViolet'], 'roseMadder', ['sapGreen', 'viridian', 'quinGold']),
      B('lightning_plains', 'Lightning Plains', 'flat', ['neutralTint', 'paynesGrey', 'yellowOchre', 'cobaltViolet', 'indigo'], 'lemonYellow', ['neutralTint', 'yellowOchre', 'paynesGrey']),
    ],
  },
  saturn: {
    seed: 'saturn-2', seaLevel: null, cloud: 0.6, visibility: [700, 3500],
    sky: skyTint(EARTH_SKY, [1.0, 0.93, 0.70]),
    biomes: [
      B('gold_islands', 'Pale Gold Sky-Islands', 'islands', ['yellowOchre', 'quinGold', 'davysGrey', 'rawSienna', 'oliveGreen'], 'cobaltViolet', ['yellowOchre', 'quinGold', 'davysGrey']),
      B('crystal_reeds', 'Crystal Reed Fields', 'flat', ['mint', 'lemonYellow', 'cerulean', 'davysGrey', 'cobaltViolet'], 'roseMadder', ['lemonYellow', 'mint', 'davysGrey']),
      B('ring_shadow', 'Ring-Shadow Twilight', 'rolling', ['cobaltViolet', 'neutralTint', 'indigo', 'yellowOchre', 'paynesGrey'], 'quinGold', ['cobaltViolet', 'neutralTint', 'yellowOchre']),
      B('honey_mist', 'Honey Mist Valleys', 'ridged', ['quinGold', 'rawSienna', 'yellowOchre', 'oliveGreen', 'sepia'], 'cerulean', ['quinGold', 'yellowOchre', 'rawSienna']),
    ],
  },
  uranus: {
    seed: 'uranus-2', seaLevel: null, cloud: 0.5, visibility: [500, 3000],
    sky: skyTint(EARTH_SKY, [0.82, 1.0, 0.96]),
    biomes: [
      B('ice_shelves', 'Mint Ice Shelves', 'terraced', ['mint', 'turquoise', 'cerulean', 'davysGrey', 'cobaltBlue'], 'roseMadder', ['mint', 'turquoise', 'cerulean']),
      B('frozen_waves', 'Frozen-Wave Forest', 'dunes', ['turquoise', 'viridian', 'cobaltBlue', 'mint', 'indigo'], 'lemonYellow', ['turquoise', 'mint', 'cobaltBlue']),
      B('pearl_fog', 'Pearl Fog Flats', 'flat', ['davysGrey', 'mint', 'roseMadder', 'cerulean', 'neutralTint'], 'cobaltViolet', ['davysGrey', 'mint', 'roseMadder']),
      B('teal_sinkholes', 'Glowing Teal Sinkholes', 'crater', ['viridian', 'turquoise', 'indigo', 'mint', 'paynesGrey'], 'lemonYellow', ['viridian', 'turquoise', 'indigo']),
    ],
  },
  neptune: {
    seed: 'neptune-2', seaLevel: -6, cloud: 0.65, visibility: [450, 2600],
    sky: skyTint(EARTH_SKY, [0.74, 0.84, 1.0]),
    biomes: [
      B('storm_seas', 'Ultramarine Storm Seas', 'coast', ['ultramarine', 'indigo', 'paynesGrey', 'cerulean', 'neutralTint'], 'mint', ['paynesGrey', 'neutralTint', 'indigo']),
      B('kelp_forests', 'Blue-Violet Kelp Forests', 'rolling', ['cobaltViolet', 'ultramarine', 'viridian', 'indigo', 'neutralTint'], 'roseMadder', ['cobaltViolet', 'ultramarine', 'viridian']),
      B('ice_spires', 'Wind-Carved Ice Spires', 'ridged', ['cerulean', 'cobaltBlue', 'davysGrey', 'mint', 'indigo'], 'cobaltViolet', ['cerulean', 'davysGrey', 'cobaltBlue']),
      B('aurora_tundra', 'Aurora Tundra', 'flat', ['viridian', 'neutralTint', 'cobaltBlue', 'mint', 'indigo'], 'lemonYellow', ['neutralTint', 'viridian', 'cobaltBlue']),
    ],
  },
  pluto: {
    seed: 'pluto-2', seaLevel: null, cloud: 0, visibility: [3000, 16000],
    sky: skyTint(EARTH_SKY, [0.6, 0.6, 0.78]),
    biomes: [
      B('heart_glacier', 'Pale Heart Glacier', 'flat', ['roseMadder', 'davysGrey', 'cobaltViolet', 'mint', 'neutralTint'], 'cadOrange', ['roseMadder', 'davysGrey', 'mint']),
      B('lilac_mountains', 'Lilac Mountains', 'ridged', ['cobaltViolet', 'neutralTint', 'roseMadder', 'indigo', 'davysGrey'], 'lemonYellow', ['cobaltViolet', 'neutralTint', 'roseMadder']),
      B('long_shadow_plain', 'Long-Shadow Plain', 'rolling', ['davysGrey', 'cobaltViolet', 'neutralTint', 'indigo', 'roseMadder'], 'cerulean', ['davysGrey', 'neutralTint', 'cobaltViolet']),
      B('nitrogen_dunes', 'Nitrogen Dunes', 'dunes', ['mint', 'davysGrey', 'cobaltBlue', 'roseMadder', 'neutralTint'], 'quinGold', ['mint', 'davysGrey', 'cobaltBlue']),
    ],
  },
};

export function getLook(bodyId) {
  const l = LOOKS[bodyId];
  if (!l) throw new Error('no look for body: ' + bodyId);
  return l;
}
