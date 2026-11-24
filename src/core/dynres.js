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
// One slow frame is a hitch (tab switch, shader compile, a world built on arrival): it moves
// the average by a bounded step (at most 2.5 x the average, or 50 ms), and the panic needs 3 of
// the last 5 frames over the line; a run of them is load.
// A refresh or frame-rate cap is not load (a 50 Hz panel, Chrome's Energy Saver, Safari's Low
// Power Mode, a 30 Hz TV): no setting can beat its interval. When shedding at least 40 % of
// the picture leaves a steady interval where it was, the controller goes back to where that
// descent began and takes the interval as its budget (capMs); it forgets it once frames run
// well under it for 3 s. A machine held back by its CPU looks the same and is treated the same:
// shedding pixels would buy it nothing.
// The caller does not feed frames while the world is loading (rest() clears the memory).
// (Hardening review 2026-11, P4: the candidate patch it tested in Node, adopted by PILOT.)

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
  capJudge: 2.5,             // seconds after the first step down: nothing shed helped -> not the GPU's load
  capJitter: 2.5,            // ms: a refresh or rAF cap gives near-constant intervals (a second guard: the
                             // first is that shedding 40 % of the picture did not move the interval)
  capMaxMs: 42,              // no display or battery saver caps slower than 24 Hz: anything slower is load

  // ---- SHARPENING: A DEVICE WITH ROOM IS GIVEN MORE PICTURE, NOT MORE OF ANYTHING ELSE.
  // The owner's speed table of 19 November (v26, an S23 Ultra): EVERY row of the test read -0.0 ms -- no far
  // trees, no trees at all, no shadows, no plants, the full paint -- because the phone was held at 60 a second by
  // its own display and nothing could be told apart under that cap. The only rows that cost anything were the ones
  // that made THE PICTURE SHARPER. The phone draws 1028 x 480 for a screen of 3086 x 1440, so everything is
  // stretched three times over, which is why the owner has now said three times that it looks soft at a distance.
  // Fitted from their own four sharpness rows: 10.4 ms for every million picture pixels, plus 8.5 ms that does not
  // depend on the picture at all. At the size it draws now that is 13.6 ms of a 16.7 ms frame: there IS room, and
  // it was being thrown away.
  //
  // So: a LADDER. A rung is a quarter of a picture pixel to the screen point. The controller climbs one rung only
  // after seconds of frames comfortably on budget AT FULL SCALE AND THE TOP TIER -- a sharper picture is the last
  // thing to be given and the first to be taken back -- and steps straight back down if the rung does not hold.
  // On a display that waits for its refresh this is self-correcting: a frame that misses the refresh by a hair is
  // shown a whole interval late, so a rung too far reads as 33 ms, not as 17.1, and goes at once.
  // `sharp` is only a NUMBER OF RUNGS here; main.js turns it into a canvas size (applyDynScale), and `sharpMax`
  // says how many rungs this screen has in it. 0 rungs, the default, is the game exactly as it was.
  sharpStep: 0.25,           // picture pixels to the screen point, per rung
  sharpUpAfter: 6,           // s steadily on budget, at full scale and the top tier, before one rung is tried
  sharpWindow: 5,            // s a new rung has to hold before it is believed
  sharpBackoffMax: 16,       // a rung that did not hold doubles the wait, up to sharpUpAfter x this
  sharpBack: 0.5,            // s after giving a rung back before another may go
  sharpGiveUp: 3,            // rungs that did not hold before the ladder is left alone until the next rest()
  // THE LADDER ON A TOUCH DEVICE (24 Nov, the owner's phone table v39.5 and the owner's standing word "give the room
  // to SHARPNESS"; main.js sets these for a phone or a tablet in the oil look, ?sharp=0 leaves them at 0). At the size
  // the phone is given it is held at 60 by its own display, so it never shows room above sixty and the ladder above
  // never climbed; and drawn 1.5 times as sharp each way it still ran 42 to 52 a second. So on a touch device the
  // ladder spends room down to a line well above the owner's thirty a second (the margin is for moving play), held
  // for half a second before a rung goes, and climbs only from frames comfortably fast; the two lines apart are the
  // hysteresis, and a rung is a whole quarter step, so the picture never creeps. 0 is each line as it was above.
  sharpHighMs: 0,            // > 0: a rung is given back when the smoothed frame is over this for sharpDownAfter s
  sharpLowMs: 0,             // > 0: a rung is climbed only after sharpUpAfter s under this
  sharpDownAfter: 0,         // s over sharpHighMs before a rung goes (0: at once, as before)
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
    this.capMs = opts.capMs || 0;   // a frame interval no setting can beat (refresh or rAF cap), 0 = none known
    // how many rungs of extra sharpness this screen has in it (main.js works it out from the screen's own pixel
    // ratio and what the device may hold); 0 is every device until the caller says otherwise, and then nothing
    // below changes anything at all.
    this.sharpMax = Math.max(0, opts.sharpMax || 0);
    // (the tier the ladder may climb from: by default the top of everything (maxQuality), as before; a touch device
    //  gives its own preset's tier, so that sharpness comes before a higher tier, the owner's word)
    this.sharpTier = opts.sharpTier != null ? opts.sharpTier : null;
    this.sharp = Math.max(0, Math.min(this.sharpMax, opts.sharp || 0));
    this.sharpChanges = 0;
    this.sharpBackoff = 1;
    this.sharpFails = 0;
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
    this.avg = this.ema; this.dev = 0;   // the same average never reset by a change, and its jitter
    this.slowRing = 0;                   // last 5 raw frames over the panic line (bits)
    this.descent = null;                 // { avg, scale, quality, t } from the first step down
    this.capLow = 0;
    this.sharpSteady = 0;                // s of frames good enough to try another rung
    this.sinceSharp = Infinity;          // s since the last rung was taken
    this.sharpProbing = false;           // the newest rung is still on trial
    this.sharpFails = 0;                 // rungs that did not hold; after sharpGiveUp the ladder is left alone
    this.sharpOver = 0;                  // s the smoothed frame has been over the touch device's line (sharpHighMs)
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

  // Feed one frame. dtMs is the real time the last frame took. Returns
  // { scale, quality, changed } where `changed` says the caller should apply the values.
  frame(dtMs) {
    const T = this.T;
    const same = () => ({ scale: this.scale, quality: this.quality, sharp: this.sharp, changed: false });
    if (!this.enabled || !(dtMs > 0)) return same();
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
    this.slowRing = ((this.slowRing << 1) | (dtMs > B.panic ? 1 : 0)) & 31;
    let slowN = 0; for (let b = this.slowRing; b; b >>= 1) slowN += b & 1;
    // A cap that lifted (charger back in, the display changed): forget it.
    if (this.capMs && this.avg < 0.8 * this.capMs) { this.capLow += dt; if (this.capLow > 3) { this.capMs = 0; this.capLow = 0; } } else this.capLow = 0;
    // Did the last descent help? If everything was shed and the interval did not move, and it is
    // steady, it is a cap (refresh, battery saver, low power mode) or the CPU: go back, and take it as the budget.
    if (this.descent) {
      const D = this.descent; D.t += dt;
      // how much of the picture was shed since the descent began (a tier counts as about 40 %)
      const kept = (this.scale / D.scale) ** 2 * 0.6 ** Math.max(0, D.quality - this.quality);
      if (this.avg < 0.9 * D.avg) this.descent = null;
      else if (D.t >= T.capJudge && kept <= 0.6 && this.avg >= 0.97 * D.avg && this.avg <= T.capMaxMs && this.dev < T.capJitter) {
        const s0 = this.scale, q0 = this.quality;
        this.capMs = Math.max(this.capMs, this.avg);
        this.scale = D.scale; this.quality = D.quality; this.descent = null;
        this.over = 0; this.under = 0; this.steady = 0; this.atMin = 0; this.atMax = 0;
        this.ema = this.avg; this.downCooldown = T.tierDownCooldown; this.upCooldown = T.tierUpCooldown;
        const changed = this.scale !== s0 || this.quality !== q0; if (changed) this.changes++;
        return { scale: this.scale, quality: this.quality, sharp: this.sharp, changed };
      } else if (D.t >= 2 * T.capJudge) this.descent = null;
    }
    this.downCooldown = Math.max(0, this.downCooldown - dt);
    this.upCooldown = Math.max(0, this.upCooldown - dt);
    this.sinceUp += dt; this.sinceTierUp += dt; this.sinceSharp += dt;
    if (this.sharpProbing && this.sinceSharp >= T.sharpWindow) { this.sharpProbing = false; this.sharpBackoff = Math.max(1, this.sharpBackoff / 2); }   // the rung held
    if (this.probing && this.sinceUp >= T.probeWindow) { this.probing = false; this.probeBackoff = Math.max(1, this.probeBackoff / 2); }   // the last step up held
    const ms = this.ema;
    const scale0 = this.scale, quality0 = this.quality, sharp0 = this.sharp;

    if (ms > B.high) { this.over += dt; this.under = 0; this.steady = 0; }
    else if (ms < B.low) { this.under += dt; this.steady += dt; this.over = 0; }
    else { this.over = Math.max(0, this.over - dt); this.under = Math.max(0, this.under - dt); if (this.over === 0) this.steady += dt; }

    // ---- THE SHARPNESS LADDER -------------------------------------------------------------------
    // A rung is the LAST thing given and the FIRST taken back: it is pure picture, and everything else in the
    // frame is the game itself. So this stands before the scale and the tier, and when it has anything to give
    // back it gives that and nothing else this frame.
    const sharpPanic = ms > B.panic && slowN >= 3;
    // (a rung given back needs a moment to be felt before the next one goes: the average is still carrying the
    //  slow frames that the rung above caused. Without this one failed rung cost two, and the ladder walked itself
    //  down to nothing and back up for ever -- the test beside this file watched it do exactly that.)
    // (the wait holds for a panic too. Without it one rung too far cost the WHOLE ladder: a picture a hair past
    //  what a 60 Hz display can hold is shown a whole interval late, 33 ms, which is over the panic line, and the
    //  controller emptied the ladder in a third of a second and then climbed it again, over and over. Traced.)
    const sHigh = T.sharpHighMs > 0 ? T.sharpHighMs : B.high;
    if (this.sharp > 0 && ms > sHigh) this.sharpOver += dt; else this.sharpOver = 0;
    // (while a rung stands and the touch device's half second over its line is still running, NOTHING ELSE is shed
    //  either: without this the ordinary controller, at 37 ms after 0.45 s, shrank the picture before the rung could go
    //  -- found by the test beside this file. With no hold, as before, this never applies.)
    if (this.sharp > 0 && ms > sHigh && !sharpPanic && this.sharpOver < (T.sharpDownAfter || 0)) { this.over = 0; this.steady = 0; this.under = 0; return same(); }
    if (this.sharp > 0 && (sharpPanic || (ms > sHigh && this.sharpOver >= (T.sharpDownAfter || 0)))) {
      // NOTHING ELSE IS SHED WHILE THE LADDER STANDS. The sharpening is the one thing in the frame that is not the
      // game: it must ALL be given back before the picture is shrunk or a tier is dropped. (Without this the half
      // second between one rung and the next was enough for the ordinary controller to panic at the 33 ms a rung
      // too far costs, and one rung too far cost the scale AND a tier -- which then took two minutes to come back.
      // Traced, on the owner's own phone as the numbers describe it.)
      if (this.sinceSharp < T.sharpBack) { this.over = 0; this.steady = 0; this.under = 0; return { scale: this.scale, quality: this.quality, sharp: this.sharp, changed: false }; }
      this.sharp = sharpPanic ? Math.floor(this.sharp / 2) : this.sharp - 1;   // a panic gives back half the ladder
      if (this.sharpProbing || sharpPanic) { this.sharpBackoff = Math.min(T.sharpBackoffMax, this.sharpBackoff * 2); this.sharpFails++; }
      this.sharpProbing = false; this.sinceSharp = 0; this.sharpSteady = 0; this.sharpOver = 0;
      this.over = 0; this.steady = 0; this.under = 0;
      // (the average is NOT wound back here. It was, and that hid a real panic: each slow frame gave back one rung
      //  and then forgot how slow it had been, so a machine falling off a cliff walked down the ladder a rung at a
      //  time instead of dropping the lot. Found by the test beside this file.)
      this.sharpChanges++;
      return { scale: this.scale, quality: this.quality, sharp: this.sharp, changed: true };
    }
    // ... and it is climbed only from the top of everything else, with the frame comfortably inside its budget.
    // (the line is the REAL one -- and the lower of the two: the tuned budget this device was given, and the
    //  ordinary sixty-a-second one. A phone drawing the oil look is given a budget of thirty a second, because the
    //  project's ruling is that a slow device keeps a sharp picture and loses pictures a second; but SHARPENING
    //  must never be what spends that. It only ever spends room a device has ABOVE sixty, and never trades
    //  smoothness for sharpness. It is also not the budget stretched to a cap the device has settled for. A
    //  machine held at 30 a second by its display or its own slowness shows the same frame time however much
    //  picture it draws, right up to the point where it drops to 20 -- so judged against the stretched budget it
    //  would climb the whole ladder for free and fall off a cliff the moment anything else happened. A device that
    //  has settled for less than sixty a second is not given more to draw: found by the test beside this file.)
    // (and after a few rungs have failed the ladder is left alone until the next rest(). A rung too far costs a
    //  blink of 30 a second while it is tried, and a device that has refused three times is a device whose answer
    //  is no: trying it again every minute for an hour is worse than a slightly softer picture.)
    const sLow = T.sharpLowMs > 0 ? T.sharpLowMs : Math.min(T.highMs, DYNRES.highMs);
    const sTop = this.sharpTier != null ? this.sharpTier : this.maxQuality;
    if (this.sharp < this.sharpMax && this.sharpFails < T.sharpGiveUp
        && this.scale >= T.maxScale - 1e-6 && this.quality >= sTop
        && this.over === 0 && !this.probing && ms <= sLow) {
      this.sharpSteady += dt;
      if (this.sharpSteady >= T.sharpUpAfter * this.sharpBackoff) {
        this.sharp++; this.sharpChanges++;
        this.sharpSteady = 0; this.sinceSharp = 0; this.sharpProbing = true;
        this.steady = 0; this.under = 0;
        return { scale: this.scale, quality: this.quality, sharp: this.sharp, changed: true };
      }
    } else this.sharpSteady = 0;

    // ---- down: fast ---------------------------------------------------------------------------
    const tierDown = () => {
      // If the last tier-up did not hold, wait much longer before trying again.
      if (this.sinceTierUp < 60) this.upPenalty = Math.min(T.tierPenaltyMax, this.upPenalty * 3);
      this.quality--; this.tierChanges++;
      this.atMin = 0; this.atMax = 0;
      this.downCooldown = T.tierDownCooldown; this.upCooldown = T.tierUpCooldown;
    };
    if (ms > B.panic && slowN >= 3) {
      // What the smallest picture of this tier would cost, if cost goes with pixels.
      const floor = ms * (T.minScale / this.scale) ** 2;
      if (this.probing) {
        // The step up on trial is what broke: take back just that, and try less often.
        this.scale = Math.max(T.minScale, this.scale - T.stepUp);
        this.probeBackoff = Math.min(T.probeBackoffMax, this.probeBackoff * 2);
        this.sinceUp = Infinity; this.probing = false;
      } else if (floor > B.panic && this.quality > this.minQuality && this.downCooldown === 0) {
        tierDown();
        this.scale = T.minScale;
      } else if (this.scale > T.minScale) {
        this.scale = Math.max(T.minScale, Math.min(this.scale - T.stepDown * 2.5, this.scale * Math.sqrt(B.target / ms)));
      }
      if (this.scale !== scale0 || this.quality !== quality0) {
        this.over = 0; this.steady = 0;
        this.ema = Math.min(this.ema, B.panic);      // let the new setting prove itself
      }
    } else if (this.over >= T.downAfter && this.scale > T.minScale) {
      if (this.sinceUp < T.probeWindow) {
        // The step up we just tried does not hold: take it back, and try less often.
        this.scale = Math.max(T.minScale, this.scale - T.stepUp);
        this.probeBackoff = Math.min(T.probeBackoffMax, this.probeBackoff * 2);
        this.sinceUp = Infinity; this.probing = false;
      } else {
        // Scale the step by how far over budget we are.
        this.scale = Math.max(T.minScale, this.scale - T.stepDown * Math.min(3, ms / B.target));
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
    const pinnedLow = this.scale <= T.minScale + 1e-6 && ms > B.high;
    const pinnedHigh = this.scale >= T.maxScale - 1e-6 && this.over === 0 && ms < B.high;
    this.atMin = pinnedLow ? this.atMin + dt : 0;
    this.atMax = pinnedHigh ? this.atMax + dt * (ms < B.tierUp ? 2 : 1) : 0;
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
    const changed = this.scale !== scale0 || this.quality !== quality0 || this.sharp !== sharp0;
    if (changed) this.changes++;
    if ((this.scale < scale0 - 1e-9 || this.quality < quality0) && !this.descent) this.descent = { avg: this.avg, scale: scale0, quality: quality0, t: 0 };
    return { scale: this.scale, quality: this.quality, sharp: this.sharp, changed };
  }
}
