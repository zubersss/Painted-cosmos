// Painted Cosmos physics: the weather as a painter needs it. OWNER: PHYSICS. Pure (no three, no DOM).
//
// physics.here.weather is meteorology (rates, ranges, kinds). A sky, a haze and a ground wash
// need a handful of numbers, each 0..1 and continuous in time, with no meteorology left in
// them. This is that translation, in one place, so PAINTER wires numbers and PILOT can pass
// them through setMood unchanged.
//
//   cloud     0 clear sky .. 1 fully covered                         (paint cloud over the blue)
//   overcast  0 full sunlight .. 1 the light of a storm at noon      (dim and cool the light, soften shadows)
//   haze      1 a clear day .. about 0.1 thick fog: MULTIPLY the clear-day fog distance by it
//   fog       share of that loss which is grey water (fog, mist, falling rain and snow)
//   dust      share of that loss which is dust (tint the haze with the ground's dust colour)
//   wet       0 dry .. 1 soaked ground                               (darker, glossier ground washes)
//   snow      0 bare ground .. 1 covered in snow: ALL the snow that lies here, the standing snow of the
//             biome (which PAINTER has painted into its ground) and the fresh snow together
//   fresh     0 .. 1 covered in FRESH snow: what recent snowfall has laid, and only that (P7; the
//             coordinator's ruling on snow): this is the number to lay over the painted ground. It
//             gathers while snow falls, settles and melts after, and is never more than `snow`
//   rain      0 none .. 1 a downpour: how much LIQUID is falling
//   snowfall  0 none .. 1 a blizzard: how much is falling FROZEN (snow, ice crystals, frost)
//             (two amounts, not an amount and a kind: a kind would flip when the first flake falls)
//   storm     0 .. 1 inside a storm core (wind in the crowns, the darkest sky)
//   flash     0 .. 1 lightning, now (a spike by nature: three or four strokes in a quarter second)
//
// All but `flash` change by a few percent a second at most (weather.test.mjs holds the inputs
// to that; sky.test.mjs holds these). In a vacuum everything is 0 and haze is 1.
import { clamp01 } from './util.js';

export const SKY = Object.freeze({
  snowCover: 0.03,     // m of snow that hides the ground (1 - 1/e of it covered at this depth)
  overcastCloud: 0.55, // how much of the dimming thick cloud alone gives
  overcastStorm: 0.35, // ... a storm core adds
  overcastRain: 0.2,   // ... and heavy precipitation adds
  overcastGale: 0.25,  // ... and a gale's scud and spray (P7)
  stormGale: 0.8,      // a hurricane-force gale is this much of a storm to the sky, lightning or not (P7)
});

export function skyNumbers(w, out = {}) {
  const pr = w && w.precipitation;
  if (!w || w.kind === 'vacuum') {
    out.cloud = 0; out.overcast = 0; out.haze = 1; out.fog = 0; out.dust = 0; out.wet = 0; out.snow = w ? clamp01(1 - Math.exp(-(w.snowDepth || 0) / SKY.snowCover)) : 0;
    out.rain = 0; out.snowfall = 0; out.storm = 0; out.flash = 0;
    out.fresh = w ? clamp01(1 - Math.exp(-(w.freshSnow || 0) / SKY.snowCover)) : 0;
    return out;
  }
  const gale = clamp01(w.gale01 || 0);
  const cloud = clamp01(w.cloud01 || 0), storm = clamp01(Math.max(w.storm01 || 0, SKY.stormGale * gale)), rain = pr ? clamp01(pr.intensity01 || 0) : 0;
  const frozen = pr ? clamp01(pr.frozen01 || 0) : 0;
  out.cloud = cloud;
  // thin cloud barely dims; a closed deck does; a storm core and a downpour darken it further
  out.overcast = clamp01(SKY.overcastCloud * cloud * cloud + SKY.overcastStorm * clamp01(w.storm01 || 0) + SKY.overcastRain * rain + SKY.overcastGale * gale);
  out.haze = Math.min(1, Math.max(0.02, w.visibility01 == null ? 1 : w.visibility01));
  // what the view is lost to: dust against everything else (fog, mist, haze, what is falling)
  const lost = 1 - out.haze, dust = clamp01(w.dust01 || 0), grey = clamp01(Math.max(w.fog01 || 0, w.haze01 || 0, lost - dust));
  const sum = dust + grey;
  out.dust = sum > 1e-6 ? lost * dust / sum : 0;
  out.fog = sum > 1e-6 ? lost * grey / sum : 0;
  out.wet = clamp01(w.wetness01 || 0);
  out.snow = clamp01(1 - Math.exp(-(w.snowDepth || 0) / SKY.snowCover));
  out.fresh = Math.min(out.snow, clamp01(1 - Math.exp(-(w.freshSnow || 0) / SKY.snowCover)));
  out.rain = rain * (1 - frozen);
  out.snowfall = rain * frozen;
  out.storm = storm;
  out.flash = clamp01(w.lightning ? w.lightning.flash01 || 0 : 0);
  return out;
}
