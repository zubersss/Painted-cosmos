// Painted Cosmos: WHAT A STORM LOOKS LIKE FROM AFAR -- its rain shafts and its lightning. OWNER: group D (the STORMS AND
// RAIN lane), painter side. docs/lead/WEATHER-DESIGN.md 6.2 C3 and C4. The oil look only, behind physics/wx2.js
// WX2.rainshaft and WX2.bolts; with both off nothing here is made.
//
// Until now a storm two kilometres off could not be seen at all (the sky drew one weather, the eye's), and lightning
// was the whole picture going white for a moment, with no bolt anywhere. The physics now knows every storm on the planet
// (physics/cloudfield.js: its cells, and the last flash of every storm cell within 4 km), and this draws two things of
// them:
//   RAIN SHAFTS  under every system raining 2 mm/h and more at its core, a curtain from the cloud's base down to the
//                ground: MANY THIN TAPERED VERTICAL STROKES, each fully painted where it lies, dense at the core and
//                ragged at the edges and at the foot, slanted downwind. The land behind shows BETWEEN the strokes,
//                never through a blur (the owner's first rule): this replaces the sky's soft drags of noise as the way
//                far rain is seen. Fewer, broader strokes far off, so a stroke is never thinner than a pixel and the
//                curtain never turns to grain.
//   BOLTS        a cloud-to-ground flash: a crisp jagged ribbon from the cloud's base to the ground, 2 to 4 pixels wide
//                whatever its distance, tapering, with one to three branches, every one of them from the flash's own
//                seed; white with a breath of violet; on for the physics' own return strokes (3 or 4 in a third of a
//                second) and off between them. No glow, no halo: the light of a flash on the land and the sky is the
//                look director's (post.js), and inside the cloud the clouds lane's.
//
// WHAT IT COSTS. One instanced draw for all the shafts (at most MAX_SHAFTS) and one small draw for the bolts (only while
// a flash is on). Derived for the phone from the v37 table (the ground's paint 24 to 34 ns a pixel; this shader is about
// a third of it, so about 10 ns): one storm's curtain 3 km away covers about a quarter of the picture's width and a
// tenth of its height, both walls of its cylinder drawn, about 5 % of 348,192 pixels: about 0.2 ms. Three in view:
// about 0.6 ms. The bolts are a few hundred pixels: nothing measurable. Nothing at all without a storm in view.
import * as THREE from 'three';
import { makePaintUniforms, bindBodyUniforms } from '../render/materials.js';
import { VERT_PARS, VERT_END, FRAG_PARS } from '../render/chunks.js';
import { register, G } from '../render/shared.js';
import { BODIES } from '../data/bodies.js';

const MAX_SHAFTS = 12;
const SEG = 14, ROWS = 4;               // the shaft's cylinder: segments round, rows up
const MAX_BOLTS = 4, BOLT_SEGS = 40;    // bolts drawn at once, and segments in one (its channel and its branches)
const SHAFT_RATE = 2;                   // mm/h at a system's core from which it has a shaft
const SHAFT_REACH = 7000;               // m: a shaft further off than this is not drawn
const BOLT_ON = 0.12;                   // a bolt is drawn while the flash is brighter than this

// ---- the shafts ---------------------------------------------------------------------------------------------
const SHAFT_VERT = /* glsl */`
${VERT_PARS}
attribute vec4 aShaft;     // xyz: the foot's middle FROM THE EYE (body axes, m); w: radius (m)
attribute vec4 aShaftU;    // xyz: up there (unit); w: height from the foot to the cloud's base (m)
attribute vec4 aShaftS;    // xyz: how far the TOP stands from the foot's line, upwind (m): the rain falls slanted; w: rate 0..1
varying vec3 vView;
varying vec2 vUv;          // x: round the curtain 0..1, y: up 0..1
varying float vRate;
varying float vSeed;
void main() {
  vec3 up = aShaftU.xyz;
  vec3 ax = normalize(cross(up, abs(up.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 bx = cross(up, ax);
  float ang = position.x * 6.2831853;
  float h = position.y;
  // a curtain hangs from the base and curls a little at its foot where the outflow pushes it (h^2: the slant grows down)
  vec3 p = aShaft.xyz + (ax * cos(ang) + bx * sin(ang)) * aShaft.w * (1.0 - 0.18 * h) + up * (h * aShaftU.w) + aShaftS.xyz * (h * h);
  vUv = vec2(position.x, h);
  vRate = aShaftS.w;
  vSeed = fract(aShaft.w * 0.0137 + aShaftU.w * 0.0071);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
  ${VERT_END}
}
`;

const SHAFT_FRAG = /* glsl */`
${FRAG_PARS}
varying vec3 vView;
varying vec2 vUv;
varying float vRate;
varying float vSeed;
float pcH1(float n) { return fract(sin(n * 12.9898 + vSeed * 78.233) * 43758.5453); }
void main() {
  #include <logdepthbuf_fragment>
  // THE STROKES. A curtain of columns round the shaft; how many depends on how big the shaft is on the screen, so that a
  // stroke is never thinner than about a pixel and a far curtain is fewer, broader strokes and not grain.
  float colsFull = 440.0;
  float px = max(fwidth(vUv.x * colsFull), 1e-4);                 // pixels per column at full count, inverted below
  float lod = clamp(exp2(floor(log2(max(px * 2.2, 1.0)))), 1.0, 32.0);
  float cols = colsFull / lod;
  float cx = vUv.x * cols, ci = floor(cx), f = cx - ci;
  float h1 = pcH1(ci), h2 = pcH1(ci + 31.7), h3 = pcH1(ci + 57.1);
  // which columns carry a stroke: more the harder it rains
  if (h1 > 0.30 + 0.62 * vRate) discard;
  // the stroke's own width in its column, and an edge one pixel wide
  float wid = 0.22 + 0.20 * h2;
  float fw = max(fwidth(cx), 1e-4);
  float onS = smoothstep(-fw, fw, wid * 0.5 - abs(f - 0.5));
  // along it: broken into long runs with gaps, its top where the base lets it go and a ragged foot
  float y = vUv.y;
  float run = fract(y * (1.2 + 1.8 * h3) + h2 * 3.0);
  float top = 1.0 - 0.10 * h3, foot = 0.04 + 0.22 * h2 * (1.0 - vRate);
  float along = step(foot, y) * step(y, top) * step(0.06 + 0.08 * h1, run);
  // tapered: thinner toward each end of the run
  float taper = smoothstep(0.0, 0.12, run) * smoothstep(0.0, 0.12, 1.0 - run);
  if (onS * along * mix(0.55, 1.0, taper) < 0.5) discard;
  // THE PAINT: the storm's own wet grey (the far air under a storm is the storm's wash: world/index.js), a step darker
  // than the air it falls through, each stroke its own shade
  // (a MIDDLE value, so a stroke reads pale against the dark land under it and a step darker against the bright sky behind
  //  its top: the rain kit's own rule, PAINTER 16, without reading the scene behind it)
  vec3 col = mix(uHaze, vec3(0.50, 0.52, 0.60), 0.65) * mix(0.82, 1.0, h3);
  vec3 c = pcAtmosV(col, pcFogAmount(length(vView)), vView);
  pcWrite(c, 1.0, normalize(-vView), -vView.z, 2.6);
}
`;

// ---- the bolts ----------------------------------------------------------------------------------------------
const BOLT_VERT = /* glsl */`
${VERT_PARS}
attribute vec3 aNext;      // the other end of this segment (from the eye, body axes)
attribute vec2 aSide;      // x: -1 or +1 across the segment, y: its width in pixels
attribute float aOn;       // 1 while this bolt's flash is on
uniform vec2 uSceneRes;
varying vec3 vView;
varying float vOn;
void main() {
  vec4 a = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vec4 b = projectionMatrix * modelViewMatrix * vec4(aNext, 1.0);
  vec2 sa = a.xy / max(a.w, 1e-4), sb = b.xy / max(b.w, 1e-4);
  vec2 dir = sb - sa;
  dir = length(dir) > 1e-6 ? normalize(dir * uSceneRes) : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x) / uSceneRes;          // one pixel across, in clip units over two
  a.xy += nrm * aSide.x * aSide.y * a.w;
  vView = (modelViewMatrix * vec4(position, 1.0)).xyz;
  vOn = aOn;
  gl_Position = a;
  ${VERT_END}
}
`;
const BOLT_FRAG = /* glsl */`
${FRAG_PARS}
varying vec3 vView;
varying float vOn;
void main() {
  #include <logdepthbuf_fragment>
  if (vOn < 0.5) discard;
  vec3 c = vec3(0.97, 0.95, 1.0);
  pcWrite(c, 1.0, normalize(-vView), -vView.z, 6.0);
}
`;

// a small seeded random walk: the bolt's channel and its branches, in the flash's own frame (up, a, b), metres
function boltShape(seed, height, pts) {
  let s = Math.floor(seed * 2147483646) + 1;
  const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  pts.length = 0;
  // the main channel: from the base (height) down to the ground point (0,0,0), wandering and pulled back to its foot
  const n = 16;
  let x = (rnd() - 0.5) * height * 0.25, z = (rnd() - 0.5) * height * 0.25;
  const main = [[x, height, z]];
  for (let i = 1; i <= n; i++) {
    const k = i / n, step = height / n;
    x += (rnd() - 0.5) * step * 1.1; z += (rnd() - 0.5) * step * 1.1;
    x *= 1 - k * 0.35; z *= 1 - k * 0.35;          // drawn back toward the point it strikes
    main.push(i === n ? [0, 0, 0] : [x, height * (1 - k), z]);
  }
  for (let i = 0; i < n; i++) pts.push([main[i], main[i + 1], 1.0]);
  // one to three branches off its upper half, going down and out, ending in the air
  const nb = 1 + Math.floor(rnd() * 2.999);
  for (let b = 0; b < nb && pts.length < BOLT_SEGS; b++) {
    const at = 2 + Math.floor(rnd() * (n * 0.5));
    let [bx, by, bz] = main[at];
    const ang = rnd() * Math.PI * 2, out = height * (0.05 + 0.05 * rnd());
    const m = 4 + Math.floor(rnd() * 4);
    for (let i = 0; i < m && pts.length < BOLT_SEGS; i++) {
      const nx = bx + Math.cos(ang) * out + (rnd() - 0.5) * out, ny = by - height / n * (0.8 + 0.6 * rnd()), nz = bz + Math.sin(ang) * out + (rnd() - 0.5) * out;
      pts.push([[bx, by, bz], [nx, ny, nz], 0.55 - 0.35 * i / m]);
      bx = nx; by = ny; bz = nz;
    }
  }
  return pts;
}

export function makeStorms(bodyUniforms, opts = {}) {
  const wantShafts = opts.shafts !== false, wantBolts = opts.bolts !== false;
  // the shaft: an open cylinder of SEG x ROWS quads; position.x round (0..1), position.y up (0..1)
  const sp = [], si = [];
  for (let r = 0; r <= ROWS; r++) for (let q = 0; q <= SEG; q++) sp.push(q / SEG, r / ROWS, 0);
  for (let r = 0; r < ROWS; r++) for (let q = 0; q < SEG; q++) {
    const a = r * (SEG + 1) + q, b = a + 1, c = a + SEG + 1, d = c + 1;
    si.push(a, b, c, b, d, c);
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  g.setIndex(si);
  const A = new Float32Array(MAX_SHAFTS * 4), AU = new Float32Array(MAX_SHAFTS * 4), AS = new Float32Array(MAX_SHAFTS * 4);
  const aShaft = new THREE.InstancedBufferAttribute(A, 4), aShaftU = new THREE.InstancedBufferAttribute(AU, 4), aShaftS = new THREE.InstancedBufferAttribute(AS, 4);
  for (const a of [aShaft, aShaftU, aShaftS]) a.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('aShaft', aShaft); g.setAttribute('aShaftU', aShaftU); g.setAttribute('aShaftS', aShaftS);
  g.instanceCount = 0;
  const smat = new THREE.ShaderMaterial({
    name: 'pc-storm-shaft', uniforms: makePaintUniforms(bodyUniforms, { uSceneAux: G.uSceneAux, uSceneRes: G.uSceneRes }),
    vertexShader: SHAFT_VERT, fragmentShader: SHAFT_FRAG, side: THREE.DoubleSide,
  });
  smat.userData.pcPainted = true;
  register(smat, 'glaze');
  const shafts = new THREE.Mesh(g, smat);
  shafts.name = 'pc-storm-shaft'; shafts.frustumCulled = false; shafts.matrixAutoUpdate = false; shafts.visible = false;

  // the bolts: MAX_BOLTS x BOLT_SEGS segments, each a quad of four vertices that the vertex shader widens on the screen
  const NV = MAX_BOLTS * BOLT_SEGS * 4;
  const bp = new Float32Array(NV * 3), bn = new Float32Array(NV * 3), bs = new Float32Array(NV * 2), bo = new Float32Array(NV);
  const bidx = [];
  for (let q = 0; q < MAX_BOLTS * BOLT_SEGS; q++) { const o = q * 4; bidx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
  const bg = new THREE.BufferGeometry();
  const aP = new THREE.BufferAttribute(bp, 3), aN = new THREE.BufferAttribute(bn, 3), aS = new THREE.BufferAttribute(bs, 2), aO = new THREE.BufferAttribute(bo, 1);
  for (const a of [aP, aN, aS, aO]) a.setUsage(THREE.DynamicDrawUsage);
  bg.setAttribute('position', aP); bg.setAttribute('aNext', aN); bg.setAttribute('aSide', aS); bg.setAttribute('aOn', aO);
  bg.setIndex(bidx);
  const bmat = new THREE.ShaderMaterial({
    name: 'pc-storm-bolt', uniforms: makePaintUniforms(bodyUniforms, { uSceneAux: G.uSceneAux, uSceneRes: G.uSceneRes }),
    vertexShader: BOLT_VERT, fragmentShader: BOLT_FRAG, side: THREE.DoubleSide,
  });
  bmat.userData.pcPainted = true;
  register(bmat, 'glaze');
  const bolts = new THREE.Mesh(bg, bmat);
  bolts.name = 'pc-storm-bolt'; bolts.frustumCulled = false; bolts.matrixAutoUpdate = false; bolts.visible = false;

  const _o = {}, shape = [], cache = new Map();
  let bound = bodyUniforms || null;
  const place = (mesh, cameraPos, root) => { mesh.position.copy(cameraPos); mesh.quaternion.copy(root.quaternion); mesh.updateMatrix(); mesh.matrixWorld.copy(mesh.matrix); mesh.matrixWorldNeedsUpdate = false; };

  return {
    shafts, bolts, objects: [shafts, bolts],
    // Every frame: the eye in the scene and in the body's axes (camL), the body's root and its uniforms, the physics.
    update(cameraPos, root, camL, bodyU, physics, bodyId) {
      const C = physics && physics.fields ? physics.fields.cloud : null;
      if (!C || !C.ready || !root || physics.here.bodyId !== bodyId) { shafts.visible = false; bolts.visible = false; return; }
      if (bodyU !== bound) { bindBodyUniforms(smat, bodyU); bindBodyUniforms(bmat, bodyU); bound = bodyU; }
      const R = Math.hypot(camL.x, camL.y, camL.z) || 1;
      const W = physics.fields.wind;
      // THE SHAFTS: the raining systems nearest the eye
      let n = 0;
      if (wantShafts) {
        const cells = C.cells, cand = [];
        for (let i = 0; i < cells.n; i++) {
          const c = cells[i];
          const rate = c.kind.rate * c.w * c.w;
          if (!(rate >= SHAFT_RATE)) continue;
          const px = c.x * R - camL.x, py = c.y * R - camL.y, pz = c.z * R - camL.z, d = Math.hypot(px, py, pz);
          if (d - c.r > SHAFT_REACH) continue;
          cand.push([d, i, rate]);
        }
        cand.sort((a, b) => a[0] - b[0]);
        for (const [d, i, rate] of cand) {
          if (n >= MAX_SHAFTS) break;
          const c = cells[i];
          C.at(c.x, c.y, c.z, _o);
          const ground = W && W.land && W.land.ready ? W.land.h[W.texel(c.x, c.y, c.z)] : 0;
          const base = Math.max(ground + 120, _o.base), h = base - ground;
          // the foot's middle, from the eye (the body's own radius: camL is body-local)
          const Rb = BODIES[bodyId].radius;
          const fx = c.x * (Rb + ground) - camL.x, fy = c.y * (Rb + ground) - camL.y, fz = c.z * (Rb + ground) - camL.z;
          // inside its own curtain the shaft is not drawn: the falling rain round the eye is the particles'
          if (Math.hypot(fx, fy, fz) < c.r * 0.6) continue;
          const o = n * 4;
          A[o] = fx; A[o + 1] = fy; A[o + 2] = fz; A[o + 3] = c.r * 0.72;
          AU[o] = c.x; AU[o + 1] = c.y; AU[o + 2] = c.z; AU[o + 3] = h;
          // slanted: the rain drifts downwind as it falls, so the top stands UPWIND of the foot (a third of the true drift,
          // at a fall of 6.5 m/s, and never more than a third of the height: painted, not plotted)
          let se = 0, sn = 0;
          if (W && W.ready) { W.at(c.x, c.y, c.z, _o); se = _o.e10; sn = _o.n10; }
          const U = Math.hypot(se, sn), slant = U > 0.1 ? Math.min(0.35 * h, U * h / 6.5 * 0.33) / U : 0;
          let ex = c.z, ez = -c.x; const el = Math.hypot(ex, ez) || 1; ex /= el; ez /= el;
          const nx = c.y * ez, ny = c.z * ex - c.x * ez, nz = -c.y * ex;
          AS[o] = -(se * ex + sn * nx) * slant; AS[o + 1] = -(sn * ny) * slant; AS[o + 2] = -(se * ez + sn * nz) * slant;
          AS[o + 3] = Math.min(1, rate / 25);
          n++;
        }
      }
      g.instanceCount = n; shafts.visible = n > 0;
      if (n) { aShaft.needsUpdate = true; aShaftU.needsUpdate = true; aShaftS.needsUpdate = true; place(shafts, cameraPos, root); }
      // THE BOLTS: the flashes on now, cloud to ground
      let nbv = 0;
      if (wantBolts) {
        const F = C.flashes;
        let nb = 0;
        for (let i = 0; i < F.n && nb < MAX_BOLTS; i++) {
          const f = F[i];
          if (f.kind !== 'cg' || !(f.flash01 > BOLT_ON) || f.age > 0.5) continue;
          const key = f.cell + ':' + f.t.toFixed(3);
          let pts = cache.get(key);
          const ground = W && W.land && W.land.ready ? W.land.h[W.texel(f.x, f.y, f.z)] : 0;
          const Rb = BODIES[bodyId].radius;
          const h = Math.max(150, f.base - ground);
          if (!pts) { pts = boltShape(f.seed, h, []).map((p) => p); cache.set(key, pts); if (cache.size > 16) cache.delete(cache.keys().next().value); }
          // the flash's own frame: up at the ground point, and two across
          const ux = f.x, uy = f.y, uz = f.z;
          const ax = Math.abs(uy) < 0.9 ? [uz, 0, -ux] : [1, 0, 0]; const al = Math.hypot(ax[0], ax[1], ax[2]); ax[0] /= al; ax[1] /= al; ax[2] /= al;
          const bx = [uy * ax[2] - uz * ax[1], uz * ax[0] - ux * ax[2], ux * ax[1] - uy * ax[0]];
          const gx = ux * (Rb + ground) - camL.x, gy = uy * (Rb + ground) - camL.y, gz = uz * (Rb + ground) - camL.z;
          const W3 = (p) => [gx + ax[0] * p[0] + ux * p[1] + bx[0] * p[2], gy + ax[1] * p[0] + uy * p[1] + bx[1] * p[2], gz + ax[2] * p[0] + uz * p[1] + bx[2] * p[2]];
          for (const [p0, p1, wk] of pts) {
            if (nbv >= NV) break;
            const a = W3(p0), b = W3(p1), wpx = (1.2 + 1.0 * wk) * (0.6 + 0.4 * Math.min(1, f.flash01 * 1.5));
            for (let v = 0; v < 4; v++) {
              const q = nbv + v, end = v >= 2 ? b : a, oth = v >= 2 ? a : b;
              bp[q * 3] = end[0]; bp[q * 3 + 1] = end[1]; bp[q * 3 + 2] = end[2];
              bn[q * 3] = oth[0]; bn[q * 3 + 1] = oth[1]; bn[q * 3 + 2] = oth[2];
              // (the far end's direction is reversed for the second pair, so the side flips with it: keep the quad flat)
              bs[q * 2] = (v & 1 ? 1 : -1) * (v >= 2 ? -1 : 1); bs[q * 2 + 1] = wpx;
              bo[q] = 1;
            }
            nbv += 4;
          }
          nb++;
        }
      }
      for (let q = nbv; q < NV; q++) bo[q] = 0;
      bolts.visible = nbv > 0;
      if (nbv) { aP.needsUpdate = true; aN.needsUpdate = true; aS.needsUpdate = true; aO.needsUpdate = true; bg.setDrawRange(0, (nbv / 4) * 6); place(bolts, cameraPos, root); }
    },
  };
}
