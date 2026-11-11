// Painted Cosmos physics: things that fall and blow near the focus. OWNER: PHYSICS. Pure.
//
// Each kind has a pooled typed-array buffer that PAINTER draws as brush marks:
//   buf.count            how many are alive (indices 0 .. count-1)
//   buf.pos   (3 n)      position relative to buf.origin, body-local axes, metres
//   buf.vel   (3 n)      velocity, body-local axes, m/s (draw streaks along it)
//   buf.size  (n)        diameter, metres
//   buf.age   (n)        seconds since it was (re)born
//   buf.origin {x,y,z}   body-local point the positions are relative to (keeps float32 precise)
// A particle is a point mass with weight and drag. Drag is quadratic in the velocity relative to
// the moving air and is scaled so that the particle's terminal speed is the one computed for
// its size, that planet's gravity and that air (atmosphere.js):
//   dv/dt = g - (g / vt^2) |v - w| (v - w)
// integrated implicitly (exact for this law), so even 10-micron frost is stable at 20 Hz.
// Rain therefore slants with the wind at the right angle, lags a gust by vt / g seconds, and
// falls three times faster on Mars than on Earth for the same drop.
//
// P1 simulates rain and snow (and whatever else the weather is precipitating: ice crystals,
// frost, acid, methane). The other kinds have their buffers and stay empty for now.
import { SPECIES, terminalVelocity, meanFreePath } from './atmosphere.js';
import { BODIES } from '../data/bodies.js';
import { ATMOSPHERES } from './atmosphere.js';
import { heightFactor } from './wind.js';
import { makeRng, clamp01 } from './util.js';

export const PARTICLES = Object.freeze({
  kinds: ['rain', 'snow', 'hail', 'dust', 'sand', 'ash', 'spores', 'leaves', 'spray'],
  capacity: { rain: [700, 1600, 3200], snow: [600, 1400, 2800], hail: [0, 200, 400], dust: [300, 800, 1600], sand: [300, 800, 1600], ash: [200, 600, 1200], spores: [200, 500, 1000], leaves: [60, 160, 320], spray: [200, 500, 1000] },
  radius: 24,          // m: half-width of the simulated volume around the focus
  height: 18,          // m above the ground at the focus where precipitation enters
  below: 8,            // m below the focus ground that still belongs to the volume
  events: 256,         // capacity of the splash / settle event ring
  flutter: 0.28,       // m/s: sideways flutter of a falling snowflake
});

// Event kinds in the ring buffer.
export const EVENT = Object.freeze({ splash: 0, ripple: 1, settle: 2, bounce: 3 });

function makeBuffer(cap) {
  return {
    count: 0, capacity: cap,
    pos: new Float32Array(cap * 3), vel: new Float32Array(cap * 3), size: new Float32Array(cap), age: new Float32Array(cap),
    origin: { x: 0, y: 0, z: 0 },
    species: null, fallSpeed: 0,
    // internal: frame coordinates (east, up, north), terminal speed, phase
    _p: new Float32Array(cap * 3), _v: new Float32Array(cap * 3), _vt: new Float32Array(cap), _ph: new Float32Array(cap), _n: 0,
  };
}

const _w = {};

export class Particles {
  constructor(seed, quality = 1) {
    this.rng = makeRng((seed | 0) ^ 0x9e3779b9);
    this.quality = quality;
    this.buffers = {};
    for (const k of PARTICLES.kinds) this.buffers[k] = makeBuffer(PARTICLES.capacity[k][2]);
    // events: x, y, z (relative to events.origin, body-local axes), kind, strength 0..1, time, size, spare
    this.events = { data: new Float32Array(PARTICLES.events * 8), capacity: PARTICLES.events, head: 0, total: 0, origin: { x: 0, y: 0, z: 0 } };
    this.frameVersion = -1;
    this._lut = new Float32Array(8);
    this._lutKey = '';
    this._wp = new Float32Array(16 * 3);       // 4 x 4 wind patch: we, wn, gust
    this._hfl = new Float32Array(25);          // height factor every metre, 0..24 m
    this.time = 0;
  }

  setQuality(q) { this.quality = q; }

  // The frame has re-anchored at old grid position (X, Z); the anchor radius changed by -dr.
  rebase(frame, X, Z, dr) {
    this.frameVersion = frame.version;
    for (const k in this.buffers) { const b = this.buffers[k], P = b._p; for (let i = 0; i < b._n; i++) { P[i * 3] -= X; P[i * 3 + 1] += dr; P[i * 3 + 2] -= Z; } }
  }

  _event(frame, x, y, z, kind, strength, size) {
    const E = this.events, o = E.head * 8;
    E.data[o] = frame.ex * x + frame.ax * y + frame.nx * z;
    E.data[o + 1] = frame.ey * x + frame.ay * y + frame.ny * z;
    E.data[o + 2] = frame.ez * x + frame.az * y + frame.nz * z;
    E.data[o + 3] = kind; E.data[o + 4] = strength; E.data[o + 5] = this.time; E.data[o + 6] = size; E.data[o + 7] = 0;
    E.head = (E.head + 1) % E.capacity; E.total++;
  }

  // Terminal speeds for 8 sizes from 0.4 to 2.5 times the species diameter.
  _buildLut(bodyId, species, rho, T) {
    const key = bodyId + species + Math.round(rho * 200) + Math.round(T / 4);
    if (key === this._lutKey) return;
    this._lutKey = key;
    const sp = SPECIES[species], atm = ATMOSPHERES[bodyId], g = BODIES[bodyId].gravity;
    const mfp = meanFreePath(bodyId, rho, T);
    for (let i = 0; i < 8; i++) {
      const d = sp.d * (0.4 + 0.3 * i);
      // snow aggregates get lighter as they grow; everything else keeps its density
      const rhoP = sp === SPECIES.snow ? sp.rho * Math.pow(sp.d / d, 0.6) : sp.rho;
      let v = terminalVelocity({ d, rho: rhoP, shape: sp.shape, tension: sp.tension }, g, rho, atm.mu, mfp);
      if (!(v < 400)) v = 400;              // a vacuum has no terminal speed: free fall
      this._lut[i] = v;
    }
  }

  // Advance every kind.
  //   frame: LocalFrame.  air: AirGrid.  near: near TerrainGrid.  (fx, fz): focus in grid
  //   coordinates, fy: focus height above frame.r0.  ground: ground height above frame.r0 at the
  //   focus.  wx: weather at the focus (weatherAt result).  rho: air density there.  cover: { z0,
  //   canopy01, canopyHeight }.  g: gravity (m/s^2).
  update(dt, frame, air, near, fx, fy, fz, ground, wx, rho, cover, bodyId, g, time) {
    this.time = time;
    const Rr = PARTICLES.radius, H = PARTICLES.height;
    const reborn = this.frameVersion !== frame.version;
    if (reborn) { this.frameVersion = frame.version; for (const k in this.buffers) this.buffers[k]._n = 0; }
    this.events.origin.x = frame.ox; this.events.origin.y = frame.oy; this.events.origin.z = frame.oz;
    // which buffer the precipitation goes to
    const pr = wx ? wx.precipitation : null;
    const type = pr ? pr.type : 'none';
    const isSnow = type === 'snow' || type === 'ice' || type === 'frost';
    const target = type === 'none' ? null : (isSnow ? this.buffers.snow : this.buffers.rain);
    const other = isSnow ? this.buffers.rain : this.buffers.snow;
    const h = dt > 0.1 ? 0.1 : dt;
    // wind patch around the focus and the height profile at the focus
    const wp = this._wp;
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      air.sampleWind(fx + (i - 1.5) * 16, fz + (j - 1.5) * 16, _w);
      const o = (j * 4 + i) * 3; wp[o] = _w.we; wp[o + 1] = _w.wn; wp[o + 2] = _w.gust;
    }
    for (let k = 0; k < 25; k++) this._hfl[k] = heightFactor(k, cover.z0 || 0.03, cover.canopyHeight || 0, cover.canopy01 || 0);

    for (const name of ['rain', 'snow']) {
      const b = this.buffers[name];
      b.origin.x = frame.ox; b.origin.y = frame.oy; b.origin.z = frame.oz;
      const cap = PARTICLES.capacity[name][this.quality];
      let want = 0;
      if (b === target) {
        want = Math.round(cap * clamp01(pr.intensity01) * (0.25 + 0.75 * pr.reachesGround01));
        b.species = pr.species; b.fallSpeed = pr.fallSpeed;
        this._buildLut(bodyId, pr.species, rho, wx.temperature);
      }
      // precipitation of the other phase, or none: let the buffer drain as its particles land
      const draining = b !== target;
      if (!draining && b._n < want) {
        // new arrivals enter at random heights so a shower builds up rather than switching on
        const add = Math.min(want - b._n, Math.ceil(cap * h * 0.6) + 1);
        for (let k = 0; k < add; k++) this._spawn(b, b._n++, fx, fz, ground + this.rng() * H, isSnow);
      }
      const n = b._n;
      if (n === 0) { b.count = 0; continue; }
      const P = b._p, V = b._v, VT = b._vt, PH = b._ph;
      const snowy = name === 'snow';
      const top = ground + H, bottom = Math.min(ground, fy) - PARTICLES.below;
      let alive = n;
      for (let i = 0; i < alive; i++) {
        const o = i * 3;
        let x = P[o], y = P[o + 1], z = P[o + 2];
        // wrap into the box around the focus, so the density stays even as the focus moves
        if (x - fx > Rr) x -= 2 * Rr; else if (x - fx < -Rr) x += 2 * Rr;
        if (z - fz > Rr) z -= 2 * Rr; else if (z - fz < -Rr) z += 2 * Rr;
        // wind at the particle: bilinear in the 4 x 4 patch, scaled by the height profile
        let u = (x - fx) / 16 + 1.5, v = (z - fz) / 16 + 1.5;
        u = u < 0 ? 0 : u > 2.999 ? 2.999 : u; v = v < 0 ? 0 : v > 2.999 ? 2.999 : v;
        const iu = u | 0, iv = v | 0, fu = u - iu, fv = v - iv, q = (iv * 4 + iu) * 3;
        const w00 = (1 - fu) * (1 - fv), w10 = fu * (1 - fv), w01 = (1 - fu) * fv, w11 = fu * fv;
        let hz = y - ground; hz = hz < 0 ? 0 : hz > 23.99 ? 23.99 : hz;
        const ih = hz | 0, hf = this._hfl[ih] + (this._hfl[ih + 1] - this._hfl[ih]) * (hz - ih);
        let we = (wp[q] * w00 + wp[q + 3] * w10 + wp[q + 12] * w01 + wp[q + 15] * w11) * hf;
        let wn = (wp[q + 1] * w00 + wp[q + 4] * w10 + wp[q + 13] * w01 + wp[q + 16] * w11) * hf;
        const vt = VT[i];
        if (snowy) {
          // a flake side-slips as it tumbles: a slow circular flutter, its own phase and rate
          const a = PH[i] + b.age[i] * (1.6 + PH[i] * 0.25);
          const fl = PARTICLES.flutter * Math.min(1, vt);
          we += Math.cos(a) * fl; wn += Math.sin(a * 1.3) * fl;
        }
        // weight, then drag relative to the air (implicit)
        let rx = V[o] - we, ry = V[o + 1] - g * h, rz = V[o + 2] - wn;
        const m = 1 / (1 + g / (vt * vt) * Math.hypot(rx, ry, rz) * h);
        rx *= m; ry *= m; rz *= m;
        const vx = we + rx, vy = ry, vz = wn + rz;
        x += vx * h; y += vy * h; z += vz * h;
        b.age[i] += h;
        // the ground (only looked up when the particle is low)
        let hit = false, gy = ground, wet = false;
        if (y < ground + 6) {
          gy = near ? near.heightAt(x, z, NaN) : NaN;
          if (gy !== gy) gy = air.terrain.heightAt(x, z, ground);
          const lq = near ? near.liquidAt(x, z) : -1e9;
          if (lq > gy) { gy = lq; wet = true; }
          hit = y <= gy;
        }
        if (hit || y < bottom) {
          if (hit) {
            const sp = Math.hypot(vx, vy, vz);
            this._event(frame, x, gy, z, snowy ? EVENT.settle : wet ? EVENT.ripple : EVENT.splash, clamp01(sp * b.size[i] * 60), b.size[i]);
          }
          if (draining || i >= want) {
            // retire: move the last live particle into this slot
            alive--;
            if (i < alive) {
              const s = alive * 3;
              P[o] = P[s]; P[o + 1] = P[s + 1]; P[o + 2] = P[s + 2]; V[o] = V[s]; V[o + 1] = V[s + 1]; V[o + 2] = V[s + 2];
              VT[i] = VT[alive]; PH[i] = PH[alive]; b.size[i] = b.size[alive]; b.age[i] = b.age[alive];
              i--;
            }
            continue;
          }
          this._spawn(b, i, fx, fz, top, isSnow);
          // enter upwind, so that slanting rain still fills the box
          const tf = H / Math.max(VT[i], 0.3) * 0.5;
          P[o] -= clampAbs(we * tf, Rr * 0.8); P[o + 2] -= clampAbs(wn * tf, Rr * 0.8);
          continue;
        }
        if (y > top + 4) y = top;
        P[o] = x; P[o + 1] = y; P[o + 2] = z; V[o] = vx; V[o + 1] = vy; V[o + 2] = vz;
      }
      b._n = alive;
      b.count = alive;
      // publish in body-local axes
      const ex = frame.ex, ey = frame.ey, ez = frame.ez, ax = frame.ax, ay = frame.ay, az = frame.az, nx = frame.nx, ny = frame.ny, nz = frame.nz;
      const pos = b.pos, vel = b.vel;
      for (let i = 0; i < alive; i++) {
        const o = i * 3;
        const x = P[o], y = P[o + 1], z = P[o + 2];
        pos[o] = ex * x + ax * y + nx * z; pos[o + 1] = ey * x + ay * y + ny * z; pos[o + 2] = ez * x + az * y + nz * z;
        const a = V[o], c = V[o + 1], d = V[o + 2];
        vel[o] = ex * a + ax * c + nx * d; vel[o + 1] = ey * a + ay * c + ny * d; vel[o + 2] = ez * a + az * c + nz * d;
      }
    }
    void other;
  }

  _spawn(b, i, fx, fz, y, snow) {
    const R = PARTICLES.radius, rng = this.rng, o = i * 3;
    b._p[o] = fx + (rng() * 2 - 1) * R; b._p[o + 1] = y; b._p[o + 2] = fz + (rng() * 2 - 1) * R;
    // size: exponential tail of large drops (Marshall and Palmer 1948), index into the 8-step LUT
    const t = snow ? rng() * 5 : Math.min(7, -Math.log(1 - rng() * 0.98) * 1.6);
    const k = t | 0, f = t - k;
    const vt = this._lut[k] + (this._lut[Math.min(7, k + 1)] - this._lut[k]) * f;
    b._vt[i] = vt > 0.005 ? vt : 0.005;
    b.size[i] = (b.species ? SPECIES[b.species].d : 0.002) * (0.4 + 0.3 * t);
    b._ph[i] = rng() * 6.2831853;
    b.age[i] = 0;
    b._v[o] = 0; b._v[o + 1] = -b._vt[i]; b._v[o + 2] = 0;
  }

  clear() {
    for (const k in this.buffers) { this.buffers[k]._n = 0; this.buffers[k].count = 0; }
  }
}
function clampAbs(x, m) { return x > m ? m : x < -m ? -m : x; }
