export const meta = {
  name: 'every-tier-r2',
  description: 'Second release of the sharper/smoother/mobile plan: every tier and every device sharp (resolution floor, sharp enlargement, trees out to 2 km at every tier, phone preset and pacing), fewer stutters and less garbage (world building, physics), the phone player\'s small findings; each lane verified adversarially and re-fixed once; then every check and an emulated phone player',
  phases: [
    { title: 'Build', detail: 'PILOT: W6 and the small findings; PAINTER: W7 then W4; PHYSICS: W5; own paths only' },
    { title: 'Verify', detail: 'an independent, adversarial verifier per lane on clean exports' },
    { title: 'Re-fix', detail: 'what failed verification goes back to the lane, once' },
    { title: 'Final checks', detail: 'every check on the final head; stations at every tier and the phone preset; a touch-only phone player' },
  ],
}

const CTX = [
  'PROJECT: Painted Cosmos, /home/user/painted-cosmos. WORK ON GIT BRANCH r2 (the working tree is on it; tools/commit.sh pushes the current branch). Branch cosmos is frozen at release 1 (pull request 2 waits for the owner); main is the live game. A calm single-player browser exploration game: walk, jetpack, board a ship, fly seamlessly from the ground to space and to every planet, land, explore. Three.js r187 vendored, WebGL2, plain ES modules with an import map, no build step.',
  'THE OWNER\'S REQUEST after playing the live game: much sharper (above all the ground seen from the ship: "i want to be able to fly above them and see where im landing not some blurry blobs"), much smoother, playable on mobile, "without losing the quality at all". THE PLAN is docs/lead/SHARP-SMOOTH-PLAN.md (sections 0, 2, 5 and your workstream in section 4). RELEASE 1 is done (W1, W2, W3): read the hand-overs at the top of docs/notes/painter.md and docs/notes/pilot.md, and the last section of docs/COORDINATOR.md. At the top tier the ground from the ship is now sharp (E_150_45 final land t1/t2 0.04/0.25 -> 1.09/1.07). BUT a touch-only phone player in iPhone 14 emulation found the ground still soft from the ship and trees gone above about 200 m, because the game sat at tier 0 and render scale 0.5 (CPU emulation; a real phone may also go low): THIS RELEASE MUST MAKE EVERY TIER AND EVERY DEVICE SHARP, AND THE GAME SMOOTHER. The station harness is tests/stations.mjs (how to run a set: the top of docs/notes/pilot.md); the baseline is tests/baselines/stations-784183b.json; release 1\'s numbers are in the integrator\'s run /home/user/.pc-scratch/verify/r1-integrate/stations-q2/.',
  'ROLES AND OWNERSHIP: PAINTER owns rendering and the world (src/render, src/world, src/art, src/data/looks, docs/notes/painter.md, docs/shots/painter). PILOT owns systems, play, UI, input, the controller and tiers\' policy, tests (index.html, src/main.js, src/core, src/player, src/ship, src/space, src/ui, src/audio, tests, README.md, docs/notes/pilot.md, docs/shots/pilot, docs/lead). PHYSICS owns src/physics, docs/notes/physics.md, docs/shots/physics. You act in ONE role, named below. Edit only that role\'s paths; for another role\'s files write the exact change in your role\'s notes. Commit only with: tools/commit.sh <role> "message" (no model names in messages). The coordinator sometimes sweeps uncommitted files into "WIP snapshot" commits; if yours were swept, say so in your next commit message.',
  'THE MACHINE: 4 CPUs, NO GPU: headless Chromium (pre-installed Playwright; tools/shot.mjs, tests/browser.mjs; window.__pc is the debug handle) renders WebGL on the CPU (SwiftShader), so browser frame times are not a GPU\'s: count work (draw calls, triangles, texture reads per pixel, pixels) and time JS separately (Node benches: the plan names them; the Sim and the world run in Node). Other agents work beside you: at most ONE browser of yours at a time, closed as soon as its frames are taken; never two Node test suites at once; free -m before a browser. Kill processes only by PID. Scratch ONLY under /home/user/.pc-scratch/<your role>/r2/; delete your own exports when done. A clean copy of the last commit: tools/export-head.sh <dir>. The container restarts without warning (five times so far): commit each finished item at once and keep the hand-over at the top of your notes current after each item, so a successor can continue from the repository alone.',
  'CHECKS (on a clean export, before every commit of code): node --test src/world/*.test.mjs (47 pass at the start), node --test tests/*.test.mjs (251), node --test src/physics/ (325); node src/physics/coast.mjs PASS at both stands; node docs/lead/evidence/review7/ghostfield.mjs all zeros; the game loads with no console error and window.__pc.info().fallback empty. Anything that touches the picture: the plan\'s quality guard (section 5) at the stations, before and after, frames OPENED; the top tier must not lose what release 1 gained.',
  'RULES: Work autonomously; never ask anyone a question; when something is ambiguous choose what best serves the owner\'s request and log the choice in your notes. Do NOT open a pull request. Never claim a picture looks right unless you opened it, or a run passed unless you ran it; state plainly what you did not verify. Do not use or look for the owner\'s other projects or past chats.',
].join('\n\n')

const FIX_SCHEMA = {
  type: 'object',
  properties: {
    role: { type: 'string' }, firstCommitParent: { type: 'string' }, commits: { type: 'array', items: { type: 'string' } },
    fixed: { type: 'array', items: { type: 'object', properties: { item: { type: 'string' }, change: { type: 'string' }, proof: { type: 'string' } }, required: ['item', 'change', 'proof'] } },
    notFixed: { type: 'array', items: { type: 'object', properties: { item: { type: 'string' }, why: { type: 'string' } }, required: ['item', 'why'] } },
    tests: { type: 'string' }, forOthers: { type: 'string' }, summary: { type: 'string' },
  },
  required: ['role', 'fixed', 'notFixed', 'tests'],
}
const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    role: { type: 'string' }, commit: { type: 'string' },
    verdicts: { type: 'array', items: { type: 'object', properties: { item: { type: 'string' }, holds: { type: 'boolean' }, how: { type: 'string' }, problem: { type: 'string' } }, required: ['item', 'holds', 'how'] } },
    regressions: { type: 'array', items: { type: 'string' } }, tests: { type: 'string' },
  },
  required: ['role', 'verdicts', 'regressions', 'tests'],
}
const INTEG_SCHEMA = {
  type: 'object',
  properties: { commit: { type: 'string' }, tests: { type: 'string' }, allMjs: { type: 'string' }, stations: { type: 'string' }, benches: { type: 'string' }, visit: { type: 'string' }, failures: { type: 'array', items: { type: 'string' } }, notRun: { type: 'string' } },
  required: ['commit', 'tests', 'allMjs', 'stations', 'failures'],
}
const PHONE_SCHEMA = {
  type: 'object',
  properties: {
    commit: { type: 'string' },
    loop: { type: 'array', items: { type: 'object', properties: { step: { type: 'string' }, done: { type: 'boolean' }, evidence: { type: 'string' } }, required: ['step', 'done', 'evidence'] } },
    problems: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string', enum: ['broken', 'confusing', 'ugly', 'minor'] }, what: { type: 'string' }, where: { type: 'string' } }, required: ['severity', 'what'] } },
    sharpFromTheShip: { type: 'string' },
    consoleErrors: { type: 'string' },
  },
  required: ['loop', 'problems', 'sharpFromTheShip'],
}
const X = { effort: 'xhigh' }

const step = (role, part, brief) => `${CTX}

YOUR ROLE: ${role}. ${part}

${brief}

Each item proven by its acceptance measure from the plan (a test that fails on the commit before yours, measured numbers, frames you opened). An item you judge wrong or too risky: say why in your notes and in notFixed, and leave it. At the end: the hand-over at the top of your notes file. RETURN: role, firstCommitParent, commits, each item with its proof, each item not done and why, the test counts on a clean export of your last commit, and anything another role must do.`

const LANES = {
  PILOT: [
    ['pilot:floor', 'Part 1 of 2 of your lane: W6.1, W6.2 and W6.3.', 'DO W6.1 (the resolution floor and measured steps in src/core/dynres.js: the controller works on internal = tier share x render scale with a floor of 0.67, 0.75 on phones and tablets; below the floor it sheds a tier (geometry, then MSAA), never pixels; steps sized from the gain the last step actually bought; URL pins below the floor keep working for the tests), W6.2 (the phone and tablet preset part 2: the floor, even pacing at a steady 30 when 60 cannot hold) and W6.3 (sketch capture off the frame: a small target, asynchronous readback, the sketch hand and JPEG in a worker, today\'s path as fallback). Coordinate with PAINTER\'s W7.3 (tier shares) through the notes: the policy is yours, the constants PAINTER\'s. Acceptance as the plan says (the model machines, the pacing model test, capture main-thread time at most 4 ms, the sketch tests and m3check green).'],
    ['pilot:fixes', 'Part 2 of 2 of your lane: the phone player\'s findings, the flaky test, the README.', 'DO, each with a test or opened frames in Playwright phone emulation: (1) on foot the jetpack gauge is drawn on top of the top-left tabs (iPhone 14 landscape); (2) loading in portrait shows blank paper for 25 s or more with no title card and no turn-sideways slip; (3) the sketchbook\'s world tabs are clipped at phone width (Saturn cut under the close button; Uranus, Neptune, Pluto not reachable from the strip); (4) in the ship the "a place to land" slip and arrow and other markers sit on the left thumb stick: keep labels off the touch controls; (5) painted-play in tests/all.mjs is flaky under load: the landing prompt\'s hold-over (sim.js landable(): 15 m and 10 m/s) lapses before the scripted E arrives at 1 to 3 frames a second, and the script never retries: make the test press again as a player would (and decide whether the hold-over should be measured in frames rather than seconds for slow machines; log the choice); (6) the honest "Land here" from history (1c406e2: over Saturn\'s honey_mist the prompt was offered, then E answered "Too steep"): bring it in with its test if it is still small and safe; (7) README: the new tiers, the floor, the read-out lines, the phone section updated. End with node tests/all.mjs in a clean tree: ALL PASSED (run painted-play three times alone as well).'],
  ],
  PAINTER: [
    ['painter:tiers', 'Part 1 of 2 of your lane: W7.1, W7.2 and W7.3.', 'DO W7.1 (the far canopy at every tier out to 1.5 to 2 km: far forms from the same placement, not scaled down by tier; the fades pushed out; a pop-free hand-over; the plan\'s foliage-share acceptance at q0, q1, q2 at E_150_45, E_400_90 and E_1000_45, and its cost bounds), W7.2 (an interpolating enlargement when the picture is drawn smaller than the screen: Catmull-Rom or FSR1 EASU, then RCAS from the sheet\'s taps, only when enlarged; the B-spline and its shake removed; identical frames when not enlarged) and W7.3 (tier shares: q0 at least 0.75 of the output at render scale 1; at q0 only a 1 px near brush). Measure at q0 and q1 at 1280x720 and in the iPhone 14 landscape profile with the phone preset, not only q2: the phone player\'s view (q0, scale 0.5 before the floor) must become sharp from the ship. Before and after sheets OPENED, kept in docs/shots/painter/r2/.'],
    ['painter:smooth', 'Part 2 of 2 of your lane: W4.', 'DO W4.1 (hitch caps and garbage in world building, still on the main thread: the build-cost cap, tree cells split, the near relist incremental, allocation-free surface sampling, and whatever else the plan lists), to its acceptance in the Node world bench on an unloaded machine run alone (walk, run and ship at 150 m: max world.update at most 8 ms; arrive at most 25 ms; allocation at most 0.15 MB a frame walking). Every station\'s frame unchanged (within 2/255). Read part 1\'s hand-over first.'],
  ],
  PHYSICS: [
    ['physics:smooth', 'Your lane: W5.1 and W5.2 (W5.3, the worker pool, is release 3).', 'DO W5.1 (first re-measure the simbench baseline on an unloaded machine; then allocation-free field updates (the flora field, air and sampleWind, the weather\'s cellAt and gather, the particle step, loose._move); field recentring and an arriving body\'s warm-up spread over frames or hidden behind the arrival veil) and W5.2 (a phone tier: physics.setQuality takes the device preset; fewer particles, smaller fields, storm particles capped per tier; rain still visible in the storm frame, opened). Acceptance as the plan says (garbage at most 150 KB a frame walking and 250 KB flying; max sim.frame at most 16 ms; the first frames on Mars at most 33 ms or inside the veil; storm physics mean at most 3 ms; at CPU 4x on the phone preset sim plus physics mean at most 3 ms, p95 at most 6 ms). Every physics test, coast.mjs, ghostfield.mjs and wallrun.mjs (earth sea_coast: no climb on ground over 50 degrees) unchanged; determinism kept.'],
  ],
}

const runLane = async (lane) => {
  const out = []
  for (const [label, part, brief] of LANES[lane]) {
    const r = await agent(step(lane, part, brief), { label, phase: 'Build', schema: FIX_SCHEMA, ...X })
    out.push(r || { role: lane, fixed: [], notFixed: [{ item: label, why: 'the agent returned nothing' }], tests: 'none' })
  }
  return out
}

const LENS = {
  PILOT: 'In particular: the controller on model machines and in the real game (it must never end below the floor without a pin; tiers shed before pixels); the phone preset and pacing; a sketch capture\'s main-thread time; the phone player\'s four findings in iPhone 14 emulation (frames opened); painted-play run three times alone; desktop play unchanged.',
  PAINTER: 'In particular: the stations from the ship at q0, q1 and q2 and in the iPhone 14 profile with the phone preset (trees present out to the plan\'s distances, the ground sharp, no pops in a descent film from 1 km); the enlargement\'s halos; the top tier unchanged against release 1 (the integrator\'s run in /home/user/.pc-scratch/verify/r1-integrate/stations-q2/); the world bench numbers re-measured yourself, run alone.',
  PHYSICS: 'In particular: simbench re-measured yourself, run alone; determinism tests; rain visible in the storm at the phone tier (frame opened); wallrun earth sea_coast; coast.mjs; ghostfield.mjs.',
}

const verifyPrompt = (lane, reports) => `${CTX}

YOUR ROLE: an independent VERIFIER (no role; you edit no file in the repository; scratch only under /home/user/.pc-scratch/verify/r2-${lane.toLowerCase()}/). The ${lane} lane of release 2 has reported (below). Try to REFUTE each claimed item against the plan's acceptance (docs/lead/SHARP-SMOOTH-PLAN.md) and find what it broke.

THE LANE'S REPORTS:
${JSON.stringify(reports, null, 1)}

For each item: reproduce the before on the lane's first firstCommitParent when cheap (git archive <commit> | tar -x -C <dir>), check the after on a clean export of the head (tools/export-head.sh <dir>), run the named tests and measures yourself, OPEN the frames. ${LENS[lane]} holds = false unless you ran or opened something that shows it; say exactly what you ran.

THEN, on the clean head: the three unit suites, coast.mjs, ghostfield.mjs; load the game once on desktop and once in phone emulation and report console errors and window.__pc.info().fallback. List every regression with the command or frame that shows it.

RETURN: role "${lane}", the commit you verified, a verdict per item, the regressions, the test counts.`

const refixPrompt = (lane, reports, ver) => `${CTX}

YOUR ROLE: ${lane}, the RE-FIX pass of release 2's ${lane} lane. An independent verifier did not accept everything. Fix exactly these, each with proof, and nothing else; if you judge a finding wrong, show why with a measurement or a frame; if a change cannot be made safe now, revert it and say so. Read the lane's hand-overs at the top of your notes first.

THE LANE'S COMMITS: ${JSON.stringify(reports.map((r) => r && r.commits))}

NOT ACCEPTED:
${JSON.stringify((ver.verdicts || []).filter((v) => !v.holds), null, 1)}

REGRESSIONS FOUND:
${JSON.stringify(ver.regressions || [], null, 1)}

${lane === 'PILOT' ? 'End with node tests/all.mjs in a clean tree: ALL PASSED. ' : ''}Update the hand-over at the top of your notes. RETURN as before (role, commits, fixed with proof, notFixed with why, tests, forOthers).`

const LANE_ORDER = ['PAINTER', 'PILOT', 'PHYSICS']
const rounds = await pipeline(
  LANE_ORDER,
  (lane) => runLane(lane),
  async (reports, lane) => {
    const ver = await agent(verifyPrompt(lane, reports), { label: `verify:${lane}`, phase: 'Verify', schema: VERIFY_SCHEMA, ...X })
    return { reports, ver }
  },
  async (r, lane) => {
    const bad = r.ver ? (r.ver.verdicts || []).filter((v) => !v.holds).length + (r.ver.regressions || []).length : 0
    if (!r.ver || bad === 0) return { ...r, refix: null }
    log(`${lane}: ${bad} findings go back to the lane`)
    const refix = await agent(refixPrompt(lane, r.reports, r.ver), { label: `refix:${lane}`, phase: 'Re-fix', schema: FIX_SCHEMA, ...X })
    return { ...r, refix }
  },
)

phase('Final checks')
const integrator = () => agent(`${CTX}

YOUR ROLE: an independent INTEGRATOR (no role; you edit no file in the repository; scratch only under /home/user/.pc-scratch/verify/r2-integrate/). Release 2 is built. Prove what the final head of branch r2 does on a clean export (name the commit).

RUN, one at a time: the three unit suites, coast.mjs, ghostfield.mjs, wallrun.mjs (earth sea_coast); every module under src/ loads alone in Node without "before initialization" (map 'three' to vendor/three/three.module.js with a loader); node tests/all.mjs in a clean tree (read tests/all.mjs and tests/cleantree.sh first); tests/stations.mjs on the quick set at q2, q1 and q0 at 1280x720 and in the iPhone 14 landscape profile with the phone preset, against the baseline and release 1's run (/home/user/.pc-scratch/verify/r1-integrate/stations-q2/): report final land t1/t2, foliage share, draw calls and triangles per station and tier; the Node world bench and simbench as the plan names them, run alone (walk, run, ship at 150 m, arrive: max and allocation per frame); one browser sitting at the top tier (quality 2, 960x540) visiting all ten bodies (window.__pc.teleport({ body, hour: 11 })), recording console errors, page errors, failed requests, window.__pc.errors and info().fallback, frames OPENED.

RETURN: the commit, the test counts, all.mjs step by step, the stations' numbers, the benches, the visit with a line per world, every failure with its output, and what you could not run.`, { label: 'integrate', phase: 'Final checks', schema: INTEG_SCHEMA, ...X })

const phonePlayer = () => agent(`You are a first-time PLAYER on a PHONE, testing a browser game called Painted Cosmos in /home/user/painted-cosmos (git branch r2). You are told nothing about how it was built. Read ONLY README.md (nothing under docs/ or src/ until you have finished playing). Edit no file in the repository; scratch only under /home/user/.pc-scratch/verify/r2-phone/.

HOW TO PLAY HERE: no real phone and no GPU: use Playwright's device emulation (const { chromium, devices } = require('playwright'); devices['iPhone 14 landscape']; hasTouch and isMobile on) with a clean copy of the last commit (tools/export-head.sh <dir>) served by a small static server of your own. Play with TOUCH ONLY (taps and drags; CDP Input.dispatchTouchEvent for drags and holds); no keyboard, no mouse, never call into the game's code or read its state. Rendering is on the CPU and slow: wait as long as it needs. One browser at a time; free -m first; kill processes only by PID. Take screenshots and OPEN them: they are your eyes.

PLAY: start the game; look around; walk; run; jump and use the jetpack; board the ship; lift off; reach space; choose another planet on the map; travel there; then FLY DOWN SLOWLY from about 1 km to the ground, taking a screenshot every 100 to 200 m of height and looking at the ground each time (can you see where you are landing: trees, paths, rocks, clearings, or blurry blobs?); land; step out; walk; open the sketchbook and the help. Try landscape and portrait (also while loading). Note anything that covers what you need to see or touch.

RETURN: the commit; each step with done true or false and the screenshot that shows it; every problem with a severity and where; a verdict on how sharp the ground looks from the ship at each height; console errors seen.`, { label: 'phone-player', phase: 'Final checks', schema: PHONE_SCHEMA, ...X })

const [integration, phone] = await parallel([integrator, phonePlayer])

return { rounds: LANE_ORDER.map((lane, i) => ({ lane, ...(rounds[i] || {}) })), integration, phone }
