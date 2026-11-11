// Painted Cosmos: Painter's gallery. OWNER: PAINTER.
// A free-fly camera over any body, with pickers and URL parameters for deterministic frames:
//   ?body=earth&biome=temperate_forest&time=12&quality=1&cam=stream|trees|canopy|jet|high|orbit
//   &ui=0 (hide panel) &t=0 (freeze wind/drift at this many seconds) &view=0..5 (debug buffers)
//   &scale=1 (render scale) &fov=55 &look=pooling:1,granulation:1,... (painter.setLook)
//   &dx=&dy=&dz= (nudge the camera, metres: right, up, forward) &yaw=&pitch= (degrees, added)
import * as THREE from 'three';
import { createPainter, RENDERER_OPTIONS } from '../render/index.js';
import { createWorld } from '../world/index.js';
import { createExplorer, createShip } from './models.js';
import { BODIES, BODY_IDS } from '../data/bodies.js';

const P = new URLSearchParams(location.search);
const num = (k, d) => (P.has(k) && P.get(k) !== '' && isFinite(+P.get(k)) ? +P.get(k) : d);

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, ...RENDERER_OPTIONS });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(num('fov', 55), 1, 0.1, 400000);
scene.add(camera);
const painter = createPainter(renderer);
const world = createWorld(scene);

let bodyId = P.get('body') || 'earth';
if (!BODIES[bodyId]) bodyId = 'earth';
let frozenT = P.has('t') ? num('t', 0) : null;
const state = {
  // camera in body-local coordinates
  pos: new THREE.Vector3(), yaw: 0, pitch: 0,
  time: num('time', 12), quality: num('quality', 1),
};

// --- UI -------------------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
for (const id of BODY_IDS) { const o = document.createElement('option'); o.value = id; o.textContent = BODIES[id].name; $('body').appendChild(o); }
function fillBiomes() {
  $('biome').innerHTML = '';
  for (const b of world.getBiomes(bodyId)) { const o = document.createElement('option'); o.value = b.id; o.textContent = b.name; $('biome').appendChild(o); }
}
if (P.get('ui') === '0') $('ui').classList.add('hidden');

// --- placing the bodies (the gallery keeps the active body's centre far below the camera, the
// camera itself at the scene origin, exactly as Pilot's floating origin will) ------------------
const sunDist = 220e3;
function placeBodies() {
  let i = 0;
  for (const [id, root] of world.bodies) {
    if (id === bodyId) root.position.copy(state.pos).multiplyScalar(-1);
    else root.position.set(60e3 * (i + 2), -40e3, -200e3 - i * 90e3);
    root.quaternion.identity();
    i++;
  }
  world.sun.position.set(sunDist * 0.5, sunDist * 0.6, sunDist * 0.6).add(world.bodies.get(bodyId).position);
  camera.position.set(0, 0, 0);
}

const _up = new THREE.Vector3(), _e = new THREE.Vector3(), _n = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3();
function frame(up) {
  _up.copy(up).normalize();
  _e.set(0, 1, 0).cross(_up); if (_e.lengthSq() < 1e-6) _e.set(1, 0, 0); _e.normalize();
  _n.crossVectors(_up, _e);
}
function orient() {
  frame(state.pos);
  const cp = Math.cos(state.pitch), sp = Math.sin(state.pitch);
  _f.copy(_n).multiplyScalar(Math.cos(state.yaw) * cp).addScaledVector(_e, Math.sin(state.yaw) * cp).addScaledVector(_up, sp);
  camera.up.copy(_up);
  camera.lookAt(_f);   // camera sits at the origin
  _r.crossVectors(_f, _up).normalize();
}

function groundRadius(dir) { return world.sampleSurface(bodyId, dir).radius; }
function surf(dir) { const s = world.sampleSurface(bodyId, dir); return Math.max(s.radius, s.liquidRadius || 0); }

// Camera presets, relative to a spot (unit direction) on the body.
function applyPreset(name, dir) {
  const d = new THREE.Vector3(dir.x, dir.y, dir.z).normalize();
  frame(d);
  const R = BODIES[bodyId].radius;
  const at = (east, north, h) => {
    const p = d.clone().multiplyScalar(R).addScaledVector(_e, east).addScaledVector(_n, north).normalize();
    return p.multiplyScalar(surf(p) + h);
  };
  state.pitch = 0; state.yaw = 0;
  if (name === 'orbit') { state.pos.copy(d).multiplyScalar(R * 2.6); state.pitch = -Math.PI / 2 + 0.001; }
  else if (name === 'high') { state.pos.copy(at(0, 0, 420)); state.pitch = -0.5; state.yaw = 0.6; }
  else if (name === 'jet') { state.pos.copy(at(0, -6, 30)); state.pitch = -0.30; state.yaw = num('jyaw', 0.9); }
  else if (name === 'canopy') { state.pos.copy(at(4, 16, 1.6)); state.pitch = 1.05; state.yaw = 0.4; }
  else if (name === 'trees') { state.pos.copy(at(0, 2, 1.7)); state.pitch = 0.06; state.yaw = 0.2; }
  else { state.pos.copy(at(0, 0, 1.7)); state.pitch = -0.04; state.yaw = 0; }   // 'stream' / default
}

function gotoBiome(biomeId, preset) {
  let spot = null;
  const spawn = world.getSpawn(bodyId);
  const here = world.sampleSurface(bodyId, spawn.unitDir);
  if (!biomeId || here.biomeId === biomeId) spot = spawn; else spot = world.findBiome(bodyId, biomeId) || spawn;
  applyPreset(preset || 'stream', spot.unitDir);
  if (preset === 'stream' || !preset) aimAlongStream();
}

// Stand on the bank and look along the water: scan for the direction with the most water.
function aimAlongStream() {
  const R = BODIES[bodyId].radius;
  const base = state.pos.clone().normalize();
  frame(base);
  // step to the water's edge: walk downhill toward the nearest liquid
  let best = null, bestD = 1e9;
  for (let a = 0; a < 64; a++) {
    const ang = (a / 64) * Math.PI * 2;
    for (let r = 2; r < 60; r += 1.5) {
      const p = base.clone().multiplyScalar(R).addScaledVector(_e, Math.sin(ang) * r).addScaledVector(_n, Math.cos(ang) * r).normalize();
      if (world.sampleSurface(bodyId, p).isLiquid) { if (r < bestD) { bestD = r; best = { ang, r }; } break; }
    }
  }
  if (!best) return;
  // stand 1.5 m back from the water
  const r0 = Math.max(0, best.r - 1.5);
  const p0 = base.clone().multiplyScalar(R).addScaledVector(_e, Math.sin(best.ang) * r0).addScaledVector(_n, Math.cos(best.ang) * r0).normalize();
  state.pos.copy(p0).multiplyScalar(surf(p0) + 1.55);
  frame(p0);
  // look where the water runs longest
  let byaw = 0, bscore = -1;
  for (let a = 0; a < 72; a++) {
    const ang = (a / 72) * Math.PI * 2;
    let score = 0;
    for (let r = 3; r < 70; r += 2) {
      const p = p0.clone().multiplyScalar(R).addScaledVector(_e, Math.sin(ang) * r).addScaledVector(_n, Math.cos(ang) * r).normalize();
      if (world.sampleSurface(bodyId, p).isLiquid) score += 1 + r * 0.02;
    }
    if (score > bscore) { bscore = score; byaw = ang; }
  }
  state.yaw = byaw + 0.10; state.pitch = -0.07;
}

function applyTime() { world.setTime(bodyId, state.time); $('time').value = state.time; $('timev').textContent = state.time; }

function setBody(id) {
  bodyId = id; $('body').value = id; fillBiomes();
  gotoBiome(P.get('biome') || world.getBiomes(bodyId)[0].id, P.get('cam') || 'stream');
  const here = world.sampleSurface(bodyId, state.pos.clone().normalize());
  $('biome').value = here.biomeId;
  applyTime();
}

$('body').onchange = (e) => { P.delete('biome'); P.delete('cam'); setBody(e.target.value); };
$('biome').onchange = (e) => { gotoBiome(e.target.value, 'stream'); };
$('time').oninput = (e) => { state.time = +e.target.value; applyTime(); };
$('quality').onchange = (e) => { painter.setQuality(+e.target.value); };
$('view').onchange = (e) => { painter.setDebugView(+e.target.value); };

// --- input ----------------------------------------------------------------------------------
const keys = {};
addEventListener('keydown', (e) => { keys[e.code] = true; if (e.code === 'KeyH') $('ui').classList.toggle('hidden'); });
addEventListener('keyup', (e) => { keys[e.code] = false; });
let drag = false;
canvas.addEventListener('pointerdown', (e) => { drag = true; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointerup', () => { drag = false; });
canvas.addEventListener('pointermove', (e) => { if (!drag) return; state.yaw += e.movementX * 0.004; state.pitch = Math.max(-1.55, Math.min(1.55, state.pitch - e.movementY * 0.004)); });

function fly(dt) {
  orient();
  const alt = state.pos.length() - groundRadius(state.pos.clone().normalize());
  let sp = (keys.ShiftLeft || keys.ShiftRight ? 8 : 1) * Math.max(4, alt * 0.8);
  const mv = new THREE.Vector3();
  if (keys.KeyW) mv.add(_f); if (keys.KeyS) mv.sub(_f);
  if (keys.KeyD) mv.add(_r); if (keys.KeyA) mv.sub(_r);
  if (keys.KeyE) mv.add(_up); if (keys.KeyQ) mv.sub(_up);
  if (mv.lengthSq() > 0) state.pos.addScaledVector(mv.normalize(), sp * dt);
  if (keys.KeyG) { const d = state.pos.clone().normalize(); state.pos.copy(d).multiplyScalar(surf(d) + 1.7); }
  const d = state.pos.clone().normalize(), g = surf(d) + 0.4;
  if (state.pos.length() < g) state.pos.copy(d).multiplyScalar(g);
}

// --- start ----------------------------------------------------------------------------------
function resize() {
  const w = Math.max(2, Math.floor(canvas.clientWidth * Math.min(devicePixelRatio || 1, 2)));
  const h = Math.max(2, Math.floor(canvas.clientHeight * Math.min(devicePixelRatio || 1, 2)));
  painter.resize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
painter.setQuality(state.quality); $('quality').value = state.quality;
if (P.has('scale')) painter.setRenderScale(num('scale', 1));
if (P.has('view')) { painter.setDebugView(num('view', 0)); $('view').value = num('view', 0); }
if (P.has('look')) { const o = {}; for (const kv of P.get('look').split(',')) { const [k, v] = kv.split(':'); o[k] = +v; } painter.setLook(o); }
setBody(bodyId);
// nudges for composing deterministic frames
state.yaw += num('yaw', 0) * Math.PI / 180; state.pitch += num('pitch', 0) * Math.PI / 180;
orient();
state.pos.addScaledVector(_r, num('dx', 0)).addScaledVector(_up, num('dy', 0)).addScaledVector(_f, num('dz', 0));
resize();

// models on show near the camera (placeholder until M3): ?models=1
let explorer = null, ship = null;
if (P.get('models') === '1') {
  explorer = createExplorer(); ship = createShip();
  scene.add(explorer.object3D); scene.add(ship.object3D);
}
function placeModel(m, east, north) {
  const R = BODIES[bodyId].radius;
  frame(state.pos);
  const p = state.pos.clone().normalize().multiplyScalar(R).addScaledVector(_e, east).addScaledVector(_n, north).normalize();
  const up = p.clone();
  p.multiplyScalar(groundRadius(p));
  const root = world.bodies.get(bodyId);
  m.object3D.position.copy(p).add(root.position);
  m.object3D.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
}

// Warm-up: build terrain and flora with a generous budget before the first painted frame, so
// headless captures are complete and deterministic.
let last = performance.now(), frames = 0, settled = false;
world.setBuildBudget(60);
function tick(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  fly(dt);
  orient();
  placeBodies();
  if (explorer) { placeModel(explorer, Math.sin(state.yaw) * 5 + 1.5, Math.cos(state.yaw) * 5); explorer.animate({ mode: 'idle' }, dt); }
  if (ship) { placeModel(ship, Math.sin(state.yaw) * 14 - 6, Math.cos(state.yaw) * 14); ship.animate({ mode: 'landed' }, dt); }
  world.update(dt, camera.position, bodyId);
  if (!settled) {
    let guard = 0;
    while (world.busy > 0 && guard++ < 400) world.update(0, camera.position, bodyId);
    if (world.busy === 0) { settled = true; world.setBuildBudget(5); }
  }
  if (frozenT != null) painter.setTime(frozenT);
  const L = world.getLighting();
  painter.setMood({ bodyId, timeOfDay: L.hours, altitude01: 0, inSpace01: L.space01, speed01: 0 });
  painter.render(scene, camera, frozenT != null ? 0 : dt);
  frames++;
  if (settled && frames >= 3 && world.busy === 0) window.__pcReady = true;
  if (frames % 20 === 0) $('stat').textContent = `${painter.info.internalWidth}x${painter.info.internalHeight} internal, ${renderer.info.render.calls} draws, ${(renderer.info.render.triangles / 1000) | 0}k tris, alt ${L.altitude.toFixed(0)} m`;
  requestAnimationFrame(tick);
}
window.__pcGallery = { state, world, painter, camera, renderer, scene };
requestAnimationFrame(tick);
