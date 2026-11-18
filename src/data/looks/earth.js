// Painted Cosmos: the look of Earth. OWNER: PAINTER (pure data, safe to import in Node).
// The fields are described in common.js (the biome helper B) and src/world/surface.js (the terrain recipes).
import { PIGMENTS, hexToRgb, pig, dilute, mixc, glazec, EARTH_SKY, m3, mkSky, B, P, PM } from './common.js';

// The hand shared with the Moon (art pass, group "earth"): boulders a step below their ground's
// value and never paper-pale, few enough to be accents rather than a scatter; the ground's own
// handwriting laid as patches (t.patch) where one wash would read flat; birches a stand of all
// ages (vary) so their trunks never stand as one fence. obs 0.34 is the drawn trunk's flared base
// (florakit birchGeometry: 0.225 x 1.5), so the youngest birch still has a trunk to bump into.
export default {
  seed: 'earth-7',
  seaLevel: 0,
  cloud: 0.45,
  deck: { height: 560 },
  visibility: [185, 2600],   // metres at ground level, and from high up
  sky: EARTH_SKY,
  // (the oil look: Earth takes the look's golden hours whole: its wood is the owner's reference clip's)
  // (and in the oil look the explorer lands in the autumn wood: the first site and the first autumn site change places)
  // (rivers: the oil look's river system, src/world/surface.js _riversOil: channels that split and rejoin, pools, side streams)
  oil: { gold: 1, sites: { 0: 'autumn_woodland', 4: 'temperate_forest' }, rivers: 1, riverAt: [53.82, -8.34, -2.78], leaves: 0.5 },
  flora: {
    tall: [
      { kit: 'broadleaf', scale: 1.25, vary: 1, bark: [[0.975, 0.965, 0.945], [0.27, 0.24, 0.26]], leaf: [[0.76, 0.85, 0.42], [0.58, 0.75, 0.36], [0.40, 0.58, 0.42]], barkP: [0.675, 0, 1.3, 0.25], leafP: [0.85, 0.34, 1.0, 0.28], wind: 0.10, far: [13.5, 11.8, 0], obs: [0.34, 11.5],
        // (the oil look: the green wood's tree as the autumn wood's, in leaf: slender, half of them dark-barked)
        oil: { slender: 1, double: 1, leaf: [[0.80, 0.92, 0.36], [0.54, 0.80, 0.30], [0.30, 0.58, 0.30]], leafP: [0.9, 0.52, 1.0, 0.28], dark: [0.5, [0.50, 0.38, 0.36], [0.36, 0.26, 0.30]] } },
      { kit: 'conifer', bark: [[0.74, 0.54, 0.42], [0.40, 0.28, 0.25]], leaf: [[0.44, 0.62, 0.43], [0.31, 0.51, 0.44], [0.24, 0.34, 0.42]], barkP: [0.50, 1, 0.9, 0.6], leafP: [0.9, 0.18, 1.0, 0.25], wind: 0.05, far: [14.5, 16.5, 0.8], obs: [0.40, 16] ,
        // (the oil look, docs/HANDOVER.md 4a on r2: a tall bare stem, dark and violet, under a high narrow crown)
        oil: { slender: 1, double: 1, bark: [[0.50, 0.38, 0.36], [0.36, 0.26, 0.30]] } },
      { kit: 'broadleaf', scale: 1.25, vary: 1, bark: [[0.975, 0.965, 0.945], [0.27, 0.24, 0.26]], leaf: [[0.96, 0.82, 0.32], [0.93, 0.64, 0.28], [0.80, 0.54, 0.34]], barkP: [0.675, 0, 1.3, 0.25], leafP: [0.85, 0.34, 1.0, 0.28], wind: 0.10, far: [13.5, 11.8, 0], obs: [0.34, 11.5] ,
        // (the oil look: slender, its crown high and thin; seven in ten are dark-barked, the rest stay birches)
        // (fam: each tree keeps to its own part of yellow, orange and this red: the owner's references of 2026-11-16)
        oil: { slender: 1, double: 1, leaf: [[0.98, 0.88, 0.26], [0.96, 0.62, 0.20], [0.80, 0.40, 0.22]], fam: [0.86, 0.27, 0.16, 1], farD: [15.5, 12.4, 0], leafP: [0.9, 0.52, 1.0, 0.28], dark: [0.7, [0.50, 0.38, 0.36], [0.36, 0.26, 0.30]] } },
    ],
    // (2026-11-18, the owner: "Give the trees more branches as well and more versions of them ... the Christmas tree
    // looking ones".) FOUR KINDS THAT ONLY THE OIL LOOK SEES (data/mode.js appends `tallOil` to `tall` and a biome
    // names which of them it wants). Each is built in its own file under world/kits/ with real limbs that fork.
    // The dark ones matter as much as the bright: in the owner's twenty paintings the deep conifer green is a
    // twentieth of all the paint at brightness 0.26, and it is what makes the oranges sing. In the game's own
    // aerial still it was 0.6 per cent, because a conifer here was one tree in thirty.
    tallOil: [
      // 0: THE BROAD MAPLE, the tree their autumn references are mostly made of. The autumn wood's own leaf washes,
      //    which measured close to the references already (gold 0.69 against their 0.68, amber 0.71 against 0.72).
      { kit: 'maple', scale: 1.2, vary: 1, bark: [[0.52, 0.40, 0.36], [0.30, 0.22, 0.24]], leaf: [[0.98, 0.88, 0.26], [0.96, 0.62, 0.20], [0.80, 0.40, 0.22]],
        barkP: [0.62, 0, 1.2, 0.3], leafP: [0.9, 0.52, 1.0, 0.28], wind: 0.11, far: [13.5, 11.8, 0], obs: [0.42, 11.5],
        fam: [0.86, 0.27, 0.16, 1], farD: [15.5, 12.4, 0] },
      // 1: THE SPRUCE - the "Christmas tree". Its needles are set at the references' own deep green (0.31 saturation,
      //    0.26 brightness), not the bright green the old conifer wore at 0.62.
      { kit: 'spruce', scale: 1.1, bark: [[0.40, 0.30, 0.28], [0.24, 0.18, 0.19]], leaf: [[0.30, 0.38, 0.26], [0.22, 0.30, 0.21], [0.15, 0.21, 0.17]],
        barkP: [0.50, 1, 0.9, 0.6], leafP: [0.9, 0.18, 1.0, 0.25], wind: 0.05, far: [14.5, 16.5, 0.8], obs: [0.40, 16] },
      // 2: THE ASPEN STAND - pale verticals in groups; 4 per cent of all the paint in their references is pale trunk.
      { kit: 'aspen', scale: 1.15, vary: 1, bark: [[0.90, 0.89, 0.86], [0.34, 0.31, 0.30]], leaf: [[0.96, 0.86, 0.30], [0.90, 0.68, 0.24], [0.68, 0.46, 0.26]],
        barkP: [0.70, 0, 1.3, 0.22], leafP: [0.9, 0.46, 1.0, 0.26], wind: 0.14, far: [13.0, 11.0, 0], obs: [0.30, 11] },
      // 3: THE TALL PINE - bare below two thirds of its height, so the eye sees through the wood.
      { kit: 'tallpine', scale: 1.2, bark: [[0.46, 0.33, 0.28], [0.26, 0.19, 0.18]], leaf: [[0.34, 0.42, 0.28], [0.25, 0.33, 0.23], [0.17, 0.23, 0.18]],
        barkP: [0.52, 1, 0.95, 0.55], leafP: [0.9, 0.18, 1.0, 0.25], wind: 0.06, far: [15.5, 17.5, 0.8], obs: [0.38, 17] },
    ],
    under: { leaf: [[0.80, 0.85, 0.38], [0.54, 0.71, 0.31], [0.35, 0.51, 0.31]], accent: [0.86, 0.29, 0.17], bush: [[0.64, 0.77, 0.37], [0.45, 0.63, 0.36], [0.24, 0.41, 0.36]], rock: [[0.78, 0.75, 0.72], [0.42, 0.39, 0.44]],
      // the sward's own washes (src/world/nearground.js): what the flower drifts are of (poppy, ox-eye, buttercup, harebell), what lies under the trees
      flowers: [[0.86, 0.29, 0.17], [0.97, 0.96, 0.90], [0.96, 0.83, 0.28], [0.62, 0.55, 0.88]], litter: [[0.82, 0.64, 0.34], [0.68, 0.43, 0.26], [0.47, 0.31, 0.25]] },
  },
  biomes: [
    B('temperate_forest', 'Temperate Forest', 'forest',
      ['sapGreen', 'hookersGreen', 'quinGold', 'burntSienna', 'rawUmber', 'ultramarine', 'cobaltViolet'], 'cadScarlet',
      ['sapGreen', 'quinGold', 'rawUmber'], { tall: [0, 1], mist: 0.72,
        // (the oil look: a green wood in the autumn wood's hand: a floor of moss and grass greens over warm earth with
        // last year's leaves in it, the canopy's greens pure; one tree in six a conifer)
        oil: { pal: { low: [0.56, 0.46, 0.34], mid: [0.60, 0.52, 0.34], high: [0.58, 0.50, 0.36], litter: [0.80, 0.70, 0.36], canopyA: [0.74, 0.88, 0.36], canopyB: [0.46, 0.74, 0.32],
          grassLight: [0.82, 0.90, 0.38], grassMid: [0.58, 0.78, 0.34], moss: [0.44, 0.64, 0.32], mud: [0.48, 0.40, 0.32] }, tallMix: 0.84 } }),      // (less air than the planet's 185 m: the back of the wood steps toward the paper in bands; PAINTER 14: 0.95 -> 0.72, the wood's depths and the sky over it go paler)
    B('autumn_woodland', 'Autumn Woodland', 'forest',
      ['quinGold', 'burntSienna', 'cadOrange', 'rawUmber', 'oliveGreen', 'ultramarine', 'cobaltViolet'], 'alizarin',
      ['quinGold', 'burntSienna', 'rawUmber'], { autumn: 1, tall: [2, 1], liquid: { color: [0.68, 0.78, 0.84], refl: 0.72 },
        under: { leaf: [[0.92, 0.82, 0.40], [0.80, 0.64, 0.34], [0.66, 0.54, 0.38]], bush: [[0.90, 0.66, 0.34], [0.72, 0.46, 0.30], [0.58, 0.44, 0.36]] },
        // (the oil look, after the owner's reference clip: a floor of yellow and orange leaves on dark warm earth, the
        // canopy's yellows and oranges pure; washes still, which the shaders lay as paint)
        // (2026-11-16, after the owner's references of autumn woods: the floor is GRASS, green in the stands and bright
        // yellow-green in the glades, with the leaves strewn on it; wider glades; conifers in groups among the broadleaves)
        oil: { pal: { low: [0.58, 0.42, 0.34], mid: [0.66, 0.48, 0.34], high: [0.62, 0.46, 0.36], litter: [0.96, 0.78, 0.30], canopyA: [0.98, 0.86, 0.30], canopyB: [0.94, 0.62, 0.24],
          grassLight: [0.84, 0.87, 0.32], grassMid: [0.64, 0.75, 0.30], moss: [0.44, 0.62, 0.30], mud: [0.56, 0.50, 0.34] }, glade: [0.10, 0.46],
          // (?floor=calm, 2026-11-17: the glades' grass was a loud lemon in the owner's recording of v8.1. A calmer floor to
          // set beside it: the sunlit grass an olive gold, the tufts with it. Not the look until the owner picks it.)
          palCalm: { grassLight: [0.78, 0.76, 0.38], grassMid: [0.58, 0.66, 0.32] },
          overCalm: { under: { leaf: [[0.80, 0.80, 0.40], [0.56, 0.68, 0.33], [0.33, 0.50, 0.28]], bush: [[0.97, 0.88, 0.36], [0.95, 0.68, 0.28], [0.84, 0.44, 0.26]] } },
          // (clearer air than the planet's 185 m: the trees a stone's throw off keep their colour, the far ones go pale)
          // (2026-11-18: all four, not two. The placer could only ever stand two kinds in a wood, so the aspen and the
          //  tall pine were built at every start-up and drawn nowhere; floraplace.js now lets the grove field choose
          //  which PAIR stands where. The maple and the spruce keep about three quarters of the wood; the rest is
          //  stands of aspen and tall pine, which is what the owner asked for -- "as many as you want".)
          over: { mist: 1.4, tallOil: [0, 1, 2, 3] },      // (maple, spruce, aspen, tall pine: see flora.tallOil above)
          // (the clip's wood is broadleaves in autumn leaf with a white birch here and there: nearly nine trees in ten;
          // its tufts and small plants are yellow-green in the sun and deep green in the shade)
          // (tallMix over 1: the groves of conifers go too; a conifer is one tree in thirty. With 0.88 whole stands were
          // still conifers, and three of the wood's stills had no autumn leaf overhead at all: the critic)
          // (2026-11-18: was [1.5, 1.05], which put a conifer at one tree in thirty - and the rendered still then
          //  measured conifers at 0.6 per cent of the aerial picture against 5.1 in the owner's paintings. A plain
          //  0.85 makes about one tree in six a spruce everywhere, and floraplace.js's own grove field still swings
          //  that from none to most of a stand, so there are groves of dark among the orange as the references show.)
          tallMix: 0.85, under: { leaf: [[0.84, 0.90, 0.34], [0.58, 0.78, 0.30], [0.34, 0.54, 0.28]], bush: [[0.97, 0.88, 0.36], [0.95, 0.68, 0.28], [0.84, 0.44, 0.26]] } } }),
    B('alpine_meadow', 'Alpine Meadow and Snow Peaks', 'alpine',
      ['sapGreen', 'lemonYellow', 'cobaltBlue', 'neutralTint', 'rawUmber', 'cobaltViolet'], 'roseMadder',
      ['sapGreen', 'neutralTint', 'cobaltBlue'], { t: { amp: 470, wl: 1000, snow: 185, dil: 0.24, patch: [{ c: [0.40, 0.54, 0.36], wl: 26, thr: 0.0, soft: 0.3, amt: 0.65 }, { c: [0.92, 0.88, 0.50], wl: 10, thr: 0.2, soft: 0.25, amt: 0.5 }] }, mist: 4.5, tall: [1, 1], tallD: 0.22, tallMix: 1, tallMax: 150, small: { grass: 0.4, flower: 0.16, rock: 0.05, bush: 0.045 },
        under: { rock: [[0.60, 0.61, 0.66], [0.34, 0.35, 0.44]] } }),     // (granite grey with a violet shadow, a step below the turf, in the meadow's cool palette)
    B('sea_coast', 'Sea Cliffs and Coast', 'coast',
      ['cerulean', 'ultramarine', 'viridian', 'yellowOchre', 'rawUmber', 'davysGrey'], 'cadOrange',
      ['yellowOchre', 'oliveGreen', 'davysGrey'], { t: { cliff: 52, stacks: 0.5, strata: 0.5 }, mist: 4, under: { leaf: [[0.88, 0.87, 0.52], [0.70, 0.75, 0.44], [0.46, 0.56, 0.42]] }, liquid: { color: [0.52, 0.72, 0.84], refl: 0.6 }, tall: [1, 0], tallD: 0.10, tallMix: 0.7, small: { grass: 0.45, rock: 0.05, bush: 0.05, flower: 0.03 } }),
    B('desert_canyon', 'Desert Canyon', 'canyon',
      ['burntSienna', 'rawSienna', 'yellowOchre', 'cobaltViolet', 'ultramarine', 'burntUmber'], 'turquoise',
      ['yellowOchre', 'rawSienna', 'burntSienna'], { t: { strata: 1, amp: 210, wl: 600, steps: 3, dil: 0.2 }, mist: 5, small: { rock: 0.035, grass: 0.03, bush: 0.008 }, phys: { ground: 'sand' },
        under: { leaf: [[0.88, 0.84, 0.56], [0.74, 0.72, 0.46], [0.54, 0.54, 0.40]], bush: [[0.86, 0.84, 0.66], [0.74, 0.72, 0.56], [0.60, 0.58, 0.48]], rock: [[0.86, 0.66, 0.52], [0.52, 0.34, 0.32]], accent: [0.30, 0.70, 0.69] } }),
    // (PAINTER 14: the reeds stand in beds with mud and water between them (floraplace.js), their feet in a deeper olive: the
    // bed's shade is the frame's one dark; an even comb of straw strokes with no dark was ARTPASS weakest 1)
    B('misty_wetland', 'Misty Wetland', 'wetland',
      ['oliveGreen', 'viridian', 'rawUmber', 'paynesGrey', 'yellowOchre', 'davysGrey'], 'lemonYellow',
      ['oliveGreen', 'rawUmber', 'davysGrey'], { mist: 0.45, under: { leaf: [[0.82, 0.82, 0.46], [0.64, 0.66, 0.38], [0.34, 0.38, 0.30]], accent: [0.93, 0.86, 0.40] }, liquid: { color: [0.74, 0.82, 0.84], refl: 0.9 }, tall: [0, 0], tallD: 0.08, tallMix: 1, small: { reed: 0.5, grass: 0.3, fern: 0.12, bush: 0.03 } }),
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
