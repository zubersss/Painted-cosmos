// Painted Cosmos: the look of the Moon. OWNER: PAINTER (pure data, safe to import in Node).
// The fields are described in common.js (the biome helper B) and src/world/surface.js (the terrain recipes).
import { PIGMENTS, hexToRgb, pig, dilute, mixc, glazec, EARTH_SKY, m3, mkSky, B, P, PM } from './common.js';

// Silver-grey minimal washes (the brief). Each biome is told apart by its value: the maria dark and
// cool (Payne's grey), the highlands bright and warm (paper, a breath of sepia), the crater fields
// splashed with pale ejecta, the rilles a winding dark cut. Boulders are few and stand in the
// ground's own greys, so the plain reads as a plain and the eye has somewhere to rest.
export default {
  seed: 'moon-2', seaLevel: null, cloud: 0,
  // (the first landing, PAINTER 13: the Moon is tidally locked, so Earth hangs fixed in the near side's sky (the
  // coordinator's ruling); the arrival is on the near side, on the flat silver mare, facing Earth 15 degrees up: the
  // mare's stand. [x, y, z, yaw, pitch])
  spawn: [-0.058016, 0.806398, -0.588521, 118, 3],
  // (no air, but the far plain still goes back in paler bands, toward a pale silver: the painter's convention, honoured
  // since PAINTER 12 on airless worlds; the horizon here is 70 to 400 m off, so the bands lie close)
  visibility: [900, 9000],
  // (the drift of the ground's wash between two hues: kept near neutral, silver rather than ochre)
  hue: [[1.0, 0.965, 0.91], [0.92, 0.93, 1.0]],
  sky: mkSky([0.20, 0.22, 0.34], [0.50, 0.52, 0.62], { haze: [0.85, 0.85, 0.88] }),
  flora: { tall: [], under: { leaf: [[0.8, 0.8, 0.8], [0.6, 0.6, 0.62], [0.4, 0.4, 0.45]], accent: [0.45, 0.66, 0.82], bush: [[0.8, 0.8, 0.8], [0.6, 0.6, 0.62], [0.4, 0.4, 0.45]], rock: [[0.75, 0.74, 0.73], [0.40, 0.40, 0.46]], shard: [[0.82, 0.82, 0.84], [0.52, 0.52, 0.58]] } },
  biomes: [
    B('mare', 'Silver Mare', 'flat', ['davysGrey', 'neutralTint', 'paynesGrey', 'indigo', 'sepia'], 'cerulean', ['paynesGrey', 'neutralTint', 'davysGrey'],
      { t: { amp: 10, dil: 0.30, patch: [{ c: [0.54, 0.57, 0.64], wl: 46, thr: 0.0, soft: 0.4, amt: 0.55 }, { c: [0.93, 0.93, 0.92], wl: 9, thr: 0.32, soft: 0.2, amt: 0.35 }] }, small: { rock: 0.010 }, phys: { ground: 'dust' },
        under: { rock: [[0.64, 0.65, 0.68], [0.34, 0.35, 0.42]] } }),
    B('highlands', 'Bright Highlands', 'rolling', ['davysGrey', 'neutralTint', 'paynesGrey', 'indigo', 'sepia'], 'cerulean', ['davysGrey', 'davysGrey', 'neutralTint'],
      { t: { amp: 70, dil: 0.55, patch: [{ c: [0.95, 0.94, 0.92], wl: 21, thr: 0.04, soft: 0.3, amt: 0.5 }, { c: [0.78, 0.73, 0.68], wl: 52, thr: 0.08, soft: 0.4, amt: 0.35 }] }, small: { rock: 0.014 }, phys: { ground: 'dust' } }),
    B('crater_fields', 'Crater Fields', 'crater', ['davysGrey', 'neutralTint', 'paynesGrey', 'indigo', 'sepia'], 'cerulean', ['neutralTint', 'davysGrey', 'paynesGrey'],
      { t: { patch: [{ c: [0.94, 0.94, 0.93], wl: 13, thr: 0.14, soft: 0.25, amt: 0.45 }] }, small: { rock: 0.020 }, phys: { ground: 'dust' } }),
    B('rilles', 'Winding Rilles', 'riverbed', ['davysGrey', 'neutralTint', 'paynesGrey', 'indigo', 'sepia'], 'cerulean', ['neutralTint', 'paynesGrey', 'davysGrey'],
      { t: { amp: 40, patch: [{ c: [0.60, 0.60, 0.66], wl: 38, thr: 0.05, soft: 0.4, amt: 0.4 }] }, small: { rock: 0.010 }, phys: { ground: 'dust' } }),
  ],
};
