// Painted Cosmos: the look of Pluto. OWNER: PAINTER (pure data, safe to import in Node).
// The fields are described in common.js (the biome helper B) and src/world/surface.js (the terrain recipes).
import { PIGMENTS, hexToRgb, pig, dilute, mixc, glazec, EARTH_SKY, m3, mkSky, B, P, PM } from './common.js';

// The ice worlds' hand (art pass, group "ice"; see uranus.js): paper and pale wash for the light,
// the world's own pigments in the middle (lilac, rose, cream here), one dense dark (the indigo of
// the high sky, the lee of a penitent, the foot of a stone), stones a step below their ground, one
// small accent (the tholin orange of the heart's edge).
export default {
  seed: 'pluto-2', seaLevel: null, cloud: 0,
  // (a thin air, but enough that the far ridges go back in steps toward a pale blue haze band)
  visibility: [1600, 10000],
  // (the ground's drifts: toward rose and toward lilac; the default warm drift on mint turned the glacier green)
  hue: [[1.0, 0.95, 0.95], [0.95, 0.93, 1.0]],
  // a pale lilac wash overhead running down to a near-paper band, so the far ridges fade to paper
  // (an indigo sky, and even the mid-lilac [0.35,0.34,0.53] > [0.78,0.76,0.90], granulated into a
  // mottled slab over half the sheet with the horizon still mid-value)
  sky: mkSky([0.50, 0.48, 0.68], [0.88, 0.86, 0.95]),
  flora: {
    // penitents: blades of old frost standing in companies, leaning one way; they throw the long shadows
    tall: [{ kit: 'spire', scale: 0.55, slim: 1, vary: 1, bark: [[0.96, 0.93, 0.98], [0.60, 0.54, 0.80]], leaf: [[0.96, 0.93, 0.98], [0.80, 0.74, 0.90], [0.60, 0.54, 0.80]], far: [5, 14, 0.9], obs: [1.4, 13] }],
    under: { leaf: [[0.9, 0.84, 0.9], [0.7, 0.64, 0.78], [0.5, 0.46, 0.62]], accent: [0.92, 0.6, 0.3], bush: [[0.9, 0.84, 0.9], [0.7, 0.64, 0.78], [0.5, 0.46, 0.62]], rock: [[0.80, 0.76, 0.86], [0.42, 0.38, 0.56]], shard: [[0.98, 0.96, 0.995], [0.84, 0.80, 0.94]],
      crust: [[0.98, 0.96, 0.99], [0.90, 0.72, 0.82], [0.97, 0.95, 0.99], [0.46, 0.40, 0.64]] } },
  biomes: [
    // the heart: cream and pale rose nitrogen ice in polygon cells, open (a thicket of penitents and a green wash before)
    B('heart_glacier', 'Pale Heart Glacier', 'flat', ['roseMadder', 'yellowOchre', 'cobaltViolet', 'neutralTint', 'indigo'], 'cadOrange', ['yellowOchre', 'roseMadder', 'neutralTint'], { t: { amp: 8, crack: 0.7, dil: 0.72, patch: [{ c: [0.98, 0.96, 0.98], wl: 19, thr: 0.0, soft: 0.3, amt: 0.7 }, { c: [0.90, 0.74, 0.80], wl: 53, thr: 0.05, soft: 0.4, amt: 0.4 }] }, tall: [0, 0], tallD: 0.012, tallMix: 1, near: { crust: 7, needle: 2, dab: 1 }, small: { shard: 0.05, rock: 0.02 }, phys: { ground: 'ice' } }),
    // (fewer pebble dabs near the eye: with the stones a step darker they stood on the slope as a stipple;
    // fewer boulders, 0.025 from 0.07: they lined the ridge as a row of identical lozenges)
    B('lilac_mountains', 'Lilac Mountains', 'ridged', ['cobaltViolet', 'neutralTint', 'roseMadder', 'indigo', 'davysGrey'], 'lemonYellow', ['cobaltViolet', 'neutralTint', 'roseMadder'], { t: { amp: 240, wl: 800, patch: [{ c: [0.96, 0.94, 0.98], wl: 16, thr: 0.04, soft: 0.3, amt: 0.6 }, { c: [0.80, 0.56, 0.64], wl: 49, thr: 0.02, soft: 0.4, amt: 0.42 }, { c: [0.40, 0.36, 0.58], wl: 6, thr: 0.3, soft: 0.2, amt: 0.35 }] }, tall: [0, 0], tallD: 0.13, tallMix: 1, near: { crust: 4, needle: 1, dab: 1 }, small: { rock: 0.025, shard: 0.03 }, phys: { ground: 'ice' } }),
    // (a few boulders, 0.018 from 0.05, one pebble dab: an even field of soap boulders was the subject of the frame)
    B('long_shadow_plain', 'Long-Shadow Plain', 'rolling', ['neutralTint', 'cobaltViolet', 'roseMadder', 'indigo', 'davysGrey'], 'cerulean', ['neutralTint', 'cobaltViolet', 'roseMadder'], { t: { amp: 60, wl: 500, patch: [{ c: [0.95, 0.93, 0.97], wl: 17, thr: 0.1, soft: 0.3, amt: 0.5 }] }, tall: [0, 0], tallD: 0.08, tallMix: 1, near: { crust: 5, dab: 1 }, small: { rock: 0.018 }, phys: { ground: 'ice' } }),
    // dunes drawn by their slip faces in shadow: lilac-blue toes, grey backs, the crests catching rose;
    // closer set (wl 160 from 220) so more than one crest stands in a view
    B('nitrogen_dunes', 'Nitrogen Dunes', 'dunes', ['cobaltBlue', 'neutralTint', 'roseMadder', 'cobaltViolet', 'davysGrey'], 'quinGold', ['cobaltBlue', 'neutralTint', 'roseMadder'], { t: { amp: 20, wl: 160, dil: 0.5, lee: 0.8 }, small: { shard: 0.03 }, phys: { ground: 'ice' } }),
  ],
};
