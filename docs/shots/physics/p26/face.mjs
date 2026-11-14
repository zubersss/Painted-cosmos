// A synthetic face (Node): level to 10 m, a face at `deg` degrees `H` m high, level beyond. Shift+W (a wish of 7.4 m/s,
// PILOT's assist) for `secs` s. node face.mjs <root> g deg H [hz=60] [secs=10] [every=0 (steps between printed rows)] [mu=0.9 foothold=0.4]
const [root, g_ = '9.81', deg_ = '70', H_ = '10', hz_ = '60', secs_ = '10', every_ = '0', mu_ = '0.9', fh_ = '0.4', v_ = '7.4'] = process.argv.slice(2);
const { stepExplorerBody } = await import(root + '/src/physics/explorer.js');
const R = 4000, g = +g_, deg = +deg_, H = +H_, hz = +hz_, secs = +secs_, every = +every_, v = +v_;
const k = Math.tan(deg * Math.PI / 180), xT = 10 + H / k;
const h = (x) => x < 10 ? 0 : x < xT ? (x - 10) * k : H, hs = (x) => x < 10 ? 0 : x < xT ? k : 0;
const sample = (d) => { const l = Math.hypot(d.x, d.y, d.z), ux = d.x / l, uz = d.z / l, x = Math.atan2(ux, uz) * R, s = hs(x), n = Math.hypot(1, s);
  return { radius: R + h(x), normal: { x: (ux - uz * s) / n, y: d.y / l / n, z: (uz + ux * s) / n }, liquidRadius: 0, slope: Math.atan(Math.abs(s)) }; };
const env = { sample, gravity: g, ground: (s, o) => Object.assign(o, { material: 'rock', friction: +mu_, kinetic: 0.7 * +mu_ / 0.9, foothold: +fh_, restitution: 0.1, sink: 0, drag: 0, dust: 0.03 }) };
const X0 = +(process.env.X0 || 2), V0 = +(process.env.V0 || 0); const st = { p: { x: Math.sin(X0 / R) * R, y: 0, z: Math.cos(X0 / R) * R }, v: { x: V0, y: 0, z: 0 }, grounded: true };
let top = 0, gain = 0, prev = null, air = 0, maxUp = 0;
for (let i = 0; i < hz * secs; i++) {
  const t = Math.atan2(st.p.x, st.p.z);
  stepExplorerBody(st, { wish: { x: v * Math.cos(t), y: 0, z: -v * Math.sin(t) }, assistAccel: 4 * Math.min(1, Math.max(0.45, g / 9)) }, 1 / hz, env);
  const x = Math.atan2(st.p.x, st.p.z) * R, r = Math.hypot(st.p.x, st.p.y, st.p.z), B = st.phys;
  const up = r - R; top = Math.max(top, up);
  if (prev != null && st.grounded && x > 10 && x < xT && up > prev) gain += up - prev; prev = up;
  if (!st.grounded) air++;
  const vu = (st.v.x * st.p.x + st.v.z * st.p.z) / r; maxUp = Math.max(maxUp, vu);
  if (every && i % every === 0) console.log((i / hz).toFixed(3), 'x', x.toFixed(3), 'up', up.toFixed(3), 'gnd', st.grounded ? 1 : 0, 'vh', B.speedGround.toFixed(2), 'vu', vu.toFixed(2), 'hip', B.hip.toFixed(3), 'hipV', B.hipV.toFixed(2), 'trend', B.trend.toFixed(2), 'base', (B.base - R).toFixed(2), 'grip', B.grip, 'cl', B.clamberT.toFixed(2), 'slip', B.slip01.toFixed(2), 'brace', B.brace.toFixed(2), 'cap', B.paceCap > 1e8 ? '-' : B.paceCap.toFixed(2), 'ahead', B.paceAhead > 1e8 ? '-' : B.paceAhead.toFixed(2), 'crest', B.paceCrest > 1e8 ? '-' : B.paceCrest.toFixed(2), 'way', B.way && B.way.ok ? B.way.lo.toFixed(1) + '..' + B.way.hi.toFixed(1) : '-');
}
const x = Math.atan2(st.p.x, st.p.z) * R;
console.log(`g ${g} ${deg} deg ${H} m ${hz} Hz: highest ${top.toFixed(2)} m, gained on the face (feet down) ${gain.toFixed(2)} m, ended x ${x.toFixed(2)} up ${(Math.hypot(st.p.x, st.p.y, st.p.z) - R).toFixed(2)}, air steps ${air}, fastest up ${maxUp.toFixed(2)} m/s`);
