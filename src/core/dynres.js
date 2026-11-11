// Dynamic resolution and quality tiers. Pure (no three, no DOM).
//
// Budget: 60 fps (16.7 ms) at 1080p on an integrated GPU, never below 30 fps (33.3 ms).
// The controller watches a smoothed frame time and moves two levers:
//   renderScale  0.5 .. 1.0   internal scene resolution (the paper composite stays full-res)
//   quality      0 | 1 | 2    Painter's tiers (low, medium, high)
// Resolution is the fast lever (reacts within about half a second); the tier is the slow one
// (only when resolution alone cannot hold the budget, or when there has been headroom for a
// long time). Dead bands and cooldowns keep it from oscillating.

export const DYNRES = Object.freeze({
  targetMs: 16.7,
  highMs: 18.6,              // slower than this: shed load
  lowMs: 13.4,               // faster than this: there is headroom
  panicMs: 30,               // close to dropping under 30 fps: shed a lot, at once
  minScale: 0.5,
  maxScale: 1.0,
  stepDown: 0.07,
  stepUp: 0.04,
  downAfter: 0.45,           // seconds over budget before scaling down
  upAfter: 2.5,              // seconds of headroom before scaling up
  tierDownAfter: 3.0,        // seconds at minimum scale and still over budget
  tierUpAfter: 12,           // seconds at full scale with headroom
  tierUpMs: 11.0,            // only go up a tier with real headroom
  tierCooldown: 6,           // seconds after any tier change before the next
  emaRate: 6,                // 1/s smoothing of the frame time
  ignoreAboveMs: 250,        // hitches (tab switch, shader compile) are not load
});

export class DynamicResolution {
  constructor(opts = {}) {
    this.T = { ...DYNRES, ...(opts.tuning || {}) };
    this.scale = opts.scale ?? 1;
    this.quality = opts.quality ?? 2;
    this.maxQuality = opts.maxQuality ?? 2;     // the player's chosen ceiling
    this.minQuality = opts.minQuality ?? 0;
    this.enabled = opts.enabled ?? true;
    this.ema = this.T.targetMs;
    this.over = 0; this.under = 0; this.atMin = 0; this.atMax = 0;
    this.cooldown = 0;
    this.changes = 0;
    this.upPenalty = 1;        // grows when a tier-up had to be undone, so it is tried less often
    this.sinceTierUp = Infinity;
  }

  // Feed one frame. dtMs is the real time the last frame took. Returns
  // { scale, quality, changed } where `changed` says the caller should apply the values.
  frame(dtMs) {
    const T = this.T;
    if (!this.enabled || !(dtMs > 0) || dtMs > T.ignoreAboveMs) {
      return { scale: this.scale, quality: this.quality, changed: false };
    }
    const dt = dtMs / 1000;
    this.ema += (dtMs - this.ema) * (1 - Math.exp(-T.emaRate * dt));
    this.cooldown = Math.max(0, this.cooldown - dt);
    let changed = false;
    const ms = this.ema;

    if (ms > T.highMs) { this.over += dt; this.under = 0; }
    else if (ms < T.lowMs) { this.under += dt; this.over = 0; }
    else { this.over = Math.max(0, this.over - dt); this.under = Math.max(0, this.under - dt); }

    // Fast lever: resolution.
    if (ms > T.panicMs && this.scale > T.minScale) {
      this.scale = Math.max(T.minScale, this.scale - T.stepDown * 2.5);
      this.over = 0; changed = true;
      this.ema = Math.min(this.ema, T.panicMs);      // let the new setting prove itself
    } else if (this.over >= T.downAfter && this.scale > T.minScale) {
      // Scale the step by how far over budget we are (cost is roughly proportional to pixels).
      const excess = Math.min(3, ms / T.targetMs);
      this.scale = Math.max(T.minScale, this.scale - T.stepDown * excess);
      this.over = 0; changed = true;
    } else if (this.under >= T.upAfter && this.scale < T.maxScale) {
      this.scale = Math.min(T.maxScale, this.scale + T.stepUp);
      this.under = 0; changed = true;
    }
    this.scale = Math.round(this.scale * 1000) / 1000;

    // Slow lever: quality tier.
    const pinnedLow = this.scale <= T.minScale + 1e-6 && ms > T.highMs;
    const pinnedHigh = this.scale >= T.maxScale - 1e-6 && ms < T.tierUpMs;
    this.atMin = pinnedLow ? this.atMin + dt : 0;
    this.atMax = pinnedHigh ? this.atMax + dt : 0;
    this.sinceTierUp += dt;
    if (this.cooldown === 0) {
      if (this.atMin >= T.tierDownAfter && this.quality > this.minQuality) {
        // If the last tier-up did not hold, wait much longer before trying again.
        if (this.sinceTierUp < 60) this.upPenalty = Math.min(16, this.upPenalty * 3);
        this.quality--; this.atMin = 0; this.cooldown = T.tierCooldown;
        this.scale = Math.min(T.maxScale, T.minScale + 0.2);   // a cheaper tier buys pixels back
        changed = true;
      } else if (this.atMax >= T.tierUpAfter * this.upPenalty && this.quality < this.maxQuality) {
        this.quality++; this.atMax = 0; this.cooldown = T.tierCooldown * 2; this.sinceTierUp = 0;
        this.scale = Math.max(T.minScale, T.maxScale - 0.15);  // start the dearer tier carefully
        changed = true;
      }
    }
    if (changed) this.changes++;
    return { scale: this.scale, quality: this.quality, changed };
  }
}
