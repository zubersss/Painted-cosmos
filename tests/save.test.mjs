import test from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/core/sim.js';
import { S } from '../src/core/state.js';
import { snapshot, validate, restore, writeSave, readSave, clearSave, AutoSave, SAVE_KEY, SAVE_VERSION } from '../src/core/save.js';
import { stubSurface, stubSpawn } from '../src/core/stubs/surface.js';
import { Pad, play, len, sub } from './helpers.mjs';
import { norm } from '../src/core/vec.js';

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

test('vistas: walking up to one finds it once, the sketchbook lists it, and it survives a save', () => {
  const spawn = stubSpawn('earth').unitDir;
  // One vista 40 m ahead of the spawn along +x (roughly), one far away.
  const near = (() => { const k = 40 / 4000; const d = { x: spawn.x + k, y: spawn.y, z: spawn.z }; const l = Math.hypot(d.x, d.y, d.z); return { x: d.x / l, y: d.y / l, z: d.z / l }; })();
  const vistas = [{ id: 'v1', name: 'The first view', unitDir: near }, { id: 'v2', name: 'Far side', unitDir: { x: -spawn.x, y: -spawn.y, z: -spawn.z } }];
  const calls = [];
  const sim = newSim({ getVistas: (id) => (id === 'earth' ? vistas : []) });
  sim.onVistaFound = (b, v) => calls.push(b + ':' + v);
  const pad = new Pad();
  play(sim, pad, 0.3);
  const nv = sim.nearestVista();
  assert.equal(nv.name, 'The first view');
  assert.ok(Math.abs(nv.distance - 40) < 3, 'distance ' + nv.distance);
  // Turn toward it and walk.
  pad.dx += (nv.bearingDeg * Math.PI / 180) / 0.0023;
  pad.press('KeyW');
  play(sim, pad, 20, { until: () => calls.length > 0 });
  pad.release('KeyW');
  assert.deepEqual(calls, ['earth:v1']);
  assert.match(sim.notice.text, /The first view/);
  play(sim, pad, 3);
  assert.equal(calls.length, 1, 'found once');
  const book = sim.sketchbook().find((b) => b.id === 'earth');
  assert.deepEqual(book.vistasFound, ['The first view']);
  assert.equal(book.vistasTotal, 2);
  assert.ok(book.visited && book.biomes.length >= 1);
  assert.equal(sim.nearestVista().name, 'Far side');
  const b = newSim({ getVistas: (id) => (id === 'earth' ? vistas : []) });
  assert.equal(restore(b, JSON.parse(JSON.stringify(snapshot(sim)))), true);
  assert.deepEqual(b.sketchbook().find((x) => x.id === 'earth').vistasFound, ['The first view']);
  // A world without vistas, or one that throws, is no problem.
  const c = newSim({ getVistas: () => { throw new Error('no'); } });
  play(c, pad, 0.2);
  assert.equal(c.nearestVista(), null);
});

// Hardening review gap 16: a game saved while swimming used to come back on the bed of the sea.
test('a game saved while swimming comes back afloat, not on the bed', () => {
  const sea = (id, d) => { const s = stubSurface(id, d); return { ...s, liquidRadius: s.radius + 6, isLiquid: true }; };
  const a = newSim({ sampleSurface: sea });
  const pad = new Pad();
  play(a, pad, 3);
  const bed = sea('earth', norm(a.ex.p)).radius;
  assert.ok(len(a.ex.p) > bed + 4, 'swimming before the save: ' + (len(a.ex.p) - bed).toFixed(2) + ' m above the bed');
  const snap = snapshot(a);
  assert.ok(snap, 'a swimmer can be saved');
  const b = newSim({ sampleSurface: sea });
  assert.equal(restore(b, JSON.parse(JSON.stringify(snap))), true);
  const h = len(b.ex.p) - bed;
  assert.ok(Math.abs(h - (6 - 1.25)) < 0.05, 'restored afloat, feet 1.25 m under the surface: ' + h.toFixed(2) + ' m above the bed');
  play(b, pad, 2);
  assert.ok(len(b.ex.p) - bed > 4, 'and stays afloat: ' + (len(b.ex.p) - bed).toFixed(2) + ' m');
});
