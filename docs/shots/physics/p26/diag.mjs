// A wall met at an angle: level to 10 m, a 70 degree face; the wish at ANG degrees off square-on. node diag.mjs <root> g ang [hz]
const [root, g_ = '9.81', ang_ = '45', hz_ = '60'] = process.argv.slice(2);
const { stepExplorerBody } = await import(root + '/src/physics/explorer.js');
const R = 4000, g = +g_, hz = +hz_, a = +ang_ * Math.PI / 180, k = Math.tan(70 * Math.PI / 180), H = 30, xT = 10 + H / k, v = 7.4;
const h = (x) => x < 10 ? 0 : x < xT ? (x - 10) * k : H, hs = (x) => x < 10 ? 0 : x < xT ? k : 0;
const sample = (d) => { const l = Math.hypot(d.x, d.y, d.z), ux = d.x / l, uz = d.z / l, x = Math.atan2(ux, uz) * R, s = hs(x), n = Math.hypot(1, s);
  return { radius: R + h(x), normal: { x: (ux - uz * s) / n, y: d.y / l / n, z: (uz + ux * s) / n }, liquidRadius: 0, slope: Math.atan(Math.abs(s)) }; };
const env = { sample, gravity: g, ground: (s, o) => Object.assign(o, { material: 'rock', friction: 0.9, kinetic: 0.7, foothold: 0.4, restitution: 0.1, sink: 0, drag: 0, dust: 0.03 }) };
const st = { p: { x: Math.sin(2 / R) * R, y: 0, z: Math.cos(2 / R) * R }, v: { x: 0, y: 0, z: 0 }, grounded: true };
let top = 0, walls = 0, air = 0;
for (let i = 0; i < hz * 10; i++) {
  const t = Math.atan2(st.p.x, st.p.z);
  stepExplorerBody(st, { wish: { x: v * Math.cos(a) * Math.cos(t), y: v * Math.sin(a), z: -v * Math.cos(a) * Math.sin(t) }, assistAccel: 4 * Math.min(1, Math.max(0.45, g / 9)) }, 1 / hz, env);
  const r = Math.hypot(st.p.x, st.p.y, st.p.z); top = Math.max(top, r - R - 0); if (st.phys.wall) walls++; if (!st.grounded) air++;
  if (i % (hz / 2) === 0) console.log((i / hz).toFixed(1), 'x', (Math.atan2(st.p.x, st.p.z) * R).toFixed(2), 'y', st.p.y.toFixed(2), 'up', (r - R).toFixed(2), 'v', st.phys.speedGround.toFixed(2), 'wall', st.phys.wall, 'brace', st.phys.brace.toFixed(2), 'gait', st.phys.gait);
}
console.log(`g ${g} at ${ang_} degrees: highest ${top.toFixed(2)} m, wall steps ${walls}, air ${air}, y ${st.p.y.toFixed(1)} m`);
