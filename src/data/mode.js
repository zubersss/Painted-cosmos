// Painted Cosmos: which look the game is drawn in, for modules that must stay free of three and of the page (the look
// data, the surface: they are also loaded in Node by the tests). OWNER: PAINTER.
// render/shared.js sets `oil` once, when it is loaded, from the address (`?look=oil`); everything else only reads it.
// `wanderer`: the new explorer (bare head, cloak, lantern; it flies by itself, no jetpack: the owner, 2026-11-15). For
// the prototype it comes with the oil look; read this, not `oil`, wherever the explorer's own behaviour is meant.
// `powers`: the elemental powers are on (main.js sets it from the address, ?powers=1, before anything is made; docs/POWERS.md).
// `calm`: a calmer forest floor to compare (render/shared.js sets it from ?floor=calm; data/looks/earth.js).
// `beasts`: THE ANIMALS (the owner, 2026-11-23: "at least 25 different animals in every biome ... animated, with
//   routines, hunting and hunted, fish and birds"). A NUMBER and not a yes-or-no, so the forty kinds can be let in a
//   handful at a time and the owner can be shown A and B of the same still:
//     0  off. No module of the creatures is imported at all, exactly as none of the powers is without ?powers=1.
//     1  THE FIVE, all within sight of where the explorer lands: red deer, red fox, brown hare, grey heron, brown
//        trout -- a herbivore, a hunter, the hunted, a bird, a fish, and two real hunts between them.
//     2  ... and the rest of the wood and the water: raven, boar, wolf, lynx, squirrel, marten, badger, tawny owl,
//        goshawk, kingfisher, teal, otter, beaver, frog, dragonfly, and the five swarms.
//     3  ... and the coast, the mountain and the canyon: the whole forty of data/looks/earth.js `fauna`.
//   Every kind carries its own `stage` saying which number lets it in, so raising the flag never moves an animal
//   that was already standing: it only adds more beside it.
//   THE CREATURES ARE AN OIL-LOOK FEATURE. Each biome's list of animals rides under its `oil.over` (so the live
//   watercolour game cannot see one) and overlayOil below is what lays those lists on, which it only does with the
//   oil look. So ?beasts=1 without ?look=oil finds no animals anywhere, which is the safe way round.
export const MODE = { oil: false, powers: false, calm: false, beasts: 0, water: null, get wanderer() { return this.oil; } };

// THE WATER (group E, docs/lead/WATER-DESIGN.md; the owner, 23-24 Nov: water that runs downhill, pools, rivers that reach the
// sea, lakes, waterfalls, fjords, and water that answers the player and the weather). Every part has its own switch in the
// address, read by waterFromSearch before anything is made (main.js, gallery.js), and none does anything without the oil
// look. `on` is true when any part that changes the WORLD is asked for (rivers, lakes, ponds, puddles, swell, falls,
// fjord): world/waterhooks.js then fetches and attaches those parts, with the drainage field they all stand on (so these
// imply ?flow=1). The paint and the player's parts (wpaint, wakes, splash) are read where they are used.
//   ?rivers=tree   rivers drawn from the drainage field's own flow tree (world/rivers.js); else today's _riversOil
//   ?lakes=1       lake beds in the basins the field fills          ?ponds=1    ponds in flat glades
//   ?puddles=1     puddles that come with rain and dry after it     ?swell=1    streams that rise after rain
//   ?falls=1       waterfalls where rivers meet cliffs              ?fjord=1    fjords at high river mouths
//   ?wpaint=1      the water's new strokes (0, THE DEFAULT for v39.2: v37's;  ?wakes=2    ring waves per pixel (1: v37's)
//                  2: and its new colour, under review)
//   ?splash=1      splashes going in, from footsteps, from a low flight
//   ?runoff=1      the water that comes and goes with the rain: runnels that run in a storm and dry after it, streams and
//                  ponds that rise and fall back (needs ?rivers=tree: the runnels come from the flow tree; world/waterstate.js)
//   ?bends=0       with ?rivers=tree: the wide rivers wander as the streams do, without their S-bends (for the A/B)
//   ?mount=1       with ?rivers=tree: MOUNTAIN STREAMS: torrents down the mountains' flanks into their valleys and on into
//                  the wood's rivers (world/mountain.js; the mountains' own flow, the drainage field as it is)
// A NUMBER or 0 for each: 0 is off.
// THE DEFAULT IN THE OIL LOOK (the owner, 24 Nov: "No do make it look different i give you access": what has passed review
// becomes the default; the coordinator's order): with ?look=oil and nothing said, the rivers of the flow tree (with their
// S-bends) and the lakes, ponds, puddles and fjord are ON, with the drainage field they stand on. Each part builds only on a
// world whose look asks for it (the rivers where there is a wood; world/hydro.js by the look's keys; world/waterhooks.js
// builds nothing on a world without a wood), so only Earth changes. To turn them off: ?rivers=old ?lakes=0 ?ponds=0
// ?puddles=0 ?fjord=0 ?falls=0 -- all six together are the oil look's ground water as it was. The FALLS are on too (the look
// director passed them with the water's paint's curtain fix, 24 Nov: they ship with water-paint, never before it). The
// watercolour game (no ?look=oil): every part of the ground off, exactly as it was. The water's paint (`wpaint`) stays v37's
// (0) until the sea from the air passes the look director; the player's (`wakes`, `splash`) are the paint lane's (above).
// (the object as it stands before waterFromSearch is asked -- a test, a module read on its own -- is the game with no water
//  part; the game and the gallery ask waterFromSearch before anything is made, and with ?look=oil it sets the defaults)
MODE.water = { on: false, rivers: 0, lakes: 0, ponds: 0, puddles: 0, swell: 0, falls: 0, fjord: 0, wpaint: 0, wakes: 1, splash: 0, runoff: 0, bends: 1, mount: 0, farwater: 0 };
export function waterFromSearch(search) {
  const W = MODE.water;
  let q;
  try { q = new URLSearchParams(search || ''); } catch { return W; }
  const n = (k, d) => { if (!q.has(k)) return d; const v = q.get(k); if (v === 'tree') return 1; const x = parseInt(v, 10); return isFinite(x) ? x : d; };
  const oil = q.get('look') === 'oil', d = oil ? 1 : 0, rv = q.get('rivers');      // (the oil look's defaults: above)
  W.rivers = rv === 'tree' ? 1 : rv === 'old' || rv === '0' ? 0 : d;
  W.lakes = n('lakes', d); W.ponds = n('ponds', d); W.puddles = n('puddles', d); W.swell = n('swell', 0);
  W.falls = n('falls', d); W.fjord = n('fjord', d);
  W.wpaint = n('wpaint', 0);      // (the coordinator, 24 Nov 12:40: v37's strokes stay the default for v39.2 -- the look director
                                  //  found the sea from the air a blocky checker with ?wpaint=1 and 2; ?wpaint=1 for the new strokes)
  W.wakes = n('wakes', 1); W.splash = n('splash', 0); W.runoff = n('runoff', 0); W.bends = n('bends', 1); W.mount = n('mount', 0);
  // (?farwater=1: the rivers drawn into the far ground as a line from the signed distance to their centre, so that from
  //  1 km up a river narrower than the ground's vertices lie apart still reads; a paint switch, it changes no ground)
  W.farwater = n('farwater', 0);
  W.on = !!(W.rivers || W.lakes || W.ponds || W.puddles || W.swell || W.falls || W.fjord || W.runoff || W.mount);
  return W;
}

// THE OIL LOOK'S OWN CONTENT, laid over the looks ONCE when the look is switched on (render/shared.js calls this; with
// the look off nothing is touched, so the default game's worlds are what they were). A look may name kinds of tall
// plant that exist only in the oil look (`flora.tallOil`: appended to `flora.tall`), and a biome may change any of
// its own fields for it (`oil.over`; in it `tallOil: [a, b]` names two of the look's oil-only kinds, as `tall` names
// two of its kinds). First use: the firs and bare trees of Neptune's snowfield (the owner, 2026-11-16).
// A look may also give some of its hand-placed sites another biome for the oil look (`oil.sites`: { index: biome id }):
// Earth's first site, where the explorer lands, is the AUTUMN wood in the oil look (the owner's references for the
// wood are all of autumn, and the first play of the look on a phone landed in the green wood: 2026-11-16).
export function overlayOil(LOOKS) {
  for (const id of Object.keys(LOOKS)) {
    const L = LOOKS[id];
    if (!L || L._oilLaid) continue;
    L._oilLaid = true;
    const base = L.flora && L.flora.tall ? L.flora.tall.length : 0;
    if (L.flora && L.flora.tallOil) L.flora.tall = (L.flora.tall || []).concat(L.flora.tallOil);
    if (L.oil && L.oil.sites && L.sites) for (const k of Object.keys(L.oil.sites)) if (L.sites[+k]) L.sites[+k] = [L.sites[+k][0], L.sites[+k][1], L.oil.sites[k]];
    for (const b of L.biomes || []) {
      const o = b.oil && b.oil.over;
      if (!o) continue;
      Object.assign(b, o);
      // (?floor=calm: a look's calmer variant of the same fields, for a side-by-side the owner chooses from)
      if (MODE.calm && b.oil.overCalm) Object.assign(b, b.oil.overCalm);
      if (o.tallOil) { b.tall = o.tallOil.map((k) => base + k); delete b.tallOil; }
    }
  }
}

