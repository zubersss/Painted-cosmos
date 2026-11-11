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
import { getSurface, sampleSurfacePure, getVistasPure } from './surface.js';
import { PlanetTerrain } from './terrain.js';
import { sampleObstaclesPure } from './obstacles.js';
import { makeSky, makeSkyUniforms } from './sky.js';
import { Flora } from './flora.js';
import { makeRing, makeCloudShell } from './orbit.js';
import { makeBodyUniforms, SHEET, syncPhysFlora } from '../render/shared.js';
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
      st.cloudR = BODIES[id].radius + Math.min(BODIES[id].atmosphereHeight * 0.22, BODIES[id].radius * 0.045) + 60;
      st.clouds = makeCloudShell(bu, st.cloudR, look);
      root.add(st.clouds);
    }
    state.set(id, st);
  }

  let budgetMs = 5;
  const prof = { terrain: 0 };
  let physics = null;
  let lastActive = null;
  const lighting = { bodyId: null, sunElevation: 1, hours: 12, dayness: 1, altitude: 0, space01: 0 };
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

  function update(dt, cameraPos, activeBodyId) {
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
        cu.x = st.look.cloud * a01; cu.y = Math.max(900, st.body.atmosphereHeight * 3.2);
      }
      st.terrain.detail = isActive;
      // one shared time budget per frame: terrain first, flora with what is left
      const tb = performance.now();
      st.terrain.update(st.camLocal, isActive ? budgetMs * 0.8 : 0);
      if (isActive) { const tt = performance.now() - tb; if (tt > prof.terrain) prof.terrain = tt; }
      if (st.flora) st.flora.update(st.camLocal, isActive, isActive ? Math.max(0, budgetMs - (performance.now() - tb)) : 0);
      if (!isActive) {
        // far bodies: plain daylight, no haze
        bu.uFog.value.set(1e-7, 6, 0, 1);
        bu.uDayness.value = 1;
      }
    }
    if (active) {
      const st = active, bu = st.bu, look = st.look, body = st.body;
      const camR = st.camLocal.length();
      _up.copy(st.camLocal).normalize();
      const here = sampleSurfacePure(st.id, _up.x, _up.y, _up.z);
      const ground = here.radius;
      // some biomes are mistier than others: blend the visibility by what is under the camera
      let mist = 0;
      for (const b of look.biomes) { const w = here.biomeWeights[b.id]; if (w) mist += w * (b.mist || 1); }
      mist = mist || 1;
      const alt = camR - ground;
      const atmH = Math.max(1, body.atmosphereHeight || 1);
      const space01 = body.atmosphereHeight > 0 ? THREE.MathUtils.smoothstep(camR - body.radius, atmH * 0.55, atmH * 1.15) : 1;
      const e = bu.uSunDirL.value.dot(_up);
      _east.crossVectors(Y, _up).normalize();
      const am = bu.uSunDirL.value.dot(_east) > 0;
      const wNight = 1 - THREE.MathUtils.smoothstep(e, -0.24, -0.03);
      const wDay = THREE.MathUtils.smoothstep(e, 0.06, 0.42);
      const wTwi = Math.max(0, 1 - wNight - wDay);
      blendKeys(look, wDay, am ? wTwi : 0, am ? 0 : wTwi, wNight);
      bu.uGlaze.value.copy(tmpKey.glaze);
      bu.uLight.value.copy(tmpKey.light);
      bu.uHaze.value.copy(tmpKey.haze);
      const dayness = 1 - wNight;
      bu.uDayness.value = dayness;
      const v0 = look.visibility[0], v1 = look.visibility[1];
      const vis = (v0 * mist + (v1 - v0 * mist) * THREE.MathUtils.smoothstep(alt, 6, 160)) + 40000 * space01;
      bu.uFog.value.set(1 / vis, 6, 1 - space01 * 0.9, space01);
      // sky
      skyU.uSunDirL.value.copy(bu.uSunDirL.value);
      skyU.uCamL.value.copy(st.camLocal);
      skyU.uSkyZenith.value.copy(tmpKey.zenith);
      skyU.uSkyHorizon.value.copy(tmpKey.horizon);
      skyU.uHaze.value.copy(tmpKey.haze);
      skyU.uCloudShade.value.copy(tmpKey.cloudShade);
      skyU.uCloud.value.set(body.radius + atmH * 0.55, look.cloud, Math.max(900, atmH * 3.2), 0.0006);
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
      skyU.uCloud.value.y = 0;
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
    findBiome(bodyId, biomeId) {
      const S = getSurface(bodyId);
      const bi = S.biomes.findIndex((b) => b.id === biomeId);
      const s = S.sites.find((x) => x.b === bi);
      return s ? { unitDir: { x: s.x, y: s.y, z: s.z } } : null;
    },
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
    getStats() { const st = state.get(lastActive); return st ? { patches: st.terrain.patchCount, visible: st.terrain.visible.length, queue: st.terrain.busy } : null; },
    sky,
  };
}
