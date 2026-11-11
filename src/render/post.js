// Painted Cosmos: the watercolor post passes. OWNER: PAINTER.
//
//   scene (MRT, internal res)      colour+wetness, normal+depth+region
//   -> prep (half res, mipmapped)  mean colour + mean luma^2, and wetness-premultiplied colour
//   -> abstraction (internal res)  brush-sized shapes (mip Kuwahara), wet-in-wet bleed
//   -> sheet (output res)          wobble, pigment pooling at wash edges, granulation in the
//                                  paper grain, graphite underdrawing, ragged border, paper
//
// Only paper effects live in screen space (grain, wobble, border). Everything that belongs to
// the painting (wash variation, strokes, light) is anchored in the world by the materials.
import * as THREE from 'three';
import { getTextures, G } from './shared.js';

const FS_VERT = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const BACKDROP_FRAG = /* glsl */`
layout(location = 1) out highp vec4 pcAux;
void main() {
  gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
  pcAux = vec4(0.0, 0.0, 20.0, 0.0);
}
`;

const PREP_FRAG = /* glsl */`
uniform sampler2D tScene;
uniform vec2 uTexel;
varying vec2 vUv;
layout(location = 1) out highp vec4 pcB;
void main() {
  vec4 a = texture(tScene, vUv + uTexel * vec2(-1.0, -1.0));
  vec4 b = texture(tScene, vUv + uTexel * vec2(1.0, -1.0));
  vec4 c = texture(tScene, vUv + uTexel * vec2(-1.0, 1.0));
  vec4 d = texture(tScene, vUv + uTexel * vec2(1.0, 1.0));
  vec3 W = vec3(0.3, 0.5, 0.2);
  float la = dot(a.rgb, W), lb = dot(b.rgb, W), lc = dot(c.rgb, W), ld = dot(d.rgb, W);
  gl_FragColor = vec4((a.rgb + b.rgb + c.rgb + d.rgb) * 0.25, (la * la + lb * lb + lc * lc + ld * ld) * 0.25);
  pcB = vec4(a.rgb * a.a + b.rgb * b.a + c.rgb * c.a + d.rgb * d.a, a.a + b.a + c.a + d.a) * 0.25;
}
`;

const ABS_FRAG = /* glsl */`
uniform sampler2D tScene;
uniform highp sampler2D tAux;
uniform highp sampler2D tHalfA;
uniform sampler2D tHalfB;
uniform sampler2D tPaper;
uniform vec2 uTexel;       // 1 / internal resolution
uniform vec2 uRes;         // internal resolution
uniform vec4 uBrush;       // near radius, far radius (fractions of height), bleed radius, bleed amount
uniform float uAbstraction;
varying vec2 vUv;
const vec3 W = vec3(0.3, 0.5, 0.2);
void main() {
  vec4 c0 = texture(tScene, vUv);
  vec4 aux = texture(tAux, vUv);
  float wet = c0.a;
  float cls = floor(aux.w + 0.001);
  // far things are fewer, larger, softer strokes; near things keep crisp accents
  float far = smoothstep(3.6, 8.2, aux.z);
  float r = mix(uBrush.x, uBrush.y, far) * uRes.y;     // brush radius in internal pixels
  float lod = max(0.0, log2(max(r, 1.0)) - 1.0);
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  float aspect = uRes.y / uRes.x;
  // a fixed-on-paper rotation breaks the regular 8-fold symmetry of the sectors
  float rot = texture(tPaper, vUv * vec2(1.0, aspect) * 2.3).b * 6.283;
  for (int k = 0; k < SECTORS; k++) {
    float a = rot + float(k) * (6.2831853 / float(SECTORS));
    vec2 off = vec2(cos(a), sin(a)) * r * 0.62 * uTexel;
    vec4 m = textureLod(tHalfA, vUv + off, lod);
    float l = dot(m.rgb, W);
    float var = max(0.0, m.a - l * l);
    float w = 1.0 / (0.00012 + var * var * 900.0 + var * 0.6);
    acc += m.rgb * w; wsum += w;
  }
  vec3 kuw = acc / wsum;
  // solid props (trunks, rocks, characters) keep more of their drawing
  float keep = (1.0 - far) * (cls == 3.0 || cls == 5.0 ? 0.72 : 0.30);
  keep = mix(1.0, keep, uAbstraction);
  vec3 col = mix(kuw, c0.rgb, keep);
  // wet-in-wet: wet areas take up the (wetness-weighted) colour around them, feathered
  vec2 feather = (texture(tPaper, vUv * vec2(1.0, aspect) * 5.1).ba - 0.5) * uBrush.z * 1.4;
  float blod = max(0.0, log2(max(uBrush.z * uRes.y, 1.0)) - 1.0);
  vec4 wb = textureLod(tHalfB, vUv + feather * vec2(aspect, 1.0), blod);
  vec3 bleed = wb.rgb / max(wb.a, 0.001);
  float bl = wet * wet * uBrush.w * smoothstep(0.02, 0.25, wb.a);
  col = mix(col, bleed, bl);
  gl_FragColor = vec4(col, wet);
}
`;

const SHEET_FRAG = /* glsl */`
uniform sampler2D tAbs;
uniform highp sampler2D tAux;
uniform highp sampler2D tHalfA;
uniform sampler2D tPaper;
uniform vec2 uOutRes;
uniform vec2 uInTexel;
uniform vec3 uPaperColor;
uniform vec3 uGrade;
uniform vec4 uPig;        // edge pooling, granulation, wobble px (at 1080p), graphite
uniform vec4 uBorder;     // width, raggedness, pooling, enabled
uniform vec2 uBoil;
uniform vec4 uWxSheet;    // weather: x value key (heavier pigment under a storm), y lightning flash
varying vec2 vUv;
const vec3 W = vec3(0.3, 0.5, 0.2);
void main() {
  float sc = max(uOutRes.y / 1080.0, 0.62);
  vec2 px = gl_FragCoord.xy;
  vec2 puv = px / (512.0 * sc);
  vec4 paper = texture(tPaper, puv, 0.55);
  vec4 plo = texture(tPaper, puv * 0.19 + 0.37);
  vec4 pmid = texture(tPaper, puv * 0.47 + 0.11 + uBoil);

  // the painter's hand: edges wobble with the paper, never ruler-straight
  vec2 wob = ((pmid.ba - 0.5) * 2.0 + (plo.ba - 0.5) * 1.2) * uPig.z * sc / uOutRes;
  vec2 uv = vUv + wob;
  vec4 c = texture(tAbs, uv);
  vec3 col = c.rgb;
  float wet = c.a;
  float lum = dot(col, W);

  // pigment pools just inside the border of each wash: wide (compare with the blurred
  // surround) plus a little right at the edge (local gradient)
  vec3 sur = textureLod(tHalfA, uv, 2.2).rgb;
  float pool = max(0.0, dot(sur, W) - lum);
  vec3 cx = texture(tAbs, uv + vec2(uInTexel.x, 0.0)).rgb - texture(tAbs, uv - vec2(uInTexel.x, 0.0)).rgb;
  vec3 cy = texture(tAbs, uv + vec2(0.0, uInTexel.y)).rgb - texture(tAbs, uv - vec2(0.0, uInTexel.y)).rgb;
  float grad = length(cx) + length(cy);
  float edge = pool * 3.2 + smoothstep(0.03, 0.45, grad) * 0.35;

  // granulation: pigment settles into the valleys of the paper, strongest in darks and wets
  float ph = paper.r;
  // fine pits show in light washes; dark passages keep only the broad settling
  float gran = ((0.52 - ph) * 0.36 * smoothstep(0.10, 0.42, lum) + (0.5 - pmid.r) * 0.85 + (0.5 - plo.r) * 0.35) * (0.22 + 0.85 * (1.0 - lum) * smoothstep(0.02, 0.30, lum)) * (0.55 + 0.8 * wet);
  gran *= 1.0 - 0.9 * uWxSheet.x;     // (heavy storm washes would turn the settling into pepper)
  float d = 1.0 + uPig.x * edge + uPig.y * gran + (plo.g - 0.5) * 0.10;
  // a storm shifts the whole key: every wash carries more pigment (richer, not greyer)
  d += uWxSheet.x * (0.75 + 0.5 * plo.r);

  // ragged unpainted border: the wash simply stops, and pools where it stops
  vec2 bd = min(vUv, 1.0 - vUv) * vec2(uOutRes.x / uOutRes.y, 1.0);
  float b = min(bd.x, bd.y);
  float corner = smoothstep(0.0, 0.08, bd.x) * smoothstep(0.0, 0.08, bd.y);
  float bn = b + (plo.g - 0.5) * uBorder.y + (pmid.g - 0.5) * uBorder.y * 0.45 + (paper.g - 0.5) * 0.006 - (1.0 - corner) * 0.012;
  float painted = mix(1.0, smoothstep(uBorder.x * 0.72, uBorder.x, bn), uBorder.w);
  float lip = (1.0 - smoothstep(uBorder.x, uBorder.x * 2.2, bn)) * painted * uBorder.w;
  d += lip * uBorder.z * (0.4 + 0.6 * plo.r);
  // dry edge: near the border the brush skips the paper's peaks
  float skip = (1.0 - smoothstep(uBorder.x * 0.9, uBorder.x * 1.6, bn)) * smoothstep(0.50, 0.62, ph) * uBorder.w;

  col = clamp(col - (col - col * col) * (d - 1.0), 0.0, 1.0);

  // graphite underdrawing on major silhouettes: faint, broken, catching the paper tooth
  vec2 guv = vUv + wob * 0.4 + vec2(1.4, -0.9) * sc / uOutRes;
  vec4 a0 = texture(tAux, guv);
  vec4 a1 = texture(tAux, guv + vec2(uInTexel.x * 1.5, 0.0));
  vec4 a2 = texture(tAux, guv + vec2(0.0, uInTexel.y * 1.5));
  float dz = max(abs(a1.z - a0.z), abs(a2.z - a0.z));
  float c0 = floor(a0.w), c1 = floor(a1.w), c2 = floor(a2.w);
  // region changes count only where a solid thing (prop, character) meets something else
  float solid = max(step(2.5, c0) * step(c0, 3.5) + step(4.5, c0), max(step(2.5, c1) * step(c1, 3.5) + step(4.5, c1), step(2.5, c2) * step(c2, 3.5) + step(4.5, c2)));
  float idc = max(abs(c1 - c0), abs(c2 - c0)) * min(solid, 1.0);
  float fol = max(step(3.5, a0.w) * step(a0.w, 4.99), max(step(3.5, a1.w) * step(a1.w, 4.99), step(3.5, a2.w) * step(a2.w, 4.99)));
  float line = max(smoothstep(0.14, 0.38, dz) * 0.6, min(idc, 1.0) * 0.38) * (1.0 - fol * 0.85);
  line *= smoothstep(0.50, 0.70, plo.r + (pmid.r - 0.5) * 0.7) * (0.30 + 0.70 * smoothstep(0.35, 0.6, ph)) * (1.0 - smoothstep(6.5, 9.5, a0.z));
  col *= mix(vec3(1.0), vec3(0.46, 0.46, 0.50), line * uPig.w);

  // lightning: for a frame or two the paper shows through. The sky and the lights go bare,
  // the darks stay as silhouettes against them
  if (uWxSheet.y > 0.003) {
    float isSky = 1.0 - step(0.5, texture(tAux, uv).w);
    float lift = uWxSheet.y * (isSky * (0.55 + 0.45 * plo.r) + (1.0 - isSky) * smoothstep(0.25, 0.75, dot(col, W)) * 0.55);
    col = mix(col, vec3(1.0), clamp(lift, 0.0, 0.92));
  }
  // nothing is pure black: the darkest darks are dense indigo and sepia
  col = max(col, vec3(0.085, 0.09, 0.145) + 0.035 * (ph - 0.5));
  col = mix(vec3(1.0), col, painted * (1.0 - skip * 0.8));

  // paper: warm off-white, lit so its tooth shows faintly even where it is bare
  float relief = (ph - 0.5) * 0.055 + (plo.g - 0.5) * 0.02;
  vec3 outc = uPaperColor * col * (1.0 + relief) * mix(vec3(1.0), uGrade, painted);
  gl_FragColor = vec4(outc, 1.0);
}
`;

function fsMaterial(frag, uniforms, extra) {
  return new THREE.ShaderMaterial(Object.assign({
    uniforms, vertexShader: FS_VERT, fragmentShader: frag,
    depthTest: false, depthWrite: false,
  }, extra || {}));
}

export class Post {
  constructor(renderer) {
    this.renderer = renderer;
    const tex = getTextures();
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.tri = new THREE.Mesh(geo, null);
    this.tri.frustumCulled = false;

    this.outW = 2; this.outH = 2; this.inW = 2; this.inH = 2;
    this.sectors = 8;

    this.rtScene = new THREE.WebGLRenderTarget(2, 2, { count: 2, depthBuffer: true, type: THREE.UnsignedByteType });
    this.rtScene.textures[0].minFilter = THREE.LinearFilter; this.rtScene.textures[0].magFilter = THREE.LinearFilter;
    this.rtScene.textures[1].type = THREE.HalfFloatType;
    this.rtScene.textures[1].minFilter = THREE.NearestFilter; this.rtScene.textures[1].magFilter = THREE.NearestFilter;
    this.rtScene.depthTexture = new THREE.DepthTexture(2, 2, THREE.FloatType);

    this.rtHalf = new THREE.WebGLRenderTarget(2, 2, { count: 2, depthBuffer: false, type: THREE.HalfFloatType });
    this.rtHalf.textures[1].type = THREE.UnsignedByteType;
    for (const t of this.rtHalf.textures) { t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; }

    this.rtAbs = new THREE.WebGLRenderTarget(2, 2, { depthBuffer: false, type: THREE.UnsignedByteType });
    this.rtAbs.texture.minFilter = THREE.LinearFilter; this.rtAbs.texture.magFilter = THREE.LinearFilter;

    // last frame's painting + depth, kept for the water's reflections
    this.rtPrev = new THREE.WebGLRenderTarget(2, 2, { depthBuffer: false, type: THREE.HalfFloatType });
    this.rtPrev.texture.minFilter = THREE.LinearFilter; this.rtPrev.texture.magFilter = THREE.LinearFilter;
    this.mKeep = fsMaterial(/* glsl */`
      uniform sampler2D tAbs; uniform highp sampler2D tAux; varying vec2 vUv;
      void main() { gl_FragColor = vec4(texture(tAbs, vUv).rgb, texture(tAux, vUv).z); }`,
      { tAbs: { value: this.rtAbs.texture }, tAux: { value: this.rtScene.textures[1] } });
    G.uPrevTex.value = this.rtPrev.texture;
    this.prevFrames = 0;

    this.mBackdrop = fsMaterial(BACKDROP_FRAG, {});
    this.mPrep = fsMaterial(PREP_FRAG, { tScene: { value: this.rtScene.textures[0] }, uTexel: { value: new THREE.Vector2() } });
    this.absUniforms = {
      tScene: { value: this.rtScene.textures[0] }, tAux: { value: this.rtScene.textures[1] },
      tHalfA: { value: this.rtHalf.textures[0] }, tHalfB: { value: this.rtHalf.textures[1] },
      tPaper: { value: tex.paper },
      uTexel: { value: new THREE.Vector2() }, uRes: { value: new THREE.Vector2() },
      uBrush: { value: new THREE.Vector4(0.0036, 0.0085, 0.013, 0.8) },
      uAbstraction: { value: 1 },
    };
    this.mAbs = {};
    for (const s of [4, 8]) this.mAbs[s] = fsMaterial(ABS_FRAG, this.absUniforms, { defines: { SECTORS: s } });
    this.sheetUniforms = {
      tAbs: { value: this.rtAbs.texture }, tAux: { value: this.rtScene.textures[1] }, tHalfA: { value: this.rtHalf.textures[0] },
      tPaper: { value: tex.paper },
      uOutRes: { value: new THREE.Vector2() }, uInTexel: { value: new THREE.Vector2() },
      uPaperColor: G.uPaperColor, uGrade: { value: new THREE.Vector3(1, 1, 1) },
      uPig: { value: new THREE.Vector4(1.0, 1.0, 2.6, 0.55) },
      uBorder: { value: new THREE.Vector4(0.030, 0.034, 0.9, 1) },
      uBoil: { value: new THREE.Vector2(0, 0) },
      uWxSheet: { value: new THREE.Vector4(0, 0, 0, 0) },
    };
    this.mSheet = fsMaterial(SHEET_FRAG, this.sheetUniforms);
    this.debugView = 0;
    this.mCopy = fsMaterial(/* glsl */`
      uniform sampler2D tA; uniform highp sampler2D tB; uniform int uMode; varying vec2 vUv;
      void main() {
        if (uMode == 1) gl_FragColor = vec4(texture(tA, vUv).rgb, 1.0);
        else if (uMode == 2) gl_FragColor = vec4(vec3(texture(tA, vUv).a), 1.0);
        else if (uMode == 3) { vec4 a = texture(tB, vUv); gl_FragColor = vec4(a.xy * 0.5 + 0.5, a.z / 20.0, 1.0); }
        else { vec4 a = texture(tB, vUv); gl_FragColor = vec4(fract(a.w), floor(a.w) / 6.0, 0.5, 1.0); }
      }`, { tA: { value: null }, tB: { value: this.rtScene.textures[1] }, uMode: { value: 1 } });
  }

  setSize(outW, outH, scale) {
    outW = Math.max(2, outW | 0); outH = Math.max(2, outH | 0);
    const inW = Math.max(2, Math.round(outW * scale)), inH = Math.max(2, Math.round(outH * scale));
    if (outW === this.outW && outH === this.outH && inW === this.inW && inH === this.inH) return;
    this.outW = outW; this.outH = outH; this.inW = inW; this.inH = inH;
    this.rtScene.setSize(inW, inH);
    this.rtHalf.setSize(Math.max(1, inW >> 1), Math.max(1, inH >> 1));
    this.rtAbs.setSize(inW, inH);
    this.rtPrev.setSize(Math.max(1, inW >> 1), Math.max(1, inH >> 1));
    this.prevFrames = 0; G.uPrevOn.value = 0;
    this.mPrep.uniforms.uTexel.value.set(1 / inW, 1 / inH);
    this.absUniforms.uTexel.value.set(1 / inW, 1 / inH);
    this.absUniforms.uRes.value.set(inW, inH);
    this.sheetUniforms.uOutRes.value.set(outW, outH);
    this.sheetUniforms.uInTexel.value.set(1 / inW, 1 / inH);
  }

  _pass(material, target) {
    const r = this.renderer;
    this.tri.material = material;
    r.setRenderTarget(target);
    r.render(this.tri, this.cam);
  }

  beginScene() {
    const r = this.renderer;
    r.setRenderTarget(this.rtScene);
    r.setClearColor(0xffffff, 1);
    r.clear(true, true, true);
    this.tri.material = this.mBackdrop;
    r.render(this.tri, this.cam);
  }

  finish() {
    this._pass(this.mPrep, this.rtHalf);
    this._pass(this.mAbs[this.sectors], this.rtAbs);
    this._pass(this.mKeep, this.rtPrev);
    this.prevFrames++;
    G.uPrevOn.value = this.prevFrames >= 1 ? 1 : 0;
    if (this.debugView) {
      const m = this.mCopy;
      m.uniforms.uMode.value = this.debugView;
      m.uniforms.tA.value = this.debugView === 5 ? this.rtAbs.texture : this.rtScene.textures[0];
      if (this.debugView === 5) m.uniforms.uMode.value = 1;
      this._pass(m, null);
    } else {
      this._pass(this.mSheet, null);
    }
  }

  dispose() {
    this.rtScene.dispose(); this.rtHalf.dispose(); this.rtAbs.dispose(); this.rtPrev.dispose();
  }
}
