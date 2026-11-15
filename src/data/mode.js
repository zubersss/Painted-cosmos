// Painted Cosmos: which look the game is drawn in, for modules that must stay free of three and of the page (the look
// data, the surface: they are also loaded in Node by the tests). OWNER: PAINTER.
// render/shared.js sets `oil` once, when it is loaded, from the address (`?look=oil`); everything else only reads it.
// `wanderer`: the new explorer (bare head, cloak, lantern; it flies by itself, no jetpack: the owner, 2026-11-15). For
// the prototype it comes with the oil look; read this, not `oil`, wherever the explorer's own behaviour is meant.
export const MODE = { oil: false, get wanderer() { return this.oil; } };
