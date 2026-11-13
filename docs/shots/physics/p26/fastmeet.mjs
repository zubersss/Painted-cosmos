const [root] = process.argv.slice(2);
const { stepExplorerBody } = await import(root + '/src/physics/explorer.js');
const R = 4000;
for (const [name, g] of [['Earth', 9.81], ['Mars', 3.71], ['Moon', 1.62]]) for (const hz of [60, 30]) for (const deg of [66, 70, 80]) for (const v0 of [4.2, 7.4]) {
  const k = Math.tan(deg * Math.PI / 180), H = 60, xT = 10 + H / k;
  const h = (x) => x < 10 ? 0 : x < xT ? (x - 10) * k : H, hs = (x) => x < 10 || x >= xT ? 0 : k;
  const sample = (d) => { const l = Math.hypot(d.x, d.y, d.z), ux = d.x / l, uz = d.z / l, x = Math.atan2(ux, uz) * R, s = hs(x), n = Math.hypot(1, s);
    return { radius: R + h(x), normal: { x: (ux - uz * s) / n, y: d.y / l / n, z: (uz + ux * s) / n }, liquidRadius: 0, slope: Math.atan(Math.abs(s)) }; };
  const env = { sample, gravity: g, ground: (s, o) => Object.assign(o, { material: 'rock', friction: 0.9, kinetic: 0.7, foothold: 0.4, restitution: 0.1, sink: 0, drag: 0, dust: 0.03 }) };
  const st = { p: { x: Math.sin(9.6 / R) * R, y: 0, z: Math.cos(9.6 / R) * R }, v: { x: v0, y: 0, z: 0 }, grounded: true };
  let top = 0, thrown = 0, rel = 0, was = true, air = 0;
  for (let i = 0; i < hz * 12; i++) {
    const t = Math.atan2(st.p.x, st.p.z);
    stepExplorerBody(st, { wish: { x: 7.4 * Math.cos(t), y: 0, z: -7.4 * Math.sin(t) }, assistAccel: 4 * Math.min(1, Math.max(0.45, g / 9)) }, 1 / hz, env);
    const r = Math.hypot(st.p.x, st.p.y, st.p.z); top = Math.max(top, r - R);
    if (!st.grounded) { if (was) rel = r; air++; thrown = Math.max(thrown, r - rel); } was = st.grounded;
  }
  console.log(name, hz, 'Hz', deg, 'deg from', v0, 'm/s: highest', top.toFixed(2), 'thrown', thrown.toFixed(2), 'air steps', air, 'ends', (Math.hypot(st.p.x, st.p.y, st.p.z) - R).toFixed(2));
}
