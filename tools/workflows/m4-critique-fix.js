export const meta = {
  name: 'm4-critique-fix',
  description: 'Milestone 4: finish the critique swap, fix round per role, adversarial verification, re-fix, integration run and a blind new-player play-test',
  phases: [
    { title: 'Critique', detail: 'PILOT and PAINTER finish their critiques of the other domains' },
    { title: 'Fix', detail: 'one fixer per role on its FIX FOR SHIP items, own paths only' },
    { title: 'Verify', detail: 'an independent, adversarial verifier per role on clean exports' },
    { title: 'Re-fix', detail: 'what failed verification goes back to the role' },
    { title: 'Play-test', detail: 'every check on the final head, and a blind new player' },
  ],
}

const CTX = [
  'PROJECT: Painted Cosmos, /home/user/painted-cosmos, git branch cosmos. A calm single-player browser exploration game that must look like "a watercolour landscape painting come to life": walk, jetpack, board a ship, fly seamlessly to every planet, land, explore; vistas and a sketchbook; no combat, no fail state. Three.js vendored, plain ES modules, no build step. The owner\'s brief is docs/BRIEF.md (section 2 is the art bible; read "Done means" and M4). The coordinator\'s log and rulings are in docs/COORDINATOR.md (read its last four sections).',
  'ROLES AND OWNERSHIP: PAINTER owns art, worlds, rendering (src/render, src/world, src/art, src/data/looks, docs/notes/painter.md, docs/shots/painter, docs/lead/CRITIQUE-PAINTER.md) and has the last word on look. PILOT owns systems, play, UI (index.html, src/main.js, src/core, src/player, src/ship, src/space, src/ui, src/audio, tests, README.md, docs/notes/pilot.md, docs/lead except the other critics\' files) and has the last word on feel, performance and architecture; PILOT is lead developer. PHYSICS owns physical behaviour (src/physics, docs/notes/physics.md, docs/shots/physics, docs/lead/CRITIQUE-PHYSICS.md). You act in ONE role, named below. Edit only that role\'s paths. For another role\'s files write the exact change in your role\'s notes file. Commit only with: tools/commit.sh <role> "message" (it commits only that role\'s paths and pushes; no model names in messages). The coordinator sometimes sweeps uncommitted files into "WIP snapshot" commits; if yours were swept, say so in your next commit message.',
  'THE MACHINE: 4 CPUs, no GPU: headless Chromium (pre-installed Playwright; tools/shot.mjs and tests/browser.mjs are the project\'s helpers) renders WebGL on the CPU, so a top-tier frame takes seconds. Other agents work beside you. At most ONE browser of yours at a time. Kill processes only by PID, never by name. Play at quality 0 and small sizes; take top-tier frames (quality 2, 960x540) only for frames you judge. Work, export and write scratch files ONLY under /home/user/.pc-scratch/<your role>/m4/ (never the session scratchpad under /tmp). A clean copy of the last commit: tools/export-head.sh <dir>. Never re-sync a tree a running browser is serving.',
  'CHECKS (on a clean export, before every commit of code): node --test src/world/*.test.mjs (19 pass at the start), node --test tests/*.test.mjs (152), node --test src/physics/ (308); node src/physics/coast.mjs says PASS at both stands; node docs/lead/evidence/review7/ghostfield.mjs is all zeros. The game must load with no console error and window.__pc.info().fallback empty.',
  'RULES: Work autonomously; never ask the owner or the coordinator a question; when something is ambiguous choose what best serves "a watercolour landscape painting come to life" and log the choice in your notes. Do NOT open a pull request. Never claim a picture looks right unless you opened it; never claim a run passed unless you ran it; state plainly what you did not verify. Do not use or look for the owner\'s other projects or past chats.',
].join('\n\n')

const CRITIQUE_SCHEMA = {
  type: 'object',
  properties: {
    file: { type: 'string' },
    commit: { type: 'string' },
    played: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          owner: { type: 'string', enum: ['PILOT', 'PAINTER', 'PHYSICS'] },
          rank: { type: 'integer' },
          title: { type: 'string' },
          detail: { type: 'string' },
          evidence: { type: 'string' },
          suggestion: { type: 'string' },
          fixForShip: { type: 'boolean' },
        },
        required: ['owner', 'rank', 'title', 'detail', 'fixForShip'],
      },
    },
    ownSide: { type: 'string' },
    notVerified: { type: 'string' },
  },
  required: ['file', 'items'],
}

const FIX_SCHEMA = {
  type: 'object',
  properties: {
    role: { type: 'string' },
    firstCommitParent: { type: 'string' },
    commits: { type: 'array', items: { type: 'string' } },
    fixed: {
      type: 'array',
      items: {
        type: 'object',
        properties: { item: { type: 'string' }, change: { type: 'string' }, proof: { type: 'string' } },
        required: ['item', 'change', 'proof'],
      },
    },
    notFixed: {
      type: 'array',
      items: {
        type: 'object',
        properties: { item: { type: 'string' }, why: { type: 'string' } },
        required: ['item', 'why'],
      },
    },
    tests: { type: 'string' },
    forOthers: { type: 'string' },
    summary: { type: 'string' },
  },
  required: ['role', 'fixed', 'notFixed', 'tests'],
}

const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    role: { type: 'string' },
    commit: { type: 'string' },
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: { item: { type: 'string' }, holds: { type: 'boolean' }, how: { type: 'string' }, problem: { type: 'string' } },
        required: ['item', 'holds', 'how'],
      },
    },
    regressions: { type: 'array', items: { type: 'string' } },
    tests: { type: 'string' },
  },
  required: ['role', 'verdicts', 'regressions', 'tests'],
}

const INTEG_SCHEMA = {
  type: 'object',
  properties: {
    commit: { type: 'string' },
    tests: { type: 'string' },
    allMjs: { type: 'string' },
    visit: { type: 'string' },
    failures: { type: 'array', items: { type: 'string' } },
    notRun: { type: 'string' },
  },
  required: ['commit', 'tests', 'failures'],
}

const PLAY_SCHEMA = {
  type: 'object',
  properties: {
    commit: { type: 'string' },
    doneMeans: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          item: { type: 'string' },
          met: { type: 'string', enum: ['yes', 'no', 'partly', 'not checkable here'] },
          evidence: { type: 'string' },
        },
        required: ['item', 'met', 'evidence'],
      },
    },
    problems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['broken', 'confusing', 'ugly', 'minor'] },
          what: { type: 'string' },
          where: { type: 'string' },
          owner: { type: 'string' },
        },
        required: ['severity', 'what'],
      },
    },
    best: { type: 'string' },
    consoleErrors: { type: 'string' },
  },
  required: ['doneMeans', 'problems'],
}

const X = { effort: 'xhigh' }

// ---------------------------------------------------------------- Critique
phase('Critique')

const pilotCritic = () => agent(`${CTX}

YOUR ROLE: PILOT (lead developer), as CRITIC. M4 of the brief: "Each session plays the whole game and writes a blunt critique of the other's domain."

The eleventh PILOT agent was cut off mid-way. Do not redo what it finished. Read docs/lead/CRITIQUE.md (its file: "PILOT on PHYSICS" has three items; "PILOT on PAINTER" is still a placeholder), the top of docs/notes/pilot.md, docs/lead/REVIEW.md "Review 6 (second half)" section 3 (its own judgement of every body's frames, one day old), and look in /home/user/.pc-scratch/pilot/run11/ for the frames and logs it had already taken (use any that are whole; name the commit they came from). Its Node instruments are in docs/lead/evidence/pilot11/.

DO:
1. Write "## PILOT on PAINTER": the look, blunt, worst first, against the art bible and the freeze-frame test. Cover what a new player sees in order: the title card over the forest, the first ten minutes on Earth (walk, jetpack, boarding, lift-off, space), each planet's arrival and one vista, night, a storm, the sea, the figure itself, each body from orbit. Take top-tier frames on a clean export of the head where run11 has none, and OPEN every frame you judge. Each item: what a player sees, where (body, biome, hour), the evidence path, why it fails, a concrete suggestion. Mark the top five "FIX FOR SHIP".
2. Finish "## PILOT on PHYSICS": keep items 1-3; add what the storm, swimming, low flight and the ship's handling show. PHYSICS is fixing item 1 (the explorer runs up cliffs) right now: re-run docs/lead/evidence/pilot11/wallrun.mjs on the head at the end and note in the item whether it is closed. Mark the top five "FIX FOR SHIP".
3. Remove the "(Being written...)" and "(Continued below...)" placeholders. Commit the file with tools/commit.sh pilot. Do not fix code in this stage (a fix round follows), except a broken test of your own.

RETURN: file, commit, what you played, and EVERY item of both sections as structured items (owner = the domain criticised: PAINTER or PHYSICS; rank within its section; fixForShip true for the top five of each).`,
  { label: 'critic:PILOT', phase: 'Critique', schema: CRITIQUE_SCHEMA, ...X })

const painterCritic = () => agent(`${CTX}

YOUR ROLE: PAINTER, as CRITIC. M4 of the brief: "Each session plays the whole game and writes a blunt critique of the other's domain."

FIRST, close the fourteenth PAINTER agent's block (it was cut off while writing its hand-over; its work is whole in the coordinator's snapshots 45c5176, 8809fff and 76d8182). Read the top of docs/notes/painter.md, open its sheets docs/shots/painter/p14-*.jpg, confirm node --test src/world/*.test.mjs and coast.mjs pass on a clean export, and write the short missing hand-over at the top of docs/notes/painter.md (what PAINTER 14 changed, where the evidence is, what is still weak, naming those snapshot commits). Do not redo its work. Commit with tools/commit.sh painter.

THEN play the whole game as a new player would on a clean export of the head (name the commit): the title card, Earth's forest, walk, jetpack, board, lift-off, space, the map, a pulse to another world, landing, stepping out, the sketchbook and a vista, night, a storm, swimming, low flight. Real key and mouse events (tests/browser.mjs and tests/grandtour.mjs show how the project drives the game). OPEN every frame you judge.

WRITE docs/lead/CRITIQUE-PAINTER.md with two sections, blunt, worst first:
- "## PAINTER on PILOT": does everything PILOT puts on screen belong to the painting? The title card, the loading sheet, the HUD, prompts, the map, the sketchbook, the help card, lettering; the cameras' framing and composition on foot, in the ship, at landing, stepping out, swimming; how the figure and the ship are presented and moved by PILOT's code; transitions (arrival, pulse, day to night as PILOT's clock drives it); anything clunky or ugly in the play itself.
- "## PAINTER on PHYSICS": does what moves paint well? Wind in grass and crowns (amplitude, rhythm, sub-second flicker), the sea and surf, rain, snow, dust, splashes, the gait and the crouch in a gale, the ship's motion; anything whose motion breaks the painting or the calm of the game.
Each item: what a player sees, where, the evidence path you opened, why it fails, a concrete suggestion. Mark the top five of each section "FIX FOR SHIP". Commit with tools/commit.sh painter (the file is in PAINTER's paths).

Do not fix code in this stage; a fix round follows.

RETURN: file, commit, what you played, and EVERY item of both sections as structured items (owner = the domain criticised: PILOT or PHYSICS; rank within its section; fixForShip true for the top five of each).`,
  { label: 'critic:PAINTER', phase: 'Critique', schema: CRITIQUE_SCHEMA, ...X })

const critiques = await parallel([pilotCritic, painterCritic])
const [pilotCrit, painterCrit] = critiques
if (!pilotCrit) log('PILOT critic returned nothing: fixers fall back to docs/lead/CRITIQUE.md as it stands')
if (!painterCrit) log('PAINTER critic returned nothing: fixers fall back to docs/lead/CRITIQUE-PAINTER.md if it exists')

const allItems = [...((pilotCrit && pilotCrit.items) || []), ...((painterCrit && painterCrit.items) || [])]
const listFor = (owner) => {
  const mine = allItems.filter((i) => i.owner === owner)
  const ship = mine.filter((i) => i.fixForShip).sort((a, b) => a.rank - b.rank)
  const rest = mine.filter((i) => !i.fixForShip)
  if (rest.length) log(`${owner}: ${ship.length} FIX FOR SHIP items go to the fixer in full; ${rest.length} lower-ranked items are named by title only`)
  const full = ship.map((i, n) => `${n + 1}. ${i.title}\n   ${i.detail}\n   Evidence: ${i.evidence || 'see the critique file'}\n   Suggestion: ${i.suggestion || 'yours to choose'}`).join('\n')
  const titles = rest.map((i) => `- ${i.title}`).join('\n')
  return `FIX FOR SHIP (from the critics, in full):\n${full || '(none returned; read the critique files)'}\n\nLower-ranked items (titles only; the files have the detail):\n${titles || '(none)'}`
}

// ---------------------------------------------------------------- Fix -> Verify -> Re-fix, per role
const ROLE_BRIEF = {
  PILOT: `YOUR ROLE: PILOT (lead developer), as FIXER of your own domain in M4's fix round.

Read: the top of docs/notes/pilot.md; docs/lead/CRITIQUE-PHYSICS.md section "PHYSICS on PILOT" (five FIX FOR SHIP items with numbers and evidence in docs/shots/physics/critique/); docs/lead/CRITIQUE-PAINTER.md section "PAINTER on PILOT"; docs/notes/physics.md "For PILOT and PAINTER: the figure's state, M4" if PHYSICS has written it.

FIRST TASK (others wait on it; commit it within your first hour): pass PHYSICS's body state through to the drawn figure, so PAINTER can pose it: the lean into the wind, the crouch in a gale, swimming and its stroke phase, rising against falling in an arc. Write the exact field names PAINTER reads under "For PAINTER (M4)" at the top of docs/notes/pilot.md.

THEN, worst first, PHYSICS's five on your domain:
1. The ship jumps 16 m upward in one frame at the end of every lift-off under trees (8.46 m to 24.80 m), the first lift-off of the game included: the free-flight clamp puts the hull on top of the crowns.
2. The landing assist: "Land here" is offered at full speed and E takes the ship from 46 to 14 m/s in 0.4 s (18 g); a slow E lurches at 4.4 g and then the ship drops at 13 m/s into the wood.
3. The ground assist rewrites the hull's velocity after PHYSICS has moved it: one-frame jolts of 3.5 to 8.5 m/s (16 to 35 g), and at a 60 degree slope a 22 g climb to 71 m/s with the nose still down; the chase camera is fixed to the hull so every jolt moves the picture.
4. Cameras through tree crowns: the foot camera on the jetpack's way up and down (the landing camera was fixed in b0e9aba but never filmed: film it).
5. Swimming is wading: with the state passed through this becomes PAINTER's pose; make sure your camera and controls suit a swimmer.
Also from that list where cheap: the camera behind the hull then popping to the shoulder on stepping out; the jetpack refilling in mid-air; hard turns at 6.5 g; HUD text overflowing at 640 px.`,
  PAINTER: `YOUR ROLE: PAINTER, as FIXER of your own domain in M4's fix round.

Read: the top of docs/notes/painter.md; docs/lead/CRITIQUE-PHYSICS.md section "PHYSICS on PAINTER"; docs/lead/CRITIQUE.md section "PILOT on PAINTER"; docs/lead/REVIEW.md "Review 6 (second half)" section 3 "The worst frames, worst first"; docs/notes/pilot.md "For PAINTER (M4)" (the figure's state fields; PILOT's fixer commits it early in its block: if it is not there yet, do your other items first, then check again; if it never arrives, read the state from PHYSICS as documented in docs/notes/physics.md and say so).

PHYSICS's five on your domain: (1) the figure ignores the wind: it must lean into it (PHYSICS leans the body 23 to 33 degrees in Neptune's squall) and its scarf and coat must move; (2) there is no swimming pose; (3) tree crowns seen from inside are flat green slabs filling up to half the frame; (4) the storm sea reads calm at quality 1: few white horses, no surf at the beach (the coordinator has ruled that PHYSICS lifts its 15 % cap on white water: paint whatever fraction comes as broken foam, streaks and spray, never a flat white area, and judge it in a frame you open); (5) the falling pose (arms spread) is used on the way up an arc too.

Order everything by what a new player sees first. For every change: before and after frames you OPEN, revert what looks worse, world tests, coast.mjs PASS, no console error.`,
  PHYSICS: `YOUR ROLE: PHYSICS, as FIXER of your own domain in M4's fix round.

BEFORE EDITING ANYTHING: the twenty-fourth PHYSICS agent has been working since this workflow began (the cliff-run regression, the white-water cap, sudden checks on arrival ground, the figure's state). Read the top of docs/notes/physics.md. If there is no "Hand-over P26" yet, or git log shows a [physics] commit in the last 15 minutes that is not a WIP snapshot, it may still be running: do read-only preparation and check again every few minutes, for up to 90 minutes, before you touch src/physics. Do not redo what it finished; take over what its hand-over lists as not done.

Read also: docs/lead/CRITIQUE.md section "PILOT on PHYSICS"; docs/lead/CRITIQUE-PAINTER.md section "PAINTER on PHYSICS".

The must-hold check for your domain: node docs/lead/evidence/pilot11/wallrun.mjs <root> earth sea_coast (and earth desert_canyon) must show no climb on ground steeper than 50 degrees. Every fix needs a test that fails before it.`,
}

const RESILIENCE = 'A RESTART CAN CUT YOU OFF AT ANY MOMENT (it has happened twice in this project). Commit every finished item at once with tools/commit.sh, and after each item bring the hand-over at the top of your notes file up to date (what is done with its proof, what you are in the middle of, what is next), so that a successor can pick up from the repository alone.'

const RESUME = {
  PILOT: `YOU ARE A SUCCESSOR. The thirteenth PILOT agent began this same fix round at 04:09 UTC and was cut off by a container restart at 05:08 UTC. Nothing it did is lost, but some of it is half done:
- its one finished commit: dea95fb (PHYSICS' body state passed to the drawn figure: the FIRST TASK below; check that "For PAINTER (M4)" is written at the top of docs/notes/pilot.md, write it if not, and do not redo the code);
- its work in progress is in two snapshot commits made by the coordinator: 8418918 and c03bce6 (git show --stat, then read the diffs): src/ship/flight.js (the landing assist, the ground assist, the landing site, the lift-off under trees), src/player/camera.js, src/core/sim.js, src/core/state.js, tests/flight.test.mjs, tests/physics.test.mjs. It had just added new tests for PHYSICS' items 1 to 3 and had started on PAINTER's item 1 (stepping out frames the ship's wing) and the view's trigger range in src/core/sim.js;
- its scratch (instruments, a film script, logs) is under /home/user/.pc-scratch/pilot/m4/ (scripts/dbg-dive.mjs, dbg-trip2.mjs, cost-flight.mjs, film.mjs, stepout.mjs, mktree.sh; out/film1.log).
FIRST: run node --test tests/*.test.mjs and the load check on the working tree to see whether its half-done edits leave the tree green; read the two diffs; for each change decide: finish it and prove it, or revert it. A change you cannot prove in this block is reverted. Then continue the list below from where it stopped.`,
  PAINTER: `YOU ARE A SUCCESSOR. The sixteenth PAINTER agent began this same fix round at 04:09 UTC and was cut off by a container restart at 05:08 UTC. Nothing it did is lost, but some of it is half done:
- its one finished commit: b579366 (FIX 1: night in its own key); do not redo it, but look at one night frame yourself;
- its work in progress is in the coordinator's snapshot commit 3def4e7 (and 3f13484 before b579366; git show --stat, then read the diffs): src/render/post.js, src/render/kitmat.js, src/render/materials.js, src/render/chunks.js, src/world/index.js. It was in the middle of FIX 2 (the storm and mist key: the storm as a murk; rain that can be seen against the land): it had changed the rain's material in kitmat.js and the lamp and region thresholds in post.js, and was trying sheet and border terms for the storm live in the browser (those live patches were NOT all written to the files);
- its plan, in its own order: FIX 1 night (done); FIX 2 storm and mist key, visible rain; FIX 3 round worlds from orbit, Neptune's belts, Pluto's heart; FIX 4 Jupiter's arrival palette; FIX 5 Uranus' and Pluto's arrivals (one dark mass, splinters in drifts); then PHYSICS' items: the figure (wind lean, cloth, swim pose, arc pose), crowns at the lens, the storm sea's white water;
- its scratch (a live-patch harness send.sh, frames) is under /home/user/.pc-scratch/painter/m4/fix/ and /home/user/.pc-scratch/painter/m4/crit/.
FIRST: run node --test src/world/*.test.mjs and the load check on the working tree, load the game once and read the console, to see whether its half-done edits leave the tree whole (a shader that does not compile is the risk); read the diffs; for each change decide: finish it and prove it in frames you open, or revert it. Then continue the plan from FIX 2. Read also the coordinator's relay at the top of docs/notes/painter.md (PHYSICS has lifted the white-water cap; the picture does not show it yet).`,
  PHYSICS: `The twenty-fourth PHYSICS agent has FINISHED (hand-over P26 at the top of docs/notes/physics.md; the coordinator verified it on a clean export of 526883f: the cliff run is fixed). Do not wait for it. Take over what its hand-over lists as not done and the critics' items below.`,
}

const fixPrompt = (role) => `${CTX}

${RESUME[role]}

${RESILIENCE}

${ROLE_BRIEF[role]}

THE CRITICS' ITEMS FOR YOUR DOMAIN:
${listFor(role)}

You decide in your own domain (the brief: "the owner of that domain decides"), but the critics' ranking guides you: fix the worst first, as many FIX FOR SHIP items as you can do well, each proven (a test that fails on the commit before your first one, or a measured before/after, or before/after frames you opened). An item you judge wrong or too risky for a final milestone: say why in your notes and in notFixed. This is the last fix round before the game ships: do not start large rewrites; keep every existing check green.

At the end: a hand-over at the top of your role's notes file. RETURN: role, firstCommitParent (the commit your first commit sits on), your commits, each fixed item with its proof (paths, numbers, test names), each item not fixed and why, the test counts you measured on a clean export of your last commit, and anything another role must do.`

const verifyPrompt = (role, fix) => `${CTX}

YOUR ROLE: an independent VERIFIER (you belong to no role; you edit no file in the repository; scratch only under /home/user/.pc-scratch/verify/${role.toLowerCase()}/). The ${role} fixer of M4's fix round has just reported. Your job is to try to REFUTE each claimed fix, and to find what it broke.

THE FIXER'S REPORT:
${JSON.stringify(fix, null, 1)}

FOR EACH "fixed" ITEM: reproduce the original fault on the commit before the fixer's first commit when that is cheap (git archive <commit> | tar -x -C <dir>), then check it is gone on a clean export of the head (tools/export-head.sh <dir>). Run the named tests yourself. For a claim about a picture, take the frame yourself (or open the fixer's) and judge it against the art bible's freeze-frame test. For a claim about feel, measure it in Node or in the game. Look next to each change for what it could have broken (other worlds, other gravities, 30 and 60 Hz, quality 0 and 2). holds = false unless you ran or opened something that shows the fix; say exactly what you ran.

THEN, on the clean head: node --test src/world/*.test.mjs, node --test tests/*.test.mjs, node --test src/physics/, node src/physics/coast.mjs, node docs/lead/evidence/review7/ghostfield.mjs, node docs/lead/evidence/pilot11/wallrun.mjs <root> earth sea_coast; load the game once in the browser and report console errors and window.__pc.info().fallback. List every regression you find, with the command or frame that shows it.

RETURN: role "${role}", the commit you verified, a verdict per item, the regressions, the test counts.`

const refixPrompt = (role, fix, ver) => `${CTX}

${RESILIENCE}

${ROLE_BRIEF[role]}

This is the RE-FIX pass. An independent verifier checked your role's fix round and did not accept everything. Fix exactly these, each with proof, and nothing else; if you judge a finding wrong, show why with a measurement or a frame.

NOT ACCEPTED:
${JSON.stringify((ver.verdicts || []).filter((v) => !v.holds), null, 1)}

REGRESSIONS FOUND:
${JSON.stringify(ver.regressions || [], null, 1)}

Update the hand-over at the top of your notes. RETURN as before (role, commits, fixed with proof, notFixed with why, tests, forOthers).`

const MEMORY = `

MEMORY (the coordinator, after the second container restart of this round, 10:19 UTC): this machine has 16 GB, no swap and four CPUs, and it died with every running command killed in the same second, most likely out of memory. Rules for everyone: one browser at a time per agent, closed as soon as its frames are taken (not left open while you think or run Node suites); never two Node test suites or two world-building instruments at once; before starting a browser or a suite run free -m and wait while less than 5000 MB is available. The coordinator's watchdog ends the largest browser process when under 1.3 GB is free (log: /home/user/.pc-scratch/coordinator/mem.log): if your browser vanishes, that is why; wait a minute and run it again. Disk: 11 GB are left; delete your own exports and frames you no longer need (only under your own scratch directory).`

const REFIX_NOTE = {
  PILOT: `

YOU ARE A SUCCESSOR in this re-fix pass. The fifteenth PILOT agent began it at 10:11 UTC and was cut off eight minutes later by a container restart. It had committed nothing. A sixteenth ran from 12:17 to 12:21 UTC, only reading, and was stopped when the owner moved the project to another model; it changed nothing. Its half-done edits are in the coordinator's snapshot commit 6e550ce (git show 6e550ce: src/player/camera.js and src/core/sim.js, "the crown lists with kits, and the foot rule in the air only": its answer to the verifier's MAJOR regressions, the third-person camera cutting into the explorer's eyes on every walk in a wood and on stepping out). With those edits the working tree FAILS two unit tests (tests/footcam.test.mjs: 'M4 the foot boom among crowns: cut short of a crown, the lens a metre clear of crowns and trunks' and 'M4 on the jetpack in a glade, up past the crowns and down again: the lens is never in a crown'; 179 of 181 pass). FIRST: read that diff and decide: finish it and prove it, or revert it (git checkout 507486f -- src/player/camera.js src/core/sim.js restores the fixer's last state, on which 181 of 181 passed) and take a simpler way. The simplest honest way is allowed: if a crown rule for the foot camera cannot be made right in this pass, take the foot camera's crown rule out (the walk as before the round: the figure always drawn) and say so. The measure that must hold: the verifier's probe, ROOT=<tree> node /home/user/.pc-scratch/verify/pilot/probes/walkcam.mjs (figure not drawn: 0 of the steps of a walk at Earth's spawn and in the autumn woodland, as on dea95fb), and stepping out at Earth's, Saturn's and Neptune's spawns shows the explorer. Its scratch: /home/user/.pc-scratch/pilot/m4/s15/. Commit each finished item at once.

ALSO, small and in your paths, after the regressions: PHYSICS' fix round moved Earth's weather 1530 s later on the game's clock (the first day is now fair). Move the clocks of the weather and motion films by the same amount, as PHYSICS lists them in docs/notes/physics.md (hand-over P27, 'For PILOT and PAINTER, M4 fix round'): tests/weather.mjs SHOTS earth-before 120 -> 1650, earth-arrives 166 -> 1696, earth-storm and earth-storm-night 240 -> 1770, earth-flash and earth-flash-night 244 -> 1774, earth-after 400 -> 1930, earth-blizzard 190 -> 1720 (and their comments); tests/motion.mjs scene storm 240 -> 1770. Check it in Node (the storm is there at the new clocks); you need not film them.` + MEMORY,
  PHYSICS: MEMORY,
}

const VERIFY_NOTE = {
  PHYSICS: `

YOU ARE A SUCCESSOR. A verifier with this same task worked from 09:52 to 10:19 UTC and was cut off by a container restart before it returned (a second one ran from 12:17 to 12:21 UTC, only reading, and was stopped when the owner moved the project to another model). Its scratch is whole and may be reused after you have checked it is what it says: /home/user/.pc-scratch/verify/physics/ (before, before-ep, before-nt: exports of earlier commits; head with head.commit; scripts/; out/ with its logs, frames and tables so far, among them out/A/ of a browser session and out/onset-head.txt). Do not trust a number there you have not seen made; do reuse the exports and the scripts. The head has moved since by PAINTER's re-fix commits only (5de71a7, 91fd6bf, 7265ff0); check that git diff a686a98..HEAD -- src/physics is empty and verify PHYSICS' code as of the head.` + MEMORY,
}

const ROLES = ['PILOT', 'PAINTER', 'PHYSICS']
const rounds = await pipeline(
  ROLES,
  (role) => agent(fixPrompt(role), { label: `fix:${role}`, phase: 'Fix', schema: FIX_SCHEMA, ...X }),
  async (fix, role) => {
    if (!fix) { log(`${role}: the fixer returned nothing; verifying the head as it stands`) }
    const ver = await agent(verifyPrompt(role, fix || { role, fixed: [], notFixed: [], tests: 'none reported' }) + (VERIFY_NOTE[role] || ''), { label: `verify:${role}`, phase: 'Verify', schema: VERIFY_SCHEMA, ...X })
    return { fix, ver }
  },
  async (r, role) => {
    // PAINTER's re-fix pass finished before the second restart (journal; commits 5de71a7, 91fd6bf, 7265ff0).
    // A resume once re-ran it because cached calls are matched in call order; the coordinator passes its result in.
    if (args && args.done && args.done[role]) { log(`${role}: re-fix pass already finished (from the journal)`); return { ...r, refix: args.done[role] } }
    const bad = r.ver ? (r.ver.verdicts || []).filter((v) => !v.holds).length + (r.ver.regressions || []).length : 0
    if (!r.ver || bad === 0) return { ...r, refix: null }
    log(`${role}: ${bad} findings go back to the fixer`)
    const refix = await agent(refixPrompt(role, r.fix, r.ver) + (REFIX_NOTE[role] || ''), { label: `refix:${role}`, phase: 'Re-fix', schema: FIX_SCHEMA, ...X })
    return { ...r, refix }
  },
)

// ---------------------------------------------------------------- Play-test on the final head
phase('Play-test')

const integrator = () => agent(`${CTX}

YOUR ROLE: an independent INTEGRATOR (no role; you edit no file in the repository; scratch only under /home/user/.pc-scratch/verify/integrate/). The fix round is over. Prove what the final head does, on a clean export of it (name the commit).

RUN: the three unit suites, coast.mjs, ghostfield.mjs, wallrun.mjs (earth sea_coast and earth desert_canyon); a check that every module under src/ loads alone as the entry in Node (for f in src/*/*.js src/data/looks/*.js: node --input-type=module -e "await import('./<f>')" must not throw "before initialization"); then, in a clean tree, node tests/all.mjs (every step; it takes about an hour here; read tests/all.mjs and tests/cleantree.sh first); then one browser sitting that loads the game and teleports to all ten bodies (window.__pc.teleport({ body, hour: 11 })), waits for each to settle (tests/browser.mjs settleWorld), and records console errors, page errors, failed requests, window.__pc.errors and info().fallback on each (wait up to 30 minutes for window.__pcReady on this machine). Open two of the frames to confirm the worlds draw.

RETURN: the commit, the test counts, all.mjs step by step, the visit's result, every failure with its output, and what you could not run.` + MEMORY,
  { label: 'integrate', phase: 'Play-test', schema: INTEG_SCHEMA, ...X })

const newPlayer = () => agent(`You are a first-time PLAYER and blunt play-tester of a browser game called Painted Cosmos, in /home/user/painted-cosmos (git branch cosmos). You are deliberately told nothing about how it was built. Read ONLY README.md (and nothing under docs/ or src/ until you have finished playing; afterwards you may read docs/BRIEF.md sections "Done means" and the art bible to phrase your verdicts). Edit no file in the repository; write scratch only under /home/user/.pc-scratch/verify/player/.

HOW TO PLAY HERE: the machine has no GPU, so a headless Chromium (pre-installed Playwright; require('playwright') works, chromium.launch() needs no options) renders on the CPU, slowly. Make a clean copy of the last commit with tools/export-head.sh <dir>, serve that directory with a small static server of your own, open index.html, and play with real keyboard and mouse events only, as the README's controls say (you may use the query string the README documents for quality or size, nothing else you find in the code). One browser at a time; kill processes only by PID. Take screenshots as you go and OPEN them: they are your eyes. Wait as long as a slow machine needs (the loading sheet can take many minutes).

PLAY, in order, as a new player would: read the title card and the help; walk and run in the forest; use the jetpack; find and board the ship; lift off; reach space; open the map; travel to at least three other planets (land, step out, walk, look around), more if time allows; find a vista and use the sketchbook; try swimming if you find water; stay through a night or a storm if one comes.

JUDGE, bluntly: could you do each thing from what the game and the README told you? Where were you confused, stuck, or bored? Does each screenshot look like a watercolour painting (soft edges, paper showing, no flat digital areas, nothing pure black)? What looks or feels broken? What was the best moment?

RETURN: the commit you played; for each of these "Done means" items a verdict with evidence (start on Earth in the forest; walk; jetpack; board the ship; reach space; land on other planets, each with different landscapes; every frame looks like a painting; no console errors; the README lists the controls; frame rate, which is not checkable here); every problem you met with a severity and where; the best moment; console errors seen.` + MEMORY,
  { label: 'new-player', phase: 'Play-test', schema: PLAY_SCHEMA, ...X })

const [integration, playtest] = await parallel([integrator, newPlayer])

return {
  critiques: { pilot: pilotCrit, painter: painterCrit },
  rounds: ROLES.map((role, i) => ({ role, ...(rounds[i] || { fix: null, ver: null, refix: null }) })),
  integration,
  playtest,
}
