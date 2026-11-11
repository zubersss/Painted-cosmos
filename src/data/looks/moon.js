// Painted Cosmos: the look of the Moon. OWNER: PAINTER (pure data, safe to import in Node).
// The fields are described in common.js (the biome helper B) and src/world/surface.js (the terrain recipes).
import { PIGMENTS, hexToRgb, pig, dilute, mixc, glazec, EARTH_SKY, m3, mkSky, B, P, PM } from './common.js';

export default {
  seed: 'moon-2', seaLevel: null, cloud: 0, visibility: [4000, 20000],
  sky: mkSky([0.20, 0.22, 0.34], [0.50, 0.52, 0.62]),
  flora: { tall: [], under: { leaf: [[0.8, 0.8, 0.8], [0.6, 0.6, 0.62], [0.4, 0.4, 0.45]], accent: [0.45, 0.66, 0.82], bush: [[0.8, 0.8, 0.8], [0.6, 0.6, 0.62], [0.4, 0.4, 0.45]], rock: [[0.88, 0.88, 0.90], [0.50, 0.50, 0.56]], shard: [[0.9, 0.9, 0.92], [0.6, 0.6, 0.66]] } },
  biomes: [
    B('mare', 'Silver Mare', 'flat', ['davysGrey', 'neutralTint', 'paynesGrey', 'indigo', 'sepia'], 'cerulean', ['davysGrey', 'neutralTint', 'paynesGrey'], { t: { amp: 10 }, small: { rock: 0.03 }, phys: { ground: 'dust' } }),
    B('highlands', 'Bright Highlands', 'rolling', ['davysGrey', 'neutralTint', 'paynesGrey', 'indigo', 'sepia'], 'cerulean', ['davysGrey', 'davysGrey', 'neutralTint'], { t: { amp: 70, dil: 0.5 }, small: { rock: 0.05 }, phys: { ground: 'dust' } }),
    B('crater_fields', 'Crater Fields', 'crater', ['davysGrey', 'neutralTint', 'paynesGrey', 'indigo', 'sepia'], 'cerulean', ['neutralTint', 'davysGrey', 'paynesGrey'], { small: { rock: 0.06 }, phys: { ground: 'dust' } }),
    B('rilles', 'Winding Rilles', 'riverbed', ['davysGrey', 'neutralTint', 'paynesGrey', 'indigo', 'sepia'], 'cerulean', ['neutralTint', 'paynesGrey', 'davysGrey'], { t: { amp: 40 }, small: { rock: 0.05 }, phys: { ground: 'dust' } }),
  ],
};
