// The wind knife (the powers): the list of felled trees (src/data/felled.js), the trunks that are no longer in the way
// (src/world/obstacles.js), the ability itself in the real forest (src/core/powers.js) and the saved game.
// Run: node --test tests/felled.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { FELLED, FELL, fellTree, felledAt, fallingOn, fallTurn, felledRows, felledLoad } from '../src/data/felled.js';
import { Powers, ABILITIES, POWERS } from '../src/core/powers.js';
import { Sim } from '../src/core/sim.js';
import { snapshot, restore, validate } from '../src/core/save.js';
import { sampleObstaclesPure } from '../src/world/obstacles.js';
import { sampleSurfacePure, getSurface } from '../src/world/surface.js';

const unit = (v) => { const l = Math.hypot(v.x, v.y, v.z); return { x: v.x / l, y: v.y / l, z: v.z / l }; };
const rot = (q, v) => {      // v turned by the quaternion q = [x, y, z, w]
  const [x, y, z, w] = q, tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]);
  return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
};

test('the list: a tree is felled once, known again by its own place, and falls over a second and a half', () => {
  felledLoad([]);
  assert.equal(FELLED.size, 0); assert.equal(felledAt('earth', 1, 2, 3), null);
  const v0 = FELLED.version, F = fellTree('earth', 10.5, 20.25, 6371000.5, 0, 0, 5, 0.3);
  assert.ok(F && FELLED.size === 1 && FELLED.version === v0 + 1);
  assert.equal(fellTree('earth', 10.5, 20.25, 6371000.5, 1, 0, 0), null, 'not twice');
  assert.equal(felledAt('earth', 10.5, 20.25, 6371000.5), F); assert.equal(felledAt('mars', 10.5, 20.25, 6371000.5), null, 'another body, another tree');
  assert.ok(Math.abs(F.dz - 1) < 1e-9, 'its direction is kept as a unit');
  assert.ok(F.f < 0 && Math.abs(F.f + 0.3 / FELL.time) < 1e-9, 'it waits for the blade');
  assert.deepEqual(fallingOn('earth'), [F]); assert.deepEqual(fallingOn('mars'), []);
  // the turn: none before it begins; at the end "up" has gone over toward the fall, about the level line across it
  const q = [0, 0, 0, 1], up = [0, 1, 0], G = { dx: 0, dy: 0, dz: 1, f: -0.2 };
  assert.deepEqual(fallTurn(0, 1, 0, G, q), [0, 0, 0, 1]);
  G.f = 1; fallTurn(0, 1, 0, G, q);
  const top = rot(q, up);
  assert.ok(Math.abs(top[2] - Math.sin(FELL.angle)) < 1e-9 && Math.abs(top[1] - Math.cos(FELL.angle)) < 1e-9 && Math.abs(top[0]) < 1e-9, 'the top lies along the fall: ' + top.map((x) => x.toFixed(2)));
  G.f = 0.5; fallTurn(0, 1, 0, G, q);
  assert.ok(rot(q, up)[2] < Math.sin(FELL.angle) * 0.5, 'half way through the time it is less than half way over (it comes down fast at the end)');
  // a fall aimed partly upward is taken level; one aimed straight up turns nothing
  fallTurn(0, 1, 0, { dx: 0, dy: 0.8, dz: 0.6, f: 1 }, q); assert.ok(Math.abs(rot(q, up)[2] - Math.sin(FELL.angle)) < 1e-9);
  assert.deepEqual(fallTurn(0, 1, 0, { dx: 0, dy: 1, dz: 0, f: 1 }, q), [0, 0, 0, 1]);
  // rows for the saved game, and back: a tree from a save lies
  const rows = JSON.parse(JSON.stringify(felledRows()));
  felledLoad([]); assert.equal(FELLED.size, 0);
  felledLoad(rows.concat([['earth', 'x', 2, 3, 0, 0, 1], null, ['mars', 1, 2, 3, 0, 0, 1]]));
  assert.equal(FELLED.size, 2, 'bad rows are left out');
  const B = felledAt('earth', 10.5, 20.25, 6371000.5);
  assert.ok(B && B.f === 1 && Math.abs(B.dz - 1) < 1e-3, 'the same tree, lying');
  assert.deepEqual(fallingOn('earth'), [], 'and not falling');
  felledLoad([]);
});

test('in the real forest: the knife fells the first tree along the aim, its trunk is out of the way, and the saved game keeps it', () => {
  felledLoad([]);
  const sim = new Sim({
    sampleSurface: (id, d) => sampleSurfacePure(id, d.x, d.y, d.z), getSpawn: (id) => getSurface(id).getSpawn(),
    sampleObstacles: (id, d, r) => sampleObstaclesPure(id, d.x, d.y, d.z, r),
  });
  const here = unit(sim.ex.p), trees = sampleObstaclesPure('earth', here.x, here.y, here.z, 16).filter((o) => o.kind === 'tree');
  assert.ok(trees.length > 2, 'trees stand round the landing place: ' + trees.length);
  assert.ok(trees.every((o) => o.p && Number.isFinite(o.p.x)), 'each carries its own place');
  // the nearest one that is at least 3 m off: look at it
  const R = Math.hypot(sim.ex.p.x, sim.ex.p.y, sim.ex.p.z), off = (o) => ({ x: o.p.x - sim.ex.p.x, y: o.p.y - sim.ex.p.y, z: o.p.z - sim.ex.p.z });
  const dist = (o) => { const r = off(o); return Math.hypot(r.x, r.y, r.z); };
  const tree = trees.filter((o) => dist(o) > 3 && dist(o) < POWERS.knifeReach - 1).sort((a, b) => dist(a) - dist(b))[0];
  assert.ok(tree, 'a tree within reach');
  const r = off(tree), k = r.x * here.x + r.y * here.y + r.z * here.z;
  sim.footCam.viewFwd = unit({ x: r.x - here.x * k, y: r.y - here.y * k, z: r.z - here.z * k });
  const p = new Powers(), knife = ABILITIES.findIndex((a) => a.id === 'knife');
  assert.equal(knife, 6, 'the seventh ability');
  p.pick(knife); p.tapOnce = true; p.update(1 / 60, sim);
  assert.equal(p.fells, 1, 'one tree felled'); assert.equal(p.casts, 1);
  const F = felledAt('earth', tree.p.x, tree.p.y, tree.p.z);
  assert.ok(F, 'that tree, or one nearer on the same line');
  const any = fallingOn('earth'); assert.equal(any.length, 1);
  const G = any[0], away = G.dx * sim.footCam.viewFwd.x + G.dy * sim.footCam.viewFwd.y + G.dz * sim.footCam.viewFwd.z;
  assert.ok(away > 0.99, 'it falls away from the explorer, along the aim');
  assert.ok(G.f <= 0, 'and begins when the blade reaches it');
  // its trunk is no longer in what the game bumps into; the others still are
  const after = sampleObstaclesPure('earth', here.x, here.y, here.z, 16).filter((o) => o.kind === 'tree');
  assert.equal(after.length, trees.length - 1);
  assert.ok(!after.some((o) => o.p.x === G.x && o.p.y === G.y && o.p.z === G.z), 'the felled one is gone from the list');
  // a second cut along the same line takes the next tree or none, never the same one
  p.tapOnce = false; p.update(0.5, sim); p.tapOnce = true; p.update(1 / 60, sim);
  assert.ok(p.fells === 1 || p.fells === 2); assert.equal(FELLED.size, p.fells);
  // the saved game keeps them; a new game given that save has them lying; a save without any has no such field
  const snap = JSON.parse(JSON.stringify(snapshot(sim)));
  assert.equal(validate(snap), null); assert.equal(snap.felled.length, p.fells);
  felledLoad([]);
  const sim2 = new Sim({ sampleSurface: (id, d) => sampleSurfacePure(id, d.x, d.y, d.z), getSpawn: (id) => getSurface(id).getSpawn() });
  assert.equal('felled' in snapshot(sim2), false, 'nothing felled: the saved game is as it always was');
  assert.equal(restore(sim2, snap), true);
  const back = felledAt('earth', G.x, G.y, G.z);
  assert.ok(back && back.f === 1, 'felled, and lying, after the game is opened again');
  assert.equal(sampleObstaclesPure('earth', here.x, here.y, here.z, 16).filter((o) => o.kind === 'tree').length, trees.length - p.fells);
  // and an old save (no field) clears them: that game never felled a tree
  delete snap.felled; assert.equal(restore(sim2, snap), true); assert.equal(FELLED.size, 0);
  void R;
});
