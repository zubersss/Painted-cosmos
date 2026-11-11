// Painted Cosmos physics: loose particles: dust, sand, ash, spores, leaves, spray, hail.
// OWNER: PHYSICS. Pure (no three, no DOM). Works on the buffers made in particles.js.
//
// Each particle is a point mass with weight and quadratic drag toward the moving air, scaled to
// its own terminal speed for this planet's gravity and air (the same law as the rain):
//   dv/dt = g - (g / vt^2) |v - w| (v - w)
// In a vacuum vt is infinite and the drag term vanishes: kicked dust then flies in clean
// parabolas and lands within a second or two, with no cloud left hanging (the Moon, Mercury).
// In air a 30 micron dust grain falls at 5 cm/s, so it is carried off by the wind and hangs.
//
// Where they come from:
//   feet        dust and sand kicked up behind a walker, in proportion to speed, slip and how
//               loose the ground is (ground().dust); a puff on landing; powder from snow
//   jets        the jetpack plume and the ship's downwash scour loose ground into a radial sheet
//               (spray over liquid), at a speed set by the dynamic pressure of the jet
//   the wind    saltation: above the threshold wind, sand grains hop along the ground in low
//               arcs, each impact launching the next (streamers); fine dust is lifted and hangs
//   the weather dust storms; hail in a storm core
//   the biome   falling leaves, spores, ash
//   dust devils a rising helix of dust (features.js)
import { SPECIES, terminalVelocity, meanFreePath, ATMOSPHERES } from './atmosphere.js';
import { saltationThreshold } from './weather.js';
import { BODIES } from '../data/bodies.js';
import { PARTICLES, EVENT } from './particles.js';
import { clamp01, smoothstep } from './util.js';

// species: row of atmosphere.SPECIES for the fall speed.  life: [min, max] seconds.
// puff: seconds for which a kicked or blown grain is carried by the parcel of air thrown up with
// it. A 30 micron grain alone stops within millimetres; a puff of dust rises because the foot or
// the jet moves the air, and the dust rides that air until it mixes away.
// flutter: sideways tumbling speed as a fraction of the fall speed (capped at 1 m/s).
// turb: how much of the air's turbulence the particle follows.
// ground: what happens on touching the ground: 0 dies, 1 hops on (saltation), 2 bounces (hail).
export const LOOSE = Object.freeze({
  dust: { species: 'dust', life: [3, 8], flutter: 0, turb: 1.0, ground: 0, rest: 0, puff: 0.45 },
  sand: { species: 'sand', life: [1.5, 4], flutter: 0, turb: 0.25, ground: 1, rest: 0.5 },
  ash: { species: 'ash', life: [8, 16], flutter: 0.3, turb: 0.7, ground: 0, rest: 0, puff: 0.3 },
  spores: { species: 'spore', life: [8, 16], flutter: 0.5, turb: 0.9, ground: 0, rest: 0, puff: 0.3 },
  leaves: { species: 'leaf', life: [6, 14], flutter: 0.6, turb: 0.5, ground: 0, rest: 0 },
  spray: { species: 'spray', life: [0.5, 1.4], flutter: 0, turb: 0.1, ground: 0, rest: 0 },
  hail: { species: 'hail', life: [3, 6], flutter: 0, turb: 0, ground: 2, rest: 0.45 },
});
export const LOOSE_KINDS = Object.keys(LOOSE);

export const KICK = Object.freeze({
  perMetre: 5,          // dust grains raised per metre walked on the loosest ground
  landing: 10,          // grains per m/s of landing speed
  up: 1.1,              // m/s: typical upward speed of a kicked grain
  jetRate: 90,          // grains per second per unit of jet load on the loosest ground
  jetSpeedMax: 14,      // m/s: fastest a grain leaves a jet's footprint
  // Once sand is hopping, each impact keeps it going at a lower wind than was needed to start
  // it: the impact threshold. On Earth it is 0.8 of the fluid threshold; on Mars about a tenth
  // (Kok 2010), which is why Martian storms keep saltating in winds that could not start it.
  impactRatio: { earth: 0.8, mars: 0.12, venus: 0.8, default: 0.8 },
});

const _gp = { dust: 0, repose: 0, liquid: 0, h: 0 };

export class Loose {
  constructor(particles) {
    this.P = particles;
    this.rng = particles.rng;
    this.vt = {};                        // base terminal speed per kind for the current air
    this._vtKey = '';
    for (const k of LOOSE_KINDS) {
      const b = particles.buffers[k];
      b._life = new Float32Array(b.capacity);
      b._e = LOOSE[k].puff ? new Float32Array(b.capacity * 3) : null;      // velocity of the air parcel it left with
      b.species = LOOSE[k].species;
      this.vt[k] = 1;
    }
    this._carry = new Float64Array(8);   // fractional emissions carried between frames
    this._wade = 0;
  }

  _terminal(bodyId, rho, T) {
    const key = bodyId + ':' + Math.round(rho * 500) + ':' + Math.round(T / 5);
    if (key === this._vtKey) return;
    this._vtKey = key;
    const atm = ATMOSPHERES[bodyId], g = BODIES[bodyId].gravity, mfp = meanFreePath(bodyId, rho, T);
    for (const k of LOOSE_KINDS) {
      let v = terminalVelocity(SPECIES[LOOSE[k].species], g, rho, atm.mu, mfp);
      if (!(v < 1e5)) v = 1e5;            // vacuum: no drag at all
      if (v < 0.004) v = 0.004;           // floats (a leaf in Venus air): drifts with the air
      this.vt[k] = v;
      this.P.buffers[k].fallSpeed = v;
    }
  }

  // Add one particle (frame coordinates: east, up, north). Returns false when the kind is full.
  emit(kind, x, y, z, vx, vy, vz, sizeMul = 1, lifeMul = 1) {
    const b = this.P.buffers[kind], K = LOOSE[kind];
    const cap = PARTICLES.capacity[kind][this.P.quality];
    if (b._n >= cap) return false;
    const i = b._n++, o = i * 3, r = this.rng;
    b._p[o] = x; b._p[o + 1] = y; b._p[o + 2] = z;
    b._v[o] = vx; b._v[o + 1] = vy; b._v[o + 2] = vz;
    if (b._e) { b._e[o] = vx; b._e[o + 1] = vy; b._e[o + 2] = vz; }
    const s = (0.6 + r() * 0.9) * sizeMul;
    b.size[i] = SPECIES[K.species].d * s;
    // a bigger grain falls faster: vt ~ d in the drag-dominated regime, d^2 in Stokes'; use d^1.2
    b._vt[i] = this.vt[kind] * Math.pow(s, 1.2);
    b._ph[i] = r() * 6.2831853;
    b._life[i] = (K.life[0] + r() * (K.life[1] - K.life[0])) * lifeMul;
    b.age[i] = 0;
    return true;
  }

  // Ground under grid position (x, z) from the near cache: fills _gp { dust, repose, liquid, h }.
  _ground(near, x, z, groundY, wet01, snowDepth) {
    const n = near ? near.nearest(x, z) : -1;
    if (n < 0) { _gp.dust = 0; _gp.repose = 0; _gp.liquid = 0; _gp.h = groundY; return _gp; }
    const c = near.cover, a = n * near.CW;
    _gp.dust = c[a + 2] * (1 - smoothstep(0.05, 0.4, wet01));
    _gp.repose = c[a + 3]; _gp.liquid = c[a + 7];
    _gp.h = near.heightAt(x, z, near.h[n]);
    if (snowDepth > 0.03) { _gp.dust = 0; }
    return _gp;
  }

  // Advance. Arguments as Particles.update, plus:
  //   disturbers (frame.disturbers), sigma (turbulence at the focus, m/s), wet01, snowDepth,
  //   dust01 (airborne dust of the weather), sandy01 (how much loose sand the wind can move),
  //   devils: [{ x, z (grid), radius, speed, up, spin, strength, height }] (features.js) or null.
  update(dt, frame, air, near, fx, fy, fz, groundY, wx, rho, cover, bodyId, g, time, disturbers, sigma, wet01, snowDepth, devils) {
    const P = this.P, rng = this.rng, h = dt > 0.1 ? 0.1 : dt;
    const Rr = PARTICLES.radius;
    this._terminal(bodyId, rho, wx ? wx.temperature : 288);
    const wp = P._wp, hfl = P._hfl;
    // reference wind at the focus (10 m) and at knee height
    const cwe = (wp[15] + wp[18] + wp[27] + wp[30]) * 0.25, cwn = (wp[16] + wp[19] + wp[28] + wp[31]) * 0.25;
    const u10 = Math.hypot(cwe, cwn);
    const carry = this._carry;

    // ---- emitters: the weather and the biome --------------------------------------------------
    if (h > 0) {
      // dust storm / dust haze: fine dust carried through the whole box
      const dust01 = wx ? wx.dust01 : 0;
      const bd = P.buffers.dust, capD = PARTICLES.capacity.dust[P.quality];
      if (dust01 > 0.03 && rho > 0) {
        carry[0] += capD * 0.6 * dust01 * h / 5;
        while (carry[0] >= 1 && bd._n < capD * (0.25 + 0.6 * dust01)) {
          carry[0] -= 1;
          const y = groundY + rng() * rng() * 14;
          this.emit('dust', fx + (rng() * 2 - 1) * Rr, y, fz + (rng() * 2 - 1) * Rr, cwe * 0.6, 0, cwn * 0.6, 1.4, 1.2);
        }
        if (carry[0] > 4) carry[0] = 4;
      }
      // saltation: sand hops where the wind is over the threshold and the ground is loose sand
      const gp = this._ground(near, fx, fz, groundY, wet01, snowDepth);
      const loose = gp.repose > 0 ? gp.dust : 0;
      if (loose > 0.2 && rho > 0) {
        const ratio = KICK.impactRatio[bodyId] || KICK.impactRatio.default;
        const thr = saltationThreshold(bodyId, rho) * (1 + (ratio - 1) * clamp01(dust01 * 2));
        const excess = u10 / thr - 0.85;
        if (excess > 0) {
          const capS = PARTICLES.capacity.sand[P.quality];
          carry[1] += capS * clamp01(excess / 0.7) * loose * h / 1.6;
          const ue = u10 > 1e-6 ? cwe / u10 : 1, un = u10 > 1e-6 ? cwn / u10 : 0;
          while (carry[1] >= 1) {
            carry[1] -= 1;
            const x = fx + (rng() * 2 - 1) * Rr, z = fz + (rng() * 2 - 1) * Rr;
            const gy = near ? near.heightAt(x, z, groundY) : groundY;
            // launched at 50 degrees or so with a speed of a few threshold friction velocities
            const vu = (0.5 + rng() * 1.1) * Math.sqrt(9 / g) * (0.7 + 0.5 * Math.min(2, excess));
            if (!this.emit('sand', x, gy + 0.01, z, ue * vu * 0.6, vu, un * vu * 0.6)) break;
          }
          if (carry[1] > 4) carry[1] = 4;
          // and the fines the hopping sand knocks loose are lifted as dust
          carry[2] += capD * 0.25 * clamp01(excess) * loose * h / 4;
          while (carry[2] >= 1) { carry[2] -= 1; this.emit('dust', fx + (rng() * 2 - 1) * Rr, groundY + rng() * 0.6, fz + (rng() * 2 - 1) * Rr, cwe * 0.3, 0.4 + rng(), cwn * 0.3); }
        }
      }
      // hail in the core of a strong storm
      const hail01 = wx && wx.precipitation ? wx.precipitation.hail01 || 0 : 0;
      if (hail01 > 0) {
        carry[3] += PARTICLES.capacity.hail[P.quality] * hail01 * h / 1.5;
        while (carry[3] >= 1) { carry[3] -= 1; if (!this.emit('hail', fx + (rng() * 2 - 1) * Rr, groundY + PARTICLES.height * (0.5 + 0.5 * rng()), fz + (rng() * 2 - 1) * Rr, cwe, -this.vt.hail, cwn)) break; }
      }
      // the biome: leaves fall faster in gusts, spores and ash drift all the time
      if (rho > 0.05) {
        const gusty = clamp01(0.15 + u10 / 9 + sigma * 0.4);
        const lv = (cover.leaves || 0) * (cover.canopy01 > 0.05 ? 1 : 0.3);
        if (lv > 0.01) {
          carry[4] += PARTICLES.capacity.leaves[P.quality] * lv * gusty * h / 9;
          const top = Math.max(3, cover.canopyHeight || 6);
          while (carry[4] >= 1) { carry[4] -= 1; if (!this.emit('leaves', fx + (rng() * 2 - 1) * Rr, groundY + top * (0.4 + 0.6 * rng()), fz + (rng() * 2 - 1) * Rr, cwe * 0.3, 0, cwn * 0.3)) break; }
        }
        if ((cover.spores || 0) > 0.01) {
          carry[5] += PARTICLES.capacity.spores[P.quality] * cover.spores * h / 12;
          while (carry[5] >= 1) { carry[5] -= 1; if (!this.emit('spores', fx + (rng() * 2 - 1) * Rr, groundY + 0.2 + rng() * rng() * 9, fz + (rng() * 2 - 1) * Rr, cwe * 0.3, 0.1 * rng(), cwn * 0.3)) break; }
        }
        if ((cover.ash || 0) > 0.01) {
          carry[6] += PARTICLES.capacity.ash[P.quality] * cover.ash * h / 12;
          while (carry[6] >= 1) { carry[6] -= 1; if (!this.emit('ash', fx + (rng() * 2 - 1) * Rr, groundY + PARTICLES.height * rng(), fz + (rng() * 2 - 1) * Rr, cwe * 0.5, -0.3, cwn * 0.5)) break; }
        }
      }
      // dust devils: a helix of dust fed at the foot of each column
      if (devils) {
        for (let k = 0; k < devils.count; k++) {
          const D = devils[k];
          if (!(D.strength > 0.05) || Math.abs(D.x - fx) > Rr + 30 || Math.abs(D.z - fz) > Rr + 30) continue;
          let n = 110 * D.strength * h + rng();
          while (n >= 1) {
            n -= 1;
            const a = rng() * 6.2831853, r = D.radius * (0.3 + 0.9 * rng());
            const x = D.x + Math.cos(a) * r, z = D.z + Math.sin(a) * r;
            const gy = near ? near.heightAt(x, z, groundY) : groundY;
            if (!this.emit('dust', x, gy + rng() * 1.5, z, -Math.sin(a) * D.speed * D.spin, D.up * 0.5, Math.cos(a) * D.speed * D.spin, 1.6, 1.5)) break;
          }
        }
      }
    }

    // ---- emitters: bodies and jets ---------------------------------------------------------------
    if (disturbers && h > 0) {
      for (let k = 0; k < disturbers.length; k++) {
        const D = disturbers[k];
        if (!D || !D.p) continue;
        const x = frame.lx(D.p.x, D.p.y, D.p.z), z = frame.lz(D.p.x, D.p.y, D.p.z);
        if (Math.abs(x - fx) > Rr || Math.abs(z - fz) > Rr) continue;
        const gp = this._ground(near, x, z, groundY, wet01, snowDepth);
        const r = Math.hypot(D.p.x, D.p.y, D.p.z), hgt = r - (frame.r0 + gp.h);
        const vx = D.v ? D.v.x * frame.ex + D.v.y * frame.ey + D.v.z * frame.ez : 0;
        const vz = D.v ? D.v.x * frame.nx + D.v.y * frame.ny + D.v.z * frame.nz : 0;
        const sp = Math.hypot(vx, vz);
        if (D.kind === 'explorer') {
          const grounded = D.grounded != null ? D.grounded : hgt < 0.3;
          if (gp.liquid > 0.05) {
            // wading: droplets thrown up by the legs, and a ring on the water now and then
            if (grounded && sp > 0.6) {
              let n = sp * 6 * h + rng();
              while (n >= 1) { n -= 1; const a = rng() * 6.2831853; this.emit('spray', x + Math.cos(a) * 0.3, gp.h + gp.liquid + 0.02, z + Math.sin(a) * 0.3, vx * 0.5 + Math.cos(a) * 0.8, 1.2 + rng() * 1.5, vz * 0.5 + Math.sin(a) * 0.8); }
              this._wade += h * sp;
              if (this._wade > 0.5) { this._wade = 0; P._event(frame, x, gp.h + gp.liquid, z, EVENT.ripple, clamp01(sp / 3), 0.3); }
            }
            continue;
          }
          const powder = snowDepth > 0.03;
          const kick = D.kick != null ? D.kick : gp.dust * clamp01(0.15 + sp / 6);
          const dusty = powder ? 0.5 : kick;
          if (!grounded || dusty < 0.02) continue;
          // behind the heels: back along the motion, upward, a little sideways
          let n = KICK.perMetre * dusty * sp * h + KICK.landing * (powder ? 0.5 : gp.dust) * (D.impact || 0) * h / 0.1 + rng() * 0.999;
          const kind = powder ? 'snow' : 'dust';
          while (n >= 1) {
            n -= 1;
            const a = rng() * 6.2831853, s = rng();
            const ex = -vx * 0.25 + Math.cos(a) * 0.6 * s, ez = -vz * 0.25 + Math.sin(a) * 0.6 * s;
            const eu = KICK.up * (0.4 + rng()) * Math.pow(9 / g, 0.25);
            if (powder) { this._emitSnow(x + Math.cos(a) * 0.2, gp.h + 0.05, z + Math.sin(a) * 0.2, ex * 1.5, eu * 2.4, ez * 1.5); this._emitSnow(x - Math.cos(a) * 0.2, gp.h + 0.05, z - Math.sin(a) * 0.2, -ex, eu * 1.8, -ez); }
            else {
              this.emit(kind, x + Math.cos(a) * 0.2, gp.h + 0.03, z + Math.sin(a) * 0.2, ex, eu, ez);
              // coarse grains too where the ground is granular: they fall straight back
              if (gp.repose > 0 && rng() < 0.5) this.emit('sand', x + Math.cos(a) * 0.15, gp.h + 0.03, z + Math.sin(a) * 0.15, ex * 1.4, eu * 1.3, ez * 1.4, 1, 0.5);
            }
          }
        } else if (D.kind === 'jet' || D.kind === 'downwash') {
          // the jet's footprint on the ground (as in flora.js): thrust over the area it has spread to
          const R0 = D.radius || 0.4, R = R0 + 0.25 * Math.max(0, hgt);
          const q = (D.strength || 0) / (Math.PI * R * R);                // Pa
          if (q < 8) continue;
          const wetGround = gp.liquid > 0.05;
          const loose = wetGround ? 1 : (snowDepth > 0.03 ? 0.6 : gp.dust);
          if (loose < 0.02) continue;
          // grains leave at the speed the jet's air has along the ground; in a vacuum the exhaust
          // is its own medium and the sheet is thrown out fast and flat
          const vj = rho > 0.01 ? Math.min(KICK.jetSpeedMax, Math.sqrt(2 * q / rho)) : KICK.jetSpeedMax * Math.min(1, q / 200 + 0.3);
          let n = KICK.jetRate * loose * clamp01(q / 300) * (D.kind === 'downwash' ? 2.5 : 1) * h + rng() * 0.999;
          while (n >= 1) {
            n -= 1;
            const a = rng() * 6.2831853, rr = R * (0.5 + 0.7 * rng());
            const px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr;
            const gy = near ? near.heightAt(px, pz, gp.h) : gp.h;
            const s = vj * (0.5 + 0.6 * rng()), el = rho > 0.01 ? 0.25 + 0.5 * rng() : 0.08 + 0.2 * rng();
            if (wetGround) this.emit('spray', px, gy + gp.liquid + 0.02, pz, Math.cos(a) * s, s * (0.5 + el), Math.sin(a) * s);
            else if (snowDepth > 0.03) this._emitSnow(px, gy + 0.05, pz, Math.cos(a) * s, s * el, Math.sin(a) * s);
            else if (gp.repose > 0 && rng() < 0.35) this.emit('sand', px, gy + 0.02, pz, Math.cos(a) * s, s * el, Math.sin(a) * s, 1, 0.6);
            else this.emit('dust', px, gy + 0.03, pz, Math.cos(a) * s, s * el, Math.sin(a) * s);
          }
          if (wetGround) { this._wade += h * 3; if (this._wade > 0.5) { this._wade = 0; P._event(frame, x, gp.h + gp.liquid, z, EVENT.ripple, 1, R); } }
        }
      }
    }

    // ---- motion ---------------------------------------------------------------------------------------
    const ex = frame.ex, ey = frame.ey, ez = frame.ez, ax = frame.ax, ay = frame.ay, az = frame.az, nx = frame.nx, ny = frame.ny, nz = frame.nz;
    for (let kk = 0; kk < LOOSE_KINDS.length; kk++) {
      const name = LOOSE_KINDS[kk], K = LOOSE[name], b = P.buffers[name];
      b.origin.x = frame.ox; b.origin.y = frame.oy; b.origin.z = frame.oz;
      let alive = b._n;
      if (alive === 0) { b.count = 0; continue; }
      const Pp = b._p, V = b._v, VT = b._vt, PH = b._ph, LF = b._life, AG = b.age, SZ = b.size, EJ = b._e;
      const turb = K.turb * sigma, puff = K.puff || 0;
      for (let i = 0; i < alive; i++) {
        const o = i * 3;
        let x = Pp[o], y = Pp[o + 1], z = Pp[o + 2];
        const age = AG[i] + h;
        let dead = age > LF[i] || Math.abs(x - fx) > Rr + 6 || Math.abs(z - fz) > Rr + 6;
        let vx = V[o], vy = V[o + 1], vz = V[o + 2];
        if (!dead) {
          // wind at the particle
          let u = (x - fx) / 16 + 1.5, v = (z - fz) / 16 + 1.5;
          u = u < 0 ? 0 : u > 2.999 ? 2.999 : u; v = v < 0 ? 0 : v > 2.999 ? 2.999 : v;
          const iu = u | 0, iv = v | 0, fu = u - iu, fv = v - iv, q = (iv * 4 + iu) * 3;
          const w00 = (1 - fu) * (1 - fv), w10 = fu * (1 - fv), w01 = (1 - fu) * fv, w11 = fu * fv;
          let hz = y - groundY; hz = hz < 0 ? 0 : hz > 23.99 ? 23.99 : hz;
          const ih = hz | 0, hf = hfl[ih] + (hfl[ih + 1] - hfl[ih]) * (hz - ih);
          let we = (wp[q] * w00 + wp[q + 3] * w10 + wp[q + 12] * w01 + wp[q + 15] * w11) * hf;
          let wn = (wp[q + 1] * w00 + wp[q + 4] * w10 + wp[q + 13] * w01 + wp[q + 16] * w11) * hf;
          let wu = 0;
          const vt = VT[i], ph = PH[i];
          if (turb > 0) { const a = ph + age * (1.1 + ph * 0.2); we += Math.cos(a) * turb; wn += Math.sin(a * 1.27) * turb; wu += Math.sin(a * 0.71 + 1.3) * turb * 0.4 * Math.min(1, hz); }
          // the parcel of air it was thrown up with, mixing away
          if (EJ && age < puff * 4) { const k = Math.exp(-age / puff); we += EJ[o] * k; wu += EJ[o + 1] * k; wn += EJ[o + 2] * k; }
          if (K.flutter > 0) { const fl = Math.min(1, K.flutter * vt), a = ph * 3 + age * (2.2 + ph * 0.4); we += Math.cos(a) * fl; wn += Math.sin(a * 1.3) * fl; }
          // a dust devil nearby: swirl, inflow and updraught (Rankine vortex)
          if (devils) for (let d = 0; d < devils.count; d++) {
            const D = devils[d];
            const dx = x - D.x, dz = z - D.z, r = Math.hypot(dx, dz);
            if (r > D.radius * 6 || hz > D.height || !(D.strength > 0)) continue;
            const rc = D.radius, f = (r < rc ? r / rc : rc / r) * D.strength, ir = r > 1e-3 ? 1 / r : 0;
            we += (-dz * ir * D.spin - dx * ir * 0.35) * D.speed * f;
            wn += (dx * ir * D.spin - dz * ir * 0.35) * D.speed * f;
            wu += D.up * D.strength * (r < rc * 1.5 ? 1 : rc * 1.5 / r);
          }
          // weight, then drag toward the air (implicit; no drag at all when vt is "infinite")
          let rx = vx - we, ry = vy - g * h - wu, rz = vz - wn;
          const m = vt < 1e4 ? 1 / (1 + g / (vt * vt) * Math.hypot(rx, ry, rz) * h) : 1;
          rx *= m; ry *= m; rz *= m;
          vx = we + rx; vy = wu + ry; vz = wn + rz;
          x += vx * h; y += vy * h; z += vz * h;
          // the ground
          if (y < groundY + 4) {
            let gy = near ? near.heightAt(x, z, NaN) : NaN;
            if (gy !== gy) gy = air.terrain.heightAt(x, z, groundY);
            if (y <= gy) {
              if (K.ground === 1 && vy < 0) {
                // saltation: the grain rebounds with about half its speed at a steeper angle,
                // as long as the wind keeps feeding it (otherwise it comes to rest)
                const s = Math.hypot(vx, vy, vz) * K.rest;
                if (s > 0.25 && age < LF[i] - 0.2) { y = gy + 0.005; const hs = Math.hypot(vx, vz) || 1; vx = vx / hs * s * 0.75; vz = vz / hs * s * 0.75; vy = s * 0.65; } else dead = true;
              } else if (K.ground === 2 && vy < 0) {
                if (-vy > 2 && PH[i] < 100) { y = gy + 0.01; vy = -vy * K.rest; vx *= 0.6; vz *= 0.6; PH[i] += 100; P._event(frame, x, gy, z, EVENT.bounce, clamp01(-vy / 8), SZ[i]); } else dead = true;
              } else dead = true;
            }
          }
        }
        if (dead) {
          alive--;
          if (i < alive) {
            const s = alive * 3;
            Pp[o] = Pp[s]; Pp[o + 1] = Pp[s + 1]; Pp[o + 2] = Pp[s + 2]; V[o] = V[s]; V[o + 1] = V[s + 1]; V[o + 2] = V[s + 2];
            VT[i] = VT[alive]; PH[i] = PH[alive]; LF[i] = LF[alive]; AG[i] = AG[alive]; SZ[i] = SZ[alive];
            if (EJ) { EJ[o] = EJ[s]; EJ[o + 1] = EJ[s + 1]; EJ[o + 2] = EJ[s + 2]; }
            i--;
          }
          continue;
        }
        Pp[o] = x; Pp[o + 1] = y; Pp[o + 2] = z; V[o] = vx; V[o + 1] = vy; V[o + 2] = vz; AG[i] = age;
      }
      b._n = alive; b.count = alive;
      const pos = b.pos, vel = b.vel;
      for (let i = 0; i < alive; i++) {
        const o = i * 3, x = Pp[o], y = Pp[o + 1], z = Pp[o + 2], a = V[o], c = V[o + 1], d = V[o + 2];
        pos[o] = ex * x + ax * y + nx * z; pos[o + 1] = ey * x + ay * y + ny * z; pos[o + 2] = ez * x + az * y + nz * z;
        vel[o] = ex * a + ax * c + nx * d; vel[o + 1] = ey * a + ay * c + ny * d; vel[o + 2] = ez * a + az * c + nz * d;
      }
    }
  }

  // Powder kicked up from snow joins the snow buffer (it falls like any other flake).
  _emitSnow(x, y, z, vx, vy, vz) {
    const b = this.P.buffers.snow, cap = PARTICLES.capacity.snow[this.P.quality];
    if (b._n >= cap) return false;
    const i = b._n++, o = i * 3;
    b._p[o] = x; b._p[o + 1] = y; b._p[o + 2] = z; b._v[o] = vx; b._v[o + 1] = vy; b._v[o + 2] = vz;
    // a clod of powder is heavier than a flake: it flies a short arc and bursts into flakes on the way
    b._vt[i] = 2.2 + this.rng() * 2.5; b._ph[i] = this.rng() * 6.2831853; b.size[i] = 0.004 + this.rng() * 0.006; b.age[i] = 0;
    return true;
  }
}
