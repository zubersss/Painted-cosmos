// Painted Cosmos: THE WEATHER'S GUARD. OWNER: group D (the weather). A new weather program that fails to compile on a
// device must not take the picture with it: the meshes it watches are hidden for good and the game goes on with the
// sky and the land as they are without the new weather (the coordinator, 24 Nov, for the day the new weather is the
// default). Any group may use it for its own new programs (the clouds lane for its clouds).
//
// HOW: three.js compiles a program the first time a mesh is drawn with a material, and with renderer.debug's
// checkShaderErrors (on by default) a failed program carries `diagnostics.runnable === false`. The mesh's
// onBeforeRender is handed the renderer, so the program is looked at there, on the frames after the first: one property
// read a frame until it has been seen to compile, then nothing at all.
//
//   watchPrograms(mesh, name, onFail)   name: what to say in the console; onFail(name, log): called once, after the
//                                       mesh (and every mesh given the same `group`) has been hidden
//   guardFailed(name)                   whether that one has failed (for tests and the speed test)

const failed = new Set();
export function guardFailed(name) { return failed.has(name); }

export function watchPrograms(mesh, name, onFail = null, group = null) {
  let seen = false;
  const prev = mesh.onBeforeRender;
  mesh.onBeforeRender = function (renderer, scene, camera, geometry, material, grp) {
    if (prev) prev.call(this, renderer, scene, camera, geometry, material, grp);
    if (seen || !renderer || !renderer.properties) return;
    const mats = Array.isArray(material) ? material : [material];
    let all = true;
    for (const m of mats) {
      const p = renderer.properties.get(m).currentProgram;
      if (!p) { all = false; continue; }
      if (p.diagnostics && p.diagnostics.runnable === false) {
        seen = true;
        failed.add(name);
        for (const o of group || [mesh]) { o.visible = false; o.userData.pcGuardOff = true; }
        const log = (p.diagnostics.fragmentShader && p.diagnostics.fragmentShader.log) || (p.diagnostics.vertexShader && p.diagnostics.vertexShader.log) || p.diagnostics.programLog || '';
        if (typeof console !== 'undefined') console.warn(`weather guard: ${name} did not compile; it is switched off and the game goes on without it. ${String(log).slice(0, 400)}`);
        if (onFail) onFail(name, log);
        return;
      }
    }
    if (all) seen = true;            // compiled and runnable: never looked at again
  };
  return mesh;
}
