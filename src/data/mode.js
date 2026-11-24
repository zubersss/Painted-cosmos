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
//   ?wpaint=1      the water's new strokes on rivers, ponds and lakes (the default; 0: v37's;  ?wakes=2  ring waves per pixel
//                  2: and its new colour)                                                  (1: v37's, per vertex)
//   ?wsea=0        the same for the sea and the water at its level (0: v37's, the default; without it, as ?wpaint= says
//                  when that is given: ?wpaint=0 is v37's water everywhere, ?wpaint=2 the new paint everywhere)
//   ?splash=1      splashes going in, from footsteps, from a low flight
//   ?runoff=1      the water that comes and goes with the rain: runnels that run in a storm and dry after it, streams and
//                  ponds that rise and fall back (needs ?rivers=tree: the runnels come from the flow tree; world/waterstate.js)
// A NUMBER or 0 for each: 0 is off, which is exactly the game as it was.
MODE.water = { on: false, rivers: 0, lakes: 0, ponds: 0, puddles: 0, swell: 0, falls: 0, fjord: 0, wpaint: 1, wsea: 0, wakes: 1, splash: 0, runoff: 0 };
export function waterFromSearch(search) {
  const W = MODE.water;
  let q;
  try { q = new URLSearchParams(search || ''); } catch { return W; }
  const n = (k, d) => { if (!q.has(k)) return d; const v = q.get(k); if (v === 'tree') return 1; const x = parseInt(v, 10); return isFinite(x) ? x : d; };
  W.rivers = q.get('rivers') === 'tree' ? 1 : 0;
  W.lakes = n('lakes', 0); W.ponds = n('ponds', 0); W.puddles = n('puddles', 0); W.swell = n('swell', 0);
  W.falls = n('falls', 0); W.fjord = n('fjord', 0);
  // (24 Nov: the look director found the open sea from the air a checker of blocks at ?wpaint=1, and passed the strokes on rivers
  //  and ponds; the coordinator: the strokes the default there, the sea on v37's until its own fix passes)
  W.wpaint = n('wpaint', 1);
  W.wsea = q.has('wsea') ? n('wsea', 0) : q.has('wpaint') ? W.wpaint : 0;
  W.wakes = n('wakes', 1); W.splash = n('splash', 0); W.runoff = n('runoff', 0);
  W.on = !!(W.rivers || W.lakes || W.ponds || W.puddles || W.swell || W.falls || W.fjord || W.runoff);
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

