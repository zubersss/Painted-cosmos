// How much of the ground round a place lies between two slopes (Node): node slopes.mjs <root> <body> <place|spawn> [radius=150]
const [root, body, place, radS = '150'] = process.argv.slice(2);
const surface = await import(root + '/src/world/surface.js');
const V = await import(root + '/src/core/vec.js');
const ss = (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z);
const d0 = V.norm(place === 'spawn' ? surface.getSurface(body).getSpawn() : surface.getStandPure(body, place).unitDir), R0 = ss(body, d0).radius;
const east = V.norm(V.cross({ x: 0, y: 1, z: 0 }, d0)), north = V.cross(d0, east);
const bins = [0, 10, 20, 30, 40, 50, 90], n = new Array(bins.length - 1).fill(0); let tot = 0, wet = 0;
for (let x = -+radS; x <= +radS; x += 3) for (let y = -+radS; y <= +radS; y += 3) {
  if (x * x + y * y > radS * radS) continue;
  const s = ss(body, V.norm(V.add(d0, V.scale(V.add(V.scale(east, x), V.scale(north, y)), 1 / R0))));
  if (s.isLiquid) { wet++; continue; }
  const a = s.slope * 57.3; tot++;
  for (let i = 0; i < n.length; i++) if (a >= bins[i] && a < bins[i + 1]) n[i]++;
}
console.log(`${body} ${place}, within ${radS} m (dry ground, ${tot} samples; ${wet} in water): ` + n.map((c, i) => `${bins[i]}-${bins[i + 1]} deg ${(100 * c / tot).toFixed(1)} %`).join(', '));
