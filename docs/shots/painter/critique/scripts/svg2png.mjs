// svg2png.mjs in.svg out.png scale bg : render an SVG in the headless browser (no game)
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const [inp, out, scale = '8', bg = '#8fa3c8'] = process.argv.slice(2);
const svg = fs.readFileSync(inp, 'utf8');
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 24 * scale * 3 + 40, height: 24 * scale + 40 } });
await p.setContent(`<body style="margin:20px;display:flex;gap:0">${['#f4efe4', bg, '#232a45'].map((c) => `<div style="background:${c};width:${24 * scale}px;height:${24 * scale}px"><div style="transform:scale(${scale});transform-origin:0 0;width:24px;height:24px">${svg}</div></div>`).join('')}</body>`);
await p.screenshot({ path: out }); await b.close();
