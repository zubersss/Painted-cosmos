// The 3D clouds (world/clouds.js), driven from Node without a browser. Run: node --test src/world/
// What is held: the oil look with ?clouds3d=1 lays cumulus over Earth's autumn wood at real heights over the land; their
// triangles stay inside the design's budget at the phone's picture (WEATHER-DESIGN 4.5: about 120k) from the ground and
// from a kilometre up; the same moment gives the same clouds to the last number; the field drifts with the wind on the
// painter's clock and holds still while that clock is held; a world without air gets none; the script's cost.
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const three = pathToFileURL(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../vendor/three/three.module.js')).href;
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier === 'three') return { url: '${three}', shortCircuit: true };
  return next(specifier, context);
}`), import.meta.url);
// (the look is chosen from the address, as in the page: this file runs in its own process under node --test)
globalThis.location = { search: '?look=oil&clouds3d=1' };

const THREE = await import('three');
const { createClouds, CLOUDS } = await import('./clouds.js');
const { makeSkyUniforms } = await import('./sky.js');
const { G, OIL } = await import('../render/shared.js');
const { getSurface, sampleSurfacePure } = await import('./surface.js');

const PHONE_RAD = 0.0031;      // radians a pixel on the S23 Ultra's picture (936 x 372, about 60 degrees up and down)
function station(biome, alt) {
  const S = getSurface('earth'), site = S.sites.find((s) => S.biomes[s.b].id === biome);
  const d = new THREE.Vector3(site.x, site.y, site.z).normalize();
  const g = sampleSurfacePure('earth', d.x, d.y, d.z).radius;
  return { d, g, cam: d.clone().multiplyScalar(g + alt) };
}
function rig(body = 'earth') {
  const root = new THREE.Group(); root.name = 'body-' + body;
  const skyU = makeSkyUniforms(); skyU.uCloud.value.y = 0.45;
  return { root, skyU, sun: new THREE.Vector3(0.3, 0.9, 0.3).normalize() };
}

test('fair cumulus over the autumn wood, at real heights over the land, inside the budget from the ground and from a kilometre', () => {
  OIL.uOilPx.value.x = PHONE_RAD;
  G.uTime.value = 30;
  for (const alt of [2, 150, 1000]) {
    const { root, skyU, sun } = rig();
    const { d, g, cam } = station('autumn_woodland', alt);
    const cl = createClouds(null);
    cl.update(0.016, cam, root, sun, null, skyU);
    const st = cl.stats;
    console.log(`  ${alt} m up: ${st.clouds} clouds, ${st.lobes} lobes, ${st.tris} triangles, by level ${cl.meshes.map((m) => m.n).join('/')}`);
    assert.ok(st.clouds > 10, 'clouds in a fair sky');
    assert.ok(st.tris < 160000, `triangles ${st.tris} inside the budget`);
    // every lobe stands over the land: its centre at least 150 m over the datum plus the land under the eye
    const anchor = cl.meshes[0].mesh.position, R = 4000;
    for (const M of cl.meshes) {
      const A = M.g.attributes.iA.array;
      for (let i = 0; i < M.n; i++) {
        const r = Math.hypot(anchor.x + A[i * 4], anchor.y + A[i * 4 + 1], anchor.z + A[i * 4 + 2]);
        assert.ok(r - R > 150, 'a lobe at ' + (r - R).toFixed(0) + ' m over the datum');
      }
    }
    // the sky's own shell is lifted to the altocumulus while these are drawn
    assert.equal(skyU.uCloud3D.value.x, 1);
    assert.ok(skyU.uCloud3D.value.y > g + 800);
    void d;
  }
});

test('the same moment gives the same clouds; the field drifts with the painter\'s clock and holds while it is held', () => {
  OIL.uOilPx.value.x = PHONE_RAD;
  const { cam } = station('autumn_woodland', 2);
  const runs = [];
  for (let n = 0; n < 2; n++) {
    G.uTime.value = 30;
    const { root, skyU, sun } = rig();
    const cl = createClouds(null);
    cl.update(0.016, cam, root, sun, null, skyU);
    runs.push(cl);
  }
  for (let li = 0; li < runs[0].meshes.length; li++) {
    const a = runs[0].meshes[li], b = runs[1].meshes[li];
    assert.equal(a.n, b.n);
    assert.deepEqual(Array.from(a.g.attributes.iA.array.subarray(0, a.n * 4)), Array.from(b.g.attributes.iA.array.subarray(0, b.n * 4)));
  }
  // held clock: no turn; running clock: a turn of the wind's speed (2.6 m/s with no wind map) over the time, about the centre
  const cl = runs[0], q0 = cl.group.quaternion.clone();
  cl.update(0.5, cam, cl.group.parent, new THREE.Vector3(0, 1, 0), null, makeSkyUniforms());
  assert.ok(cl.group.quaternion.angleTo(q0) < 1e-9, 'held clock, held clouds');
  G.uTime.value = 30.5;
  cl.update(0.5, cam, cl.group.parent, new THREE.Vector3(0, 1, 0), null, makeSkyUniforms());
  const moved = cl.group.quaternion.angleTo(q0) * 4000;
  assert.ok(Math.abs(moved - Math.hypot(2.5, 0.8) * 0.5) < 0.05, 'drifted ' + moved.toFixed(3) + ' m in half a second');
});

test('a world without air has no clouds', () => {
  G.uTime.value = 30;
  const { root, skyU, sun } = rig('moon');
  const cl = createClouds(null);
  const S = getSurface('moon'), s0 = S.sites[0];
  cl.update(0.016, new THREE.Vector3(s0.x, s0.y, s0.z).normalize().multiplyScalar(1800), root, sun, null, skyU);
  assert.equal(cl.group.visible, false);
  assert.equal(cl.stats.lobes, 0);
});

test('the script\'s cost: a rebuild (CLOUDS.rebuild apart) and a frame without one', () => {
  OIL.uOilPx.value.x = PHONE_RAD;
  G.uTime.value = 30;
  const { root, skyU, sun } = rig();
  const { cam } = station('autumn_woodland', 150);
  const cl = createClouds(null);
  cl.update(0.016, cam, root, sun, null, skyU);
  const keep = CLOUDS.rebuild, perS = 1 / keep;
  CLOUDS.rebuild = 0;
  for (let i = 0; i < 30; i++) cl.update(0.016, cam, root, sun, null, skyU);
  let tot = 0; for (let i = 0; i < 30; i++) { cl.update(0.016, cam, root, sun, null, skyU); tot += cl.stats.ms; }
  CLOUDS.rebuild = 1e9;
  const t0 = performance.now(); for (let i = 0; i < 300; i++) cl.update(0.016, cam, root, sun, null, skyU);
  const frame = (performance.now() - t0) / 300;
  CLOUDS.rebuild = keep;
  const reb = tot / 30;
  console.log(`  rebuild ${reb.toFixed(3)} ms (${perS} a second), a frame without one ${frame.toFixed(4)} ms (Node, this machine): ${(reb * perS / 30 + frame).toFixed(3)} ms a frame on average at 30 a second`);
  assert.ok(reb * perS / 30 + frame < 0.2, 'inside the lane\'s 0.2 ms of script here');
});
