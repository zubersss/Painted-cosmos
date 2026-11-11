// Sweep cases (2026-11 sweep): refresh/rAF caps, single hitches, a strictly vsync-quantized display.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DynamicResolution } from '../src/core/dynres.js';
const V = 1000 / 60, TIER = [0.45, 0.7, 1];
function run(c, interval, seconds) { let t = 0, changes = 0; while (t < seconds) { const ms = interval(t, c); if (c.frame(ms).changed) changes++; t += ms / 1000; } return changes; }

test('a refresh or rAF cap with an idle GPU keeps the top picture (30, 40, 48, 50 Hz)', () => {
  for (const hz of [30, 40, 48, 50]) {
    const c = new DynamicResolution();
    run(c, () => 1000 / hz, 120);
    assert.deepEqual([c.scale, c.quality], [1, 2], hz + ' Hz');
  }
});

test('a 30 fps cap that starts mid-session (battery saver) gives the picture back within 5 s', () => {
  const c = new DynamicResolution();
  run(c, (t, d) => Math.max(t > 20 ? 1000 / 30 : V, 4 + 9 * d.scale ** 2 * TIER[d.quality]), 26);
  assert.deepEqual([c.scale, c.quality], [1, 2]);
});

test('one slow frame of 65-180 ms changes nothing; two 120 ms frames 3 s apart change nothing', () => {
  for (const hitch of [65, 100, 150, 180]) {
    const c = new DynamicResolution(); let fired = false;
    run(c, (t) => (!fired && t > 10 ? (fired = true, hitch) : V), 60);
    assert.equal(c.changes, 0, hitch + ' ms');
  }
  const c = new DynamicResolution(); let n = 0;
  run(c, (t) => ((n === 0 && t > 10) || (n === 1 && t > 13) ? (n++, 120) : V), 60);
  assert.equal(c.changes, 0);
});

test('a strictly vsync-quantized machine at its edge does not saw: few changes, mean scale near what holds', () => {
  const c = new DynamicResolution(); let t = 0, sum = 0, k = 0;
  const changes = run(c, (tt, d) => { const ms = Math.ceil((4 + 20 * d.scale ** 2 * TIER[d.quality]) / V - 1e-9) * V; if (tt > 30) { sum += d.scale; k++; } return ms; }, 300);
  assert.ok(changes <= 20, changes + ' changes in 300 s');
  assert.ok(sum / k > 0.75, 'mean scale ' + (sum / k).toFixed(2));
});

test('real load is still shed at once: 76 ms at the top is above 30 fps within 2 s', () => {
  const c = new DynamicResolution(); let t = 0, held = null;
  while (t < 10) { const ms = Math.max(V, 6 + 70 * c.scale ** 2 * TIER[c.quality]); c.frame(ms); t += ms / 1000; if (held == null && ms <= 33.4) held = t; }
  assert.ok(held != null && held < 2, 'held at ' + held);
});
