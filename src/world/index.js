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
import { getSurface, sampleSurfacePure, getVistasPure, getStandPure } from './surface.js';
import { PlanetTerrain } from './terrain.js';
import { sampleObstaclesPure } from './obstacles.js';
import { makeSky, makeSkyUniforms } from './sky.js';
import { Flora } from './flora.js';
import { makeRing, makeCloudShell } from './orbit.js';
import { makeBodyUniforms, SHEET, WX, skyNow, syncPhysFlora } from '../render/shared.js';
import { defaultBodyUniforms } from '../render/materials.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion();
const _up = new THREE.Vector3(), _east = new THREE.Vector3(), _north = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);

function lerp3(out, a, b, t) { out.set(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t); }

export function createWorld(scene) {
  const bodies = new Map();
  const state = new Map();
  const skyU = makeSkyUniforms();
  const sky = makeSky(skyU);
  scene.add(sky);

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
      found: new Set(),
    };
    if (look.flora) st.flora = new Flora(id, root, bu);
    if (look.rings) root.add(makeRing(bu, BODIES[id].radius, look.rings));
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

  let frameNo = 0, lastWall = 0, wallDt = 16;
  function update(dt, cameraPos, activeBodyId) {
    frameNo++;
    const nowW = performance.now();
    // the frame time, smoothed over about twenty frames: one long frame changes nothing
    wallDt += ((lastWall ? Math.min(1000, nowW - lastWall) : 16) - wallDt) * 0.05; lastWall = nowW;
    const active = activeBodyId && state.has(activeBodyId) ? state.get(activeBodyId) : null;
    // PHYSICS' flora field for the body it is running on (it has already updated this frame)
    syncPhysFlora(physics && physics.fields && active && (!physics.here || !physics.here.bodyId || physics.here.bodyId === active.id) ? physics.fields.flora : null);
    for (const st of state.values()) {
      const root = st.root;
      root.updateMatrixWorld(true);
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
        st.clouds.visible = a01 > 0.02;
        const cu = st.clouds.material.uniforms.uCloud.value;
        // banded worlds close into a full deck seen from outside
        cu.x = (st.look.bands ? 1 : st.look.cloud) * a01; cu.y = Math.max(900, st.body.atmosphereHeight * 3.2);
      }
      st.terrain.detail = isActive;
      // One shared time slice per frame. When terrain and flora both have work they take
      // turns at going first, so no frame pays for a full slice of each.
      // (when frames are already very slow, as in software rendering, building is given a
      // share of the frame instead of a fixed few milliseconds, or nothing would ever settle)
      const tb = performance.now(), slice = (wallDt > 80 ? Math.max(budgetMs, Math.min(220, wallDt * 0.3)) : budgetMs) * 0.8;
      if (isActive && st.flora && (frameNo & 1) && st.flora.busy > 0 && st.terrain.busy > 0) {
        st.flora.update(st.camLocal, true, slice);
        st.terrain.update(st.camLocal, Math.max(0, slice - (performance.now() - tb)));
      } else {
        st.terrain.update(st.camLocal, isActive ? slice : 0);
        if (isActive) { const tt = performance.now() - tb; if (tt > prof.terrain) prof.terrain = tt; }
        if (st.flora) st.flora.update(st.camLocal, isActive, isActive ? Math.max(0, slice - (performance.now() - tb)) : 0);
      }
      if (!isActive) {
        // far bodies: plain daylight, no haze
        bu.uFog.value.set(1e-7, 6, 0, 1);
        bu.uDayness.value = 1; bu.uWx.value.set(0, 0, 0, 0);
      }
    }
    if (active) {
      const st = active, bu = st.bu, look = st.look, body = st.body;
      const camR = st.camLocal.length();
      _up.copy(st.camLocal).normalize();
      const here = sampleSurfacePure(st.id, _up.x, _up.y, _up.z);
      const ground = here.radius;
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
      const sk = skyNow(physics, st.id), air = 1 - space01;
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
      bu.uGlaze.value.copy(tmpKey.glaze);
      bu.uLight.value.copy(tmpKey.light);
      bu.uHaze.value.copy(tmpKey.haze);
      bu.uDayness.value = dayness;
      bu.uWx.value.set(Math.min(1, oc + dustW * 0.6), sk ? sk.wet * air : 0, sk ? sk.snow * air : 0, Math.max(veilR, veilS));
      skyU.uWxSky.value.set(Math.min(1, oc + dustW * 0.5), storm, veilR, veilS);
      skyU.uStormWash.value.copy(_storm);
      WX.key = (storm * 0.34 + oc * 0.14 + dustW * 0.10) * dayness; WX.flash = sk ? sk.flash * air : 0;
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
      SHEET.grade.set(1, 1, 1); SHEET.valid = true;
      const du = defaultBodyUniforms();
      du.uSunDirW.value.copy(skyU.uSunDirL.value); du.uFog.value.set(1e-7, 6, 0, 0);
      lighting.bodyId = null; lighting.space01 = 1;
    }
    lastActive = active ? active.id : null;
  }

  function busy() {
    let n = 0;
    for (const st of state.values()) { n += st.terrain.busy; if (st.flora) n += st.flora.busy; }
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
    setBuildBudget(ms) { budgetMs = Math.max(0.5, +ms || 5); },
    getLighting() { return lighting; },
    getBiomes(bodyId) { return getLook(bodyId).biomes.map((b) => ({ id: b.id, name: b.name })); },
    // a place to arrive at in a biome: level, dry, and showing what the biome is whichever
    // way one faces (src/art/easels.js, STANDS), with the best way to face (yaw from local
    // north toward east, radians); else the painter's easel; else the biome's first site
    findBiome(bodyId, biomeId) { return getStandPure(bodyId, biomeId); },
    get _flora() { const st = state.get(lastActive || 'earth'); return st && st.flora; },
    get _prof() { return Object.assign({}, prof, this._flora ? this._flora.prof : {}); },
    _profReset() { prof.terrain = 0; const fl = this._flora; if (fl) { const p = fl.prof; p.wanted = p.build = p.retier = 0; } },
    bodyUniforms(bodyId) { const st = state.get(bodyId); return st ? st.bu : null; },
    // Trunks and boulders within `radius` metres of a point (not part of sampleSurface):
    // -> [{ unitDir, radius, height, kind }]
    sampleObstacles(bodyId, unitDir, radius) { return sampleObstaclesPure(bodyId, unitDir.x, unitDir.y, unitDir.z, radius); },
    // PHYSICS hook (COORDINATOR C14): the motion source for flora and weather. Stored now, read
    // by the flora and weather drawing as those fields arrive.
    setPhysics(p) { physics = p || null; },
    // Force the weather in the picture (gallery, tests): PHYSICS' eleven sky numbers, or null
    // to go back to what PHYSICS (or PILOT's setMood.sky) says.
    setWeather(sky) { WX.forced = sky ? Object.assign({ cloud: 0, overcast: 0, haze: 1, fog: 0, dust: 0, wet: 0, snow: 0, rain: 0, snowfall: 0, storm: 0, flash: 0 }, sky) : null; },
    getStats() { const st = state.get(lastActive); return st ? { patches: st.terrain.patchCount, visible: st.terrain.visible.length, queue: st.terrain.busy } : null; },
    sky,
  };
}
