// A far spire or crystal stands on a broad foot, not on a tip. Run: node --test src/world/
//   The last fixes (the second blind player, Saturn's Ring-Shadow Twilight, quality 0 at half scale): dark spire shapes
//   seemed to hang in the sky above the horizon. They were the far forms of the kinds that have no trunk (spires,
//   crystals, frozen waves, kelp): one shared crown blob (florakit.js farTreeGeometry) that the prop shader set down on
//   its lowest point, so each stood on a tip, widest halfway up, a spindle; far off, where the tip was lost in the haze,
//   the mass hung over the land line with sky under it. The shader now presses the blob's lower half into a broad foot
//   (materials.js PROP_VERT, PC_FAR: the widest girth about a quarter of the way up, the top where it was); a hanging kind
//   (vines) keeps its fall, a tree with a trunk is drawn as before.
//   The shader cannot run in Node: its lines are read as text and mirrored here, and the mirror is run on the real far
//   form.
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

const { farTreeGeometry } = await import('./florakit.js');
const SRC = fs.readFileSync(path.resolve(here, '../render/materials.js'), 'utf8');
const mix = (a, b, t) => a + (b - a) * t;

// PROP_VERT under PC_FAR, mirrored: one vertex of the unit far form for a species (taper, trunk 0/1, drop 0/1)
function farVertex(p, uvy, part, sp) {
  const crown = part >= 0.5 ? 1 : 0;
  let x = p[0] * (1 - sp.taper * uvy * crown), y = p[1], z = p[2] * (1 - sp.taper * uvy * crown);
  const foot = crown * (1 - sp.trunk) * (1 - sp.drop);
  const yb = y < 0.66 ? 0.66 - (0.66 - y) * 0.3 : y;
  const r = [x * 1.5, mix((y - 0.30) * 1.45, (yb - 0.566) * 2.23, foot), z * 1.5];
  const k = mix(sp.trunk, 1, crown), w = crown * (1 - sp.trunk);
  x = mix(x * k, r[0], w); y = mix(y * k, r[1], w); z = mix(z * k, r[2], w);
  y -= sp.drop * 0.97;
  return [x, y, z];
}
function form(sp) {
  const g = farTreeGeometry(5), P = g.getAttribute('position'), U = g.getAttribute('uv'), D = g.getAttribute('aData');
  const out = [];
  for (let i = 0; i < P.count; i++) {
    const v = farVertex([P.getX(i), P.getY(i), P.getZ(i)], U.getY(i), D.getY(i), sp);
    if (sp.trunk || D.getY(i) >= 0.5) out.push(v);       // (a trunkless kind's trunk is folded to its root: nothing drawn)
  }
  return out;
}
// the height fraction at which the form is widest, its lowest and highest point
function shape(vs) {
  let lo = Infinity, hi = -Infinity, wide = 0, at = 0;
  for (const [x, y, z] of vs) { lo = Math.min(lo, y); hi = Math.max(hi, y); }
  for (const [x, y, z] of vs) { const r = Math.hypot(x, z); if (r > wide) { wide = r; at = (y - lo) / (hi - lo); } }
  // the girth near the ground: the widest within the lowest eighth
  let foot = 0;
  for (const [x, y, z] of vs) if (y - lo < (hi - lo) / 8) foot = Math.max(foot, Math.hypot(x, z));
  return { lo, hi, wide, at, foot: foot / wide };
}

test('the shader presses a trunkless far form into a broad foot (its lines, mirrored here)', () => {
  const r = spawnSync(process.execPath, ['--check', path.resolve(here, '../render/materials.js')], { encoding: 'utf8' });
  assert.equal(r.status, 0, 'materials.js parses: ' + r.stderr);
  for (const s of [
    'lp.xz *= 1.0 - uFarTaper[fsi] * uv.y * crown;',
    'float foot = crown * (1.0 - uFarTrunk[fsi]) * (1.0 - uFarDrop[fsi]);',
    'float yb = lp.y < 0.66 ? 0.66 - (0.66 - lp.y) * 0.3 : lp.y;',
    'vec3 rockP = mix(vec3(lp.x * 1.5, (lp.y - 0.30) * 1.45, lp.z * 1.5), vec3(lp.x * 1.5, (yb - 0.566) * 2.23, lp.z * 1.5), foot);',
    'lp = mix(lp * mix(uFarTrunk[fsi], 1.0, crown), rockP, crown * (1.0 - uFarTrunk[fsi]));',
    'lp.y -= uFarDrop[fsi] * 0.97;',
  ]) assert.ok(SRC.includes(s), 'PROP_VERT: ' + s);
});

test('a far spire or crystal stands on the ground on a broad foot; a tree and a vine are as before', () => {
  for (const taper of [0.85, 0.9, 0.5, 0.12]) {
    const s = shape(form({ taper, trunk: 0, drop: 0 }));
    // it stands on the ground (the blob's lumps may sink a little into it) and is as tall as it was
    assert.ok(s.lo > -0.12 && s.lo < 0.02, `taper ${taper}: its foot is on the ground (${s.lo.toFixed(3)})`);
    assert.ok(s.hi > 0.88 && s.hi < 1.1, `taper ${taper}: as tall as before (${s.hi.toFixed(3)})`);
    // widest low down, not halfway up, and broad near the ground, not a tip
    assert.ok(s.at < 0.36, `taper ${taper}: widest ${(s.at * 100).toFixed(0)} % of the way up`);
    assert.ok(s.foot > 0.74, `taper ${taper}: the girth near the ground ${(s.foot * 100).toFixed(0)} % of the widest`);
  }
  // a broadleaf or a conifer (with a trunk) and a vine (hanging) are drawn exactly as before the change
  const before = (p, uvy, part, sp) => {
    const crown = part >= 0.5 ? 1 : 0;
    let x = p[0] * (1 - sp.taper * uvy * crown), y = p[1], z = p[2] * (1 - sp.taper * uvy * crown);
    const k = mix(sp.trunk, 1, crown), w = crown * (1 - sp.trunk);
    return [mix(x * k, x * 1.5, w), mix(y * k, (y - 0.30) * 1.45, w) - sp.drop * 0.97, mix(z * k, z * 1.5, w)];
  };
  const g = farTreeGeometry(5), P = g.getAttribute('position'), U = g.getAttribute('uv'), D = g.getAttribute('aData');
  for (const sp of [{ taper: 0, trunk: 1, drop: 0 }, { taper: 0.8, trunk: 1, drop: 0 }, { taper: 0.25, trunk: 0, drop: 1 }]) {
    for (let i = 0; i < P.count; i++) {
      const p = [P.getX(i), P.getY(i), P.getZ(i)];
      const a = farVertex(p, U.getY(i), D.getY(i), sp), b = before(p, U.getY(i), D.getY(i), sp);
      for (let c = 0; c < 3; c++) assert.ok(Math.abs(a[c] - b[c]) < 1e-9, JSON.stringify(sp) + ' unchanged');
    }
  }
  // on the commit before, a trunkless far form stood on a sliver of a foot, its lowest point clear of the ground
  const old = [];
  for (let i = 0; i < P.count; i++) if (D.getY(i) >= 0.5) old.push(before([P.getX(i), P.getY(i), P.getZ(i)], U.getY(i), D.getY(i), { taper: 0.85, trunk: 0, drop: 0 }));
  const so = shape(old);
  assert.ok(so.lo > 0.04 && so.foot < 0.7, `the old form: its lowest point ${so.lo.toFixed(3)} of its height over the ground, foot ${(so.foot * 100).toFixed(0)} %`);
});
