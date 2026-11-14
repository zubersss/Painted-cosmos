// The part of the motion set that runs in the page: it keeps consecutive frames of a canvas and
// measures what changes between them (tests/motion.mjs says what each number means). It needs
// nothing of the game, so any page with a canvas can use it (PHYSICS' lab, the gallery):
//
//   import { installInPage } from '../tests/motionlib.mjs';
//   await page.evaluate(installInPage, [960, 540]);        // the size the frames are kept at
//   for each frame: advance your own clock by a fixed step and draw, then IN THE SAME TASK
//     await page.evaluate(() => { stepMyLab(1 / 30); return window.__motion.grab(); });
//     (a canvas that is not read in the task that drew it may already have been presented
//      and cleared: the frame comes back black)
//   const r = await page.evaluate(() => window.__motion.analyse({ stuck: false }));
//     r.summary (change, residual, blockMean, pops, camera, tris), r.pairs (per pair of
//     frames), r.pops (where and when), r.changeMap and r.worstDiff (JPEG data URLs)
//   window.__motion.frames[i].url is frame i as a JPEG data URL; window.__motion.reset() starts again.
//
// In the game, window.__pc.hold(true) stops the frame loop and window.__pc.step(dt, n) runs n
// frames of exactly dt seconds; grab() then also records the clock, the camera, the triangles.
// On another page pass what you want kept: grab({ t, tris, dir: [x, y, z], p: [x, y, z] }).
export function installInPage([FW, FH, canvasSelector]) {
  const gl = (canvasSelector && document.querySelector(canvasSelector)) || document.getElementById('pc-canvas') || document.querySelector('canvas');
  const aw = FW >> 1, ah = FH >> 1, N = aw * ah;
  const full = document.createElement('canvas'); full.width = FW; full.height = FH;
  const fx = full.getContext('2d', { willReadFrequently: true });
  const half = document.createElement('canvas'); half.width = aw; half.height = ah;
  const hx = half.getContext('2d', { willReadFrequently: true });
  hx.imageSmoothingQuality = 'high';
  const M = { frames: [] };
  M.reset = () => { M.frames = []; };
  // Call right after a frame is painted: the picture is still in the canvas.
  M.grab = (given) => {
    fx.drawImage(gl, 0, 0, FW, FH);
    hx.drawImage(full, 0, 0, aw, ah);
    const d = hx.getImageData(0, 0, aw, ah).data, L = new Float32Array(N);
    for (let i = 0, j = 0; i < N; i++, j += 4) L[i] = (0.2126 * d[j] + 0.7152 * d[j + 1] + 0.0722 * d[j + 2]) / 255;
    let meta = { t: M.frames.length, state: null, tris: 0, calls: 0, busy: null, dir: [0, 0, -1], p: [0, 0, 0], speed: 0, ...(given || {}) };
    const pc = window.__pc;
    if (pc && pc.sim && !given) {
      const sim = pc.sim, st = pc.game.stats, e = pc.camera.matrixWorld.elements;
      const onFoot = sim.sm.state === 'ON_FOOT', p = onFoot ? sim.ex.p : sim.sh.p;
      meta = { t: +sim.t.toFixed(3), state: sim.sm.state, tris: st.tris, calls: st.calls, busy: pc.world.busy == null ? null : pc.world.busy, dir: [-e[8], -e[9], -e[10]], p: [p.x, p.y, p.z], speed: onFoot ? sim.ex.speed : sim.sh.speed, alt: onFoot ? sim.ex.altitude : sim.sh.altGround };
    }
    M.frames.push({ L, url: full.toDataURL('image/jpeg', 0.9), meta });
    return M.frames.length;
  };
  const boxBlur = (src, r) => {
    const tmp = new Float32Array(N), out = new Float32Array(N), k = 1 / (2 * r + 1);
    for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) { let s = 0; for (let i = -r; i <= r; i++) s += src[y * aw + Math.max(0, Math.min(aw - 1, x + i))]; tmp[y * aw + x] = s * k; }
    for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) { let s = 0; for (let i = -r; i <= r; i++) s += tmp[Math.max(0, Math.min(ah - 1, y + i)) * aw + x]; out[y * aw + x] = s * k; }
    return out;
  };
  const soft = (src, r) => boxBlur(boxBlur(src, r), r);
  // Normalised correlation of A against B moved by (dx, dy), over a region that every shift keeps.
  const MX = 44, MY = 8;
  const corr = (A, B, dx, dy, stepPx = 1) => {
    let ab = 0, aa = 0, bb = 0;
    for (let y = MY; y < ah - MY; y += stepPx) for (let x = MX; x < aw - MX; x += stepPx) { const a = A[y * aw + x], b = B[(y + dy) * aw + x + dx]; ab += a * b; aa += a * a; bb += b * b; }
    return ab / (Math.sqrt(aa * bb) || 1);
  };
  const r2 = (x) => Math.round(x * 100) / 100, r3 = (x) => Math.round(x * 1000) / 1000;
  const pct = (arr, q) => { const a = Array.from(arr).sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor(q * a.length))] : 0; };
  const toUrl = (vals, gain) => {
    const img = hx.createImageData(aw, ah);
    for (let i = 0, j = 0; i < N; i++, j += 4) { const v = Math.min(255, vals[i] * gain * 255); img.data[j] = img.data[j + 1] = img.data[j + 2] = v; img.data[j + 3] = 255; }
    hx.putImageData(img, 0, 0);
    return half.toDataURL('image/jpeg', 0.85);
  };

  M.analyse = (o = {}) => {
    const F = M.frames, n = F.length, B = 16, S = 8, bw = Math.floor(aw / B), bh = Math.floor(ah / B), nb = bw * bh;
    const meanChange = new Float32Array(N), everMax = new Float32Array(N);
    const pairs = [], resid = [], allResid = [], allDm = [];
    let worst = -1, worstPair = 0;
    for (let k = 0; k + 1 < n; k++) {
      const a = F[k].L, b = F[k + 1].L;
      let sum = 0, ch = 0;
      const band = [0, 0, 0];
      for (let i = 0; i < N; i++) { const d = Math.abs(b[i] - a[i]); sum += d; if (d > 0.03) ch++; meanChange[i] += d; if (d > everMax[i]) everMax[i] = d; band[Math.min(2, Math.floor((i / aw) / (ah / 3)))] += d; }
      const r = new Float32Array(nb), sx = [], sy = [];
      let over3 = 0, dmMax = 0;
      for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
        const x0 = bx * B, y0 = by * B;
        let zero = 0, ma = 0;
        for (let y = 0; y < B; y++) { const ia = (y0 + y) * aw + x0; for (let x = 0; x < B; x++) { zero += Math.abs(b[ia + x] - a[ia + x]); ma += a[ia + x]; } }
        ma /= B * B;
        let tex = 0;
        for (let y = 0; y < B; y++) { const ia = (y0 + y) * aw + x0; for (let x = 0; x < B; x++) tex += Math.abs(a[ia + x] - ma); }
        tex /= B * B;
        let best = zero, bdx = 0, bdy = 0;
        for (let dy = -S; dy <= S; dy++) {
          const y1 = y0 + dy; if (y1 < 0 || y1 + B > ah) continue;
          for (let dx = -S; dx <= S; dx++) {
            const x1 = x0 + dx; if (x1 < 0 || x1 + B > aw || (dx === 0 && dy === 0)) continue;
            let sad = 0;
            const lim = best * 0.97;                 // a near tie stays with "did not move"
            for (let y = 0; y < B && sad < lim; y++) { const ia = (y0 + y) * aw + x0, ib = (y1 + y) * aw + x1; for (let x = 0; x < B; x++) sad += Math.abs(b[ib + x] - a[ia + x]); }
            if (sad < lim) { best = sad; bdx = dx; bdy = dy; }
          }
        }
        let mb = 0;
        for (let y = 0; y < B; y++) { const ib = (y0 + bdy + y) * aw + x0 + bdx; for (let x = 0; x < B; x++) mb += b[ib + x]; }
        mb /= B * B;
        const bi = by * bw + bx, dm = Math.abs(mb - ma);
        r[bi] = best / (B * B);
        allResid.push(r[bi]); allDm.push(dm);
        if (dm > 0.03) over3++;
        if (dm > dmMax) dmMax = dm;
        if (tex > 0.02) { sx.push(bdx); sy.push(bdy); }
      }
      resid.push(r);
      const mad = sum / N;
      if (mad > worst) { worst = mad; worstPair = k; }
      const A = F[k].meta, Bm = F[k + 1].meta;
      const dot = Math.max(-1, Math.min(1, A.dir[0] * Bm.dir[0] + A.dir[1] * Bm.dir[1] + A.dir[2] * Bm.dir[2]));
      pairs.push({
        change: r3(mad * 100), pixels3: r2((ch / N) * 100), top: r3((band[0] / (N / 3)) * 100), middle: r3((band[1] / (N / 3)) * 100), bottom: r3((band[2] / (N / 3)) * 100),
        residual: r3((r.reduce((s, v) => s + v, 0) / nb) * 100), blockMeanMax: r2(dmMax * 100), over3,
        shift: [sx.length ? pct(sx, 0.5) * 2 : 0, sy.length ? pct(sy, 0.5) * 2 : 0],
        turnDeg: r3((Math.acos(dot) * 180) / Math.PI), moved: r3(Math.hypot(Bm.p[0] - A.p[0], Bm.p[1] - A.p[1], Bm.p[2] - A.p[2])), dTris: Bm.tris - A.tris, busy: Bm.busy,
      });
    }
    // Pops: a block far above its own usual residual, in one pair of frames.
    const med = new Float32Array(nb);
    for (let bi = 0; bi < nb; bi++) med[bi] = pct(resid.map((r) => r[bi]), 0.5);
    const hits = [];
    let popBlocks = 0;
    const popPairs = new Set();
    for (let k = 0; k < resid.length; k++) for (let bi = 0; bi < nb; bi++) {
      const v = resid[k][bi];
      if (v > 0.04 && v > 3 * med[bi] + 0.02) { hits.push({ k, bx: bi % bw, by: Math.floor(bi / bw), v, m: med[bi] }); popBlocks++; popPairs.add(k); }
    }
    hits.sort((p, q) => (q.v - q.m) - (p.v - p.m));
    const pops = [];
    for (const h of hits) {
      const near = pops.find((p) => p.pair === h.k && Math.abs(p.bx - h.bx) <= 3 && Math.abs(p.by - h.by) <= 3);
      if (near) { near.blocks++; continue; }
      if (pops.length < 12) pops.push({ pair: h.k, bx: h.bx, by: h.by, x: h.bx * B * 2, y: h.by * B * 2, blocks: 1, residual: r2(h.v * 100), median: r2(h.m * 100), dTris: pairs[h.k].dTris });
    }
    let still = 0;
    for (let i = 0; i < N; i++) if (everMax[i] < 0.005) still++;
    const mean = (f) => pairs.reduce((s, p) => s + f(p), 0) / (pairs.length || 1);
    const m0 = F[0].meta, m1 = F[n - 1].meta, secs = m1.t - m0.t;
    const turn = pairs.reduce((s, p) => s + p.turnDeg, 0), moved = pairs.reduce((s, p) => s + p.moved, 0);
    const tris = F.map((f) => f.meta.tris);
    const summary = {
      change: { mean: r3(mean((p) => p.change)), max: r3(worst * 100), worstPair, pixels3: r2(mean((p) => p.pixels3)), stillShare: r2((still / N) * 100), top: r3(mean((p) => p.top)), middle: r3(mean((p) => p.middle)), bottom: r3(mean((p) => p.bottom)), pairsOverHalf: pairs.filter((p) => p.change > 0.5).length },
      residual: { mean: r3(mean((p) => p.residual)), p99: r3(pct(allResid, 0.99) * 100) },
      blockMean: { p99: r2(pct(allDm, 0.99) * 100), max: r2(Math.max(0, ...allDm) * 100), over3: allDm.filter((v) => v > 0.03).length, of: allDm.length },
      pops: { blocks: popBlocks, pairs: popPairs.size },
      camera: { turnDeg: r2(turn), degPerSecond: secs ? r2(turn / secs) : 0, moved: r2(moved), metresPerSecond: secs ? r2(moved / secs) : 0 },
      tris: { min: Math.min(...tris), max: Math.max(...tris), jumps: pairs.filter((p) => Math.abs(p.dTris) > 2000).length },
    };
    if (o.stuck && n > 6) {
      // Fine detail: what a 3 px blur takes away. Broad detail: between a 3 px and an 11 px blur.
      const lag = 5, picks = [];
      for (let k = 1; k + lag < n; k += Math.max(1, Math.floor((n - lag) / 6))) picks.push(k);
      const acc = { shift: [], fw: [], fs: [], fc: [], bw: [], bs: [], bc: [] };
      for (const k of picks) {
        const a = F[k].L, b = F[k + lag].L, a1 = soft(a, 1), b1 = soft(b, 1), a5 = soft(a, 5), b5 = soft(b, 5);
        const fa = new Float32Array(N), fb = new Float32Array(N), ca = new Float32Array(N), cb = new Float32Array(N);
        for (let i = 0; i < N; i++) { fa[i] = a[i] - a1[i]; fb[i] = b[i] - b1[i]; ca[i] = a1[i] - a5[i]; cb[i] = b1[i] - b5[i]; }
        let best = -2, gx = 0, gy = 0;
        for (let dy = -6; dy <= 6; dy++) for (let dx = -40; dx <= 40; dx++) { const c = corr(ca, cb, dx, dy, 2); if (c > best) { best = c; gx = dx; gy = dy; } }
        let fbest = -2;
        for (let dy = gy - 1; dy <= gy + 1; dy++) for (let dx = gx - 1; dx <= gx + 1; dx++) { if (Math.abs(dy) > MY || Math.abs(dx) > MX) continue; const c = corr(fa, fb, dx, dy); if (c > fbest) fbest = c; }
        acc.shift.push(Math.hypot(gx, gy) * 2);
        acc.bw.push(corr(ca, cb, gx, gy)); acc.bs.push(corr(ca, cb, 0, 0)); acc.bc.push(corr(ca, ca, gx, gy));
        acc.fw.push(fbest); acc.fs.push(corr(fa, fb, 0, 0)); acc.fc.push(corr(fa, fa, gx, gy));
      }
      const av = (x) => r2(x.reduce((s, v) => s + v, 0) / (x.length || 1));
      summary.stuck = { lagFrames: lag, pairs: picks.length, shiftPx: av(acc.shift), broad: { world: av(acc.bw), screen: av(acc.bs), chance: av(acc.bc) }, fine: { world: av(acc.fw), screen: av(acc.fs), chance: av(acc.fc) } };
    }
    for (let i = 0; i < N; i++) meanChange[i] /= pairs.length || 1;
    const wd = new Float32Array(N), wa = F[worstPair].L, wb = F[Math.min(n - 1, worstPair + 1)].L;
    for (let i = 0; i < N; i++) wd[i] = Math.abs(wb[i] - wa[i]);
    return { summary, pairs, pops, meta: F.map((f) => ({ t: f.meta.t, state: f.meta.state, tris: f.meta.tris, calls: f.meta.calls, busy: f.meta.busy, speed: r2(f.meta.speed || 0), alt: f.meta.alt == null ? null : r3(f.meta.alt) })), changeMap: toUrl(meanChange, 10), worstDiff: toUrl(wd, 8) };
  };
  window.__motion = M;
}
