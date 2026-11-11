// Painted Cosmos: the worlds. OWNER: PAINTER.
// Contract (docs/BRIEF.md section 4 + docs/COORDINATOR.md C1-C6, C11):
//   createWorld(scene) -> { bodies, sun, update(dt, cameraPos, activeBodyId),
//     sampleSurface(bodyId, unitDir), getVistas(bodyId), setTime(bodyId, hours),
//     getSpawn(bodyId), setVistaFound(bodyId, vistaId, found) }
// Additive: busy (pending build jobs), setBuildBudget(ms), getLighting(), getBiomes(bodyId),
//   findBiome(bodyId, biomeId), bodyUniforms(bodyId).
import * as THREE from 'three';
import { BODIES, BODY_IDS, SUN } from '../data/bodies.js';
import { getLook } from '../data/looks.js';
import { NearGround } from './nearground.js';
import { getSurface, sampleSurfacePure, getVistasPure, getStandPure } from './surface.js';
import { PlanetTerrain } from './terrain.js';
import { sampleObstaclesPure } from './obstacles.js';
import { makeSky, makeSkyUniforms, makeSkyGlaze } from './sky.js';
import { Flora } from './flora.js';
import { makeRing, makeCloudShell } from './orbit.js';
import { G, GLAZES, MOTION, makeBodyUniforms, SHEET, WX, PHYSW, QUALITY, FRAME_HOOKS, skyNow, syncPhysFlora, syncPhysWater } from '../render/shared.js';
import { makeKitMaterial, biomeInks, KIT_INK, KIT_PALETTE } from '../render/kitmat.js';
import { defaultBodyUniforms, makeWashMaterial } from '../render/materials.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion();
const _up = new THREE.Vector3(), _east = new THREE.Vector3(), _north = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0), _hup = new THREE.Vector3();

// the wash that, laid with k more pigment (the density model), comes out as c
function undens(c, k) { return k < 1e-4 ? c : (-(1 - k) + Math.sqrt((1 - k) * (1 - k) + 4 * k * Math.min(1, Math.max(0, c)))) / (2 * k); }
function lerp3(out, a, b, t) { out.set(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t); }

export function createWorld(scene) {
  const bodies = new Map();
  const state = new Map();
  const skyU = makeSkyUniforms();
  const sky = makeSky(skyU);
  scene.add(sky);
  // stars and pulse streaks: laid over the brushed sky as a glaze
  const skyGlaze = makeSkyGlaze(skyU);
  scene.add(skyGlaze);
  GLAZES.push(skyGlaze);
  let glazeWhy = '';

  const sun = new THREE.Object3D();
  sun.name = 'pc-sun';
  sun.position.set(0, 0, 0);
  scene.add(sun);

  for (const id of BODY_IDS) {
    const root = new THREE.Group();
    root.name = 'body-' + id;
    scene.add(root);
    bodies.set(id, root);
    const bu = makeBodyUniforms();
    bu.uBodyR.value = BODIES[id].radius;
    const look = getLook(id);
    if (id !== 'earth') { const hu = look.hue || [[1.0, 0.94, 0.86], [0.92, 0.93, 1.0]]; bu.uHueA.value.fromArray(hu[0]); bu.uHueB.value.fromArray(hu[1]); }
    const st = {
      id, root, bu, look, body: BODIES[id], clouds: null, cloudR: 0,
      terrain: new PlanetTerrain(id, root, bu, skyU),
      flora: null,
      forcedTime: null,
      camLocal: new THREE.Vector3(0, BODIES[id].radius * 4, 0),
      found: new Set(), ring: null, dab: null, farTier: 2,
    };
    if (look.flora) st.flora = new Flora(id, root, bu);
    if (look.rings) { st.ring = makeRing(bu, BODIES[id].radius, look.rings); root.add(st.ring); }
    if (look.cloud > 0.05 && BODIES[id].atmosphereHeight > 0) {
      // seen from outside, the deck hugs the planet
      st.cloudR = BODIES[id].radius + ((look.deck && look.deck.height) || Math.min(BODIES[id].atmosphereHeight * 0.22, BODIES[id].radius * 0.045) + 60);
      // a great storm stands over the first site of the biome that names it
      let stormDir = null;
      if (look.deck && look.deck.storm) { const S = getSurface(id), bi = S.biomes.findIndex((b) => b.id === look.deck.storm.over), s0 = S.sites.find((x) => x.b === bi); if (s0) stormDir = s0; }
      st.clouds = makeCloudShell(bu, st.cloudR, look, stormDir);
      root.add(st.clouds);
    }
    state.set(id, st);
  }

  // A far world as a dab: one ball in the wash it shows from afar (its cloud deck, or the mean
  // of its grounds), lit by its own sun.
  function makeDab(st) {
    const d = st.look.deck, c = [0, 0, 0];
    if (d && d.a && d.b) { for (let k = 0; k < 3; k++) c[k] = d.a[k] * 0.55 + d.b[k] * 0.45; }
    else { const S = getSurface(st.id); for (const p of S.pal) for (let k = 0; k < 3; k++) c[k] += p.mid[k] / S.pal.length; }
    const m = makeWashMaterial({ bodyUniforms: st.bu, wet: 0.55, dry: 0, scale: st.body.radius * 0.9, id: 1 });
    m.uniforms.uColor.value.set(c[0], c[1], c[2]);
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(st.body.radius, 3), m);
    mesh.name = 'dab-' + st.id; mesh.visible = false;
    st.root.add(mesh);
    return mesh;
  }

  let budgetMs = 5;
  const prof = { terrain: 0 };
  let physics = null;
  let lastActive = null;
  const lighting = { bodyId: null, sunElevation: 1, hours: 12, dayness: 1, altitude: 0, space01: 0 };
  const _storm = new THREE.Vector3(), _dust = new THREE.Vector3(), _pale = new THREE.Vector3(), _white = new THREE.Vector3(1, 1, 1);
  const dustOf = new Map();   // body -> { biomeId: the pigment its dust carries (the mid ground wash) }
  function dustColour(st, weights, out) {
    let m = dustOf.get(st.id);
    if (!m) { m = {}; const S = getSurface(st.id); S.biomes.forEach((b, i) => { m[b.id] = S.pal[i].mid; }); dustOf.set(st.id, m); }
    let r = 0, g = 0, b = 0, w = 0;
    for (const id in weights) { const c = m[id], k = weights[id]; if (c && k) { r += c[0] * k; g += c[1] * k; b += c[2] * k; w += k; } }
    return w > 0 ? out.set(r / w, g / w, b / w) : out.set(0.9, 0.8, 0.66);
  }
  // PHYSICS' draw kits (rain, snow, dust, rings, prints) with the painter's materials. They are
  // built when PHYSICS is handed over and brought up to date just before each frame is painted.
  let kits = null, kitsWanted = true;
  // Fresh snow. PHYSICS' `snow` also counts the standing cover of cold places (it is 1 on the
  // alpine meadow in fair weather); that cover is already in each biome's painting (snow
  // peaks, frost fields). What the weather adds is what has fallen lately: it gathers while
  // snow falls and is gone a few minutes after, never more than PHYSICS says lies there.
  let freshSnow = 0;
  const inksOf = new Map();   // body -> { biomeId: 16 inks }
  function kitInks(st, weights) {
    let m = inksOf.get(st.id);
    if (!m) { m = {}; const S = getSurface(st.id); S.biomes.forEach((b, i) => { m[b.id] = biomeInks(S.pal[i], b.liquid && b.liquid.color); }); inksOf.set(st.id, m); }
    for (let i = 0; i < 16; i++) {
      let r = 0, g = 0, b = 0, w = 0;
      for (const id in weights) { const c = m[id] && m[id][i], k = weights[id]; if (c && k) { r += c[0] * k; g += c[1] * k; b += c[2] * k; w += k; } }
      if (w > 0) KIT_PALETTE[i].set(r / w, g / w, b / w);
    }
  }
  function buildKits() {
    if (!physics || !kitsWanted || kits) return;
    const P = physics;
    import('../physics/three/index.js').then((K) => {
      if (physics !== P || kits) return;
      // the painter's draw table: PHYSICS' set for this pipeline (marks no smaller than three
      // internal pixels survive the brush), rain a little broader and longer: a few strokes
      const D = K.DRAW_PAINTED, draw = {};
      for (const k in D) draw[k] = { ...D[k] };
      draw.rain = { ...D.rain, width: 0.065, exposure: 0.13, minPx: 5 };      // (the share drawn is PHYSICS': it follows how hard it rains)
      draw.snow = { ...D.snow, size: 0.07, minPx: 3.5, maxPx: 6.5, varySize: 0.5 };
      kits = K.createPhysicsKits(P, { makeMaterial: (kind, info) => makeKitMaterial(kind, info, { shapeGlsl: K.SHAPE_GLSL }), weather: { draw } });
      for (const o of kits.objects) if (o.material && o.material.userData.pcGlaze && !GLAZES.includes(o)) GLAZES.push(o);
    }).catch((e) => console.warn('weather kits not available: ' + e.message));
  }
  // one pixel of the scene pass at one metre (the near strokes are never thinner than the brush)
  let nearPixel = 0.002;
  FRAME_HOOKS.push((camera, info) => { if (camera.isPerspectiveCamera && info.internalHeight) nearPixel = 2 * Math.tan(camera.fov * Math.PI / 360) / info.internalHeight; });
  // the sky's glaze: the pulse drive's streaks run out from where the ship is heading (the
  // ship's model says when the drive is on; at a full cruise in space a faint set of drags)
  const _fq = new THREE.Quaternion();
  let glazeT = -1;
  FRAME_HOOKS.push((camera) => {
    const u = skyGlaze.material.uniforms, now = G.uTime.value, dt = glazeT < 0 ? 0 : Math.min(0.1, Math.max(0, now - glazeT));
    glazeT = now;
    const on = MOTION.pulse && performance.now() - MOTION.pulseAt < 600 ? 1 : 0;
    MOTION.pulse01 += (on - MOTION.pulse01) * (dt > 0 ? 1 - Math.exp(-dt / 0.45) : 1);
    if (MOTION.pulse01 < 0.002 && !on) MOTION.pulse01 = 0;
    const cruise = THREE.MathUtils.smoothstep(MOTION.speed01, 0.85, 1.0) * MOTION.space01 * 0.16;
    const S = Math.max(MOTION.pulse01, cruise);
    u.uStreak.value.set(S, now * 0.9, nearPixel, 0);
    let ship = null;
    if (S > 0.003) for (const o of scene.children) if (o.userData && o.userData.pcCaster === 'ship' && o.visible) { ship = o; break; }
    if (ship) u.uTravel.value.set(0, 0, -1).applyQuaternion(ship.getWorldQuaternion(_fq));
    else camera.getWorldDirection(u.uTravel.value);
    // (nothing to lay by day on the ground: the object sits the frame out)
    skyGlaze.visible = S > 0.003 || skyU.uAtmo.value.x > 0.001 || skyU.uAtmo.value.y < 0.999;
    glazeWhy = `S ${S.toFixed(3)} space ${skyU.uAtmo.value.x.toFixed(3)} day ${skyU.uAtmo.value.y.toFixed(4)} pulse ${MOTION.pulse01.toFixed(3)} speed ${MOTION.speed01.toFixed(2)}`;
  });
  FRAME_HOOKS.push((camera, info) => {
    if (!kits) return;
    const id = physics && physics.here && physics.here.bodyId, root = id && bodies.get(id);
    if (root && id === lastActive) kits.update(root, camera, info.internalHeight);
    else for (const o of kits.objects) o.visible = false;
  });
  const tmpKey = { zenith: new THREE.Vector3(), horizon: new THREE.Vector3(), haze: new THREE.Vector3(), glaze: new THREE.Vector3(), light: new THREE.Vector3(), grade: new THREE.Vector3(), cloudShade: new THREE.Vector3() };

  function blendKeys(look, wDay, wDawn, wDusk, wNight) {
    const s = look.sky;
    for (const f of Object.keys(tmpKey)) {
      const a = s.day[f], b = s.dawn[f], c = s.dusk[f], d = s.night[f];
      tmpKey[f].set(
        a[0] * wDay + b[0] * wDawn + c[0] * wDusk + d[0] * wNight,
        a[1] * wDay + b[1] * wDawn + c[1] * wDusk + d[1] * wNight,
        a[2] * wDay + b[2] * wDawn + c[2] * wDusk + d[2] * wNight);
    }
  }

  function sunForHours(st, hours, out) {
    // local frame at the camera
    _up.copy(st.camLocal).normalize();
    _east.crossVectors(Y, _up);
    if (_east.lengthSq() < 1e-6) _east.set(1, 0, 0);
    _east.normalize();
    _north.crossVectors(_up, _east);
    const H = ((hours - 12) / 24) * Math.PI * 2;
    const tilt = 0.56 * (_up.y >= 0 ? 1 : -1);
    out.copy(_up).multiplyScalar(Math.cos(H) * Math.cos(tilt))
      .addScaledVector(_north, -Math.cos(H) * Math.sin(tilt))
      .addScaledVector(_east, -Math.sin(H));
    return out.normalize();
  }

  let frameNo = 0, lastWall = 0, wallDt = 16, fixedSlice = false;
  const SKY_KEYS = ['cloud', 'overcast', 'haze', 'fog', 'dust', 'wet', 'snow', 'rain', 'snowfall', 'storm', 'fresh'];
  const skyEase = { on: false, body: null, v: {} };
  function update(dt, cameraPos, activeBodyId) {
    frameNo++;
    const nowW = performance.now();
    // the frame time, smoothed over about twenty frames: one long frame changes nothing
    wallDt += ((lastWall ? Math.min(1000, nowW - lastWall) : 16) - wallDt) * 0.05; lastWall = nowW;
    const active = activeBodyId && state.has(activeBodyId) ? state.get(activeBodyId) : null;
    // PHYSICS' flora field for the body it is running on (it has already updated this frame)
    syncPhysFlora(physics && physics.fields && active && (!physics.here || !physics.here.bodyId || physics.here.bodyId === active.id) ? physics.fields.flora : null);
    const physHere = physics && physics.fields && active && (!physics.here || !physics.here.bodyId || physics.here.bodyId === active.id);
    syncPhysWater(physHere ? physics.fields.water : null);
    PHYSW.uWaveLod.value = QUALITY.level === 0 ? 0.6 : 1;
    // A far world that cannot be seen is not drawn: one wholly under the horizon of the world we
    // stand on, or behind its closed sky (it used to be submitted all the same: Neptune behind
    // the thunderstorm at the Earth spawn was 24 k triangles and 13 draw calls of nothing).
    let hzn = -1, closedSky = false;
    if (active) {
      active.root.updateMatrixWorld(true);
      active.root.getWorldPosition(_hup);
      _hup.subVectors(cameraPos, _hup);
      const cr = _hup.length();
      if (cr > 1) {
        _hup.divideScalar(cr);
        hzn = Math.PI / 2 + Math.acos(Math.min(1, (active.body.radius * 0.92) / cr));    // (the lowest ground there could be)
        closedSky = skyU.uWxSky.value.x > 0.6 && skyU.uAtmo.value.x < 0.3 && lastActive === active.id;
      }
    }
    for (const st of state.values()) {
      const root = st.root;
      root.updateMatrixWorld(true);
      // tier 2: the world itself; 1: a dab (one small washed ball: what a brush makes of a disc a
      // few pixels across, where the terrain was 14 k to 25 k triangles); 0: nothing
      let tier = 2;
      if (st !== active) {
        root.getWorldPosition(_v).sub(cameraPos);
        const dist = Math.max(1, _v.length()), rpx = st.body.radius / dist / nearPixel;
        tier = rpx < 1.3 ? 0 : rpx < (st.farTier === 2 ? 8 : 10) ? 1 : 2;
        if (hzn > 0 && tier) {
          const reach = st.body.radius * (st.ring ? 2.6 : 1.12) + (st.body.atmosphereHeight || 0);
          const fromUp = Math.acos(Math.max(-1, Math.min(1, _v.dot(_hup) / dist)));
          if (closedSky || fromUp - Math.asin(Math.min(1, reach / dist)) > hzn) tier = 0;
        }
      }
      st.farTier = tier;
      const seen = tier === 2;
      st.terrain.group.visible = seen;
      if (st.ring) st.ring.visible = tier > 0;
      if (tier === 1 && !st.dab) st.dab = makeDab(st);
      if (st.dab) st.dab.visible = tier === 1;
      root.getWorldQuaternion(_q);
      // camera in body-local coordinates
      st.camLocal.copy(cameraPos);
      root.worldToLocal(st.camLocal);
      // sun direction
      const bu = st.bu;
      if (st.forcedTime != null) {
        sunForHours(st, st.forcedTime, bu.uSunDirL.value);
        bu.uSunDirW.value.copy(bu.uSunDirL.value).applyQuaternion(_q);
      } else {
        root.getWorldPosition(_v);
        sun.getWorldPosition(_v2);
        bu.uSunDirW.value.copy(_v2.sub(_v)).normalize();
        bu.uSunDirL.value.copy(bu.uSunDirW.value).applyQuaternion(_q.clone().invert());
      }
      const isActive = st === active;
      if (st.clouds) {
        // the deck gathers as you leave the atmosphere and thins away as you come down through it
        const a01 = THREE.MathUtils.smoothstep(st.camLocal.length() - st.body.radius, st.body.atmosphereHeight * 0.6, st.body.atmosphereHeight * 1.6);
        st.clouds.visible = seen && a01 > 0.02;
        const cu = st.clouds.material.uniforms.uCloud.value;
        // banded worlds close into a full deck seen from outside
        cu.x = (st.look.bands ? 1 : st.look.cloud) * a01; cu.y = Math.max(900, st.body.atmosphereHeight * 3.2);
      }
      st.terrain.detail = isActive;
      // One shared time slice per frame. When terrain and flora both have work they take
      // turns at going first, so no frame pays for a full slice of each.
      // (when frames are already very slow, as in software rendering, building is given a
      // share of the frame instead of a fixed few milliseconds, or nothing would ever settle)
      const tb = performance.now(), slice = (wallDt > 80 && !fixedSlice ? Math.max(budgetMs, Math.min(220, wallDt * 0.3)) : budgetMs) * 0.8;
      if (isActive && st.flora && (frameNo & 1) && st.flora.busy > 0 && st.terrain.busy > 0) {
        st.flora.update(st.camLocal, true, slice);
        st.terrain.update(st.camLocal, Math.max(0, slice - (performance.now() - tb)));
      } else {
        st.terrain.update(st.camLocal, isActive ? slice : 0);
        if (isActive) { const tt = performance.now() - tb; if (tt > prof.terrain) prof.terrain = tt; }
        if (st.flora) st.flora.update(st.camLocal, isActive, isActive ? Math.max(0, slice - (performance.now() - tb)) : 0);
      }
      if (!isActive) {
        if (st.near) st.near.update(st.camLocal, false);
        // far bodies: plain daylight; seen through the air of the world we stand on they are
        // veiled by its sky (a pale disc by day, as the moon is), clear at night and from space
        const veil = active && lastActive === active.id ? (1 - skyU.uAtmo.value.x) * skyU.uAtmo.value.y * 0.72 : 0;
        if (veil > 0.01) { bu.uFog.value.set(1, 6, veil, 1); bu.uHaze.value.copy(skyU.uSkyZenith.value).lerp(skyU.uSkyHorizon.value, 0.45); }
        else bu.uFog.value.set(1e-7, 6, 0, 1);
        bu.uDayness.value = 1; bu.uWx.value.set(0, 0, 0, 0);
      }
    }
    if (active) {
      const st = active, bu = st.bu, look = st.look, body = st.body;
      const camR = st.camLocal.length();
      _up.copy(st.camLocal).normalize();
      const here = sampleSurfacePure(st.id, _up.x, _up.y, _up.z);
      const ground = here.radius;
      // the near ground: one layer of strokes round the eye (built on first use, in what is left of the slice)
      if (!st.near) st.near = new NearGround(st.id, st.root, bu);
      st.near.update(st.camLocal, true, camR - ground, Math.max(0.6, wallDt > 80 && !fixedSlice ? Math.min(110, wallDt * 0.15) : budgetMs * 0.25), dt, nearPixel);     // (in slow frames a share of the frame, like the terrain)
      // some biomes are mistier than others: blend the visibility by what is under the camera
      // and some lie in a lasting twilight (a ring's shadow, a storm wall, a crater that never sees the sun)
      let mist = 0, twi = 0;
      for (const b of look.biomes) {
        const w = here.biomeWeights[b.id];
        if (!w) continue;
        let m = b.mist || 1;
        // fog lying in the low ground: thick below its level, clear above it
        if (b.t && b.t.fog) m *= 0.2 + 0.8 * THREE.MathUtils.smoothstep(camR - body.radius, b.t.fog[0] - b.t.fog[1] * 0.5, b.t.fog[0] + b.t.fog[1]);
        mist += w * m; twi += w * (b.twilight || 0);
      }
      mist = mist || 1;
      const alt = camR - ground;
      const atmH = Math.max(1, body.atmosphereHeight || 1);
      const space01 = body.atmosphereHeight > 0 ? THREE.MathUtils.smoothstep(camR - body.radius, atmH * 0.55, atmH * 1.15) : 1;
      const e = bu.uSunDirL.value.dot(_up);
      _east.crossVectors(Y, _up).normalize();
      const am = bu.uSunDirL.value.dot(_east) > 0;
      let wNight = 1 - THREE.MathUtils.smoothstep(e, -0.24, -0.03);
      let wDay = THREE.MathUtils.smoothstep(e, 0.06, 0.42);
      const wTwi = Math.max(0, 1 - wNight - wDay);
      const lost = wDay * twi;
      wDay -= lost; wNight += lost * 0.22;
      blendKeys(look, wDay, am ? wTwi : 0, (am ? 0 : wTwi) + lost * 0.78, wNight);
      const dayness = 1 - wNight;
      // ---- weather in the picture (PHYSICS' sky numbers; they belong to the air near the ground)
      // the sky numbers are eased over about two seconds before anything is painted from them
      // (PHYSICS' may move by 8 to 15 % a second: a wash must not jump). A forced sky, a first
      // frame, a frozen clock and a change of body are taken as they are; lightning is never eased.
      const skRaw = skyNow(physics, st.id), air = 1 - space01;
      let sk = skRaw;
      if (skRaw && !WX.forced) {
        const snap = !skyEase.on || skyEase.body !== st.id || !(dt > 0), k = snap ? 1 : 1 - Math.exp(-Math.min(dt, 0.25) / 0.9);
        for (const key of SKY_KEYS) { const v = +skRaw[key] || 0; skyEase.v[key] = snap ? v : skyEase.v[key] + (v - skyEase.v[key]) * k; }
        skyEase.v.flash = skRaw.flash || 0; skyEase.on = true; skyEase.body = st.id;
        sk = skyEase.v;
      } else skyEase.on = false;
      // (PHYSICS closes the sky itself where rain or snow falls: nothing is added here)
      const oc = sk ? sk.overcast * air : 0, storm = sk ? sk.storm * air : 0;
      const hazeK = sk ? Math.min(1, Math.max(0.04, sk.haze / 0.8)) : 1;          // fair weather (0.8 and up) is my clear day
      const lostV = sk ? 1 - hazeK : 0;                                           // how much of the view the weather has taken
      const dustW = sk ? Math.min(1, sk.dust * (0.25 + 1.5 * lostV)) * air : 0, fogW = sk ? Math.min(1, sk.fog * (0.2 + 1.2 * lostV)) * air : 0;
      const veilR = sk ? sk.rain * air : 0, veilS = sk ? sk.snowfall * air : 0;
      // this world's storm pigment: its cloud shadow laid dense and glazed with indigo
      const cs = tmpKey.cloudShade, dn = (c) => c - (c - c * c) * 1.25;
      // (Payne's grey on the cool worlds; on the warm ones it stays sepia: orange mixed with indigo is mud)
      const warm = Math.min(1, Math.max(0, (cs.x - cs.z) * 3));
      _storm.set(dn(cs.x) * 0.80, dn(cs.y) * 0.84, dn(cs.z) * 0.93).lerp(_pale.set(0.38, 0.45, 0.53).multiplyScalar(0.45 + 0.55 * dayness), 0.68 - 0.46 * warm);
      // overcast: a cool even light; a storm deepens the glaze (indigo, not grey)
      tmpKey.light.lerp(_pale.set(0.94, 0.955, 0.99), oc * 0.85);
      tmpKey.glaze.multiply(_pale.set(1 - 0.10 * storm, 1 - 0.08 * storm, 1 - 0.02 * storm));
      // the far washes: lost into the pale band under the cloud, into grey water, into the ground's own dust
      tmpKey.zenith.lerp(_pale.copy(_storm).lerp(_white, 0.16), oc * 0.92);
      tmpKey.horizon.lerp(_pale.copy(_storm).lerp(_white, 0.66), oc * 0.9);
      tmpKey.haze.lerp(_pale.copy(_storm).lerp(_white, 0.74), oc * 0.9);
      tmpKey.haze.lerp(_pale.set(0.955, 0.96, 0.965), fogW * 0.7);
      if (dustW > 0.003) {
        dustColour(st, here.biomeWeights, _dust);
        tmpKey.haze.lerp(_pale.copy(_dust).lerp(_white, 0.30), dustW * 0.92);
        tmpKey.horizon.lerp(_pale.copy(_dust).lerp(_white, 0.22), dustW * 0.9);
        tmpKey.zenith.lerp(_pale.copy(_dust).multiplyScalar(0.94), dustW * 0.8);
        tmpKey.light.lerp(_pale.copy(_dust).lerp(_white, 0.55), dustW * 0.6);
        _storm.lerp(_pale.copy(_dust).multiplyScalar(0.74), dustW * 0.9);
      }
      // night: the sheet lays the night's key over everything (far more pigment in every wash:
      // post.js). The sky's own washes are laid that much lighter here, so that they land on
      // the values the look gives them.
      // (a wet night under a closed sky is dark enough by its own washes: the key is eased there)
      const nightK = (1 - dayness) * (1 - space01) * (1 - 0.30 * oc);
      SHEET.night = nightK;
      if (nightK > 0.003) { const k = 0.81 * nightK; for (const c of [tmpKey.zenith, tmpKey.horizon, tmpKey.haze, _storm, tmpKey.cloudShade]) { c.x = undens(c.x, k); c.y = undens(c.y, k); c.z = undens(c.z, k); } }
      bu.uGlaze.value.copy(tmpKey.glaze);
      bu.uLight.value.copy(tmpKey.light);
      bu.uHaze.value.copy(tmpKey.haze);
      bu.uDayness.value = dayness;
      if (lastActive && st.id !== lastActive) freshSnow = 0;
      freshSnow = Math.min(1, Math.max(0, freshSnow + dt * (veilS > 0.02 ? veilS / 22 : -1 / 300)));
      // (PHYSICS' twelfth number, `fresh`, is the cover of fresh snow alone: that is what is
      // laid over the painted ground; the older model above stands in where it is not given)
      const snowC = sk ? (skRaw.fresh != null ? sk.fresh : WX.forced ? sk.snow : Math.min(sk.snow, freshSnow)) * air : 0;
      bu.uWx.value.set(Math.min(1, oc + dustW * 0.6), sk ? sk.wet * air : 0, snowC, Math.max(veilR, veilS));
      skyU.uWxSky.value.set(Math.min(1, oc + dustW * 0.5), storm, veilR, veilS);
      skyU.uStormWash.value.copy(_storm);
      WX.key = (storm * 0.34 + oc * 0.14 + dustW * 0.10) * dayness; WX.flash = sk ? sk.flash * air : 0;
      // inks for the kits: each ground material in this place's own washes; rain is the sky's wet wash
      if (kits) {
        kitInks(st, here.biomeWeights);
        KIT_INK.rain.copy(tmpKey.haze).lerp(_storm, 0.6);     // a middle value: darker than the light sky, lighter than the wood
        KIT_INK.dust.copy(KIT_PALETTE[5]); KIT_INK.sand.copy(KIT_PALETTE[4]);
      }
      const v0 = look.visibility[0], v1 = look.visibility[1];
      const vis = (v0 * mist + (v1 - v0 * mist) * THREE.MathUtils.smoothstep(alt, 6, 160)) * (hazeK + (1 - hazeK) * space01) + 40000 * space01;
      bu.uFog.value.set(1 / vis, 6, 1 - space01 * 0.9, space01);
      // sky
      skyU.uSunDirL.value.copy(bu.uSunDirL.value);
      skyU.uCamL.value.copy(st.camLocal);
      skyU.uSkyZenith.value.copy(tmpKey.zenith);
      skyU.uSkyHorizon.value.copy(tmpKey.horizon);
      skyU.uHaze.value.copy(tmpKey.haze);
      skyU.uCloudShade.value.copy(tmpKey.cloudShade);
      // cloud cover: the world's own share in fair weather, closing in as the weather says
      const cover = sk ? look.cloud * 0.8 + (Math.max(look.cloud, 0.82) - look.cloud * 0.8) * THREE.MathUtils.smoothstep(Math.max(sk.cloud * air, dustW * 0.8), 0.12, 0.9) : look.cloud;
      skyU.uCloud.value.set(body.radius + atmH * 0.55, cover, Math.max(900, atmH * 3.2), 0.0006);
      skyU.uAtmo.value.set(space01, dayness, 0.042, body.radius);
      st.root.getWorldQuaternion(_q);
      skyU.uBodyInv.value.setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(_q.invert()));
      SHEET.grade.copy(tmpKey.grade).lerp(new THREE.Vector3(1, 1, 1), space01);
      SHEET.valid = true;
      // objects painted with the default wash (explorer, ship, stand-ins) share this light
      const du = defaultBodyUniforms();
      for (const k of Object.keys(bu)) { const a = du[k].value, b = bu[k].value; if (a && a.copy) a.copy(b); else du[k].value = b; }
      lighting.bodyId = st.id; lighting.sunElevation = e; lighting.dayness = dayness; lighting.altitude = alt; lighting.space01 = space01;
      lighting.hours = (12 + Math.atan2(-bu.uSunDirL.value.dot(_east), e) * 12 / Math.PI + 24) % 24;
    } else {
      // deep space: no atmosphere anywhere
      skyU.uAtmo.value.set(1, 1, 0.03, 1);
      skyU.uCloud.value.y = 0; skyU.uWxSky.value.set(0, 0, 0, 0); WX.key = 0; WX.flash = 0;
      sun.getWorldPosition(_v2);
      skyU.uSunDirL.value.copy(_v2.sub(cameraPos)).normalize();
      skyU.uBodyInv.value.identity();
      skyU.uCamL.value.set(0, 1, 0);
      SHEET.grade.set(1, 1, 1); SHEET.valid = true; SHEET.night = 0;
      const du = defaultBodyUniforms();
      du.uSunDirW.value.copy(skyU.uSunDirL.value); du.uFog.value.set(1e-7, 6, 0, 0);
      lighting.bodyId = null; lighting.space01 = 1;
    }
    castShade(active);
    lastActive = active ? active.id : null;
  }

  // The explorer and the ship stand on the land: each lays a soft shade on the ground, thrown
  // away from the sun (a pool right under them when the sky is closed), fading as they rise.
  // They are found in the scene by userData.pcCaster (src/art/models.js); nothing to wire.
  const _cp = new THREE.Vector3(), _cu = new THREE.Vector3(), _ct = new THREE.Vector3(), _ca = new THREE.Vector3(), _cq = new THREE.Quaternion();
  function castShade(active) {
    const K = G.uCastK.value, U = G.uCast.value;
    K.set(0, 0);
    if (!active) return;
    const sunL = active.bu.uSunDirL.value, ov = active.bu.uWx.value.x, day = active.bu.uDayness.value;
    for (const o of scene.children) {
      const kind = o.userData && o.userData.pcCaster;
      if (!kind || !o.visible) continue;
      const i = kind === 'ship' ? 1 : 0;
      _cp.copy(o.position); active.root.worldToLocal(_cp);
      const r = _cp.length();
      if (!(r > 1)) continue;
      _cu.copy(_cp).divideScalar(r);
      const ground = sampleSurfacePure(active.id, _cu.x, _cu.y, _cu.z).radius, h = Math.max(0, r - ground);
      if (h > 60) continue;
      // where the sun throws the shade, and how far (nothing is thrown under a closed sky or at night)
      const e = sunL.dot(_cu), thrown = (1 - ov) * THREE.MathUtils.smoothstep(e, 0.03, 0.2) * day;
      _ct.copy(sunL).addScaledVector(_cu, -e).multiplyScalar(-1);
      if (_ct.lengthSq() < 1e-6) _ct.set(1, 0, 0).addScaledVector(_cu, -_cu.x);
      _ct.normalize();
      const cot = Math.min(2.2, Math.sqrt(Math.max(0, 1 - e * e)) / Math.max(0.12, e));
      if (i === 0) {
        const len = 1.7 * cot * thrown;
        U[0].set(0, 0, 0, 0.34 + len * 0.5 + h * 0.05);
        _ca.copy(_cu).multiplyScalar(ground).addScaledVector(_ct, len * 0.5 + h * cot * thrown);
        U[0].x = _ca.x; U[0].y = _ca.y; U[0].z = _ca.z;
        U[1].set(_ct.x, _ct.y, _ct.z, 0.33 + h * 0.05);
        K.x = (0.62 + 0.3 * thrown) * (1 - THREE.MathUtils.smoothstep(h, 0.5, 9));
      } else {
        // the ship: a broad oval along its keel
        active.root.getWorldQuaternion(_cq).invert();
        _ca.set(0, 0, -1).applyQuaternion(o.quaternion).applyQuaternion(_cq);
        _ca.addScaledVector(_cu, -_ca.dot(_cu));
        if (_ca.lengthSq() < 1e-6) _ca.copy(_ct);
        _ca.normalize();
        U[3].set(_ca.x, _ca.y, _ca.z, 2.5 + h * 0.08);
        _ca.copy(_cu).multiplyScalar(ground).addScaledVector(_ct, (1.2 + h) * cot * thrown);
        U[2].set(_ca.x, _ca.y, _ca.z, 4.7 + h * 0.08);
        K.y = (0.75 + 0.25 * thrown) * (1 - THREE.MathUtils.smoothstep(h, 3, 40));
      }
    }
  }

  function busy() {
    let n = 0;
    for (const st of state.values()) { n += st.terrain.busy; if (st.flora) n += st.flora.busy; if (st.near) n += st.near.busy; }
    return n;
  }

  return {
    bodies, sun, update,
    sampleSurface(bodyId, unitDir) { return sampleSurfacePure(bodyId, unitDir.x, unitDir.y, unitDir.z); },
    getVistas(bodyId) { return getVistasPure(bodyId); },
    setTime(bodyId, hours) { const st = state.get(bodyId); if (st) st.forcedTime = (hours == null ? null : +hours); },
    getSpawn(bodyId) { const s = getSurface(bodyId).getSpawn(); return { unitDir: { x: s.x, y: s.y, z: s.z } }; },
    setVistaFound(bodyId, vistaId, found) { const st = state.get(bodyId); if (st) { if (found) st.found.add(vistaId); else st.found.delete(vistaId); } },
    // additive
    get busy() { return busy(); },
    // { fixed: true } pins the slice (no larger share of slow frames): for checking the 5 ms budget in software GL
    setBuildBudget(ms, opts) { budgetMs = Math.max(0.5, +ms || 5); fixedSlice = !!(opts && opts.fixed); },
    getLighting() { return lighting; },
    getBiomes(bodyId) { return getLook(bodyId).biomes.map((b) => ({ id: b.id, name: b.name })); },
    // a place to arrive at in a biome: level, dry, and showing what the biome is whichever
    // way one faces (src/art/easels.js, STANDS), with the best way to face (yaw from local
    // north toward east, radians); else the painter's easel; else the biome's first site
    findBiome(bodyId, biomeId) { return getStandPure(bodyId, biomeId); },
    get _near() { const st = state.get(lastActive || 'earth'); return st && st.near; },
    get _glaze() { return glazeWhy; },
    get _flora() { const st = state.get(lastActive || 'earth'); return st && st.flora; },
    get _prof() { return Object.assign({}, prof, this._flora ? this._flora.prof : {}); },
    _profReset() { prof.terrain = 0; const fl = this._flora; if (fl) { const p = fl.prof; p.wanted = p.build = p.retier = 0; } },
    bodyUniforms(bodyId) { const st = state.get(bodyId); return st ? st.bu : null; },
    // Trunks and boulders within `radius` metres of a point (not part of sampleSurface):
    // -> [{ unitDir, radius, height, kind }]
    sampleObstacles(bodyId, unitDir, radius) { return sampleObstaclesPure(bodyId, unitDir.x, unitDir.y, unitDir.z, radius); },
    // PHYSICS hook (COORDINATOR C14): the motion source for flora and weather. Stored now, read
    // by the flora and weather drawing as those fields arrive.
    // (opts.kits === false: no rain, snow, dust or prints are drawn)
    setPhysics(p, opts) { physics = p || null; if (opts && opts.kits === false) kitsWanted = false; if (kits && !physics) { kits.dispose(); kits = null; } buildKits(); },
    get kits() { return kits; },
    // how much freshly fallen snow lies in the picture, 0..1 (set it for a still frame)
    get freshSnow() { return freshSnow; },
    setFreshSnow(x) { freshSnow = Math.min(1, Math.max(0, +x || 0)); },
    // Force the weather in the picture (gallery, tests): PHYSICS' eleven sky numbers, or null
    // to go back to what PHYSICS (or PILOT's setMood.sky) says.
    setWeather(sky) { WX.forced = sky ? Object.assign({ cloud: 0, overcast: 0, haze: 1, fog: 0, dust: 0, wet: 0, snow: 0, rain: 0, snowfall: 0, storm: 0, flash: 0 }, sky) : null; },
    getStats() { const st = state.get(lastActive); return st ? { patches: st.terrain.patchCount, visible: st.terrain.visible.length, queue: st.terrain.busy } : null; },
    sky,
  };
}
