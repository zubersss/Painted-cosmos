// Painted Cosmos: the look of Earth. OWNER: PAINTER (pure data, safe to import in Node).
// The fields are described in common.js (the biome helper B) and src/world/surface.js (the terrain recipes).
import { PIGMENTS, hexToRgb, pig, dilute, mixc, glazec, EARTH_SKY, m3, mkSky, B, P, PM } from './common.js';

export default {
  seed: 'earth-7',
  seaLevel: 0,
  cloud: 0.45,
  deck: { height: 560 },
  visibility: [185, 2600],   // metres at ground level, and from high up
  sky: EARTH_SKY,
  flora: {
    tall: [
      { kit: 'broadleaf', scale: 1.25, vary: 1, bark: [[0.975, 0.965, 0.945], [0.27, 0.24, 0.26]], leaf: [[0.76, 0.85, 0.42], [0.58, 0.75, 0.36], [0.31, 0.51, 0.37]], barkP: [0.675, 0, 1.3, 0.25], leafP: [0.85, 0.34, 1.0, 0.28], wind: 0.10, far: [13.5, 11.8, 0], obs: [0.30, 11.5] },
      { kit: 'conifer', bark: [[0.74, 0.54, 0.42], [0.40, 0.28, 0.25]], leaf: [[0.44, 0.62, 0.43], [0.31, 0.51, 0.44], [0.17, 0.28, 0.35]], barkP: [0.50, 1, 0.9, 0.6], leafP: [0.9, 0.18, 1.0, 0.25], wind: 0.05, far: [14.5, 16.5, 0.8], obs: [0.40, 16] },
      { kit: 'broadleaf', scale: 1.25, vary: 1, bark: [[0.975, 0.965, 0.945], [0.27, 0.24, 0.26]], leaf: [[0.96, 0.82, 0.32], [0.93, 0.64, 0.28], [0.72, 0.42, 0.26]], barkP: [0.675, 0, 1.3, 0.25], leafP: [0.85, 0.34, 1.0, 0.28], wind: 0.10, far: [13.5, 11.8, 0], obs: [0.30, 11.5] },
    ],
    under: { leaf: [[0.80, 0.85, 0.38], [0.54, 0.71, 0.31], [0.35, 0.51, 0.31]], accent: [0.86, 0.29, 0.17], bush: [[0.64, 0.77, 0.37], [0.45, 0.63, 0.36], [0.24, 0.41, 0.36]], rock: [[0.78, 0.75, 0.72], [0.42, 0.39, 0.44]],
      // the sward's own washes (src/world/nearground.js): what the flower drifts are of (poppy, ox-eye, buttercup, harebell), what lies under the trees
      flowers: [[0.86, 0.29, 0.17], [0.97, 0.96, 0.90], [0.96, 0.83, 0.28], [0.62, 0.55, 0.88]], litter: [[0.82, 0.64, 0.34], [0.68, 0.43, 0.26], [0.47, 0.31, 0.25]] },
  },
  biomes: [
    B('temperate_forest', 'Temperate Forest', 'forest',
      ['sapGreen', 'hookersGreen', 'quinGold', 'burntSienna', 'rawUmber', 'ultramarine', 'cobaltViolet'], 'cadScarlet',
      ['sapGreen', 'quinGold', 'rawUmber'], { tall: [0, 1], mist: 1.25 }),      // (a little more air than the planet's 185 m: one more band of wood shows before the paper)
    B('autumn_woodland', 'Autumn Woodland', 'forest',
      ['quinGold', 'burntSienna', 'cadOrange', 'rawUmber', 'oliveGreen', 'ultramarine', 'cobaltViolet'], 'alizarin',
      ['quinGold', 'burntSienna', 'rawUmber'], { autumn: 1, tall: [2, 1], liquid: { color: [0.68, 0.78, 0.84], refl: 0.72 },
        under: { leaf: [[0.92, 0.82, 0.40], [0.80, 0.64, 0.34], [0.54, 0.42, 0.30]], bush: [[0.90, 0.66, 0.34], [0.72, 0.46, 0.30], [0.44, 0.30, 0.30]] } }),
    B('alpine_meadow', 'Alpine Meadow and Snow Peaks', 'alpine',
      ['sapGreen', 'lemonYellow', 'cobaltBlue', 'neutralTint', 'rawUmber', 'cobaltViolet'], 'roseMadder',
      ['sapGreen', 'neutralTint', 'cobaltBlue'], { t: { amp: 470, wl: 1000, snow: 185, dil: 0.30, patch: [{ c: [0.50, 0.62, 0.42], wl: 28, thr: -0.05, soft: 0.35, amt: 0.5 }, { c: [0.88, 0.86, 0.52], wl: 11, thr: 0.22, soft: 0.25, amt: 0.45 }] }, mist: 4.5, tall: [1, 1], tallD: 0.22, tallMix: 1, tallMax: 150, small: { grass: 0.4, flower: 0.16, rock: 0.05, bush: 0.02 },
        under: { flowers: [[0.86, 0.52, 0.60], [0.97, 0.96, 0.92], [0.93, 0.86, 0.42]] } }),
    B('sea_coast', 'Sea Cliffs and Coast', 'coast',
      ['cerulean', 'ultramarine', 'viridian', 'yellowOchre', 'rawUmber', 'davysGrey'], 'cadOrange',
      ['yellowOchre', 'oliveGreen', 'davysGrey'], { t: { cliff: 52, stacks: 0.5, strata: 0.5, patch: [{ c: [0.58, 0.64, 0.40], wl: 30, thr: 0.0, soft: 0.35, amt: 0.5 }, { c: [0.74, 0.70, 0.72], wl: 12, thr: 0.25, soft: 0.25, amt: 0.35 }] }, mist: 4, under: { leaf: [[0.88, 0.87, 0.52], [0.70, 0.75, 0.44], [0.46, 0.56, 0.42]] }, liquid: { color: [0.52, 0.72, 0.84], refl: 0.6 }, tall: [1, 0], tallD: 0.05, tallMix: 0.7, small: { grass: 0.45, rock: 0.05, bush: 0.05, flower: 0.03 } }),
    B('desert_canyon', 'Desert Canyon', 'canyon',
      ['burntSienna', 'rawSienna', 'yellowOchre', 'cobaltViolet', 'ultramarine', 'burntUmber'], 'turquoise',
      ['yellowOchre', 'rawSienna', 'burntSienna'], { t: { strata: 1, amp: 210, wl: 600, steps: 3, dil: 0.2 }, mist: 5, small: { rock: 0.035, grass: 0.03, bush: 0.02 }, phys: { ground: 'sand' },
        under: { leaf: [[0.88, 0.84, 0.56], [0.74, 0.72, 0.46], [0.54, 0.54, 0.40]], bush: [[0.78, 0.80, 0.60], [0.60, 0.66, 0.52], [0.42, 0.48, 0.44]], rock: [[0.86, 0.66, 0.52], [0.52, 0.34, 0.32]], accent: [0.30, 0.70, 0.69] } }),
    B('misty_wetland', 'Misty Wetland', 'wetland',
      ['oliveGreen', 'viridian', 'rawUmber', 'paynesGrey', 'yellowOchre', 'davysGrey'], 'lemonYellow',
      ['oliveGreen', 'rawUmber', 'davysGrey'], { mist: 0.45, under: { leaf: [[0.82, 0.82, 0.48], [0.60, 0.63, 0.38], [0.34, 0.40, 0.32]], accent: [0.93, 0.86, 0.40] }, liquid: { color: [0.74, 0.82, 0.84], refl: 0.9 }, tall: [0, 0], tallD: 0.14, tallMix: 1, small: { reed: 0.4, grass: 0.3, fern: 0.12, bush: 0.03 } }),
  ],
  // Hand-placed biome sites: [latitude, longitude, biomeId]. The first one holds the spawn.
  sites: [
    [38, 10, 'temperate_forest'], [46, 62, 'temperate_forest'], [-36, -120, 'temperate_forest'], [30, -150, 'temperate_forest'],
    [52, -42, 'autumn_woodland'], [-46, 30, 'autumn_woodland'], [50, 132, 'autumn_woodland'],
    [66, 16, 'alpine_meadow'], [-62, -60, 'alpine_meadow'], [18, 104, 'alpine_meadow'], [74, -140, 'alpine_meadow'], [-70, 120, 'alpine_meadow'],
    [8, -24, 'sea_coast'], [-10, 150, 'sea_coast'], [34, -84, 'sea_coast'], [-24, -34, 'sea_coast'], [-2, 66, 'sea_coast'], [-40, -170, 'sea_coast'],
    [6, 30, 'desert_canyon'], [-14, -82, 'desert_canyon'], [14, -116, 'desert_canyon'],
    [24, 44, 'misty_wetland'], [-30, 92, 'misty_wetland'], [42, -12, 'misty_wetland'],
  ],
};
