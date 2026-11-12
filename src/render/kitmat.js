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
import { G } from './shared.js';
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
  // (a glaze: see GLAZE below; `ga` is how much of the stroke's wash is laid over what is behind it)
  // (PAINTER 13: each stroke its own length, tapering to its tail and broken where the brush skipped: in Neptune's gale every
  // stroke lay level, one length, one weight, and the storm sky carried rows of ruled dashes. `rh` is the drop's own number:
  // the world draws rain with vary 0.35, so vPcData.x is 0.65..1 and stays with the drop)
  rain: 'float tpr = abs(vPcUv.x - 0.5) * 2.0; float rh = clamp((1.0 - vPcData.x) / 0.35, 0.0, 1.0); float rl = 0.38 + 0.62 * fract(rh * 7.31 + 0.13); if (tpr > 1.0 || vPcUv.y > rl || length(vView) < 3.2) discard; float yy = vPcUv.y / rl; float brk = smoothstep(0.28, 0.60, texture(uNoise3D, vec3(yy * 1.7 + rh * 13.0, rh * 5.3 + 0.21, 0.37)).r); vec3 c = ink * (0.95 + 0.05 * rh); float w = 0.95; float ga = (1.0 - smoothstep(0.25, 1.0, tpr)) * (1.0 - smoothstep(0.30, 1.0, yy)) * smoothstep(0.0, 0.12, yy) * mix(0.35, 1.0, brk) * 0.70;',
  streak: 'float tpr = abs(vPcUv.x - 0.5) * 2.0; if (tpr > 1.0 - 0.8 * vPcUv.y) discard; vec3 c = ink * vPcData.x; float w = 0.55;',
  dab: 'if (length(vPcUv - 0.5) > 0.5) discard; vec3 c = ink * vPcData.x; float w = 0.35;',
  // a flake: a speck of bare paper with a ragged edge (drawn out along its motion by the kit)
  flake: 'float rr = length((vPcUv - 0.5) * vec2(1.0, 1.25)) * 2.0; if (rr > 0.42 + 0.75 * texture(uNoise3D, vec3(vPcUv * 1.7, vPcData.x * 7.0)).r) discard; vec3 c = ink; float w = 0.05;',
  // (PAINTER 12, PHYSICS P20: where there is no air a kicked grain flies alone on its arc and falls: a small crisp touch of
  // the ground's own dust, not a soft puff; the fan keeps its shape)
  // dust: a ragged dry-brush patch thinning toward its edge; the pattern travels with the puff
  // (a glaze, like the rain: a soft veil of the ground's own dust, densest at its middle, running
  // out to nothing, broken softly where the brush was dry; never a hard pale blot)
  puff: 'float rr = length(vPcUv - 0.5) * 2.0; if (rr > 1.0 || length(vView) < 1.6) discard; float nz = 0.62 * texture(uNoise3D, vec3(vPcUv * 1.3, vPcData.x * 5.0)).r + 0.38 * texture(uNoise3D, vec3(vPcUv * vec2(3.0, 7.0), vPcData.x * 9.0)).g; vec3 c = mix(uHaze * 0.97, pcDensity(ink, 1.25), 0.42 + 0.10 * vPcData.x); float w = 0.95; float ga = (1.0 - smoothstep(0.10, 1.0, rr)) * smoothstep(0.22, 0.70, nz + 0.30 * (1.0 - rr)) * 0.52 * smoothstep(1.6, 3.6, length(vView)); if (uAirless > 0.5) { if (rr > 0.30) discard; c = pcDensity(ink, 1.30 + 0.25 * vPcData.x); ga = 0.88 * (1.0 - smoothstep(0.16, 0.30, rr + (nz - 0.5) * 0.12)); }',
  // a veil of dust (or of blown snow, or sand) as PHYSICS hands it over: vPcData.y its opacity,
  // .z how soft its ends are, .w 1 a long level streamer, 0 a round puff. A streamer is laid in
  // one level drag of a soft brush: densest just above its foot, thinning to nothing at its top
  // and toward its ends (which come down), broken along its length where the brush ran dry (the
  // breaks travel with the veil). Its wash is the ground's own dust thinned with the air, and a
  // streamer is lifted toward the paper: a pale skim snaking over the ground, never a blot.
  veil: 'vec2 p = (vPcUv - 0.5) * 2.0; if (length(vView) < 1.6) discard; float soft = clamp(vPcData.z, 0.08, 1.0), strm = clamp(vPcData.w, 0.0, 1.0);'
    + ' float ends = 1.0 - smoothstep(1.0 - max(soft, 0.8), 1.0, abs(p.x)); float up = (p.y + 1.0) * 0.5 / (0.3 + 0.7 * (1.0 - p.x * p.x));'
    + ' float prof = smoothstep(0.0, 0.12 + 0.2 * soft, up) * exp(-2.6 * up) * (1.0 - smoothstep(0.75, 1.0, up));'
    + ' float nz = 0.6 * texture(uNoise3D, vec3(vPcUv.x * 1.1 + vPcData.x * 3.7, vPcUv.y * 2.6, vPcData.x * 5.0)).r + 0.4 * texture(uNoise3D, vec3(vPcUv.x * 3.1, vPcUv.y * 8.0, vPcData.x * 9.0)).g;'
    + ' float ga = mix((1.0 - smoothstep(1.0 - soft, 1.0, length(p))) * 0.85, ends * prof * 2.0, strm) * (0.50 + 0.50 * smoothstep(0.22, 0.72, nz)) * clamp(vPcData.y * 2.6, 0.0, 1.0) * smoothstep(1.6, 3.6, length(vView)); ga = min(ga, 0.86);'
    // (seen in the game: a veil in the dust's own middle tone is lost against the hazy dune behind it. A veil
    // is the paper coming through: it is lifted toward the paper AFTER the air has been laid over it, so that
    // veils stand pale at every depth; less so after dark)
    + ' vec3 c = mix(uHaze * 0.97, pcDensity(ink, 1.25), 0.42 + 0.10 * fract(vPcData.x * 7.0)); float w = 0.95; float lift = (0.42 + 0.26 * strm) * (0.35 + 0.65 * uDayness);'
    // (PAINTER 13: where there is no air the kicked dust is grains, not a veil: the dust kind is drawn with this shape (the
    // painter's draw table makes it a veil), so PAINTER 12's grains in the puff never showed and a run on the Moon put up a
    // soft white puff of smoke at the boot. Each particle is one small crisp touch of the ground's own dust, darker than the
    // paper and not lifted toward it: a fan of grains that keeps its shape on its arcs and falls)
    // (a grain is a fleck two or three pixels across at the middle of its quad wherever it is, measured in pixels along each
    // side of the quad: a grain a quarter of the half-metre quad wide was a soft grey blot 40 px across as it flew past the
    // lens, and one drawn out by the quad's exposure was a thin pale scratch; laid a little darker than its ground)
    + ' if (uAirless > 0.5) { float gpx = length(vec2(p.x / max(fwidth(p.x), 1e-4), p.y / max(fwidth(p.y), 1e-4))); if (gpx > 1.9 || length(p) > 1.0) discard; c = pcDensity(ink, 1.65 + 0.25 * fract(vPcData.x * 7.0)); ga = 0.92 * (1.0 - smoothstep(1.0, 1.9, gpx + (nz - 0.5) * 0.4)) * clamp(vPcData.y * 3.0, 0.0, 1.0); lift = 0.0; }',
  // blown sand: a drag of the dune's own wash lifted toward the paper (a pale skim, heavier than
  // it was: scattered specks did not read), thinning to its tail
  // (PAINTER 13: with no air there is no skim: a kicked grain there is a fleck of the ground's own dust at the head of its
  // stroke, a little darker than its ground; the pale drags ran from the Moon walker's boots as thin white scratches)
  sandStreak: 'float tpr = abs(vPcUv.x - 0.5) * 2.0; if (tpr > 1.0 || length(vView) < 1.6) discard; vec3 c = mix(vec3(0.985, 0.972, 0.95), mix(uHaze, ink, 0.55), 0.58); float w = 0.9; float ga = (1.0 - tpr * tpr) * (1.0 - 0.8 * vPcUv.y) * smoothstep(0.0, 0.08, vPcUv.y) * 0.66 * smoothstep(1.6, 3.6, length(vView));'
    + ' if (uAirless > 0.5) { float gpx = length(vec2((vPcUv.x - 0.5) / max(fwidth(vPcUv.x), 1e-4), (vPcUv.y - 0.12) / max(fwidth(vPcUv.y), 1e-4))); if (gpx > 1.9) discard; c = pcDensity(ink, 1.65); ga = 0.9 * (1.0 - smoothstep(1.0, 1.9, gpx)) * smoothstep(1.6, 3.6, length(vView)); }',
  // (PAINTER 12, PHYSICS P20: and thinner as it comes to the lens, gone at 1.6 m: drops crossing near the eye in Neptune's
  // gale were large soft white blots over the picture)
  // spume and surf spray: a soft pale blot broken where the brush lifted (the drops off one crest run together
  // into a wisp of lifted paper; a fleck of 4 px was a glitter; the rain is a long grey stroke), laid after the brush
  spume: 'vec2 sp = (vPcUv - 0.5) * 2.0; float rr = length(sp * vec2(1.0, 1.3)); if (rr > 1.0 || length(vView) < 1.6) discard; float nz = texture(uNoise3D, vec3(vPcUv * 1.6, vPcData.x * 7.0)).r * 0.7 + texture(uNoise3D, vec3(vPcUv * 4.1, vPcData.x * 3.0)).g * 0.3; vec3 c = mix(ink, vec3(0.995, 0.995, 0.985), 0.86); float w = 0.08; float ga = (1.0 - smoothstep(0.10, 1.0, rr)) * smoothstep(0.30, 0.62, nz + 0.30 * (1.0 - rr)) * 0.46 * smoothstep(1.6, 7.0, length(vView));',
  // a leaf in the wind: a lens with pointed ends on the thin quad the kit lays (a line when it is
  // edge-on); laid as a glaze after the brush pass, so a mark two pixels wide is not brushed away
  // (two tones: half the leaves dark, to be seen against the sky and the meadow, half pale ochre, against the
  // wood; a leaf that turns over shows the other: it flickers as it tumbles)
  leaf: 'vec2 lp = (vPcUv - 0.5) * 2.0; float ga = (1.0 - smoothstep(0.7, 1.0, abs(lp.y) / max(1e-3, 1.0 - lp.x * lp.x))) * 0.94; if (ga < 0.02 || length(vView) < 1.2) discard; float lt = abs(step(0.5, fract(vPcData.x * 7.31)) - (gl_FrontFacing ? 0.0 : 1.0)); vec3 c = mix(pcDensity(ink, 1.5 + 0.4 * vPcData.x), mix(ink, vec3(0.97, 0.86, 0.52), 0.6), lt); float w = 0.4;',
  // a splash ring: a broken circle of paper, a little wider than the physics draws it so that
  // it is a mark and not a hairline
  // (a glaze: a soft pale arc of paper colour, broken where the brush lifted, never a white wire)
  // (PAINTER 12, PHYSICS P20: a faint glaze a step lighter than the water, softer and a third as strong: in PHYSICS' float
  // strips the rings in the rain were crisp white ellipses all over the sea)
  // ((P21) a flake settling (kind 2) and a hailstone's bounce (3) leave no ring)
  ring: 'if (vPcData.x > 1.5) discard; float cov = pcPhysRingCover(vPcUv, vPcData.z) * (0.4 + 0.6 * vPcData.y); float brk = texture(uNoise3D, vec3(vPcUv * 2.1, vPcData.w * 37.0)).r; float ga = smoothstep(0.0, 0.34, cov) * smoothstep(0.30, 0.58, brk) * 0.22; if (ga < 0.02) discard; vec3 c = vec3(0.96, 0.965, 0.95); float w = 0.0;',
  // a print: this ground, darker; a paler rim on loose ground; fading thins it through the
  // noise (fixed in the mark, so it never boils)
  mark: 'float scour = step(3.5, vPcData.z); float cover = pcPhysMarkCover(vPcUv, vPcData.z) * (1.0 - scour), rim = pcPhysMarkRim(vPcUv, vPcData.z) * step(1e-4, vPcData.y); float a = max(cover * clamp(vPcData.x * 12.0, 0.15, 0.9), rim * mix(0.6, 0.22, scour)) * min(1.0, vPcData.w * 3.0); a = min(a, 0.62); if (a < texture(uNoise3D, vec3(vPcUv * 1.7, vPcData.z * 0.37 + vPcData.x)).g) discard; vec3 c = mix(pcWetWash(ink, 1.0) * 0.66, mix(ink, vec3(1.0), 0.45), rim * (1.0 - cover)); float w = 0.2;',
};
function shapeOf(kind, info) {
  if (kind === 'rain') return SHAPES.rain;
  if (kind === 'snow') return SHAPES.flake;
  if (kind === 'dust' || kind === 'ash' || kind === 'sand') return info.veil ? SHAPES.veil : kind === 'sand' ? SHAPES.sandStreak : SHAPES.puff;
  if (kind === 'leaves') return SHAPES.leaf;
  if (kind === 'spray') return SHAPES.spume;
  return SHAPES[info.shape] || SHAPES.dab;
}
// region ids: prints belong to the ground (1); splash rings are 6 (kept crisp by the post
// pass); everything in the air is 7 (no graphite line is drawn round a raindrop or a puff)
// Kinds that are laid as a GLAZE: a transparent stroke over whatever is behind it (darker than
// a light sky, lighter than a dark wood), instead of an opaque mark. They are drawn after the
// abstraction pass, onto the brushed picture (shared.js GLAZES; the painter does it), testing
// their depth by hand against the scene's, so the post passes still see the thing behind them.
const GLAZE = { rain: 1, dust: 1, ash: 1, sand: 1, leaves: 1, spray: 1 };
function regionOf(kind, info) {
  if (kind === 'ring' || info.shape === 'ring') return 6.0;
  if (kind === 'mark' || info.shape === 'mark') return 1.0;
  return 7.0;
}

// makeKitMaterial(kind, info, { bodyUniforms, shapeGlsl }): PHYSICS' reference factory with the
// painter's shapes, inks and regions. `shapeGlsl` is PHYSICS' SHAPE_GLSL (ring and mark covers).
export function makeKitMaterial(kind, info, opts) {
  const glaze = !!GLAZE[kind] || kind === 'ring' || info.shape === 'ring';      // (a splash ring is a glaze too)
  const m = new THREE.ShaderMaterial({
    name: 'pc-kit-' + kind,
    uniforms: makePaintUniforms(opts.bodyUniforms || undefined, { uColor: { value: KIT_INK[kind] || KIT_INK.dust }, uPcInk: { value: KIT_PALETTE }, uSceneAux: G.uSceneAux, uSceneRes: G.uSceneRes, uAirless: G.uAirless, ...info.uniforms }),
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
uniform highp sampler2D uSceneAux;
uniform vec2 uSceneRes;
uniform float uAirless;
varying vec2 vPcUv; varying vec4 vPcData; varying vec3 vView; varying float vPcMat;
void main() {
  #include <logdepthbuf_fragment>
  // the ink: that of the ground the thing came from, where it came from the ground
  vec3 ink = vPcMat < 200.0 ? uPcInk[int(vPcMat + 0.5)] : uColor;
  ${shapeOf(kind, info)}
  c = pcAtmosV(pcTone(c, 2.0), pcFogAmount(length(vView)), vView);
  ${info.veil && (kind === 'dust' || kind === 'ash' || kind === 'sand') ? 'c = mix(c, vec3(0.985, 0.975, 0.955), lift);' : ''}
  ${glaze ? 'if (log2(1.0 + max(-vView.z, 0.0)) > pcAuxDec(texture(uSceneAux, gl_FragCoord.xy / uSceneRes)).z + 0.01) discard; gl_FragColor = vec4(clamp(c, 0.0, 1.0), ga);' : `pcWrite(c, w, vec3(0.0, 0.0, 1.0), -vView.z, ${regionOf(kind, info).toFixed(1)});`}
}`,
    side: THREE.DoubleSide, transparent: glaze, depthWrite: !glaze, depthTest: !glaze,
    polygonOffset: info.shape === 'mark' || info.shape === 'ring', polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  m.userData.pcPainted = true;
  m.userData.pcGlaze = glaze;
  return m;
}
