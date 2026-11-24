// Painted Cosmos: instanced flora in streamed chunks. OWNER: PAINTER.
//
// Cost is the design constraint here (lead review 1): every tree is submitted exactly once,
// in the tier its own distance puts it in.
//   tier 0  near: the full tree (about 650 triangles)
//   tier 1  mid: a trunk and two washes (about 180 triangles)
//   far     one shared form for every species, batched by far cell. In the WATERCOLOUR game, beyond the
//           thinning distance only one tree in three is kept and drawn larger ("fewer, larger, softer
//           strokes"); in the OIL look every tree is drawn out to T_FAR and nothing is grown, and a far
//           cell is four tree cells to a side instead of two so the trees that come back cost no more
//           draw calls (?farfill=0, ?farcell=2: the thinned ring and the small cell, for a side-by-side)
// Tiers are assigned per tree on the CPU whenever the camera has moved a few metres, into
// dynamic instance buffers, so nothing is drawn collapsed. Undergrowth lives in 25 m cells,
// one mesh per kind, and grows in stroke by stroke as you approach.
import * as THREE from 'three';
import { getSurface } from './surface.js';
import { dirToFace, faceToDir, nodeSize } from './cubesphere.js';
import { INST_STRIDE, U_GRASS, U_FERN, U_BUSH, U_ROCK, U_FLOWER, U_STONE, U_REED, U_SHARD } from './floraplace.js';
import { SEASON, leafNow } from '../data/season.js';
import { FLORA_PHYS, TALL_KITS, farCardGeometry, farBlobGeometry, sortLeafCards, leafDrawCount, farTreeGeometry, grassGeometry, grassPatchGeometry, reedGeometry, fernGeometry, bushGeometry, rockGeometry, flowerGeometry, shardGeometry } from './florakit.js';
import { makePropMaterial, TREE_DEPTH } from '../render/materials.js';
import { treeCell, underCell, hasCell, TREE_LEVEL, UNDER_LEVEL } from './obstacles.js';
import { QUALITY, G, LOOK, SCREEN, SHADOW } from '../render/shared.js';
import { SHADOW_LAYER } from '../render/shadow.js';
import { FELLED, FELL, felledAt, fallingOn, felledOn, fallTurn } from '../data/felled.js';

// tier ranges in metres at quality 2; scaled by RANGE_SCALE at lower tiers
const T0 = 90, T1 = 190, T_THIN = 420, T_FAR = 600;      // (were 52, 128, 300, 470 while there was a triangle budget; on these small worlds the ground hides a tree beyond about 480 m unless it stands on a hill)
const UNDER_FAR = 110, GRASS_NEAR = 15;                  // (60 under the budget)
const RELIEF = 250;            // (R1 W2.3) metres the ground in an undergrowth cell's reach may stand above the ground under the eye
// (?trees=full: the oil look's trees as they were before their detail followed the screen, for comparisons)
const TREES_FULL = typeof location !== 'undefined' && /[?&]trees=full\b/.test(location.search || '');
// THE OIL LOOK'S FAR TREE is built of flat pieces, each painted once (florakit.js farCardGeometry): on the owner's phone
// it costs as little as having no far trees at all, where the lump painted for every pixel was 3.6 ms of an 18 ms frame
// (speed test 6, 2026-11-17), and across a river the lump read as a smooth orange blob where this reads as leaves.
// (?fartree=lump: the lump, as it was until 2026-11-17, for comparisons.)
const FAR_LUMP = typeof location !== 'undefined' && /[?&]fartree=lump\b/.test(location.search || '');
// (2026-11-19) the far tree as ONE CARD with spherical normals, painted by the look's own dab shader -- 10
// triangles against 138. It was built then, measured then, written up in florakit.js as keeping "the dabbed crown
// the owner approved", AND LEFT OPT-IN. It stayed opt-in for four days.
//
// 2026-11-23, THE OWNER'S OWN PHONE (speed test 9, Adreno 740): the game runs at TEN frames a second, 101 ms a
// frame, of which the script is 11.3 ms and the draw calls nothing like the cost -- 2,022,000 TRIANGLES a frame
// is. COUNTED HEADLESS at the autumn spawn, tier 1: the far trees alone are 816,132 of the scene's 1,710,839,
// FORTY-EIGHT PER CENT OF EVERYTHING DRAWN, against the near trees' 263,364. With the one card they are 82,796
// and the scene is 977,503: a cut of 733,336 triangles, FORTY-THREE PER CENT OF THE WHOLE SCENE, from a switch
// that was already written. On a phone's tile GPU a triangle under about eight pixels wastes most of a quad, so
// this is the single biggest thing that can be done without touching what the wood IS.
// (?fartree=card is the 138-triangle tree it replaces, for an A and a B; ?fartree=lump is the old lump.)
// NOT THE DEFAULT, AND THE PICTURE IS WHY. SEEN 2026-11-23, the same camera over the autumn wood at noon,
// 900x520, A and B: with the one card the far crowns go SMOOTH AND FACETED -- flat lozenges with straight edges,
// paper cut-outs where the shingled tree is ragged and leafy. The dab shader does not cut the crown's edge the
// way the note in florakit.js says it does. That note was written from arithmetic and intent and NOBODY HAD
// LOOKED; the still disproved it in one frame. The project's own rule caught it: built is not seen.
// It stays opt-in, for the speed test and for comparisons.
const FAR_BLOB = typeof location !== 'undefined' && /[?&]fartree=blob\b/.test(location.search || '');
const FAR_CARDS = !FAR_LUMP;
// THE TREES TO 30 A SECOND (?trees2=, 2026-11-24; docs/lead/TREES-DESIGN.md on r2, package T2; the oil look only).
//   ?trees2=1 or split: the near and middle trees drawn by TWO SHORT PROGRAMS, one for the wood and one for the leaves
//     (materials.js WOOD_FRAG, LEAF_FRAG), with the wood's haze of hair twigs not built (kits/grove.js): the same
//     leaves, the same skeleton, the same paint.
//   ?trees2=cards: that, with the near tree's leaves as CLUSTERS on cards (kitbuild.js clusterCard).
// Without it (or ?trees2=0) every tree is exactly what it was. The speed test swaps it while it runs (setTrees2).
const TREES2 = (() => {
  if (typeof location === 'undefined' || !location.search) return '';
  const q = new URLSearchParams(location.search).get('trees2');
  return q === '1' || q === 'split' ? 'split' : q === 'cards' ? 'cards' : '';
})();
// (only a kind whose crown is leaves one by one, and nothing else, can be split: parts 0 bark, 5 leaf, 6 snow on a
//  bough. A kind with crowns of washes (part 1: the green wood's conifer) keeps the one program.)
function splittable(geos) {
  for (const g of geos) { const d = g.attributes.aData.array; for (let i = 1; i < d.length; i += 4) { const p = d[i]; if (!(p < 0.5 || (p > 4.5 && p < 6.5))) return false; } }
  return true;
}
// Wood first, then the leaves (sortLeafCards already orders them so: everything that is not a leaf, then the leaves by
// number), as two groups of one index, one for each program.
// (?treedepth=1, package T5: the cards of leaves laid in depth first, render/index.js; only with ?trees2=cards)
const TREEDEPTH = typeof location !== 'undefined' && /[?&]treedepth=1\b/.test(location.search || '');
const HIDDEN = new THREE.MeshBasicMaterial({ visible: false });      // (the wood's place in the depth pass: not drawn)
function hasPart(geo, part) { const d = geo.attributes.aData.array; for (let i = 1; i < d.length; i += 4) if (Math.abs(d[i] - part) < 0.5) return true; return false; }
function splitGroups(geo) {
  const base = geo.userData.leaf ? geo.userData.leaf.base : geo.index.count;
  geo.clearGroups(); geo.addGroup(0, base, 0); geo.addGroup(base, geo.index.count - base, 1);
  return geo;
}
const RANGE_SCALE = [0.28, 0.6, 1.0];                    // (the lower tiers keep the ranges they had)
const TRIM = [1, 1];          // (was [0.82, 0.88] to pay for a triangle budget; the owner withdrew the budget: trees hand over where they read best)
const WASH_T = 0.55;                   // seconds a new thing takes to wash in, and a tree to change hands between two tiers
const HOLD_MAX = 6;                    // seconds a built cell waits at most for its ground to be on the paper
// How many falling trees are laid again in one frame (the rest take their turn on the next): see _fall.
const FALL_RELAY = 10;
const RANK = { far: 0, near: 1, under2: 2, under: 3 };   // what is built first: the far masses, the trees, then what grows under them
const JIT = 0.3;                       // each tree switches tier at its own distance
const SHARED = ['position', 'normal', 'uv', 'aMass', 'aData', 'aBranchId', 'aLeaf01', 'aCard'];     // (the last two: trees only, PHYSICS' crown)
// the shared far form sized per kit: width, height (metres at instance scale 1), taper
// (2026-11-18: the four new kinds of tree. A kind with no size here has no far form at all and the wood throws as it
//  is built - found by rendering, not by a test, because the tests build a tree and the game builds a WOOD.
//  [across, high, taper]: a maple is wider than it is tall, a spruce narrow and tapering to a spike, a pine taller
//  still and bare low down.)
// (?treedist=, 2026-11-18: how far the tree-detail ranges may grow once the picture is taller than 1080 lines.
//  0.8 was measured to cut the frame's triangles by a quarter on foot and a third from the air, for a handover that
//  moves 18 m. 1 is the behaviour before this.)
const TREE_DIST = (() => { const q = typeof location !== 'undefined' && location.search ? new URLSearchParams(location.search).get('treedist') : null; const n = q == null ? NaN : +q; return isFinite(n) && n >= 0.5 && n <= 1 ? n : 0.8; })();
// THE FAR BAND IS FILLED (the owner, 2026-11-22: "I want things to look high quality and fully rendered even from 300
// yards away"). 300 yards is 275 m, and 275 m fell inside the thinned ring. On the owner's phone the far trees' range
// comes out at 281 m and the thinning distance at 197 m (T_THIN/T_FAR of it), so between 197 m and 281 m -- the very
// band the owner is asking about -- ONE TREE IN THREE was drawn, each grown half again as wide and a seventh taller to
// cover for the two that went. Trees arriving one by one as the player walks forward is exactly the "sharpens as you
// walk towards it" they are complaining of, and this file's own measured study (in _retier below) says the GROWING is
// where the fill was lost, not won: thinning the far tier cut triangles by half and put shaded pixels UP by half.
// So in the oil look there is no thinned ring: the far tier holds every tree out to T_FAR and nothing is grown.
// COUNTED by driving the real autumn wood in Node at the phone's own picture (576 lines, quality 1): the far tier
// goes from 3,908 instances all round the eye to 5,868, half again as many, in the same meshes -- and in the band
// itself the painted area goes UP by about three quarters, because a tree no longer stands in for three at 1.5 times
// the width and 1.15 times the height. The phone is CPU-bound, so that is spent where there is room; the draw calls
// below are what is bought back. It has NOT been timed on the owner's device: bench=1 must say.
// (?farfill=0: the thinned ring as it was, for a side-by-side. The watercolour game keeps it either way.)
const FAR_FILL = (() => { const q = typeof location !== 'undefined' && location.search ? new URLSearchParams(location.search).get('farfill') : null; return q == null ? 1 : (+q ? 1 : 0); })();
// WHAT THE FILL IS PAID FOR WITH: fewer, larger far cells, so the trees that come back cost no more DRAW CALLS, which
// is what the owner's own speed test says the far trees really cost -- 3 ms of a 9.6 ms script in 28 far-tree meshes,
// where triangles on that device have twice measured as free. A far cell four tree cells to a side instead of two is a
// quarter as many meshes for the same wood. COUNTED in the same Node run as above: 56 far-tree meshes all round the
// eye become 18, and the 28 the owner's own table counted inside the view become about 9. The watercolour game keeps
// the cell it has, so its draw order and its felling costs are untouched.
// (?farcell=2: the small cell, for a side-by-side. Only 2 or 4: the far cell's key and _release's walk up from a tree
//  cell are shifts, so the span must be a power of two.)
const FAR_SPAN = (() => { const q = typeof location !== 'undefined' && location.search ? new URLSearchParams(location.search).get('farcell') : null; const n = q == null ? NaN : +q; return n === 2 ? 2 : 4; })();

// THE OUTER UNDERGROWTH'S CELL, the same trade the far trees took in v13 and for the same measured reason.
// MEASURED 2026-11-23 in the autumn wood, oil look: of a frame's 232 draw calls, 38 were undergrowth -- more than
// the shadow pass (27) and more than every tall tree put together (38 across four kits). The undergrowth is drawn
// in two tiers: a fine one out to about 44 m, and an outer one to UNDER_FAR. The outer tier's cell was two
// undergrowth cells to a side; at four it is a QUARTER as many meshes for exactly the same plants in exactly the
// same places, because floraplace.js lays a plant from its position in the world and not from the cell it lands in
// (the far trees' own note above says the same, and 56 far meshes became 18 when their cell was widened).
// What it costs: an outer cell holds four times as many plants, so it is built and freed in bigger lumps -- the
// world's 5 ms slice absorbs that, and the tier is beyond 44 m where a wash-in is not watched.
// (?undercell=1 is the old pair, for an A and a B of the draw calls. The WATERCOLOUR GAME KEEPS THE OLD CELL
//  whatever the address says, so the live game's draw order and its own costs are untouched.)
const UNDER2_SHIFT = (() => {
  try { const q = new URLSearchParams(location.search).get('undercell'); const n = q == null ? NaN : +q;
    if (n === 1) return 1; if (n === 2) return 2; } catch { /* no address */ }
  return 2;
})();

// WHICH KITS ARE DRAWN FAR OFF AS LEAF CARDS and not as the old lump (the oil look's far tree, v13). A kit left out
// of this is silently given the lump, which is why it sits beside FAR_DIMS: both must name every tall kit there is.
// which kits have a WOODEN STEM worth drawing in the branch pass, and which get a trunk on their far card.
// (Named and exported so grove.test.mjs can hold every kit in TALL_KITS to them: a kit missing from a list like
//  these is invisible -- on 2026-11-18 it cost the far wood 6.6 million triangles of detail and nobody could see
//  why. A chain of `sp.kit === ...` cannot be checked by a test; a Set can.)
export const BRANCHY = new Set(['broadleaf', 'conifer', 'fungus', 'kelp', 'maple', 'spruce', 'aspen', 'tallpine',
  'roundmaple', 'poplar', 'oak', 'birch', 'willow', 'sapling']);
export const FAR_TRUNK = new Set(['broadleaf', 'conifer', 'fungus', 'maple', 'spruce', 'aspen', 'tallpine',
  'roundmaple', 'poplar', 'oak', 'birch', 'willow', 'sapling']);

export const CAN_CARD = { broadleaf: 1, conifer: 1, maple: 1, spruce: 1, aspen: 1, tallpine: 1,
  roundmaple: 1, poplar: 1, oak: 1, birch: 1, willow: 1, sapling: 1 };

export const FAR_DIMS = {
  // (the six of 2026-11-19, kits/grove.js. MEASURED over twelve seeds at lod 0: across, high, taper)
  roundmaple: [11.7, 7.8, 0], poplar: [7.3, 15.5, 0.30], oak: [18.1, 9.9, 0], birch: [12.3, 9.9, 0],
  willow: [14.7, 10.3, 0], sapling: [6.4, 4.9, 0],
  maple: [15.5, 12.0, 0], spruce: [9.5, 16.0, 0.86], aspen: [12.0, 13.5, 0], tallpine: [12.0, 19.0, 0.62],
  broadleaf: [13.5, 11.8, 0], conifer: [14.5, 16.5, 0.8], fungus: [12, 14, 0.1], crystal: [5, 6.5, 0.85], spire: [6.5, 13, 0.86], kelp: [4, 10, 0.5], wave: [11, 6.0, 0.12], vine: [7.5, 9, 0.25] };     // (PAINTER 14: a far frozen wave a long low ridge, not a cone: [8, 7.5, 0.5] stood as a row of snow peaks)

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3();
const _Y = new THREE.Vector3(0, 1, 0);
const _ft = [0, 0, 0, 1], _falling = [];      // (the powers: a felled tree's turn; the trees falling now)
const _felledAll = [];                        // (every felled tree of this world, read when the list changes)
const _ff = {}, _dd = [0, 0, 0], _laid = new Array(FAR_SPAN * FAR_SPAN).fill(false);

export class Flora {
  constructor(bodyId, root, bodyUniforms) {
    this.S = getSurface(bodyId);
    this.R = this.S.R;
    this.group = new THREE.Group();
    this.group.name = 'flora-' + bodyId;
    root.add(this.group);
    this.camLocal = new THREE.Vector3();
    this.lead = new THREE.Vector3();        // where the eye is going (world/index.js): what is built, never what is drawn
    this.leadOn = false;
    this.treeChunks = new Map(); this.farChunks = new Map(); this.underChunks = new Map(); this.under2Chunks = new Map();
    this.treeList = [];
    this.queue = [];
    this.lastTreeEval = new THREE.Vector3(1e9, 0, 0); this.lastUnderEval = new THREE.Vector3(1e9, 0, 0);
    this.treeSize = nodeSize(this.R, TREE_LEVEL); this.underSize = nodeSize(this.R, UNDER_LEVEL);
    // (how many tree cells to a side go under one far cell, and the shift from a tree cell's index to its far cell's:
    //  two in the watercolour game, four in the oil look, where the far band is filled -- see FAR_SPAN above)
    this.farSpan = LOOK.oil ? FAR_SPAN : 2;
    this.farShift = this.farSpan === 4 ? 2 : 1;
    this.farFill = !!(LOOK.oil && FAR_FILL);
    this.farSize = this.treeSize * this.farSpan;       // far trees are batched in cells this many tree cells to a side
    this.rangeScale = 1; this.treeScale = 1; this.farScale = 1; this.lastScale = -1; this.benchTreeK = null;
    // (the speed test's handle on the near trees' index, core/bench.js: 'leaves' draws a tall mesh from its first leaf
    //  card on, 'wood' only what comes before it -- sortLeafCards puts every piece of wood first. null: the whole tree.)
    this.benchNear = null;
    this.lastLaid = -10; this.washNow = 1; this._washWall = 0;
    this.lastRelease = -10;
    this.held = [];                    // cells that are built and wait for their ground (see update)
    this._origins = new Map();         // (R1 W2.3) where undergrowth cells lie that were looked at and not wanted
    this.groundReady = null;           // (face, u, v) -> is the ground there on the paper as it will stay (set by the world)
    this.focusV = new THREE.Vector4(); this._focusFrame = -1; this._focusCam = null;       // the wash clock (s): real time, in steps of at most 0.1 s (it runs when the wind's clock is frozen too)
    this.retierCursor = 0;
    this.starved = 0;
    this.hidden = false;
    this.prof = { wanted: 0, build: 0, retier: 0 };
    // (what one build step of each kind has been costing, ms. A far step lays every tree of its cell, so the larger
    //  cell starts from a larger guess -- it is only the queue's first guess and is measured from then on.)
    this.est = { near: 1.0, far: this.farSpan === 4 ? 3.0 : 1.0, under: 2.5, under2: 2.5 };

    this.bodyUniforms = bodyUniforms;
    this.look = this.S.look.flora || { tall: [], under: null };
    this.ready = false;
  }

  // Kits and materials are made the first time the body is visited.
  _init() {
    this.ready = true;
    const bodyUniforms = this.bodyUniforms, L = this.look;
    // (the oil look may give a kind its own form and washes: a species' `oil` entry, laid over it; where trees stand,
    // their sizes and what the explorer bumps into stay the species' own: floraplace.js, obstacles.js)
    // (and in the oil look every broadleaf's crown is leaves one by one: florakit.js `leafy`)
    // (`oilLook`: the kits that are SHARED with the watercolour game read this to know which game they are building
    //  for. The broadleaf and the conifer are the live game's own trees, so anything their shape gains for the oil
    //  look -- boughs sampled off a curve rather than drawn as two straight bars -- must be behind it, or the
    //  watercolour game changes and the pixel gate says so.)
    const TALL = L.tall.map((sp) => (LOOK.oil ? Object.assign({}, sp, { oilLook: 1 }, sp.kit === 'broadleaf' || sp.kit === 'maple' || sp.kit === 'aspen' ? { leafy: 1, double: 1 } : null, sp.kit === 'roundmaple' || sp.kit === 'poplar' || sp.kit === 'oak' || sp.kit === 'birch' || sp.kit === 'willow' || sp.kit === 'sapling' ? { double: 1 } : null, sp.oil) : sp));
    this.tall = TALL;
    this.species = TALL.map((sp, i) => {
      const mo = { name: 'tall-' + sp.kit + i, barkA: sp.bark[0], barkB: sp.bark[1], leafA: sp.leaf[0], leafB: sp.leaf[1], leafC: sp.leaf[2], barkP: sp.barkP, leafP: sp.leafP, accent: sp.accent, oilDark: sp.dark || null, oilFam: sp.fam || null, oilKind: sp.snowy ? 1 : sp.bare ? 2 : 0, wind: sp.wind == null ? 0.03 : sp.wind, doubleSide: !!sp.double, phys: sp.kit === 'vine' ? null : 'lite', branch: BRANCHY.has(sp.kit), stiff: sp.kit === 'kelp' ? 0.1 : 1, plantHeight: (FAR_DIMS[sp.kit] || [0, 10])[1], gem: sp.kit === 'crystal',
        // (the last fixes: a spire parts round an eye inside it; its girth at the foot, height and lean, florakit.js spireGeometry)
        hollow: sp.kit === 'spire' ? (sp.slim ? [1.3, 10.5, 0.3] : [2.0, 12, 0]) : null };
      const mat = makePropMaterial(bodyUniforms, mo);
      mat.userData.pcCasts = true;
      const gen = TALL_KITS[sp.kit];
      const fd = sp.farD || (sp.kit === 'crystal' && sp.thin ? [1.8, 8, 0.9] : FAR_DIMS[sp.kit]);      // (farD: a kind's own far size [across, high, taper]: the oil look's trees of the snow)
      // (the oil look: a tree's leaves in the order of their numbers, so that far off only a share of them is drawn:
      // florakit.js sortLeafCards)
      const lf = LOOK.oil ? sortLeafCards : (g) => g;
      const geo0 = [lf(gen(11 + i * 10, 0, sp)), lf(gen(12 + i * 10, 0, sp))], geo1 = lf(gen(13 + i * 10, 1, sp));
      return { mat, mat1: mat, geo0, geo1, base: { mat, geo0, geo1 }, mo, t2: null, t2Mode: '', canSplit: LOOK.oil && !!gen && splittable([geo0[0], geo1]), far: fd, pine: sp.kit === 'conifer',
        // (far off it is drawn as leaf cards, not as a lump: the trees in leaf of the oil look; ?fartree=lump: as it was)
        // (2026-11-18, found by an independent reader and re-measured: this list was left at the two old kits when the
        //  four new ones went into the autumn wood, so 38,686 of 38,968 FAR TREES IN IT FELL BACK TO THE 26-TRIANGLE
        //  LUMP -- the far wood went back to grey-brown blobs, and the far tier from 7,591,242 triangles to 1,011,660
        //  at 3086x1440 from 220 m up. The leafy far tree was made the look in v13; a kit must be named here to get it.)
        canCard: CAN_CARD[sp.kit] === 1,
        cardFar: LOOK.oil && FAR_CARDS && CAN_CARD[sp.kit] === 1 };
    });
    // THE TURN OF THE YEAR (the owner, 2026-11-19). A leaf's colour was already a uniform, so a wood turns from
    // summer to autumn by writing three vectors per material when the season moves -- no define, no recompile, no
    // second set of meshes, nothing added to any shader. A species with no `leafSum`/`leafAut` in its look data has
    // one dress and does not turn, which is every world but the forest.
    // BEHIND THE OIL LOOK, like everything else new. Some of the two-dress data sits in the base look rather than
    // in the oil overlay (the forest floor's), so without this line the LIVE WATERCOLOUR GAME would start turning
    // its seasons too -- which is a change to the live game, and those only happen when the owner asks.
    this._turn = [];
    for (let i = 0; LOOK.oil && i < TALL.length; i++) {
      const sp = TALL[i];
      if (!sp.leafSum && !sp.leafAut) continue;
      // `fam`, the family accent a kind's crowns carry (the maple's reds), is an AUTUMN colour: seen in the first
      // summer still it left red crowns in a green wood. Its amount rides the season with everything else.
      this._turn.push({ mat: this.species[i].mat, far: i, sum: sp.leafSum || sp.leaf, aut: sp.leafAut || sp.leaf,
        famW: sp.fam ? (sp.fam[3] == null ? 1 : sp.fam[3]) : 0 });
    }
    this.treeDepth = TREEDEPTH; TREE_DEPTH.on = TREEDEPTH;
    if (TREES2) this._useTrees2(TREES2);
    const U = L.under || { leaf: [[0.8, 0.85, 0.4], [0.55, 0.7, 0.3], [0.35, 0.5, 0.3]], accent: [0.86, 0.29, 0.17], bush: [[0.64, 0.77, 0.37], [0.45, 0.63, 0.36], [0.24, 0.41, 0.36]], rock: [[0.8, 0.79, 0.83], [0.47, 0.45, 0.55]] };
    this.U = U;
    this.pal = new Map();
    this.mats = Object.assign({
      far: L.tall.length ? makePropMaterial(bodyUniforms, {
        name: 'far-tree', leafP: [0.9, 0.12, 1.0, 0.45], wind: 0.04,
        far: TALL.map((sp, i) => ({ fam: sp.fam || null, leafA: sp.leaf[0], leafB: sp.leaf[1], leafC: sp.leaf[2], barkA: sp.bark[0], barkB: sp.bark[1], taper: this.species[i].far[2], trunk: FAR_TRUNK.has(sp.kit), drop: sp.kit === 'vine', kind: sp.snowy ? 1 : sp.bare ? 2 : 0 })),
      }) : null,
    }, this._underMats(U, ''));
    if (LOOK.oil && (U.leafSum || U.leafAut)) this._turn.push({ mat: this.mats.under, sum: U.leafSum || U.leaf, aut: U.leafAut || U.leaf });
    if (LOOK.oil && this.mats.bush && (U.bushSum || U.bushAut)) this._turn.push({ mat: this.mats.bush, sum: U.bushSum || U.bush, aut: U.bushAut || U.bush });
    this._seasonAt = -1;
    this.setSeason(SEASON.t);
    // (the FAR trees cast no shadow in the oil look: on the owner's phone their drawing from the sun was 2.8 ms of a
    // 18 ms frame, nearly all of what the far trees cost at all (speed test 6, 2026-11-17), and a far tree stands
    // beyond 57 m at the phone's settings, where the shadow square's 90 m reach is nearly spent and its texels are
    // metres wide: what is lost is a smudge at the edge of the lit ground. Checked in stills before it was kept.)
    for (const k of ['far', 'bush', 'rock']) if (this.mats[k] && !(LOOK.oil && k === 'far')) this.mats[k].userData.pcCasts = true;
    this.kit = {
      far: farTreeGeometry(5),
      // (the oil look's far tree for the kinds that are trees in leaf: a stem and leaf cards, florakit.js)
      farCards: LOOK.oil && FAR_CARDS ? sortLeafCards(FAR_BLOB ? farBlobGeometry(6) : farCardGeometry(6)) : null,     // (2026-11-18: ordered for thinning, as the near and mid trees are: see below)
      grass: grassGeometry(31, { oil: LOOK.oil }), patch: grassPatchGeometry(37, { oil: LOOK.oil }), fern: fernGeometry(41, { oil: LOOK.oil }), reed: reedGeometry(81), bush: bushGeometry(51, { oil: LOOK.oil }),
      rock: rockGeometry(61), flower: flowerGeometry(71, { oil: LOOK.oil }), shard: shardGeometry(91),
    };
  }

  // Every wash this world's flora can be drawn with, each with a kit geometry it is drawn on (kits and
  // materials made if they were not; no cell is built), for the prewarm (world.prewarm, PILOT's P3): a
  // program follows the attributes a geometry has as well as the material (three r187 keys it on a normal,
  // for one). A biome's own undergrowth washes differ from the body's only in their uniforms, so they share
  // its programs and are not listed.
  warmSet() {
    if (!this.ready) this._init();
    const K = this.kit, M = this.mats, out = this.species.flatMap((s) => (s.mat1 && s.mat1 !== s.mat ? [[s.mat, s.geo0[0]], [s.mat1, s.geo1]] : [[s.mat, s.geo1]]));      // (?trees2: each tier its own programs)
    if (M.far) out.push([M.far, K.far]);
    out.push([M.under, K.grass], [M.patch, K.patch], [M.bush, K.bush], [M.rock, K.rock], [M.shard, K.shard]);
    return out;
  }

  // The undergrowth washes: the body's, or a biome's own where it names them (looks: biome.under).
  // Turn the year. Writes three colours per leafy material and nothing else; a whole wood costs a handful of
  // vector writes, and only when the season has actually moved (a thousandth is below what any eye can see).
  setSeason(t) {
    if (!this._turn || !this._turn.length) return;
    if (Math.abs(t - this._seasonAt) < 0.001) return;
    this._seasonAt = t;
    const c = [0, 0, 0];
    for (const q of this._turn) {
      const u = q.mat && q.mat.uniforms;
      if (!u) continue;
      leafNow(q.sum[0], q.aut[0], t, c); if (u.uLeafA) u.uLeafA.value.set(c[0], c[1], c[2]);
      leafNow(q.sum[1], q.aut[1], t, c); if (u.uLeafB) u.uLeafB.value.set(c[0], c[1], c[2]);
      leafNow(q.sum[2], q.aut[2], t, c); if (u.uLeafC) u.uLeafC.value.set(c[0], c[1], c[2]);
      if (q.famW && u.uLeafFam) u.uLeafFam.value.w = q.famW * t;
      // the far trees share one mesh and one material, with a colour apiece in an array
      const f = this.mats && this.mats.far && this.mats.far.uniforms;
      if (f && q.far != null && f.uFarA && f.uFarA.value[q.far]) {
        leafNow(q.sum[0], q.aut[0], t, c); f.uFarA.value[q.far].set(c[0], c[1], c[2]);
        leafNow(q.sum[1], q.aut[1], t, c); f.uFarB.value[q.far].set(c[0], c[1], c[2]);
        leafNow(q.sum[2], q.aut[2], t, c); f.uFarC.value[q.far].set(c[0], c[1], c[2]);
        if (q.famW && f.uFarFam && f.uFarFam.value[q.far]) f.uFarFam.value[q.far].w = q.famW * t;
      }
    }
  }

  _underMats(U, tag) {
    const bodyUniforms = this.bodyUniforms, sh = U.shard || U.rock;
    return {
      under: makePropMaterial(bodyUniforms, { name: 'under' + tag, leafA: U.leaf[0], leafB: U.leaf[1], leafC: U.leaf[2], accent: U.accent, wind: 0.07, doubleSide: true, phys: 'full', stiff: 0, plantHeight: 0.5 }),
      // near grass: the same washes, each blade bent about its own root
      patch: makePropMaterial(bodyUniforms, { name: 'patch' + tag, leafA: U.leaf[1], leafB: U.leaf[2], leafC: U.leaf[2].map((x) => x - (x - x * x) * 0.6), accent: U.accent, wind: 0.07, doubleSide: true, phys: 'full', stiff: 0, plantHeight: 0.5, bladeRoot: true }),
      bush: makePropMaterial(bodyUniforms, { name: 'bush' + tag, doubleSide: LOOK.oil, leafA: U.bush[0], leafB: U.bush[1], leafC: U.bush[2], leafP: [0.85, 0.3, 1.0, 0.25], wind: 0.04, phys: 'lite', stiff: FLORA_PHYS.bush.stiffness, plantHeight: FLORA_PHYS.bush.height }),
      rock: makePropMaterial(bodyUniforms, { name: 'rock' + tag, barkA: U.rock[0], barkB: U.rock[1], wind: 0 }),
      shard: makePropMaterial(bodyUniforms, { name: 'shard' + tag, barkA: sh[0], barkB: sh[1], wind: 0, gem: !!U.shard }),
    };
  }
  _palette(bi) {
    let m = this.pal.get(bi);
    // (the oil look may give a biome's undergrowth its own colours: the biome's oil.under, laid over its washes)
    if (!m) {
      const b = this.S.biomes[bi];
      const U = Object.assign({}, this.U, b.under, LOOK.oil && b.oil ? b.oil.under : null);
      m = this._underMats(U, '-' + bi); this.pal.set(bi, m);
      // A BIOME MAKES ITS OWN UNDERGROWTH MATERIALS, here and lazily, and they are not the ones the constructor
      // registered: without this the trees of a wood turned from summer to autumn and THE FLOOR BENEATH THEM DID
      // NOT. (Found by reading, after a still showed a green floor under a gold wood and it was put down to grass.)
      if (LOOK.oil && this._turn) {
        const add = [];
        if (U.leafSum || U.leafAut) add.push({ mat: m.under, sum: U.leafSum || U.leaf, aut: U.leafAut || U.leaf });
        if (m.bush && (U.bushSum || U.bushAut)) add.push({ mat: m.bush, sum: U.bushSum || U.bush, aut: U.bushAut || U.bush });
        if (add.length) { for (const q of add) this._turn.push(q); const t = this._seasonAt; this._seasonAt = -1; this.setSeason(t < 0 ? SEASON.t : t); }
      }
    }
    return m;
  }

  // (still busy while a wash is being laid: a frame taken when this reaches 0 shows nothing half arrived)
  get busy() { return this.queue.length + (this.group.visible ? this.held.length + (this.washNow - this.lastLaid < WASH_T + 0.1 ? 1 : 0) : 0); }

  // HOW MUCH OF THE WOOD IS STANDING: cells built and not thrown away, and the meshes of them being drawn. For
  // measuring whether the plants keep up with a player who is moving (the owner, 2026-11-22: "I want things far
  // away to be loaded in before I even get there"). Walked only when something asks: it is for harnesses and the
  // read-out, not for the frame.
  standing(p, r) {
    let cells = 0, meshes = 0;
    const r2 = r != null ? r * r : 0;
    for (const map of [this.treeChunks, this.farChunks, this.underChunks, this.under2Chunks]) {
      for (const ch of map.values()) {
        if (!ch.built || ch.dead) continue;
        if (p && ch.origin.distanceToSquared(p) > r2) continue;    // only the cells about a place (a harness asking
        cells++;                                                   // whether the ground AHEAD is standing yet)
        for (const m of ch.meshes) if (m.visible) meshes++;
      }
    }
    return { cells, meshes };
  }

  // An InstancedMesh with room for `cap` instances that shares the kit geometry's buffers.
  _instanced(chunk, geo, mat, cap, lod, far) {
    const g = new THREE.BufferGeometry();
    for (const k of SHARED) if (geo.attributes[k]) g.setAttribute(k, geo.attributes[k]);
    g.setIndex(geo.index);
    for (const gr of geo.groups) g.addGroup(gr.start, gr.count, gr.materialIndex);      // (?trees2: wood, then leaves)
    if (geo.userData.leaf) g.userData.leaf = geo.userData.leaf;
    const inst = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    g.setAttribute('aInst', inst);
    const born = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
    g.setAttribute('aBorn', born);
    let inst2 = null;
    if (far) { inst2 = new THREE.InstancedBufferAttribute(new Float32Array(cap * 2), 2); g.setAttribute('aInst2', inst2); }
    const mesh = new THREE.InstancedMesh(g, mat, cap);
    // THE FAR TREES ARE DRAWN LAST of the opaque things (2026-11-18, the owner's own phone, speed test 8 row 8:
    // -1.2 ms of a 32.9 ms frame, free, and the picture cannot change - they are opaque and depth-tested, so the
    // order of opaque geometry decides only what is shaded, never what is seen). They cover a fifth of the screen
    // and only a sixth of that survives to be looked at (measured on the real world at the phone's own picture
    // size: 104,362 pixels covered, 17,249 of them on top), so putting them after the ground and the near trees
    // lets the depth test throw away most of their painting before it is done. The same table's row 7, drawn
    // FIRST, is +2.3 ms, which is the other half of the same fact.
    if (far) mesh.renderOrder = 9;
    // (the oil look's cast shadows, render/shadow.js: trees, bushes and stones cast; blades and flowers do not)
    if ((Array.isArray(mat) ? mat[0] : mat).userData.pcCasts) mesh.layers.enable(SHADOW_LAYER);
    if (Array.isArray(mat) && mat.depthMats) { mesh.userData.pcDepthMats = mat.depthMats; TREE_DEPTH.meshes.add(mesh); }      // (?treedepth=1)
    mesh.count = 0;
    mesh.position.copy(chunk.origin);
    mesh.matrixAutoUpdate = false; mesh.updateMatrix();
    // (the allowance over the cell's own half-span: a tree's height, the spread of its crown, and the relief within
    //  the cell. 24 m as it was; 30 in the oil look, where a far crown's pieces are pushed out from the crown's centre
    //  to break its outline, so a crown must not be culled at the edge of the screen for those few extra metres.)
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), chunk.size * 0.75 + (LOOK.oil ? 30 : 24));
    const origin = chunk.origin, flora = this, camRel = new THREE.Vector3(), lodv = new THREE.Vector4().fromArray(lod);
    // (the draw range of a tree's sorted index: n is what the leaves by distance ask for; the speed test may keep only
    //  the wood or only the leaves of a NEAR tree, flora.benchNear, and never touches a far one)
    const benchRange = (geometry, lf, n) => {
      const bn = far ? null : flora.benchNear;
      if (bn === 'wood') geometry.setDrawRange(0, lf.base);
      else if (bn === 'leaves') geometry.setDrawRange(lf.base, Math.max(0, n - lf.base));
      else geometry.setDrawRange(0, n);
    };
    mesh.onBeforeRender = function (renderer, scene, camera, geometry, material) {
      // (a tree's ranges follow its size on the screen in the oil look, and the far trees the air they are seen through: update())
      const u = material.uniforms, k = far ? flora.farScale : chunk.isTree ? flora.treeScale : flora.rangeScale;
      u.uOrigin.value.copy(origin);
      u.uCamLocal.value.copy(camRel.subVectors(flora.camLocal, origin));
      u.uLod.value.set(lodv.x * k, lodv.y * k, lodv.z, lodv.w);
      if (u.uLeafLod) {
        // LEAVES BY DISTANCE (florakit.js sortLeafCards; materials.js PROP_VERT and shadow.js draw by the same rule): x the
        // distance within which a tree keeps every leaf, y the least share it keeps. The mesh draws only as much of its
        // index as its NEAREST tree needs (how near that was when the trees were last sorted into tiers, less what the
        // eye has moved since).
        const L = mesh.userData.leafLod, lf = geometry.userData.leaf;
        if (L) {
          const d0 = L[0] * flora.treeScale;
          u.uLeafLod.value.set(d0, L[1], 0, 0);
          if (lf) {
            const dn = Math.max(0.01, (mesh.userData.dNear || 0) - (chunk.tierPos ? chunk.tierPos.distanceTo(flora.camLocal) : 1e9));
            const keep = Math.min(1, Math.max(L[1], Math.pow(d0 / dn, 1.2)));
            let thr = (1 - keep) * 1.06 - 0.06;
            // (the shadow pass: of a crown's leaves only a share throws a shadow at all, shadow.js uThinLeaf)
            if (u.uThinLeaf) thr = 1 - Math.min(1 - u.uThinLeaf.value, keep * 0.5) - 0.02;
            benchRange(geometry, lf, leafDrawCount(lf, thr));
          }
        } else {
          u.uLeafLod.value.set(0, 0, 0, 0);
          if (lf) benchRange(geometry, lf, geometry.index ? geometry.index.count : Infinity);
        }
      }
      if (u.uWashIn) u.uWashIn.value.set(flora.washNow, mesh.userData.laid, WASH_T);
      if (u.uFocus) u.uFocus.value.copy(flora._focus(renderer, camera));
      if (u.uPlantHeight && mesh.userData.plantH) u.uPlantHeight.value = mesh.userData.plantH;
      material.uniformsNeedUpdate = true;
    };
    mesh.userData.inst = inst; mesh.userData.inst2 = inst2; mesh.userData.born = born;
    if (!(far || chunk.isTree)) this.lastLaid = this.washNow;
    mesh.userData.laid = far || chunk.isTree ? 0 : this.washNow;       // (trees wash in one by one, see _retier; a cell of undergrowth as one)
    this.group.add(mesh);
    chunk.meshes.push(mesh);
    return mesh;
  }

  // ---- trees ----------------------------------------------------------------------------------
  // One tree's place in its patch (chunk.mat, chunk.rel): where it stands, upright with its own lean and girth; and,
  // if the explorer's wind has felled it (the powers, data/felled.js), turned about its foot as far as its fall has gone.
  _layTree(chunk, i) {
    const d = chunk.data, o = i * INST_STRIDE;
    _p.set(d[o], d[o + 1], d[o + 2]);
    _up.copy(_p).normalize();
    _q.setFromUnitVectors(_Y, _up);
    const lean = d[o + 11], yaw = d[o + 4];
    _q2.setFromEuler(_e.set(lean * Math.cos(yaw * 3.0), yaw, lean * Math.sin(yaw * 3.0), 'YXZ'));
    _q.multiply(_q2);
    if (FELLED.size) {
      const F = felledAt(this.S.id, d[o], d[o + 1], d[o + 2]);
      if (F) { fallTurn(_up.x, _up.y, _up.z, F, _ft); _q.premultiply(_q2.set(_ft[0], _ft[1], _ft[2], _ft[3])); }
    }
    const sc = d[o + 3];
    // trunks and crowns vary in girth as well as height
    const girth = sc * (0.82 + 0.4 * ((d[o + 7] * 7.31) % 1));
    _m.compose(_p.sub(chunk.origin), _q, _s.set(girth, sc, girth));
    _m.toArray(chunk.mat, i * 16);
    chunk.rel[i * 3] = _p.x; chunk.rel[i * 3 + 1] = _p.y; chunk.rel[i * 3 + 2] = _p.z;
  }
  // (the powers, the wind knife) The trees that are falling now: each goes a little further over, and every loaded
  // patch that holds it (its near patch and its far one) has that tree laid again and its meshes written again this
  // frame. A second and a half for each felled tree; nothing at all when none is falling.
  _fall(now) {
    const dt = this._fallT != null ? Math.min(0.1, Math.max(0, now - this._fallT)) : 0;
    this._fallT = now;
    const list = fallingOn(this.S.id, _falling);
    // (2026-11-18, found by an independent reader who TIMED AN ULTIMATE) A TREE IS LAID AGAIN ONLY WHILE IT IS
    // ACTUALLY MOVING, AND ONLY SO MANY A FRAME. An ultimate fells up to sixty trees at once, each with its own wait
    // so that the fall travels outward; every one of them used to be laid again every frame, wait and all, for the
    // three seconds the wave took. Measured on the real world: a settled world update is 0.125 ms, the frame of the
    // cast 2.25 ms, and the three seconds after it ran at 1.11 ms with a tail of 5 to 7 ms -- nine times the settled
    // cost, held for three seconds, on a phone already at its cap, exactly while the player is watching. A tree
    // still waiting (f below 0) stands where it stood and needs nothing; of those really moving, at most FALL_RELAY
    // are laid again in any one frame, taken in turn, so sixty falling trees cost what eight do and the rest catch
    // up on the next frame. Nothing is skipped for good: the turn comes round.
    let did = 0;
    const n = list.length;
    if (n) {
      let k = this._fallK | 0;
      if (k >= n) k = 0;
      // (how far over each tree is, and how far back up a tree that is growing again, are BOTH clocked by the record
      //  itself now -- data/felled.js healFelled -- so a wood falls and comes back on a world nobody is watching.
      //  This lays what the record says; it does not move anything.)
      for (let i = 0; i < n && did < FALL_RELAY; i++) {
        const F = list[(k + i) % n];
        if (F.f <= 0) continue;                 // still waiting for the wave: it stands, and is drawn standing
        this._relay(F); did++;
      }
      this._fallK = (k + Math.max(1, did)) % n;
    }
    // (a tree felled, or a saved game's trees put back, since the last frame: those already lying are laid too)
    // (2026-11-18) THE LIST IS WALKED, NOT EVERY TREE OF EVERY CHUNK. This used to ask of all the trees in all the
    // loaded cells whether each was felled (a string-keyed lookup apiece): measured at 24.9 ms in the one frame a
    // tree is cut, four fifths of it in the far cells, which is a hitch at the very moment the player is watching the
    // tree go over. Each felled tree is instead laid where it stands, by the same bounding test _relay already does,
    // so one felling is 291 distance comparisons and a scan of the two or three cells that hold it.
    if (this._fellV !== FELLED.version) {
      this._fellV = FELLED.version;
      for (const F of felledOn(this.S.id, _felledAll)) this._relay(F);
    }
    this._fallingNow = list.length > 0;
  }
  _relay(F) {
    for (const map of [this.treeChunks, this.farChunks]) for (const ch of map.values()) {
      if (!ch.built || !ch.n || ch.dead || !ch.mat) continue;
      const dx = ch.origin.x - F.x, dy = ch.origin.y - F.y, dz = ch.origin.z - F.z, r = ch.size * 1.5 + 30;
      if (dx * dx + dy * dy + dz * dz > r * r) continue;
      const d = ch.data;
      for (let i = 0, o = 0; i < ch.n; i++, o += INST_STRIDE) if (d[o] === F.x && d[o + 1] === F.y && d[o + 2] === F.z) { this._layTree(ch, i); ch.refill = true; break; }
    }
  }
  _buildTrees(chunk) {
    let n = 0, d;
    if (chunk.kind === 'far') {
      // the tree cells under this far cell, concatenated: farSpan of them to a side, so four cells in the watercolour
      // game and sixteen in the oil look
      const parts = [], sp = this.farSpan;
      // (which tree cell each tree came from: while that cell's own trees are not laid, the far form stands in for them)
      chunk.partEnd = []; chunk.partKey = [];
      for (let b = 0; b < sp; b++) for (let a = 0; a < sp; a++) {
        const t = treeCell(this.S, chunk.face, chunk.ix * sp + a, chunk.iy * sp + b); parts.push(t); n += t.count;
        chunk.partEnd.push(n); chunk.partKey.push(chunk.face * 1e8 + (chunk.ix * sp + a) * 1e4 + chunk.iy * sp + b);
      }
      d = new Float32Array(n * INST_STRIDE);
      let o = 0;
      for (const t of parts) { d.set(t.data.subarray(0, t.count * INST_STRIDE), o); o += t.count * INST_STRIDE; }
    } else {
      const t = treeCell(this.S, chunk.face, chunk.ix, chunk.iy);
      n = t.count; d = t.data;
    }
    chunk.n = n; chunk.data = d;
    chunk.mat = new Float32Array(n * 16);
    chunk.rel = new Float32Array(n * 3);
    chunk.tier = new Int8Array(n).fill(-2);
    chunk.dist = new Float32Array(n);
    chunk.prev = new Int8Array(n).fill(-2); chunk.since = new Float32Array(n); chunk.washUntil = 0;
    // groups: which trees can appear in which mesh
    const groups = {};
    const add = (key, i, geo, mat, far) => {
      const g = groups[key] || (groups[key] = { list: [], geo, mat, far: !!far, mesh: null, tierKey: key[0] });
      g.list.push(i);
    };
    for (let i = 0; i < n; i++) {
      const o = i * INST_STRIDE;
      this._layTree(chunk, i);
      if (chunk.kind === 'far') { const cf = this.species[d[o + 5]] && this.species[d[o + 5]].cardFar; add(cf ? '2c' : '2', i, cf ? this.kit.farCards : this.kit.far, this.mats.far, true); }
      else {
        const kind = d[o + 5], v = d[o + 6] % 2, sp = this.species[kind];
        add('0:' + kind + ':' + v, i, sp.geo0[v], sp.mat);
        add('1:' + kind, i, sp.geo1, sp.mat1 || sp.mat);
      }
    }
    chunk.groups = Object.values(groups);
    chunk.tierPos = new THREE.Vector3(1e9, 0, 0);
  }

  // Put every tree of a chunk into the tier its distance asks for and refill the buffers.
  // Where the explorer's figure stands in view space (w 1 while it is shown): strokes between the lens and
  // the figure part round the line of sight to it, so a crown never hides the figure. Once a frame.
  _focus(renderer, camera) {
    const fr = renderer.info.render.frame, v = this.focusV;
    if (fr === this._focusFrame && camera === this._focusCam) return v;
    this._focusFrame = fr; this._focusCam = camera;
    let f = G.figure, on = !!f;
    for (let o = f; o && on; o = o.parent) { if (!o.visible) on = false; if (!o.parent && !o.isScene) on = false; }
    if (!on) { v.set(0, 0, 0, 0); return v; }
    const e = f.matrixWorld.elements;
    _p.set(e[12] + e[4] * 0.95, e[13] + e[5] * 0.95, e[14] + e[6] * 0.95).applyMatrix4(camera.matrixWorldInverse);
    v.set(_p.x, _p.y, _p.z, 1);
    return v;
  }

  _retier(chunk, force) {
    const n = chunk.n;
    if (!n) return;
    const now = this.washNow, prev = chunk.prev, since = chunk.since;
    const k = this.treeScale, kf = this.farScale, dist01 = chunk.dist;
    const cx = this.camLocal.x - chunk.origin.x, cy = this.camLocal.y - chunk.origin.y, cz = this.camLocal.z - chunk.origin.z;
    const d = chunk.data, rel = chunk.rel, tier = chunk.tier, lowQ = QUALITY.level === 0;
    // the middle tier pays for the near ground, the explorer and the ship (the frame budget of
    // 600 k triangles): full trees and middle trees hand over a little sooner
    const trim0 = QUALITY.level === 1 ? TRIM[0] : 1, trim1 = QUALITY.level === 1 ? TRIM[1] : 1;
    // (the filled far band: with it the plain far tier runs all the way to T_FAR and there is no thinned tier at all,
    //  so nothing in the owner's 300 yards is one tree in three. ?farfill=0, and the watercolour game, keep the ring.)
    const fill = this.farFill, thinR = fill ? T_FAR : T_THIN;
    let changed = false;
    // a far cell: are the trees of its tree cells laid? Where they are not (not built yet, or waiting
    // for their ground), the far form stands in at any distance, and changes hands when they come
    // (as many tree cells as the cell's span asks: four with span 2, sixteen with span 4)
    let pe = null, laid = null, part = 0;
    if (chunk.kind === 'far') {
      pe = chunk.partEnd; laid = _laid;
      for (let q = 0, nq = chunk.partKey.length; q < nq; q++) { const nc = this.treeChunks.get(chunk.partKey[q]); laid[q] = !!(nc && nc.built && !nc.held && !nc.dead); }
    }
    for (let i = 0; i < n; i++) {
      const dx = rel[i * 3] - cx, dy = rel[i * 3 + 1] - cy, dz = rel[i * 3 + 2] - cz;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      dist01[i] = dist;
      const seed = d[i * INST_STRIDE + 7];
      const j = (1 + (seed - 0.5) * JIT) * k;
      const jf = kf === k ? j : (1 + (seed - 0.5) * JIT) * kf;      // (the far trees' own scale in the oil look; the same number as j without it)
      let t;
      if (dist < T0 * j * trim0) t = lowQ ? 1 : 0;      // the low tier draws no full trees
      else if (dist < T1 * j * trim1) t = 1;
      else if (dist < thinR * jf) t = 2;
      else if (!fill && dist < T_FAR * jf && (seed * 13.37) % 1 < 0.34) t = 3;   // thinned: one in three, drawn larger
      else t = -1;
      if (pe) { while (i >= pe[part]) part++; if (t >= 0 && t < 2 && !laid[part]) t = 2; }
      if (t !== tier[i]) { prev[i] = tier[i]; since[i] = now; tier[i] = t; changed = true; }
    }
    chunk.tierPos.copy(this.camLocal);
    if (!changed && !force) return;
    // (while a tree changes hands both meshes hold it; the chunk is refilled once more when the wash has dried)
    chunk.washUntil = changed ? now + WASH_T + 0.05 : 0;
    if (changed) this.lastLaid = now;
    const mat = chunk.mat;
    for (const g of chunk.groups) {
      const want = g.tierKey === '0' ? 0 : g.tierKey === '1' ? 1 : 2;
      let c = 0;
      const list = g.list;
      const inTier = (t) => t === want || (want === 2 && t === 3);
      // (a far tree that only changes between plain and thinned stays in its mesh; a tree that left this mesh a moment ago is still in it, being lifted out)
      const leaving = (i) => now - since[i] < WASH_T && inTier(prev[i]) && !inTier(tier[i]);
      for (let a = 0; a < list.length; a++) { const i = list[a]; if (inTier(tier[i]) || leaving(i)) c++; }
      if (c === 0) { if (g.mesh) { g.mesh.count = 0; g.mesh.visible = false; } continue; }
      if (!g.mesh) {
        g.mesh = this._instanced(chunk, g.geo, g.mat, list.length, g.far ? [0, T_FAR, JIT, 0.88] : [0, 1e7, 0, 0.999], g.far);
        // (the oil look's leaves by distance: a full tree keeps every leaf within about a quarter of its range and a fifth
        // of them at its end, where the middle tree, of fewer and larger leaves, takes over; the middle tree thins on from there)
        if (LOOK.oil && !g.far && !TREES_FULL) g.mesh.userData.leafLod = g.tierKey === '0' ? [0.24 * T0, 0.2] : [T0, 0.35];
        // (2026-11-18) THE FAR TREES ARE NOT THINNED BY DISTANCE, AND HERE IS THE MEASUREMENT THAT SAYS SO, because
        // on paper it is the biggest saving left in the game and the next session will want to try it again.
        // A study counted the far tier at 7,326,558 triangles of an 8,191,481-triangle frame from the air and
        // recommended it; wired up and measured on the real world at the owner's own sharpness it is a LOSS:
        //        keep           triangles (air)        shaded pixels (air)
        //        none (today)   5,282,805              18,488,867
        //        a quarter      2,509,407  (-52%)      28,354,673  (+53%)
        //        0.62           3,935,285  (-26%)      20,760,563  (+12%)
        // The reason is in the shader: when a crown's dabs are thinned, each one that is KEPT is grown to cover for
        // the ones that went, so the painted area holds but the dabs overlap each other far more - the far tier's
        // self-overlap went from 4.9 to 7.7. Triangles are not what costs this game at nine times the pixels; FILL
        // is, and this trades the cheap thing for the dear one. The study measured only the triangles.
        // (What IS kept from the attempt: the far tree's pieces are now ordered for thinning, and the dark core is
        //  given the highest sort key so it would be the last thing dropped rather than the first - so if a future
        //  far tree is ever made of cheaper marks that do not need growing, the machinery is already there.)
      }
      const mesh = g.mesh, im = mesh.instanceMatrix.array, ia = mesh.userData.inst.array, ib = g.far ? mesh.userData.inst2.array : null, ab = mesh.userData.born.array;
      let w = 0, dNear = 1e9;
      for (let a = 0; a < list.length; a++) {
        const i = list[a], out = !inTier(tier[i]);
        const t = out ? prev[i] : tier[i];
        if (out && !leaving(i)) continue;
        if (dist01[i] < dNear) dNear = dist01[i];
        // when it came (it washes in), or when it left (it is lifted out); one that only changed within the mesh keeps its place
        ab[w] = out ? -Math.max(since[i], 1e-3) : (inTier(prev[i]) ? 0 : since[i]);
        const o = i * INST_STRIDE, mo = i * 16, wo = w * 16;
        if (g.far) {
          // the unit far tree: size it to the species. A thinned tree (tier 3) stands in for three and is grown to
          // cover for them -- which is what made the far wood read as sized blobs rather than trees. Where the band is
          // filled there is no tier 3 at all (see above), so t is never 3 here and nothing is grown.
          const fd = this.species[d[o + 5]].far;
          const big = t === 3 ? 1.5 : 1;
          const sxz = fd[0] * big, sy = fd[1] * (t === 3 ? 1.15 : 1);
          for (let q = 0; q < 4; q++) { im[wo + q] = mat[mo + q] * sxz; im[wo + 4 + q] = mat[mo + 4 + q] * sy; im[wo + 8 + q] = mat[mo + 8 + q] * sxz; im[wo + 12 + q] = mat[mo + 12 + q]; }
          ib[w * 2] = d[o + 5]; ib[w * 2 + 1] = 0;
        } else {
          for (let q = 0; q < 16; q++) im[wo + q] = mat[mo + q];
        }
        ia[w * 4] = d[o + 8]; ia[w * 4 + 1] = d[o + 9]; ia[w * 4 + 2] = d[o + 7]; ia[w * 4 + 3] = d[o + 10];
        w++;
      }
      mesh.count = w; mesh.visible = true; mesh.userData.dNear = dNear;
      mesh.instanceMatrix.needsUpdate = true; mesh.userData.inst.needsUpdate = true; mesh.userData.born.needsUpdate = true;
      if (ib) mesh.userData.inst2.needsUpdate = true;
    }
  }

  // ---- undergrowth ----------------------------------------------------------------------------
  // Grass lives in 25 m cells (two meshes: short-range and long-range tufts). The rarer kinds
  // (ferns, reeds, flowers, bushes, stones) are batched in cells twice as large, one mesh a kind.
  _buildUnder(chunk) {
    let n = 0, d;
    if (chunk.kind === 'under2') {
      const parts = [];
      for (let b = 0; b < 2; b++) for (let a = 0; a < 2; a++) { const t = underCell(this.S, chunk.face, chunk.ix * 2 + a, chunk.iy * 2 + b); parts.push(t); n += t.count; }
      d = new Float32Array(n * INST_STRIDE);
      let o = 0;
      for (const t of parts) { d.set(t.data.subarray(0, t.count * INST_STRIDE), o); o += t.count * INST_STRIDE; }
    } else {
      const t = underCell(this.S, chunk.face, chunk.ix, chunk.iy);
      n = t.count; d = t.data;
    }
    // one set of lists per palette in the cell (nearly always one: two where biomes meet)
    const sets = new Map();
    const grass = chunk.kind === 'under', biomes = this.S.biomes;
    for (let i = 0; i < n; i++) {
      const o = i * INST_STRIDE, kind = d[o + 5];
      const pk = biomes[d[o + 6]] && biomes[d[o + 6]].under ? d[o + 6] : -1;
      let lists = sets.get(pk);
      if (!lists) { lists = { gn: [], gf: [], fern: [], reed: [], flower: [], bush: [], rock: [], shard: [] }; sets.set(pk, lists); }
      if (kind === U_GRASS) { if (grass) (d[o + 7] < 0.55 ? lists.gn : lists.gf).push(i); }
      else if (grass) continue;
      else if (kind === U_FERN) lists.fern.push(i);
      else if (kind === U_REED) lists.reed.push(i);
      else if (kind === U_FLOWER) lists.flower.push(i);
      else if (kind === U_BUSH) lists.bush.push(i);
      else if (kind === U_ROCK || kind === U_STONE) lists.rock.push(i);
      else if (kind === U_SHARD) lists.shard.push(i);
    }
    const make = (list, geo, mat, lod, near, skipLow) => {
      if (!list.length) return;
      // in an order that has nothing to do with place, so that drawing the first share of
      // a mesh thins it evenly (the low tier draws half)
      for (let a = list.length - 1; a > 0; a--) { const b = Math.floor(d[list[a] * INST_STRIDE + 7] * 9973.1 % 1 * (a + 1)); const t = list[a]; list[a] = list[b]; list[b] = t; }
      const mesh = this._instanced(chunk, geo, mat, list.length, lod, false);
      const im = mesh.instanceMatrix.array, ia = mesh.userData.inst.array;
      let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
      for (let a = 0; a < list.length; a++) {
        const o = list[a] * INST_STRIDE;
        _p.set(d[o], d[o + 1], d[o + 2]);
        _up.copy(_p).normalize();
        _q.setFromUnitVectors(_Y, _up);
        _q2.setFromEuler(_e.set(d[o + 11] * Math.cos(d[o + 4] * 3.0), d[o + 4], d[o + 11] * Math.sin(d[o + 4] * 3.0), 'YXZ'));
        _q.multiply(_q2);
        const sc = d[o + 3];
        _m.compose(_p.sub(chunk.origin), _q, _s.set(sc, sc * (d[o + 5] === U_STONE ? 0.55 : 1), sc));
        _m.toArray(im, a * 16);
        ia[a * 4] = d[o + 8]; ia[a * 4 + 1] = d[o + 9]; ia[a * 4 + 2] = d[o + 7]; ia[a * 4 + 3] = d[o + 10];
        if (_p.x < x0) x0 = _p.x; if (_p.x > x1) x1 = _p.x; if (_p.y < y0) y0 = _p.y; if (_p.y > y1) y1 = _p.y; if (_p.z < z0) z0 = _p.z; if (_p.z > z1) z1 = _p.z;
      }
      // (R1 W2.3) where its strokes stand (body-local: the box round their roots, as a sphere) and how far one can be seen
      // at all (PROP_VERT: a stroke is drawn while its root is nearer than uLod.y x (1 + (seed - 0.5) uLod.z), at most
      // lod[1] x (1 + lod[2] / 2), times the tier's range scale): a mesh no stroke of which can be seen is not submitted
      mesh.userData.rootC = new THREE.Vector3((x0 + x1) * 0.5, (y0 + y1) * 0.5, (z0 + z1) * 0.5).add(chunk.origin);
      mesh.userData.rootR = 0.5 * Math.hypot(x1 - x0, y1 - y0, z1 - z0) + 0.01;
      mesh.userData.reach = lod[1] * (1 + 0.5 * lod[2]);
      mesh.userData.full = list.length;
      mesh.count = QUALITY.level === 0 ? Math.ceil(list.length * 0.5) : list.length;
      mesh.instanceMatrix.needsUpdate = true; mesh.userData.inst.needsUpdate = true;
      mesh.userData.near = near; mesh.userData.skipLow = !!skipLow;
      mesh.userData.plantH = geo === this.kit.reed ? FLORA_PHYS.reed.height : geo === this.kit.fern ? FLORA_PHYS.fern.height : geo === this.kit.flower ? FLORA_PHYS.flower.height : FLORA_PHYS.grass.height;
    };
    // grass: the seed (0..1) sets how far each tuft is drawn; short-range tufts get their own
    // mesh so cells beyond that range do not submit them at all
    for (const [pk, lists] of sets) {
      const M = pk < 0 ? this.mats : this._palette(pk);
      // (the near half of the tufts used to be drawn as patches of blades; the near ground layer,
      // src/world/nearground.js, is the sward now)
      make(lists.gf, this.kit.grass, M.under, [0, 30, 0.9, 0.6], 0);
      make(lists.fern, this.kit.fern, M.under, [0, UNDER_FAR, 0.5, 0.75], 0);
      make(lists.reed, this.kit.reed, M.under, [0, UNDER_FAR, 0.4, 0.8], 0);
      make(lists.flower, this.kit.flower, M.under, [0, UNDER_FAR * 0.8, 0.5, 0.75], 0);
      make(lists.bush, this.kit.bush, M.bush, [0, UNDER_FAR, 0.3, 0.8], 0, true);
      make(lists.rock, this.kit.rock, M.rock, [0, UNDER_FAR, 0.3, 0.85], 0);
      make(lists.shard, this.kit.shard, M.shard, [0, UNDER_FAR, 0.3, 0.85], 0);
    }
  }

  // THE TREES' TWO SHORT PROGRAMS (?trees2=; see TREES2 at the head of this file). Each kind that can be split is
  // given a wood program and a leaf program (one material each, in that order, over the two groups of one index) and
  // its trees built again for them; a kind that cannot keeps what it had. mode '' puts every kind back. The kinds'
  // first forms are kept, so the speed test can swap one for the other in the same minute (setTrees2).
  _useTrees2(mode) {
    // ('cards-near' / 'cards-mid': only that tier in cards, the other split -- so the speed test can price each alone)
    const nearC = mode === 'cards' || mode === 'cards-near', midC = mode === 'cards' || mode === 'cards-mid';
    for (let i = 0; i < this.species.length; i++) {
      const s = this.species[i];
      if (!mode || !s.canSplit) { s.mat = s.mat1 = s.base.mat; s.geo0 = s.base.geo0; s.geo1 = s.base.geo1; s.t2Mode = ''; continue; }
      if (!s.t2 || s.t2.mode !== mode || s.t2.deep !== !!this.treeDepth) {
        const gen = TALL_KITS[this.tall[i].kit];
        const spN = Object.assign({}, this.tall[i], { trees2: nearC ? 'cards' : 'split' }), spM = Object.assign({}, this.tall[i], { trees2: midC ? 'cards' : 'split' });
        const g = (seed, lod, sp) => splitGroups(sortLeafCards(gen(seed, lod, sp)));
        const geo0 = [g(11 + i * 10, 0, spN), g(12 + i * 10, 0, spN)], geo1 = g(13 + i * 10, 1, spM);
        // (a tier whose tree came out in cards of leaves, part 7, has its leaves drawn by the card program; a kind with
        //  no cards of its own, by the leaf program)
        const cN = nearC && hasPart(geo0[0], 7), cM = midC && hasPart(geo1, 7), deep = !!this.treeDepth;
        s.mats = s.mats || {};
        // (t: wood, leaf, card, card-eq, card-first; '-mid' the middle tier's own, package T3: its trees bend whole, as
        //  every other plant does, without the crown's branch-by-branch sway -- a few pixels at that distance, and the
        //  dearest thing in a tree's vertex shader)
        const mk = (t) => {
          if (s.mats[t]) return s.mats[t];
          const mid = t.endsWith('-mid'), base = mid ? t.slice(0, -4) : t;
          const m = makePropMaterial(this.bodyUniforms, Object.assign({}, s.mo, { name: s.mo.name + '-' + t, tree: base.startsWith('card') ? 'card' : base,
            depth: base === 'card-eq' ? 'equal' : base === 'card-first' ? 'first' : undefined }, mid ? { branch: false } : null));
          m.userData.pcCasts = true;
          // (the depth pass shares the colour pass's uniforms: whatever the mesh sets before it is drawn holds for both)
          if (base === 'card-first') m.uniforms = mk('card-eq' + (mid ? '-mid' : '')).uniforms;
          // (the leaf programs turn with the year as the kind's own material does)
          const q = base !== 'wood' && base !== 'card-first' && this._turn && this._turn.find((x) => x.mat === s.base.mat);
          if (q) { this._turn.push(Object.assign({}, q, { mat: m, far: null })); this._seasonAt = -1; this.setSeason(SEASON.t); }
          return (s.mats[t] = m);
        };
        const leafOf = (cards, sfx) => mk(cards ? (deep ? 'card-eq' : 'card') + sfx : 'leaf' + sfx);
        const mats0 = [mk('wood'), leafOf(cN, '')], mats1 = [mk('wood-mid'), leafOf(cM, '-mid')];
        if (deep && cN) mats0.depthMats = [HIDDEN, mk('card-first')];
        if (deep && cM) mats1.depthMats = [HIDDEN, mk('card-first-mid')];
        s.t2 = { mode, deep, mats0, mats1, geo0, geo1 };
      }
      s.mat = s.t2.mats0; s.mat1 = s.t2.mats1; s.geo0 = s.t2.geo0; s.geo1 = s.t2.geo1; s.t2Mode = mode;
    }
    this.trees2 = mode;
  }
  // (PILOT's speed test, core/bench.js) The trees' two programs swapped in while the game runs: every near and middle
  // patch is dropped and built again in its turn; the caller waits for the world to settle. Returns the mode now
  // drawn, or null where there is nothing to swap (not the oil look, or no kind that can be split).
  setTrees2(mode, depth) {
    if (!LOOK.oil || !this.ready || !this.species.some((s) => s.canSplit)) return null;
    mode = mode === 'cards' || mode === 'cards-near' || mode === 'cards-mid' ? mode : mode ? 'split' : '';
    depth = depth == null ? !!this.treeDepth : !!depth;
    if ((this.trees2 || '') === mode && !!this.treeDepth === depth) return mode;
    this.treeDepth = depth; TREE_DEPTH.on = depth;
    this._useTrees2(mode);
    for (const [key, ch] of this.treeChunks) {
      if (ch.queued) { const qi = this.queue.indexOf(ch); if (qi >= 0) this.queue.splice(qi, 1); ch.queued = false; }
      this._disposeChunk(ch); this.treeChunks.delete(key);
    }
    this.lastTreeEval.set(1e9, 0, 0);
    return mode;
  }

  // (PILOT's speed test, core/bench.js) The far trees' form swapped while the game runs: the lump, or the flat pieces of
  // ?fartree=cards. Every far patch is dropped and built again in its turn; the caller waits for the world to settle.
  // Returns which form is now drawn (true: flat pieces), or null where there is nothing to swap (not the oil look).
  setFarCards(on) {
    if (!LOOK.oil || !this.ready) return null;
    on = !!on;
    const now = this.species.some((sp) => sp.cardFar);
    if (on === now) return now;
    return this.setFarForm(on ? (FAR_BLOB ? 'blob' : 'cards') : 'lump') !== 'lump';
  }
  // THE FAR TREES' FORM, swapped while the game runs (the speed test, core/bench.js; 2026-11-24, trees lane T0):
  // 'cards' the tree of flat pieces that ships (138 triangles), 'blob' two crossed six-cornered cards (?fartree=blob:
  // 10 triangles, which prices on the phone what a quad's fragments cost against a mesh's triangles), 'lump' the old
  // lump. Every far patch is dropped and built again in its turn. Returns the form now drawn, or null where there is
  // nothing to swap (not the oil look, or not yet made).
  setFarForm(form) {
    if (!LOOK.oil || !this.ready) return null;
    const now = this.farForm || (this.species.some((sp) => sp.cardFar) ? (FAR_BLOB ? 'blob' : 'cards') : 'lump');
    if (form === now) return now;
    // (ordered for thinning here too, or the speed test's swap loses it)
    // (each form made once and kept: its buffers stay on the graphics card while the meshes come and go)
    const fg = this._farGeo || (this._farGeo = {});
    if (this.kit.farCards && now !== 'lump' && !fg[now]) fg[now] = this.kit.farCards;
    if (form === 'blob') this.kit.farCards = fg.blob || (fg.blob = sortLeafCards(farBlobGeometry(6)));
    else if (form === 'cards') this.kit.farCards = fg.cards || (fg.cards = sortLeafCards(farCardGeometry(6)));
    else form = 'lump';
    for (const sp of this.species) sp.cardFar = form !== 'lump' && sp.canCard;
    this.farForm = form;
    this._dropFar();
    return form;
  }
  _dropFar() {
    for (const [key, ch] of this.farChunks) {
      if (ch.queued) { const qi = this.queue.indexOf(ch); if (qi >= 0) this.queue.splice(qi, 1); ch.queued = false; }
      this._disposeChunk(ch); this.farChunks.delete(key);
    }
    this.lastTreeEval.set(1e9, 0, 0);
  }

  _disposeChunk(chunk) {
    for (const m of chunk.meshes) {
      this.group.remove(m);
      TREE_DEPTH.meshes.delete(m);
      for (const k of SHARED) m.geometry.deleteAttribute(k);
      m.geometry.setIndex(null);
      m.geometry.dispose();
      m.dispose();
    }
    chunk.meshes.length = 0; chunk.groups = null; chunk.built = false; chunk.dead = true;
  }

  // Which chunks should exist around the camera: walk a tangent-plane grid and bucket by cell.
  // (R1 W2.3) `reach` (undergrowth): a cell is wanted only while its ground lies within that many metres of the eye
  // itself, not of the ground under it: from the ship at 150 m no stroke of the undergrowth can be seen (PROP_VERT
  // shrinks each away by its root's distance), and they were built and submitted all the same, and kept at any height
  // (98 draws of nothing at 150 m, 303 at 1 km). Walked only while the eye is near enough the ground for any cell to
  // be in reach; a cell beyond reach by more than the old margin is let go at any height.
  _wanted(level, size, radius, map, kind, reach) {
    const seen = new Set();
    this._wantAround(this.camLocal, level, size, radius, map, kind, reach, seen);
    // AND WHAT IS COMING (the owner, 2026-11-18: "I want things to be there before you get there even if your flying
    // fast"). The same walk a second time, round a point a few seconds ahead of the eye, so the trees of the ground
    // the ship is flying towards are asked for NOW and are standing by the time it arrives. Nothing is DROPPED by
    // this second walk -- the letting-go below is still reckoned from the eye itself, so nothing near the player is
    // ever taken away to pay for what is ahead -- and with no lead (standing, walking, another world) it does not
    // happen at all and the wood is exactly the wood it was.
    if (this.leadOn) this._wantAround(this.lead, level, size, radius * 0.8, map, kind, reach, seen);
    for (const [key, ch] of map) {
      if (seen.has(key)) continue;
      if (ch.origin.distanceTo(this.camLocal) > (reach != null ? reach + size * 0.75 : radius) + size * 2.2) {
        if (ch.queued) { const qi = this.queue.indexOf(ch); if (qi >= 0) this.queue.splice(qi, 1); ch.queued = false; }
        this._disposeChunk(ch); map.delete(key);
      }
    }
    for (const ch of map.values()) if (!ch.built && !ch.queued) { ch.queued = true; this.queue.push(ch); }
  }

  _wantAround(cam, level, size, radius, map, kind, reach, seen) {
    const R = this.R;
    const c = _up.copy(cam).normalize();
    const e = new THREE.Vector3().crossVectors(_Y, c); if (e.lengthSq() < 1e-6) e.set(1, 0, 0); e.normalize();
    const n = new THREE.Vector3().crossVectors(c, e);
    const step = size * 0.5, cells = 1 << level;
    let K = Math.ceil(radius / step);
    if (reach != null) {
      const above = cam.length() - R - this.S.heightAt(c.x, c.y, c.z);
      if (above > reach + size * 0.75 + RELIEF) K = -1;
    }
    for (let j = -K; j <= K; j++) for (let i = -K; i <= K; i++) {
      if ((i * i + j * j) * step * step > (radius + step) * (radius + step)) continue;
      const x = c.x * R + e.x * i * step + n.x * j * step, y = c.y * R + e.y * i * step + n.y * j * step, z = c.z * R + e.z * i * step + n.z * j * step;
      const l = 1 / Math.hypot(x, y, z);
      dirToFace(x * l, y * l, z * l, _ff);
      const ix = Math.min(cells - 1, Math.max(0, Math.floor((_ff.u + 1) * 0.5 * cells))), iy = Math.min(cells - 1, Math.max(0, Math.floor((_ff.v + 1) * 0.5 * cells)));
      const key = _ff.face * 1e8 + ix * 1e4 + iy;
      if (seen.has(key)) continue;
      const span = 2 / cells;
      let origin = map.has(key) ? map.get(key).origin : null;
      if (!origin && reach != null) origin = this._origins.get(key);
      if (!origin) {
        faceToDir(_ff.face, -1 + (ix + 0.5) * span, -1 + (iy + 0.5) * span, _dd);
        const h = this.S.heightAt(_dd[0], _dd[1], _dd[2]);
        origin = new THREE.Vector3(_dd[0], _dd[1], _dd[2]).multiplyScalar(R + h);
        if (reach != null) { if (this._origins.size > 4096) this._origins.clear(); this._origins.set(key, origin); }
      }
      if (reach != null && origin.distanceTo(cam) - size * 0.75 > reach) continue;
      seen.add(key);
      if (!map.has(key)) {
        map.set(key, { key, face: _ff.face, ix, iy, size, kind, rank: RANK[kind], fu: -1 + (ix + 0.5) * span, fv: -1 + (iy + 0.5) * span, held: false, isTree: kind === 'near' || kind === 'far', origin, meshes: [], built: false, queued: false, dead: false });
      }
    }
  }

  // A cell is built when its turn comes and laid on the paper when its ground is there as it will stay
  // (or after HOLD_MAX seconds): on an arrival the far ground settles first, so the far masses wash in
  // first, then the trees round the eye, then what grows under them. Nothing is laid on ground that is
  // still sliding into place.
  _hold(ch) {
    ch.held = true; ch.heldAt = this.washNow;
    for (const m of ch.meshes) m.visible = false;
    this.held.push(ch);
  }
  _release(ch) {
    ch.held = false;
    const now = this.washNow;
    if (now > ch.heldAt) this.lastRelease = now;      // (it did wait: the near ground's strokes come after it)
    if (ch.isTree) {
      this._retier(ch);
      // the far forms that stood in for these trees are lifted out as the trees are laid
      if (ch.kind === 'near') { const fsh = this.farShift, far = this.farChunks.get(ch.face * 1e8 + (ch.ix >> fsh) * 1e4 + (ch.iy >> fsh)); if (far && far.built && !far.held && !far.dead) this._retier(far); }
    } else {
      for (const m of ch.meshes) m.userData.laid = now;
      this._showUnder(ch);
      if (ch.meshes.length) this.lastLaid = now;
    }
  }

  // (R1 W2.3) an undergrowth cell's meshes, each submitted only while one of its strokes can be seen (the nearest root
  // nearer than the mesh's reach), and the bushes not at the low tier. A held cell stays hidden (_hold).
  _showUnder(ch) {
    if (!ch.built || ch.held || ch.dead) return;
    const cam = this.camLocal, k = this.rangeScale, low = QUALITY.level === 0;
    for (const m of ch.meshes) {
      const u = m.userData;
      let on = !(u.skipLow && low);
      if (on && u.reach) {
        const reach = u.reach * k, dc = cam.distanceTo(u.rootC);
        if (dc - u.rootR >= reach) on = false;
        else if (dc + u.rootR >= reach) {
          // (the sphere straddles the reach: the strokes drawn, root by root)
          const a = m.instanceMatrix.array, o = ch.origin, r2 = reach * reach;
          const cx = cam.x - o.x, cy = cam.y - o.y, cz = cam.z - o.z;
          on = false;
          for (let i = 0, n = m.count * 16; i < n; i += 16) {
            const dx = a[i + 12] - cx, dy = a[i + 13] - cy, dz = a[i + 14] - cz;
            if (dx * dx + dy * dy + dz * dz < r2) { on = true; break; }
          }
        }
      }
      if (on && u.near) on = ch.origin.distanceTo(cam) - ch.size * 0.75 < u.near * k * 1.5;
      m.visible = on;
    }
  }

  // budgetMs: time this call may spend building and re-tiering. now: the world's wash clock (s).
  update(camLocal, active, budgetMs, now, lead) {
    this.camLocal.copy(camLocal);
    this.leadOn = !!lead;
    if (lead) this.lead.copy(lead);
    // (the powers, the wind knife: trees that are falling, or were felled since the last frame. With none ever felled:
    // one comparison.)
    if (FELLED.size && (this._fallingNow || this._fellV !== FELLED.version)) this._fall(now); else this._fallT = now;
    this.rangeScale = RANGE_SCALE[QUALITY.level] || 1;
    // THE OIL LOOK'S TREES BY THEIR SIZE ON THE SCREEN. The tiers' ranges were made for a desktop's picture (1080 lines and
    // more); on a phone's (some 600 lines) a tree at 90 m is a third the height in pixels, and its 3,000 triangles were
    // more than its pixels. So a tree's ranges follow the picture's height (never under half), and it changes form at the
    // same size on the screen everywhere. The FAR trees also follow the air: from the ground they are drawn to twice the
    // world's visibility at ground level and no farther (Earth: 370 m; beyond that the air has taken them), from the air
    // to their full range. In steps, so that the tiers are not re-sorted with every metre climbed.
    let ts = this.rangeScale, fs = this.rangeScale;
    if (LOOK.oil && !TREES_FULL) {
      // (a tree's ranges are never under the middle tier's: the low tier's 0.28, with the picture's 0.5 on top, left
      // a tree its form for a dozen metres; the low tier still draws no full trees at all)
      ts = Math.max(ts, RANGE_SCALE[1]);
      // (2026-11-18, the owner: "slow optimization needs to be done somewhere while keeping the looks find it".)
      // MEASURED, and this was the thing nobody meant to do: asking for the phone's whole screen does not only cost
      // nine times the pixels, it also makes the world draw FULL-DETAIL TREES TWICE AS FAR AWAY. This number follows
      // the picture's height, so the old 480-line picture gave 0.5 and a 1440-line one gives 1.0 - the desktop's own
      // detail distances, on a phone. Full trees reached 45 m; they now reach 90. Counted on the real world at
      // 3086 x 1440: 5,096,312 triangles a frame on foot against 2,328,938 at the old size, and 8,191,481 from the
      // air against 4,456,337. The pixels went up ninefold as asked; the triangles went up again on top of that.
      // So past 1080 lines the growth stops at TREE_DIST. A phone's screen is small and held close, however dense
      // it is: a tree 90 m off is a few pixels either way. ?treedist= sets it; 1 is the old behaviour.
      // (2026-11-18, found by an independent reader) AND NO CLIFF AT 1080 LINES. Written as a step, the cap vanished
      // the moment the picture fell to 1080, so the ranges JUMPED from 0.8 back to 1.0 as the picture got SMALLER:
      // measured on the real world, on foot, 1081 lines drew 2,241,568 triangles in 670 calls and 1080 lines drew
      // 3,106,332 in 730 -- 39 per cent more work for 19 per cent fewer pixels. The frame controller's ladder lands
      // exactly there (1440, 1320, 1200, 1080, ...), so the one rung it steps down to when frames are slow was the
      // dearest rung of all, and a slow frame made itself slower. The cap now comes in smoothly from 1080 to 1440.
      const grow = Math.max(0.5, Math.round(SCREEN.outH / 1080 * 20) / 20);
      const sk = Math.min(grow, 1 + (TREE_DIST - 1) * Math.min(1, Math.max(0, (SCREEN.outH - 1080) / 360)));
      const vis = this.S.look && this.S.look.visibility ? this.S.look.visibility[0] : 1e4;
      const air = Math.min(1, Math.max(0.5, Math.round((vis * 2 / T_FAR + (SHADOW.alt || 0) / 60) * 8) / 8));
      // (and from the air the far trees reach farther, up to twice: there are no near trees to pay for up there, and the
      // wood ended a few hundred metres off in bare painted ground)
      // (on every tier: the far tree is the cheapest thing in the wood, and at the middle tier on a phone the two cuts
      // together ended the trees 170 m off, bare hills behind: "most of the things haven't rendered", the owner)
      ts *= sk; fs = Math.max(sk, 0.75) * air * (1 + Math.round(Math.min(1, (SHADOW.alt || 0) / 220) * 4) / 4);
    }
    // (THE SPEED TEST'S OWN HANDLE, core/bench.js. The owner's phone says the NEAR trees are 62.7 ms of a 101 ms
    //  frame and nothing in the table says how much of that is their leaves and how much their size on the screen.
    //  Setting this to 0.5 makes every near tree hand over to the far form at HALF the distance, which is exactly
    //  the change that would be made if it is worth it -- so the device measures the fix itself, not a guess.)
    if (this.benchTreeK != null) { ts *= this.benchTreeK; }
    this.treeScale = ts; this.farScale = fs;
    if (now != null) this.washNow = now;
    else { const w = performance.now(); this.washNow += this._washWall ? Math.min(0.1, Math.max(0.02, (w - this._washWall) / 1000)) : 0; this._washWall = w; }
    const alt = camLocal.length() - this.R;
    const show = active && alt < 2500;
    this.group.visible = show && !this.hidden;
    if (!show) {
      // nothing to build for a body the camera is not on
      if (this.queue.length) { for (const ch of this.queue) ch.queued = false; this.queue.length = 0; }
      if (this.held.length) { for (const ch of this.held) if (!ch.dead) this._release(ch); this.held.length = 0; }
      this.lastTreeEval.set(1e9, 0, 0); this.lastUnderEval.set(1e9, 0, 0);
      return;
    }
    if (!this.ready) this._init();
    const k = this.rangeScale, kt = this.treeScale, kq = k + kt * 8 + this.farScale * 64;
    const t0 = performance.now();
    const prof = this.prof;
    if (kq !== this.lastScale) {
      // quality changed: re-evaluate everything
      this.lastScale = kq; this.lastTreeEval.set(1e9, 0, 0); this.lastUnderEval.set(1e9, 0, 0);
      for (const ch of this.treeChunks.values()) if (ch.tierPos) ch.tierPos.set(1e9, 0, 0);
      for (const ch of this.farChunks.values()) if (ch.tierPos) ch.tierPos.set(1e9, 0, 0);
    }
    if (this.lastTreeEval.distanceTo(camLocal) > 20) {
      this.lastTreeEval.copy(camLocal);
      if (this.species.length) {
        this._wanted(TREE_LEVEL, this.treeSize, T1 * kt * (1 + JIT * 0.5) + this.treeSize * 0.75, this.treeChunks, 'near');
        this._wanted(TREE_LEVEL - this.farShift, this.farSize, T_FAR * this.farScale * (1 + JIT * 0.5) + this.farSize * 0.75, this.farChunks, 'far');
      }
      this.treeList = Array.from(this.treeChunks.values()).concat(Array.from(this.farChunks.values()));
    }
    if (this.lastUnderEval.distanceTo(camLocal) > 8) {
      this.lastUnderEval.copy(camLocal);
      // (R1 W2.3: at every height, by the distance from the eye; the radius at the ground is the reach)
      const rU = 44 * ([0.42, 0.82, 1.0][QUALITY.level] || 1) + this.underSize * 0.6, rU2 = UNDER_FAR * k * 1.25 + this.underSize * 1.2;
      this._wanted(UNDER_LEVEL, this.underSize, rU, this.underChunks, 'under', rU);
      // (the outer tier's cell: two undergrowth cells to a side as it was, or four in the oil look -- UNDER2_SHIFT
      //  at the head of this file, and `?undercell=1` for the old pair)
      const u2 = LOOK.oil ? UNDER2_SHIFT : 1;
      this._wanted(UNDER_LEVEL - u2, this.underSize * (1 << u2), rU2, this.under2Chunks, 'under2', rU2);
    }
    let t1 = performance.now(); if (t1 - t0 > prof.wanted) prof.wanted = t1 - t0;
    this.kit.patch.setDrawRange(0, QUALITY.level === 0 ? 60 : Infinity);   // the low tier: five blades a patch
    // the low tier draws half of each undergrowth mesh
    if (QUALITY.level !== this.lastQ) {
      this.lastQ = QUALITY.level;
      for (const ch of this.under2Chunks.values()) for (const m of ch.meshes) if (m.userData.full) m.count = QUALITY.level === 0 ? Math.ceil(m.userData.full * 0.5) : m.userData.full;
      for (const ch of this.underChunks.values()) for (const m of ch.meshes) if (m.userData.full) m.count = QUALITY.level === 0 ? Math.ceil(m.userData.full * 0.5) : m.userData.full;
    }
    // (R1 W2.3) an undergrowth mesh is submitted only while a stroke of it can be seen; the low tier leaves out the bushes
    for (const ch of this.underChunks.values()) this._showUnder(ch);
    for (const ch of this.under2Chunks.values()) this._showUnder(ch);
    // build queue: nearest first; always allowed one item when nothing was built for a while
    let spent = false;
    if (this.queue.length) {
      const q = this.queue, cam = this.camLocal, lead = this.leadOn ? this.lead : null;
      // (what is COMING counts as near, so the queue builds it before the ship is over it)
      for (const ch of q) { const d = ch.origin.distanceTo(cam); ch.dist = lead ? Math.min(d, ch.origin.distanceTo(lead)) : d; }
      q.sort((a, b) => (b.rank - a.rank) || (b.dist - a.dist));     // pop() takes the far masses first, then the nearest
      let built = 0;
      while (q.length) {
        const ch = q[q.length - 1];
        if (ch.dead || ch.built) { q.pop(); ch.queued = false; continue; }
        // start a step only if it is likely to fit in what is left of the slice (the first
        // step of a full slice always goes ahead, so the queue cannot stall)
        const el = performance.now() - t0, est = this.est[ch.kind];
        if (el + est > budgetMs && (built > 0 || budgetMs < 2.5) && !(built === 0 && this.starved > 12 && budgetMs > 0)) break;
        const ts = performance.now();
        // big cells are assembled from several placement cells (four, or sixteen for the oil look's far cell):
        // prepare one missing cell per step, so no single step is long
        if (ch.kind === 'far' || ch.kind === 'under2') {
          // (a far cell is farSpan placement cells to a side -- four in the oil look -- an undergrowth cell always two)
          const ck = ch.kind === 'far' ? 't' : 'u', span = ch.kind === 'far' ? this.farSpan : 2;
          let missing = false;
          for (let b = 0; b < span && !missing; b++) for (let a = 0; a < span && !missing; a++) {
            if (!hasCell(ck, this.S, ch.face, ch.ix * span + a, ch.iy * span + b)) {
              if (ck === 't') treeCell(this.S, ch.face, ch.ix * span + a, ch.iy * span + b); else underCell(this.S, ch.face, ch.ix * span + a, ch.iy * span + b);
              missing = true;
            }
          }
          if (missing) { built++; this.est[ch.kind] += (Math.min(8, performance.now() - ts) - this.est[ch.kind]) * 0.2; continue; }
        }
        q.pop();
        ch.queued = false;
        if (ch.isTree) this._buildTrees(ch); else this._buildUnder(ch);
        ch.built = true; built++;
        this._hold(ch);
        this.est[ch.kind] += (Math.min(8, performance.now() - ts) - this.est[ch.kind]) * 0.2;
      }
      this.starved = built ? 0 : this.starved + 1;
      spent = performance.now() - t0 >= budgetMs;
    }
    // lay the cells whose ground has come
    if (this.held.length) {
      const h = this.held, ready = this.groundReady, wn = this.washNow;
      let w = 0;
      for (let a = 0; a < h.length; a++) {
        const ch = h[a];
        if (ch.dead) continue;
        if (!ready || wn - ch.heldAt > HOLD_MAX || ready(ch.face, ch.fu, ch.fv)) this._release(ch); else h[w++] = ch;
      }
      h.length = w;
    }
    let t2 = performance.now(); if (t2 - t1 > prof.build) prof.build = t2 - t1;
    // re-tier: chunks near a tier boundary react to a few metres of travel, far ones to more
    if (!spent) {
      const list = this.treeList, n = list.length;
      const nearR = T1 * kt * (1 + JIT * 0.5) + this.treeSize;
      for (let c = 0; c < n; c++) {
        const ch = list[(this.retierCursor + c) % n];
        if (!ch.built || !ch.n || ch.held) continue;
        // (the powers: a tree in it is falling, or has been felled)
        if (ch.refill) {
          ch.refill = false; this._retier(ch, true);
          // A LARGE FAR CELL IS REFILLED WHOLE: the oil look's cell is four tree cells to a side and held 969 trees
          // in the measured autumn wood, and the ultimate's sixty felled trees can mark eight such cells, all eight
          // rewritten in the one frame the player is watching the wood go over. MEASURED in Node, that refill is
          // 0.09 ms for the biggest cell against 0.07 ms for the small one, so the hitch this guards against did not
          // appear and this is insurance, not a cure: it lets the rest keep their flag and come next frame, a frame
          // late at worst, which is the trade FALL_RELAY already makes. Only where the cell IS large: the watercolour
          // game's small cells are rewritten as they always were.
          if (this.farSpan > 2 && performance.now() - t0 > budgetMs) { this.retierCursor = (this.retierCursor + c + 1) % n; break; }
          continue;
        }
        if (ch.washUntil && this.washNow > ch.washUntil) { this._retier(ch, true); continue; }
        const moved = ch.tierPos.distanceTo(camLocal);
        if (moved < 3) continue;
        const d = ch.origin.distanceTo(camLocal);
        if (moved > (ch.kind === 'near' || d < nearR + ch.size ? 3 : 18)) {
          this._retier(ch);
          if (performance.now() - t0 > budgetMs) { this.retierCursor = (this.retierCursor + c + 1) % n; break; }
        }
      }
    }
    const t3 = performance.now(); if (t3 - t2 > prof.retier) prof.retier = t3 - t2;
  }
}
