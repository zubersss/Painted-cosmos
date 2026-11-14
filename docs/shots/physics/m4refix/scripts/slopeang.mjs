// A walk on a straight slope at a heading theta below across (-90 straight up, 0 across, +90 straight down), W held.
// node slopeang.mjs <root> [g=9.0] [wish=4.2] [hz=30] [deg=24] [biome:wet,...]
const [root, gS = '9.0', wishS = '4.2', hzS = '30', degS = '24', casesS = 'temperate_forest:1,alpine_meadow:1,desert_canyon:0,desert_canyon:1'] = process.argv.slice(2);
const { stepExplorerBody } = await import(root + '/src/physics/explorer.js');
const { makeWorld, V, norm, len } = await import(root + '/src/physics/testworld.mjs');
const { groundAt } = await import(root + '/src/physics/ground.js');
const g = +gS, wish = +wishS, R = 4000, hz = +hzS, dt = 1 / hz, deg = +degS;
const cases = casesS.split(',').map((c) => { const [b, w] = c.split(':'); return [b, +w]; });
console.log(`# ${root.split('/').slice(-1)[0]} g ${g} wish ${wish} ${hz} Hz ${deg} deg: heading below across -> speed m/s | slowest second (m) | slip share | rise m/s`);
for (const th of [-90, -45, -20, 0, 10, 20, 30, 45, 60, 75, 90]) {
  const row = [];
  for (const [biome, wet] of cases) {
    const a = deg * Math.PI / 180, H = 400, rad = H / Math.tan(a), x0 = 0.55 * rad;
    const sample = makeWorld({ R, cone: { dir: norm(V(0, 0, 1)), radius: rad, height: H } });
    const d = norm(V(Math.sin(x0 / R), 0, Math.cos(x0 / R))), s = sample(d);
    const st = { p: V(d.x * s.radius, d.y * s.radius, d.z * s.radius), v: V(), grounded: true };
    const G = groundAt('earth', { radius: R, slope: a, liquidRadius: 0, biomeId: biome, biomeWeights: { [biome]: 1 } }, { wetness01: wet, snowDepth: 0, temperature: 288 }, {});
    const env = { sample, gravity: g, air: (p, o) => { o.density = 1.2; o.wind.x = 0; o.wind.y = 0; o.wind.z = 0; return o; }, ground: (su, o) => Object.assign(o, G) };
    const t = th * Math.PI / 180, w = V(Math.sin(t) * wish, Math.cos(t) * wish, 0);
    const cmd = { wish: w, assistAccel: 4 * Math.min(1, Math.max(0.45, g / 9)) };
    let n = 0, sum = 0, slip = 0, least = 99, last = { ...st.p }, r0 = 0;
    for (let i = 0; i < 8 * hz; i++) {
      if (i === 2 * hz) r0 = len(st.p);
      stepExplorerBody(st, cmd, dt, env);
      if (i >= 2 * hz) { n++; sum += len(st.v); if (st.phys.slip01 > 0) slip++; }
      if ((i + 1) % hz === 0) { const m = len(V(st.p.x - last.x, st.p.y - last.y, st.p.z - last.z)); if (i >= 2 * hz) least = Math.min(least, m); last = { ...st.p }; }
    }
    row.push(`${(sum / n).toFixed(2)} | ${least.toFixed(2)} | ${(slip / n).toFixed(2)} | ${((len(st.p) - r0) / 6).toFixed(2)}`.padEnd(30));
  }
  console.log(String(th).padStart(4) + '  ' + row.join(''));
}
