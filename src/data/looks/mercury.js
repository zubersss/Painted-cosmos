// Painted Cosmos: the look of Mercury. OWNER: PAINTER (pure data, safe to import in Node).
// The fields are described in common.js (the biome helper B) and src/world/surface.js (the terrain recipes).
import { PIGMENTS, hexToRgb, pig, dilute, mixc, glazec, EARTH_SKY, m3, mkSky, B, P, PM } from './common.js';

export default {
  seed: 'mercury-3', seaLevel: null, cloud: 0, visibility: [1400, 8000],
  sky: mkSky([0.34, 0.33, 0.50], [0.97, 0.88, 0.74], { glaze: [0.62, 0.62, 0.82], light: [1.0, 0.97, 0.88] }),
  flora: {
    tall: [
      { kit: 'crystal', scale: 1.1, vary: 1, bark: [[0.90, 0.80, 0.96], [0.50, 0.42, 0.72]], leaf: [[0.90, 0.80, 0.96], [0.74, 0.62, 0.86], [0.50, 0.42, 0.72]], far: [5, 7, 0.85], obs: [0.9, 5] },
      { kit: 'crystal', scale: 0.9, vary: 1, bark: [[0.96, 0.78, 0.84], [0.62, 0.74, 0.90]], leaf: [[0.96, 0.78, 0.84], [0.80, 0.76, 0.88], [0.52, 0.66, 0.86]], far: [4, 6, 0.85], obs: [0.8, 4] },
      { kit: 'crystal', scale: 0.8, vary: 1, bark: [[0.40, 0.42, 0.56], [0.17, 0.19, 0.30]], leaf: [[0.40, 0.42, 0.56], [0.28, 0.30, 0.44], [0.17, 0.19, 0.30]], far: [4, 5, 0.85], obs: [0.8, 3.5] },
    ],
    under: { leaf: [[0.86, 0.74, 0.50], [0.74, 0.60, 0.44], [0.50, 0.40, 0.36]], accent: [0.92, 0.55, 0.25], bush: [[0.80, 0.66, 0.50], [0.62, 0.50, 0.42], [0.40, 0.32, 0.34]], rock: [[0.88, 0.80, 0.66], [0.52, 0.44, 0.42]], shard: [[0.92, 0.84, 0.97], [0.56, 0.50, 0.78]] },
  },
  biomes: [
    B('ochre_basins', 'Cracked Ochre Basins', 'basin', ['yellowOchre', 'rawSienna', 'burntUmber', 'neutralTint', 'sepia'], 'cadOrange', ['yellowOchre', 'rawSienna', 'burntUmber'],
      { t: { crack: 1.0, patch: [{ c: [0.93, 0.86, 0.68], wl: 13, thr: 0.05, soft: 0.3, amt: 0.5 }, { c: [0.60, 0.42, 0.34], wl: 43, thr: 0.0, soft: 0.4, amt: 0.4 }] }, under: { crust: [[0.95, 0.90, 0.76], [0.66, 0.48, 0.36], [0.44, 0.34, 0.34]] }, near: { crust: 6, dab: 3 }, small: { rock: 0.06 }, phys: { ground: 'rock' } }),
    B('obsidian_fields', 'Obsidian Glass Fields', 'flat', ['indigo', 'paynesGrey', 'neutralTint', 'cobaltViolet', 'sepia'], 'turquoise', ['paynesGrey', 'indigo', 'neutralTint'],
      { t: { amp: 14, crack: 0.5, gloss: 1, dil: 0.12, patch: [{ c: [0.60, 0.58, 0.70], wl: 9, thr: 0.12, soft: 0.3, amt: 0.5 }, { c: [0.12, 0.13, 0.22], wl: 37, thr: 0.0, soft: 0.35, amt: 0.5 }] }, under: { rock: [[0.50, 0.52, 0.64], [0.20, 0.22, 0.34]], shard: [[0.62, 0.66, 0.80], [0.26, 0.28, 0.44]],
          // plates of glass that mirror the sky, the black glass itself, ash drifted between, a turquoise seam
          crust: [[0.74, 0.76, 0.88], [0.13, 0.14, 0.24], [0.60, 0.58, 0.70], [0.34, 0.70, 0.70]] }, tall: [2, 2], tallD: 0.16, tallMix: 1, near: { crust: 8, needle: 2, dab: 2 }, small: { rock: 0.05, shard: 0.06 }, phys: { ground: 'rock' } }),
    B('crystal_gardens', 'Twilight Crystal Gardens', 'rolling', ['cobaltViolet', 'roseMadder', 'cerulean', 'neutralTint', 'indigo'], 'lemonYellow', ['cobaltViolet', 'roseMadder', 'neutralTint'],
      { t: { amp: 45, wl: 380, dusk: 0.2 }, twilight: 0.45, tall: [0, 1], tallD: 0.20, tallMix: 0.55, under: { crust: [[0.94, 0.84, 0.94], [0.62, 0.52, 0.80], [0.90, 0.66, 0.74]] }, near: { crust: 5, needle: 6, dab: 1 }, small: { shard: 0.16, rock: 0.03 } }),
    B('shadow_craters', 'Frozen Shadow Craters', 'crater', ['davysGrey', 'cobaltBlue', 'neutralTint', 'indigo', 'paynesGrey'], 'mint', ['davysGrey', 'cobaltBlue', 'neutralTint'],
      { t: { frost: 0.9, dusk: 0.25 }, twilight: 0.5, under: { rock: [[0.88, 0.91, 0.96], [0.52, 0.58, 0.74]] }, small: { rock: 0.03 }, phys: { ground: 'ice' } }),
  ],
};
