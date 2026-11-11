// Painted Cosmos physics: GLSL for the draw kits. OWNER: PHYSICS. Strings only (no three).
// PAINTER pastes these into its own materials next to its wash chunks, as with the flora chunk.

// ---- particles straight from the physics buffers (createWeatherKit with expand: 'gpu') ------------
// Geometry: ONE quad (position.xy in -0.5 .. 0.5, uv 0 .. 1), instanced; nothing is built on
// the CPU. Per instance, the physics arrays as they are:
//   aPcPos  vec3  m, relative to the object's origin, body-local axes
//   aPcVel  vec3  m/s          aPcSize  float  m (the grain itself)          aPcAge  float  s
//   aPcMat  float the ground it was raised from: an index into the physics' MATERIAL_IDS
//                 (bytes, not normalised: 0..14), 255 = not from the ground
// In main(), instead of `position`:
//   vec3 p = pcPhysStreak(position.xy);      // rain, hail, sand, spray
//   vec3 p = pcPhysDab(position.xy);         // snow, dust, ash, spores, leaves
//   gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
// uv.x runs across; uv.y from the head of a streak (0) to its tail (1).
// The uniforms are in info.uniforms (put them in the material's `uniforms`; the kit keeps
// their values current): the eye, so that streaks are the motion relative to the viewer and
// quads face the picture plane; uPcDraw, the DRAW entry of the kind.
export const PARTICLE_GLSL = /* glsl */`
// ---- Painted Cosmos physics: particles (src/physics/three/chunks.glsl.js) ----
uniform vec3 uPcEye;      // camera position, in the object's coordinates
uniform vec3 uPcEyeVel;   // camera velocity, m/s
uniform vec3 uPcRight;    // picture-plane axes
uniform vec3 uPcUp;
uniform vec4 uPcFocus;    // xyz centre of the particle volume, w its radius (0 = no edge fade)
uniform vec4 uPcDraw;     // streak: width, exposure, least length, fade-in.  dab: size, grow, spin, fade-in
uniform vec2 uPcPixel;    // x: metres one pixel covers at one metre from the eye; y: least size in pixels
attribute vec3 aPcPos;
attribute vec3 aPcVel;
attribute float aPcSize;
attribute float aPcAge;
attribute float aPcMat;

// 1 inside the volume, falling to 0 over its outer fifth: the edge is never a wall.
float pcPhysEdge(vec3 p) {
  if (uPcFocus.w <= 0.0) return 1.0;
  float t = clamp((length(p - uPcFocus.xyz) / uPcFocus.w - 0.8) / 0.2, 0.0, 1.0);
  return 1.0 - t * t * (3.0 - 2.0 * t);
}
float pcPhysFadeIn() { return uPcDraw.w > 0.0 ? min(1.0, aPcAge / uPcDraw.w) : 1.0; }

// A streak: from where the particle is back along its motion relative to the eye.
vec3 pcPhysStreak(vec2 corner) {
  vec3 s = (aPcVel - uPcEyeVel) * uPcDraw.y;
  float sl = length(s);
  if (sl < uPcDraw.z) s = sl > 1e-6 ? s * (uPcDraw.z / sl) : uPcUp * uPcDraw.z;
  vec3 w = cross(s, aPcPos - uPcEye);
  float wl = length(w);
  w = wl > 1e-9 ? w / wl : uPcRight;
  float width = max(uPcDraw.x, uPcPixel.x * uPcPixel.y * length(aPcPos - uPcEye));
  return aPcPos + w * (corner.x * width * pcPhysEdge(aPcPos) * pcPhysFadeIn()) - s * (corner.y + 0.5);
}

// A dab: a quad in the picture plane, growing with age, turning if the kind tumbles.
vec3 pcPhysDab(vec2 corner) {
  float h = max(uPcDraw.x + uPcDraw.y * aPcAge, uPcPixel.x * uPcPixel.y * length(aPcPos - uPcEye)) * pcPhysEdge(aPcPos) * pcPhysFadeIn();
  vec3 r = uPcRight, u = uPcUp;
  if (uPcDraw.z != 0.0) {
    float a = aPcAge * uPcDraw.z + aPcSize * 51413.7, c = cos(a), sn = sin(a);
    r = uPcRight * c + uPcUp * sn; u = uPcUp * c - uPcRight * sn;
  }
  return aPcPos + (r * corner.x + u * corner.y) * h;
}

// A shade in 1 - vary .. 1 that stays with the particle.
float pcPhysShade(float vary) { return 1.0 - vary * fract(aPcSize * 73856.093); }
`;

// ---- shapes inside the quads (fragment helpers; optional, the look is PAINTER's) -----------------
// Marks: uv.x across, uv.y along the direction of travel. aPcMark = (depth m, rim m, kind, fade).
//   pcPhysMarkCover(uv, kind): 0..1 where the ground was pressed: a boot's outline for feet
//   (kind 0, 1), a disc for a gear pad (2) or a scour dish (4).
//   pcPhysMarkRim(uv, kind): 0..1 on the raised edge just outside it.
// Rings: aPcRing = (kind, strength, age 0..1, size m).
//   pcPhysRingCover(uv, age01): a thin circle that widens and thins as it ages.
export const SHAPE_GLSL = /* glsl */`
// ---- Painted Cosmos physics: mark and ring shapes (src/physics/three/chunks.glsl.js) ----
float pcPhysMarkCover(vec2 uv, float kind) {
  vec2 p = uv * 2.0 - 1.0;
  if (kind > 1.5) return 1.0 - smoothstep(0.72, 0.82, length(p));
  // a boot: a rounded sole, narrower at the heel (the low-v end)
  float w = mix(0.62, 0.8, smoothstep(-0.8, 0.5, p.y));
  float d = length(vec2(p.x / w, p.y)) ;
  return 1.0 - smoothstep(0.78, 0.9, d);
}
float pcPhysMarkRim(vec2 uv, float kind) {
  vec2 p = uv * 2.0 - 1.0;
  float d = kind > 1.5 ? length(p) : length(vec2(p.x / 0.75, p.y));
  return smoothstep(0.8, 0.9, d) * (1.0 - smoothstep(0.92, 1.0, d));
}
float pcPhysRingCover(vec2 uv, float age01) {
  float d = length(uv * 2.0 - 1.0);
  float w = mix(0.22, 0.07, age01);
  return smoothstep(1.0 - 2.0 * w, 1.0 - w, d) * (1.0 - smoothstep(1.0 - w, 1.0, d)) * (1.0 - age01);
}
`;
