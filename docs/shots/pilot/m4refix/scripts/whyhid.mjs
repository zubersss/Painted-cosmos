// When is the figure hidden on a walk (walkcam's walk), and what squeezed the boom: the hull or a trunk?
import { mk, f2, len, sub, BODIES, surface, R } from '/home/user/.pc-scratch/verify/pilot/probes/lib.mjs';
const looks = await import(R + '/src/data/looks.js');
const [body, place] = [process.argv[2] || 'earth', process.argv[3] || 'autumn_woodland'];
const SECS = Number(process.argv[4] || 40);
const o = mk(body); const { sim, pad, P } = o;
const t = { body };
if (place !== 'spawn') { const st = surface.getStandPure(body, place); t.dir = [st.unitDir.x, st.unitDir.y, st.unitDir.z]; }
sim.teleport(t); P(1.5);
pad.press('KeyW');
let was = true;
P(SECS, { each: (tt) => {
  pad.dx += Math.sin(tt * 0.35) * 1.2;
  const vis = sim.explorerVisible();
  if (vis !== was) {
    const ship = len(sub(sim.sh.p, sim.ex.p));
    console.log(`t ${tt.toFixed(2)} ${vis ? 'drawn' : 'HIDDEN'} boom ${f2(sim.footCam.boomNow)} tight ${f2(sim.footCam.tight01)} ship ${f2(ship)} m, grounded ${sim.ex.grounded} alt ${f2(sim.ex.altitude)} mode ${sim.ex.mode}`);
  }
  was = vis;
} });
