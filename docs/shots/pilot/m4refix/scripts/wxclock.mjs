// Earth's weather at the weather and motion films' clocks, old and new (PHYSICS moved Earth's weather +1530 s)
const R = process.env.ROOT || '/home/user/painted-cosmos';
const { weatherAt, DEFAULT_SEED } = await import(R + '/src/physics/weather.js');
const env = { moist: 1, fog: 0.3, sun01: 0.6, wind: 4 };
const dir = (latDeg, lonDeg) => { const a = latDeg * Math.PI / 180, b = lonDeg * Math.PI / 180, c = Math.cos(a); return { x: c * Math.sin(b), y: Math.sin(a), z: c * Math.cos(b) }; };
const spawn = { x: 0.1736, y: 0.5817, z: 0.7946 };
const show = (name, d, t) => { const w = weatherAt('earth', d.x, d.y, d.z, 30, t, DEFAULT_SEED, env, {}); console.log(`${name.padEnd(18)} t ${String(t).padStart(4)}: ${w.kind.padEnd(13)} rain ${w.precipitation.rate.toFixed(1).padStart(5)} mm/h (${w.precipitation.type || '-'}) cloud ${w.cloud01.toFixed(2)} storm ${w.storm01.toFixed(2)}`); };
for (const [name, a, b] of [['earth-before', 120, 1650], ['earth-arrives', 166, 1696], ['earth-storm', 240, 1770], ['earth-flash', 244, 1774], ['earth-after', 400, 1930], ['motion storm', 240, 1770]]) { show(name + ' old', spawn, a); show(name + ' new', spawn, b); }
for (const t of [190, 1720]) show('earth-blizzard', dir(62.41, 49.46), t);
