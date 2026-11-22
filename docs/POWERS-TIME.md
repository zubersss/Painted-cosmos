# THE THIRD ELEMENT: SPACE AND TIME

> ## IT IS **FOUR** POWERS, NOT TWELVE (the owner, 22 Nov, the same day)
>
> *"to many space and time abilities cut them down into folding space should be one of them but make it a bit
> more theatrical like the world is getting pulled towards you the 4 should be overly powerful abilities like a
> rip in space time that sucks everything in a long ways in"*
>
> **THE FOUR, in the order of the keys 1 to 4:**
>
> | key | power | what it is |
> | --- | --- | --- |
> | 1 | **fold space** | the world is DRAWN PAST YOU for half a second and you are standing a hundred metres on |
> | 2 | **the rip** | a tear torn open where you look that draws everything in from fifty-five metres, and a hundred and twenty held to the full |
> | 3 | **still the moment** | everything inside a sphere stops, and stays stopped after you walk away |
> | 4 | **the turning year** | the season of the whole world, turned by hand |
>
> **CUT, with their code:** slow, haste, unmake, the sun's hand, the knot, and the four that were never built
> (the door, the drawn eye, the lens, the long mile). They are in the history at v31 and any of them can come
> back in a line. **The rule it leaves, for every element: a short list of powers that each feel enormous beats
> a long list of small ones.**
>
> Everything below this line is the FIRST design, of twelve, kept for its ideas and for the four that survived.
> Where it says "the twelve", read "the four".

The owner, 2026-11-22: *"start working on the 3rd ability space and time manipulation give me at least 10 powers
for that one and they should all be unique and powerful and they should also look really good in the game"*.

This is the design. The wind's seven and the fire's are in `docs/POWERS.md` and `docs/POWERS-FIRE.md`; this file
is the twelve of space and time, what each one is, what the player sees, and how it is built out of things this
engine really does. Nothing here is a number that says "it is faster now": every power moves the world's own
machinery, the same way the wind's gust makes real wind and the fire's bellows makes a real gust.

## The rule this element is designed by

Painted Cosmos has no combat and no way to fail. So a power over time is not a weapon. **Every one of these
twelve is a way to LOOK, to TRAVEL, or to MEND** — and every one has a picture of its own that nothing else in
the game draws. A power that cannot be told from another by its picture alone is not finished.

## How it is held

The third element in the hand (the `G` key cycles wind → fire → time; the touch fan's element button does the
same). Keys `1`..`9` and `0`, `-`, `=` pick the twelve; the fan holds them in two rings of six on touch.
Everything is behind `?powers=1` as the other two elements are, and nothing of it is loaded without the flag.

---

## 1. SLOW — the long moment

**What it is.** A bubble of slowed time where you look, about fourteen metres across, held while the hand is
down. Inside it the world runs at a fifth of its pace: rain hangs, a fire's tongues creep, torn leaves drift,
blown dust crawls. Step inside and you keep your own time — you move normally through a world that does not.

**What you see.** Inside the bubble every stroke is laid LONGER and smoother, as a slow brush leaves it, and the
rim is a thin pearl edge where the two times meet. Outside, the picture is exactly as it was.

**How it is built.** A *time zone*: a place, a radius and a rate, in a short list the physics takes beside the
winds (`f.times`). Everything that steps — the loose grains, the fire, the plants bending, the weather's own
motion — scales its `dt` by the rate at the place it is stepping. The painter is handed the same list and lays
the rim and the longer strokes inside it.

## 2. HASTE — the racing hour

**What it is.** The same bubble, the other way: time inside runs four times over. A fire set inside it eats a
wood in seconds; a cloud crosses the sky; a river's strokes race; snow piles up as you watch. A way to see what
a place will become.

**What you see.** Strokes SMEAR along the way things are moving — the look's own motion blur, which it has never
used, drawn as a stroke dragged rather than laid. The sky's bands slide visibly inside the bubble's circle.

**How it is built.** The same time zone with a rate above one. (Slow and haste are one ability bound two ways on
the design's ledger but two on the player's, because they feel nothing alike.)

## 3. STILL THE MOMENT — stasis

**What it is.** Everything inside a volume STOPS, and stays stopped after you walk away, for a minute or so.
Rain hangs in the air in its thousands. A fire stands like a sculpture of itself. A gust you cast a second ago
hangs as strokes of air you can walk between and look along.

**What you see.** Inside, the paint is laid FLAT — no stroke moves, no wash breathes — and a very faint cold
glaze lies over it with hairline cracks of light, so a stopped place reads as a thing held, not as a thing that
has merely slowed. It is the one picture in the game with no motion in it at all.

**How it is built.** A time zone at rate 0 with a life of its own, so it outlives the hand that cast it.

## 4. UNMAKE — the world put back

**What it is.** A place is returned to what it was: a burnt wood greens, scorch lifts off the ground, felled
trees stand up again, a melted glacier closes over. What the player has broken, and what the world has broken,
both.

**What you see.** The black LIFTS, stroke by stroke rather than fading: the charcoal strokes go back to their own
colours one at a time from the rim inward, and a felled tree rises in one movement with its leaves following.

**How it is built.** The records are already there and already heal with time: `src/data/burnt.js` (scorches,
burnt crowns, melted ice) and `src/data/felled.js`, and both already take a point to heal AROUND. This ability
is those healings run fast at a place — the honest version of a rewind, because it is the same machinery that
would have mended it in an hour.

## 5. THE TURNING YEAR

**What it is.** Push the season where you stand, forward or back, and hold it there: high summer → autumn → the
bare year → the first green. The wood turns in front of you.

**What you see.** The forest's leaves run from green to gold to bare to bud, which is the turn the game already
makes over twelve minutes (`src/data/season.js`) happening in four seconds at your hand.

**How it is built.** `SEASON.t` is already a dial every leaf's colour reads, at no cost per frame. The ability
drives it, and holds it where it is put.

## 6. THE SUN'S HAND — the long day

**What it is.** Take the sun and move it. Drag the hour of the day across the sky: noon to the gold hour to the
blue hour to the stars and round again.

**What you see.** Shadows sweep round in a half circle, the sky runs through all of its keys, the aurora comes
up, the fire's light takes over from the sun's. The whole picture changes, because the hour is what the whole
picture is built on.

**How it is built.** The sun's hour is already settable (`sim.eph.setSunHour`). The ability turns it smoothly
while the hand is down rather than snapping it.

## 7. THE KNOT — anchor and recall

**What it is.** Tie a knot in time where you stand. Walk away — a mile, a world. Pull the knot and you are drawn
back to it, AND the place is put back as it was when you tied it.

**What you see.** A small painted knot of light standing in the air where it was tied, visible from far off as a
single bright stroke. On the recall the world streaks toward you in long strokes and settles.

**How it is built.** A place, a time and a copy of what the records held then. The explorer is already
teleportable (`sim.teleport`); the putting-back is ability 4 at that place.

## 8. THE FOLD — step

**What it is.** Fold the ground between you and where you look, and you are there. Seventy metres at a step, over
a river, up a cliff, across a canyon.

**What you see.** For a quarter of a second the strokes between here and there STRETCH into a tunnel along the
line of the step, and snap back as you arrive. Nothing fades; nothing goes black.

**How it is built.** The aim already finds the ground it points at and the explorer is already teleportable. The
tunnel is the look's own strokes drawn with their length scaled along one direction for a few frames.

## 9. THE DOOR

**What it is.** Set one mouth where you stand and another where you look. A door between two places that STAYS:
walk through it, throw a fire through it, let a gust blow through it and come out of the other side.

**What you see.** A painted arch with the other place inside it, its strokes bending round the rim as if the
canvas itself had been folded and pinned. From the side it is a bright edge and nothing else.

**How it is built.** The hardest of the twelve and the last to be built: the world inside the arch is the scene
drawn a second time from the other mouth into a small target. It is one extra pass at a fraction of the
picture's size, and it is behind the element's own flag, so the game without the powers cannot pay for it.

## 10. THE DRAWN EYE — far sight

**What it is.** Your eye leaves your body and flies: over the hill, down the canyon, out over the sea, up to look
at the wood from above. Your body stays where it is, and a thread of light runs back to it.

**What you see.** The picture itself travels, painted exactly as it would be if you were there — which is the
point: this game's reason to exist is its views, and this is the power that goes and finds them.

**How it is built.** The camera is already free in the painter's own gallery. In the game the eye is tied to the
explorer; this unties it for as long as the hand is down, with the world's building following the eye (the
look-ahead of 18 Nov already builds where the eye is going, not only where the body is).

## 11. THE LENS — bring the far near

**What it is.** Hang a lens of bent space in the air. The place behind it is drawn LARGE: a telescope you cast,
and you can walk round it and look through it from any side.

**What you see.** A disc of the far world, magnified and sharp, with the rim's strokes swirling into it. A
mountain forty kilometres off stands inside a circle a metre across.

**How it is built.** The scene drawn once more through a narrow lens into a small round target — the door's own
machinery with a different camera, so the two are built together.

## 12. THE LONG MILE — drawn-in ground

**What it is.** Draw the ground in along the way you are walking, so that a half-hour's walk takes a minute. You
walk normally; the land streams past. A way to cross a world on foot that is not the ship.

**What you see.** The ground runs past in long horizontal strokes while your own stride stays its own pace — the
one place in the game where the paint shows speed the walking does not.

**How it is built.** The explorer's own motion is scaled along the way it is going while the body's gait, the
camera's bob and the physics' own steps stay as they are.

---

## What is built, after the cut of 22 November

| | power | key | built |
| --- | --- | --- | --- |
| 1 | fold space | 1 | **yes, and theatrical** — the world is drawn past you over 0.55 s (`TIMEPOWERS.foldTime`), fast at the first instant and settling at the end, with the air pouring inward along the way. About a hundred metres, which is 180 m/s: everything near enough to see goes by |
| 2 | the rip | 2 | **yes** — a wind source of its own kind (`physics/powers.js` `KIND.rip`), 55 m of reach and 120 held to the full, at full strength out to 62 per cent of it; the trees inside half of it are pulled over INWARD; drawn as a tear with a torn lip and the air running into it (`world/timefx.js`) |
| 3 | still the moment | 3 | **yes** — rate 0, and it outlives the hand that cast it. 14 m at the smallest and 46 m held to the full, where it used to be 7 m and 20 |
| 4 | the turning year | 4 | **yes** — `SEASON.t` in the hand, turning round at either end of the year |

**SEEN, not only built:** the rip was photographed in the gallery over the owner's own river
(`gallery.html?...&rip=1&physics=1&powers=1&look=oil`), a black lens-shaped tear about 8 m tall on the bank with
a violet-white torn lip, and the spray off the water drawn in towards it. The fold is held by a test (it does not
jump, it lands where you looked, it ends) but **has not been seen in motion** — nothing on this machine can show
half a second of motion, and that is the owner's to judge.

**What the cut took away:** the bubble of a SLOWED or HASTENED place is no longer castable, though the machinery
(`physics/times.js`, a rate per place that every loose grain and every patch of fire reads) is still there and is
what "still the moment" is built on. The gallery can still show all three: `?bubble=slow|haste|still`.

## v31, 22 Nov: the freeze, and why nine abilities killed the game

The owner: *"The spacetime powers freeze the game everytime I open it find out why and fix it."* They were right,
and it was worse than they could see.

**What it was.** The aim mark's ring is sized from a table of one function per ability in `src/core/powers.js`
(`AIM_SIZE`). The table held the wind's seven and six of the fire's nine. **Nine abilities had no entry at all** —
the fire's meteor, lance and cinders, and all twelve of space and time. With one of them in hand, this line

    A.size = AIM_SIZE[id](A.dist) * ...

threw a TypeError **every frame**, inside `powers.update`, inside `sim.frame`, inside `game.frame`. The frame
stopped there: the world was never stepped, nothing was painted, no sound was made. And because the loop asks for
the next frame *before* it runs this one (`main.js` `tick`), nothing fell over and nothing was reported on the
screen — the game simply stopped, with the last complete picture still up, and stayed stopped. A dead freeze with
no way out.

**The fix, both halves.** Every ability now has a ring of its own (the three bubbles show their own radius, the
unmake its reach, the two that take the whole world a small ring at the aim, the rest about a figure's width),
**and** the lookup can no longer throw: an unknown ability shows an ordinary ring. `tests/powers.test.mjs` walks
every ability of every element through that line — aimed, tapped, held, and held past the ultimate — so a tenth
one cannot be added without the tests saying so.

**Found beside it.** Held past "ULTIMATE ready", those same nine said *"held to its utmost"* and then **cast
nothing at all**: `_ultimate` knew eleven ids and its `else` was written for the two that are *held open* (gather,
part). Now an ability with no ultimate of its own is cast in the ordinary way at the greatest size
(`Powers.hasUlt`), so a long hold on the unmake or the freeze gives the big one and not silence.

**And one more, mended while the UI was rebuilt:** the word at the foot of the screen asked a question with two
answers (`p.element ? 'fire' : 'wind'`), so every space-time power was announced as **fire**. It reads the
element's own name now.

**Measured in the real game** (the lab, Earth's riverside, every ability of all three elements driven through the
game's own frame): 0 throws, and the worst single frame of any ability is 19.4 ms of script on the build machine,
which draws in software — in line with the ordinary frame there (8–14 ms). Nothing in space and time stalls.

## And the picker: a panel of words, not a ring of directions

The ring gave each ability its own direction out of the chip, thirty degrees apart over the half of the screen
from straight up round to straight down. That holds **seven**. Space and time has **twelve**: the eighth to
twelfth came out in the same directions as the first ones, so five of these powers were reachable by a key and by
**nothing at all on a phone**.

It is a panel now: tiles with the words on them, 112 by 38 px, up and to the left of the chip, in columns of six.
Hold the chip, slide onto the one you want, let go. Twelve of them are two columns read top to bottom; the wind's
seven are two columns of four. On a short screen the panel takes another column rather than shrinking the tiles.
Everything else is as it was: the tap on the chip still swaps the last two, the keys (1–9, 0, -, =) and the pad
still choose, and the element still lies out to the right where no tile is — its own tile lifted clear of the
power button, which it used to sit on top of, half off a 390 px phone.

Seen at 390 by 844 in a real browser with made-up pointer events. **Not yet pressed by a finger on a real phone.**
