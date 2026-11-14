// The new test's measurement on a tree: W held down (and up, across) a straight slope; mean speed after 3 s, slowest second, slip share.
const [root] = process.argv.slice(2);
const { stepExplorerBody } = await import(root + '/src/physics/explorer.js');
const { makeWorld, V, norm, len } = await import(root + '/src/physics/testworld.mjs');
const { groundAt } = await import(root + '/src/physics/ground.js');
const R = 4000;
const gr = (biome, slope, wet) => groundAt('earth', { radius: R, slope, liquidRadius: 0, biomeId: biome, biomeWeights: { [biome]: 1 } }, { wetness01: wet, snowDepth: 0, temperature: 288 }, {});
const walk = (biome, wet, deg, hz, g, way) => {
  const a = deg * Math.PI / 180, H = 400, rad = H / Math.tan(a), x0 = (way === 'up' ? 0.75 : way === 'down' ? 0.35 : 0.55) * rad;
  const sample = makeWorld({ R, cone: { dir: norm(V(0, 0, 1)), radius: rad, height: H } });
  const d = norm(V(Math.sin(x0 / R), 0, Math.cos(x0 / R))), s = sample(d);
  const st = { p: V(d.x * s.radius, d.y * s.radius, d.z * s.radius), v: V(), grounded: true };
  const G = gr(biome, a, wet);
  const env = { sample, gravity: g, air: (p, o) => { o.density = 1.225; o.wind.x = 0; o.wind.y = 0; o.wind.z = 0; return o; }, ground: (su, o) => Object.assign(o, G) };
  const w = way === 'up' ? V(-4.2, 0, 0) : way === 'down' ? V(4.2, 0, 0) : V(0, 4.2, 0);
  const cmd = { wish: w, assistAccel: 4 * Math.min(1, Math.max(0.45, g / 9)) };
  let sum = 0, n = 0, slip = 0, worst = 99, last = { ...st.p }, k = 0, r0 = 0;
  const dt = 1 / hz;
  for (let i = 0; i < 9 * hz; i++) {
    stepExplorerBody(st, cmd, dt, env);
    const t = (i + 1) * dt;
    if (t > 3) { sum += len(st.v); n++; if (st.phys.slip01 > 0) slip++; }
    if (Math.abs(t - 3) < dt / 2) r0 = len(st.p);
    if (++k % hz === 0) { const m = len(V(st.p.x - last.x, st.p.y - last.y, st.p.z - last.z)); if (k > hz) worst = Math.min(worst, m); last = { ...st.p }; }
  }
  return { mean: sum / n, worst, slip: slip / n, rise: (len(st.p) - r0) / 6 };
};
const CASES = [['temperate_forest', 1, [16, 20, 22, 24, 25, 26, 30, 34, 40]], ['alpine_meadow', 1, [20, 22, 24, 26, 27, 30, 34, 40]], ['desert_canyon', 0, [26, 30, 34, 36, 40]], ['desert_canyon', 1, [30, 34, 36, 40]]];
let lo = 99, loAt = '', worstLo = 99, worstAt = '';
for (const hz of [60, 30]) for (const g of [9.81, 4.6, 1.4]) {
  const row = [];
  for (const [b, w, degs] of CASES) for (const deg of degs) {
    const r = walk(b, w, deg, hz, g, 'down');
    row.push(`${b.slice(0, 6)}${w ? 'W' : 'D'}${deg}:${r.mean.toFixed(2)}/${r.worst.toFixed(2)}/${r.slip.toFixed(2)}`);
    if (r.mean < lo) { lo = r.mean; loAt = `${hz}Hz g${g} ${b} ${w} ${deg}`; }
    if (r.worst < worstLo) { worstLo = r.worst; worstAt = `${hz}Hz g${g} ${b} ${w} ${deg}`; }
  }
  console.log(`down ${hz} Hz g ${g}: ` + row.join(' '));
}
console.log(`slowest mean ${lo.toFixed(2)} at ${loAt}; slowest second ${worstLo.toFixed(2)} m at ${worstAt}`);
for (const hz of [60, 30]) {
  const up = walk('temperate_forest', 1, 24, hz, 9.81, 'up'), ac = walk('temperate_forest', 1, 24, hz, 9.81, 'across'), acg = walk('alpine_meadow', 1, 24, hz, 9.81, 'across');
  console.log(`${hz} Hz: up wet litter 24: ${up.mean.toFixed(2)} slip ${up.slip.toFixed(2)}; across wet litter 24: ${ac.mean.toFixed(2)} slip ${ac.slip.toFixed(2)} rise ${ac.rise.toFixed(3)}; across wet grass 24: ${acg.mean.toFixed(2)} slip ${acg.slip.toFixed(2)} rise ${acg.rise.toFixed(3)}`);
}
