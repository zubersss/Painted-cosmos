// Painted Cosmos: the look of Saturn. OWNER: PAINTER (pure data, safe to import in Node).
// The fields are described in common.js (the biome helper B) and src/world/surface.js (the terrain recipes).
import { PIGMENTS, hexToRgb, pig, dilute, mixc, glazec, EARTH_SKY, m3, mkSky, B, P, PM } from './common.js';

export default {
  seed: 'saturn-3', seaLevel: 0, cloud: 0.5, visibility: [620, 3600], fine: 1,
  rings: { inner: 1.35, outer: 2.25, color: [0.93, 0.86, 0.66] },
  bands: 0.5,
  deck: { height: 340, belts: 7, wobble: 0.05, a: [0.99, 0.95, 0.78], b: [0.93, 0.80, 0.52], streaks: 0.15, wet: 0.6 },
  // (a sky with body: honey at the horizon rising to a dusty violet-gold, so that the rings are a PALE arc in it)
  sky: mkSky([0.76, 0.70, 0.78], [0.99, 0.93, 0.74], { glaze: [0.74, 0.70, 0.86], light: [1.0, 0.97, 0.86], cloudShade: [0.86, 0.74, 0.66] }),
  skyBelts: [14, 0.012, 0.10], seaDeck: [84, 0.92, 1.0],
  // the first landing: far enough south that the rings stand as a great arc over the northern sky, by the rim of an island
  spawn: [-0.847849, -0.520723, 0.099999, 15, 1, 15, 343.6],
  flora: {
    tall: [
      { kit: 'crystal', thin: 1, scale: 0.9, bark: [[0.90, 0.98, 0.90], [0.50, 0.78, 0.72]], leaf: [[0.90, 0.98, 0.90], [0.74, 0.90, 0.80], [0.50, 0.78, 0.72]], far: [3.2, 7.5, 0.9], obs: [0.4, 6] },
      { kit: 'broadleaf', scale: 0.85, vary: 1, bark: [[0.80, 0.70, 0.50], [0.46, 0.36, 0.30]], leaf: [[0.95, 0.86, 0.45], [0.86, 0.72, 0.36], [0.62, 0.50, 0.34]], barkP: [0.6, 1, 0.8, 0.4], leafP: [0.40, 0.0, 0.8, 0.5], wind: 0.08, far: [10, 8.5, 0], obs: [0.25, 8] },
      { kit: 'spire', scale: 0.8, bark: [[0.84, 0.80, 0.84], [0.52, 0.48, 0.58]], leaf: [[0.84, 0.80, 0.84], [0.68, 0.64, 0.72], [0.52, 0.48, 0.58]], far: [7, 12, 0.85], obs: [1.6, 9] },
    ],
    under: { leaf: [[0.93, 0.88, 0.50], [0.82, 0.76, 0.42], [0.60, 0.56, 0.36]], accent: [0.86, 0.64, 0.22], bush: [[0.94, 0.86, 0.52], [0.82, 0.72, 0.42], [0.64, 0.58, 0.38]], rock: [[0.94, 0.90, 0.76], [0.66, 0.58, 0.50]], shard: [[0.90, 0.98, 0.92], [0.56, 0.82, 0.78]],
      flowers: [[0.64, 0.52, 0.86], [0.97, 0.80, 0.30], [0.98, 0.96, 0.86], [0.90, 0.56, 0.44]], crust: [[0.98, 0.94, 0.76], [0.78, 0.66, 0.40], [0.72, 0.86, 0.78]] },
  },
  biomes: [
    B('gold_islands', 'Pale Gold Sky-Islands', 'islands', ['yellowOchre', 'quinGold', 'davysGrey', 'rawSienna', 'oliveGreen'], 'cobaltViolet', ['yellowOchre', 'quinGold', 'rawSienna'],
      { t: { amp: 100, cliff: 95, veil: 30, wl: 470, strata: 0.4, dil: 0.42, patch: [{ c: [0.74, 0.70, 0.36], wl: 23, thr: -0.10, soft: 0.34, amt: 0.6 }, { c: [0.56, 0.58, 0.34], wl: 7.5, thr: 0.24, soft: 0.25, amt: 0.4 }, { c: [0.97, 0.90, 0.70], wl: 11, thr: 0.32, soft: 0.2, amt: 0.45 }] }, want: { perch: 0.6, rings: 2.6 }, liquid: { color: [0.97, 0.92, 0.74], refl: 0, cloud: 1 }, tall: [1, 1], tallD: 0.28, tallMix: 1, near: { blade: 6, gm: 0.42, flower: 5, crust: 2, needle: 0, dab: 1 }, small: { grass: 0.35, rock: 0.04, flower: 0.08, bush: 0.07, shard: 0.01 } }),
    B('crystal_reeds', 'Crystal Reed Fields', 'flat', ['mint', 'lemonYellow', 'cerulean', 'davysGrey', 'cobaltViolet'], 'roseMadder', ['lemonYellow', 'mint', 'davysGrey'],
      { t: { amp: 10, patch: [{ c: [0.80, 0.92, 0.84], wl: 14, thr: 0.0, soft: 0.3, amt: 0.5 }] }, tall: [0, 0], tallD: 0.55, tallMix: 1, near: { crust: 4 }, small: { shard: 0.24, grass: 0.14 }, phys: { ground: 'gravel' } }),
    B('ring_shadow', 'Ring-Shadow Twilight', 'rolling', ['cobaltViolet', 'cobaltBlue', 'indigo', 'yellowOchre', 'paynesGrey'], 'quinGold', ['cobaltViolet', 'cobaltBlue', 'paynesGrey'],
      { t: { amp: 60, wl: 520, dusk: 0.35, dil: 0.44 }, twilight: 0.75, want: { rings: 0.8 }, under: { leaf: [[0.80, 0.76, 0.80], [0.62, 0.58, 0.72], [0.42, 0.40, 0.58]], rock: [[0.86, 0.82, 0.80], [0.58, 0.54, 0.56]], shard: [[0.88, 0.86, 0.94], [0.58, 0.56, 0.74]], accent: [0.92, 0.74, 0.30] }, tall: [2, 2], tallD: 0.10, tallMix: 1, small: { rock: 0.02, flower: 0.06, shard: 0.03 } }),
    B('honey_mist', 'Honey Mist Valleys', 'ridged', ['quinGold', 'rawSienna', 'yellowOchre', 'oliveGreen', 'sepia'], 'cerulean', ['quinGold', 'yellowOchre', 'rawSienna'],
      { t: { amp: 230, wl: 900 }, mist: 0.30, tall: [1, 1], tallD: 0.30, tallMix: 1, small: { grass: 0.4, bush: 0.05, rock: 0.03 } }),
  ],
  sites: [[12, 0, 'gold_islands'], [-10, 70, 'crystal_reeds'], [30, -70, 'honey_mist'], [2, 150, 'ring_shadow'], [-3, -150, 'ring_shadow'], [50, 40, 'crystal_reeds'], [-45, -30, 'gold_islands'], [-40, 110, 'honey_mist'],
    [65, -120, 'gold_islands'], [-70, 30, 'crystal_reeds'], [35, 120, 'honey_mist'], [-25, -100, 'gold_islands'], [0, -60, 'ring_shadow'], [70, 150, 'honey_mist'], [-60, -150, 'crystal_reeds'], [0, 40, 'ring_shadow']],
};
