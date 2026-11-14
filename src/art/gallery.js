// Painted Cosmos: Painter's gallery. OWNER: PAINTER.
// A free-fly camera over any body, with pickers and URL parameters for deterministic frames:
//   ?body=earth&biome=temperate_forest&time=12&quality=1&cam=stream|trees|canopy|jet|high|orbit
//   &ui=0 (hide panel) &t=0 (freeze wind/drift at this many seconds) &view=0..5 (debug buffers)
//   &scale=1 (render scale) &fov=55 &look=pooling:1,granulation:1,... (painter.setLook)
//   &dx=&dy=&dz= (nudge the camera, metres: right, up, forward) &yaw=&pitch= (degrees, added)
//   weather: &wx=fair|overcast|rain|storm|after|blizzard|snow|dust|fog (forced sky numbers) or
//   &sky=cloud:0.9,overcast:0.8,... (any of PHYSICS' eleven); with &physics=1 the weather is
//   PHYSICS' own: &wtime= (seconds on its clock; the Earth spawn's thunderstorm is 640..800)
//   &pre= (seconds simulated before the first frame, so rain is already falling) &kits=0
//   &fresh=1 (fresh snow already lying, as after some minutes of a blizzard)
import * as THREE from 'three';
import { createPainter, RENDERER_OPTIONS } from '../render/index.js';
import { createWorld } from '../world/index.js';
import { createExplorer, createShip } from './models.js';
import { BODIES, BODY_IDS } from '../data/bodies.js';
import { LOOKS } from '../data/looks.js';
import { findVantage } from './vantage.js';
import { gaitOf, strideBob, EXPLORER_BODY } from '../physics/explorer.js';

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
  if (name === 'orbit') {
    // banded worlds are drawn from over the low latitudes, where the belts run across the disc
    if (LOOKS[bodyId].bands && Math.abs(d.y) > 0.38) { const k = Math.sqrt((1 - 0.38 * 0.38) / Math.max(1e-6, d.x * d.x + d.z * d.z)); d.set(d.x * k, 0.38 * Math.sign(d.y), d.z * k); if (d.lengthSq() < 0.5) d.set(0.925, 0.38, 0); d.normalize(); }
    state.pos.copy(d).multiplyScalar(R * num('odist', 2.6)); state.pitch = -Math.PI / 2 + 0.001;
  }
  else if (name === 'high') { state.pos.copy(at(0, 0, 420)); state.pitch = -0.5; state.yaw = 0.6; }
  else if (name === 'jet') { state.pos.copy(at(0, -6, 30)); state.pitch = -0.30; state.yaw = num('jyaw', 0.9); }
  else if (name === 'vista') { state.pos.copy(at(0, 0, 9)); state.pitch = -0.10; state.yaw = num('jyaw', 0.9); }
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
  if (preset === 'vista') {
    // where a painter would set the easel for this biome (src/art/vantage.js)
    const here2 = world.sampleSurface(bodyId, state.pos.clone().normalize());
    const v = findVantage(bodyId, biomeId || here2.biomeId);
    if (v) {
      const d = new THREE.Vector3(v.unitDir.x, v.unitDir.y, v.unitDir.z);
      state.pos.copy(d).multiplyScalar(surf(d) + v.eye);
      state.yaw = v.yaw; state.pitch = v.pitch;
      window.__pcVantage = v;
      // the hour a painter would choose for this place, unless the address names one
      const bb = LOOKS[bodyId].biomes.find((b) => b.id === (biomeId || here2.biomeId));
      if (bb && bb.hour != null && !P.has('time')) state.time = bb.hour;
    } else aimVista(1.7, false, false);
  }
  if (preset === 'shore') { aimAlongStream(); state.yaw += 1.0; }
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
    for (let r = 2; r < 460; r += (r < 60 ? 1.5 : 4)) {
      if (r > bestD) break;
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

// Where a painter would set the easel: gentle, dry, open ground a little above most of what
// is around, facing the direction with the most relief (and any liquid) in it.
function aimVista(eye, low, sea) {
  const R = BODIES[bodyId].radius;
  const base = state.pos.clone().normalize();
  frame(base);
  const e0 = _e.clone(), n0 = _n.clone();
  const pt = (o, ang, r) => o.clone().multiplyScalar(R).addScaledVector(e0, Math.sin(ang) * r).addScaledVector(n0, Math.cos(ang) * r).normalize();
  const top = (q) => Math.max(q.radius, q.liquidRadius || 0);
  const c = [];
  for (let a = 0; a < 20; a++) for (let r = 0; r <= 360; r += 40) { const p = pt(base, a / 20 * 6.283, r); c.push({ p, s: world.sampleSurface(bodyId, p) }); }
  const hs = c.map((x) => top(x.s)).sort((x, y) => x - y);
  // walls, terraces and peaks are painted from below; open country from a rise
  const want = low ? hs[Math.floor(hs.length * 0.12)] : (hs[Math.floor(hs.length * 0.6)] + hs[Math.floor(hs.length * 0.9)]) / 2;
  let best = null, bc = 1e9;
  for (const x of c) {
    if (x.s.isLiquid || x.s.slope > 0.35) continue;
    // never set the easel inside a thicket or against a trunk
    let cost = Math.abs(x.s.radius - want) * 0.05 + x.s.slope * 8 + (x.s.canopyHeight > 0 ? 12 : 0) + world.sampleObstacles(bodyId, x.p, 10).length * 25;
    // islands and coasts: stand near the edge, where the sea is in the picture
    if (sea) { let n = 0; for (let a = 0; a < 8; a++) if (world.sampleSurface(bodyId, pt(x.p, a / 8 * 6.283, 110)).isLiquid) n++; cost += n ? -n * 1.2 : 20; }
    if (cost < bc) { bc = cost; best = x; }
  }
  if (!best) return;
  state.pos.copy(best.p).multiplyScalar(best.s.radius + eye);
  let by = 0, bs = -1e9;
  for (let a = 0; a < 24; a++) {
    const ang = a / 24 * 6.283;
    let lo = 1e9, hi = -1e9, liq = 0;
    for (const r of [25, 50, 90, 150, 240, 360, 520]) {
      const q = world.sampleSurface(bodyId, pt(best.p, ang, r)), el = (top(q) - (best.s.radius + eye)) / r;
      if (el < lo) lo = el; if (el > hi) hi = el; if (q.isLiquid) liq++;
    }
    const sc = sea ? liq * 0.3 + (hi - lo) * 0.5 - Math.max(0, hi - 0.4) : low ? Math.min(hi, 0.55) + 0.3 * (hi - lo) - Math.max(0, hi - 0.6) : (hi - lo) + Math.min(liq, 3) * 0.06 - Math.max(0, hi - 0.45) * 0.9;   // relief, water, but not nose to a wall
    if (sc > bs) { bs = sc; by = ang; }
  }
  state.yaw = by; state.pitch = 0.03;
}

function applyTime() { world.setTime(bodyId, state.time); $('time').value = state.time; $('timev').textContent = state.time; }

function setBody(id) {
  bodyId = id; $('body').value = id; fillBiomes();
  gotoBiome(P.get('biome') || null, P.get('cam') || 'stream');
  const here = world.sampleSurface(bodyId, state.pos.clone().normalize());
  $('biome').value = here.biomeId;
  applyTime();
}

$('body').onchange = (e) => { P.delete('biome'); P.delete('cam'); setBody(e.target.value); };
$('biome').onchange = (e) => { gotoBiome(e.target.value, 'vista'); };
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

// forced weather (no physics needed): named skies, or the numbers themselves
const WXP = {
  fair: { cloud: 0.15, haze: 0.95 },
  overcast: { cloud: 0.8, overcast: 0.4, haze: 0.8 },
  rain: { cloud: 0.9, overcast: 0.8, haze: 0.5, fog: 0.3, wet: 0.9, rain: 0.6, storm: 0.3 },
  storm: { cloud: 0.92, overcast: 0.94, haze: 0.36, fog: 0.64, wet: 0.96, rain: 0.92, storm: 0.84 },
  after: { cloud: 0.13, haze: 0.47, fog: 0.5, wet: 0.93 },
  blizzard: { cloud: 0.95, overcast: 0.7, haze: 0.2, fog: 0.3, snow: 1, snowfall: 0.9, storm: 0.4 },
  snow: { cloud: 0.3, haze: 0.9, snow: 1 },
  dust: { cloud: 0.2, overcast: 0.2, haze: 0.12, dust: 0.88, storm: 0.3 },
  fog: { cloud: 0.5, overcast: 0.3, haze: 0.15, fog: 0.9 },
};
let forcedSky = null;
if (P.has('wx') && WXP[P.get('wx')]) forcedSky = Object.assign({}, WXP[P.get('wx')]);
if (P.has('sky')) { forcedSky = forcedSky || {}; for (const kv of P.get('sky').split(',')) { const [k, v] = kv.split(':'); forcedSky[k] = +v; } }
if (forcedSky) world.setWeather(forcedSky);
if (P.has('fresh')) world.setFreshSnow(num('fresh', 1));   // snow already fallen (with physics=1)

// PHYSICS in the gallery (?physics=1): wind, gusts and bending plants from src/physics
let wtime = num('wtime', 0), preroll = num('pre', 0);
let physics = null;
const physicsWanted = P.get('physics') === '1';
if (physicsWanted) {
  import('../physics/index.js').then((m) => {
    physics = m.createPhysics({ sampleSurface: (id, d) => world.sampleSurface(id, d) });
    world.setPhysics(physics, { kits: P.get('kits') !== '0' });
  }).catch((e) => {
    // (the tree is shared: a module may be half-saved at the moment of loading. Try again.)
    let n = 0; try { n = +sessionStorage.getItem('pcPhysTry') || 0; sessionStorage.setItem('pcPhysTry', n + 1); } catch (_) { n = 9; }
    if (n < 4) setTimeout(() => location.reload(), 1500); else console.error('physics not available: ' + e.message);
  });
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

// models on show near the camera: ?models=1 (explorer 5 m ahead, ship 14 m ahead to the left)
//   explorer: pose=idle|walk|jet|fall|wade|sit, speed=, phase= (radians of the stride), jet=, lift= (m),
//             mface= (degrees to the right of the view direction; 0 shows its back), epitch=, mdist= (m ahead, 5), mside= (m to the right, 1.5)
//   ship: smode=landed|hover|fly|pulse, gear=, canopy=, throttle=, sface=, hover= (m)
//   cockpit=1: the view from the ship's seat, as PILOT's first person (fov 62, near 0.12 m)
let explorer = null, ship = null;
if (P.get('models') === '1' || P.get('cockpit') === '1') {
  explorer = createExplorer(); ship = createShip();
  scene.add(explorer.object3D); scene.add(ship.object3D);
}
const MP = {
  pose: P.get('pose') || 'idle', speed: P.has('speed') ? num('speed', 0) : null, phase: P.has('phase') ? num('phase', 0) : null,
  jet: num('jet', 1), lift: num('lift', 0), face: num('mface', 0), epitch: num('epitch', 0),
  smode: P.get('smode') || (num('hover', 0) > 0 ? 'hover' : 'landed'), gear: P.has('gear') ? num('gear', 1) : null, canopy: num('canopy', 0),
  throttle: P.has('throttle') ? num('throttle', 0) : null, sface: num('sface', -70), dist: num('mdist', 5), side: num('mside', 1.5),
};
window.__pcModel = MP;     // (a tool may turn the explorer, .face, or move it, .dist ahead and .side to the right, between frames: several views from one load)
const _mx = new THREE.Matrix4(), _fx = new THREE.Vector3(), _zx = new THREE.Vector3(), _xx = new THREE.Vector3();
function placeModel(m, east, north, lift, face) {
  const R = BODIES[bodyId].radius;
  frame(state.pos);
  const p = state.pos.clone().normalize().multiplyScalar(R).addScaledVector(_e, east).addScaledVector(_n, north).normalize();
  const up = p.clone();
  p.multiplyScalar(groundRadius(p) + (lift || 0));
  const root = world.bodies.get(bodyId);
  m.object3D.position.copy(p).add(root.position);
  // heading: the view direction laid on the ground, turned `face` degrees to the right
  _fx.copy(_f).addScaledVector(up, -_f.dot(up)).normalize().applyAxisAngle(up, -(face || 0) * Math.PI / 180);
  _zx.copy(_fx).negate(); _xx.crossVectors(up, _zx).normalize(); _zx.crossVectors(_xx, up);
  m.object3D.quaternion.setFromRotationMatrix(_mx.makeBasis(_xx, up, _zx));
}
// PHYSICS' gait in the gallery (`gait=<m/s>`, `stride=<0..1>` held, else it runs; `grav=` m/s^2, default the
// body's): the feet and the hips by PHYSICS' own stride (gaitOf; the feet and the bob as its stepGait lays them, a
// steady pace on level ground), so that the figure can be checked pose by pose as the game will pass it.
const GAIT = P.has('gait') ? { v: num('gait', 4.2), g: P.has('grav') ? num('grav', 9) : BODIES[bodyId].gravity, s: P.has('stride') ? num('stride', 0) : 0, hold: P.has('stride') } : null;
if (GAIT) window.__pcGait = GAIT;     // (a tool may set .s, .v, .g between frames: a strip from one load)
function gaitPose(dt) {
  const T = EXPLORER_BODY, o = gaitOf(Math.max(0.12, GAIT.v), GAIT.g, T, {});
  if (!GAIT.hold && o.step > 0) GAIT.s = (GAIT.s + GAIT.v * dt / (2 * o.step)) % 1;
  // (the hips' rise and fall in a steady stride: PHYSICS' own, strideBob, the body's st.phys.bob to 1e-9)
  const bob = strideBob(Math.max(0.12, GAIT.v), GAIT.g, GAIT.s, T, o);
  const X = o.duty * o.step, lift = o.gait === 2 ? 0.12 + 0.1 * Math.min(1, GAIT.v / 7) : 0.07, feet = [];
  for (let i = 0; i < 2; i++) {
    let p = GAIT.s - 0.5 * i; if (p < 0) p += 1;
    if (p < o.duty) feet.push({ fwd: X * (1 - 2 * Math.min(1, p / o.duty)), up: 0, side: (i ? 0.5 : -0.5) * T.stepWidth, down: 1 });
    else { const u = (p - o.duty) / (1 - o.duty); feet.push({ fwd: X * (2 * (u - Math.sin(2 * Math.PI * u) / (2 * Math.PI)) - 1), up: lift * Math.sin(Math.PI * Math.sqrt(u)), side: (i ? 0.5 : -0.5) * T.stepWidth, down: 0 }); }
  }
  return { mode: 'walk', speed: GAIT.v, feet, ride: bob, stride: GAIT.s, gait: o.gait, footDown: (feet[0].down ? 1 : 0) | (feet[1].down ? 2 : 0), surge: 0, crouch01: 0 };
}
function placeExplorer(side, dt) {
  placeModel(explorer, Math.sin(state.yaw) * MP.dist + Math.cos(state.yaw) * side, Math.cos(state.yaw) * MP.dist - Math.sin(state.yaw) * side, MP.lift, MP.face);
  if (dt != null && GAIT) explorer.animate({ ...gaitPose(frozenT != null ? 0 : dt), lookPitch: MP.epitch, snap: frozenT != null }, frozenT != null ? 0 : dt);
  else if (dt != null) explorer.animate({ mode: MP.pose, speed: MP.speed == null ? undefined : MP.speed, phase: MP.phase == null ? undefined : MP.phase, jet01: MP.pose === 'jet' ? MP.jet : 0, lookPitch: MP.epitch, snap: frozenT != null }, frozenT != null ? 0 : dt);
}
let cockpit = null;
function placeShip(dt) {
  if (cockpit) { ship.object3D.position.copy(cockpit.p).sub(state.pos); ship.object3D.quaternion.copy(cockpit.q); }
  // chase=1: the ship ahead of the camera, flying where the camera looks (space and pulse frames)
  else if (P.get('chase') === '1') { ship.object3D.position.set(num('cside', 0), -num('cdown', 2.6), -num('cdist', 13)).applyQuaternion(camera.quaternion).add(camera.position); ship.object3D.quaternion.copy(camera.quaternion); }
  else placeModel(ship, Math.sin(state.yaw) * num('sdist', 14) - Math.cos(state.yaw) * 6, Math.cos(state.yaw) * num('sdist', 14) + Math.sin(state.yaw) * 6, num('hover', 0), MP.sface);
  ship.animate({ mode: MP.smode, gear01: MP.gear == null ? undefined : MP.gear, canopy01: MP.canopy, throttle01: MP.throttle == null ? undefined : MP.throttle, snap: frozenT != null }, frozenT != null ? 0 : dt);
  if (P.get('cockpit') === '1') {
    if (!cockpit) {
      // sit down: the camera goes to the seat and looks along the ship's nose
      cockpit = { p: ship.object3D.position.clone().add(state.pos), q: ship.object3D.quaternion.clone() };
      state.pos.copy(ship.object3D.userData.seat).applyQuaternion(cockpit.q).add(cockpit.p);
      camera.fov = 62; camera.near = 0.12; camera.updateProjectionMatrix();
      placeBodies(); ship.object3D.position.copy(cockpit.p).sub(state.pos);
    }
    camera.quaternion.copy(cockpit.q);
  }
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
  if (ship) placeShip(dt);
  if (explorer) placeExplorer(MP.side, dt);
  if (physics) {
    const up = state.pos.clone().normalize();
    // what pushes the grass about: the explorer on show, and the ship's downwash (?wash=<newtons>)
    // (&walk=<m/s>: during the pre-roll the explorer walks in from the left to where it stands)
    const disturbers = [], root = world.bodies.get(bodyId), walk = num('walk', 0);
    const setDisturbers = (back) => {
      disturbers.length = 0;
      if (explorer) {
        placeExplorer(MP.side - walk * back, null);
        const p = root.worldToLocal(explorer.object3D.position.clone());
        frame(state.pos);
        disturbers.push({ kind: 'explorer', p, v: { x: _r.x * walk, y: _r.y * walk, z: _r.z * walk }, radius: 0.45, strength: 1, grounded: true });
      }
      if (ship && P.has('wash')) { const p = root.worldToLocal(ship.object3D.position.clone()); disturbers.push({ kind: 'downwash', p, v: { x: 0, y: 0, z: 0 }, radius: 5, strength: num('wash', 60000) }); }
    };
    setDisturbers(0);
    if (P.get('push') === '0') disturbers.length = 0;
    const L0 = world.getLighting();
    const fr = { bodyId, time: wtime, focus: up.multiplyScalar(groundRadius(up)), eye: state.pos, sunDir: world.bodyUniforms(bodyId).uSunDirL.value, disturbers };
    // pre-roll: let the weather fall for a while before the first frame, ending at wtime
    for (; preroll > 0; preroll -= 1 / 30) { fr.time = wtime - preroll; setDisturbers(preroll); if (P.get('push') === '0') disturbers.length = 0; physics.update(1 / 30, fr); }
    setDisturbers(0);
    if (P.get('push') === '0') disturbers.length = 0;
    fr.time = wtime;
    physics.update(frozenT != null ? 0 : dt, fr);
    if (frozenT == null) wtime += dt;
  }
  world.update(dt, camera.position, bodyId);
  if (!settled) {
    // keep building until two updates in a row find nothing left to do (each finished level
    // of the quadtree asks for the next one on the following update)
    let guard = 0, idle = world.busy === 0 ? 1 : 0;
    const t0 = performance.now();
    while (idle < 2 && guard++ < 2000 && performance.now() - t0 < 4000) { world.update(0, camera.position, bodyId); idle = world.busy === 0 ? idle + 1 : 0; }
    if (idle >= 2) { settled = true; world.setBuildBudget(5); }
  }
  if (P.get('near') === '0' && world._near) world._near.mesh.visible = false;     // (the picture without the near ground strokes)
  if (frozenT != null) painter.setTime(frozenT);
  const L = world.getLighting();
  painter.setMood({ bodyId, timeOfDay: L.hours, altitude01: 0, inSpace01: L.space01, speed01: num('speed01', 0), sky: forcedSky || (physics && physics.here ? physics.here.sky : null) });
  painter.render(scene, camera, frozenT != null ? 0 : dt);
  frames++;
  if (settled && frames >= 3 && world.busy === 0 && (!physicsWanted || (physics && (world.kits || P.get('kits') === '0')))) window.__pcReady = true;
  if (frames % 20 === 0) $('stat').textContent = `${painter.info.internalWidth}x${painter.info.internalHeight} internal, ${renderer.info.render.calls} draws, ${(renderer.info.render.triangles / 1000) | 0}k tris, alt ${L.altitude.toFixed(0)} m`;
  requestAnimationFrame(tick);
}
window.__pcGallery = { state, world, painter, camera, renderer, scene, get physics() { return physics; } };
requestAnimationFrame(tick);
