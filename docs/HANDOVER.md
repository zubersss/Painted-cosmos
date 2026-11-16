# HANDOVER: read this first

This file is how one Claude session hands the project to the next, whichever account it runs on.
Nothing from an earlier chat carries over; everything that matters is in this repository. Read
this file whole, then the last three sections of `docs/COORDINATOR.md`. Only then start work.

**The rule for switching accounts:** only one session works at a time. Before you stop (or when
you see usage running low), commit and push everything and update section 3 ("State right
now"). The next session starts from that. If a session was cut off without updating it, rebuild
the state from `git log`, the last section of `docs/COORDINATOR.md`, the hand-overs at the top of
`docs/notes/*.md`, and any "WIP snapshot" commits.

## 0. How to start a session

`CLAUDE.md` at the root (on `main` since pull request #3 was merged, and on `r2`) tells every new session to do
the steps below by itself, so the owner can just type "continue".

1. Use the repository `zubersss/Painted-cosmos` and check out the working branch:
   `git fetch origin && git checkout r2`. This file and the latest log live on `r2`, not on
   `main`.
2. Read this file, then `docs/COORDINATOR.md` (its last three sections), then `docs/BRIEF.md`
   (the original brief; section 2 is the art bible, partly overridden in section 2 below).
3. Run the checks in section 5 on a clean export to see where the code stands.
4. Do what section 4 says is next, unless the owner says otherwise.

## 1. The project

Painted Cosmos is a calm single-player browser exploration game. You walk and jetpack, board a
ship, fly seamlessly from the ground to space, travel to the eight planets (plus the Moon and
Pluto), land, explore, find views and keep a sketchbook. There is no combat and no way to fail.

- **Stack:** Three.js r187 vendored, WebGL2, plain ES modules with an import map, no build step,
  zero runtime network.
- **Live:** https://zubersss.github.io/Painted-cosmos/ (GitHub Pages serves `main`).
- **Controls:** `README.md`.

## 2. The owner's standing instructions (binding; newest win)

These were given in chat over several days. They override `docs/BRIEF.md` where they differ.

1. **Work autonomously.** Choose what serves the owner's goal and log the choice in
   `docs/COORDINATOR.md`. Ask only what only the owner can decide (merging, a big change of
   direction). Message the owner briefly, at milestones.
2. **Model and effort.** The owner picks the session's model, and agents run at extra-high
   effort. Use multi-agent workflows (the owner's word is "ultracode") for the hard parts. Usage
   is now the owner's binding constraint, so prefer smaller, focused workflows over large fan-outs
   (section 6).
3. **No triangle or draw-call budgets.** Best quality, and the game starts at the top tier.
4. **Sharper and smoother first.** After play-testing, the owner asked for this, above all the
   ground seen from the ship ("see where im landing, not blurry blobs"), and said "you dont have
   to focus on the water color aspect anymore". Sharpness and smoothness now come before the
   watercolour abstraction, without losing quality at the top tier. The game must be fully
   playable on phones and tablets.
5. **A new look, as a switch beside the watercolour (not started).** The owner sent a short clip
   of another game as a style reference: oil-paint brush strokes that follow the shapes, rich
   saturated colour and strong contrast, a low golden sun with long shadows and light shafts,
   falling leaves, auroras over snow, warm window light at night. Use it as a reference only:
   make our own worlds and figure, not a copy of that game.
6. **A new explorer (not started).**
   - No hat: bare head.
   - A **rich blue** cloak (the owner, 2026-11-15: first grey, then blue-grey, then "make the
     cloak richer blue": it is the strongest colour in the picture, as in the clip) in place of the cream coat and red scarf. It
     moves with the wind and the run (PHYSICS already gives `relWind`, lean, gale crouch and so
     on in the figure's state). No jetpack under it (item 23).
   - A lantern at the hip, dark by day, flickering on at dusk and off at dawn.
   - The lantern's warm pool of light is painted into the ground's and plants' shading, not a
     real three.js light (too costly).
   - The hood goes up in snow and storms; the head is bare otherwise (confirmed by the owner on
     2026-11-15).
   - No cabins or shelters for now (the owner, 2026-11-15): the lantern gives the warm light at
     night, and the look comes first.
7. **Merging.** The owner merges, or tells the session to merge a specific pull request. The
   session's permission check refuses a merge the owner has not asked for in that session; do not
   work round it.
8. **Pause means nothing runs.** No agents, no workflows, no browsers, until the owner says go.
9. **Privacy.**
   - Never use or look for the owner's other projects, past chats or memories.
   - The owner's email is private.
   - No model names in commit messages, PR text or code, except the attribution lines the
     session's own instructions require.
10. **Plan with the owner before anything starts (2026-11-15, to the second account's session).**
    - "Do NOT start any work yet: no agents, no workflows, no code changes." This holds until the
      owner says go.
    - The owner will send style references and how the work is to be organised. The plan is then
      made together with the owner in chat, before anything starts. For the work ahead this comes
      before item 1: section 4 below is the last session's proposal, not an order.
    - Log every new instruction from the owner in `docs/COORDINATOR.md` and in this section.
11. **No ultracode unless it is needed; keep usage down; be candid (2026-11-15).**
    - The owner does not want multi-agent workflows ("ultracode"). Run one only if it is truly
      needed, and tell the owner so plainly first, with the reason. This amends item 2.
    - If a message's wording makes the harness offer a workflow while the owner is saying they
      do not want one, the owner's meaning wins: run nothing.
    - "Dont be afraid or quick to please": give the plain truth, including when an earlier
      proposal was too much.
    - The owner has two accounts. The other one's usage resets on 2026-11-19.
12. **The best possible quality comes first (2026-11-15).** "I want my game to look the best."
    Spend usage wherever it buys quality and nowhere else. When the coordinator thinks another
    idea is better than the owner's or the plan's, it says so.
13. **Sort the references before planning from them (2026-11-15).**
    - For each reference the owner sends, decide whether it helps this game or would pull its
      lighting or art direction another way, and say why.
    - The measure: the moving-painting look, which the owner likes most, together with a better
      and smoother game.
    - The style should be the game's own. The moving painting is the favourite, not a fixed
      target: "if we can get something thats unique and still look good il also be happy". Mark
      for each reference whether taking it makes the game more like something that already
      exists, or more its own. The owner and the coordinator judge this together.
    - Give the owner that view and talk it through; the owner may reject any of it. Nothing
      starts until the owner gives the go.
    - **The clip is the main target:** "i want it to look like that but with my own spin on it
      but really close to that". The other references serve that look and add the game's own
      touches; they do not pull it away from the clip.
    - The owner cares that each linked picture is judged by eye. The cloud session's network
      settings refuse the picture sites, and the environment tools could not change that (see
      the log, 2026-11-15); the owner can widen Network access in the environment's settings.
    - Use every reference that fits, not the clip alone. Each one marked take or take in part
      in `docs/references/README.md` guides the part it serves (land from the air, night, water,
      the figure, the planets), and the plan names which guides which.
15. **The hard parts first (2026-11-15).** The owner has the top model for a limited time and
    will go on with the next model down when it runs out. The plan puts the hardest and most
    quality-critical work first, and leaves for later what a session on the next model can do by
    following a proven pattern (the top model builds the machine; later sessions feed it).
16. **No blur at all (2026-11-15).** "I dont want it to be blurry at all I hate the blur the
    most." The clip is the standard for crispness. The crispness rule in
    `docs/references/README.md` binds every piece of work on the look: from the painters take
    colour and direction, never the thick rough paint; no smoothing filter, no soft blending, no
    blur effects; the full screen size on phones; sharpness measured with `tests/stations.mjs`.
18. **Strokes small, like the clip, with no outlines (2026-11-15, on the first peek).** "Make the
    strokes smaller and almost exactly like the video reference these are too wide and too
    outlined." The clip's strokes are the measure of size and shape: leaf-shaped dabs lying every
    way on the forest floor, long streaks on trunks, no line drawn round a stroke.
19. **Thinner than the clip; six styles to choose from (2026-11-15).** "Try to get them thinner
    then the video actually just copy how the lines are used but optimize it for our game."
    Then: six styles from the thinnest to the widest, the widest no wider than the clip's
    strokes; two that follow the clip's own way with thinner strokes, four that explore other
    ways; the owner chooses. They are `STYLES` in `src/render/shared.js` on `look-proto`
    (`&style=1..6`).
20. **Style 5, and the clip matched "almost to the tea" (2026-11-15, at checkpoint 1).** "Do
    style 5 but make sure your making it the same as the reference video almost to the tea you
    can change up ground materials like the grass or snow if it helps you get closer ... same
    for everything else." The style is 5 (leaf dabs lying every way). The clip's LOOK is the
    target, matched closely: light, colour, strokes, shadows, air, grass, snow. The game's own
    materials and content may be changed to get there. Items 5, 6, 16 and 17 still bind: our own
    world and figure, no blur, the desktop first.
21. **A rebuild is allowed where it does better work (2026-11-15).** The owner asked whether the
    paint should start from zero instead of building on the watercolour, and said "if a
    [rebuild] will do better work im okay with that". Rebuild a part from zero where the
    watercolour's design holds the match back (foliage, grass, sky, water, each world's colours);
    keep the world itself (planets, land, physics, flight, interface).
22. **Colours that pop, no detail lost; the plan first, then the owner's word (2026-11-15).** The
    owner asked for an audit of everything that holds the look back, fixes and overhauls, "the
    colors to pop but the details to not be lost", and to be told what the plan entails before
    being asked what to do next. The plan is put to the owner and nothing new is built on it
    until the owner answers.
23. **No jetpack: the explorer flies like Superman (2026-11-15).** "Get rid of the jetpack just
    make it flight like superman." The new explorer has no jetpack and no fuel; it flies by
    itself (Space up, W where the view looks, C down, Shift fast, hands off hovers). Built on
    `look-proto` for the new explorer; the ship still carries it between worlds.
24. **The checkpoint is approved; thinner strips on the cloak; the aurora as light (2026-11-16).**
    "I like the look so far keep it up the cloak looks clunky thinner stripes would help or more
    stripes to make it flow easier i also like the night and the tundra but the northern lights
    look like stripes instead of lights like the reference otherwise everything looking good
    continue working and tell me the next time you need something." The cloak gets many thin
    strips so that it flows. The aurora must read as light, as the clip's does (soft, glowing,
    fading upward): this is the one soft thing in the picture, by the owner's own word; the
    crispness rule (16) stands for everything else. Work goes on without stopping for approval;
    the owner is asked only when something is needed from them.
25. **Snow is the colour of ice and snow, not bright, not many-coloured (2026-11-16).** "I also
    dont like how Bright the snow area is why is the snow colorful fix it and shade it the color
    of ice and snow and make the lines closer to the ice in the reference." Snow and ice are laid
    in white, pale blue, blue and blue-grey only, a step darker than they were, and their strokes
    follow the snow and ice of the reference clip's night frames.
26. **The night sky's streaks and the snow's strokes as the reference's (2026-11-16).** "Make the
    lines on the sky at night time near the northern lights closer to the lights in the
    references not the lights but the patterns in the sky and make the snow strokes look closer
    to the reference like its actually been painted on the ground like the reference." The
    aurora stays; the streaks in the night sky follow the clip's sky; snow reads as paint laid
    on the ground, as the clip's.
27. **Snow smooth, in many thin strokes, no ridges; snow trees (2026-11-16, with a picture).** "Make
    the snow lines thinner and more frequent and get rid of the deep ridges between them it looks
    like tiles make it closer to this photo and can you start adding trees like this as well in
    the snowy areas." The picture (a watercolour of a snowy night; described in
    `docs/references/README.md`) gives the snow (smooth pale drifts, softly shaded, a few thin
    lines) and the trees (snow-laden firs, bare slender violet-blue trees). The relief on snow
    strokes (item 26's first answer) is withdrawn. No blur (16) still stands: the picture's
    softness is not taken.
    A second picture followed ("And this one": a pastel of a bare winter wood): its thin, close,
    slanting hatched strokes of pale snow and its bare dark slender trees with twiggy crowns are
    taken the same way.
28. **A summary in `CLAUDE.md`, a checkpoint, and a list of the three riskiest parts; fix nothing
    until told (2026-11-16).** "Do not stop or abandon your current task. Finish it first. When
    it's done, do these in order, without changing any game code: 1. Tell me what rendering tech
    this game uses ... 2. Give me a short overview of how the code is organized ... 3. Create a
    CLAUDE.md file in the project root that summarizes the structure, the tech used, how to run
    the game, and any conventions you've been following ... 4. Commit everything to git with a
    clear message as a checkpoint. 5. List the 3 messiest or riskiest parts of the code, but
    don't fix them yet. Wait for my go-ahead." The existing `CLAUDE.md` rules were kept and the
    summary added under them. THE THREE PARTS LISTED IN STEP 5 ARE NOT TO BE FIXED WITHOUT THE
    OWNER'S GO-AHEAD (they are named in the log's entry of that date).
29. **The reference clip still counts beside the new pictures (2026-11-16).** "But still use the
    reference video as well." The owner's two pictures of snow (item 27) are added to the
    references; they do not replace the clip, which stays the main target (items 13, 20). For
    snow: the clip gives the night's colours, the sky, the aurora, the lantern's pool and
    strokes one can see sweeping in arcs; the pictures give thin, many strokes with no ridges, soft
    shading and the trees. Where they pull apart the snow sits between them.
30. **"Resume work" (2026-11-16).** Read as: go on with the look. Not a go-ahead for the three
    riskiest parts (item 28: still waiting) and not a yes to a desktop page (still not answered).
31. **Yes to the pull request for the look (2026-11-16).** "Yes, open the pull request that adds
    the look behind ?look=oil." A pull request from `look-proto` into `main` is opened; the
    owner merges it (or asks for it to be merged) when they choose. After the merge the look is
    at the live address with `?look=oil` added; without the flag the game is as before.
32. **The owner's phone is a Samsung Galaxy S23 Ultra; they asked for the top-quality link
    (2026-11-16).** "I have a Samsung 23 ultra and give me the top quality settings link." Given:
    the live address with `?look=oil&preset=desktop&quality=2&dynres=0` (what each part does is
    in the log). The desktop they play on is still not known.
33. **After the phone: the snow world liked; the forest slow and behind; rivers (2026-11-16, with
    two screen recordings and three pictures, then twenty more).** "i liked the look of the snow
    world one but I feel like the forest one could stil use alot of work it was choppy and slow
    turning felt slow it felt laggy the look wasn't as pretty as the snow one or as well done
    refine the look further uses these new photos as references as well for it and the river
    could use more tributaries make it split off into many with diverting paths that connect and
    run off into there own rivers like real life". Then: "Here use these as reference if its
    gonna help" (twenty pictures of autumn forest from the air and the ground). So: (a) the
    forest must run smoothly on the phone; (b) its look is refined after the new pictures
    (described in `docs/references/README.md`), the clip still the main target; (c) rivers
    branch: tributaries, channels that split and rejoin, side rivers of their own.
34. **"Open the pull request" (2026-11-16).** Pull request #5 (`look-proto` into `main`: the
    forest's speed, the autumn wood, the rivers, the speed test) was opened at the owner's word.
    The owner merges it; the session does not.
35. **After pull request #5, on the phone: "feels bad ... blurry and blotchy" (2026-11-16, with the
    speed test's table and a recording).** "lt feels bad playing it now most of the things haven't
    rendered and it looks blurry and blotchy make the graphics look better and make it run
    better". The owner merged #5 and played with the phone's OWN settings. So: the look must be
    SHARP on the phone (no blur, item 16, holds there too), things must not go missing, and it
    must run better. The table's numbers and what they mean are in the log.
17. **The desktop sets the look (2026-11-15).** "If building it for the phone will lower the
    quality focus on the desktop then." The top tier on a desktop gets the best version of every
    piece, and no technique is chosen for the phone's sake. The phone gets the same look with
    cheaper settings afterwards and stays playable (item 4); it never holds the desktop back.
    The prototype is built and judged on the desktop's top tier.
14. **Say what is planned before each go (2026-11-15).** "Let me know what your planning to do rn
    before I give you to go dont do anything." Even reading the code for the plan waits for the
    owner's go. Logging the owner's instructions goes on as always.

## 3. State right now (update this before you stop)

Last written afresh 2026-11-16 by the coordinator on the second account (the earlier text had
been patched a dozen times; the log has the history).

**In one line:** the new look is LIVE behind `?look=oil` since 2026-11-16 (pull request #4,
`main` at 1cd885f). The owner played it on their phone (a Samsung Galaxy S23 Ultra): the snow
world liked, THE FOREST SLOW (about 9 pictures a second at the pinned top settings) AND NOT AS
PRETTY, and rivers wanted with tributaries (section 2, item 33; 23 new reference pictures, all
of autumn woods, in `docs/references/README.md`). The answer to that is BUILT AND PUSHED ON
`look-proto` BUT NOT LIVE: it is PULL REQUEST #5, open, waiting for the owner to merge it.

**What is on `look-proto` beyond `main`** (the log's last section has the whole account, the
painter's notes on that branch the file-by-file one):
- Speed: a tree's detail follows its size on the screen, far trees follow the air, a far tree
  keeps a share of its leaves. Measured in software at the phone's picture size: the forest's
  frame about half of what it was, a quarter of the triangles. Not measured on any real device.
- The look of the wood after the new pictures: the explorer lands in the AUTUMN wood; each tree
  its own colour (yellow, orange, red), conifers in groups; a floor of grass with the near
  blades, flowers and fallen leaves back in the oil hand; smaller rounder leaves; blue water.
- Rivers (Earth, oil look only): channels that split round islands and rejoin, pools, side
  streams that fork into the rivers.
- `?bench=1`: a speed test that leaves a table on the screen for the owner to photograph.
- The default (watercolour) game: compared pixel for pixel with `main` in six places, 0 pixels
  differ; the full check (`node tests/all.mjs --export`) on `look-proto`'s head 9b1a70a: all 17
  passed.

**What is waited for from the owner:**
1. To merge PULL REQUEST #5 (opened at their word, 2026-11-16; all checks in its text). Once
   it is merged, give them the two addresses: the wood with the phone's own settings
   (`?look=oil&body=earth&time=15.4`) and the speed test (`?look=oil&bench=1&body=earth&time=15.4`).
2. Then, from the phone: the table of `?bench=1` (a photograph of the screen), and how the wood
   looks and runs to them.
3. Their go-ahead before any of the three riskiest parts of the code is touched (below).

**Where new work goes:** built on the local branch `look-dev` (work tree `/home/user/pc-dev`,
lost with the container), pushed on `look-proto`. A LESSON KEPT: before a pull request into
`main`, prove that the watercolour game is unchanged BY PICTURES (the same views from the old
code and the new, compared pixel for pixel), not by reading the diff.

**The look, where it stands** (`look-proto`; the file-by-file account is `docs/notes/painter.md`
on that branch, "Hand-over of THE OIL LOOK"; the map of the code is `CLAUDE.md`):
- The overhaul plan of section 4a-2: 1 to 8 built and seen; 9 (every world) through a first
  round: all forty biomes draw, and what a survey of them showed wrong was cured.
- The owner's word since the checkpoint, each done and seen (section 2, items 24 to 29): the
  cloak in many thin strips; the aurora as light; snow in the colours of ice and snow; the night
  sky's streaks as the clip's; snow smooth, in thin close strokes with no ridges; snow-laden
  firs and bare trees on Neptune's snowfield; the clip still the main target beside the two
  pictures of snow.
- Checks: unit 251, world 47 on the head; the full check passed in full on earlier commits and
  is being run again on the head for the pull request.
- Measured from the ship: about three times as sharp as the live game, and more flicker under a
  slow pan (0.41 against 0.32 at 150 m; 0.23 against 0.10 at 1 km).

**Waiting for the owner (the same list, with the standing one):**
1. The pull request, then the phone's speed table and their eye (above).
2. Their go-ahead before any of the THREE RISKIEST PARTS of the code is touched (section 2,
   item 28; the list is in the log, "OWNER: finish the task in hand, then five steps"): the shader
   code's tangle, the new look's lack of automatic checks and its global switches, and the three
   branches that have grown apart.

**If the owner says "continue" or "resume"** (and gives nothing else): go on with the look on
`look-dev`, in this order: what is still wrong in the wood (rivers faint from high up; the far
land beyond the trees a mosaic of large dabs; dark flowers and stalks in the sward's shade; the
green wood, which has had little of this care); then: the trees of the snow in the other snowy places (the owner's "start
adding"; only Neptune's tundra has them); the firs' needles, angular near the eye; the open
points of the survey (Venus' lava at a low angle, Pluto's ridges, the far snow's level strokes,
the wood from the air); then, once the owner has judged the look on their desktop, the phone's
cheaper settings (item 17). Say what is planned in a line before starting; show stills.

**What a session here cannot know:** speed on a real graphics card, and how anything looks in
motion (`CLAUDE.md`, "In a cloud session there is no graphics card").

| Branch | What it holds |
| --- | --- |
| `main` | **Live.** At `1cd885f`: the new look behind `?look=oil` (PR #4, merged by the owner 2026-11-16), on top of `5e85754`: release 1, merged as `f551198` (PR #2): sharp ground from the ship at the top tier, touch controls, a phone preset; plus `CLAUDE.md` (PR #3, merged). Before that, M4's whole game (PR #1, `be90864`). |
| `cosmos` | Frozen at `3e46e80`: release 1's code, the same as `main`. Do not work on it. |
| `look-proto` | **Where new look work is pushed.** `main` plus the forest's speed, the autumn wood's look, the rivers and the speed test (2026-11-16); NOT LIVE until a new pull request is merged. |
| `r2` | **The working branch.** Release 1, the logs, this file, `tools/workflows/`, and release 2's half-done work as "WIP snapshot" commits only. No release-2 item was finished or verified. On a clean export of `r2`: world tests 56 pass and 1 fail ("MSAA belongs to the tier..."), unit 259, physics 325. |

**Waiting, in the owner's order:**

1. **The new look and the new explorer** (section 2, items 5 and 6): built, see above; pull
   request #4.
2. **Release 2** of `docs/lead/SHARP-SMOOTH-PLAN.md`: every tier and every device sharp, and
   fewer stutters.
3. **Release 3** of the same plan: building and streaming off the main thread.

**Known open issues in the live game:**
- On phones and weak machines the controller drops to tier 0 at half scale, where the ground
  from the ship is soft and trees vanish above about 200 m. This is release 2's target.
- Over Saturn's honey_mist, "Land here" can be offered and then refused with "Too steep" (about
  9 % of hover spots there). A half-done fix is in history (`1c406e2`).
- The camera can jam against narrow Mars canyon walls.
- At quality 0, a slim Neptune spire seen from a few metres shows a hard-edged slab.

## 4. What to do next

### 4a. The new look: the plan (written 2026-11-15; waiting for the owner's go to build)

This replaces the earlier brief (a filter in `post.js`), which would not have given the look.
Read `docs/references/README.md` first: the sort, the recipe and the crispness rule bind this
work.

**What the code is today** (read on `main` at `5e85754`, nothing changed):
- Every colour in the painter is the transmittance of a wash over paper: nothing is brighter
  than paper and distance fades to paper (`src/data/looks/common.js`, `src/render/chunks.js`).
  The game is pale by construction; the clip's opaque, saturated paint needs its own colour path.
- Light is laid in four soft steps by two shared functions (`pcLevel`, `pcTone` in `chunks.js`)
  that every material calls: one place to change how everything is lit.
- **There are no cast shadows.** Leaf shade is a noise pattern laid along the sun (`pcDapple`);
  the explorer and the ship lay a soft blot (`pcCast`). The clip's long trunk shadows have no
  counterpart.
- The ground's marks already keep their size on the screen as distance grows, in octaves that
  cross-fade, each mark filtered to the pixel (`TERRAIN_FRAG`, `pcStepF`, `pcSub`: release 1's
  work). The new strokes build on this.
- Six families of material (terrain, water, plants and rocks, generic wash, figure, near-ground
  blades in `src/render/materials.js`), the sky (`src/world/sky.js`, which already has an
  aurora) and PHYSICS' weather kits (`src/render/kitmat.js`).
- Plants are built in code from tubes, blobs and stroke-shaped pieces (`src/world/florakit.js`).
- The post passes (`src/render/post.js`): the brush, pooling, pencil edges, the paper sheet.
  The new look drops them for a plain finish, which is also cheaper.
- The explorer is one mesh built in code with a rig (`src/art/models.js`); its coat is already
  blown by PHYSICS' wind; a glass that lights at night exists for the ship's lamp.
- `tests/stations.mjs` measures sharpness, aliasing and flicker at fixed camera stations.

**Branch and switch.** A new branch `look-proto` from `main`. Everything behind `?look=oil`; the
default look does not change. Nothing goes live. Whether the new look replaces the watercolour
or sits beside it as a setting is decided by the owner after the stills.

**Who.** The coordinator builds it itself on the top model, one piece at a time, with no
workflow. One independent verifier agent at each checkpoint: it edits nothing, runs the suites
and the station measurements on a clean export, opens the stills and holds them against the
crispness rule and the reference notes.

**The order: the hard parts first, while the top model is available.**

| # | Piece | Guided by | Hard? |
| --- | --- | --- | --- |
| 1 | **Colour and light.** Opaque paint in place of washes over paper, in the shared functions: warm light, cool violet shade, deep darks; distance steps toward the sky's colour and never softens an edge; three colours that key the world | The clip; Van Gogh's Falling Autumn Leaves (colours only); Firewatch; No Man's Sky | Medium |
| 2 | **Strokes on the surfaces.** A stroke field made once at start-up. Each stroke one flat colour with a clean edge, running the way its surface runs (along the slope on the ground, up a trunk, with the wind in the sky). Light and shade decided stroke by stroke. The world's ground colour showing between strokes | The clip; Tom Thomson; Klimt; The Long Dark's brushed planks | **Hardest** |
| 3 | **From the ship.** Strokes re-form in steps as the eye rises: leaves, then trees as single patches, then woods and fields. Each stroke switches whole; no soft blend of two layers. Paths, water and trees stay told apart | Tom Thomson's Autumn Foliage; Breath of the Wild; The Pathless; Europa | **Hard** |
| 4 | **Shadows.** Real cast shadows near the eye (trees, the explorer, the ship), built for the desktop without compromise; farther out the leaf-shade pattern drawn long by a low sun. Shadows blue-violet, their edges cut along the strokes | The clip; Firewatch's orange forest; Arise | **Hard** |
| 5 | **Night and sky.** Night in blue with the snow lightest; the aurora in upright strokes; sky strokes that follow the game's wind; the lantern's pool laid into the ground's and plants' shading | Sohlberg; The Pathless's snowy valley; the clip | Medium |
| 6 | **The explorer.** Bare head; a blue-grey cloak with a trimmed hem over the jetpack, moved by PHYSICS' wind; the hood up in snow and storms; a lantern at the hip, lit from dusk to dawn; a rim of light | The clip's figure; Journey; No Man's Sky; Ori | Medium |

Phones are not part of the prototype (section 2, item 17: the desktop sets the look). The same
look with cheaper settings, the picture at the screen's full size and the count of its cost come
after the owner approves the prototype, with release 2's phone work.

**Two checkpoints, each a stop for the owner.**

- **Checkpoint 1 (pieces 1 to 3, the riskiest):** Earth's autumn woodland with a low sun, on
  foot and from the ship at 150 m and 1 km, beside today's game, at two or three stroke sizes.
  With the numbers: sharpness at least release 1's from the ship (`tests/stations.mjs`, final
  land t1/t2 about 1.0), flicker no worse. The owner picks the stroke size and how strong the
  colour is, or sends it back.
- **Checkpoint 2 (pieces 4 to 6):** the same wood with real shadows; Neptune's aurora tundra at
  night with the lantern lit; the explorer close up by day and by night, standing, running, hood
  up. Then the unlisted preview page for the owner's desktop, which needs the owner's word
  because it is published through `main` (as a separate folder; the live game is not touched).

**After the owner approves the prototype (work that follows a proven pattern, so a session on
the next model down can do it):** each world's colour key and stroke settings, world by world,
by a written recipe; water; leaves, snow and motes in the air; footprints, glints, landmarks;
the setting in the game's menu; release 2's phone findings; the blind players; the merge.

**Risks, said plainly.**
- Clean-edged strokes can shimmer far away. Release 1's filtering is the defence, and the
  flicker measurement is the judge.
- The ground stores its colour at the corners of its triangles, so a far stroke cannot always
  be one perfectly flat colour.
- Real shadows may cost too much on phones; there the long leaf-shade pattern stands in. The
  desktop keeps the real ones.
- It is a bigger job than a filter: the prototype converts the ground, the plants, the figure
  and the sky for two scenes. Water, the weather kits and eight more worlds come after.
- A rough guess at the cost: about half of what release 1 took, over the two checkpoints. The
  session cannot see the owner's usage meter.
- If the top model runs out mid-way: every piece is committed when done and written up here, but
  pieces 2 and 3 should be finished on it.

### 4a-2. The overhaul plan (approved by the owner 2026-11-15: "Go ahead in that order")

The owner asked what still holds the look back and what a plan to fix it entails (section 2,
item 22). Audit: the clip's frames beside the stills of `look-proto` at `d8bd753`. Built so far
there: style 5 (leaf dabs), real cast shadows, the slender wood, the pale gold air and the look's
own golden hours, falling leaves, the wanderer with cloak, hood and lantern, the lantern's pool,
snow in tiles, the aurora in strokes (see the painter's notes on that branch).

**What holds it back, most first.**

| # | Overhaul | Why (what the clip has and we lack) | What it entails | Taken from |
| --- | --- | --- | --- | --- |
| 1 | **Colour as paint** | The clip's colours are pure and strong; ours are converted from pale watercolour washes and come out brown and muted, and every shade turns the same maroon-violet | Each world's colours given outright as paint (a small palette: light, local, shade for ground, leaf, bark, sky, water); shade that keeps a thing's own hue; the air thin near the eye and thick far off; a last pass that deepens darks and lifts saturation without touching edges | The clip; Van Gogh (opposite colours side by side); No Man's Sky (three colours key a world); Tiny Glade (orange, violet, blue) |
| 2 | **Foliage rebuilt** | The clip's crowns are dark crooked branches carrying separate leaf-shaped pieces, with bright sky between; ours are lumps with leaves painted on, pale and far | Trees built again: branches as tubes, leaves as leaf-shaped cards in clusters (a few hundred a tree near by, fewer and larger farther off, one patch from the ship); each leaf one flat colour, lit or shaded whole; the same for saplings and bushes. Their shadows fall dappled by themselves | The clip; Tom Thomson (a tree as one patch from the air); Klimt (each trunk its own marks) |
| 3 | **Strokes baked** | The strokes are worked out afresh for every pixel: too slow to play, and they flicker from the ship (checkpoint 1's numbers) | The dabs and tiles drawn once into textures at start-up and read from there, filtered by distance: the same picture, many times cheaper, steady under a moving eye | Release 1's lesson (patterns filtered to the pixel) |
| 4 | **Light in the air** | The clip has shafts of light through its haze and a glow round the sun | Shafts worked out from the shadow map along each line of sight (light added in the air; no blur of the picture) | Firewatch; Arise |
| 5 | **Grass and floor** | The clip's floor has tufts of long lit blades, saplings, a few flowers, and leaves of many sizes; ours has stiff spikes and one size of leaf | Tufts as blade-shaped strokes in painted colours; leaf sizes and kinds varied; bare paths and moss as their own strokes so the land reads | The clip; Klimt (cool flecks in a warm carpet); Breath of the Wild (paths read) |
| 6 | **Sky** | Still the watercolour's sky with patches on it | A painted sky: clouds as a few big shapes, the sun's glow, night strokes that follow the wind, stars; rings and planets bold | Sohlberg; Sea of Thieves; No Man's Sky; the clip's night |
| 7 | **Water** | Still the watercolour's water with dashes on it | Flat dashes that carry the sky's colours, the sun's or the aurora's path as broken marks, a foam line at the shore | The clip's night; Sea of Thieves; Rime |
| 8 | **The figure** | The clip's cloak is made of stroke-shaped strips with a ragged edge and is the strongest colour in the frame; ours is a smooth cone with streaks, greyer | The cloak as overlapping strips that lift in the wind; a rim of light; the lantern's own glow and the shadow it throws; (the owner to say whether the blue may be richer) | The clip; Journey; Ori |
| 9 | **Every world** | Only Earth's autumn wood and Neptune's tundra are tuned | Each of the ten worlds given its palette and stroke settings by the pattern proved on these two; rocks, cliffs and strata in strokes | No Man's Sky; The Pathless (a landmark and one accent a region) |

**Order.** 1 and 2 first (they decide how close the picture is), then 3 (it decides whether it
can be played and whether it flickers), 4 and 5, then 6 to 8; 9 is pattern work for a session on
the next model down. A checkpoint with stills after 1 and 2, and again after 3 to 5.

**What it will not do.** Match the clip's scenes one for one: the clip shows three small
hand-made places, this game makes ten planets by rule. Show motion: only the owner's desktop can.

### 4b. Release 2 (on approval or in parallel)

The plan's W6 (PILOT: a resolution floor that sheds tiers before pixels, phone pacing, sketch
capture off the frame), W7 (PAINTER: trees out to 2 km at every tier, a sharp enlargement, tier
shares), W4 (PAINTER: hitches and garbage) and W5 (PHYSICS: garbage and spikes; a phone tier).

The workflow that ran it is `tools/workflows/release2-every-tier.js`. Update its context first:
which branch to use, and that the WIP snapshots on `r2` can be finished or discarded. Also fold
in the phone player's small findings listed there:
- the jetpack gauge over the tabs;
- blank paper while loading in portrait;
- the sketchbook's tabs clipped;
- labels on the left stick;
- painted-play's flaky landing.

## 5. How the work is organised

**Roles and their paths.** Agents act in one role each and edit only its paths. The exact lists
are in `tools/commit.sh`.
- PAINTER: rendering and the worlds (`src/render`, `src/world`, `src/art`, `src/data/looks`).
- PILOT: systems, play, UI, input, tests, README (`src/core`, `src/player`, `src/ship`,
  `src/space`, `src/ui`, `src/audio`, `tests`, `index.html`, `README.md`, `docs/lead`).
- PHYSICS: `src/physics`.

**Commits.** Commit with `tools/commit.sh <role> "message"`. It commits only that role's paths
and pushes the current branch. The coordinator commits `docs/COORDINATOR.md`, `docs/BRIEF.md`
and `tools/`; for other docs it uses `git commit -- <path>`.

**Notes and the log.** Each role's notes file (`docs/notes/painter.md`, `pilot.md`,
`physics.md`) has a hand-over at the top, kept current after every item. `docs/COORDINATOR.md`
is the coordinator's log: every owner instruction, ruling, acceptance and incident.

**Plans and critiques.**
- `docs/lead/SHARP-SMOOTH-PLAN.md`: sharper, smoother, mobile, in releases R0-R5.
- `docs/lead/CRITIQUE*.md` and `docs/lead/REVIEW.md`: older critiques and reviews.

**Checks** (on a clean export: `tools/export-head.sh <dir>`):
- `node --test src/world/*.test.mjs`, `node --test tests/*.test.mjs` and
  `node --test src/physics/`;
- `node src/physics/coast.mjs` (PASS at both stands);
- `node docs/lead/evidence/review7/ghostfield.mjs` (all zeros);
- `node docs/lead/evidence/pilot11/wallrun.mjs <root> earth sea_coast` (no climb on ground over
  50 degrees);
- `node tests/all.mjs` in a clean tree: about an hour, 17 steps including touch.

**Sharpness.** `tests/stations.mjs` holds the camera at fixed stations and measures the
sharpness, aliasing, flicker and cost of each frame. The baseline is
`tests/baselines/stations-784183b.json`; how to run it is at the top of `docs/notes/pilot.md`.

**The pattern that worked.**
1. Each role fixes in its own paths.
2. An independent verifier, which edits nothing, tries to refute each fix on a clean export and
   opens the frames.
3. One re-fix pass.
4. An integrator runs everything.
5. A blind player reads only the README and plays with real input, now including a touch-only
   phone player in Playwright emulation.

The scripts are in `tools/workflows/` (copied from the session that ran them; edit their context
before reuse).

## 6. The machine and the cloud session

**Hardware.** 4 CPUs, 16 GB RAM and **no GPU**. Headless Chromium (pre-installed Playwright)
renders WebGL on the CPU, at 1-3 frames a second. Count work (draw calls, triangles, texture
reads per pixel) instead of timing frames.

**Agents.**
- At most one browser per agent, closed when done.
- Never two Node test suites at once.
- Kill processes only by PID.
- Scratch goes under `/home/user/.pc-scratch/<role>/`.

**Scratch does not survive a new session or account.** Old notes name scratch paths, such as the
audits' evidence under `/home/user/.pc-scratch/audit/`, that a new container will not have.
What matters is in the repository; the harness regenerates frames.

**Restarts.** The container restarted without warning six times, and it was not memory. Commit
each finished item at once. When the stop hook reports uncommitted files, snapshot them:
`for r in painter pilot physics; do tools/commit.sh $r "WIP snapshot ..."; done`.

**Workflows.**
- The workflow runtime runs two agents at a time here.
- A resumed workflow matches finished agents in call order. If an earlier call's prompt changed,
  later finished ones re-run, so pass finished results in through `args` (see the scripts).
- Journals do not carry across sessions.

**GitHub.**
- `gh api` works for pull requests and merges on `zubersss/Painted-cosmos`.
- The Pages API path is blocked by the proxy, and github.io is not reachable from the container.
  Read the deployment from `gh api repos/zubersss/Painted-cosmos/actions/runs`.
- A push prints "This repository moved", but it succeeds.

**Usage.** One release with fix, verify, re-fix, integrate and play-test cost about 6 million
agent tokens and 19 hours here. To stretch usage:
- smaller releases, one feature at a time;
- one verifier per release for small changes;
- frames at quality 1 except where the top tier is the point;
- stop and show the owner early (stills before a full build).

## 7. Lessons learned (do not relearn these)

**Rendering**
- The blur came from a post pass whose brush grew with distance. Any painterly pass must keep
  its kernel a fixed small size in pixels, or fade out with distance.
- A sharp picture shows aliasing that a blur hid. Prefilter procedural patterns by the pixel
  footprint, and use MSAA where affordable.
- An MSAA resolve averages the region id: sky (0) plus foliage (4) reads as water (2). Release 1
  added a decode rule.
- Module workers do not see the page's import map. Worker code imports relative paths only,
  never `'three'`.

**Tests**
- Run `node tests/all.mjs` in a clean tree before calling a round done. Skipping it shipped an
  m3 regression once.
- painted-play and painted-trip are timing-sensitive at 1-3 frames a second; under load they
  can fail where they pass alone.
- The station harness must hold the game loop (`__pc.hold(true)`) or a game frame overwrites the
  held scene.

**Process**
- Verifiers find real regressions, in about half of all rounds. Keep them independent and
  adversarial.
- A cut-off agent is not resumed; a fresh successor reads the snapshots and the hand-over.
- Pin the clock in measurements (`__pc.teleport({ hour })`; the harness pins game time at 120 s).

## 8. Style references from the owner

They go in `docs/references/`; read `docs/references/README.md`. Use them for direction (colour,
light, brushwork, the figure), never to copy a specific game. The repository is public: only
keep images there that the owner made or that are free to share. For anything else, keep a
written note of what to take from it.
