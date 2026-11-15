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
   - A grey cloak in place of the cream coat and red scarf. It moves with the wind and the run
     (PHYSICS already gives `relWind`, lean, gale crouch and so on in the figure's state) and
     covers the jetpack, with the jets under the hem.
   - A lantern at the hip, dark by day, flickering on at dusk and off at dawn.
   - The lantern's warm pool of light is painted into the ground's and plants' shading, not a
     real three.js light (too costly).
   - Optionally the hood goes up in snow and storms (not yet confirmed by the owner).
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

## 3. State right now (update this before you stop)

Last updated 2026-11-15 (11:20 UTC) by the coordinator on the second account, which took over
from the first. Everything is still paused: nothing is running, the working tree is clean, and
everything is pushed. This session has read the handover and run nothing (no checks either).

**The references have arrived and are sorted** (`docs/references/README.md`, and the log's last
section). The main finding: the clip's strokes are painted on the world's surfaces, not laid
over the picture as a filter, and its look rests first on light and colour. So the prototype
brief in section 4a (a filter in `post.js`) is **under review and not to be built as written**.

**Waiting on the owner (section 2, items 10 and 13):** which of the coordinator's calls they
disagree with (the method, the cloak's colour, shelters or none). Then the coordinator reads the
rendering code, without changing it, and writes a one-page plan for the owner's go. Nothing
starts before that. The owner plays mostly on a phone, then on a desktop: the phone is the test
device from the first prototype on.

**Agreed in principle by the owner ("we should do it right?"), not yet the word to start (see
the log's last three sections). Next: the references and the owner's device, then a one-page
plan for the owner's go:**
- Models: no mixing (it would save a few per cent at most). Everything that writes or judges
  the game runs on the top model at extra-high effort.
- Set-up, with no workflow: the coordinator builds the main line itself, one piece at a time.
  Single agents are added only where they buy quality: two or three truly different ways of
  making the paint look, as stills for the owner to pick; an independent critic that compares
  every set of stills with the references; an independent verifier after each finished piece.
- Three changes to section 4a that the coordinator put to the owner: judge the look in motion on
  the owner's phone through a private preview, not only in stills; take one or two scenes all
  the way instead of a thin filter over five; and set the order of the look and release 2's
  phone work by the device the owner mostly plays on (asked, not yet answered).

| Branch | What it holds |
| --- | --- |
| `main` | **Live.** At `5e85754`: release 1, merged as `f551198` (PR #2): sharp ground from the ship at the top tier, touch controls, a phone preset; plus `CLAUDE.md` (PR #3, merged). Before that, M4's whole game (PR #1, `be90864`). |
| `cosmos` | Frozen at `3e46e80`: release 1's code, the same as `main`. Do not work on it. |
| `r2` | **The working branch.** Release 1, the logs, this file, `tools/workflows/`, and release 2's half-done work as "WIP snapshot" commits only. No release-2 item was finished or verified. On a clean export of `r2`: world tests 56 pass and 1 fail ("MSAA belongs to the tier..."), unit 259, physics 325. |

**Waiting, in the owner's order:**

1. **The prototype of the new look and the new explorer** (section 2, items 5 and 6). The owner
   chose "start the prototype", then paused before it began. Nothing has been done.
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

### 4a. The prototype (about 3-5 hours; nothing goes live)

**Under review since 2026-11-15 (see section 3): do not build this as written.**

**Branch.** Cut a new branch `style-proto` from `main`. `r2`'s half-done code is unverified, so
the stills must compare against the live look. All of it sits behind a URL switch (`?paint=oil`;
`?paint=clean` for no paint pass). The default look stays unchanged.

**Owner: PAINTER.**

**The oil-paint pass** (`src/render/post.js` and friends):
- Edge-following brush strokes, for example an anisotropic Kuwahara filter steered by the
  structure tensor, plus a subtle canvas or impasto texture lit from the sun's side.
- **The stroke size is a fixed small number of pixels. Never let it grow with distance:** that
  was the cause of the blur the owner complained about (see the plan and release 1).
- A richer grade: deeper shadows, warm/cool contrast, saturated autumn golds and night blues.
- Screen-space light shafts from a low sun.
- Canvas in place of paper and the torn border.

**The explorer** (`src/art/models.js`):
- No hat; the grey cloak and the hip lantern (section 2.6).
- The night switch from the world's clock (`Ephemeris.sunHour` and the night key).
- The lantern's pool as uniforms in the terrain and plant materials.

**The stills,** side by side with today's look, at the top tier, 1280x720:
- the Earth forest by day (and an autumn wood);
- a Mars canyon;
- a snowy night with an aurora and the lantern lit (Neptune's aurora_tundra, or Earth's alpine
  meadow at night);
- from the ship at 150 m and 1 km over Earth's forest;
- the explorer close up, by day and by night, standing and running.

**Checks:**
- `tests/stations.mjs` (quick set at q2): the ground from the ship is at least as sharp as
  release 1's (final land t1/t2 about 1.0 at 150 m and 1 km).
- No console error; the unit suites green.

**Stop and show the owner.** Copy the stills to the session's scratchpad and send them. The
full version follows only on approval:
- every world tuned;
- the switch in the game's settings;
- phone performance;
- then merge with release 2.

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
