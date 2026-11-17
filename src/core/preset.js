// The device preset (W3.5 of the sharp-smooth plan, part 1). Pure: no DOM.
//
// A phone does not start at the top tier with a 1.5 pixel ratio. Which kind of device this is
// comes from the pointer and the screen: a coarse pointer that takes touches and a screen whose
// short side is under 500 css px is a phone; with a short side of 500 or more, a tablet; anything
// else the desktop, exactly as before.
//
//   preset    pixels per css px   most pixels   starts at
//   desktop   1.5                 3.7 MP        tier 2 (the coordinator's ruling on P7, unchanged)
//   tablet    1.25                1.6 MP        tier 2
//   phone     1.25                3.7 MP        tier 1
//
// The URL can name one (?preset=phone|tablet|desktop: for a test on a desktop browser); ?quality=
// still pins the tier, ?scale= the render scale.

export const PRESETS = Object.freeze({
  desktop: Object.freeze({ id: 'desktop', dpr: 1.5, maxPixels: 3.7e6, tier: 2 }),
  tablet: Object.freeze({ id: 'tablet', dpr: 1.25, maxPixels: 1.6e6, tier: 2 }),
  phone: Object.freeze({ id: 'phone', dpr: 1.25, maxPixels: 3.7e6, tier: 1 }),
  // (a computer whose graphics chip is a basic built-in one: only ever chosen by main.js for the oil look, from the
  // chip's name, or by ?preset=laptop. The owner's own, an Intel UHD of 2022, drew the oil look's wood at 9 pictures a
  // second on the desktop's settings: 1920 x 997, the top tier, 2-sample smoothing. One picture pixel to a screen point,
  // 1.3 MP at most, the middle tier.)
  laptop: Object.freeze({ id: 'laptop', dpr: 1.0, maxPixels: 1.3e6, tier: 1 }),
});
// A graphics chip's name (WEBGL_debug_renderer_info) that says it is a basic built-in one: Intel's HD, UHD and Iris.
// (render/index.js keeps the same list for the painter's own choices: keep the two alike.)
export const BASIC_GPU = /Intel.*(U?HD Graphics|Iris)/i;
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
