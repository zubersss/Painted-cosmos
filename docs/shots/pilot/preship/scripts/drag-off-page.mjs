// Does headless Chromium (as Playwright drives it) deliver a drag that starts or moves outside the
// viewport? The blind player's driver keeps its mouse where the last drag left it.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.setContent(`<canvas id=c style="position:fixed;inset:0;width:100%;height:100%"></canvas><script>
  window.log = { down: 0, moves: 0, dy: 0 }; let drag = false, ly = 0;
  c.addEventListener('mousedown', (e) => { log.down++; drag = true; ly = e.clientY; });
  document.addEventListener('mouseup', () => { drag = false; });
  document.addEventListener('mousemove', (e) => { if (drag) { log.moves++; log.dy += e.clientY - ly; ly = e.clientY; } });
</script>`);
const get = () => page.evaluate(() => { const o = { ...window.log }; window.log = { down: 0, moves: 0, dy: 0 }; return o; });
const drag = async (x, y, dy) => { await page.mouse.move(x, y); await page.mouse.down(); for (let i = 1; i <= 10; i++) await page.mouse.move(x, y + (dy * i) / 10); await page.mouse.up(); return get(); };
console.log('inside, 400 px down from y=85:', JSON.stringify(await drag(355, 85, 400)));
console.log('from y=85, 400 px up (leaves the top):', JSON.stringify(await drag(355, 85, -400)));
console.log('starting at y=-315 (off the top), 400 px down:', JSON.stringify(await drag(355, -315, 400)));
console.log('starting at y=-715, 400 px down (all off the page):', JSON.stringify(await drag(355, -715, 400)));
await browser.close();
