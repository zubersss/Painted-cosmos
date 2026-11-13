// The slips' layout (src/ui/layout.js), pure: PAINTER's critique of the interface, M4, item 3
// ("the slips lie on the subject and on each other") and PHYSICS' item 11 (text off a small window).
import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutMarks, wrapLettering, letteringSize, ringSize, MARKS } from '../src/ui/layout.js';
import { measureLettering } from '../src/ui/lettering.js';

const W = 960, H = 540;
const sizeOf = (d) => (d.kind === 'target' ? 10.2 : 9.2);
const rectOf = (m) => ({ x0: m.x + m.lx - m.lw / 2, x1: m.x + m.lx + m.lw / 2, y0: m.y + m.ly, y1: m.y + m.ly + m.lh });
const hits = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

test('M4 aimed at a world from the chase view: its label is written clear of the ship', () => {
  // the nose on Mars: the ring in the middle of the picture, the ship just under it (as in the pulse drive)
  const ship = { x0: W / 2 - 150, x1: W / 2 + 150, y0: H / 2 + 4, y1: H / 2 + 120 };
  const list = [{ kind: 'target', x: W / 2, y: H / 2, r: 3, above: false, label: 'Mars', sub: '457.6 km  75 s' }];
  layoutMarks(list, { w: W, h: H, sizeOf, keep: [ship] });
  const m = list[0];
  assert.equal(m.text, 'Mars\n457.6 km  75 s');
  assert.ok(!hits(rectOf(m), ship), 'the label is off the ship');
  assert.ok(m.ly < 0 && m.lx === 0, 'over the ring: ' + m.ly);
  // with no ship in the way (the cockpit) it stays under the ring, as it was
  const free = [{ kind: 'target', x: W / 2, y: H / 2, r: 3, label: 'Mars', sub: '457.6 km  75 s' }];
  layoutMarks(free, { w: W, h: H, sizeOf, keep: [] });
  assert.equal(free[0].ly, ringSize(3) / 2 + MARKS.gap);
});

test('M4 a pile of worlds in the sky: no name lies on another; the one nearest the nose is the one written', () => {
  // four worlds within a few pixels of each other, far away, a little off the nose
  const list = ['Pluto', 'Neptune', 'Uranus', 'Saturn'].map((label, i) => ({ kind: 'body', x: 600 + i * 5, y: 200 + i * 3, r: 1, label, sub: null }));
  layoutMarks(list, { w: W, h: H, sizeOf, keep: [] });
  const named = list.filter((m) => m.text);
  assert.ok(named.length >= 1 && named.length <= 2, named.length + ' names written of four');
  for (let i = 0; i < named.length; i++) for (let j = i + 1; j < named.length; j++) assert.ok(!hits(rectOf(named[i]), rectOf(named[j])), named[i].label + ' and ' + named[j].label + ' do not overlap');
  assert.equal(named[0].label, 'Pluto', 'the nearest the middle of the picture');
  assert.equal(list.filter((m) => !m.text).length, 4 - named.length, 'the others keep their ring only');
  // apart, all four are named
  const apart = ['Pluto', 'Neptune', 'Uranus', 'Saturn'].map((label, i) => ({ kind: 'body', x: 200 + i * 160, y: 200, r: 1, label, sub: null }));
  layoutMarks(apart, { w: W, h: H, sizeOf, keep: [] });
  assert.equal(apart.filter((m) => m.text).length, 4);
});

test('M4 labels keep off the slips that are up; what must show gives way last; nothing is lettered off the picture', () => {
  const notice = { x0: 300, x1: 660, y0: 380, y1: 412, soft: true }, gauge = { x0: 370, x1: 590, y0: 462, y1: 490, soft: true };
  // "a place to land" in sight just over the notice: its label goes over the ring
  const a = [{ kind: 'body', keep: true, x: 480, y: 372, r: 3, label: 'a place to land', sub: '2.7 km' }];
  layoutMarks(a, { w: W, h: H, sizeOf, keep: [notice, gauge] });
  assert.ok(a[0].text && !hits(rectOf(a[0]), notice) && !hits(rectOf(a[0]), gauge), 'clear of the notice and the gauge');
  // an arrow pointing straight down rides at 0.69 of the picture's height (game.js edgeY), over the
  // band of the notice, the prompt and the gauges: its label goes over it when a notice is up
  const e = [{ kind: 'edge', x: 480, y: H * 0.69, r: 0, angle: 1.57, label: 'a place to land', sub: '2.7 km' }];
  layoutMarks(e, { w: W, h: H, sizeOf, keep: [notice, gauge] });
  assert.ok(!hits(rectOf(e[0]), gauge) && !hits(rectOf(e[0]), notice), 'the arrow\'s label is off the throttle gauge and the notice');
  assert.ok(e[0].ly < 0, 'over the arrow');
  // a world's name that would lie on the notice is not written; its ring stays
  const b = [{ kind: 'body', x: 480, y: 396, r: 2, label: 'Venus', sub: null }];
  layoutMarks(b, { w: W, h: H, sizeOf, keep: [{ x0: 300, x1: 660, y0: 340, y1: 452, soft: true }] });
  assert.equal(b[0].text, null);
  // at the edge of the picture a label is kept inside it
  const c = [{ kind: 'target', x: 12, y: 300, r: 4, label: 'Jupiter', sub: '1200.0 km  96 s' }];
  layoutMarks(c, { w: W, h: H, sizeOf, keep: [] });
  const r = rectOf(c[0]);
  assert.ok(r.x0 >= 0 && r.x1 <= W && r.y0 >= 0 && r.y1 <= H, 'inside the picture: ' + JSON.stringify(r));
});

test('M4 lettering is wrapped to its slip and to the window', () => {
  const title = wrapLettering('Alpine Meadow and Snow Peaks', 11.5, 146);
  assert.ok(title.includes('\n'), 'the long name takes two lines');
  for (const line of title.split('\n')) assert.ok(measureLettering(line, 11.5) <= 146, `"${line}" fits the slip`);
  assert.equal(title.replace(/\n/g, ' '), 'Alpine Meadow and Snow Peaks', 'nothing lost');
  // a notice in a 640 px window (PHYSICS: "M opens the map: choose a world, point the nose at its mark, pres")
  const room = 640 * 0.8 - 36;
  const n = wrapLettering('M opens the map: choose a world, point the nose at its mark, press F for the pulse drive', 13.5, room);
  for (const line of n.split('\n')) assert.ok(measureLettering(line, 13.5) <= room, `"${line}" is ${measureLettering(line, 13.5).toFixed(0)} px of ${room}`);
  assert.ok(letteringSize(n, 13.5).w <= room + 2);
  assert.equal(wrapLettering('Mars ahead', 13.5, 400), 'Mars ahead', 'a short line is left alone');
  // no word left alone on the last line: the lines are of about one length
  const v = wrapLettering('A view for the sketchbook: Temperate Forest', 13.5, 386).split('\n');
  assert.equal(v.length, 2);
  assert.ok(measureLettering(v[1], 13.5) > 0.55 * measureLettering(v[0], 13.5), `"${v[0]}" / "${v[1]}"`);
  for (const line of v) assert.ok(measureLettering(line, 13.5) <= 386);
  assert.equal(wrapLettering('one\ntwo', 10, 400), 'one\ntwo', 'lines already there are kept');
});

test('M4 the re-fix: the nose a few degrees off the target, its ring over the ship: the label slides clear of the ship', () => {
  // the verifier's frame (640 x 360, the chase view in space, Mars the target): the ship's box
  // x 229-411, y 173-265; the nose 4 degrees over Mars puts the ring 10 px under the middle of the
  // picture, and under, over, right and left of the ring all touch the hull. It fell back to under
  // the ring, on the ship ("Mars 463.0 km 76 s", label box x 261-379, y 204-243)
  const w = 640, h = 360, ship = { x0: 229, x1: 411, y0: 173, y1: 265 };
  const at = (x, y, keep = [ship]) => {
    const list = [{ kind: 'target', x, y, r: 3, above: false, label: 'Mars', sub: '463.0 km  76 s' }];
    layoutMarks(list, { w, h, sizeOf, keep });
    return list[0];
  };
  const m = at(320, 190);
  assert.ok(m.text, 'the label shows');
  const r = rectOf(m);
  assert.ok(!hits(r, ship), `off the ship: label x ${r.x0.toFixed(0)}-${r.x1.toFixed(0)}, y ${r.y0.toFixed(0)}-${r.y1.toFixed(0)}`);
  assert.ok(r.y1 <= ship.y0 && r.y1 > ship.y0 - 6 && m.lx === 0, 'just over the ship, over the ring: y1 ' + r.y1.toFixed(1));
  // wherever the ring lies on the ship (the nose 3 to 8 degrees over or beside the target), the
  // label is off the ship and inside the picture, and a notice that is up (soft) is kept clear of as well where it can be
  const notice = { x0: 150, x1: 490, y0: 8, y1: 40, soft: true };
  let n = 0, onNotice = 0;
  for (let x = ship.x0; x <= ship.x1; x += 6) for (let y = ship.y0 - 30; y <= ship.y1; y += 5) {
    const q = at(x, y, [ship, notice]), qr = rectOf(q);
    assert.ok(q.text && !hits(qr, ship), `ring at ${x}, ${y}: the label is off the ship`);
    assert.ok(qr.x0 >= MARKS.margin && qr.x1 <= w - MARKS.margin && qr.y0 >= MARKS.margin && qr.y1 <= h - MARKS.margin, `ring at ${x}, ${y}: inside the picture`);
    n++; if (hits(qr, notice)) onNotice++;
  }
  assert.ok(n > 600 && onNotice === 0, `${n} places, on the notice at ${onNotice}`);
});

// M4's blind play-test (3d38bb2): low over Venus, "a place to land 256 m" lay on the "Land here"
// prompt and on the throttle bar (its ring just over the prompt, the ship above it). A label that
// must show now slides to a place clear of the slips before it lies on one.
test('a place to land under the ship, just over the prompt: its label keeps off the prompt, the throttle and the ship', () => {
  const prompt = { x0: 405, x1: 555, y0: 414, y1: 456, soft: true };
  const throttle = { x0: 488, x1: 716, y0: 458, y1: 492, soft: true };
  const readout = { x0: 62, x1: 246, y0: 436, y1: 494, soft: true };
  const ship = { x0: 360, x1: 600, y0: 285, y1: 372 };
  for (const [x, y] of [[480, 400], [470, 410], [520, 392], [455, 380], [600, 440]]) {
    const list = [{ kind: 'body', keep: true, x, y, r: 3, label: 'a place to land', sub: '256 m' }];
    layoutMarks(list, { w: W, h: H, sizeOf, keep: [prompt, throttle, readout, ship] });
    const r = rectOf(list[0]);
    for (const [name, k] of [['prompt', prompt], ['throttle', throttle], ['read-out', readout], ['ship', ship]]) assert.ok(!hits(r, k), `ring at ${x},${y}: the label is off the ${name} (${JSON.stringify(r)})`);
    assert.ok(r.x0 >= MARKS.margin && r.x1 <= W - MARKS.margin && r.y0 >= MARKS.margin && r.y1 <= H - MARKS.margin, 'inside the picture');
  }
});
