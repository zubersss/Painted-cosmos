// The turn of the year. OWNER: PAINTER. (The owner, 2026-11-19: the forest's leaves must change from summer to
// autumn.) No three, no page: this file is plain data and arithmetic, and is tested as such.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SEASON, seasonFromSearch, stepSeason, leafNow } from './season.js';

function reset(o) { SEASON.t = 0; SEASON.year = 720; SEASON.held = false; SEASON.v = 0; SEASON._u = null; Object.assign(SEASON, o || {}); }

test('season: a whole turn goes summer -> autumn -> summer and ends where it began', () => {
  reset({ year: 100 });
  const seen = [];
  for (let i = 0; i < 100; i++) { stepSeason(1); seen.push(SEASON.t); }
  assert.ok(Math.max(...seen) > 0.98, 'it never reached autumn: highest was ' + Math.max(...seen).toFixed(2));
  assert.ok(Math.abs(SEASON.t) < 0.03, 'a whole year did not come back to summer: ' + SEASON.t.toFixed(3));
  // and it got there by going up and then down, not by jumping
  let ups = 0, downs = 0;
  for (let i = 1; i < seen.length; i++) (seen[i] > seen[i - 1] ? ups++ : downs++);
  assert.ok(ups > 40 && downs > 40, 'the year did not rise and fall evenly: ' + ups + ' up, ' + downs + ' down');
});

test('season: one huge frame cannot leap a season', () => {
  // a tab left in the background hands back a dt of minutes on its first frame back
  reset({ year: 100 });
  stepSeason(600);
  assert.ok(SEASON.t <= 1 / 100 * 2 + 1e-9, 'one 600-second frame moved the year to ' + SEASON.t.toFixed(3));
});

test('season: ?season= stands the year still, and ?year=0 does too', () => {
  reset();
  seasonFromSearch('?season=0.7');
  assert.equal(SEASON.t, 0.7);
  assert.ok(SEASON.held);
  for (let i = 0; i < 50; i++) stepSeason(1);
  assert.equal(SEASON.t, 0.7, 'a held year moved');

  reset();
  seasonFromSearch('?year=0');
  assert.ok(SEASON.held, '?year=0 did not stand it still');
  for (let i = 0; i < 50; i++) stepSeason(1);
  assert.equal(SEASON.t, 0);
});

test('season: ?season= is kept inside summer and autumn whatever is typed', () => {
  reset(); seasonFromSearch('?season=5'); assert.equal(SEASON.t, 1);
  reset(); seasonFromSearch('?season=-3'); assert.equal(SEASON.t, 0);
  reset(); seasonFromSearch('?season=rubbish'); assert.equal(SEASON.t, 0);
});

test('season: a leaf with two dresses mixes between them; one with a single dress does not turn', () => {
  const sum = [0.2, 0.8, 0.3], aut = [0.9, 0.6, 0.2];
  const near = (got, want, why) => { for (let i = 0; i < 3; i++) assert.ok(Math.abs(got[i] - want[i]) < 1e-9, why + ': ' + got[i] + ' not ' + want[i]); };
  near(leafNow(sum, aut, 0, [0, 0, 0]), sum, 'summer is not the summer dress');
  near(leafNow(sum, aut, 1, [0, 0, 0]), aut, 'autumn is not the autumn dress');
  near(leafNow(sum, aut, 0.5, [0, 0, 0]), [(sum[0] + aut[0]) / 2, (sum[1] + aut[1]) / 2, (sum[2] + aut[2]) / 2], 'halfway');
  // a plant given only one of them keeps it at every point in the year
  for (const t of [0, 0.5, 1]) {
    near(leafNow(sum, null, t, [0, 0, 0]), sum, 'a summer-only plant turned');
    near(leafNow(null, aut, t, [0, 0, 0]), aut, 'an autumn-only plant turned');
  }
});

test('season: stepping with no time passing changes nothing', () => {
  reset({ year: 100 });
  stepSeason(3);
  const was = SEASON.t;
  stepSeason(0); stepSeason(-1); stepSeason(NaN);
  assert.equal(SEASON.t, was);
});
