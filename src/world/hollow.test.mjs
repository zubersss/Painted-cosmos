// A spire the eye is inside parts round it. Run: node --test src/world/
//   The last fixes (the second blind player, Neptune, quality 0 at half scale): hard-edged dark-blue polygons at the
//   corners of the frame, on the descent and on foot. They were Neptune's ice spires (17 to 27 m tall): on foot the
//   camera's boom passes into one (PILOT's crown rule keeps the lens out of crowns only in the air, and a spire has no
//   crown), the landing camera too, and from inside a spire the eye saw only the few faces turned toward it: ruled
//   triangles and slabs of cobalt over a corner of the picture. Now a spire's material carries its form (girth at the
//   foot, height, lean: uHollow), the vertex shader finds the eye in the spire's own frame, and a spire the eye is in, or
//   at the skin of, parts into a few broad ragged washes, none of it left once the eye is inside (materials.js
//   PC_HOLLOW). Nothing else is drawn differently: only spire materials carry the define.
//   The shader cannot run in Node. What is checked: the plumbing; the shader's formula, read as text and mirrored here;
//   and that the numbers fit the spire kit's real geometry (an eye on the spire's own centre line is inside its washes'
//   reach at every height, an eye well clear of it never is).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const three = pathToFileURL(path.resolve(here, '../../vendor/three/three.module.js')).href;
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier === 'three') return { url: '${three}', shortCircuit: true };
  return next(specifier, context);
}`), import.meta.url);

const THREE = await import('three');
const { makePropMaterial } = await import('../render/materials.js');
const { makeBodyUniforms } = await import('../render/shared.js');
const { Flora } = await import('./flora.js');
const { spireGeometry } = await import('./florakit.js');
const { LOOKS } = await import('../data/looks.js');

const SRC = fs.readFileSync(path.resolve(here, '../render/materials.js'), 'utf8');
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// the shader's formula (PROP_VERT, PC_HOLLOW), mirrored; el: the eye in the spire's own units
function hollowAt(el, u) {
  const hy = Math.min(1, Math.max(0, el.y / u[1]));
  const gr = u[0] * Math.max(1 - 0.7 * hy, 0.6);
  const rr = Math.hypot(el.x, el.z - hy * hy * u[1] * u[2]);
  return (1 - smooth(gr * 0.95, gr * 1.5 + 0.3, rr)) * (el.y >= -1 ? 1 : 0) * (1 - smooth(u[1] * 1.2, u[1] * 1.45, el.y));
}

test('the shader parts a spire round an eye inside it, by the formula mirrored here', () => {
  const r = spawnSync(process.execPath, ['--check', path.resolve(here, '../render/materials.js')], { encoding: 'utf8' });
  assert.equal(r.status, 0, 'materials.js parses: ' + r.stderr);
  for (const s of [
    'float hy = clamp(el.y / uHollow.y, 0.0, 1.0);',
    'float gr = uHollow.x * max(1.0 - 0.7 * hy, 0.6);',
    'float rr = length(vec2(el.x, el.z - hy * hy * uHollow.y * uHollow.z));',
    'vHollow = (1.0 - smoothstep(gr * 0.95, gr * 1.5 + 0.3, rr)) * step(-1.0, el.y) * (1.0 - smoothstep(uHollow.y * 1.2, uHollow.y * 1.45, el.y));',
  ]) assert.ok(SRC.includes(s), 'PROP_VERT: ' + s);
  // the eye in the instance's own frame: the instance matrix's columns carry its girth and height
  assert.ok(SRC.includes('vec3 el = vec3(dot(im[0].xyz, ce) / dot(im[0].xyz, im[0].xyz), dot(im[1].xyz, ce) / dot(im[1].xyz, im[1].xyz), dot(im[2].xyz, ce) / dot(im[2].xyz, im[2].xyz));'));
  // and the fragment discards by it, everything once it is past what the noise can reach (0.94)
  const disc = SRC.split('\n').find((l) => l.includes('vHollow > 0.001'));
  assert.ok(disc && /discard;/.test(disc), 'PROP_FRAG discards by vHollow');
  const k = disc.match(/\* ([0-9.]+) \+ texture\(uNoise3D, vBody \/ [0-9.]+\)\.b \* ([0-9.]+) \+ ([0-9.]+) < vHollow/);
  assert.ok(k, 'the discard line reads as expected');
  assert.ok(+k[1] + +k[2] + +k[3] < 0.95, 'an eye deep inside leaves nothing of the spire');
});

test('only spire materials carry it, on every world that has spires', () => {
  const bu = makeBodyUniforms();
  const plain = makePropMaterial(bu, { name: 'x' });
  assert.ok(!plain.defines.PC_HOLLOW && !plain.uniforms.uHollow, 'a prop material asks for nothing by default');
  const h = makePropMaterial(bu, { name: 'y', hollow: [1.3, 10.5, 0.3] });
  assert.equal(h.defines.PC_HOLLOW, 1);
  assert.deepEqual(h.uniforms.uHollow.value.toArray(), [1.3, 10.5, 0.3, 0]);
  let spires = 0;
  for (const id of Object.keys(LOOKS)) {
    const tall = (LOOKS[id].flora && LOOKS[id].flora.tall) || [];
    if (!tall.length) continue;
    const f = new Flora(id, new THREE.Group(), makeBodyUniforms());
    f._init();
    tall.forEach((sp, i) => {
      const m = f.species[i].mat;
      if (sp.kit === 'spire') {
        spires++;
        assert.equal(m.defines.PC_HOLLOW, 1, `${id} ${sp.kit}${i} parts round the eye`);
        assert.deepEqual(m.uniforms.uHollow.value.toArray().slice(0, 3), sp.slim ? [1.3, 10.5, 0.3] : [2.0, 12, 0], `${id} ${sp.kit}${i}`);
      } else assert.ok(!m.defines.PC_HOLLOW, `${id} ${sp.kit}${i} is drawn as before`);
    });
    if (f.mats.far) assert.ok(!f.mats.far.defines.PC_HOLLOW, `${id}: the far forms are drawn as before`);
  }
  assert.ok(spires >= 8, 'spires on Neptune, Uranus, Saturn, Jupiter, Mars, Venus, Pluto: ' + spires);
});

test("the numbers fit the spire kit's own geometry: an eye inside it parts it, an eye clear of it does not", () => {
  // Every spire variant (both kinds, the near form and the middle one, fifteen seeds), band by band of its height: the
  // main form's centre and girth (the main form is the kit's first blob, the most vertices: a buttress and the fallen
  // blocks at the foot are left out of the centre), and the eye put on that centre, halfway out to the skin, and clear of
  // everything in the band. The kit's spires vary (8 to 15 m, lean 0.22 to 0.38): the shader's one form per kind is a
  // fit, so what is asked is how it does over all of them.
  const q = (a, f) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(f * (s.length - 1))]; };
  for (const slim of [true, false]) {
    const u = slim ? [1.3, 10.5, 0.3] : [2.0, 12, 0];
    for (const lod of [0, 1]) {
      const centre = [], inner = [], clear = [];
      for (const seed of [11, 12, 13, 31, 32, 33, 41, 42, 43, 51, 52, 53, 61, 62, 63]) {
        const g = spireGeometry(seed, lod, slim ? { slim: 1 } : {});
        const p = g.getAttribute('position');
        const nMain = 60 * (lod ? 2 : 4) ** 2;            // three's icosahedron of detail 1 / 3: 240 / 960 vertices
        assert.ok(p.count >= nMain);
        let H = 0;
        for (let i = 0; i < p.count; i++) H = Math.max(H, p.getY(i));
        const NB = lod ? 6 : 10;
        for (let b = 0; b < NB - 1; b++) {
          const lo = H * b / NB, hi = H * (b + 1) / NB, xs = [], zs = [], ax = [], az = [];
          for (let i = 0; i < p.count; i++) {
            const y = p.getY(i);
            if (y < lo || y >= hi) continue;
            ax.push(p.getX(i)); az.push(p.getZ(i));
            if (i < nMain) { xs.push(p.getX(i)); zs.push(p.getZ(i)); }
          }
          if (xs.length < 6) continue;
          const cx = q(xs, 0.5), cz = q(zs, 0.5), y = (lo + hi) / 2;
          const girth = q(xs.map((x, i) => Math.hypot(x - cx, zs[i] - cz)), 0.5);
          const reach = Math.max(...ax.map((x, i) => Math.hypot(x - cx, az[i] - cz)));
          centre.push(hollowAt({ x: cx, y, z: cz }, u));
          for (let a = 0; a < 8; a++) {
            const c = Math.cos(a * Math.PI / 4), s = Math.sin(a * Math.PI / 4);
            inner.push(hollowAt({ x: cx + c * girth * 0.5, y, z: cz + s * girth * 0.5 }, u));
            if (hi <= H * 0.7) clear.push(hollowAt({ x: cx + c * (reach * 1.3 + 1.0), y, z: cz + s * (reach * 1.3 + 1.0) }, u));
          }
        }
        // above the tallest and below the foot it is whole
        assert.equal(hollowAt({ x: 0, y: u[1] * 1.5, z: u[1] * u[2] }, u), 0);
        assert.equal(hollowAt({ x: 0, y: -2, z: 0 }, u), 0);
      }
      const tag = `${slim ? 'slim' : 'stout'} spire, ${lod ? 'middle' : 'near'} form`;
      // on its centre line nothing of it is left (all but a few bands near the hooked tip of the tallest)
      assert.ok(q(centre, 0.05) > 0.9, `${tag}: an eye on its centre line parts it (5th percentile ${q(centre, 0.05).toFixed(2)})`);
      // halfway out to its skin: as good as gone, nearly always
      assert.ok(q(inner, 0.5) > 0.99 && q(inner, 0.05) > 0.6, `${tag}: an eye inside it parts it (median ${q(inner, 0.5).toFixed(2)}, 5th percentile ${q(inner, 0.05).toFixed(2)})`);
      // a step clear of everything at its height (the lower seven tenths, where the form is a column): whole, nearly always
      assert.ok(q(clear, 0.95) < 0.2, `${tag}: an eye clear of it leaves it whole (95th percentile ${q(clear, 0.95).toFixed(2)})`);
    }
  }
});
