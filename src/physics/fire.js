// !! NOT WIRED INTO THE GAME YET (2026-11-18). Built and tested; nothing calls it. The additions that wire it are
// !! written out as a patch in the fire session's report, for the coordinator to apply.
// !! The fault that held the wiring back IS SETTLED. A fire in an ordinary wood used never to go out, because the
// !! only memory it had was the eleven seconds its ash sits in the list, and it leaned on the game's fuel function
// !! (and so on data/burnt.js, which is capped and forgets) to answer "nothing here" over ground already burnt.
// !! This file now KEEPS ITS OWN MEMORY of the ground each casting has burned: see "WHAT THIS CASTING HAS ALREADY
// !! BURNED" below for the three ways that were offered, which was taken, and why. A fire now goes out whatever
// !! the lasting record has forgotten, and the tests beside this file measure that it does.
// Painted Cosmos physics: the fire the explorer lights, and how it runs (the elemental powers, fire; docs/POWERS.md).
// OWNER: PHYSICS. Pure (no three, no page, no DOM): Node loads it in the tests beside it.
//
// THE OWNER'S WORDS that asked for this (2026-11-18): fire should be "able to spread once its spwan by a magical
// ability", "the place it leaves behind actually gets burnt if its the leaves or ground", and where there is ice it
// "melts away to reveal ground or if there's is no ground it just keeps melting away".
//
// WHAT THIS FILE IS. The fire is A SHORT LIST OF SMALL BURNING PATCHES, at most FIRE.max of them at once, built the
// same way as the wind the explorer makes (powers.js): plain records with a place, a width, an age and how much fuel
// is left under them, stepped once a frame, which the rest of the game then asks about. Nothing here is a grid and
// nothing here is worked out for every pixel.
//   A patch is about two metres across, so a fire is a chain of them: the ability lights one, each patch lights its
// neighbours, and each one burns out behind the ones it lit. That is why a fire leaves A RING OR A FRONT and not a
// growing disc -- the middle has already gone out. A patch that has burned out is kept a little while as ash, so the
// front cannot turn round and walk back into its own ashes.
//
// WHAT THIS FILE DOES NOT DO. It draws nothing: no flame, no smoke, no light (the painter's work). It keeps nothing:
// the lasting record of what is burnt and what has melted is src/data/burnt.js, which this file does not import and
// must not. And it does not know where a tree stands, where the dry grass is or where the water is. The game tells
// it that through two functions it is handed, which is the whole of what it needs to know about the world:
//
//   ctx.fuelAt(bodyId, px, py, pz, out)
//     "Will anything burn here?" The place is in the body's own axes, on the ground. The world fills `out`:
//       out.kind   what is there to burn: FUEL.leaves, FUEL.undergrowth, FUEL.ground, FUEL.ice,
//                  or FUEL.none for water, bare rock, deep snow, a road -- anything that will not catch.
//       out.fuel   0..1, how much of it there is (a thick wood is 1, a few dry stalks 0.2).
//       out.wet    0..1, how damp the place is. At FIRE.wetStop and above nothing catches at all: that is how
//                  rain, wet ground and the sea edge stop a fire without this file knowing what any of them are.
//       out.px/py/pz  come in as the place asked about and may be MOVED by the world onto its own ground, since
//                  only the world knows the height of the land there. Whatever comes back is where the patch burns.
//     What the function returns is not read: only `out` is.
//
//   ctx.windAt(patch, out)
//     The wind at that patch, IN THE BODY'S OWN AXES, in metres a second: out[0], out[1], out[2]. The physics has
//     one call that answers exactly that -- airAt (air.js) fills `o.wind` body-local, with the dust devils AND the
//     player's own wind already folded into it -- so a gust fanning a fire and a stilled place starving one need
//     nothing new anywhere. A caller that has only the grid's east and north turns them with the frame it holds:
//       out[0] = we*f.ex + wn*f.nx;  out[1] = we*f.ey + wn*f.ny;  out[2] = we*f.ez + wn*f.nz;
//     A patch asks again only every FIRE.windEvery seconds (the wind does not turn faster than matters to a fire),
//     and each patch asks on its own beat, so the cost is spread over the frames: measured in the tests beside this
//     file, 8.1 asks a frame with the list at its cap of 64 patches.
//
//   ctx.dampAt(patch)  -- not required. 0..1, how damp the patch's place is NOW. Without it a fire already alight
//     burns on through a shower; with it, rain puts a fire out. Asked every FIRE.dampEvery seconds per patch.
//
// WHAT IT TELLS THE GAME BACK. An ARRAY THE CALLER READS AND CLEARS: F.burns, with F.burns.count rows in use (the
// rows are reused, so reading them allocates nothing). Each row is one place that has burned or melted:
//   { bodyId, px, py, pz, radius, kind, burnt, heat, done, gen, id }
//     px,py,pz,radius  where it was and how wide, in the body's own axes
//     kind             what burned there: FUEL.leaves, FUEL.undergrowth, FUEL.ground, or FUEL.ice for melting
//     burnt            0..1, the share of what was there that has gone BY NOW (it only ever rises for a place, so a
//                      reader can simply take the newest row it sees for that place)
//     heat             for ice only: how much heat has gone into the ice here, in seconds of full flame. How deep
//                      that melts, and whether ground or more ice is underneath, is the world's business, not ours.
//     done             true on the last row about that place: it is finished, the fire has moved on
//     gen              how many patches back to the place the ability lit it (0 = lit by hand)
//     id               the patch's own number. All the rows about one burning of one place share it, so a reader
//                      never mistakes a place that burns again much later (a wood grown back) for the same fire.
// The caller reads the rows each frame and calls clearBurns(F). If it does not, rows stop being added at
// FIRE.burnsMax and F.lost counts what was missed, so a reader that falls behind is loud about it instead of quiet.
//
// Fire is weather: it passes, and nothing of this list goes into the saved game (docs/POWERS.md). What stays is the
// burnt and melted record, which is kept elsewhere.
//
// TWO THINGS A CALLER HAS TO KNOW.
//   WHAT THIS FILE REMEMBERS, AND WHAT IT DOES NOT. Each casting keeps its own memory of the ground it has burned
// (below), so a fire ends by itself and nothing the game does can make it burn for ever. That memory goes when the
// fire does. It is NOT the lasting record: the fuel function should still answer FUEL.none where data/burnt.js says
// the ground is already burnt, so that a fire lit later does not eat a wood that has already gone; but nothing
// about a fire ENDING rests on that any more.
//   A RECORD IS NOT A HANDLE. lightFire returns the patch so that the ability can read it at once, but the slot is
// used again by later fires, so nothing should hold on to it for long. Keep its `id` instead and compare that.
import { clamp01, smoothstep, hash3, eastNorth } from './util.js';

// What can be under a patch. (FUEL.ground means ground that will burn -- dry grass, turf, heath. Bare rock, sand,
// water and wet mud are FUEL.none: the fire reaches them and stops, which is what the owner asked for.)
export const FUEL = Object.freeze({ none: 0, leaves: 1, undergrowth: 2, ground: 3, ice: 4 });

export const FIRE = Object.freeze({
  // HOW MANY PATCHES AT ONCE. The hard cap the task asks for, so that a wood cannot fill the frame with fire.
  // A fire is a front, not a disc: patches 2 m wide standing side by side make a ring some 45 m across at this
  // count, which is a big fire in view, and the ash of the patches just behind the front takes slots too. If a
  // bigger fire is ever wanted this is the one number to raise, and the cost rises with it, straight in line.
  max: 64,
  burnsMax: 96,           // rows of "this burned" kept if the caller is slow to read them (then F.lost counts)
  sizeMax: 4,             // the cast's size, as the wind has (powers.js): a tap is 1, held to the full is 4

  litRadius: 2.0,         // m: how wide one burning patch is (a cast at size 1)
  spread: 2.2,            // m: how far from a patch its neighbour catches, across the wind
  near: 0.75,             // a new patch is refused this near (times the other's width) to one already there or to
                          // its ash: that is what keeps the fire a front and stops it burning the same place twice
  // (2026-11-18) HOW LONG THE WORST CASE BURNS, which is what this number really sets. A fire now always goes out -
  // it keeps its own memory of the ground it has burned - but in endless wood it goes out only when it has filled
  // the whole circle it may reach, and the time grows with the SQUARE of this. Measured, a cast held to the full in
  // wood 4 km across: at 120 m it was still burning after fifty minutes and out at 57.8, having caught 25,393
  // patches. At 60 m that is about fifteen minutes, at 40 m about seven. Sixty is chosen so a forest fire is a thing
  // that burns itself out while you watch the wood, not something left smouldering for an hour.
  // (The number first reported for this was 20.5 minutes. That was measured through a wiring whose fuel question only
  //  reached 136 m, not against the fire's own reach, and it was wrong. This note is the true one.)
  reach: 60,             // m: how far from the place it was lit one casting may run before it stops passing on

  catchTime: 0.45,        // s: a new patch comes up to its full flame over this
  dieTime: 1.1,           // s: and falls away over this once there is nothing left under it
  ashLife: 11,            // s: how long the ash of a burnt-out patch is kept (long enough for the front to be well
                          // away before its slot can be used again)
  maxLife: 40,            // s: a backstop. No patch lives longer than this, whatever the fuel says.
  bareLife: 1.6,          // s: lit where nothing will burn, the ability's own flame shows for a moment and is gone

  // HOW LONG THE FUEL LASTS under one patch at full flame in still air, in seconds, by kind. Leaves flare and are
  // gone; undergrowth smoulders longest; dry ground is quick but there is little of it.
  burnTime: Object.freeze([0, 7, 12, 8, 0]),
  // AND HOW READILY EACH PASSES THE FIRE ON (it divides the wait below): leaves carry a fire fastest.
  quick: Object.freeze([0, 1.4, 1.0, 1.2, 0]),

  seedTime: 2.6,          // s: the wait before a patch lights its next neighbour, across the wind in still air
  tryTime: 0.25,          // s: and the short wait when it looks somewhere and finds nothing there to burn
  seeds: 4,               // neighbours one patch may light in its life (at size 1)

  // THE WIND CARRIES IT. Two things happen, and both are the wind's doing:
  windLean: 0.9,          // every way a patch looks is pulled this far downwind (at a full wind), so the fire leans
  windRate: 2.2,          // and the neighbour downwind catches this many times sooner than the one across the wind
  backRate: 0.25,         // ... while the one upwind waits this much longer than across: a fire creeps against a
                          // wind, it does not run (in a full gale it stops going upwind at all, which is true)
  windCap: 16,            // m/s: the wind at which the lean and the hurry are full
  windFan: 0.045,         // per m/s: and the wind fans a patch, so it eats its own fuel faster and dies sooner

  // ---- THE WIND MAKES A FIRE STRONGER, not merely crooked (the owner, 2026-11-19: "i want them to be able to
  // interact with each other where WIND STRENGTHENS THE FIRE"). MEASURED before this was written, with a real gust
  // cast at a real fire in the real physics: the gust reached the patches (131.99 m/s against 1.76 in still air),
  // and the fire's SHAPE changed -- it stopped creeping into the wind, 17.4 m down to 6.7 -- but it was NO BIGGER
  // AND NO FASTER: 21.1 seconds to 48 patches in still air, 22.0 with the gale on it.
  //   The reason is that `windRate` and `backRate` above only trade one direction against another. A patch walks a
  // wheel of 24 directions in turn, so what the downwind ones gain the upwind ones lose, and the fire merely leans.
  // A real wind does not only bend a fire: it drives it. So three things now grow with the wind as well:
  windMore: 0.9,          // at a full wind a patch lights its neighbours this much more often, EVERY way it looks
  windSeeds: 1.0,         // ... and passes the fire on to this many more neighbours before it is spent
  windReach: 1.35,        // ... and one casting runs this much further from where it was lit, wind-driven

  wetStop: 0.55,          // 0..1 damp: at this and above nothing catches, and a patch alight goes out
  wetSlow: 0.8,           // and below it, damp fuel burns this much slower at worst

  // ---- IT RUNS UPHILL (2026-11-19, the owner: "really figure out the mechanics of how a fire spreads"). After the
  // wind this is the biggest thing a real fire does, and the model had none of it. A flame leans against the slope
  // above it, so the fuel up there is dried and heated before the fire arrives, and the fire climbs; going down it
  // has to work against that and it creeps. The rule of thumb used by people who fight them is that the rate
  // DOUBLES FOR EVERY TEN DEGREES of upslope, which is what `slopeDouble` is (tan 10 degrees = 0.176).
  slopeDouble: 0.176,     // the rise over the run that doubles the rate
  slopeMax: 6,            // ... and the most it may be multiplied by, up a cliff
  slopeMin: 0.35,         // ... and the least, running downhill

  // ---- IT NEEDS AIR. On a world with no air, or air with nothing in it that will burn, nothing catches at all --
  // and the ability's own flame should not pretend otherwise. The game answers ctx.airAt(bodyId) with 0..1; without
  // that function a world is taken to be Earth-like, so nothing changes for a caller that does not know about it.
  airStop: 0.12,          // below this share of Earth's air, nothing catches and what is alight goes out
  airFull: 0.7,           // at and above this it burns as it would on Earth; between, it is slower and feebler

  // ---- AND THE PLAYER'S OWN WIND CHANGES THE AIR A PATCH IS FED (the owner, 2026-11-19: the wind and the fire
  // must act on each other). It is not only that a gust FANS a flame: a flame eats air, and where the player has
  // STILLED the air nothing fresh reaches it, so it gutters and goes out; where they have QUICKENED it, it is fed.
  // The game answers ctx.airScaleAt(patch) with that multiplier -- 1 where the player has done nothing at all, 0 in
  // the heart of a stilled place, above 1 in a quickened one. Without that function nothing here changes.
  // (The melt is not touched by it: melting is heat going into ice, and heat does not need air -- see iceAirless.)
  stillStarve: 1,         // how much of a full stilling bites (1: the heart of a stilled place smothers a fire)
  blowMax: 1.6,           // and the most a quickened place may feed one

  // ---- EMBERS GO AHEAD OF IT (spotting). In a strong wind a fire throws burning pieces downwind, and they start
  // new fires BEYOND the front -- over a firebreak, over a river, over a road. It is why a big fire cannot be held
  // by a line on the ground, and it is the most alarming thing a fire does.
  spotFrom: 0.45,         // of the full wind: below this the wind cannot carry an ember
  spotOdds: 0.16,         // the chance a look throws an ember instead of stepping to its neighbour, at a full wind
  spotStep: 4.5,          // ... and an ember lands this many times the ordinary step downwind
  spotSpread: 0.5,        // rad: how wide the throw scatters either side of downwind

  // ---- A FIRE MAKES ITS OWN WEATHER (the owner: "fire tornados can be a thing"). Where many patches burn close
  // together the air over them rises hard, and air drawn in from every side around a rising column has to turn: a
  // FIRE WHIRL. This file does not make one -- it says WHEN AND WHERE the conditions are there, in F.whirl, and the
  // game's own powers decide what to do about it. Whirls want a big steady burn and a LIGHT wind: a gale tears the
  // column apart before it can turn, which is why `whirlWind` is an upper bound and not a lower one.
  whirlN: 9,              // burning patches within whirlR of each other before a column can form
  whirlR: 9,              // m
  whirlWind: 0.55,        // of the full wind: above this the column is torn apart and no whirl forms
  whirlHold: 1.4,         // s the conditions must hold before it is called a whirl

  // ICE DOES NOT BURN, IT MELTS. A patch on ice has no fuel: the ability's own fire keeps it alive for iceLife and
  // all its heat goes into the ice. The hole opens out to iceRadius as it melts. How deep that goes, and what is
  // under the ice, is the world's business: this file only says how much heat went in where.
  iceLife: 8,             // s
  iceRadius: 4.5,         // m: how wide the melted place grows by the end
  iceHeat: 1,             // heat (in seconds of full flame) one patch puts into the ice each second
  // AND MELTING DOES NOT NEED AIR. The owner, 2026-11-19: "give the ice planets more places to melt or use my
  // abilities". It was not that the ice worlds had no ice -- every one of their biomes is ice or snow under the
  // explorer -- it was that `airK <= 0` put EVERY patch out on its first step, melting ones included, so on
  // Uranus, on Neptune and on Pluto a cast opened a hole 0 m deep. A flame eats air; HEAT DOES NOT. Nothing
  // there burns, nothing spreads, and nothing the ability lights lasts beyond its own short life -- but the heat
  // of the cast goes into the ice as heat always has. In a thin or airless sky it carries less well (no air to
  // carry it, only what the flame shines on the ice), so a melt there is slower, and this is how much slower it
  // may ever get, not a measured figure:
  iceAirless: 0.55,       // share of the full-air melting rate where the air carries nothing at all

  // WHAT ONE CASTING REMEMBERS OF THE GROUND IT HAS BURNED: one bit per this many metres of ground (see the long
  // note below makeFires). About the step a fire takes (`spread` above), so the front can always walk forward into
  // fresh ground while a patch can never light the place one of its own casting's patches was lit in.
  scarCell: 2.5,

  reportEvery: 0.34,      // of a patch's fuel: a row is added when this much more has gone, not one a frame
  meltEvery: 1.0,         // and for ice, every this much heat
  windEvery: 0.12,        // s: how often one patch asks for the wind again
  dampEvery: 0.5,         // s: and how often it asks whether its place has turned damp (if the game says how)
});

// A cast's size, kept between 1 (a tap) and FIRE.sizeMax (held to the full). The same rule as the wind's.
export const sizeOf = (k) => (k > 1 ? (k < FIRE.sizeMax ? k : FIRE.sizeMax) : 1);

// The wheel of directions a patch looks along, as (east, north) pairs: a fine wheel, walked in steps of SPOKESTEP,
// which share no factor with it, so a patch sweeps every way round before it repeats and neighbouring patches do
// not all look the same way (that would make a fire grow as a square).
const SPOKEN = 24, SPOKESTEP = 7;
const SPOKES = new Float64Array(SPOKEN * 2);
for (let i = 0; i < SPOKEN; i++) { const a = (i / SPOKEN) * Math.PI * 2; SPOKES[i * 2] = Math.cos(a); SPOKES[i * 2 + 1] = Math.sin(a); }

// Scratch, made once: nothing in the stepping path below allocates.
const _en = new Float64Array(6);          // east and north at a patch
const _w = new Float64Array(3);           // the wind handed back to us
const _d = new Float64Array(4);           // a direction we are looking along: east, north, its length, its lean
const _f = { kind: 0, fuel: 0, wet: 0, px: 0, py: 0, pz: 0, floor: -1 };   // what the world says is under a place

// Empties a record in place. (powers.js writes a fresh blank over a wind source, which is fine because the player
// casts a few times a minute; a fire lights its neighbours many times a second, so here nothing is made at all.)
function wipe(s) {
  s.up = 0; s.spot = false;
  s.kind = 0; s.bodyId = null;
  s.px = 0; s.py = 0; s.pz = 0;           // where it burns (the body's own axes, on the ground)
  s.ox = 0; s.oy = 0; s.oz = 0;           // and where the whole fire was lit, so we know how far it has run
  s.radius = 0; s.r0 = 0;
  s.heat = 0;                             // 0..1 how fiercely it burns now
  s.fuel = 0; s.fuel0 = 0; s.sent = 0;    // what is left under it, what it had, how much we have reported
  s.floor = -1;                           // m of ice or snow over solid ground here, or -1 where nothing of ours knows
  s.airM = 1;                             // what the player's wind does to the air it is fed (1: nothing)
  s.melt = 0; s.msent = 0;                // heat put into ice here, and how much of that we have reported
  s.wet = 0; s.age = 0; s.life = 0; s.ash = false; s.ashAge = 0;
  s.seeds = 0; s.spoke = 0; s.seedT = 0; s.gen = 0; s.reach = 0;
  s.wx = 0; s.wy = 0; s.wz = 0; s.wt = 0; s.dampT = 0;    // the wind at it (body axes) and the two little clocks
  s.size = 1; s.id = 0; s._sp01 = 0;              // _sp01: how strong the wind at it was, 0..1 (set while stepping)
  s.placed = false; s.x = 0; s.z = 0; s.y = 0;            // its place in the near field's grid (placeFires)
  s.scar = null;                                  // the memory its whole casting shares (below); let go with it
  return s;
}

// The list. `count` patches are in slots 0 .. count - 1, some of them ash.
export function makeFires(seed = 1) {
  const F = [];
  for (let i = 0; i < FIRE.max; i++) F.push(wipe({}));
  F.count = 0; F.seed = seed; F.lit = 0; F.time = 0;
  F.asks = 0;                 // how many times we have asked the world what is underfoot (the world's own cost)
  F.lost = 0;                 // rows of "this burned" that were dropped because the caller had not read them
  F.burns = [];
  F.burns.count = 0;
  for (let i = 0; i < FIRE.burnsMax; i++) F.burns.push({ bodyId: null, px: 0, py: 0, pz: 0, radius: 0, kind: 0, burnt: 0, heat: 0, floor: -1, done: false, gen: 0, id: 0 });
  return F;
}

// ---- WHAT THIS CASTING HAS ALREADY BURNED -----------------------------------------------------------------------
// (2026-11-18. This is the one thing an independent reader measured as broken in this file, and it is settled here.)
//
// A FIRE MUST GO OUT. Before this, the only memory a fire had was the ash in its own list, which is kept eleven
// seconds: long enough for the front to walk away, and no longer. After that the list has forgotten, and nothing
// stopped a patch at the edge from looking back inward, being offered fuel by the world all over again, and
// lighting ground that had already burned. That is a fire that never ends -- measured in a wood 44 m across: still
// burning after five minutes, with 2,219 patches caught. The lasting record (data/burnt.js) was meant to answer
// "there is nothing left here", but it is capped and forgets its oldest marks, so in any wood bigger than its cap
// the memory ran out underneath the fire and the fire came back over its own ashes.
//
// THREE WAYS WERE OFFERED: (a) the fire keeps its own memory of what THIS casting has burned; (b) the record never
// forgets a mark while a fire is still near it; (c) the record's cap is raised to cover the biggest fire anyone can
// light. THIS IS (a), AND HERE IS WHY:
//   * It costs NOTHING IN THE SAVED GAME. Fire is weather: it passes, and nothing of this file is ever saved. Both
//     (b) and (c) would have the saved game carry the whole shape of every fire ever lit, for good.
//   * Whether a fire is out is the fire's own business. With (a) the answer cannot depend on another file's cap, nor
//     on the world's fuel function being written correctly: a fire ends whatever either of those does.
//   * A fire lit in the same place LATER still works. A new casting has a new memory, and burns whatever the world
//     says will still burn there. With (b) or (c) that ground would be refused for good by the record.
//   * It costs one look at a bit of memory for each attempt to spread, and no memory at all until a fire spreads.
// What (b) and (c) are still worth is the PICTURE -- how much burnt ground the owner can see at once -- and that is
// the record's own business, settled over there (data/burnt.js BURN.max).
//
// HOW IT IS KEPT: ONE BIT PER FIRE.scarCell OF GROUND, in a plain array of bytes made once when a casting is lit,
// laid out on the flat about the place it began (east and north there). Flat is exact enough: at the furthest a
// casting can run, the ground measured on the flat is short of the ground measured along the curve by a fifth of a
// metre on the smallest world in the game, and by millimetres on Earth -- a tenth of a cell either way. A casting
// cannot run further than its own `reach`, so the array is sized from that and NOTHING CAN FALL OUTSIDE IT: the
// memory is its own cap, and there is no second cap to go wrong. The biggest cast (reach 264 m) is 215 x 215 cells
// = 5.8 kB of bytes; the smallest (120 m) is 1.2 kB. Every patch of one casting holds the same array, so a child
// inherits its parent's memory, and when the last patch of a casting leaves the list the array goes with it.
//
// WHAT IT REMEMBERS is the cell each patch was lit in, and nothing else. So one cell holds at most one patch of one
// casting, ever -- and THAT is what makes a fire end: there are only so many cells within reach, each is used once,
// and when the ones with anything to burn in them are used up the fire has nowhere left to go. It is coarser than
// the `busy` test below, which is the real spacing among live patches and is unchanged; this is only the long
// memory. A cell about as wide as the step a fire takes leaves the front free to walk forward into fresh ground.
// HOW LONG THAT TAKES, at the worst: a casting in wood that never ends has to eat every cell it can reach, and that
// was measured at about twenty and a half minutes (5,000 patches, 134 to 178 m out) in the whole physics. An
// ordinary wood is tens of seconds. If the owner wants the worst case shorter, FIRE.reach is the number to lower.
const _en0 = new Float64Array(6);         // east and north where a casting began (makeScar only, not while stepping)
function makeScar(s) {
  const r = Math.hypot(s.px, s.py, s.pz) || 1;
  eastNorth(s.px / r, s.py / r, s.pz / r, _en0);
  const half = Math.ceil(s.reach / FIRE.scarCell) + 1, side = half * 2 + 1;
  return {
    ox: s.px, oy: s.py, oz: s.pz,
    ex: _en0[0], ey: _en0[1], ez: _en0[2], nx: _en0[3], ny: _en0[4], nz: _en0[5],
    half, side, n: 0,
    bits: new Uint8Array((side * side + 7) >> 3),
  };
}
// Which bit of a casting's memory a place falls in, or -1 for a place outside it (which is a place outside the
// casting's reach: it is refused, not guessed at).
function scarBit(sc, px, py, pz) {
  const dx = px - sc.ox, dy = py - sc.oy, dz = pz - sc.oz;
  const e = dx * sc.ex + dy * sc.ey + dz * sc.ez, n = dx * sc.nx + dy * sc.ny + dz * sc.nz;
  const i = Math.round(e / FIRE.scarCell) + sc.half, j = Math.round(n / FIRE.scarCell) + sc.half;
  if (i < 0 || j < 0 || i >= sc.side || j >= sc.side) return -1;
  return j * sc.side + i;
}
// Has this casting burned here already? (A place it cannot remember counts as burned: it will not go there.)
function scarred(sc, px, py, pz) {
  const b = scarBit(sc, px, py, pz);
  if (b < 0) return true;
  return (sc.bits[b >> 3] & (1 << (b & 7))) !== 0;
}
// It has now.
function markScar(sc, px, py, pz) {
  const b = scarBit(sc, px, py, pz);
  if (b < 0) return;
  const k = b >> 3, m = 1 << (b & 7);
  if (!(sc.bits[k] & m)) { sc.bits[k] |= m; sc.n++; }
}
// How much memory the fires' memory of themselves is using now, in bytes. Nothing in play needs this; the tests and
// the log ask it, so that the cost is a measured number and not a promise. (One casting's patches share one array,
// so each array is counted once.)
export function fireBytes(F) {
  let n = 0;
  for (let i = 0; i < F.count; i++) {
    const sc = F[i].scar;
    if (!sc) continue;
    let seen = false;
    for (let k = 0; k < i; k++) if (F[k].scar === sc) { seen = true; break; }
    if (!seen) n += sc.bits.length;
  }
  return n;
}

// A free slot, or the slot of the ash that has been dead longest (which is the furthest behind the front), or null
// when every slot holds live fire. Returning null is the cap doing its work: the fire stops widening.
function take(F) {
  if (F.count < FIRE.max) return F[F.count++];
  let k = -1, a = -1;
  for (let i = 0; i < F.count; i++) if (F[i].ash && F[i].ashAge > a) { a = F[i].ashAge; k = i; }
  return k < 0 ? null : F[k];
}

// Asks the world what is under a place, into _f. Afterwards _f.kind is what will burn there (FUEL.none for
// nothing at all) and _f.px/py/pz is where the world says that place really is on its own ground. With no fuel
// function given (some tests) the answer is "nothing here".
function ask(F, bodyId, px, py, pz, ctx) {
  _f.kind = FUEL.none; _f.fuel = 0; _f.wet = 0; _f.px = px; _f.py = py; _f.pz = pz; _f.why = ''; _f.floor = -1;
  if (ctx && ctx.fuelAt) {
    F.asks++;
    ctx.fuelAt(bodyId, px, py, pz, _f);
    if (!(Number.isFinite(_f.px) && Number.isFinite(_f.py) && Number.isFinite(_f.pz))) { _f.px = px; _f.py = py; _f.pz = pz; }
  }
  _f.kind = _f.kind | 0;
  _f.wet = Number.isFinite(_f.wet) ? clamp01(_f.wet) : 0;
  if (!(_f.fuel > 0) && _f.kind !== FUEL.ice) _f.kind = FUEL.none;
  if (_f.wet >= FIRE.wetStop) _f.kind = FUEL.none;      // too damp to catch: rain, wet ground, the sea edge
  return _f.kind;
}
// Sets a patch up from the last answer in _f: where it really burns, what is under it, how long that will last.
function settle(s) {
  s.px = _f.px; s.py = _f.py; s.pz = _f.pz;
  s.kind = _f.kind; s.wet = _f.wet; s.why = _f.why || '';
  s.floor = Number.isFinite(_f.floor) ? _f.floor : -1;
  if (s.kind === FUEL.ice) { s.fuel = 0; s.fuel0 = 0; s.life = FIRE.iceLife * (0.7 + 0.3 * s.size); }
  else if (s.kind !== FUEL.none) { s.fuel0 = clamp01(_f.fuel); s.fuel = s.fuel0; s.life = FIRE.maxLife; }
  else { s.fuel0 = 0; s.fuel = 0; s.life = FIRE.bareLife; }   // nothing to burn: the ability's own flame, for a moment
  return s;
}

// ONE OF THE WAYS A PATCH LOOKS, LEANED DOWNWIND. i: which spoke of the wheel; hE, hN: the way the wind blows
// (level, unit); sp01: how strong it is, 0..1. Written into _d: the direction east and north, how long the leaned
// arrow came out (longer downwind, short upwind, which is how far the next patch is set), and its lean (1 straight
// downwind, -1 straight into the wind, which is how long the next patch takes to catch).
function spokeAt(i, hE, hN, sp01) {
  const b = FIRE.windLean * sp01, k = i * 2;
  let vE = SPOKES[k] + hE * b, vN = SPOKES[k + 1] + hN * b;
  let L = Math.hypot(vE, vN);
  if (L < 1e-4) { vE = hE; vN = hN; L = 1; }     // straight into a full wind: there is nowhere to go but with it
  _d[0] = vE / L; _d[1] = vN / L; _d[2] = L;
  _d[3] = _d[0] * hE + _d[1] * hN;
  return _d;
}
// How long this patch waits before the neighbour along that spoke catches. Downwind it is soon, upwind it is long.
function waitFor(s, lean) {
  const q = FIRE.quick[s.kind] || 1;
  let r = 1 + FIRE.windRate * s._sp01 * lean;
  if (r < FIRE.backRate) r = FIRE.backRate;
  // and the wind drives the whole fire on, whichever way this look happens to point
  r *= 1 + FIRE.windMore * (s._sp01 || 0);
  return FIRE.seedTime / (r * q * slopeRate(s.up));
}

// How much faster a fire goes for the slope it is crossing: the rate doubles for every ten degrees of upslope and
// halves going down, bounded both ways. `up` is the rise over the run, as a patch was reached across it.
export function slopeRate(up) {
  if (!(up === up)) return 1;
  const k = Math.pow(2, up / FIRE.slopeDouble);
  return k > FIRE.slopeMax ? FIRE.slopeMax : k < FIRE.slopeMin ? FIRE.slopeMin : k;
}

// Steps the list by dt. ctx holds the two functions above (and dampAt if the game has one). Returns how many
// patches are in the list, ash and all.
export function stepFires(F, dt, ctx) {
  if (!F.count) { F.whirl = null; F.whirlT = 0; return 0; }
  F.time += dt;
  // The air on this world, asked once a frame and not once a patch: it does not change under a fire.
  F.air = ctx && ctx.airAt ? clamp01(ctx.airAt(F[0].bodyId)) : 1;
  const airK = F.air <= FIRE.airStop ? 0
    : F.air >= FIRE.airFull ? 1
    : (F.air - FIRE.airStop) / (FIRE.airFull - FIRE.airStop);
  F.airK = airK;
  const n0 = F.count;                      // a patch lit this frame takes its first step in the next one
  for (let i = 0; i < n0; i++) {
    const s = F[i];
    if (s.ash) { s.ashAge += dt; continue; }
    s.age += dt;

    // the wind at it, on its own beat
    s.wt -= dt;
    if (s.wt <= 0) {
      s.wt = FIRE.windEvery;
      if (ctx && ctx.windAt) {
        _w[0] = 0; _w[1] = 0; _w[2] = 0;
        ctx.windAt(s, _w);
        if (Number.isFinite(_w[0]) && Number.isFinite(_w[1]) && Number.isFinite(_w[2])) { s.wx = _w[0]; s.wy = _w[1]; s.wz = _w[2]; }
      }
      // and what the player's own wind does to the air it is fed, asked on the same beat (see stillStarve above)
      s.airM = 1;
      if (ctx && ctx.airScaleAt) {
        const m = ctx.airScaleAt(s);
        if (Number.isFinite(m)) s.airM = m >= 1 ? (m > FIRE.blowMax ? FIRE.blowMax : m) : 1 - FIRE.stillStarve * (1 - (m > 0 ? m : 0));
      }
    }
    // and whether its place has turned damp under it (only if the game says how)
    if (ctx && ctx.dampAt) {
      s.dampT -= dt;
      if (s.dampT <= 0) { s.dampT = FIRE.dampEvery; const w = ctx.dampAt(s); if (Number.isFinite(w)) s.wet = clamp01(w); }
    }

    // east and north at the patch, and the wind there as a level direction and a speed
    const r = Math.hypot(s.px, s.py, s.pz) || 1, ux = s.px / r, uy = s.py / r, uz = s.pz / r;
    eastNorth(ux, uy, uz, _en);
    const wE = s.wx * _en[0] + s.wy * _en[1] + s.wz * _en[2], wN = s.wx * _en[3] + s.wy * _en[4] + s.wz * _en[5];
    const ws = Math.hypot(wE, wN);
    const sp01 = ws > FIRE.windCap ? 1 : ws / FIRE.windCap;
    const hE = ws > 1e-4 ? wE / ws : 0, hN = ws > 1e-4 ? wN / ws : 0;
    s._sp01 = sp01;

    // HOW FIERCELY IT BURNS NOW: it comes up to a full flame over catchTime and falls away over dieTime.
    // Is it going out? A flame with nothing under it is the ability's own: it lives its short life and goes,
    // whether the place is wet or dry, so the player always sees that the cast happened. A flame with something
    // under it goes out when that has gone (ice has none: it melts for its own time) or if its place turns damp.
    // (ICE IS THE ONE THING AIRLESSNESS DOES NOT PUT OUT: see `iceAirless` above. A melting patch lives its
    //  iceLife whatever the sky is made of; everything else goes out at once without air to burn.)
    const ice = s.kind === FUEL.ice;
    const aK = airK * s.airM;              // the air THIS patch is fed: the world's, and what the player has done to it
    const out = s.age >= s.life || (aK <= 0 && !ice) ||
      (s.kind !== FUEL.none && (s.wet >= FIRE.wetStop || (!ice && !(s.fuel > 0))));
    s.heat += out ? -dt / FIRE.dieTime : dt / FIRE.catchTime;
    if (s.heat > 1) s.heat = 1;

    if (ice) {
      // it melts instead of burning, and the melted place opens out while it does. Thin air carries the heat less
      // well, so the same cast opens a shallower hole on Pluto than on Earth -- but it does open one.
      s.melt += dt * s.heat * FIRE.iceHeat * (FIRE.iceAirless + (1 - FIRE.iceAirless) * airK);
      const f = s.age < s.life ? s.age / s.life : 1;
      s.radius = s.r0 + (FIRE.iceRadius * (0.6 + 0.4 * s.size) - s.r0) * f;
      if (s.melt - s.msent >= FIRE.meltEvery) report(F, s, false);
    } else if (s.fuel > 0 && s.heat > 0) {
      // the fuel goes, faster in a wind (which fans it) and slower where it is damp
      // thin air burns slowly as well as feebly: a flame in half of Earth's air is not half a flame, it is a
      // slower one, so the fuel under it lasts longer rather than less time
      const fan = (1 + FIRE.windFan * ws) * (0.35 + 0.65 * aK), damp = 1 - FIRE.wetSlow * s.wet;
      const bt = FIRE.burnTime[s.kind] || 1;
      s.fuel -= dt * s.heat * fan * (damp > 0.1 ? damp : 0.1) / bt;
      if (s.fuel < 0) s.fuel = 0;
      const gone = s.fuel0 > 0 ? (s.fuel0 - s.fuel) / s.fuel0 : 1;
      if (gone - s.sent >= FIRE.reportEvery) report(F, s, false);
    }

    // it is out. Its ash is kept a little while, so that the front cannot turn round and walk back into the place
    // it has just burnt. A patch that never had anything to burn leaves no ash: there is nothing there to guard.
    if (s.heat <= 0 && out) {
      s.heat = 0;
      s.ash = true;
      s.ashAge = s.kind === FUEL.none ? FIRE.ashLife + 1 : 0;
      if (s.kind !== FUEL.none) report(F, s, true);
      continue;
    }

    // IT SPREADS. Well alight, with neighbours left to light, it looks one way at a time. Ice passes nothing on
    // (there is nothing in ice to carry a fire), and nor does a patch with nothing under it.
    if (aK > 0 && s.seeds > 0 && s.heat >= 0.55 && s.kind !== FUEL.ice && s.kind !== FUEL.none && ctx && ctx.fuelAt) {
      s.seedT -= dt;
      if (s.seedT <= 0) {
        const caught = sow(F, s, ctx, _en, hE, hN, sp01);
        s.spoke = (s.spoke + SPOKESTEP) % SPOKEN;
        if (caught) { s.seeds--; s.seedT = waitFor(s, spokeAt(s.spoke, hE, hN, sp01)[3]); }
        else s.seedT = FIRE.tryTime;         // nothing there: it looks somewhere else in a moment
      }
    }
  }
  // the ash that is long cold gives its slot back (the same shuffle stepWinds does in powers.js)
  const was = F.count;
  let n = 0;
  for (let i = 0; i < was; i++) {
    const s = F[i];
    if (s.ash && s.ashAge > FIRE.ashLife) continue;
    if (n !== i) { const t = F[n]; F[n] = s; F[i] = t; }
    n++;
  }
  F.count = n;
  // and the slots that are out of use are emptied, so that the last patch of a fire that is over lets go of its
  // casting's memory of the ground (a few kilobytes) there and then, instead of holding it until that slot is used
  // again. Nothing is made here: wipe only writes over what is already there.
  for (let i = n; i < was; i++) wipe(F[i]);
  whirlCheck(F, dt);
  return n;
}

// ---- A FIRE MAKES ITS OWN WEATHER ----------------------------------------------------------------------------
// (the owner, 2026-11-19: "fire tornados can be a thing"). Where enough patches burn close together the air over
// them rises hard, and the air drawn in to replace it from every side has to turn. This says only WHEN AND WHERE
// the conditions are there -- F.whirl -- and for how long they have held. Nothing is made and nothing is drawn: the
// game's own powers decide what a whirl is. Two passes over at most 64 patches, so it costs nothing worth counting.
//
// A whirl wants a BIG STEADY BURN and a LIGHT WIND. That the wind must be light is the part people get wrong: a
// gale tears the rising column apart before it can turn, which is why real fire whirls are seen in the lee of a
// ridge and in the quiet heart of a big fire, not out on a windy flank.
function whirlCheck(F, dt) {
  let cx = 0, cy = 0, cz = 0, live = 0, wind = 0;
  for (let i = 0; i < F.count; i++) {
    const s = F[i];
    if (s.ash || !(s.heat > 0.5) || s.kind === FUEL.none || s.kind === FUEL.ice) continue;
    cx += s.px; cy += s.py; cz += s.pz; wind += s._sp01 || 0; live++;
  }
  if (live < FIRE.whirlN) { F.whirl = null; F.whirlT = 0; return; }
  cx /= live; cy /= live; cz /= live; wind /= live;
  if (wind > FIRE.whirlWind) { F.whirl = null; F.whirlT = 0; return; }   // a gale tears the column apart
  let near = 0;
  const R2 = FIRE.whirlR * FIRE.whirlR;
  for (let i = 0; i < F.count; i++) {
    const s = F[i];
    if (s.ash || !(s.heat > 0.5) || s.kind === FUEL.none || s.kind === FUEL.ice) continue;
    const dx = s.px - cx, dy = s.py - cy, dz = s.pz - cz;
    if (dx * dx + dy * dy + dz * dz <= R2) near++;
  }
  if (near < FIRE.whirlN) { F.whirl = null; F.whirlT = 0; return; }
  F.whirlT += dt;
  if (F.whirlT < FIRE.whirlHold) { F.whirl = null; return; }             // it must hold before it is called one
  const w = F.whirl || (F.whirl = { bodyId: null, px: 0, py: 0, pz: 0, strength: 0, patches: 0, held: 0 });
  w.bodyId = F[0] ? F[0].bodyId : null;
  w.px = cx; w.py = cy; w.pz = cz;
  w.patches = near;
  w.held = F.whirlT;
  // how hard it turns: more of the fire gathered in one place, and the stiller the air, the stronger the column
  w.strength = clamp01((near - FIRE.whirlN) / (FIRE.whirlN * 2)) * (1 - wind / FIRE.whirlWind) * (0.5 + 0.5 * (F.airK == null ? 1 : F.airK));
}

// Is there anything burning (or lately burnt) within `lim` of a place? This is what keeps a fire a FRONT: the only
// places left to catch are outside the patches already there, so the fire walks outward and the middle goes out.
function busy(F, bodyId, qx, qy, qz) {
  for (let i = 0; i < F.count; i++) {
    const o = F[i];
    if (o.bodyId !== bodyId) continue;
    const bx = qx - o.px, by = qy - o.py, bz = qz - o.pz, lim = FIRE.near * (o.radius > o.r0 ? o.radius : o.r0);
    if (bx * bx + by * by + bz * bz < lim * lim) return true;
  }
  return false;
}

// One look along one spoke: is there something out there to burn, and is the place free? Lights it if so.
// The order of the tests is the order of their cost: our own arithmetic first, then the world's fuel function
// (which is the dear one), and a record is taken only once we know a fire really catches there.
function sow(F, s, ctx, en, hE, hN, sp01) {
  let d = spokeAt(s.spoke, hE, hN, sp01);
  let dE = d[0], dN = d[1];
  const L = d[2];
  let step = FIRE.spread * (0.7 + 0.3 * L) * (0.85 + 0.15 * s.size);
  // AN EMBER GOES AHEAD OF IT. In a strong wind a look may be thrown far downwind instead of stepped to the
  // neighbour: that is how a fire crosses a firebreak, a road or a river, and no line on the ground holds a big one.
  let spot = false;
  if (sp01 >= FIRE.spotFrom && (hE || hN)) {
    const roll = hash3(s.id, s.spoke + 61, F.lit + 7, F.seed);
    if (roll < FIRE.spotOdds * sp01) {
      const a = (hash3(s.id, s.spoke + 131, F.lit + 29, F.seed) - 0.5) * 2 * FIRE.spotSpread;
      const ca = Math.cos(a), sa = Math.sin(a);
      dE = hE * ca - hN * sa; dN = hE * sa + hN * ca;
      step *= FIRE.spotStep;
      spot = true;
    }
  }
  const qx = s.px + (en[0] * dE + en[3] * dN) * step;
  const qy = s.py + (en[1] * dE + en[4] * dN) * step;
  const qz = s.pz + (en[2] * dE + en[5] * dN) * step;
  // one casting burns itself out within `reach` of where it was lit: it does not cross the world
  const ax = qx - s.ox, ay = qy - s.oy, az = qz - s.oz;
  // a wind-driven fire runs further from where it was lit than a creeping one
  const rch = s.reach * (1 + (FIRE.windReach - 1) * (s._sp01 || 0));
  if (ax * ax + ay * ay + az * az > rch * rch) return false;
  // this casting has burned here already: it does not go round twice, which is what makes a fire end (one look at a
  // bit of memory, and before the dear question below, so a patch hemmed in by its own burnt ground costs the world
  // nothing at all)
  if (s.scar && scarred(s.scar, qx, qy, qz)) return false;
  if (busy(F, s.bodyId, qx, qy, qz)) return false;
  if (ask(F, s.bodyId, qx, qy, qz, ctx) === FUEL.none) return false;      // water, rock, wet ground: it stops here
  // AN EMBER CANNOT SET ICE ALIGHT. A burning piece carried on the wind lands on ice and goes out; only the
  // ability's own fire, cast deliberately, melts. (Found by the test beside this file the moment embers were added:
  // the melting ran 14.9 m into an ice sheet that a fire is supposed to stop at the edge of.)
  if (spot && _f.kind === FUEL.ice) return false;
  // the world may have moved the place onto its own ground, so look again that it is still free, and still fresh
  if (_f.px !== qx || _f.py !== qy || _f.pz !== qz) {
    if (busy(F, s.bodyId, _f.px, _f.py, _f.pz)) return false;
    if (s.scar && scarred(s.scar, _f.px, _f.py, _f.pz)) return false;
  }
  const t = take(F);
  if (!t) return false;                     // the cap: the fire already has as many patches as it may have
  wipe(t);
  t.bodyId = s.bodyId;
  t.ox = s.ox; t.oy = s.oy; t.oz = s.oz;
  t.size = s.size; t.gen = s.gen + 1; t.reach = s.reach;
  t.id = ++F.lit;
  t.r0 = FIRE.litRadius * (0.7 + 0.3 * s.size); t.radius = t.r0;
  t.seeds = Math.round(FIRE.seeds * (0.7 + 0.3 * s.size) * (1 + FIRE.windSeeds * (sp01 || 0)));
  t.spoke = Math.floor(hash3(t.id, 3, 11, F.seed) * SPOKEN) % SPOKEN;
  t._sp01 = sp01;
  t.wx = s.wx; t.wy = s.wy; t.wz = s.wz;    // it knows the wind its parent knew until it asks for itself
  settle(t);
  // it shares its whole casting's memory of the ground, and the place it burns is now in it
  t.scar = s.scar;
  if (t.scar) markScar(t.scar, t.px, t.py, t.pz);
  // THE SLOPE IT WAS REACHED ACROSS. The world has put the new place on its own ground, so the rise over the run is
  // known here and nowhere else; the new patch carries it, and seeds that much sooner or later for it.
  const rHere = Math.hypot(s.px, s.py, s.pz), rThere = Math.hypot(t.px, t.py, t.pz);
  t.up = step > 1e-3 ? (rThere - rHere) / step : 0;
  if (!(t.up === t.up)) t.up = 0;
  t.spot = spot;
  t.seedT = waitFor(t, spokeAt(t.spoke, hE, hN, sp01)[3]);
  return true;
}

// Adds a row to F.burns: one place that has burned (or, for ice, taken this much heat). `done`: it is finished.
function report(F, s, done) {
  const B = F.burns;
  if (B.count >= FIRE.burnsMax) { F.lost++; s.sent = s.fuel0 > 0 ? (s.fuel0 - s.fuel) / s.fuel0 : 1; s.msent = s.melt; return null; }
  const b = B[B.count++];
  b.bodyId = s.bodyId; b.px = s.px; b.py = s.py; b.pz = s.pz; b.radius = s.radius;
  b.kind = s.kind; b.gen = s.gen; b.done = !!done; b.id = s.id;
  b.burnt = s.kind === FUEL.ice ? 0 : (s.fuel0 > 0 ? (s.fuel0 - s.fuel) / s.fuel0 : 1);
  b.heat = s.melt;
  // and for a melt, HOW MUCH THERE IS TO MELT: a hand's depth of lying snow with the ground under it, or -1 where
  // this is a glacier and nothing of ours knows how deep it goes. The record needs it to say when the ground shows.
  b.floor = s.kind === FUEL.ice ? s.floor : -1;
  s.sent = b.burnt; s.msent = s.melt;
  return b;
}
// The caller reads F.burns[0 .. count-1] each frame and then calls this.
export function clearBurns(F) { F.burns.count = 0; F.lost = 0; }

// THE ABILITY LIGHTS A FIRE at p (the body's own axes, on the ground). size 1..FIRE.sizeMax as the wind's casts are.
// Returns the patch, or null when every slot is full of live fire. A fire is lit even where nothing will burn: the
// ability's own flame shows for a moment and dies, which is how the player learns that wet ground will not take.
export function lightFire(F, bodyId, p, size = 1, ctx = null) {
  // A PLACE THAT IS NOT A REAL PLACE IS REFUSED (2026-11-18, found by the reader who checked this file). The aim
  // comes from the view and a sample of the ground, and either can hand back a not-a-number; one of those used to
  // be written straight into a patch, and from there into the lasting record, where it poisons a filing cell for
  // the rest of the session. One comparison, at the one door everything comes in by.
  if (!bodyId || !p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) return null;
  const s = take(F);
  if (!s) return null;
  const k = sizeOf(size);
  wipe(s);
  s.bodyId = bodyId;
  s.px = p.x; s.py = p.y; s.pz = p.z;
  s.size = k; s.id = ++F.lit; s.gen = 0;
  s.reach = FIRE.reach * (0.6 + 0.4 * k);
  s.r0 = FIRE.litRadius * (0.7 + 0.3 * k); s.radius = s.r0;
  s.seeds = Math.round(FIRE.seeds * (0.7 + 0.3 * k));
  s.spoke = Math.floor(hash3(s.id, 3, 11, F.seed) * SPOKEN) % SPOKEN;
  s._sp01 = 0;
  ask(F, bodyId, p.x, p.y, p.z, ctx);
  settle(s);
  s.ox = s.px; s.oy = s.py; s.oz = s.pz;        // after settle: the world may have moved it onto its own ground
  // The memory of the ground this casting burns, made here and shared by every patch that catches from this one.
  // A flame with nothing under it, and a flame on ice, pass nothing on, so they need none and are given none: a
  // cast on wet rock costs not one byte.
  if (s.kind !== FUEL.none && s.kind !== FUEL.ice) { s.scar = makeScar(s); markScar(s.scar, s.px, s.py, s.pz); }
  s.seedT = FIRE.seedTime / (FIRE.quick[s.kind] || 1);
  return s;
}

// Puts the list in the near field's grid (x, z in metres, as placeWinds does in powers.js), and keeps the whole
// list's bounds, so that a reader can answer "nothing burning here" in two comparisons.
export function placeFires(F, frame, bodyId) {
  let any = false, bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity;
  for (let i = 0; i < F.count; i++) {
    const s = F[i];
    s.placed = s.bodyId === bodyId && frame.bodyId === bodyId;
    if (!s.placed) continue;
    s.x = frame.lx(s.px, s.py, s.pz); s.z = frame.lz(s.px, s.py, s.pz);
    s.y = Math.hypot(s.px, s.py, s.pz) - frame.r0;
    if (Math.abs(s.x) > 400 || Math.abs(s.z) > 400) { s.placed = false; continue; }
    any = true;
    const R = s.radius > s.r0 ? s.radius : s.r0;
    if (s.x - R < bx0) bx0 = s.x - R;
    if (s.x + R > bx1) bx1 = s.x + R;
    if (s.z - R < bz0) bz0 = s.z - R;
    if (s.z + R > bz1) bz1 = s.z + R;
  }
  F.bany = bx0 <= bx1; F.bx0 = bx0; F.bx1 = bx1; F.bz0 = bz0; F.bz1 = bz1;
  return any;
}

// How fiercely it is burning at grid (x, z): 0 nowhere near, 1 in the heart of a patch. For whoever wants it -- the
// smoke and embers of the loose things, the light the painter adds, the explorer feeling the heat.
// placeFires must have been called this frame, or there is nothing in the grid to find and this answers 0.
export function fireAt(F, x, z) {
  if (!F.count) return 0;
  if (F.bany !== undefined) {
    if (!F.bany) return 0;
    if (x < F.bx0 || x > F.bx1 || z < F.bz0 || z > F.bz1) return 0;
  }
  let m = 0;
  for (let i = 0; i < F.count; i++) {
    const s = F[i];
    if (s.ash || !s.placed || !(s.heat > 0)) continue;
    const rx = x - s.x, rz = z - s.z, R = s.radius;
    const d2 = rx * rx + rz * rz;
    if (d2 > R * R) continue;
    const h = s.heat * (1 - smoothstep(R * 0.45, R, Math.sqrt(d2)));
    if (h > m) m = h;
  }
  return m;
}

// Is anything actually alight (as against ash waiting for its slot back)? One walk of a short list, for the systems
// that would otherwise do real work: no smoke to make, no light to add, when nothing burns.
export function anyBurning(F) {
  for (let i = 0; i < F.count; i++) if (!F[i].ash && F[i].heat > 0) return true;
  return false;
}

// Puts a fire out: the whole list, or one body's fires. (The ability may want to call off its own fire; a session
// that leaves a body wants its fires gone.) The places that had begun to burn are reported as finished first.
// PUT OUT WHAT IS BURNING NEAR A PLACE (2026-11-19, for the fire's `snuff`: the owner asked for five new fire
// abilities, and a power that can start a forest fire needs one that can stop it). Everything within `r` of p is
// reported as finished and turned to ash, so the lasting record takes it and the front cannot walk back through.
// Returns how many patches were put out.
export function douseNear(F, bodyId, p, r) {
  if (!bodyId || !p || !(r > 0)) return 0;
  const r2 = r * r;
  let n = 0;
  for (let i = 0; i < F.count; i++) {
    const s = F[i];
    if (s.ash || s.bodyId !== bodyId) continue;
    const dx = s.px - p.x, dy = s.py - p.y, dz = s.pz - p.z;
    if (dx * dx + dy * dy + dz * dz > r2) continue;
    if (s.kind !== FUEL.none) report(F, s, true);
    s.ash = true; s.ashAge = 0; s.heat = 0; s.fuel = 0;
    n++;
  }
  if (n) { F.whirl = null; F.whirlT = 0; }
  return n;
}

export function douseFires(F, bodyId = null) {
  for (let i = 0; i < F.count; i++) {
    const s = F[i];
    if (bodyId && s.bodyId !== bodyId) continue;
    if (!s.ash && s.kind !== FUEL.none) report(F, s, true);
    s.ash = true; s.ashAge = FIRE.ashLife + 1;
  }
  const was = F.count;
  let n = 0;
  for (let i = 0; i < was; i++) { const s = F[i]; if (s.ash && s.ashAge > FIRE.ashLife) continue; if (n !== i) { const t = F[n]; F[n] = s; F[i] = t; } n++; }
  F.count = n;
  for (let i = n; i < was; i++) wipe(F[i]);     // (as in stepFires: an unused slot holds no fire's memory)
  return n;
}
