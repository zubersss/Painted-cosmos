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
