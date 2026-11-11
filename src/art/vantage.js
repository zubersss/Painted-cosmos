// Painted Cosmos: where a painter would set the easel (pure JS, no three). OWNER: PAINTER.
//
// findVantage(bodyId, biomeId) looks around the biome's sites for a dry, gentle, open spot and a
// direction to face, by reading what would actually be in the frame: from each candidate spot it
// scans the ground outward along 36 bearings, keeps what is not hidden behind nearer ground, and
// scores each view for the things a landscape painter composes with (a skyline with shape,
// overlapping distance bands, water in the middle ground, a wall to look up at, a hollow to look
// down into). Each kind of terrain weighs those differently (WANT below).
// Used by the gallery's `cam=vista` and by the evidence frames; deterministic.
import { getSurface, makeSample, NOLQ } from '../world/surface.js';
import { sampleObstaclesPure } from '../world/obstacles.js';

const NAZ = 36, HALF = 4;             // bearings around the spot; the frame spans +-HALF of them
const VFOV = 0.48;                    // half the vertical field of view (55 degrees), radians
const RS = [];
for (let r = 5; r < 1700; r *= 1.17) RS.push(r);
const NR = RS.length;

// what each terrain recipe should show: weights of the frame terms
//   relief  skyline with shape      layers  overlapping ridges      liquid  share of liquid
//   beyond  land seen across liquid steep   steep faces in view     below   ground far below the eye
//   high    how high the skyline should stand (radians)             flora   tall things in the middle ground
const WANT = {
  default: { relief: 1.0, layers: 0.6, liquid: 0, beyond: 0, steep: 0.3, below: 0, high: 0.10, flora: 0.5 },
  forest: { relief: 0.4, layers: 0.3, liquid: 1.0, beyond: 0.6, steep: 0, below: 0, high: 0.08, flora: 1.0 },
  islands: { relief: 0.8, layers: 0.6, liquid: 1.6, beyond: 2.2, steep: 1.2, below: 0.5, high: 0.10, flora: 0.2 },
  coast: { relief: 0.8, layers: 0.5, liquid: 1.6, beyond: 1.2, steep: 1.6, below: 0.3, high: 0.12, flora: 0.2 },
  canyon: { relief: 1.6, layers: 0.8, liquid: 0, beyond: 0, steep: 2.0, below: 0.3, high: 0.26, flora: 0.1 },
  mesa: { relief: 2.0, layers: 1.0, liquid: 0, beyond: 0, steep: 1.2, below: 0.4, high: 0.14, flora: 0.1 },
  terraced: { relief: 1.0, layers: 1.6, liquid: 1.0, beyond: 0.6, steep: 1.4, below: 0.3, high: 0.20, flora: 0.4 },
  wall: { relief: 0.8, layers: 0.5, liquid: 0, beyond: 0, steep: 2.4, below: 0, high: 0.30, flora: 0.2 },
  ridged: { relief: 1.6, layers: 1.0, liquid: 0, beyond: 0, steep: 0.8, below: 0.2, high: 0.22, flora: 0.5 },
  alpine: { relief: 2.0, layers: 1.0, liquid: 0, beyond: 0, steep: 0.6, below: 0, high: 0.24, flora: 0.3 },
  dunes: { relief: 1.2, layers: 2.4, liquid: 0, beyond: 0, steep: 0.2, below: 0.3, high: 0.08, flora: 0 },
  crater: { relief: 0.8, layers: 0.8, liquid: 0, beyond: 0, steep: 0.6, below: 2.4, high: 0.06, flora: 0 },
  basin: { relief: 0.6, layers: 0.8, liquid: 0, beyond: 0, steep: 0.2, below: 1.0, high: 0.06, flora: 0 },
  sinkholes: { relief: 0.5, layers: 0.5, liquid: 2.0, beyond: 1.2, steep: 1.2, below: 1.6, high: 0.06, flora: 0 },
  riverbed: { relief: 0.6, layers: 0.5, liquid: 1.6, beyond: 1.0, steep: 0.2, below: 0.2, high: 0.10, flora: 0.8 },
  wetland: { relief: 0.2, layers: 0.2, liquid: 1.6, beyond: 1.2, steep: 0, below: 0, high: 0.05, flora: 0.6 },
  flat: { relief: 0.6, layers: 0.4, liquid: 0, beyond: 0, steep: 0.2, below: 0.2, high: 0.05, flora: 0.8 },
  rolling: { relief: 1.0, layers: 0.8, liquid: 0, beyond: 0, steep: 0.2, below: 0.2, high: 0.09, flora: 0.9 },
};

function frameAt(d) {
  let ex = d[2], ey = 0, ez = -d[0];            // east = Y x up
  let l = Math.hypot(ex, ey, ez);
  if (l < 1e-6) { ex = 1; ez = 0; l = 1; }
  ex /= l; ez /= l;
  // north = up x east
  return { e: [ex, 0, ez], n: [d[1] * ez - d[2] * 0, d[2] * ex - d[0] * ez, d[0] * 0 - d[1] * ex] };
}
function step(d, f, ang, r, R, out) {
  const a = r / R, ca = Math.cos(a), sa = Math.sin(a), se = Math.sin(ang), cn = Math.cos(ang);
  out[0] = d[0] * ca + (f.e[0] * se + f.n[0] * cn) * sa;
  out[1] = d[1] * ca + (f.e[1] * se + f.n[1] * cn) * sa;
  out[2] = d[2] * ca + (f.e[2] * se + f.n[2] * cn) * sa;
  return out;
}

// One spot: scan outward on every bearing. Fills flat arrays [bearing * NR + i].
function scan(S, d, eyeR, sc) {
  const R = S.R, f = frameAt(d), p = [0, 0, 0], o = sc.o;
  for (let a = 0; a < NAZ; a++) {
    const ang = a / NAZ * Math.PI * 2;
    let hmax = -9, prevTop = 0, prevR = 0;
    for (let i = 0; i < NR; i++) {
      const r = RS[i], k = a * NR + i;
      step(d, f, ang, r, R, p);
      S.sample(p[0], p[1], p[2], o, r > 8 && r < 260);
      const liq = o.lq !== NOLQ && o.lq > o.h;
      const top = R + (liq ? o.lq : o.h);
      const th = r / R;
      const el = Math.atan2(top * Math.cos(th) - eyeR, top * Math.sin(th));
      sc.el[k] = el; sc.liq[k] = liq ? 1 : 0;
      sc.vis[k] = el > hmax ? 1 : 0;
      sc.gap[k] = el > hmax ? el - Math.max(hmax, -1.2) : 0;     // the slice of the frame this sample fills
      sc.steep[k] = i > 0 ? Math.abs(top - prevTop) / (r - prevR) : 0;
      sc.trees[k] = (r > 8 && r < 260 && S.biomes[o.top].tall) ? o.trees : 0;
      sc.own[k] = o.w[sc.bi];
      if (el > hmax) hmax = el;
      prevTop = top; prevR = r;
    }
    sc.sky[a] = hmax;
  }
}

function scoreView(sc, a0, W) {
  // the frame covers the bearings a0 - HALF .. a0 + HALF
  let hi = -9, lo = 9, nvis = 0;
  for (let c = -HALF; c <= HALF; c++) {
    const a = (a0 + c + NAZ) % NAZ;
    if (sc.sky[a] > hi) hi = sc.sky[a];
    for (let i = 3; i < NR; i++) { const k = a * NR + i; if (sc.vis[k] && RS[i] > 14) { if (sc.el[k] < lo) lo = sc.el[k]; nvis++; } }
  }
  if (!nvis) return null;
  lo = Math.max(lo, hi - 0.80);
  // set the frame so the tallest thing stands a little under the top edge, and what lies below
  // the eye is still in it
  let pitch = Math.min(hi - 0.30, (hi + lo) * 0.5 + 0.03);
  pitch = Math.max(-0.30, Math.min(0.24, Math.max(pitch, hi - 0.40)));
  if (hi < 0.12 && lo > -0.2) pitch = Math.max(pitch, -0.05);
  const top = pitch + VFOV, bot = pitch - VFOV;
  let area = 0, liquid = 0, steep = 0, below = 0, flora = 0, own = 0, layers = 0, beyond = 0, skyA = 0, m1 = 0, m2 = 0, near = 0, hiWall = 0;
  for (let c = -HALF; c <= HALF; c++) {
    const a = (a0 + c + NAZ) % NAZ;
    let hmax = -9, lastVisR = 0, sawLiq = false, got = false;
    for (let i = 0; i < NR; i++) {
      const k = a * NR + i;
      if (!sc.vis[k]) continue;
      const e1 = Math.min(top, sc.el[k]), e0 = Math.max(bot, sc.el[k] - sc.gap[k]);
      const g = Math.max(0, e1 - e0);
      if (g > 0) {
        area += g; own += g * sc.own[k];
        if (sc.liq[k]) { liquid += g; sawLiq = true; }
        else if (sawLiq && !got) { beyond++; got = true; }
        if (sc.steep[k] > 0.7 && !sc.liq[k]) steep += g * Math.min(1, sc.steep[k] / 1.6);
        if (sc.el[k] < -0.10 && RS[i] > 20) below += g;
        flora += g * Math.min(1, sc.trees[k] * 2.5) * (RS[i] > 14 && RS[i] < 180 ? 1 : 0);
        if (RS[i] < 12) near += g;
        if (lastVisR > 0 && RS[i] > lastVisR * 1.6 && i < NR - 1) layers++;
        if (RS[i] < 30 && sc.el[k] > 0.42) hiWall++;
      }
      lastVisR = RS[i];
      hmax = sc.el[k];
    }
    const s = Math.min(top, Math.max(bot, sc.sky[a]));
    skyA += (top - s);
    m1 += sc.sky[a]; m2 += sc.sky[a] * sc.sky[a];
  }
  const n = HALF * 2 + 1, full = n * VFOV * 2;
  const skyFrac = skyA / full;
  if (area < 1e-3) return null;
  const mean = m1 / n, sd = Math.sqrt(Math.max(0, m2 / n - mean * mean));
  const lf = liquid / area;
  let s = 0;
  s += W.relief * Math.min(1, sd / 0.09);
  s += W.layers * Math.min(1, layers / (n * 1.6));
  s += W.liquid * Math.min(1, lf / 0.30) * (lf > 0.62 ? 0.4 : 1);
  s += W.beyond * (beyond / n);
  s += W.steep * Math.min(1, (steep / area) / 0.30);
  s += W.below * Math.min(1, (below / area) / 0.35);
  s += W.flora * Math.min(1, (flora / area) / 0.25);
  s -= Math.abs(hi - W.high - 0.06) * 2.2;                   // the skyline about where this kind of place wants it
  s -= Math.max(0, 0.14 - skyFrac) * 6 + Math.max(0, skyFrac - 0.55) * 3;   // some sky, not mostly sky
  s -= Math.max(0, hiWall - 1) * 0.5;                         // not nose to a wall
  s -= Math.max(0, 0.02 - near / full) * 12;                  // a foreground to stand on
  s -= (1 - own / area) * 2.5;                                // paint this biome, not its neighbour
  return { s, pitch, skyFrac, lf, hi, lo, layers: layers / n, steep: steep / area, below: below / area, beyond: beyond / n, flora: flora / area };
}

// -> { unitDir: {x,y,z}, eye (m above the ground), yaw, pitch (radians), score, terms } | null
// yaw is measured from local north toward east (north = up x (Y x up)), as in the gallery.
export function findVantage(bodyId, biomeId, opts = {}) {
  const S = getSurface(bodyId), R = S.R;
  const bi = S.biomes.findIndex((b) => b.id === biomeId);
  if (bi < 0) return null;
  const B = S.biomes[bi];
  const W = Object.assign({}, WANT[B.terrain] || WANT.default, B.want || {});
  const eye = opts.eye || 1.7;
  const o = makeSample(S.nB);
  const sc = { o, bi, el: new Float32Array(NAZ * NR), gap: new Float32Array(NAZ * NR), steep: new Float32Array(NAZ * NR), trees: new Float32Array(NAZ * NR), own: new Float32Array(NAZ * NR), liq: new Uint8Array(NAZ * NR), vis: new Uint8Array(NAZ * NR), sky: new Float32Array(NAZ) };
  const sites = S.sites.filter((s) => s.b === bi).slice(0, opts.sites || 2);
  const p = [0, 0, 0], q = [0, 0, 0];
  const cands = [];
  for (const site of sites) {
    const d0 = [site.x, site.y, site.z], f0 = frameAt(d0);
    for (let ring = 0; ring <= 9; ring++) {
      const rr = ring * 48, na = ring === 0 ? 1 : Math.min(14, 4 + ring * 2);
      for (let a = 0; a < na; a++) {
        step(d0, f0, (a + ring * 0.37) / na * Math.PI * 2, rr, R, p);
        S.sample(p[0], p[1], p[2], o, true);
        if (o.w[bi] < 0.93) continue;
        if (o.lq !== NOLQ && o.lq > o.h - 0.3) continue;
        if (o.trees > 0.35 && !opts.inside) continue;
        const h0 = o.h, fp = frameAt(p);
        let rough = 0;
        for (let t = 0; t < 4; t++) { step(p, fp, t * Math.PI / 2, 3.5, R, q); rough = Math.max(rough, Math.abs(S.heightAt(q[0], q[1], q[2]) - h0)); }
        if (rough > 1.3) continue;
        cands.push({ d: [p[0], p[1], p[2]], h: h0, rough });
      }
    }
  }
  let best = null;
  const tops = [];
  for (const c of cands) {
    scan(S, c.d, R + c.h + eye, sc);
    let cb = null;
    for (let a = 0; a < NAZ; a++) {
      const v = scoreView(sc, a, W);
      if (!v) continue;
      v.s -= c.rough * 0.3;
      if (!cb || v.s > cb.s) { cb = v; cb.a = a; }
    }
    if (cb) tops.push({ c, v: cb });
  }
  tops.sort((x, y) => y.v.s - x.v.s);
  // the best view whose easel does not stand against a trunk or a boulder
  for (const t of tops.slice(0, 12)) {
    const ob = sampleObstaclesPure(bodyId, t.c.d[0], t.c.d[1], t.c.d[2], 7);
    if (ob.length && !opts.inside) continue;
    best = t; break;
  }
  if (!best && tops.length) best = tops[0];
  if (!best) return null;
  const v = best.v;
  return {
    unitDir: { x: best.c.d[0], y: best.c.d[1], z: best.c.d[2] }, eye,
    yaw: v.a / NAZ * Math.PI * 2, pitch: v.pitch, score: v.s,
    terms: { sky: +v.skyFrac.toFixed(2), liquid: +v.lf.toFixed(2), hi: +v.hi.toFixed(2), lo: +v.lo.toFixed(2), layers: +v.layers.toFixed(2), steep: +v.steep.toFixed(2), below: +v.below.toFixed(2), beyond: +v.beyond.toFixed(2), flora: +v.flora.toFixed(2) },
    candidates: tops.length,
  };
}
