// Painted Cosmos: deterministic noise (pure JS, no three). OWNER: PAINTER.
// Everything here is a pure function of its inputs and a seed, so the same planet is produced
// on every visit and Node can unit-test it.

export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Integer hash -> [0,1). Good enough for placement jitter.
export function hash2i(x, y, seed) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function hash3i(x, y, z, seed) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 2147483647) + Math.imul(seed | 0, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Improved Perlin gradient noise in 3D with a seeded permutation. Returns roughly [-1, 1]
// (scaled so typical extremes sit near +-0.9).
export function makeNoise(seed) {
  const rnd = mulberry32(seed);
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; const t = p[i]; p[i] = p[j]; p[j] = t; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  // 12 gradient directions (edges of a cube), stored flat, indexed by perm & 15 (16 with repeats)
  const GX = new Float32Array([1, -1, 1, -1, 1, -1, 1, -1, 0, 0, 0, 0, 1, 0, -1, 0]);
  const GY = new Float32Array([1, 1, -1, -1, 0, 0, 0, 0, 1, -1, 1, -1, 1, -1, 1, -1]);
  const GZ = new Float32Array([0, 0, 0, 0, 1, 1, -1, -1, 1, 1, -1, -1, 0, 1, 0, -1]);

  function n3(x, y, z) {
    const fx = Math.floor(x), fy = Math.floor(y), fz = Math.floor(z);
    const X = fx & 255, Y = fy & 255, Z = fz & 255;
    x -= fx; y -= fy; z -= fz;
    const u = x * x * x * (x * (x * 6 - 15) + 10);
    const v = y * y * y * (y * (y * 6 - 15) + 10);
    const w = z * z * z * (z * (z * 6 - 15) + 10);
    const A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z;
    const B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
    const x1 = x - 1, y1 = y - 1, z1 = z - 1;
    let g;
    g = perm[AA] & 15; const n000 = GX[g] * x + GY[g] * y + GZ[g] * z;
    g = perm[BA] & 15; const n100 = GX[g] * x1 + GY[g] * y + GZ[g] * z;
    g = perm[AB] & 15; const n010 = GX[g] * x + GY[g] * y1 + GZ[g] * z;
    g = perm[BB] & 15; const n110 = GX[g] * x1 + GY[g] * y1 + GZ[g] * z;
    g = perm[AA + 1] & 15; const n001 = GX[g] * x + GY[g] * y + GZ[g] * z1;
    g = perm[BA + 1] & 15; const n101 = GX[g] * x1 + GY[g] * y + GZ[g] * z1;
    g = perm[AB + 1] & 15; const n011 = GX[g] * x + GY[g] * y1 + GZ[g] * z1;
    g = perm[BB + 1] & 15; const n111 = GX[g] * x1 + GY[g] * y1 + GZ[g] * z1;
    const nx00 = n000 + u * (n100 - n000), nx10 = n010 + u * (n110 - n010);
    const nx01 = n001 + u * (n101 - n001), nx11 = n011 + u * (n111 - n011);
    const nxy0 = nx00 + v * (nx10 - nx00), nxy1 = nx01 + v * (nx11 - nx01);
    return (nxy0 + w * (nxy1 - nxy0)) * 1.05;
  }

  function fbm(x, y, z, oct, lac, gain) {
    let a = 1, f = 1, s = 0, n = 0;
    for (let i = 0; i < oct; i++) {
      s += a * n3(x * f + i * 17.13, y * f - i * 9.7, z * f + i * 3.31);
      n += a; a *= gain; f *= lac;
    }
    return s / n;
  }

  // Ridged multifractal in [0,1]: sharp crests, good for mountains and dunes.
  function ridged(x, y, z, oct, lac, gain) {
    let a = 1, f = 1, s = 0, n = 0, prev = 1;
    for (let i = 0; i < oct; i++) {
      let r = 1 - Math.abs(n3(x * f + i * 31.7, y * f + i * 11.3, z * f - i * 5.9));
      r *= r;
      s += a * r * prev; prev = r;
      n += a; a *= gain; f *= lac;
    }
    return s / n;
  }

  return { n3, fbm, ridged };
}

export function smoothstep(a, b, x) {
  let t = (x - a) / (b - a);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return t * t * (3 - 2 * t);
}
export function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
export function lerp(a, b, t) { return a + (b - a) * t; }
