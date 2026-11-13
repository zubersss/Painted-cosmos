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
  // into the crown: no place for the lens that way. The boom is footBoomMin, never nearer (the figure
  // stays whole, never the explorer's eyes) and no further (the crown between lens and figure is all
  // within PAINTER's 3.6 m, where it parts into dabs). (The re-fix pass: it was 0, the explorer's eyes.)
  assert.equal(footBoomAmongCrowns(pivot, V(1, 0, 0), 5.2, crowns), CAMERA.footBoomMin, 'into the crown: footBoomMin');
  // a crown the boom meets 3.5 m out: no place a metre clear at footBoomMin or beyond, so footBoomMin (0.5 m short of it)
  const ahead = [tree(-3.5 - 7.04, 0)];
  assert.equal(footBoomAmongCrowns(pivot, V(-1, 0, 0), 5.2, ahead), CAMERA.footBoomMin);
  assert.ok(crownDistance(ahead, add(pivot, V(-CAMERA.footBoomMin, 0, 0))) > 0.4, 'the lens short of that crown');
  // a boom the hull has already cut under footBoomMin is not lengthened
  assert.equal(footBoomAmongCrowns(pivot, V(1, 0, 0), 2.0, crowns), 2.0);
  const along = footBoomAmongCrowns(pivot, norm(V(0.25, 0, 1)), 5.2, crowns);
  assert.ok(along > 2 && along <= 5.2, 'past the crown\'s side: ' + along.toFixed(1));
  assert.ok(crownDistance(crowns, add(pivot, scale(norm(V(0.25, 0, 1)), along))) >= CAMERA.footLens - 1e-9, 'and the lens is clear there');
  // on the ground: a trunk 0.8 m beside where the lens would be: the lens comes in past it
  const low = add(base, V(0, CAMERA.pivotHeight, 0)), beside = [tree(0.8, 5.2)];
  const b = footBoomAmongCrowns(low, V(0, 0, 1), 5.2, beside);
  assert.ok(b > 3 && b < 4.2, 'the boom comes in to ' + b.toFixed(1) + ' m');
  assert.ok(crownDistance(beside, add(low, V(0, 0, b))) >= CAMERA.footLens - 1e-9);
  // a trunk well to the side changes nothing; with the head inside a crown, footBoomMin (all of the
  // crown round the figure within 3.6 m of the lens)
  assert.equal(footBoomAmongCrowns(low, V(0, 0, 1), 5.2, [tree(2.5, 3)]), 5.2);
  assert.equal(footBoomAmongCrowns(add(base, V(6, 12, 0)), V(1, 0, 0), 5.2, crowns), CAMERA.footBoomMin);
  // a reed, a kelp ribbon, a crystal needle (a kit with no crown) is solid only for itself
  const reed = [{ ...tree(1.6, 0, 6, 0.12), c: null }];
  assert.equal(footBoomAmongCrowns(add(base, V(0, 3, 0)), V(0, 0, 1), 5.2, reed), 5.2);
  assert.ok(crownDistance(reed, add(base, V(0, 5, 0))) > 1.1, 'no crown round a reed');
});

// The jetpack in a glade ringed by 22 m birches `ring` metres from the spawn, up past the crowns and
// down again. Each frame with the head in clear air: the lens's distance to the nearest crown, the
// boom, whether the figure is drawn.
function glade(ring) {
  const spawn = norm(stubSpawn('earth').unitDir), R = stubSurface('earth', spawn).radius;
  const east = tangent(cross(V(0, 1, 0), spawn), spawn, V(1, 0, 0)), north = cross(spawn, east);
  const trees = [];
  for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; trees.push({ unitDir: norm(add(spawn, add(scale(east, Math.cos(a) * ring / R), scale(north, Math.sin(a) * ring / R)))), radius: 0.35, height: 22 }); }
  const sim = new Sim({ sampleSurface: stubSurface, getSpawn: (id) => stubSpawn(id).unitDir, sampleObstacles: (id, d, r) => (id === 'earth' ? trees.filter((t) => Math.acos(Math.min(1, dot(norm(d), t.unitDir))) * R < r + 1) : []) });
  const pad = new Pad();
  play(sim, pad, 0.5);
  const crowns = trees.map((t) => ({ base: scale(t.unitDir, stubSurface('earth', t.unitDir).radius), u: t.unitDir, h: t.height, r: t.radius }));
  const s = { worst: Infinity, top: 0, n: 0, cut: 0, hidden: 0, airShort: Infinity, inCrownLong: 0, inCrown: 0 };
  const each = () => {
    const up = norm(sim.ex.p), head = add(sim.ex.p, scale(up, CAMERA.pivotHeight));
    s.top = Math.max(s.top, sim.ex.altitude);
    if (!sim.explorerVisible()) s.hidden++;
    if (!sim.ex.grounded && sim.ex.altitude > 3) s.airShort = Math.min(s.airShort, sim.footCam.boomNow);
    if (!sim.camPose || crownDistance(crowns, head) < CAMERA.footThrough) return;      // the head itself in a crown
    s.n++;
    const d = crownDistance(crowns, sim.camPose.p);
    s.worst = Math.min(s.worst, d);
    if (d < 0) { s.inCrown++; if (sim.footCam.boomNow > CAMERA.footBoomMin + 0.3) s.inCrownLong++; }
    if (sim.footCam.boomNow < CAMERA.boom - 1) s.cut++;
  };
  pad.press('Space');
  play(sim, pad, 3.2, { each });
  pad.release('Space');
  play(sim, pad, 14, { each, until: () => sim.ex.grounded });
  play(sim, pad, 2, { each });
  s.end = sim.footCam.boomNow;
  return s;
}

test('M4 on the jetpack in a glade, up past the crowns and down again: the lens is never in a crown where there is room, and the figure is always drawn', () => {
  // a ring 12 m out: the crowns leave a shaft 5 m round, room for a lens a metre clear of them 4 m back
  const wide = glade(12);
  assert.ok(wide.top > 14, 'up among the crowns: ' + wide.top.toFixed(1) + ' m');
  assert.ok(wide.n > 300, 'watched ' + wide.n + ' frames with the head in clear air');
  assert.ok(wide.worst > 0.15, `the lens came no nearer a crown than ${wide.worst.toFixed(2)} m (it was inside them: negative)`);
  assert.ok(wide.cut > 30, 'the boom was cut short on the way: ' + wide.cut + ' frames');
  assert.equal(wide.hidden, 0, 'the figure drawn in every frame');
  assert.ok(wide.end > CAMERA.boom - 0.4, 'and the boom is whole again on the ground: ' + wide.end.toFixed(2));
  // a ring 9.5 m out: a shaft 2.5 m round, no place for the lens a metre clear of the crowns. The
  // boom is footBoomMin, never the explorer's eyes (the first form of this rule took it to 0.8 m:
  // first person), and the crown it is in is all within 3.6 m of the lens
  const narrow = glade(9.5);
  assert.ok(narrow.top > 14, 'up among the crowns: ' + narrow.top.toFixed(1) + ' m');
  assert.equal(narrow.hidden, 0, 'the figure drawn in every frame');
  assert.ok(narrow.airShort > CAMERA.footBoomMin - 0.05, 'the boom in the air never under footBoomMin: ' + narrow.airShort.toFixed(2));
  assert.ok(narrow.inCrown > 30, 'the lens is in a crown on the way: ' + narrow.inCrown + ' frames');
  assert.ok(narrow.inCrownLong <= 3, 'and then the boom is footBoomMin (frames longer: ' + narrow.inCrownLong + ')');
  assert.ok(narrow.end > CAMERA.boom - 0.4, 'and whole again on the ground: ' + narrow.end.toFixed(2));
});
