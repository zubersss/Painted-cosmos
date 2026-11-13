// The foot camera among trees (PHYSICS' critique of PILOT, M4 item 4; PAINTER's item 10): on the
// jetpack's way up and down the lens went through crowns (flat slabs over half the frame), and a
// trunk a metre from the lens was a white slab over a fifth of it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/core/sim.js';
import { CAMERA, crownDistance, footBoomAmongCrowns } from '../src/player/camera.js';
import { stubSurface, stubSpawn } from '../src/core/stubs/surface.js';
import { Pad, play, len, sub, norm, dot } from './helpers.mjs';
import { V, add, scale, cross, tangent } from '../src/core/vec.js';

test('M4 the foot boom among crowns: cut short of a crown, the lens a metre clear of crowns and trunks', () => {
  const up = V(0, 1, 0), R = 4000, base = scale(up, R);
  const tree = (x, z, h = 22, r = 0.35) => ({ base: add(base, V(x, 0, z)), u: up, h, r });
  // a crown (7.04 m round from 6.6 m up) 8 m to the east; the pivot 12 m up in clear air beside it
  const crowns = [tree(8, 0)], pivot = add(base, V(0, 12, 0));
  assert.ok(crownDistance(crowns, pivot) > 0.9);
  assert.equal(footBoomAmongCrowns(pivot, V(-1, 0, 0), 5.2, crowns), 5.2, 'away from the tree: the whole boom');
  assert.equal(footBoomAmongCrowns(pivot, V(1, 0, 0), 5.2, crowns), 0, 'into the crown: no place for the lens that way');
  const along = footBoomAmongCrowns(pivot, norm(V(0.25, 0, 1)), 5.2, crowns);
  assert.ok(along > 2 && along <= 5.2, 'past the crown\'s side: ' + along.toFixed(1));
  assert.ok(crownDistance(crowns, add(pivot, scale(norm(V(0.25, 0, 1)), along))) >= CAMERA.footLens - 1e-9, 'and the lens is clear there');
  // on the ground: a trunk 0.8 m beside where the lens would be: the lens comes in past it
  const low = add(base, V(0, CAMERA.pivotHeight, 0)), beside = [tree(0.8, 5.2)];
  const b = footBoomAmongCrowns(low, V(0, 0, 1), 5.2, beside);
  assert.ok(b > 3 && b < 4.2, 'the boom comes in to ' + b.toFixed(1) + ' m');
  assert.ok(crownDistance(beside, add(low, V(0, 0, b))) >= CAMERA.footLens - 1e-9);
  // a trunk well to the side changes nothing; a head inside a crown is left alone
  assert.equal(footBoomAmongCrowns(low, V(0, 0, 1), 5.2, [tree(2.5, 3)]), 5.2);
  assert.equal(footBoomAmongCrowns(add(base, V(6, 12, 0)), V(1, 0, 0), 5.2, crowns), 5.2);
});

test('M4 on the jetpack in a glade, up past the crowns and down again: the lens is never in a crown', () => {
  const spawn = norm(stubSpawn('earth').unitDir), R = stubSurface('earth', spawn).radius;
  const east = tangent(cross(V(0, 1, 0), spawn), spawn, V(1, 0, 0)), north = cross(spawn, east);
  // a ring of birches 22 m tall, 9.5 m from the spawn all round: their crowns leave a shaft 2.5 m wide
  const trees = [];
  for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; trees.push({ unitDir: norm(add(spawn, add(scale(east, Math.cos(a) * 9.5 / R), scale(north, Math.sin(a) * 9.5 / R)))), radius: 0.35, height: 22 }); }
  const sim = new Sim({ sampleSurface: stubSurface, getSpawn: (id) => stubSpawn(id).unitDir, sampleObstacles: (id, d, r) => (id === 'earth' ? trees.filter((t) => Math.acos(Math.min(1, dot(norm(d), t.unitDir))) * R < r + 1) : []) });
  const pad = new Pad();
  play(sim, pad, 0.5);
  const crowns = trees.map((t) => ({ base: scale(t.unitDir, stubSurface('earth', t.unitDir).radius), u: t.unitDir, h: t.height, r: t.radius }));
  let worst = Infinity, top = 0, n = 0, cut = 0;
  const each = () => {
    const up = norm(sim.ex.p), head = add(sim.ex.p, scale(up, CAMERA.pivotHeight));
    top = Math.max(top, sim.ex.altitude);
    if (!sim.camPose || crownDistance(crowns, head) < CAMERA.footThrough) return;      // the head itself in a crown: nothing to ask
    n++;
    worst = Math.min(worst, crownDistance(crowns, sim.camPose.p));
    if (sim.footCam.boomNow < CAMERA.boom - 1) cut++;
  };
  pad.press('Space');
  play(sim, pad, 3.2, { each });
  pad.release('Space');
  play(sim, pad, 14, { each, until: () => sim.ex.grounded });
  play(sim, pad, 2, { each });
  assert.ok(top > 14, 'up among the crowns: ' + top.toFixed(1) + ' m');
  assert.ok(n > 300, 'watched ' + n + ' frames with the head in clear air');
  assert.ok(worst > 0.15, `the lens came no nearer a crown than ${worst.toFixed(2)} m (it was inside them: negative)`);
  assert.ok(cut > 30, 'the boom was cut short on the way: ' + cut + ' frames');
  assert.ok(sim.footCam.boomNow > CAMERA.boom - 0.4, 'and is whole again on the ground: ' + sim.footCam.boomNow.toFixed(2));
});
