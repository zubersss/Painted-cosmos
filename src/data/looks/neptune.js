// Painted Cosmos: the look of Neptune. OWNER: PAINTER (pure data, safe to import in Node).
// The fields are described in common.js (the biome helper B) and src/world/surface.js (the terrain recipes).
import { PIGMENTS, hexToRgb, pig, dilute, mixc, glazec, EARTH_SKY, m3, mkSky, B, P, PM } from './common.js';

export default {
  seed: 'neptune-3', seaLevel: 0, cloud: 0.42, visibility: [460, 2800], bands: 0.8, limb: 0.3,
  deck: { height: 310, belts: 5, wobble: 0.16, a: [0.50, 0.62, 0.93], b: [0.27, 0.35, 0.74], streaks: 0.9, wet: 0.6 },
  sky: mkSky([0.34, 0.46, 0.84], [0.80, 0.88, 0.98], { glaze: [0.60, 0.64, 0.88], light: [0.95, 0.97, 1.0] }),
  flora: {
    tall: [
      { kit: 'spire', scale: 1.2, bark: [[0.40, 0.42, 0.52], [0.16, 0.18, 0.28]], leaf: [[0.40, 0.42, 0.52], [0.27, 0.29, 0.40], [0.16, 0.18, 0.28]], far: [7, 12, 0.85], obs: [1.8, 13] },
      { kit: 'kelp', scale: 1.1, vary: 1, double: 1, bark: [[0.50, 0.44, 0.80], [0.26, 0.24, 0.56]], leaf: [[0.62, 0.56, 0.90], [0.42, 0.40, 0.78], [0.24, 0.26, 0.56]], leafP: [0.6, 0.1, 1.0, 0.4], wind: 0.5, far: [5, 10, 0.5], obs: [0.4, 9] },
      { kit: 'spire', scale: 1.9, slim: 1, bark: [[0.90, 0.95, 0.99], [0.44, 0.60, 0.90]], leaf: [[0.90, 0.95, 0.99], [0.70, 0.80, 0.95], [0.44, 0.60, 0.90]], far: [5, 14, 0.9], obs: [1.4, 13] },
    ],
    under: { leaf: [[0.62, 0.74, 0.70], [0.44, 0.58, 0.66], [0.30, 0.40, 0.58]], accent: [0.92, 0.90, 0.50], bush: [[0.52, 0.60, 0.80], [0.38, 0.44, 0.70], [0.24, 0.28, 0.54]], rock: [[0.50, 0.52, 0.62], [0.22, 0.24, 0.36]], shard: [[0.92, 0.96, 0.99], [0.56, 0.70, 0.92]],
      // the kelp wood's floor: wrack torn off by the gales, sea pinks and pale stars in drifts, lichen
      flowers: [[0.92, 0.54, 0.68], [0.93, 0.91, 0.52], [0.90, 0.94, 0.99]], litter: [[0.48, 0.40, 0.70], [0.32, 0.28, 0.54], [0.60, 0.66, 0.72]], crust: [[0.74, 0.88, 0.82], [0.26, 0.26, 0.48], [0.80, 0.78, 0.92]] },
  },
  biomes: [
    B('storm_seas', 'Ultramarine Storm Seas', 'coast', ['ultramarine', 'indigo', 'paynesGrey', 'cerulean', 'neutralTint'], 'mint', ['paynesGrey', 'neutralTint', 'indigo'],
      { t: { cliff: 46, stacks: 0.8, stackCell: 80, strata: 0.3 }, want: { stand: 2.4 }, liquid: { color: [0.34, 0.42, 0.78], refl: 0.5 }, tall: [0, 0], tallD: 0.30, tallMix: 1, tallWet: 1, near: { crust: 4, dab: 4 }, small: { rock: 0.09 }, phys: { ground: 'rock' } }),
    B('kelp_forests', 'Blue-Violet Kelp Forests', 'rolling', ['cobaltViolet', 'ultramarine', 'viridian', 'indigo', 'neutralTint'], 'roseMadder', ['cobaltViolet', 'ultramarine', 'viridian'],
      { t: { amp: 40, wl: 420, patch: [{ c: [0.30, 0.54, 0.52], wl: 21, thr: -0.08, soft: 0.34, amt: 0.55 }, { c: [0.72, 0.70, 0.86], wl: 8, thr: 0.26, soft: 0.22, amt: 0.45 }] }, tall: [1, 1], tallD: 0.5, tallMix: 1,
        near: { blade: 4, gm: 0.45, fern: 6, flower: 5, litter: 6, crust: 3, dab: 1 }, small: { fern: 0.18, bush: 0.09, flower: 0.09, rock: 0.03 } }),
    B('ice_spires', 'Wind-Carved Ice Spires', 'spires', ['cerulean', 'cobaltBlue', 'davysGrey', 'mint', 'indigo'], 'cobaltViolet', ['cerulean', 'davysGrey', 'cobaltBlue'],
      { t: { amp: 11, wl: 52, frost: 0.55 }, want: { flora: 1.6, layers: 0.6 }, tall: [2, 2], tallD: 0.34, tallMix: 1, small: { shard: 0.14 }, phys: { ground: 'ice' } }),
    B('aurora_tundra', 'Aurora Tundra', 'flat', ['viridian', 'neutralTint', 'cobaltBlue', 'mint', 'indigo'], 'lemonYellow', ['neutralTint', 'viridian', 'cobaltBlue'],
      { t: { amp: 12, ponds: 1, crack: 0.3 }, liquid: { color: [0.50, 0.62, 0.86], refl: 0.85 }, small: { grass: 0.45, bush: 0.04, rock: 0.03, flower: 0.05 } }),
  ],
};
