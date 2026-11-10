// STUB models behind the contract of src/art/models.js (COORDINATOR.md C10). Plain shapes.
// Explorer: about 1.8 m tall, origin at the feet, facing -Z, +Y up.
// Ship: about 9 m long, origin at the centre of the gear contact plane, nose toward -Z, +Y up,
// with userData.seat (pilot's eye) and userData.hatch (where the explorer boards), ship-local.
import * as THREE from 'three';

const mat = (c) => new THREE.MeshLambertMaterial({ color: c });

export function createExplorer() {
  const g = new THREE.Group();
  g.name = 'stub-explorer';
  const suit = mat(0xc9683f), dark = mat(0x3a3f5c), pale = mat(0xf0e8d8);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.5, 4, 10), suit);
  torso.position.y = 1.1;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), pale);
  head.position.y = 1.62;
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), dark);
  visor.position.set(0, 1.63, -0.11);
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.5, 0.2), dark);
  pack.position.set(0, 1.18, 0.27);
  const legGeo = new THREE.CapsuleGeometry(0.09, 0.56, 3, 8);
  const legL = new THREE.Group(), legR = new THREE.Group();
  for (const [leg, x] of [[legL, -0.12], [legR, 0.12]]) {
    const m = new THREE.Mesh(legGeo, dark);
    m.position.y = -0.37;
    leg.add(m);
    leg.position.set(x, 0.74, 0);
    g.add(leg);
  }
  const armGeo = new THREE.CapsuleGeometry(0.07, 0.46, 3, 8);
  const armL = new THREE.Group(), armR = new THREE.Group();
  for (const [arm, x] of [[armL, -0.33], [armR, 0.33]]) {
    const m = new THREE.Mesh(armGeo, suit);
    m.position.y = -0.28;
    arm.add(m);
    arm.position.set(x, 1.4, 0);
    g.add(arm);
  }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.7, 8), new THREE.MeshBasicMaterial({ color: 0xfff1c9 }));
  flame.rotation.x = Math.PI;
  flame.position.set(0, 0.68, 0.27);
  flame.visible = false;
  g.add(torso, head, visor, pack, flame);
  let phase = 0;
  return {
    object3D: g,
    animate(state = {}, dt = 0) {
      const mode = state.mode || 'idle';
      const speed = state.speed || 0;
      const jet = state.jet01 || 0;
      phase += dt * (mode === 'walk' || mode === 'wade' ? 2.2 + speed * 1.5 : 1.2);
      const swing = mode === 'walk' || mode === 'wade' ? Math.min(0.75, 0.2 + speed * 0.09) : 0;
      const air = mode === 'jet' || mode === 'fall' ? 1 : 0;
      legL.rotation.x = Math.sin(phase) * swing + air * 0.25;
      legR.rotation.x = -Math.sin(phase) * swing - air * 0.1;
      armL.rotation.x = -Math.sin(phase) * swing * 0.8 - air * 0.5;
      armR.rotation.x = Math.sin(phase) * swing * 0.8 - air * 0.5;
      torso.position.y = 1.1 + (mode === 'idle' ? Math.sin(phase) * 0.008 : Math.abs(Math.sin(phase)) * 0.03 * (swing > 0 ? 1 : 0));
      head.rotation.x = -(state.lookPitch || 0) * 0.5;
      flame.visible = jet > 0.05;
      flame.scale.set(1, 0.4 + jet * (0.8 + 0.3 * Math.sin(phase * 9)), 1);
      const sit = mode === 'sit' ? 1 : 0;
      if (sit) { legL.rotation.x = legR.rotation.x = -1.3; armL.rotation.x = armR.rotation.x = -0.9; }
    },
  };
}

export function createShip() {
  const g = new THREE.Group();
  g.name = 'stub-ship';
  const hull = mat(0xe8dfcc), trim = mat(0xb5553c), glass = mat(0x39405e), metal = mat(0x77736b);
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), hull);
  body.scale.set(1.35, 1.0, 4.4);
  body.position.set(0, 1.75, 0);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), glass);
  canopy.scale.set(0.85, 0.7, 1.5);
  canopy.position.set(0, 2.35, -1.3);
  const wingGeo = new THREE.BoxGeometry(3.6, 0.16, 2.2);
  const wingL = new THREE.Mesh(wingGeo, trim), wingR = new THREE.Mesh(wingGeo, trim);
  wingL.position.set(-2.6, 1.6, 1.2); wingL.rotation.z = 0.12; wingL.rotation.y = -0.25;
  wingR.position.set(2.6, 1.6, 1.2); wingR.rotation.z = -0.12; wingR.rotation.y = 0.25;
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.5, 1.6), trim);
  fin.position.set(0, 2.9, 3.0); fin.rotation.x = -0.35;
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff1c9 }));
  glow.position.set(0, 1.75, 4.3);
  g.add(body, canopy, wingL, wingR, fin, glow);
  const gear = [];
  for (const [x, z] of [[0, -2.6], [-1.5, 1.6], [1.5, 1.6]]) {
    const leg = new THREE.Group();
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 8), metal);
    strut.position.y = -0.55;
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.12, 12), metal);
    pad.position.y = -1.04;
    leg.add(strut, pad);
    leg.position.set(x, 1.1, z);
    g.add(leg);
    gear.push(leg);
  }
  g.userData.seat = new THREE.Vector3(0, 2.75, -1.7);
  g.userData.hatch = new THREE.Vector3(-2.7, 0, -0.9);
  return {
    object3D: g,
    animate(state = {}, dt = 0) {
      const gear01 = state.gear01 == null ? 1 : state.gear01;
      for (const leg of gear) { leg.scale.y = Math.max(0.05, gear01); leg.visible = gear01 > 0.03; }
      const t = state.throttle01 || 0;
      glow.scale.setScalar(0.35 + t * 1.1 + (state.mode === 'pulse' ? 1.2 : 0));
      canopy.position.y = 2.35 + (state.canopy01 || 0) * 0.5;
    },
  };
}
