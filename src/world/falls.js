// Painted Cosmos: WATERFALLS (?falls=1): the falling sheets, their plunge pools and spray. OWNER: PAINTER (the water group,
// lane W2). docs/lead/WATER-DESIGN.md, section 3.5.
//
// LANE 0'S STUB. When filled in, this module registers its layer when it loads:
//   import { WATER_PARTS, WATER_BENCH } from './waterhooks.js';
//   WATER_PARTS.push({ name: 'falls', update(ctx) { ... } });       ctx: { st, bodyId, root, body, dt, camL, lighting }
//   WATER_BENCH.push({ name: 'no falls', view: 'shore', on: () => ..., off: () => ... });
// and builds its meshes (render/fallmat.js) under ctx.root within 1.5 km of ctx.camL.
export const FALLS_STUB = true;
