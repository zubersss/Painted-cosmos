// Painted Cosmos physics: draw kits, the arithmetic. OWNER: PHYSICS.
// Pure (no three, no DOM): typed arrays in, typed arrays out, nothing allocated per call.
// kits.js wraps these in three.js objects; anyone may also call them directly.
//
// Everything is in the coordinates of the buffer being drawn: body-local axes, relative to
// that buffer's `origin` (the floating-origin rule, COORDINATOR C3). The caller gives the
// camera in the same coordinates.
//
// A quad is four vertices in the order (0,0) (1,0) (1,1) (0,1) of its uv; two triangles
// 0-1-2 and 0-2-3. For a streak u runs across and v from head to tail; for a mark u runs
// across and v along its direction.

// How each kind of particle is drawn, by default. PAINTER overrides any of it (the look is
// PAINTER's): pass { draw: { rain: { width: 0.02 } } } to the kit.
//   streak: a quad from where the particle is to where it was `exposure` seconds ago, as the
//           eye or a shutter sees it, `width` metres wide and at least `min` long
//   dab:    a quad facing the camera, `size` metres across (a real snowflake is 4 mm: these
//           are brush marks, not grains), growing by `grow` m/s as it ages (a puff of dust
//           spreads), turning at `spin` rad/s in the picture plane (a leaf tumbles)
//   fadeIn: seconds over which a new particle grows to full size (nothing pops in)
//   minPx:  the least width (streak) or size (dab) on screen, in pixels: a 1 cm streak is
//           under a pixel beyond 15 m and would flicker in and out of the raster
//   vary:   0..1 how much the shade differs from particle to particle (the `color` attribute)
export const DRAW = Object.freeze({
  rain: Object.freeze({ shape: 'streak', width: 0.012, exposure: 0.04, min: 0.05, fadeIn: 0, vary: 0, minPx: 1.2 }),
  hail: Object.freeze({ shape: 'streak', width: 0.024, exposure: 0.018, min: 0.03, fadeIn: 0, vary: 0, minPx: 1.2 }),
  sand: Object.freeze({ shape: 'streak', width: 0.014, exposure: 0.03, min: 0.02, fadeIn: 0.05, vary: 0.3, minPx: 1.2 }),
  spray: Object.freeze({ shape: 'streak', width: 0.018, exposure: 0.03, min: 0.03, fadeIn: 0, vary: 0, minPx: 1.2 }),
  snow: Object.freeze({ shape: 'dab', size: 0.035, grow: 0, spin: 0, fadeIn: 0.25, vary: 0, minPx: 1.6 }),
  dust: Object.freeze({ shape: 'dab', size: 0.16, grow: 0.3, spin: 0, fadeIn: 0.15, vary: 0.35, minPx: 1.6 }),
  ash: Object.freeze({ shape: 'dab', size: 0.03, grow: 0, spin: 1.5, fadeIn: 0.3, vary: 0.4, minPx: 1.6 }),
  spores: Object.freeze({ shape: 'dab', size: 0.03, grow: 0, spin: 0, fadeIn: 0.4, vary: 0.3, minPx: 1.6 }),
  leaves: Object.freeze({ shape: 'dab', size: 0.075, grow: 0, spin: 3.2, fadeIn: 0.3, vary: 0.5, minPx: 1.6 }),
});

// What the eye is doing, for the particle expanders. All in buffer coordinates.
//   x, y, z        camera position
//   vx, vy, vz     camera velocity (a streak is the particle's motion relative to the eye:
//                  run through rain and it slants toward you)
//   rx.. ux..      unit right and up of the picture plane
//   fx, fy, fz     centre of the particle volume (the focus); radius: its half-width (m).
//                  Particles shrink to nothing over the outer fifth, so the edge of the
//                  simulated volume is never a visible wall.
//   pix            metres that one pixel covers at one metre from the eye:
//                  2 tan(fov / 2) / (viewport height in pixels). 0 = no least size.
export function makeEye() {
  return { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 1, ry: 0, rz: 0, ux: 0, uy: 1, uz: 0, fx: 0, fy: 0, fz: 0, radius: 0, pix: 0 };
}

function edgeScale(px, py, pz, eye) {
  if (!(eye.radius > 0)) return 1;
  const dx = px - eye.fx, dy = py - eye.fy, dz = pz - eye.fz;
  const t = (Math.sqrt(dx * dx + dy * dy + dz * dz) / eye.radius - 0.8) / 0.2;
  return t <= 0 ? 1 : t >= 1 ? 0 : 1 - t * t * (3 - 2 * t);
}

// Streaks. buf: a particle buffer of physics.particles; D: its DRAW entry; out: Float32Array of
// at least count * 12. Returns the number of quads written (= the particles drawn).
export function expandStreaks(buf, D, eye, out) {
  const n = Math.min(buf.count, Math.floor(out.length / 12)), P = buf.pos, V = buf.vel, A = buf.age;
  const ex = D.exposure, hw = D.width * 0.5, min = D.min || 0, fin = D.fadeIn || 0, least = 0.5 * (D.minPx || 0) * eye.pix;
  for (let i = 0, o = 0, q = 0; i < n; i++, o += 3, q += 12) {
    const px = P[o], py = P[o + 1], pz = P[o + 2];
    // motion relative to the eye over the exposure
    let sx = (V[o] - eye.vx) * ex, sy = (V[o + 1] - eye.vy) * ex, sz = (V[o + 2] - eye.vz) * ex;
    let sl = Math.sqrt(sx * sx + sy * sy + sz * sz);
    if (sl < min) {
      if (sl > 1e-6) { const k = min / sl; sx *= k; sy *= k; sz *= k; } else { sx = eye.ux * min; sy = eye.uy * min; sz = eye.uz * min; }
      sl = min;
    }
    // across the streak, facing the eye: (motion) x (line of sight)
    const tx = px - eye.x, ty = py - eye.y, tz = pz - eye.z;
    let wx = sy * tz - sz * ty, wy = sz * tx - sx * tz, wz = sx * ty - sy * tx;
    let wl = Math.sqrt(wx * wx + wy * wy + wz * wz);
    if (wl < 1e-9) { wx = eye.rx; wy = eye.ry; wz = eye.rz; wl = 1; }   // coming straight at the eye
    let half = hw;
    if (least > 0) { const far = least * Math.sqrt(tx * tx + ty * ty + tz * tz); if (far > half) half = far; }
    let k = half / wl * edgeScale(px, py, pz, eye);
    if (fin > 0 && A[i] < fin) k *= A[i] / fin;
    wx *= k; wy *= k; wz *= k;
    const hx = px - sx, hy = py - sy, hz = pz - sz;                      // where it was
    out[q] = px - wx; out[q + 1] = py - wy; out[q + 2] = pz - wz;
    out[q + 3] = px + wx; out[q + 4] = py + wy; out[q + 5] = pz + wz;
    out[q + 6] = hx + wx; out[q + 7] = hy + wy; out[q + 8] = hz + wz;
    out[q + 9] = hx - wx; out[q + 10] = hy - wy; out[q + 11] = hz - wz;
  }
  return n;
}

// Dabs: quads facing the camera. Same arguments as expandStreaks.
export function expandDabs(buf, D, eye, out) {
  const n = Math.min(buf.count, Math.floor(out.length / 12)), P = buf.pos, A = buf.age, S = buf.size;
  const fin = D.fadeIn || 0, grow = D.grow || 0, spin = D.spin || 0, least = 0.5 * (D.minPx || 0) * eye.pix;
  for (let i = 0, o = 0, q = 0; i < n; i++, o += 3, q += 12) {
    const px = P[o], py = P[o + 1], pz = P[o + 2], age = A[i];
    let h = 0.5 * (D.size + grow * age);
    if (least > 0) { const tx = px - eye.x, ty = py - eye.y, tz = pz - eye.z, far = least * Math.sqrt(tx * tx + ty * ty + tz * tz); if (far > h) h = far; }
    h *= edgeScale(px, py, pz, eye);
    if (fin > 0 && age < fin) h *= age / fin;
    let ax = eye.rx, ay = eye.ry, az = eye.rz, bx = eye.ux, by = eye.uy, bz = eye.uz;
    if (spin !== 0) {
      // each particle keeps its own phase (its size is its own and travels with it)
      const a = age * spin + S[i] * 51413.7, c = Math.cos(a), s = Math.sin(a);
      ax = eye.rx * c + eye.ux * s; ay = eye.ry * c + eye.uy * s; az = eye.rz * c + eye.uz * s;
      bx = eye.ux * c - eye.rx * s; by = eye.uy * c - eye.ry * s; bz = eye.uz * c - eye.rz * s;
    }
    ax *= h; ay *= h; az *= h; bx *= h; by *= h; bz *= h;
    out[q] = px - ax - bx; out[q + 1] = py - ay - by; out[q + 2] = pz - az - bz;
    out[q + 3] = px + ax - bx; out[q + 4] = py + ay - by; out[q + 5] = pz + az - bz;
    out[q + 6] = px + ax + bx; out[q + 7] = py + ay + by; out[q + 8] = pz + az + bz;
    out[q + 9] = px - ax + bx; out[q + 10] = py - ay + by; out[q + 11] = pz - az + bz;
  }
  return n;
}

// A shade per particle (the same on its four vertices) in 1 - vary .. 1, stable for the life
// of the particle. out: Float32Array of at least count * 12 (rgb per vertex, grey).
export function expandShades(buf, vary, out) {
  const n = Math.min(buf.count, Math.floor(out.length / 12)), S = buf.size;
  for (let i = 0, q = 0; i < n; i++, q += 12) {
    const h = S[i] * 73856.093; const g = 1 - vary * (h - Math.floor(h));
    for (let k = 0; k < 12; k++) out[q + k] = g;
  }
  return n;
}

// Ground marks (physics.fields.deform.marks): one quad per live mark, laid on the ground.
//   frame: physics.fields.frame.  heightAt(x, z) -> m above the frame's datum, or NaN where
//   the near field does not know the ground (the quad then lies in the mark's own tangent plane).
//   time: physics.time.  lift: m above the ground (decals need a little; also give the material
//   a polygon offset).
//   pos: Float32Array(capacity * 12), relative to marks.origin.
//   data: Float32Array(capacity * 16) or null: per vertex (depth m, rim m, kind, fade 0..1).
//   shade: Float32Array(capacity * 12) or null: grey per vertex, darker where deeper and
//          fresher (so a stand-in material with vertex colours shows the print at all).
// Returns the number of quads.
const _d = new Float64Array(3);
export function expandMarks(marks, frame, heightAt, time, lift, pos, data, shade) {
  const M = marks.data, st = marks.stride, cap = marks.capacity, O = marks.origin;
  let n = 0;
  for (let m = 0; m < cap; m++) {
    const o = m * st, life = M[o + 11];
    if (!(life > 0)) continue;
    const fade = 1 - (time - M[o + 10]) / life;
    if (!(fade > 0)) continue;
    const mx = M[o] + O.x, my = M[o + 1] + O.y, mz = M[o + 2] + O.z;         // body-local
    const dx = M[o + 3], dy = M[o + 4], dz = M[o + 5], hl = M[o + 6] * 0.5, hw = M[o + 7] * 0.5;
    const r = Math.sqrt(mx * mx + my * my + mz * mz) || 1, ux = mx / r, uy = my / r, uz = mz / r;
    // across = along x up (so that across x along = up and the quad faces the sky)
    const sx = dy * uz - dz * uy, sy = dz * ux - dx * uz, sz = dx * uy - dy * ux;
    const gx = frame.lx(mx, my, mz), gz = frame.lz(mx, my, mz);
    const de = dx * frame.ex + dy * frame.ey + dz * frame.ez, dn = dx * frame.nx + dy * frame.ny + dz * frame.nz;
    const se = sx * frame.ex + sy * frame.ey + sz * frame.ez, sn = sx * frame.nx + sy * frame.ny + sz * frame.nz;
    const q = n * 12;
    for (let c = 0; c < 4; c++) {
      const a = (c === 0 || c === 3 ? -1 : 1) * hw, b = (c < 2 ? -1 : 1) * hl;
      let h = heightAt ? heightAt(gx + se * a + de * b, gz + sn * a + dn * b) : NaN;
      let px, py, pz;
      if (h === h) {
        frame.dir(gx + se * a + de * b, gz + sn * a + dn * b, _d);
        const rr = frame.r0 + h + lift; px = _d[0] * rr; py = _d[1] * rr; pz = _d[2] * rr;
      } else {
        px = mx + sx * a + dx * b + ux * lift; py = my + sy * a + dy * b + uy * lift; pz = mz + sz * a + dz * b + uz * lift;
      }
      pos[q + c * 3] = px - O.x; pos[q + c * 3 + 1] = py - O.y; pos[q + c * 3 + 2] = pz - O.z;
      if (data) { const k = n * 16 + c * 4; data[k] = M[o + 8]; data[k + 1] = M[o + 12]; data[k + 2] = M[o + 9]; data[k + 3] = fade; }
      if (shade) { const g = 1 - Math.min(0.75, 0.25 + M[o + 8] * 9) * Math.min(1, fade * 3); const k = q + c * 3; shade[k] = g; shade[k + 1] = g; shade[k + 2] = g; }
    }
    n++;
  }
  return n;
}

// Rings on the ground and on liquid (physics.particles.events): the splash of a drop, the
// ripple it leaves on water, the puff where a flake or a grain settles, a hailstone's bounce.
// One quad per event still alive, flat on the local horizontal, growing as it ages.
//   RING: per kind [life s, first radius m, growth m/s].
//   pos: Float32Array(capacity * 12) relative to events.origin.
//   data: Float32Array(capacity * 16) or null: per vertex (kind, strength, age 0..1, size m).
export const RING = Object.freeze([
  Object.freeze([0.28, 0.02, 0.35]),   // splash: a crown, quick
  Object.freeze([1.4, 0.03, 0.22]),    // ripple: a ring that travels at capillary-wave speed
  Object.freeze([0.5, 0.02, 0.05]),    // settle
  Object.freeze([0.3, 0.02, 0.2]),     // bounce
]);
export function expandRings(events, frame, time, lift, pos, data) {
  const E = events.data, cap = events.capacity, O = events.origin;
  let n = 0;
  for (let m = 0; m < cap; m++) {
    const o = m * 8, kind = E[o + 3] | 0, R = RING[kind] || RING[0];
    const age = time - E[o + 5];
    if (!(E[o + 4] > 0) || !(age >= 0) || age >= R[0]) continue;
    const x = E[o], y = E[o + 1], z = E[o + 2];
    const s = (R[1] + R[2] * age) * (0.6 + 0.8 * E[o + 4]);
    const ux = frame.ax * lift, uy = frame.ay * lift, uz = frame.az * lift;
    const q = n * 12;
    for (let c = 0; c < 4; c++) {
      const a = (c === 0 || c === 3 ? -s : s), b = (c < 2 ? -s : s);
      pos[q + c * 3] = x + frame.ex * a + frame.nx * b + ux;
      pos[q + c * 3 + 1] = y + frame.ey * a + frame.ny * b + uy;
      pos[q + c * 3 + 2] = z + frame.ez * a + frame.nz * b + uz;
      if (data) { const k = n * 16 + c * 4; data[k] = kind; data[k + 1] = E[o + 4]; data[k + 2] = age / R[0]; data[k + 3] = E[o + 6]; }
    }
    n++;
  }
  return n;
}

// The liquid surface near the focus: an (N+1) x (N+1) grid of `step` metres, centred on the
// lattice point nearest grid position (cx, cz) (it moves in whole steps, so vertices never
// swim under the waves), at radius frame.r0 + level, lifted by the waves.
//   water: physics.fields.water.field (WaterField).  pos, nrm: Float32Array((N+1)^2 * 3),
//   body-local relative to the frame's anchor (frame.ox, oy, oz); nrm may be null.
// Returns the number of vertices.
export function expandWater(water, frame, cx, cz, N, step, pos, nrm) {
  const x0 = Math.round(cx / step) * step - N * step * 0.5, z0 = Math.round(cz / step) * step - N * step * 0.5;
  const kx = water.kx, kz = water.kz, amp = water.amp, ph = water.phase, R = frame.r0 + water.level;
  const ex = frame.ex, ey = frame.ey, ez = frame.ez, nx = frame.nx, ny = frame.ny, nz = frame.nz;
  // along a row each train's phase advances by a fixed angle: turn (sin, cos) instead of
  // calling the trigonometry at every vertex
  const d0c = Math.cos(kx[0] * step), d0s = Math.sin(kx[0] * step), d1c = Math.cos(kx[1] * step), d1s = Math.sin(kx[1] * step), d2c = Math.cos(kx[2] * step), d2s = Math.sin(kx[2] * step);
  const a0 = amp[0], a1 = amp[1], a2 = amp[2];
  let v = 0;
  for (let j = 0; j <= N; j++) {
    const z = z0 + j * step;
    let p0 = kx[0] * x0 + kz[0] * z - ph[0], p1 = kx[1] * x0 + kz[1] * z - ph[1], p2 = kx[2] * x0 + kz[2] * z - ph[2];
    let s0 = Math.sin(p0), c0 = Math.cos(p0), s1 = Math.sin(p1), c1 = Math.cos(p1), s2 = Math.sin(p2), c2 = Math.cos(p2);
    // the point of the tangent plane under the start of the row, and the step along it
    let qx = frame.ox + ex * x0 + nx * z, qy = frame.oy + ey * x0 + ny * z, qz = frame.oz + ez * x0 + nz * z;
    for (let i = 0; i <= N; i++, v += 3) {
      const h = a0 * s0 + a1 * s1 + a2 * s2;
      const l = 1 / Math.sqrt(qx * qx + qy * qy + qz * qz), ux = qx * l, uy = qy * l, uz = qz * l, r = R + h;
      pos[v] = ux * r - frame.ox; pos[v + 1] = uy * r - frame.oy; pos[v + 2] = uz * r - frame.oz;
      if (nrm) {
        // up - slope: (up) - dh/deast * east - dh/dnorth * north, normalised
        const he = a0 * c0 * kx[0] + a1 * c1 * kx[1] + a2 * c2 * kx[2], hn = a0 * c0 * kz[0] + a1 * c1 * kz[1] + a2 * c2 * kz[2];
        const mx = ux - he * ex - hn * nx, my = uy - he * ey - hn * ny, mz = uz - he * ez - hn * nz;
        const ml = 1 / Math.sqrt(mx * mx + my * my + mz * mz);
        nrm[v] = mx * ml; nrm[v + 1] = my * ml; nrm[v + 2] = mz * ml;
      }
      let t = s0 * d0c + c0 * d0s; c0 = c0 * d0c - s0 * d0s; s0 = t;
      t = s1 * d1c + c1 * d1s; c1 = c1 * d1c - s1 * d1s; s1 = t;
      t = s2 * d2c + c2 * d2s; c2 = c2 * d2c - s2 * d2s; s2 = t;
      qx += ex * step; qy += ey * step; qz += ez * step;
    }
  }
  return v / 3;
}

// Static parts of a quad list: indices and uvs for `quads` quads.
export function quadIndices(quads) {
  const idx = quads * 4 > 65535 ? new Uint32Array(quads * 6) : new Uint16Array(quads * 6);
  for (let i = 0; i < quads; i++) { const v = i * 4, o = i * 6; idx[o] = v; idx[o + 1] = v + 1; idx[o + 2] = v + 2; idx[o + 3] = v; idx[o + 4] = v + 2; idx[o + 5] = v + 3; }
  return idx;
}
export function quadUvs(quads) {
  const uv = new Float32Array(quads * 8);
  for (let i = 0; i < quads; i++) { const o = i * 8; uv[o] = 0; uv[o + 1] = 0; uv[o + 2] = 1; uv[o + 3] = 0; uv[o + 4] = 1; uv[o + 5] = 1; uv[o + 6] = 0; uv[o + 7] = 1; }
  return uv;
}
export function gridIndices(N) {
  const idx = (N + 1) * (N + 1) > 65535 ? new Uint32Array(N * N * 6) : new Uint16Array(N * N * 6);
  for (let j = 0, o = 0; j < N; j++) for (let i = 0; i < N; i++, o += 6) {
    const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1;
    idx[o] = a; idx[o + 1] = b; idx[o + 2] = d; idx[o + 3] = a; idx[o + 4] = d; idx[o + 5] = c;
  }
  return idx;
}
