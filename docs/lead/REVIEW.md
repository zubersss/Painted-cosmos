# REVIEW: dated findings per role

Owner: PILOT as lead developer. Each finding has its evidence and the check it is measured
against (`R-...` ids are in `docs/lead/REFERENCES.md`; "AB n" is point n of the art bible).
MUST FIX blocks the milestone. Answer each MUST FIX in your own notes ("fixed in <commit>" or
"disagree, because ..."). I never edit your files; how to fix is your call.

Everything here was run by me, not taken from anyone's notes. Software GL only: frame rates
are relative, never a claim about a real GPU.

---

## Review 2: 2026-11-11, at commit `a9c02bc` (includes Painter's `b2bfcae` and `6a31de3`, Physics' `b0ad22b`)

What I ran:
- The same frame-cost probe as review 1, in the integrated game from a clean export
  (480x270, counters from the game's own read-out, `?stats=1`), at quality 0, 1 and 2.
- `gallery.html?...cam=trees&time=12&quality=1` at **960x540** (the coordinator's rule for
  judging look), `cam=stream` at 12 h and 0 h at 640x360.
- `node --test src/world/*.test.mjs`, `node --test src/physics/` (125 pass),
  `node --test tests/*.test.mjs` (91 pass; they fly Earth to Mars to Saturn on Painter's real
  worlds with Physics and the real obstacles, in the pure simulation).

### PAINTER: M1 is met

MUST FIX from review 1, all three **closed**:

1. **Frame cost: closed.** Measured in the integrated game:

   | view (quality 1) | triangles | draw calls | review 1 |
   | --- | --- | --- | --- |
   | standing at the spawn | 564 k | 334 | 4.36 M, 887 |
   | running | 529 k | 307 | 4.57 M, 848 |
   | flying at 120 m | 217 k | 143 | 1.47 M, 262 |
   | orbit at 5 km | 46 k | 41 | 43 k, 41 |

   Quality 0 at the spawn: 289 k, 206 calls. Quality 2: 708 k, 381 calls. All inside the budget
   (600 k / 350, 300 k, 1.2 M). Software GL at the same viewport went from 0.7 to about 3 fps.
2. **Stippled foliage: closed.** `docs/lead/evidence/painter-a9c02bc-gallery-trees-noon.jpg`
   (960x540): crowns are a few overlapping washes with darker accents; no pepper.
3. **Ruler-straight lines: closed.** Same frame: birches lean, taper and break into dry-brush
   marks; the bank of the brook wanders (`...-stream-noon.jpg`).

At 960x540 the home forest passes the freeze-frame test for me: I would take that frame for a
scan of a plein-air study.

SHOULD FIX (carried or new; none blocks)

4. **Build hitches, still.** `world.update` worst frames: 4 to 8 ms at quality 1 (flying
   8 ms), 12 ms running at quality 0. Budget 5 ms. Better than the 34 ms of review 1, not yet
   inside. The frame read-out now shows `world` ms live (` key).
5. **Shade is dark green, not a cool glaze.** The dappled patches on the clearing are the local
   colour darkened, with fairly hard edges. AB 2: shadows are cool transparent violet-blue
   glazes over the local colour.
6. **The foreground meadow** is still one broad wash with sparse marks (review 1 item 5): a
   few more grass-tip strokes near the eye, none far away.
7. **The far trunks** still stand in an even line like a fence in the `trees` frame (item 6).
8. Night (`...-stream-night.jpg`) is better: trunks take the glaze. Dusk and space unchanged
   from review 1 items 7 and 8; M3 scope.
9. `sampleObstacles` returns at most about 260 entries at large radii. Say in your notes
   whether they are the nearest ones; I keep my queries under 45 m meanwhile.

GOOD (new)

- `canopyHeight` on `sampleSurface`: wired into the ship's cushion the same hour; a low pass
  over the real forest keeps the hull above every tree top (`tests/contract.test.mjs`).
- Mars and Saturn placeholders already have distinct biomes to land in: the scripted trip
  ends in `dry_riverbeds` and `crystal_reeds`.

Answers to PAINTER's questions: the default boom is now 6.4 m (was 5.6) until the real
explorer exists. `speed01` and `altitude01`: nothing needed before M3; in M3 I would like
`speed01` near 1 (pulse) to soften and streak the far washes, and nothing from `altitude01`
that `inSpace01` does not already do.

### PHYSICS: P1 accepted by the coordinator; wiring done

- All of the wiring guide is in (commit after `a9c02bc`): `createPhysics`, `warmUp`,
  `physics.update` once a frame before `world.update`, `world.setPhysics`, the explorer through
  `stepExplorerBody` (with `assistAccel` 4, `jetMaxRise`, `descentLimit`), the ship through
  `stepShipBody` (`carve01: 1`, assists applied to the target), landing sites by friction, the
  parked ship on `stepShipGear`. Measured in my loop tests: `physics.update` averages 0.3 to
  0.5 ms; the gear settles and sleeps on Earth, the Moon and Jupiter.
- One assist I added that PHYSICS should know about and may want to model: in vacuum, X or
  throttling down brakes with the drive field (the kinematic rate) instead of the 14 m/s2
  retro thrusters, because stopping from 750 m/s took over a minute and "let go and it stops"
  is the promise of the ship (`R-SHIP-1`). A `brake` command in `stepShipBody` with a named
  field deceleration would let me drop my special case.
- A bug of mine, found by measuring and fixed: the body model moves `st.p` in place and my
  flight step then moved it again, so for a few commits the physical ship covered twice the
  ground its speed said (the climb to space read 10.9 s instead of 15 s). Fixed by keeping the
  starting point by value; the climb profile now matches the kinematic one within a second.
- GOOD: the lab page and twelve evidence shots exist now; the guide and the replacement
  tables were exactly what was asked for; the reference checks came back with measurements.

---

## Review 1: 2026-11-11, at commit `19f72ce`

What I ran:
- `node --test src/world/*.test.mjs` (12 pass), `node --test src/physics/` (72 pass),
  `node --test tests/*.test.mjs` (70 pass, including `tests/contract.test.mjs`, which checks
  Painter's real `sampleSurface` on every body and walks the real forest with collision).
- `gallery.html?body=earth&biome=temperate_forest&time=<h>&quality=1&cam=<preset>&ui=0&t=0` at
  640x360 from a clean export of HEAD: presets `trees`, `canopy`, `stream` at 12, 18.5 and 0 h.
- The integrated game (`index.html`, Painter's render, world and art as the default):
  `node tests/playthrough.mjs --query "scale=0.5&quality=0" --w 480 --h 270` against a clean
  export of `bb8ec30`: the whole loop passed with no console errors.
- A frame-cost probe in the integrated game (draw calls and triangles from `renderer.info`
  summed over the whole frame; `world.update` timed in the page).
- `createPhysics` driven for 600 frames at Painter's Earth spawn with one disturber.

### PAINTER

MUST FIX (M1: "Earth's temperate forest passes the freeze-frame test")

1. **The forest is far over any frame budget: 4.36 million triangles and 887 draw calls per
   frame standing at the spawn** (quality 1, 480x270; 4.57 M while running; 1.47 M and 262
   calls flying at 120 m; 43 k and 41 calls in orbit). Evidence: frame-cost probe at `19f72ce`;
   software GL fell from about 6.7 fps (before flora, `d238c50`) to 0.7 fps at the same
   viewport. The brief's rule is 60 fps at 1080p on an integrated GPU, and a painting that
   needs four million alpha-tested triangles plus a multi-target pass and four full-screen
   passes will not get there (`R-PAINT-8`). Budget I am setting as the owner of performance:
   **at most 600 k triangles and 350 draw calls at quality 1 in the densest view, 300 k at
   quality 0, 1.2 M at quality 2**, measured with the same probe. The far tiers are the
   obvious place: a distant tree is a few strokes (AB 4: "far things are fewer, larger, softer
   strokes"), and that is also what the painting wants.
2. **Foliage is stippled, not brushed.** `docs/lead/evidence/painter-19f72ce-gallery-trees-noon.jpg`:
   the crowns are a field of pixel-sized dark specks, and `docs/shots/pilot/real-01-on-foot.jpg`
   shows it as salt-and-pepper over the whole tree line. A watercolourist lays a crown as three
   or four overlapping washes with a few dark accents; nothing in a real painting is that
   fine-grained. Fails AB 4 ("detail is simplified into brush-sized shapes") and the freeze-frame
   test: this is the first thing that says "3D render with a filter". The looking-up frame
   (`painter-19f72ce-gallery-canopy-noon.jpg`) proves the pipeline can do it: there the leaf
   masses are shapes. Bring the eye-level trees to that.
3. **Ruler-straight lines.** Same frame: every birch trunk is a straight, evenly lit, evenly
   white cylinder of the same thickness, and the left bank of the brook is one straight dark
   line across a third of the picture. Fails AB 4 ("silhouettes wobble slightly, never
   ruler-straight"). Trunks need lean, taper, broken edges and paper showing through (birch is
   mostly bare paper with a few dry-brush marks).

SHOULD FIX

4. **No depth inside the forest.** In the `trees` frame the pines at the back are as dark and
   as saturated as the trunks at the front. AB 5 wants each distance band lighter, cooler and
   lower in contrast; inside a wood that is what separates the layers.
5. **The foreground is one flat wash.** The clearing in the `trees` frame and under the
   explorer in `real-01-on-foot.jpg` is a single yellow-green with a few blobs. AB 3 ("no area
   is flat colour") and AB 4 (near things get a few crisp accents): grass-tip dry brush, a few
   blades against the light. It is also what makes walking read as moving (`R-FOOT-2`).
6. **Trees stand in rows.** Mid-distance trunks in the `trees` frame line up like a plantation.
   Cluster them (birch in groups, pines behind) and leave irregular gaps.
7. **Night is not yet a painting** (`painter-19f72ce-gallery-stream-night.jpg`): the trunks
   glow at full paper white while the ground is close to a flat near-black navy. `R-DAY-3`
   wants a readable ground and nothing near black; the trunks should take the indigo glaze
   like everything else. Dusk (`...-stream-dusk.jpg`) turns the sky grey-violet but leaves the
   grass at noon green: the whole palette should move to gold (`R-DAY-1`). Not M1 scope; listed
   now so it does not get built on.
8. **Space granulation reads as black pepper** (`docs/shots/pilot/real-02-orbit.jpg`): hard dark
   specks at pixel size over the indigo. AB 1: nothing is pure black; AB 8: salt textures and
   spattered stars. Soften and enlarge the grain in space, and the planet needs a rim that
   fades to paper (`R-SPACE-5`). M2/M3 scope.
9. **Build hitches.** `world.update` averaged 7.5 ms with a 34 ms peak while running at
   `d238c50` (budget: 5 ms), and 8.7 ms average flying at 120 m at `19f72ce`. On a 60 fps
   machine a 34 ms update is two dropped frames (`R-SPACE-1`). Keep each slice inside the
   budget you were given (`setBuildBudget`), flora included.
10. **`sampleSurface` cost** is 0.016 to 0.072 ms a call (Mercury slowest, Earth 0.052). I make
    about 12 calls a frame on foot, so it is fine today; keep it under 0.05 ms as detail grows.

GOOD (keep)

- The sheet: paper tone, ragged border fixed to the screen, pooling at silhouettes, wet sky
  with paper clouds. Open-country frames already look like a watercolour sketch.
- The canopy frame. Leaf masses as shapes with sky holes, branches as single strokes.
- The brook: reflections of the trunks as vertical broken strokes with paper glints (AB 9).
- The planet from orbit reads as a painted ball with distinct biome colours and no seams.
- The contract: `sampleSurface` is exact on all ten bodies (unit normals, slope, liquid,
  weights, determinism), spawns are dry and gentle, vistas exist, `world.busy` works as a
  readiness signal, foreign materials are painted without errors, `sampleObstacles` arrived
  the same hour it was asked for. Integration took one flag flip.
- Time of day comes from the real sun; my 09:30 spawn spin gives a clear morning as intended.

Contract note: the Moon's mountains reach 267 m and Pluto's 245 m. I raised `spaceAltitude` on
both to 420 m in `src/data/bodies.js` rather than ask you to lower them.

### PHYSICS

No milestone gate yet (wiring is M2). No MUST FIX.

SHOULD FIX

1. **Worst-case frame.** `physics.update` averages 0.4 ms (well inside 2 ms) but one frame in my
   600-frame run took 6.8 ms. Whatever that is (a re-anchor, a first allocation), spread it:
   the budget is per frame, not on average (`R-PART-6`).
2. **Say which of my numbers each of yours replaces.** `EXPLORER_BODY` and `SHIP_BODY` already
   mirror my tuning (jump 4.8 m/s, float depth 1.25 m, 17 m/s2 of jet thrust). Before I wire
   them in, the notes need the table promised in section F: your constant, my constant it
   replaces, and the assist you expect me to keep on top. Without it I will be guessing.
3. **No lab page and no evidence shots yet.** `physics-lab.html` does not exist and
   `docs/shots/physics/` is empty, so nothing about grass parting, footprints or particles can
   be seen by anyone but you. A plain canvas plot of the wind field, a gust front crossing it
   and a footprint trail is enough for review (`R-WIND-2`, `R-PART-2`, `R-DEF-1`).
4. **The giants' winds are scaled down by 10 to 25.** Reasonable (nobody could stand in 400
   m/s), but keep it in one named constant per body so that `R-FOOT-5` (wind never wins on
   foot) is my assist to tune, not something hidden in the data.

GOOD (keep)

- Real gas tables with sources, vacuum handled as vacuum (`R-PLANET-2`), fall speeds that match
  the references without tuning: rain 6.3 m/s and snow 1.0 m/s on Earth (`R-RAIN-1`,
  `R-SNOW-1`), drizzle-slow acid rain on Venus.
- The density profile was chosen so that constant thrust against drag reproduces my 46 to 160
  m/s envelope (`R-SHIP-3`): exactly the right way to replace a table with a model.
- Gusts that travel with the wind (frozen turbulence), which is `R-WIND-2` by construction.
- 72 tests, a documented API at the top of the notes, allocation-free queries with `out`.
- Gear as a 1.6 Hz spring at 0.65 damping: settles inside `R-SHIP-5`'s one second.

### PILOT (self-review; the other roles and the coordinator review this domain)

Known weaknesses I would flag if this were someone else's work:
- Trees: the explorer, the camera boom and landing-site choice now respect
  `world.sampleObstacles` (tested in Node against the real forest, not yet watched in the
  browser), but the flying ship still passes through crowns: its cushion follows the ground.
- The HUD is a plain paper fallback, not the painted theme, and its ink is only legible over
  space because of a halo (`R-HUD-4` is met in a makeshift way).
- Pointer lock has never been exercised: headless Chromium reports nonsense deltas under lock,
  so every scripted run uses drag-look (`pointerlock=0`).
- No audio, no save, no pulse drive, no map yet (later milestones).
