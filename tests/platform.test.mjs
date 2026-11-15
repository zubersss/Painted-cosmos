// The platform (W3.4 of the sharp-smooth plan, src/core/platform.js), on a made-up browser: the
// first touch asks for the whole screen and then for the sideways lock; a refusal or a missing
// API says nothing (no rejection left unhandled, nothing thrown) and is not asked again; the wake
// lock while playing by touch, asked again when the page comes back; the silent switch; iOS's Home
// Screen hint once ever; and none of it on a desktop.
import test from 'node:test';
import assert from 'node:assert/strict';
import { attachPlatform, isIOS, A2HS_KEY, A2HS_TEXT } from '../src/core/platform.js';

class Target {
  constructor() { this.l = {}; }
  addEventListener(t, f) { (this.l[t] = this.l[t] || []).push(f); }
  fire(t, e = {}) { for (const f of this.l[t] || []) f({ type: t, ...e }); }
}
const tick = () => new Promise((r) => setTimeout(r, 0));

function browser({ fullscreen = 'grant', lock = 'grant', wake = 'grant', ios = false, standalone = false, audioSession = true } = {}) {
  const doc = new Target();
  const calls = { fs: [], lock: [], wake: 0 };
  doc.hidden = false;
  doc.fullscreenEnabled = fullscreen !== 'none';
  doc.fullscreenElement = null;
  doc.documentElement = {
    requestFullscreen: fullscreen === 'none' ? undefined : function (opts) {
      calls.fs.push(opts);
      if (fullscreen === 'throw') throw new Error('not allowed');
      if (fullscreen === 'refuse') return Promise.reject(new TypeError('Permissions check failed'));
      doc.fullscreenElement = this; return Promise.resolve();
    },
  };
  const nav = {
    userAgent: ios ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)' : 'Mozilla/5.0 (Linux; Android 14; Pixel 7)',
    maxTouchPoints: 5, standalone: ios ? standalone : undefined,
    wakeLock: wake === 'none' ? undefined : { request: () => { calls.wake++; if (wake === 'refuse') return Promise.reject(new Error('NotAllowedError')); const s = new Target(); s.release = () => s.fire('release'); calls.sentinel = s; return Promise.resolve(s); } },
    audioSession: audioSession ? { type: 'auto' } : undefined,
  };
  const win = {
    navigator: nav,
    screen: { orientation: { lock: (o) => { calls.lock.push(o); return lock === 'grant' ? Promise.resolve() : Promise.reject(new Error('NotSupportedError')); } } },
    matchMedia: (q) => ({ matches: standalone && /standalone/.test(q) }),
  };
  const store = new Map();
  const storage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v) };
  return { doc, win, nav, calls, storage, store };
}

test('the first touch asks for the whole screen, then for the screen held sideways; once', async () => {
  const b = browser();
  const touch = { shown: true };
  const p = attachPlatform({ win: b.win, doc: b.doc, touch, started: () => true, storage: b.storage });
  b.doc.fire('touchend');
  await tick(); await tick();
  assert.deepEqual(b.calls.fs, [{ navigationUI: 'hide' }]);
  assert.deepEqual(b.calls.lock, ['landscape']);
  assert.equal(p.state.fullscreen, 'granted');
  assert.equal(p.state.orientation, 'locked');
  b.doc.fire('touchend'); b.doc.fire('pointerup', { pointerType: 'touch' });
  await tick();
  assert.equal(b.calls.fs.length, 1, 'asked once');
});

test('a refusal, a throw, a missing API: nothing said, nothing thrown, not asked again', async () => {
  for (const fullscreen of ['refuse', 'throw', 'none']) {
    const b = browser({ fullscreen, lock: 'refuse' });
    const p = attachPlatform({ win: b.win, doc: b.doc, touch: { shown: true }, started: () => true });
    assert.doesNotThrow(() => b.doc.fire('touchend'));
    await tick(); await tick();
    assert.equal(p.state.fullscreen, fullscreen === 'none' ? 'unsupported' : 'refused', fullscreen);
    assert.equal(b.calls.lock.length, 0, 'no lock without the whole screen');
    b.doc.fire('touchend');
    assert.ok(b.calls.fs.length <= 1);
  }
  // the lock refused (an iPad, or Chrome outside fullscreen): said nowhere
  const b = browser({ lock: 'refuse' });
  const p = attachPlatform({ win: b.win, doc: b.doc, touch: { shown: true }, started: () => true });
  b.doc.fire('touchend');
  await tick(); await tick();
  assert.equal(p.state.orientation, 'refused');
});

test('the desktop: no touch layer, nothing asked; ?fullscreen=0 asks nothing', async () => {
  const b = browser();
  attachPlatform({ win: b.win, doc: b.doc, touch: { shown: false }, started: () => true });
  b.doc.fire('pointerup', { pointerType: 'mouse' });
  await tick();
  assert.equal(b.calls.fs.length, 0);
  const c = browser();
  attachPlatform({ win: c.win, doc: c.doc, touch: { shown: true }, started: () => true, enabled: false });
  c.doc.fire('touchend');
  await tick();
  assert.equal(c.calls.fs.length, 0);
});

test('the wake lock while the game is played by touch, asked again when the page comes back', async () => {
  const b = browser();
  const touch = { shown: true };
  let started = false;
  const p = attachPlatform({ win: b.win, doc: b.doc, touch, started: () => started });
  p.frame(1);
  assert.equal(b.calls.wake, 0, 'not before the game begins');
  started = true;
  p.frame(2); p.frame(2.1);
  await tick();
  assert.equal(b.calls.wake, 1);
  assert.equal(p.state.wakeLock, 'held');
  b.calls.sentinel.release();              // the page was hidden: the browser let go
  b.doc.hidden = true; b.doc.fire('visibilitychange');
  p.frame(3);
  assert.equal(b.calls.wake, 1, 'not while hidden');
  b.doc.hidden = false; b.doc.fire('visibilitychange');
  await tick();
  assert.equal(b.calls.wake, 2, 'asked again on the way back');
  // refused, or missing: quiet
  const r = browser({ wake: 'refuse' });
  const q = attachPlatform({ win: r.win, doc: r.doc, touch, started: () => true });
  q.frame(1); await tick(); q.frame(2); await tick();
  assert.equal(q.state.wakeLock, 'refused');
  assert.equal(r.calls.wake, 1, 'a refusal is not asked again every frame');
  const n = browser({ wake: 'none' });
  const s = attachPlatform({ win: n.win, doc: n.doc, touch, started: () => true });
  s.frame(1);
  assert.equal(s.state.wakeLock, 'unsupported');
  // the desktop
  const d = browser();
  const t = attachPlatform({ win: d.win, doc: d.doc, touch: { shown: false }, started: () => true });
  t.frame(1);
  assert.equal(d.calls.wake, 0);
});

test('sound through the silent switch where the browser has an audio session', () => {
  const b = browser();
  const p = attachPlatform({ win: b.win, doc: b.doc, touch: { shown: false } });
  assert.equal(b.nav.audioSession.type, 'playback');
  assert.equal(p.state.audioSession, 'playback');
  const c = browser({ audioSession: false });
  assert.equal(attachPlatform({ win: c.win, doc: c.doc }).state.audioSession, 'none');
});

test("iOS: the Home Screen hint once ever, a few seconds into the game; never on Android or from the Home Screen", async () => {
  assert.ok(isIOS({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)' }));
  assert.ok(isIOS({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)', platform: 'MacIntel', maxTouchPoints: 5 }));
  assert.ok(!isIOS({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)', platform: 'MacIntel', maxTouchPoints: 0 }));
  const b = browser({ ios: true, fullscreen: 'none' });
  const said = [];
  const p = attachPlatform({ win: b.win, doc: b.doc, touch: { shown: true }, started: () => true, storage: b.storage, notice: (t) => said.push(t) });
  p.frame(10); p.frame(15);
  assert.equal(said.length, 0, 'not at once');
  p.frame(18.5);
  assert.deepEqual(said, [A2HS_TEXT]);
  assert.equal(b.store.get(A2HS_KEY), '1');
  p.frame(40);
  assert.equal(said.length, 1);
  // the next visit: shown before
  const q = attachPlatform({ win: b.win, doc: b.doc, touch: { shown: true }, started: () => true, storage: b.storage, notice: (t) => said.push(t) });
  q.frame(1); q.frame(20);
  assert.equal(said.length, 1);
  assert.equal(q.state.homeScreenHint, 'shown before');
  // Android, and iOS from the Home Screen: never
  const a = browser();
  const ap = attachPlatform({ win: a.win, doc: a.doc, touch: { shown: true }, started: () => true, storage: a.storage, notice: (t) => said.push(t) });
  ap.frame(1); ap.frame(30);
  const s = browser({ ios: true, standalone: true });
  const sp = attachPlatform({ win: s.win, doc: s.doc, touch: { shown: true }, started: () => true, storage: s.storage, notice: (t) => said.push(t) });
  sp.frame(1); sp.frame(30);
  assert.equal(said.length, 1);
  assert.equal(sp.state.homeScreenHint, 'standalone');
  // an iPad that gave the page its whole screen: no word about the Home Screen
  const ipad = browser({ ios: true });
  const ipp = attachPlatform({ win: ipad.win, doc: ipad.doc, touch: { shown: true }, started: () => true, storage: ipad.storage, notice: (t) => said.push(t) });
  ipad.doc.fire('touchend');
  await tick(); await tick();
  ipp.frame(1); ipp.frame(30);
  assert.equal(said.length, 1);
  assert.equal(ipp.state.homeScreenHint, 'not needed');
});
