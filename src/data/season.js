// Painted Cosmos: the turn of the year, which is to say what colour the leaves are. OWNER: PAINTER.
//
// The owner, 2026-11-19: "make sure the leaves change colors from summer to autumn for the forest".
//
// `SEASON.t` runs 0 (high summer) to 1 (deep autumn) and back, over and over. Everything that has leaves asks for
// its colour at `t` and gets a mix of its two dresses: the summer one and the autumn one, both written in the look
// data beside each other (`leafSum`, `leafAut`; a plant given neither keeps the one colour it always had and does
// not turn at all, which is what every world but the forest does).
//
// IT COSTS NOTHING TO DRAW. A leaf's colour was already a uniform handed to the shader -- uLeafA, uLeafB, uLeafC and
// the far trees' arrays of them -- so turning the year is three vectors written per material when `t` moves, and not
// one instruction more in any shader. No define, no recompile, no second set of meshes.
//
// It is behind the oil look, like everything else new, so the live watercolour game cannot see it.
//
//   ?season=0.6     stand the year still at that point (0 summer, 1 autumn). Use it to look at one moment.
//   ?year=240       how many seconds a whole turn of the year takes, summer to autumn and back. 0 stands still.
//
// The default turn is SIX MINUTES there and six minutes back, which is fast for a year and slow for a frame: the
// owner asked to SEE the leaves change, and a wood that takes an hour to turn is a wood that never turns while
// anyone is watching. It is a dial, not a fact about the world; `?year=` moves it.
export const SEASON = {
  t: 0,            // 0 high summer, 1 deep autumn
  year: 720,       // seconds for a whole turn, summer -> autumn -> summer
  held: false,     // ?season= was given: stand still at t
  v: 0,            // which way it is going now, for anything that wants to know
};

// read the address once (main.js and the gallery both call this; in Node nothing calls it and the defaults stand)
export function seasonFromSearch(search) {
  const q = new URLSearchParams(search || '');
  if (q.has('season')) { SEASON.t = Math.max(0, Math.min(1, +q.get('season') || 0)); SEASON.held = true; }
  if (q.has('year')) { SEASON.year = Math.max(0, +q.get('year') || 0); if (!SEASON.year) SEASON.held = true; }
  return SEASON;
}

// move the year on. dt is seconds of play. A triangle: summer to autumn, then back the same way.
export function stepSeason(dt) {
  if (SEASON.held || !(SEASON.year > 0) || !(dt > 0)) { SEASON.v = 0; return SEASON.t; }
  const rate = 2 / SEASON.year;                       // a whole turn is 2 of travel: up 1 and down 1
  SEASON.v = rate;
  // a tab left in the background hands back a dt of minutes on its first frame; the year must not leap a season
  // because nobody was looking. A frame longer than a second is already pathological, so that is the ceiling.
  let u = (SEASON._u == null ? SEASON.t : SEASON._u) + rate * Math.min(dt, 1);
  u %= 2; if (u < 0) u += 2;
  SEASON._u = u;
  SEASON.t = u <= 1 ? u : 2 - u;
  if (u > 1) SEASON.v = -rate;
  return SEASON.t;
}

// a plant's colour now: three [r,g,b] for summer, three for autumn, mixed at t. Either may be missing, and then the
// other is the whole answer -- a plant with one dress does not turn.
const _c = [0, 0, 0];
export function leafNow(sum, aut, t, out) {
  const o = out || _c;
  if (!sum) { o[0] = aut[0]; o[1] = aut[1]; o[2] = aut[2]; return o; }
  if (!aut) { o[0] = sum[0]; o[1] = sum[1]; o[2] = sum[2]; return o; }
  o[0] = sum[0] + (aut[0] - sum[0]) * t;
  o[1] = sum[1] + (aut[1] - sum[1]) * t;
  o[2] = sum[2] + (aut[2] - sum[2]) * t;
  return o;
}
