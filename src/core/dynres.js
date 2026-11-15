// Dynamic resolution and quality tiers. Pure (no three, no DOM).
//
// The game starts at the best picture it has (top tier, full resolution) and gives some of it
// up only when the measured frame time asks for it. Aim: 60 fps (16.7 ms) at 1080p on an
// integrated GPU, never below 30 fps (33.3 ms). Two levers:
//   renderScale  floor .. 1.0   the render scale handed to the painter
//   quality      0 | 1 | 2      Painter's tiers (low, medium, high), as rungs of a ladder
// The picture the scene is drawn at is internal = the tier's share (PAINTER's constants,
// render/index.js TIERS) x the render scale, of the output's size.
//
// R2 W6.1 (docs/lead/SHARP-SMOOTH-PLAN.md, ruling 5): the resolution has a FLOOR. The scene is
// never drawn under `floor` of the output (0.67; 0.75 on phones and tablets: preset.js) unless
// the URL pins a smaller scale (?scale=, the tests' painted runs: `scaleFloor`). At the floor
// and still over budget the controller sheds a rung (geometry first: a tier; then MSAA, where
// the caller gives that rung), never pixels. A tier whose share is under the floor is drawn at
// render scale 1 (its share is the most it can draw).
//
// Down is fast, up is careful:
//   - under 30 fps the load is shed at once. The first step assumes cost goes with pixels (the
//     only thing known before anything was shed); if even this tier's floor could not reach
//     30 fps by that measure, the tier goes in the same move. A machine that cannot hold the top
//     tier is off it within a second or two, not left at a crawl;
//   - a little over budget, resolution steps down after half a second;
//   - every later step is sized from what the first step actually bought (the descent's average
//     before it against now: ms per unit of drawn area), not from the assumption that cost goes
//     with pixels. A machine whose cost does not move with the pixels (post passes at the output's
//     size, vertex load, the CPU) is therefore not driven to the floor: when the measured gain
//     says even the floor would not bring it in, a rung is shed instead, at the same internal
//     resolution (tiers differ by what they draw, not by blur);
//   - up again only after seconds of proof. A display that waits for its refresh never shows
//     a frame time under its interval, so "steadily on budget" is the only sign of room: the
//     controller then tries one small step up; if the step does not hold it is taken back and
//     the next try waits twice as long (a step that holds halves the wait again). A rung is
//     tried only at full scale, starts at a lower scale, and if it does not hold the wait
//     before the next try triples.
// One slow frame is a hitch (tab switch, shader compile, a world built on arrival): it moves
// the average by a bounded step (at most 2.5 x the average, or 50 ms), and the panic needs 3 of
// the last 5 frames over the line; a run of them is load.
// A refresh or frame-rate cap is not load (a 50 Hz panel, Chrome's Energy Saver, Safari's Low
// Power Mode, a 30 Hz TV): no setting can beat its interval. When shedding at least 40 % of
// the picture leaves a steady interval where it was, the controller goes back to where that
// descent began and takes the interval as its budget (capMs); it forgets it once frames run
// well under it for 3 s. A machine held back by its CPU looks the same and is treated the same:
// shedding pixels would buy it nothing.
// With nothing left to shed and the frame still over budget, `exhausted` turns true after
// paceAfter seconds (W6.2: a phone then paces itself to an even 30 fps, src/core/pacing.js).
// The caller does not feed frames while the world is loading (rest() clears the memory).
// (Hardening review 2026-11, P4: the candidate patch it tested in Node, adopted by PILOT.)

export const DYNRES = Object.freeze({
  targetMs: 16.7,
  highMs: 18.6,              // slower than this: shed load
  lowMs: 13.4,               // faster than this: there is headroom (fast displays only)
  panicMs: 30,               // close to dropping under 30 fps: shed a lot, at once
  floor: 0.67,               // R2 W6.1: internal (share x scale) never under this on a desktop...
  floorTouch: 0.75,          // ...and on a phone or a tablet (preset.js)
  minScale: 0.67,            // the floor in render scale for a tier whose share is 1
  pinMin: 0.25,              // no URL pin draws under this render scale
  maxScale: 1.0,
  stepDown: 0.07,
  stepUp: 0.04,
  aim: 1.0,                  // a measured step aims at this share of the target (the band above it to
                             // highMs is the margin, as for every other step)
  settle: 0.45,              // seconds (and `level`'s frames) after a step before what it bought is read
  level: 12,                 // frames in the plain mean a step is measured with (no lag once they are all new)
  noGain: 0.1,               // a measured gain under this share of "all of it in pixels" is none
  downAfter: 0.45,           // seconds over budget before scaling down
  upAfter: 2.5,              // seconds of headroom before scaling up
  probeAfter: 4,             // seconds steadily on budget before trying one step up
  probeWindow: 4,            // seconds a step up has to hold; if not, it is taken back
  probeBackoffMax: 32,       // a failed try doubles the wait, up to probeAfter x this
  tierDownAfter: 1.5,        // seconds at the floor and still over budget
  tierUpAfter: 12,           // seconds at full scale with room
  tierUpMs: 11.0,            // real headroom (fast displays)
  tierDownCooldown: 1.5,     // seconds after a tier change before the next one down
  tierUpCooldown: 12,        // seconds after a tier change before the next one up
  tierPenaltyMax: 27,        // a tier that did not hold triples the wait, up to tierUpAfter x this
  emaRate: 6,                // 1/s smoothing of the frame time
  ignoreAboveMs: 250,        // one frame this slow is a hitch, not load...
  hitchRun: 3,               // ...this many in a row are load
  capJudge: 2.5,             // seconds after the first step down: nothing shed helped -> not the GPU's load
  capJitter: 2.5,            // ms: a refresh or rAF cap gives near-constant intervals (a second guard: the
                             // first is that shedding 40 % of the picture did not move the interval)
  capMaxMs: 42,              // no display or battery saver caps slower than 24 Hz: anything slower is load
  paceAfter: 2,              // seconds with nothing left to shed and still over budget: `exhausted`
});

// The tiers' shares of the output (PAINTER's constants: src/render/index.js TIERS, today), used
// when the painter neither says them (painter.tierShares) nor can be asked (tierSharesOf).
export const TIER_SHARES = Object.freeze([0.62, 0.8, 1.0]);

// The shares the painter draws its tiers at: painter.tierShares when it says them; [1, 1, 1] for
// the stub painter (it draws at the render scale); otherwise read off painter.info at render
// scale 1, tier by tier, for an output `outH` pixels tall (the painter is left at `restore`).
export function tierSharesOf(painter, outH, restore = null, fallback = TIER_SHARES) {
  const ok = (a) => Array.isArray(a) && a.length === 3 && a.every((x) => typeof x === 'number' && x > 0 && x <= 1);
  if (!painter) return [...fallback];
  if (ok(painter.tierShares)) return [...painter.tierShares];
  if (painter.isStub) return [1, 1, 1];
  const info = painter.info;
  if (!info || !(outH >= 64) || typeof painter.setQuality !== 'function' || typeof painter.setRenderScale !== 'function') return [...fallback];
  const out = [];
  try {
    for (let q = 0; q < 3; q++) {
      painter.setRenderScale(1); painter.setQuality(q);
      out.push(Math.round((info.internalHeight / outH) * 100) / 100);
    }
  } catch { return [...fallback]; } finally {
    if (restore) { try { painter.setRenderScale(restore.scale); painter.setQuality(restore.quality); } catch { /* the caller applies */ } }
  }
  return ok(out) ? out : [...fallback];
}

// The ladder the controller climbs: tiers, and (on a desktop) MSAA as a rung of its own below the
// tier that has it, so that "geometry, then MSAA" is shed in that order. Each rung: { q, aa }
// (aa: the painter's setAA mode, or undefined to leave the painter's AA alone).
export const RUNGS = Object.freeze([{ q: 0 }, { q: 1 }, { q: 2 }]);
export const RUNGS_MSAA = Object.freeze([{ q: 0, aa: 'auto' }, { q: 1, aa: 'post' }, { q: 1, aa: 'auto' }, { q: 2, aa: 'auto' }]);

export class DynamicResolution {
  constructor(opts = {}) {
    this.T = { ...DYNRES, ...(opts.tuning || {}) };
    this.shares = [1, 1, 1];
    this.floor = this.T.floor;
    this.scaleFloor = null;                     // a URL pin under the floor (render scale)
    this.rungs = RUNGS;
    this.scale = opts.scale ?? 1;
    this.quality = opts.quality ?? 2;
    this.maxQuality = opts.maxQuality ?? 2;     // the player's chosen ceiling
    this.minQuality = opts.minQuality ?? 0;
    this.enabled = opts.enabled ?? true;
    this.start = { scale: this.scale, quality: this.quality };
    this.changes = 0;
    this.tierChanges = 0;
    this.probeBackoff = 1;     // grows when a step up had to be taken back
    this.upPenalty = 1;        // grows when a tier-up had to be undone
    this.capMs = opts.capMs || 0;   // a frame interval no setting can beat (refresh or rAF cap), 0 = none known
    this.rung = 0;
    this.configure(opts, true);
    this.rest();
  }

  // shares (the tiers' shares of the output), floor (internal), scaleFloor (a URL pin's render
  // scale: the floor then never asks for more than it), rungs (the ladder). The scale is held
  // inside the new bounds; the start values are not changed.
  configure(o = {}, first = false) {
    if (Array.isArray(o.shares) && o.shares.length === 3 && o.shares.every((x) => x > 0 && x <= 1)) this.shares = [...o.shares];
    if (typeof o.floor === 'number' && o.floor > 0 && o.floor <= 1) this.floor = o.floor;
    if ('scaleFloor' in o) this.scaleFloor = typeof o.scaleFloor === 'number' && o.scaleFloor > 0 ? Math.min(1, o.scaleFloor) : null;
    if (Array.isArray(o.rungs) && o.rungs.length) this.rungs = o.rungs.map((r) => ({ q: r.q | 0, aa: r.aa }));
    this.rung = this.rungOf(this.quality);
    this.aa = this.rungs[this.rung].aa;
    if (this.enabled || !first) {
      const lo = this.sMin(), s0 = this.scale;
      if (this.enabled) this.scale = Math.round(Math.min(this.T.maxScale, Math.max(lo, this.scale)) * 1000) / 1000;
      if (!first && this.scale !== s0) this.changes++;
    }
    return this;
  }

  // The highest rung that draws tier q (the lowest above it if none does).
  rungOf(q) {
    let best = -1;
    for (let i = 0; i < this.rungs.length; i++) if (this.rungs[i].q === q) best = i;
    if (best >= 0) return best;
    for (let i = 0; i < this.rungs.length; i++) if (this.rungs[i].q >= q) return i;
    return this.rungs.length - 1;
  }
  get minRung() { for (let i = 0; i < this.rungs.length; i++) if (this.rungs[i].q >= this.minQuality) return i; return 0; }
  get maxRung() { for (let i = this.rungs.length - 1; i >= 0; i--) if (this.rungs[i].q <= this.maxQuality) return i; return this.rungs.length - 1; }
  share(q = this.quality) { return this.shares[Math.max(0, Math.min(2, q | 0))]; }
  // The picture the scene is drawn at, as a share of the output's size (linear).
  get internal() { return Math.min(1, this.share() * this.scale); }
  // The smallest render scale this tier may use: the floor, or 1 where the tier's share is under
  // the floor; never more than a URL pin asks for.
  sMin(q = this.quality) {
    const sh = this.share(q);
    let s = sh > this.floor ? this.floor / sh : 1;
    if (this.scaleFloor != null) s = Math.min(s, this.scaleFloor);
    return Math.max(this.T.pinMin, Math.min(this.T.maxScale, Math.ceil(s * 1000 - 1e-6) / 1000));   // (up: share x it is never under the floor)
  }
  get exhausted() { return this.spent >= this.T.paceAfter; }

  // Forget what was measured (after loading, after a pause): the next frames start clean.
  rest() {
    this.ema = this.T.targetMs;
    this.over = 0; this.under = 0; this.steady = 0; this.atMin = 0; this.atMax = 0;
    this.slowRun = 0;
    this.downCooldown = 0; this.upCooldown = Math.max(this.upCooldown || 0, 0);
    this.sinceUp = Infinity;        // seconds since the last step up in scale
    this.probing = false;           // a step up is on trial
    this.probeFrom = null;          // the frame time measured before it
    this.sinceTierUp = Infinity;
    this.avg = this.ema; this.dev = 0;   // the same average never reset by a change, and its jitter
    this.slowRing = 0;                   // last 5 raw frames over the panic line (bits)
    this.descent = null;                 // { avg, level, area, rung, internal, t, n } from the first step down
    this.lastStep = null;                // { level, area, rung, t, n }: the last resolution step down
    this.ring = new Float64Array(this.T.level); this.ringN = 0; this.ringI = 0; this.ringSum = 0;
    this.capLow = 0;
    this.spent = 0;
  }

  // The lines the frame time is judged against: the defaults, or stretched to a known cap.
  // (Recomputed only when the cap changes: the frame loop allocates nothing here.)
  budget() {
    const T = this.T, c = this.capMs;
    if (this._B && this._Bcap === c) return this._B;
    const f = Math.max(1, c / T.targetMs);
    this._Bcap = c;
    this._B = !c ? { target: T.targetMs, high: T.highMs, low: T.lowMs, panic: T.panicMs, tierUp: T.tierUpMs }
      : { target: T.targetMs * f, high: Math.max(T.highMs, 1.1 * c), low: T.lowMs * f, panic: Math.max(T.panicMs, 1.8 * c), tierUp: T.tierUpMs * f };
    return this._B;
  }

  // What drawing one more unit of area (the whole output) costs at this rung, in ms, as measured
  // by the steps already taken here: the descent's start against now, else the last step. null
  // when nothing has been measured at this rung yet.
  gain() {
    const T = this.T, area = this.internal ** 2, now = this.level();
    const D = this.descent, L = this.lastStep;
    const ready = (S) => S && S.rung === this.rung && S.t >= T.settle && S.n >= T.level && S.area - area >= 0.05;
    if (ready(D)) return Math.max(0, (D.level - now) / (D.area - area));
    if (ready(L)) return Math.max(0, (L.level - now) / (L.area - area));
    return null;
  }

  // The plain mean of the last `level` frames (hitches bounded as for the average): the frame
  // time a step is measured with. Unlike the smoothed average it has no lag once its frames all
  // come after the step.
  level() { return this.ringN ? this.ringSum / this.ringN : this.avg; }

  // Feed one frame. dtMs is the real time the last frame took. Returns
  // { scale, quality, aa, changed } where `changed` says the caller should apply the values.
  frame(dtMs) {
    const T = this.T;
    const same = () => ({ scale: this.scale, quality: this.quality, aa: this.aa, changed: false });
    if (!this.enabled || !(dtMs > 0)) return same();
    // (a caller that set the tier itself: the ladder follows)
    if (this.rungs[this.rung].q !== this.quality) { this.rung = this.rungOf(this.quality); this.aa = this.rungs[this.rung].aa; }
    if (dtMs > T.ignoreAboveMs) {
      if (++this.slowRun < T.hitchRun) return same();
    } else this.slowRun = 0;
    const dt = Math.min(dtMs, 500) / 1000;
    const B = this.budget();
    // One long frame (a compile, a build) moves the average a bounded step; a run of them is load.
    const x = this.slowRun >= T.hitchRun ? dtMs : Math.min(dtMs, Math.max(2.5 * this.ema, 50));
    const kw = 1 - Math.exp(-T.emaRate * Math.min(x, 500) / 1000);
    this.ema += (x - this.ema) * kw;
    this.dev += (Math.abs(x - this.avg) - this.dev) * kw;
    this.avg += (x - this.avg) * kw;
    { const R = this.ring; if (this.ringN === R.length) this.ringSum -= R[this.ringI]; else this.ringN++; R[this.ringI] = x; this.ringSum += x; this.ringI = (this.ringI + 1) % R.length; }
    this.slowRing = ((this.slowRing << 1) | (dtMs > B.panic ? 1 : 0)) & 31;
    let slowN = 0; for (let b = this.slowRing; b; b >>= 1) slowN += b & 1;
    // A cap that lifted (charger back in, the display changed): forget it.
    if (this.capMs && this.avg < 0.8 * this.capMs) { this.capLow += dt; if (this.capLow > 3) { this.capMs = 0; this.capLow = 0; } } else this.capLow = 0;
    if (this.lastStep) { this.lastStep.t += dt; this.lastStep.n++; }
    // Did the last descent help? If everything was shed and the interval did not move, and it is
    // steady, it is a cap (refresh, battery saver, low power mode) or the CPU: go back, and take it as the budget.
    if (this.descent) {
      const D = this.descent; D.t += dt; D.n++;
      // how much of the picture was shed since the descent began (a rung counts as about 40 %)
      const kept = (this.internal / D.internal) ** 2 * 0.6 ** Math.max(0, D.rung - this.rung);
      if (this.avg < 0.9 * D.avg) this.descent = null;
      else if (D.t >= T.capJudge && kept <= 0.6 && this.avg >= 0.97 * D.avg && this.avg <= T.capMaxMs && this.dev < T.capJitter) {
        const s0 = this.scale, q0 = this.quality, a0 = this.aa;
        this.capMs = Math.max(this.capMs, this.avg);
        this.setRung(D.rung); this.scale = D.scale; this.descent = null; this.lastStep = null;
        this.over = 0; this.under = 0; this.steady = 0; this.atMin = 0; this.atMax = 0; this.spent = 0;
        this.ema = this.avg; this.downCooldown = T.tierDownCooldown; this.upCooldown = T.tierUpCooldown;
        const changed = this.scale !== s0 || this.quality !== q0 || this.aa !== a0; if (changed) this.changes++;
        return { scale: this.scale, quality: this.quality, aa: this.aa, changed };
      } else if (D.t >= 2 * T.capJudge) this.descent = null;
    }
    this.downCooldown = Math.max(0, this.downCooldown - dt);
    this.upCooldown = Math.max(0, this.upCooldown - dt);
    this.sinceUp += dt; this.sinceTierUp += dt;
    if (this.probing && this.sinceUp >= T.probeWindow) { this.probing = false; this.probeBackoff = Math.max(1, this.probeBackoff / 2); }   // the last step up held
    const ms = this.ema;
    const scale0 = this.scale, quality0 = this.quality, aa0 = this.aa, rung0 = this.rung, area0 = this.internal ** 2, avg0 = this.avg, level0 = this.level();

    if (ms > B.high) { this.over += dt; this.under = 0; this.steady = 0; }
    else if (ms < B.low) { this.under += dt; this.steady += dt; this.over = 0; }
    else { this.over = Math.max(0, this.over - dt); this.under = Math.max(0, this.under - dt); if (this.over === 0) this.steady += dt; }

    const sMin = this.sMin(), atFloor = this.scale <= sMin + 1e-6;
    const k = this.gain(), kPix = ms / Math.max(1e-6, area0);
    const noGain = k != null && k < T.noGain * kPix;          // the pixels measured to buy (next to) nothing
    const canShed = this.rung > this.minRung && this.downCooldown === 0;

    // ---- down: fast ---------------------------------------------------------------------------
    const panic = ms > B.panic && slowN >= 3;
    if (panic || (this.over >= T.downAfter && !(atFloor && k == null))) {
      if (this.probing || this.sinceUp < T.probeWindow) {
        // The step up on trial is what broke: take back just that, and try less often. (The
        // setting it goes back to was measured before the try: what the try cost is not its.)
        this.scale = Math.max(sMin, this.scale - T.stepUp);
        this.probeBackoff = Math.min(T.probeBackoffMax, this.probeBackoff * 2);
        this.sinceUp = Infinity; this.probing = false;
        if (this.probeFrom != null) { this.ema = Math.min(this.ema, this.probeFrom); this.over = 0; }
      } else if (k == null) {
        // Nothing measured at this rung yet: cost is taken to go with pixels for this one step.
        const floorMs = ms * (this.share() * sMin) ** 2 / Math.max(1e-6, area0);
        if (panic && floorMs > B.panic && canShed) this.shed(true);
        else if (!atFloor) this.scale = Math.max(sMin, panic ? Math.min(this.scale - T.stepDown * 2.5, this.scale * Math.sqrt(B.target / ms)) : this.scale - T.stepDown * Math.min(3, ms / B.target));
      } else {
        // Sized by what the steps here bought: to the area that brings the frame to the aim, if
        // the floor allows. If it does not, a rung instead (the pixels are not this machine's
        // lever), unless most of the frame goes with the pixels and the floor itself is within
        // budget.
        const areaMin = (this.share() * sMin) ** 2, atFloorMs = ms - k * (area0 - areaMin);
        const area = area0 - (ms - T.aim * B.target) / k, pixelShare = (k * area0) / ms;
        if (!noGain && !atFloor && (area >= areaMin - 1e-9 || (pixelShare >= 0.5 && atFloorMs <= 0.5 * (B.target + B.high)))) {
          this.scale = Math.max(sMin, Math.min(this.scale - 0.01, Math.sqrt(Math.max(0, area)) / this.share()));
        } else if (canShed) this.shed(panic);
        else if (!noGain && !atFloor) this.scale = sMin;      // the best the pixels can do
      }
      if (this.scale !== scale0 || this.rung !== rung0) {
        this.over = 0; this.steady = 0;
        if (panic) this.ema = Math.min(this.ema, B.panic);   // let the new setting prove itself
      }
    }

    // ---- up: careful ---------------------------------------------------------------------------
    else if (this.scale < T.maxScale && (this.under >= T.upAfter || this.steady >= T.probeAfter * this.probeBackoff)) {
      if (this.under >= T.upAfter) this.probeBackoff = Math.max(1, this.probeBackoff / 2);   // real headroom was seen
      this.scale = Math.min(T.maxScale, this.scale + T.stepUp);
      this.under = 0; this.steady = 0; this.sinceUp = 0; this.probing = true; this.probeFrom = this.level();
    }
    this.scale = Math.round(this.scale * 1000) / 1000;

    // ---- the rung: only when resolution cannot answer --------------------------------------------
    const stuck = (this.scale <= this.sMin() + 1e-6 || noGain) && ms > B.high;
    const pinnedHigh = this.scale >= T.maxScale - 1e-6 && this.over === 0 && ms < B.high;
    this.atMin = stuck ? this.atMin + dt : 0;
    this.atMax = pinnedHigh ? this.atMax + dt * (ms < B.tierUp ? 2 : 1) : 0;
    if (this.rung === rung0) {
      if (this.atMin >= T.tierDownAfter && this.rung > this.minRung && this.downCooldown === 0) {
        this.shed(false);
      } else if (this.atMax >= T.tierUpAfter * this.upPenalty && this.rung < this.maxRung && this.upCooldown === 0 && this.sinceUp >= T.probeWindow) {
        const internal = this.internal;
        this.setRung(this.rung + 1); this.tierChanges++;
        this.atMax = 0; this.steady = 0; this.sinceTierUp = 0;
        this.downCooldown = 0; this.upCooldown = T.tierUpCooldown;
        // start the dearer rung carefully, never above the picture it had
        this.scale = Math.round(Math.max(this.sMin(), Math.min(T.maxScale - 0.15, internal / this.share())) * 1000) / 1000;
      }
    }
    // Nothing left to shed and still over budget: the caller may pace the frames (W6.2).
    this.spent = ms > B.high && this.rung <= this.minRung && (this.scale <= this.sMin() + 1e-6 || noGain) ? this.spent + dt : 0;
    const changed = this.scale !== scale0 || this.quality !== quality0 || this.aa !== aa0;
    if (changed) this.changes++;
    const downStep = this.rung < rung0 || (this.rung === rung0 && this.scale < scale0 - 1e-9);
    if (downStep && !this.descent) this.descent = { avg: avg0, level: level0, area: area0, rung: rung0, scale: scale0, internal: Math.sqrt(area0), t: 0, n: 0 };
    if (this.rung === rung0 && this.scale < scale0 - 1e-9) this.lastStep = { level: level0, area: area0, rung: rung0, t: 0, n: 0 };
    return { scale: this.scale, quality: this.quality, aa: this.aa, changed };
  }

  setRung(i) {
    this.rung = Math.max(0, Math.min(this.rungs.length - 1, i));
    this.quality = this.rungs[this.rung].q;
    this.aa = this.rungs[this.rung].aa;
  }

  // Shed one rung. In a panic the new rung starts at its floor; otherwise at the same internal
  // resolution (tiers differ by what they draw, not by blur), held inside its bounds.
  shed(panic) {
    const T = this.T, internal = this.internal;
    // If the last tier-up did not hold, wait much longer before trying again.
    if (this.sinceTierUp < 60) this.upPenalty = Math.min(T.tierPenaltyMax, this.upPenalty * 3);
    this.setRung(this.rung - 1); this.tierChanges++;
    const lo = this.sMin();
    this.scale = Math.round((panic ? lo : Math.max(lo, Math.min(T.maxScale, internal / this.share()))) * 1000) / 1000;
    this.atMin = 0; this.atMax = 0; this.lastStep = null;
    this.downCooldown = T.tierDownCooldown; this.upCooldown = T.tierUpCooldown;
  }
}
