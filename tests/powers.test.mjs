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

test('a press casts a gust from the hands along the view; holding does not repeat it', () => {
  const p = new Powers(), sim = fakeSim();
  step(p, sim, 3); assert.equal(p.winds.count, 0, 'nothing until asked');
  p.down = true; step(p, sim, 4);
  assert.equal(p.winds.count, 1); assert.equal(p.casts, 1);
  const s = p.winds[0];
  assert.equal(s.kind, KIND.jet);
  assert.ok(Math.abs(s.dz - 1) < 1e-6 && Math.abs(s.dx) < 1e-6, 'along the view, level');
  assert.ok(Math.abs(s.pz - POWERS.ahead) < 1e-6 && Math.abs(s.py - (R + POWERS.hands)) < 1e-6, 'from the hands, a step ahead');
  assert.ok(sim.ex.casting < 1 && sim.ex.casting >= 0, 'the explorer shows the cast for a moment');
  p.down = false; step(p, sim, 2); p.down = true; step(p, sim, 2);
  assert.equal(p.casts, 1, 'a second press too soon after the first is the same stroke');
  p.down = false; step(p, sim, 30); p.down = true; step(p, sim, 2);
  assert.equal(p.casts, 2, 'a new press, a new gust');
  step(p, sim, 60 * 4); assert.equal(p.winds.count, 0, 'and the air is left as it was');
});

test('the aim lies farther out the more level the view; wind control and the whirl are set down there', () => {
  const far = new Powers(), near = new Powers();
  far.pick(2); near.pick(4);
  const sf = fakeSim({ pitch: -0.12 }), sn = fakeSim({ pitch: -0.9 });
  far.down = true; near.down = true; step(far, sf, 2); step(near, sn, 2);
  const a = far.winds[0], b = near.winds[0];
  assert.equal(a.kind, KIND.zone); assert.ok(a.gain > 1, 'quicken');
  assert.equal(b.kind, KIND.vortex);
  assert.ok(a.pz > 24 && a.pz <= POWERS.aimFar, 'a level view: far out, ' + a.pz.toFixed(1) + ' m');
  assert.ok(Math.abs(b.pz - POWERS.aimNear) < 0.5, 'looking down: near, ' + b.pz.toFixed(1) + ' m');
  const still = new Powers(); still.pick(3); still.down = true; step(still, fakeSim(), 2);
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
  assert.deepEqual(ABILITIES.map((a) => a.id), ['gust', 'gather', 'quicken', 'still', 'whirl']);
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
