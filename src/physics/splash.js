// Painted Cosmos physics: THE PLAYER IN THE WATER -- the rings it leaves, the water it throws, how wet it is.
// OWNER: PHYSICS (the water group, lane W4; docs/lead/WATER-DESIGN.md 3.6). Pure.
//
// What was there before (and stays, untouched, with every switch off): a wader and a swimmer lay ring EVENTS for the
// kits (loose.js WADE) and throw spray at the legs and a collar at the shoulders; the explorer's bow wave goes into the
// water's 16 per-vertex wakes (index.js). What this adds, each behind the water group's switch:
//   ?wakes=2   THE PLAYER'S OWN SMALL WAVES drawn per pixel (water.js WAKES2): the bow wave moved there from the 16 (a
//              metre-long ring is lost between vertices a metre or more apart), a ring from each footfall in water,
//              a pulse at each arm stroke of a swimmer, and the furrow a low fast flight presses into the water.
//   ?splash=1  SPLASHES (SPLASHES.on): a crown of drops going in (more with the square of the speed), a few flecks at each
//              footfall in water, a trail of spray behind a low fast flight. They are the particle system's own spray
//              (loose.js emit 'spray', drawn by the kits as small white strokes): one emitter, no new buffer.
// And, always while either is on: how wet the figure is (wet01, rising in the water, falling off over a minute or two
// out of it) and what the audio wants of the water here (`here`, below), both read from the facade
// (index.js: physics.here.water).
import { WAKES2, WAKE_KIND, WATER, wakeLength } from './water.js';

export const SPLASH = Object.freeze({
  footDepth: 0.03,      // m of water over the foot below which a footfall makes no ring
  footAmp: [0.010, 0.020],    // m: a footfall's ring, from a step to a stamp (by how fast the foot meets the ground)
  strokeAmp: 0.022,     // m: an arm stroke's pulse at each hand
  strokeSide: 0.35,     // m from the body's line to each hand
  pressHeight: 8,       // m over the water under which a flight presses a furrow
  pressSpeed: 8,        // m/s over which it does
  pressAmp: 0.05,       // m: the furrow's source at the surface, at twice pressSpeed
  pressEvery: 0.12,     // s of flight between two sources (at least 1.2 m apart)
  inSpeed: 1.5,         // m/s (down, or across at a third) from which going in throws a crown
  inDrops: 18,          // drops in the crown for each (m/s)^2 of the speed going in (at most inMax)
  inMax: 160,
  footDrops: 5,         // flecks at a footfall in water
  trailDrops: 3,        // drops thrown behind each furrow source when flying under 3 m
  wetIn: 0.6,           // a second: how fast the figure soaks (to 1)
  wetOut: 90,           // s: how long it takes to dry (wet01 falls by e in this)
});

// The splashes' own switch (the paint's module sets it from ?splash=1, render/waterchunk.js); physics never does.
export const SPLASHES = { on: false };

// One player's state in the water (index.js keeps one for the explorer).
export function makeWaterPlay() {
  return {
    steps: -1, stroke: 0, ringX: 1e9, ringZ: 1e9, ringT: -1e9, pressT: -1e9, pressX: 1e9, pressZ: 1e9,
    inWater: false, wet01: 0, rng: 0x9e3779b9,
    // what the audio wants of the water here (PILOT's audio.js voices; WATER-DESIGN 3.6): metres over the water's surface
    // under the body (0 standing in it; 1e9 none under it, or over 50 m), how deep the body is in it 0..1, how wet the figure is, and whether it is going in
    // now (a splash's strength 0..1, for one frame). The river's speed, the falls' distance and drop and the rain on the
    // water are the bodies-of-water and weather lanes' to give: 0 here until they do.
    here: { near: 1e9, submerged: 0, wet01: 0, splash: 0, speed: 0, fallD: 1e9, fallDrop: 0, rainOn: 0 },
  };
}

function rnd(P) { P.rng = (P.rng * 1664525 + 1013904223) >>> 0; return P.rng / 4294967296; }

// One step. P: makeWaterPlay(); water: the WaterField; loose: the Loose emitter (or null); D: the explorer's disturber
// (D.phys: its body state, explorer.js: steps, footfall, swim, stroke, grounded); frame: the LocalFrame; x, z: the body on
// the grid (m); hgt: how far its point is over the liquid's surface (m; under 0 in it); lq: that surface (m over
// frame.r0); time, dt (s). Returns nothing; lays rings and drops and writes P.here.
export function stepWaterPlay(P, water, loose, D, frame, x, z, hgt, lq, time, dt) {
  const B = D.phys || null;
  const vx = D.v ? D.v.x * frame.ex + D.v.y * frame.ey + D.v.z * frame.ez : 0;
  const vz = D.v ? D.v.x * frame.nx + D.v.y * frame.ny + D.v.z * frame.nz : 0;
  const vu = D.v ? D.v.x * frame.ax + D.v.y * frame.ay + D.v.z * frame.az : 0;
  const sp = Math.hypot(vx, vz);
  const depth = -hgt;                                   // m of water over the body's point (the feet)
  const inNow = depth > 0.02;
  const H = P.here;
  H.splash = 0;
  // HOW WET: it soaks quickly in the water, as deep as it goes (the knee is not the shoulders), and dries over minutes
  const soak = inNow ? Math.min(1, 0.35 + depth / 1.2) : 0;
  if (soak > P.wet01) P.wet01 += (soak - P.wet01) * Math.min(1, dt / SPLASH.wetIn);
  else P.wet01 *= Math.exp(-dt / SPLASH.wetOut);
  H.wet01 = P.wet01; H.submerged = inNow ? Math.min(1, depth / 1.6) : 0; H.near = inNow ? 0 : (hgt < 50 ? hgt : 1e9);

  // GOING IN: from out of the water into it, at speed: a crown of drops and a big ring
  if (inNow && !P.inWater) {
    const v = Math.max(-vu, sp / 3);
    if (v > SPLASH.inSpeed) {
      const s01 = Math.min(1, (v - SPLASH.inSpeed) / 6);
      H.splash = 0.3 + 0.7 * s01;
      water.addRing(x, z, Math.min(0.12, 0.025 + 0.012 * v), WAKE_KIND.bow);
      if (SPLASHES.on && loose) {
        let n = Math.min(SPLASH.inMax, Math.round(SPLASH.inDrops * v * v * 0.25));
        while (n-- > 0) {
          const a = rnd(P) * 6.2831853, r = 0.25 + 0.25 * rnd(P), out = v * (0.25 + 0.35 * rnd(P)), up = v * (0.45 + 0.55 * rnd(P));
          if (!loose.emit('spray', x + Math.cos(a) * r, lq + 0.04, z + Math.sin(a) * r, Math.cos(a) * out + vx * 0.3, up, Math.sin(a) * out + vz * 0.3, 1, 1)) break;
        }
      }
    }
  }
  P.inWater = inNow;

  // THE BOW WAVE (moved here from the 16 when ?wakes=2: index.js), as v37 lays it
  if (WAKES2.on && hgt < 0.2 && hgt > -2.5) {
    const amp = Math.min(0.06, 0.012 * Math.hypot(vx, vz, vu));
    if (amp >= 0.004) {
      const L = wakeLength(amp);
      if (Math.hypot(x - P.ringX, z - P.ringZ) >= WATER.wakeEvery * L || time - P.ringT >= WATER.wakeEvery || time < P.ringT) { water.addRing(x, z, amp, WAKE_KIND.bow); P.ringX = x; P.ringZ = z; P.ringT = time; }
    }
  }

  // A RING FROM EACH FOOTFALL IN WATER (explorer.js counts them: B.steps; the last one is B.footfall)
  if (B && B.steps !== P.steps) {
    const first = P.steps < 0;
    P.steps = B.steps;
    const F = B.footfall;
    if (!first && F && F.p && depth > SPLASH.footDepth && depth < 1.1) {
      const fx = frame.lx(F.p.x, F.p.y, F.p.z), fz = frame.lz(F.p.x, F.p.y, F.p.z);
      const k = Math.min(1, Math.max(0, ((F.speed || 0) - 0.3) / 2.5));
      water.addRing(fx, fz, SPLASH.footAmp[0] + (SPLASH.footAmp[1] - SPLASH.footAmp[0]) * k, WAKE_KIND.foot);
      if (SPLASHES.on && loose) {
        for (let n = 0; n < SPLASH.footDrops; n++) {
          const a = rnd(P) * 6.2831853, out = 0.5 + 0.8 * rnd(P) + 0.3 * k, up = 0.8 + 0.9 * rnd(P) + 0.6 * k;
          if (!loose.emit('spray', fx + Math.cos(a) * 0.12, lq + 0.03, fz + Math.sin(a) * 0.12, Math.cos(a) * out + vx * 0.3, up, Math.sin(a) * out + vz * 0.3, 0.8, 0.8)) break;
        }
      }
    }
  }

  // A PULSE AT EACH ARM STROKE OF A SWIMMER (explorer.js B.stroke runs 0 .. 1 a cycle): at the two hands
  if (B && B.swim > 0.5) {
    const st = B.stroke || 0;
    if (st < P.stroke - 0.5) {
      const dx = sp > 0.2 ? vx / sp : 1, dz = sp > 0.2 ? vz / sp : 0, s = SPLASH.strokeSide;
      water.addRing(x + dx * 0.4 - dz * s, z + dz * 0.4 + dx * s, SPLASH.strokeAmp, WAKE_KIND.stroke);
      water.addRing(x + dx * 0.4 + dz * s, z + dz * 0.4 - dx * s, SPLASH.strokeAmp, WAKE_KIND.stroke);
    }
    P.stroke = st;
  } else if (B) P.stroke = B.stroke || 0;

  // THE FURROW OF A LOW FAST FLIGHT: sources dropped behind, deeper the lower and the faster; spray under 3 m
  if (hgt > 0.3 && hgt < SPLASH.pressHeight && sp > SPLASH.pressSpeed) {
    const gap = Math.max(1.2, sp * SPLASH.pressEvery);
    if (Math.hypot(x - P.pressX, z - P.pressZ) >= gap || time < P.pressT) {
      const low = 1 - hgt / SPLASH.pressHeight, fast = Math.min(1.5, sp / (2 * SPLASH.pressSpeed));
      water.addRing(x, z, SPLASH.pressAmp * low * low * fast, WAKE_KIND.press);
      P.pressX = x; P.pressZ = z; P.pressT = time;
      if (SPLASHES.on && loose && hgt < 3) {
        for (let n = 0; n < SPLASH.trailDrops; n++) {
          const a = rnd(P) * 6.2831853, up = (1.5 + 2 * rnd(P)) * low;
          if (!loose.emit('spray', x + Math.cos(a) * 0.6, lq + 0.05, z + Math.sin(a) * 0.6, vx * 0.35 + Math.cos(a) * 0.8, up, vz * 0.35 + Math.sin(a) * 0.8, 1, 1)) break;
        }
      }
    }
  }
}

// Out of reach of any water (no liquid near the focus): the figure only dries.
export function dryWaterPlay(P, dt) {
  P.wet01 *= Math.exp(-dt / SPLASH.wetOut);
  P.inWater = false;
  const H = P.here; H.wet01 = P.wet01; H.submerged = 0; H.splash = 0; H.near = 1e9;
}
