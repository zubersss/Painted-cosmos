// Items (2) and (5) in the real game: the ship 150 m over Mars, 1.2 km from "a place to land" with the place
// behind it; then the nose on Jupiter (aimed, not chosen) in the air. Frames and the marks.
// Usage: node flightmarks-film.mjs <tree root> <out dir> <tag>
import fs from 'node:fs';
import path from 'node:path';
const [root, out, tag] = process.argv.slice(2);
const { startRun, finish } = await import(path.join(root, 'tests/browser.mjs'));
const opt = { out, w: 960, h: 540, query: 'scale=0.5&quality=0&fresh=1&pointerlock=0&card=0', root };
fs.mkdirSync(out, { recursive: true });
const run = await startRun(opt);
const { page, check, info, gameWait, log } = run;
const lines = [];
const note = (s) => { lines.push(s); log(s); };
try {
  await gameWait(1);
  // 1.2 km north of the place, nose north and a little west: the place lies behind, a little to the right... or left.
  const put = (heading, pitchDeg = 0, arc = 1200) => page.evaluate(({ heading, pitchDeg, arc }) => {
    const pc = window.__pc, sp = pc.world.getSpawn('mars').unitDir, R = 3000;   // the game's Mars
    const l = Math.hypot(sp.x, sp.y, sp.z), u = { x: sp.x / l, y: sp.y / l, z: sp.z / l };
    // local east = Y x up, north = up x east (as sim.teleport)
    let e = { x: u.z, y: 0, z: -u.x }; const el = Math.hypot(e.x, e.z) || 1; e = { x: e.x / el, y: 0, z: e.z / el };
    const n = { x: u.y * e.z - u.z * e.y, y: u.z * e.x - u.x * e.z, z: u.x * e.y - u.y * e.x };
    const k = Math.tan(arc / R), d = [u.x + n.x * k, u.y + n.y * k, u.z + n.z * k];
    pc.teleport({ body: 'mars', dir: d, ship: true, altitude: 150, hour: 12, heading, pitchDeg });
    return true;
  }, { heading, pitchDeg, arc });
  const marks = async () => (await info()).marks || [];
  for (const [i, hd, arc] of [[1, -12, 1200], [2, 12, 1200], [3, -20, 3000]]) {
    await put(hd, 0, arc);
    await gameWait(1.5);
    await page.evaluate(() => window.__pc.settle(6));
    const inf = await info();
    const m = (inf.marks || []).filter((x) => x.label === 'a place to land' || x.kind === 'target');
    note(`${tag} ${arc} m north of the place, heading ${hd}: state ${inf.state}, ${inf.ship ? Math.round(inf.ship.altGround) : '?'} m up; marks ${JSON.stringify(m)}`);
    await page.screenshot({ path: path.join(out, `${tag}-site-behind-${i}.jpg`), type: 'jpeg', quality: 86 });
  }
  // The nose on Jupiter, in the air (aimed, not chosen on the map), right over the place.
  await put(0, 0, 1);
  await gameWait(0.5);
  let a = await page.evaluate(() => window.__pc.aimAt('jupiter'));
  await put(a.yawDeg, a.pitchDeg, 1);
  await gameWait(1.5);
  a = await page.evaluate(() => window.__pc.aimAt('jupiter'));
  const inf = await info();
  const tgt = await page.evaluate(() => ({ target: window.__pc.sim.target, locked: window.__pc.sim.targetLocked }));
  note(`${tag} nose on Jupiter (off ${a.yawDeg.toFixed(1)}, ${a.pitchDeg.toFixed(1)} deg), state ${inf.state}, target ${tgt.target} locked ${tgt.locked}; marks ${JSON.stringify(inf.marks)}`);
  await page.screenshot({ path: path.join(out, `${tag}-nose-on-jupiter.jpg`), type: 'jpeg', quality: 86 });
  const fb = await page.evaluate(() => window.__pc.info().fallback);
  check(Array.isArray(fb) && fb.length === 0, 'fallback empty: ' + JSON.stringify(fb));
} catch (e) { run.fails.push('exception: ' + (e && e.stack ? e.stack : e)); }
fs.writeFileSync(path.join(out, `${tag}-marks.txt`), lines.join('\n') + '\n');
await finish(run, opt, {});
