// Distance and facing of a biome's stand (the easel) against its first vista (Node). node vistadist.mjs <root> <body> <biome>
const [root, body, biome] = process.argv.slice(2);
const surface = await import(root + '/src/world/surface.js');
const V = await import(root + '/src/core/vec.js');
const st = surface.getStandPure(body, biome), e = surface.getEaselPure ? surface.getEaselPure(body, biome) : null;
const R = surface.sampleSurfacePure(body, st.unitDir.x, st.unitDir.y, st.unitDir.z).radius;
for (const v of surface.getVistasPure(body).filter((x) => String(x.id).includes(biome))) {
  const d = Math.acos(Math.min(1, V.dot(V.norm(v.unitDir), V.norm(st.unitDir)))) * R;
  console.log(`${body} ${biome}: vista "${v.name}" (${v.id}) is ${d.toFixed(0)} m from the biome's stand; vista yaw ${v.yaw == null ? '-' : (v.yaw * 57.3).toFixed(0)}, stand yaw ${st.yaw == null ? '-' : (st.yaw * 57.3).toFixed(0)}${e && e.yaw != null ? ', easel yaw ' + (e.yaw * 57.3).toFixed(0) : ''}`);
}
