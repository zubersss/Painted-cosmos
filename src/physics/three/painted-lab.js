// Painted Cosmos physics: the lab inside the real painted pipeline. OWNER: PHYSICS.
// physics-lab.html?painted=1 loads this instead of the debug lab. It builds PAINTER's world and
// painter from their public exports only (createPainter, RENDERER_OPTIONS, makeWashMaterial,
// bindBodyUniforms from src/render/index.js; createWorld from src/world/index.js; the chunks
// that PAINTER's material contract names, from src/render/chunks.js), runs the physics on it
// and adds the draw kits with a material factory written to PAINTER's contract.
// It touches no PAINTER file and reaches into none of its internals.
//
// URL (all optional):  body=earth  biome=<id> | lat= lon=   hour=12 (local solar time)
//   t=<s> start time | find=rain|thunderstorm|snow|dust|fog|<kind> (the time, at this place,
//   when that weather is there; else the nearest place where it is)   speed=1   quality=1
//   walk=<m/s> (an explorer circling the focus; 0 = stands)   circle=<m>
//   ship=hover|land (a hull 9 m away: hovering low, or landing and leaving again)
//   yaw= pitch= dist=  (camera, degrees and metres, round the focus)   up=<m> (look-at height)
//   rain=thin|broad|cover|blend (four ways to draw rain; see RAIN below)   kits=0 (no kits)
//   water=1 (my wave patch over PAINTER's liquid)   expand=gpu (instanced particles)
//   hud=1   freeze=1 (stop the clock once ready: for frame pairs)
//   pre=<s> (simulate this long, unseen, before the page says it is ready)
// window.__lab: { info(), stability(dtMs, pairs), plantCheck(), setRain(mode), physics, kits, world, painter }
import * as THREE from 'three';
import { createPainter, RENDERER_OPTIONS, makeWashMaterial, bindBodyUniforms } from '../../render/index.js';
import { VERT_PARS, VERT_END, FRAG_PARS } from '../../render/chunks.js';
import { createWorld } from '../../world/index.js';
import { BODIES } from '../../data/bodies.js';
import { createPhysics, stepExplorerBody, stepShipGear, wakeShip } from '../index.js';
import { weatherAt, cellsAt } from '../weather.js';
import { createPhysicsKits } from './kits.js';
import { SHAPE_GLSL } from './chunks.glsl.js';

const Q = new URLSearchParams(location.search);
const num = (k, d) => (Q.has(k) && Q.get(k) !== '' && isFinite(+Q.get(k)) ? +Q.get(k) : d);
const bodyId = BODIES[Q.get('body')] ? Q.get('body') : 'earth';
const body = BODIES[bodyId];
const canvas = document.getElementById('c'), hud = document.getElementById('hud');
for (const id of ['key', 'legend']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; }
hud.style.display = Q.get('hud') === '1' ? '' : 'none';

const renderer = new THREE.WebGLRenderer({ canvas, ...RENDERER_OPTIONS });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(num('fov', 50), 1, 0.1, 400000);
scene.add(camera);
const painter = createPainter(renderer);
const world = createWorld(scene);
const quality = num('quality', 1);
painter.setQuality(quality);
if (Q.has('scale')) painter.setRenderScale(num('scale', 1));
const physics = createPhysics({ sampleSurface: (id, d) => world.sampleSurface(id, d), seed: Q.has('seed') ? num('seed', 18) : undefined });
physics.setQuality(Math.min(2, Math.max(0, quality | 0)));
world.setPhysics(physics);
const root = world.bodies.get(bodyId);

// ---- where and when --------------------------------------------------------------------------------
const V3 = (v) => new THREE.Vector3(v.x, v.y, v.z);
let place = null;
if (Q.has('lat')) { const la = num('lat', 0) * Math.PI / 180, lo = num('lon', 0) * Math.PI / 180; place = new THREE.Vector3(Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)); }
if (!place && Q.get('biome') && world.findBiome) { const f = world.findBiome(bodyId, Q.get('biome')); if (f) place = V3(f.unitDir || f.dir || f).normalize(); }
if (!place) { const s = world.getSpawn(bodyId); place = V3(s.unitDir || s).normalize(); }
let time = num('t', 60);
const findQ = Q.get('find');
if (findQ) {
  const want = (w) => (findQ === 'rain' ? w.precipitation.type === 'rain' && w.precipitation.rate > 5
    : findQ === 'snow' ? (w.precipitation.type === 'snow' || w.precipitation.type === 'ice') && w.precipitation.intensity01 > 0.5
    : findQ === 'thunderstorm' ? w.storm01 > 0.5 && w.precipitation.rate > 8
    : findQ === 'dust' ? w.dust01 > 0.8 : findQ === 'fog' ? w.fog01 > 0.8 : w.kind === findQ);
  const env = { moist: 1, sun01: 0.5, wind: 4, dustSource: 1 };
  let found = false;
  for (let t = time; t < time + 12000 && !found; t += 20) if (want(weatherAt(bodyId, place.x, place.y, place.z, 2, t + 15, physics.seed, env, {}))) { time = t; found = true; }
  for (let t = time; t < time + 9000 && !found; t += 41) for (const c of cellsAt(bodyId, t, physics.seed)) if (want(weatherAt(bodyId, c.x, c.y, c.z, 2, t + 15, physics.seed, env, {}))) { time = t; place.set(c.x, c.y, c.z); found = true; break; }
}
if (Q.has('hour')) world.setTime(bodyId, num('hour', 12));
const surfR = (d) => { const s = world.sampleSurface(bodyId, d); return Math.max(s.radius, s.liquidRadius || 0); };
const groundR = (d) => world.sampleSurface(bodyId, d).radius;

// tangent frame at the place (body-local)
const up0 = place.clone(), east0 = new THREE.Vector3(0, 1, 0).cross(up0); if (east0.lengthSq() < 1e-6) east0.set(1, 0, 0); east0.normalize();
const north0 = new THREE.Vector3().crossVectors(up0, east0);
const at = (e, n, h = 0) => { const p = up0.clone().multiplyScalar(body.radius).addScaledVector(east0, e).addScaledVector(north0, n).normalize(); return p.multiplyScalar(surfR(p) + h); };
const focus0 = at(0, 0);

// ---- the explorer: the real body model, walking a circle; drawn as a plain painted capsule -----------
const speedK = num('speed', 1), walk = num('walk', 0), circle = num('circle', 5);
const ex = { p: { x: 0, y: 0, z: 0 }, v: { x: 0, y: 0, z: 0 }, grounded: true };
{ const p = at(circle, 0); ex.p.x = p.x; ex.p.y = p.y; ex.p.z = p.z; }
const envEx = physics.bindEnv(bodyId, { sample: (d) => world.sampleSurface(bodyId, d), gravity: body.gravity });
const actorMat = makeWashMaterial({ color: 0x8a4a3a, wet: 0.1, id: 5.0 });
const exMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.2, 4, 10), actorMat); exMesh.visible = Q.get('explorer') !== '0';
root.add(exMesh);
const _t = new THREE.Vector3(), _u = new THREE.Vector3();
function driveExplorer(dt) {
  _u.set(ex.p.x, ex.p.y, ex.p.z); const r = _u.length(); _u.divideScalar(r);
  // tangent of the circle round the focus, with a pull back onto it
  _t.copy(_u).multiplyScalar(r).sub(focus0); const e = _t.dot(east0), n = _t.dot(north0), rad = Math.hypot(e, n) || 1;
  const pull = (circle - rad) * 0.6;
  _t.copy(east0).multiplyScalar(-n / rad + e / rad * pull).addScaledVector(north0, e / rad + n / rad * pull).normalize().multiplyScalar(walk);
  stepExplorerBody(ex, { wish: walk > 0 ? { x: _t.x, y: _t.y, z: _t.z } : { x: 0, y: 0, z: 0 }, jump: false, jet: 0, descentLimit: 9 }, dt, envEx);
  exMesh.position.set(ex.p.x + _u.x * 0.88, ex.p.y + _u.y * 0.88, ex.p.z + _u.z * 0.88);
  exMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _u);
}

// ---- the ship: the real gear model for standing, a scripted hover otherwise; a painted slab on legs ----
const shipMode = Q.get('ship');
const sh = { p: { x: 0, y: 0, z: 0 }, v: { x: 0, y: 0, z: 0 }, q: { x: 0, y: 0, z: 0, w: 1 } };
let shipObj = null, shT = 0, shLift = 1, shPhase = 'down';
const shipAlt = num('shipAlt', 3.5);
if (shipMode) {
  const p = at(-num('shipAway', 9), 2, shipMode === 'land' ? 1.2 : shipAlt); sh.p.x = p.x; sh.p.y = p.y; sh.p.z = p.z;
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().normalize()); sh.q = { x: q.x, y: q.y, z: q.z, w: q.w };
  shipObj = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.1, 7.4), makeWashMaterial({ color: 0xc9a23a, wet: 0.1, id: 3.0 })); hull.position.y = 1.5; shipObj.add(hull);
  for (const L of physics.ship.tuning.legs) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.2, 1.0, 8), makeWashMaterial({ color: 0x5a5148, id: 3.0 })); leg.position.set(L[0], 0.5, L[2]); shipObj.add(leg); }
  root.add(shipObj);
}
const envSh = physics.bindEnv(bodyId, { sample: (d) => world.sampleSurface(bodyId, d), gravity: body.gravity });
function driveShip(dt) {
  if (!shipMode) return;
  shT += dt;
  _u.set(sh.p.x, sh.p.y, sh.p.z).normalize();
  if (shipMode === 'land') {
    // set down on the gear, stand 5 s, lift off again and slide 9 m aside (so the pad marks show)
    if (shPhase === 'down') { shLift = Math.max(0, shLift - dt / 1.5); if (sh.phys && sh.phys.asleep && shT > 6) { shPhase = 'up'; wakeShip(sh); } }
    else if (shPhase === 'up') { shLift = Math.min(1, shLift + dt / 1.2); if (sh.phys.contacts === 0 && shLift >= 1) shPhase = 'away'; }
    if (shPhase !== 'away') stepShipGear(sh, { lift01: shLift, hold: shPhase === 'up' ? { x: _u.x * 2 * shLift, y: _u.y * 2 * shLift, z: _u.z * 2 * shLift } : { x: -_u.x * 0.6, y: -_u.y * 0.6, z: -_u.z * 0.6 } }, dt, envSh);
    else {
      const alt = Math.hypot(sh.p.x, sh.p.y, sh.p.z) - surfR(_u), k = Math.min(1, dt * 1.5);
      const vx = _u.x * (shipAlt - alt) + north0.x * 1.6, vy = _u.y * (shipAlt - alt) + north0.y * 1.6, vz = _u.z * (shipAlt - alt) + north0.z * 1.6;
      const far = _t.set(sh.p.x, sh.p.y, sh.p.z).sub(focus0).dot(north0) > 11 ? 0 : 1;
      sh.v.x += (vx * far - sh.v.x) * k; sh.v.y += (vy - sh.v.y) * k; sh.v.z += (vz * far - sh.v.z) * k;
      sh.p.x += sh.v.x * dt; sh.p.y += sh.v.y * dt; sh.p.z += sh.v.z * dt;
      if (sh.phys) { sh.phys.contacts = 0; sh.phys.legContact.fill(0); sh.phys.lift01 = 1; sh.phys.downwash.thrust = physics.ship.tuning.mass * body.gravity * 0.3; sh.phys.downwash.radius = 2.2; }
    }
  } else if (sh.phys == null || true) {
    // hover: hold the height over ground or liquid, drift slowly along north
    const alt = Math.hypot(sh.p.x, sh.p.y, sh.p.z) - surfR(_u);
    const drift = num('shipDrift', 0);
    sh.v.x = _u.x * (shipAlt - alt) * 2 + north0.x * drift; sh.v.y = _u.y * (shipAlt - alt) * 2 + north0.y * drift; sh.v.z = _u.z * (shipAlt - alt) * 2 + north0.z * drift;
    sh.p.x += sh.v.x * dt; sh.p.y += sh.v.y * dt; sh.p.z += sh.v.z * dt;
    sh.phys = sh.phys || { contacts: 0, asleep: false, lift01: 1, legContact: new Uint8Array(3), downwash: { thrust: 0, speed: 0, q: 0, radius: 2.2 } };
    sh.phys.downwash.thrust = physics.ship.tuning.mass * body.gravity * 0.3;
  }
  shipObj.position.set(sh.p.x, sh.p.y, sh.p.z); shipObj.quaternion.set(sh.q.x, sh.q.y, sh.q.z, sh.q.w);
}

// ---- the kit materials: PAINTER's contract ------------------------------------------------------------
// One opaque pass into two targets, holes by discard, pcWrite(col, wet, nV, viewZ, region).
// The uniform set that FRAG_PARS needs comes from a makeWashMaterial (a public export); the
// light and haze of the body are bound with bindBodyUniforms, as for any object on a planet.
const INK = { rain: 0xb9c6d6, hail: 0xe9edf0, spray: 0xdfe8ee, snow: 0xf7f8f6, dust: 0xb08b62, sand: 0xc8a469, ash: 0x77736c, spores: 0xb7c66a, leaves: 0xb5542f, ring: 0xcfd9e2, mark: 0x7a6250, water: 0x4f77a8 };
// how the fragment of each shape cuts its hole and picks its wash; c: colour, w: wetness
const FRAG = {
  // a stroke: full at the head, tapering to nothing at the tail
  streak: 'float tpr = abs(vPcUv.x - 0.5) * 2.0; if (tpr > 1.0 - 0.8 * vPcUv.y) discard; vec3 c = uColor * vPcData.x; float w = 0.55;',
  dab: 'if (length(vPcUv - 0.5) > 0.5) discard; vec3 c = uColor * vPcData.x; float w = 0.35;',
  // a puff of dust: not a disc but a ragged dry-brush patch cut from PAINTER's own noise, thinning
  // toward its edge; the pattern is fixed in the puff (it travels with it; nothing is re-rolled)
  puff: 'float rr = length(vPcUv - 0.5) * 2.0; if (rr > 1.0) discard; float nz = texture(uNoise3D, vec3(vPcUv * 1.3, vPcData.x * 5.0)).r; if (nz < 0.46 + 0.5 * rr * rr) discard; vec3 c = uColor * (0.9 + 0.1 * vPcData.x); float w = 0.75;',
  ring: 'if (pcPhysRingCover(vPcUv, vPcData.z) * (0.4 + 0.6 * vPcData.y) < 0.22) discard; vec3 c = uColor; float w = 0.8;',
  // a print: darker ground inside, a paler rim on loose ground. Shallow prints are faint, deep
  // ones full; a scour dish is only its pale ring. Fading thins the mark through PAINTER's noise
  // (fixed in the mark, so it never boils).
  mark: 'float scour = step(3.5, vPcData.z); float cover = pcPhysMarkCover(vPcUv, vPcData.z) * (1.0 - scour), rim = pcPhysMarkRim(vPcUv, vPcData.z) * step(1e-4, vPcData.y); float a = max(cover * clamp(vPcData.x * 12.0, 0.15, 0.9), rim * mix(0.6, 0.22, scour)) * min(1.0, vPcData.w * 3.0); a = min(a, 0.62); if (a < texture(uNoise3D, vec3(vPcUv * 1.7, vPcData.z * 0.37 + vPcData.x)).g) discard; vec3 c = mix(uColor, vec3(0.9, 0.86, 0.78), rim * (1.0 - cover)); float w = 0.2;',
  // the sea: three flat tones by how the wave faces the sun and the sky (hard-edged washes, no gradient)
  surface: 'vec3 nB = normalize(vPcData.xyz); float tilt = 1.0 - nB.y * 0.0 - dot(nB, normalize(uSunDirL)); float lv = pcLevel(clamp(1.3 - tilt * 0.9 + (texture(uNoise3D, vec3(vPcUv * 6.0, 0.3)).r - 0.5) * 0.25, 0.0, 1.0), 0.06) / 3.0; vec3 c = mix(uColor * 0.55, mix(uColor, vec3(0.86, 0.9, 0.95), 0.55), lv); float w = 0.12;',
};
// Four ways to draw rain (the choice is PAINTER's; `rain=` picks one):
//   thin   every drop a thin tapering stroke, opaque (the contract as it stands)
//   broad  one drop in six as a broad slanted stroke, long exposure, wet (bleeds in the post pass)
//   cover  thin strokes, each pixel kept or dropped by a stipple fixed in the stroke
//   blend  the thin strokes drawn in a pass of their own after the painting, alpha-blended
const RAIN = { thin: { width: 0.012, exposure: 0.04 }, broad: { width: 0.07, exposure: 0.14, minPx: 3 }, cover: { width: 0.02, exposure: 0.05, minPx: 1.6 }, blend: { width: 0.014, exposure: 0.05, minPx: 1.4 } };
let rainMode = RAIN[Q.get('rain')] ? Q.get('rain') : 'broad';
// What the painted frames taught: PAINTER's post pass erases anything under about three of its
// internal pixels (a 1.2 px streak or a 1.6 px flake is simply gone). So in this pipeline every
// kind gets a least size of 3 px or more, and sizes that read as brush marks at 10 m.
const DRAW_PAINTED = { snow: { size: 0.06, minPx: 3.5 }, hail: { width: 0.05, minPx: 3 }, sand: { width: 0.035, minPx: 2.6, exposure: 0.05 }, spray: { width: 0.04, minPx: 3 },
  dust: { size: 0.5, grow: 0.35, minPx: 8 }, ash: { size: 0.09, minPx: 4 }, spores: { size: 0.05, minPx: 3 }, leaves: { size: 0.1, minPx: 4 } };
const kitMaterials = [];
function makeKitMaterial(kind, info) {
  const base = makeWashMaterial({ color: INK[kind], unlit: true });
  let body = FRAG[kind === 'dust' || kind === 'ash' ? 'puff' : info.shape];
  if (kind === 'rain' && rainMode === 'broad') body = 'float tpr = abs(vPcUv.x - 0.5) * 2.0; if (tpr > 1.0 - 0.6 * vPcUv.y * vPcUv.y || fract(vPcData.x * 97.0) > 0.17) discard; vec3 c = uColor * 0.93; float w = 0.95;';
  if (kind === 'rain' && rainMode === 'cover') body = 'float tpr = abs(vPcUv.x - 0.5) * 2.0; if (tpr > 1.0 - 0.8 * vPcUv.y) discard; vec2 cell = floor(vec2(vPcUv.x * 3.0, vPcUv.y * 14.0)); if (fract(sin(dot(cell + vPcData.x * 31.0, vec2(12.9898, 78.233))) * 43758.5453) > 0.6 - 0.45 * vPcUv.y) discard; vec3 c = uColor * vPcData.x; float w = 0.55;';
  const m = new THREE.ShaderMaterial({
    name: 'pc-kit-' + kind,
    uniforms: { ...base.uniforms, ...info.uniforms },
    vertexShader: `${VERT_PARS}
${info.vertexChunk}
varying vec3 vView;
void main() {
  vec4 mv = modelViewMatrix * vec4(pcKitPosition(), 1.0);
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
  ${VERT_END}
}`,
    fragmentShader: `${FRAG_PARS}
${SHAPE_GLSL}
uniform vec3 uColor;
varying vec2 vPcUv; varying vec4 vPcData; varying vec3 vView;
void main() {
  #include <logdepthbuf_fragment>
  ${body}
  c = pcAtmos(pcTone(c, 2.0), pcFogAmount(length(vView)));
  pcWrite(c, w, vec3(0.0, 0.0, 1.0), -vView.z, ${info.region.toFixed(1)});
}`,
    side: THREE.DoubleSide,
    polygonOffset: info.shape === 'mark' || info.shape === 'ring', polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  m.userData.pcPainted = true;
  kitMaterials.push(m);
  return m;
}
// the blended variant of rain: its own pass after the painting (no depth, plain alpha)
function makeBlendRain(info) {
  return new THREE.ShaderMaterial({ uniforms: { ...info.uniforms, uCol: { value: new THREE.Color(INK.rain) } }, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `${info.vertexChunk}\nvoid main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(pcKitPosition(), 1.0); }`,
    fragmentShader: 'uniform vec3 uCol; varying vec2 vPcUv; varying vec4 vPcData; void main() { float a = (1.0 - abs(vPcUv.x - 0.5) * 2.0) * (1.0 - vPcUv.y) * 0.75; gl_FragColor = vec4(uCol * vPcData.x, a); }' });
}
let kits = null, blendScene = null, rainMesh = null;
const blendRoot = new THREE.Group();
function buildKits() {
  if (kits) kits.dispose();
  kitMaterials.length = 0; blendScene = null; rainMesh = null;
  if (Q.get('kits') === '0') { kits = null; return; }
  kits = createPhysicsKits(physics, {
    makeMaterial: (kind, info) => (kind === 'rain' && rainMode === 'blend' ? makeBlendRain(info) : makeKitMaterial(kind, info)),
    weather: { draw: { ...DRAW_PAINTED, rain: RAIN[rainMode] }, expand: Q.get('expand') === 'gpu' ? 'gpu' : 'cpu' },
    water: Q.get('water') === '1' ? { N: num('waterN', 64), step: num('waterStep', 1.25) } : false,      // PAINTER draws the liquid; the patch only on request
  });
  rainMesh = kits.weather.objects.find((o) => o.name === 'pc-physics-rain');
  if (rainMode === 'blend') { blendScene = new THREE.Scene(); blendScene.add(blendRoot); }
}
buildKits();

// ---- camera and the loop ------------------------------------------------------------------------------
const yaw = num('yaw', 30) * Math.PI / 180, pitch = num('pitch', 12) * Math.PI / 180, dist = num('dist', 9), lookUp = num('up', 1.0);
const camLocal = new THREE.Vector3(), target = new THREE.Vector3();
function placeCamera() {
  const f = Q.get('follow') === '1' ? _t.set(ex.p.x, ex.p.y, ex.p.z) : _t.copy(focus0);
  target.copy(f).addScaledVector(up0, lookUp);
  camLocal.copy(target).addScaledVector(east0, Math.sin(yaw) * Math.cos(pitch) * dist).addScaledVector(north0, -Math.cos(yaw) * Math.cos(pitch) * dist).addScaledVector(up0, Math.sin(pitch) * dist);
  // keep the eye above the ground
  const d = camLocal.clone().normalize(), g = surfR(d) + 0.4; if (camLocal.length() < g) camLocal.setLength(g);
  // floating origin: the camera sits at the scene origin, the body root is moved (C3)
  let i = 0;
  for (const [id, r] of world.bodies) { if (id === bodyId) r.position.copy(camLocal).multiplyScalar(-1); else r.position.set(60e3 * (i + 2), -40e3, -200e3 - i * 90e3); r.quaternion.identity(); i++; }
  world.sun.position.set(110e3, 132e3, 132e3).add(root.position);
  camera.position.set(0, 0, 0); camera.up.copy(up0); camera.lookAt(target.clone().sub(camLocal));
}
function resize() {
  const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
  if (canvas.width !== w || canvas.height !== h) { renderer.setSize(w, h, false); painter.resize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
}
const dist2 = [];
let last = performance.now(), frames = 0, settled = false, frozen = false, bound = false;
const cost = { phys: 0, kits: 0, world: 0 };
world.setBuildBudget(60);
physics.warmUp({ bodyId, time, focus: ex.p });
function step(dt) {
  time += dt;
  driveExplorer(dt); driveShip(dt);
  dist2.length = 0; physics.explorer.disturbers(ex, dist2);
  if (shipMode) physics.ship.disturbers(sh, dist2);
  const bu = world.bodyUniforms(bodyId);
  physics.update(dt, { bodyId, time, focus: ex.p, sunDir: bu ? bu.uSunDirL.value : null, disturbers: dist2 });
}
function draw(dt) {
  placeCamera();
  let t0 = performance.now();
  world.update(dt, camera.position, bodyId);
  cost.world += (performance.now() - t0 - cost.world) * 0.1;
  if (!settled) {
    let guard = 0, idle = world.busy === 0 ? 1 : 0; const t1 = performance.now();
    while (idle < 2 && guard++ < 2000 && performance.now() - t1 < 4000) { world.update(0, camera.position, bodyId); idle = world.busy === 0 ? idle + 1 : 0; }
    if (idle >= 2) { settled = true; world.setBuildBudget(5); }
  }
  if (kits) {
    kits.update(root, camera, painter.info.internalHeight || canvas.height);
    if (!bound) { const bu = world.bodyUniforms(bodyId); if (bu) { for (const m of kitMaterials) bindBodyUniforms(m, bu); bindBodyUniforms(actorMat, bu); if (shipObj) shipObj.traverse((o) => o.material && bindBodyUniforms(o.material, bu)); bound = true; } }
    cost.kits += (kits.stats.ms - cost.kits) * 0.1;
    _vis();
    if (kits.water && num('waterLift', 0) > 0) { const m = kits.water.objects[0]; m.position.addScaledVector(up0, num('waterLift', 0)); }
    if (blendScene && rainMesh) { blendRoot.position.copy(root.position); blendRoot.quaternion.copy(root.quaternion); blendRoot.add(rainMesh); }
  }
  const L = world.getLighting();
  painter.setMood({ bodyId, timeOfDay: L.hours, altitude01: 0, inSpace01: L.space01, speed01: 0 });
  painter.render(scene, camera, dt);
  if (blendScene && rainMesh && rainMesh.visible) {
    // the blended pass: the rain alone, over the finished painting
    const ac = renderer.autoClear; renderer.autoClear = false; renderer.setRenderTarget(null); renderer.render(blendScene, camera); renderer.autoClear = ac;
  }
}
function tick(now) {
  resize();
  const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)) * speedK; last = now;
  if (!frozen) { const t0 = performance.now(); step(dt); cost.phys += (performance.now() - t0 - cost.phys) * 0.1; }
  draw(frozen ? 0 : dt);
  frames++;
  if (settled && frames >= 4 && world.busy === 0 && !window.__pcReady) {
    // let the scene develop before anyone looks (software GL draws a frame or two a second:
    // without this a capture sees the first second of everything)
    const pre = num('pre', 0); for (let i = 0; i < pre * 30; i++) step(1 / 30);
    draw(0);
    window.__pcReady = true; if (Q.get('freeze') === '1') frozen = true;
  }
  if (hud.style.display !== 'none' && frames % 10 === 0) hud.textContent = JSON.stringify(info(), null, 0).replace(/,"/g, ', "');
  requestAnimationFrame(tick);
}
function info() {
  const w = physics.here.weather, a = physics.here.air, P = physics.particles;
  const counts = {}; for (const k of ['rain', 'snow', 'hail', 'dust', 'sand', 'ash', 'spores', 'leaves', 'spray']) if (P[k].count) counts[k] = P[k].count;
  return { body: bodyId, t: +time.toFixed(1), wx: w.kind, rate: +w.precipitation.rate.toFixed(1), wind: +a.speed.toFixed(1), wet: +w.wetness01.toFixed(2), vis: +w.visibility01.toFixed(2), particles: counts,
    marks: physics.fields.deform.marks.total, sea: physics.fields.water.field.present ? +physics.fields.water.field.height.toFixed(2) : null,
    kits: kits ? { calls: kits.stats.drawCalls, tris: kits.stats.triangles, verts: kits.stats.vertices, ms: +cost.kits.toFixed(3) } : null,
    frame: { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, internal: painter.info.internalWidth + 'x' + painter.info.internalHeight },
    ms: { physics: +cost.phys.toFixed(2), world: +cost.world.toFixed(2) }, rain: rainMode, biome: world.sampleSurface(bodyId, up0).biomeId };
}

// ---- measuring ----------------------------------------------------------------------------------------
// Frame pairs: draw, advance the simulation by dtMs, draw again; how much of the picture changed?
// Returns the mean absolute difference (0..1) and the share of pixels that changed by more than 0.08,
// averaged over `pairs` pairs. Compare with the kits hidden to see what the kits add.
const grab = document.createElement('canvas'); const g2 = grab.getContext('2d', { willReadFrequently: true });
function pixels() { grab.width = canvas.width; grab.height = canvas.height; g2.drawImage(canvas, 0, 0); return g2.getImageData(0, 0, grab.width, grab.height).data; }
function stability(dtMs = 8, pairs = 6, hideKits = false) {
  const was = frozen; frozen = true;
  if (kits) for (const o of kits.objects) o.userData.hide = hideKits;
  let mean = 0, share = 0;
  for (let k = 0; k < pairs; k++) {
    step(0.25 * speedK); draw(0.25); const a = pixels().slice();
    step(dtMs / 1000); draw(dtMs / 1000); const b = pixels();
    let s = 0, c = 0; const n = a.length / 4;
    for (let i = 0; i < a.length; i += 4) { const d = (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 765; s += d; if (d > 0.08) c++; }
    mean += s / n / pairs; share += c / n / pairs;
  }
  frozen = was;
  return { dtMs, pairs, meanDiff: +mean.toFixed(5), changedShare: +share.toFixed(5) };
}
window.__lab = { info, stability, physics, world, painter, renderer, scene, camera, root, THREE, get kits() { return kits; },
  setRain(mode) { if (RAIN[mode]) { rainMode = mode; bound = false; buildKits(); } return rainMode; },
  hideKits(h) { if (kits) for (const o of kits.objects) o.userData.hide = !!h; } };
// (a hidden kit object stays hidden whatever the kit says)
const _vis = () => { if (kits) for (const o of kits.objects) if (o.userData.hide) o.visible = false; };
scene.onBeforeRender = _vis;
requestAnimationFrame(tick);
