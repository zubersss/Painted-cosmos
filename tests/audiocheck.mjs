// Nobody can listen in this sandbox, so the sound is measured instead. Each situation is
// rendered for a few seconds through the game's own audio graph (src/audio/audio.js, built in
// an OfflineAudioContext) and the result is analysed: peak and RMS level, clipping, DC offset,
// spectrum balance, how steady a steady sound is (a looping dip or pump shows here), and
// clicks (a step between two samples far outside the signal's own slope).
// Fails when a limit of R-AUD-3 is broken (peak above -3 dBFS, clipping, DC, clicks), when
// something that should sound is silent, or when silence is not silent.
//
// Usage: node tests/audiocheck.mjs [--root dir] [--json out.json]
import fs from 'node:fs';
import { parseArgs } from './browser.mjs';
import { openPage } from '../tools/shot.mjs';

const opt = parseArgs({ json: '' });
const { page, problems, close } = await openPage({ pagePath: '/index.html?stub=1&audio=0&card=0&pointerlock=0&dynres=0&save=0', w: 320, h: 180, root: opt.root });

const rows = await page.evaluate(async () => {
  const { createAudio } = await import('/src/audio/audio.js');
  const SR = 44100;
  const base = { state: 'ON_FOOT', onFoot: true, inShip: false, speed: 0, grounded: true, jet01: 0, throttle01: 0, pulse01: 0, inSpace01: 0, altitude01: 0, bodyId: 'earth', wind: 1.5, gust01: 0.3, rain01: 0, canopy01: 0, dripping: 0, underHull: false, airless: false, thunderIn: null, thunder01: null, submerged: false };
  const ship = { state: 'ATMOSPHERE', onFoot: false, inShip: true };
  // name, seconds rendered, seconds analysed (the tail), state at time t, one-shots, expectations
  const cases = [
    { name: 'calm morning on foot', sec: 14, tail: 8, at: () => ({ ...base }), want: 'quiet' },
    { name: 'windy (12 m/s, gusting)', sec: 14, tail: 8, at: (t) => ({ ...base, wind: 12, gust01: 0.5 + 0.5 * Math.sin(t * 0.9) }), want: 'sound' },
    { name: 'gale (22 m/s)', sec: 14, tail: 8, at: () => ({ ...base, wind: 22, gust01: 0.8 }), want: 'sound' },
    { name: 'heavy rain, open ground', sec: 14, tail: 8, at: () => ({ ...base, wind: 6, rain01: 1 }), want: 'sound', steady: true },
    { name: 'heavy rain in a wood', sec: 14, tail: 8, at: () => ({ ...base, wind: 3, rain01: 1, canopy01: 0.9 }), want: 'sound' },
    { name: 'heavy rain, under the hull', sec: 14, tail: 8, at: () => ({ ...base, wind: 6, rain01: 1, underHull: true }), want: 'sound', steady: true },
    { name: 'the wood dripping after rain', sec: 14, tail: 8, at: () => ({ ...base, wind: 1, canopy01: 0.9, dripping: 0.8 }), want: 'sound' },
    { name: 'thunderstorm (rain, 18 m/s, thunder)', sec: 16, tail: 10, at: (t) => ({ ...base, wind: 18, gust01: 0.7, rain01: 1, thunderIn: 8 - t, thunder01: 1 }), want: 'sound' },
    { name: 'walking', sec: 12, tail: 8, at: () => ({ ...base, speed: 4.2 }), want: 'sound' },
    { name: 'walking on rock', sec: 12, tail: 8, at: () => ({ ...base, speed: 4.2, material: 'rock' }), want: 'sound' },
    { name: 'walking on snow', sec: 12, tail: 8, at: () => ({ ...base, speed: 4.2, material: 'snow' }), want: 'sound' },
    { name: 'running', sec: 12, tail: 8, at: () => ({ ...base, speed: 7.4 }), want: 'sound' },
    { name: 'jetpack burning', sec: 12, tail: 8, at: () => ({ ...base, grounded: false, jet01: 1, speed: 6 }), want: 'sound', steady: true },
    { name: 'ship parked (landed)', sec: 12, tail: 8, at: () => ({ ...base, ...ship, state: 'LANDED' }), want: 'sound' },
    { name: 'ship at full throttle, 150 m/s', sec: 12, tail: 8, at: () => ({ ...base, ...ship, speed: 150, throttle01: 1, wind: 8 }), want: 'sound' },
    { name: 'ship in space, cruising', sec: 12, tail: 8, at: () => ({ ...base, ...ship, state: 'SPACE', speed: 700, throttle01: 0.8, inSpace01: 1, bodyId: null }), want: 'sound' },
    { name: 'pulse drive', sec: 12, tail: 8, at: () => ({ ...base, ...ship, state: 'PULSE', speed: 15000, throttle01: 1, pulse01: 1, inSpace01: 1, bodyId: null }), want: 'sound' },
    { name: 'on the Moon, standing (airless)', sec: 12, tail: 6, at: () => ({ ...base, bodyId: 'moon', airless: true, wind: 0 }), padOff: true, want: 'silence' },
    { name: 'the pad at its fullest (Earth)', sec: 20, tail: 8, first: 34, at: () => ({ ...base, wind: 0 }), want: 'sound' },
    { name: 'interface: paper, brush, found, land, bounce', sec: 12, tail: 10, at: () => ({ ...base, wind: 0 }), events: [[2.5, 'paper'], [4, 'brush'], [5.5, 'found'], [8, 'land'], [9.5, 'bounce']], want: 'sound' },
    { name: 'everything at once', sec: 16, tail: 10, first: 40, at: (t) => ({ ...base, ...ship, speed: 160, throttle01: 1, pulse01: 1, wind: 22, gust01: 1, rain01: 1, thunderIn: 8 - t, thunder01: 1 }), events: [[8.05, 'land'], [8.1, 'found'], [8.2, 'bounce']], want: 'sound' },
    { name: 'cuts: on foot, ship at full throttle, on foot, jet', sec: 16, tail: 14, at: (t) => (t < 5 ? { ...base, wind: 10 } : t < 9 ? { ...base, ...ship, speed: 150, throttle01: 1 } : t < 12 ? { ...base, wind: 10 } : { ...base, jet01: 1, grounded: false }), want: 'sound' },
  ];

  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { const a = re[i]; re[i] = re[j]; re[j] = a; const b = im[i]; im[i] = im[j]; im[j] = b; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const ur = re[i + k], ui = im[i + k];
          const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
          re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
          const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
        }
      }
    }
  }
  const dB = (x) => (x > 1e-9 ? 20 * Math.log10(x) : -180);

  function analyse(x, from) {
    const n = x.length;
    let peak = 0, sum = 0, sq = 0, clipped = 0, maxStep = 0;
    const steps = new Float32Array(n - from - 1);
    for (let i = from; i < n; i++) {
      const v = x[i], a = Math.abs(v);
      if (a > peak) peak = a;
      if (a >= 0.999) clipped++;
      sum += v; sq += v * v;
      if (i > from) { const d = Math.abs(v - x[i - 1]); steps[i - from - 1] = d; if (d > maxStep) maxStep = d; }
    }
    const m = n - from, rms = Math.sqrt(sq / m);
    // Clicks: the largest step between two samples against the 99.9th percentile of steps.
    const sorted = Float32Array.from(steps).sort();
    const p999 = sorted[Math.floor(sorted.length * 0.999)] || 1e-12;
    // Steadiness: the spread of the level in 250 ms windows.
    const win = Math.floor(SR * 0.25); let lo = Infinity, hi = 0;
    for (let i = from; i + win <= n; i += win) { let s = 0; for (let k = 0; k < win; k++) s += x[i + k] * x[i + k]; const r = Math.sqrt(s / win); if (r < lo) lo = r; if (r > hi) hi = r; }
    // Spectrum: averaged Hann-windowed FFTs, summed into bands.
    const N = 4096, edges = [0, 120, 500, 2000, 6000, 22050], bands = [0, 0, 0, 0, 0];
    let total = 0, cent = 0;
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = from; i + N <= n; i += N) {
      for (let k = 0; k < N; k++) { re[k] = x[i + k] * (0.5 - 0.5 * Math.cos((2 * Math.PI * k) / N)); im[k] = 0; }
      fft(re, im);
      for (let k = 1; k < N / 2; k++) {
        const f = (k * SR) / N, p = re[k] * re[k] + im[k] * im[k];
        total += p; cent += p * f;
        for (let b = 0; b < 5; b++) if (f >= edges[b] && f < edges[b + 1]) { bands[b] += p; break; }
      }
    }
    return {
      peakDb: +dB(peak).toFixed(1), rmsDb: +dB(rms).toFixed(1), dc: +(sum / m).toExponential(1), clipped,
      clickRatio: +(maxStep / p999).toFixed(1), maxStep: +maxStep.toFixed(4), spreadDb: +(dB(hi) - dB(lo)).toFixed(1),
      bands: bands.map((b) => (total > 0 ? Math.round((100 * b) / total) : 0)), centroidHz: total > 0 ? Math.round(cent / total) : 0,
    };
  }

  const out = [];
  for (const c of cases) {
    const off = new OfflineAudioContext(1, Math.floor(SR * c.sec), SR);
    const audio = createAudio({ enabled: true, context: off });
    audio.start();
    const step = 1 / 30;
    let n = 0;
    const tick = (t) => {
      const s = c.at(t);
      audio.update(n === 1 && c.first ? c.first : step, s);   // `first`: jump the pad's slow clock toward its peak
      n++;
      for (const e of c.events || []) if (!e.done && t >= e[0]) { e.done = true; audio.event(e[1]); }
    };
    tick(0);
    for (let t = step; t < c.sec - 0.01; t += step) off.suspend(t).then(() => { tick(t); off.resume(); });
    const buf = await off.startRendering();
    const a = analyse(buf.getChannelData(0), Math.floor(SR * (c.sec - c.tail)));
    out.push({ name: c.name, want: c.want, steady: !!c.steady, ...a });
  }
  return out;
});
await close();

const fails = [];
const pad = (s, n) => String(s).padEnd(n);
console.log(pad('situation', 50) + pad('peak dBFS', 11) + pad('RMS dBFS', 10) + pad('DC', 10) + pad('clipped', 9) + pad('spread dB', 11) + pad('click x', 9) + 'spectrum % (<120, <500, <2k, <6k, 6k+ Hz), centroid');
for (const r of rows) {
  console.log(pad(r.name, 50) + pad(r.peakDb, 11) + pad(r.rmsDb, 10) + pad(r.dc, 10) + pad(r.clipped, 9) + pad(r.spreadDb, 11) + pad(r.clickRatio, 9) + r.bands.join(', ') + '  ' + r.centroidHz + ' Hz');
  if (r.peakDb > -3) fails.push(`${r.name}: peak ${r.peakDb} dBFS is above -3`);
  if (r.clipped) fails.push(`${r.name}: ${r.clipped} clipped samples`);
  if (Math.abs(r.dc) > 0.002) fails.push(`${r.name}: DC offset ${r.dc}`);
  if (r.want === 'sound' && r.rmsDb < -62) fails.push(`${r.name}: should sound, but is at ${r.rmsDb} dBFS`);
  if (r.want === 'quiet' && (r.rmsDb > -34 || r.rmsDb < -70)) fails.push(`${r.name}: should be quiet but present, is at ${r.rmsDb} dBFS`);
  if (r.want === 'silence' && r.rmsDb > -60) fails.push(`${r.name}: should be silent, is at ${r.rmsDb} dBFS`);
  if (r.steady && r.spreadDb > 4) fails.push(`${r.name}: a steady sound wavers by ${r.spreadDb} dB (a looping dip, or pumping)`);
  if (r.clickRatio > 6 && r.maxStep > 0.02) fails.push(`${r.name}: a click (largest sample step ${r.maxStep}, ${r.clickRatio} x the 99.9th percentile)`);
}
// Relations between situations (what must be heard over what).
const row = (n) => rows.find((r) => r.name.startsWith(n));
const rel = (ok, msg) => { if (!ok) fails.push(msg); };
rel(row('walking').peakDb >= row('calm').peakDb + 6, `footsteps are lost in a calm morning (peaks ${row('walking').peakDb} against ${row('calm').peakDb} dBFS)`);
rel(row('jetpack').rmsDb >= row('calm').rmsDb + 10, `the jetpack is not clearly above the calm bed (${row('jetpack').rmsDb} against ${row('calm').rmsDb} dBFS)`);
rel(row('ship parked').rmsDb <= row('calm').rmsDb + 3, `the parked ship hums louder than a calm morning (${row('ship parked').rmsDb} dBFS)`);
rel(row('ship at full').bands[0] <= 60, `the ship's voice is ${row('ship at full').bands[0]} % below 120 Hz: small speakers will not carry it`);
rel(row('the pad').rmsDb > -40 && row('the pad').rmsDb < -24, `the pad at its fullest is at ${row('the pad').rmsDb} dBFS (wanted -40 to -24)`);
rel(row('the wood dripping').peakDb >= row('calm').peakDb + 4, `drips are lost in the bed (peaks ${row('the wood dripping').peakDb} against ${row('calm').peakDb} dBFS)`);
rel(row('heavy rain, under').rmsDb <= row('heavy rain, open').rmsDb - 3, 'rain is no quieter under the hull than in the open');
rel(row('gale').rmsDb > row('windy').rmsDb && row('windy').rmsDb > row('calm').rmsDb + 6, 'wind loudness does not follow wind speed');
if (problems.length) fails.push('page problems: ' + [...new Set(problems)].slice(0, 4).join(' | '));
if (opt.json) fs.writeFileSync(opt.json, JSON.stringify(rows, null, 1));
console.log(fails.length ? `FAILED (${fails.length})` : 'PASSED');
for (const f of fails) console.log('  - ' + f);
process.exit(fails.length ? 1 : 0);
