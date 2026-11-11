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
  dawn: { zenith: [0.66, 0.72, 0.90], horizon: [1.0, 0.80, 0.76], haze: [1.0, 0.90, 0.87], glaze: [0.66, 0.66, 0.88], light: [1.0, 0.88, 0.82], grade: [1.0, 0.94, 0.93], cloudShade: [0.86, 0.72, 0.80] },
  dusk: { zenith: [0.58, 0.63, 0.86], horizon: [1.0, 0.80, 0.50], haze: [1.0, 0.89, 0.70], glaze: [0.60, 0.58, 0.84], light: [1.0, 0.84, 0.58], grade: [1.0, 0.92, 0.80], cloudShade: [0.84, 0.66, 0.66] },
  night: { zenith: [0.17, 0.21, 0.38], horizon: [0.34, 0.39, 0.56], haze: [0.36, 0.41, 0.58], glaze: [0.55, 0.58, 0.80], light: [0.80, 0.86, 1.0], grade: [0.42, 0.48, 0.70], cloudShade: [0.55, 0.58, 0.75] },
};

function m3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
// A body's four light keys from its day sky. `o` may override any key (for example Mars' blue dusk).
function mkSky(zenith, horizon, o) {
  o = o || {};
  const E = EARTH_SKY;
  const haze = o.haze || m3(horizon, [1, 1, 1], 0.35);
  const day = { zenith, horizon, haze, glaze: o.glaze || E.day.glaze, light: o.light || E.day.light, grade: [1, 1, 1], cloudShade: o.cloudShade || m3(zenith, [0.8, 0.8, 0.9], 0.5) };
  const dawnH = o.dawnHorizon || m3(horizon, E.dawn.horizon, 0.65), duskH = o.duskHorizon || m3(horizon, E.dusk.horizon, 0.7);
  const dawn = { zenith: m3(zenith, E.dawn.zenith, 0.45), horizon: dawnH, haze: m3(dawnH, [1, 1, 1], 0.4), glaze: E.dawn.glaze, light: o.dawnLight || E.dawn.light, grade: E.dawn.grade, cloudShade: E.dawn.cloudShade };
  const dusk = { zenith: m3(zenith, E.dusk.zenith, 0.45), horizon: duskH, haze: m3(duskH, [1, 1, 1], 0.35), glaze: E.dusk.glaze, light: o.duskLight || E.dusk.light, grade: o.duskGrade || E.dusk.grade, cloudShade: E.dusk.cloudShade };
  const nz = [zenith[0] * 0.30, zenith[1] * 0.32, zenith[2] * 0.46], nh = [horizon[0] * 0.38, horizon[1] * 0.42, horizon[2] * 0.58];
  const night = { zenith: nz, horizon: nh, haze: m3(nh, [0.4, 0.44, 0.6], 0.5), glaze: E.night.glaze, light: E.night.light, grade: o.nightGrade || E.night.grade, cloudShade: E.night.cloudShade };
  return { day, dawn, dusk, night };
}

// Biome entries. `terrain` selects the height / colour recipe in src/world/surface.js and `t`
// its parameters. `pigments` is the limited palette (5-7 named pigments), `accent` the single
// accent. `ground` gives three washes blended low / mid / high. Optional:
//   liquid: { level, color, refl (0 matte .. 1 mirror), glow (lava), cloud (cloud sea) }
//   tall: [a, b] indices into the body's flora.tall, tallD density, tallMix share of a
//   small: densities of undergrowth kinds { grass, fern, bush, rock, flower, reed, shard }
//   under: this biome's own undergrowth washes, any of { leaf, bush, accent, rock, shard }
//     (otherwise the body's flora.under)
//   mist: multiplies the visibility; phys: { ground } for PHYSICS where its guess is wrong
//   twilight: 0..1, the place lies in a lasting half-light; want: what the easel looks for
//     (src/art/vantage.js); hang: { kit, d } trailing plants on cliff lips
function B(id, name, terrain, pigments, accent, ground, extra) {
  return Object.assign({ id, name, terrain, pigments, accent, ground }, extra || {});
}
const P = (n, d) => dilute(pig(n), d == null ? 0.3 : d);
const PM = (a, b, t, d) => dilute(mixc(pig(a), pig(b), t), d == null ? 0.3 : d);

export const LOOKS = {
  earth: {
    seed: 'earth-7',
    seaLevel: 0,
    cloud: 0.45,
    deck: { height: 560 },
    visibility: [185, 2600],   // metres at ground level, and from high up
    sky: EARTH_SKY,
    flora: {
      tall: [
        { kit: 'broadleaf', bark: [[0.975, 0.965, 0.945], [0.27, 0.24, 0.26]], leaf: [[0.76, 0.85, 0.42], [0.58, 0.75, 0.36], [0.31, 0.51, 0.37]], barkP: [0.675, 0, 1.3, 0.25], leafP: [0.85, 0.34, 1.0, 0.28], wind: 0.10, far: [13.5, 11.8, 0], obs: [0.30, 11.5] },
        { kit: 'conifer', bark: [[0.74, 0.54, 0.42], [0.40, 0.28, 0.25]], leaf: [[0.44, 0.62, 0.43], [0.31, 0.51, 0.44], [0.17, 0.28, 0.35]], barkP: [0.50, 1, 0.9, 0.6], leafP: [0.9, 0.18, 1.0, 0.25], wind: 0.05, far: [14.5, 16.5, 0.8], obs: [0.40, 16] },
        { kit: 'broadleaf', bark: [[0.975, 0.965, 0.945], [0.27, 0.24, 0.26]], leaf: [[0.96, 0.82, 0.32], [0.93, 0.64, 0.28], [0.72, 0.42, 0.26]], barkP: [0.675, 0, 1.3, 0.25], leafP: [0.85, 0.34, 1.0, 0.28], wind: 0.10, far: [13.5, 11.8, 0], obs: [0.30, 11.5] },
      ],
      under: { leaf: [[0.80, 0.85, 0.38], [0.54, 0.71, 0.31], [0.35, 0.51, 0.31]], accent: [0.86, 0.29, 0.17], bush: [[0.64, 0.77, 0.37], [0.45, 0.63, 0.36], [0.24, 0.41, 0.36]], rock: [[0.80, 0.79, 0.83], [0.47, 0.45, 0.55]] },
    },
    biomes: [
      B('temperate_forest', 'Temperate Forest', 'forest',
        ['sapGreen', 'hookersGreen', 'quinGold', 'burntSienna', 'rawUmber', 'ultramarine', 'cobaltViolet'], 'cadScarlet',
        ['sapGreen', 'quinGold', 'rawUmber'], { tall: [0, 1] }),
      B('autumn_woodland', 'Autumn Woodland', 'forest',
        ['quinGold', 'burntSienna', 'cadOrange', 'rawUmber', 'oliveGreen', 'ultramarine', 'cobaltViolet'], 'alizarin',
        ['quinGold', 'burntSienna', 'rawUmber'], { autumn: 1, tall: [2, 1],
          under: { leaf: [[0.92, 0.82, 0.40], [0.80, 0.64, 0.34], [0.54, 0.42, 0.30]], bush: [[0.90, 0.66, 0.34], [0.72, 0.46, 0.30], [0.44, 0.30, 0.30]] } }),
      B('alpine_meadow', 'Alpine Meadow and Snow Peaks', 'alpine',
        ['sapGreen', 'lemonYellow', 'cobaltBlue', 'neutralTint', 'rawUmber', 'cobaltViolet'], 'roseMadder',
        ['sapGreen', 'neutralTint', 'cobaltBlue'], { t: { amp: 470, wl: 1000, snow: 185 }, mist: 6, tall: [1, 1], tallD: 0.22, tallMix: 1, tallMax: 150, small: { grass: 0.5, flower: 0.16, rock: 0.05, bush: 0.02 } }),
      B('sea_coast', 'Sea Cliffs and Coast', 'coast',
        ['cerulean', 'ultramarine', 'viridian', 'yellowOchre', 'rawUmber', 'davysGrey'], 'cadOrange',
        ['yellowOchre', 'oliveGreen', 'davysGrey'], { t: { cliff: 52, stacks: 0.5, strata: 0.5 }, mist: 4, under: { leaf: [[0.88, 0.87, 0.52], [0.70, 0.75, 0.44], [0.46, 0.56, 0.42]] }, liquid: { color: [0.52, 0.72, 0.84], refl: 0.6 }, tall: [1, 0], tallD: 0.10, tallMix: 0.7, small: { grass: 0.45, rock: 0.05, bush: 0.05, flower: 0.03 } }),
      B('desert_canyon', 'Desert Canyon', 'canyon',
        ['burntSienna', 'rawSienna', 'yellowOchre', 'cobaltViolet', 'ultramarine', 'burntUmber'], 'turquoise',
        ['yellowOchre', 'rawSienna', 'burntSienna'], { t: { strata: 1, amp: 210, wl: 600, steps: 3, dil: 0.2 }, mist: 5, small: { rock: 0.06, grass: 0.03, bush: 0.02 }, phys: { ground: 'sand' },
          under: { leaf: [[0.88, 0.84, 0.56], [0.74, 0.72, 0.46], [0.54, 0.54, 0.40]], bush: [[0.78, 0.80, 0.60], [0.60, 0.66, 0.52], [0.42, 0.48, 0.44]], rock: [[0.92, 0.74, 0.58], [0.62, 0.40, 0.32]], accent: [0.30, 0.70, 0.69] } }),
      B('misty_wetland', 'Misty Wetland', 'wetland',
        ['oliveGreen', 'viridian', 'rawUmber', 'paynesGrey', 'yellowOchre', 'davysGrey'], 'lemonYellow',
        ['oliveGreen', 'rawUmber', 'davysGrey'], { mist: 0.45, under: { leaf: [[0.82, 0.82, 0.46], [0.64, 0.66, 0.38], [0.42, 0.46, 0.34]], accent: [0.93, 0.86, 0.40] }, liquid: { color: [0.74, 0.82, 0.84], refl: 0.9 }, tall: [0, 0], tallD: 0.08, tallMix: 1, small: { reed: 0.5, grass: 0.3, fern: 0.12, bush: 0.03 } }),
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

  mars: {
    seed: 'mars-3', seaLevel: null, cloud: 0.12, visibility: [520, 5000], deck: { height: 330 },
    sky: mkSky([0.88, 0.72, 0.60], [0.985, 0.90, 0.80], { glaze: [0.74, 0.66, 0.80], light: [1.0, 0.95, 0.86], duskHorizon: [0.72, 0.84, 0.97], duskLight: [0.92, 0.94, 1.0], duskGrade: [0.94, 0.95, 1.0] }),
    flora: {
      tall: [
        { kit: 'broadleaf', scale: 0.5, bark: [[0.42, 0.30, 0.27], [0.24, 0.18, 0.20]], leaf: [[0.96, 0.58, 0.42], [0.90, 0.44, 0.38], [0.64, 0.30, 0.32]], barkP: [0.55, 1, 0.6, 0.5], leafP: [0.85, 0.30, 1.0, 0.3], wind: 0.08, far: [7.5, 6.2, 0], obs: [0.2, 6] },
        { kit: 'spire', scale: 0.7, bark: [[0.86, 0.62, 0.46], [0.52, 0.30, 0.26]], leaf: [[0.86, 0.62, 0.46], [0.70, 0.45, 0.36], [0.52, 0.30, 0.26]], far: [7, 12, 0.85], obs: [1.6, 9] },
      ],
      under: { leaf: [[0.86, 0.74, 0.46], [0.78, 0.58, 0.38], [0.56, 0.36, 0.30]], accent: [0.70, 0.22, 0.30], bush: [[0.80, 0.50, 0.36], [0.66, 0.36, 0.32], [0.42, 0.24, 0.28]], rock: [[0.90, 0.72, 0.58], [0.58, 0.36, 0.30]], shard: [[0.95, 0.96, 0.98], [0.70, 0.78, 0.90]] },
    },
    biomes: [
      B('rust_canyons', 'Rust Canyons', 'canyon', ['burntSienna', 'rawSienna', 'burntUmber', 'cobaltViolet', 'yellowOchre'], 'turquoise', ['rawSienna', 'burntSienna', 'burntUmber'],
        { t: { strata: 1, amp: 200, steps: 3, dil: 0.16, wl: 620 }, tall: [1, 1], tallD: 0.05, tallMix: 1, small: { rock: 0.07, bush: 0.012 }, phys: { ground: 'rock' } }),
      B('dust_dunes', 'Dust-Storm Dunes', 'dunes', ['rawSienna', 'yellowOchre', 'burntSienna', 'roseMadder', 'sepia'], 'cerulean', ['yellowOchre', 'rawSienna', 'burntSienna'],
        { t: { amp: 24, wl: 150, slip: 0.2, ride: 0.22, swell: 22, dil: 0.26, lee: 0.3 }, mist: 1.3, hour: 16.2, small: { rock: 0.006 }, phys: { ground: 'sand' } }),
      B('polar_frost', 'Polar Frost Fields', 'terraced', ['davysGrey', 'roseMadder', 'cobaltBlue', 'rawSienna', 'neutralTint'], 'cadOrange', ['mint', 'davysGrey', 'roseMadder'],
        { t: { amp: 40, steps: 6, wl: 760, crack: 0.8, frost: 0.85, strata: 0.7, riser: [0.84, 0.93] }, want: { high: 0.05, steep: 0.9, layers: 1.6, perch: 0.6 }, under: { rock: [[0.94, 0.92, 0.93], [0.68, 0.62, 0.70]], shard: [[0.97, 0.98, 0.99], [0.76, 0.84, 0.93]] }, small: { shard: 0.035, rock: 0.02 }, phys: { ground: 'ice' } }),
      B('dry_riverbeds', 'Dry Riverbeds', 'riverbed', ['rawSienna', 'burntUmber', 'alizarin', 'yellowOchre', 'sepia'], 'alizarin', ['yellowOchre', 'rawSienna', 'burntUmber'],
        { t: { amp: 26, dil: 0.28, bedW: 10, bedD: 2.8, bedPale: 0.55 }, tall: [0, 0], tallD: 0.42, tallMix: 1, small: { rock: 0.05, grass: 0.22, bush: 0.03 }, phys: { ground: 'gravel' } }),
    ],
    sites: [[10, 0, 'dry_riverbeds'], [-8, 60, 'rust_canyons'], [25, -60, 'dust_dunes'], [72, 20, 'polar_frost'], [-74, -40, 'polar_frost'], [-30, -20, 'rust_canyons'], [35, 110, 'dust_dunes'], [-20, 140, 'dry_riverbeds'],
      [5, -130, 'rust_canyons'], [-45, 80, 'dust_dunes'], [50, -150, 'dry_riverbeds'], [-10, -80, 'dust_dunes'], [60, 100, 'polar_frost'], [-55, -150, 'polar_frost'], [30, 40, 'rust_canyons'], [-35, 30, 'dry_riverbeds']],
  },

  saturn: {
    seed: 'saturn-3', seaLevel: 0, cloud: 0.5, visibility: [620, 3600],
    rings: { inner: 1.35, outer: 2.25, color: [0.93, 0.86, 0.66] },
    bands: 0.5,
    deck: { height: 340, belts: 7, wobble: 0.05, a: [0.99, 0.95, 0.78], b: [0.93, 0.80, 0.52], streaks: 0.15, wet: 0.6 },
    sky: mkSky([0.90, 0.84, 0.60], [0.99, 0.95, 0.80], { glaze: [0.74, 0.70, 0.86], light: [1.0, 0.97, 0.86] }),
    flora: {
      tall: [
        { kit: 'crystal', thin: 1, scale: 0.9, bark: [[0.90, 0.98, 0.90], [0.50, 0.78, 0.72]], leaf: [[0.90, 0.98, 0.90], [0.74, 0.90, 0.80], [0.50, 0.78, 0.72]], far: [3.2, 7.5, 0.9], obs: [0.4, 6] },
        { kit: 'broadleaf', scale: 0.7, bark: [[0.80, 0.70, 0.50], [0.46, 0.36, 0.30]], leaf: [[0.95, 0.86, 0.45], [0.86, 0.72, 0.36], [0.62, 0.50, 0.34]], barkP: [0.6, 1, 0.8, 0.4], leafP: [0.8, 0.25, 1.0, 0.3], wind: 0.08, far: [10, 8.5, 0], obs: [0.25, 8] },
        { kit: 'spire', scale: 0.8, bark: [[0.72, 0.66, 0.84], [0.36, 0.34, 0.52]], leaf: [[0.72, 0.66, 0.84], [0.54, 0.50, 0.70], [0.36, 0.34, 0.52]], far: [7, 12, 0.85], obs: [1.6, 9] },
      ],
      under: { leaf: [[0.93, 0.88, 0.50], [0.82, 0.76, 0.42], [0.60, 0.56, 0.36]], accent: [0.86, 0.64, 0.22], bush: [[0.90, 0.80, 0.46], [0.74, 0.62, 0.38], [0.52, 0.44, 0.34]], rock: [[0.94, 0.90, 0.76], [0.66, 0.58, 0.50]], shard: [[0.90, 0.98, 0.92], [0.56, 0.82, 0.78]] },
    },
    biomes: [
      B('gold_islands', 'Pale Gold Sky-Islands', 'islands', ['yellowOchre', 'quinGold', 'davysGrey', 'rawSienna', 'oliveGreen'], 'cobaltViolet', ['yellowOchre', 'quinGold', 'rawSienna'],
        { t: { amp: 100, cliff: 95, veil: 30, wl: 470, strata: 0.4 }, want: { perch: 0.6, rings: 1.2 }, liquid: { color: [0.97, 0.92, 0.74], refl: 0, cloud: 1 }, tall: [1, 1], tallD: 0.20, tallMix: 1, small: { grass: 0.35, rock: 0.04, flower: 0.03 } }),
      B('crystal_reeds', 'Crystal Reed Fields', 'flat', ['mint', 'lemonYellow', 'cerulean', 'davysGrey', 'cobaltViolet'], 'roseMadder', ['lemonYellow', 'mint', 'davysGrey'],
        { t: { amp: 10 }, tall: [0, 0], tallD: 0.55, tallMix: 1, small: { shard: 0.22, grass: 0.12 }, phys: { ground: 'gravel' } }),
      B('ring_shadow', 'Ring-Shadow Twilight', 'rolling', ['cobaltViolet', 'neutralTint', 'indigo', 'yellowOchre', 'paynesGrey'], 'quinGold', ['cobaltViolet', 'neutralTint', 'indigo'],
        { t: { amp: 60, wl: 520, dusk: 0.35 }, twilight: 0.75, want: { rings: 0.8 }, under: { leaf: [[0.80, 0.76, 0.80], [0.62, 0.58, 0.72], [0.42, 0.40, 0.58]], rock: [[0.76, 0.72, 0.82], [0.44, 0.40, 0.58]], accent: [0.92, 0.74, 0.30] }, tall: [2, 2], tallD: 0.10, tallMix: 1, small: { rock: 0.05, flower: 0.06, shard: 0.03 } }),
      B('honey_mist', 'Honey Mist Valleys', 'ridged', ['quinGold', 'rawSienna', 'yellowOchre', 'oliveGreen', 'sepia'], 'cerulean', ['quinGold', 'yellowOchre', 'rawSienna'],
        { t: { amp: 230, wl: 900 }, mist: 0.30, tall: [1, 1], tallD: 0.30, tallMix: 1, small: { grass: 0.4, bush: 0.05, rock: 0.03 } }),
    ],
    sites: [[12, 0, 'gold_islands'], [-10, 70, 'crystal_reeds'], [30, -70, 'honey_mist'], [2, 150, 'ring_shadow'], [-3, -150, 'ring_shadow'], [50, 40, 'crystal_reeds'], [-45, -30, 'gold_islands'], [-40, 110, 'honey_mist'],
      [65, -120, 'gold_islands'], [-70, 30, 'crystal_reeds'], [35, 120, 'honey_mist'], [-25, -100, 'gold_islands'], [0, -60, 'ring_shadow'], [70, 150, 'honey_mist'], [-60, -150, 'crystal_reeds'], [0, 40, 'ring_shadow']],
  },

  mercury: {
    seed: 'mercury-3', seaLevel: null, cloud: 0, visibility: [1400, 8000],
    sky: mkSky([0.34, 0.33, 0.50], [0.97, 0.88, 0.74], { glaze: [0.62, 0.62, 0.82], light: [1.0, 0.97, 0.88] }),
    flora: {
      tall: [
        { kit: 'crystal', scale: 1.0, bark: [[0.90, 0.80, 0.96], [0.50, 0.42, 0.72]], leaf: [[0.90, 0.80, 0.96], [0.74, 0.62, 0.86], [0.50, 0.42, 0.72]], far: [5, 7, 0.85], obs: [0.9, 5] },
        { kit: 'crystal', scale: 0.8, bark: [[0.96, 0.78, 0.84], [0.62, 0.74, 0.90]], leaf: [[0.96, 0.78, 0.84], [0.80, 0.76, 0.88], [0.52, 0.66, 0.86]], far: [4, 6, 0.85], obs: [0.8, 4] },
        { kit: 'crystal', scale: 0.7, bark: [[0.40, 0.42, 0.56], [0.17, 0.19, 0.30]], leaf: [[0.40, 0.42, 0.56], [0.28, 0.30, 0.44], [0.17, 0.19, 0.30]], far: [4, 5, 0.85], obs: [0.8, 3.5] },
      ],
      under: { leaf: [[0.86, 0.74, 0.50], [0.74, 0.60, 0.44], [0.50, 0.40, 0.36]], accent: [0.92, 0.55, 0.25], bush: [[0.80, 0.66, 0.50], [0.62, 0.50, 0.42], [0.40, 0.32, 0.34]], rock: [[0.88, 0.80, 0.66], [0.52, 0.44, 0.42]], shard: [[0.92, 0.84, 0.97], [0.56, 0.50, 0.78]] },
    },
    biomes: [
      B('ochre_basins', 'Cracked Ochre Basins', 'basin', ['yellowOchre', 'rawSienna', 'burntUmber', 'neutralTint', 'sepia'], 'cadOrange', ['yellowOchre', 'rawSienna', 'burntUmber'],
        { t: { crack: 1.0 }, small: { rock: 0.025 }, phys: { ground: 'rock' } }),
      B('obsidian_fields', 'Obsidian Glass Fields', 'flat', ['indigo', 'paynesGrey', 'neutralTint', 'cobaltViolet', 'sepia'], 'turquoise', ['paynesGrey', 'indigo', 'neutralTint'],
        { t: { amp: 14, crack: 0.5, gloss: 1, dil: 0.12 }, under: { rock: [[0.50, 0.52, 0.64], [0.20, 0.22, 0.34]], shard: [[0.62, 0.66, 0.80], [0.26, 0.28, 0.44]] }, tall: [2, 2], tallD: 0.22, tallMix: 1, small: { rock: 0.03, shard: 0.05 }, phys: { ground: 'rock' } }),
      B('crystal_gardens', 'Twilight Crystal Gardens', 'rolling', ['cobaltViolet', 'roseMadder', 'cerulean', 'neutralTint', 'indigo'], 'lemonYellow', ['cobaltViolet', 'roseMadder', 'neutralTint'],
        { t: { amp: 45, wl: 380, dusk: 0.2 }, twilight: 0.45, tall: [0, 1], tallD: 0.26, tallMix: 0.55, small: { shard: 0.12, rock: 0.02 } }),
      B('shadow_craters', 'Frozen Shadow Craters', 'crater', ['davysGrey', 'cobaltBlue', 'neutralTint', 'indigo', 'paynesGrey'], 'mint', ['davysGrey', 'cobaltBlue', 'neutralTint'],
        { t: { frost: 0.9, dusk: 0.25 }, twilight: 0.5, under: { rock: [[0.88, 0.91, 0.96], [0.52, 0.58, 0.74]] }, small: { rock: 0.03 }, phys: { ground: 'ice' } }),
    ],
  },

  venus: {
    seed: 'venus-3', seaLevel: null, cloud: 0.85, visibility: [230, 1000], bands: 0.6,
    deck: { height: 450, belts: 3.2, wobble: 0.42, a: [0.99, 0.94, 0.66], b: [0.93, 0.70, 0.36], streaks: 0.35, wet: 0.7 },
    sky: mkSky([0.90, 0.76, 0.40], [0.99, 0.91, 0.62], { glaze: [0.74, 0.62, 0.66], light: [1.0, 0.94, 0.72], cloudShade: [0.86, 0.66, 0.44] }),
    flora: {
      tall: [
        { kit: 'fungus', scale: 1.0, bark: [[0.96, 0.90, 0.72], [0.62, 0.46, 0.34]], leaf: [[0.96, 0.74, 0.34], [0.88, 0.56, 0.30], [0.60, 0.34, 0.28]], barkP: [0.74, 0, 1.6, 0.4], leafP: [0.35, 0.0, 1.0, 0.4], wind: 0.03, far: [10, 14, 0.0], obs: [0.7, 14] },
        { kit: 'fungus', scale: 0.6, bark: [[0.94, 0.86, 0.76], [0.58, 0.42, 0.40]], leaf: [[0.92, 0.60, 0.62], [0.80, 0.44, 0.50], [0.52, 0.30, 0.40]], barkP: [0.74, 0, 1.6, 0.4], leafP: [0.35, 0.0, 1.0, 0.4], wind: 0.03, far: [7, 9, 0.0], obs: [0.5, 8] },
        { kit: 'spire', scale: 0.8, bark: [[0.50, 0.44, 0.46], [0.22, 0.20, 0.26]], leaf: [[0.50, 0.44, 0.46], [0.36, 0.32, 0.36], [0.22, 0.20, 0.26]], far: [7, 12, 0.85], obs: [1.6, 9] },
      ],
      under: { leaf: [[0.92, 0.80, 0.40], [0.80, 0.62, 0.34], [0.56, 0.40, 0.30]], accent: [0.86, 0.36, 0.46], bush: [[0.90, 0.66, 0.36], [0.74, 0.48, 0.32], [0.48, 0.30, 0.30]], rock: [[0.62, 0.56, 0.56], [0.30, 0.27, 0.32]], shard: [[0.96, 0.94, 0.60], [0.70, 0.74, 0.40]] },
    },
    biomes: [
      B('fungal_towers', 'Fungal Tower Forest', 'rolling', ['quinGold', 'rawSienna', 'burntSienna', 'oliveGreen', 'sepia'], 'roseMadder', ['quinGold', 'rawSienna', 'oliveGreen'],
        { t: { amp: 55, wl: 480 }, mist: 0.8, tall: [0, 1], tallD: 0.62, tallMix: 0.55, small: { bush: 0.06, fern: 0.14, flower: 0.05, rock: 0.02 } }),
      B('lava_rivers', 'Lava Rivers', 'riverbed', ['sepia', 'burntUmber', 'paynesGrey', 'cadOrange', 'indigo'], 'cadScarlet', ['burntUmber', 'sepia', 'paynesGrey'],
        { t: { amp: 34, wet: 1, dil: 0.14 }, liquid: { color: [0.97, 0.56, 0.22], refl: 0, glow: 1 }, tall: [2, 2], tallD: 0.10, tallMix: 1, small: { rock: 0.07 }, phys: { ground: 'rock' } }),
      B('acid_terraces', 'Acid Lake Terraces', 'terraced', ['lemonYellow', 'oliveGreen', 'yellowOchre', 'viridian', 'rawUmber'], 'turquoise', ['lemonYellow', 'yellowOchre', 'oliveGreen'],
        { t: { amp: 150, steps: 12, pools: 1, wl: 430, riser: [0.72, 0.90] }, liquid: { color: [0.80, 0.92, 0.50], refl: 0.45 }, small: { shard: 0.06, rock: 0.03 } }),
      B('pale_mesas', 'Pale Mesas', 'mesa', ['yellowOchre', 'davysGrey', 'rawSienna', 'neutralTint', 'roseMadder'], 'cobaltViolet', ['yellowOchre', 'davysGrey', 'rawSienna'],
        { t: { amp: 330, strata: 0.7, wl: 520, fog: [100, 40] }, mist: 2.6, want: { perch: 1.2, liquid: 1.6, beyond: 2.4, steep: 1.0, below: 0.5, high: 0.08, relief: 1.2 }, under: { rock: [[0.94, 0.89, 0.76], [0.68, 0.58, 0.50]], bush: [[0.90, 0.84, 0.56], [0.74, 0.66, 0.44], [0.50, 0.44, 0.36]] }, small: { rock: 0.05, bush: 0.015 }, phys: { ground: 'rock' } }),
    ],
  },

  jupiter: {
    seed: 'jupiter-3', seaLevel: 0, cloud: 0.6, visibility: [600, 3200], bands: 1.0,
    deck: { height: 720, belts: 9, wobble: 0.07, a: [0.99, 0.94, 0.80], b: [0.92, 0.62, 0.38], streaks: 0.25, wet: 0.45, storm: { over: 'storm_wall', size: 0.20, color: [0.80, 0.34, 0.28] } },
    sky: mkSky([0.90, 0.78, 0.62], [0.99, 0.93, 0.80], { glaze: [0.72, 0.66, 0.84], light: [1.0, 0.95, 0.84], cloudShade: [0.90, 0.68, 0.50] }),
    flora: {
      tall: [
        { kit: 'broadleaf', scale: 0.9, bark: [[0.70, 0.58, 0.46], [0.36, 0.28, 0.28]], leaf: [[0.70, 0.84, 0.42], [0.46, 0.70, 0.44], [0.24, 0.46, 0.42]], barkP: [0.55, 1, 0.8, 0.5], leafP: [0.85, 0.30, 1.0, 0.3], wind: 0.10, far: [13, 10.5, 0], obs: [0.3, 10] },
        { kit: 'spire', scale: 1.1, bark: [[0.86, 0.50, 0.40], [0.50, 0.24, 0.28]], leaf: [[0.86, 0.50, 0.40], [0.70, 0.36, 0.34], [0.50, 0.24, 0.28]], far: [7, 12, 0.85], obs: [1.6, 12] },
        { kit: 'spire', scale: 0.8, bark: [[0.74, 0.72, 0.82], [0.38, 0.38, 0.52]], leaf: [[0.74, 0.72, 0.82], [0.56, 0.55, 0.68], [0.38, 0.38, 0.52]], far: [7, 12, 0.85], obs: [1.6, 9] },
        { kit: 'vine', scale: 1.0, double: 1, noObs: 1, bark: [[0.50, 0.44, 0.36], [0.30, 0.26, 0.26]], leaf: [[0.74, 0.88, 0.46], [0.50, 0.76, 0.44], [0.30, 0.56, 0.42]], leafP: [0.8, 0.22, 1.0, 0.3], accent: [0.92, 0.50, 0.62], wind: 0.35, far: [7.5, 9, 0.25], obs: [0, 0] },
      ],
      under: { leaf: [[0.82, 0.86, 0.46], [0.60, 0.74, 0.40], [0.36, 0.52, 0.38]], accent: [0.90, 0.50, 0.60], bush: [[0.62, 0.80, 0.44], [0.42, 0.66, 0.42], [0.24, 0.44, 0.40]], rock: [[0.94, 0.86, 0.72], [0.68, 0.50, 0.42]], shard: [[0.96, 0.94, 0.70], [0.80, 0.76, 0.50]] },
    },
    biomes: [
      B('sky_islands', 'Cream Sky-Islands', 'islands', ['yellowOchre', 'cadOrange', 'rawSienna', 'sapGreen', 'neutralTint'], 'cadScarlet', ['yellowOchre', 'sapGreen', 'rawSienna'],
        { t: { amp: 110, cliff: 120, veil: 34, wl: 430, strata: 0.6, dil: 0.26 }, mist: 1.5, want: { perch: 0.6 }, liquid: { color: [0.98, 0.90, 0.76], refl: 0, cloud: 1 }, tall: [0, 0], tallD: 0.22, tallMix: 1, small: { grass: 0.4, rock: 0.04, flower: 0.04 } }),
      B('storm_wall', 'Storm-Wall Cliffs', 'wall', ['burntSienna', 'alizarin', 'rawUmber', 'neutralTint', 'cadOrange'], 'lemonYellow', ['burntSienna', 'alizarin', 'rawUmber'],
        { t: { amp: 600, wl: 1500, strata: 0.9, dil: 0.22 }, mist: 2.4, twilight: 0.35, want: { close: 0.2 }, tall: [1, 1], tallD: 0.09, tallMix: 1, small: { rock: 0.08 }, phys: { ground: 'rock' } }),
      B('hanging_gardens', 'Hanging Gardens', 'terraced', ['sapGreen', 'viridian', 'quinGold', 'rawSienna', 'cobaltViolet'], 'roseMadder', ['sapGreen', 'viridian', 'quinGold'],
        { t: { amp: 170, steps: 6, wl: 640, riser: [0.865, 0.93], strata: 0.5, under: 0.5 }, want: { close: 0.5, high: 0.34, steep: 2.6, flora: 0, layers: 0.8 }, hang: { kit: 3, d: 0.9 }, tall: [0, 0], tallD: 0.16, tallMix: 1, small: { fern: 0.2, flower: 0.12, bush: 0.05, grass: 0.3 } }),
      B('lightning_plains', 'Lightning Plains', 'flat', ['neutralTint', 'paynesGrey', 'yellowOchre', 'cobaltViolet', 'indigo'], 'lemonYellow', ['neutralTint', 'yellowOchre', 'paynesGrey'],
        { t: { amp: 12, crack: 0.9, dusk: 0.3, pits: 1.3 }, twilight: 0.4, under: { leaf: [[0.80, 0.78, 0.66], [0.62, 0.60, 0.60], [0.42, 0.42, 0.52]], rock: [[0.72, 0.70, 0.76], [0.36, 0.36, 0.48]] }, tall: [2, 2], tallD: 0.16, tallMix: 1, small: { rock: 0.03, shard: 0.14, grass: 0.06 } }),
    ],
    // the Great Red Spot stands over the first storm-wall site, south of the equator
    sites: [[8, 0, 'sky_islands'], [-22, 40, 'storm_wall'], [30, -60, 'hanging_gardens'], [-5, 150, 'lightning_plains'], [45, 90, 'sky_islands'], [-50, -30, 'hanging_gardens'], [-35, 110, 'sky_islands'], [60, -130, 'lightning_plains'],
      [-65, 60, 'lightning_plains'], [20, -150, 'storm_wall'], [70, 20, 'hanging_gardens'], [-15, -100, 'sky_islands'], [0, 95, 'hanging_gardens'], [-45, -150, 'storm_wall'], [35, 30, 'lightning_plains'], [-75, -90, 'sky_islands']],
  },

  uranus: {
    seed: 'uranus-3', seaLevel: null, cloud: 0.4, visibility: [520, 3200],
    sky: mkSky([0.60, 0.86, 0.84], [0.93, 0.985, 0.96], { glaze: [0.64, 0.74, 0.88], light: [0.97, 1.0, 0.96] }),
    flora: {
      tall: [
        { kit: 'wave', scale: 1.0, double: 1, bark: [[0.84, 0.96, 0.94], [0.26, 0.60, 0.68]], leaf: [[0.84, 0.96, 0.94], [0.58, 0.84, 0.84], [0.26, 0.60, 0.68]], far: [9, 9, 0.5], obs: [4.5, 9] },
        { kit: 'spire', scale: 0.8, bark: [[0.92, 0.98, 0.98], [0.52, 0.78, 0.84]], leaf: [[0.92, 0.98, 0.98], [0.74, 0.90, 0.92], [0.52, 0.78, 0.84]], far: [7, 12, 0.85], obs: [1.6, 9] },
      ],
      under: { leaf: [[0.80, 0.94, 0.86], [0.62, 0.84, 0.80], [0.42, 0.66, 0.70]], accent: [0.90, 0.60, 0.70], bush: [[0.74, 0.92, 0.86], [0.54, 0.78, 0.78], [0.36, 0.58, 0.66]], rock: [[0.92, 0.97, 0.96], [0.60, 0.78, 0.82]], shard: [[0.94, 0.99, 0.98], [0.56, 0.84, 0.86]] },
    },
    biomes: [
      B('ice_shelves', 'Mint Ice Shelves', 'terraced', ['mint', 'turquoise', 'cerulean', 'davysGrey', 'cobaltBlue'], 'roseMadder', ['mint', 'turquoise', 'cerulean'],
        { t: { amp: 150, steps: 5, wl: 800, crack: 0.9, frost: 0.5, riser: [0.86, 0.94], rag: 0.6, strata: 0.5 }, tall: [1, 1], tallD: 0.06, tallMix: 1, small: { shard: 0.12, rock: 0.03 }, phys: { ground: 'ice' } }),
      B('frozen_waves', 'Frozen-Wave Forest', 'dunes', ['turquoise', 'viridian', 'cobaltBlue', 'mint', 'indigo'], 'lemonYellow', ['turquoise', 'mint', 'cobaltBlue'],
        { t: { amp: 16, wl: 90, slip: 0.2, lee: 0.6, swell: 14, ride: 0.3 }, want: { onLip: 0, along: 0, flora: 1.6, perch: 0.5 }, tall: [0, 0], tallD: 0.34, tallMix: 1, small: { shard: 0.15 }, phys: { ground: 'ice' } }),
      B('pearl_fog', 'Pearl Fog Flats', 'flat', ['davysGrey', 'mint', 'roseMadder', 'cerulean', 'neutralTint'], 'cobaltViolet', ['davysGrey', 'mint', 'roseMadder'],
        { t: { amp: 6, dil: 0.55 }, mist: 0.10, small: { shard: 0.10, rock: 0.04 }, phys: { ground: 'ice' } }),
      B('teal_sinkholes', 'Glowing Teal Sinkholes', 'sinkholes', ['viridian', 'turquoise', 'indigo', 'mint', 'paynesGrey'], 'lemonYellow', ['viridian', 'turquoise', 'indigo'],
        { t: { amp: 40 }, want: { perch: -2.5, below: 0.2, bowl: 0, steep: 1.8, liquid: 2.2 }, liquid: { color: [0.55, 0.94, 0.86], refl: 0.15, glow: 0.6 }, small: { shard: 0.08, rock: 0.04, bush: 0.02 } }),
    ],
  },

  neptune: {
    seed: 'neptune-3', seaLevel: 0, cloud: 0.42, visibility: [460, 2800], bands: 0.8,
    deck: { height: 310, belts: 5, wobble: 0.16, a: [0.50, 0.62, 0.93], b: [0.27, 0.35, 0.74], streaks: 0.9, wet: 0.6 },
    sky: mkSky([0.34, 0.46, 0.84], [0.80, 0.88, 0.98], { glaze: [0.60, 0.64, 0.88], light: [0.95, 0.97, 1.0] }),
    flora: {
      tall: [
        { kit: 'spire', scale: 1.2, bark: [[0.40, 0.42, 0.52], [0.16, 0.18, 0.28]], leaf: [[0.40, 0.42, 0.52], [0.27, 0.29, 0.40], [0.16, 0.18, 0.28]], far: [7, 12, 0.85], obs: [1.8, 13] },
        { kit: 'kelp', scale: 1.0, double: 1, bark: [[0.50, 0.44, 0.80], [0.26, 0.24, 0.56]], leaf: [[0.62, 0.56, 0.90], [0.42, 0.40, 0.78], [0.24, 0.26, 0.56]], leafP: [0.6, 0.1, 1.0, 0.4], wind: 0.5, far: [5, 10, 0.5], obs: [0.4, 9] },
        { kit: 'spire', scale: 1.9, slim: 1, bark: [[0.90, 0.95, 0.99], [0.44, 0.60, 0.90]], leaf: [[0.90, 0.95, 0.99], [0.70, 0.80, 0.95], [0.44, 0.60, 0.90]], far: [5, 14, 0.9], obs: [1.4, 13] },
      ],
      under: { leaf: [[0.62, 0.74, 0.70], [0.44, 0.58, 0.66], [0.30, 0.40, 0.58]], accent: [0.92, 0.90, 0.50], bush: [[0.52, 0.60, 0.80], [0.38, 0.44, 0.70], [0.24, 0.28, 0.54]], rock: [[0.50, 0.52, 0.62], [0.22, 0.24, 0.36]], shard: [[0.92, 0.96, 0.99], [0.56, 0.70, 0.92]] },
    },
    biomes: [
      B('storm_seas', 'Ultramarine Storm Seas', 'coast', ['ultramarine', 'indigo', 'paynesGrey', 'cerulean', 'neutralTint'], 'mint', ['paynesGrey', 'neutralTint', 'indigo'],
        { t: { cliff: 46, stacks: 0.8, stackCell: 80, strata: 0.3 }, liquid: { color: [0.34, 0.42, 0.78], refl: 0.5 }, tall: [0, 0], tallD: 0.12, tallMix: 1, tallWet: 1, small: { rock: 0.06 }, phys: { ground: 'rock' } }),
      B('kelp_forests', 'Blue-Violet Kelp Forests', 'rolling', ['cobaltViolet', 'ultramarine', 'viridian', 'indigo', 'neutralTint'], 'roseMadder', ['cobaltViolet', 'ultramarine', 'viridian'],
        { t: { amp: 40, wl: 420 }, tall: [1, 1], tallD: 0.5, tallMix: 1, small: { fern: 0.12, bush: 0.04, flower: 0.05 } }),
      B('ice_spires', 'Wind-Carved Ice Spires', 'spires', ['cerulean', 'cobaltBlue', 'davysGrey', 'mint', 'indigo'], 'cobaltViolet', ['cerulean', 'davysGrey', 'cobaltBlue'],
        { t: { amp: 11, wl: 52, frost: 0.55 }, want: { flora: 1.6, layers: 0.6 }, tall: [2, 2], tallD: 0.34, tallMix: 1, small: { shard: 0.14 }, phys: { ground: 'ice' } }),
      B('aurora_tundra', 'Aurora Tundra', 'flat', ['viridian', 'neutralTint', 'cobaltBlue', 'mint', 'indigo'], 'lemonYellow', ['neutralTint', 'viridian', 'cobaltBlue'],
        { t: { amp: 12, ponds: 1, crack: 0.3 }, liquid: { color: [0.50, 0.62, 0.86], refl: 0.85 }, small: { grass: 0.45, bush: 0.04, rock: 0.03, flower: 0.05 } }),
    ],
  },

  moon: {
    seed: 'moon-2', seaLevel: null, cloud: 0, visibility: [4000, 20000],
    sky: mkSky([0.20, 0.22, 0.34], [0.50, 0.52, 0.62]),
    flora: { tall: [], under: { leaf: [[0.8, 0.8, 0.8], [0.6, 0.6, 0.62], [0.4, 0.4, 0.45]], accent: [0.45, 0.66, 0.82], bush: [[0.8, 0.8, 0.8], [0.6, 0.6, 0.62], [0.4, 0.4, 0.45]], rock: [[0.88, 0.88, 0.90], [0.50, 0.50, 0.56]], shard: [[0.9, 0.9, 0.92], [0.6, 0.6, 0.66]] } },
    biomes: [
      B('mare', 'Silver Mare', 'flat', ['davysGrey', 'neutralTint', 'paynesGrey', 'indigo', 'sepia'], 'cerulean', ['davysGrey', 'neutralTint', 'paynesGrey'], { t: { amp: 10 }, small: { rock: 0.03 }, phys: { ground: 'dust' } }),
      B('highlands', 'Bright Highlands', 'rolling', ['davysGrey', 'neutralTint', 'paynesGrey', 'indigo', 'sepia'], 'cerulean', ['davysGrey', 'davysGrey', 'neutralTint'], { t: { amp: 70, dil: 0.5 }, small: { rock: 0.05 }, phys: { ground: 'dust' } }),
      B('crater_fields', 'Crater Fields', 'crater', ['davysGrey', 'neutralTint', 'paynesGrey', 'indigo', 'sepia'], 'cerulean', ['neutralTint', 'davysGrey', 'paynesGrey'], { small: { rock: 0.06 }, phys: { ground: 'dust' } }),
      B('rilles', 'Winding Rilles', 'riverbed', ['davysGrey', 'neutralTint', 'paynesGrey', 'indigo', 'sepia'], 'cerulean', ['neutralTint', 'paynesGrey', 'davysGrey'], { t: { amp: 40 }, small: { rock: 0.05 }, phys: { ground: 'dust' } }),
    ],
  },
  pluto: {
    seed: 'pluto-2', seaLevel: null, cloud: 0, visibility: [3000, 16000],
    sky: mkSky([0.24, 0.24, 0.40], [0.62, 0.60, 0.78]),
    flora: { tall: [], under: { leaf: [[0.9, 0.84, 0.9], [0.7, 0.64, 0.78], [0.5, 0.46, 0.62]], accent: [0.92, 0.6, 0.3], bush: [[0.9, 0.84, 0.9], [0.7, 0.64, 0.78], [0.5, 0.46, 0.62]], rock: [[0.92, 0.88, 0.94], [0.58, 0.52, 0.70]], shard: [[0.96, 0.94, 0.98], [0.68, 0.64, 0.84]] } },
    biomes: [
      B('heart_glacier', 'Pale Heart Glacier', 'flat', ['roseMadder', 'davysGrey', 'cobaltViolet', 'mint', 'neutralTint'], 'cadOrange', ['roseMadder', 'davysGrey', 'mint'], { t: { amp: 8, crack: 0.7, dil: 0.6 }, small: { shard: 0.05 }, phys: { ground: 'ice' } }),
      B('lilac_mountains', 'Lilac Mountains', 'ridged', ['cobaltViolet', 'neutralTint', 'roseMadder', 'indigo', 'davysGrey'], 'lemonYellow', ['cobaltViolet', 'neutralTint', 'roseMadder'], { t: { amp: 240, wl: 800 }, small: { rock: 0.05, shard: 0.04 }, phys: { ground: 'ice' } }),
      B('long_shadow_plain', 'Long-Shadow Plain', 'rolling', ['davysGrey', 'cobaltViolet', 'neutralTint', 'indigo', 'roseMadder'], 'cerulean', ['davysGrey', 'neutralTint', 'cobaltViolet'], { t: { amp: 60, wl: 500 }, small: { rock: 0.04 }, phys: { ground: 'ice' } }),
      B('nitrogen_dunes', 'Nitrogen Dunes', 'dunes', ['mint', 'davysGrey', 'cobaltBlue', 'roseMadder', 'neutralTint'], 'quinGold', ['mint', 'davysGrey', 'cobaltBlue'], { t: { amp: 22, wl: 220 }, small: { shard: 0.04 }, phys: { ground: 'ice' } }),
    ],
  },
};

export function getLook(bodyId) {
  const l = LOOKS[bodyId];
  if (!l) throw new Error('no look for body: ' + bodyId);
  return l;
}
