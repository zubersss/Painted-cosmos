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
import { MATERIAL_INDEX, MATERIAL_NONE, materialNow } from './ground.js';
import { BODIES } from '../data/bodies.js';
import { PARTICLES, EVENT, publish } from './particles.js';
import { clamp01, smoothstep, noise3, fsin, fcos } from './util.js';
import { snowTransport01 } from './drift.js';

// species: row of atmosphere.SPECIES for the fall speed.  life: [min, max] seconds.
// puff: seconds for which a kicked or blown grain is carried by the parcel of air thrown up with
// it. A 30 micron grain alone stops within millimetres; a puff of dust rises because the foot or
// the jet moves the air, and the dust rides that air until it mixes away.
// flutter: sideways tumbling speed as a fraction of the fall speed (capped at 1 m/s).
// turb: how much of the air's turbulence the particle follows.
// ground: what happens on touching the ground: 0 dies, 1 hops on (saltation), 2 bounces (hail).
// lands: it falls steadily enough for its landing to be foretold (buf.left: the time to the
// ground at its fall speed). Dust is not: it hangs, and its vertical speed is the turbulence's.
export const LOOSE = Object.freeze({
  dust: { species: 'dust', life: [3, 8], flutter: 0, turb: 1.0, ground: 0, rest: 0, puff: 0.45 },
  sand: { species: 'sand', life: [1.5, 4], flutter: 0, turb: 0.25, ground: 1, rest: 0.5 },
  ash: { species: 'ash', life: [8, 16], flutter: 0.3, turb: 0.7, ground: 0, rest: 0, puff: 0.3, lands: true },
  spores: { species: 'spore', life: [8, 16], flutter: 0.5, turb: 0.9, ground: 0, rest: 0, puff: 0.3, lands: true },
  // (P15) leaves: turb 0.5 -> 0.9 (a leaf answers the air within vt / g, 0.15 s: it rides every eddy longer than a
  // second, the gusts' updraughts included, which is what keeps a flock aloft); tumble: the share that tumble end over
  // end (the rest flutter to and fro without turning over: Field, Klaus, Moore and Nori 1997, Andersen, Pesavento and
  // Wang 2005), see BLOWN.leafRo
  leaves: { species: 'leaf', life: [6, 14], flutter: 0.6, turb: 0.9, ground: 0, rest: 0, lands: true, tumble: 0.75 },
  spray: { species: 'spray', life: [0.5, 1.4], flutter: 0, turb: 0.1, ground: 0, rest: 0 },
  hail: { species: 'hail', life: [3, 6], flutter: 0, turb: 0, ground: 2, rest: 0.45 },
});
export const LOOSE_KINDS = Object.keys(LOOSE);

export const KICK = Object.freeze({
  perMetre: 5,          // dust grains raised per metre walked on the loosest ground
  landing: 10,          // grains per m/s of landing speed
  up: 1.1,              // m/s: typical upward speed of a kicked grain
  // (P17) a step raises a puff only from ground with loose fines at its surface: dry bare soil (0.15), gravel (0.2), sand,
  // dust, ash, and a little from dry litter (0.06) and moss (0.08). A living sward (grass 0.02: the roots bind the soil
  // and the blades cover it) and rock (0.03) give none: no puff at the boot. (Before, a run or a landing on a meadow put
  // up a lone puff now and then: each grain is drawn as a puff, and the meadow's 0.02 was a chance of one a step.)
  stepDust: 0.05,
  jetRate: 90,          // grains per second per unit of jet load on the loosest ground
  jetSpeedMax: 14,      // m/s: fastest a grain leaves a jet's footprint
  // Once sand is hopping, each impact keeps it going at a lower wind than was needed to start
  // it: the impact threshold. On Earth it is 0.8 of the fluid threshold; on Mars about a tenth
  // (Kok 2010), which is why Martian storms keep saltating in winds that could not start it.
  impactRatio: { earth: 0.8, mars: 0.12, venus: 0.8, default: 0.8 },
});

// What the wind alone raises (P10).
export const BLOWN = Object.freeze({
  // Streamers: blowing sand and blowing snow do not leave the ground evenly but in sinuous bands a
  // metre or so wide and tens of metres long that travel downwind and snake from side to side (the
  // sweeps of the gusts near the ground; "snow snakes" on a road). The share of the ground in a
  // band is about a third; grains are launched there and nowhere else.
  streamLength: 16,       // m along the wind
  streamWidth: 1.3,       // m across it
  streamSnake: 2.2,       // m: how far a band wanders from side to side over streamWave m
  streamWave: 28,
  streamSpeed: 0.55,      // x the 10 m wind: how fast the bands travel downwind
  // Blowing snow: dry snow on the ground is moved like sand, lower and slower (drift.js
  // snowTransport01 says how hard); a ground blizzard is knee deep, a skim in a moderate wind.
  snowRate: 0.6,          // of the sand capacity per 1.6 s at full transport
  // Leaves: in a breeze a tree lets go of one now and then; the load on a leaf stalk goes with the
  // square of the wind and the share of stalks that fail rises as steeply again with the load, so
  // what is torn off goes with the fourth power of the wind; a gust front (the wind rising) strips
  // what the lull left: a flock.
  // (P15) In units of `torn` (below), which multiplies leafFlux; until P15 they were shares of the capacity a second, so a
  // capacity that was raised to show more leaves tore more off: the count is now what the wood sheds, not the buffer.
  leafCalm: 0.03,         // torn in still air where the biome's leaves (ground.js AIRBORNE) are 1: an autumn wood lets go of
                          // its leaves by itself (2000 a m2 over a month: 2 to 3 a second in the box); a summer wood (0.25) a
                          // quarter of that. (Until P15: 0.002 of the capacity a second, any wood.)
  leafWind: 11,           // m/s (10 m, in the open): the wind at which torn is 1
  leafGust: 2.5,          // x more while a gust is arriving (the wind rising at 1 m/s2)
  // (P15) How many: a wood in leaf holds some 2000 leaves over each m2 of its floor (leaf area index 5, a leaf 25 cm2). A
  // summer gale strips one or two in a hundred of them in its first minutes (green litterfall in storms: 0.1 to 0.3 a m2 a
  // second) and a gust front the weak ones first: leafFlux leaves a second off each m2 of closed canopy at torn 1, at most
  // leafTornMax times that (0.24), out of a stock of leafStock a m2 held loosely enough to go (2 in 100), which the gale
  // drains (in about 170 s at full) and a calm restores over leafRecover s. Under the crowns a torn leaf comes down at its
  // fall speed vs, so the air there holds flux / vs leaves a m3: at the gust front in a closed wood 0.24 / 1.5 = 0.16, in
  // an open one (canopy 0.3) a third of that. Each comes off where the crowns are (cover canopy01 and leaves there) and
  // where the gust is (the wind at that place, to the fourth power): they come in bursts and streams, not evenly.
  // A canopy in leaf sheds in a gale whatever its season: the biome's leaves count in full from 0.25 (a summer wood) up;
  // an autumn wood (1) holds leafAutumn times the stock loosely.
  leafFlux: 0.04,
  leafTornMax: 6,
  leafStock: 40,
  leafAutumn: 9,
  // (P15) A leaf torn off a crown 20 m up falls for ten seconds or more and goes a hundred metres downwind meanwhile: most
  // of the leaves crossing the box near the ground were shed upwind of it. Those come in through its upwind side (inflow:
  // each shed over the fetch upwind where it is still in the air when it gets there, at the height it has come down to),
  // so the box holds what a wood that goes on upwind would put in it, low leaves included; until P15 it held only what
  // its own crowns let go, high up, and they left it downwind before they came down: none passed the walker's eye.
  leafFetch: 300,         // m: the farthest upwind a shed leaf is followed from
  leafRecover: 1200,
  // (P15) Litter: what lies on the floor of a wood (last year's leaves, twigs, bits of bark) is lifted where the gust
  // sweeps reach it: a dry leaf on the ground slides at 3 to 4 m/s of wind at a metre and is thrown up at a few more;
  // the gusts' sweeps carry it head high in the streamers along the wind. leafLitter leaves a second off each m2 of
  // littered floor when the wind at 1 m is litterFull, none below litterFrom; wet litter lies (wet01).
  leafLitter: 0.04,
  litterFrom: 3,          // m/s at 1 m (the gusts' sweeps in it)
  litterFull: 9,
  // (P15) A tumbling plate turns at Omega = 2 Ro |v - w| / c (Ro, its rotation number, 0.2 to 0.4 for a thin plate
  // tumbling free: Lugt 1983, Iversen 1979, Mahadevan, Ryu and Samuel 1999), c its chord (0.6 of the leaf's length): a 5 cm
  // leaf, 3 cm across, slipping through the air at 1.5 m/s turns some 5 times a second, so a two-toned leaf shows its other
  // side about ten times a second. A flutterer rocks through +-leafRock radians at half that rate and never turns over.
  leafRo: [0.2, 0.4],
  leafRock: [0.9, 1.35],
  // Spume and surf (the sea's own spray; before P10 only bodies raised spray).
  // Spume: where a crest is breaking and the wind is over spumeFrom the wind tears the top off it:
  // drops leave at the crest's speed plus a share of the wind, a little upward, and stream downwind
  // within a metre or two of the water (Beaufort 8: "foam is blown in well-marked streaks", 9: "spray
  // may affect visibility"; Anguelova et al. 1999 for the onset near 9 m/s of friction-scaled wind).
  spumeFrom: 9,           // m/s at 10 m: no spume below this
  spumeFull: 24,          // m/s: the whole capacity in the air
  spumeLife: 2.2,         // x the life of a splash drop
  // Surf: where the water is shallower than the waves are high the wave breaks whatever the wind:
  // spray is thrown up and shoreward at about the speed of the breaker's lip, sqrt(g H).
  surfDepth: 1.3,         // x the significant height: breaking starts where the water is shallower
  surfShare: 0.5,         // of the spray capacity per second on a beach in a full sea
});

const _gp = { dust: 0, repose: 0, liquid: 0, h: 0, mat: MATERIAL_NONE };
const _sf = {}, _sp = new Float64Array(2), _aw = new Float64Array(2);
const _wl = {};
const _gq = new Float64Array(4);     // (P17) x, z in; ground height, liquid level out (near.js TerrainGrid.groundQ)
const I_DUST = MATERIAL_INDEX.dust, I_SNOW = MATERIAL_INDEX.snow;

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
    this._carry = new Float64Array(13);  // fractional emissions carried between frames
    this.blowingSnow01 = 0;              // 0..1: how hard the wind is moving snow along the ground at the focus (a ground blizzard)
    this.spume01 = 0;                    // 0..1: how much spume the wind is tearing off the sea near the focus
    this.surf01 = 0;                     // 0..1: how hard the sea is breaking on a shore near the focus
    this._gustPrev = 0; this._gustRise = 0;
    this.leafStock01 = 1;                // (P15) 0..1: the share of the loosely held leaves still on the trees round the focus
    this.leafRate = 0;                   // (P15) leaves a second torn off the crowns in the box, and lifted off the floor, last frame
    this.litterRate = 0;
    this._cov = {}; this._crownTop = 0;
    this._shore = new Float32Array(96).fill(1e9); this._shoreN = 0; this._shoreI = 0;   // places found shallow (surf)
    this._seaLevel = -1e9;               // the still level of the liquid near the focus (from sea()), for the spray
    this.saltation01 = 0;                // 0..1: how hard sand is blowing at the focus right now
    this._wade = 0;
    this._T = 288;                       // K: air temperature at the focus (frozen ground glazes, warm ground muds)
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
  // mat: the ground it is raised from (index into MATERIAL_IDS), MATERIAL_NONE when it is not.
  emit(kind, x, y, z, vx, vy, vz, sizeMul = 1, lifeMul = 1, mat = MATERIAL_NONE) {
    const b = this.P.buffers[kind], K = LOOSE[kind];
    const cap = PARTICLES.capacity[kind][this.P.quality];
    if (b._n >= cap) return false;
    const i = b._n++, o = i * 3, r = this.rng;
    b.hag[i] = 0;
    b._p[o] = x; b._p[o + 1] = y; b._p[o + 2] = z;
    b._v[o] = vx; b._v[o + 1] = vy; b._v[o + 2] = vz;
    if (b._e) { b._e[o] = vx; b._e[o + 1] = vy; b._e[o + 2] = vz; }
    const s = (0.6 + r() * 0.9) * sizeMul;
    b.size[i] = SPECIES[K.species].d * s;
    // a bigger grain falls faster: vt ~ d in the drag-dominated regime, d^2 in Stokes'; use d^1.2
    b._vt[i] = this.vt[kind] * Math.pow(s, 1.2);
    b._ph[i] = r() * 6.2831853;
    b.turn[i] = 0; b._tp[i] = r() * 6.2831853;
    b._life[i] = (K.life[0] + r() * (K.life[1] - K.life[0])) * lifeMul;
    b.age[i] = 0; b.mat[i] = mat; b.left[i] = b._life[i]; b._alt[i] = 1e9;
    return true;
  }

  // Ground under grid position (x, z) from the near cache: fills _gp { dust, repose, liquid, h,
  // mat (what the ground there is now: an index into MATERIAL_IDS, snow and mud included) }.
  _ground(near, x, z, groundY, wet01, snowDepth) {
    const n = near ? near.nearest(x, z) : -1;
    if (n < 0) { _gp.dust = 0; _gp.repose = 0; _gp.liquid = 0; _gp.h = groundY; _gp.mat = MATERIAL_NONE; return _gp; }
    const c = near.cover, a = n * near.CW;
    _gp.dust = c[a + 2] * (1 - smoothstep(0.05, 0.4, wet01));
    _gp.repose = c[a + 3]; _gp.liquid = c[a + 7];
    _gp.h = near.heightAt(x, z, near.h[n]);
    _gp.mat = near.CW > 9 ? (snowDepth > 0.03 ? I_SNOW : materialNow(c[a + 8], c[a + 9], Math.atan(Math.hypot(near.gx[n], near.gz[n])), wet01, snowDepth, this._T)) : MATERIAL_NONE;
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
    this._T = wx ? wx.temperature : 288;
    this._terminal(bodyId, rho, this._T);
    const wp = P._wp, wv = P._wv, ht = P._ht, wtx = P._wtx, wtz = P._wtz;
    // reference wind at the focus (10 m) and at knee height
    const cwe = (wp[15] + wp[18] + wp[27] + wp[30]) * 0.25, cwn = (wp[16] + wp[19] + wp[28] + wp[31]) * 0.25;
    const u10 = Math.hypot(cwe, cwn);
    const carry = this._carry;

    // ---- emitters: the weather and the biome --------------------------------------------------
    if (h > 0) {
      // dust storm / dust haze: fine dust carried through the whole box
      const dust01 = wx ? wx.dustLoad01 || 0 : 0;
      const bd = P.buffers.dust, capD = PARTICLES.capacity.dust[P.quality];
      if (dust01 > 0.03 && rho > 0) {
        // (P10: fed as fast as the wind carries it out of the box, so that the air near the player holds what the
        // storm calls for: at 13 m/s a grain crosses the box in two or three seconds, and at the old rate, a fifth
        // of the load a second, a storm that asked for 700 marks held 190)
        const want = capD * (0.25 + 0.6 * dust01);
        carry[0] += want * h * Math.max(0.2, 0.7 * u10 / (Rr + 6));
        while (carry[0] >= 1 && bd._n < want) {
          carry[0] -= 1;
          // (P7) low: what reads as marks in a dust storm is the dense streamers within a few metres of
          // the ground; the dust above head height is haze (sky.dust), and a puff against the sky is a blot
          const y = groundY + 0.4 + rng() * rng() * 3.2;
          this.emit('dust', fx + (rng() * 2 - 1) * Rr, y, fz + (rng() * 2 - 1) * Rr, cwe * 0.6, 0, cwn * 0.6, 1.4, 1.2, I_DUST);   // carried in from afar: the world's dust
        }
        if (carry[0] > 4) carry[0] = 4;
      }
      // saltation: sand hops where the wind is over the threshold and the ground is loose sand
      const gp = this._ground(near, fx, fz, groundY, wet01, snowDepth);
      const loose = gp.repose > 0 ? gp.dust : 0, matHere = gp.mat;
      const ue = u10 > 1e-6 ? cwe / u10 : 1, un = u10 > 1e-6 ? cwn / u10 : 0;
      this.saltation01 = 0;
      if (loose > 0.2 && rho > 0) {
        const ratio = KICK.impactRatio[bodyId] || KICK.impactRatio.default;
        const thr = saltationThreshold(bodyId, rho) * (1 + (ratio - 1) * clamp01(dust01 * 2));
        const excess = u10 / thr - 0.85;
        if (excess > 0) {
          this.saltation01 = clamp01(excess / 0.7) * loose;
          const capS = PARTICLES.capacity.sand[P.quality];
          carry[1] += capS * clamp01(excess / 0.7) * loose * h / 1.6;
          while (carry[1] >= 1) {
            carry[1] -= 1;
            // (P10) in a streamer: the grains leave the ground in snaking bands, not evenly
            this._streamPoint(fx, fz, Rr, time, ue, un, u10);
            const x = _sp[0], z = _sp[1];
            const gy = near ? near.heightAt(x, z, groundY) : groundY;
            // launched at 50 degrees or so with a speed of a few threshold friction velocities
            const vu = (0.5 + rng() * 1.1) * Math.sqrt(9 / g) * (0.7 + 0.5 * Math.min(2, excess));
            if (!this.emit('sand', x, gy + 0.01, z, ue * vu * 0.6, vu, un * vu * 0.6, 1, 1, matHere)) break;
          }
          if (carry[1] > 4) carry[1] = 4;
          // and the fines the hopping sand knocks loose are lifted as dust, over the streamers
          carry[2] += capD * 0.25 * clamp01(excess) * loose * h / 4;
          while (carry[2] >= 1) {
            carry[2] -= 1; this._streamPoint(fx, fz, Rr, time, ue, un, u10);
            const gy = near ? near.heightAt(_sp[0], _sp[1], groundY) : groundY;
            this.emit('dust', _sp[0], gy + rng() * 0.6, _sp[1], cwe * 0.3, 0.4 + rng(), cwn * 0.3, 1, 1, matHere);
          }
        }
      }
      // blowing snow (P10): dry snow on the ground is moved by the wind as sand is, in the same
      // streamers: a skim of hopping grains (the sand kind, of snow: its ink is snow's) and over it
      // the powder the wind keeps aloft (the dust kind, of snow), knee deep in a ground blizzard
      this.blowingSnow01 = 0;
      if (snowDepth > 0.01 && rho > 0.05) {
        const pr = wx && wx.precipitation;
        const tr = snowTransport01(u10, wet01, pr && pr.frozen01 > 0.5 ? pr.intensity01 || 0 : 0) * smoothstep(275, 271, this._T);
        if (tr > 0.02) {
          this.blowingSnow01 = tr;
          carry[7] += PARTICLES.capacity.sand[P.quality] * BLOWN.snowRate * tr * h / 1.6;
          while (carry[7] >= 1) {
            carry[7] -= 1; this._streamPoint(fx, fz, Rr, time, ue, un, u10);
            const gy = near ? near.heightAt(_sp[0], _sp[1], groundY) : groundY;
            // a snow grain hops lower than sand (the bed is soft): centimetres, to knee height in a gale
            const vu = (0.3 + rng() * 0.8) * Math.sqrt(9 / g) * (0.5 + 0.7 * tr);
            if (!this.emit('sand', _sp[0], gy + 0.01, _sp[1], ue * (vu + u10 * 0.15), vu, un * (vu + u10 * 0.15), 1, 1, I_SNOW)) break;
          }
          if (carry[7] > 4) carry[7] = 4;
          carry[8] += capD * 0.35 * tr * tr * h / 4;
          while (carry[8] >= 1) {
            carry[8] -= 1; this._streamPoint(fx, fz, Rr, time, ue, un, u10);
            const gy = near ? near.heightAt(_sp[0], _sp[1], groundY) : groundY;
            this.emit('dust', _sp[0], gy + 0.05 + rng() * rng() * 1.1, _sp[1], cwe * 0.5, 0.2 + 0.5 * rng(), cwn * 0.5, 1, 1, I_SNOW);
          }
          if (carry[8] > 4) carry[8] = 4;
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
        // (P10) a few at a time in a breeze, a flock when a gust front comes through: what is torn off
        // goes with the fourth power of the wind where the trees stand (u10 here is the gusty wind at the
        // focus), and more while that wind is rising (it strips what the lull left hanging)
        const rise = Math.max(0, (u10 - this._gustPrev) / h); this._gustPrev = u10;
        this._gustRise += (rise - this._gustRise) * Math.min(1, h / 0.4);
        const wl = u10 / BLOWN.leafWind;
        const tornF = Math.min(BLOWN.leafTornMax, BLOWN.leafCalm * (cover.leaves || 0) + wl * wl * wl * wl * (1 + BLOWN.leafGust * Math.min(1.5, this._gustRise)));
        // (P15) the stock of loose leaves: drained by what the wind tears off, restored in a calm
        const stock = BLOWN.leafStock * (1 + (BLOWN.leafAutumn - 1) * clamp01(((cover.leaves || 0) - 0.25) / 0.75));
        this.leafStock01 += (-BLOWN.leafFlux * tornF * Math.min(1, 4 * (cover.leaves || 0)) * this.leafStock01 / stock + (1 - this.leafStock01) / BLOWN.leafRecover) * h;
        if (this.leafStock01 < 0) this.leafStock01 = 0;
        this.leafRate = 0; this.litterRate = 0;
        {
          // (P15) candidates at the most the box could shed, each kept by what is there: the crowns' closure and leafiness
          // at that place and the wind there (the 4 x 4 patch, gusts and all) against the most it could be
          const A = 4 * Rr * Rr, cov = this._cov;
          carry[4] += BLOWN.leafFlux * BLOWN.leafTornMax * this.leafStock01 * A * h;
          if (carry[4] > 400) carry[4] = 400;
          let kept = 0;
          while (carry[4] >= 1) {
            carry[4] -= 1;
            const x = fx + (rng() * 2 - 1) * Rr, z = fz + (rng() * 2 - 1) * Rr;
            if (!air.coverNear(x, z, cov)) continue;
            const lv = cov.leaves || 0, lf = Math.min(1, 4 * lv) * cov.canopy01;
            if (!(lf > 0.005)) continue;
            const ul = this._patchSpeed(wp, x - fx, z - fz) / BLOWN.leafWind, ul4 = ul * ul * ul * ul;
            const torn = Math.min(BLOWN.leafTornMax, BLOWN.leafCalm * lv + ul4 * (1 + BLOWN.leafGust * Math.min(1.5, this._gustRise)));
            if (rng() * BLOWN.leafTornMax >= torn * lf) continue;
            const top = Math.max(3, cov.canopyHeight || 6), gy = near ? near.heightAt(x, z, groundY) : groundY;
            this._crownTop = top;
            kept++;
            if (!this.emit('leaves', x, gy + top * (0.45 + 0.55 * rng()), z, cwe * 0.3, 0, cwn * 0.3)) { carry[4] = 0; break; }
          }
          // (P15) inflow: leaves shed upwind of the box arrive through its upwind side
          const keptBox = kept;
          if (u10 > 0.5) {
            const vs = this.vt.leaves, topR = Math.max(3, cover.canopyHeight || 0, this._crownTop || 0);
            const Uc = Math.max(0.5, this._airAt(fx - ue * Rr, fz - un * Rr, topR * 0.7, _aw));
            const Dmax = Math.min(BLOWN.leafFetch, topR * Uc / Math.max(0.05, vs)), wid = 2 * Rr * (Math.abs(ue) + Math.abs(un));
            carry[12] += BLOWN.leafFlux * BLOWN.leafTornMax * this.leafStock01 * wid * Dmax * h;
            if (carry[12] > 400) carry[12] = 400;
            while (carry[12] >= 1) {
              carry[12] -= 1;
              // a point of the box carried back upwind to its side: the side's points as the wind crosses them
              let x = fx + (rng() * 2 - 1) * Rr, z = fz + (rng() * 2 - 1) * Rr;
              const se = ue > 1e-6 ? (x - fx + Rr) / ue : ue < -1e-6 ? (x - fx - Rr) / ue : 1e9, sn = un > 1e-6 ? (z - fz + Rr) / un : un < -1e-6 ? (z - fz - Rr) / un : 1e9;
              const sb = Math.min(se, sn) - 0.01; x -= ue * sb; z -= un * sb;
              const D = rng() * Dmax;
              // what the ground upwind is like, as far as the grid knows it (else at the side)
              if (!air.coverNear(x - ue * D, z - un * D, cov) && !air.coverNear(x, z, cov)) continue;
              const lv = cov.leaves || 0, lf = Math.min(1, 4 * lv) * cov.canopy01;
              if (!(lf > 0.005)) continue;
              const ul = this._patchSpeed(wp, x - fx, z - fz) / BLOWN.leafWind, ul4 = ul * ul * ul * ul;
              const torn = Math.min(BLOWN.leafTornMax, BLOWN.leafCalm * lv + ul4 * (1 + BLOWN.leafGust * Math.min(1.5, this._gustRise)));
              if (rng() * BLOWN.leafTornMax >= torn * lf) continue;
              // shed at h0 over there; it comes down at its fall speed while the wind at the height it is passing carries it
              const top = Math.max(3, cov.canopyHeight || 6), h0 = top * (0.45 + 0.55 * rng());
              const U0 = Math.max(0.3, this._airAt(x, z, h0 * 0.6, _aw)), hz = h0 - vs * D / U0;
              if (hz < 0.15) continue;
              const gy = near ? near.heightAt(x, z, groundY) : groundY;
              this._airAt(x, z, hz, _aw);
              kept++;
              if (!this.emit('leaves', x, gy + hz, z, _aw[0], 0, _aw[1])) { carry[12] = 0; break; }
            }
          }
          this.leafRate = h > 0 ? kept / h : 0; this._inRate = h > 0 ? (kept - keptBox) / h : 0;
          // (P15) litter off the floor, in the streamers, where the wind at a metre is over litterFrom
          const dry = 1 - smoothstep(0.1, 0.5, wet01);
          if (dry > 0.02 && snowDepth < 0.01) {
            carry[11] += BLOWN.leafLitter * A * dry * h;
            if (carry[11] > 200) carry[11] = 200;
            let lk = 0;
            while (carry[11] >= 1) {
              carry[11] -= 1; this._streamPoint(fx, fz, Rr, time, ue, un, u10);
              const x = _sp[0], z = _sp[1];
              if (!air.coverNear(x, z, cov)) continue;
              const lf = Math.min(1, 4 * (cov.leaves || 0)) * (0.3 + 0.7 * cov.canopy01);
              const u1 = this._airAt(x, z, 1, _aw) + sigma * (rng() * 2 - 1) * 1.7;   // (the sweeps: sigma is the turbulence at the focus, near the ground)
              const ex = (u1 - BLOWN.litterFrom) / (BLOWN.litterFull - BLOWN.litterFrom);
              if (!(ex > 0) || rng() >= lf * (ex > 1 ? 1 : ex)) continue;
              const gy = near ? near.heightAt(x, z, groundY) : groundY, up = 0.6 + rng() * (1.2 + 1.5 * Math.min(1, ex));
              lk++;
              if (!this.emit('leaves', x, gy + 0.05, z, _aw[0] * 0.5, up, _aw[1] * 0.5, 0.9)) { carry[11] = 0; break; }
            }
            this.litterRate = h > 0 ? lk / h : 0;
          }
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
          const dm = this._ground(near, D.x, D.z, groundY, wet01, snowDepth).mat;       // what its foot stands on
          while (n >= 1) {
            n -= 1;
            const a = rng() * 6.2831853, r = D.radius * (0.3 + 0.9 * rng());
            const x = D.x + Math.cos(a) * r, z = D.z + Math.sin(a) * r;
            const gy = near ? near.heightAt(x, z, groundY) : groundY;
            if (!this.emit('dust', x, gy + rng() * 1.5, z, -Math.sin(a) * D.speed * D.spin, D.up * 0.5, Math.cos(a) * D.speed * D.spin, 1.6, 1.5, dm)) break;
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
              while (n >= 1) { n -= 1; const a = rng() * 6.2831853; this.emit('spray', x + Math.cos(a) * 0.3, gp.h + gp.liquid + 0.02, z + Math.sin(a) * 0.3, vx * 0.5 + Math.cos(a) * 0.8, 1.2 + rng() * 1.5, vz * 0.5 + Math.sin(a) * 0.8, 1, 1, gp.mat); }
              this._wade += h * sp;
              if (this._wade > 0.5) { this._wade = 0; P._event(frame, x, gp.h + gp.liquid, z, EVENT.ripple, clamp01(sp / 3), 0.3); }
            }
            continue;
          }
          const powder = snowDepth > 0.03;
          const kick = D.kick != null ? D.kick : gp.dust * clamp01(0.15 + sp / 6);
          const dusty = powder ? 0.5 : kick;
          if (!grounded || dusty < 0.02) continue;
          if (!powder && gp.dust < KICK.stepDust) continue;      // (P17) a sward or bare rock: no puff (KICK.stepDust)
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
              this.emit(kind, x + Math.cos(a) * 0.2, gp.h + 0.03, z + Math.sin(a) * 0.2, ex, eu, ez, 1, 1, gp.mat);
              // coarse grains too where the ground is granular: they fall straight back
              if (gp.repose > 0 && rng() < 0.5) this.emit('sand', x + Math.cos(a) * 0.15, gp.h + 0.03, z + Math.sin(a) * 0.15, ex * 1.4, eu * 1.3, ez * 1.4, 1, 0.5, gp.mat);
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
            if (wetGround) this.emit('spray', px, gy + gp.liquid + 0.02, pz, Math.cos(a) * s, s * (0.5 + el), Math.sin(a) * s, 1, 1, gp.mat);
            else if (snowDepth > 0.03) this._emitSnow(px, gy + 0.05, pz, Math.cos(a) * s, s * el, Math.sin(a) * s);
            else if (gp.repose > 0 && rng() < 0.35) this.emit('sand', px, gy + 0.02, pz, Math.cos(a) * s, s * el, Math.sin(a) * s, 1, 0.6, gp.mat);
            else this.emit('dust', px, gy + 0.03, pz, Math.cos(a) * s, s * el, Math.sin(a) * s, 1, 1, gp.mat);
          }
          if (wetGround) { this._wade += h * 3; if (this._wade > 0.5) { this._wade = 0; P._event(frame, x, gp.h + gp.liquid, z, EVENT.ripple, 1, R); } }
        }
      }
    }

    // ---- motion ---------------------------------------------------------------------------------------
    // (P17) each kind is stepped by its own method (_move). Inside this long update V8 optimised the loops only on the
    // fly (on-stack replacement) and never the whole: per particle, what it called stayed calls, each number handed
    // over in a fresh heap box (half a megabyte of garbage a frame in a blizzard, measured). A method of one loop is
    // optimised whole and its lookups inlined. The arithmetic is the same, line for line.
    for (let kk = 0; kk < LOOSE_KINDS.length; kk++) this._move(LOOSE_KINDS[kk], h, frame, air, near, fx, fz, groundY, g, sigma, devils);
  }

  // One kind's step (see update, "motion").
  _move(name, h, frame, air, near, fx, fz, groundY, g, sigma, devils) {
    const P = this.P, Rr = PARTICLES.radius, wv = P._wv, ht = P._ht, wtx = P._wtx, wtz = P._wtz;
    const K = LOOSE[name], b = P.buffers[name];
    b.origin.x = frame.ox; b.origin.y = frame.oy; b.origin.z = frame.oz;
    let alive = b._n;
    if (alive === 0) { b.count = 0; return; }
    const Pp = b._p, V = b._v, VT = b._vt, PH = b._ph, LF = b._life, AG = b.age, SZ = b.size, EJ = b._e, MT = b.mat, LT = b.left, HG = b.hag;
    const turb = K.turb * sigma, puff = K.puff || 0;
    const TU = K.tumble > 0 ? b.turn : null, TP = b._tp, ro0 = BLOWN.leafRo[0], roD = BLOWN.leafRo[1] - ro0, rk0 = BLOWN.leafRock[0], rkD = BLOWN.leafRock[1] - rk0;
    const seaLevel = this._seaLevel, overSea = name === 'spray' && seaLevel > -1e8;
    for (let i = 0; i < alive; i++) {
      const o = i * 3;
      let x = Pp[o], y = Pp[o + 1], z = Pp[o + 2];
      const age = AG[i] + h;
      let dead = age > LF[i] || Math.abs(x - fx) > Rr + 6 || Math.abs(z - fz) > Rr + 6;
      let vx = V[o], vy = V[o + 1], vz = V[o + 2];
      let left = LF[i] - age;                                   // what is left of its life
      if (!dead) {
        // wind at the particle
        // (P12: between the four grid nodes round it, each with its own profile; see particles.js)
        let u = (x - wtx) * 0.0625, v = (z - wtz) * 0.0625;
        u = u < 0 ? 0 : u > 3.999 ? 3.999 : u; v = v < 0 ? 0 : v > 3.999 ? 3.999 : v;
        const iu = u | 0, iv = v | 0, fu = u - iu, fv = v - iv, pn = iv * 5 + iu;
        let hz = y - groundY;
        // (spray rides the wind over the sea, which may lie below the ground the focus stands on)
        if (overSea && y - seaLevel > hz) hz = y - seaLevel;
        hz = hz < 0 ? 0 : hz > 23.99 ? 23.99 : hz;
        const ih = hz | 0, fh = hz - ih, t0 = pn * 25 + ih, a0 = pn * 2;
        const h00 = (ht[t0] + (ht[t0 + 1] - ht[t0]) * fh) * (1 - fu) * (1 - fv), h10 = (ht[t0 + 25] + (ht[t0 + 26] - ht[t0 + 25]) * fh) * fu * (1 - fv);
        const h01 = (ht[t0 + 125] + (ht[t0 + 126] - ht[t0 + 125]) * fh) * (1 - fu) * fv, h11 = (ht[t0 + 150] + (ht[t0 + 151] - ht[t0 + 150]) * fh) * fu * fv;
        let we = wv[a0] * h00 + wv[a0 + 2] * h10 + wv[a0 + 10] * h01 + wv[a0 + 12] * h11;
        let wn = wv[a0 + 1] * h00 + wv[a0 + 3] * h10 + wv[a0 + 11] * h01 + wv[a0 + 13] * h11;
        let wu = 0;
        const vt = VT[i], ph = PH[i];
        // (P17: fsin / fcos, util.js: within 6e-8 of Math.sin and 2 to 3 times faster; and sqrt for Math.hypot, which is
        // twenty times slower in V8: the same arithmetic, half the cost of this loop at thousands of leaves)
        if (turb > 0) { const a = ph + age * (1.1 + ph * 0.2); we += fcos(a) * turb; wn += fsin(a * 1.27) * turb; wu += fsin(a * 0.71 + 1.3) * turb * 0.4 * Math.min(1, hz); }
        // the parcel of air it was thrown up with, mixing away
        if (EJ && age < puff * 4) { const k = Math.exp(-age / puff); we += EJ[o] * k; wu += EJ[o + 1] * k; wn += EJ[o + 2] * k; }
        if (K.flutter > 0) { const fl = Math.min(1, K.flutter * vt), a = ph * 3 + age * (2.2 + ph * 0.4); we += fcos(a) * fl; wn += fsin(a * 1.3) * fl; }
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
        const sl = Math.sqrt(rx * rx + ry * ry + rz * rz), m = vt < 1e4 ? 1 / (1 + g / (vt * vt) * sl * h) : 1;
        rx *= m; ry *= m; rz *= m;
        vx = we + rx; vy = wu + ry; vz = wn + rz;
        x += vx * h; y += vy * h; z += vz * h;
        // (P15) a leaf turns about its long side at its slip through the air (BLOWN.leafRo): end over end, or rocking
        // (P17: own in [0, 1), so `own * k % 1` is own * k less its floor, exactly; the slip is the one just damped)
        if (TU) {
          const own = ph * 0.15915494, f7 = own * 7.31, w = 2 * (ro0 + roD * (f7 - Math.floor(f7))) * sl * m / (0.6 * SZ[i]);
          const f3 = own * 3.7, f13 = own * 13.1;
          if (f3 - Math.floor(f3) < K.tumble) { let t = TP[i] + (f13 - Math.floor(f13) < 0.5 ? -w : w) * h; t -= 6.2831853 * Math.floor(t / 6.2831853); TP[i] = t; TU[i] = t; }
          else { const f5 = own * 5.3; let t = TP[i] + 0.5 * w * h; t -= 6.2831853 * Math.floor(t / 6.2831853); TP[i] = t; TU[i] = (rk0 + rkD * (f5 - Math.floor(f5))) * fsin(t); }
        }
        // the ground
        HG[i] = y - groundY;
        if (y < groundY + 4) {
          // (P17: TerrainGrid.groundQ, through a scratch array: nothing boxed, nothing to collect)
          const GQ = _gq; GQ[0] = x; GQ[1] = z;
          let gy = NaN, lqN = NaN;
          if (near) { near.groundQ(GQ); gy = GQ[2]; lqN = GQ[3]; }
          if (gy !== gy) { air.terrain.groundQ(GQ); gy = GQ[2] === GQ[2] ? GQ[2] : groundY; }
          HG[i] = y > gy ? y - gy : 0;
          // a drop that falls back into the liquid is gone (it used to sink to the bed, unseen)
          if (overSea && vy < 0 && near) { const lq = lqN; if (lq === lq && lq > gy) { if (y < lq - 0.03) dead = true; else HG[i] = y - lq; } }
          if (y <= gy) {
            if (K.ground === 1 && vy < 0) {
              // saltation: the grain rebounds with about half its speed at a steeper angle,
              // as long as the wind keeps feeding it (otherwise it comes to rest)
              const s = Math.hypot(vx, vy, vz) * K.rest;
              if (s > 0.25 && age < LF[i] - 0.2) { y = gy + 0.005; const hs = Math.hypot(vx, vz) || 1; vx = vx / hs * s * 0.75; vz = vz / hs * s * 0.75; vy = s * 0.65; } else dead = true;
            } else if (K.ground === 2 && vy < 0) {
              if (-vy > 2 && PH[i] < 100) { y = gy + 0.01; vy = -vy * K.rest; vx *= 0.6; vz *= 0.6; PH[i] += 100; P._event(frame, x, gy, z, EVENT.bounce, clamp01(-vy / 8), SZ[i]); } else dead = true;
            } else dead = true;
          } else if (K.lands) {
            // it will land first: its height over the ground, at the rate that has been closing (particles.js)
            const alt = y - gy, a0 = b._alt[i]; b._alt[i] = alt;
            const rate = a0 < 1e8 ? b._rate[i] + ((a0 - alt) / h - b._rate[i]) * (h < 0.15 ? h / 0.15 : 1) : -vy; b._rate[i] = rate;
            if (rate > 0.05) { const tl = alt / rate; if (tl < left) left = tl; }
          }
        }
      }
      if (dead) {
        alive--;
        if (i < alive) {
          const s = alive * 3;
          Pp[o] = Pp[s]; Pp[o + 1] = Pp[s + 1]; Pp[o + 2] = Pp[s + 2]; V[o] = V[s]; V[o + 1] = V[s + 1]; V[o + 2] = V[s + 2];
          VT[i] = VT[alive]; PH[i] = PH[alive]; LF[i] = LF[alive]; AG[i] = AG[alive]; SZ[i] = SZ[alive]; MT[i] = MT[alive]; LT[i] = LT[alive]; HG[i] = HG[alive]; b._alt[i] = b._alt[alive]; b._rate[i] = b._rate[alive]; b.turn[i] = b.turn[alive]; TP[i] = TP[alive];
          if (EJ) { EJ[o] = EJ[s]; EJ[o + 1] = EJ[s + 1]; EJ[o + 2] = EJ[s + 2]; }
          i--;
        }
        continue;
      }
      Pp[o] = x; Pp[o + 1] = y; Pp[o + 2] = z; V[o] = vx; V[o + 1] = vy; V[o + 2] = vz; AG[i] = age; LT[i] = left;
    }
    b._n = alive; b.count = alive;
    publish(b, frame, alive);                       // (on the curved ground: particles.js)
  }

  // (P15) The reference wind's speed (m/s, gusts and the lee of trees in it) at (dx, dz) from the focus, bilinear on the
  // 4 x 4 patch round it (nodes 16 m apart at -24, -8, 8, 24 m: particles.js).
  _patchSpeed(wp, dx, dz) {
    let u = (dx + 24) / 16, v = (dz + 24) / 16;
    u = u < 0 ? 0 : u > 2.999 ? 2.999 : u; v = v < 0 ? 0 : v > 2.999 ? 2.999 : v;
    const i = u | 0, j = v | 0, fu = u - i, fv = v - j, a = (j * 4 + i) * 3, b = a + 12;
    const s00 = Math.hypot(wp[a], wp[a + 1]), s10 = Math.hypot(wp[a + 3], wp[a + 4]), s01 = Math.hypot(wp[b], wp[b + 1]), s11 = Math.hypot(wp[b + 3], wp[b + 4]);
    return (s00 * (1 - fu) + s10 * fu) * (1 - fv) + (s01 * (1 - fu) + s11 * fu) * fv;
  }

  // (P15) The mean wind a particle rides at grid position (x, z), hz m over the ground: the same lookup as the motion's
  // (the 5 x 5 nodes, each with its own profile). Writes we, wn into o; returns the speed.
  _airAt(x, z, hz, o) {
    const P = this.P, wv = P._wv, ht = P._ht;
    let u = (x - P._wtx) * 0.0625, v = (z - P._wtz) * 0.0625;
    u = u < 0 ? 0 : u > 3.999 ? 3.999 : u; v = v < 0 ? 0 : v > 3.999 ? 3.999 : v;
    const iu = u | 0, iv = v | 0, fu = u - iu, fv = v - iv, pn = iv * 5 + iu;
    hz = hz < 0 ? 0 : hz > 23.99 ? 23.99 : hz;
    const ih = hz | 0, fh = hz - ih, t0 = pn * 25 + ih, a0 = pn * 2;
    const h00 = (ht[t0] + (ht[t0 + 1] - ht[t0]) * fh) * (1 - fu) * (1 - fv), h10 = (ht[t0 + 25] + (ht[t0 + 26] - ht[t0 + 25]) * fh) * fu * (1 - fv);
    const h01 = (ht[t0 + 125] + (ht[t0 + 126] - ht[t0 + 125]) * fh) * (1 - fu) * fv, h11 = (ht[t0 + 150] + (ht[t0 + 151] - ht[t0 + 150]) * fh) * fu * fv;
    o[0] = wv[a0] * h00 + wv[a0 + 2] * h10 + wv[a0 + 10] * h01 + wv[a0 + 12] * h11;
    o[1] = wv[a0 + 1] * h00 + wv[a0 + 3] * h10 + wv[a0 + 11] * h01 + wv[a0 + 13] * h11;
    return Math.hypot(o[0], o[1]);
  }

  // How much grid position (x, z) is in a streamer now: 0 between the bands .. 1 in the middle of one.
  // (ue, un): unit vector of the wind; u10: its speed. The bands lie along the wind, travel with it
  // at BLOWN.streamSpeed of its speed, and snake from side to side.
  streamAt(x, z, time, ue, un, u10) {
    const al = x * ue + z * un - BLOWN.streamSpeed * u10 * time, ac = z * ue - x * un;
    const snake = BLOWN.streamSnake * noise3(al / BLOWN.streamWave, ac / 60, time * 0.03, 911);
    const v = noise3(al / BLOWN.streamLength, (ac + snake) / BLOWN.streamWidth, time * 0.04, 733);     // (a band lasts some ten seconds)
    return smoothstep(0.02, 0.4, v);
  }

  // A place within R of (fx, fz) to launch a grain: in a streamer (up to six tries; the last one stands).
  _streamPoint(fx, fz, R, time, ue, un, u10) {
    const rng = this.rng;
    for (let k = 0; k < 6; k++) {
      _sp[0] = fx + (rng() * 2 - 1) * R; _sp[1] = fz + (rng() * 2 - 1) * R;
      if (this.streamAt(_sp[0], _sp[1], time, ue, un, u10) > rng()) break;
    }
    return _sp;
  }

  // The sea's own spray (P10): spume torn off breaking crests by the wind, and surf on a shore.
  // Call after water.update. water: the Water (water.js); near: the near ground cache (for the
  // depth); (cwe, cwn): the wind at 10 m (frame axes); g: gravity; air: the wind grid (its coarse
  // ground says what is land and what is sea beyond the near cache).
  sea(dt, water, near, fx, fz, cwe, cwn, g, air = null) {
    const h = dt > 0.1 ? 0.1 : dt, P = this.P, rng = this.rng, carry = this._carry;
    this.spume01 = 0; this.surf01 = 0;
    this._seaLevel = water && water.present ? water.level : -1e9;
    if (!(h > 0) || !water || !water.present || !(water.significant > 0.03)) return;
    const Rr = PARTICLES.radius, capY = PARTICLES.capacity.spray[P.quality];
    // (P18) the sea HERE (water.js localAt: the sea map's local sea, the reference's without a map): a sheltered bay
    // breaks less than the open shore beside it
    const L = water.localAt ? water.localAt(fx, fz, _wl) : null;
    const u10 = Math.hypot(cwe, cwn), Hs = L ? L.significant : water.significant, lvl = water.level;
    const dx = L ? L.dirx : water.dir[0], dz = L ? L.dirz : water.dir[1], c = water.speed || 0;
    // spume: the wind over a breaking sea
    // (a sea, not a puddle: nothing is torn off a chop under a hand high)
    const sp = smoothstep(BLOWN.spumeFrom, BLOWN.spumeFull, u10) * ((L ? L.foamAt : water.foamAt) < 1e8 ? 1 : 0) * smoothstep(0.2, 0.6, Hs);
    this.spume01 = sp;
    if (sp > 0) {
      carry[9] += capY * sp * h / 2.2;
      // look for breaking water at up to 64 places a frame; each found sheds a sheet of drops
      for (let k = 0; k < 64 && carry[9] >= 1; k++) {
        const x = fx + (rng() * 2 - 1) * Rr, z = fz + (rng() * 2 - 1) * Rr;
        water.surfaceAt(x, z, _sf);
        if (!(_sf.foam01 > 0.25)) continue;
        if (this._depthAt(near, air, x, z) < 0.05) continue;                // dry ground here (or nothing known)
        const y = lvl + _sf.height;
        let n = 3 + Math.floor(rng() * 6 * (0.5 + sp));
        while (n-- > 0 && carry[9] >= 1) {
          carry[9] -= 1;
          // off the top of the crest, at the crest's own speed and a share of the wind, a little upward;
          // fine drops (a third of a splash drop's size: they ride the wind for a second or two)
          const a = 0.25 + 0.3 * rng(), up = (0.8 + 2.6 * rng()) * (0.6 + 0.4 * sp);
          if (!this.emit('spray', x + (rng() - 0.5) * 0.4, y + 0.03 + rng() * 0.15, z + (rng() - 0.5) * 0.4, dx * c * 0.8 + cwe * a, up, dz * c * 0.8 + cwn * a, 0.3 + 0.25 * rng(), BLOWN.spumeLife)) { carry[9] = 0; break; }
        }
      }
      if (carry[9] > 24) carry[9] = 24;
    }
    // surf: the wave breaks where the water is shallower than it is high, whatever the wind
    if (near && Hs > 0.25) {
      // the shore is a line, and a random place in the box is seldom on it: places found shallow are
      // kept (a ring of 48, each checked again when it is used) and the breakers are looked for there
      const SH = this._shore, lim = BLOWN.surfDepth * Hs;
      for (let k = 0; k < 10; k++) {
        const x = fx + (rng() * 2 - 1) * Rr, z = fz + (rng() * 2 - 1) * Rr, d = this._depthAt(near, air, x, z);
        if (d > 0.02 && d < lim) { const o = (this._shoreI++ % 48) * 2; SH[o] = x; SH[o + 1] = z; if (this._shoreN < 48) this._shoreN++; }
      }
      let live = 0;
      for (let k = 0; k < 12 && this._shoreN > 0; k++) {
        const o = Math.floor(rng() * this._shoreN) * 2, x = SH[o], z = SH[o + 1];
        if (Math.abs(x - fx) > Rr || Math.abs(z - fz) > Rr) continue;
        const d = this._depthAt(near, air, x, z);
        if (!(d > 0.02) || d > lim) { SH[o] = 1e9; continue; }
        live++;
        water.surfaceAt(x, z, _sf);
        if (!(_sf.crest01 > 0.45)) continue;
        carry[10] += capY * BLOWN.surfShare * clamp01(Hs / 1.5) * h * 0.5;
        const lip = Math.sqrt(g * Math.min(Hs, d + _sf.height > 0.05 ? d + _sf.height : 0.05));
        let n = 2 + Math.floor(rng() * 4);
        while (n-- > 0 && carry[10] >= 1) {
          carry[10] -= 1;
          const a = rng() * 6.2831853, s = lip * (0.3 + 0.7 * rng());
          if (!this.emit('spray', x + Math.cos(a) * 0.5, water.level + Math.max(0, _sf.height) + 0.05, z + Math.sin(a) * 0.5, dx * s * 0.8 + Math.cos(a) * 0.6 + cwe * 0.15, s * (0.6 + 0.6 * rng()), dz * s * 0.8 + Math.sin(a) * 0.6 + cwn * 0.15, 0.5 + 0.5 * rng(), 1.3)) { carry[10] = 0; break; }
        }
      }
      this.surf01 = clamp01(live / 6) * clamp01(Hs / 1.5);
      if (carry[10] > 12) carry[10] = 12;
    }
  }

  // Depth of liquid (m) at grid position (x, z): from the near cache, else from the wind grid's
  // coarse ground; 0 where the ground is dry or nothing is known.
  _depthAt(near, air, x, z) {
    let gy = near ? near.heightAt(x, z, NaN) : NaN, lq = near ? near.liquidAt(x, z) : NaN;
    if (gy !== gy && air) { gy = air.terrain.heightAt(x, z, NaN); lq = air.terrain.liquidAt(x, z); }
    return gy === gy && lq === lq && lq > gy ? lq - gy : 0;
  }

  // Powder kicked up from snow joins the snow buffer (it falls like any other flake).
  _emitSnow(x, y, z, vx, vy, vz) {
    const b = this.P.buffers.snow, cap = PARTICLES.capacity.snow[this.P.quality];
    if (b._n >= cap) return false;
    const i = b._n++, o = i * 3;
    b._p[o] = x; b._p[o + 1] = y; b._p[o + 2] = z; b._v[o] = vx; b._v[o + 1] = vy; b._v[o + 2] = vz;
    // a clod of powder is heavier than a flake: it flies a short arc and bursts into flakes on the way
    b._vt[i] = 2.2 + this.rng() * 2.5; b._ph[i] = this.rng() * 6.2831853; b.size[i] = 0.004 + this.rng() * 0.006; b.age[i] = 0; b.mat[i] = I_SNOW; b.left[i] = 1e9; b._lt[i] = -1e9; b._wu[i] = 0;
    return true;
  }
}
