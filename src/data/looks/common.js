// Painted Cosmos: what every body's look is made of (paper, pigments, sky keys, the biome helper). OWNER: PAINTER.
// Pure data (no three), safe to import in Node. Each body's look is in its own file next to this one
// (src/data/looks/<body>.js); src/data/looks.js assembles them. Never import src/data/looks.js from here or from a body file.
//
// Colour convention used by the whole painter: a colour is the TRANSMITTANCE of a wash laid on
// paper. (1,1,1) is bare paper, the brightest value there is. Layering two washes multiplies
// them. The final composite multiplies by the paper colour, so nothing is ever brighter than
// paper and "fade to paper" simply means "fade to 1".

export const PAPER = '#F4EFE4';

// Named pigments: the colour of a medium-strength wash of each.
export const PIGMENTS = {
  sapGreen: '#7f9c3d',
  hookersGreen: '#3d6a47',
  viridian: '#3f8c7b',
  oliveGreen: '#8a8a3e',
  quinGold: '#dba436',
  lemonYellow: '#ecdc66',
  yellowOchre: '#d8b56a',
  rawSienna: '#c9914e',
  burntSienna: '#b6623c',
  rawUmber: '#7c644a',
  burntUmber: '#6c4b37',
  sepia: '#584435',
  ultramarine: '#4d60b2',
  cobaltBlue: '#5c82c6',
  cerulean: '#73a9d1',
  cobaltViolet: '#8c7aba',
  paynesGrey: '#4b5669',
  indigo: '#2f3a5d',
  neutralTint: '#6f6b7a',
  cadScarlet: '#da492c',
  cadOrange: '#e8873a',
  alizarin: '#b1364b',
  roseMadder: '#d98a98',
  turquoise: '#4fb3b0',
  mint: '#a8dcc4',
  davysGrey: '#8f9189',
};

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
export function pig(name) {
  const h = PIGMENTS[name];
  if (!h) throw new Error('unknown pigment: ' + name);
  return hexToRgb(h);
}
// Dilute a wash toward paper (t = 0: full strength, t = 1: bare paper).
export function dilute(c, t) { return [c[0] + (1 - c[0]) * t, c[1] + (1 - c[1]) * t, c[2] + (1 - c[2]) * t]; }
export function mixc(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
export function glazec(a, b) { return [a[0] * b[0], a[1] * b[1], a[2] * b[2]]; }

// Sky / light keys. All colours are transmittances over paper.
//   zenith, horizon: sky wash at the top and at the horizon
//   haze: what distance fades to (stays near paper)
//   glaze: the cool transparent shadow glaze
//   light: tint of the sunlit wash (warm paper)
//   grade: a last overall glaze on the whole sheet (night indigo, dusk gold)
export const EARTH_SKY = {
  day: { zenith: [0.50, 0.69, 0.90], horizon: [0.90, 0.94, 0.97], haze: [0.93, 0.955, 0.975], glaze: [0.71, 0.72, 0.875], light: [1.0, 0.985, 0.93], grade: [1, 1, 1], cloudShade: [0.80, 0.80, 0.90] },
  dawn: { zenith: [0.66, 0.72, 0.90], horizon: [1.0, 0.80, 0.76], haze: [1.0, 0.90, 0.87], glaze: [0.66, 0.66, 0.88], light: [1.0, 0.88, 0.82], grade: [1.0, 0.94, 0.93], cloudShade: [0.86, 0.72, 0.80] },
  dusk: { zenith: [0.58, 0.63, 0.86], horizon: [1.0, 0.80, 0.50], haze: [1.0, 0.89, 0.70], glaze: [0.60, 0.58, 0.84], light: [1.0, 0.84, 0.58], grade: [1.0, 0.92, 0.80], cloudShade: [0.84, 0.66, 0.66] },
  // night: a painting in its own key (PAINTER 16; the M4 critique: it was the day's picture under a dark veil). The moon
  // is the light (chunks.js pcLevel, world/index.js), so the sky is a middle indigo wash thinning to a pale band over the
  // land, two steps lighter than the wood under it; the open ground a step lighter than the wood, the lights reserved
  // paper (stars, birch bark, a lit cabin), a light last glaze. It was zenith [0.15, 0.19, 0.36], horizon
  // [0.46, 0.52, 0.68], grade [0.64, 0.70, 0.90]: a sky as dark as the land.
  night: { zenith: [0.33, 0.38, 0.60], horizon: [0.66, 0.72, 0.86], haze: [0.56, 0.62, 0.78], glaze: [0.55, 0.58, 0.80], light: [0.80, 0.86, 1.0], grade: [0.70, 0.76, 0.94], cloudShade: [0.50, 0.54, 0.70] },
};

export function m3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
// A body's four light keys from its day sky. `o` may override any key (for example Mars' blue dusk).
export function mkSky(zenith, horizon, o) {
  o = o || {};
  const E = EARTH_SKY;
  const haze = o.haze || m3(horizon, [1, 1, 1], 0.35);
  const day = { zenith, horizon, haze, glaze: o.glaze || E.day.glaze, light: o.light || E.day.light, grade: [1, 1, 1], cloudShade: o.cloudShade || m3(zenith, [0.8, 0.8, 0.9], 0.5) };
  const dawnH = o.dawnHorizon || m3(horizon, E.dawn.horizon, 0.65), duskH = o.duskHorizon || m3(horizon, E.dusk.horizon, 0.7);
  const dawn = { zenith: m3(zenith, E.dawn.zenith, 0.45), horizon: dawnH, haze: m3(dawnH, [1, 1, 1], 0.4), glaze: E.dawn.glaze, light: o.dawnLight || E.dawn.light, grade: E.dawn.grade, cloudShade: E.dawn.cloudShade };
  const dusk = { zenith: m3(zenith, E.dusk.zenith, 0.45), horizon: duskH, haze: m3(duskH, [1, 1, 1], 0.35), glaze: E.dusk.glaze, light: o.duskLight || E.dusk.light, grade: o.duskGrade || E.dusk.grade, cloudShade: E.dusk.cloudShade };
  // (the night sky of a world with air is its day sky in the night's key: a middle wash, lighter than the land under it;
  // an airless world keeps the old deep keys with o.nightDeep: its sky is space, and only its far land takes the haze)
  const nz = o.nightDeep ? [zenith[0] * 0.28, zenith[1] * 0.30, zenith[2] * 0.44] : [zenith[0] * 0.60, zenith[1] * 0.56, zenith[2] * 0.68];
  // (o.nightHorizon, PAINTER 19: a world may keep a lighter band low in its night sky, so the land stands dark against it)
  const nh = o.nightHorizon || (o.nightDeep ? [horizon[0] * 0.50, horizon[1] * 0.55, horizon[2] * 0.70] : [horizon[0] * 0.72, horizon[1] * 0.77, horizon[2] * 0.89]);
  const night = { zenith: nz, horizon: nh, haze: o.nightDeep ? m3(nh, [0.4, 0.44, 0.6], 0.5) : m3(nh, E.night.haze, 0.5), glaze: E.night.glaze, light: E.night.light,
    grade: o.nightGrade || (o.nightDeep ? [0.64, 0.70, 0.90] : E.night.grade), cloudShade: o.nightDeep ? [0.40, 0.44, 0.62] : E.night.cloudShade };
  return { day, dawn, dusk, night };
}

// Biome entries. `terrain` selects the height / colour recipe in src/world/surface.js and `t`
// its parameters. `pigments` is the limited palette (5-7 named pigments), `accent` the single
// accent. `ground` gives three washes blended low / mid / high. Optional:
//   liquid: { level, color, refl (0 matte .. 1 mirror), glow (lava), cloud (cloud sea) }
//   tall: [a, b] indices into the body's flora.tall, tallD density, tallMix share of a
//   small: densities of undergrowth kinds { grass, fern, bush, rock, flower, reed, shard }
//   under: this biome's own undergrowth washes, any of { leaf, bush, accent, rock, shard }
//     (otherwise the body's flora.under)
//   mist: multiplies the visibility; phys: { ground } for PHYSICS where its guess is wrong
//   twilight: 0..1, the place lies in a lasting half-light; want: what the easel looks for
//     (src/art/vantage.js); hang: { kit, d } trailing plants on cliff lips
export function B(id, name, terrain, pigments, accent, ground, extra) {
  return Object.assign({ id, name, terrain, pigments, accent, ground }, extra || {});
}
export const P = (n, d) => dilute(pig(n), d == null ? 0.3 : d);
export const PM = (a, b, t, d) => dilute(mixc(pig(a), pig(b), t), d == null ? 0.3 : d);

// ============================================================================================================
// THE ANIMALS, as data. (The owner, 2026-11-23: at least 25 animals in every biome, "animated, with routines,
// hunting and hunted, fish and birds".) OWNER: PAINTER / PILOT, as the plants are.
//
// A world's kinds are rows of numbers in its own look file -- Earth's are in earth.js under `fauna` -- and the
// four helpers below are the only things that read them, so no other file has to know the shape. Nothing here
// imports anything: it is arithmetic over plain objects, and Node loads it in the tests.
//
// THE ONE RULE, and it was learnt the hard way in this very folder: NOTHING IS KEYED BY ARRAY POSITION.
// `flora.tall: [0, 1]` named its trees by index, the placer could only ever stand two of them, and the aspen
// and the tall pine were built at every start-up and drawn nowhere for a fortnight (earth.js:136-138). An
// animal missing from a picture is far harder to notice than a missing tree. So a kind is named, a biome's
// list of animals is named, and what eats what is named. The one place an index appears is `sp`, which the
// routines and the drawing must share; it is handed out HERE, from the look's own `fauna.order`, and never
// written by hand.
// ------------------------------------------------------------------------------------------------------------

// The eight guilds the ledger counts, IN THE ORDER src/physics/fauna.js GUILD declares them -- that file owns
// the meaning, this is the name beside the number so a data file never has to write the number. If the two
// ever disagree, that file is right and this line is the bug.
export const FAUNA_GUILDS = Object.freeze(['grazer', 'ground', 'climber', 'hunter', 'crow', 'bird', 'raptor', 'fish']);

// What a row is left to assume, per body plan, when it has not been written out in full yet. A kind that is
// not built yet (stage 2 and 3) carries the numbers that are FACTS about the animal -- its size, its weight,
// what it eats, when it is abroad -- and takes its fine proportions from here until someone sits down and
// draws it. Said plainly: a stage-2 row will stand and walk; it will not yet look like itself.
export const FAUNA_PLAN = Object.freeze({
  walker: { legF: 0.52, girth: 0.78, neck: 0.14, neckUp: 0.45, head: 0.20, snout: 0.70, ear: 0.08, earUp: 0.75, tail: 0.20, brush: 0.5, horn: 0, limbW: 0.9, coat: 64, marks: '' },
  bird: { legF: 0.45, girth: 0.80, neck: 0.12, neckUp: 0.60, head: 0.10, snout: 0.80, ear: 0, earUp: 0, tail: 0.18, brush: 0.4, horn: 0, limbW: 0.6, coat: 40, marks: '' },
  fish: { legF: 0, girth: 0.55, neck: 0, neckUp: 0, head: 0.08, snout: 0.5, ear: 0, earUp: 0, tail: 0.10, brush: 0.3, horn: 0, limbW: 0, coat: 24, marks: '' },
});
const SHAPE_KEYS = ['plan', 'high', 'legF', 'len', 'girth', 'neck', 'neckUp', 'head', 'snout', 'ear', 'earUp', 'tail', 'brush', 'horn', 'limbW', 'coat', 'marks', 'col', 'span', 'bill', 'depth', 'fin'];

// THE KINDS OF ONE WORLD, in the one order everything else must use. `stage` is MODE.beasts: 1 is the five
// built first, 2 the rest of the wood and the water, 3 the coast, the mountain and the canyon.
// Each row comes back with its own name as `id` and its place in this array as `sp`, which is the index the
// routines write into agents.sp and the drawing reads (src/physics/fauna.js, src/world/beasts.js).
export function faunaKinds(LOOK, stage) {
  const F = LOOK && LOOK.fauna;
  if (!F || !F.order || !F.kinds) return [];
  const want = stage == null ? 1 : stage, out = [];
  for (const id of F.order) {
    const k = F.kinds[id];
    if (!k) continue;                                  // the test beside this file is what catches a typo here
    if ((k.stage || 1) > want) continue;
    out.push(Object.assign({ id, sp: out.length }, k));
  }
  return out;
}

// WHAT STANDS IN ONE BIOME, in the shape the placer takes (src/world/beasts.js beastBirths `roster`).
// A biome names its animals and how many of each: `life: { deer: 0.15, fox: 0.05 }`, in GROUPS PER HECTARE,
// because animals arrive in groups and a hectare is a size the owner can picture. The placer wants groups per
// square kilometre, which is a hundred times that, and the multiplication happens here and nowhere else.
// A name in `life` that is not a kind, or is a kind this stage has not let in, is simply left out.
// BUILD IT ONCE PER BIOME AND KEEP IT, not once per cell: measured on this machine, the autumn wood's roster
// out of forty-two kinds is 5.35 microseconds, which is nothing once and everything if a cell asks for it.
export function faunaRoster(biome, kinds) {
  const life = biome && biome.life;
  if (!life) return [];
  const by = new Map();
  for (const k of kinds) by.set(k.id, k);
  const out = [];
  for (const id of Object.keys(life)) {
    const k = by.get(id), d = +life[id];
    if (!k || !(d > 0)) continue;
    out.push({ id, sp: k.sp, perKm2: d * 100, herd: k.group || null, spread: k.spread == null ? 9 : k.spread,
      hours: k.hours || null, wants: k.where || 'any' });
  }
  return out;
}

// THE SAME KINDS IN THE ROUTINES' OWN SHAPE (src/physics/fauna.js faunaRow). That file fills in everything a
// row leaves out and knows nothing of names, so the two things translated here are the two that are numbers
// there and words here: the guild, and WHICH GUILDS THIS ONE HUNTS, which it wants as one bit per guild.
export function faunaLives(kinds) {
  return kinds.map((k) => {
    let eats = 0;
    for (const g of k.hunts || []) { const i = FAUNA_GUILDS.indexOf(g); if (i >= 0) eats |= 1 << i; }
    return { id: k.id, guild: Math.max(0, FAUNA_GUILDS.indexOf(k.guild)), high: k.high, legF: k.legF, mass: k.mass,
      walk: k.walk, trot: k.trot, run: k.run, group: k.group || null, peak: k.peak, amp: k.amp, base: k.base,
      hab: k.hab || null, eats: (k.hunts && k.hunts.length) ? eats : undefined, flee: k.flee, shy: k.shy,
      strike: !!k.strike, dens: k.dens, size: k.size || null, callR: k.callR, water: !!k.water };
  });
}

// THE SAME KINDS IN THE BODY-BUILDER'S SHAPE (src/world/beastkit.js SHAPES). Whatever the row does not say is
// taken from its plan's defaults above, so a half-written kind still has a body.
export function faunaShapes(kinds) {
  return kinds.map((k) => {
    const d = FAUNA_PLAN[k.plan] || FAUNA_PLAN.walker, s = { id: k.id };
    for (const f of SHAPE_KEYS) s[f] = k[f] !== undefined ? k[f] : d[f];
    return s;
  });
}
