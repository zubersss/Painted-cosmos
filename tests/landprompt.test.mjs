// "Land here" is offered only where E starts a landing (M4's last re-fix pass). The scripted trip
// came down over Saturn's honey_mist, the screen said "E Land here", and E answered "Too steep to
// land here" (with PHYSICS a site must be ground whose friction holds the parked ship; the assist
// looks up to 45 m round): a new player offered a landing, then refused. Driven on the real
// worlds (PAINTER's surface and obstacles, PHYSICS' ground) at spots round the spawns of Saturn
// and Earth where nothing near holds, and at spots where something does. Skipped if a module
// cannot be imported (a file caught mid-edit).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/core/sim.js';
import { S } from '../src/core/state.js';
import { findLandingSite, SHIP } from '../src/ship/flight.js';
import { BODIES } from '../src/data/bodies.js';
import { Pad, play } from './helpers.mjs';

let surface = null, obstacles = null, P = null, why = '';
try {
  surface = await import('../src/world/surface.js');
  obstacles = await import('../src/world/obstacles.js');
  P = await import('../src/physics/index.js');
} catch (e) { why = String(e && e.message).slice(0, 120); }
const skip = surface && obstacles && P && P.createPhysics ? false : 'world or physics not importable: ' + why;

const nrm = (v) => { const l = Math.hypot(v.x, v.y, v.z); return { x: v.x / l, y: v.y / l, z: v.z / l }; };

// The landing assist's own search, as E makes it (trees within 80 m, PHYSICS' friction rule):
// is there ground near `p` that will hold the parked ship?
function holdsNear(sim, physics, body, p) {
  const G = {};
  const holds = (dir, g) => Math.tan(g.slope) < 0.8 * (physics.ground(body, dir, G).friction || 0.6);
  return !!findLandingSite(p, sim.sampler(body), SHIP, sim.obstaclesNear(body, p, 80), holds, false);
}

// Spots 60 m up in a patch east and north of a world's spawn (metres), split by holdsNear.
function spots(sim, physics, body, biome, e0, e1, n0, n1, step) {
  const R = BODIES[body].radius;
  const sp = surface.getSurface(body).getSpawn();
  const c = nrm(sp.unitDir || sp);
  const east = nrm({ x: c.z, y: 0, z: -c.x });
  const north = { x: c.y * east.z - c.z * east.y, y: c.z * east.x - c.x * east.z, z: c.x * east.y - c.y * east.x };
  const steep = [], fine = [];
  for (let n = n0; n <= n1; n += step) for (let e = e0; e <= e1; e += step) {
    const d = nrm({ x: c.x + (east.x * e + north.x * n) / R, y: c.y + (east.y * e + north.y * n) / R, z: c.z + (east.z * e + north.z * n) / R });
    const g = surface.sampleSurfacePure(body, d.x, d.y, d.z);
    if (biome && g.biomeId !== biome) continue;
    const p = { x: d.x * (g.radius + 60), y: d.y * (g.radius + 60), z: d.z * (g.radius + 60) };
    (holdsNear(sim, physics, body, p) ? fine : steep).push({ body, at: `${body} ${biome || g.biomeId} ${e} E ${n} N`, dir: [d.x, d.y, d.z] });
  }
  return { steep: steep.slice(0, 5), fine: fine.slice(0, 2) };
}

test('"Land here" is offered only where E starts a landing (never offered, then refused as too steep)', { skip }, () => {
  const sampleSurface = (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z);
  const physics = P.createPhysics({ sampleSurface, seed: 1 });
  const sim = new Sim({
    sampleSurface,
    getSpawn: (id) => surface.getSurface(id).getSpawn(),
    sampleObstacles: (id, d, r) => obstacles.sampleObstaclesPure(id, d.x, d.y, d.z, r),
    physics,
  });
  const pad = new Pad();
  // Where the scripted trip and the verifier met it (Saturn's honey_mist, 3.9 to 4.9 km north
  // of the spawn), and Earth's alpine meadow (1.3 to 1.8 km north).
  const sat = spots(sim, physics, 'saturn', 'honey_mist', -2400, 0, 3600, 4500, 150);
  const ear = spots(sim, physics, 'earth', null, -800, 800, 1200, 1800, 200);
  const report = [];
  let steep = 0, held = 0;
  for (const spot of [...sat.steep, ...ear.steep, ...sat.fine, ...ear.fine]) {
    // The ship is set to hover about there (beside where the explorer would stand), 60 m up.
    sim.teleport({ body: spot.body, dir: spot.dir, ship: true, altitude: 60 });
    play(sim, pad, 0.8);
    const shown = !!(sim.promptNow && sim.promptNow.text === 'Land here');
    const holds = holdsNear(sim, physics, spot.body, sim.sh.p);    // from where it hovers now
    sim.notice = null;
    pad.tap('KeyE');
    play(sim, pad, 0.25);
    const state = sim.sm.state, notice = sim.notice ? sim.notice.text : '';
    const landing = state === S.LANDING || state === S.LANDED;
    report.push(`${spot.at}: ${holds ? 'ground near holds' : 'nothing near holds'}; "Land here" ${shown ? 'shown' : 'not shown'}; E: ${state}, "${notice}"`);
    if (shown) assert.ok(landing, `${spot.at}: "Land here" was on the screen and E did not start a landing: ${state}, "${notice}"`);
    if (holds) {
      held++;
      assert.ok(shown, `${spot.at}: ground near holds, so "Land here" is offered`);
    } else if (!shown) {
      // Not offered: E says why, and the ship flies on, under control.
      steep++;
      assert.ok(/steep/i.test(notice), `${spot.at}: E without the prompt said "${notice}"`);
      assert.equal(state, S.ATMOSPHERE, spot.at);
    }
  }
  console.log('  ' + report.join('\n  '));
  assert.ok(steep >= 2, `the patches hold spots where nothing near holds (${steep}): if the worlds changed, move the patches`);
  assert.ok(held >= 3, 'and spots where ground holds: ' + held);
});
