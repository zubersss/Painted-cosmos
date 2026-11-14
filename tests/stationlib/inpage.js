// The station harness's helpers in the game's page (window.__st). tests/stations.mjs reads this
// file from its own tree and puts it into the page as a script, so the harness can measure a
// clean export of any commit, the baseline's included. Read-only on the game's code: it holds the
// loop, steps it, aims the camera, renders the held frame in each debug view, reads the pixels
// back (gl.readPixels), counts the work (renderer.info) and counts the post passes' texture reads
// with instrumented copies of their shaders. A port of the sharpness audit's inpage.js
// (/home/user/.pc-scratch/audit/sharp/bin/), with the plan's additions (section 5).
(function () {
  const pc = window.__pc;
  const STORM = { cloud: 1, overcast: 0.95, haze: 0.35, fog: 0.5, wet: 0.9, rain: 0.85, storm: 0.85 };   // tests/weather.mjs' forced storm sky
  const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const st = {
    cam: null,            // camera override { pitch (deg below the horizon), heading (deg from north) }
    hideShip: false,
    lowScaleSettle: 0.34, // the settle's frames are stepped at a small internal size (they are not drawn)
    pinnedScale: null,
    jitterPx: 0,          // a sub-pixel pan of the picture (the flicker index): the projection is shifted, nothing else
    washClock: 100,       // the painter's wash clock at every measured render (sway, drift): the same picture every run
    gameClock: 120,       // the game's clock at each station (s), before the hour is set: early, as the audit's stations were
                          // (its loop ran from a fresh page: 14 s at the first station). The wind moves with it: E_150_45's raw
                          // land lapvar is 522 at 120 s and at 14 s, 527 at 400 s, 555 at 900 s; the wash clock moves it 1 %.
    hud(on) { const h = document.getElementById('pc-hud'); if (h) h.style.visibility = on ? '' : 'hidden'; },
    settled() { const w = pc.world; return typeof w.isSettled === 'function' ? w.isSettled() : w.busy === 0; },
    // Step the held loop until the world has had nothing to build for `need` frames (the audit's settle: the
    // frames are not drawn, only the wash clock moves, as render() would; a generous build budget).
    settle(maxFrames = 1200, need = 6) {
      const P = pc.painter, keep = pc.dyn.scale;
      if (P.setRenderScale) P.setRenderScale(this.lowScaleSettle);
      if (pc.world.setBuildBudget) pc.world.setBuildBudget(80, { fixed: true });
      const R = P.render, self = P;
      P.render = function (s, c, dt) { if (dt > 0) self.setTime(self.getTime() + Math.min(dt, 0.1)); };
      let n = 0, i = 0;
      try { for (; i < maxFrames && n < need; i++) { pc.step(1 / 30, 1); n = this.settled() ? n + 1 : 0; } }
      finally { P.render = R; }
      if (pc.world.setBuildBudget) pc.world.setBuildBudget(5);
      if (P.setRenderScale) P.setRenderScale(this.pinnedScale != null ? this.pinnedScale : keep);
      return { frames: i, settled: n >= need };
    },
    where() {
      const s = pc.sim, i = pc.info();
      const r = (v) => v && [v.x, v.y, v.z].map((x) => Math.round(x * 1000) / 1000);
      return { body: s.bodyId, state: i.state, ex: r(s.ex.p), sh: r(s.sh.p), altGround: s.sh.altGround, view: s.viewKind, fov: pc.camera.fov,
        near: pc.camera.near, far: pc.camera.far, quality: pc.dyn.quality, scale: pc.dyn.scale,
        internal: [pc.painter.info.internalWidth, pc.painter.info.internalHeight],
        canvas: [pc.renderer.domElement.width, pc.renderer.domElement.height], t: Math.round(s.t * 1000) / 1000 };
    },
    // Put the game at a station (tests/stationlib/stations.mjs) and settle the world there.
    place(o, tier) {
      if (tier) {
        pc.painter.setQuality(tier.q); pc.painter.setRenderScale(tier.scale); pc.dyn.quality = tier.q; pc.dyn.scale = tier.scale;
        this.pinnedScale = tier.scale;
        if (pc.physics && pc.physics.setQuality) pc.physics.setQuality(tier.q);
      }
      const w = pc.world;
      if (w.setWeather) w.setWeather(o.weather === 'storm' ? STORM : {});
      if (this.gameClock != null) pc.setClock(this.gameClock);
      const d = o.where === 'spawn' ? w.getSpawn(o.body).unitDir : w.findBiome(o.body, o.where).unitDir;
      const dir = [d.x, d.y, d.z], hour = o.hour == null ? 11 : o.hour;
      if (o.foot) {
        this.cam = null; this.hideShip = false;
        const a = { body: o.body, dir, hour };
        if (o.heading != null) { a.heading = o.heading; a.lookPitch = 0; }
        pc.teleport(a);
      } else {
        pc.teleport({ body: o.body, dir, ship: true, altitude: o.alt, hour, heading: o.heading, throttle: 0 });
        pc.sim.shipCam.cockpit = true; this.hideShip = true; this.cam = { pitch: o.pitch, heading: o.heading };
      }
      const s = this.settle(1200);
      if (this.gameClock != null) pc.setHour(hour);   // the light of the hour asked, whatever game time the settle took
      const p = o.foot ? pc.sim.ex.p : pc.sim.sh.p, l = Math.hypot(p.x, p.y, p.z);
      const smp = w.sampleSurface(o.body, { x: p.x / l, y: p.y / l, z: p.z / l });
      return { s, dir, w: this.where(), heightAboveGround: l - smp.radius, biome: smp.biomeId, canopy: smp.canopyHeight };
    },
    applyCam() {
      if (!this.cam) return;
      const cam = pc.camera, V3 = cam.position.constructor, M4 = cam.matrix.constructor;
      const root = pc.world.bodies.get(pc.sim.bodyId);
      const up = new V3().copy(root.position).negate().normalize();
      let h;
      if (this.cam.heading != null) {
        const axis = new V3(0, 1, 0).applyQuaternion(root.quaternion);
        let east = new V3().crossVectors(axis, up);
        if (east.lengthSq() < 1e-8) east = new V3(1, 0, 0);
        east.normalize();
        const north = new V3().crossVectors(up, east).normalize();
        const a = this.cam.heading * Math.PI / 180;
        h = north.multiplyScalar(Math.cos(a)).addScaledVector(east, Math.sin(a)).normalize();
      } else {
        const f = new V3(0, 0, -1).applyQuaternion(cam.quaternion);
        h = f.addScaledVector(up, -f.dot(up)).normalize();
      }
      const a = this.cam.pitch * Math.PI / 180;
      const dir = h.clone().multiplyScalar(Math.cos(a)).addScaledVector(up, -Math.sin(a));
      const m = new M4().lookAt(new V3(0, 0, 0), dir, this.cam.pitch > 89.5 ? h : up);
      cam.quaternion.setFromRotationMatrix(m);
      cam.updateMatrixWorld(true);
    },
    // One render of the held frame (the whole frame: scene pass and post passes), in debug view `view`.
    render(view) {
      const P = pc.painter, cam = pc.camera;
      this.applyCam();
      const sh = pc.game.shipModel && pc.game.shipModel.object3D;
      const was = sh ? sh.visible : true;
      if (sh && this.hideShip) sh.visible = false;
      const pm = cam.projectionMatrix.elements, keep8 = pm[8];
      if (this.jitterPx) {
        // NDC x moves by -d for +d in element 8 (x_ndc = (P0 x + P8 z) / -z): the picture moves by -d W / 2 px.
        pm[8] = keep8 + (2 * this.jitterPx) / pc.renderer.domElement.width;
        cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
      }
      if (this.washClock != null) P.setTime(this.washClock);
      P.setDebugView(view | 0);
      try { P.render(pc.scene, cam, 0); }
      finally {
        P.setDebugView(0);
        if (sh) sh.visible = was;
        if (this.jitterPx) { pm[8] = keep8; cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert(); }
      }
    },
    // the canvas as RGBA bytes (row 0 at the bottom), read in the same task as the render
    read() {
      const R = pc.renderer, gl = R.getContext(), W = R.domElement.width, H = R.domElement.height;
      R.setRenderTarget(null);
      const buf = new Uint8Array(W * H * 4);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      return { W, H, buf };
    },
    // a debug view copied from the targets the last render left (no second scene pass); 5 = the abstraction pass's output
    copyView(v) {
      const post = pc.painter._post, m = post.mCopy;
      m.uniforms.uMode.value = v === 5 ? 1 : v;
      m.uniforms.tA.value = v === 5 ? post.rtAbs.texture : post.rtScene.textures[0];
      post._pass(m, null);
    },
    // the post passes only, on the scene pass already in the targets (post experiments; the loop must be held)
    postOnly() {
      const P = pc.painter, post = P._post;
      if (this.washClock != null) P.setTime(this.washClock);
      P.setDebugView(0);
      post.finish([], pc.camera);
    },
    // One full render (or the post passes only), its cost, then each view read back: { W, H, cost, px: { v: base64 RGBA } }.
    capture(views, full = true) {
      const info = pc.renderer.info, keep = info.autoReset;
      info.autoReset = false; info.reset();
      if (full) this.render(0); else this.postOnly();
      const cost = { calls: info.render.calls, triangles: info.render.triangles };
      info.autoReset = keep; info.reset();
      const px = {};
      let W = 0, H = 0;
      for (const v of views) {
        if (v !== 0) this.copyView(v);
        const r = this.read();
        W = r.W; H = r.H;
        px[v] = b64(r.buf);
      }
      this.lastCost = cost;
      return { W, H, cost, px };
    },
    // the frame's work over every pass, at the current settings
    cost() {
      const info = pc.renderer.info, keep = info.autoReset;
      info.autoReset = false; info.reset();
      this.render(0);
      const r = { calls: info.render.calls, triangles: info.render.triangles };
      info.autoReset = keep; info.reset();
      return r;
    },
    // the drawn meshes by material name (what the cost is made of): [{ name, calls, triangles }]
    inventory() {
      const by = new Map();
      pc.scene.traverseVisible((o) => {
        if (!o.isMesh && !o.isInstancedMesh) return;
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        const k = (m && (m.name || m.type)) || '?';
        const g = o.geometry, n = g ? (g.index ? g.index.count : (g.attributes.position ? g.attributes.position.count : 0)) / 3 : 0;
        const e = by.get(k) || { name: k, meshes: 0, triangles: 0 };
        e.meshes++; e.triangles += Math.round(n * (o.isInstancedMesh ? o.count : 1));
        by.set(k, e);
      });
      return [...by.values()].sort((a, b) => b.triangles - a.triangles).slice(0, 20);
    },
    // Resize the drawing buffer (the aliasing index's supersampled reference); the aspect is kept.
    size(w, h) {
      pc.painter.resize(w, h);
      pc.camera.aspect = w / h; pc.camera.updateProjectionMatrix();
      return [pc.renderer.domElement.width, pc.renderer.domElement.height];
    },
    // ---- texture reads per pixel of every post pass, counted ------------------------------------------------
    // The frame's post passes are recorded as they run (Post._pass); each is then drawn again into a scratch
    // target of its own size with a copy of its shader in which every texture read adds one to a counter, and
    // the counter is read back. The inputs are the targets as the frame left them, so a pass that skips reads
    // on some pixels is counted as it runs. (Glazes laid with the scene's camera are not post passes: not counted.)
    _tapMats: new Map(),
    instrument(m) {
      const src = m.fragmentShader;
      let im = this._tapMats.get(m);
      if (im && im.userData.src === src && im.userData.defs === JSON.stringify(m.defines || {})) return im;
      // every read is routed through a counting function of the same overloads (GLSL has no variadic macros)
      const T = ['highp sampler2D', 'highp vec2'], T3 = ['highp sampler3D', 'highp vec3'], TC = ['highp samplerCube', 'highp vec3'];
      const fn = (name, call, [smp, crd], extra, xargs) => `highp vec4 ${name}(${smp} s, ${crd} c${extra}) { pcTapN += 1.0; return ${call}(s, c${xargs}); }\n`;
      let head = 'float pcTapN = 0.0;\n';
      for (const t of [T, T3, TC]) {
        head += fn('pcTapTex', 'texture', t, '', '') + fn('pcTapTex', 'texture', t, ', float b', ', b') + fn('pcTapLod', 'textureLod', t, ', float l', ', l');
      }
      head += 'highp vec4 pcTapFetch(highp sampler2D s, ivec2 c, int l) { pcTapN += 1.0; return texelFetch(s, c, l); }\n';
      head += 'highp vec4 pcTapGrad(highp sampler2D s, highp vec2 c, vec2 x, vec2 y) { pcTapN += 1.0; return textureGrad(s, c, x, y); }\n';
      const body = src.replace(/\btexture(2D)?\s*\(/g, 'pcTapTex(').replace(/\btextureLod\s*\(/g, 'pcTapLod(')
        .replace(/\btexelFetch\s*\(/g, 'pcTapFetch(').replace(/\btextureGrad\s*\(/g, 'pcTapGrad(');
      const re = /void\s+main\s*\(\s*(void)?\s*\)/;
      if (!re.test(body)) return null;
      const frag = head + body.replace(re, 'void pcTapMain()') + '\nvoid main() { pcTapMain(); gl_FragColor = vec4(pcTapN / 255.0, 0.0, 0.0, 1.0); }\n';
      im = new m.constructor({ uniforms: m.uniforms, vertexShader: m.vertexShader, fragmentShader: frag, defines: Object.assign({}, m.defines),
        depthTest: false, depthWrite: false, blending: 0, glslVersion: m.glslVersion });
      im.userData.src = src; im.userData.defs = JSON.stringify(m.defines || {});
      this._tapMats.set(m, im);
      return im;
    },
    taps(full = false) {
      const post = pc.painter._post, R = pc.renderer, rec = [];
      const orig = post._pass;
      post._pass = function (m, t) { rec.push({ m, t, w: t ? t.width : R.domElement.width, h: t ? t.height : R.domElement.height }); return orig.call(this, m, t); };
      try { if (full) this.render(0); else this.postOnly(); } finally { post._pass = orig; }
      const RT = post.rtAbs.constructor, out = [];
      for (const p of rec) {
        const name = p.m === post.mPrep ? 'prep' : p.m === post.mSheet ? 'sheet' : p.m === post.mKeep ? 'keep' : p.m === post.mBackdrop ? 'backdrop'
          : (post.mAbs && Object.values(post.mAbs).includes(p.m)) ? 'abstraction' : p.m === post.mCopy ? 'copy' : (p.m.name || 'pass' + out.length);
        const im = this.instrument(p.m);
        if (!im) { out.push({ name, w: p.w, h: p.h, mean: null }); continue; }
        const t = new RT(p.w, p.h, { depthBuffer: false, type: 1009 });
        orig.call(post, im, t);
        const buf = new Uint8Array(p.w * p.h * 4);
        R.readRenderTargetPixels(t, 0, 0, p.w, p.h, buf);
        t.dispose();
        let s = 0, mx = 0, mn = 255;
        for (let i = 0; i < buf.length; i += 4) { const v = buf[i]; s += v; if (v > mx) mx = v; if (v < mn) mn = v; }
        const n = p.w * p.h;
        out.push({ name, w: p.w, h: p.h, mean: Math.round((s / n) * 1000) / 1000, min: mn, max: mx, perFrame: s, ...(name === 'abstraction' ? { px: b64(buf) } : {}) });
      }
      R.setRenderTarget(null);
      return out;
    },
    // ---- post experiments (shader source swapped in the post passes and the scene's materials) ---------------
    mats() {
      const s = new Set();
      pc.scene.traverse((o) => { const m = o.material; if (!m) return; (Array.isArray(m) ? m : [m]).forEach((x) => s.add(x)); });
      const P = pc.painter._post;
      [P.mSheet, P.mPrep, P.mKeep].concat(Object.values(P.mAbs || {})).forEach((x) => x && s.add(x));
      return [...s];
    },
    orig: new Map(),
    patch(find, repl) {
      let n = 0;
      for (const m of this.mats()) for (const k of ['fragmentShader', 'vertexShader']) if (m[k] && m[k].includes(find)) {
        if (!this.orig.has(m)) this.orig.set(m, { fragmentShader: m.fragmentShader, vertexShader: m.vertexShader });
        m[k] = m[k].split(find).join(repl); m.needsUpdate = true; n++;
      }
      return n;
    },
    unpatchAll() {
      let n = 0;
      for (const [m, o] of this.orig) { m.fragmentShader = o.fragmentShader; m.vertexShader = o.vertexShader; m.needsUpdate = true; n++; }
      this.orig.clear();
      return n;
    },
    // the post uniforms an experiment may move, to put back afterwards
    postState() {
      const P = pc.painter._post, A = P.absUniforms, S = P.sheetUniforms;
      return { pig: S.uPig.value.toArray(), brush: A.uBrush.value.toArray(), abstraction: A.uAbstraction.value, border: S.uBorder.value.w };
    },
    restorePost(s) {
      const P = pc.painter._post, A = P.absUniforms, S = P.sheetUniforms;
      S.uPig.value.fromArray(s.pig); A.uBrush.value.fromArray(s.brush); A.uAbstraction.value = s.abstraction; S.uBorder.value.w = s.border;
      return this.unpatchAll();
    },
  };
  window.__st = st;
})();
