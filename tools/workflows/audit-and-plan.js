export const meta = {
  name: 'sharp-smooth-mobile-plan',
  description: 'Understand and plan: measure what blurs the picture (above all the ground seen from the ship), where each frame\'s time goes and what is built that need not be, and what a phone meets today; then the lead developer\'s plan with owners and measurable acceptance',
  phases: [
    { title: 'Audit', detail: 'three read-only audits in the real game and in Node: sharpness, performance and streaming, mobile' },
    { title: 'Plan', detail: 'the lead developer turns the audits into one plan, by owner, with acceptance measures' },
  ],
}

const CTX = [
  'PROJECT: Painted Cosmos, /home/user/painted-cosmos, git branch cosmos (main is the live game, https://zubersss.github.io/Painted-cosmos/, the same code). A calm single-player browser exploration game: walk, jetpack, board a ship, fly seamlessly from the ground to space and to every planet, land, explore; vistas and a sketchbook. Three.js r187 vendored (vendor/), WebGL2, plain ES modules with an import map, no build step. Rendering: scene into multiple render targets, then a watercolour post pipeline (a Kuwahara-type abstraction pass, a sheet pass, a glaze pass, paper), a dynamic-resolution controller and quality tiers 0/1/2 (README.md "Is it fast enough on my machine?" and "URL parameters"). Terrain: cube-sphere quadtree with floating origin. Read README.md, the tops of docs/notes/painter.md, docs/notes/pilot.md and docs/notes/physics.md, and the last section of docs/COORDINATOR.md.',
  'THE OWNER\'S NEW REQUEST, after playing the live game (verbatim): "i dont like how blurry thing look when im flying above them and a buch of things just look blurry optimize it better maybe load certain parts of the map only when im on them and ignore the rest idk figure out a solution to make things a lot sharper and smoother also i can play it on mobile fix that as well i want to be able to fly above them and see where im landing not some blurry blobs you dont have to focus on the water color aspect anymore it looks good just make it sharper and smoother figure out the best solution to make thing sharper and smoother without losing the quality at all". The coordinator\'s rulings: sharpness and smoothness now come before the watercolour abstraction (palette, paper and washes stay; nothing may smear detail into blobs, least of all the ground seen from the ship); the top tier keeps or gains detail (save cost by working smarter, not by drawing less where it is seen); "i can play it on mobile" means the game must become playable on a phone and a tablet.',
  'THE MACHINE: 4 CPUs, NO GPU: headless Chromium (pre-installed Playwright; require(\'playwright\') works; tools/shot.mjs and tests/browser.mjs are the project\'s helpers; window.__pc is the game\'s debug handle: teleport, info(), painter, world, physics) renders WebGL on the CPU, so frame times in the browser are NOT a real GPU\'s: measure GPU work by what is drawn (passes, their resolution, texture reads per pixel from the shaders, draw calls and triangles from renderer.info, overdraw) and JS time separately (performance.now around the world, physics and sim steps). At most ONE browser of yours at a time, closed when its frames are taken; never two Node test suites at once; free -m before a browser. Kill processes only by PID. You EDIT NO FILE in the repository: experiments are live patches in the page (shader source swaps, uniform changes, toggled passes) or edits inside your own clean export (tools/export-head.sh <dir>) under your scratch directory. The container may restart without warning: write your findings to your scratch directory as you go.',
  'RULES: Work autonomously; never ask anyone a question. Never claim a picture looks a way unless you opened it, or a number unless you measured it; say plainly what you could not measure. Do not open a pull request. Do not use or look for the owner\'s other projects or past chats.',
].join('\n\n')

const AUDIT_SCHEMA = {
  type: 'object',
  properties: {
    commit: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          rank: { type: 'integer' },
          title: { type: 'string' },
          cause: { type: 'string', description: 'file and function, with the mechanism' },
          measured: { type: 'string', description: 'the numbers and the frames (paths) that show it' },
          fix: { type: 'string', description: 'the concrete change proposed, and its expected effect and cost' },
          owner: { type: 'string', enum: ['PAINTER', 'PILOT', 'PHYSICS'] },
          risk: { type: 'string' },
        },
        required: ['rank', 'title', 'cause', 'measured', 'fix', 'owner'],
      },
    },
    evidence: { type: 'string', description: 'directory of frames, logs and scripts' },
    notMeasured: { type: 'string' },
  },
  required: ['findings', 'evidence', 'notMeasured'],
}

const X = { effort: 'xhigh' }

const sharpness = () => agent(`${CTX}

YOUR TASK: the SHARPNESS AUDIT (scratch: /home/user/.pc-scratch/audit/sharp/). Find every cause of blur in the picture and measure how much each costs in sharpness, above all for the ground seen from the ship.

1. Stations (record exact positions so others can repeat them): Earth's spawn forest and Mars' canyon, each on foot, and from the ship hovering at 50 m, 150 m, 400 m and 1 km looking down at 45 degrees and straight down; also one Saturn or Jupiter station from 150 m. Take frames at the top tier pinned (?quality=2&scale=1&dynres=0) at 1280x720, and the same at what the controller picks by itself on this machine, and at quality 1 and 0. OPEN them. Build contact sheets.
2. A sharpness measure per frame and per region (for example the variance of the Laplacian, or the energy above a spatial frequency, over the ground area), so that each experiment gives a number as well as a picture.
3. Experiments, one at a time, by live patches in the page: each post pass off in turn (the abstraction pass above all: its radius, and whether it scales with distance or altitude), the paper and the edge wobble, the glaze; the render scale and each tier's share of resolution; anti-aliasing and how the final image is enlarged (filtering, any blur in upscaling); texture filtering on the ground (mipmaps, anisotropy: renderer.capabilities.getMaxAnisotropy()); the terrain's LOD rule as seen from altitude (the quadtree's split distance or screen-space error, the patch resolution, vertex colours versus a texture: what detail of colour the ground can carry at all); far vegetation (the far and middle forms that read as blobs from the air) and how far each detail ring reaches; fog, aerial perspective and the fade toward paper with altitude; the depth precision (log depth) if it shows. For each: sharpness number before and after, the frame pair, its cost (extra or saved work: pixels times texture reads, triangles, draw calls), and the honest look of it.
4. The best-practice remedies to weigh, measured where you can: an edge-adaptive sharpening pass after any enlargement (contrast-adaptive sharpening, FSR1-type EASU plus RCAS), an abstraction radius that shrinks with distance and altitude, the post pipeline at full resolution where it matters, ground texture detail and anisotropic filtering, a finer terrain LOD rule from the air with morphing, impostors for far trees instead of blobs, MSAA or a light post AA instead of blur.

RETURN the findings ranked by how much sharpness each fix buys a player flying over the land (with what it costs), the evidence directory, and what you could not measure.`, { label: 'audit:sharpness', phase: 'Audit', schema: AUDIT_SCHEMA, ...X })

const performance = () => agent(`${CTX}

YOUR TASK: the PERFORMANCE AND STREAMING AUDIT (scratch: /home/user/.pc-scratch/audit/perf/). Find where each frame's time goes and what is built, kept or drawn that need not be, so the game can be much smoother on a real machine and on a phone without drawing less where the player looks.

1. GPU work, by pass: for each render target and post pass, its resolution, format and the texture reads and arithmetic per pixel read from the shader source; the scene's draw calls and triangles (renderer.info) at the same stations as a sharpness auditor would use (Earth's spawn on foot; the ship at 150 m and 1 km over Earth's forest; Mars' canyon; space); overdraw of grass, foliage and particles; shadow maps if any; how many full-screen passes a frame takes and which could be merged, run at lower resolution without visible loss, or skipped when nothing changed.
2. CPU work: JS time per frame for the sim, PHYSICS (window.__pc.info and the frame read-out's world and physics lines), the world builder (terrain patches, flora scattering, near ground), the HUD and layout, measured in the page with performance.now and in Node (the Sim runs there: see tests/ and docs/lead/evidence/ for instruments); long tasks and hitches (frames over 50 ms of JS) while walking, flying low at speed, and arriving at a world; garbage (allocations per frame).
3. STREAMING, the owner's question "load certain parts of the map only when I'm on them": what the game builds and keeps today (other planets' terrain and flora while you are on Earth? patches behind you? far detail rings when flying high?); how terrain patches and flora are built (main thread or worker, budget per frame, caching); what would move to a Web Worker (patch geometry, flora placement), what a per-frame build budget and a cache would give, and what can be released when far.
4. The dynamic-resolution controller and the tiers: when they drop the picture's resolution on a real machine, and whether a cheaper pipeline would let a laptop's built-in graphics keep full resolution at 60 frames a second (estimate from the pixel and fetch counts against a typical integrated GPU's fill rate, stating the assumption).

RETURN the findings ranked by how much smoother each fix makes the game on a laptop's built-in graphics and on a phone (with its risk), the evidence directory, and what you could not measure.`, { label: 'audit:performance', phase: 'Audit', schema: AUDIT_SCHEMA, ...X })

const mobile = () => agent(`${CTX}

YOUR TASK: the MOBILE AUDIT (scratch: /home/user/.pc-scratch/audit/mobile/). Find what stops the game being playable on a phone and a tablet today, and what it needs.

1. Load the game with Playwright's device emulation (devices['iPhone 14'], devices['Pixel 7'] in landscape and portrait, devices['iPad Pro 11'] landscape; hasTouch and isMobile on) and OPEN the frames: the loading sheet, the title card, the first view, the HUD and prompts, the help card, the map, the sketchbook. Try to play with touch only (taps, drags, two fingers): can you start, look, walk, jump, board, fly, choose a world on the map, land? Record exactly where it fails.
2. Read the code for every input path (src/core/input.js and wherever pointer lock, keys, the gamepad and the mouse are read), the HUD layout (src/ui), the viewport meta and the page's CSS (page scroll, zoom, safe areas, orientation), audio unlock, fullscreen.
3. A phone's GPU and memory: the render targets and their formats at a phone's size and device pixel ratio (for example 2532x1170 at DPR 3), the float render target fallback (painter.floatFallback), texture memory, what the dynamic-resolution controller would do; what a phone preset must be (pixel budget, DPR cap, tier) to hold 30 to 60 frames a second, estimated from the pixel and fetch counts and stated as an estimate.
4. What touch controls this game needs, designed for it: on foot (a move stick on the left, look by dragging on the right, run, jump and jetpack, E, V), in the ship (throttle, turn and nose, rise and sink, brake, land, pulse, map), anywhere (sketchbook, help, map), and how prompts name touch buttons instead of keys; where on the screen they go so they do not cover the subject; landscape first, portrait handled.

RETURN the findings ranked by what most blocks a phone player (with the fix and its owner), the evidence directory, and what you could not test (a real phone, a real mobile GPU, iOS Safari itself).`, { label: 'audit:mobile', phase: 'Audit', schema: AUDIT_SCHEMA, ...X })

// Each audit's findings feed the plan; the plan needs all three (a barrier is right here).
const [sharp, perf, mob] = await parallel([sharpness, performance, mobile])
log(`audits: sharpness ${sharp ? sharp.findings.length : 'none'}, performance ${perf ? perf.findings.length : 'none'}, mobile ${mob ? mob.findings.length : 'none'} findings`)

phase('Plan')
const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    workstreams: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          owner: { type: 'string', enum: ['PAINTER', 'PILOT', 'PHYSICS'] },
          title: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                order: { type: 'integer' },
                change: { type: 'string', description: 'what to change, in which files' },
                acceptance: { type: 'string', description: 'the measurement or frame that proves it, with the threshold' },
                risk: { type: 'string' },
              },
              required: ['order', 'change', 'acceptance'],
            },
          },
          dependsOn: { type: 'string' },
        },
        required: ['owner', 'title', 'items'],
      },
    },
    qualityGuard: { type: 'string', description: 'how "without losing the quality at all" is checked: frames and numbers at fixed stations before and after' },
    notPossibleHere: { type: 'string' },
  },
  required: ['summary', 'workstreams', 'qualityGuard', 'notPossibleHere'],
}

const plan = await agent(`${CTX}

YOUR ROLE: PILOT, the lead developer (last word on feel, performance and architecture), writing THE PLAN for the owner's request from three independent audits. PAINTER owns rendering (src/render, src/world, src/art, src/data/looks) and has the last word on look; PILOT owns systems, play, UI, input, the controller and tiers' policy, tests (index.html, src/main.js, src/core, src/player, src/ship, src/space, src/ui, src/audio, tests, README.md); PHYSICS owns src/physics. You edit no file; scratch /home/user/.pc-scratch/audit/plan/.

THE AUDITS:
SHARPNESS: ${JSON.stringify(sharp, null, 1)}

PERFORMANCE AND STREAMING: ${JSON.stringify(perf, null, 1)}

MOBILE: ${JSON.stringify(mob, null, 1)}

Check the claims that matter most yourself (read the code they name; reproduce a number or open a frame where a claim is surprising). Then write the plan: workstreams by owner, items in order, each with the files, the acceptance measure and threshold, and its risk. The plan must (1) make the ground seen from the ship sharp enough to see where one lands, at every tier; (2) make the game smoother on a laptop's built-in graphics and on a phone, with streaming and building that does not stall frames; (3) make the game fully playable by touch on a phone and a tablet; (4) keep or gain detail at the top tier (say exactly how that is guarded: fixed stations, frames and numbers before and after); (5) keep every existing check green (tests/all.mjs, the unit suites, coast.mjs, ghostfield.mjs, the grand tour). Prefer proven techniques. Order the work so the biggest gains land first and each step is shippable on its own. Save the plan as /home/user/.pc-scratch/audit/plan/PLAN.md as well.

RETURN the plan.`, { label: 'plan', phase: 'Plan', schema: PLAN_SCHEMA, ...X })

return { sharp, perf, mob, plan }
