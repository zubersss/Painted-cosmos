// Does the world stand ready for a player ON FOOT? (The owner, 2026-11-22: "I want things far away to be loaded
// in before I even get there".)
//
// rush.test.mjs beside this one asks the same question of a FLIGHT, and the look-ahead that answered it then
// (2026-11-18) only worked above 14 m/s -- a flying speed. On foot there was no look-ahead at all: the world was
// built round where the player already stood, evenly in every direction, half of it behind them. This drives the
// real world from Node, walks and sprints in a straight line, and asks the honest question: IS THE WOOD YOU ARE
// WALKING INTO STANDING YET, three seconds before you reach it?
// Run: node --test src/world/
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const three = pathToFileURL(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../vendor/three/three.module.js')).href;
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier === 'three') return { url: '${three}', shortCircuit: true };
  return next(specifier, context);
}`), import.meta.url);

const THREE = await import('three');
const { createWorld } = await import('./index.js');
const { QUALITY } = await import('../render/shared.js');

QUALITY.level = 1;
const scene = new THREE.Scene();
const world = createWorld(scene);
const cam = new THREE.Vector3(0, 0, 0);
world.sun.position.set(2e5, 1e5, 1.5e5);

const sp = world.getSpawn('earth').unitDir;
const up = new THREE.Vector3(sp.x, sp.y, sp.z).normalize();
const east = new THREE.Vector3(0, 1, 0).cross(up).normalize();
const s0 = world.sampleSurface('earth', up);

// the place `metres` along the ground from the spawn, heading east, `alt` above it, in the body's own axes
function place(metres, alt) {
  const a = metres / s0.radius;
  const d = up.clone().multiplyScalar(Math.cos(a)).addScaledVector(east, Math.sin(a)).normalize();
  const s = world.sampleSurface('earth', d);
  return d.multiplyScalar(Math.max(s.radius, s.liquidRadius || 0) + alt);
}
// put the eye there (floating origin: the body is moved under a camera that stays at the scene's origin)
function walkTo(metres, alt) {
  const p = place(metres, alt);
  for (const [id, root] of world.bodies) {
    if (id === 'earth') root.position.set(-p.x, -p.y, -p.z);
    else root.position.set(9e5, -4e5, -3e6);
    root.updateMatrixWorld(true);
  }
}
function settle() {
  for (let i = 0; i < 6000; i++) { world.update(1 / 60, cam, 'earth'); if (i > 3 && world.busy === 0) break; }
}

test('the wood a walker is walking into is standing before they reach it', () => {
  world.setBuildBudget(5);                           // the game's own slice of a frame, not a raised one
  walkTo(0, 1.7); settle();
  const settled = world.getStats();
  assert.ok(settled.visible > 100 && settled.cells > 100, 'the world settled first: ' + JSON.stringify(settled));
  const out = [];
  for (const speed of [4, 9]) {                      // a walk and a sprint (player/explorer.js)
    walkTo(0, 1.7); settle();
    let leastAhead = Infinity, sumAhead = 0, leastDrawn = Infinity, sumBusy = 0;
    const frames = 60 * 20;
    for (let f = 0; f < frames; f++) {
      walkTo(speed * f / 60, 1.7);
      world.update(1 / 60, cam, 'earth');
      // THE HONEST QUESTION: the cells standing within 70 m of where the eye will be in three seconds
      const a = world.getStats(place(speed * (f / 60 + 3), 1.7), 70);
      if (a.cells < leastAhead) leastAhead = a.cells;
      sumAhead += a.cells;
      const now = world.getStats();
      if (now.meshes < leastDrawn) leastDrawn = now.meshes;
      sumBusy += world.busy;
    }
    const mean = sumAhead / frames;
    out.push(speed + ' m/s: the wood 3 s ahead, mean ' + mean.toFixed(1) + ' cells standing, least ' + leastAhead
      + '; drawn now never under ' + leastDrawn + ' of ' + settled.meshes + '; mean queue ' + (sumBusy / frames).toFixed(1));
    // MEASURED on the build machine, the same minute, with the walking look-ahead off and on:
    //   4 m/s: mean 44.3 -> 48.4 cells, least 41 -> 42, mean queue 7.8 -> 1.9
    //   9 m/s: mean 42.0 -> 47.9 cells, least 35 -> 43, mean queue 33.5 -> 17.2
    // (and the world holds 3 per cent more cells for it: 312 -> 321 at 9 m/s. That is the whole cost.)
    assert.ok(leastAhead > 38, speed + ' m/s: the wood ahead thinned to ' + leastAhead + ' cells');
    assert.ok(mean > 45, speed + ' m/s: the wood ahead is only ' + mean.toFixed(1) + ' cells on average');
    assert.ok(leastDrawn > settled.meshes * 0.9, speed + ' m/s: what is drawn thinned to ' + leastDrawn);
  }
  console.log('on foot, with the look-ahead (build budget 5 ms):\n  ' + out.join('\n  '));
});
