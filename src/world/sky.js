// Painted Cosmos: the sky wash, clouds, sun and (simple, for now) space. OWNER: PAINTER.
// One full-screen triangle drawn last at the far plane. Everything is evaluated per view ray in
// the active body's local frame, so clouds and wash variation are anchored to the planet.
import * as THREE from 'three';
import { G, ensureGlobals } from '../render/shared.js';
import { RING_PROFILE } from './orbit.js';

const SKY_VERT = /* glsl */`
uniform vec2 uProjScale;
uniform mat3 uCamRot;      // camera rotation, scene space
uniform mat3 uBodyInv;     // scene -> body-local rotation
varying vec3 vDirL;
varying vec3 vDirW;
void main() {
  vec3 dv = vec3(position.xy * uProjScale, -1.0);
  vDirW = uCamRot * dv;
  vDirL = uBodyInv * vDirW;
  #ifdef USE_REVERSED_DEPTH_BUFFER
    gl_Position = vec4(position.xy, 0.0, 1.0);
  #else
    gl_Position = vec4(position.xy, 1.0, 1.0);
  #endif
}
`;

const SKY_FRAG = /* glsl */`
uniform highp sampler3D uNoise3D;
uniform sampler2D uStrokeTex;
uniform vec3 uSunDirL;
uniform vec3 uCamL;         // camera position, body-local
uniform vec3 uSkyZenith;
uniform vec3 uSkyHorizon;
uniform vec3 uHaze;
uniform vec3 uCloudShade;
uniform vec4 uCloud;        // shell radius, coverage, feature size (m), drift
uniform vec4 uAtmo;         // space01 (0 on the ground .. 1 in space), dayness, sun angular radius, body radius
uniform vec4 uWxSky;        // weather: x overcast, y storm, z rain veil, w snow veil
uniform vec3 uStormWash;    // this world's heavy-weather pigment (its cloud shadow laid dense, glazed with indigo)
uniform vec4 uRingS;        // a ringed world seen from under its rings: inner, outer radius (m), strength (0: none)
uniform vec3 uRingC;        // the rings' wash
uniform vec4 uBelt;         // a banded world from inside: belts pole to pole, how far their edges wander (rad), strength
uniform vec4 uSeaC;         // a sea of cloud: its top above the body's radius (m), strength, how high its heads stand
uniform vec4 uAurora;       // an aurora over a biome that names it: x strength (0: none)
uniform float uTime;
varying vec3 vDirL;
varying vec3 vDirW;
layout(location = 1) out highp vec4 pcAux;
uniform float uAux8;

vec3 dens(vec3 c, float d) { return clamp(c - (c - c * c) * (d - 1.0), 0.0, 1.0); }
${RING_PROFILE}

void main() {
  vec3 d = normalize(vDirL);
  vec3 up = normalize(uCamL);
  float e = dot(d, up);
  float sd = dot(d, uSunDirL);
  float sunE = dot(uSunDirL, up);

  // ---- the wash: strong at the zenith, thinning to bare paper at the horizon
  float t = pow(1.0 - clamp(e, 0.0, 1.0), 2.4);
  vec3 sky = mix(uSkyZenith, uSkyHorizon, t);
  // the horizon glows toward the sun at dawn and dusk
  float toward = pow(max(sd, 0.0), 3.0) * (1.0 - smoothstep(0.0, 0.5, sunE));
  sky = mix(sky, uSkyHorizon, toward * 0.65);
  // (overcast: the world has already turned the zenith and horizon keys into one heavy wash of
  // its storm pigment, dense overhead and running thinner toward a paler band above the horizon)
  float oc = uWxSky.x;
  // turbulence and the odd backrun: no flat colour anywhere in a wet wash
  vec4 n1 = texture(uNoise3D, d * 1.3 + 0.17);
  vec4 n2 = texture(uNoise3D, d * 4.1);
  float turb = (n1.r - 0.5) * 0.9 + (n2.g - 0.5) * 0.35;
  float bf = n1.a + (n2.b - 0.5) * 0.10;
  float back = smoothstep(0.84, 0.90, bf) * (1.0 - smoothstep(0.90, 0.95, bf));
  sky = dens(sky, 1.0 + turb * (1.0 - t * 0.7) * (1.0 + oc * 0.7) + back * 0.38 * (1.0 - t));
  sky = mix(sky, vec3(1.0), smoothstep(0.90, 0.97, bf) * 0.22 * (1.0 - t));
  // below the horizon (seen from high up): haze
  sky = mix(sky, uHaze, 1.0 - smoothstep(-0.12, 0.02, e));

  // ---- the rings, seen from the ground: a great pale arc across the sky, laid into the wash
  // before the clouds (so clouds drift in front of it), band beside band with the sky between,
  // lost in the haze toward the horizon; the planet's own shadow lies across its far side.
  // (The same plane, radii and bands as the ring's geometry in orbit.js, which takes over in space.)
  if (uRingS.z > 0.001 && abs(d.y) > 1e-5) {
    float tr = -uCamL.y / d.y;
    vec3 rp = uCamL + d * tr;
    float r01 = (length(rp.xz) - uRingS.x) / (uRingS.y - uRingS.x);
    float pb = dot(uCamL, d), pd = pb * pb - (dot(uCamL, uCamL) - uAtmo.w * uAtmo.w);
    bool hid = pd > 0.0 && (-pb - sqrt(pd)) > 0.0 && (-pb - sqrt(pd)) < tr;      // the planet in the way (from high up)
    if (tr > 0.0 && r01 > 0.0 && r01 < 1.0 && !hid) {
      vec4 ra = texture(uNoise3D, vec3(r01 * 2.3, 0.37, 0.11));
      vec4 rb = texture(uNoise3D, vec3(r01 * 9.1, 0.71, 0.53));
      vec2 pr = pcRingProfile(r01, ra, rb);
      float al = dot(rp, uSunDirL);
      float lit = al > 0.0 ? 1.0 : smoothstep(uAtmo.w * 0.95, uAtmo.w * 1.05, length(rp - uSunDirL * al));
      // the brush runs dry along the arc here and there (anchored to the ring, not to the eye)
      float dryb = texture(uNoise3D, vec3(rp.xz / uRingS.y * 2.6, r01 * 1.7)).g;
      float k = pr.x * uRingS.z * smoothstep(0.012, 0.13, e) * (1.0 - oc * 0.85) * (0.74 + 0.26 * smoothstep(0.30, 0.56, dryb));
      // by day: the pale rings are lifted out of the sky's wash to paper; the thin ones are a glaze of their own gold over it
      vec3 lifted = mix(vec3(1.0, 0.99, 0.95), uRingC, 0.10);
      vec3 glazed = dens(sky * mix(vec3(1.0), uRingC, 0.35), 1.05);
      vec3 ringD = mix(glazed, lifted, smoothstep(0.10, 0.62, pr.y));
      // by night the lit ring is the palest thing in the sky
      vec3 ringN = mix(uRingC, vec3(1.0, 0.985, 0.93), 0.25 + 0.6 * pr.y);
      vec3 ringc = mix(ringN, ringD, uAtmo.y);
      // in the planet's shadow: only a cool breath darker than the sky
      ringc = mix(dens(sky * vec3(0.86, 0.85, 0.93), 1.35), ringc, lit);
      sky = mix(sky, ringc, k * mix(0.94, 0.92, uAtmo.y));
      // pigment pools where the sky's wash stops against each lifted band: the arc's fine drawn edges
      sky = dens(sky, 1.0 + pr.x * (1.0 - pr.x) * 4.0 * 0.9 * uRingS.z * smoothstep(0.012, 0.13, e) * uAtmo.y * (1.0 - oc));
    }
  }

  // ---- the belts of a banded world, seen from inside it: the high cloud lies in broad bands
  // along the parallels, pale zone beside darker belt, their edges run wet into each other
  float rc0 = length(uCamL);
  if (uBelt.z > 0.001) {
    float bb = dot(uCamL, d), bd = bb * bb - (rc0 * rc0 - uCloud.x * uCloud.x);
    if (bd > 0.0 && rc0 < uCloud.x) {
      vec3 bp = normalize(uCamL + d * (-bb + sqrt(bd)));
      vec4 b1 = texture(uNoise3D, bp * 5.3 + vec3(uTime * 0.0003, 0.0, 0.0));
      vec4 b2 = texture(uNoise3D, bp * 19.0 + 0.4);
      float lat = asin(clamp(bp.y, -1.0, 1.0)) + ((b1.r - 0.5) + (b2.g - 0.5) * 0.4) * uBelt.y;
      float sv = sin(lat * uBelt.x * 3.14159 + 0.6), sv2 = sin(lat * uBelt.x * 3.14159 * 2.7 + 2.1);
      float belt = smoothstep(-0.22, 0.30, sv + 0.28 * sv2 + (b2.r - 0.5) * 0.35);
      vec3 zone = mix(sky, vec3(1.0, 0.985, 0.94), 0.50);
      vec3 beltc = dens(mix(sky, uCloudShade, 0.62), 1.30 + (b1.g - 0.5) * 0.9 + (b2.b - 0.5) * 0.4);
      sky = mix(sky, mix(zone, beltc, belt), uBelt.z * smoothstep(-0.02, 0.07, e) * (1.0 - oc) * (1.0 - uAtmo.x));
    }
  }

  // ---- an aurora (a biome that names it, PAINTER 12): curtains hung low over the horizon, their lower edge a wavy
  // pale line lifted out of the wash, rays running up from it and fading into violet; folded along the horizon
  // (anchored to the planet, drifting slowly). By day a pale ghost in the blue, by night the palest thing low down.
  if (uAurora.x > 0.001) {
    vec3 ha = normalize(d - up * e + up * 1e-4);
    vec4 fa = texture(uNoise3D, ha * 1.25 + vec3(0.7, 0.2, uTime * 0.0015));
    vec4 fb = texture(uNoise3D, ha * 3.4 + vec3(0.1, uTime * 0.002, 0.4));
    float fold = smoothstep(0.38, 0.62, fa.r * 0.7 + fb.g * 0.3);                    // where along the horizon a curtain hangs
    float e0 = 0.16 + 0.12 * fa.g + 0.05 * (fb.r - 0.5);                             // its lower edge, wavy (9 to 19 degrees up)
    float ray = texture(uNoise3D, vec3(ha.xz * 16.0, ha.y * 16.0) + vec3(0.0, uTime * 0.004, 0.0)).g;
    ray = 0.40 + 0.60 * smoothstep(0.35, 0.70, ray);                                  // rays: streaks up the curtain
    float hgt = 0.22 + 0.25 * fb.b;
    float k = smoothstep(e0 - 0.012, e0 + 0.02, e) * (1.0 - smoothstep(e0 + 0.04, e0 + hgt, e)) * fold * ray;
    // (pale viridian at the lower edge lifted out of the blue, violet where the rays fade: it has to stand against the
    // middle of the sky, where the wash is deep; low down the sky is near paper and a pale curtain is lost in it)
    vec3 ac = mix(vec3(0.66, 0.93, 0.78), vec3(0.80, 0.68, 0.93), smoothstep(e0, e0 + hgt * 0.8, e));
    sky = mix(sky, ac, clamp(k * uAurora.x * (0.62 + 0.36 * (1.0 - uAtmo.y)) * (1.0 - oc) * (1.0 - uAtmo.x), 0.0, 0.85));
  }

  // ---- a sea of cloud seen from one of its islands: beyond the island's rim the cloud tops
  // lie in rows out to their own horizon, and heads of cumulus stand up along it. (The sea
  // itself is the liquid's surface near by; this is its far reach, which no island's rim hides.)
  if (uSeaC.y > 0.001) {
    float rs = uAtmo.w + uSeaC.x;
    // where the top of the far cloud lies for this eye: below eye level (its own horizon) from above it,
    // above eye level from a bench lower than the cloud tops (the islands then stand in a bank of it)
    float et = rc0 > rs ? -sqrt(max(0.0, 1.0 - (rs * rs) / (rc0 * rc0))) : sin(atan((rs - rc0) / 450.0));
    vec3 hz2 = normalize(d - up * e + up * 1e-4);
    vec4 h1 = texture(uNoise3D, hz2 * 2.2 + 0.31);
    vec4 h2 = texture(uNoise3D, hz2 * 7.0);
    float head = (0.016 + 0.085 * smoothstep(0.30, 0.78, h1.r) + 0.020 * h2.g) * uSeaC.z;       // heads of cumulus stand up along it
    float above = e - et;
    float deck = 0.0, hollow = 0.0;
    if (above < head) {
      deck = 1.0 - smoothstep(head * 0.80, head, above);                              // a crisp upper edge
      float sb = dot(uCamL, d), sdisc = sb * sb - (rc0 * rc0 - rs * rs);
      if (rc0 > rs && sdisc > 0.0 && sb < 0.0) {
        // the deck itself, seen from above: rows of billows out to its horizon; the sea near by is the liquid's own surface
        float ts = -sb - sqrt(sdisc);
        vec3 sp = uCamL + d * ts;
        vec4 q1 = texture(uNoise3D, sp / 190.0 + vec3(uTime * 0.0006, 0.0, 0.0));
        vec4 q2 = texture(uNoise3D, sp / 53.0);
        deck *= smoothstep(160.0, 420.0, ts);
        hollow = 1.0 - smoothstep(0.30, 0.56, q1.r * 0.65 + q2.g * 0.35);
      } else {
        // the heads and the bank under them: lit tops, the sides and hollows in a soft glaze
        float under = clamp(1.0 - above / max(head, 1e-4), 0.0, 1.0);
        hollow = smoothstep(0.22, 0.85, under + (h2.r - 0.5) * 0.5) * (0.55 + 0.45 * h2.b) * (1.0 - 0.5 * (1.0 - smoothstep(-0.10, 0.0, above)));
      }
      vec3 deckc = mix(vec3(1.0, 0.995, 0.97), mix(uCloudShade, vec3(0.80, 0.76, 0.88), 0.35), hollow * 0.62);
      sky = mix(sky, deckc, deck * uSeaC.y * (1.0 - oc * 0.6) * (1.0 - uAtmo.x));
    }
  }

  // ---- clouds: bare paper with soft violet undersides, on a shell around the planet
  float rc = length(uCamL);
  float b = dot(uCamL, d);
  float disc = b * b - (rc * rc - uCloud.x * uCloud.x);
  float cloud = 0.0, shade = 0.0, body = 0.0, belly = 0.5;
  if (uCloud.y > 0.001 && disc > 0.0) {
    float tt = rc < uCloud.x ? (-b + sqrt(disc)) : (-b - sqrt(disc));
    if (tt > 0.0) {
      vec3 hp = uCamL + d * tt;
      vec3 q = hp / uCloud.z + vec3(uTime * uCloud.w, 0.0, uTime * uCloud.w * 0.6);
      float c1 = texture(uNoise3D, q).r;
      float c2 = texture(uNoise3D, q * 2.7 + 0.31).g;
      float c3 = texture(uNoise3D, q * 7.3).b;
      float v = c1 * 0.60 + c2 * 0.28 + c3 * 0.12;
      float th = 1.0 - uCloud.y;
      // crisp on the upper edge, wet and soft on the lower
      cloud = smoothstep(th - 0.02, th + 0.09, v);
      float toSun = texture(uNoise3D, q + uSunDirL * 0.09).r * 0.60 + texture(uNoise3D, (q + uSunDirL * 0.09) * 2.7 + 0.31).g * 0.28 + c3 * 0.12;
      shade = smoothstep(0.0, 0.10, toSun - v + 0.02) * smoothstep(th + 0.02, th + 0.16, v);
      float fade = rc < uCloud.x ? smoothstep(0.015, 0.20, e) : 1.0;
      cloud *= fade;
      body = smoothstep(th + 0.02, th + 0.30, v);
      belly = smoothstep(th + 0.06, th + 0.50, v + (c2 - 0.5) * 0.25);
    }
  }
  // (at night a cloud is a pale shape lifted out of the wash, not bare paper: paper is kept for the stars)
  vec3 cl = mix(mix(mix(uSkyHorizon, vec3(1.0), 0.22), vec3(1.0), uAtmo.y), uCloudShade, shade * 0.9);
  cl = dens(cl, 1.0 + (n2.r - 0.5) * 0.8);
  // under an overcast the cloud is no longer bare paper: it is the wash itself, in heavy masses
  // with dark bellies; their torn edges stay pale, where the light still comes through
  // (PAINTER 16/17, the M4 critique: under Earth's thunderstorm the closed sky was the darkest thing in the picture, its
  // darkest hundredth at L* 8, the crowns paler cut-outs against it. The sky is the light of a rain picture: the masses
  // are laid a little thinner and their bellies less deep, so that the sky's darks stay above the wood's)
  vec3 mass = dens(mix(uStormWash, vec3(1.0), 0.12), 0.10 + 1.05 * belly + 0.22 * uWxSky.y + (n2.r - 0.5) * 0.4);
  cl = mix(cl, mass, oc * (0.30 + 0.70 * body));
  vec3 col = mix(sky, cl, cloud);

  // rain or snow falling from the cloud base, far off: soft slanted drags of the wet wash,
  // strongest low in the sky (anchored to the planet: they do not turn with the camera)
  float veil = max(uWxSky.z, uWxSky.w);
  if (veil > 0.01) {
    vec3 hz = normalize(d - up * e + up * 1e-4);
    vec3 side = cross(up, hz);
    vec3 vq = hz * 1.7 + side * (e * 1.1) + up * (e * 0.30) + vec3(uTime * 0.004, 0.0, 0.0);
    float drag = texture(uNoise3D, vq).r * 0.75 + texture(uNoise3D, vq * 2.3 + 0.3).g * 0.25;
    float low = (1.0 - smoothstep(0.03, 0.62, e)) * smoothstep(-0.10, 0.03, e);
    col = dens(col, 1.0 + (smoothstep(0.30, 0.78, drag) - 0.35) * low * uWxSky.z * 1.05);
    // falling snow whitens the low sky instead: the far world goes to paper
    col = mix(col, vec3(0.985, 0.985, 0.99), uWxSky.w * low * (0.35 + 0.45 * smoothstep(0.35, 0.65, drag)));
  }

  // ---- the sun: bare paper with a warm halo
  float ang = acos(clamp(sd, -1.0, 1.0));
  float halo = exp(-ang * 7.0) * 0.75 + exp(-ang * 28.0) * 0.6;
  col = mix(col, vec3(1.0, 0.985, 0.93), clamp(halo, 0.0, 1.0) * (1.0 - cloud * 0.6) * (1.0 - oc * 0.9));
  float sun = 1.0 - smoothstep(uAtmo.z * 0.82, uAtmo.z, ang + (n2.b - 0.5) * 0.012);
  col = mix(col, vec3(1.0), sun * (1.0 - cloud * 0.5) * (1.0 - oc));

  // ---- space: deep indigo and Payne's grey washes in layers, salt blooms, a violet drift.
  // (The stars are not painted here: the brush would take them. They are spattered on
  // afterwards as a glaze, see makeSkyGlaze; this pass only says where they may lie.)
  float starOK = 0.0;
  if (uAtmo.x > 0.001 || uAtmo.y < 0.999) {
    vec3 dw = normalize(vDirW);
    vec4 s1 = texture(uNoise3D, dw * 0.9 + 0.4);
    vec4 s2 = texture(uNoise3D, dw * 2.9);
    vec3 sp = mix(vec3(0.20, 0.24, 0.45), vec3(0.34, 0.37, 0.52), s1.r);
    sp = mix(sp, vec3(0.42, 0.33, 0.57), smoothstep(0.55, 0.80, s1.g) * 0.6);          // a violet nebula drift, wet in wet
    sp = dens(sp, 1.0 + (s2.g - 0.5) * 0.9 + (s1.b - 0.5) * 0.7);
    // a second wash laid over the first when it had dried: its edge is crisp here, lost there
    float lay = s1.a * 0.62 + s2.r * 0.38;
    float edgeW = mix(0.012, 0.10, smoothstep(0.35, 0.65, s2.a));
    float over = smoothstep(0.50 - edgeW, 0.50 + edgeW, lay);
    sp = dens(sp, 1.0 + over * 0.50 + (1.0 - smoothstep(0.0, 0.035, abs(lay - 0.50))) * over * 0.22);
    // a pale bloom where water ran back into the wash (a nebula), and salt
    float bloom = smoothstep(0.62, 0.86, s1.b * 0.7 + s2.b * 0.3) * (1.0 - over * 0.6);
    sp = mix(sp, vec3(0.70, 0.66, 0.80), bloom * 0.42);
    vec4 sa = texture(uNoise3D, dw * 6.3 + 0.2);
    float salt = smoothstep(0.66, 0.80, sa.r * 0.6 + s2.b * 0.4);                         // salt: pale crystalline blooms
    sp = mix(sp, vec3(0.62, 0.66, 0.82), salt * 0.50);
    float sunS = 1.0 - smoothstep(uAtmo.z * 0.82, uAtmo.z, ang);
    sp = mix(sp, vec3(1.0, 0.985, 0.93), clamp(halo, 0.0, 1.0));
    sp = mix(sp, vec3(1.0), sunS);
    col = mix(col, sp, uAtmo.x);
    // stars: in space everywhere but in the sun's glare; from the ground at night, above the
    // horizon haze and where no cloud lies
    float night = (1.0 - uAtmo.y) * (1.0 - cloud) * (1.0 - oc) * smoothstep(0.03, 0.30, e);
    starOK = mix(night, 1.0, uAtmo.x) * (1.0 - clamp(halo * 1.6, 0.0, 1.0));
  }

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), mix(1.0, 0.45, uAtmo.x));
  pcAux = uAux8 > 0.5 ? vec4(starOK, 0.0, 20.0 / 32.0, 0.0) : vec4(starOK, 0.0, 20.0, 0.0);     // (x: where stars may lie; the sky has no normal to store)
}
`;

export function makeSkyUniforms() {
  ensureGlobals();
  return {
    uNoise3D: G.uNoise3D, uStrokeTex: G.uStrokeTex, uTime: G.uTime, uAux8: G.uAux8,
    uSunDirL: { value: new THREE.Vector3(0.3, 0.8, 0.5).normalize() },
    uCamL: { value: new THREE.Vector3(0, 4000, 0) },
    uSkyZenith: { value: new THREE.Vector3(0.50, 0.69, 0.90) },
    uSkyHorizon: { value: new THREE.Vector3(0.90, 0.94, 0.97) },
    uHaze: { value: new THREE.Vector3(0.93, 0.955, 0.975) },
    uCloudShade: { value: new THREE.Vector3(0.80, 0.80, 0.90) },
    uCloud: { value: new THREE.Vector4(4600, 0.45, 2600, 0.0006) },
    uAtmo: { value: new THREE.Vector4(0, 1, 0.045, 4000) },
    uWxSky: { value: new THREE.Vector4(0, 0, 0, 0) },
    uStormWash: { value: new THREE.Vector3(0.48, 0.50, 0.68) },
    uRingS: { value: new THREE.Vector4(1, 2, 0, 0) },
    uRingC: { value: new THREE.Vector3(0.93, 0.86, 0.66) },
    uBelt: { value: new THREE.Vector4(9, 0.02, 0, 0) },
    uAurora: { value: new THREE.Vector4(0, 0, 0, 0) },
    uSeaC: { value: new THREE.Vector4(80, 0, 1, 0) },
    uProjScale: { value: new THREE.Vector2(1, 1) },
    uCamRot: { value: new THREE.Matrix3() },
    uBodyInv: { value: new THREE.Matrix3() },
  };
}

// ------------------------------------------------------------------------------------------
// The sky's glaze: what is laid over the brushed sky afterwards (see shared.js GLAZES).
//   Stars: spattered masking fluid. Round soft dots of bare paper, most of them small, a few
//   large, fixed among themselves (scene directions); the sky pass says where they may lie.
//   Pulse streaks: when the drive is on, long soft drags of the brush run out from the point
//   the ship flies toward: pale ones lifted out of the wash and a few darker ones, each with a
//   loaded start and a dry, broken tail. They flow outward; nothing in them is a hard line.
// ------------------------------------------------------------------------------------------
const GLAZE_FRAG = /* glsl */`
uniform highp sampler3D uNoise3D;
uniform highp sampler2D uSceneAux;
uniform float uAux8;
uniform vec2 uSceneRes;
uniform vec4 uAtmo;
uniform vec4 uStreak;       // x strength 0..1, y flow (the painter's clock), z one pixel (tangent), w -
uniform vec3 uTravel;       // where the ship is going, scene space (unit)
varying vec3 vDirW;
float h21(vec2 p) { vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
// one layer of spatter on a cube map: at most one star a cell
float spatter(vec3 d, float n, float share, float rMin, float rMax, float px) {
  vec3 a = abs(d);
  vec2 uv; float face;
  if (a.x >= a.y && a.x >= a.z) { uv = d.yz / a.x; face = d.x > 0.0 ? 0.0 : 1.0; }
  else if (a.y >= a.z) { uv = d.zx / a.y; face = d.y > 0.0 ? 2.0 : 3.0; }
  else { uv = d.xy / a.z; face = d.z > 0.0 ? 4.0 : 5.0; }
  vec2 g = (uv * 0.5 + 0.5) * n, cell = floor(g), f = g - cell;
  vec2 key = cell + face * 71.0;
  float h = h21(key + 0.5);
  if (h > share) return 0.0;
  float hs = h21(key + 17.3);
  float r = mix(rMin, rMax, hs * hs * hs) * px;                 // radius (tangent): most are small
  float cellT = 2.0 / n;                                         // a cell's width (tangent, on its face)
  float rc = min(r / cellT, 0.30);
  vec2 c = vec2(h21(key + 3.1), h21(key + 7.7)) * (1.0 - 2.0 * rc - 0.04) + rc + 0.02;
  float dist = length(f - c) / max(rc, 1e-4);
  // a round soft dot; the small ones are fainter (a fine spatter), the large ones bare paper
  return (1.0 - smoothstep(0.35, 1.0, dist)) * (0.50 + 0.50 * smoothstep(0.05, 0.6, hs));
}
void main() {
  vec4 aux = texture(uSceneAux, gl_FragCoord.xy / uSceneRes);
  if (aux.w * (uAux8 > 0.5 ? 8.0 : 1.0) > 0.5) discard;                                      // only the sky takes this glaze
  vec3 d = normalize(vDirW);
  float S = uStreak.x;
  // ---- stars
  float px = uStreak.z;
  float star = max(spatter(d, 26.0, 0.24, 1.3, 3.2, px), spatter(d.zxy, 11.0, 0.16, 2.4, 4.4, px));
  star *= aux.x * (1.0 - 0.75 * S);
  vec3 col = vec3(1.0);
  float alpha = star;
  // ---- pulse streaks
  if (S > 0.004) {
    vec3 f = normalize(uTravel);
    vec3 u = normalize(cross(f, abs(f.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0))), v = cross(f, u);
    float c = clamp(dot(d, f), -1.0, 1.0);
    float rho = sqrt(max(1.0 - c, 0.0) / max(1.0 + c, 1e-4));    // tan(theta / 2): 0 ahead, 1 abeam
    float lr = log(max(rho, 1e-4));
    float dvv = dot(d, v), duu = dot(d, u);
    float phi = atan(dvv, abs(duu) + abs(dvv) > 0.0 ? duu : 1.0) / 6.2831853 + 0.5;     // 0..1 round the way ahead
    // (the hand is not a ruler: each drag wanders a little as it runs out)
    vec4 wn = texture(uNoise3D, d * 2.3 + 0.21);
    phi += (wn.r - 0.5) * 0.005 + (wn.g - 0.5) * 0.002;
    float pale = 0.0, deep = 0.0;
    for (int L = 0; L < 2; L++) {
      float K = L == 0 ? 38.0 : 67.0;
      float gphi = phi * K, i = floor(gphi), x = gphi - i - 0.5;
      float h = h21(vec2(i, 3.0 + float(L) * 9.0)), h2 = h21(vec2(i, 11.0 + float(L) * 5.0));
      if (h > 0.62) continue;
      float w = mix(0.16, 0.50, h2 * h2);                          // half width, share of the sector
      float xo = abs(x + (h2 - 0.5) * 0.3) / w;
      float across = (1.0 - smoothstep(0.0, 1.0, xo)) * (1.0 - 0.35 * smoothstep(0.0, 0.5, xo));      // soft from the middle out: a wet drag, no edge
      // along: one drag after another flows outward; each starts loaded and trails off dry
      float len = mix(1.1, 2.4, h2);
      float sAl = (lr - uStreak.y * mix(0.55, 0.95, h) + h * 13.0) / len;
      float xa = 1.0 - fract(sAl);                                 // 0 at the head (outer end) .. 1 at the tail
      float along = smoothstep(0.0, 0.10, xa) * (1.0 - smoothstep(0.45, 0.98, xa));
      float dryN = texture(uNoise3D, vec3(gphi * 0.9, sAl * 2.3, h * 7.0)).r;
      float dry = 1.0 - smoothstep(0.18, 0.70, xa) * smoothstep(0.36, 0.58, dryN) * 0.9;
      dry *= 0.72 + 0.28 * smoothstep(0.30, 0.55, texture(uNoise3D, vec3(gphi * 2.1, sAl * 5.0, h * 3.0)).g);
      float m = across * along * dry * (L == 0 ? 1.0 : 0.6);
      if (h2 > 0.30) pale = max(pale, m); else deep = max(deep, m);
    }
    float reach = smoothstep(0.035, 0.42, rho) * (1.0 - smoothstep(6.0, 40.0, rho));
    pale *= reach * S; deep *= reach * S;
    // a darker drag under, a lifted pale one over
    float aD = deep * 0.40, aP = pale * 0.58;
    vec3 cD = vec3(0.17, 0.20, 0.38), cP = vec3(0.90, 0.93, 1.0);
    float aS = alpha, aAll = 1.0 - (1.0 - aD) * (1.0 - aP) * (1.0 - aS);
    col = (cD * aD * (1.0 - aP) * (1.0 - aS) + cP * aP * (1.0 - aS) + vec3(aS)) / max(aAll, 1e-4);
    alpha = aAll;
  }
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(col, alpha);
}
`;

export function makeSkyGlaze(skyUniforms) {
  ensureGlobals();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const uniforms = {
    uNoise3D: G.uNoise3D, uSceneAux: G.uSceneAux, uSceneRes: G.uSceneRes, uAux8: G.uAux8,
    uAtmo: skyUniforms.uAtmo, uProjScale: skyUniforms.uProjScale, uCamRot: skyUniforms.uCamRot, uBodyInv: skyUniforms.uBodyInv,
    uStreak: { value: new THREE.Vector4(0, 0, 0.002, 0) },
    uTravel: { value: new THREE.Vector3(0, 0, -1) },
  };
  const mat = new THREE.ShaderMaterial({
    name: 'pc-sky-glaze', uniforms, vertexShader: SKY_VERT, fragmentShader: GLAZE_FRAG,
    depthWrite: false, depthTest: false, transparent: true,
  });
  mat.userData.pcPainted = true; mat.userData.pcGlaze = true;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'pc-sky-glaze';
  mesh.frustumCulled = false;
  mesh.renderOrder = 1001;
  const m4 = new THREE.Matrix4();
  mesh.onBeforeRender = function (renderer, scene, camera) {
    const pe = camera.projectionMatrix.elements;
    uniforms.uProjScale.value.set(1 / pe[0], 1 / pe[5]);
    uniforms.uCamRot.value.setFromMatrix4(m4.extractRotation(camera.matrixWorld));
    mat.uniformsNeedUpdate = true;
  };
  return mesh;
}

export function makeSky(uniforms) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const mat = new THREE.ShaderMaterial({
    name: 'pc-sky', uniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
    depthWrite: false, depthTest: true, depthFunc: THREE.LessEqualDepth,
  });
  mat.userData.pcPainted = true;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'pc-sky';
  mesh.frustumCulled = false;
  mesh.renderOrder = 1000;
  const m4 = new THREE.Matrix4();
  mesh.onBeforeRender = function (renderer, scene, camera) {
    const pe = camera.projectionMatrix.elements;
    uniforms.uProjScale.value.set(1 / pe[0], 1 / pe[5]);
    uniforms.uCamRot.value.setFromMatrix4(m4.extractRotation(camera.matrixWorld));
    mat.uniformsNeedUpdate = true;
  };
  return mesh;
}
