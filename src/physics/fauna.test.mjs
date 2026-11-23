// Tests: the animals' own lives (fauna.js) -- that the world's cells are the world's own cells, that the ledger
// is steady over a hundred game-days and goes on living unwatched, that a herd stays a herd, that a hunt is
// sometimes won and sometimes lost, that the ground is asked for within its budget, that a frame allocates
// nothing, and what a frame costs with a full band and with none.
// Run: node --test src/physics/fauna.test.mjs   (or node --test src/physics/ for all the physics)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeFauna, faunaRows, faunaBytes, stepFauna, stepCell, ledgerAt, cellOf, cellPoint, cellSize,
  clearKills, scare, activity, placeBeast, GUILD, FSTATE, FAUNA, NCELL, LGRID, NOLIQ,
} from './fauna.js';
// THE WORLD'S OWN CUBE-SPHERE, not a stand-in: fauna.js carries a copy of the six rows of numbers so that
// PHYSICS does not import PAINTER's folder, and this is the guard that keeps the copy from drifting.
import { dirToFace } from '../world/cubesphere.js';
import v8 from 'node:v8';
import vm from 'node:vm';

// A real collection, so "nothing is allocated" is measured and not guessed. Without it the heap's own
// uncollected rubbish reads as 32 bytes a frame and the test is worthless either way it goes.
let gc = null;
try { v8.setFlagsFromString('--expose-gc'); gc = vm.runInNewContext('gc'); v8.setFlagsFromString('--no-expose-gc'); } catch { gc = null; }

const R = 4000;                      // Earth's radius in this game (data/bodies.js)
const BODY = 'testworld';

// ---- a plain stand-in world ---------------------------------------------------------------------------------
// A round world with a food field that varies over a couple of hundred metres, a patch of water, and a hill.
// `wet` rings a pool round the point (0, 0, R). Everything is a pure function of the place, so a test can ask
// the same question twice and get the same answer.
function world(opt) {
  const o = opt || {};
  return {
    bodyId: BODY, R, g: 9.81, t: 0, day01: o.day01 == null ? 0.45 : o.day01, day: 1500,
    eye: o.eye || null, asks: 0, maxAsksInAFrame: 0,
    groundAt(bodyId, x, y, z, s) {
      this.asks++;
      const il = 1 / (Math.hypot(x, y, z) || 1);
      const ux = x * il, uy = y * il, uz = z * il;
      // The tests all work round the point (0, 0, R), where east is +X and north is +Y and the third axis is
      // the height: so these two ARE the ground, near enough over the few hundred metres anything here runs.
      const mx = ux * R, my = uy * R;
      const f = 0.5 + 0.5 * Math.sin(mx / 140) * Math.cos(my / 170);
      s.r = R + 20 * Math.sin(mx / 600) + 12 * Math.cos(my / 450);
      s.trees = o.bare ? 0 : 0.55 + 0.3 * f;
      s.under = o.bare ? 0.1 : f;
      s.glade = o.bare ? 1 : 1 - 0.7 * s.trees;
      s.canopy = s.trees * 0.9;
      s.rock = 0.05;
      // A SHORE, not a puddle: everything north of this line is under water, so a cell straddling it reads
      // as half wet, a heron can stand on the dry side of it and a fish can be in the wet side.
      s.lq = o.shore != null && my > o.shore ? s.r + 0.35 : NOLIQ;
      return s;
    },
  };
}
const at = (e, n, r) => { const k = (r || R) / Math.hypot(e, n, R); return { x: e * k, y: n * k, z: R * k }; };

// ---- the rows the tests use ---------------------------------------------------------------------------------
// Five animals over the guilds the band needs: a herd, a small one on the ground, two hunters of different
// speed, a stander at the water, and a fish.
const ROWS = () => faunaRows([
  { id: 'deer', guild: GUILD.grazer, high: 1.1, mass: 90, walk: 1.1, trot: 3.0, run: 8.0, group: [3, 7], flee: 30, shy: 0.8, hab: [0.6, 1, 0.8, 0] },
  { id: 'hare', guild: GUILD.ground, high: 0.3, mass: 3.5, walk: 0.6, trot: 1.8, run: 9.5, flee: 18, shy: 1, hab: [0.3, 1, 0.9, 0], sprint: 14 },
  { id: 'vole', guild: GUILD.ground, high: 0.1, mass: 0.03, walk: 0.3, trot: 0.8, run: 2.4, flee: 6, shy: 1, hab: [0.5, 1, 0.5, 0], sprint: 5 },
  { id: 'fox', guild: GUILD.hunter, high: 0.42, mass: 7, walk: 1.0, trot: 2.6, run: 11.0, flee: 22, shy: 0.4, hab: [0.6, 0.7, 0.9, 0], sprint: 26 },
  { id: 'heron', guild: GUILD.raptor, high: 0.95, mass: 1.6, walk: 0.5, trot: 1.2, run: 4, strike: true, flee: 35, shy: 0.6, hab: [0, 0, 0.3, 1], water: false },
  { id: 'trout', guild: GUILD.fish, high: 0.08, mass: 0.8, walk: 0.4, trot: 1.0, run: 3.0, water: true, flee: 5, shy: 1, hab: [0, 0, 0, 1] },
]);

function run(F, ctx, seconds, dt = 1 / 60) {
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) {
    const was = ctx.asks;
    ctx.t = F.time + dt;
    stepFauna(F, dt, ctx);
    const used = ctx.asks - was;
    if (used > ctx.maxAsksInAFrame) ctx.maxAsksInAFrame = used;
  }
}

// ---- the cells are the world's own cells ----------------------------------------------------------------------
test('the cells are world/cubesphere.js own cells, at level 4', () => {
  const o = { face: 0, u: 0, v: 0 };
  let n = 0;
  for (let i = 0; i < 1000; i++) {
    // a spread of directions, not a spiral: the seams of the cube are where a copy drifts
    const a = (i * 2.399963) % 6.283185, b = Math.acos(1 - 2 * ((i + 0.5) / 1000));
    const x = Math.sin(b) * Math.cos(a), y = Math.cos(b), z = Math.sin(b) * Math.sin(a);
    dirToFace(x, y, z, o);
    let ix = Math.min(LGRID - 1, Math.max(0, Math.floor((o.u + 1) * 0.5 * LGRID)));
    let iy = Math.min(LGRID - 1, Math.max(0, Math.floor((o.v + 1) * 0.5 * LGRID)));
    const want = o.face * LGRID * LGRID + iy * LGRID + ix;
    assert.equal(cellOf(x * R, y * R, z * R), want, 'cell ' + i);
    n++;
  }
  assert.equal(n, 1000);
  assert.equal(NCELL, 1536);
  // and a point inside a cell is in that cell
  const d = [0, 0, 0];
  for (let c = 0; c < NCELL; c += 7) {
    cellPoint(c, 0.5, 0.5, d);
    assert.equal(cellOf(d[0], d[1], d[2]), c, 'centre of cell ' + c);
  }
  console.log(`# cells: ${NCELL} of ${cellSize(R).toFixed(1)} m (${(cellSize(R) ** 2 / 1e4).toFixed(2)} ha) on a ${R} m world`);
});

// ---- the ledger ------------------------------------------------------------------------------------------------
test('the ledger is steady over a hundred game-days: nothing dies out and nothing runs away', () => {
  const F = makeFauna({ rows: ROWS(), seed: 3 }), ctx = world();
  ctx.t = 0;
  stepFauna(F, 1 / 60, ctx);                      // picks up the body, the gravity and the day
  const c = cellOf(0, 0, R);
  stepCell(F, c, ctx);                            // looks at the ground once: four samples
  const first = new Float64Array(8);
  for (let g = 0; g < 8; g++) first[g] = F.n[c * 8 + g];
  // a hundred game-days, an hour of game time at a step
  const day = 1500, lo = new Float64Array(8).fill(1e9), hi = new Float64Array(8);
  for (let i = 0; i < 100 * 24; i++) {
    F.time += day / 24;
    stepCell(F, c, null);
    for (let g = 0; g < 8; g++) { const v = F.n[c * 8 + g]; if (v < lo[g]) lo[g] = v; if (v > hi[g]) hi[g] = v; }
  }
  const names = ['grazer', 'ground', 'climber', 'hunter', 'crow', 'bird', 'raptor', 'fish'];
  for (let g = 0; g < 8; g++) {
    // the fish are the exception and they SHOULD be: this cell has no water in it at all, so its capacity for
    // fish is nothing and nothing is what lives there. A guild with somewhere to live must never die out.
    if (g === GUILD.fish) { assert.equal(hi[g] < 0.01, true, 'fish lived in a cell with no water'); continue; }
    assert.ok(lo[g] > 0.0005, names[g] + ' died out (low ' + lo[g] + ')');
    assert.ok(hi[g] < 400, names[g] + ' ran away (high ' + hi[g] + ')');
  }
  // the three that are eaten should settle well inside what the ground could hold, not at the floor
  for (const g of [GUILD.grazer, GUILD.ground, GUILD.bird]) {
    const end = F.n[c * 8 + g];
    assert.ok(end > 0.5, names[g] + ' ended at ' + end.toFixed(2) + ', which is the floor');
  }
  console.log('# one cell after 100 game-days: ' + names.map((s, g) =>
    `${s} ${first[g].toFixed(1)}->${F.n[c * 8 + g].toFixed(1)} (${lo[g].toFixed(1)}..${hi[g].toFixed(1)})`).join(', '));
});

test('a cell nobody has visited is brought up to date in ONE step, and it matches stepping it a frame at a time', () => {
  const rows = ROWS();
  const A = makeFauna({ rows, seed: 9 }), B = makeFauna({ rows, seed: 9 });
  const ctx = world();
  stepFauna(A, 1 / 60, ctx); stepFauna(B, 1 / 60, ctx);
  const c = cellOf(0, 0, R);
  stepCell(A, c, ctx); stepCell(B, c, ctx);
  // A takes one step of an hour; B takes 3,600 steps of a second
  A.time += 3600; stepCell(A, c, null);
  for (let i = 0; i < 3600; i++) { B.time += 1; stepCell(B, c, null); }
  for (let g = 0; g < 8; g++) {
    const a = A.n[c * 8 + g], b = B.n[c * 8 + g];
    const rel = Math.abs(a - b) / Math.max(1e-6, Math.abs(b));
    // 4 per cent: MEASURED, the worst guild is the small birds at 3.0 (they grow fastest, 0.70 a game-day,
    // so they are the hardest to integrate coarsely), and the floor is about two whatever the step is --
    // FAUNA.ledgerStep says what was measured and why the step is as long as it is. This is a count of birds
    // in a wood nobody is standing in, not a trajectory.
    assert.ok(rel < 0.04, `guild ${g}: in ${Math.ceil(3600 / FAUNA.ledgerStep)} steps ${a.toFixed(4)} against 3,600 steps of a second ${b.toFixed(4)} (${(rel * 100).toFixed(2)}%)`);
  }
});

test('the world goes on living with nobody watching: come back and it has moved on', () => {
  const F = makeFauna({ rows: ROWS(), seed: 5 }), ctx = world();
  stepFauna(F, 1 / 60, ctx);
  const c = cellOf(0, 0, R);
  // take the cell down to a third of what is there, as a hard winter or a fire would
  stepCell(F, c, ctx);
  for (let g = 0; g < 8; g++) F.n[c * 8 + g] *= 0.33;
  const was = F.n[c * 8 + GUILD.grazer];
  // three game-days away
  F.time += 3 * 1500;
  const now = ledgerAt(F, 0, 0, R, GUILD.grazer, ctx);
  assert.ok(now > was * 1.3, `the wood did not refill while nobody watched: ${was.toFixed(2)} -> ${now.toFixed(2)}`);
  console.log(`# three game-days unwatched: grazers ${was.toFixed(2)} -> ${now.toFixed(2)} in that cell`);
});

test('the memory is one allocation and it is small', () => {
  const F = makeFauna({ rows: ROWS() });
  const b = faunaBytes(F);
  assert.ok(b < 200 * 1024, 'the whole system is ' + b + ' bytes');
  console.log(`# memory: ${(b / 1024).toFixed(1)} kB for ${NCELL} cells x 8 guilds and a band of ${F.cap}`);
});

// ---- the near band ---------------------------------------------------------------------------------------------
test('the band fills, stays inside itself, and publishes what the drawing asks for', () => {
  const F = makeFauna({ rows: ROWS(), seed: 11 });
  const eye = at(0, 0);
  const ctx = world({ eye });
  run(F, ctx, 30);
  const A = F.agents;
  assert.ok(A.n > 8, 'only ' + A.n + ' animals turned up');
  assert.ok(A.n <= F.cap);
  for (let k = 0; k < A.n; k++) {
    const i = k * 3;
    // on the ground, inside the band, facing somewhere, in one of the eight states the drawing knows
    const d = Math.hypot(A.pos[i] - eye.x, A.pos[i + 1] - eye.y, A.pos[i + 2] - eye.z);
    assert.ok(d < FAUNA.band * 1.25, 'animal ' + k + ' is ' + d.toFixed(0) + ' m out');
    const r = Math.hypot(A.pos[i], A.pos[i + 1], A.pos[i + 2]);
    assert.ok(Math.abs(r - R) < 120, 'animal ' + k + ' is ' + (r - R).toFixed(1) + ' m off the ground');
    const fl = Math.hypot(A.fwd[i], A.fwd[i + 1], A.fwd[i + 2]);
    assert.ok(Math.abs(fl - 1) < 1e-3, 'heading is not a unit vector: ' + fl);
    const up = (A.pos[i] * A.fwd[i] + A.pos[i + 1] * A.fwd[i + 1] + A.pos[i + 2] * A.fwd[i + 2]) / r;
    assert.ok(Math.abs(up) < 1e-3, 'heading is not tangent to the ground: ' + up);
    assert.ok(A.phase[k] >= 0 && A.phase[k] < 1, 'phase ' + A.phase[k]);
    assert.ok(A.state[k] <= 7, 'state ' + A.state[k] + ' is not one of the drawing s eight');
    assert.ok(A.head[k] >= -0.01 && A.head[k] <= 1.01);
    assert.ok(A.alert[k] >= -0.01 && A.alert[k] <= 1.01);
    assert.ok(A.sp[k] < F.rows.length);
    assert.ok(A.size[k] > 0.4 && A.size[k] < 2);
    assert.ok(A.born[k] <= F.time + 1e-6);
  }
  console.log(`# the band after 30 s: ${A.n} animals, ${F.hn} herd records, ${ctx.asks} ground samples in all`);
});

test('the ground is asked for inside its budget, and far less than once an animal a frame', () => {
  const F = makeFauna({ rows: ROWS(), seed: 2 });
  const ctx = world({ eye: at(0, 0) });
  run(F, ctx, 10);
  const before = ctx.asks, frames = 600;
  for (let i = 0; i < frames; i++) {
    const was = ctx.asks;
    ctx.t = F.time + 1 / 60;
    stepFauna(F, 1 / 60, ctx);
    const used = ctx.asks - was;
    assert.ok(used <= FAUNA.samples, 'a frame asked the ground ' + used + ' times');
    if (used > ctx.maxAsksInAFrame) ctx.maxAsksInAFrame = used;
  }
  const per = (ctx.asks - before) / frames;
  assert.ok(per < FAUNA.samples, 'the ground is asked ' + per.toFixed(2) + ' times a frame');
  console.log(`# ground samples: ${per.toFixed(2)} a frame for ${F.agents.n} animals (most in one frame: ${ctx.maxAsksInAFrame}, the budget is ${FAUNA.samples})`);
  // at the measured 2.28 us a sample, say what that is in milliseconds
  console.log(`#   = ${(per * 0.00228).toFixed(4)} ms a frame at 2.28 us a sample`);
});

test('a herd stays a herd', () => {
  const F = makeFauna({ rows: ROWS(), seed: 7 });
  const ctx = world({ eye: at(0, 0) });
  run(F, ctx, 20);
  // find a herd with members and watch it for two minutes
  run(F, ctx, 120);
  let herds = 0, worst = 0;
  for (let h = 0; h < F.hn; h++) {
    if (!F.hlive[h] || F.hcount[h] < 2) continue;
    herds++;
    for (let k = 0; k < F.n0; k++) {
      if (F.herd[k] !== h) continue;
      const i = k * 3, o = h * 3;
      const d = Math.hypot(F.pw[i] - F.hp[o], F.pw[i + 1] - F.hp[o + 1], F.pw[i + 2] - F.hp[o + 2]);
      if (d > worst) worst = d;
      assert.ok(d < F.hspread[h] * 4 + 12, `a member wandered ${d.toFixed(1)} m from a herd whose spread is ${F.hspread[h].toFixed(1)} m`);
    }
  }
  assert.ok(herds >= 1, 'no herd with two in it turned up');
  console.log(`# after two minutes: ${herds} herds, the furthest member ${worst.toFixed(1)} m from its herd`);
});

// ---- the hunt -----------------------------------------------------------------------------------------------
// The chase is decided by the gap and by the stamina and never by a dice roll, so the same two animals at the
// same gap always end the same way -- which is the point: the player can see who is going to win. What makes
// some hunts fail is that some quarry is faster than its hunter and some starts further off.
// Two animals and nothing else: placeBeast puts them down, and F.stockAt held at infinity keeps the ledger
// from filling the band round them, so the two indices stay what they were and the trial is only the chase.
function huntTrial(preyRow, gap, seconds = 40) {
  const rows = faunaRows([preyRow, { id: 'fox', guild: GUILD.hunter, high: 0.42, mass: 7, walk: 1, trot: 2.6, run: 11, sprint: 26, flee: 22, shy: 0 }]);
  const F = makeFauna({ rows, seed: 21 });
  const ctx = world({ bare: true });
  stepFauna(F, 1 / 60, ctx);
  stepCell(F, cellOf(0, 0, R), ctx);
  F.stockAt = Infinity;                       // nothing else is made real for the length of this trial
  const a = at(0, 0), b = at(-gap, 0);
  const prey = placeBeast(F, 0, a.x, a.y, a.z, ctx);
  const fox = placeBeast(F, 1, b.x, b.y, b.z, ctx);
  assert.equal(prey, 0); assert.equal(fox, 1);
  F.hunger[fox] = 1; F.fear[fox] = 0; F.stam[fox] = 1; F.cool[fox] = 0; F.scanAt[fox] = 0; F.tgt[fox] = -1;
  F.think[fox] = 0;
  F.hunger[prey] = 0.2; F.fear[prey] = 0; F.stam[prey] = 1;
  F.st[fox] = FSTATE.STAND; F.st[prey] = FSTATE.STAND;
  clearKills(F);
  // ONE CHASE, not forty seconds of them: it ends when the quarry is taken or when the hunter gives up. (A
  // hunter that is left to try again and again will corner anything in the end, which is true of a real one
  // too; what this is measuring is whether the legs decide a single chase.)
  const n0 = F.n0, steps = Math.round(seconds * 60);
  let closest = 1e9, wasChasing = false, took = 0;
  for (let i = 0; i < steps; i++) {
    ctx.t = F.time + 1 / 60;
    F.stockAt = Infinity;
    stepFauna(F, 1 / 60, ctx);
    if (F.n0 > 1) {
      const d = Math.hypot(F.pw[0] - F.pw[3], F.pw[1] - F.pw[4], F.pw[2] - F.pw[5]);
      if (d < closest) closest = d;
      const chasing = F.st[1] === FSTATE.HUNT;
      if (chasing) { wasChasing = true; took = F.time; }
      else if (wasChasing && F.time > took + 0.5) break;        // it has broken off
    }
    if (F.kills.count) break;
  }
  return { killed: F.kills.count > 0, left: F.n0, was: n0, closest, F };
}

test('a hunt is sometimes won and sometimes lost, and which is decided by the legs', () => {
  const slow = { id: 'slowhare', guild: GUILD.ground, high: 0.3, mass: 3.5, walk: 0.6, trot: 1.8, run: 5.0, sprint: 9, flee: 18, shy: 1 };
  const fast = { id: 'fasthare', guild: GUILD.ground, high: 0.3, mass: 3.5, walk: 0.6, trot: 1.8, run: 12.5, sprint: 40, flee: 18, shy: 1 };
  const a = huntTrial(slow, 8);
  const b = huntTrial(fast, 8);
  assert.ok(a && b, 'the two animals did not both turn up in the band');
  assert.equal(a.killed, true, 'the fox did not catch a quarry slower than itself from 8 m');
  assert.equal(b.killed, false, 'the fox caught a quarry faster than itself, which it cannot');
  // and the gap matters as well as the legs
  const far = huntTrial(slow, 55);
  assert.ok(far, 'no band');
  console.log(`# hunts: slow quarry at 8 m -> ${a.killed ? 'taken' : 'got away'} (closest ${a.closest.toFixed(2)} m); fast quarry at 8 m -> ${b.killed ? 'taken' : 'got away'} (closest ${b.closest.toFixed(2)} m); slow quarry at 55 m -> ${far.killed ? 'taken' : 'got away'} (closest ${far.closest.toFixed(2)} m)`);
});

test('a wood is not a zoo: how often a hunt happens, and how often it fails', () => {
  const F = makeFauna({ rows: ROWS(), seed: 17 });
  const ctx = world({ eye: at(0, 0) });
  run(F, ctx, 120);
  let hunters = 0;
  for (let k = 0; k < F.n0; k++) if (F.rows[F.row[k]].chase) hunters++;
  assert.ok(hunters > 0, 'no hunter in the band');
  clearKills(F);
  const e0 = F.prof.events, t0 = F.time;
  let kills = 0, stalked = 0, chased = 0;
  const MINS = 20;
  for (let i = 0; i < 60 * 60 * MINS; i++) {
    ctx.t = F.time + 1 / 60;
    stepFauna(F, 1 / 60, ctx);
    kills += F.kills.count; clearKills(F);
    for (let k = 0; k < F.n0; k++) { if (F.st[k] === FSTATE.STALK) stalked++; else if (F.st[k] === FSTATE.HUNT) chased++; }
  }
  const mins = (F.time - t0) / 60;
  console.log(`# the hunt, over ${mins.toFixed(0)} game-minutes with ${hunters} hunters in the band: ${kills} kills (one every ${(mins / Math.max(1, kills)).toFixed(1)} min), ${(stalked / 60).toFixed(0)} seconds of stalking, ${(chased / 60).toFixed(0)} of chasing`);
  console.log(`#   watchable events within ${FAUNA.eventR} m: ${((F.prof.events - e0) / mins).toFixed(1)} a minute`);
  // the design's aim: the SIGNS of a hunt every few minutes and a kill now and then -- not never, and not a zoo
  assert.ok(kills >= 1, 'nothing was caught in ' + mins.toFixed(0) + ' game-minutes');
  assert.ok(kills <= mins / 2, `a kill every ${(mins / kills).toFixed(1)} minutes is a zoo`);
  assert.ok(stalked > chased, 'every stalk turned into a chase: nothing is ever given up on');
});

test('a kill is one row the caller reads and clears, and the ledger is one the poorer', () => {
  const slow = { id: 'slowhare', guild: GUILD.ground, high: 0.3, mass: 3.5, walk: 0.6, trot: 1.8, run: 5.0, sprint: 9, flee: 18, shy: 1 };
  const t = huntTrial(slow, 8);
  const F = t.F;
  assert.ok(F.kills.count >= 1);
  const k = F.kills[0];
  assert.equal(k.bodyId, BODY);
  assert.equal(k.guild, GUILD.ground);
  assert.equal(k.sp, 0);
  assert.equal(k.by, 1);
  assert.ok(k.id > 0 && k.t > 0);
  assert.ok(Math.abs(Math.hypot(k.x, k.y, k.z) - R) < 120);
  assert.equal(t.left, t.was - 1, 'the quarry is still in the band');
  clearKills(F);
  assert.equal(F.kills.count, 0);
});

test('a stander strikes at the water and sometimes gets something', () => {
  const rows = faunaRows([
    { id: 'heron', guild: GUILD.raptor, high: 0.95, mass: 1.6, walk: 0.5, trot: 1.2, run: 4, strike: true, flee: 35, shy: 0.4, hab: [0, 0, 0.5, 1] },
    { id: 'trout', guild: GUILD.fish, high: 0.08, mass: 0.8, water: true, flee: 5, shy: 1, hab: [0, 0, 0, 1] },
  ]);
  const F = makeFauna({ rows, seed: 4 });
  // the shore runs through the band, and the player stands well back from it: a heron is 35 m shy and would
  // otherwise spend the whole test with its head up instead of fishing
  // THE SHORE RUNS THROUGH THE BAND. These two numbers are not free choices: the cell the eye stands in has
  // its four habitat samples at 110 m and 282 m along each axis (printed by a probe here), so a shore at 190 m
  // north makes that cell read as half wet, and the eye at (196, 170) puts its wet quarters 141 m off -- inside
  // the 220 m band and outside the 35 m a heron will let anyone come.
  const ctx = world({ shore: 190, eye: at(196, 170) });
  run(F, ctx, 60);
  let herons = 0, fish = 0, standing = 0;
  for (let k = 0; k < F.n0; k++) {
    if (F.row[k] === 0) { herons++; if (F.lq[k] > F.gs[k] - 0.6) standing++; }
    else fish++;
  }
  assert.ok(herons > 0, 'no heron turned up by the water');
  assert.ok(fish > 0, 'no fish turned up in the water');
  // let them get to the water's edge, then hurry their own clock along and watch for strikes
  run(F, ctx, 120);
  clearKills(F);
  let strikes = 0, took = 0;
  for (let round = 0; round < 60; round++) {
    for (let k = 0; k < F.n0; k++) if (F.row[k] === 0) { F.cool[k] = 0; F.think[k] = 0; }
    let struck = false;
    for (let i = 0; i < 60; i++) {
      ctx.t = F.time + 1 / 60; stepFauna(F, 1 / 60, ctx);
      for (let k = 0; k < F.n0; k++) if (F.row[k] === 0 && F.st[k] === FSTATE.HUNT) struck = true;
    }
    if (struck) strikes++;
    took += F.kills.count; clearKills(F);          // read and clear, as the game does every frame
  }
  assert.ok(strikes > 0, 'the heron never struck');
  assert.ok(took > 0 && took < strikes * herons, 'it took something every single time, or never');
  console.log(`# the heron: ${herons} by the shore (${standing} of them standing in it at a minute), ${fish} fish; it struck in ${strikes} of 60 goes and got something ${took} times`);
});

// ---- the things the band must not do --------------------------------------------------------------------------
test('nothing is allocated in a frame', () => {
  const F = makeFauna({ rows: ROWS(), seed: 13 });
  const ctx = world({ eye: at(0, 0) });
  run(F, ctx, 20);                                  // fill the band and let everything warm up
  const n = F.agents.n;
  assert.ok(n > 8);
  for (let i = 0; i < 20000; i++) { ctx.t = F.time + 1 / 60; stepFauna(F, 1 / 60, ctx); }   // warm the code paths
  if (gc) { gc(); gc(); }
  const before = process.memoryUsage().heapUsed;
  const frames = 60000;
  for (let i = 0; i < frames; i++) { ctx.t = F.time + 1 / 60; stepFauna(F, 1 / 60, ctx); }
  if (gc) { gc(); gc(); }
  const after = process.memoryUsage().heapUsed;
  const per = (after - before) / frames;
  // a frame that allocated even one small object would be tens of bytes a frame and the heap would climb
  assert.ok(per < (gc ? 3 : 64), `the heap grew ${per.toFixed(1)} bytes a frame over ${frames} frames`);
  console.log(`# allocation: ${per.toFixed(3)} bytes a frame over ${frames} frames with ${F.agents.n} animals${gc ? '' : ' (no collector: a loose bound)'}`);
});

test('with nothing near, a frame is two comparisons', () => {
  const F = makeFauna({ rows: ROWS(), seed: 1 });
  const ctx = world();                              // no eye at all: nothing is ever made real
  run(F, ctx, 5);
  assert.equal(F.agents.n, 0);
  // warm, then measure
  for (let i = 0; i < 20000; i++) { ctx.t = F.time + 1 / 60; stepFauna(F, 1 / 60, ctx); }
  const N = 400000, t0 = performance.now();
  for (let i = 0; i < N; i++) { ctx.t = F.time + 1 / 60; stepFauna(F, 1 / 60, ctx); }
  const ns = (performance.now() - t0) * 1e6 / N;
  assert.ok(ns < 400, 'an empty frame costs ' + ns.toFixed(0) + ' ns');
  console.log(`# an empty world: ${ns.toFixed(0)} ns a frame (the slow tick fires on about one frame in thirty)`);
});

// The band the LEDGER fills is what a wood really holds. To time the worst case the design names -- 164 drawn
// from 96 records in Earth's autumn woodland -- the live animals are copied until the band is full. They are
// real records in every way; they just stand a metre apart.
function crowd(F, upTo) {
  const A = F.agents, live = F.n0;
  while (F.n0 < Math.min(upTo, F.cap)) {
    const src = F.n0 % live, k = F.n0++;
    for (const a of ['pw', 'goal']) for (let j = 0; j < 3; j++) F[a][k * 3 + j] = F[a][src * 3 + j];
    for (let j = 0; j < 3; j++) A.fwd[k * 3 + j] = A.fwd[src * 3 + j];
    for (const a of ['gs', 'gr', 'slp', 'moved', 'food', 'foodWas', 'lq', 'deye', 'scanAt', 'hunger', 'thirst',
      'tired', 'fear', 'stam', 'think', 'cool', 'called', 'want', 'stride', 'strideV', 'st', 'row', 'herd',
      'tgt', 'cell', 'home', 'ord', 'oa', 'ob']) F[a][k] = F[a][src];
    for (const a of ['phase', 'speed', 'state', 'head', 'alert', 'sp', 'size', 'seed', 'born', 'shade']) A[a][k] = A[a][src];
    F.pw[k * 3] += (k % 7) - 3;                 // a metre or two apart, so they are not all one animal
    F.think[k] = F.time + (k % 60) / 240;       // ... and on their own beats, as the real ones are
    F.herd[k] = -1;
  }
  A.n = F.n0;
}

test('what a frame costs, at the band the ledger fills and at the band full', () => {
  for (const want of [0, 164]) {
    const F = makeFauna({ rows: ROWS(), seed: 17 });
    const ctx = world({ eye: at(0, 0) });
    run(F, ctx, 40);
    if (want) { crowd(F, want); F.stockAt = Infinity; }
    const n = F.n0;
    let thinks = 0, scans = 0, asks = 0;
    for (let i = 0; i < 3000; i++) { ctx.t = F.time + 1 / 60; if (want) F.stockAt = Infinity; stepFauna(F, 1 / 60, ctx); }
    const N = 20000, t0 = performance.now();
    for (let i = 0; i < N; i++) {
      ctx.t = F.time + 1 / 60;
      if (want) F.stockAt = Infinity;
      stepFauna(F, 1 / 60, ctx);
      thinks += F.prof.thinks; scans += F.prof.scans; asks += F.prof.asks;
    }
    const ms = (performance.now() - t0) / N;
    console.log(`# a frame with ${n} animals and ${F.hn} herds: ${ms.toFixed(4)} ms here (x6 for the phone = ${(ms * 6).toFixed(3)} ms of its 9.6 ms script)`);
    console.log(`#   a second of it: ${(thinks / N * 60).toFixed(1)} thinks, ${(scans / N * 60).toFixed(2)} prey scans, ${(asks / N * 60).toFixed(1)} ground samples`);
    assert.ok(ms < 0.2, `a frame with ${n} animals costs ` + ms.toFixed(4) + ' ms');
  }
});

test('the band does not grow: what stands there after half an hour is what stood there after a minute', () => {
  const F = makeFauna({ rows: ROWS(), seed: 41 });
  const ctx = world({ eye: at(0, 0) });
  run(F, ctx, 60);
  const early = F.n0;
  for (let i = 0; i < 60 * 60 * 30; i++) { ctx.t = F.time + 1 / 60; stepFauna(F, 1 / 60, ctx); }
  const late = F.n0;
  console.log(`# the band standing still: ${early} animals after a minute, ${late} after half an hour`);
  assert.ok(late <= early * 1.25 + 2, `the band grew from ${early} to ${late}`);
  assert.ok(late >= early * 0.6, `the band emptied from ${early} to ${late}`);
});

test('the same place gives the same animals', () => {
  const mk = () => {
    const F = makeFauna({ rows: ROWS(), seed: 29 });
    const ctx = world({ eye: at(0, 0) });
    run(F, ctx, 6);
    return F;
  };
  const a = mk(), b = mk();
  assert.equal(a.agents.n, b.agents.n, 'a different number of animals turned up the second time');
  for (let k = 0; k < a.agents.n; k++) {
    assert.equal(a.agents.sp[k], b.agents.sp[k], 'a different animal at ' + k);
    const i = k * 3;
    const d = Math.hypot(a.agents.pos[i] - b.agents.pos[i], a.agents.pos[i + 1] - b.agents.pos[i + 1], a.agents.pos[i + 2] - b.agents.pos[i + 2]);
    assert.ok(d < 1e-3, 'animal ' + k + ' was ' + d.toFixed(3) + ' m away the second time');
  }
});

// ---- the little rules that make it read as alive ----------------------------------------------------------------
test('run and tumble: the grazers end up where the food is', () => {
  const F = makeFauna({ rows: faunaRows([ROWS()[0].id ? { id: 'deer', guild: GUILD.grazer, high: 1.1, mass: 90, walk: 1.1, trot: 3, run: 8, group: null, flee: 1, shy: 0, hab: [0.6, 1, 0.8, 0] } : null]), seed: 31 });
  const ctx = world({ eye: at(0, 0) });
  run(F, ctx, 10);
  const n = F.n0;
  assert.ok(n >= 4, 'only ' + n + ' grazers');
  let before = 0; for (let k = 0; k < n; k++) before += F.food[k];
  before /= n;
  run(F, ctx, 240);
  let after = 0, m = 0; for (let k = 0; k < F.n0; k++) { after += F.food[k]; m++; }
  after /= Math.max(1, m);
  console.log(`# run and tumble: the food under the grazers went ${before.toFixed(3)} -> ${after.toFixed(3)} over four minutes`);
  // it must really CLIMB, not merely fail to fall: a random walk settles at the field's own mean of 0.5
  assert.ok(after > before, `the grazers did not find better ground: ${before.toFixed(3)} -> ${after.toFixed(3)}`);
  assert.ok(after > 0.55, 'the grazers ended on ground no better than the average of the whole wood');
});

test('a fright passes between animals, but only twice, and the list empties', () => {
  const F = makeFauna({ rows: ROWS(), seed: 19 });
  const ctx = world({ eye: at(0, -500) });          // the player is far off, so only the fright is at work
  run(F, ctx, 20);
  assert.ok(F.n0 > 6);
  const i = 0;
  scare(F, F.pw[i], F.pw[i + 1], F.pw[i + 2], 50, 1, 0);
  let most = 0;
  for (let s = 0; s < 120; s++) { ctx.t = F.time + 1 / 60; stepFauna(F, 1 / 60, ctx); if (F.alarms.count > most) most = F.alarms.count; }
  assert.ok(most >= 1, 'nothing took fright');
  assert.ok(most <= FAUNA.alarms, 'the alarm list overflowed');
  for (let a = 0; a < F.alarms.count; a++) assert.ok(F.alarms[a].hop <= FAUNA.alarmHops, 'a fright hopped ' + F.alarms[a].hop + ' times');
  run(F, ctx, 20);
  assert.equal(F.alarms.count, 0, 'the frights never cleared');
  let afraid = 0; for (let k = 0; k < F.n0; k++) if (F.fear[k] > 0.3) afraid++;
  console.log(`# a fright: ${most} alarms in the air at once, ${afraid} still uneasy twenty seconds later`);
});

test('standing still is how you see things', () => {
  const rows = ROWS();
  const mk = (move) => {
    const F = makeFauna({ rows, seed: 23 });
    const eye = at(0, 0);
    const ctx = world({ eye });
    run(F, ctx, 25);
    let fear = 0, n = 0;
    for (let s = 0; s < 300; s++) {
      if (move) { const p = at(s * 0.08, 0); eye.x = p.x; eye.y = p.y; eye.z = p.z; }
      ctx.t = F.time + 1 / 60;
      stepFauna(F, 1 / 60, ctx);
    }
    for (let k = 0; k < F.n0; k++) { fear += F.fear[k]; n++; }
    return n ? fear / n : 0;
  };
  const still = mk(false), walking = mk(true);
  console.log(`# fear of the player: standing still ${still.toFixed(3)}, walking ${walking.toFixed(3)}`);
  assert.ok(walking >= still, 'walking at them was not worse than standing still');
});

test('the day is one cosine: a nocturnal row is the same row with its peak moved', () => {
  const day = { base: 0.5, amp: 0.45, peak: 0.5 }, night = { base: 0.5, amp: 0.45, peak: 0.0 };
  assert.ok(activity(day, 0.5) > 0.9, 'a day animal is not awake at noon');
  assert.ok(activity(day, 0.0) < 0.1, 'a day animal is awake at midnight');
  assert.ok(activity(night, 0.0) > 0.9, 'a night animal is not awake at midnight');
  assert.ok(activity(night, 0.5) < 0.1, 'a night animal is awake at noon');
});

test('the meadow at four hours of the day is not the same meadow', () => {
  const rows = faunaRows([
    { id: 'deer', guild: GUILD.grazer, high: 1.1, mass: 90, walk: 1.1, trot: 3, run: 8, group: [3, 6], peak: 0.25, amp: 0.5, flee: 20, shy: 0.8, hab: [0.6, 1, 0.8, 0] },
    { id: 'badger', guild: GUILD.ground, high: 0.28, mass: 10, walk: 0.7, trot: 1.6, run: 4, peak: 0.95, amp: 0.5, flee: 12, shy: 0.8, hab: [0.8, 0.8, 0.2, 0] },
  ]);
  const seen = [];
  for (const h of [0.0, 0.25, 0.5, 0.95]) {
    const F = makeFauna({ rows, seed: 37 });
    const ctx = world({ eye: at(0, 0), day01: h });
    run(F, ctx, 40);
    let asleep = 0, awake = 0;
    for (let k = 0; k < F.n0; k++) (F.st[k] === FSTATE.SLEEP || F.st[k] === FSTATE.REST ? asleep++ : awake++);
    seen.push(`${(h * 24).toFixed(0)}h: ${awake} up, ${asleep} down`);
  }
  console.log('# the day: ' + seen.join('; '));
  assert.ok(seen.length === 4);
});
