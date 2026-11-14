// Painted Cosmos physics: THE COAST REPORT (P18), for PAINTER's coast fix. OWNER: PHYSICS. Node only.
//
//   node src/physics/coast.mjs [root] [body:biome ...] [--t=<s>] [--settle=<s>] [--json]
//     root: the tree to load (default: this repository); body:biome default earth:sea_coast neptune:storm_seas
//
// For each coast stand (src/world/surface.js getStandPure, sampled through sampleSurfacePure): finds the storm (the
// strongest wind at the stand over the first 9000 s, or --t), puts the focus 2 m up the beach at the waterline nearest the
// stand (as the lab's shore subjects do), runs the physics for --settle s (default 150: the swell takes 90 s to come up)
// ending at the storm, and prints what the sea map says the sea is there: at the waterline and 20, 80, 200 and 500 m out,
// the fetch (m) and the mean depth along it (m), the significant height (m) of the whole sea and of the wind sea, how far
// the open sea's swell reaches, the white-horse fraction (% of the surface white) and which way the waves run (degrees off
// the shore's normal; 0 = straight in). Then the far rose (fetch by compass point from the open water about) and where the
// storms come from. Then the verdict against the targets: what the same storm raises over 2.5 km of water 20 m deep
// ((P21) in the time it has blown: the same growth as the game's sea, over the same settle; blowing for ever is printed too)
// (the coordinator's ruling: the coasts face open water, at least about 2 km of fetch at about 20 m deep toward the storm
// wind), and the marks it must reach: 80 m out, fetch >= 2000 m, mean depth >= 12 m, Hs >= 0.75 x the target, white
// >= 0.6 x the target; at the waterline the surf breaking (Hs over 0.25 m).
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { seaGrown as seaGrownHere, whiteWind as whiteWindHere } from './water.js';   // (P22, P26: when the caller's W does not carry them)

const here = path.dirname(fileURLToPath(import.meta.url));
const DEF_ROOT = path.resolve(here, '../..');
const deg = (a) => Math.round(a * 180 / Math.PI);
const r2 = (v) => (v == null || v !== v ? v : Math.round(v * 100) / 100);
const COMPASS = ['E', 'ENE', 'NE', 'NNE', 'N', 'NNW', 'NW', 'WNW', 'W', 'WSW', 'SW', 'SSW', 'S', 'SSE', 'SE', 'ESE'];
export const COAST_TARGET = Object.freeze({ fetch: 2500, depth: 20, passFetch: 2000, passDepth: 12, passHs: 0.75, passWhite: 0.6, surfHs: 0.25, out: 80 });

// The report for one stand. W: { createPhysics, sampleSurfacePure, getStandPure, BODIES, windLarge, weatherWind, windSea,
// foamCover, liquidOf, airDensity, WATER }; opts: { t (storm time, s; default: found), settle (s), seed }.
export function coastReport(W, bodyId, biomeId, opts = {}) {
  const { BODIES } = W, R = BODIES[bodyId].radius, g = BODIES[bodyId].gravity, seed = opts.seed || 18;
  const stand = W.getStandPure(bodyId, biomeId), u0 = stand.unitDir;
  const n0 = (v) => { const l = Math.hypot(v.x, v.y, v.z); return { x: v.x / l, y: v.y / l, z: v.z / l }; };
  let ex = u0.z, ez = -u0.x; { const l = Math.hypot(ex, ez) || 1; ex /= l; ez /= l; }
  const E = { x: ex, y: 0, z: ez }, Nn = { x: u0.y * ez, y: u0.z * ex - u0.x * ez, z: -u0.y * ex };
  const dirAt = (e, n) => n0({ x: u0.x * R + E.x * e + Nn.x * n, y: u0.y * R + E.y * e + Nn.y * n, z: u0.z * R + E.z * e + Nn.z * n });
  const S = (e, n) => { const d = dirAt(e, n); return W.sampleSurfacePure(bodyId, d.x, d.y, d.z); };
  const depth = (e, n) => { const s = S(e, n); return (s.liquidRadius || 0) - s.radius; };
  // the waterline nearest the stand (a spiral of rays, then bisection), and the way out to sea there
  const wet0 = depth(0, 0) > 0; let hit = null;
  for (let r = 4; r <= 1500 && !hit; r += 4) for (let k = 0; k < 48 && !hit; k++) { const a = k / 48 * 2 * Math.PI; if ((depth(Math.cos(a) * r, Math.sin(a) * r) > 0) !== wet0) hit = { a, r }; }
  if (!hit) return { bodyId, biomeId, error: 'no waterline within 1500 m of the stand' };
  let lo = hit.r - 4, hi = hit.r; for (let i = 0; i < 16; i++) { const m = (lo + hi) / 2; if ((depth(Math.cos(hit.a) * m, Math.sin(hit.a) * m) > 0) !== wet0) hi = m; else lo = m; }
  const we0 = Math.cos(hit.a) * hi, wn0 = Math.sin(hit.a) * hi;
  // the way out to sea: the mean direction toward the water from the waterline (eight rays of 30 m)
  let oe = 0, on = 0;
  for (let k = 0; k < 16; k++) { const a = k / 16 * 2 * Math.PI, d = depth(we0 + Math.cos(a) * 30, wn0 + Math.sin(a) * 30); if (d > 0) { oe += Math.cos(a); on += Math.sin(a); } }
  { const l = Math.hypot(oe, on) || 1; oe /= l; on /= l; }
  const beach = (m) => [we0 + oe * m, wn0 + on * m];
  // the storm: the strongest wind at the place over the first 9000 s (the weather's own wind on the planet's), and the
  // compass points the strong winds come from
  const _w = new Float64Array(4), _ww = new Float64Array(6), dw = dirAt(we0, wn0);
  const windNow = (t) => {
    W.windLarge(bodyId, dw.x, dw.y, dw.z, t, seed, _w); W.weatherWind(bodyId, dw.x, dw.y, dw.z, t, seed, _ww);
    let wx = _w[0] * _ww[0] + _ww[1], wy = _w[1] * _ww[0] + _ww[2], wz = _w[2] * _ww[0] + _ww[3];
    const bs = Math.hypot(wx, wy, wz), bl = bs > 1e-6 ? _ww[5] * Math.min(1, bs / 2) / bs : 0; wx *= 1 + bl; wy *= 1 + bl; wz *= 1 + bl;
    const e = wx * E.x + wy * E.y + wz * E.z, n = wx * Nn.x + wy * Nn.y + wz * Nn.z;
    return { U: Math.hypot(e, n), from: Math.atan2(-n, -e) };
  };
  let tStorm = opts.t, Umax = 0; const hist = new Array(16).fill(0), samples = [];
  for (let t = 0; t <= 9000; t += 30) { const w = windNow(t); samples.push(w); if (w.U > Umax) { Umax = w.U; if (opts.t == null) tStorm = t; } }
  for (const w of samples) if (w.U > 0.6 * Umax) hist[((Math.round(w.from / (2 * Math.PI) * 16) % 16) + 16) % 16]++;
  const Ustorm = windNow(tStorm).U;      // (the targets are for the wind at the time reported)
  // run the physics into the storm with the focus 2 m up the beach
  const physics = W.createPhysics({ sampleSurface: (id, d) => W.sampleSurfacePure(id, d.x, d.y, d.z), seed, timeBudget: false });
  void physics.fields.water.uniforms.uPhysSeaMap;      // (the sea as it is once the shader reads the map: the reference is the most exposed water)
  const [fe, fn] = beach(-2), fd = dirAt(fe, fn), sf = W.sampleSurfacePure(bodyId, fd.x, fd.y, fd.z), fr = Math.max(sf.radius, sf.liquidRadius || 0) + 1;
  const focus = { x: fd.x * fr, y: fd.y * fr, z: fd.z * fr };
  const settle = opts.settle || 150, t0 = Math.max(0, tStorm - settle);
  for (let t = t0; t <= tStorm + 1e-9; t += 1 / 30) physics.update(1 / 30, { bodyId, time: t, focus, sunDir: fd });
  const A = physics.fields.air, Ws = physics.fields.water, U = Math.hypot(A.cwe, A.cwn), fromNow = Math.atan2(-A.cwn, -A.cwe);
  const outA = Math.atan2(on, oe);
  const at = (m) => {
    const [e, n] = beach(m), d = dirAt(e, n), s = W.sampleSurfacePure(bodyId, d.x, d.y, d.z), p = { x: d.x * R, y: d.y * R, z: d.z * R };
    const o = physics.water(bodyId, p, {}), L = Ws.local(p, {});
    const wavesTo = Math.atan2(L.dirz, L.dirx), offNormal = wavesTo - (outA + Math.PI), wd = (s.liquidRadius || 0) - s.radius;
    if (!(wd > 0) && m > 0) return { out: m, waterDepth: 'dry', fetch: '-', meanDepth: '-', Hs: '-', windSea: '-', swellReach: '-', whitePct: 0, wavesOffNormal: '-' };
    return { out: m, waterDepth: r2(Math.max(0, wd)), fetch: Math.round(o.fetch), meanDepth: r2(o.depth), Hs: r2(o.significant), windSea: r2(o.waveHs),
      swellReach: r2(o.open), whitePct: r2(100 * o.whitecapCover), wavesOffNormal: deg(Math.atan2(Math.sin(offNormal), Math.cos(offNormal))) };
  };
  const rows = [0, 20, 80, 200, 500].map(at);
  const rose = Array.from(Ws.map.rose.r);
  // the targets: the same storm over 2.5 km of water 20 m deep (the wind sea, the swell it raises beyond, the white share)
  const rhoA = W.airDensity(bodyId, 0), rhoL = W.liquidOf(bodyId).density, wsT = W.windSea(Ustorm, COAST_TARGET.fetch, g, rhoA, rhoL, COAST_TARGET.depth, {});
  const swT = W.windSea(Ustorm, COAST_TARGET.fetch * W.WATER.swellFetch, g, rhoA, rhoL, COAST_TARGET.depth, {});
  const swH = swT.height * W.WATER.swellDecay, HsEq = Math.sqrt(wsT.height ** 2 + swH ** 2);
  // (P21) ... in the time it blows. A sea grows with the wind's duration as well as its fetch: the game's sea follows the
  // wind as WaterField does (the wind sea toward this wind's over WATER.growTime, the swell's wind rising with it and its
  // height over WATER.swellTime), and the run above starts where the wind of the settle's start has raised its sea (it
  // arrives there). The target is the same growth over the reference water under the same wind, so the verdict asks of
  // the terrain what the storm can raise in the time it blows, not what a storm blowing for ever would: Neptune's squall
  // peaks at 240 s, and a swell that takes 90 s to come up cannot reach its full height in it, over any water.
  // (P22) ... and the arrival now settles to what the wind's history has raised (water.js seaGrown, physics on arrival),
  // so the target is the same history over the reference water: the last four swell times before the storm, whenever the
  // run arrived (until P22 it started where the run's settle started: arriving 20 s before the peak, the target was nearly
  // the storm's equilibrium and the arrival showed it)
  const grown = (() => {
    const o = (W.seaGrown || seaGrownHere)((t) => windNow(t).U, tStorm, COAST_TARGET.fetch, COAST_TARGET.depth, g, rhoA, rhoL, 0, {});
    return { Hs: Math.sqrt(o.height * o.height + o.swellHeight * o.swellHeight), windSea: o.height, swell: o.swellHeight, swellWind: o.swellWind };
  })();
  const HsT = grown.Hs;
  // (P26) the white share by the same law as the sea's (water.js foamCover): the steepness's law as far as a gale, the
  // wind's beyond it (the wind as that history's sea has felt it, as on Earth: whiteWind of the swell's wind)
  const whiteUe = (W.whiteWind || whiteWindHere)(grown.swellWind, g, rhoA, rhoL), whiteT = 100 * W.foamCover(wsT.whitecap01, whiteUe);
  const r80 = rows.find((r) => r.out === COAST_TARGET.out), r0 = rows[0];
  const checks = {
    fetch: r80.fetch >= COAST_TARGET.passFetch, depth: r80.meanDepth >= COAST_TARGET.passDepth,     // (a dry point fails every mark)
    Hs: r80.Hs >= COAST_TARGET.passHs * HsT, white: r80.whitePct >= COAST_TARGET.passWhite * whiteT, surf: r0.Hs >= COAST_TARGET.surfHs,
  };
  return {
    bodyId, biomeId, stormTime: tStorm, stormWind: r2(Ustorm), strongest: r2(Umax), windNow: r2(U), windFrom: COMPASS[((Math.round(fromNow / (2 * Math.PI) * 16) % 16) + 16) % 16],
    stormsFrom: Object.fromEntries(hist.map((c, k) => [COMPASS[k], c]).filter(([, c]) => c > 0)),
    waterline: { east: r2(we0), north: r2(wn0), fromStand: r2(hi) }, outToSea: COMPASS[((Math.round(outA / (2 * Math.PI) * 16) % 16) + 16) % 16],
    rows, rose: Object.fromEntries(rose.map((r, k) => [COMPASS[Math.round(k * 15 / 22.5) % 16] + '(' + (k * 15) + ')', Math.round(r)])),
    reference: { fetch: Math.round(Ws.map.target.refFetch), depth: r2(Ws.map.target.refDepth), Hs: r2(Ws.field.significant) },
    target: { Hs: r2(HsT), windSea: r2(grown.windSea), swell: r2(grown.swell), whitePct: r2(whiteT), whiteWind: r2(whiteUe), fetch: COAST_TARGET.fetch, depth: COAST_TARGET.depth, settle: tStorm - t0, history: 4 * W.WATER.swellTime,
      blownForEver: { Hs: r2(HsEq), windSea: r2(wsT.height), swell: r2(swH) } },
    checks, pass: Object.values(checks).every(Boolean),
  };
}

async function main() {
  const args = process.argv.slice(2), flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v == null ? true : v]; }));
  const pos = args.filter((a) => !a.startsWith('--'));
  const root = pos[0] && !pos[0].includes(':') ? path.resolve(pos.shift()) : DEF_ROOT;
  const stands = pos.length ? pos.map((s) => s.split(':')) : [['earth', 'sea_coast'], ['neptune', 'storm_seas']];
  const imp = (p) => import(pathToFileURL(path.join(root, p)).href);
  const [phys, surf, bodies, wind, weather, water, atmo] = await Promise.all(['src/physics/index.js', 'src/world/surface.js', 'src/data/bodies.js', 'src/physics/wind.js', 'src/physics/weather.js', 'src/physics/water.js', 'src/physics/atmosphere.js'].map(imp));
  const W = { createPhysics: phys.createPhysics, sampleSurfacePure: surf.sampleSurfacePure, getStandPure: surf.getStandPure, BODIES: bodies.BODIES, windLarge: wind.windLarge,
    weatherWind: weather.weatherWind, windSea: water.windSea, seaGrown: water.seaGrown, foamCover: water.foamCover, whiteWind: water.whiteWind, WATER: water.WATER, liquidOf: atmo.liquidOf, airDensity: atmo.airDensity };
  let allPass = true;
  for (const [b, bi] of stands) {
    const r = coastReport(W, b, bi, { t: flags.t != null ? +flags.t : undefined, settle: flags.settle ? +flags.settle : undefined });
    if (flags.json) { console.log(JSON.stringify(r)); allPass = allPass && !!r.pass; continue; }
    if (r.error) { console.log(`${b}:${bi}: ${r.error}`); allPass = false; continue; }
    console.log(`\n== ${b}:${bi}  storm at ${r.stormTime} s: ${r.stormWind} m/s (now ${r.windNow} from ${r.windFrom}); strong winds from ${JSON.stringify(r.stormsFrom)}`);
    console.log(`   waterline ${r.waterline.fromStand} m from the stand (east ${r.waterline.east}, north ${r.waterline.north}); the sea lies to the ${r.outToSea}`);
    console.log('   out (m)  water depth  fetch (m)  mean depth  Hs (m)  wind sea  swell reach  white %  waves off the normal (deg)');
    for (const w of r.rows) console.log(`   ${String(w.out).padStart(7)}  ${String(w.waterDepth).padStart(11)}  ${String(w.fetch).padStart(9)}  ${String(w.meanDepth).padStart(10)}  ${String(w.Hs).padStart(6)}  ${String(w.windSea).padStart(8)}  ${String(w.swellReach).padStart(11)}  ${String(w.whitePct).padStart(7)}  ${String(w.wavesOffNormal).padStart(5)}`);
    console.log(`   far rose (fetch in m by direction, degrees from east toward north, from the water about that sees most open sea): ${Object.entries(r.rose).map(([k, v]) => k + ' ' + v).join(', ')}`);
    console.log(`   reference sea (the most exposed water about): fetch ${r.reference.fetch} m, depth ${r.reference.depth} m, Hs ${r.reference.Hs} m`);
    console.log(`   TARGET (this storm over ${r.target.fetch} m of water ${r.target.depth} m deep, its last ${r.target.history} s): Hs ${r.target.Hs} m (wind sea ${r.target.windSea}, swell ${r.target.swell}), white ${r.target.whitePct} %; blowing for ever it would raise Hs ${r.target.blownForEver.Hs} m (wind sea ${r.target.blownForEver.windSea}, swell ${r.target.blownForEver.swell})`);
    console.log(`   ${COAST_TARGET.out} m out: fetch >= ${COAST_TARGET.passFetch} ${r.checks.fetch ? 'ok' : 'NO'}, mean depth >= ${COAST_TARGET.passDepth} ${r.checks.depth ? 'ok' : 'NO'}, Hs >= ${r2(COAST_TARGET.passHs * r.target.Hs)} ${r.checks.Hs ? 'ok' : 'NO'}, white >= ${r2(COAST_TARGET.passWhite * r.target.whitePct)} % ${r.checks.white ? 'ok' : 'NO'}; surf at the waterline (Hs >= ${COAST_TARGET.surfHs}) ${r.checks.surf ? 'ok' : 'NO'}  =>  ${r.pass ? 'PASS' : 'NOT YET'}`);
    allPass = allPass && r.pass;
  }
  process.exitCode = allPass ? 0 : 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
