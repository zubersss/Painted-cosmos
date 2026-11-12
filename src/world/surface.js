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
import { makeNoise, hashString, hash3i, smoothstep, clamp } from './noise.js';
import { dirToFace } from './cubesphere.js';
import { EASELS, STANDS } from '../art/easels.js';

const _cf = {};

const NOT = {};
const SNOW = [0.97, 0.98, 1.0];
const CHAR = [0.16, 0.14, 0.19];     // cooled lava: indigo and sepia, the darkest wash of a lava plain
const EMBER = [0.98, 0.55, 0.24];    // the glow of lava on its banks: cadmium orange run thin

export const NOLQ = -1e9;
const D2R = Math.PI / 180;

export function makeSample(nBiomes) {
  return {
    h: 0, lq: NOLQ, top: 0, w: new Float32Array(nBiomes || 8),
    r: 1, g: 1, b: 1,            // ground wash (transmittance over paper)
    r2: 1, g2: 1, b2: 1,         // what this ground reads as from far away (canopy, water)
    dry: 0, wet: 0, canopy: 0, aux: 0,
    qr: 0.6, qg: 0.74, qb: 0.8, qk: 0.85, qglow: 0, qcloud: 0,   // liquid look: colour, mirror, glow, cloud
    trees: 0, birch: 0, under: 0, rock: 0, s: 1e9, glade: 0, strata: 0, lip: 0,
  };
}

// scratch result of one biome recipe
function makeB() {
  return { h: 0, lq: NOLQ, r: 1, g: 1, b: 1, r2: 1, g2: 1, b2: 1, dry: 0.2, wet: 0.2, canopy: 0, aux: 0, trees: 0, birch: 0, under: 0, rock: 0, s: 1e9, glade: 0, strata: 0, lip: 0 };
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
    // liquid groups: 0 stream network, 1 sea (water or cloud), 2 pools, 3 flowing lava and the like
    this.lqGroup = this.biomes.map((b) => (b.terrain === 'forest' ? 0 : (b.terrain === 'coast' || b.terrain === 'islands') ? 1
      : (b.terrain === 'wetland' || b.terrain === 'sinkholes' || (b.t && (b.t.pools || b.t.ponds))) ? 2 : (b.terrain === 'riverbed' && b.t && b.t.wet) ? 3 : -1));
    const leafy = { broadleaf: 1, conifer: 1, fungus: 1, kelp: 1 };
    const tallKits = (look.flora && look.flora.tall) || [];
    this.shade = this.biomes.map((b) => (b.tall && tallKits[b.tall[0]] && leafy[tallKits[b.tall[0]].kit] ? 1 : 0));
    this.liq = this.biomes.map((b) => Object.assign({ color: [0.62, 0.74, 0.80], refl: 0.85, glow: 0, cloud: 0 }, b.liquid || {}));
    this._gw = new Float64Array(4); this._gl = new Float64Array(4);
    this.hasFlora = this.biomes.some((b) => (b.tall && b.tall.length) || b.hang);
    this.hangs = this.biomes.some((b) => b.hang);
    this.smallSum = this.biomes.map((b) => (b.small ? Object.values(b.small).reduce((x, y) => x + y, 0) : 0));
    this.tallH = this.biomes.map((b) => (b.tall ? 1.45 * Math.max(...b.tall.map((i) => (tallKits[i] && tallKits[i].obs ? tallKits[i].obs[1] : 10))) : 0));
    this._buildSites();
    this._prepPalettes();
    this.clearings = [];   // [{x,y,z, r}] flora-free glades (spawn)
    this.pads = [];        // [{x,y,z, r, r2, h}] levelled places (a first landing chosen by eye)
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
      const dl = bi.t && bi.t.dil != null ? bi.t.dil : 0.36;
      const p = { low: dilute(g[0], dl + 0.02), mid: dilute(g[1], dl - 0.02), high: dilute(g[2], dl), P };
      if (bi.terrain === 'forest') {
        if (bi.autumn) {
          p.grassLight = dilute(mixc(pig('quinGold'), pig('oliveGreen'), 0.35), 0.5);
          p.grassMid = dilute(mixc(pig('oliveGreen'), pig('quinGold'), 0.3), 0.3);
          p.moss = dilute(mixc(pig('oliveGreen'), pig('rawUmber'), 0.4), 0.25);
          p.litter = dilute(mixc(pig('cadOrange'), pig('burntSienna'), 0.5), 0.35);
        } else {
          p.grassLight = dilute(mixc(pig('sapGreen'), pig('quinGold'), 0.36), 0.42);
          p.grassMid = dilute(mixc(pig('sapGreen'), pig('quinGold'), 0.10), 0.22);
          p.moss = dilute(mixc(pig('hookersGreen'), pig('sapGreen'), 0.45), 0.26);
          p.litter = dilute(mixc(pig('burntSienna'), pig('rawUmber'), 0.45), 0.40);
        }
        p.mud = dilute(mixc(pig('rawUmber'), pig('sapGreen'), 0.25), 0.40);
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
    const L = c.L;
    let s = c.s;
    if (s < 26) {
      const fb1 = R / 8.5, fb2 = R / 2.7;
      const wob = nC(x * fb1 + 14.0, y * fb1 - 3.0, z * fb1 + 6.0) * 1.25 + nC(x * fb2 - 7.0, y * fb2 + 11.0, z * fb2) * 0.5;
      s = Math.max(0, s + wob * smoothstep(0.4, 3.0, s) * (1 - smoothstep(14, 26, s)));
    }
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
    const glade = smoothstep(0.24, 0.62, nA(x * fg + 61.0, y * fg + 3.0, z * fg - 17.0));
    const pz = smoothstep(-0.12, 0.34, nA(x * fp - 23.0, y * fp + 41.0, z * fp + 9.0) + (b.h - L) * 0.018 - 0.1) * smoothstep(7, 30, s);
    const v1 = nC(x * fv - 3.0, y * fv, z * fv + 21.0);
    set3(b, pal.grassMid);
    mix3(b, pal.grassLight, clamp(glade * 0.8 + v1 * 0.4 + 0.1, 0, 1));
    mix3(b, pal.litter, clamp(pz * (1 - glade * 0.85) * (0.72 + v1 * 0.3), 0, 1));
    mix3(b, pal.moss, smoothstep(15, 4.5, s) * 0.55 * (1 - glade * 0.5));
    mix3(b, pal.mud, smoothstep(w0 + 1.0, w0 + 0.1, s) * 0.8);
    mix3(b, pal.bed, smoothstep(w0 + 0.35, w0 - 0.5, s));
    mix3(b, pal.rock, rk * 0.92);
    const bedm = smoothstep(w0 + 0.6, w0 - 0.3, s);
    b.dry = clamp(0.34 + 0.5 * rk + 0.3 * glade - bedm * 0.4, 0, 1);
    b.wet = clamp(0.18 + 0.5 * bedm, 0, 1);
    const open = smoothstep(w0 + 0.6, w0 + 3.6, s);
    b.trees = clamp((1 - 0.82 * glade) * (1 - rk) * open, 0, 1);
    b.canopy = clamp(b.trees * 1.05 + (1 - open) * 0.35, 0, 1);
    b.birch = clamp(0.74 - pz * 0.72 + 0.3 * (1 - smoothstep(6, 18, s)), 0.06, 1);
    b.under = clamp((0.45 + 0.55 * glade) * (1 - rk * 0.7) * smoothstep(w0 + 0.1, w0 + 1.2, s), 0, 1);
    b.rock = rk; b.s = s; b.glade = glade; b.aux = 0; b.strata = 0; b.lip = 0;
    // far colour: the canopy seen from outside (pines cooler and darker), streams as pale lines
    const cz = clamp(b.trees * 1.15, 0, 1);
    const ca = pal.canopyA, cb = pal.canopyB, k = clamp(pz * 1.1, 0, 1), dv = 1 + v1 * 0.25;
    b.r2 = b.r + ((ca[0] + (cb[0] - ca[0]) * k) * dv - b.r) * cz;
    b.g2 = b.g + ((ca[1] + (cb[1] - ca[1]) * k) * dv - b.g) * cz;
    b.b2 = b.b + ((ca[2] + (cb[2] - ca[2]) * k) * dv - b.b) * cz;
    const wl = smoothstep(w0 + 1.2, w0 - 0.6, s);
    b.r2 += (0.80 - b.r2) * wl; b.g2 += (0.87 - b.g2) * wl; b.b2 += (0.93 - b.b2) * wl;
  }

  // Impact craters, scattered on a grid of cells laid over each face of the cube-sphere (one
  // crater a cell, most cells; anywhere in its cell, so nothing lines up). Returns a height
  // offset: a bowl with a flat floor and a steep inner wall, a raised rim, a gentle apron.
  _craters(x, y, z, cell, depth, rimH, keep) {
    dirToFace(x, y, z, _cf);
    const n = Math.max(2, Math.round(this.R * 1.5708 / cell));
    const fu = (_cf.u + 1) * 0.5 * n, fv = (_cf.v + 1) * 0.5 * n;
    const bx = Math.floor(fu - 0.5), by = Math.floor(fv - 0.5);     // the 2 x 2 cells whose craters can reach this point
    const sd = (this.seed ^ Math.imul(cell | 0, 7919)) | 0, f = _cf.face;
    const kp = keep == null ? 0.72 : keep;
    let out = 0, wob = 2;
    this._rim = 0;                                                   // how nearly this point sits on a rim crest (read by the caller)
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      const ix = bx + i, iy = by + j;
      if (ix < 0 || iy < 0 || ix >= n || iy >= n) continue;
      const h4 = hash3i(ix, iy, f, sd);
      if (h4 > kp) continue;
      const rr = 0.12 + 0.17 * (h4 / kp), reach = rr * 1.75;
      let cx = ix + hash3i(ix, iy, f + 7, sd), cy = iy + hash3i(ix, iy, f + 13, sd);
      cx = cx < reach ? reach : cx > n - reach ? n - reach : cx;     // whole craters only: none cut by the edge of a face
      cy = cy < reach ? reach : cy > n - reach ? n - reach : cy;
      const dx = fu - cx, dy = fv - cy;
      let d = Math.sqrt(dx * dx + dy * dy) / rr;
      if (d > 1.75) continue;
      if (wob === 2) wob = this.nC.n3(x * this.R / (cell * 0.16) + 3.0, y * this.R / (cell * 0.16), z * this.R / (cell * 0.16) - 5.0) * 0.09;
      d *= 1 + wob;                                                  // a lumpy outline, never a circle
      const bowl = d < 1 ? -(1 - Math.pow(d, 2.6)) : 0;
      // (the crest is rounded on both sides: a rim one can stand on)
      const rim = d < 1 ? Math.exp(-(1 - d) * (1 - d) / 0.012) : Math.exp(-Math.pow((d - 1) * 3.0, 1.6)) * (1 - smoothstep(1.45, 1.75, d));
      out += (bowl * depth + rim * rimH) * (rr / 0.29);
      if (rr > 0.2 && d > 0.9 && d < 1.12 && rim > this._rim) this._rim = rim;
    }
    return out;
  }

  // Small tables of rock standing alone (sea stacks, islets of a sky-archipelago): one per
  // cell of a 3D grid. Returns 0..1: a flat top with a cliff all round, scaled per stack.
  _stacks(X, Y, Z, cell, keep) {
    const px = X / cell, py = Y / cell, pz = Z / cell;
    const ix = Math.floor(px), iy = Math.floor(py), iz = Math.floor(pz), sd = this.seed | 0;
    const h4 = hash3i(ix, iy, iz, sd ^ 911);
    if (h4 > keep) return 0;
    const cx = ix + 0.28 + 0.44 * hash3i(ix, iy, iz, sd ^ 5), cy = iy + 0.28 + 0.44 * hash3i(ix, iy, iz, sd ^ 71), cz = iz + 0.28 + 0.44 * hash3i(ix, iy, iz, sd ^ 173);
    const rr = 0.10 + 0.16 * hash3i(ix, iy, iz, sd ^ 37);
    const dx = px - cx, dy = py - cy, dz = pz - cz;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) / rr;
    if (d > 1.25) return 0;
    // a lumpy outline, never a circle
    const wob = this.nC.n3(X / (cell * 0.11) + 3.0, Y / (cell * 0.11), Z / (cell * 0.11) - 5.0) * 0.16;
    return (1 - smoothstep(0.72, 0.96, d + wob)) * (0.45 + 0.55 * (h4 / keep));
  }

  // The coast's open reach (looks `t.open: { a, b, r: [r0, r1], depth }`): the distance (m) from the point to the
  // great circle segment a-b (its nearest point projected back onto the sphere), and the sea floor pressed down to
  // about `depth` m within r0 of it, eased back to the land's own height by r1. Where the land was already deeper
  // nothing changes. The floor is not level (a broad swell of the bed), so the reach shoals and deepens as a sea does.
  _open(x, y, z, hh, o) {
    const a = o.a, b = o.b, R = this.R;
    const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2], bb = bx * bx + by * by + bz * bz;
    let t = ((x - a[0]) * bx + (y - a[1]) * by + (z - a[2]) * bz) / (bb || 1); t = t < 0 ? 0 : t > 1 ? 1 : t;
    let qx = a[0] + bx * t, qy = a[1] + by * t, qz = a[2] + bz * t; const ql = 1 / Math.hypot(qx, qy, qz); qx *= ql; qy *= ql; qz *= ql;
    const d = Math.sqrt(Math.max(0, 2 - 2 * (x * qx + y * qy + z * qz))) * R;
    if (d >= o.r[1]) return hh;
    const m = 1 - smoothstep(o.r[0], o.r[1], d);
    const fl = -o.depth * (1 + 0.22 * this.nA.n3(x * R / 420 + 3.0, y * R / 420 - 8.0, z * R / 420 + 1.0));
    return hh > fl ? hh + (fl - hh) * m : hh;
  }

  _generic(c, b, bi, pal, full, bidx) {
    const R = this.R, x = c.x, y = c.y, z = c.z, A = this.nA, C = this.nC;
    const X = x * R, Y = y * R, Z = z * R;
    const T = bi.t || NOT, k = bi.terrain;
    let h = 0, t = 0.5, dry = 0.4, wet = 0.2, lq = NOLQ, grow = 1, bed = 0;
    let shade = 0, snow = 0, veil = 0, lip = 0, meadow = 1, ember = 0, char = 0, crk = 0;
    if (k === 'alpine') {
      // meadows fill the valley floors; the peaks stand up sharply behind them
      const wl = T.wl || 1000, amp = T.amp || 480;
      const rd = A.ridged(X / wl + 4.0, Y / wl, Z / wl - 2.0, 4, 2.1, 0.5);
      const up = smoothstep(0.14, 0.60, rd);
      const pk = 0.42 + 0.58 * smoothstep(-0.35, 0.45, A.n3(X / (wl * 1.6) + 9.0, Y / (wl * 1.6), Z / (wl * 1.6) + 3.0));
      const crag = A.ridged(X / (wl * 0.19) + 2.0, Y / (wl * 0.19) - 6.0, Z / (wl * 0.19), 2, 2.0, 0.5);
      const m = A.n3(X / 260, Y / 260 + 7.0, Z / 260);
      const rise = Math.pow(up, 1.7) * (0.30 + 0.70 * rd) * pk;
      h = 42 + m * 7 * (1 - up) + rise * amp + (crag - 0.4) * amp * 0.10 * up + C.n3(X / 22, Y / 22, Z / 22) * 0.7 * (0.4 + up) + C.n3(X / 5, Y / 5, Z / 5) * 0.08;
      // (PAINTER 12: on the flanks, above the meadow floors, rock teeth and drifts of 2 to 4 m along the small ridges,
      // so a near slope's crest is broken against the sky: under fresh snow it stood as one ruled diagonal)
      const flank = smoothstep(0.25, 0.50, up);
      if (flank > 0) { const tooth = A.ridged(X / 13 + 5.0, Y / 13 - 3.0, Z / 13 + 1.0, 2, 2.1, 0.5); h += flank * Math.max(0, tooth - 0.60) * 8.0; }
      t = clamp(up * 0.55 + rise * 0.6, 0, 1); dry = 0.3 + 0.5 * t; wet = 0.15;
      grow = (1 - smoothstep(95, 170, h)) * smoothstep(0.05, 0.3, up);
      meadow = 1 - smoothstep(0.25, 0.6, up);
      const sl = T.snow || 190;
      snow = smoothstep(sl, sl + 60, h + (crag - 0.5) * 90 + C.n3(X / 60, Y / 60, Z / 60) * 30);
      shade = up * (1 - snow) * 0.18;
    } else if (k === 'coast') {
      const f = R / 780;
      const n = A.fbm(x * f - 9.0, y * f + 2.0, z * f + 14.0, 4, 2.0, 0.5);
      let hh = n * 70 - 9;
      // (`t.open`: open water laid over the coast, a reach of sea along a line from a to b (unit directions) r[0] m
      // either side, its floor `depth` m down, shoaling to the land over r[0]..r[1]: a storm coast that faces kilometres
      // of open sea toward the storm wind, the surf raised over real fetch, COORDINATOR ruling 2026-11-12)
      if (T.open) hh = this._open(x, y, z, hh, T.open);
      const cl = T.cliff || 44;
      let face = 0;
      if (hh > 0.9) {
        // (the cliff in profile, PAINTER 12: a skirt of talus, the face, a ledge across it in places, and a rounded
        // shoulder; a narrow headland's top falls toward its tip. It was one step 3.3 m of the land's rise wide: a wall
        // a few metres across in plan with a level lip, so a headland ended in a ruled vertical edge, and seen from
        // afar the terrain's cells combed the face into even vertical stripes)
        const q = hh + C.n3(x * R / 60, y * R / 60 + 5.0, z * R / 60) * 2.5 + C.n3(X / 17, Y / 17, Z / 17 - 4.0) * 0.6;
        const tq = clamp((q - 0.9) / 4.6, 0, 1);
        const ledge = smoothstep(-0.1, 0.35, C.n3(X / 70 + 9.0, Y / 70, Z / 70 - 2.0));
        const tal = smoothstep(0.0, 0.22, tq), f1 = smoothstep(0.14, 0.48, tq), f2 = smoothstep(0.48 + 0.08 * ledge, 0.84, tq), sh = smoothstep(0.76, 1.0, tq);
        const cu = tal * 0.09 + f1 * (0.42 + 0.04 * ledge) + f2 * (0.41 - 0.04 * ledge) + sh * 0.08;
        face = clamp(Math.max(f1 * (1 - f1), f2 * (1 - f2)) * 4 + tal * (1 - tal) * 1.2, 0, 1);
        const top = 0.78 + 0.22 * smoothstep(3.0, 12.0, hh);
        hh += cu * cl * top + C.n3(x * R / 40, y * R / 40, z * R / 40) * 3.0 * smoothstep(6, 20, hh);
      } else if (hh > -30 && hh < -1.5) {
        // stacks: stumps of the old cliff left standing in the shallows
        const st = this._stacks(X, Y, Z, T.stackCell || 95, T.stacks == null ? 0.45 : T.stacks);
        if (st > 0) { const near = smoothstep(-30, -16, hh) * (1 - smoothstep(-6, -1.5, hh)); hh += st * near * (cl * 0.9 - hh); face = Math.max(face, st * (1 - st) * 4 * near); }
      }
      h = hh + C.n3(x * R / 9, y * R / 9 + 2.0, z * R / 9) * 0.25 + (C.n3(x * R / 37 + 4.0, y * R / 37, z * R / 37) * 2.6 + C.n3(x * R / 11 - 2.0, y * R / 11, z * R / 11 + 6.0) * 0.9 + C.n3(x * R / 3.7 + 8.0, y * R / 3.7, z * R / 3.7) * 0.4) * (1 - smoothstep(3, 16, Math.abs(hh)));
      t = clamp((h + 2) / 34, 0, 1); dry = 0.25 + 0.5 * t; wet = h < 1 ? 0.6 : 0.2;
      lq = this.sea == null ? 0 : this.sea;
      grow = bi.tallWet ? (1 - smoothstep(-14, -3, h)) * smoothstep(-34, -20, h) * 1.0 + smoothstep(-3, 0, h) * 0 : smoothstep(cl * 0.7, cl * 0.9, h);
      meadow = smoothstep(cl * 0.5, cl * 0.8, h);
      bed = 1 - smoothstep(-0.5, 2.5, h);
      shade = face * 0.12;
    } else if (k === 'canyon') {
      // a plateau cut by a wandering network of gorges: flat dry floor, walls in steps, benches
      const wl = T.wl || 620, amp = T.amp || 190;
      const wa = C.n3(X / 190 + 3.0, Y / 190, Z / 190) * 0.20, wb = C.n3(X / 190, Y / 190 + 9.0, Z / 190 - 4.0) * 0.20;
      const cut = Math.abs(A.n3(X / wl - 3.0 + wa, Y / wl + wb, Z / wl + 9.0 - wa));
      const fw = (T.floor || 0.05) * (1 + 0.5 * A.n3(X / 330 + 7.0, Y / 330, Z / 330));
      const rag = C.n3(X / 47, Y / 47 + 2.0, Z / 47) * 0.05 + C.n3(X / 13, Y / 13, Z / 13 + 5.0) * 0.012;
      const tw = clamp((cut - fw) / (T.wall || 0.19) + rag, 0, 1.3);
      const ns = T.steps || 3;
      const q = Math.min(tw, 0.9999) * ns, fl = Math.floor(q), fr = q - fl;
      const riser = smoothstep(0.10, 0.50, fr) * 0.88 + smoothstep(0.42, 0.80, fr) * 0.12;
      const prof = (fl + riser) / ns;
      const D = amp * (0.78 + 0.22 * A.n3(X / 900 + 1.0, Y / 900, Z / 900));
      const top = smoothstep(1.0, 1.25, tw);
      const pn = A.fbm(X / 420 + 11.0, Y / 420, Z / 420 - 6.0, 3, 2.0, 0.5);
      const bu = smoothstep(0.30, 0.335, pn + rag * 0.4) * top;        // a butte left standing on the plateau
      h = 24 + D * prof + (pn * 9 + bu * D * 0.30) * top + C.n3(X / 30, Y / 30, Z / 30) * 1.2 * (0.25 + 0.75 * prof) + C.n3(X / 5, Y / 5, Z / 5) * 0.10;
      const face = Math.max(riser * (1 - riser), bu * (1 - bu)) * 4;
      t = clamp(0.08 + smoothstep(0.0, 0.25, tw) * 0.42 + prof * 0.22 + top * 0.2 + bu * 0.1, 0, 1); dry = 0.6; wet = 0.1;
      grow = 1 - clamp(face * 1.6, 0, 1);
      shade = face * 0.14;
      bed = (1 - smoothstep(0.0, 0.12, tw)) * 0.8;
      meadow = 1 - clamp(face * 2, 0, 1);
    } else if (k === 'mesa') {
      // flat-topped tables with cliffs all round and a skirt of talus, standing on a plain
      const wl = T.wl || 520, amp = T.amp || 300;
      const n = A.fbm(X / wl + 21.0, Y / wl - 5.0, Z / wl, 3, 2.0, 0.5);
      const rag = C.n3(X / 52, Y / 52, Z / 52 + 3.0) * 0.035 + C.n3(X / 15, Y / 15 + 7.0, Z / 15) * 0.010;
      const thr = T.thr == null ? 0.06 : T.thr;
      const m1 = smoothstep(thr, thr + 0.035, n + rag) * 0.88 + smoothstep(thr + 0.025, thr + 0.11, n + rag) * 0.12;
      const m2 = smoothstep(thr + 0.20, thr + 0.23, n + rag * 0.8);
      const apron = smoothstep(thr - 0.16, thr, n + rag);
      h = 26 + apron * apron * amp * 0.10 + m1 * amp * 0.62 + m2 * amp * 0.28
        + A.n3(X / 900, Y / 900 + 4.0, Z / 900) * 14 + C.n3(X / 34, Y / 34, Z / 34) * 1.3 * (0.4 + m1) + C.n3(X / 6, Y / 6, Z / 6) * 0.10;
      const face = Math.max(m1 * (1 - m1), m2 * (1 - m2)) * 4;
      t = clamp(0.12 + apron * 0.2 + m1 * 0.4 + m2 * 0.28, 0, 1); dry = 0.6; wet = 0.1;
      grow = 1 - clamp(face * 1.6, 0, 1);
      shade = face * 0.10;
      meadow = 1 - clamp(face * 2, 0, 1);
    } else if (k === 'terraced') {
      // broad level treads, each ending in a cliff down to the next
      const wl = T.wl || 820, amp = T.amp || 110, steps = T.steps || 7;
      const n = A.fbm(X / wl + 21.0, Y / wl - 5.0, Z / wl, 3, 2.0, 0.5) * 0.5 + 0.5;
      const rag = (C.n3(X / 44, Y / 44 + 1.0, Z / 44) * 0.11 + C.n3(X / 12, Y / 12, Z / 12 - 3.0) * 0.03) * (T.rag == null ? 1 : T.rag);
      const q = clamp(n, 0, 0.9999) * steps + rag, fl = Math.floor(q), fr = q - fl;
      const r0 = T.riser ? T.riser[0] : 0.76, r1 = T.riser ? T.riser[1] : 0.92;
      const riser = smoothstep(r0, r1, fr) * 0.90 + smoothstep(r1 - 0.02, Math.min(0.995, r1 + 0.06), fr) * 0.10;
      h = 30 + (fl + riser) / steps * amp + C.n3(X / 30, Y / 30, Z / 30) * 1.0 + C.n3(X / 5, Y / 5, Z / 5) * 0.10;
      const face = riser * (1 - riser) * 4;
      t = clamp((fl + riser) / steps * 0.85 + face * 0.15, 0, 1); dry = 0.6; wet = 0.1;
      grow = 1 - clamp(face * 1.8 + smoothstep(r0 - 0.04, r0, fr) * (1 - riser), 0, 1);
      meadow = 1 - clamp(face * 2, 0, 1);
      shade = face * 0.12 + (T.under || 0) * smoothstep(0.55, 0.80, riser) * (1 - smoothstep(0.93, 1.0, riser));   // a dark recess under the lip
      lip = smoothstep(r1 - 0.035, r1 - 0.01, fr) * (1 - smoothstep(r1 + 0.01, r1 + 0.03, fr));
      if (T.pools) {
        // a pool on every tread, held behind a raised rim at the tread's outer edge
        const lev = fl + (fr >= r1 ? 1 : 0);
        const rim = smoothstep(r1 - 0.06, r1, fr) * (1 - smoothstep(r1 + 0.02, r1 + 0.08, fr));
        const pool = smoothstep(-0.20, 0.10, C.n3(X / 58 + 3.0, Y / 58 - 7.0, Z / 58)) * (fr >= r1 ? smoothstep(r1 + 0.05, r1 + 0.10, fr) : 1 - smoothstep(r0 - 0.03, r0 + 0.02, fr));
        h += rim * 0.9 - pool * 1.9;
        lq = 30 + (lev / steps) * amp + 0.30;
        bed = pool; wet = 0.2 + 0.4 * pool;
        grow *= 1 - pool;
      }
    } else if (k === 'wall') {
      // one great escarpment: lowland, a skirt of talus, the wall in two lifts, the upland
      const wl = T.wl || 1500, amp = T.amp || 520;
      const n = A.fbm(X / wl - 6.0, Y / wl + 1.0, Z / wl, 3, 2.0, 0.5);
      const fold = A.ridged(X / 85 + 2.0, Y / 85, Z / 85 - 7.0, 2, 2.0, 0.5) * 0.05 + C.n3(X / 30, Y / 30, Z / 30) * 0.012;
      const e = n + fold - (T.thr || 0);
      const w1 = smoothstep(0.0, 0.07, e), w2 = smoothstep(0.19, 0.24, e), apron = smoothstep(-0.15, 0.0, e);
      h = 30 + apron * apron * amp * 0.09 + w1 * amp * 0.64 + w2 * amp * 0.20
        + A.n3(X / 700, Y / 700 + 3.0, Z / 700) * 12 + C.n3(X / 30, Y / 30, Z / 30) * 1.4 * (0.4 + w1) + C.n3(X / 5, Y / 5, Z / 5) * 0.10;
      const face = Math.max(w1 * (1 - w1), w2 * (1 - w2)) * 4;
      t = clamp(0.08 + apron * 0.22 + face * 0.30 + w1 * 0.25 + w2 * 0.25, 0, 1); dry = 0.6; wet = 0.12;
      grow = (1 - clamp(face * 1.8, 0, 1)) * (1 - w1 * 0.6);
      meadow = 1 - clamp(face * 2, 0, 1);
      shade = face * 0.10;
    } else if (k === 'spires') {
      // wind-carved fins: rows of narrow blades standing along the wind, notched into spires
      const wl = T.wl || 46, amp = T.amp || 12;
      const ax = T.axis || [0.62, 0.30, -0.72];
      const warp = A.n3(X / 170 + 2.0, Y / 170, Z / 170) * 0.9 + C.n3(X / 40, Y / 40, Z / 40) * 0.12;
      const u = (X * ax[0] + Y * ax[1] + Z * ax[2]) / wl + warp;
      const cu = Math.abs(u - Math.floor(u) - 0.5) * 2;
      const env = smoothstep(-0.20, 0.30, A.n3(X / 150 + 7.0, Y / 150, Z / 150 - 3.0));
      const fin = Math.pow(Math.max(0, 1 - cu / (T.fin || 0.55)), 1.6);
      const sp = 0.5 + 0.5 * C.n3(X / 17 + 1.0, Y / 17, Z / 17);
      const hgt = fin * env * (0.30 + 0.70 * sp * sp * 1.6);
      h = 22 + A.n3(X / 800, Y / 800, Z / 800 + 5.0) * 16 + amp * Math.min(1.15, hgt) + C.n3(X / 9, Y / 9, Z / 9) * 0.25;
      t = clamp(0.15 + hgt * 0.8, 0, 1); dry = 0.5; wet = 0.15;
      grow = 0.25 + 0.75 * smoothstep(0.05, 0.45, hgt);      // the spires stand along the scoured ridges
      meadow = 1 - smoothstep(0.1, 0.4, hgt);
      shade = smoothstep(0.1, 0.5, hgt) * 0.22;
    } else if (k === 'wetland') {
      this._base(c);
      const m = A.fbm(x * R / 46 + 3.0, y * R / 46, z * R / 46 - 6.0, 3, 2.1, 0.5);
      h = c.L * 0.1 + 1.1 + m * 1.9 + C.n3(x * R / 6, y * R / 6, z * R / 6) * 0.07;
      lq = c.L * 0.1 + 1.0;
      t = clamp(0.5 + m * 0.8, 0, 1); dry = 0.15; wet = 0.6;
      bed = 1 - smoothstep(lq - 0.2, lq + 0.5, h);
    } else if (k === 'dunes') {
      // transverse dunes: long sinuous crests across the wind, each a long back and a short
      // steep slip face; smaller dunes ride the big ones
      const wl = T.wl || 150, amp = T.amp || 13;
      const ax = T.axis || [0.36, 0.48, 0.80];
      const warp = A.n3(X / (wl * 2.6) + 4.0, Y / (wl * 2.6), Z / (wl * 2.6) - 1.0) * 0.55 + C.n3(X / (wl * 0.7), Y / (wl * 0.7) + 2.0, Z / (wl * 0.7)) * 0.10;
      const u = (X * ax[0] + Y * ax[1] + Z * ax[2]) / wl + warp;
      const sp = T.slip || 0.26;
      // one dune across its wavelength: 0 at the toe, 1 at the crest; lee = on the slip face
      let fu = u - Math.floor(u), p, lee = 0;
      if (fu < 1 - sp) { const s1 = fu / (1 - sp); p = s1 * s1 * (3 - 2 * s1) * 0.4 + s1 * 0.6; }
      else { const s2 = (fu - (1 - sp)) / sp; p = Math.pow(1 - s2, 1.6); lee = smoothstep(0.0, 0.05, s2) * (1 - smoothstep(0.7, 1.0, s2)); }
      // the dunes that ride it: a third of the size, the same wind
      const um = u * 2.9 + C.n3(X / (wl * 0.9) + 6.0, Y / (wl * 0.9), Z / (wl * 0.9)) * 0.9 + C.n3(X / (wl * 0.22), Y / (wl * 0.22) + 3.0, Z / (wl * 0.22)) * 0.16;
      let fm = um - Math.floor(um), pm, leem = 0;
      if (fm < 1 - sp) { const s1 = fm / (1 - sp); pm = s1 * s1 * (3 - 2 * s1) * 0.4 + s1 * 0.6; }
      else { const s2 = (fm - (1 - sp)) / sp; pm = Math.pow(1 - s2, 1.6); leem = smoothstep(0.0, 0.07, s2) * (1 - smoothstep(0.65, 1.0, s2)); }
      const am = 0.35 + 0.65 * smoothstep(-0.45, 0.35, A.n3(X / (wl * 3.1) + 9.0, Y / (wl * 3.1), Z / (wl * 3.1) + 2.0));
      const am2 = smoothstep(-0.25, 0.35, C.n3(X / (wl * 0.8) + 2.0, Y / (wl * 0.8) + 5.0, Z / (wl * 0.8)) + 0.25);
      const swell = A.n3(X / 700, Y / 700, Z / 700);
      const km = (T.ride == null ? 0.42 : T.ride) * am2 * (1 - lee) * (1 - smoothstep(0.45, 0.85, p));   // on the long backs only: the crest stays one clean line
      h = 24 + swell * (T.swell || 30) + amp * am * (0.75 + 0.5 * swell) * p + amp * km * pm + C.n3(X / 8, Y / 8, Z / 8) * 0.10;
      t = clamp(0.2 + 0.5 * p * am + 0.3 * pm * am2, 0, 1); dry = 0.16; wet = 0.25;
      shade = Math.max(lee * (0.35 + 0.65 * am), leem * am2 * 0.8) * (T.lee == null ? 0.5 : T.lee);
      lip = am > 0.75 && fu > 1 - sp - 0.035 && fu < 1 - sp + 0.004 ? 1 : 0;      // on the crest of a full-grown dune
      meadow = 1 - Math.max(lee, leem);
    } else if (k === 'ridged') {
      const wl = T.wl || 900, amp = T.amp || 260, f = R / wl;
      const rd = A.ridged(x * f - 6.0, y * f + 1.0, z * f, 4, 2.1, 0.5);
      // buttresses and gullies break the big faces
      h = 20 + rd * amp + A.ridged(x * f * 5.3 + 2.0, y * f * 5.3, z * f * 5.3 - 7.0, 2, 2.0, 0.5) * amp * 0.13 + C.n3(x * R / 25, y * R / 25, z * R / 25) * 1.6;
      t = rd; dry = 0.6; wet = 0.12;
      grow = 1 - smoothstep(0.35, 0.6, rd);
      meadow = grow;
    } else if (k === 'crater' || k === 'basin') {
      const big = this._craters(x, y, z, k === 'crater' ? (T.cell || 400) : 520, k === 'crater' ? 58 : 12, k === 'crater' ? 20 : 6, k === 'crater' ? 0.9 : 0.72);
      lip = this._rim;                                               // the rim of a large crater: where the easel goes
      const sml = this._craters(x, y, z, k === 'crater' ? 150 : 190, k === 'crater' ? 13 : 5, k === 'crater' ? 4.5 : 2.5);
      const tiny = this._craters(x, y, z, 47, k === 'crater' ? 3.4 : 1.6, k === 'crater' ? 1.3 : 0.7, 0.5);
      const cr = big + sml + tiny;
      h = 44 + cr + A.n3(x * R / 1300, y * R / 1300, z * R / 1300) * 26 + C.n3(x * R / 14, y * R / 14, z * R / 14) * 0.4;
      t = clamp(0.55 + cr * 0.035, 0, 1); dry = 0.55; wet = 0.12;
      grow = cr < -2 ? 0.2 : 1;
      // frost gathers where the sun never reaches: the floors of the bowls
      if (T.frost) snow = T.frost * (0.10 + 0.90 * smoothstep(-1.5, -12, cr)) * (0.7 + 0.3 * C.n3(X / 40, Y / 40, Z / 40));
      shade = smoothstep(1.0, 6.0, cr) * 0.25 + smoothstep(-3, -20, cr) * (T.frost ? 0 : 0.2);
    } else if (k === 'islands') {
      // tables of land standing in a sea (of water or of cloud): cliffs all round, a garden on top
      const wl = T.wl || 520, amp = T.amp || 150, cl = T.cliff || 80;
      const n = A.fbm(X / wl + 5.0, Y / wl - 7.0, Z / wl + 2.0, 3, 2.0, 0.5);
      const rag = C.n3(X / 55 - 6.0, Y / 55, Z / 55 + 2.0) * 0.03 + C.n3(X / 14, Y / 14 + 3.0, Z / 14) * 0.008;
      // (the last of the height is gained over a wider band: a rounded shoulder, not a knife edge)
      const isl = smoothstep(0.0, 0.05, n + rag) * 0.93 + smoothstep(0.035, 0.11, n + rag) * 0.07;
      let land = isl, tall = 1;
      if (isl < 1 && n > -0.42) { const st = this._stacks(X, Y, Z, T.stackCell || 170, T.stacks == null ? 0.6 : T.stacks); if (st > land) { land = Math.min(1, st * 2.2); tall = Math.max(isl, st * 0.9 + 0.1); } }
      const dome = Math.max(0, n) * amp * 0.5 * isl;
      h = -40 + land * (40 + cl * tall) + dome + C.n3(X / 18, Y / 18, Z / 18) * 0.6 * land + (C.n3(X / 37 + 4.0, Y / 37, Z / 37) * 3.2 + C.n3(X / 9 - 2.0, Y / 9, Z / 9 + 6.0) * 1.1) * land * (1 - land) * 4 + C.n3(X / 4, Y / 4 + 8.0, Z / 4) * 0.12;
      const face = land * (1 - land) * 4;
      t = clamp(0.25 + land * 0.35 + dome / amp, 0, 1); dry = 0.3; wet = 0.35;
      lq = this.sea == null ? 0 : this.sea;
      grow = smoothstep(cl * 0.75, cl * 0.95, h);
      meadow = grow;
      bed = 1 - smoothstep(-1, 4, h);
      shade = face * 0.10;
      // where the rock goes down into the cloud it is lost in it: the islands seem to float
      if (T.veil) veil = (1 - smoothstep(3, T.veil, h - lq + C.n3(X / 31, Y / 31 + 2.0, Z / 31) * T.veil * 0.35)) * smoothstep(-3, 2, h - lq);
    } else if (k === 'riverbed') {
      this._base(c);
      // (`flow`: the bed swells and narrows along its course: pools of lava between narrows)
      const s = c.s, amp = T.amp || 26, dp = T.bedD || 1.6;
      const w0 = (T.bedW || (T.wet ? 9 : 6.5)) * (T.flow ? 0.7 + T.flow * smoothstep(-0.3, 0.5, A.n3(x * R / 210 + 4.4, y * R / 210 - 2.2, z * R / 210 + 9.1)) : 1);
      const hb = s < w0 ? -1.2 - dp * (1 - (s / w0) * (s / w0)) : -1.2 + (dp * 0.6 + 1.0) * smoothstep(w0, w0 + 4 + dp * 1.5, s);
      const rise = smoothstep(w0 + 2, 110, s);
      const hill = Math.max(0, 0.5 + 0.55 * A.n3(x * R / 380 + 7.7, y * R / 380 + 1.1, z * R / 380 - 3.3));
      h = c.L + hb + hill * amp * rise + A.n3(x * R / 90, y * R / 90, z * R / 90) * 3 * rise + C.n3(x * R / 11, y * R / 11, z * R / 11) * 0.35 + C.n3(x * R / 3.1, y * R / 3.1, z * R / 3.1) * 0.06;
      const lqD = T.lqD == null ? 1.9 : T.lqD;      // how far below the plain the liquid stands (a lava river runs brim-full)
      if (T.wet) lq = c.L - lqD;
      bed = 1 - smoothstep(w0 - 0.5, w0 + 2.5, s);
      t = clamp(0.25 + rise * 0.8 - bed * 0.4, 0, 1); dry = 0.5; wet = 0.15;
      // things grow along the banks, where the water once ran
      grow = smoothstep(w0 + 0.5, w0 + 4, s) * (1 - smoothstep(22, 60, s) * 0.85);
      shade = smoothstep(w0 - 0.5, w0 + 1.5, s) * (1 - smoothstep(w0 + 1.5, w0 + 4 + dp, s)) * 0.3 * (T.wet ? 0 : 1);
      // the light of what flows: a warm glaze on the banks that dies away in a few strides, and
      // beside it the cooled levee, the darkest ground of the plain
      if (T.ember) { const se = w0 * Math.sqrt(Math.max(0, 1 - (lqD - 1.2) / dp)); ember = T.ember * (1 - smoothstep(se - 1, se + (T.emberR || 16), s)); char = smoothstep(se - 2, se + 1, s) * (1 - smoothstep(se + 6, se + 44, s)); crk = -char * smoothstep(-0.25, 0.35, C.n3(X / 23 + 7.0, Y / 23, Z / 23 - 3.0)); }
    } else if (k === 'sinkholes') {
      const amp = T.amp || 40;
      const cl = A.n3(x * R / 190 + 9.0, y * R / 190 - 4.0, z * R / 190 + 2.0);
      const pit = smoothstep(0.30, 0.52, cl);
      h = 26 + A.n3(x * R / 600, y * R / 600, z * R / 600 + 5.0) * 8 - pit * amp + C.n3(x * R / 16, y * R / 16, z * R / 16) * 0.5;
      lq = 26 - amp * 0.62;
      t = clamp(1 - pit, 0, 1); dry = 0.4; wet = 0.2 + 0.4 * pit;
      grow = 1 - smoothstep(0.02, 0.2, pit);
      bed = smoothstep(0.55, 0.9, pit);
      shade = pit * (1 - pit) * 4 * 0.25;
    } else if (k === 'flat') {
      const amp = T.amp || 9;
      h = 18 + A.n3(x * R / 700, y * R / 700 + 3.0, z * R / 700) * amp + C.n3(x * R / 40, y * R / 40, z * R / 40) * 0.6 + C.n3(x * R / 6, y * R / 6, z * R / 6) * 0.06 + (T.pits ? this._craters(x, y, z, 130, 7 * T.pits, 3 * T.pits) : 0);
      t = clamp(0.5 + A.n3(x * R / 180, y * R / 180, z * R / 180) * 0.9, 0, 1); dry = 0.3; wet = 0.3;
      if (T.ponds) {
        // meltwater ponds: round, shallow, scattered in groups
        const pd = smoothstep(0.34, 0.42, C.n3(X / 38 + 5.0, Y / 38, Z / 38 - 2.0) * 0.6 + A.n3(X / 210, Y / 210 + 4.0, Z / 210) * 0.5);
        h -= pd * 1.3;
        lq = 18 + A.n3(x * R / 700, y * R / 700 + 3.0, z * R / 700) * amp - 0.75;
        bed = pd; wet = 0.3 + 0.3 * pd;
      }
    } else { // rolling
      const wl = T.wl || 600, amp = T.amp || 70;
      h = 30 + A.fbm(x * R / wl + 1.0, y * R / wl, z * R / wl - 4.0, 4, 2.0, 0.5) * amp + C.n3(x * R / 12, y * R / 12, z * R / 12) * 0.3;
      t = clamp(0.5 + A.n3(x * R / 150, y * R / 150, z * R / 150) * 0.9, 0, 1); dry = 0.35; wet = 0.22;
    }
    b.h = h; b.lq = lq;
    if (!full) return;
    const v = C.n3(x * R / 33 + 12.0, y * R / 33, z * R / 33 - 5.0) * 0.25;
    let tt = clamp(t + v, 0, 1);
    if (tt < 0.5) { set3(b, pal.low); mix3(b, pal.mid, tt * 2); }
    else { set3(b, pal.mid); mix3(b, pal.high, tt * 2 - 1); }
    // a second and third wash laid in patches over the first (looks.js `t.patch`: lichen on
    // basalt, moss on an island's top, frost drifts on ice): the ground's own handwriting,
    // near (a few metres) and middle (tens of metres), before form and frost are laid in
    if (T.patch) {
      for (let q = 0; q < T.patch.length; q++) {
        const pt = T.patch[q], w = pt.wl, o = 3.7 + q * 11.3;
        const n = C.n3(X / w + o, Y / w - o, Z / w + 2.0 * o) + 0.45 * C.n3(X / (w * 0.29) - o, Y / (w * 0.29), Z / (w * 0.29) + o);
        // (on a table of land the patches are what grows on its top: the cliffs keep their rock)
        const kp = smoothstep(pt.thr, pt.thr + pt.soft, n) * pt.amt * (k === 'islands' ? grow : 1);
        if (kp > 0) mix3(b, pt.c, kp);
      }
    }
    // form laid in with a second, denser wash (cliff faces, slip faces, cut banks)
    if (shade > 0) { const kd = shade * 0.9, kg = Math.min(1, shade * 1.7); b.r -= (b.r - b.r * b.r) * kd; b.g -= (b.g - b.g * b.g) * kd; b.b -= (b.b - b.b * b.b) * kd * 0.6; b.r *= 1 - 0.26 * kg; b.g *= 1 - 0.28 * kg; b.b *= 1 - 0.08 * kg; }
    if (snow > 0) mix3(b, SNOW, clamp(snow, 0, 0.94));
    if (T.frost && k !== 'crater' && k !== 'basin') mix3(b, SNOW, clamp(T.frost * (0.45 + v * 1.6 + 0.3 * tt), 0, 0.92));
    if (bed > 0) { mix3(b, pal.low, bed * 0.6); if (T.bedPale) { const kb = bed * T.bedPale; b.r += (0.97 - b.r) * kb; b.g += (0.95 - b.g) * kb; b.b += (0.93 - b.b) * kb; } }
    if (char > 0) { const kc = char * (0.5 + v * 1.6) * (T.char == null ? 0.55 : T.char); mix3(b, CHAR, clamp(kc, 0, 0.85)); }
    if (ember > 0) { const ke = clamp(ember * (0.8 + v * 0.8), 0, 0.9); mix3(b, EMBER, ke * 0.62); }
    if (T.dusk) { const d = T.dusk; b.r *= 1 - 0.30 * d; b.g *= 1 - 0.30 * d; b.b *= 1 - 0.12 * d; }
    // fog lying in the low ground: the wash thins toward paper below its level
    if (T.fog) { const fk = (1 - smoothstep(T.fog[0] - T.fog[1], T.fog[0] + T.fog[1], h + v * T.fog[1] * 2.5)) * 0.82; b.r += (0.99 - b.r) * fk; b.g += (0.975 - b.g) * fk; b.b += (0.93 - b.b) * fk; wet = wet + (1 - wet) * fk; }
    if (veil > 0) { b.r += (1 - b.r) * veil; b.g += (1 - b.g) * veil; b.b += (1 - b.b) * veil; wet = wet + (1 - wet) * veil; }
    b.r2 = b.r; b.g2 = b.g; b.b2 = b.b;
    if (lq !== NOLQ && h < lq) { const L = this.liq[bidx].color; b.r2 = L[0]; b.g2 = L[1]; b.b2 = L[2]; }
    b.dry = T.gloss ? 0.95 : dry; b.wet = wet;
    const dens = (bi.tallD || 0) * grow;
    b.trees = dens; b.birch = bi.tallMix == null ? 0.5 : bi.tallMix;
    b.canopy = dens * 0.8 * this.shade[bidx];
    b.under = bi.small ? (lq !== NOLQ && h < lq ? 0 : meadow) : 0;
    b.rock = k === 'alpine' ? t : 0; b.s = c.baseReady ? c.s : 1e9; b.glade = 1; b.aux = crk || T.crack || 0;
    b.strata = T.strata || 0; b.lip = lip;
  }

  // ---- the surface --------------------------------------------------------------------------
  sample(x, y, z, o, full) {
    const w = o.w, nb = this.nB;
    const top = this.biomeWeights(x, y, z, w);
    o.top = top;
    const c = this._ctx; c.x = x; c.y = y; c.z = z; c.baseReady = false;
    const b = this._b;
    let h = 0;
    const gw = this._gw, gl = this._gl;
    gw[0] = gw[1] = gw[2] = gw[3] = 0; gl[0] = gl[1] = gl[2] = gl[3] = 0;
    let qw = 0, qr = 0, qg = 0, qb = 0, qk = 0, qglow = 0, qcloud = 0;
    if (full) { o.r = o.g = o.b = 0; o.r2 = o.g2 = o.b2 = 0; o.dry = o.wet = o.canopy = o.aux = 0; o.trees = o.birch = o.under = o.rock = 0; o.glade = 0; o.s = 1e9; o.strata = 0; o.lip = 0; }
    for (let i = 0; i < nb; i++) {
      const wi = w[i];
      if (wi < 0.0015) continue;
      const bi = this.biomes[i];
      const lg = this.lqGroup[i];
      if (bi.terrain === 'forest') this._forest(c, b, bi, this.pal[i], full);
      else this._generic(c, b, bi, this.pal[i], full, i);
      h += wi * b.h;
      if (b.lq !== NOLQ && lg >= 0) {
        gw[lg] += wi; gl[lg] += wi * b.lq;
        if (full) { const L = this.liq[i]; qw += wi; qr += wi * L.color[0]; qg += wi * L.color[1]; qb += wi * L.color[2]; qk += wi * L.refl; qglow += wi * L.glow; qcloud += wi * L.cloud; }
      }
      if (full) {
        o.r += wi * b.r; o.g += wi * b.g; o.b += wi * b.b;
        o.r2 += wi * b.r2; o.g2 += wi * b.g2; o.b2 += wi * b.b2;
        o.dry += wi * b.dry; o.wet += wi * b.wet; o.canopy += wi * b.canopy; o.aux += wi * b.aux;
        o.rock += wi * b.rock; o.glade += wi * b.glade; o.strata += wi * b.strata;
        if (i === top) { o.trees = b.trees * smoothstep(0.5, 0.8, wi); o.birch = b.birch; o.under = b.under * smoothstep(0.5, 0.8, wi); o.s = b.s; o.lip = b.lip * smoothstep(0.5, 0.8, wi); }
      }
    }
    if (full && qw > 0) { o.qr = qr / qw; o.qg = qg / qw; o.qb = qb / qw; o.qk = qk / qw; o.qglow = qglow / qw; o.qcloud = qcloud / qw; }
    // Liquid keeps its true level and exists only well inside its own biome group. Toward the
    // edge of the group the ground is lifted into a low berm above the liquid, so it never
    // ends in a wall and never tilts.
    let lq = NOLQ;
    for (let g = 0; g < 4; g++) {
      if (gw[g] <= 0) continue;
      const lv = gl[g] / gw[g], k = smoothstep(0.55, 0.78, gw[g]);
      if (k < 1) { const t = lv + 1.2, d = h - t; h += (1 - k) * (0.5 * (h + t + Math.sqrt(d * d + 0.36)) - h); }
      if (gw[g] >= 0.55 && lv > lq) lq = lv;
    }
    // a first landing chosen by eye stands on a levelled place: the ground within its radius is drawn to the
    // spot's own height and eased back into the land round it (room for the ship wherever the view is best)
    if (this.pads.length) {
      for (const pd of this.pads) {
        const dx = x - pd.x, dy = y - pd.y, dz = z - pd.z;
        const d2 = (dx * dx + dy * dy + dz * dz) * this.R * this.R;
        if (d2 < pd.r2) { const k = 1 - smoothstep(pd.r, pd.r * 1.7, Math.sqrt(d2)); h += (pd.h - h) * k; }
      }
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

  // The nearest dry, gentle ground of the same biome to a site (a vista must be a place a
  // walker can stand): rings outward to 240 m; the site itself if nothing better is found.
  standNear(site) {
    const o = this._so || (this._so = makeSample(this.nB)), R = this.R;
    let ux = -site.z, uy = 0, uz = site.x; let l = Math.hypot(ux, uy, uz) || 1; ux /= l; uz /= l;
    const vx = site.y * uz - site.z * uy, vy = site.z * ux - site.x * uz, vz = site.x * uy - site.y * ux;
    for (let r = 0; r <= 240; r += 12) {
      const na = r === 0 ? 1 : Math.round(r / 6);
      for (let a = 0; a < na; a++) {
        const an = a / na * Math.PI * 2 + r * 0.31, e = r / R;
        let x = site.x + (ux * Math.cos(an) + vx * Math.sin(an)) * e, y = site.y + (uy * Math.cos(an) + vy * Math.sin(an)) * e, z = site.z + (uz * Math.cos(an) + vz * Math.sin(an)) * e;
        l = 1 / Math.hypot(x, y, z); x *= l; y *= l; z *= l;
        this.sample(x, y, z, o, false);
        if (o.top !== site.b || o.w[site.b] < 0.85 || (o.lq !== NOLQ && o.lq > o.h - 0.4)) continue;
        const h0 = o.h, d = 4 / R;
        let rough = 0;
        for (let t = 0; t < 4 && rough < 1; t++) { const c = Math.cos(t * Math.PI / 2), sn = Math.sin(t * Math.PI / 2); rough = Math.max(rough, Math.abs(this.heightAt(x + (ux * c + vx * sn) * d, y + (uy * c + vy * sn) * d, z + (uz * c + vz * sn) * d) - h0)); }
        if (rough < 1.0) return [x, y, z];
      }
    }
    return [site.x, site.y, site.z];
  }

  heightAt(x, y, z) {
    const o = this._ho || (this._ho = makeSample(this.nB));
    this.sample(x, y, z, o, false);
    return o.h;
  }

  // A good first landing spot: earth -> a clearing by the stream in the first forest site,
  // where the brook is narrow and the wood stands close around.
  getSpawn() {
    if (this._spawn) return this._spawn;
    const s0 = this.sites[0];
    const o = makeSample(this.nB);
    // A first landing chosen by eye (looks.js `spawn`: [x, y, z, yaw, pitch in degrees]): the spot and the way to
    // face where the world's idea stands in the first view (a lava river with towers on its banks, the rim of a
    // sky island under the ring arc). Kept only while it still stands on dry, level ground with room for the ship.
    const fx = this.look.spawn;
    if (fx) {
      const k = 1 / Math.hypot(fx[0], fx[1], fx[2]), x = fx[0] * k, y = fx[1] * k, z = fx[2] * k;
      let ax = -z, ay = 0, az = x; const al = Math.hypot(ax, ay, az) || 1; ax /= al; az /= al;
      const bx = y * az - z * ay, by = z * ax - x * az, bz = x * ay - y * ax;
      this.sample(x, y, z, o, true);
      const h0 = o.h, top = o.top;
      let ok = !(o.lq !== NOLQ && o.lq > o.h - 0.5), drift = 0;
      for (let a = 0; a < 8 && ok; a++) {
        const ca = Math.cos(a * Math.PI / 4), sa = Math.sin(a * Math.PI / 4);
        for (const r of [6.5, 13]) {
          const e = r / this.R;
          this.sample(x + (ax * ca + bx * sa) * e, y + (ay * ca + by * sa) * e, z + (az * ca + bz * sa) * e, o, false);
          if (o.lq !== NOLQ && o.lq > o.h - 0.3) { ok = false; break; }
          drift = Math.max(drift, Math.abs(o.h - h0));
        }
      }
      // (the place is levelled, but only a place that is nearly level already: no shelf is cut into a hillside)
      if (ok && drift < 4.5) {
        this._spawn = { x, y, z, yaw: fx[3] * D2R, pitch: (fx[4] || 0) * D2R };
        this.pads.push({ x, y, z, r: 14, r2: (14 * 1.7) * (14 * 1.7), h: h0 });
        // (and a berth for the ship, 16 m off on a compass bearing, where PILOT looks for the flattest ground
        // beside the arrival: dead level, so the ship stands in the first view and not behind the easel)
        if (fx[6] != null) {
          let ex = z, ez = -x; const el = Math.hypot(ex, ez) || 1; ex /= el; ez /= el;                   // east
          const nx = y * ez, ny = z * ex - x * ez, nz = -y * ex;                                         // north = d x east
          const cb = Math.cos(fx[6] * D2R) * 16 / this.R, sb = Math.sin(fx[6] * D2R) * 16 / this.R;
          let qx = x + nx * cb + ex * sb, qy = y + ny * cb, qz = z + nz * cb + ez * sb; const ql = 1 / Math.hypot(qx, qy, qz);
          this.pads.push({ x: qx * ql, y: qy * ql, z: qz * ql, r: 5, r2: (5 * 1.7) * (5 * 1.7), h: h0 });
        }
        if (this.biomes[top].tall) this.clearings.push({ x, y, z, r: fx[5] || 15 });
        return this._spawn;
      }
    }
    // tangent frame at the site
    let ux = -s0.z, uy = 0, uz = s0.x; let l = Math.hypot(ux, uy, uz) || 1; ux /= l; uy /= l; uz /= l;
    const vx = s0.y * uz - s0.z * uy, vy = s0.z * ux - s0.x * uz, vz = s0.x * uy - s0.y * ux;
    const isForest = this.biomes[s0.b].terrain === 'forest';
    const step = 6 / this.R, N = 46;
    const at = (i, j, out) => {
      let x = s0.x + (ux * i + vx * j) * step, y = s0.y + (uy * i + vy * j) * step, z = s0.z + (uz * i + vz * j) * step;
      const k = 1 / Math.hypot(x, y, z); out[0] = x * k; out[1] = y * k; out[2] = z * k; return out;
    };
    const p = [0, 0, 0], q = [0, 0, 0];
    const cands = [];
    for (let j = -N; j <= N; j++) {
      for (let i = -N; i <= N; i++) {
        at(i, j, p);
        this.sample(p[0], p[1], p[2], o, true);
        if (o.w[s0.b] < 0.97) continue;
        let cost;
        if (isForest) {
          if (o.rock > 0.05) continue;
          cost = Math.abs(o.s - 12) * 0.5 + Math.abs(o.glade - 0.25) * 5 + Math.hypot(i, j) * 0.02;
        } else {
          if (o.lq !== NOLQ && o.lq > o.h - 1) continue;
          cost = Math.hypot(i, j) * 0.05;
          // room for the ship: level and dry all round, out to 13 m
          const h0 = o.h;
          let steep = 0, wetNear = false;
          for (let a = 0; a < 8 && !wetNear; a++) {
            const ca = Math.cos(a * Math.PI / 4), sa = Math.sin(a * Math.PI / 4);
            for (const r of [6.5, 13]) {
              const e = r / this.R, qx = p[0] + (ux * ca + vx * sa) * e, qy = p[1] + (uy * ca + vy * sa) * e, qz = p[2] + (uz * ca + vz * sa) * e;
              this.sample(qx, qy, qz, o, false);
              if (o.lq !== NOLQ && o.lq > o.h - 0.3) { wetNear = true; break; }
              steep = Math.max(steep, Math.abs(o.h - h0) / r);
            }
          }
          if (wetNear) continue;
          cost += steep * 60;
        }
        // flatness: compare with neighbours 5 m away
        const e = 5 / this.R, x = p[0], y = p[1], z = p[2];
        const h1 = this.heightAt(x + ux * e, y + uy * e, z + uz * e), h2 = this.heightAt(x + vx * e, y + vy * e, z + vz * e);
        const h3 = this.heightAt(x - ux * e, y - uy * e, z - uz * e), h4 = this.heightAt(x - vx * e, y - vy * e, z - vz * e);
        cost += (Math.abs(h1 - h3) + Math.abs(h2 - h4)) * 1.2;
        cands.push({ i, j, cost });
      }
    }
    cands.sort((a, b) => a.cost - b.cost);
    let best = null, bestCost = 1e9;
    if (isForest) {
      // refine the best candidates: measure how wide the water really is beside each one
      for (let c = 0; c < Math.min(60, cands.length); c++) {
        const cd = cands[c];
        let wmin = 1e9;
        for (let a = 0; a < 16; a++) {
          const ca = Math.cos(a * Math.PI / 8), sa = Math.sin(a * Math.PI / 8);
          let first = -1, last = -1;
          for (let r = 1; r <= 40; r += 1) {
            at(cd.i + ca * r / 6, cd.j + sa * r / 6, q);
            this.sample(q[0], q[1], q[2], o, false);
            const wet = o.lq !== NOLQ && o.lq > o.h;
            if (wet) { if (first < 0) first = r; last = r; } else if (first >= 0) break;
          }
          if (first >= 0 && last < 40) { const w = last - first + 1; if (w < wmin) wmin = w; }
        }
        if (wmin > 100) continue;
        const cost = cd.cost + Math.abs(wmin - 5) * 0.8;
        if (cost < bestCost) { bestCost = cost; best = at(cd.i, cd.j, [0, 0, 0]); }
      }
    }
    if (!best && cands.length) best = at(cands[0].i, cands[0].j, [0, 0, 0]);
    if (!best) best = [s0.x, s0.y, s0.z];
    this._spawn = { x: best[0], y: best[1], z: best[2] };
    if (isForest) this.clearings.push({ x: best[0], y: best[1], z: best[2], r: 11 });
    // (a stand of kelp or crystal is opened round the first landing too: the first view is not a wall a metre from the eye)
    else if (this.biomes[s0.b].tall) this.clearings.push({ x: best[0], y: best[1], z: best[2], r: 15 });
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
  S.sample(x, y, z, o, S.hasFlora);
  const R = S.R, h = o.h, lq = o.lq;
  // tallest thing likely to stand here (0 on open ground): tree tops, for flying over them
  const canopyHeight = S.hasFlora ? S.tallH[o.top] * smoothstep(0.03, 0.30, o.trees) : 0;
  const canopy01 = S.hasFlora ? clamp(o.canopy, 0, 1) : 0;   // closed-canopy fraction (0 in a glade)
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
    isLiquid: liquidRadius > radius, slope: Math.acos(cosS), liquidRadius, canopyHeight, canopy01,
  };
}

// The painter's spot for a biome: where its picture was painted from (src/art/easels.js), or
// its first site. -> { unitDir, yaw, pitch } (yaw from local north toward east, radians) | null
export function getEaselPure(bodyId, biomeId) {
  const S = getSurface(bodyId);
  const e = EASELS[bodyId] && EASELS[bodyId][biomeId];
  if (e) { const l = 1 / Math.hypot(e[0], e[1], e[2]); return { unitDir: { x: e[0] * l, y: e[1] * l, z: e[2] * l }, yaw: e[3] * D2R, pitch: e[4] * D2R }; }
  const bi = S.biomes.findIndex((b) => b.id === biomeId);
  const s0 = S.sites.find((x) => x.b === bi);
  return s0 ? { unitDir: { x: s0.x, y: s0.y, z: s0.z }, yaw: 0, pitch: 0 } : null;
}

// Where to arrive in a biome: its stand (a spot that shows the biome whichever way one
// faces), else its easel, else its first site. -> { unitDir, yaw, pitch } | null
export function getStandPure(bodyId, biomeId) {
  const e = STANDS[bodyId] && STANDS[bodyId][biomeId];
  if (e) { const l = 1 / Math.hypot(e[0], e[1], e[2]); return { unitDir: { x: e[0] * l, y: e[1] * l, z: e[2] * l }, yaw: e[3] * D2R, pitch: 0 }; }
  return getEaselPure(bodyId, biomeId);
}

// The marked views of a body: first each biome's easel (the view its picture was painted
// from; yaw and pitch say which way the painter faced), then second sites.
export function getVistasPure(bodyId) {
  const S = getSurface(bodyId);
  const out = [];
  const seen = {};
  for (const bi of S.biomes) {
    const e = EASELS[bodyId] && EASELS[bodyId][bi.id];
    if (!e || out.length >= 8) continue;
    const v = getEaselPure(bodyId, bi.id);
    seen[bi.id] = 1;
    out.push({ id: bodyId + '-' + bi.id + '-1', name: bi.name, unitDir: v.unitDir, yaw: v.yaw, pitch: v.pitch });
  }
  for (let i = 0; i < S.sites.length && out.length < 8; i++) {
    const s = S.sites[i], bi = S.biomes[s.b];
    seen[bi.id] = (seen[bi.id] || 0) + 1;
    if (seen[bi.id] > 2) continue;
    if (seen[bi.id] === 1 || !(EASELS[bodyId] && EASELS[bodyId][bi.id]) || i > 0) {
      // a site of a biome whose easel is already listed counts as its second view
      if (EASELS[bodyId] && EASELS[bodyId][bi.id] && S.sites.findIndex((x) => x.b === s.b) === i) { seen[bi.id]--; continue; }
      const st = S.standNear(s);
      out.push({ id: bodyId + '-' + bi.id + '-' + seen[bi.id], name: bi.name + (seen[bi.id] > 1 ? ' II' : ''), unitDir: { x: st[0], y: st[1], z: st[2] } });
    }
  }
  return out;
}
