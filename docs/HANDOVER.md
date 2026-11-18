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
36. **Rivers after two sheets of references (2026-11-16).** "Uses these as a reference for making
    the river and its paths." One wide winding river, tributaries that fork like a tree and thin
    away to nothing, sand bars and islands, plain to see from the air (the sheets are described
    in `docs/references/README.md`).
37. **"Open pull request" (2026-11-16).** Pull request #6 (`look-proto` into `main`: the phone's
    sharp picture and lighter paint, the rivers' second form, the speed test's second form) was
    opened at the owner's word. The owner merges it; the session does not.
38. **"Give me a link that forces top settings" (2026-11-16, after merging pull request #6).**
    Given: `?look=oil&preset=desktop&quality=2&dynres=0&lite=0&aa=msaa` (what each part forces is
    in the log). For seeing the look at its best; it is slow on the phone.
39. **Smoother without losing quality; the rivers flow (2026-11-16, with two speed tables and a
    recording).** "it ran better on my phone but the look was still awful keep working on it
    figure out what you could do to make run smoother without losing quality also the rivers
    should be moving with the flow of the current same for the art of it". (The look judged was
    the OLD version: the site had not been renewed; the log has the proof.) So: the cost is cut
    where the picture does not change, the water's strokes lie along the current and move with
    it.
40. **The phone is the main target (2026-11-17).** "i agree about the phone": the Samsung Galaxy
    S23 Ultra sets the look and the speed; the computer (a Lenovo, a basic built-in chip) follows
    with cheaper settings. This REPLACES item 17.
41. **Pull requests opened and merged by the session (2026-11-17).** "also start doing the pull
    request and merge on auto when you need it". A standing permission given in that session:
    when a version is ready to be tried on the owner's machines, the session opens the pull
    request into `main` and merges it itself. The gate it keeps before doing so is in the log
    (the default game unchanged by pictures, the three test suites, `node tests/all.mjs --only
    static,unit`, the default game's page booting; the full check straight after; undo at once
    if it fails: it did once, v8's request at run time, undone as v8.1). A LATER SESSION asks the
    owner once whether this still stands (`CLAUDE.md` says "only when the owner asks in that
    session", and was not changed). This amends item 7.
42. **The elemental powers, wind first (2026-11-17; the owner away for several hours).** The
    explorer will control wind, water, earth and fire; the feel of airbending (the feel only, no
    characters or symbols of any show); no combat, no enemies, no fail state. First a design note
    in `docs/` for the whole system (element choice and triggers on touch, keyboard, gamepad;
    the phone is the main target). Then WIND, in order: a gust, b gather and carry, c wind
    control (faster, or dead calm), d tornado, e move water (plan and cost first), f wind knife
    that fells a tree (plan and cost first); each finished before the next. The player's wind
    goes into the shared air field (`src/physics/air.js`) if that is the right way. RULES: a new
    branch off `main` behind `?powers=1`, off by default; DO NOT MERGE IT INTO `main` until the
    owner says (this overrides item 41 for this work); unused it costs nothing, in use a small
    fixed cost, measured; automatic tests like the physics tests; the full check still passes;
    the three riskiest parts touched only as far as wind strictly needs; no code for the other
    elements. Do not wait for the owner: choose, log each choice, keep going. Before stopping:
    commit, push, handover, and a short summary with stills, how to try it on the phone, and
    what is needed from the owner. The whole text is in the log.
43. **v8.1 on the phone: better, "but could still use alot of work" (2026-11-17, with the third
    speed table and a recording).** The table and what it means are in the log: the leaf change
    bought nothing; the far trees' crowns and the bark are the cost; the phone slows hard as it
    warms (40 ms to 69 ms in fifty seconds). Seen in the recording: dark blots on shaded ground,
    a loud lemon floor, pale lumps for far trees. Next after the powers.
44. **The snow world's link at high settings; "keep working though don't stop" (2026-11-17).**
    "Give me the link to the snow world at high settings keep working though don't stop." Given:
    the top-settings link with `body=neptune&time=23` (in the log). The four questions put to
    the owner in the powers' summary were not answered; "keep working" is read as: go on by the
    standing instructions, which makes the wind knife (item 42, f) the next work. NOT a word to
    merge the powers (item 42: "I'll say when").

45. **Both speed tables (v9) from the phone; "let's just keep working on refining the performance
    and the wind" (2026-11-17).** The two tables and their reading are in the log. In short: with
    the lumps the far trees are half the phone's frame (44 ms, 23 without them), but NOT through
    the paint in their own pixels (flat, they cost the same): the build machine was wrong about
    why. The experimental far tree (`?fartree=cards`) ran at 36.5 a second against 22.5. The
    speed test's finer rows cannot be trusted as they are (the screen's 8.3 ms beat, heat,
    shaders rebuilt while a row is timed). Standing instruction: KEEP REFINING THE PERFORMANCE
    AND THE WIND. Still no word to merge the powers.
46. **Top-quality links, one for the forest and one for the snow (2026-11-17).** "Give me top
    quality link one for  forest and one for snow." Given: the top-settings link (item 38's)
    with `body=earth&time=15.4` and with `body=neptune&time=23` (in the log).
47. **"Merge the powers" (2026-11-17).** The word item 42 waited for. The powers (wind, seven
    abilities) are merged into `main` behind `?powers=1` by the session's gate; the log has the
    steps and their results. The other elements (water, earth, fire) are still only described
    in `docs/POWERS.md`: no code for them (item 42: "don't start code for the other elements").
48. **The v13 table and five new instructions (2026-11-17, evening).** "Keep working on the
    performance I want it to look good from far away as well as run well and also make the wind
    powers more powerful let me be able to increase to circle to much bigger sizes and I should
    be able to make trees bend towards the direction I send the wind whatever direction I decide
    too and make the me have an option to fly even faster and when im flying high my camera
    seems to glitch." Five pieces: the camera's glitch when flying high (a bug); an option to
    fly faster; the aim's circle growable to much bigger sizes; trees bending the way the wind
    is sent; performance that keeps the far view good. The v13 table could not be read (the same
    row between 28 and 52 ms): THE SPEED TEST MUST HOLD THE GAME STILL FIRST.

49. **"You decide when to use ultracode ive given you full access" (2026-11-17).** The many-agent
    mode is the session's choice now (it replaces item 11's "not unless truly needed"). The
    session's reading: the bottleneck is the ONE software-drawing test browser, so many agents
    would only queue for it; the mode is for work that is parallel and needs no browser.

50. **"Make the bending the trees ability only one and add a even faster flying mode also keep
    refining the graphics I want it to look the best it can't on a Samsung s23 ultra"
    (2026-11-18, with the v15 table).** Three things. (a) ONLY ONE ABILITY BENDS THE TREES: today
    every cast lifts the trees' lean limit; it is to be one ability, and the rest leave the wood
    at its natural 17 degrees. The session took that one to be THE GUST, the ability you aim and
    send, because item 48(d) asked for trees that "bend towards the direction I send the wind";
    one line moves it if the owner meant another. (b) A FURTHER, FASTER FLIGHT above the 78 m/s
    surge of v15. (c) THE LOOK AT ITS BEST ON THE S23 ULTRA, which with the table below now means
    SPENDING HEADROOM, not saving it.

51. **THE v15 TABLE, AND WHAT IT SETTLES (2026-11-18).** The first table that can be believed
    (speed test 7, "held still", Adreno 740, picture 1028 x 480, tier 1, lighter paint, 199 calls,
    501k triangles, script 7.9 ms). ROWS 10 TO 21 ALL READ 16.7 ms = 60.0 A SECOND, middle 17,
    longest 17. THAT IS THE PHONE'S OWN REFRESH CAP, NOT THE GAME'S SPEED: the game finishes its
    frame with time to spare and waits. Three things follow, and they overturn a day of reasoning:
    - THE FAR TREES ARE SETTLED AND THE ARGUMENT IS OVER. Rows 2 to 9 differ by at most 1.6 ms
      while their own "as set" baselines wander 19.0, 20.0, 16.7: that spread is the phone warming
      and the world streaming in, not the far trees. They cost about a millisecond either way.
    - THE ONLY ROW THAT BREAKS THE CAP IS "THE FULL PAINT" at 18.4 ms. So the full desktop paint
      costs at least 1.7 ms more than the lighter one the phone is given - and the phone has the
      room for it.
    - THE PICTURE IS DRAWN AT 1028 x 480 ON A 3086 x 1440 SCREEN: a third of the screen's own
      detail, upscaled. THAT, not the paint, is most of why the owner has twice said it looks bad
      on their screen.
    HOW MUCH ROOM IS LEFT CANNOT BE SEEN THROUGH THE CAP (16.7 means "16.7 or less"). The speed
    test must therefore gain rows that RAISE the load - the picture at 1.5x and 2x, the full paint,
    the edges - until the cap breaks and the real headroom shows. Until then, no row at 16.7 may
    be read as a measurement of anything.

17. **The desktop sets the look (2026-11-15).** "If building it for the phone will lower the
    quality focus on the desktop then." The top tier on a desktop gets the best version of every
    piece, and no technique is chosen for the phone's sake. The phone gets the same look with
    cheaper settings afterwards and stays playable (item 4); it never holds the desktop back.
    The prototype is built and judged on the desktop's top tier.
14. **Say what is planned before each go (2026-11-15).** "Let me know what your planning to do rn
    before I give you to go dont do anything." Even reading the code for the plan waits for the
    owner's go. Logging the owner's instructions goes on as always.

## 3. State right now (update this before you stop)

Head rewritten 2026-11-18 (the v12 text it replaced is in the log).

**`main` IS AT v16 (18 Nov), pull request #16 merged.** It carries: the whole screen can be drawn (`?dpr=`,
`?best=1`; the phone preset's 3.7 MP ceiling no longer holds back an asked-for sharpness), only the gust bends the
trees, a third flight speed of 170 m/s, three cuts that cost nothing on screen, and four speed-test rows that RAISE
the load. Gate: six default scenes and three oil scenes all 0 of 518,400 pixels different; unit 273, world 48,
physics 366; the page boots; the speed test runs its 26 rows. THE FULL CHECK ON v16 HAS NOT BEEN RUN YET.

**FIRE IS IN `main` AND WIRED TO NOTHING** (`src/physics/fire.js`, `src/data/burnt.js`, `docs/POWERS-FIRE.md`).
Nothing imports any of it, so the game is unchanged. All three were broken by independent readers; the faults are
at the top of each file and in the log. DO NOT WIRE IT until the first one is settled: a fire in an ordinary wood
never goes out, because the record it leans on forgets faster than one fire fills it.

**THE ART PASS IS THE LIVE WORK** (the owner, 18 Nov: redo the art for the sharp screen, colour from their twenty
oil paintings, paint style from the clip, closer to realism with the strokes kept). The measured palette of those
twenty is in `docs/references/README.md`; the five stages and the render-measure loop are in the log. Stage 1 has
not been applied yet.

**THE FULL CHECK ON `main` AT v15: ALL 17 PASSED** (started 02:15, finished 03:27 on 18 November; the log is
`/home/user/.pc-scratch/look/full_v15.log`, read from its own last line). It covers v13's and v14's code as well.
What it cannot check is written at its end: frame rate on a real graphics card, a real mouse under pointer lock, a
real gamepad, how the sound sounds.

**v16 IS BUILT AND GATED BUT NOT YET MERGED** (branch `look-proto`): only one ability bends the trees (the gust), a
third stage of flight to 170 m/s, three cuts to the painter and the world that cost nothing on screen, `?dpr=` and
`?best=1`, and four new speed-test rows that RAISE the load.

**In one line:** `main` is at `v15 (18 Nov)` (5d6cf88; pull requests #4 to #15, #7 onwards opened
and merged by the session on the owner's standing word and their own "merge the powers"). LIVE
BEHIND SWITCHES: the new look (`?look=oil`), THE ELEMENTAL POWERS, WIND (`?powers=1`, seven
abilities), the speed test (`bench=1`, its SEVENTH form, which now HOLDS THE GAME STILL while it
measures), and `fartree=lump` to bring back the old far tree. THE PHONE IS THE MAIN TARGET.
ALL FIVE OF THE OWNER'S ASKS OF 17-18 NOVEMBER ARE NOW IN `main`: the camera's glitch in flight
fixed, an even faster flight, a power's circle grown by holding it (to four times, with the size
in words), the trees leaning the way the wind is sent, and the speed test held still. `look-proto`
equals `main`; `powers` is one merge behind it.

**THE FULL CHECK ON `main` AT v15** (which carries v13's, v14's and v15's code: v13's own run was
cut short by a machine restart and v14's was stopped on purpose so this one would cover both)
was started 02:15 on 18 November. Its log is `/home/user/.pc-scratch/look/full_v15.log` (in the
session's scratch, NOT in the repository): read ITS OWN last line and ITS OWN time before
believing any result from it.

**A BRANCH THAT IS COMMITTED BUT NOT PUSHED IS ONE RESTART FROM GONE.** v15 sat on a local branch
`look-dev` that was never on the remote while the machine restarted twice. It survived by luck.
Push the working branch (`git push origin <local>:look-proto`) the moment a piece of work is
committed, not when it is finished.

**The phone's speed, where it stands** (the log of 2026-11-17 has the tables and the reasoning):
- With the live far trees (lumps) the far trees are HALF THE PHONE'S FRAME (44 ms as set, 23
  without them), and NOT through the paint in their own pixels (laid flat they cost the same).
  The build machine's software drawing said the opposite, twice: IT CANNOT BE TRUSTED FOR WHY
  SOMETHING IS SLOW ON THE PHONE, only the phone's own table can.
- The experimental far tree of flat pieces ran at 36.5 pictures a second against 22.5. It was
  too plain; v10 makes it leafier (a dark core under shingled leaves). NOT YET TIMED on the phone.
- THE SCRIPT (10 ms of the phone's frame) has no single large thing in it: three hundred draw
  calls' bookkeeping, the physics' air, the world. For script time this machine is a fair
  stand-in for the phone (9.2 ms here); the tools are `/home/user/.pc-scratch/look/pw/prof.mjs`,
  `draws.mjs`, `walks.mjs` in the session that made them. One frame at a phone's size: 244 draw
  calls, 900k triangles; the shadow pass is 55 of the calls and 323k of the triangles.
- WAITED FOR FROM THE OWNER: one table of SPEED TEST 6 (`?look=oil&bench=1`, label v11): its
  rows split the far trees' cost (shadow pass or picture, drawn first or last) and time the two
  far trees in the same run; and their eye on `?look=oil&fartree=cards`. Then: either the leafy
  far tree becomes the phone's look (the owner's call), or the lump's real cost is found and cut.

**WHAT THE OWNER HAS BEEN ASKED AND HAS NOT YET ANSWERED (as of 2026-11-18, 02:00):**
1. ONE TABLE OF SPEED TEST 7 FROM THE PHONE, the first that can be believed (`?look=oil&bench=1`,
   label v15): it holds the explorer, the view and the clock still and says "held still" in its
   header. Until such a table exists NO ROW of the three earlier tables can be used, and the two
   far trees cannot be told apart. Read rows 2 to 9 (the far trees) and 16 to 18 (the shadows).
2. THEIR EYE ON THE FAR DISTANCE: v13 made the leafy far tree the look. Does the wood across the
   river read better or worse than before? (`?fartree=lump` shows the old one; one line to undo.)
3. HOW THE WIND LOOKS, FEELS AND SOUNDS IN THE HAND on the phone. Still nobody's eye but stills:
   whether the white strokes of air are too bold; the gathered ball (the weakest in stills); the
   sounds (never heard); and now whether HOLDING a power to grow its circle feels right, and
   whether the faster flight (78 m/s at full surge) is the right speed.
4. The forest's floor: A (live) or B (`?floor=calm`, which IS on `main` as of v15: checked
   2026-11-18 in `src/data/mode.js` and `src/data/looks/earth.js`, so the two can be compared on
   the owner's own phone by adding `&floor=calm` to the address).
5. The three riskiest parts of the code (listed for them on 2026-11-16): they said "don't fix them
   yet, wait for my go-ahead". Still waiting.
GIVE THE OWNER LINKS AS PLAIN ADDRESSES ON THEIR OWN LINES (inside code marks a phone may not
let one tap them: they had to ask again).

**THE ELEMENTAL POWERS (section 2, items 42 and 47): MERGED INTO `main` (v12), behind
`?powers=1`.** Wind was built on 2026-11-17 and merged the same day at the owner's word. The
owner has NOT YET PLAYED IT: their first words about how it looks and feels on the phone decide
what is refined next. Water, earth and fire are only described (no code: item 42).
- Read first: `docs/POWERS.md` ON BRANCH `powers` (the design note for the whole system; wind as
  built, how it is seen and heard, what is not built; the plans and costs for "move water" and
  "wind knife"), then the log's sections of 2026-11-17 on the powers ("CHOICES MADE FOR THE
  OWNER", fourteen of them: the owner has not yet read or answered them).
- BUILT AND SEEN IN STILLS, ALL SIX OF THE OWNER'S LIST: a. gust, b. gather and carry, c. wind
  control (quicken; still), d. tornado ("whirl"), e. move water ("part": hold and the water
  parts along the way the explorer looks; they walk the bed), f. the wind knife ("knife": the
  first tree along the aim is cut, falls to its own side and stays felled, also in the saved
  game). Seven abilities on keys 1 to 7 and on the touch fan (a column of words beside the
  button). A ring on the ground shows where a power will act before it is cast; a stilled
  place is seen to fall still; the screen says when an ability can do nothing here.
- Before the merge: the full check passed on the branch (17 of 17) and, without the flag, it
  drew what `main` drew (the default game: 0 pixels differ in six scenes). The full check on
  `main` after the merge is recorded in the log's last entry on v12.
- THE LESSON OF TWO FAULTS FOUND LATE (a dead touch button; a whirl breaking the physics among
  real dust devils): stills made by calling the powers' code prove the picture, not the hand.
  Anything the owner will touch is pressed here with real touch events first:
  `/home/user/.pc-scratch/look/pw/touchshot.mjs` in the session that made it (a browser with a
  touch screen, 823 x 384; `QUERY='stub=render,world,art&powers=1...'` opens in six seconds for
  the mechanics, the painted page in four minutes for the picture).
- What exists there: `src/physics/powers.js` (the explorer's wind as a short list of shapes: a
  jet, a zone, an orb, a vortex) taken by the air at a point, the plants' field, the loose things
  and the rain and snow through the door the dust devils use; `src/core/powers.js` (the hands,
  the aim, seven abilities: gust, gather, quicken, still, whirl, part, knife; a sound for each cast);
  `src/ui/powers.js` (the touch button and its fan); the explorer's cast gesture; the wind drawn
  as white strokes of air (`src/physics/three/expand.js`, option `wisp`; `src/physics/loose.js`
  `_wisps`); tests `src/physics/powers.test.mjs` (12), `src/physics/kits.test.mjs` (one for the
  stroke) and `tests/powers.test.mjs` (5).
- NOT KNOWN: how it looks in motion, how it feels on the phone, how it sounds. The gathered ball
  is the weakest in the picture. Only the owner's phone can say.
- THE CHOICES MADE FOR THE OWNER while they were away (twenty-seven, numbered in the log's
  entries of 2026-11-17 on the powers) have not been read back to them one by one: each can be
  changed in a line when they say what they do not like.
- The address: the game's own with `?look=oil&powers=1` (or `?powers=1` alone for the
  watercolour game).
- The stills script is `/home/user/.pc-scratch/look/pw/run5.sh` in the session that made it (not
  in the repository): it opens the game page with the lab, casts through `window.__pc.sim.powers`
  (`pick(i)`, `down = true`), steps the game and takes stills.

**What the phone has taught** (the log has the three tables and the reasoning):
- Its own settings drew the look tiny and the controller shrank it further: cured in #6 (the
  picture is not drawn small in the oil look; a phone is asked for 30 pictures a second).
- Twice the owner judged an OLD version minutes after merging (the site takes some minutes to
  renew): the version is now on the screen (`src/core/build.js`, `build.txt`: CHANGE BOTH with
  every pull request) and a stale page reloads itself.
- A phone slows as it warms: only the speed test's first rows compare; its third form repeats
  the first row at the end.
- Where the time goes at 1028 x 480: plants' paint 23 ms, script 11 ms, ground's paint 3 ms.

**The owner's machines:** the phone is a Samsung Galaxy S23 Ultra (Adreno 740): 26 pictures a
second in the wood at 1028 x 480 (v6). The computer is a Lenovo with 8 GB of memory and an Intel
UHD built-in chip (12th generation): 8.7 a second at the desktop's settings (v6), its script's
own time 25 ms a frame. THE PHONE IS THE STRONGER MACHINE. Standing instruction 17 ("the desktop
sets the look") was given before either was known; this has been put to the owner and is theirs
to settle. Since v8 the oil look gives such a computer the preset `laptop` (the log).

**What is waited for from the owner:**
1. (Done: v8 is live.)
2. With the label at the bottom of the screen saying `v8`, the THIRD speed
   table (`?look=oil&bench=1&body=earth&time=15.4`) and how it looks and plays.
3. Their go-ahead before any of the three riskiest parts of the code is touched (below).

**What the third table decides:** "plants one flat colour" against "as set" is what the bark and
the far crowns still cost per pixel (the leaves no longer do). If it is still large: the bark's
streaks and the far crowns need the same cure or one layer of strokes on phones. If the frame is
near the script's own time (11 ms): the script is next (the painter's draw calls, the physics).
If the phone has room to spare: a larger picture on phones, or a sharp enlargement in the last
pass (the screen is three times the picture's size each way).

**Where new work goes:** built on the local branch `look-dev` (work tree `/home/user/pc-dev`,
lost with the container), pushed on `look-proto`. LESSONS KEPT: (1) before a pull request into
`main`, prove that the watercolour game is unchanged BY PICTURES, not by reading the diff; (2)
judge a change for the phone AT THE PHONE'S OWN SETTINGS (`preset=phone`, a window of 823 x 384);
(3) ask the device before cutting: the speed test's flat rows found in one run what two rounds
of guessing had missed.

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
1. Whether to open the pull request; then the phone's third table and their eye (above).
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
| `main` | **Live.** At `288493c`: the new look behind `?look=oil`, version v8 (PR #4 to #6 merged by the owner 2026-11-16, PR #7 by the session 2026-11-17), on top of `5e85754`: release 1, merged as `f551198` (PR #2): sharp ground from the ship at the top tier, touch controls, a phone preset; plus `CLAUDE.md` (PR #3, merged). Before that, M4's whole game (PR #1, `be90864`). |
| `cosmos` | Frozen at `3e46e80`: release 1's code, the same as `main`. Do not work on it. |
| `look-proto` | **Where new look work is pushed.** The same commit as `main` since the merge of PR #7 (2026-11-17); anything pushed here later is not live until a new pull request is merged (which the session may now do itself: section 2, item 41). |
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
