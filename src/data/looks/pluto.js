// Painted Cosmos: the look of Pluto. OWNER: PAINTER (pure data, safe to import in Node).
// The fields are described in common.js (the biome helper B) and src/world/surface.js (the terrain recipes).
import { PIGMENTS, hexToRgb, pig, dilute, mixc, glazec, EARTH_SKY, m3, mkSky, B, P, PM } from './common.js';

export default {
  seed: 'pluto-2', seaLevel: null, cloud: 0, visibility: [3000, 16000],
  sky: mkSky([0.24, 0.24, 0.40], [0.62, 0.60, 0.78]),
  flora: {
    // penitents: blades of old frost standing in companies, leaning one way; they throw the long shadows
    tall: [{ kit: 'spire', scale: 0.55, slim: 1, vary: 1, bark: [[0.96, 0.93, 0.98], [0.60, 0.54, 0.80]], leaf: [[0.96, 0.93, 0.98], [0.80, 0.74, 0.90], [0.60, 0.54, 0.80]], far: [5, 14, 0.9], obs: [1.4, 13] }],
    under: { leaf: [[0.9, 0.84, 0.9], [0.7, 0.64, 0.78], [0.5, 0.46, 0.62]], accent: [0.92, 0.6, 0.3], bush: [[0.9, 0.84, 0.9], [0.7, 0.64, 0.78], [0.5, 0.46, 0.62]], rock: [[0.92, 0.88, 0.94], [0.58, 0.52, 0.70]], shard: [[0.98, 0.96, 0.995], [0.84, 0.80, 0.94]],
      crust: [[0.98, 0.96, 0.99], [0.90, 0.72, 0.82], [0.97, 0.95, 0.99], [0.46, 0.40, 0.64]] } },
  biomes: [
    B('heart_glacier', 'Pale Heart Glacier', 'flat', ['roseMadder', 'davysGrey', 'cobaltViolet', 'mint', 'neutralTint'], 'cadOrange', ['roseMadder', 'davysGrey', 'mint'], { t: { amp: 8, crack: 0.7, dil: 0.6, patch: [{ c: [0.98, 0.96, 0.98], wl: 19, thr: 0.0, soft: 0.3, amt: 0.6 }, { c: [0.90, 0.74, 0.80], wl: 53, thr: 0.05, soft: 0.4, amt: 0.4 }] }, tall: [0, 0], tallD: 0.05, tallMix: 1, near: { crust: 7, needle: 3, dab: 1 }, small: { shard: 0.09, rock: 0.02 }, phys: { ground: 'ice' } }),
    B('lilac_mountains', 'Lilac Mountains', 'ridged', ['cobaltViolet', 'neutralTint', 'roseMadder', 'indigo', 'davysGrey'], 'lemonYellow', ['cobaltViolet', 'neutralTint', 'roseMadder'], { t: { amp: 240, wl: 800, patch: [{ c: [0.96, 0.94, 0.98], wl: 16, thr: 0.04, soft: 0.3, amt: 0.6 }, { c: [0.80, 0.56, 0.64], wl: 49, thr: 0.02, soft: 0.4, amt: 0.42 }, { c: [0.40, 0.36, 0.58], wl: 6, thr: 0.3, soft: 0.2, amt: 0.35 }] }, tall: [0, 0], tallD: 0.13, tallMix: 1, near: { crust: 7, needle: 3, dab: 3 }, small: { rock: 0.10, shard: 0.05 }, phys: { ground: 'ice' } }),
    B('long_shadow_plain', 'Long-Shadow Plain', 'rolling', ['davysGrey', 'cobaltViolet', 'neutralTint', 'indigo', 'roseMadder'], 'cerulean', ['davysGrey', 'neutralTint', 'cobaltViolet'], { t: { amp: 60, wl: 500, patch: [{ c: [0.95, 0.93, 0.97], wl: 17, thr: 0.1, soft: 0.3, amt: 0.5 }] }, tall: [0, 0], tallD: 0.08, tallMix: 1, near: { crust: 5, dab: 3 }, small: { rock: 0.08 }, phys: { ground: 'ice' } }),
    B('nitrogen_dunes', 'Nitrogen Dunes', 'dunes', ['mint', 'davysGrey', 'cobaltBlue', 'roseMadder', 'neutralTint'], 'quinGold', ['mint', 'davysGrey', 'cobaltBlue'], { t: { amp: 22, wl: 220 }, small: { shard: 0.04 }, phys: { ground: 'ice' } }),
  ],
};
