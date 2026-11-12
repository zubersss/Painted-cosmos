// Painted Cosmos physics: filmstrips of the GAME itself (index.html), not the lab. OWNER: PHYSICS. (P20)
// A Node tool, not part of the game and not a test (node --test does not pick it up).
//
//   node src/physics/three/gamefilm.mjs <subject>[,<subject>...] | list
//        [--root <dir>]   serve this directory (a clean export: tools/export-head.sh <dir>); default the repo
//        [--out <dir>]    where motion-<subject>.jpg and .json go (default docs/shots/physics)
//        [--tag <t>]      file names motion-<subject>-<t>.*
//        [--quality 1]    the tier (default: the subject's, else 1)
//        [--w --h]        the viewport (default: the subject's)
//
// The page is PILOT's integrated game with PAINTER's world, painter and kits (the same as a player's), the HUD
// hidden. The game's own clock is stopped (window.__pc.hold) and driven here at a fixed step (window.__pc.step), so
// a strip does not depend on how fast this machine draws; each kept frame is copied into one sheet in the task that
// drew it, with the numbers of that instant read from the game's simulation and PHYSICS (the `probe`). Every step is
// also read by `track` (numbers that must not miss a frame, such as how high the feet get). One browser at a time.
//
// A subject:
//   setup   (G) => ...  in the page: place the explorer (G.pc.teleport), set the clock; G.mark() fixes the frame of
//           reference (east, north, up at the explorer) that G.at / G.enu use
//   pre     seconds of game clock run in 0.2 s steps after the world has settled (not drawn into the sheet)
//   keys    keys held from the first kept frame on (real key events: the game's own input)
//   lead    steps run (drawn, not kept) after the keys go down
//   frames, dt (s a step), every (steps a kept frame), w, h, crop [x, y, w, h] in fractions, tile [w, h], cols
//   start   (G) => ...  in the page, after `pre`, just before the keys go down (a run-up speed, say)
//   probe   (G) => ({...}) for each kept frame;  track (G, acc) => ... for every step;  after (G, acc) => ({...})
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPage } from '../../../tools/shot.mjs';
import { settleWorld, fallbackProblem } from '../../../tests/browser.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../../..');

// helpers that live in the page (window.G)
const PAGE_HELPERS = `(() => {
  const pc = window.__pc, ph = pc.physics, r2 = (v) => +(+v).toFixed(2), r3 = (v) => +(+v).toFixed(3), D = 180 / Math.PI;
  const nrm = (v) => { const l = Math.hypot(v.x, v.y, v.z); return { x: v.x / l, y: v.y / l, z: v.z / l }; };
  const crs = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
  const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const o = {}, a = {};
  const G = window.G = { pc, ph, r2, r3, D, nrm, crs, dot, ref: null,
    // the frame of reference: the explorer's place now, east, north, up
    mark() { const p = pc.sim.ex.p, up = nrm(p), ref = Math.abs(up.y) < 0.95 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
      const east = nrm(crs(ref, up)), north = crs(up, east); G.ref = { p0: { x: p.x, y: p.y, z: p.z }, up, east, north }; return G.ref; },
    // a body-local point e, n metres from the mark, h metres over the ground there
    at(e, n, h = 0) { const R = G.ref, q = nrm({ x: R.p0.x + R.east.x * e + R.north.x * n, y: R.p0.y + R.east.y * e + R.north.y * n, z: R.p0.z + R.east.z * e + R.north.z * n });
      const s = pc.world.sampleSurface(pc.sim.bodyId, q), r = s.radius + h; return { x: q.x * r, y: q.y * r, z: q.z * r }; },
    enu(p) { const R = G.ref, d = { x: p.x - R.p0.x, y: p.y - R.p0.y, z: p.z - R.p0.z }; return { e: dot(d, R.east), n: dot(d, R.north), u: dot(d, R.up) }; },
    enuV(v) { const R = G.ref; return { e: dot(v, R.east), n: dot(v, R.north), u: dot(v, R.up) }; },
    // the explorer: where, the feet over the ground (the game's own altitude: PILOT's ground with the boulders), speeds,
    // the legs and the gait as PHYSICS reports them
    ex() { const x = pc.sim.ex, p = G.enu(x.p), up = nrm(x.p), vu = dot(x.v, up), B = x.phys || {};
      return { e: r2(p.e), n: r2(p.n), feet: r3(x.altitude || 0), vh: r2(x.speed || 0), vu: r2(vu), gnd: x.grounded ? 1 : 0, gait: B.gait || 0, ride: r3(B.ride || 0), hip: r3(B.hip || 0), clamber: r2(B.clamber01 || 0), foot: B.footDown == null ? -1 : B.footDown, steps: B.steps || 0, pA: B.paceAhead != null && B.paceAhead < 1e8 ? r2(B.paceAhead) : -1, mat: B.material || '' }; },
    // the lean of a plant rooted e, n metres from the mark (deg), stiff 0 grass, 1 a trunk
    bend(e, n, stiff = 0) { ph.fields.flora.plantBend(G.at(e, n), stiff, o); return r2(o.angle * D); },
    // the wind h metres over the ground e, n metres from the mark (m/s), as a point at rest
    wind(e, n, h) { const w = ph.air(pc.sim.bodyId, G.at(e, n, h), a, h).wind; return r2(Math.hypot(w.x, w.y, w.z)); },
    windEN(e, n, h) { const w = G.enuV(ph.air(pc.sim.bodyId, G.at(e, n, h), a, h).wind); return { e: r2(w.e), n: r2(w.n) }; },
    here() { const h = ph.here; return { wx: h.weather.kind, wind: r2(h.air.speed), gust: r2(h.air.gust01 || 0), rate: r2(h.weather.precipitation.rate) }; },
    // the boulders the game knows within r metres of a body-local point
    rocks(p, r) { const q = nrm(p), R = Math.hypot(p.x, p.y, p.z), out = [];
      for (const b of pc.sim.sampleObstacles(pc.sim.bodyId, q, r) || []) { if (b.kind && b.kind !== 'rock') continue; const u = nrm(b.unitDir), d = { x: u.x * R - p.x, y: u.y * R - p.y, z: u.z * R - p.z };
        out.push({ u, height: b.height, radius: b.radius || 0.3, dist: Math.hypot(d.x, d.y, d.z) }); }
      return out.sort((x, y) => x.dist - y.dist); },
  };
})()`;

const SPAWN = `G.pc.setClock(T); const d = G.pc.world.getSpawn('earth').unitDir; G.pc.teleport({ body: 'earth', dir: [d.x, d.y, d.z], hour: 12.3, heading: HEAD, lookPitch: PITCH, firstPerson: false }); G.mark();`;
const spawnAt = (t, heading, pitch) => `(G) => { const T = ${t}, HEAD = ${heading}, PITCH = ${pitch}; ${SPAWN} }`;
const GRASS_PROBE = `(G) => { const x = G.pc.sim.ex.p, f = G.enu(x); return { w05: G.wind(0, 0, 0.5), w2: G.here().wind, gust: G.here().gust, a: G.bend(1, 2), b: G.bend(1.6, 2.4), c: G.bend(0.3, 2.9), d: G.bend(-1.5, 3.5) }; }`;
const TREE_PROBE = `(G) => ({ w10: G.wind(0, 0, 10), w2: G.here().wind, gust: G.here().gust, trunkA: G.bend(-6, 10, 1), trunkB: G.bend(5, 14, 1), clock: G.r3(G.ph.fields.flora.uniforms.uPhysBranchClock ? G.ph.fields.flora.uniforms.uPhysBranchClock[0] : -1) })`;

// (the Moon boulder run) find the densest place of low boulders within 320 m of crater_fields' stand (as PILOT's
// tests/boulderrun.mjs does), then the boulder there that a run can meet from at least 12 m of clear ground with an
// offset `off` metres from its middle; start the explorer `run` metres before it, facing it
const MOON_SETUP = (off = 0, run = 14, minH = 0.6, pick = 0, v0 = 0, maxSlope = 9) => `(G) => {
  const pc = G.pc, w = pc.world, body = 'moon', R = w.sampleSurface(body, { x: 0, y: 1, z: 0 }).radius;
  const at0 = w.findBiome(body, 'crater_fields'), d = G.nrm(at0.unitDir || at0);
  const ref = Math.abs(d.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 }, e = G.nrm(G.crs(ref, d)), nn = G.crs(d, e);
  let best = null;
  for (let i = -8; i <= 8; i++) for (let j = -8; j <= 8; j++) {
    const q = G.nrm({ x: d.x + (e.x * i * 40 + nn.x * j * 40) / R, y: d.y + (e.y * i * 40 + nn.y * j * 40) / R, z: d.z + (e.z * i * 40 + nn.z * j * 40) / R });
    const low = (pc.sim.sampleObstacles(body, q, 28) || []).filter((o) => o.kind === 'rock' && o.height <= 1.35);
    if (!best || low.length > best.n) best = { q, n: low.length };
  }
  // candidates: boulders minH..1.2 m tall; the line of the run comes from the side with no other boulder within 1.6 m
  // of it over the last 'run' metres (a clear run-up), and passes 'off' metres beside the boulder's middle
  const site = best.q, p0 = { x: site.x * R, y: site.y * R, z: site.z * R };
  const rocks = (pc.sim.sampleObstacles(body, site, 28) || []).filter((o) => o.kind === 'rock');
  const cands = [];
  for (const b of rocks) {
    if (b.height < ${minH} || b.height > 1.2) continue;
    if ((w.sampleSurface(body, G.nrm(b.unitDir)).slope || 0) > ${maxSlope}) continue;
    const u = G.nrm(b.unitDir), E = G.nrm(G.crs(Math.abs(u.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 }, u)), N = G.crs(u, E);
    for (let k = 0; k < 16; k++) {
      const a = k / 16 * 2 * Math.PI, f = { x: E.x * Math.cos(a) + N.x * Math.sin(a), y: E.y * Math.cos(a) + N.y * Math.sin(a), z: E.z * Math.cos(a) + N.z * Math.sin(a) }, s = G.crs(u, f);
      let clear = true;
      for (const o of rocks) { if (o === b) continue; const v = G.nrm(o.unitDir), dd = { x: (v.x - u.x) * R, y: (v.y - u.y) * R, z: (v.z - u.z) * R }, along = G.dot(dd, f), side = G.dot(dd, s) - ${off};
        if (along > -${run} - 1 && along < 3 && Math.abs(side) < 1.6 + (o.radius || 0.3)) { clear = false; break; } }
      if (clear) cands.push({ b, u, f, s, h: b.height });
    }
  }
  cands.sort((x, y) => y.h - x.h);
  const c = cands[Math.min(${pick}, cands.length - 1)];
  if (!c) { window.__site = { none: true, rocks: rocks.length }; return; }
  const st = G.nrm({ x: c.u.x * R - c.f.x * ${run} + c.s.x * ${off}, y: c.u.y * R - c.f.y * ${run} + c.s.y * ${off}, z: c.u.z * R - c.f.z * ${run} + c.s.z * ${off} });
  const ref2 = Math.abs(st.y) < 0.95 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 }, E2 = G.nrm(G.crs(ref2, st)), N2 = G.crs(st, E2);
  const heading = Math.atan2(G.dot(c.f, E2), G.dot(c.f, N2)) * G.D;
  pc.setClock(60); pc.teleport({ body, dir: [st.x, st.y, st.z], hour: 10, heading, lookPitch: -8, firstPerson: false }); G.mark();
  // (a run-up: the explorer already running at v0 along the line, as a player arrives at a run; the Moon's grip builds a
  // run slowly, 3 m/s in 3.6 s uphill)
  window.__v0 = ${v0};
  window.__site = { n: best.n, boulder: { height: G.r2(c.h), radius: G.r2(c.b.radius || 0), cands: cands.length }, heading: G.r2(heading), off: ${off}, run: ${run}, rockU: c.u, f: c.f, s: c.s };
}`;
// the numbers of a boulder run: where the feet are against the boulder (along the line, beside it), off the ground and
// how high, how far the body rose above where the feet left the ground
// the run-up speed along the line (window.__v0), set on the explorer just before Shift+W goes down
const MOON_START = `(G) => { const S = window.__site, v = window.__v0; if (!S || !S.f || !v) return; const x = G.pc.sim.ex, up = G.nrm(x.p), d = G.dot(S.f, up), t = G.nrm({ x: S.f.x - d * up.x, y: S.f.y - d * up.y, z: S.f.z - d * up.z }); x.v = { x: t.x * v, y: t.y * v, z: t.z * v }; x.grounded = true; }`;
const MOON_PROBE = `(G) => { const S = window.__site, x = G.ex(), p = G.pc.sim.ex.p, R = Math.hypot(p.x, p.y, p.z), u = S.rockU, d = { x: p.x - u.x * R, y: p.y - u.y * R, z: p.z - u.z * R };
  return { ...x, along: G.r2(G.dot(d, S.f)), side: G.r2(G.dot(d, S.s)) }; }`;
const MOON_TRACK = `(G, A) => { const x = G.pc.sim.ex, p = x.p, R = Math.hypot(p.x, p.y, p.z), S = window.__site, u = S.rockU, d = { x: p.x - u.x * R, y: p.y - u.y * R, z: p.z - u.z * R }, along = G.dot(d, S.f);
  A.n = (A.n || 0) + 1; A.feetMax = Math.max(A.feetMax || 0, x.altitude || 0);
  if (Math.abs(along) < 3) { A.feetNear = Math.max(A.feetNear || 0, x.altitude || 0); A.vhMin = Math.min(A.vhMin == null ? 99 : A.vhMin, x.speed || 0); }
  if (x.grounded) { if (A.cur) { A.offs = (A.offs || []).concat([A.cur]); A.cur = null; } A.r0 = R; A.v0 = x.speed || 0; A.along0 = along; }
  else { if (!A.cur) A.cur = { along: +along.toFixed(2), from: +(A.along0 == null ? along : A.along0).toFixed(2), speed: +(A.v0 || 0).toFixed(2), feet: 0, rise: -9, steps: 0 };
    A.cur.steps++; A.cur.feet = +Math.max(A.cur.feet, x.altitude || 0).toFixed(3); A.cur.rise = +Math.max(A.cur.rise, R - (A.r0 || R)).toFixed(3); }
  A.rise = Math.max(A.rise || 0, A.cur ? A.cur.rise : 0); A.vuMax = Math.max(A.vuMax || 0, G.dot(x.v, G.nrm(p))); }`;
const MOON_AFTER = `(G, A) => { const offs = (A.offs || []).concat(A.cur ? [A.cur] : []); return { site: window.__site && { ...window.__site, rockU: undefined, f: undefined, s: undefined }, steps: A.n, feetMax: G.r3(A.feetMax || 0), feetWithin3m: G.r3(A.feetNear || 0), thrownUp: G.r3(Math.max(0, A.rise || 0)), vuMax: G.r2(A.vuMax || 0), slowestWithin3m: G.r2(A.vhMin == null ? -1 : A.vhMin), offGround: offs.filter((o) => o.feet > 0.02) }; }`;

// (item 3) the coast stand of a biome, the waterline nearest it (rays every 11.25 degrees, 4 m steps, then halved), and a
// place `out` m beyond it into the liquid; the explorer is put there facing along the shore
const COAST_SETUP = (body, biome, t, out) => `(G) => {
  const pc = G.pc, w = pc.world, at0 = w.findBiome('${body}', '${biome}'), d0 = G.nrm(at0.unitDir || at0);
  pc.setClock(${t}); pc.teleport({ body: '${body}', dir: [d0.x, d0.y, d0.z], hour: 11, firstPerson: false }); G.mark();
  const D = (e, n) => { const p = G.at(e, n), l = Math.hypot(p.x, p.y, p.z), s = w.sampleSurface('${body}', { x: p.x / l, y: p.y / l, z: p.z / l }); return (s.liquidRadius || 0) - s.radius; };
  const wet = D(0, 0) > 0; let hit = null;
  for (let r = 4; r <= 900 && !hit; r += 4) for (let k = 0; k < 32 && !hit; k++) { const a = k / 32 * 2 * Math.PI; if ((D(Math.cos(a) * r, Math.sin(a) * r) > 0) !== wet) hit = { a, r }; }
  if (!hit) { window.__site = { none: true }; return; }
  let lo = hit.r - 4, hi = hit.r; for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2; if ((D(Math.cos(hit.a) * m, Math.sin(hit.a) * m) > 0) !== wet) hi = m; else lo = m; }
  const sgn = wet ? -1 : 1, rr = hi + sgn * ${out}, e = Math.cos(hit.a) * rr, n = Math.sin(hit.a) * rr, depth = D(e, n);
  const q = G.nrm(G.at(e, n)), oe = Math.cos(hit.a) * sgn, on = Math.sin(hit.a) * sgn;
  // along the shore: the out direction turned 90 degrees (east-north to a compass heading from north toward east)
  const heading = Math.atan2(on, -oe) * G.D;
  pc.teleport({ body: '${body}', dir: [q.x, q.y, q.z], hour: 11, heading, lookPitch: -6, firstPerson: false }); G.mark();
  window.__site = { waterline: G.r2(hi), out: ${out}, depth: G.r2(depth), heading: G.r2(heading), oe: G.r3(oe), on: G.r3(on) };
}`;
// the feet's height over the still level and the drawn surface at the explorer; how much of it is under; the sea there
const FLOAT_PROBE = `(G) => { const x = G.pc.sim.ex, p = x.p, R = Math.hypot(p.x, p.y, p.z), s = G.pc.world.sampleSurface(G.pc.sim.bodyId, G.nrm(p)), still = s.liquidRadius || 0;
  const W = G.ph.fields.water, L = W.local(p, {}), wl = W.heightAt(p), B = x.phys || {};
  return { feet: G.r3(R - still), surf: G.r3(wl), under: G.r3(still + wl - R), sub: G.r2(B.submerged01 || 0), swim: x.swimming ? 1 : 0, vu: G.r2(G.dot(x.v, G.nrm(p))), Hs: G.r2(L.significant), depth: G.r2(still - s.radius), spray: G.ph.particles.spray.count, surfAt: G.r2(G.ph.here.blown ? G.ph.here.blown.surf || 0 : 0) }; }`;

export const SUBJECTS = {
  // ---- the sub-second gusts (P18) in the meadow by the explorer: 30 frames a second, the storm's wind ----
  'game-grass-sub': { note: 'the game, Earth spawn, 176 s (the storm: 11 m/s at 10 m): the grass at the explorer\'s feet, 30 frames a second (0.4 s); does it move under a second?',
    setup: spawnAt(176 - 3, 0, -22), pre: 3, w: 640, h: 360, quality: 1, crop: [0.2, 0.45, 0.6, 0.55], frames: 12, dt: 1 / 30, every: 1, cols: 4, probe: GRASS_PROBE },
  // the same at the gust front of the first storm (146 s): the wind rising
  'game-grass-front': { note: 'the game, Earth spawn, 146 s (the first storm\'s gust front over the meadow), 30 frames a second (0.4 s)',
    setup: spawnAt(146 - 3, 0, -22), pre: 3, w: 640, h: 360, quality: 1, crop: [0.2, 0.45, 0.6, 0.55], frames: 12, dt: 1 / 30, every: 1, cols: 4, probe: GRASS_PROBE },
  // ---- the crowns by the spawn, looking up into them: 15 frames a second for 1.6 s (the branches' own 0.9 to 1.7 Hz
  // and the foliage's tremble) ----
  'game-tree-sub': { note: 'the game, Earth spawn, 167 s (the storm\'s height): the birch crowns over the explorer, 15 frames a second (1.6 s)',
    setup: spawnAt(167 - 3, 0, 18), pre: 3, w: 640, h: 360, quality: 1, crop: [0.1, 0.0, 0.8, 0.7], tile: [256, 126], frames: 24, dt: 1 / 30, every: 2, cols: 6, probe: TREE_PROBE },
  'game-tree-front': { note: 'the game, Earth spawn, 149 s (the first storm\'s gust front reaches the crowns), 15 frames a second (1.6 s)',
    setup: spawnAt(149 - 3, 0, 18), pre: 3, w: 640, h: 360, quality: 1, crop: [0.1, 0.0, 0.8, 0.7], tile: [256, 126], frames: 24, dt: 1 / 30, every: 2, cols: 6, probe: TREE_PROBE },
  // ---- the storm frame: the first thunderstorm at the Earth spawn (240 s), standing, the top tier, 960 x 540; four
  // frames a tenth of a second apart ----
  'game-storm': { note: 'the game, Earth spawn, the first thunderstorm (240 s), standing, the top tier at 960 x 540; frames 0.1 s apart',
    setup: spawnAt(240 - 6, 0, 2), pre: 6, w: 960, h: 540, quality: 2, crop: [0, 0, 1, 1], tile: [480, 270], frames: 4, dt: 1 / 30, every: 3, cols: 2,
    probe: `(G) => { const s = G.ph.here.sky || {}, k = (n) => G.ph.particles[n].count; return { ...G.here(), cloud: G.r2(s.cloud || 0), overcast: G.r2(s.overcast || 0), wet: G.r2(s.wet || 0), skyRain: G.r2(s.rain || 0), storm: G.r2(s.storm || 0), flash: G.r2(s.flash || 0), rain: k('rain'), leaves: k('leaves'), w10: G.wind(0, 0, 10) }; }` },
  // ---- milestone 3's Moon boulder run: Shift+W (the game's run) at the tallest boulder of the densest field near
  // crater_fields' stand, from 14 m of clear ground; 30 steps a second, a frame kept every 0.1 s ----
  'game-moon-boulder': { note: 'the game, the Moon, crater_fields: a run (Shift+W, from 6 m/s) at the tallest boulder on gentle ground (slope under 8 degrees) of the densest field near the stand, met in the middle, from 12 m out; 10 frames a second, simulated at 30 Hz',
    setup: MOON_SETUP(0, 12, 0.6, 0, 6, 0.14), start: MOON_START, pre: 0.4, keys: ['ShiftLeft', 'KeyW'], w: 640, h: 360, quality: 1, crop: [0.15, 0.2, 0.7, 0.7], tile: [224, 126], frames: 30, dt: 1 / 30, every: 3, cols: 6,
    probe: MOON_PROBE, track: MOON_TRACK, after: MOON_AFTER },
  'game-moon-boulder-side': { note: 'the game, the Moon, crater_fields: the same run met 0.45 m off the boulder\'s middle (P17); 10 frames a second, simulated at 30 Hz',
    setup: MOON_SETUP(0.45, 12, 0.6, 0, 6, 0.14), start: MOON_START, pre: 0.4, keys: ['ShiftLeft', 'KeyW'], w: 640, h: 360, quality: 1, crop: [0.15, 0.2, 0.7, 0.7], tile: [224, 126], frames: 30, dt: 1 / 30, every: 3, cols: 6,
    probe: MOON_PROBE, track: MOON_TRACK, after: MOON_AFTER },
  // ---- (item 3) the drawn sea and physics' sea: the explorer floating off the coast stand, 'out' m beyond the waterline
  // (deep enough to float), the camera behind it looking along the shore; probe: the feet's height over the still level,
  // the drawn surface there (physics' twin of the water shader), how much of the body is under, the sea there ----
  'game-float-earth': { note: 'the game, Earth sea_coast at 1150 s (a fresh breeze): the explorer floating 25 m out, looking along the shore; 7.5 frames a second',
    setup: COAST_SETUP('earth', 'sea_coast', 1150, 25), pre: 4, w: 640, h: 360, quality: 1, crop: [0.1, 0.15, 0.8, 0.75], tile: [256, 135], frames: 24, dt: 1 / 30, every: 4, cols: 6, probe: FLOAT_PROBE },
  'game-float-neptune': { note: 'the game, Neptune storm_seas at 240 s (the storm): the explorer floating 25 m out, looking along the shore; 7.5 frames a second',
    setup: COAST_SETUP('neptune', 'storm_seas', 240, 25), pre: 4, w: 640, h: 360, quality: 1, crop: [0.1, 0.15, 0.8, 0.75], tile: [256, 135], frames: 24, dt: 1 / 30, every: 4, cols: 6, probe: FLOAT_PROBE },
};

function arg(name, d) { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : d; }

async function filmOne(name, S, o) {
  const W = Number(o.w || S.w || 640), H = Number(o.h || S.h || 360), Q = o.quality || S.quality || 1;
  const query = `dynres=0&pointerlock=0&card=0&fresh=1&save=0&audio=0&quality=${Q}`;
  const t0 = Date.now();
  const { page, problems, close } = await openPage({ pagePath: '/index.html?' + query, w: W, h: H, root: o.root });
  let res = null, note = [];
  const log = (...a) => console.log(new Date().toISOString().slice(11, 19), name, ...a);
  try {
    await page.waitForFunction('window.__pcReady === true', null, { timeout: 900000, polling: 300 });
    const fb = await fallbackProblem(page, query); if (fb) throw new Error('FALLBACK: ' + fb);
    await page.evaluate(() => { const h = document.getElementById('pc-hud'); if (h) h.style.visibility = 'hidden'; });
    await page.evaluate(PAGE_HELPERS);
    await page.evaluate(() => { const pc = window.__pc; pc.hold(false); pc.setTimeScale(0); });
    await page.evaluate(`(${S.setup})(window.G)`);
    log('placed', JSON.stringify(await page.evaluate(() => ({ site: window.__site || null, info: (({ state, body, biome }) => ({ state, body, biome }))(window.__pc.info()) }))));
    const st = await settleWorld(page, { calm: 8, maxFrames: 400 });
    if (!st.ok) note.push(`the world did not settle in ${st.frames} frames`);
    log('settled', JSON.stringify(st));
    await page.evaluate(() => { const pc = window.__pc; pc.hold(true); pc.setTimeScale(1); });
    if (S.pre) await page.evaluate(([k]) => window.__pc.step(0.2, k), [Math.max(1, Math.round(S.pre / 0.2))]);
    if (S.start) await page.evaluate(`(${S.start})(window.G)`);
    for (const k of S.keys || []) await page.keyboard.down(k);
    if (S.lead) await page.evaluate(([dt, k]) => window.__pc.step(dt, k), [S.dt, S.lead]);
    res = await page.evaluate((O) => {
      const fn = (s) => (s ? (0, eval)('(' + s + ')') : null), probe = fn(O.probe), track = fn(O.track), G = window.G, pc = window.__pc;
      const gl = document.getElementById('pc-canvas') || document.querySelector('canvas');
      const c = O.crop || [0, 0, 1, 1], sx = Math.round(c[0] * gl.width), sy = Math.round(c[1] * gl.height), sw = Math.round(c[2] * gl.width), sh = Math.round(c[3] * gl.height);
      const tw = O.tile ? O.tile[0] : sw, th = O.tile ? O.tile[1] : sh, cols = O.cols || 4, rows = Math.ceil(O.frames / cols);
      const sheet = document.createElement('canvas'); sheet.width = tw * cols; sheet.height = th * rows;
      const g = sheet.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, sheet.width, sheet.height); g.font = '10px monospace'; g.textBaseline = 'top';
      const numbers = [], acc = {}, t0 = pc.sim.t;
      for (let i = 0; i < O.frames; i++) {
        for (let k = 0; k < (O.every || 1); k++) { pc.step(O.dt, 1); if (track) track(G, acc); }
        const x = (i % cols) * tw, y = Math.floor(i / cols) * th;
        g.drawImage(gl, sx, sy, sw, sh, x, y, tw, th);
        const s = i + ' ' + (pc.sim.t - t0).toFixed(2) + 's'; g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(x, y, s.length * 6 + 4, 12); g.fillStyle = '#000'; g.fillText(s, x + 2, y + 1);
        if (probe) { const r = probe(G); r.t = +(pc.sim.t - t0).toFixed(4); numbers.push(r); }
      }
      const after = fn(O.after);
      return { sheet: sheet.toDataURL('image/jpeg', 0.86), numbers, dt: O.dt * (O.every || 1), hz: 1 / O.dt, w: sheet.width, h: sheet.height, after: after ? after(G, acc) : null, errors: (pc.errors || []).slice(0, 5), info: (({ state, body, biome, t }) => ({ state, body, biome, t }))(pc.info()) };
    }, { frames: S.frames, dt: S.dt, every: S.every, crop: S.crop, tile: S.tile, cols: S.cols, probe: S.probe, track: S.track, after: S.after });
    for (const k of S.keys || []) await page.keyboard.up(k);
  } catch (e) { problems.push('FILM FAILED: ' + String(e.message).split('\n')[0]); }
  await close();
  const base = path.join(o.out, 'motion-' + name + (o.tag ? '-' + o.tag : ''));
  if (res) {
    fs.writeFileSync(base + '.jpg', Buffer.from(res.sheet.split(',')[1], 'base64'));
    const rec = { subject: name, note: S.note, page: '/index.html (the game)', quality: Number(Q), size: [W, H], frames: res.numbers.length, dt: res.dt, hz: res.hz, sheet: [res.w, res.h], info: res.info, notes: note, after: res.after, numbers: res.numbers };
    fs.writeFileSync(base + '.json', JSON.stringify(rec) + '\n');
    const keys = Object.keys(res.numbers[0] || {});
    const flat = (v) => (v && typeof v === 'object' ? JSON.stringify(v) : String(v));
    console.log(`# ${name}: ${res.numbers.length} frames, ${res.dt.toFixed(4)} s apart, simulated at ${res.hz.toFixed(0)} Hz, sheet ${res.w}x${res.h}, ${((Date.now() - t0) / 1000).toFixed(0)} s to make${note.length ? '; ' + note.join('; ') : ''}`);
    console.log('#  i  ' + keys.join('  '));
    res.numbers.forEach((r, i) => console.log(String(i).padStart(4) + '  ' + keys.map((k) => flat(r[k])).join('  ')));
    if (res.after) console.log('# after: ' + JSON.stringify(res.after));
    if (res.errors.length) problems.push('game errors: ' + res.errors.join(' | '));
    console.log('wrote ' + base + '.jpg and .json');
  }
  if (problems.length) { console.log('PROBLEMS (' + problems.length + '):'); for (const p of [...new Set(problems)].slice(0, 12)) console.log('  ' + p); }
  return !!res && !problems.length;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const which = process.argv[2];
  if (!which || which === 'list') { for (const k in SUBJECTS) console.log(k.padEnd(24) + (SUBJECTS[k].note || '')); process.exit(0); }
  const o = { root: arg('root', undefined), out: path.resolve(arg('out', path.join(REPO, 'docs/shots/physics'))), tag: arg('tag', ''), quality: arg('quality', ''), w: arg('w', ''), h: arg('h', '') };
  fs.mkdirSync(o.out, { recursive: true });
  let ok = true;
  for (const n of which.split(',')) { if (!SUBJECTS[n]) { console.log('no such subject: ' + n); ok = false; continue; } ok = (await filmOne(n, SUBJECTS[n], o)) && ok; }
  process.exit(ok ? 0 : 1);
}
