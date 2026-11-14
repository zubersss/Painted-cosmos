// dusk.mjs: the evening at the spawn with the game's own framing, as the clock runs. Usage: node dusk.mjs <root> <out>
import { start } from './plib.mjs';
const [root, out] = process.argv.slice(2);
const G = await start({ root, out, w: 960, h: 540, query: 'dynres=0&pointerlock=0&fresh=1&save=0&audio=0&quality=2' });
const { page, log, run, shot, film, settle } = G;
try {
  await page.mouse.click(G.cx, G.cy);
  await run(0.5);
  const r = await page.evaluate(() => { const pc = window.__pc, d = pc.world.getSpawn('earth').unitDir; pc.setClock(420); pc.teleport({ body: 'earth', dir: [d.x, d.y, d.z], hour: 17.45, firstPerson: false }); return { t: pc.sim.t }; });
  log('placed', JSON.stringify(r), JSON.stringify(await settle()));
  await run(1);
  await film('c10-dusk', { frames: 12, every: 100, dt: 0.1, hud: true });       // 10 s of play between frames
} catch (e) { log('FAILED', String(e.stack || e.message).split('\n').slice(0, 4).join(' | ')); }
await G.done();
