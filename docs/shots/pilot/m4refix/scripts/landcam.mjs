// The landing's chase camera among the crowns (PHYSICS 4, the landing camera): the real Sim at Earth's spawn,
// board, lift off, 9 s of W at full throttle level over the wood, E (film2's landfast). Each frame of the landing:
// the lens's distance to the nearest crown (the cameras' crown model), the boom, and the share of the picture
// where a ray from the lens meets a crown before it reaches the ship's distance ("cover"), and before 3.6 m (dabs).
// Usage: ROOT=<tree> node landcam.mjs [margin]
import { mk, f2, len, dot, norm, sub, scale, S, FEEL, RAD, vec } from '/home/user/.pc-scratch/verify/pilot/probes/lib.mjs';
const { add, qRotate, V, cross } = vec;
const R = process.env.ROOT;
const cam = await import(R + '/src/player/camera.js');
const o = mk('earth'); const { sim, pad, P, holdPitch } = o;
P(0.5);
pad.dx += (sim.info().shipBearingDeg * RAD) / FEEL.mouseFoot; P(0.2);
pad.press('KeyW'); P(60, { each: () => { const b = sim.info().shipBearingDeg; if (b != null) pad.dx += (b * RAD / FEEL.mouseFoot) * 0.1; }, until: () => sim.info().canBoard }); pad.release('KeyW');
P(0.3); pad.tap('KeyE'); P(8, { until: () => sim.sm.state === S.LANDED }); P(1);
pad.tap('Space'); P(8);
pad.press('KeyW'); P(9, { each: () => holdPitch(0) }); pad.release('KeyW');
pad.tap('KeyE');
const rows = [];
let midW = 0, midN = 0, worstCover = 0, worstAt = null, n = 0, sumCover = 0, frames = 0;
P(40, { each: (t) => {
  if (sim.sm.state !== S.LANDING && sim.sm.state !== S.ATMOSPHERE) return;
  frames++;
  if (frames % 3) return;
  const every = (frames % 15 === 0);
  const solid = sim.crownSolid(), pose = sim.camPose; if (!solid || !pose) return;
  const p = pose.p, dir = qRotate(pose.q, V(0, 0, -1)), up = qRotate(pose.q, V(0, 1, 0)), right = cross(dir, up);
  const dShip = len(sub(sim.sh.p, p));
  const th = Math.tan((pose.fov * Math.PI) / 360), tw = th * 16 / 9;
  let hit = 0, near = 0, mid = 0, tot = 0;
  for (let j = 0; j < 12; j++) for (let i = 0; i < 20; i++) {
    const x = ((i + 0.5) / 20 * 2 - 1) * tw, y = ((j + 0.5) / 12 * 2 - 1) * th;
    const r = norm(add(add(dir, scale(right, x)), scale(up, y)));
    let s = 0.2, got = -1;
    for (let k = 0; k < 60 && s < Math.max(dShip, 8); k++) { const d = solid(add(p, scale(r, s))); if (d < 0.05) { got = s; break; } s += Math.max(0.15, d); }
    tot++; if (got >= 0) { hit++; if (got < 3.6) near++; else if (got < 8) mid++; }
  }
  const cover = hit / tot;
  sumCover += cover; n++;
  if (cover > worstCover) { worstCover = cover; worstAt = sim.t; }
  if (every || true) rows.push(`t ${f2(sim.t)} ${sim.sm.state} hAG ${f2(sim.sh.altGround)} v ${f2(sim.sh.speed)} lens-crown ${f2(solid(p))} m boom ${f2(len(sub(p, sim.sh.p)))} cover ${(100 * cover).toFixed(0)} % (within 3.6 m ${(100 * near / tot).toFixed(0)} %, 3.6 to 8 m ${(100 * mid / tot).toFixed(0)} %)`); midW = Math.max(midW, mid / tot); if (mid / tot > 0.15) midN++;
}, until: () => sim.sm.state === S.LANDED });
if (process.argv.includes('-v')) console.log(rows.join('\n'));
console.log(`landing ${sim.sm.state}: crown cover of the picture between lens and ship: worst ${(100 * worstCover).toFixed(0)} % at t ${f2(worstAt)}, mean ${(100 * sumCover / Math.max(1, n)).toFixed(1)} %; frames over 20 %: ${rows.filter((r) => +r.match(/cover (\d+)/)[1] > 20).length} of ${rows.length}; a crown 3.6 to 8 m from the lens: worst ${(100 * midW).toFixed(0)} % of the picture, over 15 % in ${midN} of ${rows.length} looks (a look every 3 frames)`);
