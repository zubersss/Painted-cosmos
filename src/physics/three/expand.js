// Painted Cosmos physics: draw kits, the arithmetic. OWNER: PHYSICS.
// Pure (no three, no DOM): typed arrays in, typed arrays out, nothing allocated per call.
// kits.js wraps these in three.js objects; anyone may also call them directly.
//
// Everything is in the coordinates of the buffer being drawn: body-local axes, relative to
// that buffer's `origin` (the floating-origin rule, COORDINATOR C3). The caller gives the
// camera in the same coordinates.
//
// A quad is four vertices in the order (0,0) (1,0) (1,1) (0,1) of its uv; two triangles
// 0-1-2 and 0-2-3. For a streak u runs across and v from head to tail; for a mark u runs
// across and v along its direction.

// How each kind of particle is drawn, by default. PAINTER overrides any of it (the look is
// PAINTER's): pass { draw: { rain: { width: 0.02 } } } to the kit.
//   streak: a quad from where the particle is to where it was `exposure` seconds ago, as the
//           eye or a shutter sees it, `width` metres wide and at least `min` long
//   dab:    a quad facing the camera, `size` metres across (a real snowflake is 4 mm: these
//           are brush marks, not grains), growing by `grow` m/s as it ages (a puff of dust
//           spreads), turning at `spin` rad/s in the picture plane (a leaf tumbles)
//   fadeIn: seconds over which a new particle grows to full size (nothing pops in)
//   minPx:  the least width (streak) or size (dab) on screen, in pixels: a 1 cm streak is
//           under a pixel beyond 15 m and would flicker in and out of the raster (and PAINTER's
//           post pass erases any mark under about 3 of its internal pixels). A mark that the
//           floor makes f times larger than it is stands for f (streak) or f^2 (dab) of its
//           kind: only that share is drawn, chosen by a number each particle keeps for life, so
//           the far air holds fewer, larger marks and the cover stays what it was (art bible 4)
//   maxPx:  the most (0 = no limit): a flake a hand's breadth from the lens is not a snowball
//   exposure (dab): a dab is drawn out along its motion relative to the eye over this many
//           seconds (driving snow is streaks; still air leaves it round); not with `spin`.
//           smear: the most it is drawn out, in dab sizes (default 2)
//   varySize (dab): 0..1: sizes differ from particle to particle by this much either way
//   sizeMax, fill (dab): where the physics says how much of the view the kind hides (dust in
//           a storm), the kit sizes the marks to cover that, up to sizeMax; fill is the share
//           of a quad the material inks (a disc 0.785; say so if yours is ragged)
//   cell (dab): m. What falls is the same everywhere near by, so each particle may be shown at
//           its place modulo a square cell of this half-width round the EYE (as the simulation
//           itself wraps its box round the focus): the same flakes, each still on its own
//           simulated path, but all of them near the lens, where single marks read; none is
//           shown under the hull. 0 = each where it is. For snow, which is sparse to simulate
//           (a real snowfall is thousands of flakes a cubic metre) and has no ground to respect
//           but the hull and the terrain, which hides what is behind it.
//           The cell in use is the nearest one that divides the simulated box (cellFor): the box
//           wraps its particles from one wall to the other, and only then is a wrapped particle
//           shown where it was.
//   fadeOut: seconds over which a mark shrinks to nothing before it is gone (its life ends, or
//           it lands: buf.left). Nothing pops out: a puff that has grown to two metres does not
//           vanish between two frames, a flake shown a cell away from where it is melts just
//           above the ground it is really over, and a stroke of rain (a metre of it, in the
//           painted table) thins to a point over its last 40 cm instead of going out whole
//   strobe (dab with an exposure): seconds, the frame time the picture is made for. A mark that
//           crosses more than its own drawn length in that time cannot be followed by the eye:
//           it is a flash somewhere new every frame. So a dab is drawn out at least as far as
//           it travels in a frame, whatever `smear` says (driving snow is slanted strokes), up
//           to `streak` dab sizes (default 3); beyond that a camera would smear it to nothing
//           and so does this: it shrinks away, gone at 1.6 times that (a hairline is not a
//           flake: one near the lens in a gale). 0 = off
//   near (dab): m. Nothing is drawn nearer the eye than 0.4 of this, and marks grow to their
//           full size between there and it: a flake at arm's length crosses the whole picture
//           in a frame or two, a blot the painter would not have put there. 0 = off
//   share:  0..1 (default 1): draw only this share of the kind (a painter's rain is a few
//           strokes, not every drop); which ones is decided as for the floor
//   vary:   0..1 how much the shade differs from particle to particle (the `color` attribute)
// New in P7 (tuned against PAINTER's picture; CPU expanders only, the instanced chunk has not got them):
//   parallel (streak): 1 = every stroke of the frame takes ONE direction in the picture, that of
//           the kind's mean motion relative to the eye, and lies in the picture plane at its
//           drop's depth, as long as that motion is seen from where the eye looks (looking down
//           the rain, strokes are dots). Drops drawn each along its own path in perspective lean
//           opposite ways left and right of the view axis and cross: a painter lays rain parallel.
//   maxLen (streak): m, the longest stroke (0 = none). Jupiter's rain falls 30 m/s: at any
//           exposure worth a stroke on Earth it would be metres long there.
//   near (streak): as for dabs: nothing nearer the eye than 0.4 of it, full size from it.
//   tumble, aspect (dab without spin): a flake is not a disc. Each mark has a shape of its own,
//           between `aspect` (short side to long) and 1, and lies at an angle of its own that
//           turns slowly (up to `tumble` rad/s, some one way, some the other) while it is not
//           drawn out by its motion; the more it is drawn out, the more it lies along its motion.
//   wall, wallFrom, wallFull, wallShare, wallHigh, wallNear, wallFade (dab): dust in a storm is
//           not round puffs but low streamers hugging the ground. As the dust the weather carries
//           (eye.wall01: the kit sets it to weather.dustLoad01) goes from wallFrom to wallFull the
//           marks go from round puffs to walls: fewer first, then wider: level
//           (their long side along the horizon of the picture, their short side the local up),
//           `wall` times as wide as high, at most `wallHigh` m high, only a share `wallShare` of
//           them drawn (two or three in view, not twenty), nothing nearer than 0.4 of `wallNear`,
//           growing and going over `wallFade` s more than a puff does.
// New in P10 (the owner's quality push; CPU expanders only):
//   aspect, flip, edge (dab WITH spin): a leaf is not a ball. The mark is `aspect` (short side to
//           long, at most) when seen broadside and `edge` when seen edge-on, and goes between the two
//           as it tumbles about its long side, `flip` rad/s (each at its own rate and phase) while it
//           turns in the picture at `spin` rad/s, some one way, some the other.
//           (P15) When the buffer carries `turn` (the physics' leaves: radians about the long side), that is the
//           tumble instead of `flip`'s own clock, and while cos(turn) < 0 the quad's short side is reversed: its
//           winding turns over with the leaf, so gl_FrontFacing tells which side of the leaf is seen.
//   level (streak): 1 = the stroke lies along the ground: the grain's motion with its vertical part taken
//           out (blowing sand is a skim over the surface; its grains' own hops are steep at both ends)
//   veil (dab): the kind is a translucent thing (dust): the kit adds a per-vertex attribute
//           aPcVeil = (opacity01, soft01, veil01) from expandVeils and puts it in vPcData.y, .z, .w:
//           opacity01  how much of what is behind it the mark hides at its densest (dust is densest
//                      at the ground and thins upward: veilLow at the ground, veilHigh from veilTop m
//                      up; it comes and goes with the mark's fades instead of popping)
//           soft01     how much of the mark's half-size is feathered edge (0 hard, 1 all of it):
//                      veilSoft at the ground, 1 from veilTop up; a wall is softer than a puff
//           veil01     0 the mark is a round puff .. 1 it is a level streamer (as its quad is laid)
//   bands (dab with a cell; snow): 0..1. In a wind what falls comes in bands: the share drawn goes
//           between 1 - bands and 1 with a pattern bandLong m along the wind and bandWide m across it
//           that travels with the wind (eye.bandE, bandN: how far the wind has carried it; eye.band01:
//           how much of this the wind of the moment calls for; the kit sets all three), so a flake
//           stays in its band while both are carried along.
import { noise3 } from '../util.js';     // (the lattice noise of the physics, -1..1: for the bands of what falls in a wind)

export const DRAW = Object.freeze({
  rain: Object.freeze({ shape: 'streak', width: 0.012, exposure: 0.04, min: 0.05, fadeIn: 0.1, fadeOut: 0.08, vary: 0, minPx: 1.2 }),
  hail: Object.freeze({ shape: 'streak', width: 0.024, exposure: 0.018, min: 0.03, fadeIn: 0.1, fadeOut: 0, vary: 0, minPx: 1.2 }),
  sand: Object.freeze({ shape: 'streak', width: 0.014, exposure: 0.03, min: 0.02, fadeIn: 0.05, fadeOut: 0.15, vary: 0.3, minPx: 1.2 }),
  spray: Object.freeze({ shape: 'streak', width: 0.018, exposure: 0.03, min: 0.03, fadeIn: 0, fadeOut: 0.15, vary: 0, minPx: 1.2 }),
  snow: Object.freeze({ shape: 'dab', size: 0.035, grow: 0, spin: 0, fadeIn: 0.25, fadeOut: 0.3, vary: 0, minPx: 1.6, exposure: 0.03, strobe: 0.02, near: 3, tumble: 1.2, aspect: 0.5 }),
  dust: Object.freeze({ shape: 'dab', size: 0.16, grow: 0.3, spin: 0, fadeIn: 0.15, fadeOut: 0.7, vary: 0.35, minPx: 1.6, sizeMax: 2.6, fill: 0.785, near: 2.5 }),
  ash: Object.freeze({ shape: 'dab', size: 0.03, grow: 0, spin: 1.5, fadeIn: 0.3, fadeOut: 0.4, vary: 0.4, minPx: 1.6 }),
  spores: Object.freeze({ shape: 'dab', size: 0.03, grow: 0, spin: 0, fadeIn: 0.4, fadeOut: 0.4, vary: 0.3, minPx: 1.6 }),
  leaves: Object.freeze({ shape: 'dab', size: 0.09, grow: 0, spin: 3.2, aspect: 0.33, flip: 5, edge: 0.07, fadeIn: 0.3, fadeOut: 0.3, vary: 0.5, minPx: 1.6 }),
});

// The same table for PAINTER's pipeline, as overrides of DRAW (pass it as `draw` to the weather
// kit). Its post pass erases any mark under about three of its internal pixels, so every kind
// has a least size of 3 px or more and sizes that read as brush marks at 10 m:
//   snow   a flake is a speck of bare paper 4 to 10 px across, drawn out along its motion in
//          wind, shown modulo a cell round the eye
//   dust   ragged dry-brush patches (the lab's puff inks 0.3 of its quad); in a storm the kit
//          sizes them from the dust in the air, up to 2.6 m: billows, not blots
//   rain   one broad wet stroke stands for several drops (thin strokes do not survive)
export const DRAW_PAINTED = Object.freeze({
  // rain: a few broad strokes, all one way (P7: PAINTER's own numbers, a third of the strokes,
  // none longer than 1.2 m on any world, none nearer than 2.4 m)
  // shareGain: the share drawn follows how hard it rains: share x (0.6 + shareGain x sky.rain): 0.16 in a drizzle, 0.4 in a downpour
  rain: Object.freeze({ width: 0.05, exposure: 0.12, minPx: 4, share: 0.25, shareGain: 1, parallel: 1, maxLen: 1.2, near: 6 }),
  // snow: PAINTER's sizes (0.07 m, 3.5 to 6.5 px: 0.1 m and 10 px were popcorn), each flake its own shape and turn
  // (P10) in a wind a flake is a level stroke as long as it travels in a frame, up to 8 flake sizes (it was
  // 3: beyond that the mark was taken away as a hairline, so a 19 m/s blizzard drew almost nothing near the
  // eye); and the snow comes in bands
  snow: Object.freeze({ size: 0.07, minPx: 3.5, maxPx: 6.5, exposure: 0.04, smear: 1.2, varySize: 0.5, cell: 9, tumble: 1.2, aspect: 0.5, streak: 8, bands: 0.8, bandLong: 9, bandWide: 2.2 }),
  hail: Object.freeze({ width: 0.05, minPx: 3, maxLen: 0.6 }),
  // (P10) the skim of blowing sand (or snow): each grain a short low smear along its hop
  sand: Object.freeze({ width: 0.08, minPx: 3, exposure: 0.22, vary: 0.12, maxLen: 1.4, level: 1, near: 3 }),
  // (P10) spume and surf: each mark a flick of white as long as the drop flies in a tenth of a second
  spray: Object.freeze({ width: 0.11, minPx: 4, exposure: 0.1, maxLen: 1.5, min: 0.12 }),
  // dust: round ragged puffs where it is kicked up; in a storm low veils, eleven times as wide as high.
  // (P10) many and soft: 6 in 10 of the marks are veils (it was 1 in 20: four or five blots), none over
  // 1.1 m high, each translucent (veil: opacity and softness per vertex, for a glaze)
  dust: Object.freeze({ size: 0.5, grow: 0.35, minPx: 8, maxPx: 160, sizeMax: 2.6, fill: 0.3, exposure: 0.12, wall: 11, wallFrom: 0.25, wallFull: 0.7, wallShare: 0.6, wallHigh: 1.1, wallNear: 3.5, wallFade: 1.2,
    veil: 1, veilLow: 0.75, veilHigh: 0.15, veilTop: 3, veilSoft: 0.5 }),
  ash: Object.freeze({ size: 0.09, minPx: 4, exposure: 0.03 }),
  spores: Object.freeze({ size: 0.05, minPx: 3 }),
  // (P10) a leaf 17 cm long, never under 6 px long: thin, so its ink is a third of a disc's that size
  leaves: Object.freeze({ size: 0.17, minPx: 6, near: 3 }),      // (near: a leaf a metre from the lens was a blot across the sheet)
});

// The cell (m, half-width) a kind is shown modulo: the one nearest D.cell of which the
// simulated box (half-width eye.radius) holds a whole number. The simulation wraps a particle
// from one wall of its box to the other; unless the box is whole cells wide the wrapped
// particle would be shown somewhere else in the same frame (measured: 4 marks a second jumping
// across the picture and 12 vanishing, in a blizzard, with a 9 m cell in a 24 m box).
// buf (optional): the buffer; a kind simulated in a box of its own (buf.radius: snow, 8 m round
// the eye the physics was given) is always shown modulo that box round the eye that is drawing:
// where the two eyes are the same every flake is exactly where it is simulated.
export function cellFor(D, eye, buf) {
  const own = buf && buf.radius > 0 && eye && eye.radius > 0 && buf.radius < eye.radius ? buf.radius : 0;
  const c = D.cell > 0 ? D.cell : own, R = own > 0 ? own : eye && eye.radius > 0 ? eye.radius : 0;
  if (!(c > 0) || !(R > 0)) return c;
  return R / Math.max(1, Math.round(R / c));
}
const smooth01 = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

// What the eye is doing, for the particle expanders. All in buffer coordinates.
//   x, y, z        camera position
//   vx, vy, vz     camera velocity (a streak is the particle's motion relative to the eye:
//                  run through rain and it slants toward you)
//   rx.. ux..      unit right and up of the picture plane
//   fx, fy, fz     centre of the particle volume (the focus); radius: its half-width (m).
//                  Particles shrink to nothing over the outer fifth, so the edge of the
//                  simulated volume is never a visible wall.
//   pix            metres that one pixel covers at one metre from the eye:
//                  2 tan(fov / 2) / (viewport height in pixels). 0 = no least size.
export function makeEye() {
  return { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 1, ry: 0, rz: 0, ux: 0, uy: 1, uz: 0, fx: 0, fy: 0, fz: 0, radius: 0, pix: 0,
    // for kinds drawn modulo a cell round the eye: the local horizontal axes (unit; east x north = up),
    // and what keeps the weather off: shelters = [east, north (m from the eye), top (m above the eye), radius] x shelterCount
    ex: 1, ey: 0, ez: 0, nx: 0, ny: 0, nz: -1, shelters: null, shelterCount: 0,
    // 0..1: how much dust the weather carries (weather.dustLoad01): dust dabs with a `wall` become low walls in a storm
    wall01: 0,
    // bands (P10): how far the wind has carried the band pattern (m along the local east and north, from the buffer's
    // origin), the wind's direction (unit, east and north), and 0..1 how banded what falls is in this wind
    bandE: 0, bandN: 0, bandWe: 1, bandWn: 0, band01: 0 };
}

// A number in 0..1 that stays with a particle for life (its size is its own).
export const own01 = (size) => { const h = size * 91573.37; return h - Math.floor(h); };
// How much is left of a particle whose own number is h when only a share `keep` of its kind is
// drawn where it is: all of it while keep is well above h, nothing once keep is below h, and
// a smooth shrinking between (so a mark never pops as it drifts away from the eye). Averaged
// over the kind the area drawn is the share asked for, within a few percent.
export function thinned(h, keep) {
  if (keep >= 1) return 1;
  const t = (keep * 1.18 - h) / (0.3 * h + 1e-4);
  return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
}

function edgeScale(px, py, pz, eye) {
  if (!(eye.radius > 0)) return 1;
  const dx = px - eye.fx, dy = py - eye.fy, dz = pz - eye.fz;
  const t = (Math.sqrt(dx * dx + dy * dy + dz * dz) / eye.radius - 0.8) / 0.2;
  return t <= 0 ? 1 : t >= 1 ? 0 : 1 - t * t * (3 - 2 * t);
}

// Streaks. buf: a particle buffer of physics.particles; D: its DRAW entry; out: Float32Array of
// at least count * 12. Returns the number of quads written (= the particles drawn).
// room (>= 1, default 1): how much larger the kind's marks may grow in all before they would
// hide more than the physics says the kind hides; the floor thins only beyond that.
export function expandStreaks(buf, D, eye, out, room = 1) {
  const n = Math.min(buf.count, Math.floor(out.length / 12)), P = buf.pos, V = buf.vel, A = buf.age, S = buf.size, L = buf.left;
  const fout = L ? D.fadeOut || 0 : 0;
  const ex = D.exposure, hw = D.width * 0.5, min = D.min || 0, fin = D.fadeIn || 0, least = 0.5 * (D.minPx || 0) * eye.pix, most = 0.5 * (D.maxPx || 0) * eye.pix;
  const share = D.share > 0 && D.share < 1 ? D.share : 1, roomy = room > 1 ? room : 1;
  const maxLen = D.maxLen > 0 ? D.maxLen : 1e9, nearD = D.near || 0;
  const level = D.level ? 1 : 0, Ux = eye.ey * eye.nz - eye.ez * eye.ny, Uy = eye.ez * eye.nx - eye.ex * eye.nz, Uz = eye.ex * eye.ny - eye.ey * eye.nx;
  // one direction for the frame: the mean motion relative to the eye, as the picture plane sees it
  // (dr, du: unit, along picture right and up; seen: the share of the motion that lies in the plane)
  let par = D.parallel ? 1 : 0, dr = 0, du = -1, seen = 0;
  if (par && n > 0) {
    let mx = 0, my = 0, mz = 0;
    for (let i = 0, o = 0; i < n; i++, o += 3) { mx += V[o]; my += V[o + 1]; mz += V[o + 2]; }
    mx = mx / n - eye.vx; my = my / n - eye.vy; mz = mz / n - eye.vz;
    const sr = mx * eye.rx + my * eye.ry + mz * eye.rz, su = mx * eye.ux + my * eye.uy + mz * eye.uz, pl = Math.sqrt(sr * sr + su * su), ml = Math.sqrt(mx * mx + my * my + mz * mz);
    if (ml > 1e-6 && pl > 1e-3 * ml) { dr = sr / pl; du = su / pl; seen = pl / ml; }
  }
  const dx = eye.rx * dr + eye.ux * du, dy = eye.ry * dr + eye.uy * du, dz = eye.rz * dr + eye.uz * du;        // along the stroke
  const cx = eye.ux * dr - eye.rx * du, cy = eye.uy * dr - eye.ry * du, cz = eye.uz * dr - eye.rz * du;        // across it, in the picture plane
  for (let i = 0, o = 0, q = 0; i < n; i++, o += 3, q += 12) {
    const px = P[o], py = P[o + 1], pz = P[o + 2];
    // motion relative to the eye over the exposure
    let sx = (V[o] - eye.vx) * ex, sy = (V[o + 1] - eye.vy) * ex, sz = (V[o + 2] - eye.vz) * ex;
    // level: the stroke lies along the ground (its motion with the part along the local up taken out)
    if (level) { const d = sx * Ux + sy * Uy + sz * Uz; sx -= Ux * d; sy -= Uy * d; sz -= Uz * d; }
    let sl = Math.sqrt(sx * sx + sy * sy + sz * sz);
    const tx = px - eye.x, ty = py - eye.y, tz = pz - eye.z;
    let wx, wy, wz, wl = 1;
    if (par) {
      // its own length (a big drop falls faster), the frame's direction
      sl *= seen; sl = sl < min ? min : sl > maxLen ? maxLen : sl;
      sx = dx * sl; sy = dy * sl; sz = dz * sl; wx = cx; wy = cy; wz = cz;
    } else {
      if (sl < min) {
        if (sl > 1e-6) { const k = min / sl; sx *= k; sy *= k; sz *= k; } else { sx = eye.ux * min; sy = eye.uy * min; sz = eye.uz * min; }
        sl = min;
      } else if (sl > maxLen) { const k = maxLen / sl; sx *= k; sy *= k; sz *= k; sl = maxLen; }
      // across the streak, facing the eye: (motion) x (line of sight)
      wx = sy * tz - sz * ty; wy = sz * tx - sx * tz; wz = sx * ty - sy * tx;
      wl = Math.sqrt(wx * wx + wy * wy + wz * wz);
      if (wl < 1e-9) { wx = eye.rx; wy = eye.ry; wz = eye.rz; wl = 1; }   // coming straight at the eye
    }
    let half = hw, thin = 1;
    const dist = Math.sqrt(tx * tx + ty * ty + tz * tz);
    // the floor: f times wider than it is, so one in f is drawn
    if (least > 0) { const far = least * dist; if (far > half) { thin = thinned(own01(S[i]), share * Math.min(1, roomy * half / far)); half = far; } else if (share < 1) thin = thinned(own01(S[i]), share); }
    else if (share < 1) thin = thinned(own01(S[i]), share);
    if (most > 0 && half > most * dist) half = most * dist;
    let k = half / wl * edgeScale(px, py, pz, eye) * thin;
    if (nearD > 0 && dist < nearD) k *= smooth01((dist / nearD - 0.4) / 0.6);
    if (fin > 0 && A[i] < fin) k *= A[i] / fin;
    if (fout > 0 && L[i] < fout) k *= L[i] > 0 ? L[i] / fout : 0;
    wx *= k; wy *= k; wz *= k;
    const hx = px - sx, hy = py - sy, hz = pz - sz;                      // where it was
    out[q] = px - wx; out[q + 1] = py - wy; out[q + 2] = pz - wz;
    out[q + 3] = px + wx; out[q + 4] = py + wy; out[q + 5] = pz + wz;
    out[q + 6] = hx + wx; out[q + 7] = hy + wy; out[q + 8] = hz + wz;
    out[q + 9] = hx - wx; out[q + 10] = hy - wy; out[q + 11] = hz - wz;
  }
  return n;
}

// Dabs: quads facing the camera. Same arguments as expandStreaks.
// size: the size now (m) when the kit has worked one out from the physics (see dabSize);
// D.size otherwise.
export function expandDabs(buf, D, eye, out, size = D.size, room = 1) {
  const n = Math.min(buf.count, Math.floor(out.length / 12)), P = buf.pos, V = buf.vel, A = buf.age, S = buf.size, L = buf.left;
  const grow = D.grow || 0, spin = D.spin || 0, least = 0.5 * (D.minPx || 0) * eye.pix, most = 0.5 * (D.maxPx || 0) * eye.pix;
  const ex = spin === 0 ? D.exposure || 0 : 0, smear = 2 * (D.smear != null ? D.smear : 2);
  const vs = D.varySize || 0;
  const strobe = ex > 0 ? D.strobe || 0 : 0, streak = D.streak > 0 ? D.streak : 3;
  const tumble = spin === 0 ? D.tumble || 0 : 0, aspect = D.aspect > 0 && D.aspect < 1 ? D.aspect : 1;   // (with spin: a leaf, see `flip`)
  const cell = cellFor(D, eye, buf), c2 = cell * 2, M = buf.mat, SH = eye.shelters, nSH = cell > 0 && SH ? eye.shelterCount : 0;
  const Ex = eye.ex, Ey = eye.ey, Ez = eye.ez, Nx = eye.nx, Ny = eye.ny, Nz = eye.nz;
  // walls (dust in a storm): how far the marks have gone from puffs to walls, and the wall's axes:
  // level along the picture's horizon (picture right with its share along the local up taken out), and the local up
  const wT = D.wall > 1 && eye.wall01 > 0 ? smooth01((eye.wall01 - (D.wallFrom || 0)) / Math.max(1e-6, (D.wallFull || 1) - (D.wallFrom || 0))) : 0;
  const Ux = Ey * Nz - Ez * Ny, Uy = Ez * Nx - Ex * Nz, Uz = Ex * Ny - Ey * Nx;
  let Hx = eye.rx, Hy = eye.ry, Hz = eye.rz;
  if (wT > 0) { const d = Hx * Ux + Hy * Uy + Hz * Uz; Hx -= Ux * d; Hy -= Uy * d; Hz -= Uz * d; const l = Math.sqrt(Hx * Hx + Hy * Hy + Hz * Hz); if (l > 1e-3) { Hx /= l; Hy /= l; Hz /= l; } else { Hx = Ex; Hy = Ey; Hz = Ez; } }
  // (thinned first, widened after: half way to a storm there are already few of them, not hundreds of half-walls)
  const wAsp = 1 + ((D.wall || 1) - 1) * smooth01((wT - 0.3) / 0.7), wKeep = wT > 0 && D.wallShare > 0 && D.wallShare < 1 ? Math.pow(D.wallShare, smooth01(wT / 0.6)) : 1;
  // a wall's height: what hides the same as the marks it stands for, never over wallHigh (the rest is haze)
  const wHigh = wT > 0 ? Math.min(size / Math.sqrt(wKeep * wAsp), size + ((D.wallHigh || size) - size) * wT) / size : 1;
  const share = (D.share > 0 && D.share < 1 ? D.share : 1) * wKeep, roomy = room > 1 ? room : 1;
  const nearD = (D.near || 0) + ((D.wallNear || D.near || 0) - (D.near || 0)) * wT;
  const fout = L ? (D.fadeOut || 0) + (D.wallFade || 0) * wT : 0, fin = (D.fadeIn || 0) + (D.wallFade || 0) * wT;
  const band = D.bands > 0 && eye.band01 > 0 ? D.bands * eye.band01 : 0, bandLong = D.bandLong || 9, bandWide = D.bandWide || 2;
  const flip = spin !== 0 && aspect < 1 ? D.flip || 0 : 0, edgeOn = D.edge > 0 ? D.edge : 0.08;
  // (P15) the physics' own turn of each leaf about its long side (buf.turn, loose.js), when it hands one over: the quad is
  // laid with its short side reversed while the leaf shows its other side (cos(turn) < 0), so its winding turns over
  // with it and a material that colours by gl_FrontFacing (PAINTER's two-toned leaf) flickers as the leaf tumbles
  const TU = flip > 0 && buf.turn && buf.turn.length >= n ? buf.turn : null;
  for (let i = 0, o = 0, q = 0; i < n; i++, o += 3, q += 12) {
    let px = P[o], py = P[o + 1], pz = P[o + 2];
    const age = A[i];
    let h = 0.5 * (size * wHigh + grow * age * (1 - wT));
    if (vs > 0) { const r = S[i] * 51413.7; h *= 1 - vs + 2 * vs * (r - Math.floor(r)); }       // no two flakes the same size
    let tx = px - eye.x, ty = py - eye.y, tz = pz - eye.z, edge = -1;
    if (cell > 0 && !(M && M[i] !== 255)) {
      // shown at its place modulo the cell round the eye; it shrinks to nothing toward the cell's wall
      // (what was raised from the ground, kicked powder, is shown where it is)
      const de = tx * Ex + ty * Ey + tz * Ez, dn = tx * Nx + ty * Ny + tz * Nz;
      const we = de - c2 * Math.round(de / c2), wn = dn - c2 * Math.round(dn / c2);
      const se = we - de, sn = wn - dn;
      px += Ex * se + Nx * sn; py += Ey * se + Ny * sn; pz += Ez * se + Nz * sn;
      tx = px - eye.x; ty = py - eye.y; tz = pz - eye.z;
      const m = Math.max(Math.abs(we), Math.abs(wn)) / cell, t = (m - 0.8) / 0.2;
      edge = t <= 0 ? 1 : t >= 1 ? 0 : 1 - t * t * (3 - 2 * t);
      // not under the hull
      for (let k = 0; k < nSH; k++) { const a = k * 4, dx = we - SH[a], dz = wn - SH[a + 1]; if (dx * dx + dz * dz < SH[a + 3] * SH[a + 3] && (tx * Ux + ty * Uy + tz * Uz) < SH[a + 2]) { edge = 0; break; } }
    }
    const dist = Math.sqrt(tx * tx + ty * ty + tz * tz);
    // bands: the share drawn here, where this flake is in the pattern the wind carries
    let shr = share;
    if (band > 0) {
      const pe = px * Ex + py * Ey + pz * Ez - eye.bandE, pn = px * Nx + py * Ny + pz * Nz - eye.bandN;
      const v = noise3((pe * eye.bandWe + pn * eye.bandWn) / bandLong, (pn * eye.bandWe - pe * eye.bandWn) / bandWide, (px * Ux + py * Uy + pz * Uz) / 6, 517);
      shr *= 1 - band * (1 - smooth01((v + 0.25) / 0.5));
    }
    // the floor: f times larger than it is, so one in f^2 is drawn (unless the physics leaves room)
    if (least > 0 && least * dist > h) { const far = least * dist, f = h / far; h = far * thinned(own01(S[i]), shr * Math.min(1, roomy * f * f)); }
    else if (shr < 1) h *= thinned(own01(S[i]), shr);
    if (most > 0 && h > most * dist) h = most * dist;
    const full = h;                                               // its size before the edge and the fades take from it
    if (dist < nearD) h *= smooth01((dist / nearD - 0.4) / 0.6);
    h *= edge >= 0 ? edge : edgeScale(px, py, pz, eye);
    if (fin > 0 && age < fin) h *= age / fin;
    if (fout > 0 && L[i] < fout) h *= L[i] > 0 ? L[i] / fout : 0;
    let ax = eye.rx, ay = eye.ry, az = eye.rz, bx = eye.ux, by = eye.uy, bz = eye.uz, la = h, lb = h;
    if (spin !== 0) {
      // each particle keeps its own phase (its size is its own and travels with it)
      let a = age * spin + S[i] * 51413.7;
      if (aspect < 1) {
        // a leaf: turning in the picture at its own rate, one way or the other, and tumbling about
        // its long side, so that it is seen broadside (aspect), then edge-on (a line), then broadside
        const r1 = S[i] * 27183.31, f1 = r1 - Math.floor(r1), r2 = S[i] * 65537.17, f2 = r2 - Math.floor(r2);
        a = age * spin * (f2 < 0.5 ? -(0.4 + 0.9 * f1) : 0.4 + 0.9 * f1) + f2 * 6.2831853;
        if (TU) { const ct = Math.cos(TU[i]); lb = h * (edgeOn + (aspect - edgeOn) * Math.abs(ct)) * (ct < 0 ? -1 : 1); }
        else lb = h * (edgeOn + (aspect - edgeOn) * Math.abs(Math.cos(age * flip * (0.6 + 0.8 * f2) + f1 * 6.2831853)));
      }
      const c = Math.cos(a), s = Math.sin(a);
      ax = eye.rx * c + eye.ux * s; ay = eye.ry * c + eye.uy * s; az = eye.rz * c + eye.uz * s;
      bx = eye.ux * c - eye.rx * s; by = eye.uy * c - eye.ry * s; bz = eye.uz * c - eye.rz * s;
    } else if (h > 0 && (ex > 0 || tumble > 0)) {
      // (c, s2): the way its long side lies in the picture; sl: how far it is drawn out along its motion
      let c = 1, s2 = 0, sl = 0;
      if (ex > 0) {
        // drawn out along its motion across the picture during the exposure (never by more than D.smear dab sizes: 2 by default)
        const vx = (V[o] - eye.vx) * ex, vy = (V[o + 1] - eye.vy) * ex, vz = (V[o + 2] - eye.vz) * ex;
        const sr = vx * eye.rx + vy * eye.ry + vz * eye.rz, su = vx * eye.ux + vy * eye.uy + vz * eye.uz;
        sl = Math.sqrt(sr * sr + su * su);
        if (sl > 1e-5) {
          c = sr / sl; s2 = su / sl;
          const travel = sl * strobe / ex;
          // drawn out by its motion during the exposure, capped; but never less than it travels in
          // a frame (else it strobes), and shrinking away where that would make it a hairline
          if (travel > streak * 2 * full) { const k = 1 - smooth01((travel / (streak * 2 * full) - 1) / 0.6); h *= k; }
          const cap = Math.max(smear * h, travel);
          if (sl > cap) sl = cap;
          sl *= 1 - wT;                                              // a wall is not drawn out: it is one
        } else sl = 0;
      }
      lb = h; la = h + 0.5 * sl;
      const mc = c, ms = s2;                                         // the way it moves in the picture
      if (tumble > 0) {
        // its own shape, lying its own way and turning slowly: an oval (long side h, short side its
        // own share of h) at angle th. Drawn out along its motion, the mark is that oval spread along
        // the motion: the two are added as ellipses (second moments), so the mark turns toward the
        // motion steadily as the wind rises and only ever turns fast while it is all but round
        const r1 = S[i] * 27183.31, f1 = r1 - Math.floor(r1), r2 = S[i] * 65537.17, f2 = r2 - Math.floor(r2);
        const th = f2 * 6.2831853 + age * tumble * (f2 < 0.5 ? -(0.35 + 0.65 * f1) : 0.35 + 0.65 * f1), ct = Math.cos(th), st = Math.sin(th);
        const sh = h * (aspect + (1 - aspect) * f1), A2 = h * h, B2 = sh * sh, Q = la * la - A2;
        const xx = A2 * ct * ct + B2 * st * st + Q * mc * mc, yy = A2 * st * st + B2 * ct * ct + Q * ms * ms, xy = (A2 - B2) * ct * st + Q * mc * ms;
        const df = xx - yy, rr = Math.sqrt(df * df + 4 * xy * xy), tr = xx + yy;
        if (rr > 1e-12) { const k = df / rr; c = Math.sqrt(0.5 * (1 + k)); s2 = Math.sqrt(0.5 * (1 - k)); if (xy < 0) s2 = -s2; }
        la = Math.sqrt(0.5 * (tr + rr)); lb = Math.sqrt(Math.max(0, 0.5 * (tr - rr)));
      }
      ax = eye.rx * c + eye.ux * s2; ay = eye.ry * c + eye.uy * s2; az = eye.rz * c + eye.uz * s2;
      bx = eye.ux * c - eye.rx * s2; by = eye.uy * c - eye.ry * s2; bz = eye.uz * c - eye.rz * s2;
      // the head stays where the particle is
      { const k = 0.5 * sl, mx = eye.rx * mc + eye.ux * ms, my = eye.ry * mc + eye.uy * ms, mz = eye.rz * mc + eye.uz * ms; px -= mx * k; py -= my * k; pz -= mz * k; }
    }
    if (wT > 0) {
      // toward a wall: its long side level, its short side the local up (each turned the short way round)
      let k = ax * Hx + ay * Hy + az * Hz < 0 ? -(1 - wT) : 1 - wT;
      ax = ax * k + Hx * wT; ay = ay * k + Hy * wT; az = az * k + Hz * wT;
      let l = Math.sqrt(ax * ax + ay * ay + az * az); if (l > 1e-4) { ax /= l; ay /= l; az /= l; } else { ax = Hx; ay = Hy; az = Hz; }
      k = bx * Ux + by * Uy + bz * Uz < 0 ? -(1 - wT) : 1 - wT;
      bx = bx * k + Ux * wT; by = by * k + Uy * wT; bz = bz * k + Uz * wT;
      l = Math.sqrt(bx * bx + by * by + bz * bz); if (l > 1e-4) { bx /= l; by /= l; bz /= l; } else { bx = Ux; by = Uy; bz = Uz; }
      la *= wAsp;
    }
    ax *= la; ay *= la; az *= la; bx *= lb; by *= lb; bz *= lb;
    out[q] = px - ax - bx; out[q + 1] = py - ay - by; out[q + 2] = pz - az - bz;
    out[q + 3] = px + ax - bx; out[q + 4] = py + ay - by; out[q + 5] = pz + az - bz;
    out[q + 6] = px + ax + bx; out[q + 7] = py + ay + by; out[q + 8] = pz + az + bz;
    out[q + 9] = px - ax + bx; out[q + 10] = py - ay + by; out[q + 11] = pz - az + bz;
  }
  return n;
}

// The size (m) a dab of this kind should have now for the marks to hide what the physics says
// the kind hides: `extinction` (1/m: the share of a sight line hidden per metre; from
// physics.here.weather: precipitation.extinction, dustExtinction) spread over the `count`
// marks alive in `volume` m3 of air, each inking `D.fill` of its quad:
//   count x fill x size^2 = extinction x volume          (fill: the share of the quad that is inked)
// never under D.size, never over D.sizeMax. o (optional): o.cover = the share of that hiding
// the marks then paint (1 = all of it; the rest is haze, which is the sky's to paint).
export function dabSize(D, extinction, count, volume, o) {
  const max = D.sizeMax || D.size, fill = D.fill || 0.785;
  let s = D.size, want = 0;
  if (extinction > 0 && count > 0) { want = Math.sqrt(extinction * volume / (count * fill)); s = want < D.size ? D.size : want > max ? max : want; }
  if (o) o.cover = want > 0 ? Math.min(1, (s * s) / (want * want)) : 1;
  return s;
}

// Veils (P10): what a translucent kind (dust) hides and how soft its edge is, per vertex:
// out[3 per vertex] = opacity01, soft01, veil01 (see `veil` in the header; veil01: 0 a round puff ..
// 1 a level streamer, as the kit lays its quad). buf.hag is the particle's height over the ground
// under it; eye.wall01 what the wind carries (walls are softer).
// out: Float32Array of at least count * 12. Returns the number of quads written.
export function expandVeils(buf, D, eye, out) {
  const n = Math.min(buf.count, Math.floor(out.length / 12)), A = buf.age, L = buf.left, H = buf.hag;
  const lo = D.veilLow != null ? D.veilLow : 0.6, hi = D.veilHigh != null ? D.veilHigh : 0.15, top = D.veilTop > 0 ? D.veilTop : 3, s0 = D.veilSoft != null ? D.veilSoft : 0.5;
  const wT = D.wall > 1 && eye.wall01 > 0 ? smooth01((eye.wall01 - (D.wallFrom || 0)) / Math.max(1e-6, (D.wallFull || 1) - (D.wallFrom || 0))) : 0;
  const fin = (D.fadeIn || 0) + (D.wallFade || 0) * wT + 1e-3, fout = (D.fadeOut || 0) + (D.wallFade || 0) * wT + 1e-3;
  for (let i = 0, q = 0; i < n; i++, q += 12) {
    const up = smooth01((H ? H[i] : 0) / top);
    let op = lo + (hi - lo) * up;
    if (A[i] < fin) op *= A[i] / fin;
    if (L && L[i] < fout) op *= L[i] > 0 ? L[i] / fout : 0;
    const soft = Math.min(1, s0 + (1 - s0) * Math.max(up, 0.6 * wT));
    for (let k = 0; k < 12; k += 3) { out[q + k] = op; out[q + k + 1] = soft; out[q + k + 2] = wT; }
  }
  return n;
}

// A shade per particle (the same on its four vertices) in 1 - vary .. 1, stable for the life
// of the particle. out: Float32Array of at least count * 12 (rgb per vertex, grey).
export function expandShades(buf, vary, out) {
  const n = Math.min(buf.count, Math.floor(out.length / 12)), S = buf.size;
  for (let i = 0, q = 0; i < n; i++, q += 12) {
    const h = S[i] * 73856.093; const g = 1 - vary * (h - Math.floor(h));
    for (let k = 0; k < 12; k++) out[q + k] = g;
  }
  return n;
}

// The ground each particle was raised from, once per vertex: buf.mat (an index into the physics'
// MATERIAL_IDS, 255 = not from the ground) copied to its quad's four vertices.
// out: Uint8Array of at least count * 4.
export function expandMats(buf, out) {
  const n = Math.min(buf.count, out.length >> 2), M = buf.mat;
  for (let i = 0, q = 0; i < n; i++, q += 4) { const m = M ? M[i] : 255; out[q] = m; out[q + 1] = m; out[q + 2] = m; out[q + 3] = m; }
  return n;
}

// Ground marks (physics.fields.deform.marks): one quad per live mark, laid on the ground.
//   frame: physics.fields.frame.  heightAt(x, z) -> m above the frame's datum, or NaN where
//   the near field does not know the ground (the quad then lies in the mark's own tangent plane).
//   time: physics.time.  lift: m above the ground (decals need a little; also give the material
//   a polygon offset).
//   pos: Float32Array(capacity * 12), relative to marks.origin.
//   data: Float32Array(capacity * 16) or null: per vertex (depth m, rim m, kind, fade 0..1).
//   shade: Float32Array(capacity * 12) or null: grey per vertex, darker where deeper and
//          fresher (so a stand-in material with vertex colours shows the print at all).
//   mat: Uint8Array(capacity * 4) or null: per vertex, the material the mark was pressed into
//        (an index into the physics' MATERIAL_IDS, 255 = unknown).
// Returns the number of quads.
const _d = new Float64Array(3);
export function expandMarks(marks, frame, heightAt, time, lift, pos, data, shade, mat) {
  const M = marks.data, st = marks.stride, cap = marks.capacity, O = marks.origin;
  let n = 0;
  for (let m = 0; m < cap; m++) {
    const o = m * st, life = M[o + 11];
    if (!(life > 0)) continue;
    const fade = 1 - (time - M[o + 10]) / life;
    if (!(fade > 0)) continue;
    const mx = M[o] + O.x, my = M[o + 1] + O.y, mz = M[o + 2] + O.z;         // body-local
    const dx = M[o + 3], dy = M[o + 4], dz = M[o + 5], hl = M[o + 6] * 0.5, hw = M[o + 7] * 0.5;
    const r = Math.sqrt(mx * mx + my * my + mz * mz) || 1, ux = mx / r, uy = my / r, uz = mz / r;
    // across = along x up (so that across x along = up and the quad faces the sky)
    const sx = dy * uz - dz * uy, sy = dz * ux - dx * uz, sz = dx * uy - dy * ux;
    const gx = frame.lx(mx, my, mz), gz = frame.lz(mx, my, mz);
    const de = dx * frame.ex + dy * frame.ey + dz * frame.ez, dn = dx * frame.nx + dy * frame.ny + dz * frame.nz;
    const se = sx * frame.ex + sy * frame.ey + sz * frame.ez, sn = sx * frame.nx + sy * frame.ny + sz * frame.nz;
    const q = n * 12;
    for (let c = 0; c < 4; c++) {
      const a = (c === 0 || c === 3 ? -1 : 1) * hw, b = (c < 2 ? -1 : 1) * hl;
      let h = heightAt ? heightAt(gx + se * a + de * b, gz + sn * a + dn * b) : NaN;
      let px, py, pz;
      if (h === h) {
        frame.dir(gx + se * a + de * b, gz + sn * a + dn * b, _d);
        const rr = frame.r0 + h + lift; px = _d[0] * rr; py = _d[1] * rr; pz = _d[2] * rr;
      } else {
        px = mx + sx * a + dx * b + ux * lift; py = my + sy * a + dy * b + uy * lift; pz = mz + sz * a + dz * b + uz * lift;
      }
      pos[q + c * 3] = px - O.x; pos[q + c * 3 + 1] = py - O.y; pos[q + c * 3 + 2] = pz - O.z;
      if (data) { const k = n * 16 + c * 4; data[k] = M[o + 8]; data[k + 1] = M[o + 12]; data[k + 2] = M[o + 9]; data[k + 3] = fade; }
      if (shade) { const g = 1 - Math.min(0.75, 0.25 + M[o + 8] * 9) * Math.min(1, fade * 3); const k = q + c * 3; shade[k] = g; shade[k + 1] = g; shade[k + 2] = g; }
      if (mat) mat[n * 4 + c] = st > 13 ? M[o + 13] : 255;
    }
    n++;
  }
  return n;
}

// Rings on the ground and on liquid (physics.particles.events): the splash of a drop, the
// ripple it leaves on water, the puff where a flake or a grain settles, a hailstone's bounce.
// One quad per event still alive, flat on the local horizontal, growing as it ages.
//   RING: per kind [life s, first radius m, growth m/s].
//   pos: Float32Array(capacity * 12) relative to events.origin.
//   data: Float32Array(capacity * 16) or null: per vertex (kind, strength, age 0..1, size m).
export const RING = Object.freeze([
  Object.freeze([0.28, 0.02, 0.35]),   // splash: a crown, quick
  Object.freeze([1.4, 0.03, 0.22]),    // ripple: a ring that travels at capillary-wave speed
  Object.freeze([0.5, 0.02, 0.05]),    // settle
  Object.freeze([0.3, 0.02, 0.2]),     // bounce
]);
export function expandRings(events, frame, time, lift, pos, data) {
  const E = events.data, cap = events.capacity, O = events.origin;
  let n = 0;
  for (let m = 0; m < cap; m++) {
    const o = m * 8, kind = E[o + 3] | 0, R = RING[kind] || RING[0];
    const age = time - E[o + 5];
    if (!(E[o + 4] > 0) || !(age >= 0) || age >= R[0]) continue;
    const x = E[o], y = E[o + 1], z = E[o + 2];
    const s = (R[1] + R[2] * age) * (0.6 + 0.8 * E[o + 4]);
    const ux = frame.ax * lift, uy = frame.ay * lift, uz = frame.az * lift;
    const q = n * 12;
    for (let c = 0; c < 4; c++) {
      const a = (c === 0 || c === 3 ? -s : s), b = (c < 2 ? -s : s);
      pos[q + c * 3] = x + frame.ex * a + frame.nx * b + ux;
      pos[q + c * 3 + 1] = y + frame.ey * a + frame.ny * b + uy;
      pos[q + c * 3 + 2] = z + frame.ez * a + frame.nz * b + uz;
      if (data) { const k = n * 16 + c * 4; data[k] = kind; data[k + 1] = E[o + 4]; data[k + 2] = age / R[0]; data[k + 3] = E[o + 6]; }
    }
    n++;
  }
  return n;
}

// The liquid surface near the focus: an (N+1) x (N+1) grid of `step` metres, centred on the
// lattice point nearest grid position (cx, cz) (it moves in whole steps, so vertices never
// swim under the waves), at radius frame.r0 + level, lifted by the waves and the wakes.
//   water: physics.fields.water.field (WaterField).  pos, nrm: Float32Array((N+1)^2 * 3),
//   body-local relative to the frame's anchor (frame.ox, oy, oz); nrm may be null.
// Returns the number of vertices.
const _ws = new Float64Array(4), _wc = new Float64Array(4), _gs = new Float64Array(4), _gc = new Float64Array(4);
const _dws = new Float64Array(4), _dwc = new Float64Array(4), _dgs = new Float64Array(4), _dgc = new Float64Array(4);
const _wk = new Float64Array(3);
export function expandWater(water, frame, cx, cz, N, step, pos, nrm, group = 0.45) {
  const x0 = Math.round(cx / step) * step - N * step * 0.5, z0 = Math.round(cz / step) * step - N * step * 0.5;
  const kx = water.kx, kz = water.kz, gx = water.gx, gz = water.gz, amp = water.amp, ph = water.phase, gph = water.gphase, R = frame.r0 + water.level;
  const NT = amp.length;
  const ex = frame.ex, ey = frame.ey, ez = frame.ez, nx = frame.nx, ny = frame.ny, nz = frame.nz;
  // along a row each train's phase (and its groups') advances by a fixed angle: turn
  // (sin, cos) instead of calling the trigonometry at every vertex
  for (let t = 0; t < NT; t++) { _dwc[t] = Math.cos(kx[t] * step); _dws[t] = Math.sin(kx[t] * step); _dgc[t] = Math.cos(gx[t] * step); _dgs[t] = Math.sin(gx[t] * step); }
  let wakes = false; for (let w = 3; w < water.wake.length; w += 4) if (water.wake[w] > 0) { wakes = true; break; }
  let v = 0;
  for (let j = 0; j <= N; j++) {
    const z = z0 + j * step;
    for (let t = 0; t < NT; t++) { const a = kx[t] * x0 + kz[t] * z - ph[t], e = gx[t] * x0 + gz[t] * z - gph[t]; _ws[t] = Math.sin(a); _wc[t] = Math.cos(a); _gs[t] = Math.sin(e); _gc[t] = Math.cos(e); }
    // the point of the tangent plane under the start of the row, and the step along it
    let qx = frame.ox + ex * x0 + nx * z, qy = frame.oy + ey * x0 + ny * z, qz = frame.oz + ez * x0 + nz * z;
    for (let i = 0; i <= N; i++, v += 3) {
      let h = 0, he = 0, hn = 0;
      for (let t = 0; t < NT; t++) {
        const A = amp[t];
        if (A !== 0) {
          const env = 1 + group * _gs[t];
          h += A * env * _ws[t];
          if (nrm) { const c = A * env * _wc[t], gg = A * group * _gc[t] * _ws[t]; he += c * kx[t] + gg * gx[t]; hn += c * kz[t] + gg * gz[t]; }
        }
        let tt = _ws[t] * _dwc[t] + _wc[t] * _dws[t]; _wc[t] = _wc[t] * _dwc[t] - _ws[t] * _dws[t]; _ws[t] = tt;
        tt = _gs[t] * _dgc[t] + _gc[t] * _dgs[t]; _gc[t] = _gc[t] * _dgc[t] - _gs[t] * _dgs[t]; _gs[t] = tt;
      }
      if (wakes) { water.wakeInto(x0 + i * step, z, _wk); h += _wk[0]; he += _wk[1]; hn += _wk[2]; }
      const l = 1 / Math.sqrt(qx * qx + qy * qy + qz * qz), ux = qx * l, uy = qy * l, uz = qz * l, r = R + h;
      pos[v] = ux * r - frame.ox; pos[v + 1] = uy * r - frame.oy; pos[v + 2] = uz * r - frame.oz;
      if (nrm) {
        // up - slope: (up) - dh/deast * east - dh/dnorth * north, normalised
        const mx = ux - he * ex - hn * nx, my = uy - he * ey - hn * ny, mz = uz - he * ez - hn * nz;
        const ml = 1 / Math.sqrt(mx * mx + my * my + mz * mz);
        nrm[v] = mx * ml; nrm[v + 1] = my * ml; nrm[v + 2] = mz * ml;
      }
      qx += ex * step; qy += ey * step; qz += ez * step;
    }
  }
  return v / 3;
}

// Static parts of a quad list: indices and uvs for `quads` quads.
export function quadIndices(quads) {
  const idx = quads * 4 > 65535 ? new Uint32Array(quads * 6) : new Uint16Array(quads * 6);
  for (let i = 0; i < quads; i++) { const v = i * 4, o = i * 6; idx[o] = v; idx[o + 1] = v + 1; idx[o + 2] = v + 2; idx[o + 3] = v; idx[o + 4] = v + 2; idx[o + 5] = v + 3; }
  return idx;
}
export function quadUvs(quads) {
  const uv = new Float32Array(quads * 8);
  for (let i = 0; i < quads; i++) { const o = i * 8; uv[o] = 0; uv[o + 1] = 0; uv[o + 2] = 1; uv[o + 3] = 0; uv[o + 4] = 1; uv[o + 5] = 1; uv[o + 6] = 0; uv[o + 7] = 1; }
  return uv;
}
export function gridIndices(N) {
  const idx = (N + 1) * (N + 1) > 65535 ? new Uint32Array(N * N * 6) : new Uint16Array(N * N * 6);
  for (let j = 0, o = 0; j < N; j++) for (let i = 0; i < N; i++, o += 6) {
    const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1;
    idx[o] = a; idx[o + 1] = b; idx[o + 2] = d; idx[o + 3] = a; idx[o + 4] = d; idx[o + 5] = c;
  }
  return idx;
}
