// Painted Cosmos: HOW WET THE WORLD IS JUST NOW, for the water that comes and goes with the rain (?runoff=1). OWNER: PAINTER
// (the water group's lead; docs/lead/WATER-DESIGN.md 3.1, docs/notes/water.md).
//
// The owner, 24 Nov: "how the water collects and drifts into ponds or into runways into the rivers and oceans". Where the
// runnels run and how much each water rises is in the world's own data (world/rivers.js: o.cap, o.swell); WHEN is here: a
// small hydrograph at the eye, stepped once a frame, that the water's paint reads (the water-paint lane: its uRunoff).
//
//   WATERSTATE.wet   0..1  the runnels: they fill within minutes of heavy rain and drain within a quarter of an hour of it
//   WATERSTATE.rise  m     the streams, rivers and ponds: up to RUNOFF.riseMax, rising over minutes after the rain has
//                          gathered (a catchment's lag) and falling back over tens of minutes as the land dries
//   WATERSTATE.mud   0..1  a swollen river's brown
//   WATERSTATE.rain  mm/h  the rain at the eye just now (for the paint's rings, if it wants it)
//
// FROM WHAT. The weather group's rain field when the game has it (physics.fields.rain, WEATHER-DESIGN.md 9.3): what fell at
// the eye over the last half hour and the last three hours (rainBetween). Where it has not (look-proto before the weather
// lands), the ground's own wetness the game already keeps (the world's uWx.y, the integral of past rain at the place,
// physics/weather.js moistureAt) stands in, run through the same lags.
//
// THE NUMBERS (RUNOFF): a runnel runs once about 2 mm has fallen in half an hour (a heavy shower gives that in four or five
// minutes); a stream rises its whole riseMax for about 20 mm over three hours (a long soaking); the lags are a minute or two
// up and ten to thirty down, which is what a small wooded catchment does. All game seconds.
import { MODE } from '../data/mode.js';
import { WATER_PARTS } from './waterhooks.js';

export const RUNOFF = {
  wetMm: 2.0,       // mm in the last half hour for the runnels to run full (1 - exp(-mm / wetMm))
  riseMm: 20.0,     // mm in the last three hours for the full rise
  riseMax: 0.4,     // m: the most a stream rises (the water's mesh keeps cells 0.45 m above the still level)
  wetUp: 60, wetDown: 600,     // s: how fast the runnels fill and drain (first-order lags)
  riseUp: 300, riseDown: 1800, // s: how fast the streams rise and fall
  mudK: 0.7,        // the brown at the full rise
};

export const WATERSTATE = { wet: 0, rise: 0, mud: 0, rain: 0, from: 'none', t: 0 };

// one step of the hydrograph. `src` is { mm30, mm180, rain } (what fell at the eye over the last 30 and 180 min, and the rate
// now), or null with `wet01` (the ground's wetness, 0..1) standing in. dt in game seconds.
export function stepRunoff(st, dt, src, wet01) {
  let wetT, riseT;
  if (src) {
    wetT = 1 - Math.exp(-Math.max(0, src.mm30) / RUNOFF.wetMm);
    riseT = RUNOFF.riseMax * (1 - Math.exp(-Math.max(0, src.mm180) / RUNOFF.riseMm));
    st.rain = src.rain || 0; st.from = 'rain';
  } else {
    // the ground's wetness: already an integral of the rain with its own drying; the runnels want it well soaked, the
    // streams want it soaked for longer (the second lag below)
    const w = Math.max(0, Math.min(1, wet01 || 0));
    wetT = Math.max(0, Math.min(1, (w - 0.35) / 0.5));
    riseT = RUNOFF.riseMax * Math.max(0, Math.min(1, (w - 0.25) / 0.6));
    st.rain = 0; st.from = 'wetness';
  }
  const h = Math.max(0, Math.min(5, dt));
  const k = (up, down, target, now) => 1 - Math.exp(-h / (target > now ? up : down));
  st.wet += (wetT - st.wet) * k(RUNOFF.wetUp, RUNOFF.wetDown, wetT, st.wet);
  st.rise += (riseT - st.rise) * k(RUNOFF.riseUp, RUNOFF.riseDown, riseT, st.rise);
  st.mud = RUNOFF.mudK * st.rise / RUNOFF.riseMax;
  st.t += h;
  return st;
}

// the water's part: what fell at the eye, asked of the rain field twice a second (it is a quadrature over hours, not free),
// the lags stepped every frame
let asked = 0, last = null;
const _src = { mm30: 0, mm180: 0, rain: 0 };
export const RUNOFF_PART = {
  name: 'runoff',
  update(ctx) {
    if (!MODE.water || !MODE.water.runoff) return;
    const dt = Math.max(0, Math.min(0.25, ctx.dt || 0)) * (ctx.timeScale || 1);
    const ph = ctx.physics, fr = ph && ph.fields && ph.fields.rain;
    let src = null;
    if (fr && typeof fr.rainBetween === 'function' && ctx.camL) {
      asked -= dt;
      if (asked <= 0 || !last) {
        asked = 0.5;
        const p = ctx.camL, l = Math.hypot(p.x, p.y, p.z) || 1, t = fr.t || 0;
        const a = fr.rainBetween(ctx.bodyId, p.x / l, p.y / l, p.z / l, t - 1800, t);
        const b = fr.rainBetween(ctx.bodyId, p.x / l, p.y / l, p.z / l, t - 10800, t);
        _src.mm30 = a ? a.mm || 0 : 0; _src.mm180 = b ? b.mm || 0 : 0; _src.rain = fr.rate || 0;
        last = _src;
      }
      src = last;
    }
    const bu = ctx.st && ctx.st.bu, wet01 = bu && bu.uWx ? bu.uWx.value.y : (ctx.wet01 || 0);
    stepRunoff(WATERSTATE, dt, src, wet01);
  },
};
if (!WATER_PARTS.includes(RUNOFF_PART)) WATER_PARTS.push(RUNOFF_PART);
