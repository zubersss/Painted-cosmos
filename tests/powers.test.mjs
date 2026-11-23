// The elemental powers, the player's side (src/core/powers.js): the hands, the aim, what each ability adds to the
// list of the explorer's wind. (What the wind then does to the world is PHYSICS': src/physics/powers.test.mjs.)
// Run: node --test tests/powers.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Powers, ABILITIES, ELEMENTS, POWERS } from '../src/core/powers.js';
import { KIND, WINDPOWER } from '../src/physics/powers.js';
import { S } from '../src/core/state.js';
import { FELLED, felledAt, felledLoad } from '../src/data/felled.js';

const R = 4000;
function fakeSim({ pitch = -0.12, state = S.ON_FOOT } = {}) {
  return { sm: { state }, bodyId: 'earth', easel: null, ex: { p: { x: 0, y: R, z: 0 }, casting: 0 },
    footCam: { viewFwd: { x: 0, y: 0, z: 1 }, pitch }, sampleSurface: () => ({ radius: R, liquidRadius: 0 }) };
}
const step = (p, sim, n = 1, dt = 1 / 60) => { for (let i = 0; i < n; i++) p.update(dt, sim); };

test('the hand goes down and the circle grows; the lift casts one gust from the hands along the view', () => {
  const p = new Powers(), sim = fakeSim(), said = [];
  p.onCast = (id) => said.push(id);
  step(p, sim, 3); assert.equal(p.winds.count, 0, 'nothing until asked');
  p.down = true; step(p, sim, 4);
  assert.equal(p.winds.count, 0, 'held, not yet cast'); assert.ok(p.size > 1, 'and the circle is growing: ' + p.size.toFixed(2));
  p.down = false; step(p, sim, 2);
  assert.equal(p.winds.count, 1); assert.equal(p.casts, 1);
  assert.deepEqual(said, ['gust'], 'the cast is said once, by its name (the sound)');
  const s = p.winds[0];
  assert.equal(s.kind, KIND.jet);
  assert.ok(Math.abs(s.dz - 1) < 1e-6 && Math.abs(s.dx) < 1e-6, 'along the view, level');
  assert.ok(Math.abs(s.pz - POWERS.ahead) < 1e-6 && Math.abs(s.py - (R + POWERS.hands)) < 1e-6, 'from the hands, a step ahead');
  assert.ok(sim.ex.casting < 1 && sim.ex.casting >= 0, 'the explorer shows the cast for a moment');
  p.down = true; step(p, sim, 2); p.down = false; step(p, sim, 2);
  assert.equal(p.casts, 1, 'a second cast too soon after the first is the same stroke');
  step(p, sim, 30); p.down = true; step(p, sim, 2); p.down = false; step(p, sim, 2);
  assert.equal(p.casts, 2, 'a new press and lift, a new gust');
  step(p, sim, 60 * 4); assert.equal(p.winds.count, 0, 'and the air is left as it was');
});

test('the aim lies farther out the more level the view; wind control and the whirl are set down there', () => {
  const far = new Powers(), near = new Powers();
  far.pick(2); near.pick(4);
  const sf = fakeSim({ pitch: -0.12 }), sn = fakeSim({ pitch: -0.9 });
  // (the hand goes down, the circle grows, the lift casts it: hold to grow, let go to cast)
  const cast = (p, sim) => { p.down = true; step(p, sim, 2); p.down = false; step(p, sim, 2); };
  cast(far, sf); cast(near, sn);
  const a = far.winds[0], b = near.winds[0];
  assert.equal(a.kind, KIND.zone); assert.ok(a.gain > 1, 'quicken');
  assert.equal(b.kind, KIND.vortex);
  assert.ok(a.pz > 24 && a.pz <= POWERS.aimFar, 'a level view: far out, ' + a.pz.toFixed(1) + ' m');
  assert.ok(Math.abs(b.pz - POWERS.aimNear) < 0.5, 'looking down: near, ' + b.pz.toFixed(1) + ' m');
  const still = new Powers(); still.pick(3); cast(still, fakeSim());
  assert.equal(still.winds[0].gain, 0, 'still: a dead calm');
});

test('gather: a ball held while the hand is down follows the aim; let go, it is thrown as a gust', () => {
  const p = new Powers(), sim = fakeSim({ pitch: -0.5 });
  p.pick(1); p.down = true; step(p, sim, 2);
  assert.equal(p.winds.count, 1); assert.equal(p.winds[0].kind, KIND.orb);
  assert.ok(Math.abs(p.winds[0].pz - POWERS.orbAhead) < 0.5, 'at first just ahead of the explorer');
  step(p, sim, 120);
  const out = p.winds[0].pz;
  assert.ok(out > 10 && out <= POWERS.orbReach + 0.1, 'carried out along the aim: ' + out.toFixed(1) + ' m');
  sim.footCam.viewFwd = { x: 1, y: 0, z: 0 }; step(p, sim, 120);
  assert.ok(p.winds[0].px > 10 && Math.abs(p.winds[0].pz) < 1, 'and round with the view');
  p.down = false; step(p, sim, 1);
  assert.ok(p.winds.count === 2 && p.winds.some((s) => s.kind === KIND.jet), 'let go: a gust from where the ball was');
  step(p, sim, 60 * 4); assert.equal(p.winds.count, 0);
});

test('only on foot; never more than the limit; five abilities in the order of the keys', () => {
  const p = new Powers(), ship = fakeSim({ state: S.FLYING || 'FLYING' });
  p.down = true; step(p, ship, 10);
  assert.equal(p.winds.count, 0, 'nothing from the ship');
  const sim = fakeSim();
  for (let k = 0; k < 20; k++) { p.down = false; step(p, sim, 20); p.down = true; step(p, sim, 2); }
  assert.ok(p.winds.count <= WINDPOWER.max);
  assert.deepEqual(ABILITIES.map((a) => a.id), ['gust', 'gather', 'quicken', 'still', 'whirl', 'part', 'knife']);
});

test('part water: held, a channel goes with the explorer along the view and its floor is dry; let go, it closes', () => {
  const p = new Powers(), sim = fakeSim();
  p.pick(5); p.down = true; step(p, sim, 150);
  assert.ok(p.part && p.winds.count === 1 && p.winds[0].kind === KIND.part, 'one channel, held');
  assert.equal(p.part.len, p.part.reach, 'run out to its full length in a second');
  assert.ok(p.part.reach >= WINDPOWER.partReach, 'and held, it is at least its own reach: ' + p.part.reach.toFixed(1) + ' m');
  assert.ok(Math.abs(p.part.pz + WINDPOWER.partBack) < 1e-6 && Math.abs(p.part.dz - 1) < 1e-6, 'it begins just behind the explorer and lies along the view');
  const at = (x, z) => { const l = Math.hypot(x, R, z); return p.dry('earth', { x: x / l, y: R / l, z: z / l }, l); };
  assert.ok(at(0, 5), 'dry 5 m ahead'); assert.ok(at(0, 0), 'dry under the explorer');
  assert.ok(!at(p.part.radius + 2, 5), 'water beyond its wall (it is ' + p.part.radius.toFixed(1) + ' m to each side, held)'); assert.ok(!at(0, p.part.reach + 3), 'and beyond its reach');
  // it follows the explorer and the view
  sim.ex.p = { x: 10, y: R, z: 0 }; sim.footCam.viewFwd = { x: 1, y: 0, z: 0 }; step(p, sim, 2);
  assert.ok(Math.abs(p.part.dx - 1) < 1e-3 && Math.abs(p.part.px - (10 - WINDPOWER.partBack)) < 0.02, 'moved and turned with them');
  assert.ok(at(14, 0) && !at(0, 5), 'the dry floor is where they look now');
  // let go: it closes; another ability chosen while held closes it too
  p.down = false; step(p, sim, 2);
  assert.equal(p.part, null); assert.equal(p.winds.count, 1, 'still closing');
  step(p, sim, 60 * 5); assert.equal(p.winds.count, 0, 'closed and gone (the longer it was held, the longer it takes)'); assert.ok(!at(15, 0));
  p.down = true; step(p, sim, 10); assert.ok(p.part); p.pick(0); assert.equal(p.part, null, 'choosing another ability lets it go');
});

test('a word when an ability can do nothing here: the knife with no tree in reach, the channel with no water', () => {
  const p = new Powers(), sim = fakeSim();
  assert.equal(p.note, '');
  p.pick(ABILITIES.findIndex((a) => a.id === 'knife')); p.tapOnce = true; step(p, sim, 2);
  assert.equal(p.casts, 1); assert.equal(p.fells, 0); assert.equal(p.note, 'no tree in reach');
  step(p, sim, 60); assert.equal(p.note, 'no tree in reach', 'it stands for a moment');
  step(p, sim, 60 * 2); assert.equal(p.note, '', 'and goes');
  p.pick(ABILITIES.findIndex((a) => a.id === 'part')); p.down = true; step(p, sim, 2);
  assert.ok(p.part, 'the channel is still made (a wind along the ground)'); assert.equal(p.note, 'no water here');
  p.down = false; step(p, sim, 60 * 3);
  // over water it says nothing
  const wet = fakeSim(); wet.sampleSurface = () => ({ radius: R, liquidRadius: R + 1 });
  const q = new Powers(); q.pick(ABILITIES.findIndex((a) => a.id === 'part')); q.down = true; step(q, wet, 2);
  assert.equal(q.note, '');
});

test('a tap from the touch button is one cast, however slow the frames are', () => {
  const p = new Powers(), sim = fakeSim();
  p.tapOnce = true; step(p, sim, 2, 0.5);                    // one frame of half a second sees it
  assert.equal(p.casts, 1); assert.equal(p.tapOnce, false, 'taken');
  step(p, sim, 3, 0.5); assert.equal(p.casts, 1, 'and it is not held: no second cast');
  p.tapOnce = true; step(p, sim, 2, 0.5); assert.equal(p.casts, 2, 'the next tap casts again');
});

test('the touch button takes the finger: the HUD lets touches through to the picture, so the button must ask for them', () => {
  const ui = fs.readFileSync(new URL('../src/ui/powers.js', import.meta.url), 'utf8');
  const rule = /\.pc-pw-btn \{([^}]*)\}/.exec(ui);
  assert.ok(rule && /pointer-events:\s*auto/.test(rule[1]), '.pc-pw-btn has pointer-events: auto');
  assert.ok(/touch-action:\s*none/.test(rule[1]), 'and no scroll or zoom starts on it');
  const theme = fs.readFileSync(new URL('../src/ui/theme.css', import.meta.url), 'utf8');
  assert.ok(/\.pc-hud \{[^}]*pointer-events:\s*none/.test(theme), '(the HUD layer lets them through: that is why)');
});

test('without ?powers=1 nothing of the powers is loaded: main.js imports them only behind the flag', () => {
  const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.ok(!/^import .*powers/m.test(main), 'no static import of the powers in main.js');
  assert.ok(/params\.has\('powers'\)[\s\S]{0,200}import\('\.\/core\/powers\.js'\)/.test(main), 'a dynamic import behind the flag');
  for (const f of ['../src/core/sim.js', '../src/core/game.js', '../src/ui/hud.js']) {
    const s = fs.readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.ok(!/from '\.\.?\/[a-z/]*powers\.js'/.test(s), f + ' does not import the powers');
  }
});

test('THE ULTIMATE (owner, 2026-11-18): holding past the full circle runs a second charge, and letting go then lays a whole stand down', () => {
  // a stand of 40 trees scattered over 30 m in front of the explorer, as the world would hand them over
  const trees = [];
  for (let i = 0; i < 40; i++) {
    const a = (i * 2.399963), r = 2 + (i % 7) * 4.1;
    trees.push({ kind: 'tree', radius: 0.4, height: 14, p: { x: Math.sin(a) * r, y: R, z: 14 + Math.cos(a) * r } });
  }
  const sim = fakeSim();
  sim.sampleObstacles = () => trees;
  const p = new Powers();
  felledLoad([]);                                  // a clean slate: no tree felled yet
  p.down = true;
  step(p, sim, Math.ceil(WINDPOWER.chargeTime * 60) + 4);
  assert.ok(p.charge >= 1, 'the circle is full: ' + p.charge.toFixed(2));
  assert.ok(!p.ultReady, 'and the ultimate is NOT ready on the first charge alone');
  assert.ok(p.ult > 0, 'the second charge has begun: ' + p.ult.toFixed(2));
  step(p, sim, Math.ceil(WINDPOWER.ultTime * 60) + 4);
  assert.ok(p.ultReady, 'held on, the ultimate is ready');
  const before = FELLED.size;
  p.down = false; step(p, sim, 2);
  assert.equal(p.ults, 1, 'one ultimate cast');
  const laid = FELLED.size - before;
  assert.ok(laid > 10, 'a blast lays a whole section of wood down: ' + laid + ' trees');
  assert.ok(laid <= WINDPOWER.ultFellMax, 'and never more than its own limit: ' + laid);
  // the wave: the near trees go over first, the far ones later
  const waits = [];
  // (the blast's middle is half its length down the aim, not where the trees happen to be clustered)
  const cz = WINDPOWER.ultGustLen * 0.5;
  for (const t of trees) { const F = felledAt('earth', t.p.x, t.p.y, t.p.z); if (F) waits.push({ d: Math.hypot(t.p.x, t.p.z - cz), f: F.f }); }
  waits.sort((a, b) => a.d - b.d);
  assert.ok(waits.length > 10 && waits[0].f > waits[waits.length - 1].f, 'the near ones are further over than the far ones (the fall travels outward): nearest ' + waits[0].f.toFixed(3) + ', farthest ' + waits[waits.length - 1].f.toFixed(3));
  console.log('THE GUST\'S ULTIMATE: ' + laid + ' trees laid down, the nearest at ' + waits[0].d.toFixed(1) + ' m and the farthest at ' + waits[waits.length - 1].d.toFixed(1) + ' m');
});

test('an ordinary cast is not an ultimate, and letting go early never fells a stand', () => {
  const trees = [];
  for (let i = 0; i < 20; i++) trees.push({ kind: 'tree', radius: 0.4, height: 14, p: { x: (i % 5) * 3 - 6, y: R, z: 10 + ((i / 5) | 0) * 4 } });
  const sim = fakeSim();
  sim.sampleObstacles = () => trees;
  const p = new Powers();
  felledLoad([]);
  p.down = true;
  step(p, sim, Math.ceil(WINDPOWER.chargeTime * 60) + 4);     // full circle, but no second charge
  p.down = false; step(p, sim, 2);
  assert.equal(p.ults, 0, 'no ultimate');
  assert.equal(FELLED.size, 0, 'and not one tree laid down by an ordinary gust');
});

test('FIRE IS REACHABLE (owner, 2026-11-18: "Now make a fire ability"): the element swaps, and kindle lights a fire through the physics', () => {
  const p = new Powers(), sim = fakeSim();
  assert.equal(p.list[p.ability].id, 'gust', 'the wind is in the hand to begin with');
  p.nextElement();
  assert.equal(p.element, 1);
  assert.equal(p.list[p.ability].id, 'kindle', 'and now the fire is');
  // (2026-11-19, the owner: "give it 5 new abilities that are fire based". Six now, and the test names them
  //  rather than counting them, so that a rename or a reorder is caught as well as a loss.)
  // (2026-11-22, the owner: "Give it cooler abilities as well the fire". Nine now.)
  assert.deepEqual(p.list.map((a) => a.id),
    ['kindle', 'ember', 'bellows', 'wall', 'snuff', 'firewhirl', 'meteor', 'lance', 'cinders'],
    'the fire does not have the nine abilities it should');
  for (const a of p.list) assert.ok(a.word && typeof a.word === 'string', a.id + ' has no word for the screen');
  // the physics is what lights it, because only it knows what is underfoot there
  let asked = null;
  sim.physics = { lightFire: (fires, bodyId, at, size) => { asked = { bodyId, at, size }; return { kind: 1 }; } };
  p.down = true; step(p, sim, 2); p.down = false; step(p, sim, 2);
  assert.ok(asked, 'the physics was asked to light it');
  assert.equal(asked.bodyId, 'earth');
  assert.equal(p.fireCasts, 1, 'one fire lit');
  // and the element key walks THREE now (2026-11-22: space and time is the third), round to the wind again
  p.nextElement();
  assert.equal(p.element, 2);
  assert.equal(p.list[p.ability].id, 'fold', 'space and time is the third element');
  p.nextElement();
  assert.equal(p.element, 0);
  assert.equal(p.list[p.ability].id, 'gust');
  assert.equal(p.charge, 0, 'and nothing is left charged across the swap');
});

test('SPACE AND TIME is the third element, and is the FOUR the owner cut it down to (2026-11-22)', async () => {
  const { TIME_ABILITIES, ELEMENTS } = await import('../src/core/powers.js');
  // The first design had twelve ("give me at least 10 powers for that one"). The owner cut them the same day:
  // "to many space and time abilities cut them down ... the 4 should be overly powerful abilities like a rip in
  // space time that sucks everything in a long ways in". Folding space is one, by name, and the rip is the
  // owner's own idea.
  assert.equal(TIME_ABILITIES.length, 4, 'the owner asked for four: there are ' + TIME_ABILITIES.length);
  assert.deepEqual(TIME_ABILITIES.map((a) => a.id), ['fold', 'rip', 'freeze', 'year'],
    'the four of space and time are not what docs/POWERS-TIME.md says they are');
  assert.ok(TIME_ABILITIES.some((a) => a.id === 'fold'), 'folding space was named by the owner and must be one');
  assert.ok(TIME_ABILITIES.some((a) => a.id === 'rip'), 'the rip was the owner\'s own idea and must be one');
  // every one has a word for the screen, and no two share an id with another element (the dispatch is BY id, so
  // a clash would cast the wrong power: `still` was the wind's and nearly became this element's as well)
  const seen = new Set();
  for (const el of ELEMENTS) for (const a of el.list) {
    assert.ok(a.word && typeof a.word === 'string', a.id + ' has no word for the screen');
    assert.ok(!seen.has(a.id), 'two elements both have an ability called ' + a.id + ': the dispatch is by id');
    seen.add(a.id);
  }
  assert.equal(ELEMENTS.length, 3);
  assert.equal(ELEMENTS[2].list, TIME_ABILITIES);
  // the ones that were cut are gone with their code, not left in the list unreachable
  for (const gone of ['slow', 'haste', 'unmake', 'sun', 'knot', 'door', 'eye', 'lens', 'mile']) {
    assert.ok(!seen.has(gone), gone + ' was cut by the owner but is still in a list');
  }
});

test('space and time: a slowed place really slows the world in it, and nothing outside it (2026-11-22)', async () => {
  const { makeTimes, castTime, stepTimes, placeTimes, timeAt, TIMEPOWER } = await import('../src/physics/times.js');
  const T = makeTimes();
  assert.equal(timeAt(T, 0, 0), 1, 'with nothing cast the world runs at its own pace');
  const frame = { lx: (x) => x, lz: (x, y, z) => z, ly: () => 0, r0: 0 };
  castTime(T, 'earth', { x: 0, y: 0, z: 0 }, TIMEPOWER.slowRate, 1, TIMEPOWER.slowLife, false);
  for (let i = 0; i < 60; i++) stepTimes(T, 1 / 60);     // let it open
  placeTimes(T, frame, 'earth');
  assert.ok(timeAt(T, 0, 0) < 0.3, 'the middle of a slowed place is not slow: ' + timeAt(T, 0, 0));
  assert.equal(timeAt(T, 400, 0), 1, 'a place four hundred metres off was slowed too');
  // it closes by itself, and gives its slot back
  for (let i = 0; i < 60 * 20; i++) stepTimes(T, 1 / 60);
  assert.equal(T.count, 0, 'a bubble outlived its life: ' + T.count);
  assert.equal(timeAt(T, 0, 0), 1);

  // ... and a STOPPED place stops it altogether, and outlives the hand that cast it
  const S2 = makeTimes();
  castTime(S2, 'earth', { x: 0, y: 0, z: 0 }, TIMEPOWER.stillRate, 1, TIMEPOWER.stillLife, false);
  for (let i = 0; i < 60; i++) stepTimes(S2, 1 / 60);
  placeTimes(S2, frame, 'earth');
  assert.ok(timeAt(S2, 0, 0) < 0.02, 'a stopped place still runs: ' + timeAt(S2, 0, 0));
  for (let i = 0; i < 60 * 20; i++) stepTimes(S2, 1 / 60);
  assert.equal(S2.count, 1, 'a stopped place did not outlive the hand that cast it');
});

test('A SPARK FALLS SHORT onto ground that will burn, and says plainly when nothing will (owner, 2026-11-18: the fire at the riverside spawn)', () => {
  // The world here: water from 9 m out, a bank that burns nearer than that. (At the owner's own
  // spawn the aim lands on the river as often as on the bank; measured 2026-11-18, six casts, all refused.)
  const p = new Powers(), sim = fakeSim();
  p.nextElement();
  const dist = (at) => Math.hypot(at.x - sim.ex.p.x, at.y - sim.ex.p.y, at.z - sim.ex.p.z);
  let lit = null;
  sim.physics = {
    fuelAt: (bodyId, at, o = {}) => {
      const d = dist(at);
      if (d >= 9) { o.kind = 0; o.fuel = 0; o.wet = 1; o.why = 'water'; } else { o.kind = 2; o.fuel = 0.8; o.wet = 0; o.why = ''; }
      return o;
    },
    lightFire: (fires, bodyId, at, size) => { lit = { x: at.x, y: at.y, z: at.z, d: dist(at) }; const o = {}; return Object.assign(o, sim.physics.fuelAt(bodyId, at, o), { fuel: o.fuel }); },
  };
  p.down = true; step(p, sim, 2); p.down = false; step(p, sim, 2);
  assert.ok(lit, 'a fire was lit');
  assert.ok(lit.d < 9, 'short of the water, not in it: ' + lit.d.toFixed(1) + ' m');
  assert.ok(lit.d > 1, 'and not at the explorer’s own feet: ' + lit.d.toFixed(1) + ' m');
  assert.ok(!p.note || p.note === 'fire', 'nothing complained about: ' + p.note);

  // and where NOTHING near the aim will burn, the word on the screen says which thing refused it
  const q = new Powers(), sim2 = fakeSim();
  q.nextElement();
  sim2.physics = {
    fuelAt: (bodyId, at, o = {}) => { o.kind = 0; o.fuel = 0; o.wet = 1; o.why = 'water'; return o; },
    lightFire: () => ({ kind: 0, fuel: 0, wet: 1, why: 'water' }),
  };
  step(q, sim2, 40);                       // past the word the element swap leaves
  q.down = true; step(q, sim2, 2); q.down = false; step(q, sim2, 2);
  assert.equal(q.note, 'the water will not take it', 'the screen names the water, not a vague "nothing here will burn"');
});

test('FIRE HAS AN ULTIMATE, and a hold that is taken away casts nothing (found by independent readers, 2026-11-18)', () => {
  // (1) The headline of this version was fire, kindle is its one ability, and holding the button -- the first thing
  //     anyone does after the screen says "ULTIMATE ready - let go" -- lit nothing whatever: the sound played, the
  //     explorer threw the cast, and no fire existed.
  const p = new Powers(), sim = fakeSim();
  p.nextElement();
  let lit = 0, size = 0;
  sim.physics = { lightFire: (f, b, at, k) => { lit++; size = k; return { kind: 2, fuel: 0.8, wet: 0, why: '' }; } };
  p.down = true;
  step(p, sim, Math.ceil((WINDPOWER.chargeTime + WINDPOWER.ultTime) * 60) + 8);
  assert.ok(p.ultReady, 'the second charge is full');
  p.down = false; step(p, sim, 2);
  assert.equal(p.ults, 1, 'one ultimate cast');
  assert.equal(lit, 1, 'and it lit a fire');
  assert.ok(size > WINDPOWER.sizeMax, 'a great one, not an ordinary cast: ' + size);
  assert.equal(p.note, 'a great fire is set', 'and the screen says so, not the word written for gather');

  // (2) Swapping the element with the cast key still down used to read as a fresh press on the next frame, arm the
  //     new element's first ability and cast it on release: one cast key and one element key, and a fire was lit in
  //     the wood with permanent scorch marks that nobody asked for.
  const q = new Powers(), sim2 = fakeSim();
  let lit2 = 0;
  sim2.physics = { lightFire: () => { lit2++; return { kind: 2, fuel: 0.8, wet: 0, why: '' }; } };
  q.keys.cast = true; step(q, sim2, 60);          // a gust charging
  q.nextElement();                                 // G, with the key still down
  step(q, sim2, 2);
  q.keys.cast = false; step(q, sim2, 2);           // the hand lifts
  assert.equal(lit2, 0, 'no fire was lit by a swap');
  assert.equal(q.casts, 0, 'and nothing was cast at all');
  // and the hands still work afterwards
  q.keys.cast = true; step(q, sim2, 2); q.keys.cast = false; step(q, sim2, 2);
  assert.equal(lit2, 1, 'a fresh press still lights one');

  // (3) Changing ability mid-hold abandons the hold instead of silently eating a four-second charge
  const r = new Powers(), sim3 = fakeSim();
  r.down = true;
  step(r, sim3, Math.ceil((WINDPOWER.chargeTime + WINDPOWER.ultTime) * 60) + 8);
  assert.ok(r.ultReady);
  r.pick(4);
  assert.ok(!r.ultReady && r.charge === 0, 'the charge is visibly let go, not kept for an ability that never earned it');
  assert.notEqual(r.note, 'ULTIMATE ready - let go', 'and the screen stops promising it');
  r.down = false; step(r, sim3, 2);
  assert.equal(r.ults, 0, 'nothing was cast');
});

// ---- THE FIVE NEW FIRE ABILITIES (the owner, 2026-11-19) ---------------------------------------
// A stand-in physics that records what each one asked of it, so that what the ability DOES is held, not just that
// it does not throw.
function fireRig() {
  const lit = [], doused = [];
  let whirl = null;
  const sim = fakeSim();
  sim.physics = {
    lightFire: (F, bodyId, at, size) => { lit.push({ bodyId, at: { ...at }, size }); return { kind: 1, fuel: 1, wet: 0 }; },
    fuelAt: (bodyId, p, out = {}) => { out.kind = 1; out.fuel = 1; out.wet = 0; return out; },
    douseNear: (F, bodyId, p, r) => { doused.push({ bodyId, p: { ...p }, r }); return 3; },
    fireWhirl: () => whirl,
  };
  return { sim, lit, doused, setWhirl: (w) => { whirl = w; } };
}
const castOnce = (p, sim) => { p.down = true; step(p, sim, 2); p.down = false; step(p, sim, 2); };
const pickFire = (p, id) => { p.setElement(1); const i = p.list.findIndex((a) => a.id === id); assert.ok(i >= 0, 'no ability ' + id); p.pick(i); };

test('fire ember: the spark is thrown FURTHER than the aim and does not fall short', () => {
  const { sim, lit } = fireRig();
  const p = new Powers();
  pickFire(p, 'ember');
  castOnce(p, sim);
  assert.equal(lit.length, 1, 'the ember lit nothing');
  // it must land beyond the aim, along the same line from the explorer
  const a = p.aim, from = a.from;
  const aimD = Math.hypot(a.p.x - from.x, a.p.y - from.y, a.p.z - from.z);
  const gotD = Math.hypot(lit[0].at.x - from.x, lit[0].at.y - from.y, lit[0].at.z - from.z);
  assert.ok(gotD > aimD * 1.5, 'the spark landed at ' + gotD.toFixed(1) + ' m, barely past the aim at ' + aimD.toFixed(1));
});

test('fire bellows: it makes REAL WIND, which is how it speeds a fire up', () => {
  // the owner asked that putting air on a fire speeds it. The honest way is to make wind the fire already reads,
  // not a number that says "faster": so what this test holds is that a wind source appears.
  const { sim } = fireRig();
  const p = new Powers();
  pickFire(p, 'bellows');
  const before = p.winds.count;
  castOnce(p, sim);
  assert.ok(p.winds.count > before, 'bellows made no wind at all, so it cannot fan anything');
});

test('fire wall: a line of fire is laid ACROSS the view, not one patch at the aim', () => {
  const { sim, lit } = fireRig();
  const p = new Powers();
  pickFire(p, 'wall');
  castOnce(p, sim);
  assert.ok(lit.length >= 3, 'a wall of ' + lit.length + ' patches is not a wall');
  // the patches must be spread out, and across the view rather than along it
  let most = 0;
  for (let i = 0; i < lit.length; i++) for (let j = i + 1; j < lit.length; j++) {
    const d = Math.hypot(lit[i].at.x - lit[j].at.x, lit[i].at.y - lit[j].at.y, lit[i].at.z - lit[j].at.z);
    if (d > most) most = d;
  }
  assert.ok(most > 4, 'the wall is only ' + most.toFixed(1) + ' m from end to end');
});

test('fire snuff: it puts out what is near the aim, on this world only', () => {
  const { sim, doused } = fireRig();
  const p = new Powers();
  pickFire(p, 'snuff');
  castOnce(p, sim);
  assert.equal(doused.length, 1, 'snuff asked the physics to put nothing out');
  assert.equal(doused[0].bodyId, sim.bodyId);
  assert.ok(doused[0].r > 0, 'snuff reached nowhere');
});

test('fire whirl: it needs a fire great enough, and then it turns the air where that fire is', () => {
  const rig = fireRig();
  const p = new Powers();
  pickFire(p, 'firewhirl');
  // with no fire there is nothing to turn, and no wind is made
  const before = p.winds.count;
  castOnce(p, rig.sim);
  assert.equal(p.winds.count, before, 'a fire whirl turned the air with no fire under it');

  // now the physics reports a column at the aim
  const p2 = new Powers();
  pickFire(p2, 'firewhirl');
  p2._aim(rig.sim);
  rig.setWhirl({ bodyId: rig.sim.bodyId, px: p2.aim.p.x, py: p2.aim.p.y, pz: p2.aim.p.z, strength: 0.8, patches: 12 });
  const was = p2.winds.count;
  castOnce(p2, rig.sim);
  assert.ok(p2.winds.count > was, 'a fire whirl with a fire under it made no turning air');
});

// ============================================================================================================
// THE FREEZE THE OWNER FOUND (2026-11-22: "The spacetime powers freeze the game everytime I open it"), and the
// guard against another one like it.
//
// What it was: the aim mark's ring is sized from a table of one function per ability, and the table had entries
// for the wind's seven and six of the fire's nine. The fire's meteor, lance and cinders and ALL TWELVE of space
// and time had none, so `AIM_SIZE[id](A.dist)` threw a TypeError the moment one of them was in hand -- inside
// powers.update, inside sim.frame, inside game.frame. The frame stopped there: the world was never stepped and
// nothing was painted. Because the loop asks for the next frame BEFORE it runs this one (main.js tick), there was
// no error on the screen and no fall-over, only a game that stopped dead and stayed stopped. Nine of the twenty-one
// abilities did it, every time, and no test here ever held one.
//
// So: every ability of every element, held and let go, at a tap, at an ordinary hold and held past the ultimate.
// Nothing here may throw, and every one must have a ring to show for itself.
test('every ability of every element can be aimed, held and cast without throwing: a frame must never stop', () => {
  assert.ok(ELEMENTS.length >= 3, 'three elements by now');
  for (const el of ELEMENTS) {
    for (let i = 0; i < el.list.length; i++) {
      const id = el.list[i].id, where = el.id + '/' + id;
      // (a world that turns, for the sun's hand; no physics, which is the hardest case: every ability must give up
      //  quietly when the world cannot answer, not throw)
      const sim = fakeSim();
      sim.eph = { turnBy: () => true };
      const p = new Powers();
      while (p.element !== el.n) p.nextElement();
      p.pick(i);
      assert.equal(p.list[i].id, id, where + ': the list in hand is not the element\'s own');
      // standing with it in hand: the aim mark must have a ring, and a sane one
      step(p, sim, 2);
      assert.ok(p.aim.ok, where + ': no aim');
      assert.ok(p.aim.size > 0 && p.aim.size < 400, where + ': the ring of the aim mark is ' + p.aim.size);
      // a tap
      p.tapOnce = true; step(p, sim, 2); step(p, sim, 20);
      // an ordinary hold
      p.down = true; step(p, sim, 12); p.down = false; step(p, sim, 12);
      // and held past "ULTIMATE ready" (the clock is the step's own dt, so this is seconds of holding)
      p.down = true; step(p, sim, 40, 0.2);
      assert.equal(p.ultReady, true, where + ': a long hold never reaches the ultimate');
      p.down = false; step(p, sim, 12);
      // (the four of space and time that are only designed so far say so and cast nothing: docs/POWERS-TIME.md)
      const unbuilt = id === 'eye' || id === 'mile' || id === 'door' || id === 'lens';
      if (!unbuilt) assert.ok(p.casts > 0, where + ': nothing was ever cast');
      step(p, sim, 90);                         // and it all runs out again without a word
    }
  }
});

// And the one thing the freeze turned up beside itself: holding an ability past full must do SOMETHING.
test('held past the ultimate, an ability with no ultimate of its own is still cast, at the greatest size', () => {
  for (const el of ELEMENTS) {
    for (const ab of el.list) {
      const has = Powers.hasUlt(ab.id);
      if (ab.hold) continue;                    // gather and part are held open: their ultimate is the holding
      if (ab.id === 'eye' || ab.id === 'mile' || ab.id === 'door' || ab.id === 'lens') continue;   // not built yet
      const sim = fakeSim(); sim.eph = { turnBy: () => true };
      const p = new Powers();
      while (p.element !== el.n) p.nextElement();
      p.pick(el.list.indexOf(ab));
      p.down = true; step(p, sim, 40, 0.2);
      p.down = false; step(p, sim, 4);
      assert.ok(p.casts >= 1, el.id + '/' + ab.id + ': held to the full and nothing was cast');
      if (has) assert.ok(p.ults > 0, el.id + '/' + ab.id + ': its own ultimate was not used');
    }
  }
});

// FOLDING SPACE, theatrical (the owner, 2026-11-22: "make it a bit more theatrical like the world is getting
// pulled towards you"). Nothing jumps in one frame any more: the world is drawn past for about half a second.
test('the fold draws the world past you over half a second and sets you down where you looked', async () => {
  const { TIMEPOWERS } = await import('../src/core/powers.js');
  const R = 4000;
  const p = new Powers(), sim = fakeSim();
  while (p.element !== 2) p.nextElement();
  p.pick(0);
  assert.equal(p.list[0].id, 'fold');
  const start = { ...sim.ex.p };
  p.tapOnce = true; step(p, sim, 2);
  assert.ok(p.fold, 'no fold began');
  // it does NOT arrive at once: a few frames in it is a little way along, not at the far end
  const far = { ...p.fold.p1 };
  step(p, sim, 3);
  const d0 = Math.hypot(sim.ex.p.x - start.x, sim.ex.p.y - start.y, sim.ex.p.z - start.z);
  const full = Math.hypot(far.x - start.x, far.y - start.y, far.z - start.z);
  assert.ok(full > 40, 'a fold should carry you a long way: ' + full.toFixed(0) + ' m');
  assert.ok(d0 > 0 && d0 < full * 0.75, 'the world was not drawn past, it jumped: ' + d0.toFixed(1) + ' of ' + full.toFixed(0));
  // the air pours INWARD along the way while it runs (a gust from the far end back to the feet)
  assert.ok(p.winds.count > 0, 'nothing pours in with the world');
  // and by the end of its half second it is standing there, and the fold is over
  step(p, sim, Math.ceil(TIMEPOWERS.foldTime * 60) + 4);
  assert.equal(p.fold, null, 'the fold never ended');
  const land = Math.hypot(sim.ex.p.x - far.x, sim.ex.p.y - far.y, sim.ex.p.z - far.z);
  assert.ok(land < 1.5, 'it did not set you down where you looked: ' + land.toFixed(2) + ' m out');
  assert.ok(Math.abs(Math.hypot(sim.ex.p.x, sim.ex.p.y, sim.ex.p.z) - R) < 1, 'and not on the ground');
});

// THE RIP, in the player's hand: it is a wind source of its own kind, so the world answers it with nothing added.
test('the rip tears open a wind source that reaches tens of metres, and closes by itself', async () => {
  const { TIMEPOWERS } = await import('../src/core/powers.js');
  const { KIND } = await import('../src/physics/powers.js');
  const p = new Powers(), sim = fakeSim();
  while (p.element !== 2) p.nextElement();
  p.pick(1);
  assert.equal(p.list[1].id, 'rip');
  p.tapOnce = true; step(p, sim, 2);
  assert.equal(p.winds.count, 1, 'no rip was torn');
  const s = p.winds[0];
  step(p, sim, 90);                                 // it tears open over about a second (TIMEPOWER ripFade)
  assert.equal(s.kind, KIND.rip);
  assert.ok(Math.abs(s.radius - TIMEPOWERS.ripReach) < 1, 'the rip reaches ' + s.radius + ' m, not ' + TIMEPOWERS.ripReach);
  assert.ok(s.radius > 40, 'a long way is the whole point of it');
  // the painter is handed it on the time list, because a rip lives in the WIND list which the painter never sees
  assert.ok(p.times.rips && p.times.rips.length === 1, 'the painter was not handed the rip');
  // held to the full it is far bigger
  const q = new Powers(), sim2 = fakeSim();
  while (q.element !== 2) q.nextElement();
  q.pick(1);
  q.down = true; step(q, sim2, 40, 0.2); q.down = false; step(q, sim2, 3);
  assert.ok(q.winds.count >= 1 && q.winds[0].radius > TIMEPOWERS.ripReach * 1.5,
    'held to the full the rip is no bigger: ' + (q.winds[0] && q.winds[0].radius));
  // and it is not held open: it closes
  step(p, sim, 60 * 9);
  assert.equal(p.winds.count, 0, 'a rip outlived its life');
  assert.equal(p.times.rips.length, 0, 'and the painter is still being handed it');
});

// ---- THE AIM REACHES AS FAR AS THE EYE DOES (2026-11-22) ----------------------------------------------------
// The owner asked for the world to move at three hundred yards (275 m). Until v32 the aim's distance was a
// function of the camera's PITCH alone -- 6 m looking steeply down, 30 m level -- and the view was never traced
// against the land, so every power landed at most thirty metres away whatever the player was looking at. The view
// is marched against the real ground now (src/core/powers.js _march) and the pitch rule is kept as the FLOOR and
// the fallback, so the aim can only ever go FURTHER than it used to.
const along = (d) => { const l = Math.hypot(d.x, d.y, d.z) || 1; return Math.atan2(d.z / l, d.y / l) * R; };
// a world with a wall of rock standing 60 m tall across the view at `at` metres, and flat ground before it
const ridgeSim = (pitch = -0.02, at = 150) => {
  const s = fakeSim({ pitch });
  s.ex.v = { x: 0, y: 0, z: 0 };
  s.sampleSurface = (b, d) => ({ radius: R + (along(d) > at ? 60 : 0), liquidRadius: 0 });
  return s;
};

test('the aim is marched against the land: a look at the far ridge puts the power on the ridge', () => {
  const p = new Powers(); p.pick(2);                     // quicken: an ability that acts AT the aim
  const sim = ridgeSim();
  step(p, sim, 8);
  assert.ok(p.aim.pitchDist <= POWERS.aimFar, 'the pitch rule alone still says ' + p.aim.pitchDist.toFixed(1) + ' m');
  assert.ok(p.aim.ray > 100 && p.aim.ray < 160, 'the march met the ridge at ' + p.aim.ray.toFixed(1) + ' m');
  assert.ok(p.aim.dist > 100, 'and the aim went out to it: ' + p.aim.dist.toFixed(1) + ' m');
  // and the cast is really set down out there, not at arm's length
  p.down = true; step(p, sim, 2); p.down = false; step(p, sim, 2);
  const s = p.winds[0];
  assert.equal(s.kind, KIND.zone);
  const out = Math.hypot(s.px - sim.ex.p.x, s.py - sim.ex.p.y, s.pz - sim.ex.p.z);
  assert.ok(out > 100, 'the power was set down ' + out.toFixed(1) + ' m away, not on the far ridge');
});

test('the aim falls back to the pitch rule for a view that meets nothing, and for a world that will not answer', () => {
  // the sky: the march walks its whole ladder and meets nothing
  const sky = new Powers(); sky.pick(2);
  step(sky, ridgeSim(0.5), 10);
  assert.equal(sky.aim.ray, 0, 'something was met in the sky');
  assert.ok(Math.abs(sky.aim.dist - sky.aim.pitchDist) < 1e-9, 'the pitch rule did not stand: ' + sky.aim.dist);
  assert.ok(sky.aim.ok && Number.isFinite(sky.aim.p.x), 'and there is still an aim to draw');
  // a world that throws on every sample (between worlds, a body with nothing made yet)
  const dead = new Powers(); dead.pick(2);
  const sim = fakeSim(); sim.sampleSurface = () => { throw new Error('nothing made here yet'); };
  step(dead, sim, 10);
  assert.equal(dead.aim.ray, 0);
  assert.ok(dead.aim.dist > 0 && dead.aim.dist <= POWERS.aimFar, 'the pitch rule is the fallback: ' + dead.aim.dist);
  // and the aim never goes NEARER than the pitch rule, at any pitch, on any of these grounds
  for (let pit = -1.15; pit <= 1.25; pit += 0.1) {
    for (const g of [ridgeSim(pit).sampleSurface, () => ({ radius: R, liquidRadius: 0 }), () => ({ radius: R, liquidRadius: R + 3 })]) {
      const q = new Powers(); q.pick(2);
      const s2 = fakeSim({ pitch: pit }); s2.sampleSurface = g;
      step(q, s2, 10);
      assert.ok(q.aim.dist >= q.aim.pitchDist - 1e-9, 'at pitch ' + pit.toFixed(2) + ' the aim came nearer than it used to');
      assert.ok(Number.isFinite(q.aim.dist) && Number.isFinite(q.aim.size), 'at pitch ' + pit.toFixed(2) + ': not a number');
    }
  }
});

test('the aim march is amortised: a few rungs a frame while nothing is pressed, the whole ladder on the press', () => {
  // nothing pressed: the first frame cannot have walked all nine rungs, so the ring is still the pitch rule's
  const slow = new Powers(); slow.pick(2);
  const sim = ridgeSim();
  step(slow, sim, 1);
  assert.equal(slow.aim.ray, 0, 'the whole ladder was walked on an idle frame');
  step(slow, sim, 6);
  assert.ok(slow.aim.ray > 100, 'the sweep never finished: ' + slow.aim.ray);
  // a tap: the press walks the whole ladder in that one frame, BEFORE the ability is armed and cast
  const tap = new Powers(); tap.pick(2);
  const sim2 = ridgeSim();
  tap.tapOnce = true; step(tap, sim2, 1);
  assert.ok(tap.aim.ray > 100, 'the press did not walk the whole ladder: ' + tap.aim.ray);
  step(tap, sim2, 1);
  const s = tap.winds[0];
  assert.ok(Math.hypot(s.px - sim2.ex.p.x, s.py - sim2.ex.p.y, s.pz - sim2.ex.p.z) > 100, 'the tap cast at arm\'s length');
});

test('an ability whose work cannot travel that far keeps its ring where the work is', () => {
  // a gust is a pulse that leaves the hands and is spent at WINDPOWER.gustReach: the ring must not be drawn on a
  // ridge the air will never reach, which would be a worse lie than the thirty-metre aim was
  const g = new Powers(); g.pick(0);
  step(g, ridgeSim(), 8);
  assert.ok(g.aim.ray > 100, 'the march still reaches: ' + g.aim.ray);
  assert.ok(g.aim.dist <= WINDPOWER.gustReach * 2.5 + 1e-6, 'the gust\'s aim went past its own reach: ' + g.aim.dist.toFixed(1));
  assert.ok(g.aim.dist > POWERS.aimFar, 'and it is still further than the old rule: ' + g.aim.dist.toFixed(1));
  // the ones that act AT the aim are not capped
  const r = new Powers(); while (r.element !== 2) r.nextElement(); r.pick(1);     // the rip
  step(r, ridgeSim(), 8);
  assert.ok(r.aim.dist > 100, 'the rip must reach as far as the eye: ' + r.aim.dist.toFixed(1));
});

// ---- THE FOLD'S AIR AT THE FOLD'S OWN SPEED (2026-11-22) ---------------------------------------------------
// It used to cast ONE gust at the far end pointing back at the feet, and a gust's front runs out at
// WINDPOWER.gustFront (26 m/s) while the fold carries the explorer at about 180: so the air the owner asked for
// was a hundred metres behind them in the first frame and the eye went through still air the whole way.
test('the fold carries ONE source of air with the player, pointed back along the travel', () => {
  const p = new Powers(); while (p.element !== 2) p.nextElement(); p.pick(0);
  const sim = ridgeSim();
  p.tapOnce = true; step(p, sim, 2);
  assert.ok(p.fold, 'no fold began');
  const jets = () => p.winds.filter((s) => s.kind === KIND.jet);
  assert.equal(jets().length, 1, 'the fold cast more than one gust');
  let worst = 0;
  for (let i = 0; i < 40 && p.fold; i++) {
    step(p, sim, 1);
    const js = jets();
    assert.equal(js.length, 1, 'a gust was cast per frame: the six slots would fill in a tenth of a second');
    const a = js[0], e = sim.ex.p;
    worst = Math.max(worst, Math.hypot(a.px - e.x, a.py - e.y, a.pz - e.z));
    // it lies BACK along the travel: the fold goes +z, so the air goes -z
    assert.ok(a.dz < -0.9, 'the carried air stopped pointing back along the travel: dz ' + a.dz.toFixed(2));
  }
  assert.ok(worst < 2.0, 'the air was left behind: it got ' + worst.toFixed(1) + ' m from the eye (the hands are ' + POWERS.hands + ' m up)');
  assert.equal(p.fold, null, 'the fold never ended');
});

test('the fold lands you running, and not on the face of a lake', async () => {
  const { TIMEPOWERS } = await import('../src/core/powers.js');
  // (1) you arrive moving: the velocity used to be zeroed on arrival, so a hundred-metre rush ended planted
  const p = new Powers(); while (p.element !== 2) p.nextElement(); p.pick(0);
  const sim = ridgeSim();
  p.tapOnce = true; step(p, sim, 2 + 90);
  assert.equal(p.fold, null);
  const v = Math.hypot(sim.ex.v.x, sim.ex.v.y, sim.ex.v.z);
  assert.ok(v > 1, 'it set you down planted: ' + v.toFixed(2) + ' m/s');
  assert.ok(v <= TIMEPOWERS.foldLand + 1e-6, 'and it must stay under the body\'s own run: ' + v.toFixed(2) + ' m/s');
  assert.ok(sim.ex.v.z > 0, 'the speed it keeps must be ALONG the travel');
  // (2) a lake 40 m along the way: the fold stops on the bank and says so
  const q = new Powers(); while (q.element !== 2) q.nextElement(); q.pick(0);
  const wet = fakeSim(); wet.ex.v = { x: 0, y: 0, z: 0 };
  wet.sampleSurface = (b, d) => ({ radius: R, liquidRadius: along(d) > 40 ? R + 1.4 : 0 });
  q.tapOnce = true; step(q, wet, 2);
  assert.ok(q.fold, 'the fold was refused outright at a lake 40 m off');
  const far = Math.hypot(q.fold.p1.x - q.fold.p0.x, q.fold.p1.y - q.fold.p0.y, q.fold.p1.z - q.fold.p0.z);
  assert.ok(far > 2 && far < 40, 'it did not stop at the water: ' + far.toFixed(1) + ' m');
  assert.equal(q.note, 'the fold stops at the water');
  step(q, wet, 90);
  assert.ok(along({ x: wet.ex.p.x, y: wet.ex.p.y, z: wet.ex.p.z }) < 40, 'it set you down on the water');
  // (3) and a world whose samples throw must not refuse the fold: a wet landing beats a power that does nothing
  const r = new Powers(); while (r.element !== 2) r.nextElement(); r.pick(0);
  const bad = fakeSim(); let n = 0;
  bad.sampleSurface = (b, d) => { if (++n > 3) throw new Error('no ground'); return { radius: R, liquidRadius: 0 }; };
  r.tapOnce = true; step(r, bad, 2);
  assert.ok(r.fold || r.casts > 0, 'a bad sample refused the fold');
});
