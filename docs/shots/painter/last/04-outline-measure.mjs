// sout.mjs <tree>: where does the drawn outline of a spire's middle form lie in sA (materials.js PROP_FRAG, the re-fix)?
// For eyes near the spire, the contour edges of the real mesh (one face toward the eye, one away), sampled along their
// length, weighted by length; sA by the shader's formula with the shader's one form per kind (uHollow).
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
const tree = process.argv[2];
const three = pathToFileURL(path.join(tree, 'vendor/three/three.module.js')).href;
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(s, c, n) { if (s === 'three') return { url: '${three}', shortCircuit: true }; return n(s, c); }`), import.meta.url);
const { spireGeometry } = await import(pathToFileURL(path.join(tree, 'src/world/florakit.js')).href);
function hit(o, d, T) {
  const e1 = T[1].map((x, k) => x - T[0][k]), e2 = T[2].map((x, k) => x - T[0][k]);
  const p = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
  const det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2]; if (Math.abs(det) < 1e-12) return null;
  const tv = o.map((x, k) => x - T[0][k]); const uu = (tv[0] * p[0] + tv[1] * p[1] + tv[2] * p[2]) / det; if (uu < 0 || uu > 1) return null;
  const q = [tv[1] * e1[2] - tv[2] * e1[1], tv[2] * e1[0] - tv[0] * e1[2], tv[0] * e1[1] - tv[1] * e1[0]];
  const vv = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) / det; if (vv < 0 || uu + vv > 1) return null;
  const t = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det; return t > 0 ? t : null;
}
const sOf = (p, e, u) => {
  const ay = Math.min(1, Math.max(0, p[1] / u[1])), az = ay * ay * u[1] * u[2];
  const qx = p[0], qz = p[2] - az, dx = qx - e[0], dz = qz - (e[2] - az);
  return Math.abs(qx * dz - qz * dx) / Math.max(Math.hypot(qx, qz) * Math.hypot(dx, dz), 1e-4);
};
for (const slim of [true, false]) {
  const u = slim ? [1.3, 10.5, 0.3] : [2.0, 12, 0];
  const S = [];
  for (const seed of [13, 23, 33, 43, 53, 63, 73, 83]) {
    const g = spireGeometry(seed, 1, slim ? { slim: 1 } : {});
    const P = g.getAttribute('position'), idx = g.index ? g.index.array : null;
    const nT = (idx ? idx.length : P.count) / 3;
    const V = (i) => [P.getX(i), P.getY(i), P.getZ(i)];
    const key = (v) => v.map((x) => Math.round(x * 1e4)).join(',');
    const tris = [];
    for (let t = 0; t < nT; t++) { const ii = [0, 1, 2].map((k) => (idx ? idx[t * 3 + k] : t * 3 + k)); tris.push(ii.map(V)); }
    let H = 0; for (let i = 0; i < P.count; i++) H = Math.max(H, P.getY(i));
    for (const rf of [1.6, 2.2, 3.0, 4.5]) for (const hf of [0.08, 0.2, 0.35]) for (let a = 0; a < 8; a++) {
      const ang = a * Math.PI / 4, y = H * hf, ay = Math.min(1, y / u[1]), gr = u[0] * Math.max(1 - 0.7 * ay, 0.6);
      const e = [Math.cos(ang) * gr * rf, y, Math.sin(ang) * gr * rf + ay * ay * u[1] * u[2]];
      const edges = new Map();
      tris.forEach((T, ti) => {
        const ab = T[1].map((x, k) => x - T[0][k]), ac = T[2].map((x, k) => x - T[0][k]);
        const n = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
        const front = n[0] * (e[0] - T[0][0]) + n[1] * (e[1] - T[0][1]) + n[2] * (e[2] - T[0][2]) > 0;
        for (let k = 0; k < 3; k++) {
          const A = T[k], B = T[(k + 1) % 3], kk = [key(A), key(B)].sort().join('|');
          const r = edges.get(kk) || { A, B, f: [] }; r.f.push(front); edges.set(kk, r);
        }
      });
      for (const r of edges.values()) {
        if (r.f.length !== 2 || r.f[0] === r.f[1]) continue;
        const L = Math.hypot(r.B[0] - r.A[0], r.B[1] - r.A[1], r.B[2] - r.A[2]);
        for (let t = 0.1; t < 1; t += 0.2) {
          const p = r.A.map((x, k) => x + (r.B[k] - x) * t);
          const d = p.map((x, k) => x - e[k]), D = Math.hypot(...d); d.forEach((x, k) => { d[k] = x / D; });
          let before = false, behind = false;
          for (const T of tris) {
            const t2 = hit(e, d, T); if (t2 == null) continue;
            if (t2 < D * (1 - 1e-3)) { before = true; break; }
            if (t2 > D * (1 + 1e-3)) behind = true;
          }
          if (before) continue;
          S.push([sOf(p, e, u), L, rf, behind ? 0 : 1, Math.abs(r.B[1] - r.A[1]) / L, p[1] / H]);
        }
      }
    }
  }
  const ALL = S.length; const So = S.filter((x) => x[3] === 1); S.length = 0; S.push(...So);
  const tot = S.reduce((s, x) => s + x[1], 0), frac = (f) => S.filter(f).reduce((s, x) => s + x[1], 0) / tot;
  console.log(slim ? 'slim' : 'stout', 'visible contour samples', ALL, 'on the outer outline', S.length,
    'share of contour length with sA > 0.94:', frac((x) => x[0] > 0.94).toFixed(3), '> 0.9:', frac((x) => x[0] > 0.9).toFixed(3), '> 0.8:', frac((x) => x[0] > 0.8).toFixed(3), '< 0.5:', frac((x) => x[0] < 0.5).toFixed(3));
  for (const [nm, f] of [['sides (edge more vertical than 45 deg, 0.1 to 0.8 of the height)', (x) => x[4] > 0.7 && x[5] > 0.1 && x[5] < 0.8], ['the rest', (x) => !(x[4] > 0.7 && x[5] > 0.1 && x[5] < 0.8)]]) {
    const T = S.filter(f), tt = T.reduce((s, x) => s + x[1], 0);
    console.log('  ', nm, 'share of outline', (tt / tot).toFixed(3), '> 0.94', (T.filter((x) => x[0] > 0.94).reduce((s, x) => s + x[1], 0) / tt).toFixed(3), '> 0.9', (T.filter((x) => x[0] > 0.9).reduce((s, x) => s + x[1], 0) / tt).toFixed(3), '> 0.8', (T.filter((x) => x[0] > 0.8).reduce((s, x) => s + x[1], 0) / tt).toFixed(3), '< 0.5', (T.filter((x) => x[0] < 0.5).reduce((s, x) => s + x[1], 0) / tt).toFixed(3));
  }
  for (const rf of [1.6, 2.2, 3.0, 4.5]) {
    const T = S.filter((x) => x[2] === rf), tt = T.reduce((s, x) => s + x[1], 0);
    console.log('   eye at', rf, 'girths: > 0.94', (T.filter((x) => x[0] > 0.94).reduce((s, x) => s + x[1], 0) / tt).toFixed(3), '> 0.9', (T.filter((x) => x[0] > 0.9).reduce((s, x) => s + x[1], 0) / tt).toFixed(3));
  }
}
