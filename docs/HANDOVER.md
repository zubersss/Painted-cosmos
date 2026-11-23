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

52. **The phone's table of 18 November, speed test 8, is the first one that measures anything**
    (the owner pasted it as text; every earlier table either hit the 60-a-second cap or drifted).
    S23 Ultra, Adreno 740, picture 1028 x 480 of a 3086 x 1440 screen, tier 1, the lighter paint,
    250 calls, 902k triangles, script 7.1 to 14.6 ms. The five "as set" rows read 32.9, 34.0, 32.9,
    34.0, 34.0: **the wood runs at 30 a second and nothing is capped.**
    - **All the trees are half the frame: 16.2 ms of 33.** Of that, **the PLANTS' PAINT alone is
      11.7 ms** - every leaf and branch still drawn, just painted one flat colour. That is the one
      biggest thing in the frame and the next place the work goes.
    - Far trees 10.3 ms; near trees 6.7; small plants 2.3; the full paint +4.0. **Shadows, all of
      them, cost 0.2 ms - they are free, and could be made BETTER for nothing.**
    - **Drawing the far trees LAST is -1.2 ms, free** (drawn first is +2.3). Applied.
    - The old lump far trees would be **+6.9 ms**: the leafy far tree is settled on a real device.
    - Sharpness: as it is 33 ms; half again as sharp 55 (18 a second); twice 92 (11); **every pixel
      of the screen 161 ms = 6.2 a second.** Fitting those: about **18 ms fixed** (script and
      geometry) **plus about 16 ms for each picture's worth of pixels**. SO THE WHOLE SCREEN IS NOT
      REACHABLE AT THIS LOOK; the honest target is HALF AGAIN AS SHARP AT 30 A SECOND, which needs
      the per-pixel cost roughly halved.
    - Measured beside it with `tools/overdraw.mjs` at the same picture size: **a pixel is painted
      6.49 times over**; the far trees 2.10 of that with a self-lap of 9.94 (104,362 pixels covered,
      1,036,911 fragments painted into them, 17,249 on top at the end).
    - CAUTION: this run's view has 902k triangles where speed test 7's had 501k - a denser spot in
      the wood. The two tables are NOT the same picture and must not be read against each other.

53. **What the player breaks must grow back, and the world must be there before a fast flight
    arrives (2026-11-18).** "Also make sure that felled woods or burnt areas eventually do return
    to normal so it isn't taking up memory make and fix the loading in when your flying I want
    things to be there before you get there even if your flying fast."
    - The three records of damage (`data/felled.js`, `data/burnt.js`, `data/stripped.js`) are
      bounded only by a CAP today, and forget the oldest mark when full. They must HEAL: a scorch
      fades, a felled tree stands again, a bare crown comes back into leaf, after enough time.
      That is what the owner asked for and it bounds the memory by time as well as by count.
    - A tree coming back is SEEN, so it must not pop: it comes back the way it went.
    - Flying at 170 m/s outruns what the world builds. Build for where the ship WILL be, and let
      it build harder while it is moving fast.

54. **"It looks like spiders not trees" (2026-11-19).** "Also fix the branches it looks like
    spiders not trees go over the references for the branches as well." The branch work of 18 Nov
    went the wrong way. What the references say, gathered in `docs/references/README.md`: a tree
    is ONE HEAVY STEM that FORKS LOW into a FEW WIDE BOUGHS ("forked low", "boughs reaching wide",
    "a heavy dark stem", "a thick trunk in long flowing strokes"), each TAPERING and dividing
    again into finer twigs that END IN A HAZE - a HIERARCHY OF WIDTHS, the same rule written for
    the rivers ("one wide river, thin tributaries, thinner twigs that end"). A spider is many
    limbs of ONE width radiating evenly from a point, not tapering, each ending as a stick.

- **2026-11-19, the trees:** "Also fix the branches it looks like spiders not trees go over the references for the branches as well"; then "Can't you just sketch over the reference photos? To get it the best?"; then, having sent twenty reference pictures made with ChatGPT, "Actually just use it as a reference show me 10 different looks of the trees and ill pick 5 to plant in the world". Ten looks were drawn (`docs/shots/trees/ten_looks.png`, built by `tools/treevariants.mjs` on `look-proto`) and the owner is choosing five. The five chosen become real kits in `src/world/kits/`; the other five cost nothing because none of them is a module the game loads.

- **2026-11-19, the six trees and the seasons:** "Yes do 12374 and the widow 6 but refine them a little better and make sure the leaves change colors from summer to autumn for the forest". SIX trees chosen from the sheet (1 round maple, 2 tall poplar, 3 great oak, 4 slender birch, 7 young sapling, 6 weeping willow), to be refined and built as real kits, and the forest's leaves must turn from summer to autumn.

- **2026-11-19, the rest of Earth:** "Keep on working on the look and performance and the rest of earth not just the forests starting with the mountains they should be a special focus". A STANDING direction: the look and the performance together, across all six of Earth's places, and the mountains (`alpine_meadow`) first and foremost. Four of the six have had almost no attention in the oil look.

- **2026-11-19, the fire and everything else:** "Keep working on the fire and give it 5 new abilities that are fire based also make it so that putting on a fire speeds up the fire and also fire tornados can be a thing also really figure out the mechanics of how a fire spreads and starts and how it spreads and how it acts based around different environments and keep working on the rest of the worlds biomed as well every biome should get at least 1 milestone worth of upgrades and same for the graphics and looks of the game that should get 3 milestones worth of upgrades once you've done all and merged it give me the link to try the new benchmark test and one to just try it out". SEVEN asks; several sessions of work. Order: the fire (5 abilities, wind feeds it, fire tornados, a real spread model), then every biome, then three milestones of look. Merge each piece as it is done.

- **2026-11-19, wind and fire together, and the ice worlds:** "Refine the wind and fire abilities even further i want them to be able to interact with each other where wind strengthens the fire and also give the ice planets more places to melt or use my abilities and the sky of the ice planets still needs to be streaky and painted like". Three asks: wind must visibly feed fire (MEASURE whether it already does before building anything); the ice worlds need more ice to melt and more to use the powers on; and their SKY IS STILL NOT STREAKY -- asked before, not done.

- **2026-11-22, the fire must feel violent, and keep at the rest:** with speed test 9 at v27, "Keep working on the
  performance and making further looking things load and look good and also change up the fire animation it doesnt
  feel violent enough". THREE standing things: the performance; **distant things must LOAD and look good**; and the
  fire must read as violent. The v27 table's readable rows say the FAR TREES are the biggest single item in the
  script (3 ms of 9.6, in draw calls and not triangles) and that **the water costs nothing** and **the cheap far
  tree (`?fartree=blob`) buys nothing**. The fire was found, by photographing it for the first time, to be drawn as
  a field of pale straws; see the log for the four faults and their fixes.

- **2026-11-22, the third element is SPACE AND TIME:** "Give it cooler abilities as well the fire and also start
  working on the 3rd ability space and time manipulation give me at least 10 powers for that one and they should
  all be unique and powerful and they should also look really good in the game". NOT water or earth, which
  `docs/POWERS.md` had pencilled in as three and four. Twelve are designed in `docs/POWERS-TIME.md`; eight were
  built at v29 and painted at v30. The fire went from six abilities to nine.

- **2026-11-22, the art is drawn originally:** "Now make the designs for these powers actually look cool make
  sure the art is drawn originally as well unless you can find pre-made stuff then go on ahead". THERE IS NO
  PRE-MADE STUFF AND THERE MUST NOT BE: every mark in this game is made by its own code, there is not one picture
  file in the repository, and CLAUDE.md forbids committing other people's pictures. A STANDING rule for every new
  power: **it is not finished until it has a picture of its own, drawn here.**

- **2026-11-22, A TEN-STEP UPGRADE (ultracode):** "Refine it even further specifically the looks do a 10 step up
  grade using ultracode i want better lighting better physics for the powers and specifically better looks i want
  things to look high quality and fully rendered even from 300 yards away". THREE THINGS: the lighting, the
  physics of the powers, and **the look at 275 metres -- it must read as fully rendered there, not sharpen as you
  walk towards it.** Run as a multi-agent workflow at the owner's word. A STANDING measure it adds: **the test of
  the look is now what a still taken at 275 m shows, not what the near ground shows.**

- **2026-11-22, FOUR space-time powers and not twelve:** "to many space and time abilities cut them down into
  folding space should be one of them but make it a bit more theatrical like the world is getting pulled towards
  you the 4 should be overly powerful abilities like a rip in space time that sucks everything in a long ways in
  but also keep working on the performance and look of the game I want things far away to be loaded in before I
  even get there". Four instructions: (1) cut space and time to FOUR, each OVERLY POWERFUL; (2) folding space
  stays and is made THEATRICAL -- the world is pulled towards you, not a step to where you look; (3) one of the
  four is a RIP IN SPACE-TIME that sucks everything in from a long way; (4) standing: keep at the performance and
  the look, and **the far world is to be loaded before the player gets there**. A STANDING rule it adds for every
  element from now on: **a short list of powers that each feel enormous beats a long list of small ones.**

- **2026-11-22, the freeze and the picker:** "The spacetime powers freeze the game everytime I open it find out
  why and fix it also change the ui for the powers I want it to be simpler to pick stuff and for it to still be
  easy to understand". Both done at v31. The freeze was a table of one function per ability (`AIM_SIZE`) that had
  no entry for NINE of the twenty-one, so those threw inside the frame and the game stopped dead with the last
  picture up. A STANDING rule it leaves: **anything keyed by ability id must be walked by a test over every
  ability of every element** -- `tests/powers.test.mjs` now does, and that is what keeps a tenth new power from
  killing the game. The picker is a PANEL OF WORDS (tiles you read), not a ring of directions, because a ring
  holds seven and space and time has twelve.

- **2026-11-20, top quality and good at a distance:** with speed test 9 at v26, "i want to to look like a top quality
  load with things looking good even from a distance". A STANDING direction about the picture itself. What the table
  actually says: twenty-four of its twenty-nine rows read -0.0 ms because the phone is held at 60 a second by its own
  display, so the test could not hear its own answers; the only rows that cost anything were the sharper ones, and
  from them the frame is **10.4 ms a megapixel plus 8.5 ms that is not the picture at all** (the script: 9.6 ms, 350
  draw calls). THE PICTURE IS 1028 ACROSS ON A SCREEN OF 3086 -- stretched three times, which is most of why it looks
  soft far off. So: give the room to SHARPNESS (the ladder, v27), and buy more of it by cutting the script, not by
  cutting what is drawn. **Do not cut content for speed on this phone until a table says content costs something.**

## 3. State right now (update this before you stop)

Head rewritten 2026-11-18, evening (the morning's text and the v12 text it replaced are in the log).

**`main` IS AT v33 (23 Nov), pull request #33 merged: THE TEN-STEP UPGRADE. THE FAR DISTANCE WAS NOT BEING DRAWN
AT ALL.**
The owner, 23 Nov: *"do a 10 step up grade using ultracode i want better lighting better physics for the powers
and specifically better looks i want things to look high quality and fully rendered even from 300 yards away."*

- **THE FINDING, computed by three readers independently and the reason the picture looked the way it did:** the
  haze fraction reached **1.000 from 250 m out** (2.7 x the distance, Earth's 185 m visibility, a shoulder, six
  bands with a top band of exactly 1.0). Everything the ground, the trees and the water computed past that was
  thrown away and painted one flat colour. **The far distance was not low quality -- it was not drawn.**
- **THE TEN STEPS** are listed in `docs/COORDINATOR.md` under 23 Nov with the switch that turns each one off.
  In short: the air keeps a quarter of the far paint; four values and a terminator; a sky fill and a ground
  bounce; the far floor in masses not confetti; the plants' air matched to the ground's (they had drifted); a far
  crown with a lit and a shaded side; the last pass never softening the oil picture and keeping the far land's
  contrast; the sun's square reaching 160 m instead of 113; every tree drawn in the far band; one air for land
  and sky; ground marks out to 450 m; the rip as a real tear with its own grains; and the aim reaching 300 m
  instead of 30.
- **EVERY STEP HAS AN A AND A B.** `?air=0&bands=6&litcurve=0&bounce=0&masses=0&skyface=0&skyair=0&vista=0&shreach=0&farfill=0&farcell=2&upscale=0`
  is the look exactly as it was at v32. That is how the two pairs of stills were made.
- **SEEN:** two A/B pairs at the same camera and hour. Ten steps, five files of shader text, five different
  agents, **no compile error**; the watercolour game compiles and is untouched.
- **HELD BACK:** the second coarse shadow square to 400 m -- the one change every reader costed as likely to be
  refused on speed. Written down, not built.
- **WHAT IS LEFT, said plainly:** the far trees' RANGE on the phone (the far mesh's fade floor, `flora.js` `fs`)
  still cuts the wood inside the owner's 275 m at the phone's picture size; the near strokes' prefilter in
  `materials.js` is keep-or-throw per pixel, which is what could make the new far ground marks read as pepper;
  the grass's travelling wave is not held by a stopped place (one phase for the whole field); and the autumn
  wood's palette art pass (task 45) was deliberately NOT done in the same round, so the air could be judged
  without the colours moving under it.
- **A RULE THIS LEAVES:** the test of the look is now **what a still taken at 275 m shows**, not what the near
  ground shows.
- **ONE CHECK WAS NOT FINISHED AND THE OWNER WAS TOLD:** Neptune's snowfield in the oil look. The sky's shader is
  ONE program for every world and it compiles (Earth proves that), so the risk there is not a broken picture but
  an ice sky that reads worse -- and `?skyair=0` turns that one step off by itself. The snow world's grab ran for
  over twenty minutes on this software-drawing machine without finishing; it is the first thing to shoot in the
  next session.


**`main` IS AT v32 (22 Nov), pull request #32 merged: SPACE AND TIME IS FOUR OVERLY POWERFUL ABILITIES, AND THE
WORLD IS BUILT AHEAD OF A WALKER.**
The owner, 22 Nov: *"to many space and time abilities cut them down into folding space should be one of them but
make it a bit more theatrical like the world is getting pulled towards you the 4 should be overly powerful
abilities like a rip in space time that sucks everything in a long ways in but also keep working on the
performance and look of the game I want things far away to be loaded in before I even get there."*

- **THE FOUR:** `fold space`, `the rip`, `still the moment`, `the turning year`. Cut with their code: slow,
  haste, unmake, the sun's hand, the knot, and the four never built. **The rule it leaves, for every element: a
  short list of powers that each feel enormous beats a long list of small ones.**
- **THE FOLD** draws the world past you for 0.55 s instead of stepping you (`TIMEPOWERS.foldTime`), with a gust
  from the far end back to your feet so the leaves stream AT you. Held by a test; **not seen in motion.**
- **THE RIP** is a wind source of its own kind (`physics/powers.js` `KIND.rip`): 55 m of reach, 120 held to the
  full, at full strength out to 62 per cent of it, the trees inside half of it pulled over INWARD. **SEEN** over
  the owner's river. Drawn in `world/timefx.js` (the knot's buffer, which the cut freed).
- **STILL THE MOMENT** is 14 m at the smallest and 46 m at the full, where it was 7 and 20, and the radius grows
  WITH the circle instead of stepping only at the very top.
- **THE WALKER'S WORLD:** `LEAD_MIN` was 14 m/s (a flying speed) so on foot there was no look-ahead at all. It is
  1.2 m/s now and the lead is never nearer than 55 m. MEASURED, off and on: 4 m/s, the wood 3 s ahead 44.3 ->
  48.4 cells standing, queue 7.8 -> 1.9; 9 m/s, 42.0 -> 47.9, queue 33.5 -> 17.2; the cost is 3 per cent more
  cells held. `src/world/walk.test.mjs`.
- **A TRAP MENDED AND WORTH KEEPING:** a shader that fails to compile shows `material.program === false`. It is
  NOT a misleading signal, whatever the v30 note says -- it was right both times it was doubted.
- **THE WHOLE GAME DRIVEN AFTER THE MERGE:** every one of the twenty abilities of all three elements cast through
  the real game's own frame in the lab, **0 throws**; the worst single frame is the fold at 19.4 ms of script on
  this software-drawing machine (it carries you a hundred metres and the world builds as it goes), against 5 to
  17 ms for the rest.


**`main` IS AT v31 (22 Nov), pull request #31 merged: THE FREEZE IS MENDED AND THE POWERS ARE PICKED FROM A LIST OF WORDS.**
The owner, 22 Nov: *"The spacetime powers freeze the game everytime I open it find out why and fix it also change
the ui for the powers I want it to be simpler to pick stuff and for it to still be easy to understand."*

- **THE FREEZE, measured and mended.** The aim mark's ring is sized from a table of one function per ability
  (`AIM_SIZE`, `src/core/powers.js`). It had the wind's seven and six of the fire's nine: **nine abilities had no
  entry** -- the fire's meteor, lance and cinders, and all twelve of space and time. With one of them in hand
  `AIM_SIZE[id](d)` threw a TypeError **every frame**, inside `powers.update` -> `sim.frame` -> `game.frame`. The
  frame stopped at that line: the world was never stepped and nothing was painted. And because `main.js tick`
  asks for the next frame BEFORE running this one, there was no fall-over and nothing on the screen -- the game
  just stopped with the last complete picture up, for ever.
- **SEEN AFTER THE FIX, in the real game** (the lab, all 21 abilities of all 3 elements driven through the game's
  own frame): **0 throws**, worst single frame 19.4 ms of script against 8-14 ms for an ordinary frame on this
  software-drawing machine. Nothing in space and time stalls.
- **THE RULE IT LEAVES (standing):** anything keyed by ability id must be walked by a test over EVERY ability of
  EVERY element. `tests/powers.test.mjs` now does that twice over (aimed, tapped, held, held past the ultimate).
- **FOUND BESIDE IT:** held past "ULTIMATE ready", those same nine said "held to its utmost" and **cast nothing**.
  Now an ability with no ultimate of its own is cast in the ordinary way at the greatest size (`Powers.hasUlt`).
  And the sun's hand called `orbits.setSunHour` every frame while held -- 2.16 ms a call here, 130 ms of work for
  every second held; it turns the body's spin instead (`turnBy`, 0.0002 ms).
- **THE PICKER IS A PANEL OF WORDS.** The ring gave each ability its own direction, 30 degrees apart over half the
  screen: that holds SEVEN, and space and time has TWELVE, so five of them came out in the same directions as the
  first five and were reachable by a key and **by nothing at all on a phone**. Now: tiles with the words on them,
  112 by 38 px, up and left of the chip in columns of six. Hold the chip, slide onto the word, let go. A short
  screen takes another COLUMN rather than shrinking the tiles. **SEEN at 390 by 844 in a real browser** (the
  twelve in two columns; the wind's seven in two columns of four).
- **THREE MORE FAULTS MENDED, all seen:** the element key and the pad changed the hand without telling the panel
  (twelve words of the wrong element, picked by position); the word at the foot of the screen read
  `p.element ? 'fire' : 'wind'`, so every space-time power was announced as **fire**; and the element's own tile
  was drawn level with the chip and sat **half off a 390 px phone, on top of the power button**.
- **AND SEEN OVER THE REAL GAME** (the autumn wood at 844 by 390, the thumb holding the chip while the element key
  put space and time in hand): the twelve in two columns, clear of the map and book buttons, the element's tile
  above the power button, the label reading v31. Two faults were caught in that picture and mended: the five
  unplaced tiles above, and the foot of the screen reading "space and time: slow - space and time", because the
  note said on an element swap IS the element's name.
- **WHAT IS LEFT:** nobody has pressed the panel with a FINGER on a real phone. That is the owner's to do, and
  the one thing that can call it done.


**`main` IS AT v30 (22 Nov), pull request #30 merged: THE THIRD ELEMENT IS PAINTED.**
`src/world/timefx.js` draws, all in code:
- **THE BUBBLE** of a slowed, hastened or stopped place: a ball of air with its EDGE PAINTED -- a broad band of
  brush marks with gaps between them, drifting round it. Slow a pale blue; haste a warm gold with the marks
  smeared along the brush's way; **still a cold white with hairline cracks and NO drift at all**. All three SEEN
  over the owner's own river.
- **THE KNOT**: three crossed strokes standing on the ground, pointed at both ends, beating slowly.
**THE FAULT THAT TOOK TWO HOURS, and the rule it leaves.** A translucent thing in this painter is a GLAZE -- and
**a glaze material that is not in the `GLAZES` list is never drawn at all**; even in the list the bubble stayed
invisible. What worked was giving the idea up and laying it in the SCENE pass as MARKS WITH GAPS, the way the
leaves in the air are, because the gaps are what make an edge soft here. **A new translucent thing takes the
leaves' path first and the glaze path only if it must.** (And `?time=` is the gallery's own hour of day: the
bubble's parameter had to be `?bubble=slow|haste|still`.)
**STILL NOT DRAWN of the third element:** the fold's tunnel and the lift of the unmake. The four unbuilt powers
(the door, the drawn eye, the lens, the long mile) are named and say so plainly when cast.


**`main` IS AT v29 (22 Nov), pull request #29 merged: THE THIRD ELEMENT IS SPACE AND TIME.**
The owner, 22 Nov: "Give it cooler abilities as well the fire and also start working on the 3rd ability space and
time manipulation give me at least 10 powers for that one". TWELVE are designed (`docs/POWERS-TIME.md`), EIGHT
are built and do real work; the fire went from six abilities to nine.
- **THE RULE THIS ELEMENT IS DESIGNED BY:** no combat, no way to fail, so a power over time is not a weapon --
  every one of the twelve is a way to LOOK, to TRAVEL or to MEND, and each has a picture nothing else draws.
- **BUILT:** slow, haste, still the moment (`src/physics/times.js`: every loose grain and every patch of fire
  keeps the pace of the PLACE IT IS IN -- a global slow would have been one line and would not have been the
  power); unmake (the records' own healing run through at a place); the turning year; the sun's hand; the knot
  (tie it, pull it from anywhere); the fold (a step to where you look).
- **NAMED, NOT BUILT:** the door, the drawn eye, the lens, the long mile. They say so when cast.
- **NEW FIRES:** meteor (a RING of fire lit at once and a blast of air out of it), lance (a line down the view),
  cinders (sparks let go into the wind, landing where the weather takes them).
- **THE NEXT PIECE OF WORK ON THIS ELEMENT IS THE PICTURES.** The time field runs, but a bubble's RIM, the fold's
  tunnel and the knot's standing light are NOT DRAWN: these eight are felt and not yet seen.
- **TWO TRAPS:** the ability dispatch is BY ID, so two elements may not share one (a test holds it); and NO
  DOUBLE QUOTE in a message passed to `tools/commit.sh` -- it cut this element's own commit message in half, the
  same way a backtick breaks a shader.


**`main` IS AT v28 (22 Nov), pull request #28 merged: THE FIRE IS A FIRE AND NOT A FIELD OF STRAWS.**
The owner, 22 Nov: "change up the fire animation it doesnt feel violent enough". The gallery got a fire of its own
(`?fire=N` with `?physics=1&powers=1&look=oil`) and the fire was photographed for the first time. FOUR FAULTS, all
found by looking and none of them what was expected:
1. **A tongue of fire was drawn as A BLADE OF GRASS** -- every grain of the falling-leaf crowd is laid the same
   width, so a tongue was 8 cm across and 80 cm long. Proved by painting the tongues magenta.
2. **The heart was eating the tongue** -- the white core at full strength on a two-pixel mark made every far flame
   white; widened, it made a crowd of candle flames.
3. **A spark was a straw** -- the share of an ember's flight that is drawn came out over 1 at a phone's size.
4. **A night fire's smoke was pale lavender** -- the day rule that lifts a plume off a dark wood ran at night too.
Then the fire itself: its own ribbon shape, a two-beat whip, a torn tip, a per-patch SURGE, more and harder
tongues, and a FLICKERING LIGHT (it was a steady lamp while the tongues flew). SEEN; how it MOVES is the owner's
to judge.
**And the speed test holds the picture's size** while it asks its questions: a phone's own resize had silently put
it back in the middle of the v27 run, which is why that table's last eight rows all read 16.7 ms.

**WHAT THE v27 TABLE SAYS TO DO NEXT (not started):** the FAR TREES are the biggest single item in the script,
**3 ms of a 9.6 ms frame, in draw calls and not triangles** (28 far-tree meshes of 245 draws, counted in the
gallery). Cut their draw count with fewer, larger far cells. **The water costs NOTHING (+0.0) -- leave it alone.
The cheap far tree `?fartree=blob` buys NOTHING (-0.1) -- do not switch to it.**


**`main` IS AT v27 (20 Nov), pull request #27 merged: THE PICTURE SHARPENS ITSELF TO WHAT THE DEVICE CAN HOLD.**
The owner's v26 table said almost nothing -- 24 of its 29 rows read -0.0 ms, because their phone is held at 60 a
second by its display and the test could not hear its own answers. The four rows that DO say something give the
phone's frame as **10.4 ms a megapixel plus 8.5 ms that is not the picture at all** (the script: 9.6 ms, 350 draw
calls). At the size it draws, 13.6 ms of a 16.7 ms frame: there was about 3 ms of room being thrown away, while
the picture was 1028 across on a screen of 3086.
- **THE LADDER** (core/dynres.js, main.js): a rung is a quarter of a picture pixel to the screen point, taken on
  the canvas and never by stretching. Climbed from full scale and the top tier only, spending ONLY room above
  sixty a second; a rung is the first thing given back and nothing else is shed while one stands. SEEN in the real
  game at 3.75 pixels to the point: 1028x480 -> 1440x672 at two rungs. `?sharpen=N` pins a rung, `?sharpen=0` off.
- **THE SPEED TEST CAN HEAR** (core/bench.js): it now finds out whether the device is held at its refresh (a
  spread in the frame times, and whether fewer pixels help) and, if it is, asks every question at a sharper size
  and says so in the header. Two new rows ask where the draw calls are (the ground is 61 of 245 and the water 39).
- **WAITING ON THE OWNER:** a v27 table (it will now have numbers in it), and their eye on `?sharpen=1`, `2`, `3`
  to say which rung looks right. **Do not cut content for speed on that phone until a table says content costs
  something:** at the size it draws, nothing did.


**`main` IS AT v26 (19 Nov), pull request #26 merged: THE WIND AND THE FIRE ACT ON EACH OTHER, THE ICE WORLDS
ANSWER A CAST, AND THEIR SKY IS PAINTED.** The owner's three asks of 19 Nov, all three done and all three measured.

1. **The wind drives the fire, both ways.** MEASURED FIRST: a real gust DID reach a real fire (131.99 m/s at the
   patches against 1.76 in still air) and the fire was no faster and no bigger for it -- a wind only changed its
   SHAPE, because `windRate`/`backRate` trade one direction against another across a wheel of 24. Three new dials
   (`windMore`, `windSeeds`, `windReach`) make it DRIVE the fire: downwind 18.8 -> 23.0 m, twelve patches sooner.
   And the other half, which the moving wind can never say: HOW MUCH AIR THERE IS TO FEED IT (`ctx.airScaleAt`).
   A STILL smothers a fire, a QUICKEN feeds it -- 21.0 m becomes 35.2 m. On a big fire the plain still (14 m)
   carves a hole and the fire grows round it; the ultimate (56 m) puts the whole thing out.
2. **The ice worlds.** The fault was NOT that there was nowhere to melt: every biome on Uranus, Neptune and Pluto
   is ice or snow underfoot. It was that a fire needs an oxidiser and those skies have none, so `airK <= 0` put
   every patch out on its first step, the MELTING ones with it. A cast on ice in an airless sky went from 0.00
   heat into the ice (dead in one frame) to 7.21 and a hole 8.10 m across. Earth unchanged. THE MELT HAD ALSO
   NEVER BEEN PAINTED -- recorded and saved since 18 Nov, read by no shader -- so it is now in the same uniform
   arrays as the scorches (told apart by the sign of one number: see `pcMarksAt`). A melt now knows what is under
   it, so a snowfield is laid bare and a glacier goes on down. And a gust raises CRYSTALS off bare ice, where
   before it raised a grey puff of dust.
3. **Their sky is laid in brush strokes** (`pcSkyStrokes`, `skyStrokes` in the look data, `?skystroke=` to turn it
   anywhere). 31.3% of the sky's pixels changed against the same frame with it off, by 8.35 of 255 on average.
   SEEN on Pluto and on Uranus.

**WHAT THE OWNER HAS NOT YET SEEN OR TIMED:** none of this has been on their device. Worth asking for: a look at
Pluto and Uranus with `?look=oil` (the sky), and a cast of fire on an ice world with `?powers=1&look=oil`. The
phone has still never timed `&fartree=blob` (v25).


**`main` IS AT v25 (19 Nov), pull request #25 merged: A FAR TREE OF ONE ROUNDED CARD, opt-in as `?fartree=blob`.**
The owner's table says the far trees' cost is TRIANGLES, not paint ("one flat colour" -0.9 ms, "as lumps" -8.7 ms),
so the far tree is now ONE ROUNDED CARD crossed twice, painted by the look's own dab shader, with spherical normals
to round it and a six-cornered outline so it is a crown and not a square. MEASURED on foot: triangles -90%,
fragments -43%, self-lap 9.96 -> 5.87, and the wood still covers the same pixels. Whole frame -20% / -14%.
**THE PHONE HAS NOT TIMED IT: ask for speed test 9 with `&fartree=blob` added.** Four other things were tried
today and measured as losses; they are in the log for 19 Nov with their numbers, and none should be tried again.

**`main` IS AT v24 (19 Nov), pull request #24 merged.** The owner refused shortening the far trees' reach ("No I
dont like that find another way around it"), so the wood stays as deep. KEPT: plants no longer ask for
alphaToCoverage where there is no multisampling (the phone has none) -- the picture is identical, 0.00% of pixels,
and whether it buys time only the phone knows. THROWN AWAY: thinning the far trees WITHOUT growing what is kept --
triangles -47% but fragments +62% and self-lap 9.96 -> 15.18, **because the far tree's DARK CORE has the HIGHEST
sort key and is dropped LAST**, so thinning keeps the big mark and drops the small ones. **Do not try thinning the
far tier again under the present sort: that is twice.** The way in is to drop the core FIRST.

**`main` IS AT v23 (19 Nov), pull request #23 merged: THE SPEED TEST TELLS THE TRUTH NOW.** The v22 table was not
readable -- four rows were timed while NOTHING WAS BEING DRAWN and none was marked, because the test only asked
whether frames were steady and an empty scene is the steadiest of all. Its baselines disagreed threefold. It also
was not comparable with v21's: the phone was held the other way round and the sun was not out. **So it is still
UNKNOWN whether v22's 30% triangle cut helps the phone, and the next thing to ask for is ONE clean run at v23,
landscape, sun out.** The test now marks NOTHING DRAWN, waits forty seconds for a wood to build, quotes a header
row that was really drawing, and prints a warning when its own baselines disagree.

**`main` IS AT v22 (19 Nov), pull request #22 merged: THE TREES COST WHAT THEY USED TO AGAIN.** The owner's phone
said 22 a second at v21 and 60 with no trees at all. It was my regression from v19, and the cause was NOT what it
looked like: the middle tier's WOOD, not its leaves (the old maple drew 84 triangles of wood there, this grammar
652 and the poplar 1492). The middle tier is now a stem and its first boughs and nothing else. MEASURED in the oil
look on the same scenes: **943,393 -> 664,781 triangles standing in the wood, a 30% cut**, and unchanged from 150 m
up where everything is already the far tier. **THE PHONE HAS NOT SAID whether it is enough -- ask for speed test 9
again.** If it is not, the owner's own table names the next lever and it is not geometry: rows 11 and 12 are -13.5
ms each and they are the plants' PAINT.

**`main` IS AT v21 (19 Nov), pull request #21 merged: THE FIRE'S REAL MECHANICS AND FIVE NEW ABILITIES.**
ember, bellows, wall of fire, snuff, fire whirl. The fire now RUNS UPHILL (doubling every ten degrees), NEEDS AN
OXIDISER (only Earth has one), THROWS EMBERS 4.5x downwind over any firebreak, and RAISES ITS OWN WHIRL where enough
of it burns together in a light wind. "Putting air on a fire speeds it up" is bellows, and it is done by making real
wind the fire already reads, not by a number. docs/POWERS.md has the table and what is NOT done. Suites on the
merged tree: unit 306, physics 385, world and kits and season 108. All six abilities CAST IN THE RUNNING GAME.
**STILL OWED on that instruction: every biome a milestone, and three milestones of look.** Three Earth biomes are
looked at and their faults named in the log for 19 Nov; none is mended. And a NEGATIVE RESULT is recorded there that
will save the next session a day: the ground's `graze` rule is NOT why steep faces look coarse -- measured twice,
2.6% on the canyon -- and the stroke direction is the place to look instead.

**`main` IS AT v20 (19 Nov), pull request #20 merged: THE FIRST PASS AT THE MOUNTAINS.** `alpine_meadow` had no oil
block at all and has one now (so the watercolour game is untouched): peaks about twice as high with closer ridges,
raw umber and neutral tint instead of a thinned cobalt blue, a snowline that sits ON the new peaks, and strata.
MEASURED: tone spread 37.1 -> 54.7 on the lower slopes; a stroke 3.5 -> 4.9 px, the one number that went the wrong
way. **THE MOUNTAINS' COST IS NOT MEASURED -- the station harness has no alpine station. Add one first thing**, so
the look and the cost of a place are measured in the same run, which is what the owner's instruction asks for. The
log for 19 Nov has the two lessons of this pass and the `graze` finding left deliberately unmended.

**`main` IS AT v19 (19 Nov), pull request #19 merged.** It carries THE OWNER'S SIX TREES and THE TURN OF THE YEAR.
`src/world/kits/grove.js` is one grammar with six rows of numbers -- round maple, tall poplar, great oak, slender
birch, weeping willow, young sapling -- chosen by the owner off a sheet of ten. They stand in the autumn wood in
deliberate PAIRS (the placer reads a biome's list two at a time): maple with spruce, oak with sapling, birch with
poplar. The willow stands in the misty wetland instead, by water, because it costs half as much again to draw.
`src/data/season.js` turns the year: a leaf's colour was already a uniform, so summer to autumn is three vectors
written per material when the season moves and NOT ONE INSTRUCTION MORE IN ANY SHADER. `?season=0` to `?season=1`;
`?year=` sets how long a turn takes (720 s by default), `?year=0` stops it. All of it is behind `LOOK.oil`.
GATE: see the log for 19 Nov -- it does NOT say "0 pixels" and the reason matters. `tests/capture.mjs` IS NOT
REPEATABLE (the same code captured twice differs by 22 KB); the gate was run on `tests/stations.mjs --set quick`,
which holds the loop, and two runs of identical code differ by MORE than main differs from the branch. Suites on the
merged tree: unit 301, world and kits and season 108, physics 376. **THE FULL 17-STEP CHECK HAS NOT BEEN RUN**
(nor was it on v18).

**`main` IS AT v18 (18 Nov), pull request #18 merged.** It carries THE FIRE AND ITS ULTIMATE, the
four kinds of tree really standing, the far wood's leaves back, the sky's cloud form, a wood that
grows back, the world there before a fast flight, speed test 9 and the twelve faults the
six-dimension review found. GATE: the live watercolour game 0 pixels different of 518,400 in all
six scenes; the oil look 431k-443k changed in three; the page boots clean; speed test 9 ran all 27
rows (the first compile of the three new shader switches). Suites on the merged tree: unit 301,
world and kits 82, physics 376. **THE FULL CHECK ON v18 HAS NOT BEEN RUN.**

(The paragraph below is kept for the history of how main stood before #18.)

**`main` WAS AT v16 (18 Nov) PLUS PULL REQUEST #17** (the speed test's copy button). THE LABEL ON THE
SCREEN STILL SAYS v16 because #17 did not bump it: bump `src/core/build.js` AND `build.txt` with
EVERY merge, including the small ones. The owner has the live speed test at
`https://zubersss.github.io/Painted-cosmos/?look=oil&bench=1` and has already sent its table back.

**`look-proto` CARRIES v18-TO-BE: 25 commits, NOT YET GATED AND NOT MERGED.** What is on it:
- THE FIRE, wired and mended. It says in plain words why it will not take (`fuelAt` hands back a
  `why`, carried onto the patch and said on screen), a spark FALLS SHORT along the aim onto the
  first ground that will burn, fire has an ULTIMATE, and a burnt wood survives a reload.
  **THE FIRE BURNS IN THE RUNNING GAME** (18 Nov, evening, the real page in the test browser, the
  real keys): G put the fire in the hand ("in hand: kindle, element 1"); the world answered heading
  by heading and FOUR OF TWELVE DIRECTIONS FROM THE SPAWN ARE THE RIVER (30, 60, 120, 150 deg all
  "water"), which is exactly what was eating the morning's casts; facing 240 (fuel 1.00) one press
  of the cast key caught and the screen said nothing, i.e. complained of nothing. Then:
      3 s after lighting:  2 patches,  21 strokes of flame,  8 of ember, 36 of smoke
      8 s after lighting: 12 patches, 113 strokes of flame,  2 of ember, 117 of smoke
  **AND IT HAS BEEN SEEN**: `docs/shots/fire/fire_burning_close.jpg`. Four burning patches on the
  riverbank eight seconds after one press, the ground charred black behind the flames, embers in
  the grass. THE TRAP THAT COST AN HOUR: the aim is 6 m out looking steeply down and 30 m looking
  level, so a fire cast from a level view lands 25 m away and is 505 PIXELS OF A 518,400-PIXEL
  PICTURE -- a tenth of one per cent. It was drawn the whole time. MEASURE A THING BEFORE
  CONCLUDING IT IS MISSING: with the fire and without it, the canvas differed by exactly those 505
  pixels, which settled in two readings what two stills could not.
  The same run proved the SPARK FALLING SHORT in the real game without staging it: the ground the
  view pointed at came back `kind 0, fuel 0.00` and the fire took anyway, 6.0 m away.
  (MACHINE FACT WORTH KEEPING: stepping the held game 90 frames costs 28 SECONDS here; ONE picture
  cost 34 minutes once and 12 another time, and READING THE CANVAS FROM INSIDE THE PAGE IS NO
  CHEAPER -- 24 minutes -- because the cost is the pixel readback itself, not the screenshot tool.
  The browser is not slow at playing the game; it is slow at handing back pixels. Plan a render
  round the READBACKS: budget one or two, not six.)
- THE FOUR NEW TREES really standing (all four now, not two), the far wood with its leaves back,
  the sky with cloud form and nothing but the sun left paper white, the fire's own art and the
  light it throws, the ring picker reading the list in the hand with a thumb's route to the
  element, `tools/overdraw.mjs`, and the twelve faults the six-dimension review found.
- THREE SUITES GREEN on it: unit 299, world and kits 82, physics 376.

**THE SIX-DIMENSION REVIEW OF 18 NOVEMBER IS THE MOST IMPORTANT THING IN THIS FILE.** Twelve
agents read the then-nineteen unmerged commits and tried to refute each other; **six merge-blockers
and six more faults, and NOT ONE FINDING WAS REFUTED.** All twelve are fixed. The log has every
one with its measurement. THE LESSON: an agent's own measurement is a draft, and nothing built
here has yet survived an independent reading. Run that review before every merge of this size.

**BOTH OF THE OWNER'S ASKS OF THE EVENING ARE BUILT AND MEASURED** (section 2 item 53):
- THE WOOD GROWS BACK. A felled tree stands again after 420 s of play, a scorch and a burnt crown
  after 600, melted ice fills in over 240, a stripped crown refills over 240 - each only once the
  explorer is more than 160 m away (200 for a burn), or after twice the wait if they stay to watch.
  The record is DROPPED when the thing is whole, so every list is bounded by time as well as by
  count. Measured with all three records FULL and nothing yet old enough: 22.2 microseconds a
  frame; with them empty, which is every frame of an ordinary game, 38.5 ns.
  (`stripStep` had been written with its record and CALLED BY NOTHING: a bare crown stayed bare for
  ever. Found while wiring this.)
- THE WORLD ARRIVES FIRST. The ground and the trees are built for a point a few seconds ahead of
  the eye as well as for the eye. MEASURED with `src/world/rush.test.mjs`, PC_LEAD=0 against the
  new default: at 170 m/s the thinnest moment of a flight goes from 195 to 228 patches of a
  237-patch settled world (82 per cent to 96). THE COST: the world holds more ground while flying
  fast (mean 212 -> 271 patches), which is more to draw and to keep; only over 14 m/s.
  `?lead=0` is the world as it was. A slice multiplier was tried and TAKEN OUT: the world's own
  budget test caught it spending 12.4 ms in a frame meant for 5.

**THE PHONE IS AT 30 A SECOND IN THE WOOD AND NOTHING IS CAPPED** (speed test 8, section 2 item
52). All the trees are half the frame; the PLANTS' PAINT ALONE IS 11.7 ms of 33. The whole
3086 x 1440 screen is 161 ms = 6 a second and is NOT REACHABLE at this look: the honest target is
half again as sharp at 30 a second, which needs the per-pixel cost roughly halved. That is the
next piece of work, and only the device can say where it goes.

**ON `look-proto`, NOT YET MERGED (18 Nov, after v16):** the art pass's first changes - the far air leans blue
(measured onto the references' own numbers), a shoulder so nothing clips to paper white, the resolution
controller's cut taken off the canvas instead of stretching, and FOUR NEW KINDS OF TREE in the autumn wood (a
broad maple, a spruce, an aspen stand, a tall pine) with branches that fork and show through the crown. All seen
in rendered stills. Not gated, not merged.

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
