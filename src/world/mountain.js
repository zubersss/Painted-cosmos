// Painted Cosmos: MOUNTAIN STREAMS (?mount=1, with ?rivers=tree). OWNER: PAINTER (the water group's lead; the coordinator's
// order 3c, 24 Nov; docs/lead/WATER-DESIGN.md 3.2, docs/notes/water.md).
//
// Until now no water ran off a mountain: Earth's alpine meadow (a sixth of the world, peaks to 890 m) carried no liquid, and
// the drainage field took it for a wall 30 m over the wood's base (surface.js waterBaseAt), so the rain on the peaks went
// nowhere. With the switch:
//   1. THE MOUNTAINS GET THEIR OWN FLOW: the drainage field takes them for a wall and is left as it is (its levels, lakes and
//      the wood's routing are W1's exactly). Their own terrain is ridges round closed valleys -- a field filled over it fills a
//      quarter of the mountain's nodes, some by hundreds of metres, and its streams would climb over saddles (measured
//      24 Nov) -- so world/rivers.js gives the mountains a LOCAL flow instead: from each node down its steepest slope on the
//      mountain's own large-scale height (alpineMacro below: the alpine recipe's ridges, peaks and crags, without the noises
//      under 60 m), into the valley floors, where a torrent ends (it sinks into the meadow, thinning away) or runs on off the
//      mountain into the wood's rivers. A hollow among the peaks is not drawn as a tarn: lakes are lane W2's.
//   2. THE STREAMS GO UP ONTO THE MOUNTAINS: the alpine meadow joins the liquid group of the wood's streams (prepareMountain),
//      so the streams of that flow carry on up onto it; there they stay narrow (world/rivers.js RIVER_DEF.mountW) and run
//      straighter (mountWander, a fraction of the wood's wander), as torrents do.
//   3. THE LAND KEEPS THEM: surface.js's alpine recipe asks alpineStream (S.mount.alpine) for the stream nearest the point:
//      a gully cut into the slope down to the stream's level, a bed of stones, a low bank where the slope falls away under
//      it, the water's level, white water where the stream falls steeply (the lane-0 turbW contract), no trees in it, and no
//      water over the snow line (the gully stays, full of snow).
import { smoothstep } from './noise.js';

export const MOUNT_DEF = {
  // (a mountain stream's width and wander are world/rivers.js RIVER_DEF.mountW and mountWander: the network is built there)
  gully: 0.9,       // the gully's walls: metres up for a metre out (about 42 degrees)
  levee: 3,         // metres: where the slope falls away under the stream, a bank this wide keeps it in
  snow: 30,         // metres over the snow line (the biome's t.snow) above which a stream is frozen: no water, the gully stays
  white: [0.05, 0.22], // the stream's fall along it (metres a metre) from clear to white water
  reach: 30,        // metres from the centre line past which the stream cuts nothing (the gully's walls meet the slope sooner)
};

// THE ALPINE RECIPE'S LARGE-SCALE HEIGHT (surface.js _generic, k === 'alpine': the same sums in the same order), without the
// 22 m and 5 m noises and the flank's rock teeth, which the field's 98 m cells cannot carry
export function alpineMacro(S, x, y, z, T) {
  const R = S.R, A = S.nA, X = x * R, Y = y * R, Z = z * R;
  const wl = T.wl || 1000, amp = T.amp || 480;
  const rd = A.ridged(X / wl + 4.0, Y / wl, Z / wl - 2.0, 4, 2.1, 0.5);
  const up = smoothstep(0.14, 0.60, rd);
  const pk = 0.42 + 0.58 * smoothstep(-0.35, 0.45, A.n3(X / (wl * 1.6) + 9.0, Y / (wl * 1.6), Z / (wl * 1.6) + 3.0));
  const crag = A.ridged(X / (wl * 0.19) + 2.0, Y / (wl * 0.19) - 6.0, Z / (wl * 0.19), 2, 2.0, 0.5);
  const m = A.n3(X / 260, Y / 260 + 7.0, Z / 260);
  const rise = Math.pow(up, 1.7) * (0.30 + 0.70 * rd) * pk;
  return 42 + m * 7 * (1 - up) + rise * amp + (crag - 0.4) * amp * 0.10 * up;
}

// the land's large-scale height where the mountains are: surface.js waterBaseAt with the mountains' own height where it has
// the wall (the liquid groups as the world was made; the alpine meadow is asked by its terrain). `have`: w holds the point's
// biome weights already
export function mountBaseAt(S, x, y, z, w, divide, have) {
  if (!have) S.biomeWeights(x, y, z, w);
  const G = S._lqGroup0 || S.lqGroup;
  let w0 = 0, w1 = 0, w2 = 0, wa = 0, ha = 0;
  for (let i = 0; i < S.nB; i++) {
    const wi = w[i];
    if (wi <= 0) continue;
    if (S.biomes[i].terrain === 'alpine') { wa += wi; ha += wi * alpineMacro(S, x, y, z, S.biomes[i].t || {}); continue; }
    const g = G[i];
    if (g === 0) w0 += wi; else if (g === 1) w1 += wi; else if (g === 2) w2 += wi;
  }
  const L = S._bigL(x, y, z);
  const wl = w0 + w1 + w2 + wa;
  const base = wl > 1e-6 ? ((w0 + w2) * L + w1 * S.sea + ha) / wl : L;
  return base + (divide === undefined ? 30 : divide) * (1 - Math.min(1, wl));
}

// the alpine meadow joins the wood's streams' liquid group, and its recipe is handed the stream (once a world, after the
// drainage field and before the rivers, which read S.mount: world/waterhooks.js)
export function prepareMountain(S) {
  if (!S || S.mount) return S ? S.mount : null;
  const idx = [];
  S.biomes.forEach((b, i) => { if (b.terrain === 'alpine') idx.push(i); });
  if (!idx.length || !S.biomes.some((b) => b.terrain === 'forest')) return null;
  S._lqGroup0 = S.lqGroup.slice();
  for (const i of idx) S.lqGroup[i] = 0;
  S.mount = { idx, alpine: alpineStream, baseAt: mountBaseAt };
  return S.mount;
}

// THE STREAM IN THE ALPINE RECIPE: called with the recipe's height h (after its crags and teeth); returns the height with the
// stream's gully cut, and sets EVERY time c.lqA (the water's level, NaN where there is none), c.bedA (the bed's wash, 0..1),
// c.growA (what of the trees may stand, 0..1), c.wetA (how wet the ground, 0..1); in the water, c.fu and c.fv (the current)
// and c.turbW, c.fspdW (white water, the lane-0 contract)
export function alpineStream(S, c, h, T) {
  c.lqA = NaN; c.bedA = 0; c.growA = 1; c.wetA = 0;
  const net = S.rivers;
  if (!net) return h;
  const o = MOUNT_DEF, R = S.R, x = c.x, y = c.y, z = c.z, g = net.D.g;
  const frozen = (T.snow || 190) + o.snow;
  const node = g.idOf(x, y, z), i0 = net.off[node], i1 = net.off[node + 1];
  if (i1 <= i0) return h;
  const hit = net._nearest(x * R, y * R, z * R, i0, i1, x, y, z);
  if (hit.i < 0 || hit.d > net.o.near) return h;
  const si = hit.i, st = hit.t, d = hit.d;
  if (d > o.reach || (net.sM && net.sM[si] === 2)) return h;       // (a stretch that runs dry over a crag: world/rivers.js)
  const hw = net.sW[si * 2] + (net.sW[si * 2 + 1] - net.sW[si * 2]) * st;
  // the water's level: the network's (on a mountain stream it follows the mountain's own large-scale height down, never rising,
  // world/rivers.js)
  const a = si * 3, lw = net.sP[si * 2] + (net.sP[si * 2 + 1] - net.sP[si * 2]) * st;
  // the gully: the bed a shallow trough under the water, the walls up to the slope at `gully`; where the slope lies lower than
  // the stream (the 22 m and 5 m noises and the rock teeth are not in the large scale), a low bank keeps the water in
  if (d < hw) {
    const t = d / hw;
    h = lw - (0.25 + 0.45 * (1 - t * t));
  } else {
    const wall = lw - 0.25 + (d - hw) * o.gully;
    if (h > wall) h = wall;
    else if (d < hw + o.levee) {
      const bank = Math.min(wall, lw + 0.3);
      if (h < bank) h += (bank - h) * (1 - smoothstep(hw + 0.5 * o.levee, hw + o.levee, d));
    }
  }
  c.bedA = 1 - smoothstep(hw, hw + 1.2, d);
  c.growA = Math.min(c.growA, smoothstep(hw + 1, hw + 5, d));
  c.wetA = Math.max(c.wetA, 0.6 * (1 - smoothstep(hw, hw + 4, d)));
  if (d < hw + 1.5 && lw < frozen) {
    if (!(c.lqA === c.lqA) || lw > c.lqA) c.lqA = lw;
    // the current along the segment, downstream, in the place's tangent axes (as world/rivers.js), and white where it falls
    let ux, uy, uz;
    if (Math.abs(y) < 0.9) { ux = -z; uy = 0; uz = x; } else { ux = 0; uy = z; uz = -y; }
    const ul = 1 / Math.sqrt(ux * ux + uy * uy + uz * uz); ux *= ul; uy *= ul; uz *= ul;
    const vx = y * uz - z * uy, vy = z * ux - x * uz, vz = x * uy - y * ux;
    const bx = net.sB[a] - net.sA[a], by = net.sB[a + 1] - net.sA[a + 1], bz = net.sB[a + 2] - net.sA[a + 2];
    const fu = bx * ux + by * uy + bz * uz, fv = bx * vx + by * vy + bz * vz, fl = Math.sqrt(fu * fu + fv * fv);
    if (fl > 1e-9) { c.fu = fu / fl; c.fv = fv / fl; }
    const len = Math.sqrt(bx * bx + by * by + bz * bz) || 1, fall = Math.max(0, net.sP[si * 2] - net.sP[si * 2 + 1]) / len;
    c.turbW = smoothstep(o.white[0], o.white[1], fall);
    c.fspdW = 0.6 + 6 * Math.min(0.5, fall);
  }
  return h;
}
