// Painted Cosmos physics: the GLSL twin of FloraField.plantBend / plantDisplace (flora.js).
// OWNER: PHYSICS. A string only: no three, no DOM. PAINTER includes FLORA_GLSL in the vertex
// shader of its instanced flora and feeds it the three field textures and the uniforms from
// physics.fields.flora (see docs/notes/physics.md, "For PAINTER").
//
// The constants below are interpolated from flora.js, so the shader and the CPU model cannot
// drift apart. physics-lab.html?scene=flora draws both on top of each other as a check.
import { FLORA, WAVE_K, WAVE_ROT, WAVE_A } from './flora.js';

const f = (x) => (Number.isInteger(x) ? x.toFixed(1) : String(x));
const rot = (i) => `vec2(d.x * ${f(Math.cos(WAVE_ROT[i]))} - d.y * ${f(Math.sin(WAVE_ROT[i]))}, d.x * ${f(Math.sin(WAVE_ROT[i]))} + d.y * ${f(Math.cos(WAVE_ROT[i]))})`;

export const FLORA_GLSL = /* glsl */`
// ---- Painted Cosmos physics: flora bend (generated from src/physics/flora.js) ----
uniform sampler2D uPhysBend;   // RG: soft-plant load (east, north), BA: stiff-plant load
uniform sampler2D uPhysWind;   // RG: wind at 2 m (m/s), B: gust01, A: turbulence (m/s)
uniform sampler2D uPhysPush;   // RG: push load (east, north), B: flatten01, A: shake01
uniform vec3 uPhysAnchor;      // body-local anchor of the field frame (m)
uniform vec3 uPhysEast;        // unit axes of the frame, body-local
uniform vec3 uPhysNorth;
uniform vec3 uPhysUp;
uniform vec4 uPhysWindMap;     // xy: centre of the bend/wind field (m along east/north), z: 1/size, w: texels per side
uniform vec4 uPhysNearMap;     // the same for the push field
uniform vec4 uPhysWave;        // xy: wave direction, z: wavenumber (rad/m), w: amplitude
uniform vec4 uPhysWavePhase;   // xyz: phases of the three wave trains
uniform vec4 uPhysShape;       // soft flex, soft max angle, stiff flex, stiff max angle

// Bilinear lookup that does not need float-texture filtering (define PC_PHYS_LINEAR to use the
// hardware filter instead: textures must then be LinearFilter + ClampToEdge).
vec4 pcPhysTex(sampler2D t, vec2 uv, float n) {
  #ifdef PC_PHYS_LINEAR
    return texture(t, uv);
  #else
    vec2 p = clamp(uv * n - 0.5, vec2(0.0), vec2(n - 1.0));
    vec2 i = min(floor(p), vec2(n - 2.0));
    vec2 w = p - i;
    ivec2 c = ivec2(i);
    vec4 a = texelFetch(t, c, 0), b = texelFetch(t, c + ivec2(1, 0), 0);
    vec4 e = texelFetch(t, c + ivec2(0, 1), 0), g = texelFetch(t, c + ivec2(1, 1), 0);
    return mix(mix(a, b, w.x), mix(e, g, w.x), w.y);
  #endif
}

// Position of a body-local point in the field frame (metres along east and north).
vec2 pcPhysGrid(vec3 p) {
  vec3 d = p - uPhysAnchor;
  return vec2(dot(d, uPhysEast), dot(d, uPhysNorth));
}

// The bend of a plant rooted at body-local point root. stiff01: 0 grass .. 1 tree.
// Returns xy: bend (radians toward east / north), z: flatten01, w: shake01.
vec4 pcPhysBend(vec3 root, float stiff01) {
  vec2 g = pcPhysGrid(root);
  vec2 uv = (g - uPhysWindMap.xy) * uPhysWindMap.z + 0.5;
  vec4 b = pcPhysTex(uPhysBend, uv, uPhysWindMap.w);
  vec2 L = mix(b.xy, b.zw, stiff01);
  float gust = pcPhysTex(uPhysWind, uv, uPhysWindMap.w).z;
  vec2 d = uPhysWave.xy;
  float ws = ${f(WAVE_A[0])} * sin(uPhysWave.z * ${f(WAVE_K[0])} * dot(${rot(0)}, g) - uPhysWavePhase.x)
           + ${f(WAVE_A[1])} * sin(uPhysWave.z * ${f(WAVE_K[1])} * dot(${rot(1)}, g) - uPhysWavePhase.y)
           + ${f(WAVE_A[2])} * sin(uPhysWave.z * ${f(WAVE_K[2])} * dot(${rot(2)}, g) - uPhysWavePhase.z);
  L *= 1.0 + uPhysWave.w * (1.0 - stiff01) * (0.35 + 0.65 * gust) * ws;
  vec2 nuv = (g - uPhysNearMap.xy) * uPhysNearMap.z + 0.5;
  float flatten = 0.0, shake = 0.0;
  if (nuv.x > 0.0 && nuv.y > 0.0 && nuv.x < 1.0 && nuv.y < 1.0) {
    vec4 p = pcPhysTex(uPhysPush, nuv, uPhysNearMap.w);
    L += p.xy * (1.0 - 0.85 * stiff01);
    flatten = p.z * (1.0 - stiff01);
    shake = p.w;
  }
  float load = length(L);
  float flex = mix(uPhysShape.x, uPhysShape.z, stiff01);
  float amax = mix(uPhysShape.y, uPhysShape.w, stiff01);
  float ang = amax * (1.0 - exp(-flex * load));
  ang = mix(ang, ${f(FLORA.flatAngle)}, flatten);
  return vec4(L * (load > 1e-6 ? ang / load : 0.0), flatten, shake);
}

// Where a point of the plant goes. rel: the point relative to the root (body-local axes, m).
// up: the plant's own up (unit). H: the plant's height (m). bend: pcPhysBend(...).xy.
// The stem curls like a tip-loaded cantilever and keeps its length.
vec3 pcPhysDisplace(vec3 rel, vec3 up, float H, vec2 bend) {
  float h = dot(rel, up);
  float ang = length(bend);
  float s = clamp(h / max(H, 1e-3), 0.0, 1.0);
  float am = ang * (s - s * s / 3.0);
  float hor = h * sin(am);
  vec2 sh = ang > 1e-6 ? bend * (hor / ang) : vec2(0.0);
  return (rel - up * h) + uPhysEast * sh.x + uPhysNorth * sh.y + up * (h * cos(am));
}

// Wind at 2 m above the ground at a body-local point: xy m/s (east, north), z gust01, w turbulence.
vec4 pcPhysWind(vec3 p) {
  vec2 uv = (pcPhysGrid(p) - uPhysWindMap.xy) * uPhysWindMap.z + 0.5;
  return pcPhysTex(uPhysWind, uv, uPhysWindMap.w);
}
`;
