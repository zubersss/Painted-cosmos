import { Sim } from '/home/user/painted-cosmos/src/core/sim.js';
import { stubSurface, stubSpawn } from '/home/user/painted-cosmos/src/core/stubs/surface.js';
import { Pad, play, len, sub } from '/home/user/painted-cosmos/tests/helpers.mjs';
const sim = new Sim({ sampleSurface: stubSurface, getSpawn: (id) => stubSpawn(id).unitDir });
const pad = new Pad();
for (const t of [0.5, 2, 5, 10, 20]) {
  play(sim, pad, t - (sim.t || 0) > 0 ? t - sim.t : 0);
  console.log('t', sim.t.toFixed(1), 'state', sim.sm.state, 'dist', len(sub(sim.sh.p, sim.ex.p)).toFixed(1), 'inPic', sim.shipInPicture(), 'hull', sim.hullInView(0.7).toFixed(3));
}
