// Painted Cosmos: THE SHORE'S DIRECTION for the sea's strokes (lane W2, the bodies of water; F's design of 24 Nov).
// OWNER: PAINTER (the water group). Test: node --test src/world/shore.test.mjs
//
// From the air the sea's strokes lie along the crests of the wind's waves (render/materials.js WATER_FRAG, the water's new
// paint). A swell's crests turn to meet a shore and come in roughly parallel to it, but PHYSICS turns them only within its
// sea map's inner level, 17 nodes of 16 m round the player: everywhere else the crests are the open wind's, and where the
// wind runs along a coast the sea's strokes ran straight at it ("a river flowing into the cliff", the look director). So
// the mesher hands the paint the coastline's own direction near land, and the paint turns the crests toward it there.
//
// field.at(x, y, z, out) at a unit direction: out.width the narrowest crossing there (m, land each side; SHORE_DEF.open for
// open water), and out.lx, out.ly the way TOWARD LAND, a unit vector times w, how near land is
// (1 with land within the first ring, less by the last, 0 beyond), in the frame the paint decodes the current in
// (Uf = (-z, 0, x) normalised, or (0, z, -y) near a pole; Vf = up x Uf). The paint turns the wind's waves toward it by w,
// as a swell turns to meet a shore, and lays its strokes along the turned crests: a way with a sense, not a line, so the
// turn always has a side to go (a line blended halfway toward one across it has none). The field is laid on a lattice of
// cells some LATTICE m on each cube face (the gnomonic chart), each node measured once a world and cached, and read
// bilinearly between them: the same at a patch's edge from either side, so no seam where two patches meet.
// A node: the ground's height (clamped, -20 .. +12 m about the sea) on three rings of eight points; its first moment is the
// slope toward land (every ring counts the same, so a rock on the near ring cannot swing it); the coastline runs across it.
// A node over deep water (DEEP m and more) is far from any shore: it is not measured at all.
import { NOLQ, makeSample } from './surface.js';
import { smoothstep } from './noise.js';

export const SHORE_DEF = {
  lattice: 160,              // metres between the field's nodes
  rings: [120, 250, 450, 700],   // metres: the rings the ground is read on (the last for the crossing's width only)
  near: [1.0, 0.3, 0, 0],        // nearness when the land found is on that ring (the look director: the turn only within
                                 // about 120 m of the shore; farther out the wind's own crests)
  na: 8,                     // points a ring
  deep: 30,                  // metres of water at the node: no shore near (not measured)
  clampH: [-20, 12],         // metres about the sea: a cliff's top cannot outweigh the shore's line
  share: [0.2, 0.5],         // the share of a ring on land over which it counts from nothing to fully near (a stack, a
                             // rock, one point of eight: nothing; the swell bends toward a beach, it does not circle a rock)
  open: 1500,                // metres: the narrowest crossing counted as open water (the width byte's full scale)
};

const FACE = (x, y, z) => { const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z); return ax >= ay && ax >= az ? (x > 0 ? 0 : 1) : ay >= az ? (y > 0 ? 2 : 3) : (z > 0 ? 4 : 5); };
// a face's chart: (a, b) = the other two coordinates over the main one; and back
function chart(f, x, y, z) { switch (f) { case 0: return [y / x, z / x]; case 1: return [y / -x, z / -x]; case 2: return [z / y, x / y]; case 3: return [z / -y, x / -y]; case 4: return [x / z, y / z]; default: return [x / -z, y / -z]; } }
function unchart(f, a, b) { let x, y, z; switch (f) { case 0: x = 1; y = a; z = b; break; case 1: x = -1; y = a; z = b; break; case 2: y = 1; z = a; x = b; break; case 3: y = -1; z = a; x = b; break; case 4: z = 1; x = a; y = b; break; default: z = -1; x = a; y = b; } const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; }
export function frameOf(x, y, z) {
  let ux, uy, uz; if (Math.abs(y) < 0.9) { ux = -z; uy = 0; uz = x; } else { ux = 0; uy = z; uz = -y; }
  const lu = 1 / Math.hypot(ux, uy, uz); ux *= lu; uy *= lu; uz *= lu;
  return [ux, uy, uz, y * uz - z * uy, z * ux - x * uz, x * uy - y * ux];
}

export class ShoreField {
  constructor(S, opts) {
    this.S = S; this.o = Object.assign({}, SHORE_DEF, opts || {});
    this.R = S.R; this.sea = S.sea == null ? 0 : S.sea;
    this.da = this.o.lattice / this.R;
    this.cache = new Map();
    this.st = makeSample(S.nB);
    this.nodes = 0; this.samples = 0;
  }
  // one node of the lattice, measured once: the way toward land times w, in the node's own frame
  _node(f, i, j) {
    const key = (f * 65536 + (i + 32768)) * 65536 + (j + 32768);
    let v = this.cache.get(key);
    if (v) return v;
    v = this._measure(...unchart(f, (i + 0.5) * this.da, (j + 0.5) * this.da));
    this.cache.set(key, v); this.nodes++;
    return v;
  }
  _measure(x, y, z) {
    const S = this.S, st = this.st, o = this.o, R = this.R;
    S.sample(x, y, z, st, false); this.samples++;
    if (!(st.lq !== NOLQ && st.lq > st.h) || Math.abs(st.lq - this.sea) > 0.3) return NONE;      // (not the sea: not read)
    if (this.sea - st.h >= o.deep) return OPEN;                                                     // (deep water: no shore near)
    const [ux, uy, uz, vx, vy, vz] = frameOf(x, y, z);
    let gx = 0, gy = 0, w = 0;
    const hit = this._hit || (this._hit = new Float64Array(16));      // (metres to the first land each way; open: o.open)
    for (let a = 0; a < o.na; a++) hit[a] = o.open;
    for (let r = 0; r < o.rings.length; r++) {
      const d = o.rings[r] / R; let land = 0;
      for (let a = 0; a < o.na; a++) {
        const an = a * 2 * Math.PI / o.na, c = Math.cos(an), s = Math.sin(an);
        let qx = x + (ux * c + vx * s) * d, qy = y + (uy * c + vy * s) * d, qz = z + (uz * c + vz * s) * d; const l = 1 / Math.hypot(qx, qy, qz);
        S.sample(qx * l, qy * l, qz * l, st, false); this.samples++;
        if (!(st.lq !== NOLQ && st.lq > st.h)) { land++; if (hit[a] > o.rings[r]) hit[a] = o.rings[r]; }
        const hh = Math.max(o.clampH[0], Math.min(o.clampH[1], st.h - this.sea));
        gx += c * hh; gy += s * hh;
      }
      // (how near: by the SHARE of the ring that is land, so a rock or a sea stack, one point of eight, turns nothing,
      //  and a coastline, three or four of eight, turns the waves fully: the first stills curled the strokes into rings
      //  round every stack)
      w = Math.max(w, o.near[r] * smoothstep(o.share[0], o.share[1], land / o.na));
    }
    // THE CROSSING (the look director: a narrow strait with the wind across it is short chop, not long crests): the
    // narrowest way across, land each side, of the four axes the rings were read along; open water counts as o.open
    let width = o.open;
    for (let a = 0; a < o.na / 2; a++) width = Math.min(width, Math.min(o.open, hit[a] + hit[a + o.na / 2]));
    const gl = Math.hypot(gx, gy);
    if (!(gl > 1e-6) || w <= 0) return width < o.open ? [0, 0, width, 1] : OPEN;
    return [gx / gl * w, gy / gl * w, width, 1];      // (the first moment points up the slope: toward land)
  }
  // the field at a unit direction, read bilinearly between the four nodes round it (out: lx, ly; w their length)
  at(x, y, z, out) {
    const f = FACE(x, y, z), [a, b] = chart(f, x, y, z);
    const ga = a / this.da - 0.5, gb = b / this.da - 0.5, i0 = Math.floor(ga), j0 = Math.floor(gb), fa = ga - i0, fb = gb - j0;
    const n00 = this._node(f, i0, j0), n10 = this._node(f, i0 + 1, j0), n01 = this._node(f, i0, j0 + 1), n11 = this._node(f, i0 + 1, j0 + 1);
    // (only the nodes that ARE sea are read: a node on land or a lake knows nothing of the sea, and counted as open
    //  water it widened every strait whose banks a node fell on -- a 350 m strait read 800 m)
    const k00 = (1 - fa) * (1 - fb) * n00[3], k10 = fa * (1 - fb) * n10[3], k01 = (1 - fa) * fb * n01[3], k11 = fa * fb * n11[3];
    const K = k00 + k10 + k01 + k11;
    if (!(K > 1e-6)) { out.lx = 0; out.ly = 0; out.w = 0; out.width = this.o.open; return out; }
    const c = (n00[0] * k00 + n10[0] * k10 + n01[0] * k01 + n11[0] * k11) / K;
    const s = (n00[1] * k00 + n10[1] * k10 + n01[1] * k01 + n11[1] * k11) / K;
    const wd = (n00[2] * k00 + n10[2] * k10 + n01[2] * k01 + n11[2] * k11) / K;
    out.lx = c; out.ly = s; out.w = Math.min(1, Math.hypot(c, s)); out.width = wd;
    return out;
  }
}
const NONE = Object.freeze([0, 0, SHORE_DEF.open, 0]);      // (a node that is not the sea: not read)
const OPEN = Object.freeze([0, 0, SHORE_DEF.open, 1]);      // (open water: no shore near)

// one field a world, made when a mesher first asks (and only with the water's new paint: world/patchgen.js)
const FIELDS = new Map();
export function shoreField(S) {
  let F = FIELDS.get(S.id);
  if (!F || F.S !== S) { F = new ShoreField(S); FIELDS.set(S.id, F); }
  return F;
}
