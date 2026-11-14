// Capture one frame of the game for evidence, tolerant of very slow (software GL) frames.
// Usage: node tests/capture.mjs <out.jpg> [--query "k=v&..."] [--root dir] [--w 640 --h 360]
//          [--eval "js"]... [--settle] [--wait gameSeconds]
// Steps: wait for ready -> run each --eval -> optional settle -> wait game seconds -> screenshot.
import { openPage } from '../tools/shot.mjs';

const args = process.argv.slice(2);
const out = args.shift();
const opt = { w: 640, h: 360, query: '', evals: [], wait: 0 };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--eval') opt.evals.push(args[++i]);
  else if (a === '--settle') opt.settle = true;
  else if (a.startsWith('--')) opt[a.slice(2)] = args[++i];
}
const query = 'dynres=0&pointerlock=0&card=0' + (opt.query ? '&' + opt.query : '');
const { page, problems, close } = await openPage({ pagePath: '/index.html?' + query, w: Number(opt.w), h: Number(opt.h), root: opt.root });
let ok = true;
try {
  await page.waitForFunction('window.__pcReady === true', null, { timeout: 300000, polling: 250 });
  for (const js of opt.evals) await page.evaluate(js);
  if (opt.settle) await page.evaluate(() => window.__pc.settle(12));
  if (Number(opt.wait) > 0) {
    await page.evaluate((s) => new Promise((resolve) => {
      const t0 = window.__pc.sim.t;
      const f = () => (window.__pc.sim.t - t0 >= s ? resolve() : requestAnimationFrame(f));
      f();
    }), Number(opt.wait));
  }
  const info = await page.evaluate(() => { const i = window.__pc.info(); return { state: i.state, using: i.using, fps: i.fps, mood: i.mood, near: i.near, far: i.far }; });
  console.log(JSON.stringify(info));
  await page.screenshot({ path: out, type: 'jpeg', quality: 86, timeout: 240000 });
  console.log('wrote', out);
} catch (e) { ok = false; console.log('capture failed:', e.message.slice(0, 200)); }
await close();
if (problems.length) { ok = false; console.log('PROBLEMS:', [...new Set(problems)].slice(0, 8).join(' | ')); }
process.exit(ok ? 0 : 1);
