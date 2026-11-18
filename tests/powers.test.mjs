// The elemental powers, the player's side (src/core/powers.js): the hands, the aim, what each ability adds to the
// list of the explorer's wind. (What the wind then does to the world is PHYSICS': src/physics/powers.test.mjs.)
// Run: node --test tests/powers.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Powers, ABILITIES, POWERS } from '../src/core/powers.js';
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
  assert.equal(p.list.length, 1, 'fire has one ability built; the rest are named in docs/POWERS-FIRE.md');
  // the physics is what lights it, because only it knows what is underfoot there
  let asked = null;
  sim.physics = { lightFire: (fires, bodyId, at, size) => { asked = { bodyId, at, size }; return { kind: 1 }; } };
  p.down = true; step(p, sim, 2); p.down = false; step(p, sim, 2);
  assert.ok(asked, 'the physics was asked to light it');
  assert.equal(asked.bodyId, 'earth');
  assert.equal(p.fireCasts, 1, 'one fire lit');
  // and swapping back drops everything the fire was holding
  p.nextElement();
  assert.equal(p.list[p.ability].id, 'gust');
  assert.equal(p.charge, 0, 'and nothing is left charged across the swap');
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
