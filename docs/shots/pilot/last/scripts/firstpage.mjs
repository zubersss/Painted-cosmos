// The first page in the painted game (quality 0, half scale, 960x540, fresh), and the Space press
// during the walk into the ship. Usage: node firstpage.mjs <tree root> <out dir>
import fs from 'node:fs';
import path from 'node:path';
const root = process.argv[2], out = process.argv[3];
const { startRun, finish, RAD, MOUSE_FOOT } = await import(path.join(root, 'tests/browser.mjs'));
const opt = { out, w: 960, h: 540, query: 'scale=0.5&quality=0&fresh=1&pointerlock=0', root };
const run = await startRun(opt);
const { page, check, info, look, gameWait, until, log } = run;
try {
  await page.mouse.click(run.cx, run.cy);
  await gameWait(0.6);
  await look(60, 0);
  const t0 = (await info()).t;
  let i = await until((x) => x.sketches && x.sketches.count >= 1, 40);
  const hull = await page.evaluate(() => ({ inPic: window.__pc.sim.shipInPicture(), d: Math.hypot(...['x', 'y', 'z'].map((k) => window.__pc.sim.sh.p[k] - window.__pc.sim.ex.p[k])) }));
  check(i.sketches && i.sketches.count >= 1, `the first page: ${JSON.stringify(i.sketches && i.sketches.keys)} ${(i.t - t0).toFixed(1)} s of game time after the look; the ship ${hull.d.toFixed(1)} m off, in the middle of the view: ${hull.inPic}`);
  await page.screenshot({ path: path.join(out, 'firstpage-screen.jpg'), type: 'jpeg', quality: 88 });
  const url = await page.evaluate(() => { const sk = window.__pc.sketches; return sk.get(Object.keys(sk.items)[0]); });
  if (url) fs.writeFileSync(path.join(out, 'firstpage-sketch.jpg'), Buffer.from(url.split(',')[1], 'base64'));
  // Walk to the ship and board; press Space while climbing in.
  i = await info();
  await look((i.shipBearingDeg * RAD) / MOUSE_FOOT, 0);
  await page.keyboard.down('KeyW');
  i = await until((x) => x.canBoard, 60, async (x) => { if (Math.abs(x.shipBearingDeg) > 4) await look((x.shipBearingDeg * RAD) / MOUSE_FOOT * 0.6, 0); });
  await page.keyboard.up('KeyW');
  check(i.canBoard, 'at the ship: ' + i.prompt);
  await page.keyboard.press('KeyE');
  i = await until((x) => x.state === 'BOARDING', 3);
  const tb = i.t;
  await page.keyboard.down('Space');
  await run.sleep(1500);
  await page.keyboard.up('Space');
  const during = (await info()).state;
  i = await until((x) => x.state === 'ATMOSPHERE', 10);
  check(i.state === 'ATMOSPHERE', `Space held 1.5 s from ${during === 'BOARDING' ? 'inside' : 'after'} the walk in (state when released: ${during}): lifted off ${(i.t - tb).toFixed(1)} s of game time after the boarding began (state ${i.state})`);
  const fb = await page.evaluate(() => window.__pc.info().fallback);
  check(Array.isArray(fb) && fb.length === 0, 'fallback empty: ' + JSON.stringify(fb));
} catch (e) { run.fails.push('exception: ' + (e && e.stack ? e.stack : e)); }
await finish(run, opt, {});
