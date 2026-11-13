// (the verifier's instrument, copied unchanged below from /home/user/.pc-scratch/verify/physics/scripts/slope2.mjs)
// Verifier: walking a straight slope of a cone (PHYSICS' testworld), W held, by material and wetness.
// Reports SIGNED progress: metres gained uphill per second (height gained / s and horizontal progress along the
// wish / s over 3..9 s), the share of steps slipping, airborne, and the least progress in any one second.
// node slope2.mjs <root> [g=9.0] [wish=4.2] [dir=up|down|across] [hz=30] [degs=14,16,...]
const [root, gS = '9.0', wishS = '4.2', dirn = 'up', hzS = '30', degsS = '12,16,18,20,22,24,25,26,27,28,30,32,34,36,40'] = process.argv.slice(2);
const { stepExplorerBody } = await import(root + '/src/physics/explorer.js');
const { makeWorld, V, norm, len } = await import(root + '/src/physics/testworld.mjs');
const { groundAt } = await import(root + '/src/physics/ground.js');
const g = +gS, wish = +wishS, R = 4000, hz = +hzS, dt = 1 / hz;
const ground = (biome, slope, wet) => groundAt('earth', { radius: R, slope, liquidRadius: 0, biomeId: biome, biomeWeights: { [biome]: 1 } }, { wetness01: wet, snowDepth: 0, temperature: 288 }, {});
const cases = [['temperate_forest', 0], ['temperate_forest', 1], ['alpine_meadow', 1], ['desert_canyon', 0], ['desert_canyon', 1], ['sea_coast', 1]];
console.log(`# ${root.split('/').slice(-2).join('/')} g ${g} wish ${wish} ${dirn} ${hz} Hz: rise m/s | along-wish m/s | least along-wish in a second | slip share | air share`);
console.log('deg  ' + cases.map(([b, w]) => (b.slice(0, 8) + (w ? '-wet' : '-dry')).padEnd(36)).join(''));
for (const deg of degsS.split(',').map(Number)) {
  const row = [];
  for (const [biome, wet] of cases) {
    const a = deg * Math.PI / 180, H = 400, rad = H / Math.tan(a);
    const sample = makeWorld({ R, cone: { dir: norm(V(0, 0, 1)), radius: rad, height: H } });
    const x0 = dirn === 'down' ? 0.35 * rad : 0.75 * rad;
    const d = norm(V(Math.sin(x0 / R), 0, Math.cos(x0 / R))), s = sample(d);
    const st = { p: V(d.x * s.radius, d.y * s.radius, d.z * s.radius), v: V(), grounded: true };
    const G = ground(biome, a, wet);
    const env = { sample, gravity: g, air: (p, o) => { o.density = 1.2; o.wind.x = 0; o.wind.y = 0; o.wind.z = 0; return o; }, ground: (su, o) => Object.assign(o, G) };
    const wdir = dirn === 'up' ? V(-1, 0, 0) : dirn === 'down' ? V(1, 0, 0) : V(0, 1, 0);
    const cmd = { wish: V(wdir.x * wish, wdir.y * wish, wdir.z * wish), assistAccel: 4 * Math.min(1, Math.max(0.45, g / 9)) };
    let slip = 0, air = 0, n = 0, least = 99, r0 = 0, a0 = 0, rPrev = 0, aPrev = 0;
    const along = () => st.p.x * wdir.x + st.p.y * wdir.y + st.p.z * wdir.z, rr = () => len(st.p);
    for (let i = 0; i < 9 * hz; i++) {
      if (i === 3 * hz) { r0 = rr(); a0 = along(); }
      if (i % hz === 0) { if (i >= 2 * hz) least = Math.min(least, along() - aPrev); aPrev = along(); }
      stepExplorerBody(st, cmd, dt, env);
      if (i >= 3 * hz) { n++; if (st.phys && st.phys.slip01 > 0) slip++; if (!st.grounded) air++; }
    }
    const rise = (rr() - r0) / 6, alg = (along() - a0) / 6;
    row.push(`${rise.toFixed(2)} | ${alg.toFixed(2)} | ${least.toFixed(2)} | ${(slip / n).toFixed(2)} | ${(air / n).toFixed(2)}`.padEnd(36));
  }
  console.log(String(deg).padEnd(5) + row.join(''));
}
