// All sound, made in code with WebAudio: no audio files. A wind bed that follows the real wind
// and thins to silence in space, rain, thunder with its true delay, the ship's voice, the
// jetpack, footsteps on the stride, soft pads per planet with long silences, and paper and
// brush sounds for the interface. Every gain moves on a ramp (no clicks); nothing loops in
// less than the life of a noise buffer played at a wandering rate.
const PAD_ROOT = { mercury: 98, venus: 110, earth: 130.8, moon: 146.8, mars: 116.5, jupiter: 87.3, saturn: 103.8, uranus: 155.6, neptune: 138.6, pluto: 164.8 };
const PAD_CHORD = { mercury: [1, 1.5, 2.25], venus: [1, 1.26, 1.5], earth: [1, 1.25, 1.5, 1.875], moon: [1, 1.5, 2], mars: [1, 1.2, 1.5], jupiter: [1, 1.335, 1.5], saturn: [1, 1.25, 1.682], uranus: [1, 1.122, 1.5], neptune: [1, 1.189, 1.782], pluto: [1, 1.5, 1.782] };

export function createAudio({ enabled = true } = {}) {
  let ctx = null, master = null, ready = false;
  const node = {};
  let stepPhase = 0, padBody = null, padGain = 0, padClock = 0, lastThunder = -1e9, lastState = null;
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
    // Fade the ends into each other so the loop point is silent.
    const f = Math.floor(ctx.sampleRate * 0.25);
    for (let i = 0; i < f; i++) { const k = i / f; d[i] *= k; d[n - 1 - i] *= k; }
    return buf;
  }
  function noiseVoice(buf, type, freq, q) {
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const filt = ctx.createBiquadFilter(); filt.type = type; filt.frequency.value = freq; filt.Q.value = q;
    const gain = ctx.createGain(); gain.gain.value = 0;
    src.connect(filt).connect(gain).connect(master); src.start();
    return { src, filt, gain };
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

  function start() {
    if (!enabled || ctx) { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      master = ctx.createGain(); master.gain.value = 0;
      master.connect(comp).connect(ctx.destination);
      master.gain.setTargetAtTime(0.55, ctx.currentTime, 1.5);            // fade the world in
      node.white = noiseBuffer(5, 0);
      node.soft = noiseBuffer(7, 0.92);
      node.wind = noiseVoice(node.soft, 'bandpass', 420, 0.6);
      node.wind2 = noiseVoice(node.soft, 'bandpass', 1300, 1.4); node.wind2.src.playbackRate.value = 0.83;
      node.rain = noiseVoice(node.white, 'highpass', 2600, 0.3);
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
  //      bodyId, wind (m/s), gust01, rain01, airless, thunderIn (s, or null), submerged }
  function update(dt, s) {
    if (!ready) return;
    const air = s.airless ? 0 : 1 - s.inSpace01;
    // Wind: louder and brighter with speed; a parked calm is nearly silent.
    const w = Math.min(1, (s.wind || 0) / 22);
    const windLevel = air * (0.012 + 0.2 * Math.pow(w, 0.8)) * (0.75 + 0.25 * (s.gust01 || 0)) * (s.inShip ? 0.45 : 1);
    set(node.wind.gain.gain, windLevel, 0.4);
    set(node.wind.filt.frequency, 260 + 520 * w + 180 * (s.gust01 || 0), 0.5);
    set(node.wind2.gain.gain, windLevel * 0.45 * w, 0.6);
    set(node.rain.gain.gain, air * 0.16 * (s.rain01 || 0) * (s.inShip ? 0.5 : 1), 0.8);
    // Air over the hull, by flight speed; nothing in vacuum.
    set(node.rush.gain.gain, s.inShip ? air * Math.min(0.14, s.speed / 1400) : 0, 0.3);
    set(node.rush.filt.frequency, 400 + Math.min(1600, s.speed * 6), 0.3);
    set(node.jet.gain.gain, s.onFoot ? 0.16 * (s.jet01 || 0) : 0, 0.05);
    const thr = s.inShip ? Math.max(s.throttle01 || 0, 0.12) : 0;
    set(node.shipGain.gain, s.inShip ? 0.05 + 0.1 * thr + 0.06 * (s.pulse01 || 0) : 0, 0.25);
    set(node.shipA.frequency, 46 + 34 * thr + 150 * (s.pulse01 || 0), 0.3);
    set(node.shipB.frequency, (46 + 34 * thr) * 1.5 + 230 * (s.pulse01 || 0), 0.3);
    set(node.shipFilt.frequency, 220 + 700 * thr + 2400 * (s.pulse01 || 0), 0.3);
    // Footsteps on the stride (about one step per 0.75 m walked).
    if (s.onFoot && s.grounded && s.speed > 0.6) {
      stepPhase += (s.speed * dt) / 0.75;
      if (stepPhase >= 1) { stepPhase -= 1; burst(s.submerged ? 500 : 180 + Math.random() * 90, 0.8, s.submerged ? 0.07 : 0.05, 0.16, 'lowpass'); }
    } else stepPhase = 0.6;
    // Thunder, when it arrives.
    if (s.thunderIn != null && s.thunderIn <= 0 && s.thunderIn > -0.3 && ctx.currentTime - lastThunder > 2.5) {
      lastThunder = ctx.currentTime;
      burst(90, 0.4, 0.5 * air, 4.5, 'lowpass');
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
    padGain = padBody ? 0.05 * Math.max(0, breathe * 1.6 - 0.6) * (s.pulse01 ? 0.4 : 1) : 0.02;
    set(node.padGain.gain, padGain, 4);
    lastState = s.state;
  }

  // One-shot sounds: 'paper' (panels), 'brush' (a prompt, a choice), 'found' (a vista), 'land', 'bounce'.
  function event(type) {
    if (!ready) return;
    if (type === 'paper') burst(3200, 0.5, 0.08, 0.28, 'highpass');
    else if (type === 'brush') burst(1500, 1.2, 0.05, 0.18);
    else if (type === 'land') burst(120, 0.7, 0.25, 0.5, 'lowpass');
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

  return {
    start, update, event,
    get ready() { return ready; },
    get state() { return ctx ? ctx.state : 'off'; },
    debug: () => (ready ? { wind: node.wind.gain.gain.value, ship: node.shipGain.gain.value, pad: node.padGain.gain.value, rain: node.rain.gain.gain.value, lastState } : null),
  };
}
