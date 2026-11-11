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
  // night: a dark-toned painting of its own (the sheet's night key, post.js): a deep zenith
  // running to a paler band over the land, a light last glaze; the lights are reserved paper
  night: { zenith: [0.15, 0.19, 0.36], horizon: [0.46, 0.52, 0.68], haze: [0.40, 0.46, 0.63], glaze: [0.55, 0.58, 0.80], light: [0.80, 0.86, 1.0], grade: [0.64, 0.70, 0.90], cloudShade: [0.40, 0.44, 0.62] },
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
  const nz = [zenith[0] * 0.28, zenith[1] * 0.30, zenith[2] * 0.44], nh = [horizon[0] * 0.50, horizon[1] * 0.55, horizon[2] * 0.70];
  const night = { zenith: nz, horizon: nh, haze: m3(nh, [0.4, 0.44, 0.6], 0.5), glaze: E.night.glaze, light: E.night.light, grade: o.nightGrade || E.night.grade, cloudShade: E.night.cloudShade };
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
