// Dynamic resolution and quality tiers. Pure (no three, no DOM).
//
// The game starts at the best picture it has (top tier, full resolution) and gives some of it
// up only when the measured frame time asks for it. Aim: 60 fps (16.7 ms) at 1080p on an
// integrated GPU, never below 30 fps (33.3 ms). Two levers:
//   renderScale  0.5 .. 1.0   internal scene resolution (the paper composite stays full-res)
//   quality      0 | 1 | 2    Painter's tiers (low, medium, high)
//
// Down is fast, up is careful:
//   - under 30 fps the load is shed at once, by as much as the frame time says is needed
//     (cost goes roughly with pixels); if even the smallest picture of this tier could not
//     reach 30 fps the tier goes in the same move. A machine that cannot hold the top tier is
//     off it within a second or two, not left at a crawl;
//   - a little over budget, resolution steps down after half a second;
//   - up again only after seconds of proof. A display that waits for its refresh never shows
//     a frame time under its interval, so "steadily on budget" is the only sign of room: the
//     controller then tries one small step up; if the step does not hold it is taken back and
//     the next try waits twice as long (a step that holds halves the wait again). A tier is tried only at full resolution, starts at a
//     lower scale, and if it does not hold the wait before the next try triples.
// One slow frame is a hitch (tab switch, shader compile) and is ignored; a run of them is load.
// The caller does not feed frames while the world is loading (rest() clears the memory).

export const DYNRES = Object.freeze({
  targetMs: 16.7,
  highMs: 18.6,              // slower than this: shed load
  lowMs: 13.4,               // faster than this: there is headroom (fast displays only)
  panicMs: 30,               // close to dropping under 30 fps: shed a lot, at once
  minScale: 0.5,
  maxScale: 1.0,
  stepDown: 0.07,
  stepUp: 0.04,
  downAfter: 0.45,           // seconds over budget before scaling down
  upAfter: 2.5,              // seconds of headroom before scaling up
  probeAfter: 4,             // seconds steadily on budget before trying one step up
  probeWindow: 4,            // seconds a step up has to hold; if not, it is taken back
  probeBackoffMax: 32,       // a failed try doubles the wait, up to probeAfter x this
  tierDownAfter: 1.5,        // seconds at minimum scale and still over budget
  tierUpAfter: 12,           // seconds at full scale with room
  tierUpMs: 11.0,            // real headroom (fast displays)
  tierDownCooldown: 1.5,     // seconds after a tier change before the next one down
  tierUpCooldown: 12,        // seconds after a tier change before the next one up
  tierPenaltyMax: 27,        // a tier that did not hold triples the wait, up to tierUpAfter x this
  emaRate: 6,                // 1/s smoothing of the frame time
  ignoreAboveMs: 250,        // one frame this slow is a hitch, not load...
  hitchRun: 3,               // ...this many in a row are load
});

export class DynamicResolution {
  constructor(opts = {}) {
    this.T = { ...DYNRES, ...(opts.tuning || {}) };
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
    this.rest();
  }

  // Forget what was measured (after loading, after a pause): the next frames start clean.
  rest() {
    this.ema = this.T.targetMs;
    this.over = 0; this.under = 0; this.steady = 0; this.atMin = 0; this.atMax = 0;
    this.slowRun = 0;
    this.downCooldown = 0; this.upCooldown = Math.max(this.upCooldown || 0, 0);
    this.sinceUp = Infinity;        // seconds since the last step up in scale
    this.probing = false;           // a step up is on trial
    this.sinceTierUp = Infinity;
  }

  // Feed one frame. dtMs is the real time the last frame took. Returns
  // { scale, quality, changed } where `changed` says the caller should apply the values.
  frame(dtMs) {
    const T = this.T;
    const same = () => ({ scale: this.scale, quality: this.quality, changed: false });
    if (!this.enabled || !(dtMs > 0)) return same();
    if (dtMs > T.ignoreAboveMs) {
      if (++this.slowRun < T.hitchRun) return same();
    } else this.slowRun = 0;
    const dt = Math.min(dtMs, 500) / 1000;
    this.ema += (dtMs - this.ema) * (1 - Math.exp(-T.emaRate * dt));
    this.downCooldown = Math.max(0, this.downCooldown - dt);
    this.upCooldown = Math.max(0, this.upCooldown - dt);
    this.sinceUp += dt; this.sinceTierUp += dt;
    if (this.probing && this.sinceUp >= T.probeWindow) { this.probing = false; this.probeBackoff = Math.max(1, this.probeBackoff / 2); }   // the last step up held
    const ms = this.ema;
    const scale0 = this.scale, quality0 = this.quality;

    if (ms > T.highMs) { this.over += dt; this.under = 0; this.steady = 0; }
    else if (ms < T.lowMs) { this.under += dt; this.steady += dt; this.over = 0; }
    else { this.over = Math.max(0, this.over - dt); this.under = Math.max(0, this.under - dt); if (this.over === 0) this.steady += dt; }

    // ---- down: fast ---------------------------------------------------------------------------
    const tierDown = () => {
      // If the last tier-up did not hold, wait much longer before trying again.
      if (this.sinceTierUp < 60) this.upPenalty = Math.min(T.tierPenaltyMax, this.upPenalty * 3);
      this.quality--; this.tierChanges++;
      this.atMin = 0; this.atMax = 0;
      this.downCooldown = T.tierDownCooldown; this.upCooldown = T.tierUpCooldown;
    };
    if (ms > T.panicMs) {
      // What the smallest picture of this tier would cost, if cost goes with pixels.
      const floor = ms * (T.minScale / this.scale) ** 2;
      if (floor > T.panicMs && this.quality > this.minQuality && this.downCooldown === 0) {
        tierDown();
        this.scale = T.minScale;
      } else if (this.scale > T.minScale) {
        this.scale = Math.max(T.minScale, Math.min(this.scale - T.stepDown * 2.5, this.scale * Math.sqrt(T.targetMs / ms)));
      }
      if (this.scale !== scale0 || this.quality !== quality0) {
        this.over = 0; this.steady = 0;
        this.ema = Math.min(this.ema, T.panicMs);      // let the new setting prove itself
      }
    } else if (this.over >= T.downAfter && this.scale > T.minScale) {
      if (this.sinceUp < T.probeWindow) {
        // The step up we just tried does not hold: take it back, and try less often.
        this.scale = Math.max(T.minScale, this.scale - T.stepUp);
        this.probeBackoff = Math.min(T.probeBackoffMax, this.probeBackoff * 2);
        this.sinceUp = Infinity; this.probing = false;
      } else {
        // Scale the step by how far over budget we are.
        this.scale = Math.max(T.minScale, this.scale - T.stepDown * Math.min(3, ms / T.targetMs));
      }
      this.over = 0; this.steady = 0;
    }

    // ---- up: careful ---------------------------------------------------------------------------
    else if (this.scale < T.maxScale && (this.under >= T.upAfter || this.steady >= T.probeAfter * this.probeBackoff)) {
      if (this.under >= T.upAfter) this.probeBackoff = Math.max(1, this.probeBackoff / 2);   // real headroom was seen
      this.scale = Math.min(T.maxScale, this.scale + T.stepUp);
      this.under = 0; this.steady = 0; this.sinceUp = 0; this.probing = true;
    }
    this.scale = Math.round(this.scale * 1000) / 1000;

    // ---- the tier: only when resolution alone cannot answer ---------------------------------------
    const pinnedLow = this.scale <= T.minScale + 1e-6 && ms > T.highMs;
    const pinnedHigh = this.scale >= T.maxScale - 1e-6 && this.over === 0 && ms < T.highMs;
    this.atMin = pinnedLow ? this.atMin + dt : 0;
    this.atMax = pinnedHigh ? this.atMax + dt * (ms < T.tierUpMs ? 2 : 1) : 0;
    if (this.quality === quality0) {
      if (this.atMin >= T.tierDownAfter && this.quality > this.minQuality && this.downCooldown === 0) {
        tierDown();
        this.scale = Math.min(T.maxScale, T.minScale + 0.2);   // a cheaper tier buys pixels back
      } else if (this.atMax >= T.tierUpAfter * this.upPenalty && this.quality < this.maxQuality && this.upCooldown === 0 && this.sinceUp >= T.probeWindow) {
        this.quality++; this.tierChanges++;
        this.atMax = 0; this.steady = 0; this.sinceTierUp = 0;
        this.downCooldown = 0; this.upCooldown = T.tierUpCooldown;
        this.scale = Math.max(T.minScale, T.maxScale - 0.15);  // start the dearer tier carefully
      }
    }
    const changed = this.scale !== scale0 || this.quality !== quality0;
    if (changed) this.changes++;
    return { scale: this.scale, quality: this.quality, changed };
  }
}
