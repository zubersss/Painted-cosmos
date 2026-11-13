// Painted Cosmos: the look of Neptune. OWNER: PAINTER (pure data, safe to import in Node).
// The fields are described in common.js (the biome helper B) and src/world/surface.js (the terrain recipes).
import { PIGMENTS, hexToRgb, pig, dilute, mixc, glazec, EARTH_SKY, m3, mkSky, B, P, PM } from './common.js';

// The ice worlds' hand (art pass, group "ice"; see uranus.js): paper and pale wash for the light,
// the world's own pigments in the middle (ultramarine, cobalt violet, viridian here), one dense
// dark (indigo, Payne's grey) in small places, stones a step below their ground, one small accent.
export default {
  seed: 'neptune-3', seaLevel: 0, cloud: 0.42, visibility: [460, 2800], bands: 0.8, limb: 0.3,
  // (the ground's drifts: toward cobalt violet and toward cerulean; the default warm drift laid
  // ochre stains on the ice spires' snow)
  hue: [[0.97, 0.94, 1.0], [0.90, 0.97, 1.0]],
  // (PAINTER 14: the high white streaks at less than half strength, 0.9 -> 0.4: from orbit they curved round the globe as
  // bright arcs, reflections on a glass ball)
  // (PAINTER 17, the M4 critique's third item: they still did. The belts turned about the body's pole and the first landing
  // is at 72 degrees north: from above it they were rings concentric with the limb, and the sunlit wash a pale lobe inside
  // it. The belts' own axis is tilted 45 degrees (`axis`), so that they cross the disc from above the landing and from the
  // ecliptic alike; six belts with less push at their edges, the dark belt a step lighter (0.27, 0.35, 0.74 before), the
  // streaks at 0.15, and no sunlit wash on the deck (`matte`): no arc is lighter than the wash beside it)
  deck: { height: 310, belts: 6, wobble: 0.11, a: [0.50, 0.62, 0.93], b: [0.33, 0.42, 0.80], streaks: 0.15, wet: 0.6, axis: [-0.707, 0.707, 0], matte: 1 },
  sky: mkSky([0.34, 0.46, 0.84], [0.82, 0.89, 0.98], { glaze: [0.60, 0.64, 0.88], light: [0.95, 0.97, 1.0] }),
  flora: {
    tall: [
      { kit: 'spire', scale: 1.2, bark: [[0.40, 0.42, 0.52], [0.16, 0.18, 0.28]], leaf: [[0.40, 0.42, 0.52], [0.27, 0.29, 0.40], [0.16, 0.18, 0.28]], far: [7, 12, 0.85], obs: [1.8, 13] },
      // kelp: pale violet where the light comes through a frond, indigo at the holdfast, wet
      { kit: 'kelp', scale: 1.1, vary: 1, double: 1, bark: [[0.52, 0.46, 0.82], [0.20, 0.20, 0.46]], leaf: [[0.78, 0.72, 0.94], [0.48, 0.44, 0.80], [0.20, 0.21, 0.48]], leafP: [0.6, 0.1, 1.0, 0.7], wind: 0.5, far: [5, 10, 0.5], obs: [0.4, 9] },
      // the ice spires: paper on the windward faces, a deep cobalt glaze on the lee
      { kit: 'spire', scale: 2.1, slim: 1, bark: [[0.92, 0.96, 0.99], [0.30, 0.42, 0.78]], leaf: [[0.92, 0.96, 0.99], [0.66, 0.76, 0.94], [0.30, 0.42, 0.78]], far: [5, 14, 0.9], obs: [1.4, 13] },
    ],
    under: { leaf: [[0.62, 0.74, 0.70], [0.44, 0.58, 0.66], [0.30, 0.40, 0.58]], accent: [0.92, 0.90, 0.50], bush: [[0.52, 0.60, 0.80], [0.38, 0.44, 0.70], [0.24, 0.28, 0.54]], rock: [[0.50, 0.52, 0.62], [0.22, 0.24, 0.36]], shard: [[0.92, 0.96, 0.99], [0.56, 0.70, 0.92]],
      // the kelp wood's floor: wrack torn off by the gales, sea pinks and pale stars in drifts, lichen
      flowers: [[0.92, 0.54, 0.68], [0.93, 0.91, 0.52], [0.90, 0.94, 0.99]], litter: [[0.48, 0.40, 0.70], [0.32, 0.28, 0.54], [0.60, 0.66, 0.72]], crust: [[0.74, 0.88, 0.82], [0.26, 0.26, 0.48], [0.80, 0.78, 0.92]] },
  },
  biomes: [
    // basalt: the headlands laid in a dense Payne's grey (a pale grey plaster wall before) with
    // their beds showing, so the far headlands go back into the mist in steps instead of standing as paper cut-outs
    B('storm_seas', 'Ultramarine Storm Seas', 'coast', ['ultramarine', 'indigo', 'paynesGrey', 'cerulean', 'neutralTint'], 'mint', ['paynesGrey', 'neutralTint', 'indigo'],
      { t: { cliff: 46, stacks: 0.8, stackCell: 80, strata: 0.55, dil: 0.14,
        // (PAINTER 12, the coordinator's ruling: open water toward the biome's eastern edge, kilometres of it, so the beach
        // faces the storm wind over real fetch; the big island east of the old stand and the reefs round it are under it now)
        open: { a: [-0.643483, 0.016623, -0.765280], b: [-0.859070, 0.008434, -0.511788], r: [560, 800], depth: 34 } }, want: { stand: 2.4 }, liquid: { color: [0.34, 0.42, 0.78], refl: 0.5 }, tall: [0, 0], tallD: 0.30, tallMix: 1, tallWet: 1, near: { crust: 4, dab: 4 }, small: { rock: 0.09 }, phys: { ground: 'rock' } }),
    // the floor: sea-green moss (viridian the middle wash) with violet hollows under the violet kelp; a
    // little less kelp, so less of the floor lies in the kelp's canopy glaze (all one violet before);
    // a few pale violet bushes (a band of saturated ultramarine blobs under the kelp was a large near-black)
    // and a few sea pinks (an even scarlet confetti over the floor)
    B('kelp_forests', 'Blue-Violet Kelp Forests', 'rolling', ['cobaltViolet', 'ultramarine', 'viridian', 'indigo', 'neutralTint'], 'roseMadder', ['cobaltViolet', 'viridian', 'mint'],
      { t: { amp: 40, wl: 420, dil: 0.42, patch: [{ c: [0.30, 0.54, 0.52], wl: 21, thr: -0.08, soft: 0.34, amt: 0.55 }, { c: [0.80, 0.80, 0.90], wl: 8, thr: 0.26, soft: 0.22, amt: 0.5 }] }, tall: [1, 1], tallD: 0.4, tallMix: 1,
        near: { blade: 4, gm: 0.45, fern: 6, flower: 2, litter: 6, crust: 3, dab: 1 }, small: { fern: 0.18, bush: 0.03, flower: 0.04, rock: 0.03 },
        under: { bush: [[0.74, 0.76, 0.88], [0.56, 0.58, 0.78], [0.40, 0.42, 0.62]], rock: [[0.62, 0.66, 0.78], [0.36, 0.40, 0.56]] } }),
    B('ice_spires', 'Wind-Carved Ice Spires', 'spires', ['cerulean', 'cobaltBlue', 'davysGrey', 'mint', 'indigo'], 'cobaltViolet', ['cerulean', 'davysGrey', 'cobaltBlue'],
      { t: { amp: 11, wl: 52, frost: 0.55 }, want: { flora: 1.6, layers: 0.6 }, tall: [2, 2], tallD: 0.34, tallMix: 1, small: { shard: 0.08 }, phys: { ground: 'ice' } }),
    // (aurora_tundra: tried thinner grass, frost polygons and lichen patches; the bared ground showed the
    // kelp wood's indigo wrack as ink blots, then with pale lichens it read as before: reverted to the base)
    B('aurora_tundra', 'Aurora Tundra', 'flat', ['viridian', 'neutralTint', 'cobaltBlue', 'mint', 'indigo'], 'lemonYellow', ['neutralTint', 'viridian', 'cobaltBlue'],
      { t: { amp: 12, ponds: 1, crack: 0.3 }, aurora: 1, liquid: { color: [0.50, 0.62, 0.86], refl: 0.85 }, small: { grass: 0.45, bush: 0.04, rock: 0.03, flower: 0.05 } }),
  ],
};
