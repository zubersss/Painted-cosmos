// Painted Cosmos: the shape and ground colour of every body (pure JS, no three). OWNER: PAINTER.
//
// getSurface(bodyId).sample(x, y, z, out, full) is THE definition of a planet: a pure,
// deterministic function of the body-local unit direction. The terrain mesher, the flora
// placer and world.sampleSurface all call it, so what you walk on is what you see.
//
// out.h   ground height in metres above the body's base radius
// out.lq  liquid surface height above the base radius (NOLQ when there is none nearby)
// out.w   Float32Array of biome weights (index = position in look.biomes), out.top = heaviest
// full === true also fills the painter's fields: wash colour, wash parameters, flora fields.

import { BODIES } from '../data/bodies.js';
import { LOOKS, pig, dilute, mixc } from '../data/looks.js';
import { makeNoise, hashString, smoothstep, clamp } from './noise.js';

export const NOLQ = -1e9;
const D2R = Math.PI / 180;

export function makeSample(nBiomes) {
  return {
    h: 0, lq: NOLQ, top: 0, w: new Float32Array(nBiomes || 8),
    r: 1, g: 1, b: 1,            // ground wash (transmittance over paper)
    r2: 1, g2: 1, b2: 1,         // what this ground reads as from far away (canopy, water)
    dry: 0, wet: 0, canopy: 0, aux: 0,
    trees: 0, birch: 0, under: 0, rock: 0, s: 1e9, glade: 0,
  };
}

// scratch result of one biome recipe
function makeB() {
  return { h: 0, lq: NOLQ, r: 1, g: 1, b: 1, r2: 1, g2: 1, b2: 1, dry: 0.2, wet: 0.2, canopy: 0, aux: 0, trees: 0, birch: 0, under: 0, rock: 0, s: 1e9, glade: 0 };
}

function mix3(o, c, t) { o.r += (c[0] - o.r) * t; o.g += (c[1] - o.g) * t; o.b += (c[2] - o.b) * t; }
function set3(o, c) { o.r = c[0]; o.g = c[1]; o.b = c[2]; }

class Surface {
  constructor(bodyId) {
    const body = BODIES[bodyId];
    const look = LOOKS[bodyId];
    if (!body || !look) throw new Error('unknown body: ' + bodyId);
    this.id = bodyId;
    this.R = body.radius;
    this.look = look;
    this.biomes = look.biomes;
    this.nB = this.biomes.length;
    const seed = hashString(look.seed);
    this.seed = seed;
    this.nA = makeNoise(seed);
    this.nBn = makeNoise(seed ^ 0x9e3779b9);
    this.nC = makeNoise(seed ^ 0x51f15e77);
    this.sea = look.seaLevel;
    this.lqGroup = this.biomes.map((b) => (b.terrain === 'forest' ? 0 : b.terrain === 'coast' ? 1 : b.terrain === 'wetland' ? 2 : -1));
    this._buildSites();
    this._prepPalettes();
    this.clearings = [];   // [{x,y,z, r}] flora-free glades (spawn)
    this._b = makeB();
    this._ctx = { x: 0, y: 0, z: 0, baseReady: false, L: 0, s: 1e9 };
    this._wtmp = new Float32Array(this.sites.length);
    this._spawn = null;
  }

  _buildSites() {
    const look = this.look;
    const sites = [];
    if (look.sites) {
      for (const [lat, lon, id] of look.sites) {
        const cl = Math.cos(lat * D2R);
        sites.push({ x: cl * Math.sin(lon * D2R), y: Math.sin(lat * D2R), z: cl * Math.cos(lon * D2R), b: this.biomes.findIndex((b) => b.id === id) });
      }
    } else {
      // jittered Fibonacci sphere, biomes dealt round-robin from a seeded start
      const n = Math.max(12, this.nB * 4);
      const ga = Math.PI * (3 - Math.sqrt(5));
      let k = this.seed % this.nB;
      for (let i = 0; i < n; i++) {
        const y = 1 - (2 * (i + 0.5)) / n;
        const r = Math.sqrt(1 - y * y);
        const a = i * ga + (this.seed % 628) * 0.01;
        sites.push({ x: Math.cos(a) * r, y, z: Math.sin(a) * r, b: (k + i * 3 + ((i * 7) % this.nB)) % this.nB });
      }
      // make sure every biome owns at least two sites
      for (let b = 0; b < this.nB; b++) {
        let c = 0; for (const s of sites) if (s.b === b) c++;
        for (let i = 0; c < 2 && i < sites.length; i++) {
          let cnt = 0; for (const s of sites) if (s.b === sites[i].b) cnt++;
          if (cnt > 2) { sites[i].b = b; c++; }
        }
      }
    }
    this.sites = sites;
  }

  _prepPalettes() {
    // Wash colours each recipe blends between, prepared once.
    this.pal = this.biomes.map((bi) => {
      const g = bi.ground.map((n) => pig(n));
      const P = {};
      for (const n of bi.pigments) P[n] = pig(n);
      P.accent = pig(bi.accent);
      const p = { low: dilute(g[0], 0.38), mid: dilute(g[1], 0.34), high: dilute(g[2], 0.36), P };
      if (bi.terrain === 'forest') {
        if (bi.autumn) {
          p.grassLight = dilute(mixc(pig('quinGold'), pig('oliveGreen'), 0.35), 0.5);
          p.grassMid = dilute(mixc(pig('oliveGreen'), pig('quinGold'), 0.3), 0.3);
          p.moss = dilute(mixc(pig('oliveGreen'), pig('rawUmber'), 0.4), 0.25);
          p.litter = dilute(mixc(pig('cadOrange'), pig('burntSienna'), 0.5), 0.35);
        } else {
          p.grassLight = dilute(mixc(pig('sapGreen'), pig('quinGold'), 0.42), 0.52);
          p.grassMid = dilute(mixc(pig('sapGreen'), pig('quinGold'), 0.12), 0.30);
          p.moss = dilute(mixc(pig('hookersGreen'), pig('sapGreen'), 0.45), 0.26);
          p.litter = dilute(mixc(pig('burntSienna'), pig('rawUmber'), 0.45), 0.40);
        }
        p.mud = dilute(mixc(pig('rawUmber'), pig('burntSienna'), 0.25), 0.34);
        p.bed = dilute(mixc(pig('quinGold'), pig('rawUmber'), 0.55), 0.40);
        p.rock = dilute(mixc(pig('ultramarine'), pig('burntSienna'), 0.5), 0.62);
        if (bi.autumn) {
          p.canopyA = dilute(mixc(pig('quinGold'), pig('cadOrange'), 0.35), 0.22);
          p.canopyB = dilute(mixc(pig('burntSienna'), pig('oliveGreen'), 0.4), 0.18);
        } else {
          p.canopyA = dilute(mixc(pig('sapGreen'), pig('quinGold'), 0.18), 0.22);
          p.canopyB = dilute(mixc(pig('hookersGreen'), pig('ultramarine'), 0.22), 0.20);
        }
      }
      return p;
    });
  }

  // ---- biome field -------------------------------------------------------------------------
  // Smooth, warped Voronoi over the sites. Weights are written into w (per biome), returns top.
  biomeWeights(x, y, z, w) {
    const R = this.R, n = this.nBn.n3;
    const f1 = R / 1500, f2 = R / 420, f3 = R / 130;
    const a1 = 1050 / R * 0.2, a2 = 420 / R * 0.2, a3 = 130 / R * 0.2;
    let wx = x + a1 * n(x * f1 + 11.5, y * f1, z * f1) + a2 * n(x * f2, y * f2 + 3.3, z * f2) + a3 * n(x * f3 + 1.0, y * f3, z * f3);
    let wy = y + a1 * n(x * f1, y * f1 + 27.1, z * f1) + a2 * n(x * f2 + 9.1, y * f2, z * f2) + a3 * n(x * f3, y * f3 + 5.0, z * f3);
    let wz = z + a1 * n(x * f1, y * f1, z * f1 - 14.9) + a2 * n(x * f2, y * f2, z * f2 + 6.7) + a3 * n(x * f3, y * f3, z * f3 - 8.0);
    const il = 1 / Math.sqrt(wx * wx + wy * wy + wz * wz);
    wx *= il; wy *= il; wz *= il;
    const sites = this.sites, ns = sites.length, d = this._wtmp;
    let dmin = 1e9;
    for (let i = 0; i < ns; i++) {
      const s = sites[i];
      const dot = wx * s.x + wy * s.y + wz * s.z;
      const di = Math.sqrt(Math.max(0, 2 - 2 * dot));   // chord length ~ angle
      d[i] = di; if (di < dmin) dmin = di;
    }
    const bw = 280 / R;   // blend band about 280 m wide
    const nb = this.nB;
    for (let i = 0; i < nb; i++) w[i] = 0;
    let sum = 0;
    for (let i = 0; i < ns; i++) {
      const t = 1 - (d[i] - dmin) / bw;
      if (t > 0) { const ww = t * t; w[sites[i].b] += ww; sum += ww; }
    }
    let top = 0, tw = -1;
    for (let i = 0; i < nb; i++) { w[i] /= sum; if (w[i] > tw) { tw = w[i]; top = i; } }
    return top;
  }

  // ---- shared fields ------------------------------------------------------------------------
  _base(c) {
    if (c.baseReady) return;
    c.baseReady = true;
    const R = this.R, x = c.x, y = c.y, z = c.z;
    const f0 = R / 1900;
    c.L = 24 + 12 * this.nA.n3(x * f0 + 3.1, y * f0 - 1.7, z * f0 + 8.2);
    // the stream network: the zero contour of a warped noise field. s is the distance in
    // metres from the nearest stream centre line (true distance near the stream, where the
    // field is divided by its gradient; a looser pseudo distance far away).
    const cf = this._sf(x, y, z);
    const K = 640 / 1.25;
    let s = Math.abs(cf) * K;
    if (s < 95) {
      let ux, uy, uz;
      if (Math.abs(y) < 0.9) { ux = -z; uy = 0; uz = x; } else { ux = 0; uy = z; uz = -y; }
      const l = 1 / Math.sqrt(ux * ux + uy * uy + uz * uz); ux *= l; uy *= l; uz *= l;
      const vx = y * uz - z * uy, vy = z * ux - x * uz, vz = x * uy - y * ux;
      const e = 2.0, eR = e / R;
      const c1 = this._sf(x + ux * eR, y + uy * eR, z + uz * eR), c2 = this._sf(x + vx * eR, y + vy * eR, z + vz * eR);
      const g = Math.sqrt((c1 - cf) * (c1 - cf) + (c2 - cf) * (c2 - cf)) / e;
      const st = Math.abs(cf) / Math.max(g, 0.42 / K);
      s = st + (s - st) * smoothstep(55, 95, s);
    }
    c.s = s;
  }

  _sf(x, y, z) {
    const R = this.R, fw = R / 230, f1 = R / 640;
    const wa = this.nBn.n3(x * fw + 5.5, y * fw, z * fw) * 0.20;
    const wb = this.nBn.n3(x * fw, y * fw + 19.2, z * fw - 4.4) * 0.20;
    return this.nA.n3(x * f1 + wa + 40.5, y * f1 + wb - 12.3, z * f1 - wa * 0.6 + 5.5);
  }

  // ---- biome recipes ------------------------------------------------------------------------
  _forest(c, b, bi, pal, full) {
    this._base(c);
    const R = this.R, x = c.x, y = c.y, z = c.z, nA = this.nA.n3, nC = this.nC.n3;
    const s = c.s, L = c.L;
    const fs = R / 160;
    const w0 = 2.5 + 0.9 * nC(x * fs + 2.2, y * fs, z * fs - 7.7);
    let hb;
    if (s < w0) { const t = s / w0; hb = -0.4 - 0.55 * (1 - t * t); }
    else hb = -0.4 + 1.05 * smoothstep(w0, w0 + 4.0, s) + 0.55 * smoothstep(w0 + 3, w0 + 15, s);
    const rise = smoothstep(w0 + 2, 95, s);
    const f1 = R / 350, f2 = R / 98, f3 = R / 15.5, f4 = R / 3.4;
    const hill = Math.max(0, 0.5 + 0.55 * nA(x * f1 + 7.7, y * f1 + 1.1, z * f1 - 3.3));
    const mid = nA(x * f2 - 5.1, y * f2 + 8.8, z * f2 + 2.4);
    const sm = nC(x * f3, y * f3 + 4.2, z * f3) * 0.42 * smoothstep(w0 * 0.6, w0 + 6, s);
    const mi = nC(x * f4 + 1.7, y * f4, z * f4 + 9.9) * 0.085 * (0.3 + 0.7 * smoothstep(0, w0 + 2, s));
    const fr = R / 58;
    const rk = smoothstep(0.40, 0.60, nC(x * fr + 31.0, y * fr - 8.0, z * fr + 2.0)) * smoothstep(14, 42, s);
    let rockBump = 0;
    if (rk > 0) { const f5 = R / 6.8; rockBump = rk * (1.9 + 1.5 * Math.abs(nC(x * f5, y * f5, z * f5 + 13.0))); }
    b.h = L + hb + (hill * 24 + mid * 4.5) * rise + sm + mi + rockBump;
    b.lq = L - 0.4;
    if (!full) return;
    const fg = R / 125, fp = R / 270, fv = R / 26;
    const glade = smoothstep(0.08, 0.48, nA(x * fg + 61.0, y * fg + 3.0, z * fg - 17.0));
    const pz = smoothstep(-0.12, 0.34, nA(x * fp - 23.0, y * fp + 41.0, z * fp + 9.0) + (b.h - L) * 0.018 - 0.1) * smoothstep(7, 30, s);
    const v1 = nC(x * fv - 3.0, y * fv, z * fv + 21.0);
    set3(b, pal.grassMid);
    mix3(b, pal.grassLight, clamp(glade * 0.8 + v1 * 0.4 + 0.1, 0, 1));
    mix3(b, pal.litter, clamp(pz * (1 - glade * 0.85) * (0.72 + v1 * 0.3), 0, 1));
    mix3(b, pal.moss, smoothstep(15, 4.5, s) * 0.55 * (1 - glade * 0.5));
    mix3(b, pal.mud, smoothstep(w0 + 1.7, w0 + 0.25, s) * 0.9);
    mix3(b, pal.bed, smoothstep(w0 + 0.35, w0 - 0.5, s));
    mix3(b, pal.rock, rk * 0.92);
    const bedm = smoothstep(w0 + 0.6, w0 - 0.3, s);
    b.dry = clamp(0.22 + 0.55 * rk + 0.22 * glade - bedm * 0.3, 0, 1);
    b.wet = clamp(0.18 + 0.5 * bedm, 0, 1);
    const open = smoothstep(w0 + 0.6, w0 + 3.6, s);
    b.trees = clamp((1 - 0.82 * glade) * (1 - rk) * open, 0, 1);
    b.canopy = clamp(b.trees * 1.05 + (1 - open) * 0.35, 0, 1);
    b.birch = clamp(1 - pz * 0.9, 0.05, 1);
    b.under = clamp((0.45 + 0.55 * glade) * (1 - rk * 0.7) * smoothstep(w0 + 0.1, w0 + 1.2, s), 0, 1);
    b.rock = rk; b.s = s; b.glade = glade; b.aux = pz;
    // far colour: the canopy seen from outside (pines cooler and darker), streams as pale lines
    const cz = clamp(b.trees * 1.15, 0, 1);
    const ca = pal.canopyA, cb = pal.canopyB, k = clamp(pz * 1.1, 0, 1), dv = 1 + v1 * 0.25;
    b.r2 = b.r + ((ca[0] + (cb[0] - ca[0]) * k) * dv - b.r) * cz;
    b.g2 = b.g + ((ca[1] + (cb[1] - ca[1]) * k) * dv - b.g) * cz;
    b.b2 = b.b + ((ca[2] + (cb[2] - ca[2]) * k) * dv - b.b) * cz;
    const wl = smoothstep(w0 + 1.2, w0 - 0.6, s);
    b.r2 += (0.80 - b.r2) * wl; b.g2 += (0.87 - b.g2) * wl; b.b2 += (0.93 - b.b2) * wl;
  }

  _generic(c, b, bi, pal, full) {
    const R = this.R, x = c.x, y = c.y, z = c.z, A = this.nA, C = this.nC;
    let h = 0, t = 0.5, dry = 0.4, wet = 0.2, lq = NOLQ;
    const k = bi.terrain;
    if (k === 'alpine') {
      const f = R / 1150;
      const rd = A.ridged(x * f + 4.0, y * f, z * f - 2.0, 5, 2.1, 0.55);
      const m = A.n3(x * R / 260, y * R / 260 + 7.0, z * R / 260);
      h = 45 + rd * rd * 520 + m * 9 + C.n3(x * R / 22, y * R / 22, z * R / 22) * 0.7;
      t = clamp((h - 60) / 330, 0, 1); dry = 0.3 + 0.5 * t; wet = 0.15;
    } else if (k === 'coast') {
      const f = R / 780;
      const n = A.fbm(x * f - 9.0, y * f + 2.0, z * f + 14.0, 4, 2.0, 0.5);
      let hh = n * 70 - 9;
      if (hh > 1.5) hh += smoothstep(1.5, 8, hh) * 24 + C.n3(x * R / 40, y * R / 40, z * R / 40) * 2.2 * smoothstep(8, 20, hh);
      h = hh + C.n3(x * R / 9, y * R / 9 + 2.0, z * R / 9) * 0.25;
      t = clamp((h + 2) / 34, 0, 1); dry = 0.25 + 0.5 * t; wet = h < 1 ? 0.6 : 0.2;
      lq = this.sea == null ? 0 : this.sea;
    } else if (k === 'canyon' || k === 'mesa' || k === 'terraced') {
      const f = R / 820;
      const n = A.fbm(x * f + 21.0, y * f - 5.0, z * f, 3, 2.0, 0.5) * 0.5 + 0.5;
      const steps = k === 'terraced' ? 7 : 4;
      const q = n * steps, fl = Math.floor(q), fr = q - fl;
      const tr = (fl + smoothstep(0.62, 0.9, fr)) / steps;
      const cut = Math.abs(A.n3(x * R / 560 - 3.0, y * R / 560, z * R / 560 + 9.0));
      const cv = k === 'canyon' ? smoothstep(0.11, 0.02, cut) : 0;
      h = 30 + tr * (k === 'terraced' ? 110 : 190) * (1 - cv * 0.85) + C.n3(x * R / 30, y * R / 30, z * R / 30) * 1.4 + C.n3(x * R / 5, y * R / 5, z * R / 5) * 0.12;
      t = clamp(tr * (1 - cv), 0, 1); dry = 0.6; wet = 0.1;
    } else if (k === 'wetland') {
      this._base(c);
      const m = A.fbm(x * R / 95 + 3.0, y * R / 95, z * R / 95 - 6.0, 3, 2.1, 0.5);
      h = c.L * 0.1 + 1.1 + m * 1.9 + C.n3(x * R / 6, y * R / 6, z * R / 6) * 0.07;
      lq = c.L * 0.1 + 1.0;
      t = clamp(0.5 + m * 0.8, 0, 1); dry = 0.15; wet = 0.6;
    } else if (k === 'dunes') {
      const f = R / 240;
      const rd = A.ridged(x * f + y * f * 0.6, y * f, z * f + 3.0, 2, 2.0, 0.5);
      h = 20 + rd * 26 + A.n3(x * R / 900, y * R / 900, z * R / 900) * 30 + C.n3(x * R / 8, y * R / 8, z * R / 8) * 0.12;
      t = rd; dry = 0.35; wet = 0.25;
    } else if (k === 'ridged') {
      const f = R / 900;
      const rd = A.ridged(x * f - 6.0, y * f + 1.0, z * f, 4, 2.1, 0.5);
      h = 20 + rd * 260 + C.n3(x * R / 25, y * R / 25, z * R / 25) * 1.0;
      t = rd; dry = 0.6; wet = 0.12;
    } else if (k === 'crater' || k === 'basin') {
      const f = R / 420;
      const cl = A.n3(x * f + 2.0, y * f + 8.0, z * f - 1.0);
      const rim = smoothstep(0.18, 0.02, Math.abs(Math.abs(cl) - 0.32));
      const bowl = smoothstep(0.30, 0.0, Math.abs(cl));
      h = 30 + rim * (k === 'crater' ? 26 : 9) - bowl * (k === 'crater' ? 30 : 12) + A.n3(x * R / 1300, y * R / 1300, z * R / 1300) * 40 + C.n3(x * R / 14, y * R / 14, z * R / 14) * 0.4;
      t = clamp(0.5 + rim * 0.5 - bowl * 0.5, 0, 1); dry = 0.55; wet = 0.12;
    } else if (k === 'islands') {
      const f = R / 520;
      const n = A.fbm(x * f + 5.0, y * f - 7.0, z * f + 2.0, 3, 2.0, 0.5);
      const isl = smoothstep(-0.05, 0.25, n);
      h = -60 + isl * 150 + n * 40 + C.n3(x * R / 18, y * R / 18, z * R / 18) * 0.6;
      t = isl; dry = 0.3; wet = 0.35;
    } else if (k === 'flat') {
      h = 18 + A.n3(x * R / 700, y * R / 700 + 3.0, z * R / 700) * 9 + C.n3(x * R / 40, y * R / 40, z * R / 40) * 0.6 + C.n3(x * R / 6, y * R / 6, z * R / 6) * 0.06;
      t = clamp(0.5 + A.n3(x * R / 180, y * R / 180, z * R / 180) * 0.9, 0, 1); dry = 0.3; wet = 0.3;
    } else { // rolling
      h = 30 + A.fbm(x * R / 600 + 1.0, y * R / 600, z * R / 600 - 4.0, 4, 2.0, 0.5) * 70 + C.n3(x * R / 12, y * R / 12, z * R / 12) * 0.3;
      t = clamp(0.5 + A.n3(x * R / 150, y * R / 150, z * R / 150) * 0.9, 0, 1); dry = 0.35; wet = 0.22;
    }
    b.h = h; b.lq = lq;
    if (!full) return;
    const v = C.n3(x * R / 33 + 12.0, y * R / 33, z * R / 33 - 5.0) * 0.25;
    const tt = clamp(t + v, 0, 1);
    if (tt < 0.5) { set3(b, pal.low); mix3(b, pal.mid, tt * 2); }
    else { set3(b, pal.mid); mix3(b, pal.high, tt * 2 - 1); }
    if (k === 'alpine' && h > 250) mix3(b, [0.97, 0.98, 1.0], smoothstep(250, 300, h + v * 60));
    if (lq !== NOLQ && h < lq + 0.6) mix3(b, pal.low, 0.5);
    b.r2 = b.r; b.g2 = b.g; b.b2 = b.b;
    b.dry = dry; b.wet = wet; b.canopy = 0; b.trees = 0; b.birch = 0; b.under = 0; b.rock = k === 'alpine' ? t : 0; b.s = 1e9; b.glade = 1; b.aux = 0;
  }

  // ---- the surface --------------------------------------------------------------------------
  sample(x, y, z, o, full) {
    const w = o.w, nb = this.nB;
    const top = this.biomeWeights(x, y, z, w);
    o.top = top;
    const c = this._ctx; c.x = x; c.y = y; c.z = z; c.baseReady = false;
    const b = this._b;
    let h = 0;
    // liquid groups: 0 stream network (forests), 1 sea, 2 wetland pools
    let g0w = 0, g0l = 0, g1w = 0, g1l = 0, g2w = 0, g2l = 0;
    if (full) { o.r = o.g = o.b = 0; o.r2 = o.g2 = o.b2 = 0; o.dry = o.wet = o.canopy = o.aux = 0; o.trees = o.birch = o.under = o.rock = 0; o.glade = 0; o.s = 1e9; }
    for (let i = 0; i < nb; i++) {
      const wi = w[i];
      if (wi < 0.0015) continue;
      const bi = this.biomes[i];
      const lg = this.lqGroup[i];
      if (lg === 0) this._forest(c, b, bi, this.pal[i], full);
      else this._generic(c, b, bi, this.pal[i], full);
      h += wi * b.h;
      if (b.lq !== NOLQ) {
        if (lg === 0) { g0w += wi; g0l += wi * b.lq; }
        else if (lg === 1) { g1w += wi; g1l += wi * b.lq; }
        else { g2w += wi; g2l += wi * b.lq; }
      }
      if (full) {
        o.r += wi * b.r; o.g += wi * b.g; o.b += wi * b.b;
        o.r2 += wi * b.r2; o.g2 += wi * b.g2; o.b2 += wi * b.b2;
        o.dry += wi * b.dry; o.wet += wi * b.wet; o.canopy += wi * b.canopy; o.aux += wi * b.aux;
        o.rock += wi * b.rock; o.glade += wi * b.glade;
        if (i === top) { o.trees = b.trees * smoothstep(0.5, 0.8, wi); o.birch = b.birch; o.under = b.under * smoothstep(0.5, 0.8, wi); o.s = b.s; }
      }
    }
    // Liquid keeps its true level and exists only well inside its own biome group. Toward the
    // edge of the group the ground is lifted into a low berm above the liquid, so water never
    // ends in a wall and never tilts.
    let lq = NOLQ;
    if (g0w > 0) {
      const lv = g0l / g0w, k = smoothstep(0.55, 0.78, g0w);
      if (k < 1) { const t = lv + 1.2, d = h - t; h += (1 - k) * (0.5 * (h + t + Math.sqrt(d * d + 0.36)) - h); }
      if (g0w >= 0.55) lq = lv;
    }
    if (g1w > 0) {
      const lv = g1l / g1w, k = smoothstep(0.55, 0.78, g1w);
      if (k < 1) { const t = lv + 1.2, d = h - t; h += (1 - k) * (0.5 * (h + t + Math.sqrt(d * d + 0.36)) - h); }
      if (g1w >= 0.55 && lv > lq) lq = lv;
    }
    if (g2w > 0) {
      const lv = g2l / g2w, k = smoothstep(0.55, 0.78, g2w);
      if (k < 1) { const t = lv + 1.2, d = h - t; h += (1 - k) * (0.5 * (h + t + Math.sqrt(d * d + 0.36)) - h); }
      if (g2w >= 0.55 && lv > lq) lq = lv;
    }
    o.h = h;
    o.lq = lq;
    if (full && this.clearings.length) {
      for (const cl of this.clearings) {
        const dx = x - cl.x, dy = y - cl.y, dz = z - cl.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) * this.R;
        if (d < cl.r * 1.6) {
          const k = smoothstep(cl.r * 0.75, cl.r * 1.5, d);
          o.trees *= k; o.canopy *= 0.25 + 0.75 * k; o.glade = Math.max(o.glade, 1 - k);
        }
      }
    }
    return o;
  }

  heightAt(x, y, z) {
    const o = this._ho || (this._ho = makeSample(this.nB));
    this.sample(x, y, z, o, false);
    return o.h;
  }

  // A good first landing spot: earth -> a clearing by the stream in the first forest site.
  getSpawn() {
    if (this._spawn) return this._spawn;
    const s0 = this.sites[0];
    let best = null, bestCost = 1e9;
    const o = makeSample(this.nB);
    // tangent frame at the site
    let ux = -s0.z, uy = 0, uz = s0.x; let l = Math.hypot(ux, uy, uz) || 1; ux /= l; uy /= l; uz /= l;
    const vx = s0.y * uz - s0.z * uy, vy = s0.z * ux - s0.x * uz, vz = s0.x * uy - s0.y * ux;
    const isForest = this.biomes[s0.b].terrain === 'forest';
    const step = 6 / this.R, N = 46;
    for (let j = -N; j <= N; j++) {
      for (let i = -N; i <= N; i++) {
        let x = s0.x + (ux * i + vx * j) * step, y = s0.y + (uy * i + vy * j) * step, z = s0.z + (uz * i + vz * j) * step;
        l = 1 / Math.hypot(x, y, z); x *= l; y *= l; z *= l;
        this.sample(x, y, z, o, true);
        if (o.w[s0.b] < 0.97) continue;
        let cost;
        if (isForest) {
          if (o.rock > 0.05) continue;
          cost = Math.abs(o.s - 13) * 0.5 + (1 - o.glade) * 6 + Math.hypot(i, j) * 0.02;
        } else {
          if (o.lq !== NOLQ && o.lq > o.h - 1) continue;
          cost = Math.hypot(i, j) * 0.05;
        }
        // flatness: compare with neighbours 5 m away
        const e = 5 / this.R;
        const h1 = this.heightAt(x + ux * e, y + uy * e, z + uz * e), h2 = this.heightAt(x + vx * e, y + vy * e, z + vz * e);
        const h3 = this.heightAt(x - ux * e, y - uy * e, z - uz * e), h4 = this.heightAt(x - vx * e, y - vy * e, z - vz * e);
        cost += (Math.abs(h1 - h3) + Math.abs(h2 - h4)) * 1.2;
        if (cost < bestCost) { bestCost = cost; best = [x, y, z]; }
      }
    }
    if (!best) best = [s0.x, s0.y, s0.z];
    this._spawn = { x: best[0], y: best[1], z: best[2] };
    if (isForest) this.clearings.push({ x: best[0], y: best[1], z: best[2], r: 11 });
    return this._spawn;
  }
}

const cache = new Map();
export function getSurface(bodyId) {
  let s = cache.get(bodyId);
  if (!s) {
    s = new Surface(bodyId);
    cache.set(bodyId, s);
    s.getSpawn();   // fixes the spawn clearing before anything samples flora
  }
  return s;
}

// The public contract shape (see docs/COORDINATOR.md C1, C2).
const _o = new Map();
export function sampleSurfacePure(bodyId, dx, dy, dz) {
  const S = getSurface(bodyId);
  let o = _o.get(bodyId);
  if (!o) { o = makeSample(S.nB); _o.set(bodyId, o); }
  const il = 1 / Math.hypot(dx, dy, dz);
  const x = dx * il, y = dy * il, z = dz * il;
  S.sample(x, y, z, o, false);
  const R = S.R, h = o.h, lq = o.lq;
  const weights = {};
  for (let i = 0; i < S.nB; i++) if (o.w[i] > 0.0005) weights[S.biomes[i].id] = o.w[i];
  const biomeId = S.biomes[o.top].id;
  // normal by central differences on two tangents, 0.4 m apart
  let ux, uy, uz;
  if (Math.abs(y) < 0.9) { ux = -z; uy = 0; uz = x; } else { ux = 0; uy = z; uz = -y; }
  let l = 1 / Math.hypot(ux, uy, uz); ux *= l; uy *= l; uz *= l;
  const vx = y * uz - z * uy, vy = z * ux - x * uz, vz = x * uy - y * ux;
  const e = 0.4, eR = e / R;
  const hu1 = S.heightAt(x + ux * eR, y + uy * eR, z + uz * eR), hu0 = S.heightAt(x - ux * eR, y - uy * eR, z - uz * eR);
  const hv1 = S.heightAt(x + vx * eR, y + vy * eR, z + vz * eR), hv0 = S.heightAt(x - vx * eR, y - vy * eR, z - vz * eR);
  const gu = (hu1 - hu0) / (2 * e), gv = (hv1 - hv0) / (2 * e);
  let nx = x - ux * gu - vx * gv, ny = y - uy * gu - vy * gv, nz = z - uz * gu - vz * gv;
  l = 1 / Math.hypot(nx, ny, nz); nx *= l; ny *= l; nz *= l;
  const cosS = clamp(nx * x + ny * y + nz * z, -1, 1);
  const radius = R + h;
  const liquidRadius = (lq !== NOLQ && lq > h) ? R + lq : 0;
  return {
    radius, normal: { x: nx, y: ny, z: nz }, biomeId, biomeWeights: weights,
    isLiquid: liquidRadius > radius, slope: Math.acos(cosS), liquidRadius,
  };
}

export function getVistasPure(bodyId) {
  const S = getSurface(bodyId);
  const out = [];
  const seen = {};
  for (let i = 0; i < S.sites.length && out.length < 8; i++) {
    const s = S.sites[i], bi = S.biomes[s.b];
    seen[bi.id] = (seen[bi.id] || 0) + 1;
    if (seen[bi.id] > 2) continue;
    out.push({ id: bodyId + '-' + bi.id + '-' + seen[bi.id], name: bi.name + (seen[bi.id] > 1 ? ' II' : ''), unitDir: { x: s.x, y: s.y, z: s.z } });
  }
  return out;
}
