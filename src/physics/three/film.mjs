// Painted Cosmos physics: filmstrips of everything the physics moves. OWNER: PHYSICS. (P11)
// A Node tool, not part of the game and not a test (node --test does not pick it up).
//
//   node src/physics/three/film.mjs <subject>[,<subject>...] | all | list
//        [--root <dir>]   serve this directory (a clean export: tools/export-head.sh <dir>); default the repo
//        [--out <dir>]    where motion-<subject>.jpg and motion-<subject>.json go (default docs/shots/physics)
//        [--tag <t>]      file names motion-<subject>-<t>.* (for a before / after pair)
//        [--q "a=b&c=d"]  extra URL parameters for the lab (they win over the subject's own)
//        [--quality 2]    the tier (default 1)
//
// Each subject opens the painted lab (physics-lab.html?painted=1: PAINTER's world and painter, the game's own
// kits) with its clock stopped, and asks the page for a strip: __lab.film() advances the simulation by a fixed
// step, draws, copies the crop of the subject into one sheet, and reads the numbers of that frame from the
// simulation itself (the `probe`). So a strip does not depend on how fast the machine draws, and a verdict
// rests on a picture and on numbers of the same instants. One browser at a time (software GL).
//
// A subject:
//   q       URL parameters of the lab (body, place, time, camera, walk, ship, pre ...)
//   w, h    the viewport (px); crop [x, y, w, h] in fractions of it; tile [w, h] px of a frame in the sheet
//           (default: the crop's own pixels, nothing resampled); cols
//   frames, dt (s a frame), sub (simulation steps a frame)
//   before  (lab) => ...  run once in the page when it is ready (for instance lab.run(seconds, 1/60, each))
//   each    (i, t, ctl, lab) => ...  before every frame: scripts the explorer, the ship, the camera (lab.ctl)
//   probe   (lab) => ({...})  the numbers of a frame; P.* below are helpers that live in the page
//   cols2   which of the probe's keys go in the printed table (default all)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPage } from '../../../tools/shot.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../../..');

// helpers that live in the page (window.P), written once here
const PAGE_HELPERS = `(() => {
  const L = window.__lab, ph = L.physics, r2 = (v) => +v.toFixed(2), r3 = (v) => +v.toFixed(3), D = 180 / Math.PI;
  const o = {}, a = {};
  window.P = {
    r2, r3,
    // bend of a plant rooted e, n metres from the focus: degrees, and its east / north parts (deg)
    bend(e, n, stiff = 0) { ph.fields.flora.plantBend(L.at(e, n), stiff, o); return { deg: r2(o.angle * D), e: r2(o.e * D), n: r2(o.n * D), flat: r2(o.flatten01 || 0) }; },
    // wind speed (m/s) h metres over the ground e, n metres from the focus
    wind(e, n, h) { const w = ph.air(L.bodyId, L.at(e, n, h), a, h).wind; return r2(Math.hypot(w.x, w.y, w.z)); },
    windEN(e, n, h) { const w = L.enuV(ph.air(L.bodyId, L.at(e, n, h), a, h).wind); return { e: r2(w.e), n: r2(w.n) }; },
    // the explorer: where (east, north, feet over the ground), how fast (over the ground, upward), the legs
    ex() { const p = L.enu(L.ex.p), v = L.enuV(L.ex.v), B = L.ex.phys || {}; return { e: r2(p.e), n: r2(p.n), h: r3(p.h), vh: r2(Math.hypot(v.e, v.n)), vu: r2(v.u), hip: r3(B.hip || 0), clamber: r2(B.clamber01 || 0), gnd: L.ex.grounded ? 1 : 0,
      // (P13) the gait: the hips off standing with the stride in it (m), which gait (0 stand 1 walk 2 run), the stride's phase, feet down
      // (1 left, 2 right, 3 both, 0 none: a flight), footfalls so far
      ride: r3(B.ride || 0), gait: B.gait || 0, stride: r2(B.stride || 0), feet: B.footDown == null ? -1 : B.footDown, steps: B.steps || 0 }; },
    // the ship: height of its origin over the ground, speeds, feet down, lift, tilt (deg from the local up), wash
    ship() { const s = L.sh, p = L.enu(s.p), v = L.enuV(s.v), B = s.phys || {}, q = s.q;
      const ux = 2 * (q.x * q.y - q.w * q.z), uy = 1 - 2 * (q.x * q.x + q.z * q.z), uz = 2 * (q.y * q.z + q.w * q.x), r = Math.hypot(s.p.x, s.p.y, s.p.z);
      const c = (ux * s.p.x + uy * s.p.y + uz * s.p.z) / r;
      return { h: r3(p.h), e: r2(p.e), n: r2(p.n), vu: r3(v.u), vh: r3(Math.hypot(v.e, v.n)), feet: B.contacts || 0, lift: r2(B.lift01 == null ? 1 : B.lift01), tilt: r2(Math.acos(Math.min(1, c)) * D), wash: r2(B.downwash ? B.downwash.speed || 0 : 0), asleep: B.asleep ? 1 : 0 }; },
    // particles of a kind: how many, their mean velocity (east, north, up; m/s) and mean height over the focus plane
    parts(kind) { const b = ph.particles[kind], n = b.count; if (!n) return { n: 0 };
      let x = 0, y = 0, z = 0, s = 0; const v = b.velocity || b.vel, st = b.stride || 3;
      if (!v) return { n };
      for (let i = 0; i < n; i++) { x += v[i * st]; y += v[i * st + 1]; z += v[i * st + 2]; s += Math.hypot(v[i * st], v[i * st + 1], v[i * st + 2]); }
      const m = L.enuV({ x: x / n, y: y / n, z: z / n }); return { n, e: r2(m.e), nn: r2(m.n), u: r2(m.u), sp: r2(s / n) }; },
    // where the particles of a kind are: how many, their centre (east, north of the focus; m over the ground there), how
    // many lie within r metres of the focus
    where(kind, r = 30) { const b = ph.particles[kind], n = b.count; if (!n) return { n: 0 };
      let e = 0, nn = 0, h = 0, near = 0; const q = { x: 0, y: 0, z: 0 };
      for (let i = 0; i < n; i++) { q.x = b.origin.x + b.pos[i * 3]; q.y = b.origin.y + b.pos[i * 3 + 1]; q.z = b.origin.z + b.pos[i * 3 + 2]; const p = L.enu(q); e += p.e; nn += p.n; h += p.h; if (Math.hypot(p.e, p.n) < r) near++; }
      return { n, e: r2(e / n), nn: r2(nn / n), h: r2(h / n), near }; },
    // (P15) particles of a kind round the lens: how many within r metres of the eye, within 3 m, and their mean height over the ground
    nearEye(kind, r = 8) { const b = ph.particles[kind], n = b.count, E = L.eye; if (!n || !E) return { n: 0, eye: 0, eye3: 0 };
      let k = 0, k3 = 0; for (let i = 0; i < n; i++) { const d = Math.hypot(b.origin.x + b.pos[i * 3] - E.x, b.origin.y + b.pos[i * 3 + 1] - E.y, b.origin.z + b.pos[i * 3 + 2] - E.z); if (d < r) k++; if (d < 3) k3++; }
      return { n, eye: k, eye3: k3 }; },
    here() { const h = ph.here; return { wx: h.weather.kind, wind: r2(h.air.speed), gust: r2(h.air.gust01 || 0), rate: r2(h.weather.precipitation.rate) }; },
  };
})()`;

const SPAWN = 'body=earth&hour=12.3';
// (P12) put the explorer `e0` metres east of the focus, at rest or at a run-up speed, before a clamber strip
const CLAMBER_BEFORE = (e0, v = 0, until = 2.2) => `(L) => { const p = L.at(${e0}, 0); L.ex.p.x = p.x; L.ex.p.y = p.y; L.ex.p.z = p.z; L.ex.v.x = L.ex.v.y = L.ex.v.z = 0; L.ex.grounded = true;
  ${v ? `for (let i = 0; i < 600 && L.enu(L.ex.p).e < ${until}; i++) { L.ctl.wish = [${v}, 0]; L.run(1 / 60, 1 / 60); }` : ''} }`;
// (P12) move the focus (the hidden explorer; follow=1) to the waterline nearest the place, `up` metres up the beach,
// look along the shore turned `turn` radians toward the water, let the sea settle there for 6 s, then `more`
const SHORE_BEFORE = (up, turn, more = '') => `(L) => {
  const D = (e, n) => { const p = L.at(e, n), l = Math.hypot(p.x, p.y, p.z), s = L.world.sampleSurface(L.bodyId, { x: p.x / l, y: p.y / l, z: p.z / l }); return (s.liquidRadius || 0) - s.radius; };
  const wet = D(0, 0) > 0; let hit = null;
  for (let r = 4; r <= 900 && !hit; r += 4) for (let k = 0; k < 32 && !hit; k++) { const a = k / 32 * 2 * Math.PI; if ((D(Math.cos(a) * r, Math.sin(a) * r) > 0) !== wet) hit = { a, r }; }
  window.__shore = hit; if (!hit) return;
  let lo = hit.r - 4, hi = hit.r; for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2; if ((D(Math.cos(hit.a) * m, Math.sin(hit.a) * m) > 0) !== wet) hi = m; else lo = m; }
  // (out: the unit vector from land to water along the ray)
  const out = wet ? -1 : 1, rr = hi - out * ${up}, e = Math.cos(hit.a) * rr, n = Math.sin(hit.a) * rr;
  const p = L.at(e, n); L.ex.p.x = p.x; L.ex.p.y = p.y; L.ex.p.z = p.z; L.ex.v.x = L.ex.v.y = L.ex.v.z = 0;
  // (P15) the beach's slope: the ground's height over the still liquid 10 m landward of the waterline, over 10
  const S0 = (e, n) => { const p = L.at(e, n), l = Math.hypot(p.x, p.y, p.z); return L.world.sampleSurface(L.bodyId, { x: p.x / l, y: p.y / l, z: p.z / l }); };
  const rl = hi - out * 10, rw = hi + out * 3, lq = S0(Math.cos(hit.a) * rw, Math.sin(hit.a) * rw).liquidRadius || 0;
  const slope = Math.max(0.005, (S0(Math.cos(hit.a) * rl, Math.sin(hit.a) * rl).radius - lq) / 10);
  // (P15) the liquid's depth 20, 40, 80, 160 and 320 m out from the waterline along the ray (negative: dry land there)
  const deep = [20, 40, 80, 160, 320].map((d) => { const r = hi + out * d, q = S0(Math.cos(hit.a) * r, Math.sin(hit.a) * r); return +(((q.liquidRadius || 0) > q.radius ? q.liquidRadius - q.radius : -1)).toFixed(1); });
  window.__shore = { e, n, r: hi, oe: Math.cos(hit.a) * out, on: Math.sin(hit.a) * out, wet, slope, up: ${up}, deep };
  L.yaw = hit.a + ${turn} * out;
  L.run(6, 1 / 30); ${more} }`;
const SHORE_PROBE = `(L) => { const W = L.physics.fields.water, F = W.field, s = L.info().seaState || {}, S = window.__shore || {}, b = L.physics.here.blown, o = {};
  const lvl = (d) => { const me = L.enu(L.ex.p), p = L.at(me.e + S.oe * d, me.n + S.on * d); const w = W.heightAt ? W.heightAt(p, o) : null; return w == null ? null : P.r2(typeof w === 'number' ? w : (w.height != null ? w.height : NaN)); };
  return { Hs: s.Hs, length: s.length, breaking: s.breaking ? 1 : 0, cover: s.cover, surf: P.r2(b.surf || 0), spume: P.r2(b.spume || 0), spray: L.physics.particles.spray.count, w6: lvl(8), w20: lvl(22), w80: lvl(82), runup: W.runup ? P.r2(W.runup(L.ex.p, S.slope || 0.07)) : null, reach: W.runup ? P.r2(W.runup(L.ex.p, S.slope || 0.07) / (S.slope || 0.07)) : null, slope: P.r3(S.slope || 0), deep: (S.deep || []).join('/'), fetch: Math.round(F.fetch || 0), fdepth: P.r2(F.depth || 0) }; }`;
// (P15) runup: the level of the water's edge over the still level (m) by the physics' own swash (Stockdon) at the beach's
// slope; reach: how far up the beach that is from the still waterline (m; the explorer stands SHORE_BEFORE's 'up' m up it).
// (P14) the stand-in crowns: look across the wind at the crowns; the numbers of three tips of the middle tree
const CROWN_BEFORE = `(L) => { const w = P.windEN(0, 0, 10); L.yaw = Math.atan2(w.n, w.e); }`;
const CROWN_PROBE = `(L) => { const o = {}, r = {}; for (const i of [0, 3, 5]) { L.crownTip(0, i, o); r['b' + i] = [P.r3(o.e), P.r3(o.n), P.r3(o.up)]; r['hz' + i] = P.r2(o.hz); } r.set = P.r3(o.set); const U1 = L.physics.fields.flora.uniforms.uPhysBranch[0]; return { w10: P.wind(0, 0, 10), w2: P.wind(0, 0, 2), uc: P.r2(Math.sqrt(Math.max(0, o.load || 0)) * U1), load: P.r2(o.load || 0), trunk: P.bend(0, 0, 1).deg, ...r }; }`;
export const SUBJECTS = {
  // ---- where things are: four views round the Earth spawn, 90 degrees apart (not a motion strip) ----
  'look-around': { note: 'four views round the spawn (yaw 30, 120, 210, 300), to choose a framing',
    q: SPAWN + '&t=60&pre=2&dist=14&pitch=10&up=1.5&walk=0', w: 640, h: 360, frames: 4, dt: 1 / 30, sub: 1, cols: 2,
    each: `(i, t, ctl, L) => { L.yaw = (30 + 90 * i) * Math.PI / 180; }`, probe: `(L) => P.here()` },
  // ---- grass and the near ground ----
  // (numbers: the wind half a metre up, the lean of three blades a metre apart (deg), and of one of them east / north)
  'grass-breeze': { note: 'Earth spawn, 60 s of game clock: the near ground in the fair-weather wind (2 m/s at 10 m), 15 frames a second',
    q: SPAWN + '&t=60&pre=6&explorer=0&dist=6&pitch=10&up=0.4', w: 640, h: 360, crop: [0.25, 0.42, 0.5, 0.5], frames: 12, dt: 1 / 15, sub: 4,
    probe: `(L) => ({ w05: P.wind(0, 0, 0.5), a: P.bend(0, 0).deg, b: P.bend(0.6, 0.4).deg, c: P.bend(-0.7, 0.9).deg, ae: P.bend(0, 0).e, an: P.bend(0, 0).n })` },
  'grass-gust': { note: 'Earth spawn, 143 to 149 s: the first storm\'s gust front arrives over the meadow, 2 frames a second',
    q: SPAWN + '&t=143&pre=4&explorer=0&dist=6&pitch=10&up=0.4', w: 640, h: 360, crop: [0.25, 0.42, 0.5, 0.5], frames: 12, dt: 0.5, sub: 30,
    probe: `(L) => ({ w05: P.wind(0, 0, 0.5), a: P.bend(0, 0).deg, b: P.bend(0.6, 0.4).deg, c: P.bend(-0.7, 0.9).deg, ae: P.bend(0, 0).e, an: P.bend(0, 0).n })` },
  'grass-storm': { note: 'Earth spawn, 176 s: the meadow in the storm wind (11 m/s at 10 m), 15 frames a second',
    q: SPAWN + '&t=176&pre=4&explorer=0&dist=6&pitch=10&up=0.4', w: 640, h: 360, crop: [0.25, 0.42, 0.5, 0.5], frames: 12, dt: 1 / 15, sub: 4,
    probe: `(L) => ({ w05: P.wind(0, 0, 0.5), a: P.bend(0, 0).deg, b: P.bend(0.6, 0.4).deg, c: P.bend(-0.7, 0.9).deg, ae: P.bend(0, 0).e, an: P.bend(0, 0).n })` },
  'grass-walker': { note: 'Earth spawn, 60 s: a walker (1.5 m/s) crosses the frame through the grass; it parts and closes behind, 4 frames a second',
    q: SPAWN + '&t=60&pre=3&dist=6&pitch=14&up=0.4&circle=0.01', w: 640, h: 360, crop: [0.2, 0.3, 0.6, 0.6], tile: [320, 180], frames: 12, dt: 0.25, sub: 15,
    before: `(L) => { L.run(2.4, 1 / 60, (i, t, ctl) => { ctl.wish = [-1.5, -0.6]; }); }`,
    each: `(i, t, ctl) => { ctl.wish = [1.5, 0.6]; }`,
    probe: `(L) => { const x = P.ex(); return { e: x.e, n: x.n, vh: x.vh, at0: P.bend(0, 0).deg, flat0: P.bend(0, 0).flat, side: P.bend(0.4, -1.0).deg, behind: P.bend(x.e - 1.4, x.n - 0.56).deg }; }` },
  // ---- trees ----
  // (numbers: the wind 10 m up, the lean of a trunk (deg) at two places 12 m apart, a branch tip's swing (m: east, north, up))
  'tree-breeze': { note: 'Earth spawn, 100 to 104 s: birches in a breeze (3 m/s at 10 m), 3 frames a second',
    q: SPAWN + '&t=100&pre=6&explorer=0&dist=20&pitch=3&up=5.5&yaw=30', w: 640, h: 360, crop: [0.2, 0.05, 0.6, 0.6], tile: [320, 180], frames: 12, dt: 1 / 3, sub: 20,
    probe: `(L) => { const b = L.physics.fields.flora.plantBend(L.at(-6, 10), 1, {}), br = L.physics.fields.flora.plantBranch(2.5, 0, 9, 12, L.at(-6, 10), b, {}); return { w10: P.wind(-6, 10, 10), trunk: P.bend(-6, 10, 1).deg, trunk2: P.bend(5, 14, 1).deg, tipE: P.r3(br.e), tipN: P.r3(br.n), tipU: P.r3(br.up) }; }` },
  'tree-gust': { note: 'Earth spawn, 143 to 149 s: the gust front of the first storm reaches the birches, 2 frames a second',
    q: SPAWN + '&t=143&pre=4&explorer=0&dist=20&pitch=3&up=5.5&yaw=30', w: 640, h: 360, crop: [0.2, 0.05, 0.6, 0.6], tile: [320, 180], frames: 12, dt: 0.5, sub: 30,
    probe: `(L) => { const b = L.physics.fields.flora.plantBend(L.at(-6, 10), 1, {}), br = L.physics.fields.flora.plantBranch(2.5, 0, 9, 12, L.at(-6, 10), b, {}); return { w10: P.wind(-6, 10, 10), trunk: P.bend(-6, 10, 1).deg, trunk2: P.bend(5, 14, 1).deg, tipE: P.r3(br.e), tipN: P.r3(br.n), tipU: P.r3(br.up) }; }` },
  'tree-storm': { note: 'Earth spawn, 176 s: birches in the storm, 10 frames a second (the crown against the trunk, the return swing)',
    q: SPAWN + '&t=176&pre=4&explorer=0&dist=20&pitch=3&up=5.5&yaw=30', w: 640, h: 360, crop: [0.2, 0.05, 0.6, 0.6], tile: [320, 180], frames: 12, dt: 0.1, sub: 6,
    probe: `(L) => { const b = L.physics.fields.flora.plantBend(L.at(-6, 10), 1, {}), br = L.physics.fields.flora.plantBranch(2.5, 0, 9, 12, L.at(-6, 10), b, {}); return { w10: P.wind(-6, 10, 10), trunk: P.bend(-6, 10, 1).deg, trunk2: P.bend(5, 14, 1).deg, tipE: P.r3(br.e), tipN: P.r3(br.n), tipU: P.r3(br.up) }; }` },
  // (P14) the lab's own stand-in birches (crown=: a trunk, seven 3.5 m branches, foliage dabs), moved by FLORA_GLSL as PAINTER's
  // trees should be (pcPhysBend, pcPhysCrown per branch, pcPhysDisplace); the camera looks across the wind at 8 m.
  // numbers: the wind 10 m up, the trunk's lean (deg), three branch tips of the middle tree from the JS twin (m east, north,
  // up), the set they stream at (m) and each branch's own frequency (Hz)
  'crown-breeze': { note: 'Earth spawn (a temperate wood), 100 s: the stand-in birches in a breeze (4 m/s at 10 m among the trees, 9.5 m/s regional), 10 frames a second',
    q: SPAWN + '&t=100&pre=4&explorer=0&crown=0,0&dist=13&pitch=4&up=8.5&fov=60', w: 900, h: 540, crop: [0.28, 0.0, 0.44, 0.92], tile: [264, 298], cols: 6, frames: 12, dt: 0.1, sub: 6,
    before: CROWN_BEFORE, probe: CROWN_PROBE },
  'crown-gust': { note: 'Earth spawn, 149 s: the gust front of the first thunderstorm reaches the stand-in birches (10 m wind among the trees 9 to 14 m/s, 28 m/s regional), 10 frames a second',
    q: SPAWN + '&t=149&pre=4&explorer=0&crown=0,0&dist=13&pitch=4&up=8.5&fov=60', w: 900, h: 540, crop: [0.28, 0.0, 0.44, 0.92], tile: [264, 298], cols: 6, frames: 12, dt: 0.1, sub: 6,
    before: CROWN_BEFORE, probe: CROWN_PROBE },
  'crown-storm': { note: 'Earth spawn, 167 s: the stand-in birches at the storm\'s height (30 m/s regional, 12 to 18 m/s at 10 m among the trees), 10 frames a second',
    q: SPAWN + '&t=167&pre=4&explorer=0&crown=0,0&dist=13&pitch=4&up=8.5&fov=60', w: 900, h: 540, crop: [0.28, 0.0, 0.44, 0.92], tile: [264, 298], cols: 6, frames: 12, dt: 0.1, sub: 6,
    before: CROWN_BEFORE, probe: CROWN_PROBE },
  // ---- the explorer (PILOT's speeds: walk 4.2 m/s, run 7.4 m/s, jump 4.8 m/s) ----
  // (numbers: east and north of the start (m), feet over the ground (m), speed over the ground and upward (m/s), the legs:
  //  hip = leg length less standing (m), clamber01, on the ground 1 / 0)
  'explorer-run': { note: 'Earth spawn: a walk (4.2 m/s) for 0.6 s, a run (7.4 m/s) for 1.2 s, then stop; the camera follows; 7 frames a second',
    q: SPAWN + '&t=60&pre=1&follow=1&dist=7&pitch=6&up=0.9&yaw=0&circle=0.01', w: 640, h: 360, crop: [0.25, 0.2, 0.5, 0.6], tile: [213, 144], cols: 6, frames: 18, dt: 0.15, sub: 9,
    each: `(i, t, ctl) => { ctl.wish = t < 0.6 ? [4.2, 0] : t < 1.8 ? [7.4, 0] : [0, 0]; }`, probe: `(L) => P.ex()` },
  // (P13) the gait, at a steady pace, from the side, close, fast enough a strip to see each step
  'explorer-walk': { note: "Earth spawn: PILOT's walk (4.2 m/s, by its gait a jog: Froude 2.2), steady; the camera follows from the side; 15 frames a second",
    q: SPAWN + '&t=60&pre=1&follow=1&dist=5&pitch=4&up=0.9&yaw=0&circle=0.01', w: 640, h: 360, crop: [0.3, 0.2, 0.4, 0.62], tile: [213, 186], cols: 6, frames: 18, dt: 1 / 15, sub: 4,
    before: `(L) => { L.run(1.5, 1 / 60, (i, t, ctl) => { ctl.wish = [4.2, 0]; }); }`, each: `(i, t, ctl) => { ctl.wish = [4.2, 0]; }`, probe: `(L) => P.ex()` },
  'explorer-stroll': { note: 'Earth spawn: a stroll (1.5 m/s: a walking gait, Froude 0.28), steady; 10 frames a second',
    q: SPAWN + '&t=60&pre=1&follow=1&dist=5&pitch=4&up=0.9&yaw=0&circle=0.01', w: 640, h: 360, crop: [0.3, 0.2, 0.4, 0.62], tile: [213, 186], cols: 6, frames: 18, dt: 1 / 10, sub: 6,
    before: `(L) => { L.run(1.5, 1 / 60, (i, t, ctl) => { ctl.wish = [1.5, 0]; }); }`, each: `(i, t, ctl) => { ctl.wish = [1.5, 0]; }`, probe: `(L) => P.ex()` },
  'explorer-walk-moon': { note: "the Moon: PILOT's walk (4.2 m/s), steady; 10 frames a second",
    q: 'body=moon&hour=10&t=60&pre=1&follow=1&dist=5&pitch=4&up=0.9&yaw=0&circle=0.01', w: 640, h: 360, crop: [0.3, 0.2, 0.4, 0.62], tile: [213, 186], cols: 6, frames: 18, dt: 1 / 10, sub: 6,
    before: `(L) => { L.run(2.5, 1 / 60, (i, t, ctl) => { ctl.wish = [4.2, 0]; }); }`, each: `(i, t, ctl) => { ctl.wish = [4.2, 0]; }`, probe: `(L) => P.ex()` },
  'explorer-run-moon': { note: "the Moon: PILOT's run (7.4 m/s), steady; 12 frames a second",
    q: 'body=moon&hour=10&t=60&pre=1&follow=1&dist=5&pitch=4&up=0.9&yaw=0&circle=0.01', w: 640, h: 360, crop: [0.3, 0.2, 0.4, 0.62], tile: [213, 186], cols: 6, frames: 18, dt: 1 / 12, sub: 5,
    before: `(L) => { L.run(3.5, 1 / 60, (i, t, ctl) => { ctl.wish = [7.4, 0]; }); }`, each: `(i, t, ctl) => { ctl.wish = [7.4, 0]; }`, probe: `(L) => P.ex()` },
  'explorer-jump': { note: 'Earth spawn: a jump from a walk (4.2 m/s) and its landing; the camera follows; 12 frames a second',
    q: SPAWN + '&t=60&pre=1&follow=1&dist=7&pitch=6&up=0.9&yaw=0&circle=0.01', w: 640, h: 360, crop: [0.25, 0.1, 0.5, 0.7], tile: [213, 168], cols: 6, frames: 18, dt: 1 / 12, sub: 5,
    before: `(L) => { L.run(1, 1 / 60, (i, t, ctl) => { ctl.wish = [4.2, 0]; }); }`,
    each: `(i, t, ctl) => { ctl.wish = [4.2, 0]; if (i === 1) ctl.jump = true; }`, probe: `(L) => P.ex()` },
  'explorer-jump-moon': { note: 'the Moon, at the spawn: the same jump (4.8 m/s off the ground) and its landing; 3 frames a second',
    q: 'body=moon&hour=10&t=60&pre=1&follow=1&dist=9&pitch=6&up=1.6&yaw=0&circle=0.01', w: 640, h: 360, crop: [0.25, 0.05, 0.5, 0.8], tile: [213, 192], cols: 6, frames: 18, dt: 0.4, sub: 24,
    before: `(L) => { L.run(1, 1 / 60, (i, t, ctl) => { ctl.wish = [4.2, 0]; }); }`,
    each: `(i, t, ctl) => { ctl.wish = [4.2, 0]; if (i === 1) ctl.jump = true; }`, probe: `(L) => P.ex()` },
  'explorer-jet': { note: 'Earth spawn: a 2.5 s jetpack burn from standing, the coast, the fall and the landing; the camera follows from 30 m; a frame every 0.55 s',
    q: SPAWN + '&t=60&pre=1&follow=1&dist=30&pitch=4&up=0.9&yaw=0&circle=0.01', w: 640, h: 360, crop: [0.3, 0.2, 0.4, 0.6], tile: [213, 180], cols: 6, frames: 24, dt: 0.55, sub: 33,
    each: `(i, t, ctl) => { ctl.wish = [0, 0]; ctl.jet = t < 2.5 ? 1 : 0; }`, probe: `(L) => P.ex()` },
  // the walker goes east from the spawn until its legs first reach the end of their stroke (clamber01 > 0.6: a boulder,
  // a ledge), is put back 16 m before that place and walks up to 3 m from it unseen; the strip is the walk over it
  'explorer-clamber': { note: 'the Moon: a walk (4.2 m/s) over the first boulder east of the spawn that makes the legs clamber; the camera follows; 6 frames a second',
    q: 'body=moon&hour=10&t=60&pre=1&follow=1&dist=7&pitch=8&up=0.9&yaw=0&circle=0.01', w: 640, h: 360, crop: [0.25, 0.2, 0.5, 0.6], tile: [213, 144], cols: 6, frames: 18, dt: 1 / 6, sub: 10,
    before: `(L) => { let found = null; for (let i = 0; i < 60 * 240 && !found; i++) { L.ctl.wish = [4.2, 0]; L.run(1 / 60, 1 / 60); if (L.ex.phys && L.ex.phys.clamber01 > 0.6) found = L.enu(L.ex.p); }
      window.__found = found; if (!found) return; const p = L.at(found.e - 16, found.n); L.ex.p.x = p.x; L.ex.p.y = p.y; L.ex.p.z = p.z; L.ex.v.x = L.ex.v.y = L.ex.v.z = 0;
      for (let i = 0; i < 60 * 20 && L.enu(L.ex.p).e < found.e - 3; i++) { L.ctl.wish = [4.2, 0]; L.run(1 / 60, 1 / 60); } }`,
    each: `(i, t, ctl) => { ctl.wish = [4.2, 0]; }`, probe: `(L) => { const x = P.ex(); x.found = window.__found ? P.r2(window.__found.e) : -1; return x; }` },
  // ---- the ship (ship=fly: the real gear and flight models through PILOT's sequence) ----
  // (numbers: height of the hull's origin over the ground (m), climb and ground speed (m/s), feet on the ground, the share
  //  of the weight the lift carries, the wash speed at the ground (m/s), the grass under the hull (lean deg, flattened 0..1),
  //  dust in the air)
  'ship-liftoff': { note: 'Earth spawn: the ship stands on its legs, lifts off and climbs to 6 m; 4 frames a second',
    q: SPAWN + '&t=60&pre=9&explorer=0&ship=fly&shipAway=0&shipAlt=6&dist=17&pitch=6&up=3&yaw=70', w: 640, h: 360, crop: [0.2, 0.1, 0.6, 0.8], tile: [213, 160], cols: 6, frames: 18, dt: 0.25, sub: 15,
    each: `(i, t, ctl) => { if (i >= 2) ctl.ship = 'up'; }`,
    probe: `(L) => { const s = P.ship(), b = P.bend(0, 2), o = { h: s.h, vu: s.vu, vh: s.vh, feet: s.feet, lift: s.lift, wash: s.wash, grass: b.deg, flat: b.flat, dust: P.parts('dust').n }; return o; }` },
  'ship-hover': { note: 'Earth spawn, 176 s (the storm: 11 m/s at 10 m, gusting): the ship holds 6 m; 5 frames a second',
    q: SPAWN + '&t=166&pre=1&explorer=0&ship=fly&shipAway=0&shipAlt=6&dist=17&pitch=6&up=3&yaw=70', w: 640, h: 360, crop: [0.2, 0.1, 0.6, 0.8], tile: [213, 160], cols: 6, frames: 18, dt: 0.2, sub: 12,
    before: `(L) => { L.run(9, 1 / 60, (i, t, ctl) => { ctl.ship = 'up'; }); }`,
    each: `(i, t, ctl) => { ctl.ship = 'up'; }`,
    probe: `(L) => { const s = P.ship(), w = P.windEN(0, 2, 6); const B = (L.sh.phys && L.sh.phys.buffetAngle) || {}, D = 180 / Math.PI; return { h: s.h, e: s.e, n: s.n, vu: s.vu, vh: s.vh, windE: w.e, windN: w.n, roll: P.r2((B.roll || 0) * D), pitch: P.r2((B.pitch || 0) * D), yaw: P.r2((B.yaw || 0) * D), wash: s.wash, grass: P.bend(0, 2).deg }; }` },
  'ship-land': { note: 'Earth spawn: from a hover at 6 m the ship comes down, the gear takes it at 1 m and the legs take the weight; 3 frames a second',
    q: SPAWN + '&t=50&pre=1&explorer=0&ship=fly&shipAway=0&shipAlt=6&dist=17&pitch=6&up=3&yaw=70', w: 640, h: 360, crop: [0.2, 0.1, 0.6, 0.8], tile: [213, 160], cols: 6, frames: 24, dt: 1 / 3, sub: 20,
    before: `(L) => { L.run(9, 1 / 60, (i, t, ctl) => { ctl.ship = 'up'; }); }`,
    each: `(i, t, ctl) => { ctl.ship = 'down'; }`,
    probe: `(L) => { const s = P.ship(), b = P.bend(0, 2); return { h: s.h, vu: s.vu, feet: s.feet, lift: s.lift, wash: s.wash, asleep: s.asleep, grass: b.deg, flat: b.flat, dust: P.parts('dust').n }; }` },
  // ---- what falls and what is blown ----
  // (numbers: how many particles, their mean velocity east / north / up and mean speed (m/s), the wind 2 m up (east, north))
  'rain-turn': { note: 'Earth spawn, 176 s: rain in the storm while the camera turns 40 degrees a second; 15 frames a second',
    q: SPAWN + '&t=172&pre=4&explorer=0&dist=10&pitch=4&up=2.5&yaw=30', w: 640, h: 360, crop: [0.25, 0.2, 0.5, 0.6], tile: [320, 216], frames: 12, dt: 1 / 15, sub: 4,
    each: `(i, t, ctl) => { ctl.yawRate = 40; }`,
    probe: `(L) => { const r = P.parts('rain'), w = P.windEN(0, 0, 2); return { rain: r.n, ve: r.e, vn: r.nn, vu: r.u, windE: w.e, windN: w.n, leaves: P.parts('leaves').n, yaw: P.r2(L.yaw * 57.3) }; }` },
  'snow-blizzard': { note: 'Earth, 62.4 N: snow in a blizzard (bands, the skim over the ground); 10 frames a second',
    q: 'body=earth&lat=62.41&lon=49.46&t=150&hour=12&pre=10&explorer=0&dist=10&pitch=5&up=1.5&yaw=30', w: 640, h: 360, crop: [0.25, 0.2, 0.5, 0.6], tile: [320, 216], frames: 12, dt: 0.1, sub: 6,
    probe: `(L) => { const r = P.parts('snow'), w = P.windEN(0, 0, 2), k = P.parts('sand'), d = P.parts('dust'); return { snow: r.n, ve: r.e, vn: r.nn, vu: r.u, windE: w.e, windN: w.n, skim: k.n, skimSp: k.sp || 0, powder: d.n }; }` },
  'mars-dust': { note: 'Mars, the dunes in a dust storm: veils and blowing sand; 6 frames a second',
    q: 'body=mars&biome=dust_dunes&find=dust&hour=11&pre=12&explorer=0&dist=10&pitch=5&up=1.2&yaw=30', w: 640, h: 360, crop: [0.25, 0.2, 0.5, 0.6], tile: [320, 216], frames: 12, dt: 1 / 6, sub: 10,
    probe: `(L) => { const d = P.parts('dust'), k = P.parts('sand'), w = P.windEN(0, 0, 2); return { dust: d.n, ve: d.e, vn: d.nn, vu: d.u, sand: k.n, sandSp: k.sp || 0, windE: w.e, windN: w.n }; }` },
  'leaves-gust': { note: 'Earth spawn, 176 s: leaves torn off in the storm; 10 frames a second',
    q: SPAWN + '&t=172&pre=4&explorer=0&dist=12&pitch=4&up=3&yaw=210', w: 640, h: 360, crop: [0.2, 0.15, 0.6, 0.7], tile: [320, 210], frames: 12, dt: 0.1, sub: 6,
    probe: `(L) => { const r = P.parts('leaves'), w = P.windEN(0, 0, 2), x = P.where('leaves', 15); return { leaves: r.n, near: x.near, ve: r.e, vn: r.nn, vu: r.u, sp: r.sp, windE: w.e, windN: w.n, h: x.h }; }` },
  // ---- (P15) the gust front at the game's own camera: the boom 5.2 m behind a standing explorer, pivot 2.05 m over the
  // feet, 58 degrees, looking across the wind (the leaves stream across the picture). (numbers: leaves in the box, within
  // 8 and 3 m of the lens, how many show their other side this frame (turned over since the last), the wind) ----
  'leaves-front': { note: "Earth spawn (a temperate wood), 149 s: the first thunderstorm's gust front, at the game's camera (5.2 m boom, 58 degrees), looking across the wind; 10 frames a second",
    q: SPAWN + '&t=146&pre=3&dist=5.2&pitch=3&up=2.05&fov=58&yaw=0', w: 640, h: 360, crop: [0, 0, 1, 1], tile: [320, 180], frames: 12, dt: 0.1, sub: 6,
    before: `(L) => { const w = P.windEN(0, 0, 10); L.yaw = Math.atan2(-w.n, -w.e); window.__w = w; }`,
    probe: `(L) => { const r = P.nearEye('leaves', 8), w = P.windEN(0, 0, 2), b = L.physics.particles.leaves, T = b.turn, B = L.physics.here.blown; let back = 0, flip = 0; const o = window.__side || (window.__side = new Uint8Array(8192)); if (T) for (let i = 0; i < b.count; i++) { const f = Math.cos(T[i]) < 0 ? 1 : 0; back += f; if (f !== o[i]) flip++; o[i] = f; } return { leaves: r.n, eye8: r.eye, eye3: r.eye3, back, turned: flip, torn: Math.round(B.leaves || 0), litter: Math.round(B.litter || 0), stock: P.r2(B.leafStock01 == null ? 1 : B.leafStock01), w2: P.r2(Math.hypot(w.e, w.n)), u10: P.r2(L.info().u10 || 0) }; }` },
  'leaves-front-detail': { note: "the same at 960 x 540, the upper right of the picture at its own pixels (the crowns and the sky the leaves cross), 30 frames a second: does a leaf turn over?",
    q: SPAWN + '&t=146&pre=3.8&dist=5.2&pitch=3&up=2.05&fov=58&yaw=0', w: 960, h: 540, crop: [0.45, 0, 0.55, 0.62], cols: 3, frames: 6, dt: 1 / 30, sub: 2,
    before: `(L) => { const w = P.windEN(0, 0, 10); L.yaw = Math.atan2(-w.n, -w.e); }`,
    probe: `(L) => { const r = P.nearEye('leaves', 8); return { leaves: r.n, eye8: r.eye, eye3: r.eye3 }; }` },
  // ---- (P12) a clamber: a 1 m boulder (radius 0.6 m, PILOT's ground profile) 6 m east of the focus; the camera
  // stands south of it and does not move. (numbers: P.ex() and the height of the ground under the feet over the plain) ----
  'clamber-walk': { note: 'Earth spawn: a walk (4.2 m/s) over a 1 m boulder; 8 frames a second',
    q: SPAWN + '&t=60&pre=1&circle=0.01&rock=1&rockAt=6&rockR=0.6&lookE=6&dist=6.5&pitch=5&up=0.8&yaw=0', w: 640, h: 360, crop: [0.1, 0.25, 0.8, 0.55], tile: [320, 124], cols: 4, frames: 24, dt: 1 / 8, sub: 8,
    before: CLAMBER_BEFORE(1.5), each: `(i, t, ctl) => { ctl.wish = [4.2, 0]; }`, probe: `(L) => P.ex()` },
  'clamber-run': { note: 'Earth spawn: a run (7.4 m/s) over a 1 m boulder; 10 frames a second',
    q: SPAWN + '&t=60&pre=1&circle=0.01&rock=1&rockAt=6&rockR=0.6&lookE=6&dist=6.5&pitch=5&up=0.8&yaw=0', w: 640, h: 360, crop: [0.1, 0.25, 0.8, 0.55], tile: [320, 124], cols: 4, frames: 24, dt: 1 / 10, sub: 6,
    before: CLAMBER_BEFORE(-6, 7.4), each: `(i, t, ctl) => { ctl.wish = [7.4, 0]; }`, probe: `(L) => P.ex()` },
  'clamber-walk-moon': { note: 'the Moon: a walk (4.2 m/s) over a 1 m boulder; 6 frames a second',
    q: 'body=moon&hour=10&t=60&pre=1&circle=0.01&rock=1&rockAt=6&rockR=0.6&lookE=6&dist=6.5&pitch=5&up=0.8&yaw=0', w: 640, h: 360, crop: [0.1, 0.25, 0.8, 0.55], tile: [320, 124], cols: 4, frames: 24, dt: 1 / 6, sub: 10,
    before: CLAMBER_BEFORE(1.5), each: `(i, t, ctl) => { ctl.wish = [4.2, 0]; }`, probe: `(L) => P.ex()` },
  'clamber-run-moon': { note: 'the Moon: a run (7.4 m/s) over a 1 m boulder; 8 frames a second',
    q: 'body=moon&hour=10&t=60&pre=1&circle=0.01&rock=1&rockAt=6&rockR=0.6&lookE=6&dist=6.5&pitch=5&up=0.8&yaw=0', w: 640, h: 360, crop: [0.1, 0.25, 0.8, 0.55], tile: [320, 124], cols: 4, frames: 24, dt: 1 / 8, sub: 8,
    before: CLAMBER_BEFORE(-8, 7.4), each: `(i, t, ctl) => { ctl.wish = [7.4, 0]; }`, probe: `(L) => P.ex()` },
  // (P16) the same run seen from further back, from 10 m before the boulder: where the walker sees it and slows (its soles,
  // within the Moon's grip), the clamber, the run on; probe: the pace it holds for the face it has seen (pA) and how far
  // ahead that face is (ad)
  'clamber-run-moon-long': { note: 'the Moon: a run (7.4 m/s) at a 1 m boulder from 10 m out; 8 frames a second',
    q: 'body=moon&hour=10&t=60&pre=1&circle=0.01&rock=1&rockAt=6&rockR=0.6&lookE=2&dist=12&pitch=6&up=0.8&yaw=0', w: 640, h: 360, crop: [0, 0.3, 1, 0.5], tile: [320, 90], cols: 4, frames: 32, dt: 1 / 8, sub: 8,
    before: CLAMBER_BEFORE(-12, 7.4, -4), each: `(i, t, ctl) => { ctl.wish = [7.4, 0]; }`, probe: `(L) => ({ ...P.ex(), pA: L.ex.phys && L.ex.phys.paceAhead < 1e8 ? P.r2(L.ex.phys.paceAhead) : -1, ad: L.ex.phys && L.ex.phys.ahead ? P.r2(L.ex.phys.ahead.d) : -1 })` },
  // ---- (P12) waves on a shore: the focus is moved to the waterline nearest the place, 2 m up the beach; the camera
  // looks along the shore, turned a little toward the water. (numbers: the sea state, the run-up line (m up the beach
  // from the still waterline), the surf and foam the model reports, the height of the water 6 and 20 m out) ----
  'shore-earth': { note: 'Earth, sea_coast: waves running up the beach; 4 frames a second for 6 s',
    q: 'body=earth&biome=sea_coast&hour=12&t=60&pre=4&explorer=0&follow=1&dist=11&pitch=9&up=0.6', w: 640, h: 360, crop: [0, 0.2, 1, 0.7], tile: [320, 126], cols: 4, frames: 24, dt: 0.25, sub: 15,
    before: SHORE_BEFORE(2, 0.5), probe: SHORE_PROBE },
  // (P15) the same beach in the calmest air it has in two and a half hours (2.4 m/s at 480 s) and in a fresh breeze
  // (8.8 m/s at 1150 s); w80: the water's height 80 m out (beyond PAINTER's first 64 m)
  'shore-earth-calm': { note: 'Earth, sea_coast at 480 s (light air, 2.4 m/s): waves running up the beach; 4 frames a second for 6 s',
    q: 'body=earth&biome=sea_coast&hour=12&t=468&pre=4&explorer=0&follow=1&dist=11&pitch=9&up=0.6', w: 640, h: 360, crop: [0, 0.2, 1, 0.7], tile: [320, 126], cols: 4, frames: 24, dt: 0.25, sub: 15,
    before: SHORE_BEFORE(2, 0.5), probe: SHORE_PROBE },
  'shore-earth-breeze': { note: 'Earth, sea_coast at 1150 s (a fresh breeze, 8.8 m/s): waves running up the beach; 4 frames a second for 6 s',
    q: 'body=earth&biome=sea_coast&hour=12&t=1138&pre=4&explorer=0&follow=1&dist=11&pitch=9&up=0.6', w: 640, h: 360, crop: [0, 0.2, 1, 0.7], tile: [320, 126], cols: 4, frames: 24, dt: 0.25, sub: 15,
    before: SHORE_BEFORE(2, 0.5), probe: SHORE_PROBE },
  // (P15) out to sea from the waterline, low (does the sea heave beyond PAINTER's first 64 m? white horses?), a frame every 0.5 s
  'sea-out-earth-breeze': { note: 'Earth, sea_coast at 1150 s (8.8 m/s, Hs 0.64 m): out to sea from 2 m up the beach, the eye 1.6 m up; a frame every 0.5 s',
    q: 'body=earth&biome=sea_coast&hour=12&t=1138&pre=4&explorer=0&follow=1&dist=4&pitch=2&up=1.6&fov=58', w: 640, h: 360, crop: [0, 0.1, 1, 0.8], tile: [320, 144], cols: 4, frames: 12, dt: 0.5, sub: 30,
    before: SHORE_BEFORE(2, 0, `const S = window.__shore; if (S) L.yaw = Math.atan2(-S.oe, S.on);`), probe: SHORE_PROBE },
  'sea-out-neptune': { note: 'Neptune, storm_seas at 44 to 50 s (30 m/s, Hs 2.8 m): out to sea from 4 m up the beach, the eye 1.6 m up; a frame every 0.5 s',
    q: 'body=neptune&biome=storm_seas&t=34&hour=11&pre=4&explorer=0&follow=1&dist=4&pitch=2&up=1.6&fov=58', w: 640, h: 360, crop: [0, 0.1, 1, 0.8], tile: [320, 144], cols: 4, frames: 12, dt: 0.5, sub: 30,
    before: SHORE_BEFORE(4, 0, `const S = window.__shore; if (S) L.yaw = Math.atan2(-S.oe, S.on);`), probe: SHORE_PROBE },
  'shore-neptune': { note: 'Neptune, storm_seas at 40 s (waves 2.8 m, 29 m/s): the surf line along the shore; 4 frames a second for 6 s',
    q: 'body=neptune&biome=storm_seas&t=34&hour=11&pre=4&explorer=0&follow=1&dist=16&pitch=8&up=1', w: 640, h: 360, crop: [0, 0.15, 1, 0.75], tile: [320, 135], cols: 4, frames: 24, dt: 0.25, sub: 15,
    before: SHORE_BEFORE(4, 0.5), probe: SHORE_PROBE },
  // ---- (P12) spray, and nothing else: every other kit is hidden, so each pale dash in the picture is a drop of spray.
  // The focus stands at the waterline; after 12 s (the count has grown) the camera is turned to where the spray is. ----
  'spray-neptune': { note: 'Neptune, storm_seas, 46 to 49 s: spray alone (rain, rings and marks hidden), looking where it is; 4 frames a second',
    q: 'body=neptune&biome=storm_seas&t=34&hour=11&pre=4&explorer=0&follow=1&dist=12&pitch=4&up=1.6', w: 640, h: 360, crop: [0, 0.1, 1, 0.8], tile: [320, 144], cols: 4, frames: 12, dt: 0.25, sub: 15,
    before: SHORE_BEFORE(1, 0, `L.run(8, 1 / 30); const x = P.where('spray', 60), me = L.enu(L.ex.p); window.__spray = x; if (x.n) L.yaw = Math.atan2(-(x.e - me.e), x.nn - me.n);`),
    each: `(i, t, ctl, L) => { if (L.kits) for (const o of L.kits.objects) o.userData.hide = !/spray/.test(o.name || ''); }`,
    probe: `(L) => { const x = P.where('spray', 60), r = P.parts('spray'), s = L.info().seaState || {}, me = L.enu(L.ex.p); return { spray: x.n, e: P.r2(x.e - me.e), n: P.r2(x.nn - me.n), h: x.h, near: x.near, sp: r.sp, ve: r.e, vn: r.nn, vu: r.u, Hs: s.Hs, spume: P.r2(L.physics.here.blown.spume || 0), surf: P.r2(L.physics.here.blown.surf || 0) }; }` },
  // ---- water: the camera is turned toward where the spray is ----
  'sea-neptune': { note: 'Neptune, the storm coast at 40 s (waves 2.8 m): the surf and the spray, looking where the spray is; 6 frames a second',
    q: 'body=neptune&biome=storm_seas&t=34&hour=11&pre=6&explorer=0&dist=14&pitch=7&up=1.5', w: 640, h: 360, crop: [0.15, 0.15, 0.7, 0.7], tile: [320, 180], frames: 12, dt: 1 / 6, sub: 10,
    before: `(L) => { const x = P.where('spray', 40); window.__spray = x; if (x.n) L.yaw = Math.atan2(-x.e, x.nn); }`,
    probe: `(L) => { const x = P.where('spray', 40), r = P.parts('spray'), s = L.info().seaState || {}; return { spray: x.n, near: x.near, e: x.e, n: x.nn, h: x.h, sp: r.sp, vu: r.u, Hs: s.Hs, cover: s.cover, spume: P.r2(L.physics.here.blown.spume || 0), surf: P.r2(L.physics.here.blown.surf || 0) }; }` },
};

function arg(name, d) { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : d; }

async function filmOne(name, S, { root, out, tag, extra, quality }) {
  const q = 'painted=1&freeze=1&quality=' + quality + '&' + S.q + (extra ? '&' + extra : '');
  const t0 = Date.now();
  const { page, problems, close } = await openPage({ pagePath: '/physics-lab.html?' + q, w: S.w || 720, h: S.h || 405, root });
  let res = null;
  try {
    await page.waitForFunction('window.__pcReady === true', null, { timeout: 900000, polling: 500 });
    await page.evaluate(PAGE_HELPERS);
    if (S.before) await page.evaluate(`(${S.before})(window.__lab)`);
    res = await page.evaluate((o) => window.__lab.film(o), { frames: S.frames || 12, dt: S.dt || 1 / 15, sub: S.sub || 2, crop: S.crop, tile: S.tile, cols: S.cols || 4, each: S.each, probe: S.probe, quality: 0.85 });
    res.info = await page.evaluate('window.__lab.info()');
  } catch (e) { problems.push('FILM FAILED: ' + String(e.message).split('\n')[0]); }
  await close();
  const base = path.join(out, 'motion-' + name + (tag ? '-' + tag : ''));
  if (res) {
    fs.writeFileSync(base + '.jpg', Buffer.from(res.sheet.split(',')[1], 'base64'));
    const rec = { subject: name, note: S.note, url: '/physics-lab.html?' + q, frames: res.numbers.length, dt: res.dt, hz: res.hz, sheet: [res.w, res.h], info: res.info, numbers: res.numbers };
    fs.writeFileSync(base + '.json', JSON.stringify(rec) + '\n');
    // the table: one line a frame
    const keys = S.cols2 || Object.keys(res.numbers[0] || {});
    const flat = (v) => (v && typeof v === 'object' ? Object.entries(v).map(([k, x]) => k + ':' + x).join(' ') : String(v));
    console.log(`# ${name}: ${res.numbers.length} frames, ${res.dt.toFixed(4)} s apart, simulated at ${res.hz} Hz, sheet ${res.w}x${res.h}, ${((Date.now() - t0) / 1000).toFixed(0)} s to make`);
    console.log('#  i  ' + keys.join('  '));
    res.numbers.forEach((r, i) => console.log(String(i).padStart(4) + '  ' + keys.map((k) => flat(r[k])).join('  ')));
    console.log('wrote ' + base + '.jpg and .json');
  }
  if (problems.length) { console.log('PROBLEMS (' + problems.length + '):'); for (const p of [...new Set(problems)].slice(0, 12)) console.log('  ' + p); }
  return !!res && !problems.length;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const which = process.argv[2];
  if (!which || which === 'list') { for (const k in SUBJECTS) console.log(k.padEnd(18) + (SUBJECTS[k].note || '')); process.exit(0); }
  const names = which === 'all' ? Object.keys(SUBJECTS) : which.split(',');
  const o = { root: arg('root', undefined), out: path.resolve(arg('out', path.join(REPO, 'docs/shots/physics'))), tag: arg('tag', ''), extra: arg('q', ''), quality: arg('quality', '1') };
  fs.mkdirSync(o.out, { recursive: true });
  let ok = true;
  for (const n of names) { if (!SUBJECTS[n]) { console.log('no such subject: ' + n); ok = false; continue; } ok = (await filmOne(n, SUBJECTS[n], o)) && ok; }
  process.exit(ok ? 0 : 1);
}
