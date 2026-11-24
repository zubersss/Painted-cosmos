// All sound, made in code with WebAudio: no audio files. A wind bed that follows the real wind
// and thins to silence in space, rain, thunder with its true delay, the ship's voice, the
// jetpack, footsteps on the stride, soft pads per planet with long silences, and paper and
// brush sounds for the interface. Every gain moves on a ramp (no clicks); nothing loops in
// less than the life of a noise buffer played at a wandering rate.
const PAD_ROOT = { mercury: 98, venus: 110, earth: 130.8, moon: 146.8, mars: 116.5, jupiter: 87.3, saturn: 103.8, uranus: 155.6, neptune: 138.6, pluto: 164.8 };
const PAD_CHORD = { mercury: [1, 1.5, 2.25], venus: [1, 1.26, 1.5], earth: [1, 1.25, 1.5, 1.875], moon: [1, 1.5, 2], mars: [1, 1.2, 1.5], jupiter: [1, 1.335, 1.5], saturn: [1, 1.25, 1.682], uranus: [1, 1.122, 1.5], neptune: [1, 1.189, 1.782], pluto: [1, 1.5, 1.782] };

// (group D, the weather, behind ?stormland=1 or ?wx2=1 -- read from the address here and not imported, so this file never
//  needs the weather's modules: the coordinator's ruling of 24 Nov gave group D this one piece of PILOT's file. THUNDER
//  BY DISTANCE: a near bolt CRACKS -- a split-second rip of high noise, then the boom -- and a far one only ROLLS, low,
//  long and in several waves, as the sound comes back from the length of the channel; under leaves a little quieter, in
//  the ship or under its hull muffled and quieter. The delay after the flash is the physics' (weather.js lightningFor:
//  distance over the speed of sound of the air); the bang plays when its count-down crosses zero, as before. Without
//  the switch the thunder is exactly what it was.)
const STORM_AUDIO = (() => {
  if (typeof location === 'undefined' || !location || !location.search) return false;
  const q = new URLSearchParams(location.search), on = (k) => q.has(k) && q.get(k) !== '0' && q.get(k) !== 'false';
  return on('stormland') || on('wx2');
})();
export const THUNDER = Object.freeze({
  near: 450,        // m: within this a bolt cracks
  far: 1600,        // m: beyond this it only rolls
  sound: 340,       // m/s: the speed of sound the physics uses near the ground (for the plan's own length only)
});
// The distance of a flash from the loudness its thunder arrives with (weather.js lightningFor: thunder01 = 1 / (1 + d / 900)
// at the moment of arrival, then falling over seconds): the game hands the audio thunderIn and thunder01, not the distance.
export function thunderDistance(thunder01) { return 900 * (1 / Math.max(0.02, Math.min(1, thunder01)) - 1); }
// What one thunderclap is, as layers of filtered noise: [{ at (s after the bang), type, freq, q, level, decay, attack }].
// dist: m; cover01: leaves overhead; roof: in the ship or under its hull; seed: 0..1, so no two are alike.
export function thunderPlan(dist, cover01 = 0, roof = false, seed = 0.5) {
  const near = 1 - Math.min(1, Math.max(0, (dist - THUNDER.near * 0.5) / (THUNDER.far - THUNDER.near * 0.5)));   // 1 near .. 0 far
  const loud = 1 / (1 + dist / 900);
  const k = (1 - 0.25 * Math.min(1, cover01)) * (roof ? 0.55 : 1);
  const L = [];
  const h = (i) => { const x = Math.sin((seed * 97.13 + i * 13.7) * 12.9898) * 43758.5453; return x - Math.floor(x); };
  if (dist < THUNDER.near && !roof) {
    // the crack: a rip of high noise, the channel overhead tearing, then a slap
    L.push({ at: 0, type: 'highpass', freq: 1800 + 900 * h(1), q: 0.4, level: 0.22 * loud * k, decay: 0.16, attack: 0.004 });
    L.push({ at: 0.02, type: 'bandpass', freq: 520 + 260 * h(2), q: 0.7, level: 0.2 * loud * k, decay: 0.45, attack: 0.006 });
  } else if (dist < THUNDER.far) {
    // a clap, already softened by the air between
    L.push({ at: 0, type: 'bandpass', freq: (roof ? 180 : 300) + 120 * h(3), q: 0.6, level: 0.12 * loud * k * near, decay: 0.7, attack: 0.02 });
  }
  // the boom and the roll: low, longer and slower to swell the further off; two to four waves
  const waves = 2 + Math.round(2 * (1 - near) * h(4) + (1 - near));
  let at = near > 0.5 ? 0.03 : 0.1 + 0.3 * h(5);
  for (let i = 0; i < waves; i++) {
    const lp = (roof ? 70 : 85 + 70 * near) * (0.85 + 0.3 * h(10 + i));
    L.push({ at, type: 'lowpass', freq: lp, q: 0.4, level: (i === 0 ? 0.5 : 0.34 * (1 - 0.25 * i)) * loud * k, decay: 1.6 + 2.6 * (1 - near) + 0.8 * h(20 + i), attack: 0.03 + 0.5 * (1 - near) });
    at += 0.5 + 1.1 * (1 - near) * (0.6 + 0.8 * h(30 + i));
  }
  return L;
}
// Whether the bang is due this frame: the count-down crossed zero since the last frame (or, first seen, has just passed).
// maxLate (s, the storm switch: 0.5): a crossing found later than this is not a bang (a jump of the count-down from one
// storm's to another's), and is not played late.
export function thunderDue(prevThunderIn, thunderIn, maxLate = Infinity) {
  return thunderIn != null && thunderIn <= 0 && (prevThunderIn == null ? thunderIn > -0.3 : prevThunderIn > 0 && thunderIn > -maxLate);
}

// createAudio({ enabled, context }): `context` (optional) is an AudioContext to build the graph
// in, e.g. an OfflineAudioContext: tests/audiocheck.mjs renders each situation through this
// very graph and measures it (levels, clipping, DC, spectrum, steadiness, clicks).
export function createAudio({ enabled = true, context = null } = {}) {
  let ctx = null, master = null, ready = false;
  const node = {};
  let stepPhase = 0, padBody = null, padGain = 0, padClock = 0, lastThunder = -1e9, lastState = null;
  let prevThunderIn = null, dripClock = 0;
  const set = (param, v, tc = 0.08) => { if (param) param.setTargetAtTime(v, ctx.currentTime, tc); };

  function noiseBuffer(seconds, tilt) {
    const n = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    let b = 0, seed = 22222;
    for (let i = 0; i < n; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
      const w = (seed >>> 0) / 2147483648 - 1;
      b = b * tilt + w * (1 - tilt);                    // tilt toward low frequencies
      d[i] = b * (1 + tilt * 6);
    }
    // A seamless loop: the tail is cross-faded (equal power) into the head, and the loop ends
    // where the tail began. No dip and no step at the loop point.
    const f = Math.floor(ctx.sampleRate * 0.5);
    for (let i = 0; i < f; i++) {
      const k = i / f;
      d[i] = d[i] * Math.sqrt(k) + d[n - f + i] * Math.sqrt(1 - k);
    }
    buf._loopEnd = (n - f) / ctx.sampleRate;
    return buf;
  }
  function noiseVoice(buf, type, freq, q) {
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.loopStart = 0; src.loopEnd = buf._loopEnd;
    const filt = ctx.createBiquadFilter(); filt.type = type; filt.frequency.value = freq; filt.Q.value = q;
    const gain = ctx.createGain(); gain.gain.value = 0;
    src.connect(filt).connect(gain).connect(master); src.start();
    return { src, filt, gain };
  }
  // (group D) a burst `at` seconds from now with its own swell (thunder's layers)
  function burstAt(at, freq, q, level, decay, type, attack) {
    if (!ready || !(level > 0.0005)) return;
    const src = ctx.createBufferSource(); src.buffer = node.white;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const filt = ctx.createBiquadFilter(); filt.type = type; filt.frequency.value = freq; filt.Q.value = q;
    const g = ctx.createGain(); const t = ctx.currentTime + Math.max(0, at);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    src.connect(filt).connect(g).connect(master);
    src.start(t, Math.random() * 2); src.stop(t + attack + decay + 0.05);
  }
  function burst(freq, q, level, decay, type = 'bandpass') {
    if (!ready) return;
    const src = ctx.createBufferSource(); src.buffer = node.white;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const filt = ctx.createBiquadFilter(); filt.type = type; filt.frequency.value = freq; filt.Q.value = q;
    const g = ctx.createGain(); const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    src.connect(filt).connect(g).connect(master);
    src.start(t, Math.random() * 2); src.stop(t + decay + 0.05);
  }
  // One footfall, by what is underfoot (PHYSICS' ground material): soft on grass and litter, a
  // crunch on loose grains and snow, a tap on rock, ice and glass, a squelch in mud, a splash.
  // `loud` (about 0.5 to 1.25) is the footfall's force over the body's weight (PHYSICS' gait).
  function footstep(material, loud = 1) {
    const m = material || 'grass', j = 0.85 + Math.random() * 0.3, L = loud;
    if (m === 'water') { burst(900 * j, 0.7, 0.3 * L, 0.24); return; }
    if (m === 'sand' || m === 'dust' || m === 'ash' || m === 'snow' || m === 'gravel') { burst(1700 * j, 0.6, 0.2 * L, 0.17); burst(300 * j, 1, 0.16 * L, 0.09); return; }
    if (m === 'rock' || m === 'ice' || m === 'glass' || m === 'crystal') { burst(720 * j, 2.2, 0.4 * L, 0.07); return; }
    if (m === 'mud' || m === 'bed') { burst(230 * j, 1.4, 0.46 * L, 0.16); return; }
    burst(340 * j, 1.1, 0.4 * L, 0.12);                       // grass, soil, litter, moss
  }
  // A drop falling from a leaf: a short, pitched tick.
  function drip() {
    if (!ready) return;
    const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime, f0 = 900 + Math.random() * 1500;
    o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 1.7, t + 0.05);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05 + Math.random() * 0.06, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(g).connect(master); o.start(t); o.stop(t + 0.09);
  }

  // start(gesture): `gesture` is true only when called from inside a click, tap or key press
  // (main.js listens for them). Browsers let a page start sound only there: a context made or
  // resumed anywhere else stays suspended (Safari for the whole session, Chrome when the only
  // input is a gamepad) and Chrome warns at every try. So the context is made, and resumed,
  // only inside a gesture; never from the frame loop. A given `context` (tests) needs none.
  let hidden = false, faded = false;
  function start(gesture = false) {
    if (!enabled) return;
    if (ctx) {
      if (gesture && !hidden && !context && ctx.state === 'suspended') ctx.resume().then(unfade, () => {});
      return;
    }
    if (!gesture && !context) return;
    try {
      const AC = context ? null : window.AudioContext || window.webkitAudioContext;
      if (!context && !AC) return;
      ctx = context || new AC();
      if (!context && ctx.state === 'suspended') ctx.resume().catch(() => {});   // older WebKit makes it suspended even in a gesture
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      master = ctx.createGain(); master.gain.value = 0;
      master.connect(comp).connect(ctx.destination);
      master.gain.setTargetAtTime(0.75, ctx.currentTime, 1.5);            // fade the world in
      node.white = noiseBuffer(11, 0);
      node.soft = noiseBuffer(17, 0.92);
      node.wind = noiseVoice(node.soft, 'bandpass', 420, 0.6);
      node.wind2 = noiseVoice(node.soft, 'bandpass', 1300, 1.4); node.wind2.src.playbackRate.value = 0.83;
      // Rain: a bright hiss (drops on leaves and in the air), a soft body (drops on the ground),
      // and a low drumming for rain on the hull overhead.
      node.rain = noiseVoice(node.white, 'highpass', 1900, 0.3);
      node.rainLow = noiseVoice(node.soft, 'bandpass', 700, 0.4); node.rainLow.src.playbackRate.value = 1.31;
      node.rainHull = noiseVoice(node.white, 'bandpass', 330, 1.3); node.rainHull.src.playbackRate.value = 0.71;
      // What the wind carries over the ground (PHYSICS' here.blown): a dry hiss of sand or
      // snow, and the wash of surf and spume where the player stands by a breaking sea.
      node.hiss = noiseVoice(node.white, 'bandpass', 5200, 0.8); node.hiss.src.playbackRate.value = 1.17;
      node.surf = noiseVoice(node.soft, 'lowpass', 520, 0.5); node.surf.src.playbackRate.value = 0.83;
      node.jet = noiseVoice(node.white, 'bandpass', 900, 0.9);
      node.rush = noiseVoice(node.white, 'bandpass', 700, 0.5);           // air over the hull
      // The ship: two soft oscillators a fifth apart through a low-pass, and a whine for the pulse.
      node.shipGain = ctx.createGain(); node.shipGain.gain.value = 0;
      node.shipFilt = ctx.createBiquadFilter(); node.shipFilt.type = 'lowpass'; node.shipFilt.frequency.value = 300;
      node.shipA = ctx.createOscillator(); node.shipA.type = 'sawtooth'; node.shipA.frequency.value = 55;
      node.shipB = ctx.createOscillator(); node.shipB.type = 'triangle'; node.shipB.frequency.value = 82.5;
      node.shipA.connect(node.shipFilt); node.shipB.connect(node.shipFilt);
      node.shipFilt.connect(node.shipGain).connect(master); node.shipA.start(); node.shipB.start();
      // The pad: up to four sines, retuned when the planet changes.
      node.padGain = ctx.createGain(); node.padGain.gain.value = 0; node.padGain.connect(master);
      node.pad = [0, 1, 2, 3].map((i) => {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 130 * (1 + i * 0.25);
        const g = ctx.createGain(); g.gain.value = 0.25 / (1 + i * 0.6);
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + i * 0.017; const lg = ctx.createGain(); lg.gain.value = 0.12;
        lfo.connect(lg).connect(g.gain); lfo.start();
        o.connect(g).connect(node.padGain); o.start();
        return o;
      });
      ready = true;
    } catch { ctx = null; ready = false; }
  }

  // s: { state, onFoot, inShip, speed, grounded, jet01, throttle01, pulse01, inSpace01, altitude01,
  //      bodyId, wind (m/s), gust01, airless, submerged, material (ground underfoot, PHYSICS' name),
  //      blown ({ sand, snow, spume, surf }, each 0..1: PHYSICS' here.blown, or null),
  //      rain01 (PHYSICS' sky.rain: liquid falling, 0..1), canopy01 (leaves overhead), dripping
  //      (0..1: the soaked wood dripping after rain), underHull (standing under the parked ship),
  //      thunderIn (s until the bang, negative after it, or null), thunder01 (its loudness) }
  let surfT = 0;
  function update(dt, s) {
    if (!ready) return;
    const air = s.airless ? 0 : 1 - s.inSpace01;
    // Wind: louder and brighter with speed; a parked calm is nearly silent.
    const w = Math.min(1, (s.wind || 0) / 22);
    const windLevel = air * (0.012 + 0.2 * Math.pow(w, 0.8)) * (0.75 + 0.25 * (s.gust01 || 0)) * (s.inShip ? 0.45 : 1);
    set(node.wind.gain.gain, windLevel, 0.4);
    set(node.wind.filt.frequency, 260 + 520 * w + 180 * (s.gust01 || 0), 0.5);
    set(node.wind2.gain.gain, windLevel * 0.45 * w, 0.6);
    // Rain follows what is falling (sky.rain) and what it falls on. In a wood the drops meet
    // leaves (more hiss, less ground); under the hull or inside the ship nothing lands on you:
    // the hiss is far off and the hull drums.
    const rain = air * Math.min(1, s.rain01 || 0), leaves = Math.min(1, s.canopy01 || 0);
    const roof = s.inShip || s.underHull ? 1 : 0;
    set(node.rain.gain.gain, rain * 0.1 * (0.7 + 0.35 * leaves) * (roof ? 0.3 : 1), 0.8);
    set(node.rainLow.gain.gain, rain * 0.2 * (1 - 0.5 * leaves) * (roof ? 0.45 : 1), 0.8);
    set(node.rainHull.gain.gain, rain * 0.16 * roof, 0.5);
    // Blown sand and snow hiss (snow more softly); inside the ship it is the hull that hears it.
    // The surf breathes: each wave washes in and draws back, about one in eight seconds.
    const bl = s.blown || null;
    const grit = bl ? Math.min(1, Math.max(bl.sand || 0, (bl.snow || 0) * 0.6)) : 0;
    set(node.hiss.gain.gain, air * grit * 0.07 * (0.7 + 0.3 * (s.gust01 || 0)) * (s.inShip ? 0.3 : 1), 0.6);
    set(node.hiss.filt.frequency, (bl && (bl.snow || 0) > (bl.sand || 0) ? 6400 : 4600) + 900 * (s.gust01 || 0), 0.8);
    surfT += dt;
    const wash = 0.62 + 0.38 * Math.sin(surfT * 0.79) * Math.sin(surfT * 0.79 * 0.31 + 1.3);
    const sea = bl ? Math.min(1, (bl.surf || 0) + 0.4 * (bl.spume || 0)) : 0;
    set(node.surf.gain.gain, air * sea * 0.17 * wash * (s.inShip ? 0.35 : 1), 0.9);
    set(node.surf.filt.frequency, 380 + 420 * wash + 300 * (bl ? bl.spume || 0 : 0), 0.9);
    // Drips: the wood goes on dripping after the rain, and drips under leaves while it rains.
    const drops = air * (s.onFoot ? 1 : 0) * Math.max(s.dripping || 0, rain * leaves * 0.6);
    if (drops > 0.04) {
      dripClock += dt * (0.6 + 7 * drops);
      while (dripClock >= 1) { dripClock -= 0.6 + Math.random() * 0.8; drip(); }
    } else dripClock = 0;
    // Air over the hull, by flight speed; nothing in vacuum.
    set(node.rush.gain.gain, s.inShip ? air * Math.min(0.14, s.speed / 1400) : 0, 0.3);
    set(node.rush.filt.frequency, 400 + Math.min(1600, s.speed * 6), 0.3);
    set(node.jet.gain.gain, s.onFoot ? 0.5 * (s.jet01 || 0) : 0, 0.05);
    // The ship's voice follows thrust; parked, it is a breath (measured: it was louder than a
    // calm morning). Tuned high enough that small speakers carry it (above 120 Hz).
    const parked = s.state === 'LANDED' || s.state === 'BOARDING';
    const thr = s.inShip ? Math.max(s.throttle01 || 0, 0.12) : 0;
    set(node.shipGain.gain, !s.inShip ? 0 : parked ? 0.012 : 0.05 + 0.1 * thr + 0.06 * (s.pulse01 || 0), 0.35);
    set(node.shipA.frequency, 62 + 50 * thr + 150 * (s.pulse01 || 0), 0.3);
    set(node.shipB.frequency, (62 + 50 * thr) * 1.5 + 230 * (s.pulse01 || 0), 0.3);
    set(node.shipFilt.frequency, 320 + 900 * thr + 2400 * (s.pulse01 || 0), 0.3);
    // Footsteps: on PHYSICS' footfalls when the body has a gait (each one as it lands, loud by
    // its force; a landing on both feet a little heavier); else on a stride of our own (about
    // one step per 0.75 m walked).
    if (s.footfalls) {
      if (s.onFoot && s.footfall) footstep(s.submerged ? 'water' : s.material, Math.min(1.25, s.footfall.loud * (s.footfall.foot === 2 ? 1.15 : 1)));
      stepPhase = 0.6;
    } else if (s.onFoot && s.grounded && s.speed > 0.6) {
      stepPhase += (s.speed * dt) / 0.75;
      if (stepPhase >= 1) { stepPhase -= 1; footstep(s.submerged ? 'water' : s.material); }
    } else stepPhase = 0.6;
    // Thunder, when it arrives.
    // (The count-down crossing zero is the bang, whatever the frame rate; its loudness falls
    // with distance: thunder01.)
    const due = thunderDue(prevThunderIn, s.thunderIn, STORM_AUDIO ? 0.5 : Infinity);
    prevThunderIn = s.thunderIn == null ? null : s.thunderIn;
    if (due && STORM_AUDIO && air > 0 && ctx.currentTime - lastThunder > 0.6) {
      // (group D, with the storm switch) by distance: a crack near, a long low roll far; quieter under leaves, muffled
      // in the ship or under its hull
      lastThunder = ctx.currentTime;
      const dist = thunderDistance(s.thunder01 == null ? 0.5 : s.thunder01);
      for (const l of thunderPlan(dist, s.canopy01 || 0, !!roof, Math.random())) burstAt(l.at, l.freq, l.q, l.level * air, l.decay, l.type, l.attack);
    } else if (due && !STORM_AUDIO && ctx.currentTime - lastThunder > 1.5) {
      lastThunder = ctx.currentTime;
      const loud = air * (0.25 + 0.75 * (s.thunder01 == null ? 0.7 : Math.min(1, s.thunder01))) * (roof ? 0.6 : 1);
      burst(90, 0.4, 0.5 * loud, 4.5, 'lowpass');
      burst(240, 0.5, 0.16 * loud, 1.1, 'lowpass');           // the crack on top of the roll
    }
    // The pad: fades in over half a minute on a world, breathes, and falls silent for a while.
    padClock += dt;
    if (s.bodyId !== padBody) {
      padBody = s.bodyId;
      const root = PAD_ROOT[padBody] || 120, chord = PAD_CHORD[padBody] || [1, 1.5, 2];
      node.pad.forEach((o, i) => set(o.frequency, root * (chord[i % chord.length] * (i >= chord.length ? 2 : 1)), 6));
      padClock = 0;
    }
    const breathe = 0.5 + 0.5 * Math.sin(padClock * (2 * Math.PI / 97) - 1.2);     // about 50 s on, 50 s off
    padGain = padBody ? 0.17 * Math.max(0, breathe * 1.6 - 0.6) * (s.pulse01 ? 0.4 : 1) : 0.07;
    set(node.padGain.gain, padGain, 4);
    lastState = s.state;
  }

  // One-shot sounds: 'paper' (panels), 'brush' (a prompt, a choice), 'found' (a vista), 'land', 'bounce'.
  function event(type) {
    if (!ready) return;
    if (type === 'paper') burst(3200, 0.5, 0.08, 0.28, 'highpass');
    else if (type === 'brush') burst(1500, 1.2, 0.05, 0.18);
    else if (type === 'sketch') {
      // A pencil on paper: three short strokes.
      [0, 0.13, 0.3].forEach((dly, i) => setTimeout(() => burst(2300 + i * 350, 1.6, 0.045, 0.11 + i * 0.03), dly * 1000));
    }
    else if (type === 'land') burst(120, 0.7, 0.25, 0.5, 'lowpass');
    // (the powers, ?powers=1: fired by core/powers.js when a wind is cast; never without the flag)
    else if (type === 'gust') { burst(620, 0.6, 0.2, 0.6); burst(2100, 0.5, 0.06, 0.4, 'highpass'); }
    else if (type === 'gather') { burst(480, 1.1, 0.12, 0.8); burst(1300, 0.9, 0.05, 0.5); }
    else if (type === 'quicken') burst(1100, 0.4, 0.1, 1.3);
    else if (type === 'still') burst(420, 0.5, 0.08, 1.0, 'lowpass');
    else if (type === 'whirl') { burst(240, 0.8, 0.2, 1.8, 'lowpass'); burst(860, 0.7, 0.09, 1.2); }
    else if (type === 'part') burst(700, 0.5, 0.12, 1.4);
    else if (type === 'knife') { burst(2600, 1.6, 0.14, 0.22, 'highpass'); burst(900, 1.0, 0.1, 0.3); }
    else if (type === 'timber') { burst(1500, 0.8, 0.1, 0.5); setTimeout(() => burst(105, 0.7, 0.3, 0.8, 'lowpass'), 1250); }      // a tree goes over, and lands
    else if (type === 'bounce') burst(160, 1.2, 0.2, 0.35, 'lowpass');
    else if (type === 'found') {
      [0, 0.16, 0.34].forEach((dly, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + dly;
        o.type = 'sine'; o.frequency.value = (PAD_ROOT[padBody] || 130) * [2, 2.5, 3][i];
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
        o.connect(g).connect(master); o.start(t); o.stop(t + 1.7);
      });
    }
  }

  // A hidden tab stops the frame loop, so the mixer would hold its last levels (a jetpack's
  // hiss playing on from a background tab): fade to silence and suspend; back on show.
  function pause() {
    hidden = true;
    if (!ctx || context || !master) return;
    const t = ctx.currentTime, g = master.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + 0.05);
    faded = true;
    setTimeout(() => { if (hidden && ctx.state === 'running') ctx.suspend().catch(() => {}); }, 80);
  }
  function unfade() {
    if (hidden || !faded) return;
    faded = false;
    const t = ctx.currentTime, g = master.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(0, t); g.setTargetAtTime(0.75, t, 0.25);
  }
  function resume() {
    hidden = false;
    if (!ctx || context || !master) return;
    // A page that has had a gesture may resume without one (Chrome); where it may not, the
    // next click or key press resumes it (start(true)) and the sound comes back then.
    if (ctx.state === 'suspended') ctx.resume().then(unfade, () => {}); else unfade();
  }

  return {
    start, update, event, pause, resume,
    get enabled() { return enabled; },
    get ready() { return ready; },
    get state() { return ctx ? ctx.state : 'off'; },
    debug: () => (ready ? { wind: node.wind.gain.gain.value, ship: node.shipGain.gain.value, pad: node.padGain.gain.value, rain: node.rain.gain.gain.value, rainLow: node.rainLow.gain.gain.value, rainHull: node.rainHull.gain.gain.value, hiss: node.hiss.gain.gain.value, surf: node.surf.gain.gain.value, lastState } : null),
  };
}
