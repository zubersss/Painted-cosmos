// Earth's direction in the Moon's frame after setSunHour at several hours, old and new ephemeris.
const [oldRoot, newRoot] = process.argv.slice(2);
for (const [name, root] of [['old', oldRoot], ['new', newRoot]]) {
  const { Ephemeris } = await import(root + '/src/core/orbits.js');
  const { BODIES } = await import(root + '/src/data/bodies.js');
  const V = await import(root + '/src/core/vec.js');
  const e = new Ephemeris(BODIES), t = 505, dir = V.norm(V.V(-0.85, 0.1, -0.5));
  const ein = () => V.qRotate(V.qConj(e.orientation('moon', t)), V.norm(V.sub(e.position('earth', t), e.position('moon', t))));
  const b0 = ein(); let worst = 0;
  for (const h of [6, 9.5, 10, 15.4, 18, 22]) { e.setSunHour('moon', t, dir, h); const d = ein(); worst = Math.max(worst, Math.acos(Math.min(1, d.x * b0.x + d.y * b0.y + d.z * b0.z))); }
  console.log(name, 'Earth moves in the Moon\'s sky by up to', (worst * 57.3).toFixed(1), 'degrees over six hours set');
}
