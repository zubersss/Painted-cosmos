// Painted Cosmos: the painter's materials for PHYSICS' draw kits (rain, snow, dust, sand, ash,
// spores, leaves, spray, hail, splash rings, prints). OWNER: PAINTER.
// PHYSICS decides where every particle and mark is (src/physics/three/, one vertex chunk per
// kind giving pcKitPosition() and three varyings); how each is drawn is decided here.
//   rain    a few broad slanted strokes of the sky's own wet wash (they bleed in the post pass)
//   snow    flecks of bare paper with a ragged edge
//   dust, sand, ash   ragged dry-brush drifts in the ink of the ground they were raised from
//   prints, pads, scour   the ground's own wash laid darker, a paler rim on loose ground
//   rings   crisp broken circles (region 6: the post pass keeps its hands off them)
import * as THREE from 'three';
import { makePaintUniforms } from './materials.js';
import { VERT_PARS, VERT_END, FRAG_PARS } from './chunks.js';

// what a kind is drawn with when it did not come from the ground (updated by the world: rain
// takes the sky's wash, spray the liquid's)
export const KIT_INK = {
  rain: new THREE.Vector3(0.74, 0.79, 0.86), hail: new THREE.Vector3(0.94, 0.95, 0.96), spray: new THREE.Vector3(0.90, 0.93, 0.95),
  snow: new THREE.Vector3(0.985, 0.985, 0.98), dust: new THREE.Vector3(0.78, 0.66, 0.50), sand: new THREE.Vector3(0.84, 0.72, 0.52),
  ash: new THREE.Vector3(0.52, 0.50, 0.50), spores: new THREE.Vector3(0.78, 0.82, 0.50), leaves: new THREE.Vector3(0.80, 0.42, 0.24),
  ring: new THREE.Vector3(0.90, 0.93, 0.96), mark: new THREE.Vector3(0.56, 0.47, 0.40),
};
// the ink of each ground material (index = PHYSICS' MATERIAL_IDS), blended over the biomes
// under the camera by the world every frame
export const KIT_PALETTE = [];
for (let i = 0; i < 16; i++) KIT_PALETTE.push(new THREE.Vector3(0.72, 0.64, 0.52));

// The palette of one biome: 16 washes, by PHYSICS' material names. `pal` is the biome's
// prepared ground washes (surface.pal: low, mid, high), `liquid` its liquid colour if any.
const MATS = ['grass', 'soil', 'litter', 'mud', 'sand', 'dust', 'gravel', 'rock', 'snow', 'ice', 'ash', 'glass', 'crystal', 'moss', 'bed'];
const mx = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export function biomeInks(pal, liquid) {
  const earth = mx(pal.mid, pal.high, 0.45), stone = mx(pal.high, [0.78, 0.78, 0.82], 0.35), paper = [0.975, 0.98, 0.985];
  const of = {
    grass: pal.low, moss: mx(pal.low, pal.high, 0.3), soil: earth, litter: mx(pal.mid, pal.high, 0.25),
    mud: mx(earth, [0.34, 0.29, 0.28], 0.4), sand: mx(pal.mid, [1, 1, 1], 0.18), dust: mx(pal.mid, [1, 1, 1], 0.12),
    gravel: stone, rock: stone, glass: mx(stone, [0.40, 0.42, 0.52], 0.4), crystal: mx(stone, [1, 1, 1], 0.3),
    snow: paper, ice: mx(paper, [0.84, 0.90, 0.96], 0.5), ash: mx(earth, [0.50, 0.49, 0.50], 0.65),
    bed: liquid ? mx(liquid, [1, 1, 1], 0.45) : mx(earth, [0.34, 0.29, 0.28], 0.4),
  };
  const out = [];
  for (let i = 0; i < 16; i++) out.push(of[MATS[i]] || earth);
  return out;
}

// one line of GLSL a shape: cuts the hole (discard), sets vec3 c (the wash), float w (wetness)
// and float lv (light level for pcTone: 2 local colour)
const SHAPES = {
  // rain: a broad stroke, full at the head and thinning to its tail, laid wet
  // (nothing right in front of the lens: a drop a metre away would be a stick across the sheet)
  rain: 'float tpr = abs(vPcUv.x - 0.5) * 2.0; if (tpr > 1.0 - 0.6 * vPcUv.y * vPcUv.y || length(vView) < 3.2) discard; vec3 c = ink * (0.93 + 0.07 * vPcData.x); float w = 0.95;',
  streak: 'float tpr = abs(vPcUv.x - 0.5) * 2.0; if (tpr > 1.0 - 0.8 * vPcUv.y) discard; vec3 c = ink * vPcData.x; float w = 0.55;',
  dab: 'if (length(vPcUv - 0.5) > 0.5) discard; vec3 c = ink * vPcData.x; float w = 0.35;',
  // a flake: a speck of bare paper with a ragged edge (drawn out along its motion by the kit)
  flake: 'float rr = length((vPcUv - 0.5) * vec2(1.0, 1.25)) * 2.0; if (rr > 0.42 + 0.75 * texture(uNoise3D, vec3(vPcUv * 1.7, vPcData.x * 7.0)).r) discard; vec3 c = ink; float w = 0.05;',
  // dust: a ragged dry-brush patch thinning toward its edge; the pattern travels with the puff
  puff: 'float rr = length(vPcUv - 0.5) * 2.0; if (rr > 1.0) discard; float nz = 0.62 * texture(uNoise3D, vec3(vPcUv * 1.3, vPcData.x * 5.0)).r + 0.38 * texture(uNoise3D, vec3(vPcUv * vec2(3.0, 7.0), vPcData.x * 9.0)).g; if (nz < 0.40 + 0.6 * rr * rr) discard; vec3 c = mix(uHaze * 0.97, pcDensity(ink, 1.25), 0.42 + 0.10 * vPcData.x); float w = 0.95;',
  // a splash ring: a broken circle of paper, a little wider than the physics draws it so that
  // it is a mark and not a hairline
  ring: 'if (pcPhysRingCover(vPcUv, vPcData.z) * (0.4 + 0.6 * vPcData.y) < 0.12) discard; if (texture(uNoise3D, vec3(vPcUv * 2.1, vPcData.w * 37.0)).r < 0.36) discard; vec3 c = ink; float w = 0.0;',
  // a print: this ground, darker; a paler rim on loose ground; fading thins it through the
  // noise (fixed in the mark, so it never boils)
  mark: 'float scour = step(3.5, vPcData.z); float cover = pcPhysMarkCover(vPcUv, vPcData.z) * (1.0 - scour), rim = pcPhysMarkRim(vPcUv, vPcData.z) * step(1e-4, vPcData.y); float a = max(cover * clamp(vPcData.x * 12.0, 0.15, 0.9), rim * mix(0.6, 0.22, scour)) * min(1.0, vPcData.w * 3.0); a = min(a, 0.62); if (a < texture(uNoise3D, vec3(vPcUv * 1.7, vPcData.z * 0.37 + vPcData.x)).g) discard; vec3 c = mix(pcWetWash(ink, 1.0) * 0.66, mix(ink, vec3(1.0), 0.45), rim * (1.0 - cover)); float w = 0.2;',
};
function shapeOf(kind, info) {
  if (kind === 'rain') return SHAPES.rain;
  if (kind === 'snow') return SHAPES.flake;
  if (kind === 'dust' || kind === 'ash' || kind === 'sand') return kind === 'sand' ? SHAPES.streak : SHAPES.puff;
  return SHAPES[info.shape] || SHAPES.dab;
}
// region ids: prints belong to the ground (1); splash rings are 6 (kept crisp by the post
// pass); everything in the air is 7 (no graphite line is drawn round a raindrop or a puff)
function regionOf(kind, info) {
  if (kind === 'ring' || info.shape === 'ring') return 6.0;
  if (kind === 'mark' || info.shape === 'mark') return 1.0;
  return 7.0;
}

// makeKitMaterial(kind, info, { bodyUniforms, shapeGlsl }): PHYSICS' reference factory with the
// painter's shapes, inks and regions. `shapeGlsl` is PHYSICS' SHAPE_GLSL (ring and mark covers).
export function makeKitMaterial(kind, info, opts) {
  const m = new THREE.ShaderMaterial({
    name: 'pc-kit-' + kind,
    uniforms: makePaintUniforms(opts.bodyUniforms || undefined, { uColor: { value: KIT_INK[kind] || KIT_INK.dust }, uPcInk: { value: KIT_PALETTE }, ...info.uniforms }),
    vertexShader: `${VERT_PARS}
${info.vertexChunk}
varying vec3 vView;
void main() {
  vec4 mv = modelViewMatrix * vec4(pcKitPosition(), 1.0);
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
  ${VERT_END}
}`,
    fragmentShader: `${FRAG_PARS}
${opts.shapeGlsl || ''}
uniform vec3 uColor;
uniform vec3 uPcInk[16];
varying vec2 vPcUv; varying vec4 vPcData; varying vec3 vView; varying float vPcMat;
void main() {
  #include <logdepthbuf_fragment>
  // the ink: that of the ground the thing came from, where it came from the ground
  vec3 ink = vPcMat < 200.0 ? uPcInk[int(vPcMat + 0.5)] : uColor;
  ${shapeOf(kind, info)}
  c = pcAtmos(pcTone(c, 2.0), pcFogAmount(length(vView)));
  pcWrite(c, w, vec3(0.0, 0.0, 1.0), -vView.z, ${regionOf(kind, info).toFixed(1)});
}`,
    side: THREE.DoubleSide,
    polygonOffset: info.shape === 'mark' || info.shape === 'ring', polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  m.userData.pcPainted = true;
  return m;
}
