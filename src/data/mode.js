// Painted Cosmos: which look the game is drawn in, for modules that must stay free of three and of the page (the look
// data, the surface: they are also loaded in Node by the tests). OWNER: PAINTER.
// render/shared.js sets `oil` once, when it is loaded, from the address (`?look=oil`); everything else only reads it.
// `wanderer`: the new explorer (bare head, cloak, lantern; it flies by itself, no jetpack: the owner, 2026-11-15). For
// the prototype it comes with the oil look; read this, not `oil`, wherever the explorer's own behaviour is meant.
export const MODE = { oil: false, get wanderer() { return this.oil; } };

// THE OIL LOOK'S OWN CONTENT, laid over the looks ONCE when the look is switched on (render/shared.js calls this; with
// the look off nothing is touched, so the default game's worlds are what they were). A look may name kinds of tall
// plant that exist only in the oil look (`flora.tallOil`: appended to `flora.tall`), and a biome may change any of
// its own fields for it (`oil.over`; in it `tallOil: [a, b]` names two of the look's oil-only kinds, as `tall` names
// two of its kinds). First use: the firs and bare trees of Neptune's snowfield (the owner, 2026-11-16).
export function overlayOil(LOOKS) {
  for (const id of Object.keys(LOOKS)) {
    const L = LOOKS[id];
    if (!L || L._oilLaid) continue;
    L._oilLaid = true;
    const base = L.flora && L.flora.tall ? L.flora.tall.length : 0;
    if (L.flora && L.flora.tallOil) L.flora.tall = (L.flora.tall || []).concat(L.flora.tallOil);
    for (const b of L.biomes || []) {
      const o = b.oil && b.oil.over;
      if (!o) continue;
      Object.assign(b, o);
      if (o.tallOil) { b.tall = o.tallOil.map((k) => base + k); delete b.tallOil; }
    }
  }
}

