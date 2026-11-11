// Painted Cosmos: explorer and ship (placeholder shapes for M1). OWNER: PAINTER.
// Contract (COORDINATOR C10): explorer about 1.8 m tall, origin at the feet, facing -Z, +Y up.
// Ship about 9 m long, origin at the centre of the landing-gear contact plane, nose toward -Z;
// object3D.userData.seat / .hatch are local points. animate(state, dt) ignores unknown fields.
import * as THREE from 'three';
import { makeWashMaterial } from '../render/materials.js';

function part(geo, mat, x, y, z, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

export function createExplorer() {
  const g = new THREE.Group();
  g.name = 'explorer';
  const coat = makeWashMaterial({ color: '#b6623c', scale: 0.5, dry: 0.3 });
  const dark = makeWashMaterial({ color: '#4b5669', scale: 0.4, dry: 0.2 });
  const pale = makeWashMaterial({ color: '#ead9c2', scale: 0.4, dry: 0.1 });
  const pack = makeWashMaterial({ color: '#8c7aba', scale: 0.4, dry: 0.3 });
  const body = new THREE.Group(); g.add(body);
  // coat: a soft bell
  const coatGeo = new THREE.LatheGeometry([[0.0, 1.50], [0.16, 1.47], [0.22, 1.30], [0.24, 1.05], [0.30, 0.72], [0.33, 0.55], [0.26, 0.52], [0.0, 0.52]].map((p) => new THREE.Vector2(p[0], p[1])), 14);
  part(coatGeo, coat, 0, 0, 0, body);
  const head = part(new THREE.SphereGeometry(0.15, 14, 10), pale, 0, 1.62, 0, body);
  const hat = part(new THREE.LatheGeometry([[0.0, 0.16], [0.10, 0.12], [0.16, 0.02], [0.30, -0.02], [0.31, -0.035], [0.0, -0.03]].map((p) => new THREE.Vector2(p[0], p[1])), 14), dark, 0, 1.72, 0, body);
  const legGeo = new THREE.CapsuleGeometry(0.075, 0.42, 4, 8);
  const legL = part(legGeo, dark, -0.10, 0.29, 0, body), legR = part(legGeo, dark, 0.10, 0.29, 0, body);
  const armGeo = new THREE.CapsuleGeometry(0.06, 0.42, 4, 8);
  const armL = part(armGeo, coat, -0.27, 1.12, 0, body), armR = part(armGeo, coat, 0.27, 1.12, 0, body);
  const jet = part(new THREE.CapsuleGeometry(0.13, 0.30, 4, 10), pack, 0, 1.12, 0.24, body);
  let t = 0;
  function animate(state, dt) {
    const s = state || {};
    t += (dt || 0);
    const mode = s.mode || 'idle';
    const speed = s.speed == null ? (mode === 'walk' ? 1.4 : 0) : s.speed;
    const w = mode === 'walk' || mode === 'wade' ? Math.min(1, speed / 1.2) : 0;
    const ph = t * (5 + speed * 1.5);
    legL.rotation.x = Math.sin(ph) * 0.6 * w; legR.rotation.x = -Math.sin(ph) * 0.6 * w;
    armL.rotation.x = -Math.sin(ph) * 0.45 * w; armR.rotation.x = Math.sin(ph) * 0.45 * w;
    const fl = mode === 'jet' || mode === 'fall';
    armL.rotation.z = fl ? -0.5 : -0.06; armR.rotation.z = fl ? 0.5 : 0.06;
    body.rotation.x = mode === 'jet' ? 0.18 * (s.jet01 == null ? 1 : s.jet01) : (mode === 'sit' ? -0.2 : 0);
    body.position.y = mode === 'sit' ? -0.35 : Math.abs(Math.sin(ph)) * 0.03 * w + Math.sin(t * 1.3) * 0.006;
    head.rotation.x = -(s.lookPitch || 0) * 0.5; hat.rotation.x = head.rotation.x;
  }
  return { object3D: g, animate };
}

export function createShip() {
  const g = new THREE.Group();
  g.name = 'ship';
  const hull = makeWashMaterial({ color: '#d8b56a', scale: 2.2, dry: 0.35 });
  const trim = makeWashMaterial({ color: '#b6623c', scale: 1.5, dry: 0.3 });
  const glass = makeWashMaterial({ color: '#73a9d1', scale: 1.2, wet: 0.5, dry: 0 });
  const dark = makeWashMaterial({ color: '#4b5669', scale: 1.0, dry: 0.2 });
  const body = new THREE.Group(); g.add(body);
  body.position.y = 1.15;
  // hull: a soft seed shape, nose toward -Z
  const hullGeo = new THREE.SphereGeometry(1, 24, 16);
  hullGeo.scale(1.45, 0.95, 4.4);
  const pos = hullGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i) / 4.4;
    const taper = z < 0 ? 1 - 0.35 * z * z : 1 - 0.15 * z * z;   // slimmer nose
    pos.setX(i, pos.getX(i) * taper); pos.setY(i, pos.getY(i) * taper * (pos.getY(i) < 0 ? 0.75 : 1));
  }
  hullGeo.computeVertexNormals();
  part(hullGeo, hull, 0, 0, 0, body);
  const canopyGeo = new THREE.SphereGeometry(0.85, 16, 12); canopyGeo.scale(0.95, 0.75, 1.5);
  const canopy = part(canopyGeo, glass, 0, 0.55, -1.3, body);
  const wingGeo = new THREE.SphereGeometry(1, 16, 8); wingGeo.scale(2.6, 0.12, 1.3);
  part(wingGeo, trim, -2.1, -0.05, 1.0, body).rotation.z = 0.12;
  part(wingGeo, trim, 2.1, -0.05, 1.0, body).rotation.z = -0.12;
  const finGeo = new THREE.SphereGeometry(1, 12, 8); finGeo.scale(0.1, 0.95, 1.1);
  part(finGeo, trim, 0, 0.85, 3.2, body);
  const engGeo = new THREE.CapsuleGeometry(0.42, 1.2, 4, 12); engGeo.rotateX(Math.PI / 2);
  part(engGeo, dark, -1.05, -0.1, 3.3, body); part(engGeo, dark, 1.05, -0.1, 3.3, body);
  // landing gear: three soft legs
  const gear = new THREE.Group(); g.add(gear);
  const legGeo = new THREE.CapsuleGeometry(0.10, 0.9, 4, 8);
  const padGeo = new THREE.SphereGeometry(0.28, 10, 6); padGeo.scale(1, 0.3, 1);
  for (const [x, z] of [[0, -2.6], [-1.3, 1.9], [1.3, 1.9]]) {
    part(legGeo, dark, x, 0.52, z, gear); part(padGeo, dark, x, 0.06, z, gear);
  }
  g.userData.seat = new THREE.Vector3(0, 1.75, -1.3);
  g.userData.hatch = new THREE.Vector3(-2.3, 0, -0.6);
  let t = 0;
  function animate(state, dt) {
    const s = state || {};
    t += (dt || 0);
    const mode = s.mode || 'landed';
    const gear01 = s.gear01 == null ? (mode === 'landed' || mode === 'hover' ? 1 : 0) : s.gear01;
    gear.scale.y = Math.max(0.05, gear01); gear.position.y = (1 - gear01) * 0.9; gear.visible = gear01 > 0.02;
    const c = s.canopy01 == null ? 0 : s.canopy01;
    canopy.rotation.x = -c * 0.9; canopy.position.y = 0.55 + c * 0.35;
    body.position.y = 1.15 + (mode === 'hover' ? Math.sin(t * 1.7) * 0.06 : 0);
    body.rotation.z = mode === 'hover' ? Math.sin(t * 1.1) * 0.012 : 0;
  }
  return { object3D: g, animate };
}
