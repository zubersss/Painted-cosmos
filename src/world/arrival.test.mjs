// node --test src/world/arrival.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { isArrival } from './arrival.js';

test('M4 arrival: a leap is an arrival only where the frame before does not explain it', () => {
  // the first frame over a world, whatever the leap
  assert.equal(isArrival(0, 0, false), true);
  // a walk, a run, a ship at 60 frames a second
  assert.equal(isArrival(0.03, 0.03, true), false);
  assert.equal(isArrival(15, 15, true), false);
  // a debug teleport out of a walk, and out of a standstill
  assert.equal(isArrival(500, 0.1, true), true);
  assert.equal(isArrival(61, 0, true), true);
  // the pulse letting go at 900 m/s under frames of a quarter of a second: 225 m after 225 m is flight, not an arrival
  // (the rule before, any leap over 60 m, held the picture as bare paper for as long as the ship was fast)
  assert.equal(isArrival(225, 225, true), false);
  // a ship gathering speed at four frames a second: 60 m/s more each second is 3.75 m more a frame
  for (let v = 200; v < 1000; v += 15) assert.equal(isArrival((v + 15) * 0.25, v * 0.25, true), false, 'at ' + v + ' m/s');
  // a hitch: one frame of a second at 320 m/s after frames of a sixtieth: the land under the eye is not laid: an arrival
  assert.equal(isArrival(320, 5.3, true), true);
  // a teleport out of fast flight is still found when it is far
  assert.equal(isArrival(4000, 225, true), true);
});
