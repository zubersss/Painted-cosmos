// The phone and tablet as a platform (W3.4 of the sharp-smooth plan): the whole screen, held
// sideways, kept awake, with sound through the silent switch, and a word to iOS about the Home
// Screen. Every call here is one the browser may not have or may refuse: each is tried, and
// failing it says nothing to the console and changes nothing else (only `state` records it).
//
//   on the first touch      fullscreen where the browser allows it (Android, an iPad), then a try
//                           at locking the screen sideways (Android in fullscreen only)
//   while playing by touch  a Screen Wake Lock, asked for again whenever the page comes back
//   at once                 navigator.audioSession.type = 'playback' (Safari: sound with the switch on)
//   iOS, not from the Home Screen, once ever: "For the whole screen: Share, then Add to Home Screen"
//
// None of it happens on a desktop (no touch layer shown): the desktop is the desktop.

export const A2HS_KEY = 'painted-cosmos.home-screen-hint';
export const A2HS_TEXT = 'For the whole screen: Share, then Add to Home Screen';

// Is this iOS or iPadOS (an iPad asks for the desktop site and says it is a Mac with touch points)?
export function isIOS(nav = {}) {
  const ua = String(nav.userAgent || '');
  return /iPhone|iPad|iPod/.test(ua) || (nav.platform === 'MacIntel' && (nav.maxTouchPoints || 0) > 1);
}

// Opened from the Home Screen (or installed): the browser's bars are already gone.
export function isStandalone(win) {
  try {
    if (win.navigator && win.navigator.standalone === true) return true;
    if (win.matchMedia && (win.matchMedia('(display-mode: standalone)').matches || win.matchMedia('(display-mode: fullscreen)').matches)) return true;
  } catch { /* no media queries */ }
  return false;
}

// opts: { touch (the touch pad: .shown), started () => has the game begun, storage (the guarded
// handle or null), notice (text) => say it once, enabled (false: ?fullscreen=0, nothing asked) }.
export function attachPlatform({ win = window, doc = document, touch, started, storage, notice, enabled = true } = {}) {
  const state = { fullscreen: 'not asked', orientation: 'not asked', wakeLock: 'not asked', audioSession: 'none', homeScreenHint: 'not shown' };
  const nav = win.navigator || {};

  // Sound through the silent switch (Safari 17+); elsewhere there is nothing to set.
  try {
    if (nav.audioSession && 'type' in nav.audioSession) { nav.audioSession.type = 'playback'; state.audioSession = String(nav.audioSession.type); }
  } catch { state.audioSession = 'refused'; }

  // The first touch asks for the whole screen and the sideways lock (a request needs the user's
  // gesture: a touchend is one, a touchstart is not). Asked once: a refusal is not asked again.
  const root = doc.documentElement;
  const fsEnabled = () => !!(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);
  const fsElement = () => doc.fullscreenElement || doc.webkitFullscreenElement || null;
  const lockSideways = () => {
    const o = win.screen && win.screen.orientation;
    if (!o || typeof o.lock !== 'function') { state.orientation = 'unsupported'; return; }
    try {
      const p = o.lock('landscape');
      state.orientation = 'asked';
      if (p && typeof p.then === 'function') p.then(() => { state.orientation = 'locked'; }, () => { state.orientation = 'refused'; });
    } catch { state.orientation = 'refused'; }
  };
  const askScreen = (e) => {
    if (state.fullscreen !== 'not asked' || !enabled) return;
    if (!(touch && touch.shown) && !(e && e.pointerType === 'touch')) return;
    if (isStandalone(win)) { state.fullscreen = 'standalone'; return; }
    if (fsElement()) { state.fullscreen = 'granted'; lockSideways(); return; }
    const req = root.requestFullscreen || root.webkitRequestFullscreen;
    if (!fsEnabled() || typeof req !== 'function') { state.fullscreen = 'unsupported'; return; }
    state.fullscreen = 'asked';
    try {
      const p = req.call(root, { navigationUI: 'hide' });
      if (p && typeof p.then === 'function') p.then(() => { state.fullscreen = 'granted'; lockSideways(); }, () => { state.fullscreen = 'refused'; });
      else { state.fullscreen = fsElement() ? 'granted' : 'asked'; lockSideways(); }
    } catch { state.fullscreen = 'refused'; }
  };
  doc.addEventListener('touchend', askScreen, { capture: true, passive: true });
  doc.addEventListener('pointerup', (e) => { if (e.pointerType === 'touch') askScreen(e); }, { capture: true, passive: true });

  // The screen kept awake while the game is played by touch (a pulse to Mars takes a minute with
  // no finger on the glass). The browser lets go of it when the page is hidden: asked again on
  // the way back.
  let lock = null, asking = false;
  const wantLock = () => !!(touch && touch.shown) && (!started || started()) && !doc.hidden;
  const askLock = () => {
    if (lock || asking || !wantLock()) return;
    if (!nav.wakeLock || typeof nav.wakeLock.request !== 'function') { state.wakeLock = 'unsupported'; return; }
    asking = true;
    try {
      nav.wakeLock.request('screen').then((s) => {
        asking = false; lock = s; state.wakeLock = 'held';
        try { s.addEventListener('release', () => { lock = null; if (state.wakeLock === 'held') state.wakeLock = 'released'; }); } catch { /* still held */ }
      }, () => { asking = false; state.wakeLock = 'refused'; });
    } catch { asking = false; state.wakeLock = 'refused'; }
  };
  doc.addEventListener('visibilitychange', () => { if (!doc.hidden) { if (state.wakeLock === 'refused') state.wakeLock = 'not asked'; askLock(); } });

  // iOS has no fullscreen for a page: once ever, after the game has begun, a word about the Home
  // Screen (where the game plays without the browser's bars).
  let hintAt = 0;
  const hint = (now) => {
    if (state.homeScreenHint !== 'not shown' || !isIOS(nav) || !(touch && touch.shown) || !started || !started()) return;
    if (isStandalone(win)) { state.homeScreenHint = 'standalone'; return; }
    // (an iPad that gave the page its whole screen needs no word about the Home Screen)
    if (state.fullscreen === 'granted' || fsElement()) { state.homeScreenHint = 'not needed'; return; }
    let seen = false;
    try { seen = !!(storage && storage.getItem(A2HS_KEY)); } catch { seen = false; }
    if (seen) { state.homeScreenHint = 'shown before'; return; }
    if (!hintAt) { hintAt = now + 8; return; }            // a few seconds into the game, not at the first tap
    if (now < hintAt) return;
    state.homeScreenHint = 'shown';
    try { if (storage) storage.setItem(A2HS_KEY, '1'); } catch { /* shown again next visit */ }
    if (notice) notice(A2HS_TEXT);
  };

  // Once a frame (main.js): the wake lock while playing, the hint when it is due.
  const frame = (nowS) => {
    if (wantLock() && !lock && state.wakeLock !== 'refused' && state.wakeLock !== 'unsupported') askLock();
    hint(nowS);
  };
  return { state, frame, askScreen };
}
