# The elemental powers: design note

Written 2026-11-17 by the coordinator, at the owner's word (the whole instruction is in
`docs/COORDINATOR.md` on branch `r2`). Branch `powers`, behind `?powers=1`, off by default. Wind is
being built first; water, earth and fire are only described here: no code exists for them.

## What the powers are

The explorer shapes the air, the water, the earth and fire, and the world nearby answers. They are
a way of touching the world, not a way of fighting it: **no combat, no enemies, no fail state**,
nothing to run out of, nothing to unlock. A power is worth having when the world's own systems
answer it: wind moves what wind already moves (leaves, dust, sand, snow, rain, grass, trees, water,
the cloak), and so on for the others. The feel aimed at for wind is that of bending the air with
the whole body: broad, flowing, the world swept along. (The feel only: no character, symbol or
name of any show or game is used.)

## How the player uses them (the phone first)

One power button, one aim, four abilities at a time.

**How big.** The hand goes down on the power and THE CIRCLE GROWS, to four times its width in a
little over two seconds; letting go casts it at that size, and a tap is the smallest and casts at
once. Everything of the cast follows the size: how far and wide it reaches, how hard it blows,
how much it throws about, and how many branches it takes. A ball or a channel that is being held
grows in the hand. The word on the screen says how big it is being made.

**What the wind does to the wood.** A real trunk leans about seventeen degrees in the worst gale
and no further, and the world's own weather never passes that. The explorer's wind is not weather:
while any of it is alive a plant may be laid over much further (two and a half times), so a gust
lays a stand over the way it was sent and a quickened place holds it there. When the wind is gone
the wood stands up again.

**Aim.** A power acts where the player looks: the point on the ground under the middle of the
screen, out to the power's own reach. While the power button is held, a ring painted on the ground
shows the place and the size of what will happen. Nothing else is aimed: no cursor to steer.

**Touch (the main target).** A round power button sits above "jump", under the right thumb.
- A short tap does the element's first ability at the aim (wind: a gust).
- Pressing and holding opens a small fan of the element's abilities round the thumb; sliding to one
  and letting go casts it at the aim. An ability that is held (gather and carry, move water) lasts
  while the thumb stays down on it and ends when it lifts.
- The element itself is chosen on a second, smaller button beside it, which opens the same kind of
  fan with the four elements (only wind is there for now, so the button is not shown yet).
The left thumb keeps the walk stick and a drag on the picture still looks around, so the aim can be
moved while a power is held.

**Keyboard and mouse.** `1` `2` `3` `4` choose an ability of the element (`5` `6` where an element
has more); `Q` casts it at the aim, or holds it while the key is down; the right mouse button does
the same as `Q`. `G` will open the choice of element when there is more than one. (None of these
keys is used by the game today.)

**Gamepad.** The right bumper casts or holds; the left bumper steps to the next ability; the
d-pad's four ways will choose the element.

**On the screen.** The power button shows the ability it will do as one word; the fan shows the
others as words on paper tabs, in the hand of the game's other buttons. No bars, no numbers, no
cooldown clocks: an ability that cannot be done here (move water with no water near) does nothing
and says so in a word.

## The four elements

Each has a few abilities; the first is the tap. All of them act on the systems the game already
has, which is what decides whether an ability is cheap or dear.

**Wind** (being built; the order is the owner's)
1. *Gust*: a push of wind at the aim. Lifts and carries leaves, dust, sand and snow, bends plants,
   ruffles water, lifts the cloak.
2. *Gather and carry*: draws the loose things round the explorer into a turning ball of air and
   carries them to the aim while held; let go and they are thrown.
3. *Wind control*: in a chosen place the wind is quickened, or stilled to a dead calm, for a while.
4. *Tornado*: a whirlwind set down at the aim that pulls in and throws round whatever is loose.
5. *Move water*: a wall of wind that pushes water out of the explorer's path (plan and cost first).
6. *Wind knife*: a blade of wind that fells a tree, which falls and stays felled (plan and cost
   first).

**Water** (not built)
1. *Wave*: draws the water at the aim up and sends it along as one swell.
2. *Rain*: calls a shower over a place: the ground darkens, puddles form, dust settles.
3. *Still*: flattens the water at the aim to a mirror for a while.
4. *Ice*: freezes a path across water that can be walked on until it melts.
5. *Mist*: lifts a bank of mist off water or wet ground.

**Earth** (not built)
1. *Rise*: lifts a step or a pillar of ground under the aim, to stand on or to climb.
2. *Smooth*: levels a patch of ground (a place to land the ship).
3. *Grow*: grass, flowers and saplings spring up in a ring at the aim.
4. *Stone*: draws stepping stones up out of water or mud.
5. *Furrow*: cuts a channel that water will follow.

**Fire** (not built)
1. *Light*: a flame in the hand; the lantern's light grows, by night or in a cave.
2. *Warm*: melts snow and ice in a ring, dries wet ground.
3. *Embers*: a drift of sparks that goes with the wind and lights the dark for a while.
4. *Campfire*: a small fire set on the ground that stays, with its own light and smoke.
Fire never spreads and never burns the wood down: there is nothing to lose.

## How they are made (the rules that keep them cheap)

- **Off, they do not exist.** Without `?powers=1` no module of the powers is loaded, no button is
  made, no test in a frame is added.
- **On and unused, they cost one comparison** in each system that could answer ("is there any
  wind of the player's?").
- **In use, a small fixed cost.** The player's wind is a short list of plain shapes (a jet, a
  vortex, a zone), six at most at once, each a few lines of arithmetic. It is handed to the systems
  that already take the dust devils' wind in the same way (the air at a point, the plants' field,
  the loose things), so everything that answers a dust devil answers the player. Nothing of it is
  worked out for every pixel.
- **The costs are measured** (script time a frame, with and without, and the count of the work),
  and written in `docs/COORDINATOR.md`.
- **The mechanics are tested** like the rest of the physics (`src/physics/powers.test.mjs`).
- **What stays** (a felled tree) is kept in the saved game; everything else is weather: it passes.

## Wind, as built (2026-11-17)

Seven abilities on the keys `1` to `7` and on the touch fan, in this order: **gust**, **gather**,
**quicken**, **still**, **whirl**, **part** (move water: below), **knife** (the wind knife: below) (wind control is two of them: a hidden second gesture is not found
on a phone). On the touch button a tap casts (when the thumb lifts); an ability
that is held (gather, part) begins the moment the thumb is down; sliding the thumb off the button
opens the fan, and letting go on a word chooses it and casts it. The aim is shown by A RING ON THE GROUND WHERE THE
POWER WILL ACT, as wide as what it will do there (a whirl's core, a quickened place's fourteen
metres, a gust's width at that distance), lying as the ground lies to the eye; it is there before
the cast and stronger while a power is held. It is drawn by the interface over the picture, not
painted into the world (so it does not hide behind a tree).

The player's wind does not go onto the wind grid of `src/physics/air.js` (its nodes are 16 m
apart). It goes in beside it, by the door the dust devils use: a short list of shapes
(`src/physics/powers.js`) that the air at a point, the plants' field, the loose things and the rain
and snow each ask exactly. The whirl is handed on as a dust devil.

**How the wind is seen.** Moving air has no colour, so each of the explorer's winds carries pale
strokes of its own: light grains that ride the air, in the colours of snow and ice, each drawn as a
narrow stroke as long as the grain flies in a tenth of a second (two and a half metres at most),
lying along its flight. A gust also turns about its own line as it goes (a curl, nine tenths of its
speed one width out), so from behind, where the player stands, a blast is strokes wheeling round
the aim and not dots flying away; and the leaves, dust and grass under it are turned with it. The
strokes are drawn by the painter of the falling leaves, with no new pass and no new texture
(`src/physics/three/expand.js`, option `wisp`; only with `?powers=1`).
A gathered ball does not draw the air into its very middle: inside its core the air only turns,
so what it gathers goes round it a metre out, as a ball, and is not packed into a knot.

**What is heard.** Each cast has a short sound of its own, made in code like the game's other
sounds (a rush for a gust, a low roar for a whirl, a soft breath for the quickened and the stilled
place). There is no sound that lasts while a whirl stands or a ball is held: not built.

**Touched as the owner will touch it (2026-11-17).** The button and the fan were pressed with real
touch events on a phone-sized screen (823 x 384): a tap casts once, the fan opens with its
words, a word is chosen and cast. That first try found the button dead to a finger and a whirl
breaking the physics among real dust devils; both are mended and held by tests. The fan's seven words lie in a column beside
the button, on its left, 32 px apart and clear of the jump button under it (on an arc the top
words lay over each other).

A stilled place is seen to fall still: for its first second strokes stand round its rim, drift in
a little, sink and are gone. And when an ability can do nothing here the screen says so beside
its name for a moment: "no tree in reach" (the knife), "no water here" (the channel, which is
then only a wind along the ground).

**What is not built.** A lasting sound; the choice of element (there is only wind).

## Move water and the wind knife: the plans and their cost

The owner asked for the plan and its cost first, then the simplest version. BOTH ARE BUILT in their
simplest versions (each below, after its plan).

### Move water ("push water out of my path")

*What the player sees.* While the ability is held, a wall of wind runs out ahead of the explorer
and the water there is pushed aside: a channel three metres wide and up to fourteen long, its bed
showing, the water heaped a little along its two sides with spray blowing off them; the explorer
walks through on the bed. Let go, and the water closes again from the far end inward.

*How.* Three small pieces, none of them a fluid simulation.
1. **The water's face is pressed down in the channel** (`WATER_VERT`, `src/render/materials.js`):
   a vertex of the water's mesh inside the channel is lowered toward the bed (its own depth is
   already carried with it, `aDepth`), and one within a metre outside is raised a hand's breadth.
   The channel is two uniforms (where it starts and how it runs; its length, width and how far
   open it is). The mesh near the explorer has a vertex every three quarters of a metre: fine
   enough for a three-metre channel, too coarse for a narrower one.
2. **The explorer stands on the bed** (`src/core/sim.js`, where the depth of water at the feet is
   worked out): inside the open channel the depth is taken as nothing, so the explorer walks and
   does not swim. One comparison a frame.
3. **Spray and rings along the walls**: the channel is one more shape in the list of the
   explorer's wind (a jet that is held), so the loose-things system throws spray off the water it
   lies on, as a gust does now.

*Cost.* Unused: nothing in the frame; the water's shader is compiled with the channel only when
the address says `?powers=1` (a compile-time switch, as the oil look's is). In use: a dozen
operations more for each vertex of the water (some tens of thousands of vertices, no more pixels),
and the spray of one held jet (about 150 grains a second). No new pass, no new texture.

*What it will not do.* The water does not flow round the channel or pile up behind it, a river is
not dammed, and the channel does not follow a slope: it is a dent in the water's face, not moved
water. From high above, where the mesh is coarse, it will look blunt. Fish, boats and waves do
not answer it (the game has none that would).

*The risk.* It touches the water's vertex shader, which is one of the three risky parts (the
shader code). The change is a few lines behind its own switch; it must be seen in a still on the
river and on the sea before it is called done.

*As built (2026-11-17, the simplest version; ability six, "part").* While the power is held, a
channel 3.4 m wide runs out 14 m along the way the explorer looks, beginning a step and a half
behind them, and goes with them as they walk and turn; let go, it closes from the far end inward
in a second and a half. The three pieces are as planned: the water's face is pressed down to its
bed and cut away in the channel and heaped a hand's breadth along its walls (`WATER_VERT`, behind
the define `PC_POWERS`, which is set only with `?powers=1`); the explorer's ground has no water on
the channel's floor (`src/core/sim.js` `explorerEnv`: one comparison a sample without the powers);
spray is thrown off the water along the two walls and strokes of air fly along the floor. The
channel is one shape for all three (`partShape`, `src/physics/powers.js`).
SEEN in stills on the brook by the landing place (0.86 m deep there): a trench across the water
with sloping walls of water, the bed and its fallen leaves showing, the explorer standing dry on
it (depth at the feet 0.00 m; 0.87 m two seconds after letting go). MEASURED: the game's script
for a frame 2.97 ms with the channel held, about 3 ms without: nothing that can be measured.
NOT SEEN: deeper water, where the explorer swims (none within 30 m of the landing place); the sea;
how it looks as it opens and closes. One channel is drawn at a time (a closing one vanishes if a
new one is opened at once). The walls are as coarse as the water's mesh (a point every three
quarters of a metre near the explorer).

### The wind knife ("a blade of wind that cuts down a tree, which falls and stays felled")

*What the player sees.* A thin gust, flat like a blade, leaves the hands; the first tree it meets
within twenty metres is cut near its foot, leans, falls away from the explorer over a second and a
half, and lies there, its crown on the ground. It stays felled when the player walks away and
comes back, and after the game is closed and opened again.

*How.* Four pieces.
1. **Which tree**: the game already knows where the trunks stand, for walking into them
   (`sampleObstacles`). The first trunk within a metre and a half of the aim's line is the one.
2. **That it is felled** is kept in a small list (the tree's place, the way it fell, when):
   in the game's state, and in the saved game (`src/core/save.js`, one new field).
3. **It is drawn fallen** (`src/world/flora.js`, where each tree's place in its mesh is written):
   a felled tree's place is turned about its foot to lie along the way it fell; while it is
   falling, its patch of the wood is written again each frame (a second and a half), then left.
   The same place serves the picture and the shadows, in all three of its forms (full, middle,
   far), so it is felled from every distance.
4. **It no longer stands in the way**: the felled trunk is taken out of what the explorer and the
   ship bump into. (The lying trunk is not something to trip over in the simplest version.)
   A blade is also one more shape in the wind list: it lifts leaves along its path.

*Cost.* Unused, or with no tree felled: nothing (one comparison where a patch of the wood is
written). A felled tree: a few numbers in the save, a lookup in a small table when its patch is
written (which happens only when the eye moves, as now), and for the second and a half of the
fall one patch written each frame (some dozens of trees: well under a millisecond).

*What it will not do.* No stump is left and no log is cut: the whole tree lies down. The fallen
crown does not break or settle on uneven ground: it turns as one stiff thing, so on a steep slope
it may hang in the air or sink in. The wind's sway still moves a fallen crown's leaves. Trees
do not grow back.

*The risk.* It touches `src/world/flora.js`, which the trees' speed work also changed lately; and
the saved game. Neither is one of the three risky parts. A test can check the mechanics (the
right tree is chosen, it is felled once, it is kept in the save and found again).

*As built (2026-11-17, the simplest version; ability seven, "knife").* A thin straight gust
leaves the hands; the first tree within 18 m whose trunk is within 1.2 m of the aim's line is cut:
when the blade reaches it, it goes over away from the explorer AND TO ITS OWN SIDE OF THE AIM (forty
degrees off: straight away, the fall was hidden behind the tree itself from where the player
stands), slowly at first and fast at the end, in a second and a half, and lies with its crown on
the ground. The four pieces are as
planned. The felled trees are one small list (`src/data/felled.js`), each tree named by its own
place in the placement data, so its near form, its far form and the obstacles all know it again
without a search. The trees' renderer lays a felled tree down about its foot
(`src/world/flora.js` `_layTree`, `_fall`); its trunk is no longer in what the explorer and the
ship bump into (`src/world/obstacles.js`); the saved game keeps the list (`src/core/save.js`: a
field written only when a tree has been felled; a save without it is as it always was).
SEEN in stills in the autumn wood: from the side, the trunk leaning at 1.35 s and the tree lying
at 2.7 s, its crown on the ground; from behind (where the player stands) it falls away and reads
less. MEASURED: while a tree falls the game's script is about 5 ms a frame against 3 (its two
patches of the wood are written again each frame for a second and a half); nothing after it
lies, and nothing at all with no tree felled.
NOT SEEN: the far form of a felled tree picked out in a still (it uses the same placement; at
80 m it could not be told from the trees round it); a felled tree after the game is closed and
opened again in a browser (the saved game's round trip is tested in Node, not seen). As planned:
no stump, no log, the lying trunk is not something to trip over, the fallen crown still sways in
the wind, and on a slope the tree lies along the level, not along the ground. At most 400 trees
are kept (the oldest stands again).
