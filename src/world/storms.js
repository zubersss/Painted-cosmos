// Painted Cosmos: WHAT A STORM LOOKS LIKE FROM AFAR -- its rain shafts and its lightning. OWNER: group D (the STORMS AND
// RAIN lane), painter side. docs/lead/WEATHER-DESIGN.md 6.2 C3 and C4. The oil look only, behind physics/wx2.js
// WX2.rainshaft and WX2.bolts; with both off nothing here is made.
//
// Until now a storm two kilometres off could not be seen at all (the sky drew one weather, the eye's), and lightning
// was the whole picture going white for a moment, with no bolt anywhere. The physics now knows every storm on the planet
// (physics/cloudfield.js: its cells, and the last flash of every storm cell within 4 km), and this draws two things of
// them:
//   RAIN SHAFTS  under every system raining 2 mm/h and more at its core, two wide VEILS (the look director's
//                review, 24 Nov: the first version was a comb of thin white lines): broad sheets hung from the cloud's
//                base to the ground, slanted with the wind, each a flat VALUE STEP against what is behind it (a glaze,
//                laid as a multiply), with low-contrast strokes inside that merge into the step, thinning toward its
//                sides, its top and its foot in flat steps. Never a blur, never a fade (the owner's first rule).
//   BOLTS        a cloud-to-ground flash: a crisp jagged ribbon from the cloud's base to the ground, 2 to 4 pixels wide
//                whatever its distance, tapering, with one to three branches, every one of them from the flash's own
//                seed; white with a breath of violet; on for the physics' own return strokes (3 or 4 in a third of a
//                second) and off between them. No glow, no halo: the light of a flash on the land and the sky is the
//                look director's (post.js), and inside the cloud the clouds lane's.
//
// WHAT IT COSTS. One instanced draw for all the veils (at most MAX_SHAFTS storms x VEILS) and one small draw for the
// bolts (only while a flash is on). Derived for the phone from the v37 table (the ground's paint 24 to 34 ns a pixel;
// the veil's shader is a few hashes, a fog and a multiply: under a third of it, about 8 ns): a storm 1.5 km off hangs
// two or three veils of about 30 x 60 phone pixels where they show over the land, under 2 % of 348,192 pixels with
// their overlaps: about 0.05 ms; a storm at 1 km about 0.1 ms; a few in view about 0.2 ms. The bolts are a few
// hundred pixels: nothing measurable. Nothing at all without a storm in view.
import * as THREE from 'three';
import { makePaintUniforms, bindBodyUniforms } from '../render/materials.js';
import { VERT_PARS, VERT_END, FRAG_PARS } from '../render/chunks.js';
import { register, G } from '../render/shared.js';
import { BODIES } from '../data/bodies.js';
import { watchPrograms } from './wxguard.js';

const MAX_SHAFTS = 12;
const VEILS = 2;                        // veils hung under one storm (the look director: two wide beat four thin)
const MAX_BOLTS = 4, BOLT_SEGS = 40;    // bolts drawn at once, and segments in one (its channel and its branches)
const SHAFT_RATE = 2;                   // mm/h at a system's core from which it has a shaft
const SHAFT_REACH = 7000;               // m: a shaft further off than this is not drawn
const BOLT_ON = 0.12;                   // a bolt is drawn while the flash is brighter than this
const hs = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };

// ---- the shafts ----------------------------------------------------------------------------------------------
// (the look director's review of 24 Nov, LOOK-RULES R3/R4: what a painter lays under a distant storm is a FEW BROAD
//  VEILS, each a VALUE STEP against what is behind it -- a little darker than the sky, the hue of the storm's shade, and
//  over the land a glaze of that step -- with long parallel strokes inside at low contrast that merge into the step;
//  slanted with the wind, all strokes of a veil one slant; thinning toward its sides and its foot in two or three flat
//  steps, never a fade; stopped by the land in front of it. The first shafts were a comb of thin white lines.)
// HOW IT IS LAID: each veil is a flat sheet in the world, hung from the cloud's base to the ground at a place fixed in
// the storm, turned about the vertical to face the eye. It is drawn in the scene pass, after everything solid, as a
// MULTIPLY: the colour under it times (1 - its step) in the shade's hue; the second target (region, depth: chunks.js
// pcWrite's pcAux) times exactly 1, so the land and sky under it keep their own region and depth. Depth-tested, so the
// land in front cuts it and the ground under its foot ends it.
const SHAFT_VERT = /* glsl */`
${VERT_PARS}
attribute vec4 aVeil0;     // xyz: the veil's foot FROM THE EYE (body axes, m); w: its width (m)
attribute vec4 aVeil1;     // xyz: up there (unit); w: its height, foot to the cloud's base (m)
attribute vec4 aVeil2;     // xyz: where its top stands from the foot's line (upwind: the slant, m); w: its seed 0..1
attribute vec4 aVeil3;     // xyz: across it (unit, level, square to the eye); w: its step (0.06 .. 0.10)
varying vec3 vView;
varying vec2 vUv;          // x: across 0..1, y: up 0..1
varying vec2 vVeil;        // x: seed, y: step
void main() {
  vec3 p = aVeil0.xyz + aVeil3.xyz * (position.x * aVeil0.w) + aVeil1.xyz * (position.y * aVeil1.w) + aVeil2.xyz * position.y;
  vUv = vec2(position.x + 0.5, position.y);
  vVeil = vec2(aVeil2.w, aVeil3.w);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
  ${VERT_END}
}
`;

const SHAFT_FRAG = /* glsl */`
${FRAG_PARS}
uniform vec2 uSceneRes;
varying vec3 vView;
varying vec2 vUv;
varying vec2 vVeil;
float pcH1(float n) { return fract(sin(n * 12.9898 + vVeil.x * 78.233) * 43758.5453); }
void main() {
  #include <logdepthbuf_fragment>
  // THE STROKES: columns along the veil (its slant is the sheet's own), each the brush's width on the screen and never
  // under two pixels; laid in octaves of the distance so a far veil is fewer, wider strokes, and one under about three
  // strokes wide is one flat step (R4.5)
  float strokePx = max(2.0, 4.6 * uSceneRes.y / 720.0);
  float du = max(fwidth(vUv.x), 1e-6);
  float want = 1.0 / (du * strokePx);                       // strokes across the veil at the brush's width
  float cols = want >= 3.0 ? exp2(floor(log2(want))) : 1.0;
  float ci = floor(vUv.x * cols);
  float h1 = pcH1(ci), h2 = pcH1(ci + 31.7), h3 = pcH1(ci + 57.1);
  // ITS LEVEL: full in the middle, two flat steps toward each side, the steps' edges wandering stroke by stroke
  float side = abs((ci + 0.5) / cols - 0.5) * 2.0 + (h1 - 0.5) * (cols > 1.0 ? 0.30 : 0.0);
  float level = side < 0.50 ? 1.0 : side < 0.78 ? 0.66 : side < 1.0 ? 0.33 : 0.0;
  // and up it: each stroke leaves the cloud's base at its own height, a step thinner at first (the rain is still
  // gathering under the base: and until the clouds lane draws the base, a flat top would read as a wall), and thins
  // toward the foot in two flat steps
  // (the look director's second look: until the clouds lane hangs them from a drawn cloud base, the top comes in by
  //  the same two flat steps as the sides, its edges wandering stroke by stroke, never a ragged top in open air)
  float y = vUv.y, yt = y + (h1 - 0.5) * 0.08;
  if (yt > 0.74) level -= 0.34;
  if (yt > 0.88) level -= 0.33;
  if (y < 0.20 + 0.14 * h3) level -= 0.34;
  if (y < 0.07 + 0.08 * h2) level -= 0.33;
  if (level < 0.2) discard;
  // THE STEP: the veil's own, by its level, each stroke within 0.03 of it; the air in front takes it back toward nothing
  float st = vVeil.y * level + 0.03 * (h3 - 0.5) * 2.0 * step(2.0, cols);
  // (the air in front takes back part of it, as the far land keeps a quarter of its paint: a veil 3 km off still reads)
  st *= 1.0 - 0.6 * pcFogAmount(length(vView));
  // in the hue of the shade (the cool key), half of it: a glaze, not a paint
  vec3 sh = pcOilShadeC(); sh /= max(max(sh.r, sh.g), max(sh.b, 1e-3));
  vec3 k = (1.0 - clamp(st, 0.0, 0.5)) * mix(vec3(1.0), sh, 0.5 * clamp(st * 8.0, 0.0, 1.0));
  gl_FragColor = vec4(k, 1.0);
  pcAux = vec4(1.0);          // (times one: the region and the depth under the veil stay what they were)
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
  pcWrite(c, 1.0, normalize(-vView), -vView.z, 8.0);     // (region 8: a light of its own, kept out of the night key)
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
  // the veils: one flat quad each, instanced; position.x across (-0.5..0.5), position.y up (0..1)
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, -0.5, 1, 0, 0.5, 1, 0], 3));
  g.setIndex([0, 1, 2, 1, 3, 2]);
  const NVL = MAX_SHAFTS * VEILS;
  const V0 = new Float32Array(NVL * 4), V1 = new Float32Array(NVL * 4), V2 = new Float32Array(NVL * 4), V3 = new Float32Array(NVL * 4);
  const aV = [V0, V1, V2, V3].map((arr) => { const at = new THREE.InstancedBufferAttribute(arr, 4); at.setUsage(THREE.DynamicDrawUsage); return at; });
  aV.forEach((at, q) => g.setAttribute('aVeil' + q, at));
  g.instanceCount = 0;
  const smat = new THREE.ShaderMaterial({
    name: 'pc-storm-shaft', uniforms: makePaintUniforms(bodyUniforms, { uSceneRes: G.uSceneRes }),
    vertexShader: SHAFT_VERT, fragmentShader: SHAFT_FRAG, side: THREE.DoubleSide,
    // a multiply after everything solid: colour times the veil's step, the region and depth target times one
    transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor,
    blendEquationAlpha: THREE.AddEquation, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
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
  // (a program that does not compile on a device switches itself off, and the sky goes on without it: wxguard.js)
  watchPrograms(shafts, 'storm veils'); watchPrograms(bolts, 'storm bolts');

  const _o = {}, shape = [], cache = new Map();
  let bound = bodyUniforms || null;
  const place = (mesh, cameraPos, root) => { mesh.position.copy(cameraPos); mesh.quaternion.copy(root.quaternion); mesh.updateMatrix(); mesh.matrixWorld.copy(mesh.matrix); mesh.matrixWorldNeedsUpdate = false; };

  // (for the look director, who lays the flash's light on the land and the sky in the shared light, not as a blur:
  //  xyz the direction from the eye to the brightest flash on now, in the body's axes (as uSunDirL), w its strength
  //  0..1 here: its own brightness, as near as it is: 1 within 500 m, a quarter at 2.5 km. Zero between flashes.)
  const flash = new THREE.Vector4(0, 1, 0, 0);
  return {
    shafts, bolts, objects: [shafts, bolts], flash,
    // Every frame: the eye in the scene and in the body's axes (camL), the body's root and its uniforms, the physics.
    update(cameraPos, root, camL, bodyU, physics, bodyId) {
      const C = physics && physics.fields ? physics.fields.cloud : null;
      if (!C || !C.ready || !root || physics.here.bodyId !== bodyId) { shafts.visible = false; bolts.visible = false; flash.w = 0; return; }
      if (bodyU !== bound) { bindBodyUniforms(smat, bodyU); bindBodyUniforms(bmat, bodyU); bound = bodyU; }
      const R = Math.hypot(camL.x, camL.y, camL.z) || 1;
      const W = physics.fields.wind;
      // THE SHAFTS: under the raining systems nearest the eye, two or three veils each
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
        const Rb = BODIES[bodyId].radius;
        let used = 0;
        for (const [d, i, rate] of cand) {
          if (used >= MAX_SHAFTS) break;
          const c = cells[i];
          // inside its own curtain the veils are not hung: the falling rain round the eye is the particles'
          const g0 = W && W.land && W.land.ready ? W.land.h[W.texel(c.x, c.y, c.z)] : 0;
          if (Math.hypot(c.x * (Rb + g0) - camL.x, c.y * (Rb + g0) - camL.y, c.z * (Rb + g0) - camL.z) < c.r * 0.6) continue;
          used++;
          let ex = c.z, ez = -c.x; const el = Math.hypot(ex, ez) || 1; ex /= el; ez /= el;
          const nx = c.y * ez, ny = c.z * ex - c.x * ez, nz = -c.y * ex;
          const nv = VEILS;
          for (let k = 0; k < nv && n < NVL; k++) {
            // each veil has its own place in the storm, fixed there (it does not slide as the eye moves), and its width
            const hA = hs(c.i * 3 + k, c.gen), hR = hs(c.i * 3 + k + 0.5, c.gen + 7), hW = hs(c.i * 3 + k + 0.25, c.gen + 13);
            const ang = 6.2831853 * (hA + k / nv), rho = c.r * (0.10 + 0.40 * hR);
            let vx = c.x * Rb + (ex * Math.cos(ang) + nx * Math.sin(ang)) * rho, vy = c.y * Rb + ny * Math.sin(ang) * rho, vz = c.z * Rb + (ez * Math.cos(ang) + nz * Math.sin(ang)) * rho;
            const vl = Math.hypot(vx, vy, vz); vx /= vl; vy /= vl; vz /= vl;
            C.at(vx, vy, vz, _o);
            const ground = W && W.land && W.land.ready ? W.land.h[W.texel(vx, vy, vz)] : 0;
            const base = Math.max(ground + 120, _o.base), h = base - ground;
            const fx = vx * (Rb + ground) - camL.x, fy = vy * (Rb + ground) - camL.y, fz = vz * (Rb + ground) - camL.z;
            // across it: level and square to the line from the eye
            let ax = vy * fz - vz * fy, ay = vz * fx - vx * fz, az = vx * fy - vy * fx; const al = Math.hypot(ax, ay, az) || 1; ax /= al; ay /= al; az /= al;
            // slanted with the wind there: its top upwind of its foot, 10 to 25 degrees off the vertical
            let se = 0, sn = 0;
            if (W && W.ready) { W.at(vx, vy, vz, _o); se = _o.e10; sn = _o.n10; }
            const U = Math.hypot(se, sn);
            let ox = 0, oy = 0, oz = 0;
            if (U > 0.1) {
              const tl = Math.tan((10 + Math.min(15, 1.5 * U)) * Math.PI / 180) * h / U;
              let vex = vz, vez = -vx; const vel = Math.hypot(vex, vez) || 1; vex /= vel; vez /= vel;
              const vnx = vy * vez, vny = vz * vex - vx * vez, vnz = -vy * vex;
              ox = -(se * vex + sn * vnx) * tl; oy = -(sn * vny) * tl; oz = -(se * vez + sn * vnz) * tl;
            }
            const o = n * 4;
            V0[o] = fx; V0[o + 1] = fy; V0[o + 2] = fz; V0[o + 3] = c.r * (0.30 + 0.20 * hW);
            V1[o] = vx; V1[o + 1] = vy; V1[o + 2] = vz; V1[o + 3] = h;
            V2[o] = ox; V2[o + 1] = oy; V2[o + 2] = oz; V2[o + 3] = hs(c.i + k * 0.37, c.gen + 3);
            V3[o] = ax; V3[o + 1] = ay; V3[o + 2] = az; V3[o + 3] = 0.06 + 0.04 * Math.min(1, rate / 25);
            n++;
          }
        }
      }
      g.instanceCount = n; shafts.visible = n > 0 && !shafts.userData.pcGuardOff;
      if (n) { for (const at of aV) at.needsUpdate = true; place(shafts, cameraPos, root); }
      // THE FLASH'S LIGHT (every flash, cloud to ground or in the cloud): the brightest here
      flash.w = 0;
      {
        const F = C.flashes, Rb = BODIES[bodyId].radius;
        for (let i = 0; F && i < F.n; i++) {
          const f = F[i]; if (!(f.flash01 > 0)) continue;
          const hm = Rb + (f.base || 0) * 0.6;
          const dx = f.x * hm - camL.x, dy = f.y * hm - camL.y, dz = f.z * hm - camL.z, d = Math.hypot(dx, dy, dz) || 1;
          const k = f.flash01 / (1 + Math.max(0, d - 500) * Math.max(0, d - 500) / (1150 * 1150));
          if (k > flash.w) flash.set(dx / d, dy / d, dz / d, Math.min(1, k));
        }
      }
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
      bolts.visible = nbv > 0 && !bolts.userData.pcGuardOff;
      if (nbv) { aP.needsUpdate = true; aN.needsUpdate = true; aS.needsUpdate = true; aO.needsUpdate = true; bg.setDrawRange(0, (nbv / 4) * 6); place(bolts, cameraPos, root); }
    },
  };
}
