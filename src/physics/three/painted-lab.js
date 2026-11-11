// Painted Cosmos physics: the lab inside the real painted pipeline. OWNER: PHYSICS.
// physics-lab.html?painted=1 loads this instead of the debug lab. It builds PAINTER's world and
// painter from their public exports only (createPainter, RENDERER_OPTIONS, makeWashMaterial,
// makePaintUniforms, bindBodyUniforms and the three scene chunks VERT_PARS, VERT_END, FRAG_PARS,
// all from src/render/index.js; createWorld from src/world/index.js; the palette data of
// src/data/looks.js), runs the physics on it and adds the draw kits with a material factory
// written to PAINTER's contract.
// It touches no PAINTER file and reaches into none of its internals.
//
// URL (all optional):  body=earth  biome=<id> | lat= lon=   hour=12 (local solar time)
//   t=<s> start time | find=rain|thunderstorm|snow|dust|fog|<kind> (the time, at this place,
//   when that weather is there; else the nearest place where it is)   speed=1   quality=1
//   walk=<m/s> (an explorer circling the focus; 0 = stands)   circle=<m>
//   ship=hover|land (a hull 9 m away: hovering low, or landing and leaving again)
//   yaw= pitch= dist=  (camera, degrees and metres, round the focus)   up=<m> (look-at height)
//   rain=thin|broad|cover|blend (P4's four ways to draw rain; see RAIN below; default: the game's own table)   kits=0 (no kits)
//   water=1 (my wave patch over PAINTER's liquid)   expand=gpu (instanced particles)
//   hud=1   freeze=1 (stop the clock once ready: for frame pairs)
//   pre=<s> (simulate this long, unseen, before the page says it is ready)
//   eye=0 (the physics is not told where the camera is)
//   push=0 (the explorer and the ship disturb nothing: with freeze=1 and the same pre, the frame
//   differs from the pushed one only by what the push field does)
// window.__lab: { info(), stability(dtMs, pairs, hideKits, orbitDegPerSec), plantCheck(), setRain(mode), physics, kits, world, painter }
import * as THREE from 'three';
import { createPainter, RENDERER_OPTIONS, makeWashMaterial, makePaintUniforms, bindBodyUniforms, VERT_PARS, VERT_END, FRAG_PARS } from '../../render/index.js';
import { createWorld } from '../../world/index.js';
import { BODIES } from '../../data/bodies.js';
import { LOOKS, pig, dilute } from '../../data/looks.js';
import { createPhysics, stepExplorerBody, stepShipGear, wakeShip, MATERIAL_IDS } from '../index.js';
import { weatherAt, cellsAt } from '../weather.js';
import { createPhysicsKits } from './kits.js';
import { SHAPE_GLSL } from './chunks.glsl.js';
import { DRAW_PAINTED } from './expand.js';

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
// Ink by material: every loose particle and every mark says what ground it came from
// (vPcMat, an index into MATERIAL_IDS), and its ink is that ground's. Here: the biome's own
// ground washes from PAINTER's look table, snow and ice left near paper, wet ground deeper.
// (The lab's stand-in: the palette is PAINTER's to make.)
const _hex = (h) => new THREE.Vector3(((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255);
function inkPalette(biomeId) {
  const b = LOOKS[bodyId] && LOOKS[bodyId].biomes.find((x) => x.id === biomeId);
  const g = b ? b.ground.map((n) => dilute(pig(n), 0.3)) : [[0.74, 0.66, 0.52], [0.66, 0.56, 0.44], [0.56, 0.5, 0.46]];
  const mx = (a, c, t) => [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, a[2] + (c[2] - a[2]) * t];
  const base = mx(g[0], g[1], 0.5), stone = mx(g[2], [0.78, 0.78, 0.8], 0.3);
  const of = (m) => (m === 'snow' || m === 'ice' ? [0.965, 0.97, 0.98] : m === 'mud' || m === 'bed' ? mx(base, [0.3, 0.26, 0.24], 0.35)
    : m === 'rock' || m === 'glass' || m === 'crystal' || m === 'gravel' ? stone : m === 'ash' ? mx(base, [0.45, 0.44, 0.44], 0.6) : base);
  const pal = []; for (let i = 0; i < 16; i++) { const c = of(MATERIAL_IDS[i] || 'soil'); pal.push(new THREE.Vector3(c[0], c[1], c[2])); }
  return pal;
}
const INK = { rain: 0xb9c6d6, hail: 0xe9edf0, spray: 0xdfe8ee, snow: 0xf7f8f6, dust: 0xb08b62, sand: 0xc8a469, ash: 0x77736c, spores: 0xb7c66a, leaves: 0xb5542f, ring: 0xcfd9e2, mark: 0x7a6250, water: 0x4f77a8 };
// how the fragment of each shape cuts its hole and picks its wash; c: colour, w: wetness
const FRAG = {
  // a stroke: full at the head, tapering to nothing at the tail
  streak: 'float tpr = abs(vPcUv.x - 0.5) * 2.0; if (tpr > 1.0 - 0.8 * vPcUv.y) discard; vec3 c = ink * vPcData.x; float w = 0.55;',
  dab: 'if (length(vPcUv - 0.5) > 0.5) discard; vec3 c = ink * vPcData.x; float w = 0.35;',
  // a flake: a speck of bare paper with a ragged edge (it is drawn out along its motion by the kit)
  flake: 'float rr = length(vPcUv - 0.5) * 2.0; if (rr > 0.78 + 0.22 * texture(uNoise3D, vec3(vPcUv * 2.3, vPcData.x * 7.0)).r) discard; vec3 c = ink; float w = 0.05;',
  // a puff of dust: not a disc but a ragged dry-brush patch cut from PAINTER's own noise, thinning
  // toward its edge; the pattern is fixed in the puff (it travels with it; nothing is re-rolled)
  puff: 'float rr = length(vPcUv - 0.5) * 2.0; if (rr > 1.0) discard; float nz = 0.62 * texture(uNoise3D, vec3(vPcUv * 1.3, vPcData.x * 5.0)).r + 0.38 * texture(uNoise3D, vec3(vPcUv * vec2(3.0, 7.0), vPcData.x * 9.0)).g; if (nz < 0.47 + 0.5 * rr * rr) discard; vec3 c = mix(vec3(1.0), ink, 0.8) * (0.9 + 0.1 * vPcData.x); float w = 0.75;',
  // a leaf (P10): a lens with pointed ends on the thin quad the kit lays (3:1 at its broadest, a line edge-on)
  leaf: 'vec2 lp = (vPcUv - 0.5) * 2.0; if (abs(lp.y) > 1.0 - lp.x * lp.x) discard; vec3 c = ink * (0.72 + 0.28 * vPcData.x); float w = 0.3;',
  // spume and surf (P10): a pale wet stroke like the rain's
  spume: 'float tpr = abs(vPcUv.x - 0.5) * 2.0; if (tpr > 1.0 - 0.6 * vPcUv.y * vPcUv.y) discard; vec3 c = ink * 0.97; float w = 0.95;',
  ring: 'if (pcPhysRingCover(vPcUv, vPcData.z) * (0.4 + 0.6 * vPcData.y) < 0.22) discard; vec3 c = ink; float w = 0.8;',
  // a print: darker ground inside, a paler rim on loose ground. Shallow prints are faint, deep
  // ones full; a scour dish is only its pale ring. Fading thins the mark through PAINTER's noise
  // (fixed in the mark, so it never boils).
  mark: 'float scour = step(3.5, vPcData.z); float cover = pcPhysMarkCover(vPcUv, vPcData.z) * (1.0 - scour), rim = pcPhysMarkRim(vPcUv, vPcData.z) * step(1e-4, vPcData.y); float a = max(cover * clamp(vPcData.x * 12.0, 0.15, 0.9), rim * mix(0.6, 0.22, scour)) * min(1.0, vPcData.w * 3.0); a = min(a, 0.62); if (a < texture(uNoise3D, vec3(vPcUv * 1.7, vPcData.z * 0.37 + vPcData.x)).g) discard; vec3 c = mix(ink * 0.66, mix(ink, vec3(1.0), 0.45), rim * (1.0 - cover)); float w = 0.2;',
  // the sea: three flat tones by how the wave faces the sun and the sky (hard-edged washes, no gradient)
  surface: 'vec3 nB = normalize(vPcData.xyz); float tilt = 1.0 - nB.y * 0.0 - dot(nB, normalize(uSunDirL)); float lv = pcLevel(clamp(1.3 - tilt * 0.9 + (texture(uNoise3D, vec3(vPcUv * 6.0, 0.3)).r - 0.5) * 0.25, 0.0, 1.0), 0.06) / 3.0; vec3 c = mix(ink * 0.55, mix(ink, vec3(0.86, 0.9, 0.95), 0.55), lv); float w = 0.12;',
};
// Four ways to draw rain (the choice is PAINTER's; `rain=` picks one):
//   thin   every drop a thin tapering stroke, opaque (the contract as it stands)
//   broad  one drop in six as a broad slanted stroke, long exposure, wet (bleeds in the post pass)
//   cover  thin strokes, each pixel kept or dropped by a stipple fixed in the stroke
//   blend  the thin strokes drawn in a pass of their own after the painting, alpha-blended
const RAIN = { thin: { width: 0.012, exposure: 0.04, minPx: 1.2 }, broad: { width: 0.07, exposure: 0.14, minPx: 3 }, cover: { width: 0.02, exposure: 0.05, minPx: 1.6 }, blend: { width: 0.014, exposure: 0.05, minPx: 1.4 } };
// (P8) the default is the GAME's table (DRAW_PAINTED.rain: parallel, at most 1.2 m, none nearer than 2.4 m, a share of
// the strokes): until P8 this page drew P4's 'broad' strokes by default, and its storm frames showed planks the game never draws
let rainMode = RAIN[Q.get('rain')] ? Q.get('rain') : 'game';
// The draw table for this pipeline is DRAW_PAINTED (expand.js: what the painted frames taught);
// the URL may override single numbers of it.
const DRAW_LAB = {}; for (const k in DRAW_PAINTED) DRAW_LAB[k] = { ...DRAW_PAINTED[k] };
for (const k of ['snowSize', 'snowMin', 'snowMax', 'snowCell', 'dustMax', 'dustSize']) if (Q.has(k)) { const kind = k.slice(0, 4), f = { Size: 'size', Min: 'minPx', Cell: 'cell', Max: k === 'dustMax' ? 'sizeMax' : 'maxPx' }[k.slice(4)]; DRAW_LAB[kind][f] = num(k, DRAW_LAB[kind][f]); }
const kitMaterials = [];
let palette = null;
const figure = { value: 0 };
// What blows as a GLAZE (P10; `glaze=0` puts dust and sand back in the painting as cut marks): the dust veils
// and the skim of blowing sand or snow are laid over the finished painting in a pass of their own, alpha-blended,
// because nothing cut with `discard` can be soft and every cut mark gets the post pass's dark outline (that
// outline is why blowing sand read darker than the dune). This is the lab's stand-in for a glaze PAINTER would
// lay inside its own pipeline (before the paper and the edge pass, tested against the scene's depth): here it
// has no depth and no paper grain. What it shows is the physics' half: where the veils are, how low, how many,
// how they thin upward (vPcData.y) and how soft their edges are (vPcData.z).
const glazeOn = Q.get('glaze') !== '0';
// (leaves too: a leaf seen edge-on is a line a pixel or two wide, and the post pass erases any mark under about
// three of its pixels: in the painting a flock of 135 leaves left three specks)
const GLAZED = { dust: true, sand: true, leaves: true };
const SNOW_INDEX = MATERIAL_IDS.indexOf('snow');
function makeGlaze(kind, info) {
  palette = palette || inkPalette(world.sampleSurface(bodyId, up0).biomeId);
  const veil = kind === 'dust', leaf = kind === 'leaves';
  const m = new THREE.ShaderMaterial({
    name: 'pc-glaze-' + kind, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { ...info.uniforms, uCol: { value: new THREE.Color(INK[kind]) }, uPcInk: { value: palette } },
    vertexShader: `${info.vertexChunk}\nvoid main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(pcKitPosition(), 1.0); }`,
    fragmentShader: `uniform vec3 uCol; uniform vec3 uPcInk[16]; varying vec2 vPcUv; varying vec4 vPcData; varying float vPcMat;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
void main() {
  bool snow = abs(vPcMat - ${SNOW_INDEX}.0) < 0.5;
  vec3 ink = vPcMat < 200.0 ? uPcInk[int(vPcMat + 0.5)].rgb : uCol;
  // what blows is paler than the ground it left (lit grains against the ground's own shadow); blowing snow
  // is bare paper (PAINTER's blizzard ground is a blue shadow wash since its block 4: figure and ground)
  vec3 c = snow ? vec3(0.975, 0.98, 0.99) : mix(ink, vec3(0.97, 0.95, 0.91), 0.5);
  float a;
  ${leaf ? `vec2 lp = (vPcUv - 0.5) * 2.0;
  // a lens with pointed ends on the thin quad the kit lays; its own shade of the leaf colour
  a = 1.0 - smoothstep(0.7, 1.0, abs(lp.y) / max(1e-3, 1.0 - lp.x * lp.x));
  c = uCol * (0.7 + 0.3 * vPcData.x);` : veil ? `vec2 p = (vPcUv - 0.5) * 2.0;
  float soft = clamp(vPcData.z, 0.08, 1.0);
  // a streamer, not a blob: long and level, its ends feathered over vPcData.z of its half-length, densest just
  // above its foot and thinning to nothing at its top; wisps along its length (fixed in the veil, which
  // travels with the wind)
  float ends = 1.0 - smoothstep(1.0 - max(soft, 0.8), 1.0, abs(p.x));
  // (a wisp: its top comes down toward its ends)
  float up = (p.y + 1.0) * 0.5 / (0.3 + 0.7 * (1.0 - p.x * p.x));
  float prof = smoothstep(0.0, 0.12 + 0.2 * soft, up) * exp(-2.6 * up) * (1.0 - smoothstep(0.75, 1.0, up));
  a = ends * prof * 1.6;
  // (a puff, where the kit says the mark is one: round, soft all the way in)
  a = mix((1.0 - smoothstep(1.0 - soft, 1.0, length(p))) * 0.7, a, vPcData.w);
  a *= 0.3 + 0.7 * vn(vec2(vPcUv.x * 2.4 + vPcData.x * 37.0, vPcUv.y * 6.5 + vPcData.x * 11.0));
  a *= vPcData.y;` : `float tpr = abs(vPcUv.x - 0.5) * 2.0;
  a = (1.0 - smoothstep(0.1, 1.0, tpr)) * (1.0 - vPcUv.y * vPcUv.y) * 0.8;`}
  gl_FragColor = vec4(c, a);
}` });
  return m;
}
function makeKitMaterial(kind, info) {
  let body = FRAG[kind === 'dust' || kind === 'ash' ? 'puff' : kind === 'snow' ? 'flake' : kind === 'leaves' ? 'leaf' : kind === 'spray' ? 'spume' : info.shape];
  // (P10) a flake over fresh snow was white on white until PAINTER's block 4 made the blizzard's ground a blue
  // shadow wash; `figure=<0..1>` still draws flakes in a shadow tone by that much where fresh snow lies (default 0)
  if (kind === 'snow') body = body.replace('vec3 c = ink;', 'vec3 c = mix(ink, vec3(0.66, 0.72, 0.84), uPcFigure);');
  if (kind === 'rain' && (rainMode === 'broad' || rainMode === 'game')) body = 'float tpr = abs(vPcUv.x - 0.5) * 2.0; if (tpr > 1.0 - 0.6 * vPcUv.y * vPcUv.y) discard; vec3 c = ink * 0.93; float w = 0.95;';
  if (kind === 'rain' && rainMode === 'cover') body = 'float tpr = abs(vPcUv.x - 0.5) * 2.0; if (tpr > 1.0 - 0.8 * vPcUv.y) discard; vec2 cell = floor(vec2(vPcUv.x * 3.0, vPcUv.y * 14.0)); if (fract(sin(dot(cell + vPcData.x * 31.0, vec2(12.9898, 78.233))) * 43758.5453) > 0.6 - 0.45 * vPcUv.y) discard; vec3 c = ink * vPcData.x; float w = 0.55;';
  palette = palette || inkPalette(world.sampleSurface(bodyId, up0).biomeId);
  const m = new THREE.ShaderMaterial({
    name: 'pc-kit-' + kind,
    // everything FRAG_PARS declares (lit and hazed like the body once its uniforms are bound), plus the kit's own
    uniforms: makePaintUniforms(world.bodyUniforms(bodyId) || undefined, { uColor: { value: _hex(INK[kind]) }, uPcInk: { value: palette }, uPcFigure: figure, ...info.uniforms }),
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
uniform vec3 uPcInk[16];
uniform float uPcFigure;
varying vec2 vPcUv; varying vec4 vPcData; varying vec3 vView; varying float vPcMat;
void main() {
  #include <logdepthbuf_fragment>
  // the ink: that of the ground the thing came from, where it came from the ground
  vec3 ink = vPcMat < 200.0 ? uPcInk[int(vPcMat + 0.5)] : uColor;
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
let kits = null, blendScene = null, rainMesh = null, glazed = [];
const blendRoot = new THREE.Group();
function buildKits() {
  if (kits) kits.dispose();
  kitMaterials.length = 0; blendScene = null; rainMesh = null;
  if (Q.get('kits') === '0') { kits = null; return; }
  kits = createPhysicsKits(physics, {
    makeMaterial: (kind, info) => (kind === 'rain' && rainMode === 'blend' ? makeBlendRain(info) : glazeOn && GLAZED[kind] ? makeGlaze(kind, info) : makeKitMaterial(kind, info)),
    weather: { draw: { ...DRAW_LAB, rain: RAIN[rainMode] || DRAW_LAB.rain }, expand: Q.get('expand') === 'gpu' ? 'gpu' : 'cpu' },
    water: Q.get('water') === '1' ? { N: num('waterN', 64), step: num('waterStep', 1.25) } : false,      // PAINTER draws the liquid; the patch only on request
  });
  rainMesh = kits.weather.objects.find((o) => o.name === 'pc-physics-rain');
  // what is laid over the finished painting: the blended rain (rain=blend), the glazed kinds
  glazed = kits.weather.objects.filter((o) => (o.name === 'pc-physics-rain' && rainMode === 'blend') || (glazeOn && GLAZED[o.name.slice(11)]));
  if (glazed.length) { blendScene = new THREE.Scene(); blendScene.add(blendRoot); }
}
buildKits();

// ---- camera and the loop ------------------------------------------------------------------------------
let yaw = num('yaw', 30) * Math.PI / 180;
const pitch = num('pitch', 12) * Math.PI / 180, dist = num('dist', 9), lookUp = num('up', 1.0);
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
const dist2 = [], pushOn = Q.get('push') !== '0';
let last = performance.now(), frames = 0, settled = false, frozen = false, bound = false;
const cost = { phys: 0, kits: 0, world: 0 };
world.setBuildBudget(60);
physics.warmUp({ bodyId, time, focus: ex.p });
function step(dt) {
  time += dt;
  driveExplorer(dt); driveShip(dt);
  // push=0: the bodies are there but press on nothing (for A/B frames: what the push field does to the picture)
  dist2.length = 0; if (pushOn) physics.explorer.disturbers(ex, dist2);
  if (shipMode && pushOn) physics.ship.disturbers(sh, dist2);
  const bu = world.bodyUniforms(bodyId);
  // (the eye: what falls as single flakes is simulated round it; eye=0 leaves it out, as a caller that does not know it would)
  physics.update(dt, { bodyId, time, focus: ex.p, sunDir: bu ? bu.uSunDirL.value : null, disturbers: dist2, eye: Q.get('eye') === '0' || camLocal.lengthSq() === 0 ? undefined : camLocal });
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
    if (blendScene) { blendRoot.position.copy(root.position); blendRoot.quaternion.copy(root.quaternion); for (const o of glazed) blendRoot.add(o); }
    figure.value = Math.min(1, (physics.here.sky.fresh || 0) * 1.5) * num('figure', 0);
  }
  const L = world.getLighting();
  painter.setMood({ bodyId, timeOfDay: L.hours, altitude01: 0, inSpace01: L.space01, speed01: 0 });
  painter.render(scene, camera, dt);
  if (blendScene && glazed.some((o) => o.visible)) {
    // the blended pass: over the finished painting, inside the paper's margin
    const ac = renderer.autoClear; renderer.autoClear = false; renderer.setRenderTarget(null);
    const w = canvas.width, h = canvas.height, mx = Math.round(w * 0.026), my = Math.round(h * 0.046);
    renderer.setScissor(mx, my, w - 2 * mx, h - 2 * my); renderer.setScissorTest(true);
    renderer.render(blendScene, camera);
    renderer.setScissorTest(false); renderer.autoClear = ac;
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
const r3 = (o) => { const q = {}; for (const k in o) if (o[k]) q[k] = +(+o[k]).toFixed(3); return q; };
function info() {
  const w = physics.here.weather, a = physics.here.air, P = physics.particles;
  const counts = {}; for (const k of ['rain', 'snow', 'hail', 'dust', 'sand', 'ash', 'spores', 'leaves', 'spray']) if (P[k].count) counts[k] = P[k].count;
  return { body: bodyId, t: +time.toFixed(1), wx: w.kind, rate: +w.precipitation.rate.toFixed(1), wind: +a.speed.toFixed(1), wet: +w.wetness01.toFixed(2), vis: +w.visibility01.toFixed(2), particles: counts,
    marks: physics.fields.deform.marks.total, sea: physics.fields.water.field.present ? +physics.fields.water.field.height.toFixed(2) : null,
    kits: kits ? { calls: kits.stats.drawCalls, tris: kits.stats.triangles, verts: kits.stats.vertices, ms: +cost.kits.toFixed(3), cover: r3(kits.weather.stats.cover), size: r3(kits.weather.stats.size) } : null,
    sky: r3(physics.here.sky), hides: { falling: +(w.precipitation.extinction * 24).toFixed(3), dust: +(w.dustExtinction * 24).toFixed(3) },
    frame: { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, internal: painter.info.internalWidth + 'x' + painter.info.internalHeight },
    ms: { physics: +cost.phys.toFixed(2), world: +cost.world.toFixed(2) }, rain: rainMode, biome: world.sampleSurface(bodyId, up0).biomeId };
}

// ---- measuring ----------------------------------------------------------------------------------------
// Frame pairs: draw, advance the simulation by dtMs, draw again; how much of the picture changed?
// Returns the mean absolute difference (0..1) and the share of pixels that changed by more than 0.08,
// averaged over `pairs` pairs. Compare with the kits hidden to see what the kits add.
const grab = document.createElement('canvas'); const g2 = grab.getContext('2d', { willReadFrequently: true });
function pixels() { grab.width = canvas.width; grab.height = canvas.height; g2.drawImage(canvas, 0, 0); return g2.getImageData(0, 0, grab.width, grab.height).data; }
// orbit (degrees a second): the camera goes round the focus at that rate between the two frames of a pair
// (a slow camera move: every mark shifts by a part of a pixel; what crawls shows as change beyond the scene's own).
function stability(dtMs = 8, pairs = 6, hideKits = false, orbit = 0) {
  const was = frozen; frozen = true;
  if (kits) for (const o of kits.objects) o.userData.hide = hideKits;
  let mean = 0, share = 0;
  for (let k = 0; k < pairs; k++) {
    step(0.25 * speedK); draw(0.25); const a = pixels().slice();
    yaw += orbit * Math.PI / 180 * dtMs / 1000;
    step(dtMs / 1000); draw(dtMs / 1000); const b = pixels();
    let s = 0, c = 0; const n = a.length / 4;
    for (let i = 0; i < a.length; i += 4) { const d = (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 765; s += d; if (d > 0.08) c++; }
    mean += s / n / pairs; share += c / n / pairs;
  }
  frozen = was;
  return { dtMs, pairs, orbit, hideKits, meanDiff: +mean.toFixed(5), changedShare: +share.toFixed(5) };
}
window.__lab = { info, stability, physics, world, painter, renderer, scene, camera, root, THREE, get kits() { return kits; },
  setRain(mode) { if (RAIN[mode]) { rainMode = mode; bound = false; buildKits(); } return rainMode; },
  hideKits(h) { if (kits) for (const o of kits.objects) o.userData.hide = !!h; } };
// (a hidden kit object stays hidden whatever the kit says)
const _vis = () => { if (kits) for (const o of kits.objects) if (o.userData.hide) o.visible = false; };
scene.onBeforeRender = _vis;
requestAnimationFrame(tick);
