// Painted Cosmos physics: things that fall and blow near the focus. OWNER: PHYSICS. Pure.
//
// Each kind has a pooled typed-array buffer that PAINTER draws as brush marks:
//   buf.count            how many are alive (indices 0 .. count-1)
//   buf.pos   (3 n)      position relative to buf.origin, body-local axes, metres
//   buf.vel   (3 n)      velocity, body-local axes, m/s (draw streaks along it)
//   buf.size  (n)        diameter, metres
//   buf.age   (n)        seconds since it was (re)born
//   buf.mat   (n, bytes) the ground it was raised from: an index into ground.js MATERIAL_IDS, or
//                        255 (MATERIAL_NONE) for what did not come from the ground (rain, falling
//                        snow, hail, leaves). Kicked dust is the colour of what it was kicked from.
//   buf.left  (n)        seconds until it will be gone, where the physics can tell (its life is
//                        ending; the ground is coming up at its fall speed); 1e9 while it cannot.
//                        For the kits: a mark that shrinks over its last moments never pops out.
//   buf.origin {x,y,z}   body-local point the positions are relative to (keeps float32 precise)
//   buf.radius           m: half-width of the box the kind is simulated in (it wraps from wall to wall)
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
import { heightFactor, WIND } from './wind.js';
import { AIR, wakeAt } from './air.js';
import { makeRng, clamp01, smoothstep, fsin, fcos } from './util.js';

export const PARTICLES = Object.freeze({
  kinds: ['rain', 'snow', 'hail', 'dust', 'sand', 'ash', 'spores', 'leaves', 'spray'],
  capacity: { rain: [700, 1600, 3200], snow: [800, 2000, 2800], hail: [0, 200, 400], dust: [300, 1000, 2400], sand: [300, 1200, 2800], ash: [200, 600, 1200], spores: [200, 500, 1000], leaves: [800, 3000, 6000], spray: [200, 800, 1800] },
  // (P10, the owner's instruction: no count is a budget. Dust, sand, leaves and spray were raised so that a storm's veils,
  // the streamers of blowing sand and snow, a flock of leaves and the spume of a gale are many small marks, not a few large ones.)
  // (P15: leaves 80 / 260 / 600 -> 800 / 3000 / 6000. A gust front through a wood in leaf holds up to 0.16 leaves a cubic
  // metre of air under the crowns (BLOWN.leafFlux in loose.js): 1000 to 2500 in the box at the front; 260 held 200.)
  radius: 24,          // m: half-width of the simulated volume around the focus
  // Snow is simulated in a smaller box, and round the EYE (frame.eye; the focus when none is
  // given). A snowfall is the same everywhere near by, single flakes only read near the lens
  // (beyond a few metres snow is haze: sky.snowfall), and a real one is thousands of flakes a
  // cubic metre: so the flakes there are go where they can be seen, and each of them lands on
  // the ground it is over, is caught by the leaves it is under and stopped by the hull.
  snowRadius: 8,       // m: half-width of the box snow is simulated in
  height: 18,          // m above the ground at the focus where precipitation enters
  below: 8,            // m below the focus ground that still belongs to the volume
  // shelter: a closed canopy catches rain on its leaves. A dry canopy lets a quarter through,
  // a soaked one three quarters (the rest runs down the stems or evaporates); when the rain
  // stops the leaves go on dripping until they have drained.
  throughDry: 0.25, throughWet: 0.75,
  dripShare: 0.14,     // drips after rain, as a share of the rain capacity, under a closed soaked canopy
  dripWet: 0.35,       // ground wetness below which the canopy has drained
  dripSize: 0.0045,    // m: drops gather on a leaf tip until they are this big
  events: 512,         // capacity of the splash / settle event ring (256 before P7)
  ringRate: 90,        // a second in a downpour: splashes and ripples laid near the focus for the drops the particles stand for
  ringRadius: 10,      // m round the focus
  ringFar: 16,         // m: a particle's own landing is recorded only this near the focus (a ring further off is under a pixel)
  flutter: 0.28,       // m/s: sideways flutter of a falling snowflake
});

// Event kinds in the ring buffer.
export const EVENT = Object.freeze({ splash: 0, ripple: 1, settle: 2, bounce: 3 });

function makeBuffer(cap) {
  return {
    count: 0, capacity: cap,
    pos: new Float32Array(cap * 3), vel: new Float32Array(cap * 3), size: new Float32Array(cap), age: new Float32Array(cap),
    mat: new Uint8Array(cap).fill(255), left: new Float32Array(cap).fill(1e9),
    // hag: m above the ground under it (the loose kinds: dust, sand, leaves, spray ...; what falls from the sky leaves it 0).
    // What blows is densest at the ground and thins upward: a veil's opacity follows this (three/expand.js expandVeils).
    hag: new Float32Array(cap),
    // (P15) turn: radians, how far a leaf has turned about its long side (it tumbles: loose.js). cos(turn) < 0: it shows
    // its other side (a two-toned leaf flickers light and dark as it turns over); |cos| how broadside it is to a view
    // across it. 0 for every kind that does not tumble.
    turn: new Float32Array(cap),
    origin: { x: 0, y: 0, z: 0 }, radius: PARTICLES.radius,
    species: null, fallSpeed: 0,
    // internal: frame coordinates (east, up, north), terminal speed, phase
    _p: new Float32Array(cap * 3), _v: new Float32Array(cap * 3), _vt: new Float32Array(cap), _ph: new Float32Array(cap), _n: 0,
    // for `left`: the height over the ground under it when last looked up, and when that was
    _alt: new Float32Array(cap).fill(1e9), _lt: new Float64Array(cap).fill(-1e9), _rate: new Float32Array(cap), _g: new Float32Array(cap), _wu: new Float32Array(cap), _tp: new Float32Array(cap),
  };
}

const _w = new Float64Array(8);
const _gq = new Float64Array(5);     // (P17) x, z in; ground height, liquid level out (near.js TerrainGrid.groundQ); (P21) [4] the node (groundQN)
const _carry = new Float64Array(2);  // (P20) a particle's grid position carried through a re-anchor (LocalFrame.carry)

export class Particles {
  constructor(seed, quality = 1) {
    this.rng = makeRng((seed | 0) ^ 0x9e3779b9);
    this.quality = quality;
    this.buffers = {};
    for (const k of PARTICLES.kinds) this.buffers[k] = makeBuffer(PARTICLES.capacity[k][2]);
    // events: x, y, z (relative to events.origin, body-local axes), kind, strength 0..1, time, size, spare
    this.events = { data: new Float32Array(PARTICLES.events * 8), capacity: PARTICLES.events, head: 0, total: 0, origin: { x: 0, y: 0, z: 0 } };
    // things that keep the rain off what is under them (the ship's hull): x, z (grid), y (top,
    // above frame.r0), radius; set by the caller before update()
    this.shelters = new Float32Array(4 * 4); this.shelterCount = 0;
    this._cp = new Float32Array(16);          // canopy closure on the 4 x 4 patch
    // (P17) the context _fall reads (set by update per kind; numbers start as -0 so that their fields hold numbers, not small integers)
    this._fc = { h: -0, Rb: -0, bx: -0, bz: -0, ground: -0, fx: -0, fy: -0, fz: -0, g: -0, time: -0, H: -0, canopyH: -0, through: -0, liquid0: -0, drip: -0, want: -0, draining: false, isSnow: false, target: false, pr: null, nSH: -0 };
    this.dripping = 0;                        // 0..1: how hard the canopy over the focus is dripping
    this.frameVersion = -1;
    this._lut = new Float32Array(8);
    this._lutKey = '';
    this._wp = new Float32Array(16 * 3);       // 4 x 4 wind patch: we, wn, gust
    this._hfl = new Float32Array(25);          // (until P12: the height factor at the focus; unused now)
    // (P12) the air the particles ride in, the same air as airAt's: on the 5 x 5 nodes of the wind grid
    // round the focus, each node's reference wind (_wv: we, wn) and ITS OWN profile every metre from 0
    // to 24 m (_ht: the log law of its roughness, the calm under its canopy, the lee of the trees
    // upwind fading out above them). Until P12 every particle had the profile of the ground the FOCUS
    // stood on and the whole wake at every height: a walker in the meadow saw rain and leaves cross
    // the wood's edge at the meadow's wind, 2 to 3 m/s faster than the branches beside them moved.
    this._wv = new Float32Array(25 * 2);
    this._ht = new Float32Array(25 * 25);
    this._hsig = new Float64Array(25).fill(NaN);
    this._wtx = 0; this._wtz = 0;              // grid position of the patch's first node (m)
    this.time = 0;
    this._ring = 0;                            // rings owed near the focus (P7)
    // (P20) how calm the liquid about the focus is (1 still, 0 a running sea; set by physics.update from the sea there): a
    // raindrop's ring shows on still water and is lost among the waves of a sea that is running (a storm sea drew crisp rings)
    this.seaCalm01 = 1;
    // (P21) how a raindrop's splash shows on the ground where it lands, as that ground is now (0..1; set by physics.update):
    // splashOf[material id] (ground.js splashOn), the material of each node of the near grid read from splashCover
    // (splashCW numbers a node, the id at splashSlot), splashHere where the node is not known. A drop leaves a ring on water
    // and on hard ground under a film of water; a meadow, a forest floor, moss, sand, dust and snow take it with none (P20's
    // strips: crisp rings all over the grass). null: everywhere, as before P21.
    this.splashOf = null; this.splashCover = null; this.splashCW = 0; this.splashSlot = 0; this.splashHere = 1;
    this.landed = 0;                          // (P21) drops and flakes that have reached the ground or the liquid so far (a crown or not)
  }

  // (P21) The splash a raindrop makes on the ground at near-grid node n (-1: not known), 0..1.
  splashAt(n) {
    const S = this.splashOf;
    if (!S) return 1;
    const C = this.splashCover;
    if (n < 0 || !C) return this.splashHere;
    const f = S[C[n * this.splashCW + this.splashSlot] | 0];
    return f === f ? f : this.splashHere;
  }

  setQuality(q) { this.quality = q; }

  // The frame has re-anchored at old grid position (X, Z); the anchor radius changed by -dr. (P20) With `old` (the frame
  // before: ox..nz) every particle is carried through the ray of its own ground (frame.carry: exact), not shifted by
  // (X, Z), which is exact only at the anchor (on the Moon a drop 30 m out moved 2.4 m in the re-anchor's frame); its
  // height over the anchor radius gains dr either way (|p| is unchanged). The events (splashes, settles; body-local
  // offsets from events.origin, which update() moves to the new anchor) are moved with it: until P20 an event alive
  // in that frame was drawn the whole re-anchor away (384 m) for the rest of its life.
  rebase(frame, X, Z, dr, old) {
    this.frameVersion = frame.version;
    const c = _carry;
    for (const k in this.buffers) {
      const b = this.buffers[k], P = b._p;
      for (let i = 0; i < b._n; i++) {
        if (old) { frame.carry(old, P[i * 3], P[i * 3 + 2], c); P[i * 3] = c[0]; P[i * 3 + 2] = c[1]; } else { P[i * 3] -= X; P[i * 3 + 2] -= Z; }
        P[i * 3 + 1] += dr;
      }
    }
    const E = this.events, dx = E.origin.x - frame.ox, dy = E.origin.y - frame.oy, dz = E.origin.z - frame.oz;
    for (let k = 0; k < E.capacity; k++) { const o = k * 8; E.data[o] += dx; E.data[o + 1] += dy; E.data[o + 2] += dz; }
    E.origin.x = frame.ox; E.origin.y = frame.oy; E.origin.z = frame.oz;
  }

  // (own (M4), 0..1: the least share of its strength a ring keeps on a rough sea: a body's own rings, see loose.js WADE.ownCalm)
  _event(frame, x, y, z, kind, strength, size, own = 0) {
    if (kind === EVENT.ripple) { strength *= own > this.seaCalm01 ? own : this.seaCalm01; if (strength < 0.02) return; }   // (P20)
    const E = this.events, o = E.head * 8;
    // (heights are radial, the grid is the tangent plane at the anchor: see publish())
    const qx = frame.ox + frame.ex * x + frame.nx * z, qy = frame.oy + frame.ey * x + frame.ny * z, qz = frame.oz + frame.ez * x + frame.nz * z;
    const k = (frame.r0 + y) / Math.sqrt(qx * qx + qy * qy + qz * qz);
    E.data[o] = qx * k - frame.ox; E.data[o + 1] = qy * k - frame.oy; E.data[o + 2] = qz * k - frame.oz;
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
  //   canopy01, canopyHeight }.  g: gravity (m/s^2).  (ecx, ecz): the eye in grid coordinates
  //   (the centre of the snow's box; the focus when not given).
  update(dt, frame, air, near, fx, fy, fz, ground, wx, rho, cover, bodyId, g, time, ecx = fx, ecz = fz) {
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
      const o = (j * 4 + i) * 3; wp[o] = _w[0]; wp[o + 1] = _w[1]; wp[o + 2] = _w[2];
      this._cp[j * 4 + i] = _w[7];
    }
    const cp = this._cp, canopyH = cover.canopyHeight || 0;
    const wet01 = wx && wx.wetness01 ? wx.wetness01 : 0;
    // share of the drops that get through closed canopy
    const through = PARTICLES.throughDry + (PARTICLES.throughWet - PARTICLES.throughDry) * wet01;
    const SH = this.shelters, nSH = this.shelterCount;
    // (P12) the wind and its profile on the 5 x 5 grid nodes round the focus (see the constructor)
    const wv = this._wv, ht = this._ht;
    {
      const T = air.terrain, N = air.N, cell = air.cell, half = T.half, CWa = T.CW, cv = T.cover, sig = this._hsig;
      const pi0 = Math.round(fx / cell) - 2, pj0 = Math.round(fz / cell) - 2;
      const moved = pi0 * cell !== this._wtx || pj0 * cell !== this._wtz;
      this._wtx = pi0 * cell; this._wtz = pj0 * cell;
      for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
        let gi = pi0 + i - T.ci + half, gj = pj0 + j - T.cj + half;
        gi = gi < 0 ? 0 : gi > N - 1 ? N - 1 : gi; gj = gj < 0 ? 0 : gj > N - 1 ? N - 1 : gj;
        const n = gj * N + gi, c = n * CWa, pn = j * 5 + i, ok = T.valid[n];
        wv[pn * 2] = air.we[n]; wv[pn * 2 + 1] = air.wn[n];
        const z0 = ok ? cv[c] : WIND.refRoughness, c01 = ok ? cv[c + 1] : 0, hc = ok ? cv[c + 2] : 0;
        const wk = Math.round(air.wake[n] * 128) / 128, wkH = air.wakeH[n];
        // (a node's profile is worked out again only when its ground or its wake has changed)
        const sg = z0 + 31 * c01 + 977 * hc + 7919 * wk + 104729 * wkH;
        if (!moved && sg === sig[pn]) continue;
        sig[pn] = sg;
        for (let k = 0, o = pn * 25; k < 25; k++) {
          ht[o + k] = heightFactor(k, z0, hc, c01) * wakeAt(wk, wkH, k);
        }
      }
    }
    const wtx = this._wtx, wtz = this._wtz;
    // liquid level at the focus: what an unsampled spot is assumed to be until its node arrives
    let liquid0 = near ? near.liquidAt(fx, fz) : NaN;
    if (liquid0 !== liquid0) liquid0 = air.terrain.liquidAt(fx, fz);
    if (liquid0 !== liquid0) liquid0 = -1e9;

    const groundF = ground;
    for (let kk = 0; kk < 2; kk++) {
      const name = kk === 0 ? 'rain' : 'snow';
      const b = this.buffers[name];
      b.origin.x = frame.ox; b.origin.y = frame.oy; b.origin.z = frame.oz;
      // the box of this kind: its half-width, its centre, and the surface under its centre
      const Rb = kk === 1 ? PARTICLES.snowRadius : Rr, bx = kk === 1 ? ecx : fx, bz = kk === 1 ? ecz : fz;
      b.radius = Rb;
      let ground = groundF;
      if (bx !== fx || bz !== fz) {
        let gB = near ? near.heightAt(bx, bz, NaN) : NaN; if (gB !== gB) gB = air.terrain.heightAt(bx, bz, groundF);
        let lB = near ? near.liquidAt(bx, bz) : NaN; if (lB !== lB) lB = air.terrain.liquidAt(bx, bz);
        ground = lB > gB ? lB : gB;
      }
      const cap = PARTICLES.capacity[name][this.quality];
      let want = 0;
      if (b === target) {
        want = Math.round(cap * clamp01(pr.intensity01) * (0.25 + 0.75 * pr.reachesGround01));
        // under leaves there are fewer drops in the box (above the crowns as many as anywhere)
        if (canopyH > 1) want = Math.round(want * (1 - clamp01(cover.canopy01 || 0) * (1 - through) * Math.min(1, canopyH / H)));
        b.species = pr.species; b.fallSpeed = pr.fallSpeed;
        this._buildLut(bodyId, pr.species, rho, wx.temperature);
      }
      // after the rain the soaked canopy goes on dripping: big slow drops from the leaf tips
      let drip = 0;
      if (kk === 0 && b !== target && type === 'none' && b.species && canopyH > 1 && T0(wx) > 273.5) {
        drip = clamp01((wet01 - PARTICLES.dripWet) / (1 - PARTICLES.dripWet)) * clamp01((cover.canopy01 || 0) * 1.3);
        if (drip > 0.02) want = Math.round(cap * PARTICLES.dripShare * drip); else drip = 0;
      }
      if (kk === 0) this.dripping = drip;
      // precipitation of the other phase, or none: let the buffer drain as its particles land
      const draining = b !== target && drip === 0;
      if (drip > 0 && b._n < want) {
        const add = Math.min(want - b._n, Math.ceil(cap * h * 0.2) + 1);
        for (let k = 0; k < add; k++) { const i = b._n; if (this._drip(b, i, fx, fz, ground, canopyH, cp, g)) b._n++; }
      }
      if (!draining && b._n < want) {
        // new arrivals enter at random heights so a shower builds up rather than switching on
        const add = Math.min(want - b._n, Math.ceil(cap * h * 0.6) + 1);
        for (let k = 0; k < add; k++) this._spawn(b, b._n++, bx, bz, ground + this.rng() * H, isSnow, Rb);
      }
      // (P17) the step of each falling particle is its own method (_fall: see there)
      const C = this._fc;
      C.h = h; C.Rb = Rb; C.bx = bx; C.bz = bz; C.ground = ground; C.fx = fx; C.fy = fy; C.fz = fz; C.g = g; C.time = time; C.H = H;
      C.canopyH = canopyH; C.through = through; C.liquid0 = liquid0; C.drip = drip; C.want = want; C.draining = draining; C.isSnow = isSnow; C.target = b === target; C.pr = pr; C.nSH = nSH;
      this._fall(b, name, frame, air, near, C);
    }
    void other;
    // (P7) The rings the drops stand for. Rain of 25 mm/h lands over a thousand drops a second on
    // every square metre; the particles are a few hundred a second over the whole box, and a ring
    // is only seen near by. So near the focus as many more land as a painter would put in: up to
    // ringRate a second, within ringRadius, more of them nearer; each where the ground or the
    // liquid is, none under the hull, fewer under leaves, as the drops themselves.
    if (h > 0 && target === this.buffers.rain && pr.reachesGround01 > 0.5) {
      this._ring += PARTICLES.ringRate * clamp01(pr.intensity01) * h;
      if (this._ring > 8) this._ring = 8;
      const rng = this.rng;
      while (this._ring >= 1) {
        this._ring -= 1;
        const a = rng() * 6.2831853, r = PARTICLES.ringRadius * rng(), x = fx + Math.cos(a) * r, z = fz + Math.sin(a) * r, fate = rng(), big = rng();
        let gy = near ? near.heightAt(x, z, NaN) : NaN; if (gy !== gy) gy = air.terrain.heightAt(x, z, groundF);
        let lq = near ? near.liquidAt(x, z) : NaN; if (lq !== lq) lq = air.terrain.liquidAt(x, z); if (lq !== lq) lq = liquid0;
        const onLiquid = lq > gy; if (onLiquid) gy = lq;
        if (canopyH > 1) {
          let u = (x - fx) / 16 + 1.5, v = (z - fz) / 16 + 1.5; u = u < 0 ? 0 : u > 2.999 ? 2.999 : u; v = v < 0 ? 0 : v > 2.999 ? 2.999 : v;
          const iu = u | 0, iv = v | 0, fu = u - iu, fv = v - iv;
          const c01 = cp[iv * 4 + iu] * (1 - fu) * (1 - fv) + cp[iv * 4 + iu + 1] * fu * (1 - fv) + cp[iv * 4 + iu + 4] * (1 - fu) * fv + cp[iv * 4 + iu + 5] * fu * fv;
          if (c01 > 0.05 && fate < c01 * (1 - through)) continue;
        }
        let dry = false;
        for (let k = 0; k < nSH; k++) { const so = k * 4, dx = x - SH[so], dz = z - SH[so + 1]; if (dx * dx + dz * dz < SH[so + 3] * SH[so + 3] && gy < SH[so + 2]) { dry = true; break; } }
        if (dry) continue;
        const size = (pr.dropSize || 0.002) * (0.6 + 0.9 * big);
        // on liquid a ripple, on the ground a crown: as the drops themselves ((P21) where the ground shows one)
        let st = clamp01((pr.fallSpeed || 6) * size * 60);
        if (!onLiquid && this.splashOf) { st *= this.splashAt(near ? near.nearest(x, z) : -1); if (st < 0.02) continue; }
        this._event(frame, x, gy, z, onLiquid ? EVENT.ripple : EVENT.splash, st, size);
      }
    } else this._ring = 0;
  }

  // (P17) One falling kind's step (rain or snow), moved out of update verbatim: inside that long method V8 optimised the
  // loop only on the fly (on-stack replacement), never whole, so every lookup it made per drop stayed a call and every
  // number it handed over was boxed on the heap; a method of one loop is optimised whole. C: the frame's context (update).
  _fall(b, name, frame, air, near, C) {
    const n = b._n;
    if (n === 0) { b.count = 0; return; }
    const h = C.h, Rb = C.Rb, bx = C.bx, bz = C.bz, ground = C.ground, fx = C.fx, fy = C.fy, fz = C.fz, g = C.g, time = C.time, H = C.H;
    const canopyH = C.canopyH, through = C.through, liquid0 = C.liquid0, drip = C.drip, want = C.want, draining = C.draining, isSnow = C.isSnow, pr = C.pr, nSH = C.nSH;
    const target = C.target ? b : null, SH = this.shelters, cp = this._cp, wv = this._wv, ht = this._ht, wtx = this._wtx, wtz = this._wtz, SO = this.splashOf;
  const P = b._p, V = b._v, VT = b._vt, PH = b._ph;
  const snowy = name === 'snow';
  const top = ground + H, bottom = Math.min(ground, fy) - PARTICLES.below;
  const virga = b === target && pr.reachesGround01 < 0.999 ? H * (1 - pr.reachesGround01) : 0;
  let alive = n;
  for (let i = 0; i < alive; i++) {
    const o = i * 3;
    let x = P[o], y = P[o + 1], z = P[o + 2];
    // wrap into the box around the focus, so the density stays even as the focus moves
    // (powder kicked up from lying snow is where the foot is, wherever the box is)
    let wrapped = false;
    if (b.mat[i] === 255) {
      if (x - bx > Rb) { x -= 2 * Rb * Math.ceil((x - bx - Rb) / (2 * Rb)); wrapped = true; } else if (x - bx < -Rb) { x += 2 * Rb * Math.ceil((bx - x - Rb) / (2 * Rb)); wrapped = true; }
      if (z - bz > Rb) { z -= 2 * Rb * Math.ceil((z - bz - Rb) / (2 * Rb)); wrapped = true; } else if (z - bz < -Rb) { z += 2 * Rb * Math.ceil((bz - z - Rb) / (2 * Rb)); wrapped = true; }
    }
    // wind at the particle: between the four grid nodes round it, each with its own profile (P12)
    let u = (x - wtx) * 0.0625, v = (z - wtz) * 0.0625;
    u = u < 0 ? 0 : u > 3.999 ? 3.999 : u; v = v < 0 ? 0 : v > 3.999 ? 3.999 : v;
    const iu = u | 0, iv = v | 0, fu = u - iu, fv = v - iv, pn = iv * 5 + iu;
    // (height over the ground: for a flake, over the ground under it as last looked up)
    let hz = y - (snowy && b._lt[i] > -1e8 ? b._g[i] : ground); hz = hz < 0 ? 0 : hz > 23.99 ? 23.99 : hz;
    const ih = hz | 0, fh = hz - ih, t0 = pn * 25 + ih, a0 = pn * 2;
    const h00 = (ht[t0] + (ht[t0 + 1] - ht[t0]) * fh) * (1 - fu) * (1 - fv), h10 = (ht[t0 + 25] + (ht[t0 + 26] - ht[t0 + 25]) * fh) * fu * (1 - fv);
    const h01 = (ht[t0 + 125] + (ht[t0 + 126] - ht[t0 + 125]) * fh) * (1 - fu) * fv, h11 = (ht[t0 + 150] + (ht[t0 + 151] - ht[t0 + 150]) * fh) * fu * fv;
    let we = wv[a0] * h00 + wv[a0 + 2] * h10 + wv[a0 + 10] * h01 + wv[a0 + 12] * h11;
    let wn = wv[a0 + 1] * h00 + wv[a0 + 3] * h10 + wv[a0 + 11] * h01 + wv[a0 + 13] * h11;
    const vt = VT[i];
    if (snowy) {
      // a flake side-slips as it tumbles: a slow circular flutter, its own phase and rate
      const a = PH[i] + b.age[i] * (1.6 + PH[i] * 0.25);
      const fl = PARTICLES.flutter * Math.min(1, vt);
      we += fcos(a) * fl; wn += fsin(a * 1.3) * fl;      // (P17: fsin / fcos, util.js; sqrt for Math.hypot below: the same numbers, cheaper)
    }
    // weight, then drag relative to the air (implicit). wu: the air's own rise or fall where
    // it flows over sloping ground (snow only; below)
    const wu = snowy ? b._wu[i] : 0;
    let rx = V[o] - we, ry = V[o + 1] - g * h - wu, rz = V[o + 2] - wn;
    const m = 1 / (1 + g / (vt * vt) * Math.sqrt(rx * rx + ry * ry + rz * rz) * h);
    rx *= m; ry *= m; rz *= m;
    const vx = we + rx, vy = wu + ry, vz = wn + rz;
    x += vx * h; y += vy * h; z += vz * h;
    b.age[i] += h;
    // the ground (only looked up when the particle is low)
    // (a flake is looked up all the way down: it rides the air over the ground, below)
    let hit = false, gy = ground, wet = false, left = b.left[i] - h, nm = -1;
    if (snowy || y < ground + 6) {
      left = 1e9;
      // (P17: TerrainGrid.groundQ, both lookups through a scratch array: nothing boxed, nothing to collect)
      const GQ = _gq; GQ[0] = x; GQ[1] = z;
      if (near) { near.groundQN(GQ); gy = GQ[2]; nm = GQ[4]; } else { gy = NaN; GQ[3] = NaN; }
      let lq = GQ[3];
      if (gy !== gy || lq !== lq) { const g1 = gy, l1 = lq; air.terrain.groundQ(GQ); gy = g1 === g1 ? g1 : GQ[2] === GQ[2] ? GQ[2] : ground; lq = l1 === l1 ? l1 : GQ[3]; }
      if (lq !== lq) lq = liquid0;
      if (lq > gy) { gy = lq; wet = true; }
      if (snowy && b.mat[i] === 255) {
        // The air near the ground flows over it, and a flake, which falls at a metre a second
        // in a wind of ten, goes where the air goes: up the windward slope and down the lee.
        // Carried straight and level instead it would strike every rise it met and leave
        // everything lower than the highest ground about bare of snow (measured on an alpine
        // slope: half the flakes in view gone). So the air it is in rises and falls with the
        // ground under it, at the rate the ground changes along its path, and the flake
        // follows through its drag, a tenth of a second late. (At every height of the 18 m
        // it falls through: over a single hummock the streamlines flatten with height, but
        // the box wraps, so a slope across it is a slope without end, and over that the air
        // runs parallel to the ground all the way up. With the following fading out aloft,
        // flakes blown downhill hung where the lag equalled their fall and never landed.)
        // Across a wrap of the box it keeps its height over the ground instead.
        const g0 = b._g[i]; b._g[i] = gy;
        if (time - b._lt[i] < 0.5) {
          if (wrapped || h < 1e-4) { y += gy - g0; b._wu[i] = 0; } else b._wu[i] = (gy - g0) / h;
        } else { b._wu[i] = 0; y += gy - ground; }      // (the first look: it entered over the ground it is over, not the box centre's)
      }
      hit = y <= gy;
      // How long until it lands: its height over the ground under it, at the rate that height
      // has been closing. (Not at its fall speed: in a wind a flake comes down a windward
      // slope many times faster than it falls, and its landing must be foretold in time.)
      // The rate is eased over 0.15 s: the ground is rough, and a flake skimming it would
      // otherwise be told it lands now, never, now.
      const alt = y - gy, dl = time - b._lt[i];
      let rate = -vy;                                                       // (the first look: its fall speed)
      if (dl > 0 && dl < 0.5) { const r0 = b._rate[i]; rate = r0 + ((b._alt[i] - alt) / dl - r0) * (dl < 0.15 ? dl / 0.15 : 1); }
      // (never slower than it is falling: a clod of kicked powder is down again in a third of a second)
      const closing = rate > -vy ? rate : -vy;
      if (closing > 0.05) left = alt / closing;
      b._alt[i] = alt; b._lt[i] = time; b._rate[i] = rate;
    }
    // virga: in hot dry air a drop evaporates on the way down and never lands
    let gone = false;                      // caught or evaporated on the way: it never lands
    if (virga > 0 && !snowy && y - ground < virga * (0.3 + 0.7 * PH[i] / 6.2831853)) { hit = false; gone = true; }
    // shelter. Canopy: a share of what falls is caught where it meets the leaves (each
    // particle's fate is its own for its whole fall). Drips are born under the leaves.
    if (canopyH > 1 && hz < canopyH && drip === 0) {
      let cu = (x - fx) / 16 + 1.5, cw = (z - fz) / 16 + 1.5;
      cu = cu < 0 ? 0 : cu > 2.999 ? 2.999 : cu; cw = cw < 0 ? 0 : cw > 2.999 ? 2.999 : cw;
      const ci = cu | 0, cj = cw | 0, cfu = cu - ci, cfv = cw - cj, cq = cj * 4 + ci;
      const c01 = cp[cq] * (1 - cfu) * (1 - cfv) + cp[cq + 1] * cfu * (1 - cfv) + cp[cq + 4] * (1 - cfu) * cfv + cp[cq + 5] * cfu * cfv;
      if (c01 > 0.05 && PH[i] < 6.2831853 * c01 * (1 - through) && hz > canopyH * 0.5) { hit = false; gone = true; }
    }
    // the hull: a drop that reaches it stops there (a splash on the hull, none under it)
    for (let s = 0; s < nSH; s++) {
      const so = s * 4, dx = x - SH[so], dz = z - SH[so + 1];
      if (y < SH[so + 2] && y - vy * h >= SH[so + 2] - 0.5 && dx * dx + dz * dz < SH[so + 3] * SH[so + 3]) {
        this._event(frame, x, SH[so + 2], z, snowy ? EVENT.settle : EVENT.splash, clamp01(Math.hypot(vx, vy, vz) * b.size[i] * 60), b.size[i]);
        hit = false; gone = true; break;
      }
    }
    // (snow is bounded by the ground under each flake, not by a floor and a lid at the centre's height)
    if (hit || gone || (y < bottom && !snowy)) {
      if (hit) {
        this.landed++;
        const sp = Math.hypot(vx, vy, vz);
        if (Math.abs(x - bx) < PARTICLES.ringFar && Math.abs(z - bz) < PARTICLES.ringFar) {
          // ((P21) a drop on the ground: as much of a crown as that ground shows)
          let st = clamp01(sp * b.size[i] * 60);
          if (!snowy && !wet && SO) st *= this.splashAt(nm);
          if (st >= 0.02 || snowy || wet || !SO) this._event(frame, x, gy, z, snowy ? EVENT.settle : wet ? EVENT.ripple : EVENT.splash, st, b.size[i]);
        }
      }
      if (draining || i >= want) {
        // retire: move the last live particle into this slot
        alive--;
        if (i < alive) {
          const s = alive * 3;
          P[o] = P[s]; P[o + 1] = P[s + 1]; P[o + 2] = P[s + 2]; V[o] = V[s]; V[o + 1] = V[s + 1]; V[o + 2] = V[s + 2];
          VT[i] = VT[alive]; PH[i] = PH[alive]; b.size[i] = b.size[alive]; b.age[i] = b.age[alive]; b.mat[i] = b.mat[alive]; b.left[i] = b.left[alive]; b._alt[i] = b._alt[alive]; b._lt[i] = b._lt[alive]; b._rate[i] = b._rate[alive]; b._g[i] = b._g[alive]; b._wu[i] = b._wu[alive];
          i--;
        }
        continue;
      }
      if (drip > 0) {
        // the next drop from a leaf tip (or, where there is no leaf over the spot, one fewer)
        if (!this._drip(b, i, fx, fz, ground, canopyH, cp, g)) {
          alive--;
          if (i < alive) { const s = alive * 3; P[o] = P[s]; P[o + 1] = P[s + 1]; P[o + 2] = P[s + 2]; V[o] = V[s]; V[o + 1] = V[s + 1]; V[o + 2] = V[s + 2]; VT[i] = VT[alive]; PH[i] = PH[alive]; b.size[i] = b.size[alive]; b.age[i] = b.age[alive]; b.mat[i] = b.mat[alive]; b.left[i] = b.left[alive]; b._alt[i] = b._alt[alive]; b._lt[i] = b._lt[alive]; b._rate[i] = b._rate[alive]; b._g[i] = b._g[alive]; b._wu[i] = b._wu[alive]; i--; }
        }
        continue;
      }
      this._spawn(b, i, bx, bz, top, isSnow, Rb);
      // enter upwind, so that slanting rain still fills the box
      const tf = H / Math.max(VT[i], 0.3) * 0.5;
      P[o] -= clampAbs(we * tf, Rb * 0.8); P[o + 2] -= clampAbs(wn * tf, Rb * 0.8);
      continue;
    }
    if (snowy) { if (y - gy > H + 4) y = gy + H; } else if (y > top + 4) y = top;
    P[o] = x; P[o + 1] = y; P[o + 2] = z; V[o] = vx; V[o + 1] = vy; V[o + 2] = vz; b.left[i] = left;
  }
    b._n = alive;
    b.count = alive;
    publish(b, frame, alive);
  }

  _spawn(b, i, fx, fz, y, snow, R = PARTICLES.radius) {
    const rng = this.rng, o = i * 3;
    b._p[o] = fx + (rng() * 2 - 1) * R; b._p[o + 1] = y; b._p[o + 2] = fz + (rng() * 2 - 1) * R;
    // size: exponential tail of large drops (Marshall and Palmer 1948), index into the 8-step LUT
    const t = snow ? rng() * 5 : Math.min(7, -Math.log(1 - rng() * 0.98) * 1.6);
    const k = t | 0, f = t - k;
    const vt = this._lut[k] + (this._lut[Math.min(7, k + 1)] - this._lut[k]) * f;
    b._vt[i] = vt > 0.005 ? vt : 0.005;
    b.size[i] = (b.species ? SPECIES[b.species].d : 0.002) * (0.4 + 0.3 * t);
    b._ph[i] = rng() * 6.2831853;
    b.age[i] = 0; b.mat[i] = 255; b.left[i] = 1e9; b._lt[i] = -1e9; b._wu[i] = 0;  // from the sky, not from the ground
    b._v[o] = 0; b._v[o + 1] = -b._vt[i]; b._v[o + 2] = 0;
  }

  // A drip: a big drop let go by a leaf, at rest, somewhere under the canopy near the focus.
  // Returns false when the spot it tried has no canopy over it.
  _drip(b, i, fx, fz, ground, canopyH, cp, g) {
    const R = PARTICLES.radius, rng = this.rng, o = i * 3;
    const x = fx + (rng() * 2 - 1) * R, z = fz + (rng() * 2 - 1) * R;
    let u = (x - fx) / 16 + 1.5, v = (z - fz) / 16 + 1.5;
    u = u < 0 ? 0 : u > 2.999 ? 2.999 : u; v = v < 0 ? 0 : v > 2.999 ? 2.999 : v;
    const iu = u | 0, iv = v | 0, fu = u - iu, fv = v - iv;
    const c01 = cp[iv * 4 + iu] * (1 - fu) * (1 - fv) + cp[iv * 4 + iu + 1] * fu * (1 - fv) + cp[iv * 4 + iu + 4] * (1 - fu) * fv + cp[iv * 4 + iu + 5] * fu * fv;
    if (rng() > c01) return false;
    b._p[o] = x; b._p[o + 1] = ground + canopyH * (0.45 + 0.5 * rng()); b._p[o + 2] = z;
    b._v[o] = 0; b._v[o + 1] = 0; b._v[o + 2] = 0;
    b.size[i] = PARTICLES.dripSize * (0.8 + 0.4 * rng());
    // terminal speed of a drop this big: the top of the size table (large drops flatten: about 9 m/s on Earth)
    b._vt[i] = Math.max(this._lut[7], 0.5);
    b._ph[i] = rng() * 6.2831853;
    b.age[i] = 0; b.mat[i] = 255; b.left[i] = 1e9; b._lt[i] = -1e9;
    void g;
    return true;
  }

  clear() {
    for (const k in this.buffers) { this.buffers[k]._n = 0; this.buffers[k].count = 0; }
  }
}
// Publish a buffer's particles in body-local axes, relative to the frame's anchor.
// The simulation runs in grid coordinates: (x, z) on the tangent plane at the anchor, y the
// height above the sphere of radius r0, measured along the local vertical (as the ground
// heights of the terrain grids are). So the particle is at radius r0 + y on the line through
// the grid point, NOT at anchor + east x + up y + north z: on a 4 km world that plane leaves
// the ground by d^2 / 2R, 4.5 m at 190 m from the anchor and 18 m at 380 m (measured: the rain
// ended that far above the ground before a walker had gone far enough for the frame to move).
// Velocities are turned to the local vertical to first order in d / R.
export function publish(b, frame, n) {
  const ex = frame.ex, ey = frame.ey, ez = frame.ez, nx = frame.nx, ny = frame.ny, nz = frame.nz, ox = frame.ox, oy = frame.oy, oz = frame.oz, r0 = frame.r0;
  const P = b._p, V = b._v, pos = b.pos, vel = b.vel;
  for (let i = 0; i < n; i++) {
    const o = i * 3, x = P[o], y = P[o + 1], z = P[o + 2];
    const qx = ox + ex * x + nx * z, qy = oy + ey * x + ny * z, qz = oz + ez * x + nz * z;
    const il = 1 / Math.sqrt(qx * qx + qy * qy + qz * qz), k = (r0 + y) * il;
    pos[o] = qx * k - ox; pos[o + 1] = qy * k - oy; pos[o + 2] = qz * k - oz;
    // east' = east - up (east . up), north' likewise; up' = the unit vector through the grid point
    const a = V[o], d = V[o + 2], c = V[o + 1] - (a * x + d * z) * il;
    vel[o] = ex * a + nx * d + qx * il * c; vel[o + 1] = ey * a + ny * d + qy * il * c; vel[o + 2] = ez * a + nz * d + qz * il * c;
  }
}
function clampAbs(x, m) { return x > m ? m : x < -m ? -m : x; }
const T0 = (wx) => (wx && wx.temperature ? wx.temperature : 288);
