// Painted Cosmos: the look of Venus. OWNER: PAINTER (pure data, safe to import in Node).
// The fields are described in common.js (the biome helper B) and src/world/surface.js (the terrain recipes).
import { PIGMENTS, hexToRgb, pig, dilute, mixc, glazec, EARTH_SKY, m3, mkSky, B, P, PM } from './common.js';

export default {
  seed: 'venus-3', seaLevel: null, cloud: 0.85, visibility: [230, 1000], bands: 0.6,
  // the first landing: on the bank of a lava river where it runs away into the haze, a grove of the old towers beside it
  spawn: [0.441599, 0.870687, 0.216551, 352, -4, 15, 19.6],
  deck: { height: 450, belts: 3.2, wobble: 0.42, a: [0.99, 0.94, 0.66], b: [0.93, 0.70, 0.36], streaks: 0.35, wet: 0.7 },
  sky: mkSky([0.90, 0.76, 0.40], [0.99, 0.91, 0.62], { glaze: [0.74, 0.62, 0.66], light: [1.0, 0.94, 0.72], cloudShade: [0.86, 0.66, 0.44] }),
  flora: {
    tall: [
      { kit: 'fungus', scale: 1.0, vary: 1, bark: [[0.96, 0.90, 0.72], [0.62, 0.46, 0.34]], leaf: [[0.96, 0.74, 0.34], [0.88, 0.56, 0.30], [0.60, 0.34, 0.28]], barkP: [0.74, 0, 1.6, 0.4], leafP: [0.35, 0.0, 1.0, 0.4], wind: 0.03, far: [10, 14, 0.0], obs: [0.7, 14] },
      { kit: 'fungus', scale: 0.6, vary: 1, bark: [[0.94, 0.86, 0.76], [0.58, 0.42, 0.40]], leaf: [[0.92, 0.60, 0.62], [0.80, 0.44, 0.50], [0.52, 0.30, 0.40]], barkP: [0.74, 0, 1.6, 0.4], leafP: [0.35, 0.0, 1.0, 0.4], wind: 0.03, far: [7, 9, 0.0], obs: [0.5, 8] },
      { kit: 'spire', scale: 0.8, vary: 1, bark: [[0.50, 0.44, 0.46], [0.22, 0.20, 0.26]], leaf: [[0.50, 0.44, 0.46], [0.36, 0.32, 0.36], [0.22, 0.20, 0.26]], far: [7, 12, 0.85], obs: [1.6, 9] },
      // the old towers that line a lava river, full grown, their caps warmed from below
      { kit: 'fungus', scale: 1.45, bark: [[0.97, 0.90, 0.70], [0.66, 0.44, 0.30]], leaf: [[0.97, 0.70, 0.30], [0.90, 0.48, 0.24], [0.58, 0.28, 0.24]], barkP: [0.74, 0, 1.6, 0.4], leafP: [0.35, 0.0, 1.0, 0.4], wind: 0.03, far: [14, 20, 0.0], obs: [1.0, 20] },
    ],
    under: { leaf: [[0.92, 0.80, 0.40], [0.80, 0.62, 0.34], [0.56, 0.40, 0.30]], accent: [0.86, 0.36, 0.46], bush: [[0.90, 0.66, 0.36], [0.74, 0.48, 0.32], [0.48, 0.30, 0.30]], rock: [[0.62, 0.56, 0.56], [0.30, 0.27, 0.32]], shard: [[0.96, 0.94, 0.60], [0.70, 0.74, 0.40]],
      // the sward: young fungi (caps on pale stalks), what has fallen from the towers, crusts of mould
      flowers: [[0.92, 0.56, 0.60], [0.96, 0.74, 0.34], [0.98, 0.93, 0.76], [0.80, 0.40, 0.34]], stalk: [0.96, 0.90, 0.74], litter: [[0.90, 0.66, 0.36], [0.70, 0.44, 0.30], [0.50, 0.32, 0.30]], crust: [[0.94, 0.86, 0.50], [0.62, 0.60, 0.34], [0.88, 0.56, 0.52]] },
  },
  biomes: [
    B('fungal_towers', 'Fungal Tower Forest', 'rolling', ['quinGold', 'rawSienna', 'burntSienna', 'oliveGreen', 'sepia'], 'roseMadder', ['quinGold', 'rawSienna', 'oliveGreen'],
      { t: { amp: 55, wl: 480, patch: [{ c: [0.58, 0.60, 0.30], wl: 17, thr: -0.05, soft: 0.35, amt: 0.55 }, { c: [0.86, 0.60, 0.50], wl: 7, thr: 0.28, soft: 0.25, amt: 0.4 }] }, mist: 0.8, tall: [0, 1], tallD: 0.62, tallMix: 0.55,
        near: { blade: 2, dab: 1, flower: 7, flowerSize: 2.3, fern: 6, litter: 6, crust: 4 }, small: { bush: 0.09, fern: 0.20, flower: 0.10, rock: 0.02 } }),
    B('lava_rivers', 'Lava Rivers', 'riverbed', ['sepia', 'burntUmber', 'paynesGrey', 'cadOrange', 'indigo'], 'cadScarlet', ['burntUmber', 'sepia', 'paynesGrey'],
      { t: { amp: 34, wet: 1, dil: 0.14, bedW: 12, bedD: 2.3, lqD: 1.5, flow: 1.3, ember: 1, emberR: 26, patch: [{ c: [0.17, 0.15, 0.19], wl: 31, thr: -0.02, soft: 0.3, amt: 0.6 }, { c: [0.84, 0.72, 0.36], wl: 9, thr: 0.24, soft: 0.22, amt: 0.5 }, { c: [0.74, 0.40, 0.24], wl: 4.5, thr: 0.38, soft: 0.2, amt: 0.45 }] }, liquid: { color: [0.96, 0.46, 0.16], refl: 0, glow: 1 }, tall: [3, 2], tallD: 0.30, tallMix: 0.62,
        // cooled flows: ropes of dark glass, sulphur crust round the vents, an ember crack here and there
        under: { crust: [[0.13, 0.12, 0.16], [0.90, 0.78, 0.36], [0.30, 0.26, 0.30], [0.93, 0.52, 0.22]], rock: [[0.44, 0.38, 0.40], [0.19, 0.16, 0.21]] }, near: { dab: 2, crust: 8, needle: 0 }, small: { rock: 0.035 }, phys: { ground: 'rock' } }),
    B('acid_terraces', 'Acid Lake Terraces', 'terraced', ['lemonYellow', 'oliveGreen', 'yellowOchre', 'viridian', 'rawUmber'], 'turquoise', ['lemonYellow', 'yellowOchre', 'oliveGreen'],
      { t: { amp: 150, steps: 12, pools: 1, wl: 430, riser: [0.72, 0.90] }, liquid: { color: [0.80, 0.92, 0.50], refl: 0.45 }, under: { crust: [[0.97, 0.96, 0.70], [0.70, 0.80, 0.44], [0.50, 0.72, 0.62]], rock: [[0.84, 0.76, 0.54], [0.54, 0.47, 0.34]] }, near: { crust: 6, needle: 2, dab: 0 }, small: { shard: 0.05, rock: 0.016 } }),
    B('pale_mesas', 'Pale Mesas', 'mesa', ['yellowOchre', 'davysGrey', 'rawSienna', 'neutralTint', 'roseMadder'], 'cobaltViolet', ['yellowOchre', 'davysGrey', 'rawSienna'],
      { t: { amp: 330, strata: 0.7, wl: 520, fog: [100, 40] }, mist: 2.6, want: { perch: 1.2, liquid: 1.6, beyond: 2.4, steep: 1.0, below: 0.5, high: 0.08, relief: 1.2 }, under: { rock: [[0.94, 0.89, 0.76], [0.68, 0.58, 0.50]], bush: [[0.90, 0.84, 0.56], [0.74, 0.66, 0.44], [0.50, 0.44, 0.36]], crust: [[0.97, 0.94, 0.84], [0.74, 0.62, 0.52], [0.84, 0.66, 0.66]] }, near: { crust: 2, dab: 1 }, small: { rock: 0.018, bush: 0.01 }, phys: { ground: 'rock' } }),
  ],
};
