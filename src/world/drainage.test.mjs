// Painted Cosmos: the drainage field -- water runs downhill and pools where it cannot fall further.
// OWNER: PAINTER. Run: node --test src/world/drainage.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODE, overlayOil } from '../data/mode.js';
import { LOOKS } from '../data/looks.js';
MODE.oil = true; overlayOil(LOOKS);
const { getSurface, makeSample, NOLQ } = await import('./surface.js');
const { Drainage, attachDrainage } = await import('./drainage.js');

const S = getSurface('earth');
const D = new Drainage(S).build();
const nodes = () => { const a = []; const n = D.g.n; for (let f = 0; f < 6; f++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) a.push(D.g.pid(f, i, j)); return a; };

test('the filled surface never stands below the land', () => {
  for (const p of nodes()) assert.ok(D.lvl[p] >= D.ter[p] - 1e-3, 'node ' + p);
});

test('no pit is left in the filled surface: every node can get out', () => {
  const nb = new Int32Array(8);
  for (const p of nodes()) {
    const m = D._nbs(p, nb);
    let out = false;
    for (let t = 0; t < m; t++) if (D.lvl[nb[t]] <= D.lvl[p] + 1e-6) { out = true; break; }
    assert.ok(out, 'node ' + p + ' has nowhere to drain');
  }
});

test('a read agrees with the node it sits on', () => {
  const n = D.g.n, d = [0, 0, 0], o = D.out();
  for (let f = 0; f < 6; f++) for (let j = 1; j < n - 1; j += 7) for (let i = 1; i < n - 1; i += 7) {
    D.g.dirOf(f, i, j, d);
    D.at(d[0], d[1], d[2], o);
    assert.ok(Math.abs(o.level - D.lvl[D.g.pid(f, i, j)]) < 1e-3);
    assert.ok(o.fill >= 0);
  }
});

test('the wood is a chain of DEAD LEVEL reaches, not a noise field', () => {
  // walk the channel out of the spawn and count the five-metre steps where the water does not move
  const R = S.R, o = makeSample(S.nB);
  const basis = (x, y, z) => { let ux, uy, uz; if (Math.abs(y) < 0.9) { ux = -z; uy = 0; uz = x; } else { ux = 0; uy = z; uz = -y; }
    const l = 1 / Math.hypot(ux, uy, uz); ux *= l; uy *= l; uz *= l; return [ux, uy, uz, y * uz - z * uy, z * ux - x * uz, x * uy - y * ux]; };
  const sp = S.getSpawn();
  // stay ON the channel's own line: one Newton step back onto the zero contour after every step
  const snap = (p) => {
    for (let k = 0; k < 20; k++) {
      const [ux, uy, uz, vx, vy, vz] = basis(p[0], p[1], p[2]), e = 2, eR = e / R;
      const c0 = S._sfO(p[0], p[1], p[2]);
      const c1 = S._sfO(p[0] + ux * eR, p[1] + uy * eR, p[2] + uz * eR), c2 = S._sfO(p[0] + vx * eR, p[1] + vy * eR, p[2] + vz * eR);
      const gu = (c1 - c0) / e, gv = (c2 - c0) / e, g2 = gu * gu + gv * gv;
      if (g2 < 1e-18 || Math.abs(c0) < 1e-7) break;
      const du = -c0 * gu / g2, dv = -c0 * gv / g2, hl = Math.hypot(du, dv) || 1;
      const st = Math.min(60, hl) / hl / R;
      const x = p[0] + (ux * du + vx * dv) * st, y = p[1] + (uy * du + vy * dv) * st, z = p[2] + (uz * du + vz * dv) * st;
      const il = 1 / Math.hypot(x, y, z); p = [x * il, y * il, z * il];
    }
    return p;
  };
  const run = (on) => {
    S.drain = on ? D : null; S._dr = null;
    let p = snap([sp.x, sp.y, sp.z]), prevT = null, lev = 0, pairs = 0, prev = null;
    for (let i = 0; i < 1200; i++) {
      const [ux, uy, uz, vx, vy, vz] = basis(p[0], p[1], p[2]), e = 2, eR = e / R;
      const c0 = S._sfO(p[0], p[1], p[2]);
      const c1 = S._sfO(p[0] + ux * eR, p[1] + uy * eR, p[2] + uz * eR), c2 = S._sfO(p[0] + vx * eR, p[1] + vy * eR, p[2] + vz * eR);
      const gu = (c1 - c0) / e, gv = (c2 - c0) / e, gl = Math.hypot(gu, gv) || 1e-12;
      let tu = -gv / gl, tv = gu / gl;
      if (prevT && tu * prevT[0] + tv * prevT[1] < 0) { tu = -tu; tv = -tv; }
      prevT = [tu, tv];
      S.sample(p[0], p[1], p[2], o, false);
      // only the WOOD: a marsh's level is c.L * 0.1, a tenth of the slope, so it reads as level either way
      let wF = 0;
      for (let k = 0; k < S.nB; k++) if (S.lqGroup[k] === 0) wF += o.w[k];
      const wet = wF >= 0.55 && o.lq !== NOLQ && o.lq > o.h - 0.45;
      if (wet && prev !== null) { pairs++; if (Math.abs(o.lq - prev) < 0.005) lev++; }
      prev = wet ? o.lq : null;
      let x = p[0] + (ux * tu + vx * tv) * (5 / R), y = p[1] + (uy * tu + vy * tv) * (5 / R), z = p[2] + (uz * tu + vz * tv) * (5 / R);
      const il = 1 / Math.hypot(x, y, z); p = snap([x * il, y * il, z * il]);
    }
    return { lev, pairs };
  };
  const a = run(false), b = run(true);
  S.drain = null; S._dr = null;
  assert.ok(a.pairs > 50 && b.pairs > 50, 'the walk must find wet channel');
  assert.ok(a.lev / a.pairs < 0.1, 'today the level wanders everywhere: ' + a.lev + '/' + a.pairs);
  assert.ok(b.lev / b.pairs > 0.3, 'with the field most of the river must stand level: ' + b.lev + '/' + b.pairs);
});

test('a filled basin stands at ONE level, and the ground is not moved by it', () => {
  const R = S.R, o = makeSample(S.nB), n = D.g.n, d = [0, 0, 0];
  // the deepest filled node of all
  let best = -1, bf = 0;
  for (let f = 0; f < 6; f++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const p = D.g.pid(f, i, j), fl = D.lvl[p] - D.ter[p];
    if (fl > bf) { bf = fl; best = [f, i, j]; }
  }
  assert.ok(bf > 2, 'Earth must have at least one basin over 2 m deep: ' + bf.toFixed(2));
  D.g.dirOf(best[0], best[1], best[2], d);
  const [ux, uy, uz, vx, vy, vz] = (() => { const x = d[0], y = d[1], z = d[2]; let a = -z, b = 0, c = x;
    const l = 1 / Math.hypot(a, b, c); a *= l; b *= l; c *= l; return [a, b, c, y * c - z * b, z * a - x * c, x * b - y * a]; })();
  S.drain = D; S._dr = null;
  const lv = [];
  for (let a = -150; a <= 150; a += 10) for (let b = -150; b <= 150; b += 10) {
    let x = d[0] + (ux * a + vx * b) / R, y = d[1] + (uy * a + vy * b) / R, z = d[2] + (uz * a + vz * b) / R;
    const il = 1 / Math.hypot(x, y, z);
    S.sample(x * il, y * il, z * il, o, false);
    if (o.lq !== NOLQ && o.lq > o.h + 0.5 && o.s > 30) lv.push(o.lq);
  }
  S.drain = null; S._dr = null;
  assert.ok(lv.length > 20, 'the deepest basin must hold standing water away from the channel: ' + lv.length);
  assert.ok(Math.max(...lv) - Math.min(...lv) < 0.05, 'a lake must be dead level: spread ' + (Math.max(...lv) - Math.min(...lv)).toFixed(3) + ' m');
});

test('the painted current runs with the land, not against it', () => {
  const R = S.R, o = makeSample(S.nB), oo = D.out();
  const sp = S.getSpawn();
  let ux = -sp.z, uy = 0, uz = sp.x; const l = 1 / Math.hypot(ux, uy, uz); ux *= l; uy *= l; uz *= l;
  const vx = sp.y * uz - sp.z * uy, vy = sp.z * ux - sp.x * uz, vz = sp.x * uy - sp.y * ux;
  const score = (on) => {
    S.drain = on ? D : null; S._dr = null;
    let sum = 0, n = 0;
    for (let i = 0; i < 4000; i++) {
      const an = i * 0.618 * Math.PI * 2, r = (i % 97) * 4;
      let x = sp.x + (ux * Math.cos(an) + vx * Math.sin(an)) * r / R, y = sp.y + (uy * Math.cos(an) + vy * Math.sin(an)) * r / R, z = sp.z + (uz * Math.cos(an) + vz * Math.sin(an)) * r / R;
      const il = 1 / Math.hypot(x, y, z); x *= il; y *= il; z *= il;
      S.sample(x, y, z, o, false);
      if (o.lq === NOLQ || o.lq <= o.h - 0.45 || (o.fu === 0 && o.fv === 0)) continue;
      D.flow(D.at(x, y, z, oo));
      if (oo.fall < 2e-4) continue;
      const du = oo.fx * ux + oo.fy * uy + oo.fz * uz, dv = oo.fx * vx + oo.fy * vy + oo.fz * vz;
      const m = Math.hypot(du, dv) || 1e-9;
      sum += (o.fu * du + o.fv * dv) / m; n++;
    }
    return n ? sum / n : 0;
  };
  const before = score(false), after = score(true);
  S.drain = null; S._dr = null;
  // (a small patch of wood can agree with the fall by luck -- round the spawn the old fixed way round
  // scores 0.56 -- so this asserts the field is better here AND good in itself. Over a traced 10 km of
  // channel the old way round measured -0.424 against the new 0.643, with 239 of 368 wet points running
  // uphill by more than 60 degrees against 0 of 367: scratchpad measurement, 2026-11-23.)
  assert.ok(after > 0.6, 'with the field the current must run downhill: ' + after.toFixed(3));
  assert.ok(after > before + 0.1, 'the field must be better than the old fixed way round: ' + before.toFixed(3) + ' -> ' + after.toFixed(3));
});

test('a world with no liquid at all gets no field, and nothing breaks', () => {
  const T = getSurface('mars');
  assert.equal(attachDrainage(T), null);
  const o = makeSample(T.nB);
  T.sample(0.3, 0.5, 0.81, o, true);
  assert.ok(Number.isFinite(o.h));
});
