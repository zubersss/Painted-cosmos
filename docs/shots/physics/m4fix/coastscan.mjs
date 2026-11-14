// For Earth's epoch candidates: the storm coast.mjs would pick at the sea_coast stand (the strongest wind over the first 9000 s),
// then (with full=1) its verdict. node coastscan.mjs <root> <epochs,comma> [full=0]
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [root, epochsS, full = '0'] = process.argv.slice(2);
const imp = (p) => import(pathToFileURL(path.join(root, p)).href);
const [phys, surf, bodies, wind, weather, water, atmo, coast] = await Promise.all(['src/physics/index.js', 'src/world/surface.js', 'src/data/bodies.js', 'src/physics/wind.js', 'src/physics/weather.js', 'src/physics/water.js', 'src/physics/atmosphere.js', 'src/physics/coast.mjs'].map(imp));
const W = { createPhysics: phys.createPhysics, sampleSurfacePure: surf.sampleSurfacePure, getStandPure: surf.getStandPure, BODIES: bodies.BODIES, windLarge: wind.windLarge,
  weatherWind: weather.weatherWind, windSea: water.windSea, seaGrown: water.seaGrown, foamCover: water.foamCover, whiteWind: water.whiteWind, WATER: water.WATER, liquidOf: atmo.liquidOf, airDensity: atmo.airDensity };
for (const e of epochsS.split(',').map(Number)) {
  weather.REGIMES.earth.epoch = e;
  if (+full) {
    const r = coast.coastReport(W, 'earth', 'sea_coast', {});
    const w80 = r.rows.find((x) => x.out === 80);
    console.log(`epoch ${e}: storm at ${r.stormTime} s ${r.stormWind} m/s from ${r.windFrom}; 80 m out fetch ${w80.fetch} depth ${w80.meanDepth} Hs ${w80.Hs} white ${w80.whitePct} off normal ${w80.wavesOffNormal}; target Hs ${r.target.Hs} white ${r.target.whitePct}; checks ${JSON.stringify(r.checks)} => ${r.pass ? 'PASS' : 'NOT YET'}`);
  } else {
    // the wind scan alone, as coastReport does it (at the stand: close enough to its waterline for the choice of storm)
    const u0 = surf.getStandPure('earth', 'sea_coast').unitDir, _w = new Float64Array(4), _ww = new Float64Array(6);
    let ex = u0.z, ez = -u0.x; { const l = Math.hypot(ex, ez) || 1; ex /= l; ez /= l; }
    const E = { x: ex, y: 0, z: ez }, Nn = { x: u0.y * ez, y: u0.z * ex - u0.x * ez, z: -u0.y * ex };
    let best = { U: 0 }; const top = [];
    for (let t = 0; t <= 9000; t += 30) {
      wind.windLarge('earth', u0.x, u0.y, u0.z, t, 18, _w); weather.weatherWind('earth', u0.x, u0.y, u0.z, t, 18, _ww);
      let wx = _w[0] * _ww[0] + _ww[1], wy = _w[1] * _ww[0] + _ww[2], wz = _w[2] * _ww[0] + _ww[3];
      const bs = Math.hypot(wx, wy, wz), bl = bs > 1e-6 ? _ww[5] * Math.min(1, bs / 2) / bs : 0; wx *= 1 + bl; wy *= 1 + bl; wz *= 1 + bl;
      const ee = wx * E.x + wy * E.y + wz * E.z, nn = wx * Nn.x + wy * Nn.y + wz * Nn.z, U = Math.hypot(ee, nn), from = Math.atan2(-nn, -ee) * 57.3;
      if (U > best.U) best = { U, t, from };
    }
    console.log(`epoch ${e}: storm at ${best.t} s ${best.U.toFixed(2)} m/s from ${best.from.toFixed(0)} deg (east 0, north 90)`);
  }
}
