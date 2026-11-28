// ?glerr=1: AN ON-SCREEN REPORT OF WHAT THE GRAPHICS CHIP REFUSED (the coordinator, 24 Nov, after the owner's phone
// drew no ground at the top tier while every desktop and software GPU drew it). A phone cannot show its console, so
// this lays the facts on the page itself, to be photographed: every shader program that failed (its name and the first
// lines of the driver's own words), the GL error codes raised while playing (counted each second), a lost context, a
// mesh of the ground whose vertex data is shorter than its triangles ask for (WebGL then refuses to draw it), the
// materials whose program would not run, and this chip's limits. Loaded only with ?glerr=1; without it nothing of this
// file is fetched. main.js sets the shader hook itself, before the first compile, and hands the list here.

import { BUILD } from './build.js';

const CODES = { 0x0500: 'INVALID_ENUM', 0x0501: 'INVALID_VALUE', 0x0502: 'INVALID_OPERATION', 0x0505: 'OUT_OF_MEMORY', 0x0506: 'INVALID_FRAMEBUFFER_OPERATION', 0x9242: 'CONTEXT_LOST' };

export function startGlErr(renderer, scene, store) {
  const gl = renderer.getContext();
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;right:6px;top:6px;max-width:62vw;max-height:70vh;overflow:auto;z-index:9999;'
    + 'background:rgba(0,0,0,.78);color:#fff;font:10px/1.25 monospace;padding:6px 8px;border-radius:6px;white-space:pre-wrap;pointer-events:auto';
  document.body.appendChild(box);
  const errs = {};
  let lost = 0;
  renderer.domElement.addEventListener('webglcontextlost', () => { lost++; });
  const lim = (() => {
    try {
      const e = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        gpu: e ? String(gl.getParameter(e.UNMASKED_RENDERER_WEBGL)).slice(0, 60) : '?',
        fragVec: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS), vertVec: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
        vary: gl.getParameter(gl.MAX_VARYING_VECTORS), attr: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
        tex: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS), vtex: gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS),
        texSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
        floatLinear: !!gl.getExtension('OES_texture_float_linear'), colorFloat: !!gl.getExtension('EXT_color_buffer_float'),
      };
    } catch (e) { return { err: String(e) }; }
  })();
  // a ground mesh whose vertex data is shorter than its triangles ask for: WebGL refuses the whole draw
  const short = new Map();
  const checkGround = () => {
    let n = 0, vis = 0;
    const bad = [];
    scene.traverse((o) => {
      const m = o.material;
      if (!o.isMesh || !m || !m.userData || !m.userData.pcMake || m.userData.pcMake.kind !== 'terrain') return;
      n++; if (o.visible) vis++;
      const g = o.geometry;
      if (!g || short.has(g)) { if (short.get(g)) bad.push(short.get(g)); return; }
      let need = 0;
      if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i++) if (a[i] > need) need = a[i]; need += 1; } else if (g.attributes.position) need = g.attributes.position.count;
      let msg = '';
      for (const k in g.attributes) { const c = g.attributes[k].count; if (c < need) msg += k + ' ' + c + '<' + need + ' '; }
      short.set(g, msg);
      if (msg) bad.push(msg);
    });
    return { n, vis, bad };
  };
  const notRunnable = () => {
    const out = [];
    const mats = window.__pcMaterials;
    if (!mats) return out;
    for (const m of mats) {
      const p = renderer.properties.get(m);
      const pr = p && p.currentProgram;
      if (pr && pr.diagnostics && pr.diagnostics.runnable === false) out.push((m.userData.pcMake && m.userData.pcMake.kind) || m.name || m.type);
    }
    return out;
  };
  let t = 0;
  const draw = () => {
    t++;
    for (let i = 0; i < 8; i++) { const e = gl.getError(); if (!e) break; errs[e] = (errs[e] || 0) + 1; }
    const info = (window.__pc && window.__pc.info) ? (() => { try { return window.__pc.info(); } catch (e) { return {}; } })() : {};
    const gr = checkGround();
    const nr = notRunnable();
    let s = 'GLERR ' + BUILD + '  t ' + t + ' s  tier ' + info.quality + ' scale ' + (info.scale != null ? (+info.scale).toFixed(2) : '?')
      + '  canvas ' + renderer.domElement.width + 'x' + renderer.domElement.height + '\n';
    s += 'gpu ' + lim.gpu + '\nlimits frag ' + lim.fragVec + ' vert ' + lim.vertVec + ' vary ' + lim.vary + ' attr ' + lim.attr + ' tex ' + lim.tex + '/' + lim.vtex
      + ' size ' + lim.texSize + ' floatLinear ' + lim.floatLinear + ' colorFloat ' + lim.colorFloat + '\n';
    s += 'context lost ' + lost + '   gl errors ' + (Object.keys(errs).length ? Object.entries(errs).map(([k, v]) => (CODES[k] || k) + ' x' + v).join(', ') : 'none') + '\n';
    s += 'ground meshes ' + gr.n + ' (visible ' + gr.vis + ')' + (gr.bad.length ? '  SHORT DATA: ' + gr.bad.slice(0, 3).join(' | ') : '  data ok') + '\n';
    s += 'programs not runnable: ' + (nr.length ? nr.join(', ') : 'none') + '\n';
    const gg = window.__pcGroundGuard;
    s += 'ground guard: ' + (gg ? (gg.dropped.length ? 'TOOK OUT ' + gg.dropped.join(', ') : 'nothing taken out') + (gg.gaveUp ? '  GAVE UP' : '') + (gg.why ? '\n  why: ' + gg.why : '') : 'not loaded') + '\n';
    s += 'shader failures: ' + (store.shader.length ? '' : 'none') + '\n';
    for (const f of store.shader.slice(0, 4)) s += '- ' + f.name + '\n  ' + (f.prog || '').slice(0, 300) + '\n  vs: ' + (f.vs || '').slice(0, 300) + '\n  fs: ' + (f.fs || '').slice(0, 400) + '\n';
    box.textContent = s;
  };
  setInterval(draw, 1000);
  draw();
}
