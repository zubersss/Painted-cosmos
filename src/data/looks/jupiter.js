// Painted Cosmos: the look of Jupiter. OWNER: PAINTER (pure data, safe to import in Node).
// The fields are described in common.js (the biome helper B) and src/world/surface.js (the terrain recipes).
import { PIGMENTS, hexToRgb, pig, dilute, mixc, glazec, EARTH_SKY, m3, mkSky, B, P, PM } from './common.js';

export default {
  seed: 'jupiter-3', seaLevel: 0, cloud: 0.6, visibility: [600, 3200], bands: 1.0, fine: 1,
  deck: { height: 720, belts: 9, wobble: 0.07, a: [0.99, 0.94, 0.80], b: [0.92, 0.62, 0.38], streaks: 0.25, wet: 0.45, storm: { over: 'storm_wall', size: 0.20, color: [0.80, 0.34, 0.28] } },
  sky: mkSky([0.90, 0.78, 0.62], [0.99, 0.93, 0.80], { glaze: [0.72, 0.66, 0.84], light: [1.0, 0.95, 0.84], cloudShade: [0.90, 0.68, 0.50] }),
  skyBelts: [20, 0.016, 0.85], seaDeck: [106, 0.92, 1.15],
  // the first landing: a bench of the first island, where the belts of the sky run down between the islands that stand round it
  spawn: [0.124426, 0.328288, 0.936347, 60, 0, 15, 91.6],
  flora: {
    tall: [
      { kit: 'broadleaf', scale: 1.0, vary: 1, bark: [[0.70, 0.58, 0.46], [0.36, 0.28, 0.28]], leaf: [[0.70, 0.84, 0.42], [0.46, 0.70, 0.44], [0.24, 0.46, 0.42]], barkP: [0.55, 1, 0.8, 0.5], leafP: [0.85, 0.30, 1.0, 0.3], wind: 0.10, far: [13, 10.5, 0], obs: [0.3, 10] },
      { kit: 'spire', scale: 1.1, bark: [[0.86, 0.50, 0.40], [0.50, 0.24, 0.28]], leaf: [[0.86, 0.50, 0.40], [0.70, 0.36, 0.34], [0.50, 0.24, 0.28]], far: [7, 12, 0.85], obs: [1.6, 12] },
      { kit: 'spire', scale: 0.8, bark: [[0.74, 0.72, 0.82], [0.38, 0.38, 0.52]], leaf: [[0.74, 0.72, 0.82], [0.56, 0.55, 0.68], [0.38, 0.38, 0.52]], far: [7, 12, 0.85], obs: [1.6, 9] },
      { kit: 'vine', scale: 1.0, double: 1, noObs: 1, bark: [[0.50, 0.44, 0.36], [0.30, 0.26, 0.26]], leaf: [[0.74, 0.88, 0.46], [0.50, 0.76, 0.44], [0.30, 0.56, 0.42]], leafP: [0.8, 0.22, 1.0, 0.3], accent: [0.92, 0.50, 0.62], wind: 0.35, far: [7.5, 9, 0.25], obs: [0, 0] },
    ],
    under: { leaf: [[0.82, 0.86, 0.46], [0.60, 0.74, 0.40], [0.36, 0.52, 0.38]], accent: [0.90, 0.50, 0.60], bush: [[0.62, 0.80, 0.44], [0.42, 0.66, 0.42], [0.24, 0.44, 0.40]], rock: [[0.94, 0.86, 0.72], [0.68, 0.50, 0.42]], shard: [[0.96, 0.94, 0.70], [0.80, 0.76, 0.50]],
      flowers: [[0.90, 0.30, 0.22], [0.98, 0.95, 0.80], [0.92, 0.52, 0.62], [0.96, 0.66, 0.26]], crust: [[0.96, 0.90, 0.72], [0.80, 0.56, 0.40]] },
  },
  biomes: [
    B('sky_islands', 'Cream Sky-Islands', 'islands', ['yellowOchre', 'cadOrange', 'rawSienna', 'sapGreen', 'neutralTint'], 'cadScarlet', ['yellowOchre', 'sapGreen', 'rawSienna'],
      { t: { amp: 110, cliff: 120, veil: 34, wl: 430, strata: 0.6, dil: 0.26, patch: [{ c: [0.52, 0.68, 0.34], wl: 26, thr: -0.12, soft: 0.34, amt: 0.62 }, { c: [0.36, 0.54, 0.34], wl: 8, thr: 0.22, soft: 0.25, amt: 0.4 }, { c: [0.90, 0.62, 0.42], wl: 12, thr: 0.34, soft: 0.2, amt: 0.4 }] }, mist: 1.5, want: { perch: 0.6, liquid: 3.0, beyond: 2.6, steep: 0.8 }, liquid: { color: [0.98, 0.90, 0.76], refl: 0, cloud: 1 }, tall: [0, 0], tallD: 0.30, tallMix: 1, near: { blade: 6, gm: 0.40, flower: 5, crust: 2, dab: 1 }, small: { grass: 0.4, rock: 0.04, flower: 0.09, bush: 0.07, fern: 0.06 } }),
    B('storm_wall', 'Storm-Wall Cliffs', 'wall', ['burntSienna', 'alizarin', 'rawUmber', 'neutralTint', 'cadOrange'], 'lemonYellow', ['burntSienna', 'alizarin', 'rawUmber'],
      { t: { amp: 600, wl: 1500, strata: 0.9, dil: 0.22 }, mist: 2.4, twilight: 0.35, want: { close: 0.2 }, tall: [1, 1], tallD: 0.09, tallMix: 1, small: { rock: 0.08 }, phys: { ground: 'rock' } }),
    B('hanging_gardens', 'Hanging Gardens', 'terraced', ['sapGreen', 'viridian', 'quinGold', 'rawSienna', 'cobaltViolet'], 'roseMadder', ['sapGreen', 'viridian', 'quinGold'],
      { t: { amp: 170, steps: 6, wl: 640, riser: [0.865, 0.93], strata: 0.5, under: 0.5 }, want: { close: 0.5, high: 0.34, steep: 2.6, flora: 0, layers: 0.8 }, hang: { kit: 3, d: 0.9 }, tall: [0, 0], tallD: 0.16, tallMix: 1, small: { fern: 0.2, flower: 0.12, bush: 0.05, grass: 0.3 } }),
    B('lightning_plains', 'Lightning Plains', 'flat', ['neutralTint', 'paynesGrey', 'yellowOchre', 'cobaltViolet', 'indigo'], 'lemonYellow', ['neutralTint', 'yellowOchre', 'paynesGrey'],
      { t: { amp: 12, crack: 0.9, dusk: 0.3, pits: 1.3 }, twilight: 0.4, under: { leaf: [[0.80, 0.78, 0.66], [0.62, 0.60, 0.60], [0.42, 0.42, 0.52]], rock: [[0.72, 0.70, 0.76], [0.36, 0.36, 0.48]] }, tall: [2, 2], tallD: 0.16, tallMix: 1, near: { crust: 5 }, small: { rock: 0.05, shard: 0.16, grass: 0.06 } }),
  ],
  // the Great Red Spot stands over the first storm-wall site, south of the equator
  sites: [[8, 0, 'sky_islands'], [-22, 40, 'storm_wall'], [30, -60, 'hanging_gardens'], [-5, 150, 'lightning_plains'], [45, 90, 'sky_islands'], [-50, -30, 'hanging_gardens'], [-35, 110, 'sky_islands'], [60, -130, 'lightning_plains'],
    [-65, 60, 'lightning_plains'], [20, -150, 'storm_wall'], [70, 20, 'hanging_gardens'], [-15, -100, 'sky_islands'], [0, 95, 'hanging_gardens'], [-45, -150, 'storm_wall'], [35, 30, 'lightning_plains'], [-75, -90, 'sky_islands']],
};
