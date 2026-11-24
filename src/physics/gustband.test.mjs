// The gust bands seen from the air (group D, ?gustbands=1; flora.js GUSTBAND, flora.glsl.js pcGustBand): what the physics
// hands the shaders. Off: nothing. On, in a breeze: a direction along the wind with the strength as its length, and a
// run that grows with the wind and wraps at one period of the noise, so the bands never jump.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPhysics } from './index.js';
import { makeWorld, norm } from './testworld.mjs';
import { WX2 } from './wx2.js';
import { GUSTBAND } from './flora.js';
import { FLORA_GLSL } from './flora.glsl.js';

test('gust bands: off by default; on in a breeze, along the wind, running, wrapped at one period', () => {
  const sample = makeWorld({ R: 4000 });
  const u = norm({ x: 0.3, y: 0.2, z: 0.93 }), F = { x: u.x * 4001.7, y: u.y * 4001.7, z: u.z * 4001.7 };
  const was = WX2.gustbands;
  try {
    WX2.gustbands = false;
    let p = createPhysics({ sampleSurface: (b, d) => sample(d), timeBudget: false });
    for (let f = 0; f < 60; f++) p.update(1 / 30, { bodyId: 'earth', time: 500 + f / 30, focus: F, sunDir: null });
    assert.deepEqual(Array.from(p.fields.flora.uniforms.uPhysGust).slice(0, 3), [0, 0, 0]);
    WX2.gustbands = true;
    p = createPhysics({ sampleSurface: (b, d) => sample(d), timeBudget: false });
    let found = null;
    for (let t = 500; t < 20000 && !found; t += 900) {
      let prev = null, runs = 0, jumps = 0;
      for (let f = 0; f < 90; f++) {
        p.update(1 / 30, { bodyId: 'earth', time: t + f / 30, focus: F, sunDir: null });
        const g = p.fields.flora.uniforms.uPhysGust, s = Math.hypot(g[0], g[1], g[2]);
        if (s > 0.2) {
          if (prev != null) { const d = (g[3] - prev + GUSTBAND.along) % GUSTBAND.along; if (d > 0 && d < 1) runs++; else if (d !== 0) jumps++; }
          prev = g[3];
          assert.ok(g[3] >= 0 && g[3] < GUSTBAND.along, `the run ${g[3].toFixed(2)} m is wrapped at one period`);
          // along the surface (no part straight up)
          const up = Math.abs(g[0] * u.x + g[1] * u.y + g[2] * u.z) / s;
          assert.ok(up < 0.05, `the bands' direction lies along the ground (${up.toFixed(3)})`);
        }
      }
      if (runs > 30) found = { t, runs, jumps };
    }
    assert.ok(found, 'a breeze in which the bands ran');
    assert.equal(found.jumps, 0, 'the run never jumps');
    // the shader's function is there, and only where a material asks for it (and binds uPhysGust)
    assert.ok(/#ifdef PC_GUST[\s\S]*uniform vec4 uPhysGust;[\s\S]*float pcGustBand\(vec3 p\)[\s\S]*#endif/.test(FLORA_GLSL));
  } finally { WX2.gustbands = was; }
});
