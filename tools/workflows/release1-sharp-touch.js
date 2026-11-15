export const meta = {
  name: 'sharp-touch-r1',
  description: 'First release of the sharper/smoother/mobile plan: the measuring stick and a green suite (W1), sharp from the ship (W2), playable by touch on a phone and a tablet (W3); each lane verified adversarially and re-fixed once; then every check and an emulated phone play-through',
  phases: [
    { title: 'Build', detail: 'PILOT lane: W1 gate, then W3 touch in two parts; PAINTER lane: W2 sharpness in two parts; own paths only' },
    { title: 'Verify', detail: 'an independent, adversarial verifier per lane on clean exports' },
    { title: 'Re-fix', detail: 'what failed verification goes back to the lane, once' },
    { title: 'Final checks', detail: 'every check on the final head; a touch-only play-through in phone emulation' },
  ],
}

const CTX = [
  'PROJECT: Painted Cosmos, /home/user/painted-cosmos, git branch cosmos (main is the live game, https://zubersss.github.io/Painted-cosmos/). A calm single-player browser exploration game: walk, jetpack, board a ship, fly seamlessly from the ground to space and to every planet, land, explore; vistas and a sketchbook. Three.js r187 vendored, WebGL2, plain ES modules with an import map, no build step.',
  'THE OWNER\'S REQUEST after playing the live game: much sharper (above all the ground seen from the ship: "i want to be able to fly above them and see where im landing not some blurry blobs"), much smoother, playable on mobile, "without losing the quality at all"; "you dont have to focus on the water color aspect anymore it looks good". THE PLAN is docs/lead/SHARP-SMOOTH-PLAN.md (read section 0, section 2 "Lead rulings", section 5 "The quality guard", and your workstream in section 4 in full). It rests on three audits whose evidence is under /home/user/.pc-scratch/audit/ (sharp/: the station harness in bin/ (live.mjs, inpage.js, stations.py, metrics.py, exp.py), frames, logs/summary-q2.txt with the baseline numbers; perf/; mobile/; plan/repro/). This is RELEASE 1: W1, W2 and W3 only; later releases do the rest.',
  'ROLES AND OWNERSHIP: PAINTER owns rendering (src/render, src/world, src/art, src/data/looks, docs/notes/painter.md, docs/shots/painter). PILOT owns systems, play, UI, input, the controller and tiers\' policy, tests (index.html, src/main.js, src/core, src/player, src/ship, src/space, src/ui, src/audio, tests, README.md, docs/notes/pilot.md, docs/shots/pilot, docs/lead). PHYSICS owns src/physics. You act in ONE role, named below. Edit only that role\'s paths; for another role\'s files write the exact change in your role\'s notes. Commit only with: tools/commit.sh <role> "message" (no model names in messages). The coordinator sometimes sweeps uncommitted files into "WIP snapshot" commits; if yours were swept, say so in your next commit message.',
  'THE MACHINE: 4 CPUs, NO GPU: headless Chromium (pre-installed Playwright; tools/shot.mjs and tests/browser.mjs; window.__pc is the debug handle) renders WebGL on the CPU (SwiftShader), so browser frame times are not a GPU\'s: count work (draw calls, triangles, texture taps per pixel) and time JS separately. Another agent works beside you: at most ONE browser of yours at a time, closed as soon as its frames are taken; never two Node test suites at once; free -m before a browser. Kill processes only by PID. Scratch ONLY under /home/user/.pc-scratch/<your role>/r1/; delete your own exports when done. A clean copy of the last commit: tools/export-head.sh <dir>. The container restarts without warning (four times so far): commit each finished item at once and keep the hand-over at the top of your notes current after each item, so a successor can continue from the repository alone.',
  'CHECKS (on a clean export, before every commit of code): node --test src/world/*.test.mjs (30 pass at the start), node --test tests/*.test.mjs (208), node --test src/physics/ (325); node src/physics/coast.mjs PASS at both stands; node docs/lead/evidence/review7/ghostfield.mjs all zeros; the game loads with no console error and window.__pc.info().fallback empty. The quality guard of the plan (section 5) for anything that touches the picture: frames at the fixed stations before and after, OPENED, and the numbers.',
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
  properties: { commit: { type: 'string' }, tests: { type: 'string' }, allMjs: { type: 'string' }, stations: { type: 'string' }, visit: { type: 'string' }, failures: { type: 'array', items: { type: 'string' } }, notRun: { type: 'string' } },
  required: ['commit', 'tests', 'allMjs', 'failures'],
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
    ['pilot:gate', 'Part 1 of 3 of your lane (the lane is W1, then W3).', 'DO W1 of the plan (W1.1 the station harness tests/stations.mjs with its in-page metric module, ported from the sharpness audit\'s harness, reproducing the baseline numbers the plan names; W1.2 restore the painted-trip test fixes from history (1c406e2, d874a8c: the per-leg bump count; on "Too steep" fly on 100 to 150 m), add coast and ghostfield steps to tests/all.mjs). Then node tests/all.mjs --only painted-trip three times (each must pass) and node tests/all.mjs once in a clean tree (ALL PASSED). PAINTER\'s lane works in parallel and will use your harness once it is committed: commit it as early as it reproduces the baseline, and write in your notes how to run a station set.'],
    ['pilot:touch-a', 'Part 2 of 3 of your lane: W3.1 and W3.2.', 'DO W3.1 (the gesture guard and touch input: src/core/touch.js new, input.js, index.html, theme.css, tests/touch.mjs and tests/touch.test.mjs new) and W3.2 (the touch HUD: prompt slips as buttons in the right-thumb arc, JUMP/RISE, SINK, BRAKE, PULSE, LAND, the top-left tabs for MAP, SKETCHBOOK, HELP, VIEW, panels that close by touch), with the plan\'s acceptance in Playwright device emulation (iPhone 14, Pixel 7, iPad Pro 11, landscape; CDP touch events). Desktop play must be unchanged (no touch layer without a coarse pointer and touch; every existing test green). Read the hand-over of part 1 at the top of docs/notes/pilot.md first.'],
    ['pilot:touch-b', 'Part 3 of 3 of your lane: W3.3, W3.4 and W3.5.', 'DO W3.3 (phone layouts and words: the map, book and help readable on a phone; no touch-mode string names a key or the mouse; desktop strings unchanged), W3.4 (platform: fullscreen on the first touch where allowed, a landscape lock attempt, the manifest without icon files, wake lock, iPad and phone portrait field of view) and W3.5 (the phone and tablet preset, part 1: the DPR cap and pixel cap, the start tier; the read-out names the preset). Then tests/touch.mjs plays the whole loop by touch only in iPhone 14 landscape emulation, on the stubs and in the painted world at quality 0 (walk to the ship, board, lift off, climb, map, choose Mars, set course, pulse, descend, land, step out, book, help). README: a section for phones and tablets with the touch controls. Read the hand-overs of parts 1 and 2 first. End with node tests/all.mjs in a clean tree: ALL PASSED.'],
  ],
  PAINTER: [
    ['painter:sharp-a', 'Part 1 of 2 of your lane (the lane is W2).', 'DO W2.1 (prefilter the procedural marks by the pixel footprint, so the far ground is not aliased noise once the brush stops hiding it) and W2.2 (reverse the abstraction brush: it shrinks with distance and lets the scene through far away; the radius in internal pixels, capped; skip the sector taps where keep is 1; the edge wobble only on edges and the border, not on interiors), to the plan\'s acceptance at the stations (land t2 at least 0.95 and t1 at least 0.9 at every 150 m, 400 m and 1 km station on Earth, Mars and Saturn at q2; on foot t1 at least 0.6, t2 at least 0.85; the look\'s palette, paper and washes kept). Until PILOT commits tests/stations.mjs (W1.1, in parallel), use the sharpness audit\'s harness in /home/user/.pc-scratch/audit/sharp/bin/ (copy it into your scratch; it takes a tree as its root). Before and after contact sheets at q2 1280x720 for every station, OPENED, kept in docs/shots/painter/r1/.'],
    ['painter:sharp-b', 'Part 2 of 2 of your lane: W2.3, W2.4 and W2.5.', 'DO W2.3 (free wins: undergrowth and grass cells not built or drawn beyond their range at any altitude; the forced recursive matrix updates; to the plan\'s draw-call and triangle acceptance with every station\'s frame within 2/255), W2.4 (post savings with an identical picture: the paper reads baked per resize, the backdrop pass removed, the keep pass only when needed; every station within 1/255) and W2.5 (anti-aliasing: MSAA on the scene target at tiers 2 and 1 on desktop, with a rule that keeps the region id honest through the resolve (averaged sky and foliage must not read as water); the plan\'s aliasing index acceptance; if MSAA cannot be made safe, a light post AA on edges, never a blur). Read the hand-over of part 1 at the top of docs/notes/painter.md first, and use tests/stations.mjs if PILOT has committed it. Before and after sheets OPENED, kept in docs/shots/painter/r1/.'],
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

const verifyPrompt = (lane, reports) => `${CTX}

YOUR ROLE: an independent VERIFIER (no role; you edit no file in the repository; scratch only under /home/user/.pc-scratch/verify/r1-${lane.toLowerCase()}/). The ${lane} lane of release 1 has reported (below). Try to REFUTE each claimed item against the plan's acceptance (docs/lead/SHARP-SMOOTH-PLAN.md) and find what it broke.

THE LANE'S REPORTS:
${JSON.stringify(reports, null, 1)}

For each item: reproduce the before on the lane's first firstCommitParent when cheap (git archive <commit> | tar -x -C <dir>), check the after on a clean export of the head (tools/export-head.sh <dir>), run the named tests and measures yourself, OPEN the frames. ${lane === 'PAINTER' ? 'In particular: the stations from the ship (150 m, 400 m, 1 km on Earth, Mars, Saturn) at q2, and at q1 and q0; shimmer and aliasing in motion (two frames with a small pan); night, dusk, storm and on foot for anything that got worse; the region view at sky and foliage edges (no false water); draw calls and triangles.' : 'In particular: play by touch only in Playwright emulation (iPhone 14 and Pixel 7 landscape, iPad Pro 11) from the title card to landing on another world and stepping out; a pinch or a drag must not zoom or pan the page; then play on desktop with keys and mouse to see nothing changed there; the painted-trip step three times; tests/stations.mjs reproducing the baseline.'} holds = false unless you ran or opened something that shows it; say exactly what you ran.

THEN, on the clean head: the three unit suites, coast.mjs, ghostfield.mjs; load the game once on desktop and once in phone emulation and report console errors and window.__pc.info().fallback. List every regression with the command or frame that shows it.

RETURN: role "${lane}", the commit you verified, a verdict per item, the regressions, the test counts.`

const refixPrompt = (lane, reports, ver) => `${CTX}

YOUR ROLE: ${lane}, the RE-FIX pass of release 1's ${lane} lane. An independent verifier did not accept everything. Fix exactly these, each with proof, and nothing else; if you judge a finding wrong, show why with a measurement or a frame; if a change cannot be made safe now, revert it and say so. Read the lane's hand-overs at the top of your notes first.

THE LANE'S COMMITS: ${JSON.stringify(reports.map((r) => r && r.commits))}

NOT ACCEPTED:
${JSON.stringify((ver.verdicts || []).filter((v) => !v.holds), null, 1)}

REGRESSIONS FOUND:
${JSON.stringify(ver.regressions || [], null, 1)}

${lane === 'PILOT' ? 'End with node tests/all.mjs in a clean tree: ALL PASSED. ' : ''}Update the hand-over at the top of your notes. RETURN as before (role, commits, fixed with proof, notFixed with why, tests, forOthers).`

const rounds = await pipeline(
  ['PILOT', 'PAINTER'],
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

YOUR ROLE: an independent INTEGRATOR (no role; you edit no file in the repository; scratch only under /home/user/.pc-scratch/verify/r1-integrate/). Release 1 is built. Prove what the final head does on a clean export (name the commit).

RUN, one at a time: the three unit suites, coast.mjs, ghostfield.mjs, wallrun.mjs (earth sea_coast); every module under src/ loads alone in Node without "before initialization" (map the bare 'three' import to vendor/three/three.module.js with a loader); node tests/all.mjs in a clean tree (read tests/all.mjs and tests/cleantree.sh first); tests/stations.mjs on the quick set at q2 against the baseline in docs/lead/SHARP-SMOOTH-PLAN.md and the sharpness audit's logs/summary-q2.txt (report the numbers: before and after, land t1/t2 per station); one browser sitting at the top tier (quality 2, 960x540) visiting all ten bodies (window.__pc.teleport({ body, hour: 11 })), recording console errors, page errors, failed requests, window.__pc.errors and info().fallback, and frames you OPEN (say in one line each whether the ground is sharp and the picture still reads as painted).

RETURN: the commit, the test counts, all.mjs step by step, the stations' numbers, the visit with a line per world, every failure with its output, and what you could not run.`, { label: 'integrate', phase: 'Final checks', schema: INTEG_SCHEMA, ...X })

const phonePlayer = () => agent(`You are a first-time PLAYER on a PHONE, testing a browser game called Painted Cosmos in /home/user/painted-cosmos (git branch cosmos). You are told nothing about how it was built. Read ONLY README.md (nothing under docs/ or src/ until you have finished playing). Edit no file in the repository; scratch only under /home/user/.pc-scratch/verify/r1-phone/.

HOW TO PLAY HERE: no real phone and no GPU: use Playwright's device emulation (const { chromium, devices } = require('playwright'); devices['iPhone 14 landscape'] or devices['iPhone 14'] with a landscape viewport; hasTouch and isMobile on) with a clean copy of the last commit (tools/export-head.sh <dir>) served by a small static server of your own. Play with TOUCH ONLY (taps and drags; Playwright's touchscreen.tap, or CDP Input.dispatchTouchEvent for drags and holds); no keyboard, no mouse, never call into the game's code or read its state. Rendering is on the CPU and slow (1 to 3 frames a second): wait as long as it needs. One browser at a time; free -m first; kill processes only by PID. Take screenshots and OPEN them: they are your eyes.

PLAY: start the game; look around; walk; run; jump and use the jetpack; find and board the ship; lift off; reach space; open the map and choose another planet; travel there; fly down and look at the ground from the ship (can you see where you are landing, or is it blurry blobs?); land; step out; walk; open the sketchbook and the help. Try landscape and portrait. Also try a pinch and a two-finger drag: the page must not zoom or scroll.

RETURN: the commit; each step of that loop with done true or false and the screenshot that shows it; every problem with a severity and where; a verdict on how sharp the ground looks from the ship; console errors seen.`, { label: 'phone-player', phase: 'Final checks', schema: PHONE_SCHEMA, ...X })

const [integration, phone] = await parallel([integrator, phonePlayer])

return { rounds: ['PILOT', 'PAINTER'].map((lane, i) => ({ lane, ...(rounds[i] || {}) })), integration, phone }
