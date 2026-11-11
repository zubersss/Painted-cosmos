import test from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/core/sim.js';
import { S } from '../src/core/state.js';
import { snapshot, validate, restore, writeSave, readSave, clearSave, AutoSave, SAVE_KEY, SAVE_VERSION } from '../src/core/save.js';
import { stubSurface, stubSpawn } from '../src/core/stubs/surface.js';
import { Pad, play, len, sub } from './helpers.mjs';

const newSim = (opts = {}) => new Sim({ sampleSurface: stubSurface, getSpawn: (id) => stubSpawn(id).unitDir, ...opts });
function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m };
}
const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('denied'); } };

test('round trip: a saved game comes back where it was, on any body', () => {
  const a = newSim();
  const pad = new Pad();
  a.teleport({ body: 'mars', lat: 12, lon: 80 });
  pad.press('KeyW');
  play(a, pad, 3);
  pad.release('KeyW');
  play(a, pad, 0.5);
  a.setTarget('saturn');
  const snap = snapshot(a);
  assert.equal(validate(snap), null);
  const text = JSON.stringify(snap);
  assert.ok(text.length < 2500, 'small: ' + text.length + ' bytes');

  const b = newSim();
  assert.equal(restore(b, JSON.parse(text)), true);
  assert.equal(b.bodyId, 'mars');
  assert.equal(b.sm.state, S.ON_FOOT);
  assert.ok(len(sub(b.ex.p, a.ex.p)) < 0.05, 'explorer in the same place');
  assert.ok(len(sub(b.sh.p, a.sh.p)) < 0.05, 'ship in the same place');
  assert.ok(Math.abs(b.t - a.t) < 0.02);
  assert.equal(b.target, 'saturn');
  assert.deepEqual(Object.keys(b.visited), ['mars']);
  assert.ok(Math.abs(b.eph.localSolarTime('mars', b.t, b.ex.p) - a.eph.localSolarTime('mars', a.t, a.ex.p)) < 0.01, 'same time of day');
  // And it plays on: walk, board, lift off.
  play(b, pad, 1);
  assert.ok(b.ex.grounded);
});

test('saving in the ship restores you landed; flying is never saved', () => {
  const a = newSim();
  a.sm.force(S.LANDED);
  const snap = snapshot(a);
  assert.equal(snap.state, S.LANDED);
  const b = newSim();
  assert.equal(restore(b, snap), true);
  assert.equal(b.sm.state, S.LANDED);
  a.teleport({ body: 'earth', ship: true, altitude: 300 });
  assert.equal(snapshot(a), null);
  a.teleport({ body: 'earth', ship: true, altitude: 6000 });
  assert.equal(snapshot(a), null);
});

test('bad saves are refused, never thrown, and leave the game untouched', () => {
  const good = snapshot(newSim());
  const cases = [
    null, 42, 'x', {}, { ...good, version: SAVE_VERSION + 1 }, { ...good, t: NaN }, { ...good, state: 'SPACE' },
    { ...good, bodyId: 'vulcan' }, { ...good, explorer: { p: { x: 0, y: 0, z: 0 }, fwd: good.explorer.fwd } },
    { ...good, ship: { ...good.ship, q: { x: 0, y: 0, z: 0 } } }, { ...good, ship: { ...good.ship, p: { x: 1e9, y: 0, z: 0 } } },
    { ...good, explorer: { ...good.explorer, p: { x: 'a', y: 0, z: 0 } } },
  ];
  const sim = newSim();
  const before = { ...sim.ex.p };
  for (const c of cases) {
    assert.notEqual(validate(c), null, JSON.stringify(c).slice(0, 60));
    assert.equal(restore(sim, c), false);
  }
  assert.deepEqual(sim.ex.p, before);
});

test('storage: works when it can, shrugs when it cannot', () => {
  const store = memoryStorage();
  const sim = newSim();
  assert.equal(readSave(store), null);
  assert.equal(writeSave(store, snapshot(sim)), true);
  assert.equal(readSave(store).bodyId, 'earth');
  store.setItem(SAVE_KEY, '{not json');
  assert.equal(readSave(store), null);
  store.setItem(SAVE_KEY, JSON.stringify({ version: 999 }));
  assert.equal(readSave(store), null);
  assert.equal(clearSave(store), true);
  assert.equal(readSave(store), null);
  // A storage that throws on everything (private mode, quota) never breaks anything.
  assert.equal(writeSave(broken, snapshot(sim)), false);
  assert.equal(readSave(broken), null);
  assert.equal(clearSave(broken), false);
  assert.equal(writeSave(store, null), false);
  assert.equal(readSave(undefined), null);
});

test('autosave writes on arrival and at intervals on foot, not in the air and not in flight', () => {
  const store = memoryStorage();
  const sim = newSim();
  const pad = new Pad();
  const auto = new AutoSave(store, 20);
  play(sim, pad, 0.2);
  assert.equal(auto.update(sim), true, 'first frame on foot');
  assert.equal(auto.update(sim), false, 'not again at once');
  play(sim, pad, 21);
  assert.equal(auto.update(sim), true, 'after the interval');
  play(sim, pad, 21);
  pad.press('Space');
  play(sim, pad, 1.5);
  assert.ok(!sim.ex.grounded);
  assert.equal(auto.update(sim), false, 'not while in the air');
  pad.release('Space');
  play(sim, pad, 15, { until: () => sim.ex.grounded });
  assert.equal(auto.update(sim), true, 'once back on the ground');
  sim.teleport({ body: 'earth', ship: true, altitude: 200 });
  assert.equal(auto.update(sim), false, 'not in flight');
  sim.sm.force(S.LANDED);
  sim.shFrame = { kind: 'body', id: 'earth', rotating: true };
  assert.equal(auto.update(sim), true, 'on touchdown');
  assert.equal(auto.writes, 4);
  const bad = new AutoSave(broken);
  assert.equal(bad.update(sim), false);
  assert.equal(bad.ok, false);
});
