// Painted Cosmos: the look of Earth. OWNER: PAINTER (pure data, safe to import in Node).
// The fields are described in common.js (the biome helper B) and src/world/surface.js (the terrain recipes).
import { PIGMENTS, hexToRgb, pig, dilute, mixc, glazec, EARTH_SKY, m3, mkSky, B, P, PM } from './common.js';

// The hand shared with the Moon (art pass, group "earth"): boulders a step below their ground's
// value and never paper-pale, few enough to be accents rather than a scatter; the ground's own
// handwriting laid as patches (t.patch) where one wash would read flat; birches a stand of all
// ages (vary) so their trunks never stand as one fence. obs 0.34 is the drawn trunk's flared base
// (florakit birchGeometry: 0.225 x 1.5), so the youngest birch still has a trunk to bump into.
// The animals' coats (`fauna` below) are mixed from their own biome's NAMED PIGMENTS and never from a loose
// colour, so an animal can never wear a colour that is not in its wood. Three shorthands, so that a row of
// colour reads as a row and not as a paragraph:
const M = (a, b, t) => mixc(pig(a), pig(b), t);     // a mixture of two of the biome's pigments
const D = (a, t) => dilute(pig(a), t);              // one of them thinned toward the paper (t = 1 is bare paper)
const K = (a, b) => glazec(pig(a), pig(b));         // two washes laid one over the other, which is how this game
                                                    // makes a dark: nothing is ever darker than the paint allows
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
        oil: { slender: 1, double: 1, leaf: [[0.80, 0.92, 0.36], [0.54, 0.80, 0.30], [0.30, 0.58, 0.30]],
          leafSum: [[0.80, 0.92, 0.36], [0.54, 0.80, 0.30], [0.30, 0.58, 0.30]], leafAut: [[0.97, 0.86, 0.28], [0.93, 0.62, 0.22], [0.74, 0.42, 0.24]],
          leafP: [0.9, 0.52, 1.0, 0.28], dark: [0.5, [0.50, 0.38, 0.36], [0.36, 0.26, 0.30]] } },
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
        leafSum: [[0.80, 0.92, 0.36], [0.54, 0.80, 0.30], [0.30, 0.58, 0.30]], leafAut: [[0.98, 0.88, 0.26], [0.96, 0.62, 0.20], [0.80, 0.40, 0.22]],
        barkP: [0.62, 0, 1.2, 0.3], leafP: [0.9, 0.52, 1.0, 0.28], wind: 0.11, far: [13.5, 11.8, 0], obs: [0.42, 11.5],
        fam: [0.86, 0.27, 0.16, 1], farD: [15.5, 12.4, 0] },
      // 1: THE SPRUCE - the "Christmas tree". Its needles are set at the references' own deep green (0.31 saturation,
      //    0.26 brightness), not the bright green the old conifer wore at 0.62.
      { kit: 'spruce', scale: 1.1, bark: [[0.40, 0.30, 0.28], [0.24, 0.18, 0.19]], leaf: [[0.30, 0.38, 0.26], [0.22, 0.30, 0.21], [0.15, 0.21, 0.17]],
        barkP: [0.50, 1, 0.9, 0.6], leafP: [0.9, 0.18, 1.0, 0.25], wind: 0.05, far: [14.5, 16.5, 0.8], obs: [0.40, 16] },
      // 2: THE ASPEN STAND - pale verticals in groups; 4 per cent of all the paint in their references is pale trunk.
      { kit: 'aspen', scale: 1.15, vary: 1, bark: [[0.90, 0.89, 0.86], [0.34, 0.31, 0.30]], leaf: [[0.96, 0.86, 0.30], [0.90, 0.68, 0.24], [0.68, 0.46, 0.26]],
        leafSum: [[0.82, 0.92, 0.40], [0.56, 0.80, 0.34], [0.34, 0.58, 0.32]], leafAut: [[0.96, 0.86, 0.30], [0.90, 0.68, 0.24], [0.68, 0.46, 0.26]],
        barkP: [0.70, 0, 1.3, 0.22], leafP: [0.9, 0.46, 1.0, 0.26], wind: 0.14, far: [13.0, 11.0, 0], obs: [0.30, 11] },
      // 3: THE TALL PINE - bare below two thirds of its height, so the eye sees through the wood.
      { kit: 'tallpine', scale: 1.2, bark: [[0.46, 0.33, 0.28], [0.26, 0.19, 0.18]], leaf: [[0.34, 0.42, 0.28], [0.25, 0.33, 0.23], [0.17, 0.23, 0.18]],
        barkP: [0.52, 1, 0.95, 0.55], leafP: [0.9, 0.18, 1.0, 0.25], wind: 0.06, far: [15.5, 17.5, 0.8], obs: [0.38, 17] },
      // ---- THE SIX THE OWNER CHOSE from the sheet of ten (2026-11-19), kits/grove.js. Each carries BOTH ITS
      //      DRESSES: `leafSum` what it wears in summer, `leafAut` in autumn, mixed at data/season.js SEASON.t.
      //      (A tree given neither -- the spruce, the pines -- keeps one colour and does not turn, as a conifer
      //      does not.) The autumn washes are the autumn wood's own, which measured close to the owner's
      //      references already; the summer ones are the green wood's, so the two ends are colours already judged.
      // 4: THE ROUND MAPLE - a short trunk under a deep round head; the common tree of the wood.
      { kit: 'roundmaple', scale: 1.2, vary: 1, bark: [[0.52, 0.40, 0.36], [0.30, 0.22, 0.24]],
        leaf: [[0.98, 0.88, 0.26], [0.96, 0.62, 0.20], [0.80, 0.40, 0.22]],
        leafSum: [[0.80, 0.92, 0.36], [0.54, 0.80, 0.30], [0.30, 0.58, 0.30]],
        leafAut: [[0.98, 0.88, 0.26], [0.96, 0.62, 0.20], [0.80, 0.40, 0.22]],
        barkP: [0.62, 0, 1.2, 0.3], leafP: [0.9, 0.52, 1.0, 0.28], wind: 0.11, far: [11.7, 7.8, 0], obs: [0.42, 7.8],
        fam: [0.86, 0.27, 0.16, 1], farD: [11.7, 7.8, 0] },
      // 5: THE TALL POPLAR - a column: one stem the whole height with short branches all up it.
      { kit: 'poplar', scale: 1.1, vary: 1, bark: [[0.72, 0.70, 0.62], [0.32, 0.29, 0.28]],
        leaf: [[0.94, 0.86, 0.30], [0.88, 0.66, 0.24], [0.66, 0.46, 0.26]],
        leafSum: [[0.78, 0.90, 0.38], [0.52, 0.76, 0.32], [0.32, 0.56, 0.32]],
        leafAut: [[0.94, 0.86, 0.30], [0.88, 0.66, 0.24], [0.66, 0.46, 0.26]],
        barkP: [0.66, 0, 1.25, 0.24], leafP: [0.9, 0.46, 1.0, 0.26], wind: 0.15, far: [7.3, 15.5, 0.30], obs: [0.22, 15.5] },
      // 6: THE GREAT OAK - a heavy trunk, low boughs, the widest crown in the wood. Planted sparingly: it is a
      //    tree you come upon, and at 17 m across it holds a clearing on its own.
      { kit: 'oak', scale: 1.15, vary: 1, bark: [[0.48, 0.38, 0.33], [0.26, 0.20, 0.20]],
        leaf: [[0.92, 0.78, 0.28], [0.86, 0.56, 0.22], [0.64, 0.38, 0.22]],
        leafSum: [[0.70, 0.86, 0.34], [0.46, 0.72, 0.30], [0.26, 0.50, 0.30]],
        leafAut: [[0.92, 0.78, 0.28], [0.86, 0.56, 0.22], [0.64, 0.38, 0.22]],
        barkP: [0.58, 1, 1.15, 0.34], leafP: [0.9, 0.48, 1.0, 0.28], wind: 0.08, far: [18.1, 9.9, 0], obs: [0.50, 9.9] },
      // 7: THE SLENDER BIRCH - a pale thin trunk and a haze of fine twigs, in groups.
      { kit: 'birch', scale: 1.15, vary: 1, bark: [[0.93, 0.92, 0.89], [0.30, 0.28, 0.28]],
        leaf: [[0.97, 0.90, 0.32], [0.92, 0.70, 0.26], [0.70, 0.48, 0.26]],
        leafSum: [[0.82, 0.92, 0.40], [0.56, 0.80, 0.34], [0.34, 0.58, 0.32]],
        leafAut: [[0.97, 0.90, 0.32], [0.92, 0.70, 0.26], [0.70, 0.48, 0.26]],
        barkP: [0.72, 0, 1.3, 0.20], leafP: [0.9, 0.46, 1.0, 0.26], wind: 0.15, far: [12.3, 9.9, 0], obs: [0.30, 9.9] },
      // 8: THE WEEPING WILLOW - curtains of hanging leaf. It costs about half as much again as the others to draw,
      //    so it is planted only where there is water, which is also the only place it belongs.
      { kit: 'willow', scale: 1.1, vary: 1, bark: [[0.50, 0.42, 0.34], [0.28, 0.23, 0.21]],
        leaf: [[0.92, 0.86, 0.36], [0.84, 0.66, 0.28], [0.60, 0.46, 0.28]],
        leafSum: [[0.74, 0.88, 0.42], [0.50, 0.74, 0.36], [0.30, 0.54, 0.34]],
        leafAut: [[0.92, 0.86, 0.36], [0.84, 0.66, 0.28], [0.60, 0.46, 0.28]],
        barkP: [0.60, 0, 1.2, 0.28], leafP: [0.9, 0.44, 1.0, 0.28], wind: 0.17, far: [14.7, 10.3, 0], obs: [0.44, 10.3] },
      // 9: THE YOUNG SAPLING - five metres, three limbs; what fills the gaps between the grown trees.
      { kit: 'sapling', scale: 1.1, vary: 1, bark: [[0.56, 0.44, 0.38], [0.30, 0.23, 0.24]],
        leaf: [[0.98, 0.86, 0.30], [0.94, 0.64, 0.22], [0.74, 0.42, 0.24]],
        leafSum: [[0.84, 0.94, 0.40], [0.58, 0.82, 0.34], [0.34, 0.60, 0.34]],
        leafAut: [[0.98, 0.86, 0.30], [0.94, 0.64, 0.22], [0.74, 0.42, 0.24]],
        barkP: [0.64, 0, 1.2, 0.26], leafP: [0.9, 0.50, 1.0, 0.28], wind: 0.20, far: [6.4, 4.9, 0], obs: [0.20, 4.9] },
    ],
    under: { leaf: [[0.80, 0.85, 0.38], [0.54, 0.71, 0.31], [0.35, 0.51, 0.31]], accent: [0.86, 0.29, 0.17], bush: [[0.64, 0.77, 0.37], [0.45, 0.63, 0.36], [0.24, 0.41, 0.36]], rock: [[0.78, 0.75, 0.72], [0.42, 0.39, 0.44]],
      // the floor turns with the trees above it, or a green sward sits under a gold wood
      leafSum: [[0.80, 0.85, 0.38], [0.54, 0.71, 0.31], [0.35, 0.51, 0.31]], leafAut: [[0.92, 0.82, 0.40], [0.80, 0.64, 0.34], [0.66, 0.54, 0.38]],
      bushSum: [[0.64, 0.77, 0.37], [0.45, 0.63, 0.36], [0.24, 0.41, 0.36]], bushAut: [[0.90, 0.66, 0.34], [0.72, 0.46, 0.30], [0.58, 0.44, 0.36]],
      // the sward's own washes (src/world/nearground.js): what the flower drifts are of (poppy, ox-eye, buttercup, harebell), what lies under the trees
      flowers: [[0.86, 0.29, 0.17], [0.97, 0.96, 0.90], [0.96, 0.83, 0.28], [0.62, 0.55, 0.88]], litter: [[0.82, 0.64, 0.34], [0.68, 0.43, 0.26], [0.47, 0.31, 0.25]] },
  },
  // ==========================================================================================================
  // THE ANIMALS OF EARTH. (The owner, 2026-11-23: "at least 25 different animals in every biome ... in this
  // game's own hand, animated, with routines, hunting and hunted, fish and birds. focus on the artstyle and
  // animation for these make sure its really good".)
  //
  // FORTY KINDS, NOT A THOUSAND, and said plainly because the owner should hear it from the work and not find
  // it out: twenty-five in every one of the game's forty-two biomes is 1,050 animals to build, to colour and
  // to LOOK AT, and that is a year of sessions, not a task. What is here instead is forty kinds for Earth,
  // arranged so that ELEVEN OF THEM LIVE IN THREE BIOMES OR MORE (the fox, the raven, the hare, the eagle, the
  // owl, the swallow, the otter, the trout, the heron, the midges, the starlings). That is the whole reason
  // the owner's number is reachable at all:
  //     the green wood and the gold wood .. 20 kinds each (they are one wood in two dresses, so one list)
  //     the misty wetland, the sea coast .. 15 kinds each
  //     the alpine meadow ................. 13 kinds
  //     the desert canyon ................. 9 kinds, and that is the honest number. It has no trees at all and
  //                                         bushes at 0.008 (below): there is next to nothing there to eat.
  //                                         Water in the canyon -- a seep, a pour-over pool, a fall in a side
  //                                         canyon -- would honestly add three or four more.
  // Nothing in the list is there to pad it: every kind does something nothing else in the list does.
  //
  // HOW TO CHANGE ONE. These rows are the thing the owner will most want to change, so: one row is one kind,
  // every length is in metres, every weight in kilograms, and a COAT IS MIXED FROM ITS OWN BIOME'S NAMED
  // PIGMENTS (the seven at the head of each biome further down) and never from a loose colour -- so an animal
  // can never wear a colour that is not in its wood. HOW MANY of each stand in a place is deliberately not
  // here: it is that biome's own `life`, in groups per hectare, beside its plants.
  //
  // NOTHING IS KEYED BY POSITION. `order` is the one place these rows are put in a line, and common.js hands
  // out the index from it. The warning is at the head of common.js and it was earned in this very file: the
  // trees were named by index, the placer could only ever stand two of them, and two whole species were built
  // at every start-up and drawn nowhere for a fortnight (see the note at the autumn wood below).
  //
  // WHAT A ROW SAYS
  //   plan   which body it is built from: 'walker' (four legs), 'bird', 'fish', 'swarm' (one mark a body, the
  //          falling leaves' own path). ONLY THE WALKER IS BUILT TODAY (src/world/beastkit.js SHAPES), so the
  //          heron's, the trout's and the swarms' proportions below are a proposal and not a drawing.
  //   guild  one of the eight the world's ledger counts (common.js FAUNA_GUILDS)
  //   stage  which ?beasts=N lets it in (src/data/mode.js): 1 the five, 2 the wood and the water, 3 the rest
  //   in     which of Earth's six biomes it belongs to, in plain words (that biome's `life` says how many)
  //  -- the body: metres, and shares of other lengths (src/world/beastkit.js reads exactly these names) --
  //   high  shoulder height (a bird: standing height; a fish: its depth)   legF  how much of that is leg
  //   len   the barrel, chest to rump      girth  its half width against its half height
  //   neck, neckUp   its length, how steeply it rises     head, snout   its length, how drawn out the muzzle
  //   ear, earUp     its length, how upright              tail, brush   its length, how bushy the end
  //   horn  antler or horn, 0 for none     limbW  how thick the legs are (1 ordinary)
  //   coat  how many flat strokes the coat is laid in     marks 'dapple'|'rump'|'bib'|'mask'|''
  //   span  a bird's wings, tip to tip     bill  a bill's length      fin  a fish's fin
  //  -- the paint: six washes, each mixed from this animal's own biome's named pigments --
  //   col { back, side, belly, dark, pale, mark }
  //  -- how fast, how heavy --
  //   walk, trot, run  m/s ON EARTH. LEFT OUT ON PURPOSE for every kind here: the engine already turns leg
  //          length, gravity and the Froude number into the gait and the speeds (src/physics/explorer.js
  //          gaitOf, which src/physics/fauna.js calls), and one row is then right on every planet. The real
  //          animal's speed is written in its comment where it is worth knowing, and if the engine's number
  //          ever reads wrong in a still, put it here and say why.
  //   mass  kg. Only the chase uses it: a hunter that cannot last gives up, which is what real ones do.
  //  -- how it lives --
  //   group [least, most] that stand together (left out: it is alone)   spread  m they scatter over
  //   many  a swarm's bodies inside ONE instance (the swarms only: a swarm is one thing, not thirty)
  //   hours [from, to] it is abroad; it may run through midnight (an owl's [19, 6])
  //   peak, amp, base   its day as one cosine: peak 0..1 through the day (0 = midnight), how hard it drives it
  //   hab [trees, under, glade, water] 0..1, the ground it belongs on   where 'wood'|'open'|'water'|'any'
  //   flee  m: how near you may come before it goes     shy 0..1: how readily it takes fright
  //   callR m: how far its own alarm carries (a jay's is far)   strike: it stands and stabs instead of chasing
  //   water: it lives IN the water, so it is placed on the liquid and not on the ground
  //   eats     what it eats, in plain words, for the owner and for whoever writes the menus
  //   hunts    which GUILDS it chases in front of the player (common.js makes the routines' bits from this).
  //            A raven eats dead deer and must never be seen running one down, so a raven hunts nothing.
  //   eatenBy  the kinds that hunt it, BY NAME. Every name here must be a kind in this list; that is what the
  //            test beside this file is for, and it is the only guard against a wood where nothing eats.
  //  -- and a few that only some kinds carry --
  //   size [least, most]  how much one individual may differ from its row (a yearling at 0.88)
  //   depth, fin   a fish's body depth and its fin        of  this row is an age or a sex of another kind
  //   with { kind: chance }  which other kinds stand in this one's group, and how often
  //   season 'summer'  it is only abroad in summer (data/season.js is the mechanism; NOT READ YET)
  //   colSum, colAut   two dresses, mixed at data/season.js SEASON.t exactly as a tree's leafSum / leafAut
  //   soar  it hangs on a lift instead of flapping   rock  it rocks in its glide (a vulture, and not an eagle)
  //   far   m: it is worth drawing much further out than its size alone would say (a soaring bird, a cloud)
  //   fells, fellsMost  it fells a named tree, and how many cuts it may have standing at once
  //
  // A LIMIT WORTH KNOWING BEFORE THE LIST IS READ: the far tier's colour table holds SIXTEEN species
  // (src/world/beastkit.js MAX_SPECIES = 16). Stage 1 is seven rows and fits; a wood of twenty does not. So
  // either that number is raised or a biome's roster is held to sixteen. It is named here so that nobody
  // discovers it by seeing a fox painted as a deer at two hundred metres.
  // ==========================================================================================================
  fauna: {
    // THE ORDER IS THE CONTRACT, and this is the only place it is written. common.js faunaKinds walks this
    // list and hands each kind its index; the routines write that index and the drawing reads it. Put a new
    // kind at the END, never in the middle, or every saved thing that remembers a species means another one.
    order: [
      // the five, and the stag and calf that stand in a deer group
      'deer', 'fox', 'hare', 'heron', 'trout', 'stag', 'fawn',
      // the rest of the wood
      'raven', 'boar', 'wolf', 'lynx', 'squirrel', 'marten', 'badger', 'owl', 'goshawk',
      // the water
      'kingfisher', 'teal', 'otter', 'beaver', 'frog', 'dragonfly',
      // the swarms: one mark a body, and together about two draw calls
      'midge', 'swallow', 'butterfly', 'herring', 'starling',
      // the coast
      'gull', 'seal', 'cormorant', 'crab', 'sheep',
      // the mountain
      'ibex', 'marmot', 'ptarmigan', 'eagle',
      // the canyon
      'bighorn', 'canyoncat', 'quail', 'lizard', 'tortoise', 'vulture',
    ],
    kinds: {
      // ====== THE FIVE, built first, all of them within sight of where the explorer lands ==================
      // They prove every part of the system once and nothing twice: three body plans; one plan at two sizes an
      // order apart (a deer and a hare), which is the test of whether one mesh can carry twenty animals; TWO
      // whole hunts, so the owner's ecosystem is real on the first day (the fox hunts the hare on land, the
      // heron hunts the trout in the water) and each hunted animal answers in its own way; and the cheapest
      // tier of all proved by the trout, which is one draw call for a whole pool.
      // The proportions of the deer, the fox and the hare are src/world/beastkit.js's own, copied on 23 Nov so
      // that handing these rows to the builder changes not one pixel of what it already makes. The design
      // asked for a red deer 1.30 m at the shoulder; the kit's 1.24 m stag and 1.10 m hind are truer to the
      // animal and are what the geometry is cut to, so the kit's numbers are the ones kept.

      // 1. RED DEER (a hind). WORTH DRAWING: the heads all come up together when you cross their line, and
      //    then the group goes off in single file between the trunks -- a row of warm ochre shapes crossing
      //    the vertical dark of the wood. A hind walks at about 1.1 m/s and gallops at about 11; the engine's
      //    own Froude law gives 2.2 and 4.8 for her leg, which is what she will actually do until a still says
      //    otherwise. MEASURED: her back wash sits 0.37 of brightness below the wood's gold litter, so she is
      //    a dark shape on a bright floor and not a shadow in it.
      deer: { plan: 'walker', guild: 'grazer', stage: 1, in: ['temperate_forest', 'autumn_woodland', 'alpine_meadow'],
        high: 1.10, legF: 0.60, len: 1.05, girth: 0.72, neck: 0.44, neckUp: 0.74, head: 0.26, snout: 0.62,
        ear: 0.15, earUp: 0.80, tail: 0.14, brush: 0.45, horn: 0, limbW: 0.85, coat: 96, marks: 'rump',
        col: { back: M('rawUmber', 'burntSienna', 0.30), side: M('rawUmber', 'quinGold', 0.45), belly: D('quinGold', 0.62),
          dark: K('rawUmber', 'ultramarine'), pale: D('quinGold', 0.80), mark: D('quinGold', 0.72) },
        mass: 100, group: [3, 7], spread: 11, size: [0.88, 1.06], hours: [4, 22], peak: 0.27, amp: 0.50, base: 0.50,
        hab: [0.5, 0.8, 0.9, 0.2], where: 'any', flee: 45, shy: 0.75, callR: 60,
        eats: ['grass', 'bramble', 'sapling leaves', 'acorns'], hunts: [], eatenBy: ['wolf', 'lynx'],
        // a group is hinds and calves with a stag among them in the autumn. NOTHING READS THIS YET: the placer
        // (src/world/beasts.js beastBirths) is where it belongs, one roll per group.
        with: { stag: 0.35, fawn: 0.60 } },

      // 2. RED FOX. WORTH DRAWING: the pounce. A high nose-first arc with the tail swung round as a
      //    counterweight -- one animation, and it is the one everybody remembers. It is the only kind that
      //    lives in all six biomes, so it is also the proof that one row can furnish a whole planet.
      //    MEASURED: its back is 0.29 below the litter and 0.17 below the canopy's orange -- it is nearly its
      //    background's HUE, which is the truth about a fox; what separates it is value, and the white bib at
      //    0.95, which is the brightest thing on any animal in this list.
      fox: { plan: 'walker', guild: 'hunter', stage: 1, in: ['temperate_forest', 'autumn_woodland', 'alpine_meadow', 'sea_coast', 'desert_canyon', 'misty_wetland'],
        high: 0.42, legF: 0.50, len: 0.62, girth: 0.72, neck: 0.14, neckUp: 0.34, head: 0.18, snout: 0.88,
        ear: 0.095, earUp: 0.95, tail: 0.40, brush: 1.00, horn: 0, limbW: 0.80, coat: 72, marks: 'bib',
        col: { back: M('burntSienna', 'cadOrange', 0.35), side: M('cadOrange', 'quinGold', 0.25), belly: D('quinGold', 0.84),
          dark: K('rawUmber', 'ultramarine'), pale: D('cadOrange', 0.88), mark: K('rawUmber', 'ultramarine') },
        mass: 7, spread: 0, size: [0.92, 1.04], hours: [16, 8], peak: 0.95, amp: 0.55, base: 0.45,
        hab: [0.6, 0.8, 0.8, 0.3], where: 'any', flee: 28, shy: 0.85, callR: 40,
        eats: ['hare', 'mice', 'frogs', 'eggs', 'carrion'], hunts: ['ground', 'bird'], eatenBy: ['wolf', 'eagle'] },

      // 3. BROWN HARE. WORTH DRAWING: it is invisible until it breaks, and then it goes in a zig-zag bound. It
      //    is the one creature that makes the grass feel like cover rather than paint. MEASURED, and on
      //    purpose: its back sits only 0.27 under the litter and 0.18 under the grass, which is HALF the
      //    deer's step -- it is meant to be hard to see until it moves.
      hare: { plan: 'walker', guild: 'ground', stage: 1, in: ['temperate_forest', 'autumn_woodland', 'alpine_meadow', 'sea_coast'],
        high: 0.30, legF: 0.45, len: 0.42, girth: 0.84, neck: 0.07, neckUp: 0.55, head: 0.12, snout: 0.45,
        ear: 0.13, earUp: 0.88, tail: 0.05, brush: 0.60, horn: 0, limbW: 0.78, coat: 54, marks: '',
        col: { back: M('rawUmber', 'quinGold', 0.42), side: M('quinGold', 'rawUmber', 0.28), belly: D('quinGold', 0.78),
          dark: K('rawUmber', 'cobaltViolet'), pale: D('quinGold', 0.86), mark: D('rawUmber', 0.45) },
        mass: 3.5, group: [1, 2], spread: 14, hours: [15, 9], peak: 0.90, amp: 0.45, base: 0.50,
        hab: [0.3, 0.9, 1.0, 0.1], where: 'any', flee: 22, shy: 0.95, callR: 18,
        eats: ['grass', 'flowers', 'bark'], hunts: [], eatenBy: ['fox', 'lynx', 'eagle', 'owl', 'goshawk'] },

      // 4. GREY HERON. WORTH DRAWING: the stillness. A pale vertical in the reeds that you took for a dead
      //    stem until it moved. It stands for a minute, stabs, and goes off with slow heavy beats and its legs
      //    trailing. MEASURED: its side wash is level with the lightest reed (within 0.02) and 0.18 above the
      //    reed bed's middle, so it reads as a pale upright against a dark bed -- which is the whole picture.
      //    Its greys come from the WETLAND'S palette (paynesGrey, davysGrey), because the wetland is its home;
      //    in the wood it stands at the river, where a neutral grey is the one thing the gold has no answer to.
      //    THE BIRD PLAN IS NOT BUILT. These proportions are a proposal for whoever cuts it.
      heron: { plan: 'bird', guild: 'raptor', stage: 1, in: ['misty_wetland', 'autumn_woodland', 'temperate_forest', 'sea_coast'],
        high: 1.00, legF: 0.55, len: 0.55, girth: 0.62, neck: 0.42, neckUp: 0.85, head: 0.14, snout: 1.00,
        bill: 0.13, span: 1.60, ear: 0, earUp: 0, tail: 0.16, brush: 0.20, horn: 0, limbW: 0.35, coat: 44, marks: '',
        col: { back: D('paynesGrey', 0.52), side: D('davysGrey', 0.58), belly: D('davysGrey', 0.84),
          dark: K('paynesGrey', 'paynesGrey'), pale: D('davysGrey', 0.92), mark: pig('yellowOchre') },
        mass: 1.6, group: [1, 2], spread: 25, hours: [5, 21], peak: 0.30, amp: 0.35, base: 0.60,
        hab: [0.2, 0.2, 0.3, 1.0], where: 'water', flee: 38, shy: 0.90, callR: 70, strike: true,
        eats: ['trout', 'frogs', 'eels'], hunts: ['fish'], eatenBy: [] },

      // 5. BROWN TROUT. WORTH DRAWING: IT FACES UPSTREAM. The river already carries a current at every sample
      //    (src/world/surface.js), and fish that lean on it are what proves the water is really flowing, which
      //    is half of the owner's other ask of the same day. It holds station, darts, and rises.
      //    A fish's `high` is its DEPTH, not a shoulder: that is what the drawing scales it by.
      //    Its one red is the autumn wood's own accent, alizarin, spent on a few spots the size of a dab and
      //    nothing else -- the opposite accent in any scene is the player's blue cloak, and no animal takes it.
      //    THE FISH PLAN IS NOT BUILT either; a fish is a travelling wave down a body and no legs at all.
      trout: { plan: 'fish', guild: 'fish', stage: 1, in: ['autumn_woodland', 'temperate_forest', 'misty_wetland', 'alpine_meadow'],
        high: 0.085, len: 0.30, depth: 0.085, fin: 0.06, girth: 0.55, legF: 0, neck: 0, neckUp: 0,
        head: 0.075, snout: 0.50, ear: 0, earUp: 0, tail: 0.10, brush: 0.30, horn: 0, limbW: 0, coat: 24, marks: '',
        col: { back: M('oliveGreen', 'rawUmber', 0.42), side: M('quinGold', 'oliveGreen', 0.32), belly: D('quinGold', 0.82),
          dark: K('rawUmber', 'ultramarine'), pale: D('quinGold', 0.88), mark: pig('alizarin') },
        mass: 0.45, group: [5, 12], spread: 6, hours: null, peak: 0.25, amp: 0.30, base: 0.70,
        hab: [0, 0, 0, 1], where: 'water', water: true, flee: 9, shy: 0.80, callR: 5,
        eats: ['nymphs', 'flies', 'fry'], hunts: [], eatenBy: ['heron', 'otter', 'kingfisher'] },

      // THE STAG AND THE CALF are not a forty-first and forty-second kind: they are the deer's own sexes and
      // ages, and they stand in a deer group (see `with` above). They have rows of their own because the
      // antler is a part and not a scale, and because a calf is dappled and its mother is not.
      stag: { plan: 'walker', guild: 'grazer', stage: 1, of: 'deer', in: ['temperate_forest', 'autumn_woodland', 'alpine_meadow'],
        high: 1.24, legF: 0.60, len: 1.18, girth: 0.78, neck: 0.48, neckUp: 0.70, head: 0.29, snout: 0.62,
        ear: 0.15, earUp: 0.75, tail: 0.14, brush: 0.45, horn: 0.46, limbW: 0.95, coat: 104, marks: 'rump',
        col: { back: M('rawUmber', 'burntSienna', 0.18), side: M('rawUmber', 'quinGold', 0.34), belly: D('quinGold', 0.56),
          dark: K('rawUmber', 'ultramarine'), pale: D('quinGold', 0.76), mark: D('quinGold', 0.68) },
        mass: 180, spread: 11, hours: [4, 22], peak: 0.27, amp: 0.50, base: 0.50,
        hab: [0.5, 0.8, 0.9, 0.2], where: 'any', flee: 50, shy: 0.65, callR: 90,
        eats: ['grass', 'bramble', 'sapling leaves', 'acorns'], hunts: [], eatenBy: ['wolf'] },
      fawn: { plan: 'walker', guild: 'grazer', stage: 1, of: 'deer', in: ['temperate_forest', 'autumn_woodland', 'alpine_meadow'],
        high: 0.62, legF: 0.63, len: 0.56, girth: 0.74, neck: 0.22, neckUp: 0.72, head: 0.16, snout: 0.48,
        ear: 0.10, earUp: 0.85, tail: 0.09, brush: 0.40, horn: 0, limbW: 0.72, coat: 58, marks: 'dapple',
        col: { back: M('rawUmber', 'quinGold', 0.34), side: M('rawUmber', 'quinGold', 0.52), belly: D('quinGold', 0.70),
          dark: K('rawUmber', 'ultramarine'), pale: D('quinGold', 0.86), mark: D('quinGold', 0.90) },
        mass: 22, spread: 6, hours: [4, 22], peak: 0.27, amp: 0.50, base: 0.50,
        hab: [0.5, 0.8, 0.9, 0.2], where: 'any', flee: 40, shy: 0.95, callR: 25,
        eats: ['grass', 'milk'], hunts: [], eatenBy: ['wolf', 'lynx', 'fox', 'eagle'] },

      // ====== THE REST OF THE WOOD (?beasts=2) =============================================================
      // Every one of these is the walker or the bird, and a plan is ONE instanced mesh however many kinds ride
      // it: that is the whole point of the shape, and it is why the wood can go from five kinds to twenty
      // without one more draw call. What is NOT written out here is the fine proportions -- the girth, the
      // snout, the set of an ear. Those are a drawing, and they are written when someone sits down and draws
      // the animal; until then the row takes its plan's defaults (common.js FAUNA_PLAN) and will stand and
      // walk without yet looking like itself. Everything below IS a fact about the animal.

      // 6. RAVEN -- it goes where the wolves have been, so it is the kind that TELLS you something happened;
      //    and it tumbles and rolls in a gust, which means it plays in the wind the powers make.
      raven: { plan: 'bird', guild: 'crow', stage: 2, in: ['temperate_forest', 'autumn_woodland', 'alpine_meadow', 'sea_coast', 'desert_canyon', 'misty_wetland'],
        high: 0.30, span: 1.20, len: 0.42, mass: 1.2, bill: 0.08,
        col: { back: K('ultramarine', 'rawUmber'), side: K('cobaltViolet', 'rawUmber'), belly: K('ultramarine', 'ultramarine'),
          dark: K('ultramarine', 'rawUmber'), pale: D('cobaltViolet', 0.55), mark: D('cobaltViolet', 0.70) },
        group: [2, 4], spread: 30, hours: [6, 20], peak: 0.45, amp: 0.35, base: 0.65,
        hab: [0.6, 0.3, 0.7, 0.3], where: 'any', flee: 30, shy: 0.70, callR: 120,
        eats: ['carrion', 'eggs', 'anything'], hunts: [], eatenBy: [] },

      // 7. WILD BOAR -- it PLOUGHS the leaf litter, leaving a scuffed line of bare earth through dabs that are
      //    already drawn. Its young are striped.
      boar: { plan: 'walker', guild: 'grazer', stage: 2, in: ['temperate_forest', 'autumn_woodland', 'misty_wetland'],
        high: 0.80, legF: 0.46, len: 1.00, girth: 0.86, neck: 0.11, neckUp: 0.16, head: 0.40, snout: 1.00,
        ear: 0.11, earUp: 0.60, tail: 0.18, brush: 0.30, horn: 0, limbW: 1.20, coat: 86, marks: '',
        col: { back: K('rawUmber', 'rawUmber'), side: M('rawUmber', 'cobaltViolet', 0.22), belly: M('rawUmber', 'quinGold', 0.25),
          dark: K('rawUmber', 'ultramarine'), pale: D('rawUmber', 0.45), mark: K('rawUmber', 'cobaltViolet') },
        mass: 80, group: [2, 5], spread: 9, size: [0.55, 1.08], hours: [17, 7], peak: 0.92, amp: 0.50, base: 0.50,
        hab: [0.9, 1.0, 0.4, 0.3], where: 'wood', flee: 30, shy: 0.60, callR: 50,
        eats: ['roots', 'acorns', 'leaf litter', 'carrion'], hunts: [], eatenBy: ['wolf', 'lynx'] },

      // 8. GREY WOLF -- the pack crosses a glade nose to tail and every deer in sight lifts its head at once.
      //    The animal that makes the wood feel as though it has rules. A pack is ONE steering solve with five
      //    followers, never six solves.
      wolf: { plan: 'walker', guild: 'hunter', stage: 2, in: ['temperate_forest', 'autumn_woodland', 'alpine_meadow'],
        high: 0.85, legF: 0.56, len: 1.10, girth: 0.70, neck: 0.22, neckUp: 0.40, head: 0.26, snout: 0.90,
        ear: 0.11, earUp: 0.92, tail: 0.38, brush: 0.80, horn: 0, limbW: 0.88, coat: 88, marks: '',
        col: { back: M('rawUmber', 'neutralTint', 0.55), side: M('neutralTint', 'quinGold', 0.22), belly: D('quinGold', 0.74),
          dark: K('rawUmber', 'ultramarine'), pale: D('neutralTint', 0.80), mark: M('rawUmber', 'neutralTint', 0.70) },
        mass: 40, group: [3, 6], spread: 13, hours: [16, 9], peak: 0.93, amp: 0.45, base: 0.55,
        hab: [0.7, 0.6, 0.8, 0.3], where: 'any', flee: 60, shy: 0.50, callR: 200,
        eats: ['deer', 'boar young', 'hare'], hunts: ['grazer', 'ground'], eatenBy: [] },

      // 9. LYNX -- you almost never see it, and when you do it is already looking at you. Stalk, freeze, two
      //    bounds. Its density is deliberately the lowest in the wood.
      lynx: { plan: 'walker', guild: 'hunter', stage: 2, in: ['temperate_forest', 'autumn_woodland', 'alpine_meadow'],
        high: 0.65, legF: 0.58, len: 0.90, girth: 0.74, neck: 0.14, neckUp: 0.30, head: 0.20, snout: 0.55,
        ear: 0.11, earUp: 1.00, tail: 0.14, brush: 0.55, horn: 0, limbW: 1.05, coat: 76, marks: 'dapple',
        col: { back: M('rawUmber', 'quinGold', 0.50), side: M('quinGold', 'rawUmber', 0.32), belly: D('quinGold', 0.80),
          dark: K('rawUmber', 'ultramarine'), pale: D('quinGold', 0.88), mark: K('rawUmber', 'rawUmber') },
        mass: 22, spread: 0, hours: [18, 6], peak: 0.02, amp: 0.55, base: 0.45,
        hab: [0.9, 0.8, 0.4, 0.1], where: 'wood', flee: 40, shy: 0.95, callR: 30,
        eats: ['hare', 'ptarmigan', 'deer calves'], hunts: ['ground', 'bird', 'grazer'], eatenBy: [] },

      // 10. RED SQUIRREL -- it keeps the trunk between you and it, and the trees stop being scenery.
      squirrel: { plan: 'walker', guild: 'climber', stage: 2, in: ['temperate_forest', 'autumn_woodland'],
        high: 0.14, legF: 0.40, len: 0.22, girth: 0.80, neck: 0.03, neckUp: 0.50, head: 0.06, snout: 0.45,
        ear: 0.035, earUp: 1.00, tail: 0.20, brush: 1.00, horn: 0, limbW: 0.75, coat: 40, marks: '',
        col: { back: M('burntSienna', 'rawUmber', 0.35), side: M('burntSienna', 'cadOrange', 0.20), belly: D('quinGold', 0.88),
          dark: K('rawUmber', 'ultramarine'), pale: D('quinGold', 0.92), mark: D('burntSienna', 0.40) },
        mass: 0.33, group: [1, 3], spread: 20, hours: [6, 18], peak: 0.33, amp: 0.45, base: 0.55,
        hab: [1.0, 0.3, 0.1, 0], where: 'wood', flee: 12, shy: 0.98, callR: 25,
        eats: ['cones', 'nuts', 'buds'], hunts: [], eatenBy: ['marten', 'goshawk', 'owl', 'fox'] },

      // 11. PINE MARTEN -- it works the CANOPY, the only kind that uses the trees' upper half, which is most
      //     of what the oil look actually draws.
      marten: { plan: 'walker', guild: 'climber', stage: 2, in: ['temperate_forest', 'autumn_woodland'],
        high: 0.17, legF: 0.38, len: 0.50, girth: 0.68, neck: 0.07, neckUp: 0.30, head: 0.10, snout: 0.80,
        ear: 0.04, earUp: 0.90, tail: 0.26, brush: 0.85, horn: 0, limbW: 0.72, coat: 52, marks: 'bib',
        col: { back: K('rawUmber', 'rawUmber'), side: M('rawUmber', 'burntSienna', 0.25), belly: D('quinGold', 0.70),
          dark: K('rawUmber', 'ultramarine'), pale: D('quinGold', 0.80), mark: D('quinGold', 0.66) },
        mass: 1.5, spread: 0, hours: [19, 5], peak: 0.00, amp: 0.50, base: 0.50,
        hab: [1.0, 0.4, 0.2, 0], where: 'wood', flee: 25, shy: 0.95, callR: 30,
        eats: ['squirrel', 'eggs', 'berries'], hunts: ['climber', 'bird'], eatenBy: ['eagle', 'goshawk'] },

      // 12. BADGER -- the first animal with a routine you can LEARN: out of the same bank at the same hour,
      //     down the same line, nose down, every night.
      badger: { plan: 'walker', guild: 'hunter', stage: 2, in: ['temperate_forest', 'autumn_woodland'],
        high: 0.28, legF: 0.32, len: 0.64, girth: 0.92, neck: 0.07, neckUp: 0.18, head: 0.17, snout: 0.92,
        ear: 0.035, earUp: 0.50, tail: 0.12, brush: 0.50, horn: 0, limbW: 1.25, coat: 60, marks: 'mask',
        col: { back: M('neutralTint', 'rawUmber', 0.30), side: D('neutralTint', 0.30), belly: K('rawUmber', 'ultramarine'),
          dark: K('ultramarine', 'rawUmber'), pale: D('neutralTint', 0.86), mark: K('ultramarine', 'rawUmber') },
        mass: 11, group: [1, 3], spread: 7, hours: [20, 5], peak: 0.02, amp: 0.60, base: 0.40,
        hab: [0.8, 0.9, 0.5, 0.2], where: 'wood', flee: 20, shy: 0.80, callR: 25,
        eats: ['worms', 'roots', 'eggs'], hunts: [], eatenBy: [] },

      // 13. TAWNY OWL -- silent, and against the night key the painter wrote (common.js EARTH_SKY.night) it is
      //     a picture in its own right. The risk is the opposite of the usual one: a dark bird on dark ground
      //     at night may simply not be there, and that is a looking question, not a measuring one.
      owl: { plan: 'bird', guild: 'raptor', stage: 2, in: ['temperate_forest', 'autumn_woodland', 'misty_wetland', 'desert_canyon'],
        high: 0.38, span: 1.00, len: 0.30, mass: 0.50, bill: 0.03,
        col: { back: M('rawUmber', 'quinGold', 0.30), side: M('rawUmber', 'quinGold', 0.48), belly: D('quinGold', 0.74),
          dark: K('rawUmber', 'ultramarine'), pale: D('quinGold', 0.86), mark: K('rawUmber', 'rawUmber') },
        spread: 0, hours: [19, 6], peak: 0.00, amp: 0.60, base: 0.40,
        hab: [1.0, 0.5, 0.4, 0.2], where: 'wood', flee: 26, shy: 0.85, callR: 180,
        eats: ['mice', 'hare young', 'frogs'], hunts: ['ground'], eatenBy: [] },

      // 14. GOSHAWK -- the only fast thing under the canopy. A flat hard flap in a straight line, and it is
      //     through and gone before you have turned.
      goshawk: { plan: 'bird', guild: 'raptor', stage: 2, in: ['temperate_forest', 'autumn_woodland'],
        high: 0.30, span: 1.10, len: 0.50, mass: 0.90, bill: 0.03,
        col: { back: M('neutralTint', 'rawUmber', 0.35), side: D('neutralTint', 0.38), belly: D('neutralTint', 0.82),
          dark: K('rawUmber', 'ultramarine'), pale: D('neutralTint', 0.90), mark: K('rawUmber', 'ultramarine') },
        spread: 0, hours: [7, 18], peak: 0.38, amp: 0.45, base: 0.55,
        hab: [1.0, 0.4, 0.5, 0.1], where: 'wood', flee: 45, shy: 0.90, callR: 60,
        eats: ['squirrel', 'teal', 'ptarmigan'], hunts: ['climber', 'bird', 'ground'], eatenBy: [] },

      // ====== THE WATER (?beasts=2): the river runs through both woods, and the wetland is all water ========

      // 15. KINGFISHER -- the most saturated single mark in the whole wood. It sits on a willow twig and dives
      //     like a thrown dart. Turquoise is already a named pigment and already the canyon's accent, so it
      //     costs no new colour.
      kingfisher: { plan: 'bird', guild: 'raptor', stage: 2, in: ['autumn_woodland', 'temperate_forest', 'misty_wetland'],
        high: 0.09, span: 0.26, len: 0.17, mass: 0.04, bill: 0.04,
        col: { back: pig('turquoise'), side: M('turquoise', 'cerulean', 0.40), belly: M('burntSienna', 'cadOrange', 0.30),
          dark: K('ultramarine', 'rawUmber'), pale: D('davysGrey', 0.92), mark: pig('cadOrange') },
        spread: 0, hours: [6, 19], peak: 0.38, amp: 0.40, base: 0.60,
        hab: [0.3, 0.2, 0.2, 1.0], where: 'water', flee: 16, shy: 0.95, callR: 40,
        eats: ['fry', 'minnows'], hunts: ['fish'], eatenBy: ['goshawk'] },

      // 16. TEAL -- THE FLUSH. Fifteen of them off the pool at once when you come round the reeds: the loudest
      //     thing in the game that is not weather.
      teal: { plan: 'bird', guild: 'bird', stage: 2, in: ['misty_wetland', 'autumn_woodland', 'temperate_forest', 'sea_coast'],
        high: 0.22, span: 0.60, len: 0.35, mass: 0.33, bill: 0.04,
        col: { back: M('rawUmber', 'oliveGreen', 0.45), side: M('davysGrey', 'oliveGreen', 0.30), belly: D('yellowOchre', 0.80),
          dark: K('rawUmber', 'ultramarine'), pale: D('davysGrey', 0.88), mark: M('viridian', 'ultramarine', 0.30) },
        group: [6, 15], spread: 7, hours: null, peak: 0.35, amp: 0.30, base: 0.70,
        hab: [0.1, 0.3, 0.2, 1.0], where: 'water', water: true, flee: 32, shy: 0.95, callR: 90,
        eats: ['weed', 'snails'], hunts: [], eatenBy: ['fox', 'otter', 'goshawk'] },

      // 17. OTTER -- it eats a fish lying on its back in the current. The second fish-eater, and the one kind
      //     that proves land and water are the same world.
      otter: { plan: 'walker', guild: 'hunter', stage: 2, in: ['misty_wetland', 'autumn_woodland', 'temperate_forest', 'sea_coast'],
        high: 0.30, legF: 0.30, len: 0.70, girth: 0.82, neck: 0.08, neckUp: 0.25, head: 0.14, snout: 0.75,
        ear: 0.025, earUp: 0.40, tail: 0.40, brush: 0.35, horn: 0, limbW: 0.90, coat: 58, marks: '',
        col: { back: K('rawUmber', 'rawUmber'), side: M('rawUmber', 'davysGrey', 0.25), belly: D('yellowOchre', 0.76),
          dark: K('rawUmber', 'ultramarine'), pale: D('davysGrey', 0.86), mark: D('yellowOchre', 0.70) },
        mass: 9, group: [1, 3], spread: 12, hours: [17, 8], peak: 0.95, amp: 0.45, base: 0.55,
        hab: [0.2, 0.3, 0.3, 1.0], where: 'water', flee: 30, shy: 0.90, callR: 50,
        eats: ['trout', 'crayfish'], hunts: ['fish'], eatenBy: ['wolf'] },

      // 18. BEAVER -- it FELLS A WILLOW, through the same persistence the wind knife already uses
      //     (src/data/felled.js). The only animal that changes the world and leaves the change there after a
      //     save. IT MAY HOLD AT MOST ONE STANDING CUT and may not start another until that one has grown
      //     back: that list is shared with the play code and the saved game, and it is tuned for a player's
      //     occasional cut, not for a resident animal.
      beaver: { plan: 'walker', guild: 'grazer', stage: 2, in: ['misty_wetland'],
        high: 0.32, legF: 0.28, len: 0.80, girth: 0.95, neck: 0.06, neckUp: 0.20, head: 0.18, snout: 0.60,
        ear: 0.03, earUp: 0.60, tail: 0.30, brush: 0.15, horn: 0, limbW: 1.15, coat: 64, marks: '',
        col: { back: K('rawUmber', 'rawUmber'), side: M('rawUmber', 'burntSienna', 0.20), belly: M('rawUmber', 'yellowOchre', 0.30),
          dark: K('rawUmber', 'ultramarine'), pale: D('yellowOchre', 0.80), mark: D('rawUmber', 0.40) },
        mass: 20, group: [1, 3], spread: 10, hours: [18, 6], peak: 0.00, amp: 0.55, base: 0.45,
        hab: [0.5, 0.4, 0.2, 1.0], where: 'water', flee: 22, shy: 0.80, callR: 60,
        eats: ['willow bark', 'shoots'], hunts: [], eatenBy: ['wolf'], fells: 'willow', fellsMost: 1 },

      // 19. COMMON FROG -- at 0.08 m it is 2.8 pixels at twenty metres on the owner's phone. It is a SOUND and
      //     a ring spreading on a pool whose mirror is already 0.9, far more than it is a body, and it should
      //     be written that way rather than modelled and then found invisible.
      frog: { plan: 'walker', guild: 'ground', stage: 2, in: ['misty_wetland', 'autumn_woodland', 'temperate_forest'],
        high: 0.05, legF: 0.35, len: 0.08, girth: 1.10, neck: 0, neckUp: 0, head: 0.03, snout: 0.40,
        ear: 0, earUp: 0, tail: 0, brush: 0, horn: 0, limbW: 0.80, coat: 12, marks: '',
        col: { back: M('oliveGreen', 'rawUmber', 0.35), side: M('oliveGreen', 'yellowOchre', 0.30), belly: D('yellowOchre', 0.84),
          dark: K('rawUmber', 'oliveGreen'), pale: D('lemonYellow', 0.70), mark: K('rawUmber', 'rawUmber') },
        mass: 0.03, group: [4, 12], spread: 5, hours: [18, 8], peak: 0.95, amp: 0.45, base: 0.55,
        hab: [0.2, 0.6, 0.2, 1.0], where: 'water', flee: 6, shy: 1.00, callR: 10,
        eats: ['insects'], hunts: [], eatenBy: ['heron', 'otter', 'owl', 'fox'] },

      // 20. DRAGONFLY -- it hovers dead still, and then it is three metres away with nothing in between. The
      //     only thing in the game that moves like that.
      dragonfly: { plan: 'bird', guild: 'bird', stage: 2, in: ['misty_wetland', 'autumn_woodland'], season: 'summer',
        high: 0.02, span: 0.10, len: 0.075, mass: 0.001, bill: 0,
        col: { back: M('viridian', 'turquoise', 0.45), side: M('turquoise', 'lemonYellow', 0.25), belly: D('lemonYellow', 0.60),
          dark: K('rawUmber', 'viridian'), pale: D('mint', 0.60), mark: pig('turquoise') },
        group: [1, 4], spread: 8, hours: [9, 18], peak: 0.55, amp: 0.55, base: 0.45,
        hab: [0.1, 0.3, 0.4, 1.0], where: 'water', flee: 4, shy: 0.90, callR: 6,
        eats: ['midges'], hunts: [], eatenBy: ['frog', 'swallow'] },

      // ====== THE SWARMS (?beasts=2): five kinds for about two draw calls ===================================
      // All five are the falling leaves' own pattern (src/world/leaffall.js): ONE mesh, a per-instance phase,
      // the whole motion solved in the vertex shader from the clock, nothing kept between frames, a stopped
      // clock giving the same picture twice. A swarm is ONE instance; `many` is how many marks are inside it.
      // This is the cheapest work in the whole creature plan and it holds five of the most memorable entries.
      // THE RULE THEY MUST NOT BREAK: nothing in this look may boil faster than six to eight pictures a
      // second, and a swarm of small fast marks is the likeliest thing here to break it.

      // 21. MIDGE COLUMN -- a standing column that drifts and shears, in a low shaft of sun the painter
      //     already draws.
      midge: { plan: 'swarm', guild: 'bird', stage: 2, in: ['misty_wetland', 'autumn_woodland', 'temperate_forest'],
        high: 0.004, len: 0.004, mass: 0.00001, many: [150, 260], group: [1, 1], spread: 2,
        col: { back: K('rawUmber', 'neutralTint'), side: D('neutralTint', 0.40), belly: D('neutralTint', 0.60),
          dark: K('rawUmber', 'ultramarine'), pale: D('neutralTint', 0.80), mark: D('neutralTint', 0.70) },
        hours: [17, 21], peak: 0.80, amp: 0.70, base: 0.30,
        hab: [0.5, 0.6, 0.6, 0.8], where: 'any', flee: 0, shy: 0, callR: 0,
        eats: ['nothing you would notice'], hunts: [], eatenBy: ['swallow', 'frog', 'trout', 'dragonfly'] },

      // 22. SWALLOW -- they hunt the midges that are ACTUALLY THERE, and they fly low before rain: a weather
      //     sign made of birds, over a weather model that already exists.
      swallow: { plan: 'swarm', guild: 'bird', stage: 2, in: ['temperate_forest', 'autumn_woodland', 'alpine_meadow', 'sea_coast', 'misty_wetland'], season: 'summer',
        high: 0.06, span: 0.32, len: 0.15, mass: 0.019, many: [10, 30], group: [1, 1], spread: 40,
        col: { back: K('ultramarine', 'ultramarine'), side: M('ultramarine', 'cobaltViolet', 0.35), belly: D('quinGold', 0.82),
          dark: K('ultramarine', 'rawUmber'), pale: D('quinGold', 0.90), mark: M('burntSienna', 'alizarin', 0.35) },
        hours: [6, 20], peak: 0.45, amp: 0.45, base: 0.55,
        hab: [0.3, 0.5, 0.9, 0.8], where: 'any', flee: 0, shy: 0, callR: 0,
        eats: ['midges'], hunts: [], eatenBy: ['goshawk'] },

      // 23. MEADOW BUTTERFLIES -- flowers that have come loose, over drifts of poppy, ox-eye, buttercup and
      //     harebell that are already written into the ground below.
      butterfly: { plan: 'swarm', guild: 'bird', stage: 2, in: ['alpine_meadow', 'temperate_forest', 'autumn_woodland'], season: 'summer',
        high: 0.01, span: 0.06, len: 0.03, mass: 0.0005, many: [8, 20], group: [1, 1], spread: 16,
        col: { back: D('lemonYellow', 0.25), side: D('cadOrange', 0.35), belly: D('lemonYellow', 0.70),
          dark: K('rawUmber', 'rawUmber'), pale: D('lemonYellow', 0.85), mark: pig('roseMadder') },
        hours: [9, 18], peak: 0.52, amp: 0.55, base: 0.45,
        hab: [0.1, 0.5, 1.0, 0.2], where: 'open', flee: 0, shy: 0, callR: 0,
        eats: ['nectar'], hunts: [], eatenBy: ['swallow'] },

      // 24. HERRING SHOAL -- a silver sheet turning below you, seen from the top of a fifty-two metre cliff.
      //     The shoal turns as ONE thing; that is the whole picture, and it is one draw call.
      herring: { plan: 'swarm', guild: 'fish', stage: 2, in: ['sea_coast'],
        high: 0.07, len: 0.30, mass: 0.3, many: [150, 400], group: [1, 1], spread: 14, water: true,
        col: { back: M('viridian', 'ultramarine', 0.40), side: D('davysGrey', 0.72), belly: D('davysGrey', 0.92),
          dark: K('ultramarine', 'rawUmber'), pale: D('cerulean', 0.86), mark: D('cerulean', 0.60) },
        hours: null, peak: 0.40, amp: 0.20, base: 0.80,
        hab: [0, 0, 0, 1], where: 'water', flee: 12, shy: 1.00, callR: 0,
        eats: ['plankton'], hunts: [], eatenBy: ['seal', 'gull', 'cormorant'] },

      // 25. STARLING CLOUD -- THIS IS THE ANIMAL THAT REACHES THE OWNER'S MILE. At 1,609 m a single bird is
      //     0.07 of a pixel and a deer is 0.7, but a sixty-metre cloud is 21 pixels across and it POURS. It is
      //     the only honest meeting point of the mile ask and the animal ask, and it costs one draw call.
      //     Its whole claim is a number, so it must be looked at with a measured pixel width written beside
      //     it, and if it reads as a grey smudge it should be CUT and not enlarged to cheat the distance.
      starling: { plan: 'swarm', guild: 'bird', stage: 2, in: ['temperate_forest', 'autumn_woodland', 'misty_wetland'],
        high: 0.08, span: 0.38, len: 0.20, mass: 0.08, many: [400, 1500], group: [1, 1], spread: 60,
        col: { back: K('ultramarine', 'rawUmber'), side: K('cobaltViolet', 'rawUmber'), belly: K('rawUmber', 'ultramarine'),
          dark: K('ultramarine', 'ultramarine'), pale: D('cobaltViolet', 0.60), mark: D('cobaltViolet', 0.75) },
        hours: [16, 19], peak: 0.73, amp: 0.80, base: 0.20,
        hab: [0.4, 0.3, 0.8, 0.6], where: 'any', flee: 0, shy: 0, callR: 0, far: 1200,
        eats: ['insects'], hunts: [], eatenBy: ['goshawk'] },

      // ====== THE COAST (?beasts=3) =========================================================================

      // 26. HERRING GULL -- it hangs MOTIONLESS in the lift off the fifty-two metre cliff, and the lift that
      //     holds it is the real wind field and not an animation. The cheapest spectacular thing in this whole
      //     list, and the one the wind powers will visibly scatter. BEFORE ANY OF THEM IS BUILT, the wind near
      //     a cliff must be checked: if it is smooth rather than lifting, sixty birds will hang in nothing.
      gull: { plan: 'bird', guild: 'bird', stage: 3, in: ['sea_coast'],
        high: 0.32, span: 1.20, len: 0.58, mass: 1.0, bill: 0.06, soar: 1,
        col: { back: D('davysGrey', 0.45), side: D('davysGrey', 0.72), belly: D('davysGrey', 0.93),
          dark: K('ultramarine', 'davysGrey'), pale: D('davysGrey', 0.96), mark: pig('cadOrange') },
        group: [20, 60], spread: 26, hours: null, peak: 0.42, amp: 0.30, base: 0.70,
        hab: [0, 0.2, 1.0, 0.8], where: 'open', flee: 20, shy: 0.55, callR: 110,
        eats: ['fish', 'crabs', 'scraps'], hunts: [], eatenBy: [] },

      // 27. HARBOUR SEAL -- the same animal is a lumpy dark sausage on a rock and the most graceful thing in
      //     the sea, and you see both within a minute. It rides the fish plan at scale; hauled out is a pose.
      seal: { plan: 'fish', guild: 'hunter', stage: 3, in: ['sea_coast'],
        high: 0.45, len: 1.50, depth: 0.45, fin: 0.22, mass: 90, water: true,
        col: { back: M('davysGrey', 'rawUmber', 0.40), side: D('davysGrey', 0.40), belly: D('davysGrey', 0.80),
          dark: K('ultramarine', 'rawUmber'), pale: D('davysGrey', 0.88), mark: K('rawUmber', 'davysGrey') },
        group: [3, 10], spread: 10, hours: null, peak: 0.45, amp: 0.25, base: 0.75,
        hab: [0, 0, 0.3, 1.0], where: 'water', flee: 28, shy: 0.70, callR: 40,
        eats: ['herring', 'mackerel'], hunts: ['fish'], eatenBy: [] },

      // 28. CORMORANT -- the wings-out stance. The one bird in the list that holds a SHAPE rather than a
      //     motion, and the only silhouette a player will recognise at two hundred metres.
      cormorant: { plan: 'bird', guild: 'raptor', stage: 3, in: ['sea_coast', 'autumn_woodland', 'misty_wetland'],
        high: 0.45, span: 1.30, len: 0.80, mass: 2.2, bill: 0.07,
        col: { back: K('viridian', 'rawUmber'), side: K('ultramarine', 'rawUmber'), belly: K('rawUmber', 'rawUmber'),
          dark: K('ultramarine', 'ultramarine'), pale: D('davysGrey', 0.70), mark: pig('yellowOchre') },
        group: [2, 6], spread: 12, hours: [6, 20], peak: 0.40, amp: 0.35, base: 0.65,
        hab: [0, 0.1, 0.4, 1.0], where: 'water', flee: 30, shy: 0.85, callR: 40,
        eats: ['fish'], hunts: ['fish'], eatenBy: [] },

      // 29. SHORE CRAB -- it raises its claws at you instead of running away. The smallest thing in the game
      //     with an opinion. It is a crawler, not a walker: the plan below is a stand-in until one is cut.
      crab: { plan: 'walker', guild: 'ground', stage: 3, in: ['sea_coast'],
        high: 0.05, legF: 0.50, len: 0.15, girth: 1.30, neck: 0, neckUp: 0, head: 0.03, snout: 0.20,
        ear: 0, earUp: 0, tail: 0, brush: 0, horn: 0, limbW: 0.45, coat: 10, marks: '',
        col: { back: M('rawUmber', 'viridian', 0.35), side: M('rawUmber', 'yellowOchre', 0.30), belly: D('yellowOchre', 0.84),
          dark: K('rawUmber', 'ultramarine'), pale: D('yellowOchre', 0.88), mark: pig('cadOrange') },
        mass: 0.15, group: [5, 15], spread: 4, hours: null, peak: 0.45, amp: 0.20, base: 0.80,
        hab: [0, 0.1, 0.3, 1.0], where: 'water', flee: 3, shy: 0.90, callR: 0,
        eats: ['scraps'], hunts: [], eatenBy: ['gull'] },

      // 30. CLIFF SHEEP -- a scatter of cream dabs on a green clifftop, which is what finally gives the
      //     fifty-two metre cliff its height.
      sheep: { plan: 'walker', guild: 'grazer', stage: 3, in: ['sea_coast'],
        high: 0.70, legF: 0.50, len: 0.85, girth: 0.90, neck: 0.16, neckUp: 0.45, head: 0.20, snout: 0.70,
        ear: 0.08, earUp: 0.40, tail: 0.10, brush: 0.30, horn: 0, limbW: 0.90, coat: 110, marks: '',
        col: { back: D('yellowOchre', 0.60), side: D('yellowOchre', 0.74), belly: D('yellowOchre', 0.86),
          dark: K('rawUmber', 'davysGrey'), pale: D('davysGrey', 0.94), mark: K('rawUmber', 'ultramarine') },
        mass: 45, group: [3, 8], spread: 14, size: [0.55, 1.05], hours: [5, 21], peak: 0.42, amp: 0.30, base: 0.70,
        hab: [0, 0.4, 1.0, 0.1], where: 'open', flee: 18, shy: 0.65, callR: 25,
        eats: ['cliff turf'], hunts: [], eatenBy: ['eagle'] },

      // ====== THE MOUNTAIN (?beasts=3) ======================================================================

      // 31. ALPINE IBEX -- it walks ground nothing else can, and stands still on a skyline. The references ask
      //     for the snow to be the lightest thing in the picture; an ibex is the darkest thing you can put on
      //     it. At three hundred metres it is 1.8 pixels, so it must be the far tier's silhouette or it will
      //     not be there at all.
      ibex: { plan: 'walker', guild: 'grazer', stage: 3, in: ['alpine_meadow'],
        high: 0.95, legF: 0.55, len: 1.10, girth: 0.80, neck: 0.26, neckUp: 0.55, head: 0.24, snout: 0.65,
        ear: 0.10, earUp: 0.55, tail: 0.12, brush: 0.35, horn: 0.80, limbW: 1.00, coat: 94, marks: '',
        col: { back: M('rawUmber', 'neutralTint', 0.45), side: M('neutralTint', 'rawUmber', 0.35), belly: D('neutralTint', 0.70),
          dark: K('rawUmber', 'cobaltViolet'), pale: D('neutralTint', 0.84), mark: K('rawUmber', 'rawUmber') },
        mass: 85, group: [2, 6], spread: 15, size: [0.6, 1.08], hours: [5, 20], peak: 0.32, amp: 0.40, base: 0.60,
        hab: [0, 0.4, 1.0, 0.1], where: 'open', flee: 55, shy: 0.80, callR: 40,
        eats: ['alpine turf', 'lichen'], hunts: [], eatenBy: ['eagle', 'lynx'] },

      // 32. MARMOT -- the WHISTLE and the dive. The first animal in the game that answers you from sixty
      //     metres off, and the one that makes the meadow feel watched.
      marmot: { plan: 'walker', guild: 'ground', stage: 3, in: ['alpine_meadow'],
        high: 0.18, legF: 0.34, len: 0.45, girth: 1.00, neck: 0.04, neckUp: 0.30, head: 0.10, snout: 0.50,
        ear: 0.025, earUp: 0.60, tail: 0.16, brush: 0.60, horn: 0, limbW: 1.00, coat: 44, marks: '',
        col: { back: M('rawUmber', 'lemonYellow', 0.25), side: M('rawUmber', 'lemonYellow', 0.42), belly: D('lemonYellow', 0.66),
          dark: K('rawUmber', 'cobaltViolet'), pale: D('lemonYellow', 0.82), mark: D('rawUmber', 0.40) },
        mass: 4.5, group: [2, 5], spread: 6, hours: [7, 18], peak: 0.45, amp: 0.45, base: 0.55,
        hab: [0, 0.6, 1.0, 0.1], where: 'open', flee: 60, shy: 0.95, callR: 160,
        eats: ['meadow flowers', 'grass'], hunts: [], eatenBy: ['eagle', 'fox'] },

      // 33. PTARMIGAN -- it TURNS WHITE as the leaves turn, through the season system that already exists:
      //     `colSum` and `colAut` are exactly what a tree's `leafSum` / `leafAut` are, mixed at data/season.js
      //     SEASON.t. No new code at all -- an existing system handed a new caller. (NOTHING READS colSum AND
      //     colAut YET: the painter's material must mix them the way the leaves' already does.)
      ptarmigan: { plan: 'bird', guild: 'bird', stage: 3, in: ['alpine_meadow'],
        high: 0.22, span: 0.55, len: 0.35, mass: 0.50, bill: 0.02,
        col: { back: M('rawUmber', 'neutralTint', 0.40), side: M('neutralTint', 'lemonYellow', 0.22), belly: D('neutralTint', 0.88),
          dark: K('rawUmber', 'cobaltViolet'), pale: D('neutralTint', 0.94), mark: pig('roseMadder') },
        colSum: { back: M('rawUmber', 'neutralTint', 0.40), side: M('neutralTint', 'lemonYellow', 0.22), belly: D('neutralTint', 0.88) },
        colAut: { back: D('neutralTint', 0.88), side: D('neutralTint', 0.93), belly: D('neutralTint', 0.97) },
        group: [2, 6], spread: 9, hours: [5, 20], peak: 0.35, amp: 0.35, base: 0.65,
        hab: [0, 0.6, 1.0, 0.1], where: 'open', flee: 14, shy: 0.95, callR: 30,
        eats: ['shoots', 'berries'], hunts: [], eatenBy: ['eagle', 'lynx', 'fox'] },

      // 34. GOLDEN EAGLE -- the first time you meet it, it is BELOW you. It is the animal that makes height
      //     mean something, and it belongs to the owner's mile ask as much as to this one. It glides and
      //     circles on a thermal and almost never flaps.
      eagle: { plan: 'bird', guild: 'raptor', stage: 3, in: ['alpine_meadow', 'sea_coast', 'desert_canyon'],
        high: 0.45, span: 2.10, len: 0.85, mass: 4.5, bill: 0.06, soar: 1,
        col: { back: K('rawUmber', 'rawUmber'), side: M('rawUmber', 'quinGold', 0.30), belly: M('rawUmber', 'neutralTint', 0.30),
          dark: K('rawUmber', 'ultramarine'), pale: D('quinGold', 0.72), mark: D('quinGold', 0.55) },
        group: [1, 2], spread: 80, hours: [7, 19], peak: 0.46, amp: 0.35, base: 0.65,
        hab: [0.2, 0.3, 1.0, 0.3], where: 'any', flee: 90, shy: 0.60, callR: 50, far: 600,
        eats: ['hare', 'marmot', 'ibex kids', 'lambs'], hunts: ['ground', 'grazer', 'bird'], eatenBy: [] },

      // ====== THE CANYON (?beasts=3): nine kinds, and nine is the truth about the place =====================
      // It has no trees at all and bushes at 0.008 (its biome below). Its best animals use the ROCK and not
      // the plants, and most of them are out at dusk. The owner asked for twenty-five here and will get nine;
      // that has to be said to them before the work starts, not found out afterwards. Putting twenty-five
      // kinds in a canyon with nothing growing in it would be a lie about the place.

      // 35. DESERT BIGHORN -- it walks a ledge across a strata face, and that is what finally makes the
      //     canyon's size readable.
      bighorn: { plan: 'walker', guild: 'grazer', stage: 3, in: ['desert_canyon'],
        high: 0.90, legF: 0.55, len: 1.15, girth: 0.82, neck: 0.24, neckUp: 0.50, head: 0.24, snout: 0.65,
        ear: 0.10, earUp: 0.55, tail: 0.10, brush: 0.30, horn: 0.55, limbW: 1.05, coat: 90, marks: 'rump',
        col: { back: M('rawUmber', 'rawSienna', 0.40), side: M('rawSienna', 'yellowOchre', 0.35), belly: D('yellowOchre', 0.80),
          dark: K('burntUmber', 'cobaltViolet'), pale: D('yellowOchre', 0.88), mark: D('yellowOchre', 0.82) },
        mass: 80, group: [2, 4], spread: 13, hours: [5, 20], peak: 0.30, amp: 0.45, base: 0.55,
        hab: [0, 0.3, 1.0, 0.1], where: 'open', flee: 55, shy: 0.85, callR: 35,
        eats: ['canyon scrub'], hunts: [], eatenBy: ['canyoncat'] },

      // 36. CANYON CAT -- out only when the canyon's light has gone violet (cobaltViolet is already in its
      //     palette). It stalks on hot rock and lies up in shade by day.
      canyoncat: { plan: 'walker', guild: 'hunter', stage: 3, in: ['desert_canyon'],
        high: 0.70, legF: 0.58, len: 1.10, girth: 0.74, neck: 0.16, neckUp: 0.28, head: 0.22, snout: 0.58,
        ear: 0.08, earUp: 0.95, tail: 0.70, brush: 0.40, horn: 0, limbW: 1.00, coat: 82, marks: '',
        col: { back: M('rawSienna', 'rawUmber', 0.40), side: M('rawSienna', 'yellowOchre', 0.30), belly: D('yellowOchre', 0.82),
          dark: K('burntUmber', 'ultramarine'), pale: D('yellowOchre', 0.90), mark: K('burntUmber', 'burntUmber') },
        mass: 50, spread: 0, hours: [18, 7], peak: 0.00, amp: 0.60, base: 0.40,
        hab: [0, 0.3, 0.7, 0.2], where: 'any', flee: 45, shy: 0.95, callR: 40,
        eats: ['bighorn', 'tortoise', 'quail', 'lizard'], hunts: ['grazer', 'ground', 'bird'], eatenBy: [] },

      // 37. DESERT QUAIL -- a line of small round bodies trotting over hot rock, all turning at the same
      //     instant. It flies only if it is forced to.
      quail: { plan: 'bird', guild: 'bird', stage: 3, in: ['desert_canyon'],
        high: 0.14, span: 0.36, len: 0.22, mass: 0.17, bill: 0.015,
        col: { back: M('rawUmber', 'rawSienna', 0.35), side: M('rawSienna', 'yellowOchre', 0.40), belly: D('yellowOchre', 0.78),
          dark: K('burntUmber', 'ultramarine'), pale: D('yellowOchre', 0.90), mark: pig('turquoise') },
        group: [8, 14], spread: 5, hours: [5, 20], peak: 0.33, amp: 0.45, base: 0.55,
        hab: [0, 0.4, 1.0, 0.2], where: 'open', flee: 16, shy: 0.95, callR: 45,
        eats: ['seeds'], hunts: [], eatenBy: ['canyoncat', 'eagle', 'raven'] },

      // 38. COLLARED LIZARD -- it basks, does press-ups, and then runs away UPRIGHT ON TWO LEGS, which nobody
      //     expects and nobody forgets.
      lizard: { plan: 'walker', guild: 'ground', stage: 3, in: ['desert_canyon'],
        high: 0.05, legF: 0.45, len: 0.12, girth: 0.80, neck: 0.02, neckUp: 0.20, head: 0.04, snout: 0.70,
        ear: 0, earUp: 0, tail: 0.14, brush: 0.10, horn: 0, limbW: 0.55, coat: 14, marks: '',
        col: { back: M('turquoise', 'yellowOchre', 0.45), side: M('yellowOchre', 'turquoise', 0.30), belly: D('yellowOchre', 0.84),
          dark: K('burntUmber', 'ultramarine'), pale: D('lemonYellow', 0.70), mark: pig('turquoise') },
        mass: 0.08, group: [2, 6], spread: 9, hours: [8, 18], peak: 0.50, amp: 0.55, base: 0.45,
        hab: [0, 0.2, 1.0, 0], where: 'open', flee: 8, shy: 0.95, callR: 0,
        eats: ['insects'], hunts: [], eatenBy: ['canyoncat', 'raven', 'eagle'] },

      // 39. DESERT TORTOISE -- a warm ochre dome you take for a stone until it moves. The one thing in the
      //     game that is never in a hurry.
      tortoise: { plan: 'walker', guild: 'ground', stage: 3, in: ['desert_canyon'],
        high: 0.14, legF: 0.30, len: 0.30, girth: 1.15, neck: 0.05, neckUp: 0.25, head: 0.06, snout: 0.50,
        ear: 0, earUp: 0, tail: 0.03, brush: 0.10, horn: 0, limbW: 1.10, coat: 20, marks: '',
        col: { back: M('rawSienna', 'burntUmber', 0.35), side: M('rawSienna', 'yellowOchre', 0.30), belly: D('yellowOchre', 0.74),
          dark: K('burntUmber', 'burntUmber'), pale: D('yellowOchre', 0.86), mark: D('rawSienna', 0.40) },
        mass: 4, spread: 0, hours: [7, 18], peak: 0.42, amp: 0.40, base: 0.60,
        hab: [0, 0.4, 1.0, 0.1], where: 'open', flee: 3, shy: 0.30, callR: 0,
        eats: ['scrub', 'flowers after rain'], hunts: [], eatenBy: ['raven'] },

      // 40. TURKEY VULTURE -- it ROCKS and the eagle does not: two gliders told apart at a mile by nothing but
      //     the way they hold the air. Wings in a shallow V, and almost never a flap.
      vulture: { plan: 'bird', guild: 'crow', stage: 3, in: ['desert_canyon', 'sea_coast'],
        high: 0.50, span: 1.70, len: 0.70, mass: 2.0, bill: 0.05, soar: 1, rock: 1,
        col: { back: K('burntUmber', 'burntUmber'), side: K('burntUmber', 'cobaltViolet'), belly: K('burntUmber', 'ultramarine'),
          dark: K('burntUmber', 'ultramarine'), pale: D('cobaltViolet', 0.60), mark: M('burntSienna', 'alizarin', 0.40) },
        group: [2, 5], spread: 70, hours: [8, 19], peak: 0.50, amp: 0.40, base: 0.60,
        hab: [0, 0.2, 1.0, 0.2], where: 'any', flee: 70, shy: 0.55, callR: 20, far: 600,
        eats: ['carrion'], hunts: [], eatenBy: [] },
    },
  },

  biomes: [
    B('temperate_forest', 'Temperate Forest', 'forest',
      ['sapGreen', 'hookersGreen', 'quinGold', 'burntSienna', 'rawUmber', 'ultramarine', 'cobaltViolet'], 'cadScarlet',
      ['sapGreen', 'quinGold', 'rawUmber'], { tall: [0, 1], mist: 0.72,
        // (the oil look: a green wood in the autumn wood's hand: a floor of moss and grass greens over warm earth with
        // last year's leaves in it, the canopy's greens pure; one tree in six a conifer)
        oil: { pal: { low: [0.56, 0.46, 0.34], mid: [0.60, 0.52, 0.34], high: [0.58, 0.50, 0.36], litter: [0.80, 0.70, 0.36], canopyA: [0.74, 0.88, 0.36], canopyB: [0.46, 0.74, 0.32],
          grassLight: [0.82, 0.90, 0.38], grassMid: [0.58, 0.78, 0.34], moss: [0.44, 0.64, 0.32], mud: [0.48, 0.40, 0.32] }, tallMix: 0.84,
          // THE GREEN WOOD AND THE GOLD WOOD ARE ONE WOOD IN TWO DRESSES -- same terrain recipe, same tree kits,
          // differing only in palette and in which of the two leaf dresses they wear. So they keep ONE list of
          // animals between them, which is why the five built first furnish a third of Earth's biomes on their
          // first day. If you change one of these two lists, change the other.
          over: {
            // ---- WHAT LIVES HERE (?beasts=N; the kinds are `fauna` above) ---------------------------------
            // In GROUPS PER HECTARE, BY NAME -- never by position (the warning at the head of common.js). It is
            // groups and not animals because animals arrive in groups, and how big a group is is the kind's own
            // `group`. The placer wants groups per square kilometre; common.js faunaRoster multiplies by a hundred,
            // so that the number written here is the one a person can picture. MEASURED over the 220 m ring the
            // routines call the near band (15.2 hectares: src/physics/fauna.js FAUNA.band): deer at 0.15 is 2.3
            // groups, which is about eleven deer and a group in sight most of the time; hare at 0.40 is nine hares;
            // lynx at 0.008 is one in eight ringfuls, which is why you almost never see one. `?lifedens=` scales
            // the whole table at once without anybody editing it.
            // THE WOOD HOLDS TWENTY-TWO KINDS. The far tier's colour table holds SIXTEEN (beastkit.js MAX_SPECIES),
            // so either that number is raised or the far tier paints only the first sixteen of this list. ?beasts=1
            // stands five of them and is well inside it.
            life: { deer: 0.15, fox: 0.05, hare: 0.40, heron: 0.06, trout: 0.10,
              raven: 0.06, boar: 0.05, wolf: 0.012, lynx: 0.008, squirrel: 0.30, marten: 0.02, badger: 0.03, owl: 0.03, goshawk: 0.015,
              kingfisher: 0.05, teal: 0.03, otter: 0.02, frog: 0.10,
              midge: 0.04, swallow: 0.03, butterfly: 0.06, starling: 0.004 },
          } } }),      // (less air than the planet's 185 m: the back of the wood steps toward the paper in bands; PAINTER 14: 0.95 -> 0.72, the wood's depths and the sky over it go paler)
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
          // (2026-11-19: THE SIX THE OWNER CHOSE now stand in this wood. floraplace.js reads this list in PAIRS --
          //  the grove field picks one pair and mixes between its two -- so they are paired on purpose:
          //    the round maple with the spruce, which is the wood's ordinary mixture of leaf and dark needle;
          //    the great oak with the young sapling, which is a glade: one huge tree and the young around it;
          //    the birch with the poplar, which is a stand of pale verticals.
          //  The willow is NOT here: it belongs by water and costs half as much again to draw, so it stands in
          //  the misty wetland instead. The four kits of 18 Nov stay in the data and are no longer planted here.)
          over: { mist: 1.4, tallOil: [4, 1, 6, 9, 7, 5],
            // (the same list as the green wood's above, and for the same reason: one wood in two dresses. The
            //  river runs through both of them, which is what gives a wood a heron, a kingfisher and trout.)
            life: { deer: 0.15, fox: 0.05, hare: 0.40, heron: 0.06, trout: 0.10,
              raven: 0.06, boar: 0.05, wolf: 0.012, lynx: 0.008, squirrel: 0.30, marten: 0.02, badger: 0.03, owl: 0.03, goshawk: 0.015,
              kingfisher: 0.05, teal: 0.03, otter: 0.02, frog: 0.10,
              midge: 0.04, swallow: 0.03, butterfly: 0.06, starling: 0.004 },
          },
          // (the clip's wood is broadleaves in autumn leaf with a white birch here and there: nearly nine trees in ten;
          // its tufts and small plants are yellow-green in the sun and deep green in the shade)
          // (tallMix over 1: the groves of conifers go too; a conifer is one tree in thirty. With 0.88 whole stands were
          // still conifers, and three of the wood's stills had no autumn leaf overhead at all: the critic)
          // (2026-11-18: was [1.5, 1.05], which put a conifer at one tree in thirty - and the rendered still then
          //  measured conifers at 0.6 per cent of the aerial picture against 5.1 in the owner's paintings. A plain
          //  0.85 makes about one tree in six a spruce everywhere, and floraplace.js's own grove field still swings
          //  that from none to most of a stand, so there are groves of dark among the orange as the references show.)
          tallMix: 0.85, under: { leaf: [[0.84, 0.90, 0.34], [0.58, 0.78, 0.30], [0.34, 0.54, 0.28]], bush: [[0.97, 0.88, 0.36], [0.95, 0.68, 0.28], [0.84, 0.44, 0.26]],
            // (this biome makes its own undergrowth materials, so it needs its own two dresses or it keeps the
            //  forest's and its own washes above are thrown away the moment the year turns)
            leafSum: [[0.84, 0.90, 0.34], [0.58, 0.78, 0.30], [0.34, 0.54, 0.28]], leafAut: [[0.95, 0.84, 0.38], [0.84, 0.62, 0.30], [0.66, 0.46, 0.30]],
            bushSum: [[0.66, 0.80, 0.36], [0.46, 0.66, 0.34], [0.26, 0.44, 0.34]], bushAut: [[0.97, 0.88, 0.36], [0.95, 0.68, 0.28], [0.84, 0.44, 0.26]] } } }),
    B('alpine_meadow', 'Alpine Meadow and Snow Peaks', 'alpine',
      ['sapGreen', 'lemonYellow', 'cobaltBlue', 'neutralTint', 'rawUmber', 'cobaltViolet'], 'roseMadder',
      ['sapGreen', 'neutralTint', 'cobaltBlue'], { t: { amp: 470, wl: 1000, snow: 185, dil: 0.24, patch: [{ c: [0.40, 0.54, 0.36], wl: 26, thr: 0.0, soft: 0.3, amt: 0.65 }, { c: [0.92, 0.88, 0.50], wl: 10, thr: 0.2, soft: 0.25, amt: 0.5 }] }, mist: 4.5, tall: [1, 1], tallD: 0.22, tallMix: 1, tallMax: 150, small: { grass: 0.4, flower: 0.16, rock: 0.05, bush: 0.045 },
        under: { rock: [[0.60, 0.61, 0.66], [0.34, 0.35, 0.44]] },     // (granite grey with a violet shadow, a step below the turf, in the meadow's cool palette)
        // THE MOUNTAINS (the owner, 2026-11-19: "the rest of earth not just the forests starting with the mountains
        // they should be a special focus"). In the oil look only; the watercolour game keeps the numbers above.
        // What the first still showed, from the meadow at ten in the morning: the peaks were a DISTANT FRIEZE, barely
        // a fifth of the picture's height, with no snow on them but one cap -- in a place the game itself calls
        // "Alpine Meadow and SNOW PEAKS" -- and their faces read as MOTTLED CAMOUFLAGE, green and grey and violet in
        // patches of ten to twenty-six metres, with no form at any larger size.
        //   amp 470 -> 920, wl 1000 -> 820: the peaks stand about twice as high and their ridges are closer
        //     together, so from the meadow they fill the view instead of edging it.
        //   snow 185 -> 300: a snowline that sits ON the new peaks. The references ask for "the snow mountains the
        //     lightest thing in the picture" (Sohlberg, reference 26).
        //   strata 0.55: beds of unequal thickness following the height, strongest on steep faces (the mechanism the
        //     canyons already use). This is what makes rock read as rock rather than as a mottled surface.
        //   the patches' wavelengths 26 and 10 -> 110 and 40 m: at ten metres a patch is camouflage on a face a
        //     kilometre off; at a hundred it is the mass of one buttress against the next.
        //   SECOND LOOK (the still above the new peaks): the range read as SUGAR ICING -- cream, mint and lilac, with
        //     nothing dark in the picture at all. Two causes, both in the numbers above:
        //       the three ground colours are sapGreen, neutralTint and COBALT BLUE, each DILUTED a quarter toward
        //       the paper (`dil`), so the high rock was a thinned blue; and
        //       the snowline at 300 on peaks that now reach 960 put snow over two thirds of the mountain.
        //     So in the oil look the high ground is RAW UMBER and NEUTRAL TINT -- rock brown into cold grey -- at a
        //     tenth of the dilution, and the snow sits at 560, which leaves the lower half of every peak as dark
        //     rock. The references want "the snow mountains the lightest thing in the picture" (Sohlberg), and that
        //     asks for everything else to be DARKER, not for more white.
        oil: { over: { ground: ['sapGreen', 'rawUmber', 'neutralTint'],
          // THIRTEEN KINDS on the mountain (in groups per hectare, by name; see the green wood above). The ibex
          // is the darkest thing you can put on snow the references want to be the lightest thing in the
          // picture, and the eagle is the one animal you meet from ABOVE. The trout is here for a tarn that
          // does not exist yet: without one, `wants: 'water'` finds nowhere and places none -- which is the
          // right failure, not a wrong one.
          life: { ibex: 0.05, marmot: 0.12, ptarmigan: 0.08, eagle: 0.006, hare: 0.35, fox: 0.04, wolf: 0.008,
            lynx: 0.005, raven: 0.05, deer: 0.06, trout: 0.04, butterfly: 0.12, swallow: 0.02 },
          t: { amp: 920, wl: 820, snow: 560, dil: 0.10, strata: 0.55,
          //   THIRD LOOK, and a fault of my own making: the slopes read as big merged blobs, and I took that for
          //     dabs the size of a house. MEASURED, it was nothing of the kind -- a dab is 6 to 7 pixels across.
          //     What had merged was the COLOUR: lengthening these wavelengths to 110 and 40 m (above) to kill the
          //     camouflage gave every dab within a hundred metres of its neighbour the same wash, so they joined
          //     into shapes the size of a buttress. 48 and 20 m is the middle ground: too long to mottle a far face,
          //     too short to let a slope set as one colour.
          patch: [{ c: [0.40, 0.54, 0.36], wl: 48, thr: 0.0, soft: 0.3, amt: 0.62 },
                  { c: [0.86, 0.84, 0.56], wl: 20, thr: 0.2, soft: 0.28, amt: 0.42 }] } } } }),
    B('sea_coast', 'Sea Cliffs and Coast', 'coast',
      ['cerulean', 'ultramarine', 'viridian', 'yellowOchre', 'rawUmber', 'davysGrey'], 'cadOrange',
      ['yellowOchre', 'oliveGreen', 'davysGrey'], { t: { cliff: 52, stacks: 0.5, strata: 0.5 }, mist: 4, under: { leaf: [[0.88, 0.87, 0.52], [0.70, 0.75, 0.44], [0.46, 0.56, 0.42]] }, liquid: { color: [0.52, 0.72, 0.84], refl: 0.6 }, tall: [1, 0], tallD: 0.10, tallMix: 0.7, small: { grass: 0.45, rock: 0.05, bush: 0.05, flower: 0.03 },
      // FIFTEEN KINDS on the coast (in groups per hectare, by name; see the green wood above). The gulls hang
      // motionless in the lift off the 52 m cliff above -- that lift is the real wind field and not an
      // animation, and it is the cheapest spectacular thing in the whole list. Sixty gulls on a stack is one
      // field read and sixty bodies solved in the shader, not sixty solves.
      oil: { over: { life: { gull: 0.02, seal: 0.015, cormorant: 0.03, crab: 0.06, sheep: 0.08, fox: 0.03,
        raven: 0.05, hare: 0.25, heron: 0.04, teal: 0.02, otter: 0.015, eagle: 0.004, vulture: 0.004,
        swallow: 0.03, herring: 0.006 } } } }),
    B('desert_canyon', 'Desert Canyon', 'canyon',
      ['burntSienna', 'rawSienna', 'yellowOchre', 'cobaltViolet', 'ultramarine', 'burntUmber'], 'turquoise',
      ['yellowOchre', 'rawSienna', 'burntSienna'], { t: { strata: 1, amp: 210, wl: 600, steps: 3, dil: 0.2 }, mist: 5, small: { rock: 0.035, grass: 0.03, bush: 0.008 }, phys: { ground: 'sand' },
        under: { leaf: [[0.88, 0.84, 0.56], [0.74, 0.72, 0.46], [0.54, 0.54, 0.40]], bush: [[0.86, 0.84, 0.66], [0.74, 0.72, 0.56], [0.60, 0.58, 0.48]], rock: [[0.86, 0.66, 0.52], [0.52, 0.34, 0.32]], accent: [0.30, 0.70, 0.69] },
      // NINE KINDS, AND NINE IS THE TRUTH ABOUT THIS PLACE (in groups per hectare, by name; see the green wood
      // above). The owner asked for twenty-five in every biome; this one has no trees at all and bushes at
      // 0.008, three lines up, so there is next to nothing here to eat. Twenty-five kinds in an empty canyon
      // would be a lie about the place. Water here -- a seep, a pour-over pool, a fall in a side canyon --
      // would honestly add three or four more (frogs, dragonflies, swifts at the fall).
      oil: { over: { life: { bighorn: 0.03, canyoncat: 0.006, quail: 0.05, lizard: 0.10, tortoise: 0.02,
        vulture: 0.008, eagle: 0.004, fox: 0.025, raven: 0.04 } } } }),
    // (PAINTER 14: the reeds stand in beds with mud and water between them (floraplace.js), their feet in a deeper olive: the
    // bed's shade is the frame's one dark; an even comb of straw strokes with no dark was ARTPASS weakest 1)
    B('misty_wetland', 'Misty Wetland', 'wetland',
      ['oliveGreen', 'viridian', 'rawUmber', 'paynesGrey', 'yellowOchre', 'davysGrey'], 'lemonYellow',
      ['oliveGreen', 'rawUmber', 'davysGrey'], { mist: 0.45, under: { leaf: [[0.82, 0.82, 0.46], [0.64, 0.66, 0.38], [0.34, 0.38, 0.30]], accent: [0.93, 0.86, 0.40] }, liquid: { color: [0.74, 0.82, 0.84], refl: 0.9 }, tall: [0, 0], tallD: 0.08, tallMix: 1, small: { reed: 0.5, grass: 0.3, fern: 0.12, bush: 0.03 },
        // (2026-11-19: THE WEEPING WILLOW stands here, among young trees. The owner chose it from the sheet of ten
        //  and was told it costs about half as much again as the others to draw; a wetland is where it belongs and
        //  is small enough that its cost stays where it is put.)
        oil: { over: { tallOil: [8, 9],
          // SIXTEEN KINDS in the wetland (in groups per hectare, by name; see the green wood above). This is
          // the richest water in the game and it is where the owner's "fish and the things that eat fish" is
          // most fully answered: a heron and an otter working the same pool, a kingfisher on a willow twig, and
          // a beaver that fells one of the willows above and leaves it felled after a save.
          life: { heron: 0.10, kingfisher: 0.06, teal: 0.06, otter: 0.03, beaver: 0.02, frog: 0.15,
            dragonfly: 0.10, midge: 0.08, swallow: 0.04, starling: 0.005, fox: 0.03, raven: 0.04, owl: 0.02,
            trout: 0.08, boar: 0.03, cormorant: 0.02 } } } }),
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
