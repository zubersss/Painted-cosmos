// Painted Cosmos: HOW WET THE WORLD IS JUST NOW, for the water that comes and goes with the rain (?runoff=1). OWNER: PAINTER
// (the water group's lead; docs/lead/WATER-DESIGN.md 3.1, docs/notes/water.md).
//
// The owner, 24 Nov: "how the water collects and drifts into ponds or into runways into the rivers and oceans". Where the
// runnels run and how much each water rises is in the world's own data (world/rivers.js: o.cap, o.swell); WHEN is here: a
// small hydrograph at the eye, stepped once a frame, that the water's paint reads (the water-paint lane: its uRunoff).
//
//   WATERSTATE.wet   0..1  the runnels: they run within a minute or two of heavy rain and drain within about a quarter of an
//                          hour of its end
//   WATERSTATE.rise  m     the streams, rivers and ponds: up to RUNOFF.riseMax, rising over minutes after the rain has
//                          gathered (a catchment's lag) and, after a short storm, falling back over tens of minutes (the
//                          quick flow), a small part staying up for some hours (the slow flow) if much has fallen
//   WATERSTATE.mud   0..1  a swollen river's brown
//   WATERSTATE.rain  mm/h  the rain at the eye just now (for the paint's rings, if it wants it)
//
// THE WORLD'S CLOCK. Every time here is the WORLD's, the clock the weather runs on: the game's day lasts 25 minutes, so an
// hour of weather passes in a game minute (physics/weather.js WEATHER.timeScale, 60; the rain field's rainBetween and the
// ground's drying both keep it). A frame's game seconds are turned into the world's (RUNOFF.clock), and the rain field is
// asked over the world's last ten minutes, half hour and three hours -- ten, thirty and 180 game seconds. (Until 24 Nov
// the hydrograph ran on game seconds: its "last half hour" was thirty hours of weather and its streams stayed up for
// days of it -- found in the A/B, docs/notes/water.md RUNOFF.)
//
// FROM WHAT. The weather group's rain field when the game has it (physics.fields.rain, WEATHER-DESIGN.md 9.3): what fell at
// the eye over those three windows (rainBetween). Where it has not (look-proto before the weather lands), the ground's own
// wetness the game already keeps (the world's uWx.y, the integral of past rain at the place, physics/weather.js moistureAt)
// stands in, run through the same lags.
//
// THE NUMBERS (RUNOFF): a runnel runs once about a millimetre has fallen in ten minutes (a heavy shower gives that in two);
// the streams answer to what fell in the last half hour (the quick flow) and to 0.15 of what fell in the three hours
// before (the slow flow), 63 % of their riseMax for 6 mm of that (a long soaking of 20 mm over three hours, or a short
// downpour of 6 mm); the lags are a minute or five up and five to twenty down, which is what a small wooded catchment
// does. A storm of 30 mm/h for 20 minutes (tests: runoff.test.mjs): the runnels run within three minutes and are drained
// twenty minutes after it; the streams peak near 0.3 m about ten minutes after it, are down to half that within the hour
// and back to nothing about four hours on. (In the game: the runnels run within seconds of a heavy shower and are gone
// twenty seconds after it; the streams fall over the next minute and are quiet four minutes on.)
import { MODE } from '../data/mode.js';
import { WATER_PARTS } from './waterhooks.js';

export const RUNOFF = {
  clock: 60,        // world seconds in a game second (physics/weather.js WEATHER.timeScale; the test holds them equal)
  wetMm: 1.0,       // mm in the last ten minutes for the runnels to run (1 - exp(-mm / wetMm))
  riseMm: 6.0,      // mm of the streams' rain (the last half hour, and slowK of the three hours before it) for 63 % of the rise
  slowK: 0.15,      // the share of the older rain (half an hour to three hours ago) that still feeds the streams
  riseMax: 0.4,     // m: the most a stream rises (the water's mesh keeps cells 0.45 m above the still level)
  wetUp: 60, wetDown: 300,     // world s: how fast the runnels fill and drain (first-order lags)
  riseUp: 300, riseDown: 1200, // world s: how fast the streams rise and fall
  mudK: 0.7,        // the brown at the full rise
  win: [600, 1800, 10800],     // world s: the rain field's three windows (the runnels', the quick flow's, the slow flow's)
};

export const WATERSTATE = { wet: 0, rise: 0, mud: 0, rain: 0, from: 'none', t: 0 };

// one step of the hydrograph. `src` is { mm10, mm30, mm180, rain } (what fell at the eye over the world's last 10, 30 and
// 180 minutes, and the rate now), or null with `wet01` (the ground's wetness, 0..1) standing in. dt in WORLD seconds.
export function stepRunoff(st, dt, src, wet01) {
  let wetT, riseT;
  if (src) {
    const m10 = Math.max(0, src.mm10 || 0), m30 = Math.max(m10, src.mm30 || 0), m180 = Math.max(m30, src.mm180 || 0);
    wetT = 1 - Math.exp(-m10 / RUNOFF.wetMm);
    riseT = RUNOFF.riseMax * (1 - Math.exp(-(m30 + RUNOFF.slowK * (m180 - m30)) / RUNOFF.riseMm));
    st.rain = src.rain || 0; st.from = 'rain';
  } else {
    // the ground's wetness: already an integral of the rain with its own drying; the runnels want it well soaked, the
    // streams want it soaked for longer (the second lag below)
    const w = Math.max(0, Math.min(1, wet01 || 0));
    wetT = Math.max(0, Math.min(1, (w - 0.35) / 0.5));
    riseT = RUNOFF.riseMax * Math.max(0, Math.min(1, (w - 0.25) / 0.6));
    st.rain = 0; st.from = 'wetness';
  }
  const h = Math.max(0, Math.min(60, dt));
  const k = (up, down, target, now) => 1 - Math.exp(-h / (target > now ? up : down));
  st.wet += (wetT - st.wet) * k(RUNOFF.wetUp, RUNOFF.wetDown, wetT, st.wet);
  st.rise += (riseT - st.rise) * k(RUNOFF.riseUp, RUNOFF.riseDown, riseT, st.rise);
  st.mud = RUNOFF.mudK * st.rise / RUNOFF.riseMax;
  st.t += h;
  return st;
}

// the water's part: what fell at the eye, asked of the rain field twice a second (a quadrature of 5 s steps: 2, 6 and 36 of
// them), the lags stepped every frame on the world's clock
let asked = 0, last = null;
const _src = { mm10: 0, mm30: 0, mm180: 0, rain: 0 };
export const RUNOFF_PART = {
  name: 'runoff',
  update(ctx) {
    if (!MODE.water || !MODE.water.runoff) return;
    const dt = Math.max(0, Math.min(0.25, ctx.dt || 0)) * (ctx.timeScale || 1);   // game seconds
    const ph = ctx.physics, fr = ph && ph.fields && ph.fields.rain;
    let src = null;
    if (fr && typeof fr.rainBetween === 'function' && ctx.camL) {
      asked -= dt;
      if (asked <= 0 || !last) {
        asked = 0.5;
        const p = ctx.camL, l = Math.hypot(p.x, p.y, p.z) || 1, t = fr.t || 0, c = RUNOFF.clock, W = RUNOFF.win;
        const mm = (age) => { const r = fr.rainBetween(ctx.bodyId, p.x / l, p.y / l, p.z / l, t - age / c, t); return r ? r.mm || 0 : 0; };
        _src.mm10 = mm(W[0]); _src.mm30 = mm(W[1]); _src.mm180 = mm(W[2]);
        _src.rain = typeof fr.now === 'number' ? fr.now : 0;
        last = _src;
      }
      src = last;
    }
    const bu = ctx.st && ctx.st.bu, wet01 = bu && bu.uWx ? bu.uWx.value.y : (ctx.wet01 || 0);
    stepRunoff(WATERSTATE, dt * RUNOFF.clock, src, wet01);
  },
};
if (!WATER_PARTS.includes(RUNOFF_PART)) WATER_PARTS.push(RUNOFF_PART);
