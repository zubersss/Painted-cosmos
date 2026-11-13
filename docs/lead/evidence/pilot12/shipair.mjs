// The ship in the air as a player holds it (Node, PILOT's Sim with PHYSICS, 60 Hz, the real worlds):
//  hover  : hands off at 30 m for 30 s: how far it drifts, how its height wanders, how the hull rocks
//  cross  : throttle 0.5 for 20 s on four headings: the ground speed made, the drift off the nose's line
//  top    : full throttle low: top speed, seconds to 90 % of it
//  land   : E from a 25 m hover: seconds to LANDED, the sink at the end, how far the legs slide in the 20 s after
// node shipair.mjs <root> <body> <place|spawn> <clock> [parts=hover,cross,top,land]
const [root, body, place, clockS = '30', partsS = 'hover,cross,top,land'] = process.argv.slice(2);
const { Sim } = await import(root + '/src/core/sim.js');
const surface = await import(root + '/src/world/surface.js');
const obstacles = await import(root + '/src/world/obstacles.js');
const P = await import(root + '/src/physics/index.js');
const { Pad, play } = await import(root + '/tests/helpers.mjs');
const V = await import(root + '/src/core/vec.js');
const ss = (id, d) => surface.sampleSurfacePure(id, d.x, d.y, d.z);
const d0 = place === 'spawn' ? surface.getSurface(body).getSpawn() : surface.getStandPure(body, place).unitDir;
const clock = +clockS, parts = partsS.split(',');
const make = () => {
  const physics = P.createPhysics({ sampleSurface: ss });
  const sim = new Sim({ sampleSurface: ss, getSpawn: (id) => surface.getSurface(id).getSpawn(), sampleObstacles: (id, d, r) => obstacles.sampleObstaclesPure(id, d.x, d.y, d.z, r), physics, body });
  sim.t = clock; return { sim, physics };
};
const DEG = 180 / Math.PI;
// how far the drawn hull is off level: the hull's own attitude plus PHYSICS' buffetAngle (the chop and the wind's trim), degrees
const tilt = (sim) => { const u = V.norm(sim.sh.p), hu = V.qRotate(sim.sh.q, { x: 0, y: 1, z: 0 }); const b = sim.sh.phys && sim.sh.phys.buffetAngle; const ba = b ? Math.hypot(b.pitch, b.roll) * DEG : 0; return Math.acos(Math.max(-1, Math.min(1, V.dot(u, hu)))) * DEG + ba; };
{
  const { sim, physics } = make(); sim.teleport({ body, dir: [d0.x, d0.y, d0.z], ship: true, altitude: 30, throttle: 0, heading: 0 }); play(sim, new Pad(), 1);
  const h = physics.here;
  console.log(`# ${body} ${place} clock ${clock}: weather ${h.weather.kind} (${h.weather.intensity01.toFixed(2)}), wind at the hull ${h.air.speed.toFixed(1)} m/s, gust01 ${(h.air.gust01 || 0).toFixed(2)}, air ${h.air.density.toFixed(2)} kg/m3`);
}
if (parts.includes('hover')) {
  const { sim } = make(); sim.teleport({ body, dir: [d0.x, d0.y, d0.z], ship: true, altitude: 30, throttle: 0, heading: 0 }); const pad = new Pad(); play(sim, pad, 2);
  const p0 = { ...sim.sh.p }; let lo = 1e9, hi = -1e9, tl = 0, vmax = 0, n = 0, tsum = 0; const alts = [];
  play(sim, pad, 30, { each: () => { const a = sim.sh.altGround; lo = Math.min(lo, a); hi = Math.max(hi, a); const t = tilt(sim); tl = Math.max(tl, t); tsum += t; n++; vmax = Math.max(vmax, sim.sh.speed); alts.push(a); } });
  const up = V.norm(p0), dv = V.sub(sim.sh.p, p0), horiz = V.len(V.sub(dv, V.scale(up, V.dot(dv, up))));
  // the hull's largest change of height within any one second
  let jump = 0; for (let i = 60; i < alts.length; i++) jump = Math.max(jump, Math.abs(alts[i] - alts[i - 60]));
  console.log(`  hover, hands off 30 s: drifted ${horiz.toFixed(1)} m (fastest ${vmax.toFixed(1)} m/s); height over the ground ${lo.toFixed(1)} .. ${hi.toFixed(1)} m (most in one second ${jump.toFixed(1)} m); hull off level mean ${(tsum / n).toFixed(1)}, worst ${tl.toFixed(1)} deg`);
}
if (parts.includes('cross')) {
  const row = [];
  for (const hd of [0, 90, 180, 270]) {
    const { sim } = make(); sim.teleport({ body, dir: [d0.x, d0.y, d0.z], ship: true, altitude: 40, throttle: 0.5, heading: hd }); const pad = new Pad(); play(sim, pad, 4);
    const p0 = { ...sim.sh.p }, f0 = V.qRotate(sim.sh.q, { x: 0, y: 0, z: -1 }); let tl = 0;
    play(sim, pad, 16, { each: () => { tl = Math.max(tl, tilt(sim)); } });
    const up = V.norm(p0), dv0 = V.sub(sim.sh.p, p0), dv = V.sub(dv0, V.scale(up, V.dot(dv0, up))), fh = V.norm(V.sub(f0, V.scale(up, V.dot(f0, up))));
    const along = V.dot(dv, fh), side = V.len(V.sub(dv, V.scale(fh, along)));
    row.push(`h${hd}: ${(along / 16).toFixed(1)} m/s along the nose, ${side.toFixed(0)} m off its line (${(Math.atan2(side, along) * DEG).toFixed(1)} deg), worst tilt ${tl.toFixed(0)}`);
  }
  console.log('  cruise at half throttle 16 s: ' + row.join('; '));
}
if (parts.includes('top')) {
  const { sim } = make(); sim.teleport({ body, dir: [d0.x, d0.y, d0.z], ship: true, altitude: 40, heading: 30 }); const pad = new Pad(); play(sim, pad, 1);
  pad.press('KeyW'); const vs = []; play(sim, pad, 30, { each: () => vs.push(sim.sh.speed) });
  const top = Math.max(...vs); let t90 = 0; for (let i = 0; i < vs.length; i++) if (vs[i] > 0.9 * top) { t90 = i / 60; break; }
  let t50 = 0; for (let i = 0; i < vs.length; i++) if (vs[i] > 0.5 * top) { t50 = i / 60; break; }
  pad.release('KeyW'); const pb = { ...sim.sh.p }; pad.press('KeyX'); let tb = null;
  play(sim, pad, 40, { each: (t) => { if (tb == null && sim.sh.speed < 1) tb = t; }, until: () => sim.sh.speed < 0.5 });
  console.log(`  full throttle at 40 m: top ${top.toFixed(0)} m/s (half of it in ${t50.toFixed(1)} s, 90 % in ${t90.toFixed(1)} s); X: stopped in ${tb == null ? '>40' : tb.toFixed(1)} s over ${V.len(V.sub(sim.sh.p, pb)).toFixed(0)} m`);
}
if (parts.includes('land')) {
  const { sim } = make(); sim.teleport({ body, dir: [d0.x, d0.y, d0.z], ship: true, altitude: 25, throttle: 0 }); sim.sh.v = { x: 0, y: 0, z: 0 }; const pad = new Pad(); play(sim, pad, 1);
  pad.tap('KeyE'); let vl = 0, said = '';
  const tland = play(sim, pad, 60, { each: () => { vl = -sim.info().ship.vUp; if (sim.notice && sim.notice.text) said = sim.notice.text; }, until: () => sim.sm.state === 'LANDED' });
  const p1 = { ...sim.sh.p }; let tl = 0, moved = 0;
  play(sim, pad, 20, { each: () => { tl = Math.max(tl, tilt(sim)); moved = Math.max(moved, V.len(V.sub(sim.sh.p, p1))); } });
  const g = ss(body, V.norm(sim.sh.p));
  console.log(`  E at 25 m: ${sim.sm.state === 'LANDED' ? 'LANDED in ' + tland.toFixed(1) + ' s' : 'NOT LANDED (' + sim.sm.state + ')'}, sink at the end ${vl.toFixed(2)} m/s${said ? ', said "' + said + '"' : ''}; ground ${(g.slope * DEG).toFixed(0)} deg${g.isLiquid ? ' (liquid)' : ''}; in the 20 s after: moved ${moved.toFixed(2)} m, hull off level up to ${tl.toFixed(1)} deg`);
}
