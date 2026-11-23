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
export const MODE = { oil: false, powers: false, calm: false, beasts: 0, get wanderer() { return this.oil; } };

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

