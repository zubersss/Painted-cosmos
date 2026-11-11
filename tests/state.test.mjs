import test from 'node:test';
import assert from 'node:assert/strict';
import {
  StateMachine, S, EV, flightZone, canBoard, canBeginLanding, promptFor, isPiloting, isInShip,
} from '../src/core/state.js';

test('the whole loop: foot -> ship -> space -> back down -> foot', () => {
  const sm = new StateMachine();
  const seq = [
    [EV.board, S.BOARDING], [EV.seated, S.LANDED], [EV.liftoff, S.ATMOSPHERE],
    [EV.leftAtmosphere, S.SPACE], [EV.pulseOn, S.PULSE], [EV.pulseOff, S.SPACE],
    [EV.enteredAtmosphere, S.ATMOSPHERE], [EV.beginLanding, S.LANDING], [EV.touchdown, S.LANDED],
    [EV.exit, S.BOARDING], [EV.steppedOut, S.ON_FOOT],
  ];
  for (const [ev, want] of seq) {
    assert.equal(sm.dispatch(ev), true, ev);
    assert.equal(sm.state, want);
  }
  assert.deepEqual(sm.history, [S.ON_FOOT, ...seq.map((s) => s[1])]);
});

test('events that make no sense are ignored, never thrown', () => {
  const sm = new StateMachine();
  for (const ev of [EV.liftoff, EV.touchdown, EV.seated, EV.steppedOut, EV.pulseOn, EV.exit, 'nonsense', undefined]) {
    assert.equal(sm.dispatch(ev), false);
    assert.equal(sm.state, S.ON_FOOT);
  }
});

test('boarding has a direction: you cannot fall out of the ship half way in', () => {
  const sm = new StateMachine();
  sm.dispatch(EV.board);
  assert.equal(sm.ctx.boardingDir, 'in');
  assert.equal(sm.dispatch(EV.steppedOut), false);
  assert.equal(sm.dispatch(EV.seated), true);
  assert.equal(sm.ctx.boardingDir, null);
  sm.dispatch(EV.exit);
  assert.equal(sm.ctx.boardingDir, 'out');
  assert.equal(sm.dispatch(EV.seated), false);
  assert.equal(sm.dispatch(EV.steppedOut), true);
  assert.equal(sm.state, S.ON_FOOT);
});

test('landing can be cancelled and there is no dead end', () => {
  const sm = new StateMachine(S.ATMOSPHERE);
  sm.dispatch(EV.beginLanding);
  assert.equal(sm.dispatch(EV.abortLanding), true);
  assert.equal(sm.state, S.ATMOSPHERE);
  // From every state some sequence of events leads back to ON_FOOT.
  const all = Object.values(S), evs = Object.values(EV);
  for (const start of all) {
    const seen = new Set([start]);
    let frontier = [start];
    while (frontier.length) {
      const next = [];
      for (const s of frontier) for (const ev of evs) {
        const m = new StateMachine(s);
        m.ctx.boardingDir = ev === EV.seated ? 'in' : 'out';
        if (m.dispatch(ev) && !seen.has(m.state)) { seen.add(m.state); next.push(m.state); }
      }
      frontier = next;
    }
    assert.ok(seen.has(S.ON_FOOT), `${start} can reach ON_FOOT`);
  }
});

test('time in state and change listeners', () => {
  const sm = new StateMachine();
  const log = [];
  sm.onChange((next, prev, ev) => log.push(`${prev}>${next}:${ev}`));
  sm.update(0.5); sm.update(0.25);
  assert.equal(sm.time, 0.75);
  sm.dispatch(EV.board);
  assert.equal(sm.time, 0);
  assert.deepEqual(log, ['ON_FOOT>BOARDING:board']);
  assert.throws(() => sm.force('NOPE'));
});

test('flight zone has hysteresis at the edge of space', () => {
  assert.equal(flightZone(100, 800, 'space'), 'atmosphere');
  assert.equal(flightZone(799, 800, 'space'), 'atmosphere');
  assert.equal(flightZone(801, 800, 'space'), 'space');
  assert.equal(flightZone(850, 800, 'atmosphere'), 'atmosphere');
  assert.equal(flightZone(900, 800, 'atmosphere'), 'space');
});

test('prompts and rules', () => {
  assert.equal(canBoard(4, 20), true);
  assert.equal(canBoard(20, 8), true);
  assert.equal(canBoard(20, 20), false);
  assert.equal(canBeginLanding(S.ATMOSPHERE, 50, 30), true);
  assert.equal(canBeginLanding(S.ATMOSPHERE, 500, 30), false);
  assert.equal(canBeginLanding(S.ATMOSPHERE, 50, 300), false);
  assert.equal(canBeginLanding(S.SPACE, 50, 30), false);
  assert.equal(promptFor(S.ON_FOOT, { canBoard: true }).key, 'E');
  assert.equal(promptFor(S.ON_FOOT, { canBoard: false }), null);
  assert.match(promptFor(S.LANDED, {}).text, /Lift off/);
  assert.match(promptFor(S.ATMOSPHERE, { canLand: true }).text, /Land/);
  assert.equal(promptFor(S.ATMOSPHERE, { canLand: true, liftingOff: true }), null);
  assert.equal(promptFor(S.SPACE, {}), null);
  assert.match(promptFor(S.SPACE, { target: 'Mars' }).text, /Pulse to Mars/);
  assert.equal(promptFor(S.PULSE, {}).key, 'F');
  assert.ok(isPiloting(S.SPACE) && isPiloting(S.LANDING) && !isPiloting(S.LANDED));
  assert.ok(isInShip(S.LANDED) && !isInShip(S.ON_FOOT) && !isInShip(S.BOARDING));
});
