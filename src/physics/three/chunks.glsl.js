// Painted Cosmos physics: GLSL for the draw kits. OWNER: PHYSICS. Strings only (no three).
// PAINTER pastes these into its own materials next to its wash chunks, as with the flora chunk.

// ---- particles straight from the physics buffers (createWeatherKit with expand: 'gpu') ------------
// Geometry: ONE quad (position.xy in -0.5 .. 0.5, uv 0 .. 1), instanced; nothing is built on
// the CPU. Per instance, the physics arrays as they are:
//   aPcPos  vec3  m, relative to the object's origin, body-local axes
//   aPcVel  vec3  m/s          aPcSize  float  m (the grain itself)          aPcAge  float  s
//   aPcLeft float s until it is gone, where the physics can tell (1e9 otherwise)
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
uniform vec4 uPcDraw;     // streak: width, exposure, least length, fade-in.  dab: size (now), grow, spin, fade-in
uniform vec4 uPcDraw2;    // x: dab exposure (s): drawn out along its motion across the picture.  y: share of the kind drawn (1 = all)
                          // z: room (>= 1): how much the marks may grow before they hide more than the physics says
                          // w: dab cell (m; 0 = none): shown modulo a cell of this half-width round the eye
uniform vec3 uPcEast;     // local horizontal axes (unit), for the cell
uniform vec3 uPcNorth;
uniform vec4 uPcShelter;  // the hull: east, north (m from the eye), top (m above the eye), radius (0 = none)
uniform vec4 uPcPixel;    // x: metres one pixel covers at one metre from the eye; y: least size in pixels; z: most (0 = none);
                          // w: dab: how much sizes differ from particle to particle (0..1)
uniform float uPcSmear;   // dab: the most it is drawn out along its motion, in half-sizes (4 = two dab sizes)
uniform vec4 uPcDraw3;    // x: fade-out (s): a mark shrinks to nothing over its last moments (aPcLeft).  y: dab strobe (s): the
                          // frame time (0 = off); z: the longest a dab is drawn out to keep up with its travel a frame, in dab sizes
                          // w: dab: nothing nearer the eye than 0.4 of this (m), full size from it on (0 = off)
attribute float aPcLeft;
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
float pcPhysFadeIn() { return (uPcDraw.w > 0.0 ? min(1.0, aPcAge / uPcDraw.w) : 1.0) * (uPcDraw3.x > 0.0 ? clamp(aPcLeft / uPcDraw3.x, 0.0, 1.0) : 1.0); }
// Where the least size makes a mark f times larger than it is, it stands for f (streak) or
// f^2 (dab) of its kind and only that share is drawn: a number each particle keeps for life
// decides which, and a mark shrinks smoothly to nothing as its turn passes (expand.js: thinned).
float pcPhysThin(float keep) {
  if (keep >= 1.0) return 1.0;
  float h = fract(aPcSize * 91573.37);
  return smoothstep(0.0, 1.0, (keep * 1.18 - h) / (0.3 * h + 1e-4));
}

// A streak: from where the particle is back along its motion relative to the eye.
vec3 pcPhysStreak(vec2 corner) {
  vec3 s = (aPcVel - uPcEyeVel) * uPcDraw.y;
  float sl = length(s);
  if (sl < uPcDraw.z) s = sl > 1e-6 ? s * (uPcDraw.z / sl) : uPcUp * uPcDraw.z;
  vec3 w = cross(s, aPcPos - uPcEye);
  float wl = length(w);
  w = wl > 1e-9 ? w / wl : uPcRight;
  float dist = length(aPcPos - uPcEye), hw = 0.5 * uPcDraw.x, far = 0.5 * uPcPixel.x * uPcPixel.y * dist, thin = 1.0;
  if (far > hw) { thin = pcPhysThin(uPcDraw2.y * min(1.0, uPcDraw2.z * hw / far)); hw = far; } else thin = pcPhysThin(uPcDraw2.y);
  if (uPcPixel.z > 0.0) hw = min(hw, 0.5 * uPcPixel.x * uPcPixel.z * dist);
  return aPcPos + w * (corner.x * 2.0 * hw * pcPhysEdge(aPcPos) * pcPhysFadeIn() * thin) - s * (corner.y + 0.5);
}

// A dab: a quad in the picture plane, growing with age, turning if the kind tumbles, drawn out
// along its motion if the kind has an exposure.
vec3 pcPhysDab(vec2 corner) {
  vec3 c0 = aPcPos;
  float edge = -1.0;
  if (uPcDraw2.w > 0.0 && aPcMat > 200.0) {
    vec3 t = c0 - uPcEye;
    vec2 d = vec2(dot(t, uPcEast), dot(t, uPcNorth)), w = d - 2.0 * uPcDraw2.w * floor(d / (2.0 * uPcDraw2.w) + 0.5);
    c0 += uPcEast * (w.x - d.x) + uPcNorth * (w.y - d.y);
    float m = clamp((max(abs(w.x), abs(w.y)) / uPcDraw2.w - 0.8) / 0.2, 0.0, 1.0);
    edge = 1.0 - m * m * (3.0 - 2.0 * m);
    if (uPcShelter.w > 0.0 && length(w - uPcShelter.xy) < uPcShelter.w && dot(c0 - uPcEye, cross(uPcEast, uPcNorth)) < uPcShelter.z) edge = 0.0;
  }
  float dist = length(c0 - uPcEye), h = 0.5 * (uPcDraw.x + uPcDraw.y * aPcAge), far = 0.5 * uPcPixel.x * uPcPixel.y * dist;
  h *= 1.0 - uPcPixel.w + 2.0 * uPcPixel.w * fract(aPcSize * 51413.7);
  if (far > h) { float f = h / far; h = far * pcPhysThin(uPcDraw2.y * min(1.0, uPcDraw2.z * f * f)); } else h *= pcPhysThin(uPcDraw2.y);
  if (uPcPixel.z > 0.0) h = min(h, 0.5 * uPcPixel.x * uPcPixel.z * dist);
  float full = h;
  if (uPcDraw3.w > 0.0) h *= smoothstep(0.4, 1.0, dist / uPcDraw3.w);
  h *= (edge >= 0.0 ? edge : pcPhysEdge(aPcPos)) * pcPhysFadeIn();
  vec3 r = uPcRight, u = uPcUp;
  float la = h;
  if (uPcDraw.z != 0.0) {
    float a = aPcAge * uPcDraw.z + aPcSize * 51413.7, c = cos(a), sn = sin(a);
    r = uPcRight * c + uPcUp * sn; u = uPcUp * c - uPcRight * sn;
  } else if (uPcDraw2.x > 0.0 && h > 0.0) {
    vec3 v = (aPcVel - uPcEyeVel) * uPcDraw2.x;
    vec2 sp = vec2(dot(v, uPcRight), dot(v, uPcUp));
    float sl = length(sp);
    if (sl > 1e-5) {
      vec2 c = sp / sl; float travel = sl * uPcDraw3.y / uPcDraw2.x, streak = uPcDraw3.z;
      if (travel > streak * 2.0 * full) h *= 1.0 - smoothstep(0.0, 0.6, travel / (streak * 2.0 * full) - 1.0);
      sl = min(sl, max(uPcSmear * h, travel));
      r = uPcRight * c.x + uPcUp * c.y; u = uPcUp * c.x - uPcRight * c.y;
      la = h + 0.5 * sl; c0 -= r * (0.5 * sl);
    }
  }
  return c0 + r * (corner.x * 2.0 * la) + u * (corner.y * 2.0 * h);
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
