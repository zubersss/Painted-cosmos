// The pace up (and down, and across) a straight slope, by material and wetness, with the suit's assist as PILOT gives it.
// node slopepace.mjs <root> [g=9.81] [wish=4.2] [dirs=up]   -> a table: slope x ground: mean pace over 3..9 s, the slowest second, slip share
const [root, gS = '9.81', wishS = '4.2', dirsS = 'up', hzS = '30'] = process.argv.slice(2);
const { stepExplorerBody, EXPLORER_BODY: T } = await import(root + '/src/physics/explorer.js');
const { makeWorld, V, norm, len, dot } = await import(root + '/src/physics/testworld.mjs');
const { groundAt, MATERIALS } = await import(root + '/src/physics/ground.js');
const g = +gS, wish = +wishS, R = 4000, hz = +hzS;
function ground(biome, slope, wet) {
  return groundAt('earth', { radius: R, slope, liquidRadius: 0, biomeId: biome, biomeWeights: { [biome]: 1 } }, { wetness01: wet, snowDepth: 0, temperature: 288 }, {});
}
const cases = [['temperate_forest', 0], ['temperate_forest', 1], ['alpine_meadow', 0], ['alpine_meadow', 1], ['desert_canyon', 0], ['sea_coast', 0]];
const head = 'slope  ' + cases.map(([b, w]) => (b.slice(0, 9) + (w ? '-wet' : '-dry')).padEnd(34)).join('');
for (const dirn of dirsS.split(',')) {
  console.log(`# g ${g} wish ${wish} m/s, ${dirn}, ${hz} Hz: mean pace 3..9 s / slowest second / share of steps slipping  (material mu+foothold drag)`);
  console.log(head);
  for (let deg = 10; deg <= 46; deg += 2) {
    const row = [];
    for (const [biome, wet] of cases) {
      const a = deg * Math.PI / 180, H = 400, rad = H / Math.tan(a);
      const sample = makeWorld({ R, cone: { dir: norm(V(0, 0, 1)), radius: rad, height: H } });
      // start part-way up the cone, east of the apex; "up" walks west toward the apex
      const x0 = dirn === 'down' ? 0.35 * rad : 0.75 * rad;
      const d = norm(V(Math.sin(x0 / R), 0, Math.cos(x0 / R))), s = sample(d);
      const st = { p: V(d.x * s.radius, d.y * s.radius, d.z * s.radius), v: V(), grounded: true };
      const G = ground(biome, a, wet);
      const env = { sample, gravity: g, air: (p, o) => { o.density = 1.2; o.wind.x = 0; o.wind.y = 0; o.wind.z = 0; return o; }, ground: (su, o) => Object.assign(o, G) };
      const wdir = dirn === 'up' ? V(-1, 0, 0) : dirn === 'down' ? V(1, 0, 0) : V(0, 1, 0);
      const cmd = { wish: V(wdir.x * wish, wdir.y * wish, wdir.z * wish), assistAccel: 4 * Math.min(1, Math.max(0.45, g / 9)) };
      let sum = 0, n = 0, slip = 0, worst = 99, last = { ...st.p }, k = 0;
      const dt = 1 / hz;
      for (let i = 0; i < 9 * hz; i++) {
        stepExplorerBody(st, cmd, dt, env);
        if (i >= 3 * hz) { sum += len(st.v); n++; if (st.phys.slip01 > 0) slip++; }
        if (++k % hz === 0) { const m = len({ x: st.p.x - last.x, y: st.p.y - last.y, z: st.p.z - last.z }); if (k > hz) worst = Math.min(worst, m); last = { ...st.p }; }
      }
      row.push(`${(sum / n).toFixed(2)} / ${worst.toFixed(2)} / ${(slip / n).toFixed(2)} (${G.material.slice(0, 4)} ${(G.friction + G.foothold).toFixed(2)} ${G.drag.toFixed(2)})`.padEnd(34));
    }
    console.log(String(deg).padEnd(7) + row.join(''));
  }
}
