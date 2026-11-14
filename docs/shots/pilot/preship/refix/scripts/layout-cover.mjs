// The verifier's two layout probes, with the area of slip covered as well (mean and worst, px^2 and share of the label).
const root = process.argv[2];
const { layoutMarks } = await import(root + '/src/ui/layout.js');
const rectOf = (m) => ({ x0: m.x + m.lx - m.lw / 2, x1: m.x + m.lx + m.lw / 2, y0: m.y + m.ly, y1: m.y + m.ly + m.lh });
const hits = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
const area = (a, b) => hits(a, b) ? (Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * (Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)) : 0;
const sizeOf = (d) => (d.kind === 'target' ? 10.2 : 9.2);
function run(name, W, H, slips, ship, yLo, yHi, seed0, N) {
  let seed = seed0; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let n = 0, on = 0, sumShare = 0, worstShare = 0, far = 0, worst = 0, half = 0;
  for (let i = 0; i < N; i++) {
    const x = 40 + rnd() * (W - 80), y = yLo + rnd() * (yHi - yLo);
    if ([...slips, ship].some((s) => x > s.x0 - 4 && x < s.x1 + 4 && y > s.y0 - 4 && y < s.y1 + 4)) continue;
    const list = [{ kind: 'body', keep: true, x, y, r: 3, label: 'a place to land', sub: Math.round(rnd() * 900) + ' m' }];
    layoutMarks(list, { w: W, h: H, sizeOf, keep: [...slips, ship] });
    const m = list[0]; if (!m.text) continue; n++;
    const r = rectOf(m), A = (r.x1 - r.x0) * (r.y1 - r.y0);
    const c = slips.reduce((a, s) => a + area(r, s), 0) / A;
    if (c > 0) { on++; sumShare += c; worstShare = Math.max(worstShare, c); if (c > 0.5) half++; }
    const gap = Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.y0 - y, 0, y - r.y1));
    if (gap > 60) far++; worst = Math.max(worst, gap);
  }
  console.log(`${name}: ${n} labels; on a slip ${on} (mean ${(on ? 100 * sumShare / on : 0).toFixed(0)}% of the label, worst ${(100 * worstShare).toFixed(0)}%, over half ${half}); >60 px from the ring ${far}; worst ${worst.toFixed(0)} px`);
}
{
  const prompt = { x0: 405, x1: 555, y0: 414, y1: 456, soft: true }, throttle = { x0: 488, x1: 716, y0: 458, y1: 492, soft: true }, readout = { x0: 62, x1: 246, y0: 436, y1: 494, soft: true };
  run('fixer geometry 960x540', 960, 540, [prompt, throttle, readout], { x0: 360, x1: 600, y0: 285, y1: 372 }, 372, 510, 11, 5000);
}
for (const [W, H] of [[640, 360], [960, 540], [1280, 720]]) {
  const k = W / 960;
  const slips = [{ x0: W / 2 - 75, x1: W / 2 + 75, y0: H * 0.77, y1: H * 0.77 + 42, soft: true }, { x0: W / 2 + 8, x1: W / 2 + 236 * k, y0: H * 0.85, y1: H * 0.85 + 34, soft: true },
    { x0: 62 * k, x1: 246 * k, y0: H * 0.81, y1: H * 0.81 + 58, soft: true }, { x0: W / 2 - 160, x1: W / 2 + 160, y0: H * 0.62, y1: H * 0.62 + 34, soft: true }];
  run(`random ${W}x${H}`, W, H, slips, { x0: W / 2 - 120 * k, x1: W / 2 + 120 * k, y0: H * 0.53, y1: H * 0.69 }, H * 0.45, H * 0.95, 7, 4000);
}
