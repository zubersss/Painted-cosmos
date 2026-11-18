# Fire: how it joins the game

Written 2026-11-18 by the coordinator, at the owner's word. This is a PLAN, not a report of work
done: nothing in it has been seen on a screen. It is the map the next sessions build from, so
every hook below names a real file, a real function and the line it is on today (branch
`look-dev`, build v16). Line numbers are given with enough of the code beside them to find it
again if it has moved: `src/main.js`, `src/core/bench.js`, `src/core/preset.js` and
`src/render/index.js` were being edited while this was written, and `src/main.js` had already
shifted by five lines between two readings of it.

**The owner's words that started this** (2026-11-18):

> "start adding fire with it being able to spread once its spwan by a magical ability and the
> place it leaves behind actually gets burnt if its leaves and gest burnt if its the leaves or
> ground ice melts away to reveal ground or if there's is no ground it just keeps melting away"

Read with this note: `docs/POWERS.md` (the design for all four elements, and wind as built).

**Where this departs from `docs/POWERS.md`.** That note says, of fire: *"Fire never spreads and
never burns the wood down: there is nothing to lose."* The owner has now asked for the opposite,
so that sentence is overruled by the instruction above and `docs/POWERS.md` must be corrected
when fire is built. Everything else of that note is kept: no combat, no enemies, nothing that
can hurt the explorer, nothing to run out of, one button and one aim, and the rule that a power
is worth having only when the world's own systems answer it. Two of its four fire abilities are
kept by name (*warm*, here called **melt**; *embers*) and two are held back (*light* and
*campfire*: below). One ability is added that `docs/POWERS.md` does not have (**snuff**), for the
reason given in part 1.

Two other agents are writing the fire itself (`src/physics/fire.js`) and the lasting record of
what is burnt and melted (`src/data/burnt.js`) as this is written. This note does not name their
functions, because their names are theirs to choose; it names what the rest of the game needs
to ask them for.

---

## 1. What the player does

**In plain words.** Fire is a second element beside the wind. The power button under the right
thumb works exactly as it does now; a smaller button beside it chooses which element the thumb
is holding, wind or fire. Choose fire and the same button, the same fan of words and the same
ring on the ground now do fire instead of wind. Hold the button and the circle grows, as it does
for the wind: a bigger circle means a bigger first patch of fire and more heat in it, so it
spreads further before it dies. A tap is the smallest.

The abilities, in the order of the keys and of the touch fan:

1. **kindle** — fire is set down where you are looking, and it spreads through whatever will
   burn: leaves on the ground, the undergrowth, the crowns of trees. This is the owner's
   "spawn".
2. **melt** — a ring of heat with no flame. Ice and snow melt away inside it and wet ground
   dries. Nothing is set alight, so the owner can melt ice without burning a wood down.
3. **embers** — a drift of sparks that goes where the wind goes and may light what it lands on.
   A way to carry fire across a gap, and a thing to look at by night.
4. **snuff** — the fire you are looking at goes out. Not in `docs/POWERS.md`; it is here because
   there is no other way back. A burnt wood is kept for good in the saved game, so a fire the
   player cannot stop is the one thing in this game that could be lost by accident. The wind's
   **still** also starves a fire (part 3), which is a happy accident of what is already built.

Held back for now, and why: **light** (a flame in the hand that makes the lantern brighter) needs
a new light in the painter and buys the owner nothing in daylight; **campfire** is kindle with the
spreading taken out, so it is better judged once kindle is seen.

The word at the foot of the screen reads `fire: kindle  x2.4` while the circle grows, in the same
place as `wind: gust  x2.4` now. When an ability can do nothing here it says so beside its name
for a moment, as the wind's does: "nothing here will burn", "no ice here".

Nothing new is aimed, and nothing is a cursor: fire acts where the view looks, as the wind does.

**Technically.**

- The abilities live in `src/core/powers.js:16-24` (`ABILITIES`, a frozen array of seven). Fire is
  a second such array. `pick()` and `next()` (`src/core/powers.js:74-75`) index whichever array
  is current, so the element becomes one more field on `Powers` and `ABILITIES` becomes
  `this.list`. The numbers of each ability stay in their own frozen table beside `POWERS`
  (`src/core/powers.js:26-38`).
- The ring's width per ability comes from `AIM_SIZE` (`src/core/powers.js:42-45`): fire needs its
  own table (kindle: the first patch's radius; melt: the ring's radius; embers: where the sparks
  are thrown; snuff: the reach).
- The hold-to-grow circle is already element-free: `charge`, `size` and `_wasTap` in
  `src/core/powers.js:170-172`, cast on release at `195-210`. Fire's casts hang off the same
  `released` branch, so a phone, a keyboard and a game pad all reach it through the one
  `this.keys` object (`src/core/powers.js:68`; the key, mouse and bumper listeners are
  `attachPowerInputs`, `src/core/powers.js:232-256`). Keys `1`..`5` then mean fire's five, because
  `pick()` takes a number and the keydown handler already accepts `Digit1`..`Digit9`
  (`src/core/powers.js:236`).
- **The one real piece of work on the screen.** `src/ui/powers.js:46-52` builds the fan's word
  tabs ONCE, when the interface is attached, from `ABILITIES`. Switching element must rebuild
  them (or build both sets and show one). The word line is also hard-coded: `'wind: ' + w` at
  `src/ui/powers.js:91` becomes the element's own name. The element button itself is new, beside
  `.pc-pw-btn` (`src/ui/powers.js:16-21`), and must take the finger the same way: `pointer-events:
  auto` and `touch-action: none`, which is what `tests/powers.test.mjs:125-131` holds the wind's
  button to. `G` cycles the element on a keyboard and the d-pad chooses it on a pad, as
  `docs/POWERS.md` planned.
- Each cast asks for a sound by its id (`src/core/powers.js:227`, `_cast`, and `src/main.js:342`,
  `powers.onCast = (id) => ...`),
  so fire needs rows in `src/audio/audio.js:222-240` beside `gust`, `whirl` and `knife`: a soft
  rush for kindle, a hiss for melt, a crackle for embers, a damp thud for snuff. There is no
  sound that lasts while something burns, for the same reason the wind has none while a whirl
  stands: not built, and it should be said plainly rather than promised.

---

## 2. What is seen

**In plain words.** The game paints with its own brush, and the wind is seen only because each
wind carries pale strokes of air drawn by the painter that already draws falling leaves. Fire can
be seen the same cheap way, and should be, because it costs nothing new:

- **Flame**: short warm strokes thrown up out of a burning patch, each gone in a quarter of a
  second, laid along the way they fly, so they lick upward and lean with the wind.
- **Smoke**: slow soft grains that rise and drift, in the grey-brown the game already mixes for
  ash; they ride the air, so the explorer's own gust blows the smoke of their own fire.
- **Embers**: a few warm grains with a long life that go where the wind goes and fade.

What the fire leaves behind is not grains but paint:

- **Burnt ground**: the ground's wash goes toward the near-black indigo the game already uses for
  cooled lava, in a soft ragged patch, laid as colour on the ground that is already being drawn.
- **A bare black crown**: a burnt tree keeps its trunk and loses its leaves; the trunk and
  branches are laid in the dark bark wash. The tree is not felled and does not fall (that can
  come later).

No blur, no grain, no outlines, small strokes: the look's own rules hold for fire too.

**Technically, and what each costs.**

- **Flame, smoke, embers cost no new draw call and no new texture.** They go into the particle
  buffers that exist and are already drawn: `leaves` and `ash` (`src/physics/particles.js:36-37`;
  capacities per quality tier: leaves 800 / 3000 / 6000, ash 200 / 600 / 1200). The emitter is one
  more method beside the wind's, in the same file and the same shape as
  `src/physics/loose.js:962-1021` (`_wisps`, the strokes of air) and `901-943` (`_tear`, the leaves
  torn from a crown); it emits through `src/physics/loose.js:231` (`emit(kind, x, y, z, vx, vy, vz,
  sizeMul, lifeMul, mat)`).
- **How a warm stroke gets its colour, without a new material.** A grain carries a ground
  material's number in `mat`, and the painter looks that number up in a palette of sixteen inks:
  `uniform vec3 uPcInk[16]` (`src/render/kitmat.js:164`), chosen at `src/render/kitmat.js:173`
  (`vPcMat < 200.0 ? uPcInk[...] : uColor`). The physics has only FIFTEEN ground materials
  (measured: `MATERIAL_IDS.length` is 15, highest index 14 — `src/physics/ground.js:24-62`), and
  `biomeInks` fills all sixteen slots with the fifteen names (`src/render/kitmat.js:31-45`), so
  **slot 15 is spare and nothing uses it today**. The world sets `KIT_PALETTE[15]` to the flame's
  warm wash each frame, beside where it already sets the rain's and the dust's inks
  (`src/world/index.js:141-150` and `557-558`), and only when the fire's flag is on. A flame grain
  is then emitted with `mat = 15` and is painted warm in every biome without a new material, a new
  uniform block or a new pass. The wind's own pale strokes do exactly this with the snow and ice
  inks (`src/physics/loose.js:183-184`).
- **Why flame reads as a stroke and not a dot.** The leaf painter is told, only with the powers
  on, to lay a grain that carries a ground ink as a ribbon along its flight:
  `src/world/index.js:184` sets `wisp: 0.11, wispMin: 0.8, wispMax: 2.4, wispWide: 0.3` on
  `draw.leaves`, and `src/physics/three/expand.js:317-320` and `349-370` lay it. A flame grain in
  the `leaves` buffer with `mat = 15` is therefore already a warm stroke lying along the way it
  rises. Smoke should NOT be a stroke: it goes in the `ash` buffer, which has no `wisp` option, so
  it stays a soft round touch.
- **The rate must be capped across the whole fire, not per patch.** The wind's rates are fixed per
  source (`src/physics/powers.js:88-93`, `wispGust: 115` strokes a second and so on) because at
  most six winds live at once (`WINDPOWER.max`, `src/physics/powers.js:35`). A spreading fire will
  want tens of patches, and tens of patches at a hundred strokes a second each would swallow the
  `leaves` buffer that the wood's own falling leaves and the wind's strokes of air share. So the
  fire's budget is one number for the whole fire (a suggested start: 240 flame strokes, 60 smoke
  grains and 15 embers a second at quality 2, divided among the live patches, two thirds of that
  at quality 1 and a third at quality 0), and the nearest patches are served first. This is a
  design rule, not a measurement; it must be measured once it runs.
- **Burnt ground: a short list of circles in the ground's own shader.** The precedent is exact and
  should be followed: the parted channel is two `vec4` uniforms declared in
  `src/render/shared.js:66-68`, added to the water's material only behind a compile-time switch
  (`src/render/materials.js:1062`: `if (MODE.powers) { m.defines.PC_POWERS = 1; ... }`), used in
  the shader behind `#ifdef PC_POWERS` (`src/render/materials.js:633-636` and `667-690`), and
  filled from the physics each frame by the world (`src/world/index.js:151-165`, `setParted`).
  Fire's scorch does the same on the ground material (`makeTerrainMaterial`,
  `src/render/materials.js:598-610`) with a new define: an array of a dozen `vec4`s (centre from
  the eye in the body's axes, radius), tested in `TERRAIN_FRAG` against `vBody` (set in the vertex
  program at `src/render/materials.js:642`) and mixed into the colour `c` between
  `src/render/materials.js:440` (where `c` is made) and `593` (`pcWrite`, where it is laid). Use
  the dark wash the surface already has for this, `CHAR` at `src/world/surface.js:23`
  (`[0.16, 0.14, 0.19]`, "indigo and sepia"), and `EMBER` at `:24` for a short-lived warm rim
  while a patch is still hot: `src/world/surface.js:877-878` shows the mix the lava plains use.
  Cost: nothing in draw calls, nothing in memory, a dozen distance tests per ground pixel with
  the flag on, and not one instruction in the live game, which compiles the shader without the
  define.
  **The limit, said plainly:** only the dozen nearest patches are painted. The record remembers
  every patch; the ground shows the ones near the eye. Walk away and back and the near ones are
  painted again. A wood burnt over hundreds of metres will not be black all the way to the
  horizon in this first version.
  *The way not to take, and why:* baking the scorch into the ground mesh's own vertex colours
  (`src/world/patchgen.js:71`, where each vertex asks the surface) would be sharper and
  unlimited, but a patch is built once and kept, so every burnt patch would have to be built
  again — tens of milliseconds in the frame the player is watching, which is the very hitch that
  `src/world/flora.js:258-268` was rewritten to avoid.
- **A bare black crown: one float per tree, no new mesh.** Each tree instance already carries four
  numbers to the shader (`attribute vec4 aInst` — hue, value, seed, the shade at its foot —
  `src/render/materials.js:1080`, made at `src/world/flora.js:171-172`, filled at
  `src/world/flora.js:415`). All four are in use, so burnt wants a fifth one-float attribute made
  and filled in the same two places. The plant's vertex program (`PROP_VERT`, main at
  `src/render/materials.js:1196`) then scales the leaf quads of a burnt tree to nothing, and its
  fragment program lays the bark in the char wash where it now chooses bark and leaf washes
  (`src/render/materials.js:1493-1496`). Cost: four bytes per tree instance, one attribute read
  per vertex, zero new draw calls, and all of it behind the same define so the live game's plant
  shader is untouched.
  *The way not to take:* a second material for burnt trees. That is a new draw call for every
  patch of wood that holds one, and the trees' draw calls are already what the phone work of the
  last fortnight has been spent on.
- **Not in this first version, and it should be said:** the fire gives off no LIGHT. Nothing of
  the ground, the trunks or the explorer is lit by it; a fire by night will be warm strokes in the
  dark, not a glow on the trees. A real light means new work in the painter for every surface,
  and it is the right thing to ask the owner about after they have seen the flames.

---

## 3. What the world must do

**In plain words.** The record of what is burnt is a small list kept outside the picture, exactly
as the list of felled trees is. Four things read it:

- the trees, so a burnt tree is drawn bare;
- the ground's paint, so a burnt patch is dark;
- the ground's shape, so melted ice is a dip you can stand in;
- the saved game.

And where ice melts: the ice sinks inside the ring, and what the world says is under the ice
shows through. Where the world says there is nothing under it, the dip just keeps deepening while
the heat lasts — the owner's "it just keeps melting away" — down to a floor, so that nobody can
melt a hole through the world and fall out of it. If the dip goes below the level of nearby water,
the water is there, and the explorer swims in the hole they have made.

**Technically.**

- **What the world needs to ask the record** (the names belong to `src/data/burnt.js`; these are
  the four questions): is the tree whose place in the placement data is (x, y, z) on this body
  burnt; how burnt is the ground at a point, nought to one; how deep is the ice melted at a point,
  in metres; and give me every mark of this body, with a version number that goes up on every
  change. That is the shape `src/data/felled.js` already has: `felledAt` (`:39`), `felledOn`
  (`:52`), `FELLED.version` and `FELLED.size` (`:20`). With nothing ever burnt every reader makes
  one comparison and stops, which is the rule in `docs/POWERS.md` ("on and unused, they cost one
  comparison").
- **A burnt tree is drawn bare** in the one place a tree's own appearance is written:
  `src/world/flora.js:229-243` (`_layTree`), which already asks the felled list at `:237-241`. The
  burnt question goes beside it, and its answer is written into the new per-instance float at
  `src/world/flora.js:415`. When the record changes, only the trees named in it are laid again
  (`_relay`, `src/world/flora.js:271-279`), and the per-frame cost is one version comparison
  (`src/world/flora.js:639-641`). A burnt tree is NOT felled, so nothing changes in
  `src/world/obstacles.js`: its trunk still stands in the way, which is both correct and less
  risk.
- **Scorched ground is coloured** by the uniform list of part 2, filled once a frame from the
  record in `src/world/index.js` beside `setParted` (`:151-165`), nearest patches first.
- **Melted ice lowers the ground, in two copies of one shape.** This is the part to be most
  careful with, because two different parts of the game must agree about where the ground is:
  1. *What the player stands on.* The explorer's ground comes from the surface
     (`sampleSurfacePure`, `src/world/surface.js:1132`), cached by the physics on a grid of
     17 x 17 nodes 2 m apart (`src/physics/index.js:71`, `src/physics/near.js:104-126`). So the
     surface subtracts the melt depth from the ground's height inside the dip. `src/world/surface.js`
     may import `src/data/burnt.js` the way `src/world/flora.js` imports `src/data/felled.js`: it
     already imports from `src/data/` (`src/world/surface.js:12-14`) and is pure, so the tests
     still load it in Node.
     When the record changes, the physics must throw the cache away (`invalidate()`,
     `src/physics/near.js:126`) by comparing the record's version, as the trees do. Arithmetic,
     not a measurement: 289 nodes at about 8 microseconds a sample (`src/physics/near.js:10`) is
     about 2.3 ms of work, which the grid's own per-frame budget spreads over several frames.
  2. *What the eye sees.* Patches of ground mesh are built once and kept, so the dip must be
     pressed into the ground's VERTEX program, exactly as the parted channel presses the water's
     face down (`WATER_VERT`, `src/render/materials.js:667-690`). One shape function, written
     twice: plain JavaScript for the surface and the physics, the same lines in GLSL for the
     shader. `src/physics/powers.js:211` (`partShape`) and its GLSL copy are the precedent, and
     its comment says so in one line.
     **Measured limit:** the finest ground mesh has a vertex every 0.77 m on Earth, 0.58 m on
     Mars, 0.81 m on Neptune (worked out from `PATCH_N = 32`, `src/world/patchgen.js:7`, and the
     deepest quadtree level, `src/world/terrain.js:62`). So a melt pit narrower than about two
     metres cannot read as a shape at all, only as a change of colour, and every pit will have
     blunt edges. This is the same limit the parted channel has, and `docs/POWERS.md` says so
     about that.
- **What is under the ice.** The game has no ice thickness anywhere today: ice is a ground
  material (`src/physics/ground.js`, index 9) on land whose height is the land's own. So the
  thickness has to be new data, and it belongs with the rest of a world's data, not in code:
  a biome may name, in `src/data/looks/<world>.js`, how deep its ice is and what wash and material
  lie under it. Give it a default (a metre and a half of ice over the `bed` wash, which
  `src/render/kitmat.js:39` already mixes from the biome's liquid) so that not one look file has
  to change on the day fire is built, and so an ice world the owner has not thought about still
  behaves.
  Where a biome names nothing under its ice, the dip deepens while the heat lasts, clamped at a
  floor in metres in the fire's own table. The clamp is not tidiness: the explorer's body and the
  ship both ask the surface for the ground, and a bottomless pit is a hole the player falls down
  for ever.
  If the floor of the dip ends below the liquid level that the same surface sample reports, the
  sample already reads as water and the explorer wades or swims. That follows from the code as it
  stands; it has NOT been tried, and it is the first thing to look at in a still.
- **What the fire asks of the world, not the other way round.** A fire needs to know what will
  burn where. The world already answers that for the wind: `air.coverNear(x, z, cov)` gives the
  leaves on the floor, the closed canopy and its height at a point, and the wind's leaf-tearing
  uses exactly those three (`src/physics/loose.js:901-930`). Snow depth and wetness are handed to
  the loose things every frame (`src/physics/index.js:318`). So the fire's fuel is read from what
  is there: dry litter and canopy burn, wet ground and snow do not, and bare rock never does.
- **The wind and the fire meet in one place only.** A fire spreads with the air at its own place,
  and the air at a point already answers the explorer's wind (`airAt`, `src/physics/air.js:479`,
  with the player's wind folded in at `:536`). So a gust fans a fire and a **stilled** place —
  which multiplies the wind there by nought (`src/physics/powers.js:336`, `o[3]`) — starves it.
  Nothing new is needed for that; it falls out of asking the air properly.
- **Not in this first version:** the near ground's grass and flowers do not char
  (`src/world/nearground.js`: three rings of brush marks, a pure function of each cell); a burnt
  tree does not fall; a burnt crown does not grow back; nothing burns on another body than the one
  the explorer is standing on (every shape carries its `bodyId`, as the wind's do,
  `src/physics/powers.js:100`).

---

## 4. What the saved game stores

**In plain words.** The fire itself is not saved. A fire is weather: it passes. What is saved is
what it left behind — the burnt patches, the melted ice and the bare trees — in one more small
field beside the felled trees that are saved today. A save written before fire existed loads
exactly as it always did.

**Technically.**

- `src/core/save.js:44` already writes `...(FELLED.size ? { felled: felledRows() } : null)` — the
  field exists only when there is something in it. The burnt record is one more line of the same
  shape, and `src/core/save.js:120` (`felledLoad(d.felled)`) gains one more call beside it. The
  record's own file owns the two functions (rows out, rows in), as `src/data/felled.js:77-89`
  does, and the loader must throw away anything that is not a finite number, as that one does.
- **Do not raise `SAVE_VERSION`** (`src/core/save.js:19`). `validate` rejects any save whose
  version is not the current one (`src/core/save.js:49`), so raising it would throw away every
  save the owner has. Adding a field that may be missing costs nothing and keeps them.
- Each row is plain numbers: which body, which kind of mark (scorched ground, melted ice, a burnt
  tree), where, how wide, and how far gone. A burnt tree is named the way a felled tree is named —
  by its own place in the placement data (`src/data/felled.js:8-9`) — so that its near form, its
  far form and the obstacles all know it again without searching.
- The list is capped and the oldest is forgotten first, as `FELL.max = 400` does
  (`src/data/felled.js:15`, `:33`). A forgotten scorch mark means that patch of ground is clean
  again. That is a real limit to tell the owner about, not a bug.
- What is NOT in the save: live flames, smoke, embers, how hot anything is. Load a save and the
  fires are out and the marks are there. This matches `docs/POWERS.md`: "What stays (a felled
  tree) is kept in the saved game; everything else is weather: it passes."

---

## 5. What must not happen

- **The live watercolour game must not change by one pixel.** Everything of fire sits behind the
  flag, as the wind does: `src/main.js:47` sets `MODE.powers` from the address before anything is
  made, and `src/main.js:320-344` imports the powers' modules only inside
  `if (params.has('powers') ...)`. Fire rides the same `?powers=1` (one flag for the owner to
  remember) but gets its own field on `MODE` (`src/data/mode.js:8`) so the painter's parts of it
  can be switched off on their own while it is being built.
- **No static import, anywhere.** `tests/powers.test.mjs:134-141` reads `src/main.js`, `sim.js`,
  `game.js` and `hud.js` as text and fails if any of them imports the powers at the top. Fire
  needs the same test, and `src/physics/fire.js` must not be imported by `src/physics/index.js`
  at the top either: the fire's list comes in on the frame's own object, beside `winds`
  (`src/core/sim.js:633` hands it over; `src/physics/index.js:250-253` places it). That way the
  physics has one comparison a frame and no module of fire is even parsed.
- **No new define in a shader the live game compiles.** The ground and the plants get their fire
  branches the way the water got the parted channel: the define is added only when the flag is on
  (`src/render/materials.js:1062` is the line to copy), and every new line of GLSL sits inside
  `#ifdef`. Shaders fail only when a browser compiles them, so render after every change — and
  never take a screen derivative of a planet-sized coordinate such as `vBody` (comparing
  distances, which is all the scorch does, is fine).
- **The phone must stay fast.** The budget for all of fire: no new draw call, no new pass, no new
  texture, no new mesh. Particle rates capped for the whole fire, not per patch; the painted
  scorch capped at a dozen circles; the fire's own list capped; the quality tiers already shrink
  the particle capacities (`src/physics/particles.js:37`) and `src/core/dynres.js` steps the tier
  down when frames are slow. The phone is already at its sixty-a-second cap (`docs/HANDOVER.md`),
  so fire must cost nothing the owner can feel, and that can only be settled with `bench=1` on
  their own device.
- **Nothing may hurt the explorer.** No damage, no health, no fail state, no being stopped from
  walking through a burnt place (`docs/POWERS.md`).
- **The fire must end.** A cap on how many patches live at once, a cap on how far one cast can
  spread, and **snuff**, so the player can always put it out. Rain and a stilled place should help
  too, because they already exist.
- **The three risky parts of this repository are the shader code, the saved game and the trees'
  renderer.** Fire touches all three. Each piece behind its own switch, each one seen in a still
  before it is called done, and the three test suites green before any push.

---

## 6. The order to build it in

Smallest first. Each step says what a test can prove and what only a pair of eyes on the owner's
own phone can judge. The split matters: a still made by calling the code proves the picture; it
does not prove the hand.

1. **The record** (`src/data/burnt.js`) and its tests. A pure module: add a mark, merge marks that
   overlap, cap the list, bump a version, rows out and rows in.
   *Proved by a test:* all of it.
2. **The fire itself** (`src/physics/fire.js`) and its tests. A short list of burning shapes, cast,
   stepped once a frame, spreading downwind into what will burn, dying to ash, each ended patch
   reported to the record. Placed in the frame and bounded, so that a reader outside everything
   that burns answers in two comparisons (`placeWinds`, `src/physics/powers.js:240-271`, is the
   pattern).
   *Proved by a test:* a cast makes a patch; a patch spreads with a wind and does not spread
   against it; wet ground and snow do not catch; the list never passes its cap; a patch ends and
   the record has it; the same seed gives the same spread.
3. **Wired into the physics.** `winds` and `fires` side by side: `src/core/sim.js:633`,
   `src/physics/index.js:250-253`, and the fuel questions answered from `cover`
   (`src/physics/loose.js:901-930` shows how).
   *Proved by a test:* stepping the physics with one fire alight emits flame and smoke grains and
   leaves the buffers inside their capacity; with no fire, the frame's work is unchanged.
4. **The player's side.** The second element, its five abilities, the fan rebuilt, the word line,
   the element button, the sounds.
   *Proved by a test:* a fake sim, as `tests/powers.test.mjs:12-16` builds one — the element
   switches, keys 1 to 5 choose, a tap casts the smallest, holding grows the circle, nothing works
   off foot.
   *Only on a phone:* that the element button can be hit with a thumb, that it does not fight the
   fan or the jump button, and that the words are readable. The owner's rule: anything they will
   touch is pressed with real touch events before it is called seen.
5. **Flame, smoke and embers seen.** Ink slot 15, the rates, the shapes of the strokes.
   *Nothing here can be proved by a test.* Only stills, and then motion on the owner's device: a
   stroke that reads in a still can still crawl or flicker in motion.
6. **Scorched ground.** The uniform list, the define, the char wash.
   *Proved by a test:* the list is filled from the record, nearest first, and is empty with the
   flag off.
   *Only by eye:* whether a burnt patch reads as burnt ground and not as a dirty smudge, and
   whether its edge is ragged enough for this look.
7. **Melted ice.** The shape in both copies, the surface's height, the cache thrown away, the
   look's new ice data with its default, the floor.
   *Proved by a test:* the shape function's depth at a few radii; the surface returns a lower
   ground inside the dip and the same ground outside it; the dip never passes the floor; a save
   and a reload put the dip back.
   *Only by eye:* whether the dip reads as melted ice at all at a vertex every 0.8 m, what the
   revealed ground looks like, and what happens when the floor meets water.
8. **Bare black crowns.** The fifth per-instance float, the two shader branches.
   *Proved by a test:* a burnt tree's instance carries the flag and its neighbour does not.
   *Only by eye:* whether a bare crown reads as burnt and not as a dead branch glitch, near and
   far.
9. **The saved game.** One field, written only when there is something in it.
   *Proved by a test:* snapshot, validate, load, and the marks are back; an old save with no field
   loads as it always did.
10. **Speed, on the owner's phone.** `?powers=1&look=oil&bench=1` with a wood burning, and the
    table photographed. Nothing about speed on a device can be learned on the build machine,
    which draws in software and has been wrong twice about why the phone is slow.

A reasonable first cut for the owner to look at is steps 1 to 6: fire that spreads, is seen, and
leaves the ground black. Melting (7) and bare crowns (8) are each a day's work of their own, and
each has one thing in it that only their eyes can settle.

---

## What is not known

Said plainly, so that nobody builds on a guess:

- Whether the `leaves` buffer can carry the flame's strokes without starving the wood's own
  falling leaves and the wind's strokes of air. They share one buffer and one capacity. Must be
  measured.
- Whether a dozen scorch circles is the right number: too few and a burnt wood is patchy, too many
  and the ground's shader slows. Must be measured on a phone.
- How fire should spread, in numbers. Nothing in this repository has ever modelled it, and the
  rate that feels right is the owner's judgement, not arithmetic. Start slow enough to watch.
- What a melted pit looks like with vertices 0.8 m apart. It may not read at all.
- Whether water appearing in a melted pit works, or breaks the explorer's wading.
- Whether fire wants a light of its own before the owner will like it by night.
