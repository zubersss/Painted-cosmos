// Painted Cosmos: the look of Uranus. OWNER: PAINTER (pure data, safe to import in Node).
// The fields are described in common.js (the biome helper B) and src/world/surface.js (the terrain recipes).
import { PIGMENTS, hexToRgb, pig, dilute, mixc, glazec, EARTH_SKY, m3, mkSky, B, P, PM } from './common.js';

// The hand shared by the ice worlds (art pass, group "ice": Uranus, Neptune, Pluto): most of the
// sheet is paper and pale wash, the ice's light; the middle values are the world's own cool
// pigments (mint and aqua here, ultramarine on Neptune, lilac on Pluto); and every biome keeps ONE
// dense dark, deep teal or indigo, in small places only (a seam, the recess under a lip, the
// hollow of a curl, a pit's throat, the foot of a stone) so the frame has its 3-4 steps.
// Stones sit a step below their ground, never paper-pale. One accent, small. Shadows stay cool.
export default {
  seed: 'uranus-3', seaLevel: null, cloud: 0.4, visibility: [520, 3200],
  // (the ground's two drifts of neighbouring pigment: toward aqua and toward blue; the default
  // warm drift turned the mint ice yellow-green)
  hue: [[0.95, 1.0, 0.96], [0.92, 0.95, 1.0]],
  sky: mkSky([0.60, 0.86, 0.84], [0.93, 0.985, 0.96], { glaze: [0.64, 0.74, 0.88], light: [0.97, 1.0, 0.96] }),
  flora: {
    tall: [
      // (frozen waves: tried an aqua crest and a deep teal hollow, scale 1.2; from the stand the waves are seen
      // along their crests and still read as peaks, and the aqua lost the paper light against the mint sky: reverted)
      { kit: 'wave', scale: 1.0, double: 1, bark: [[0.84, 0.96, 0.94], [0.26, 0.60, 0.68]], leaf: [[0.84, 0.96, 0.94], [0.58, 0.84, 0.84], [0.26, 0.60, 0.68]], far: [9, 9, 0.5], obs: [4.5, 9] },
      // ice needles on the shelves, wind-carved and leaning: the round-bellied cones read as snowy firs
      // (and as cypresses once mint)
      { kit: 'spire', scale: 0.9, vary: 1, slim: 1, bark: [[0.90, 0.98, 0.97], [0.38, 0.66, 0.76]], leaf: [[0.90, 0.98, 0.97], [0.68, 0.88, 0.90], [0.38, 0.66, 0.76]], far: [5, 14, 0.9], obs: [1.4, 9] },
    ],
    under: { leaf: [[0.80, 0.94, 0.86], [0.62, 0.84, 0.80], [0.42, 0.66, 0.70]], accent: [0.90, 0.60, 0.70], bush: [[0.74, 0.92, 0.86], [0.54, 0.78, 0.78], [0.36, 0.58, 0.66]], rock: [[0.78, 0.90, 0.89], [0.34, 0.56, 0.62]], shard: [[0.94, 0.99, 0.98], [0.56, 0.84, 0.86]],
      // frost flowers and plates of rime, the blue ice under them, a deep teal seam
      crust: [[0.98, 0.995, 0.99], [0.62, 0.86, 0.86], [0.97, 0.99, 0.98], [0.26, 0.54, 0.62]] },
  },
  biomes: [
    // (`under`: a dark recess under every shelf's lip; a more ragged lip; the teal seams a step deeper)
    B('ice_shelves', 'Mint Ice Shelves', 'terraced', ['mint', 'turquoise', 'cerulean', 'cobaltBlue', 'indigo', 'davysGrey'], 'roseMadder', ['mint', 'turquoise', 'cerulean'],
      { t: { amp: 150, steps: 5, wl: 800, crack: 0.9, frost: 0.45, riser: [0.90, 0.95], rag: 0.9, under: 1.0, strata: 0.5, patch: [{ c: [0.96, 0.985, 0.98], wl: 15, thr: 0.02, soft: 0.3, amt: 0.6 }, { c: [0.30, 0.60, 0.68], wl: 47, thr: 0.05, soft: 0.35, amt: 0.5 }, { c: [0.56, 0.84, 0.80], wl: 5.5, thr: 0.3, soft: 0.2, amt: 0.4 }] }, tall: [1, 1], tallD: 0.08, tallMix: 1, near: { crust: 7, needle: 5, dab: 2 }, small: { shard: 0.18, rock: 0.06 }, phys: { ground: 'ice' } }),
    B('frozen_waves', 'Frozen-Wave Forest', 'dunes', ['turquoise', 'viridian', 'cobaltBlue', 'mint', 'indigo'], 'lemonYellow', ['turquoise', 'mint', 'cobaltBlue'],
      { t: { amp: 16, wl: 90, slip: 0.2, lee: 0.6, swell: 14, ride: 0.3 }, want: { onLip: 0, along: 0, flora: 1.6, perch: 0.5 }, tall: [0, 0], tallD: 0.34, tallMix: 1, near: { crust: 5 }, small: { shard: 0.15 }, phys: { ground: 'ice' } }),
    // pearl: mint, lilac and rose laid wet into one another under the fog; the stones loom out of it darker
    B('pearl_fog', 'Pearl Fog Flats', 'flat', ['mint', 'roseMadder', 'cobaltViolet', 'davysGrey', 'neutralTint'], 'cerulean', ['mint', 'roseMadder', 'cobaltViolet'],
      { t: { amp: 6, dil: 0.55, patch: [{ c: [0.97, 0.965, 0.975], wl: 22, thr: 0.0, soft: 0.35, amt: 0.55 }, { c: [0.86, 0.95, 0.92], wl: 70, thr: 0.05, soft: 0.4, amt: 0.45 }] }, mist: 0.10, small: { shard: 0.10, rock: 0.05 },
        under: { rock: [[0.82, 0.82, 0.88], [0.48, 0.50, 0.62]], shard: [[0.96, 0.95, 0.98], [0.70, 0.70, 0.86]] }, phys: { ground: 'ice' } }),
    // the pit's throat is the dark (indigo), its walls viridian, the plain mint ice; the pool a
    // reserved light of pale teal (no `glow`: that is the lava path, scarlet banks and paper-yellow streaks);
    // the wall a quiet slope with a few stones (rock 0.015, shard 0.04, one pebble dab: the dark stone
    // colour feeds the pebble dabs, which stood over the whole wall as an even polka-dot stipple)
    B('teal_sinkholes', 'Glowing Teal Sinkholes', 'sinkholes', ['viridian', 'turquoise', 'indigo', 'mint', 'paynesGrey'], 'lemonYellow', ['indigo', 'viridian', 'mint'],
      { t: { amp: 40 }, want: { perch: -2.5, below: 0.2, bowl: 0, steep: 1.8, liquid: 2.2 }, liquid: { color: [0.50, 0.90, 0.84], refl: 0.12 }, small: { shard: 0.04, rock: 0.015, bush: 0.02 }, near: { dab: 1 },
        under: { rock: [[0.70, 0.84, 0.84], [0.24, 0.44, 0.52]] } }),
  ],
};
