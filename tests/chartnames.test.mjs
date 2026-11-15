// The names on the touch chart (src/ui/layout.js placeChartNames, drawn by src/ui/map.js): each
// name's ink, its halo included, kept off every dot and every other name. The re-fix pass of
// release 1: on the 400x225 chart 'Mercury' touched 'Saturn' (the verifier's frame
// loop-iphone14-painted-map.jpg): with all four sides of its dot taken a name fell back to its
// first side, over another name, and its box missed the halo and the descenders by about 2 px.
import test from 'node:test';
import assert from 'node:assert/strict';
import { placeChartNames, chartNameBox, CHART_NAMES } from '../src/ui/layout.js';
import { letterPath } from '../src/ui/lettering.js';
import { chartDots, chartNameList, MAP_TOUCH } from '../src/ui/map.js';
import { Ephemeris } from '../src/core/orbits.js';
import { BODIES } from '../src/data/bodies.js';

// the chart's css size on the touch sheet, measured in the browser (scratch mapsweep.mjs on 3cd414b)
const CHARTS = [['400x225', 212, 189], ['iPhone 14', 482, 300], ['Pixel 7', 561, 320], ['iPad Pro 11', 1138, 678]];

const NAMES = ['Mercury', 'Venus', 'Earth', 'Moon', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
const area = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

test('the box holds the ink as inkOnCanvas draws it, the halo included', () => {
  for (const s of [11.5, 12.7, 15.4]) {
    for (const name of NAMES) {
      const p = letterPath(name, s, { align: 'center', seed: 2 });
      const nums = p.d.match(/-?\d+(\.\d+)?/g).map(Number);
      const x = 100.3, y = 80.6, tx = Math.round(x - p.width / 2), ty = Math.round(y - p.baseline), h = (p.stroke + 3) / 2;
      const b = chartNameBox(name, s, x, y);
      for (let i = 0; i + 1 < nums.length; i += 2) {
        const px = tx + nums[i], py = ty + nums[i + 1];
        assert.ok(px - h >= b.x0 - 0.01 && px + h <= b.x1 + 0.01 && py - h >= b.y0 - 0.01 && py + h <= b.y1 + 0.01,
          `${name} at ${s}: the ink at (${(px).toFixed(1)}, ${(py).toFixed(1)}) lies outside its box ${JSON.stringify(b)}`);
      }
    }
  }
});

// The chart as createMap's layout() fits it to a sheet of cw x ch css px (src/ui/map.js).
function chartView(cw, ch) {
  let sx = cw / 680, sy = ch / 400;
  if (sx > sy * MAP_TOUCH.maxRatio) sx = sy * MAP_TOUCH.maxRatio;
  if (sy > sx * MAP_TOUCH.maxRatio) sy = sx * MAP_TOUCH.maxRatio;
  return { sx, sy, ox: (cw - 680 * sx) / 2, oy: (ch - 400 * sy) / 2, w: cw, h: ch, touch: true };
}
const eph = new Ephemeris(BODIES);
const overlaps = (out, dots, w, h) => {
  let n = 0;
  const shown = out.filter((p) => !p.hidden);
  for (let i = 0; i < shown.length; i++) {
    const b = shown[i].box;
    if (b.x0 < 0 || b.y0 < 0 || b.x1 > w || b.y1 > h) n++;
    for (let j = i + 1; j < shown.length; j++) if (area(b, shown[j].box) > 0) n++;
    for (const d of dots) {
      const qx = Math.max(b.x0, Math.min(d.x, b.x1)), qy = Math.max(b.y0, Math.min(d.y, b.y1));
      if (Math.hypot(qx - d.x, qy - d.y) < d.size * 1.1) n++;
    }
  }
  return n;
};

test('the real chart over 400 clock times: no name on another name or on a dot, at every size the touch sheet takes', () => {
  for (const [label, cw, ch] of CHARTS) {
    const view = chartView(cw, ch), small = ch < MAP_TOUCH.smallChart;
    let bad = 0, worst = null, far = 0, leftOff = 0, layoutsLeftOff = 0, maxLeftOff = 0, minSize = Infinity, wrongDot = 0;
    for (let k = 0; k < 400; k++) {
      const t = k * 2111.3, positions = {};
      for (const id of eph.ids) positions[id] = eph.position(id, t);
      const dots = chartDots(positions, view);
      const ids = dots.map((d) => d.id), selected = ids[k % ids.length], here = ids[(k * 7) % ids.length];
      const out = placeChartNames(chartNameList(dots, view, selected, here), { w: cw, h: ch });
      const n = overlaps(out, dots, cw, ch);
      if (n) { bad++; worst = worst || { t, selected, here }; }
      const off = out.filter((p) => p.hidden);
      assert.ok(!off.some((p) => p.id === selected || p.id === here), `${label}: the chosen world's name and yours always show`);
      if (off.length) { layoutsLeftOff++; leftOff += off.length; maxLeftOff = Math.max(maxLeftOff, off.length); }
      for (const p of out) {
        if (p.hidden) continue;
        minSize = Math.min(minSize, p.s);
        const d = dots.find((q) => q.id === p.id), qx = Math.max(p.box.x0, Math.min(d.x, p.box.x1)), qy = Math.max(p.box.y0, Math.min(d.y, p.box.y1));
        if (p.id !== selected && p.id !== here) {
          far = Math.max(far, Math.hypot(qx - d.x, qy - d.y) - d.size);
          // read as the name of the dot it lies by: nearer the edge of its own dot than of any other
          const e = (q) => Math.hypot(Math.max(p.box.x0 - q.x, 0, q.x - p.box.x1), Math.max(p.box.y0 - q.y, 0, q.y - p.box.y1)) - q.size;
          if (!dots.every((q) => q === d || e(q) > e(d))) wrongDot++;
        }
      }
    }
    assert.equal(bad, 0, `${label} (${cw}x${ch}): ${bad} of 400 layouts with a name on a name or a dot; first ${JSON.stringify(worst)}`);
    assert.equal(wrongDot, 0, `${label}: ${wrongDot} names lie nearer another world's dot than their own`);
    // each name by its own dot (a name that must show may go further: CHART_NAMES.mustRings)
    assert.ok(far <= 32 + 1, `${label}: a name lies ${far.toFixed(1)} css px from its dot`);
    if (!small) {
      // a phone, a tablet: every name at its full size (W3.3's 11 css px floor holds); one name is
      // left off only where dots clump (two worlds drawn on one spot, three outer worlds in a knot):
      // in 19 layouts of 400 on the iPhone 14 when measured, 10 on the Pixel 7, 3 on the iPad
      assert.ok(minSize >= MAP_TOUCH.name, `${label}: smallest name ${minSize}`);
      assert.ok(layoutsLeftOff <= 30 && leftOff === layoutsLeftOff, `${label}: names left off in ${layoutsLeftOff} of 400 layouts (${leftOff} names)`);
    } else {
      // smaller than any phone held sideways (the painted runs' 400x225): a crowded name may be
      // lettered down to MAP_TOUCH.nameSmall and, with no room even so, left off (when measured:
      // 457 names of 4000, in 280 layouts of 400, at most 5 in one)
      assert.ok(minSize >= MAP_TOUCH.nameSmall, `${label}: smallest name ${minSize}`);
      assert.ok(leftOff <= 600 && maxLeftOff <= 5, `${label}: names left off in ${layoutsLeftOff} of 400 layouts (${leftOff} names, at most ${maxLeftOff})`);
    }
  }
});

test('a name goes where it is asked first when that is clear, and a moon\'s on its far side', () => {
  const one = placeChartNames([{ id: 'mars', name: 'Mars', x: 100, y: 100, r: 5, s: 11.5, prefer: ['up', 'down', 'right', 'left'] }], { w: 300, h: 200 })[0];
  assert.ok(one.clear && one.box.y1 <= 100 - 5 && Math.abs(one.x - 100) < 1e-9, 'above its dot: ' + JSON.stringify(one));
  const two = placeChartNames([
    { id: 'moon', name: 'Moon', x: 150, y: 140, r: 3.2, s: 11.5, prefer: ['down', 'right', 'left', 'up'] },
    { id: 'earth', name: 'Earth', x: 150, y: 94, r: 6, s: 11.5, prefer: ['up', 'left', 'right', 'down'] },
  ], { w: 300, h: 200 });
  assert.ok(two[0].box.y0 >= 140 && two[1].box.y1 <= 94, 'the moon\'s name under it, the planet\'s over it');
});

test('with every side taken a name takes the corner or the nearest place that is clear, not its first side', () => {
  // a dot hemmed in above and below by two names already placed: the third goes to its side
  const w = 300, h = 200;
  const out = placeChartNames([
    { id: 'a', name: 'Saturn', x: 150, y: 70, r: 5, s: 11.5, prefer: ['up'] },
    { id: 'b', name: 'Neptune', x: 150, y: 130, r: 5, s: 11.5, prefer: ['down'] },
    { id: 'c', name: 'Mercury', x: 150, y: 100, r: 5, s: 11.5, prefer: ['up', 'down'] },
  ], { w, h });
  assert.ok(out.every((p) => p.clear), JSON.stringify(out.map((p) => [p.id, p.clear])));
  assert.equal(area(out[2].box, out[0].box) + area(out[2].box, out[1].box), 0);
});
