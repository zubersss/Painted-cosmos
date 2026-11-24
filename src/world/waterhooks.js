// Painted Cosmos: WHERE THE WATER'S PARTS ARE FETCHED, ATTACHED AND STEPPED. OWNER: PAINTER (the water group, lane 0).
//
// docs/lead/WATER-DESIGN.md, section 5.0. The water is built in four lanes on separate files (rivers, the bodies of water,
// the paint, the player and the world). This file is the one place the game asks for them, so no lane edits a file
// another lane or group owns:
//   loadWater()          fetch the parts the address asks for (data/mode.js MODE.water); call it once, awaited, before the
//                        world is made (main.js, art/gallery.js). Nothing of the water is fetched without a switch.
//   ensureWater(bodyId)  attach them to a world's surface: the drainage field first (world/drainage.js), then the rivers
//                        (world/rivers.js attachRivers) and the lakes, ponds, puddles, mouths and fjords
//                        (world/hydro.js attachHydro). Builds once a world and then costs nothing; it must run BEFORE that
//                        world's first terrain patch (a patch built earlier keeps the old ground and will not meet its
//                        neighbours), so main.js calls it for the first world and world/index.js for every world the eye
//                        arrives at, at the top of its frame.
//   frame(st, dt, camL, lighting, physics)  the water's own frame for the world the eye is on (world/index.js, once a frame):
//                        every part in WATER_PARTS is stepped. A part registers itself from its own module when it is loaded:
//                          WATER_PARTS.push({ name, update(ctx) })   ctx = { st, bodyId, root, body, dt, camL, lighting, physics }
//                        (physics: PHYSICS' facade when the game runs one, else null: its fields.rain is the weather's rain)
//   WATER_BENCH          rows for the speed test's two water views (core/bench.js): a part pushes
//                          { name, view: 'bank' | 'shore', on: () => ..., off: () => ... }
//                        and the test times it against that view's own "as set" row. So a lane adds its own rows without
//                        touching core/bench.js.
import { MODE } from '../data/mode.js';

export const WATER_PARTS = [];
export const WATER_BENCH = [];

let DR = null, RIV = null, HYD = null, MT = null, loaded = null;
const attached = new Set();

// The parts of the WORLD the address asks for (the paint's and the player's parts are read where they are used).
function wants() {
  const W = MODE.water || {};
  return { rivers: !!W.rivers, hydro: !!(W.lakes || W.ponds || W.puddles || W.falls || W.fjord), falls: !!W.falls, runoff: !!W.runoff, mount: !!(W.mount && W.rivers) };
}

export function loadWater() {
  if (loaded) return loaded;
  const W = MODE.water;
  if (!W || !W.on || !MODE.oil) { loaded = Promise.resolve(false); return loaded; }
  const w = wants();
  const one = (p) => import(p).catch((e) => { console.warn('water: ' + p + ' did not load', e); return null; });
  loaded = Promise.all([
    one('./drainage.js'),
    w.rivers ? one('./rivers.js') : null,
    w.hydro ? one('./hydro.js') : null,
    w.falls ? one('./falls.js') : null,      // (it registers itself in WATER_PARTS when it loads)
    w.runoff ? one('./waterstate.js') : null, // (so does the runoff's hydrograph)
    w.mount ? one('./mountain.js') : null,    // (the mountain streams: prepared before the rivers, below)
  ]).then(([d, r, h, , , m]) => { DR = d; RIV = r; HYD = h; MT = m; return true; });
  return loaded;
}

// Attach the parts to one world. Safe to call every frame: after the first call for a world it is one Set lookup.
export function ensureWater(bodyId) {
  if (!DR || attached.has(bodyId)) return;
  attached.add(bodyId);
  try {
    const drain = DR.ensureDrainage(bodyId);
    if (!drain) return;                                  // a world with no liquid: nothing of the water attaches
    const S = drain.S;
    if (MT && MT.prepareMountain) MT.prepareMountain(S);   // (the alpine meadow joins the streams' group before they are drawn)
    if (RIV && RIV.attachRivers) RIV.attachRivers(S, drain);
    if (HYD && HYD.attachHydro) HYD.attachHydro(S, drain, S.rivers);
  } catch (e) { console.warn('water: the parts did not attach to ' + bodyId, e); }
}

const _ctx = { st: null, bodyId: '', root: null, body: null, dt: 0, camL: null, lighting: null, physics: null };
export function frame(st, dt, camL, lighting, physics) {
  if (!WATER_PARTS.length || !st) return;
  _ctx.st = st; _ctx.bodyId = st.id; _ctx.root = st.root; _ctx.body = st.body; _ctx.dt = dt; _ctx.camL = camL; _ctx.lighting = lighting;
  _ctx.physics = physics || null;
  for (const p of WATER_PARTS) {
    try { p.update(_ctx); } catch (e) { if (!p._warned) { p._warned = true; console.warn('water: ' + p.name + ' failed', e); } }
  }
}
