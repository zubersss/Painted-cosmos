// Painted Cosmos: far trees as painted impostors. OWNER: PAINTER (the trees lane, far: T1 of docs/lead/TREES-DESIGN.md
// on r2). The far trees of the oil look since 24 Nov (?fartree=old: today's far tree), with a guard that falls back to it.
//
// WHY. A far tree today is one shared form of 138 triangles (florakit.js farCardGeometry) sized to its kind: on the
// owner's phone the far wood is 816,000 triangles on foot and 5.9 million at 150 m up (counted), and its crowns read as
// smooth dark lumps with a few flecks. An impostor is two triangles a tree. What it shows is the kind's OWN full tree
// (the same kit the near trees are built from), seen from the nearest of 64 directions, and painted as the oil look
// paints a leaf: each stroke one flat colour in its tree's own colour run, lit whole by the crown's light, with a lit
// side and a shaded one.
//
// WHAT IS BAKED, once per world, the first time a far impostor is drawn: for every kind of tree that is drawn far off as
// leaves (flora.js CAN_CARD), its two lod-0 trees, each from 8 x 8 directions laid hemi-octahedrally from the horizon
// to straight down (an eye below the horizon takes the lowest ring), each view 64 texels square. A texel holds no
// colour, only what the paint needs to know about the piece of tree there:
//   R  the stroke's own number (0..1), from which its colour within the tree's run is chosen;
//   G  the crown's mass normal, octahedral, x in 6 bits, and the piece's inner shade (aData.z) in 2;
//   B  the normal's y in 6 bits, and what the piece is in 2: 0 wood, 1 leaf, 2 a leaf under snow, 3 the inside of a
//      crown (a far tree's dark core);
//   A  where the stroke's centre lies along the line of sight (1..255; 0: nothing there).
// A STROKE IS A HANDFUL OF LEAVES. A real leaf is about a texel at 64 texels a tree, and one leaf a pixel would be the
// grain the look forbids (LOOK-RULES R4.2). So the leaves are gathered into strokes: every leaf whose centre falls in the
// same cell of a grid laid through the crown takes that cell's number and its centre, so a stroke is a clump of real
// leaves, about 2.6 texels across, ragged at its edge by the leaves' own outlines, with the sky between clumps.
// THE COARSER LEVELS ARE BAKED, NOT AVERAGED (no blur, R4.1): each level of the mip chain is drawn again at half the
// size with the stroke grid twice as coarse, so a stroke stays about 2.6 texels at every level, and the level a tree
// is drawn from is chosen by its size on the screen (NEAREST, no blend between levels or views). The grids nest, and a
// coarse stroke takes the number of the fine stroke at its corner, so a tree that changes level as the eye moves keeps
// an eighth of its strokes exactly and the rest take a neighbour's colour.
// Bark is thickened by half a texel at each level, so a trunk far off is a thin line and not a row of dots.
import * as THREE from 'three';
import { VERT_PARS, VERT_END, FRAG_PARS } from './chunks.js';
import { FOG_VERT, SKYUP, PC_UP_F, FARCROWN, makePaintUniforms } from './materials.js';
import { FRAME_HOOKS, register, OIL, PHYS } from './shared.js';
import { FLORA_GLSL } from '../physics/flora.glsl.js';

const _q = (() => { try { return new URLSearchParams(location.search); } catch { return null; } })();
const _qn = (k, d, lo, hi) => { const v = _q && _q.has(k) ? +_q.get(k) : NaN; return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
export const IMP = {
  views: 8,                                              // views to a side of the hemi-octahedron (64 in all)
  tile: Math.round(_qn('impres', 96, 16, 128) / 8) * 8,  // texels to a view at the finest level (?impres=; a multiple of 8)
  stroke: _qn('impstroke', 4.5, 1, 8),                   // a stroke's size in texels at every level (?impstroke=; 3.6 keeps it
                                                         //  at 2.5 screen px or more at the level picked, the look director)
  jit: _qn('impjit', 0.35, 0, 1),
  bakeMs: _qn('impbake', 4, 0, 1000),                    // the bake's share of a frame, ms (?impbake=0: all at once)
  deep: _qn('impdeep', 0.5, 0, 1),                       // (a crown seen far off reads as a lit mass and a shaded one, not as its depths)                         // how much of a near leaf's own light jitter a stroke keeps (?impjit=)
  cols: 4,                                               // tree variants laid side by side in the atlas
  // (the quad stands at the tree's middle. It stood 0.35 of the tree's radius toward the eye, and then a big tree's quad
  //  came out nearer than a small tree's standing just in front of it: SEEN, a young oak at 50 m drawn as a bare stump,
  //  its crown behind its neighbour's. At the middle, the nearer tree is laid over the farther one whole, as a painter
  //  lays them. ?imppush= to try others.)
  push: _qn('imppush', 0, 0, 0.5),
  dens: _qn('impdens', 3.0, 0.5, 6),                     // each kind's leaves drawn larger until its crown is this dense (?impdens=)
  leafLo: 1.4, leafHi: 4.0,                              // (never less, never more, than this much larger)
  variants: Math.round(_qn('impvar', 1, 1, 2)),          // trees baked of each kind (?impvar=2: two, at twice the memory)
  minLeaf: _qn('impminleaf', 2.0, 0, 6),                 // and never under this many texels across, at any level
  // SMALL CROWNS IN TWO STEPS (by default since the look director passed it, 24 Nov; ?impsmall=0 the old way, =N
  // texels to try others): a view of 12 texels or fewer paints a crown's strokes in two light levels, its cap and its
  // body (IMP_FRAG)
  small: (() => { const v = _q && _q.get('impsmall'); if (v === '0') return 0; const n = v == null ? NaN : +v; return v == null || v === '' || v === '1' || !isFinite(n) ? 12 : Math.max(0, Math.min(96, n)); })(),
};
// (the weather group's gust bands seen from the air, ?gustbands=1, or ?wx2=1 without it: read from the address here,
//  never imported, the contract for the weather's modules; IMP_VERT GUST)
const GUSTBANDS = (() => {
  if (!_q) return false;
  const on = (k) => _q.has(k) && _q.get(k) !== '0' && _q.get(k) !== 'false';
  return _q.has('gustbands') ? on('gustbands') : on('wx2');
})();
// (the levels: halving until a view is a single texel; 96 texels give 96, 48, 24, 12, 6, 3 and the last is cut at 1.5
//  so it stops at 3 -- six levels)
IMP.levels = (() => { let n = 1, t = IMP.tile; while (t % 2 === 0 && t > 2) { t /= 2; n++; } return n; })();

// ---- the directions ----------------------------------------------------------------------------------------------
// (the same arithmetic as the vertex shader below; change one, change both)
export function viewDir(i, j, N = IMP.views) {
  const qx = ((i + 0.5) / N) * 2 - 1, qy = ((j + 0.5) / N) * 2 - 1;
  const x = (qx + qy) * 0.5, z = (qx - qy) * 0.5, y = 1 - Math.abs(x) - Math.abs(z);
  const l = Math.hypot(x, y, z) || 1;
  return new THREE.Vector3(x / l, y / l, z / l);
}
export function viewCell(d, N = IMP.views) {
  const y = Math.max(d.y, 0), s = Math.abs(d.x) + y + Math.abs(d.z) || 1;
  const x = d.x / s, z = d.z / s;
  const cx = Math.min(N - 1, Math.max(0, Math.floor(((x + z) * 0.5 + 0.5) * N)));
  const cy = Math.min(N - 1, Math.max(0, Math.floor(((x - z) * 0.5 + 0.5) * N)));
  return [cx, cy];
}
export function viewBasis(d) {
  const ref = Math.abs(d.y) > 0.999 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(ref, d).normalize();
  const up = new THREE.Vector3().crossVectors(d, right);
  return { right, up };
}
// The half width and half height of the frame of a view: an upright cylinder (radius rc, half height hh) seen from d.
// Its width across the view is always its diameter (the view's right is level); its height is the cylinder's height
// foreshortened by the view's slant, plus the top's ellipse. (the same arithmetic as the vertex shader)
export function viewRect(d, rc, hh) {
  const sinE = Math.max(0, Math.min(1, d.y)), cosE = Math.sqrt(1 - sinE * sinE);
  return [rc, hh * cosE + rc * sinE];
}

// ---- the bake ----------------------------------------------------------------------------------------------------
const BAKE_VERT = /* glsl */`
attribute vec4 aData;
attribute vec3 aMass;
attribute vec3 aCard;
attribute float aBranchId;
uniform vec3 uC;
uniform float uR;
uniform vec3 uD;
uniform float uCell;
uniform float uCellK;
uniform float uPad;
uniform vec2 uLeafK;      // x a leaf drawn this much larger, y and never under this many metres from its centre to a corner
uniform vec3 uCC;         // the crown's middle (the middle of the box round its leaves' centres)
uniform vec3 uCRad;       // and that box's half sizes: the crown's ball, as an ellipsoid
uniform float uDeepK;     // how much of a stroke's depth behind the crown's front surface is its inner shade (IMP.deep)
varying vec3 vEnc;
varying vec3 vN;
varying float vDep;
varying float vInner;
float pcImpHash(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
void main() {
  float part = aData.y;
  vec3 p = position;
  float cls = 1.0, id;
  vec3 n, ctr;
  vInner = 0.0;
  float vFlat = 0.0;
  if (part < 0.5) {
    // wood: the TRUNK (aBranchId -1) thickened by a fifth of a texel of this level, so a far trunk is a line and not a
    // row of dots; the limbs are left as they are and go as the tree gets small, as a painter would leave them out
    cls = 0.0; if (aBranchId < 0.0) p += normal * uPad; n = normal; ctr = p; id = aData.w;
    // (the limbs down to the third level, and then left out: below that they were dark specks among the leaves, SEEN
    //  from 150 m; left out from the second level, a small tree's crown floated over its trunk, SEEN at 50 m)
    if (aBranchId >= 0.0 && uCellK > 4.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  } else {
    // A LEAF DRAWN LARGER, about its own centre: the game itself draws a far tree's leaves larger as it drops some
    // (PROP_VERT, leaves by distance), and a tree's real leaves at 64 texels are single texels -- a crown of specks,
    // SEEN in the first bake. Never under uLeafK.y from centre to corner, so at the coarse levels a leaf is still a
    // touch of a couple of texels and not a speck, and a small crown closes up as a real one does far off.
    vec3 off = position - aCard;
    float hl = length(off);
    p = aCard + off * max(uLeafK.x, uLeafK.y / max(hl, 1e-4));
    if (part > 5.5 && part < 6.5) cls = 2.0;
    if (aData.z > 1.5) cls = 3.0;
    // the stroke: the cell of the crown's grid this leaf's centre falls in (the grid nests from level to level, and
    // a coarse cell takes the number of the finest cell at its corner)
    vec3 cell = floor(aCard / uCell);
    ctr = (cell + 0.5) * uCell;
    id = pcImpHash(cell * uCellK + 17.0);
    // ONE LIGHT A STROKE, AND A CROWN LIT AS ONE ROUND MASS (the references from the air: "a whole country of round
    // crowns"). The stroke's normal is the crown's FRONT surface where the line of sight through the stroke meets it:
    // the crown's ball as an ellipsoid round its leaves, seen from this view. So every stroke of a crown takes the
    // crown's lit cap or its shaded side, as a ball does, and a stroke seen far back through a gap is not lit as the
    // back of the crown (it was: a speckle of dark touches among the lit, SEEN from 150 m). How far behind that surface
    // the stroke lies is its inner shade (the deeper, the darker, as the inside of a crown is).
    vec3 q = (ctr - uCC) / uCRad, dq = uD / uCRad;
    float qa = dot(dq, dq), qb = dot(q, dq), qc = dot(q, q) - 1.0, disc = qb * qb - qa * qc;
    vec3 nf = normalize((ctr - uCC) / (uCRad * uCRad) + 1e-5);
    float deep = 0.0;
    if (disc > 0.0) {
      float tf = (-qb + sqrt(disc)) / qa;           // forward along the line of sight to the front of the crown
      vec3 pf = ctr + uD * max(tf, 0.0);
      nf = normalize((pf - uCC) / (uCRad * uCRad));
      deep = clamp(max(tf, 0.0) / (0.9 * min(uCRad.x, min(uCRad.y, uCRad.z)) + 1e-3), 0.0, 1.0);
    }
    // (ONE NORMAL AND ONE INNER SHADE A STROKE, nothing of the leaf's own: the look director's review of the first
    //  impostors, 24 Nov: single texels of a stroke took a step of their own from their leaf's mass normal or inner
    //  shade -- the speckle. Every leaf of a stroke is written at the stroke's own depth too (below), so where two
    //  strokes overlap the nearer one is laid whole and no texel of the one behind pokes through.)
    n = nf;
    vInner = deep * uDeepK;
    vFlat = 1.0;
  }
  vEnc = vec3(id, cls, clamp(vFlat > 0.5 ? vInner : aData.z, 0.0, 1.0));
  vN = n;
  vDep = dot(ctr - uC, uD) / uR;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  if (vFlat > 0.5) { vec4 pz = projectionMatrix * modelViewMatrix * vec4(ctr, 1.0); gl_Position.z = pz.z / pz.w * gl_Position.w; }
}
`;
const BAKE_FRAG = /* glsl */`
varying vec3 vEnc;
varying vec3 vN;
varying float vDep;
varying float vInner;
void main() {
  vec3 n = normalize(vN);
  n /= abs(n.x) + abs(n.y) + abs(n.z);
  vec2 o = n.z >= 0.0 ? n.xy : (1.0 - abs(n.yx)) * vec2(n.x >= 0.0 ? 1.0 : -1.0, n.y >= 0.0 ? 1.0 : -1.0);
  vec2 q = floor((o * 0.5 + 0.5) * 63.0 + 0.5);
  float sz = floor(vEnc.z * 3.0 + 0.5);
  float a = 1.0 + floor(clamp(0.5 + 0.5 * vDep, 0.0, 1.0) * 254.0 + 0.5);
  gl_FragColor = vec4(floor(vEnc.x * 255.0 + 0.5), q.x * 4.0 + sz, q.y * 4.0 + vEnc.y, a) / 255.0;
}
`;

const PENDING = new Set();
let hooked = false, TICK = 0;
// (how many frames the painter has drawn since the first bake was asked for: flora.js steps the bake from its own
//  update only when no frame came between two updates -- the gallery's settling loop, which waits for nothing to be
//  busy without drawing -- so a game frame never pays for two steps)
export function bakeTick() { return TICK; }
function hook() {
  if (hooked) return;
  hooked = true;
  // (the bake needs the renderer and must run OUTSIDE a render: the painter's frame hooks run before the frame's
  //  passes, render/index.js. The renderer is handed over by the first far tree that is drawn, flora.js.)
  FRAME_HOOKS.push(() => {
    TICK++;
    for (const a of PENDING) a.step();
  });
}

// The atlas for one world: `variants` = [{ geo, layer }], the kit geometries in layer order.
export class ImpostorAtlas {
  constructor(geos) {
    this.geos = geos;
    this.n = geos.length;
    this.rows = Math.max(1, Math.ceil(this.n / IMP.cols));
    this.cellPx = IMP.views * IMP.tile;
    this.width = IMP.cols * this.cellPx;
    this.height = this.rows * this.cellPx;
    // per variant, in the kit's own units: the middle of the tree's box (x, y, z) and the radius of the upright cylinder
    // round it (w), and the cylinder's half height (uImpH.x) and the radius of the ball round it all (uImpH.y). A view
    // is framed on the cylinder seen from its direction, which wastes far fewer texels than the ball did (a poplar is
    // seven metres across and fifteen high): see viewRect.
    this.cr = []; this.ch = [];
    for (const g of geos) {
      if (!g.boundingBox) g.computeBoundingBox();
      const b = g.boundingBox, cx = (b.min.x + b.max.x) / 2, cy = (b.min.y + b.max.y) / 2, cz = (b.min.z + b.max.z) / 2;
      const pa = g.attributes.position.array;
      let rc = 0;
      for (let i = 0; i < pa.length; i += 3) rc = Math.max(rc, Math.hypot(pa[i] - cx, pa[i + 2] - cz));
      rc *= 1.04;
      const hh = (b.max.y - b.min.y) / 2 * 1.04;
      // the crown's middle: the mean of the leaves' centres (aCard of every piece that is not wood)
      const cd = g.attributes.aCard.array, dd = g.attributes.aData.array;
      let mx = 0, my = 0, mz = 0, mn = 0;
      for (let i = 0, k = 0; i < cd.length; i += 3, k += 4) if (dd[k + 1] > 0.5) { mx += cd[i]; my += cd[i + 1]; mz += cd[i + 2]; mn++; }
      this.cc = this.cc || [];
      this.cc.push(mn ? new THREE.Vector3(mx / mn, my / mn, mz / mn) : new THREE.Vector3(cx, cy, cz));
      // HOW MUCH LARGER ITS LEAVES ARE DRAWN: a kind's leaves are grown until its crown is as dense as IMP.dens, the
      // card area seen from the side (half of all of it: the cards face every way) over the crown's side outline (an
      // ellipse across its leaves' centres). MEASURED over Earth's thirteen kinds the density runs from 0.13 (the
      // spruce) to 1.3 (the round maple) and 2.5 (the sapling), so one factor for all left the conifers bare poles
      // and the round maples solid (SEEN).
      this.leafK = this.leafK || [];
      {
        const P = g.attributes.position.array, ix = g.index.array;
        let area = 0, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
        for (let t = 0; t < ix.length; t += 3) {
          const a = ix[t], b = ix[t + 1], c = ix[t + 2];
          if (dd[a * 4 + 1] < 0.5) continue;
          const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
          const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
          area += 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
          const k = a * 3;
          x0 = Math.min(x0, cd[k]); x1 = Math.max(x1, cd[k]); y0 = Math.min(y0, cd[k + 1]); y1 = Math.max(y1, cd[k + 1]); z0 = Math.min(z0, cd[k + 2]); z1 = Math.max(z1, cd[k + 2]);
        }
        const sil = Math.PI * ((x1 - x0 + z1 - z0) / 4) * ((y1 - y0) / 2);
        this.ce = this.ce || [];
        this.ce.push([new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), new THREE.Vector3(Math.max(0.5, (x1 - x0) / 2 * 1.1), Math.max(0.5, (y1 - y0) / 2 * 1.1), Math.max(0.5, (z1 - z0) / 2 * 1.1))]);
        const dens = area > 0 && sil > 1e-3 ? area * 0.5 / sil : 1;
        this.leafK.push(Math.min(IMP.leafHi, Math.max(IMP.leafLo, Math.sqrt(IMP.dens / dens))));
      }
      this.cr.push(new THREE.Vector4(cx, cy, cz, rc));
      this.ch.push(new THREE.Vector4(hh, Math.hypot(rc, hh), 0, 0));
    }
    this.texture = null; this.ready = false; this.renderer = null;
    this.uniforms = {
      uImpTex: { value: null },
      uImpK: { value: new THREE.Vector4(0, IMP.views, IMP.tile, IMP.levels - 1) },
      uImpAtlas: { value: new THREE.Vector4(this.width, this.height, IMP.cols, IMP.push) },
      uImpC: { value: this.cr },
      uImpH: { value: this.ch },
    };
    this.ms = 0;
  }
  // THE GUARD (the coordinator, 24 Nov, before the impostors became the default far trees): if this device cannot
  // compile the impostor program, or the bake throws or comes out empty, the far tier goes back to today's form and the
  // console says why. probe() compiles the material on a one-tree mesh and reads three's own diagnostics of the program
  // (renderer.debug.checkShaderErrors, on by default); it returns why it failed, or null.
  probe(renderer) {
    const m = this.material;
    if (!m) return null;
    const g = impostorQuadGeometry();
    g.setAttribute('aInst', new THREE.InstancedBufferAttribute(new Float32Array(4), 4));
    g.setAttribute('aBorn', new THREE.InstancedBufferAttribute(new Float32Array(1), 1));
    g.setAttribute('aInst2', new THREE.InstancedBufferAttribute(new Float32Array(2), 2));
    const mesh = new THREE.InstancedMesh(g, m, 1), scene = new THREE.Scene();
    scene.add(mesh);
    let why = null;
    try {
      renderer.compile(scene, new THREE.PerspectiveCamera());
      const prog = renderer.properties.get(m).currentProgram;
      if (prog && typeof prog.getUniforms === 'function') prog.getUniforms();      // (three checks a program on its first use)
      const dg = prog && prog.diagnostics;
      if (dg && !dg.runnable) why = 'the impostor program did not compile: ' + String(dg.programLog || (dg.fragmentShader && dg.fragmentShader.log) || '').slice(0, 200);
    } catch (e) { why = 'the impostor program threw: ' + ((e && e.message) || e); }
    g.dispose();
    return why;
  }
  fail(why) {
    if (this.failed) return;
    this.failed = why;
    console.warn('[painted cosmos] far impostors off, today\'s far trees instead: ' + why);
    if (typeof this.onFail === 'function') this.onFail(why);
  }
  // (does any texel of the finest level hold a tree? sampled, not every texel)
  hasTree() {
    const d = this.texture && this.texture.mipmaps && this.texture.mipmaps[0] && this.texture.mipmaps[0].data;
    if (!d) return false;
    for (let i = 3; i < d.length; i += 4 * 97) if (d[i]) return true;
    return false;
  }
  // ONE SLICE OF THE BAKE (IMP.bakeMs of it; all of it with ?impbake=0), the guard before the first: run by the frame
  // hook, and by flora.js from its update when no frame came between (it is outside a render either way). When the
  // last step is done and the atlas holds a tree, onReady is called, in that same call: flora swaps today's far trees
  // for the impostors there and then. Returns true once the atlas is made or has failed.
  step() {
    if (this.ready || this.failed || !this.renderer) { PENDING.delete(this); return true; }
    try {
      // (THE GUARD, before the first step: the impostor program must compile on this device)
      if (!this._probed) { this._probed = true; const why = this.probe(this.renderer); if (why) { this.fail(why); PENDING.delete(this); return true; } }
      if (_q && _q.get('impfail') === 'bake') throw new Error('forced by ?impfail=bake');
      if (this.bake(this.renderer, IMP.bakeMs > 0 ? IMP.bakeMs : Infinity)) {
        PENDING.delete(this);
        if (!this.texture || !this.hasTree()) this.fail('the atlas came out empty');
        else if (typeof this.onReady === 'function') this.onReady();
        return true;
      }
    } catch (e) { this.fail('the bake threw: ' + ((e && e.message) || e)); PENDING.delete(this); return true; }
    return false;
  }
  // asked by every far tree's mesh while it is drawn and the atlas is not yet made (flora.js)
  request(renderer) {
    if (this.ready || this.failed || !renderer) return;
    this.renderer = renderer;
    hook();
    PENDING.add(this);
  }
  // THE BAKE IN STEPS (the coordinator, 24 Nov: 48 MB baked in one go was about ten seconds in software and an unknown
  // hitch on the phone at the first far draw). A step is one tree at one level: its 64 views drawn into its own square
  // of the target, and that square read back into the level's array. The frame hook runs as many steps as fit in
  // IMP.bakeMs of a frame (always one), and the atlas is made when the last is done; till then flora draws today's far
  // trees (the coordinator, 24 Nov: with the impostors drawing nothing until the last step, the far wood was gone for
  // up to 8 s on the phone after every world load) and counts the bake as busy, so a still waits for it.
  // ?impbake=0: all at once. Returns true when done.
  bake(renderer, budgetMs = 0) {
    const t0 = performance.now();
    const W = this.width, H = this.height, N = IMP.views;
    let B = this._bk;
    if (!B) {
      const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.UnsignedByteType, format: THREE.RGBAFormat, depthBuffer: true, stencilBuffer: false,
        magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter, generateMipmaps: false });
      rt.texture.colorSpace = THREE.NoColorSpace;
      const mat = new THREE.ShaderMaterial({
        vertexShader: BAKE_VERT, fragmentShader: BAKE_FRAG, side: THREE.DoubleSide,
        uniforms: { uC: { value: new THREE.Vector3() }, uR: { value: 1 }, uD: { value: new THREE.Vector3(0, 0, 1) }, uCell: { value: 1 }, uCellK: { value: 1 }, uPad: { value: 0 }, uLeafK: { value: new THREE.Vector2(1, 0) }, uCC: { value: new THREE.Vector3() }, uCRad: { value: new THREE.Vector3(1, 1, 1) }, uDeepK: { value: IMP.deep } },
      });
      const scene = new THREE.Scene();
      const mesh = new THREE.Mesh(this.geos[0], mat);
      mesh.frustumCulled = false;
      scene.add(mesh);
      const levels = [];
      for (let lv = 0; lv < IMP.levels; lv++) { const Wl = W / (1 << lv), Hl = H / (1 << lv); levels.push({ data: new Uint8Array(Wl * Hl * 4), width: Wl, height: Hl }); }
      B = this._bk = { rt, mat, scene, mesh, levels, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 10), step: 0, ms: 0, frames: 0 };
    }
    const { rt, mat, scene, mesh, levels, cam } = B, U = mat.uniforms, C = new THREE.Vector3();
    // the renderer's own state, put back after
    const prevRT = renderer.getRenderTarget(), prevAuto = renderer.autoClear, prevAlpha = renderer.getClearAlpha();
    const prevCol = new THREE.Color(); renderer.getClearColor(prevCol);
    renderer.autoClear = false;
    renderer.setClearColor(0x000000, 0);
    const steps = this.n * IMP.levels;
    do {
      const lv = Math.floor(B.step / this.n), L = B.step % this.n;
      const tile = IMP.tile / (1 << lv), Wl = W / (1 << lv);
      const g = this.geos[L], cr = this.cr[L], rc = cr.w, hh = this.ch[L].x, R = this.ch[L].y;
      mesh.geometry = g;
      C.set(cr.x, cr.y, cr.z);
      // (a texel of this level, taken on the tree's larger side: the stroke grid is IMP.stroke of them, doubled at
      //  each coarser level so the grids nest; the trunk is thickened by a fifth of one; a leaf is never smaller
      //  than IMP.minLeaf of them)
      const texel0 = (2 * Math.max(rc, hh)) / IMP.tile, texel = texel0 * (1 << lv);
      U.uC.value.copy(C); U.uR.value = R; U.uCell.value = IMP.stroke * texel0 * (1 << lv); U.uCellK.value = 1 << lv; U.uPad.value = texel * 0.2;
      U.uLeafK.value.set(this.leafK[L], IMP.minLeaf * 0.5 * texel);
      U.uCC.value.copy(this.ce[L][0]); U.uCRad.value.copy(this.ce[L][1]);
      const col = L % IMP.cols, row = Math.floor(L / IMP.cols), sq = N * tile, x0 = col * sq, y0 = row * sq;
      // (this tree's square of the target, cleared alone)
      rt.scissorTest = true; rt.viewport.set(x0, y0, sq, sq); rt.scissor.set(x0, y0, sq, sq);
      renderer.setRenderTarget(rt);
      renderer.clear(true, true, false);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const d = viewDir(i, j, N), b = viewBasis(d), [hw, hv] = viewRect(d, rc, hh);
        U.uD.value.copy(d);
        cam.left = -hw; cam.right = hw; cam.top = hv; cam.bottom = -hv; cam.near = R * 0.5; cam.far = R * 5.5;
        cam.position.copy(C).addScaledVector(d, R * 3);
        cam.up.copy(b.up);
        cam.lookAt(C);
        cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
        const x = x0 + i * tile, y = y0 + j * tile;
        rt.viewport.set(x, y, tile, tile); rt.scissor.set(x, y, tile, tile);
        renderer.setRenderTarget(rt);
        renderer.render(scene, cam);
      }
      // (its square read back into the level's array, row by row)
      const buf = new Uint8Array(sq * sq * 4), dst = levels[lv].data;
      renderer.readRenderTargetPixels(rt, x0, y0, sq, sq, buf);
      for (let r = 0; r < sq; r++) dst.set(buf.subarray(r * sq * 4, (r + 1) * sq * 4), ((y0 + r) * Wl + x0) * 4);
      B.step++;
    } while (B.step < steps && performance.now() - t0 < budgetMs);
    renderer.setRenderTarget(prevRT);
    renderer.autoClear = prevAuto;
    renderer.setClearColor(prevCol, prevAlpha);
    B.ms += performance.now() - t0; B.frames++;
    if (B.step < steps) return false;
    rt.dispose(); mat.dispose();
    const tex = new THREE.DataTexture(levels[0].data, W, H, THREE.RGBAFormat, THREE.UnsignedByteType);
    tex.mipmaps = levels;
    tex.minFilter = THREE.NearestMipmapNearestFilter; tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false; tex.flipY = false; tex.colorSpace = THREE.NoColorSpace;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    if (this.texture) this.texture.dispose();
    this.texture = tex;
    this.uniforms.uImpTex.value = tex;
    this.uniforms.uImpK.value.x = 1;
    this.ready = true;
    this.ms = B.ms; this.frames = B.frames;
    this.bytes = levels.reduce((s2, l) => s2 + l.data.length, 0);
    this._bk = null;
    if (typeof window !== 'undefined') window.__pcImpostor = this;
    return true;
  }
  dispose() { if (this.texture) this.texture.dispose(); this.texture = null; this.ready = false; PENDING.delete(this); if (this._bk) { this._bk.rt.dispose(); this._bk.mat.dispose(); this._bk = null; } }
}

// One quad a tree: four corners, the shader turns it to the view.
export function impostorQuadGeometry() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  g.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 1, 2, 0, 2, 3]), 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 30);
  return g;
}

// ---- the painted impostor ----------------------------------------------------------------------------------------
const IMP_VERT = /* glsl */`
${VERT_PARS}
${FOG_VERT}
attribute vec4 aInst;     // per instance: x hue, y value, z seed, w canopy shade at its foot
attribute float aBorn;    // when it came into this mesh (negative: when it left), as PROP_VERT
attribute vec2 aInst2;    // x the kind (its colours), y its layer in the atlas (kind slot * 2 + variant)
uniform vec3 uOrigin;
uniform vec3 uCamLocal;
uniform vec4 uLod;
uniform vec3 uWashIn;
uniform vec4 uOilPx;
uniform vec3 uSunDirL;
uniform vec4 uImpK;       // x baked (0: nothing is drawn yet), y views to a side, z texels to a view, w the coarsest level
uniform vec4 uImpAtlas;   // x, y the atlas in texels, z variants to a row, w how far the quad stands toward the eye
uniform vec4 uImpC[PC_IMP_NV];
uniform vec4 uImpH[PC_IMP_NV];
uniform vec3 uFarA[PC_NFAR];
uniform vec3 uFarB[PC_NFAR];
uniform vec3 uFarC[PC_NFAR];
uniform vec4 uFarFam[PC_NFAR];
uniform float uFarKind[PC_NFAR];
uniform vec3 uFarBarkA[PC_NFAR];
uniform vec3 uFarBarkB[PC_NFAR];
#if defined(PC_PHYS) || defined(PC_GUST)
// THE FAR WOOD LEANS WITH THE WIND (?farwind=1, the weather group's far wind field; the coordinator, 24 Nov). The same
// bend every plant reads (physics flora.glsl.js pcPhysBendLite: the bend field near, the far field beyond it once it is
// bound), taken once at the tree's foot, leans the quad over it as a stiff stem leans: the top moves, the foot does not.
// (and with ?gustbands=1 the same file's pcGustBand: GUST below)
${FLORA_GLSL}
#endif
#ifdef PC_PHYS
uniform float uPhysOn;
#endif
#ifdef PC_GUST
uniform float uImpGust;   // 1: the crowns take the gust bands (0: the speed test's row, flora.setImpGust)
#endif
varying vec3 vBody;
varying vec3 vView;
varying vec2 vQuad;
varying float vWash;
varying float vFog;
flat varying vec4 vTile;
flat varying float vLod;
flat varying vec4 vInst;
flat varying vec3 vLA;
flat varying vec3 vLB;
flat varying vec3 vLC;
flat varying vec3 vBA;
flat varying vec3 vBB;
flat varying vec3 vSunK;
flat varying vec3 vUpK;
flat varying vec3 vDepth;
flat varying vec2 vKB;    // x the kind (twigs, snow), y the light of a crown seen against the sun
#ifdef PC_GUST
flat varying float vGust; // how far a gust band has turned this crown's leaves their paler side (0: not at all)
#endif
void main() {
  mat4 im = instanceMatrix;
  vec4 inst = aInst;
  float wsh = clamp((uWashIn.x - max(abs(aBorn), uWashIn.y)) / uWashIn.z, 0.0, 1.0);
  vWash = aBorn < 0.0 ? -(1.0 - clamp((uWashIn.x + aBorn) / uWashIn.z, 0.0, 1.0)) - 1e-3 : wsh;
  vec3 io = im[3].xyz;
  float di = distance(io, uCamLocal);
  float j = 1.0 + (inst.z - 0.5) * uLod.z;
  float vis = step(uLod.x * j, di) * (1.0 - smoothstep(uLod.y * j * uLod.w, uLod.y * j, di)) * uImpK.x;
  int sp = int(aInst2.x + 0.5), ly = int(aInst2.y + 0.5);
  vec4 CR = uImpC[ly];
  vec2 HR = uImpH[ly].xy;   // the cylinder's half height, the ball's radius
  mat3 ir = mat3(im);
  mat3 iv = inverse(ir);
  // the nearest baked view, from the eye's direction in the kit's own space (render/impostor.js viewCell)
  vec3 d = normalize(iv * (uCamLocal - io) - CR.xyz);
  vec3 dh = vec3(d.x, max(d.y, 0.0), d.z);
  dh /= abs(dh.x) + dh.y + abs(dh.z) + 1e-6;
  float N = uImpK.y;
  vec2 cell = clamp(floor((vec2(dh.x + dh.z, dh.x - dh.z) * 0.5 + 0.5) * N), 0.0, N - 1.0);
  vec2 qc = (cell + 0.5) / N * 2.0 - 1.0;
  vec2 pc = vec2(qc.x + qc.y, qc.x - qc.y) * 0.5;
  vec3 dc = normalize(vec3(pc.x, 1.0 - abs(pc.x) - abs(pc.y), pc.y));
  vec3 ref = abs(dc.y) > 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
  vec3 rt = normalize(cross(ref, dc));
  vec3 up = cross(dc, rt);
  // the quad, square to that view, through the crown's middle and stood a little toward the eye; it shrinks into the
  // tree's foot at the end of the range, as every far tree does
  // (framed on the tree's upright cylinder seen from this view: impostor.js viewRect)
  float sinE = clamp(dc.y, 0.0, 1.0);
  vec2 hwv = vec2(CR.w, HR.x * sqrt(1.0 - sinE * sinE) + CR.w * sinE);
  vec3 lp = CR.xyz + rt * (position.x * hwv.x) + up * (position.y * hwv.y) + dc * (HR.y * uImpAtlas.w);
  vec3 wp = (im * vec4(lp * vis, 1.0)).xyz;
  #ifdef PC_PHYS
    if (uPhysOn > 0.5) {
      vec3 rootB = io + uOrigin, upP = normalize(rootB);
      float Hp = 2.0 * HR.x * length(ir[1]);
      wp = io + pcPhysDisplace(wp - io, upP, Hp, pcPhysBendLite(rootB, 1.0));
    }
  #endif
  vBody = wp + uOrigin;
  vec4 mv = modelViewMatrix * vec4(wp + pcRound(io + uOrigin), 1.0);
  vView = mv.xyz;
  vQuad = position.xy * 0.5 + 0.5;
  // where this view lies in the atlas, and the level its size on the screen asks for
  float T = uImpK.z;
  float col = mod(float(ly), uImpAtlas.z), row = floor(float(ly) / uImpAtlas.z);
  vec2 o = (vec2(col, row) * N + cell) * T;
  vTile = vec4(o / uImpAtlas.xy, vec2(T) / uImpAtlas.xy);
  float px = 2.0 * max(hwv.x * length(ir[0]), hwv.y * length(ir[1])) / max(di * uOilPx.x, 1e-4);
  // (a stroke at least about 2.5 px on the phone's 372 lines and about 3.5 px at 1080 (the look director, R3.3): the
  //  level is taken coarser by as much on a taller picture)
  float lb = log2(1.0 + 0.4 * clamp((uOilPx.y - 372.0) / 708.0, 0.0, 1.5));
  vLod = clamp(floor(log2(T / max(px, 1e-3)) + 0.5 + lb), 0.0, uImpK.w);
  // the tree's own colour run (as PROP_VERT and PROP_FRAG lay it for the crowns)
  vec3 lA = uFarA[sp], lB = uFarB[sp], lC = uFarC[sp];
  vec4 famL = uFarFam[sp];
  if (famL.a > 0.0) {
    float tf = fract(inst.z * 9.73 + 0.37);
    float cF = tf < 0.4 ? tf * 0.5 : (tf < 0.8 ? 0.3 + (tf - 0.4) * 0.75 : 0.75 + (tf - 0.8) * 1.25);
    float a0 = clamp(cF - 0.13, 0.0, 1.0), b0 = clamp(cF + 0.13, 0.0, 1.0);
    vec3 pa = a0 < 0.5 ? mix(lA, lB, a0 * 2.0) : mix(lB, famL.rgb, a0 * 2.0 - 1.0);
    vec3 pb = b0 < 0.5 ? mix(lA, lB, b0 * 2.0) : mix(lB, famL.rgb, b0 * 2.0 - 1.0);
    vec3 lC0 = lC;
    lA = mix(lA, pa, famL.a); lB = mix(lB, pb, famL.a);
    lC = mix(lC0, mix(pb, lC0, 0.55) * vec3(0.92, 0.80, 0.84), famL.a);
  }
  vLA = lA; vLB = lB; vLC = lC; vBA = uFarBarkA[sp]; vBB = uFarBarkB[sp];
  vInst = inst;
  // THE GUST BANDS SEEN FROM THE AIR (?gustbands=1 or ?wx2=1, the weather group, 24 Nov: "seen from above a gust is a
  // SHEEN: the leaves turn their paler side and the pale patch runs downwind"; physics flora.glsl.js pcGustBand, one read
  // of the shared noise). Read ONCE A TREE at its foot, so a crown turns whole and each stroke stays one colour; and each
  // tree turns at its own threshold (its seed), so a band is a ragged patch of turned crowns, not a stripe with a soft
  // edge, and a weaker wind (lower band values) turns fewer of them. The colour step is the ground's own (materials.js
  // pcGroundPaint, PC_GUST): paler, a little cooler, so a band crosses meadow and wood as one thing.
  // (the look director, 24 Nov, from 600 m: "the turned crowns are 2 to 3 pixels and each tree turns at its own
  //  threshold, so the band becomes a salt of pale specks over the whole wood ... grain". Asked: the spread of the trees'
  //  thresholds narrows with the crown's width on the screen (gK: 0 at 4 px and under, 1 at 10 px and over), so under a
  //  band small crowns turn together; and a small crown's step is two thirds as strong, so the far bands do not outshout
  //  the near ones. From 10 px up (the near wood from 150 m) all is as it was, which the look director passed.
  //  MEASURED at 600 m: neither this nor reading the band as a mean of five points round the foot (tried, taken out)
  //  made fewer specks: the specks are the turned crowns' own lit strokes, a paler third colour in a wood of 2 to 5 px
  //  crowns of lit and dark strokes. What the far bands should be is with the look director.)
  #ifdef PC_GUST
    float gPx = 2.0 * hwv.x * length(ir[0]) / max(di * uOilPx.x, 1e-4);      // (the crown's width on the screen, px)
    float gK = smoothstep(4.0, 10.0, gPx);
    float gTh = 0.375 + (fract(inst.z * 4.37 + 0.11) - 0.5) * 0.45 * gK;
    vGust = step(gTh, pcGustBand(io + uOrigin)) * 0.85 * mix(0.67, 1.0, gK) * uImpGust;
  #endif
  // the sun, up and the line of sight in the kit's own space (the crown's mass normals are measured there)
  mat3 rot = mat3(normalize(ir[0]), normalize(ir[1]), normalize(ir[2]));
  vSunK = transpose(rot) * uSunDirL;
  vUpK = transpose(rot) * normalize(io + uOrigin);
  vDepth = ir * (dc * HR.y);
  vKB = vec2(uFarKind[sp], pow(max(dot(normalize(io - uCamLocal), uSunDirL), 0.0), 1.5));
  vFog = pcFogAmountV(di * pcFogBank(vBody));
  gl_Position = projectionMatrix * mv;
  ${VERT_END}
}
`;

const IMP_FRAG = /* glsl */`
${FRAG_PARS}
${PC_UP_F}
uniform highp sampler2D uImpTex;
uniform vec4 uImpK;
uniform vec4 uImpAtlas;
uniform float uCanopy;
varying vec3 vBody;
varying vec3 vView;
varying vec2 vQuad;
varying float vWash;
varying float vFog;
flat varying vec4 vTile;
flat varying float vLod;
flat varying vec4 vInst;
flat varying vec3 vLA;
flat varying vec3 vLB;
flat varying vec3 vLC;
flat varying vec3 vBA;
flat varying vec3 vBB;
flat varying vec3 vSunK;
flat varying vec3 vUpK;
flat varying vec3 vDepth;
flat varying vec2 vKB;
#ifdef PC_GUST
flat varying float vGust;
#endif
void main() {
  #include <logdepthbuf_fragment>
  // (the speed test, shared.js uOilL.y = 4: written at once, before the atlas is read or anything is cut away; alpha 1,
  //  the whole quad covered, or alpha to coverage on a multisampled picture would lay none of it)
  if (uOilL.y > 3.5 && uOilL.y < 4.5) { pcWrite(vec3(0.42, 0.40, 0.32), 1.0, vec3(0.0, 0.0, 1.0), -vView.z, 3.0); return; }
  // THE SILHOUETTE BY COVER, NOT BY THE TEXEL'S SQUARE (the look director: stair-steps at the pixel). The four texels
  // round the point are read; how much of them is tree, weighed as the point lies among them, is the cover. Where it is
  // under a half (a quarter on a multisampled picture, which alpha to coverage then edges) nothing is laid; the paint
  // is the nearest texel of tree. So the outline is the cover's own smooth line through the texels, at the pixel.
  float T = uImpK.z * exp2(-vLod);
  int li = int(vLod + 0.5);
  vec2 lsz = vec2(textureSize(uImpTex, li));
  vec2 t0 = vTile.xy * lsz, tq = vec2(T);
  vec2 tc = t0 + clamp(vQuad * tq, vec2(0.5), tq - 0.5) - 0.5;
  vec2 i0 = floor(tc), fq = tc - i0;
  vec2 lo = t0, hi = t0 + tq - 1.0;
  vec4 a00 = texelFetch(uImpTex, ivec2(clamp(i0, lo, hi)), li);
  vec4 a10 = texelFetch(uImpTex, ivec2(clamp(i0 + vec2(1.0, 0.0), lo, hi)), li);
  vec4 a01 = texelFetch(uImpTex, ivec2(clamp(i0 + vec2(0.0, 1.0), lo, hi)), li);
  vec4 a11 = texelFetch(uImpTex, ivec2(clamp(i0 + vec2(1.0, 1.0), lo, hi)), li);
  vec4 o4 = step(vec4(0.002), vec4(a00.a, a10.a, a01.a, a11.a));
  float cover = mix(mix(o4.x, o4.y, fq.x), mix(o4.z, o4.w, fq.x), fq.y);
  if (cover < (uOilG.z > 0.5 ? 0.25 : 0.5)) discard;
  // (the nearest texel that is tree)
  vec4 t = fq.x < 0.5 ? (fq.y < 0.5 ? a00 : a01) : (fq.y < 0.5 ? a10 : a11);
  if (t.a < 0.002) t = o4.x > 0.5 ? a00 : o4.y > 0.5 ? a10 : o4.z > 0.5 ? a01 : a11;
  // a tree being laid (or lifted) as it changes hands: broken touches anchored to the tree, as PROP_FRAG does
  if (vWash < 0.999) {
    float vd = length(vView);
    float ws = exp2(floor(log2(max(vd, 30.0) / 60.0) + 0.5));
    float wn = textureLod(uNoise3D, vBody / (2.3 * ws), 0.0).g * 0.5 + textureLod(uNoise3D, vBody / (0.6 * ws), 0.0).b * 0.5;
    wn = clamp((wn - 0.5) * 1.5 + 0.5, 0.02, 0.98);
    if (vWash >= 0.0 ? wn > vWash : wn < 1.0 + vWash) discard;
  }
  vec4 e = floor(t * 255.0 + 0.5);
  float id = e.r / 255.0;
  float qx = floor(e.g / 4.0), az = (e.g - qx * 4.0) / 3.0;
  float qy = floor(e.b / 4.0), cls = e.b - qy * 4.0;
  vec2 o = vec2(qx, qy) / 63.0 * 2.0 - 1.0;
  vec3 n = vec3(o, 1.0 - abs(o.x) - abs(o.y));
  if (n.z < 0.0) n.xy = (1.0 - abs(n.yx)) * vec2(n.x >= 0.0 ? 1.0 : -1.0, n.y >= 0.0 ? 1.0 : -1.0);
  n = normalize(n);
  #ifdef PC_IMP_DEBUG
    // (?impdebug=1: what an impostor reads, flat: wood brown, leaves by the level read (0 green, 1 cyan, 2 yellow,
    //  3 magenta, 4 red, 5 white), the core grey)
    vec3 lvc = vLod < 0.5 ? vec3(0.2, 0.8, 0.2) : vLod < 1.5 ? vec3(0.2, 0.8, 0.9) : vLod < 2.5 ? vec3(0.95, 0.9, 0.2) : vLod < 3.5 ? vec3(0.9, 0.2, 0.9) : vLod < 4.5 ? vec3(0.9, 0.2, 0.1) : vec3(1.0);
    pcWrite(cls < 0.5 ? vec3(0.45, 0.3, 0.15) : cls > 2.5 ? vec3(0.4) : lvc, clamp(cover, 0.0, 1.0), vec3(0.0, 0.0, 1.0), -vView.z, 3.0); return;
  #endif
  // (the speed test's flat plants, 2 and 3: every far tree one flat colour, its outline kept; the cover as the paint's
  //  alpha, as below, or alpha to coverage on a multisampled picture would lay none of it)
  if (uOilL.y > 1.5 && uOilL.y < 3.5) { pcWrite(cls < 0.5 ? vBB : vLA * 0.7, clamp(cover, 0.0, 1.0), vec3(0.0, 0.0, 1.0), -vView.z, 3.0); return; }
  vec3 r3 = vec3(id, fract(id * 13.7), fract(id * 5.1));
  float ms = dot(n, vSunK);
  ${SKYUP('dot(n, vUpK)')}
  // the sun on the stroke: the crown's own lit side and shaded side (its place in the crown dotted with the sun, as a
  // far crown of flat pieces takes it, PROP_VERT), and inside the shadow square what the map says as well, whole
  float canopy = vInst.w * uCanopy * 0.4;
  float rSun = mix(r3.z, 0.5 + 0.5 * ms - (r3.z - 0.5) * 0.22 * ${'${IMPJIT}'}, ${'${FARCROWN}'});
  float sun = mix(step(mix(0.05, 0.585, canopy), rSun), 1.0 - 0.42 * canopy, uWx.x);
  // (no read of the shadow map: a texel's own place on the quad would cut a stroke in two at a shadow's edge, one step
  //  a stroke being the rule; the far crowns are beyond what the near and middle trees throw on them, and they cast
  //  nothing themselves unless ?impshadow=1 -- and then their crowns take the crown's own light, as here)
  vec3 c;
  float rid = 3.0;
  if (cls < 0.5) {
    // bark: its own pair of washes, lit by its own normal
    vec3 bc = mix(vBB, vBA, 0.30 + 0.30 * r3.y);
    float xb = ms * 0.5 + 0.5;
    c = pcTone(pcBody(bc), pcLevel(mix(min(xb, 0.44), xb, sun), 0.03));
  } else {
    // a stroke of leaves: its colour from the tree's run by its own number, its light at its centre (PROP_VERT, "a
    // leaf's paint, once a leaf": the same steps, and the same tone function every surface takes, pcTone)
    float twig = step(1.5, vKB.x);
    // SMALL CROWNS IN TWO STEPS (the default; ?impsmall=0 the old way; the look director, 24 Nov: "at the coarse levels only (a view of 12 texels
    // or fewer), pull a crown's strokes toward two steps: the cap one step, the rest of the crown one step, so each small
    // crown reads as one lit mass with its shade, not lit and dark alternating; leave 24+ texels as they are. Keep the
    // step difference between cap and body at one level (not less)". SEEN before it, from 1 km over the far view's
    // canopy roof: crowns of 1-3 px each split into lit and dark strokes made the wood V 0.49 with a third of it under
    // V 0.3, against the roof's 0.74 past the impostors' reach.) The strokes facing the sun are the cap, at the level a
    // lit stroke of this crown takes; every other stroke is the body, one level under it. No stroke's own light jitter
    // and no inner shade there; each stroke keeps its own colour. The conifer's dark core is left as it is.
    bool small = false;
    #ifdef PC_IMP_SMALL
      small = uImpK.z * exp2(-vLod) < float(IMPS_T) + 0.5;
    #endif
    float azL = small ? 0.0 : az;
    float hue = vInst.x + (id - 0.5) * 1.7;
    vec3 cs = mix(vLA, vLB, clamp(0.5 + hue * 0.5, 0.0, 1.0));
    cs = mix(cs, vLC, clamp(azL * 0.55 + (r3.y - 0.5) * 0.6, 0.0, 1.0));
    cs = pcSummerTree(cs, fract(vInst.z * 9.73 + 0.37), uLookG.y);      // (each summer tree its own green, as PROP_VERT and PROP_FRAG: chunks.js; the look director)
    // (a crown a gust band has turned: the ground's own pale, cooler step, whole: GUST in the vertex shader)
    #ifdef PC_GUST
      if (vGust > 0.0) cs = mix(cs, min(vec3(1.0), mix(cs, vec3(dot(cs, vec3(0.3, 0.5, 0.2))), 0.45) * 1.12 + vec3(0.01, 0.03, 0.06)), vGust);
    #endif
    cs = pcWetWash(pcDabTint(pcDensity(cs, 1.0 + vInst.y * 0.4), r3, 1.0 - twig), 0.7);
    bool snow = cls > 1.5 && cls < 2.5;
    if (snow) cs = mix(vec3(0.95, 0.97, 1.0), vec3(0.80, 0.87, 0.98), r3.x * 0.7);
    float xl = (ms * 0.5 + 0.5) * (1.0 - az * 0.35);
    xl = max(xl, vKB.y * (0.6 + 0.4 * r3.x) * (1.0 - twig));
    if (snow) xl = max(xl, 0.58 + 0.2 * r3.y);
    xl *= mix(mix(0.50, 0.30, ${'${FARCROWN}'}), 1.0, sun);
    // (a near leaf's light is jittered by its own number so each leaf is its own tone; a stroke of a far crown keeps
    //  only a share of that, or the crown is a speckle of lit and dark touches and not a lit mass and a shaded one:
    //  SEEN from 150 m, IMP.jit)
    xl += (r3.z - 0.5) * 0.25 * ${'${IMPJIT}'};
    xl = max(xl, mix(0.30 + 0.15 * r3.x, 0.18 + 0.12 * r3.x, ${'${FARCROWN}'}));
    if (cls > 2.5) xl = 0.2;
    float lv = pcLevel(xl, 0.03);
    if (small && cls < 2.5) {
      // (the cap's level: a stroke of this crown facing the sun at 0.6, lit, with the crown's own light against the sun)
      float xc = max(0.80, vKB.y * 0.8 * (1.0 - twig));
      if (snow) xc = max(xc, 0.68);
      float lc = floor(pcLevel(xc, 0.002) + 0.5);      // (a soft of 0 would be a smoothstep with equal edges: undefined)
      float cap = step(mix(0.05, 0.585, canopy), 0.5 + 0.5 * ms);
      lv = cap > 0.5 ? lc : max(lc - 1.0, 0.0);
    }
    // (the shade of a crown through the shared foliage shade where the build has it, chunks.js pcShadeLeaf, as a
    //  near leaf takes its own; otherwise pcTone alone)
    c = ${'${IMPSHADE}'};
    // (nothing of a crown under V 0.18: the look director's floor for the darkest conifer, R1.2c)
    float vmx = max(c.r, max(c.g, c.b));
    if (vmx < 0.18) c *= 0.18 / max(vmx, 1e-3);
    rid = 4.0 + fract(vInst.z * 7.0 + id * 0.37) * 0.9;
  }
  if (!(uOilL.y > 5.5 && uOilL.y < 6.5)) c = pcAtmosV(c, vFog, vView);
  // (the first target's alpha is the cover, for alpha to coverage, as the plants write theirs)
  pcWrite(c, clamp(cover, 0.0, 1.0), vec3(0.0, 0.0, 1.0), -vView.z, rid);
}
`;

// The impostor material for one world: the atlas's uniforms, and the far material's own colour tables (shared, so the
// turn of the year written into the far trees' colours reaches the impostors in the same breath: flora.js setSeason).
export function makeImpostorMaterial(bodyU, atlas, farMat, farcrown = FARCROWN) {
  const fu = farMat.uniforms;
  const own = Object.assign({
    uOrigin: { value: new THREE.Vector3() }, uCamLocal: { value: new THREE.Vector3() },
    uLod: { value: new THREE.Vector4(0, 1e9, 0, 0.9) },
    uWashIn: { value: new THREE.Vector3(1e6, 0, 0.55) },
    uCanopy: { value: 1 },
    uFarA: fu.uFarA, uFarB: fu.uFarB, uFarC: fu.uFarC, uFarFam: fu.uFarFam, uFarKind: fu.uFarKind, uFarBarkA: fu.uFarBarkA, uFarBarkB: fu.uFarBarkB,
  }, atlas.uniforms);
  const fc = (+farcrown).toFixed(4);
  // (the far wind: the plants' own physics uniforms, shared by reference; ?farwind=1)
  const wind = !!(_q && _q.get('farwind') === '1');
  if (wind) Object.assign(own, PHYS, { uStiff: { value: 1 }, uPlantHeight: { value: 12 } });
  // (the gust bands: compiled in only where the shared binding exists, render/shared.js PHYS.uPhysGust -- no unbound
  //  uniform anywhere -- and only with ?gustbands=1 or ?wx2=1, read from the address as the weather's contract asks)
  const gust = GUSTBANDS && !!PHYS.uPhysGust;
  if (gust) Object.assign(own, PHYS, { uImpGust: { value: 1 } });      // (the whole PHYS block by reference, as with the lean: FLORA_GLSL is compiled for the bands)
  const m = new THREE.ShaderMaterial({
    name: 'pc-prop-far-impostor',
    defines: Object.assign({ PC_IMPOSTOR: 1, PC_IMP_NV: Math.max(1, atlas.n), PC_NFAR: fu.uFarA.value.length }, _q && _q.get('impdebug') === '1' ? { PC_IMP_DEBUG: 1 } : null, wind ? { PC_PHYS: 1 } : null, gust ? { PC_GUST: 1 } : null,
      IMP.small > 0 ? { PC_IMP_SMALL: 1, IMPS_T: IMP.small.toFixed(1) } : null),
    uniforms: makePaintUniforms(bodyU, own),
    vertexShader: IMP_VERT,
    fragmentShader: IMP_FRAG.split('${FARCROWN}').join(fc).split('${IMPJIT}').join((+IMP.jit).toFixed(4))
      .split('${IMPSHADE}').join(/vec3\s+pcShadeLeaf\s*\(/.test(FRAG_PARS) ? 'mix(pcShadeLeaf(cs), pcTone(cs, lv), smoothstep(1.2, 2.0, lv))' : 'pcTone(cs, lv)')
      + (_q && _q.get('impfail') === 'compile' ? '\n#error forced by impfail compile\n' : ''),
    side: THREE.DoubleSide,
  });
  m.userData.pcPainted = true;
  m.alphaToCoverage = true;      // (the silhouette's cover: IMP_FRAG)
  m.userData.impAtlas = atlas;
  atlas.material = m;
  register(m, 'impostor', null);
  return m;
}

// ---- the impostors' own cast shadows, from the air (T6's option; ?impshadow=1) ---------------------------------------
// A far tree has thrown no shadow in the oil look (flora.js: the 138-triangle far tree drawn again from the sun was 2.8
// ms on the phone), so from the air no crown has a shadow lying beside it (LOOK-RULES R1.3d; the references from a few
// hundred metres: "each tree ... with its shadow lying on the grass beside it"). An impostor can throw one for two
// triangles: its quad is turned to face the SUN, the view baked nearest the sun's direction is read, and only the
// strokes that are there are drawn into the map -- the crown's silhouette as the sun sees it. A share of a crown's strokes
// casts, as a share of a near crown's leaves does (shadow.js uThinLeaf), so the shade on the floor is broken by light.
// Drawn only from the air (shadow.js: SHADOW_CROWD, the shadow pass's own list of meshes with a shadow twin), where no
// near or middle tree stands in the square at all.
export const IMP_SHADOW = _q ? _q.get('impshadow') === '1' : false;
const IMP_SH_VERT = /* glsl */`
attribute vec4 aInst;
attribute vec2 aInst2;
uniform vec3 uCamLocal;
uniform vec4 uLod;
uniform float uInv;
uniform vec3 uSunDirL;
uniform vec4 uImpK;
uniform vec4 uImpAtlas;
uniform vec4 uImpC[PC_IMP_NV];
uniform vec4 uImpH[PC_IMP_NV];
uniform vec4 uShK;
varying float vS;
varying vec2 vQuad;
flat varying vec4 vTile;
flat varying float vLod;
void main() {
  mat4 im = instanceMatrix;
  vec3 io = im[3].xyz;
  float di = distance(io, uCamLocal);
  float j = 1.0 + (aInst.z - 0.5) * uLod.z;
  float vis = step(uLod.x * j, di) * (1.0 - smoothstep(uLod.y * j * uLod.w, uLod.y * j, di)) * uImpK.x;
  int ly = int(aInst2.y + 0.5);
  vec4 CR = uImpC[ly];
  vec2 HR = uImpH[ly].xy;
  mat3 ir = mat3(im);
  vec3 d = normalize(inverse(ir) * uSunDirL);
  vec3 dh = vec3(d.x, max(d.y, 0.0), d.z);
  dh /= abs(dh.x) + dh.y + abs(dh.z) + 1e-6;
  float N = uImpK.y;
  vec2 cell = clamp(floor((vec2(dh.x + dh.z, dh.x - dh.z) * 0.5 + 0.5) * N), 0.0, N - 1.0);
  vec2 qc = (cell + 0.5) / N * 2.0 - 1.0;
  vec2 pc = vec2(qc.x + qc.y, qc.x - qc.y) * 0.5;
  vec3 dc = normalize(vec3(pc.x, 1.0 - abs(pc.x) - abs(pc.y), pc.y));
  vec3 ref = abs(dc.y) > 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
  vec3 rt = normalize(cross(ref, dc));
  vec3 up = cross(dc, rt);
  float sinE = clamp(dc.y, 0.0, 1.0);
  vec2 hwv = vec2(CR.w, HR.x * sqrt(1.0 - sinE * sinE) + CR.w * sinE);
  vec3 lp = CR.xyz + rt * (position.x * hwv.x) + up * (position.y * hwv.y);
  vec3 wp = (im * vec4(lp * vis, 1.0)).xyz;
  vec4 mv = modelViewMatrix * vec4(wp, 1.0);
  vS = -mv.z * uInv;
  vQuad = position.xy * 0.5 + 0.5;
  float T = uImpK.z;
  float col = mod(float(ly), uImpAtlas.z), row = floor(float(ly) / uImpAtlas.z);
  vTile = vec4(((vec2(col, row) * N + cell) * T) / uImpAtlas.xy, vec2(T) / uImpAtlas.xy);
  // (the level by the map's own texel: the square is projectionMatrix's 2 / width across, uShK.z one texel of it)
  float texel = 2.0 / max(projectionMatrix[0][0], 1e-6) * max(uShK.z, 1.0 / 4096.0);
  float px = 2.0 * max(hwv.x * length(ir[0]), hwv.y * length(ir[1])) / max(texel, 1e-4);
  vLod = clamp(floor(log2(T / max(px, 1e-3)) + 0.5), 0.0, uImpK.w);
  gl_Position = projectionMatrix * mv;
}
`;
const IMP_SH_FRAG = /* glsl */`
uniform highp sampler2D uImpTex;
uniform vec4 uImpK;
uniform float uThinLeaf;
varying float vS;
varying vec2 vQuad;
flat varying vec4 vTile;
flat varying float vLod;
void main() {
  float T = uImpK.z * exp2(-vLod);
  vec2 uq = clamp(vQuad, 0.5 / T, 1.0 - 0.5 / T);
  vec4 t = textureLod(uImpTex, vTile.xy + uq * vTile.zw, vLod);
  if (t.a < 0.002) discard;
  float cls = floor(t.b * 255.0 + 0.5) - floor(floor(t.b * 255.0 + 0.5) / 4.0) * 4.0;
  // (a share of the crown's strokes casts, each whole, by its own number: shadow.js uThinLeaf, as a near crown's leaves)
  if (cls > 0.5 && cls < 2.5 && fract(t.r * 7.31 + 0.13) < uThinLeaf) discard;
  gl_FragColor = vec4(vS, 0.0, 0.0, 1.0);
}
`;
// The shadow twin of an impostor material (shadow.js asks for it once, with its own uInv): the atlas and the sun shared
// by reference, its own copies of what flora.js writes per mesh before each draw.
export function makeImpostorShadowMaterial(impMat, uInv) {
  const u = impMat.uniforms;
  return new THREE.ShaderMaterial({
    name: 'pc-shadow-impostor',
    defines: { PC_IMP_NV: impMat.defines.PC_IMP_NV },
    uniforms: {
      uOrigin: { value: new THREE.Vector3() }, uCamLocal: { value: new THREE.Vector3() }, uLod: { value: new THREE.Vector4(0, 1e9, 0, 0.9) },
      uWashIn: { value: new THREE.Vector3(1e6, 0, 0.55) },
      uInv, uSunDirL: u.uSunDirL, uImpK: u.uImpK, uImpAtlas: u.uImpAtlas, uImpC: u.uImpC, uImpH: u.uImpH, uImpTex: u.uImpTex,
      uShK: OIL.uShK, uThinLeaf: { value: 0.66 },
    },
    vertexShader: IMP_SH_VERT, fragmentShader: IMP_SH_FRAG, side: THREE.DoubleSide,
  });
}
