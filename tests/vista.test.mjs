// A view is a picture, not a spot (PAINTER's critique of PILOT, M4 item 4): found by walking up
// to it, it is offered ("E: stand at the easel"); the explorer is taken to the place the picture
// was painted from and the view to its heading and pitch, held, and given back. On foot one quiet
// mark shows the nearest view not yet drawn within 150 m.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Sim, FEEL, VISTA_RANGE, VISTA_MARK, EASEL } from '../src/core/sim.js';
import { S } from '../src/core/state.js';
import { CAMERA } from '../src/player/camera.js';
import { stubSurface, stubSpawn } from '../src/core/stubs/surface.js';
import { Pad, play, len, sub, norm, dot } from './helpers.mjs';
import { V, add, scale, cross, tangent } from '../src/core/vec.js';

const RAD = Math.PI / 180;
function world() {
  const spawn = norm(stubSpawn('earth').unitDir), R = stubSurface('earth', spawn).radius;
  const east = tangent(cross(V(0, 1, 0), spawn), spawn, V(1, 0, 0)), north = cross(spawn, east);
  const at = (e, n) => norm(add(spawn, add(scale(east, e / R), scale(north, n / R))));
  // one view 40 m north of the spawn, painted looking east and a little up; one 120 m east with no heading; one far away
  const vistas = [
    { id: 'v1', name: 'The first view', unitDir: at(0, 40), yaw: 90 * RAD, pitch: 0.1 },
    { id: 'v2', name: 'Second site', unitDir: at(120, 40) },
    { id: 'v3', name: 'Far side', unitDir: { x: -spawn.x, y: -spawn.y, z: -spawn.z }, yaw: 0, pitch: 0 },
  ];
  const sim = new Sim({ sampleSurface: stubSurface, getSpawn: (id) => stubSpawn(id).unitDir, getVistas: (id) => (id === 'earth' ? vistas : []) });
  return { sim, vistas, east, north, R, spawn };
}
const dist = (sim, d) => Math.acos(Math.min(1, dot(norm(sim.ex.p), norm(d)))) * len(sim.ex.p);
// walk toward a body-local direction with the mouse and W
function walkTo(sim, pad, d, until) {
  pad.press('KeyW');
  play(sim, pad, 60, { each: () => {
    const up = norm(sim.ex.p), to = tangent(sub(norm(d), up), up, sim.footCam.viewFwd), f = sim.footCam.viewFwd;
    const a = Math.atan2(dot(cross(f, to), scale(up, -1)), dot(f, to));
    pad.dx += Math.max(-60, Math.min(60, a / FEEL.mouseFoot * 0.3));
  }, until });
  pad.release('KeyW');
}

test('M4 a view not yet drawn within 150 m is marked; walking up to it finds it and offers its easel', () => {
  const { sim, vistas } = world();
  const pad = new Pad();
  play(sim, pad, 0.3);
  const m = sim.vistaMark();
  assert.ok(m && m.id === 'v1', 'the nearest view is marked');
  assert.ok(Math.abs(m.distance - 40) < 1.5 && m.distance < VISTA_MARK, 'at ' + m.distance.toFixed(1) + ' m');
  assert.equal(sim.promptNow, null, 'nothing is offered 40 m away');
  walkTo(sim, pad, vistas[0].unitDir, () => !!sim.easelOffer);
  assert.ok(sim.vistas.earth.v1, 'found');
  assert.match(sim.notice.text, /A view for the sketchbook: The first view/);
  play(sim, pad, 0.1);
  assert.deepEqual(sim.promptNow, { key: 'E', text: 'Stand at the easel' });
  assert.ok(dist(sim, vistas[0].unitDir) < VISTA_RANGE + 0.5);
  // walking on out of reach takes the offer away; the mark is still there, the view is still found
  const off = norm(add(norm(sim.ex.p), scale(sim.footCam.viewFwd, 60 / len(sim.ex.p))));
  walkTo(sim, pad, off, () => !sim.easelOffer);
  play(sim, pad, 0.1);
  assert.equal(sim.promptNow, null);
  assert.ok(sim.vistaMark() && sim.vistaMark().id === 'v1', 'still marked: found, not drawn');
});

test('M4 E at a found view: the explorer is taken to the easel, the view to the picture\'s heading and pitch, held, and given back', () => {
  const { sim, vistas, east } = world();
  const pad = new Pad();
  play(sim, pad, 0.3);
  walkTo(sim, pad, vistas[0].unitDir, () => !!sim.easelOffer);
  const d0 = dist(sim, vistas[0].unitDir);
  pad.tap('KeyE');
  play(sim, pad, 0.05);
  assert.ok(sim.easel && sim.easel.phase === 'go', 'on the way to the easel');
  assert.equal(sim.sm.state, S.ON_FOOT);
  // the hands are off the controls on the way; the view turns smoothly; the explorer is in sight
  pad.press('KeyD'); pad.press('Space');
  let worstTurn = 0, lastF = sim.footCam.viewFwd, seen = true, tGo = 0;
  play(sim, pad, 8, { each: () => {
    pad.dx += 30;
    worstTurn = Math.max(worstTurn, Math.acos(Math.min(1, dot(lastF, sim.footCam.viewFwd))) * 60); lastF = sim.footCam.viewFwd;
    if (!sim.explorerVisible()) seen = false;
    tGo += 1 / 60;
  }, until: () => sim.easel && sim.easel.phase === 'hold' });
  pad.release('KeyD'); pad.release('Space');
  assert.equal(sim.easel.phase, 'hold');
  assert.ok(tGo >= EASEL.minSeconds - 0.1 && tGo <= EASEL.maxSeconds + 0.1, `the walk of ${d0.toFixed(1)} m took ${tGo.toFixed(2)} s`);
  assert.ok(worstTurn < 2.2, `the view turned at ${worstTurn.toFixed(2)} rad/s at most`);
  assert.ok(seen, 'the explorer was in sight all the way');
  assert.ok(dist(sim, vistas[0].unitDir) < 0.3, 'standing on the easel\'s spot: ' + dist(sim, vistas[0].unitDir).toFixed(2) + ' m');
  assert.ok(dot(sim.footCam.viewFwd, tangent(east, norm(sim.ex.p), east)) > 0.9995, 'looking east, as the picture was painted');
  assert.ok(Math.abs(sim.footCam.pitch - 0.1) < 1e-6, 'at its pitch');
  assert.ok(Math.abs(sim.footCam.boom - CAMERA.boom) < 1e-6 && !sim.footCam.firstPerson, 'third person at the usual boom');
  assert.equal(sim.ex.fuel, 1, 'the jetpack was not used');
  play(sim, pad, 0.05);
  assert.equal(sim.promptNow, null, 'no prompt while the picture is held');
  // held, then the controls are the player's again; the view stays until they move it
  play(sim, pad, EASEL.hold + 0.3);
  assert.equal(sim.easel, null);
  assert.ok(dot(sim.footCam.viewFwd, tangent(east, norm(sim.ex.p), east)) > 0.999);
  const p0 = { ...sim.ex.p };
  pad.press('KeyW'); play(sim, pad, 1); pad.release('KeyW');
  assert.ok(len(sub(sim.ex.p, p0)) > 2, 'walking again');
  // stood at: not offered or marked again; the mark goes to the next view within 150 m
  assert.equal(sim.easelOffer, null);
  const m = sim.vistaMark();
  assert.ok(m && m.id === 'v2', 'the next view is marked: ' + (m && m.id));
});

test('M4 a view the world gives no heading for keeps the way the player looks; a page already drawn is not offered', () => {
  const { sim, vistas } = world();
  const pad = new Pad();
  sim.vistaDrawn = (body, id) => id === 'v1';               // the presenter: v1 has its picture (an older save)
  play(sim, pad, 0.3);
  assert.equal(sim.vistaMark().id, 'v2', 'v1 is drawn: the mark is the other one, ' + sim.vistaMark().distance.toFixed(0) + ' m off');
  walkTo(sim, pad, vistas[1].unitDir, () => !!sim.easelOffer);
  assert.equal(sim.easelOffer.id, 'v2');
  const f0 = sim.footCam.viewFwd, pitch0 = sim.footCam.pitch;
  pad.tap('KeyE');
  let drawn = false;
  sim.vistaDrawn = (body, id) => id === 'v1' || (id === 'v2' && drawn);
  play(sim, pad, 8, { until: () => sim.easel && sim.easel.phase === 'hold' });
  assert.ok(dot(sim.footCam.viewFwd, tangent(f0, norm(sim.ex.p), f0)) > 0.999, 'the heading is the player\'s own');
  assert.ok(Math.abs(sim.footCam.pitch - pitch0) < 1e-9);
  // the picture is held until the presenter has drawn the page (the world may still be building)
  play(sim, pad, EASEL.hold + 1);
  assert.ok(sim.easel && sim.easel.phase === 'hold', 'still held: the page is not drawn yet');
  drawn = true;
  play(sim, pad, 0.1);
  assert.equal(sim.easel, null, 'drawn: given back');
  assert.equal(sim.easelOffer, null, 'and not offered again');
  // a page that could not be drawn while the picture was held (the book was opened over it): after
  // eight seconds the controls come back, and the easel is still on offer
  const w3 = world(), sim3 = w3.sim, pad3 = new Pad();
  sim3.vistaDrawn = () => false;
  play(sim3, pad3, 0.3);
  walkTo(sim3, pad3, w3.vistas[0].unitDir, () => !!sim3.easelOffer);
  pad3.tap('KeyE');
  play(sim3, pad3, 8, { until: () => sim3.easel && sim3.easel.phase === 'hold' });
  play(sim3, pad3, 8.3);
  assert.equal(sim3.easel, null, 'given back after eight seconds');
  play(sim3, pad3, 0.1);
  assert.equal(sim3.easelOffer && sim3.easelOffer.id, 'v1', 'still on offer: the page has no picture');
});
