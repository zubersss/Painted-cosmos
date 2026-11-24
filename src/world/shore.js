// Painted Cosmos: THE SHORE'S DIRECTION for the sea's strokes (lane W2, the bodies of water; F's design of 24 Nov).
// OWNER: PAINTER (the water group). Test: node --test src/world/shore.test.mjs
//
// From the air the sea's strokes lie along the crests of the wind's waves (render/materials.js WATER_FRAG, the water's new
// paint). A swell's crests turn to meet a shore and come in roughly parallel to it, but PHYSICS turns them only within its
// sea map's inner level, 17 nodes of 16 m round the player: everywhere else the crests are the open wind's, and where the
// wind runs along a coast the sea's strokes ran straight at it ("a river flowing into the cliff", the look director). So
// the mesher hands the paint the coastline's own direction near land, and the paint turns the crests toward it there.
//
// field.at(x, y, z, out) at a unit direction: out.lx, out.ly the way TOWARD LAND, a unit vector times w, how near land is
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

export const SHORE_DEF = {
  lattice: 160,              // metres between the field's nodes
  rings: [120, 250, 450],    // metres: the rings the ground is read on
  near: [1.0, 0.8, 0.35],    // nearness when the nearest land found is on that ring
  na: 8,                     // points a ring
  deep: 30,                  // metres of water at the node: no shore near (not measured)
  clampH: [-20, 12],         // metres about the sea: a cliff's top cannot outweigh the shore's line
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
    if (!(st.lq !== NOLQ && st.lq > st.h) || Math.abs(st.lq - this.sea) > 0.3) return ZERO;      // (not the sea)
    if (this.sea - st.h >= o.deep) return ZERO;                                                     // (deep water: no shore near)
    const [ux, uy, uz, vx, vy, vz] = frameOf(x, y, z);
    let gx = 0, gy = 0, w = 0;
    for (let r = 0; r < o.rings.length; r++) {
      const d = o.rings[r] / R; let land = 0;
      for (let a = 0; a < o.na; a++) {
        const an = (a + 0.5 * r) * 2 * Math.PI / o.na, c = Math.cos(an), s = Math.sin(an);
        let qx = x + (ux * c + vx * s) * d, qy = y + (uy * c + vy * s) * d, qz = z + (uz * c + vz * s) * d; const l = 1 / Math.hypot(qx, qy, qz);
        S.sample(qx * l, qy * l, qz * l, st, false); this.samples++;
        if (!(st.lq !== NOLQ && st.lq > st.h)) land++;
        const hh = Math.max(o.clampH[0], Math.min(o.clampH[1], st.h - this.sea));
        gx += c * hh; gy += s * hh;
      }
      if (land > 0 && w === 0) w = o.near[r];
    }
    const gl = Math.hypot(gx, gy);
    if (!(gl > 1e-6) || w <= 0) return ZERO;
    return [gx / gl * w, gy / gl * w];      // (the first moment points up the slope: toward land)
  }
  // the field at a unit direction, read bilinearly between the four nodes round it (out: lx, ly; w their length)
  at(x, y, z, out) {
    const f = FACE(x, y, z), [a, b] = chart(f, x, y, z);
    const ga = a / this.da - 0.5, gb = b / this.da - 0.5, i0 = Math.floor(ga), j0 = Math.floor(gb), fa = ga - i0, fb = gb - j0;
    const n00 = this._node(f, i0, j0), n10 = this._node(f, i0 + 1, j0), n01 = this._node(f, i0, j0 + 1), n11 = this._node(f, i0 + 1, j0 + 1);
    const c = (n00[0] * (1 - fa) + n10[0] * fa) * (1 - fb) + (n01[0] * (1 - fa) + n11[0] * fa) * fb;
    const s = (n00[1] * (1 - fa) + n10[1] * fa) * (1 - fb) + (n01[1] * (1 - fa) + n11[1] * fa) * fb;
    out.lx = c; out.ly = s; out.w = Math.min(1, Math.hypot(c, s));
    return out;
  }
}
const ZERO = Object.freeze([0, 0]);

// one field a world, made when a mesher first asks (and only with the water's new paint: world/patchgen.js)
const FIELDS = new Map();
export function shoreField(S) {
  let F = FIELDS.get(S.id);
  if (!F || F.S !== S) { F = new ShoreField(S); FIELDS.set(S.id, F); }
  return F;
}
