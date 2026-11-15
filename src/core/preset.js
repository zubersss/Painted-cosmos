// The device preset (W3.5 of the sharp-smooth plan, part 1). Pure: no DOM.
//
// A phone does not start at the top tier with a 1.5 pixel ratio. Which kind of device this is
// comes from the pointer and the screen: a coarse pointer that takes touches and a screen whose
// short side is under 500 css px is a phone; with a short side of 500 or more, a tablet; anything
// else the desktop, exactly as before.
//
//   preset    pixels per css px   most pixels   starts at   resolution floor (R2 W6.1, W6.2)
//   desktop   1.5                 3.7 MP        tier 2      0.67 of the output (the coordinator's ruling on P7, unchanged)
//   tablet    1.25                1.6 MP        tier 2      0.75
//   phone     1.25                3.7 MP        tier 1      0.75
// The floor: the scene is never drawn under that share of the buffer (internal = tier share x render
// scale, src/core/dynres.js); under it the controller sheds a tier, never pixels.
//
// The URL can name one (?preset=phone|tablet|desktop: for a test on a desktop browser); ?quality=
// still pins the tier, ?scale= the render scale.

export const PRESETS = Object.freeze({
  desktop: Object.freeze({ id: 'desktop', dpr: 1.5, maxPixels: 3.7e6, tier: 2, floor: 0.67 }),
  tablet: Object.freeze({ id: 'tablet', dpr: 1.25, maxPixels: 1.6e6, tier: 2, floor: 0.75 }),
  phone: Object.freeze({ id: 'phone', dpr: 1.25, maxPixels: 3.7e6, tier: 1, floor: 0.75 }),
});
export const PHONE_SHORT_SIDE = 500;      // css px: under this a touch screen is a phone

// env: { coarse (matchMedia('(pointer: coarse)')), touchPoints (navigator.maxTouchPoints),
// screenW, screenH (screen.width/height, css px; the window's size where there is no screen),
// ask (the URL's ?preset=) }. Returns one of PRESETS.
export function choosePreset(env = {}) {
  if (env.ask && PRESETS[env.ask]) return PRESETS[env.ask];
  const touch = !!env.coarse && (env.touchPoints || 0) > 0;
  if (!touch) return PRESETS.desktop;
  const w = +env.screenW || 0, h = +env.screenH || 0;
  const short = w > 0 && h > 0 ? Math.min(w, h) : 0;
  if (!short) return PRESETS.tablet;
  return short < PHONE_SHORT_SIDE ? PRESETS.phone : PRESETS.tablet;
}

// The drawing buffer for a canvas of cssW x cssH css px on a screen of deviceRatio device pixels
// per css px: { w, h, ratio } (ratio: the pixels per css px used).
export function bufferSize(cssW, cssH, deviceRatio, preset = PRESETS.desktop) {
  const css = Math.max(1, cssW * cssH);
  const ratio = Math.min(deviceRatio || 1, preset.dpr, Math.sqrt(preset.maxPixels / css));
  return { w: Math.max(1, Math.floor(cssW * ratio)), h: Math.max(1, Math.floor(cssH * ratio)), ratio };
}
