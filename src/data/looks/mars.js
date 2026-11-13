// Painted Cosmos: the look of Mars. OWNER: PAINTER (pure data, safe to import in Node).
// The fields are described in common.js (the biome helper B) and src/world/surface.js (the terrain recipes).
import { PIGMENTS, hexToRgb, pig, dilute, mixc, glazec, EARTH_SKY, m3, mkSky, B, P, PM } from './common.js';

export default {
  seed: 'mars-3', seaLevel: null, cloud: 0.12, visibility: [520, 5000], deck: { height: 330 },
  // (PAINTER 14, Mars from orbit: each biome's far wash (t.farC) rust, orange or a dark sepia marking, and a thinner limb
  // (0.64 by the air's depth): the haze laid over the whole disc made it a pale peach ball with cream swirls)
  limb: 0.32,
  sky: mkSky([0.88, 0.72, 0.60], [0.985, 0.90, 0.80], { glaze: [0.74, 0.66, 0.80], light: [1.0, 0.95, 0.86], duskHorizon: [0.72, 0.84, 0.97], duskLight: [0.92, 0.94, 1.0], duskGrade: [0.94, 0.95, 1.0],
    // (PAINTER 19, the blind player's UGLY 9: Mars by night was one blue-grey wash, sky and land one value with maroon
    // blobs in it. A lighter band low in the night sky (it was 0.71, 0.69, 0.71): the land and the groves stand dark against it)
    nightHorizon: [0.90, 0.86, 0.88] }),
  // (PAINTER 19: and a deeper wash over the near land by night, the land within about 20 m easing out by 160 m, so that
  // the near ground, the middle distance and the sky's band are three washes (post.js uNightNear). Mars' own: on Earth it
  // sank the moonlit meadow and the pale beach toward the wood's and the sea's value; a world that says nothing has none)
  nightNear: 0.30,
  flora: {
    tall: [
      { kit: 'broadleaf', scale: 0.5, bark: [[0.42, 0.30, 0.27], [0.24, 0.18, 0.20]], leaf: [[0.96, 0.58, 0.42], [0.90, 0.44, 0.38], [0.64, 0.30, 0.32]], barkP: [0.55, 1, 0.6, 0.5], leafP: [0.85, 0.16, 0.7, 0.3], wind: 0.08, far: [7.5, 6.2, 0], obs: [0.2, 6] },
      { kit: 'spire', scale: 0.7, bark: [[0.86, 0.62, 0.46], [0.52, 0.30, 0.26]], leaf: [[0.86, 0.62, 0.46], [0.70, 0.45, 0.36], [0.52, 0.30, 0.26]], far: [7, 12, 0.85], obs: [1.6, 9] },
    ],
    under: { leaf: [[0.86, 0.74, 0.46], [0.78, 0.58, 0.38], [0.56, 0.36, 0.30]], accent: [0.70, 0.22, 0.30], bush: [[0.80, 0.50, 0.36], [0.66, 0.36, 0.32], [0.42, 0.24, 0.28]], rock: [[0.84, 0.62, 0.48], [0.50, 0.31, 0.27]], shard: [[0.95, 0.96, 0.98], [0.70, 0.78, 0.90]] },
  },
  biomes: [
    B('rust_canyons', 'Rust Canyons', 'canyon', ['burntSienna', 'rawSienna', 'burntUmber', 'cobaltViolet', 'yellowOchre'], 'turquoise', ['rawSienna', 'burntSienna', 'burntUmber'],
      { t: { strata: 1, amp: 200, steps: 3, dil: 0.16, wl: 620, farC: [0.72, 0.40, 0.28, 0.40] }, tall: [1, 1], tallD: 0.05, tallMix: 1, small: { rock: 0.02 }, phys: { ground: 'rock' } }),
    B('dust_dunes', 'Dust-Storm Dunes', 'dunes', ['rawSienna', 'yellowOchre', 'burntSienna', 'roseMadder', 'sepia'], 'cerulean', ['yellowOchre', 'rawSienna', 'burntSienna'],
      { t: { amp: 24, wl: 150, slip: 0.2, ride: 0.22, swell: 22, dil: 0.26, lee: 0.7, farC: [0.88, 0.58, 0.36, 0.45] }, mist: 1.3, hour: 16.2, small: { rock: 0.006 }, phys: { ground: 'sand' } }),
    B('polar_frost', 'Polar Frost Fields', 'terraced', ['davysGrey', 'roseMadder', 'cobaltBlue', 'rawSienna', 'neutralTint'], 'cadOrange', ['cobaltBlue', 'davysGrey', 'roseMadder'],
      { t: { amp: 40, steps: 6, wl: 760, crack: 0.8, frost: 0.85, strata: 0.7, riser: [0.84, 0.93] }, want: { high: 0.05, steep: 0.9, layers: 1.6, perch: 0.6 }, under: { rock: [[0.94, 0.92, 0.93], [0.68, 0.62, 0.70]], shard: [[0.97, 0.96, 0.97], [0.80, 0.76, 0.86]] }, near: { needle: 0, dab: 0 }, small: { shard: 0.012, rock: 0.015 }, phys: { ground: 'ice' } }),
    B('dry_riverbeds', 'Dry Riverbeds', 'riverbed', ['rawSienna', 'burntUmber', 'alizarin', 'yellowOchre', 'sepia'], 'alizarin', ['yellowOchre', 'rawSienna', 'burntUmber'],
      { t: { amp: 26, dil: 0.28, bedW: 10, bedD: 2.8, bedPale: 0.55, farC: [0.46, 0.27, 0.22, 0.70] }, tall: [0, 0], tallD: 0.42, tallMix: 1, near: { dab: 1 }, small: { rock: 0.024, grass: 0.22, bush: 0.02 }, phys: { ground: 'gravel' } }),
  ],
  sites: [[10, 0, 'dry_riverbeds'], [-8, 60, 'rust_canyons'], [25, -60, 'dust_dunes'], [72, 20, 'polar_frost'], [-74, -40, 'polar_frost'], [-30, -20, 'rust_canyons'], [35, 110, 'dust_dunes'], [-20, 140, 'dry_riverbeds'],
    [5, -130, 'rust_canyons'], [-45, 80, 'dust_dunes'], [50, -150, 'dry_riverbeds'], [-10, -80, 'dust_dunes'], [60, 100, 'polar_frost'], [-55, -150, 'polar_frost'], [30, 40, 'rust_canyons'], [-35, 30, 'dry_riverbeds']],
};
