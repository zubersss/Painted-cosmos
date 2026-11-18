// The elemental powers, the player's side (src/core/powers.js): the hands, the aim, what each ability adds to the
// list of the explorer's wind. (What the wind then does to the world is PHYSICS': src/physics/powers.test.mjs.)
// Run: node --test tests/powers.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Powers, ABILITIES, POWERS } from '../src/core/powers.js';
import { KIND, WINDPOWER } from '../src/physics/powers.js';
import { S } from '../src/core/state.js';

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
