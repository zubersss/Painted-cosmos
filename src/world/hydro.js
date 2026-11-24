// Painted Cosmos: LAKES, PONDS, PUDDLES, A RIVER'S MOUTH AND FJORDS (?lakes= ?ponds= ?puddles= ?falls= ?fjord=). OWNER:
// PAINTER (the water group, lane W2). docs/lead/WATER-DESIGN.md, sections 3.1, 3.3 and 3.5.
//
// LANE 0'S STUB: the contract the hooks call. Until lane W2 fills it in, attachHydro attaches nothing and the ground is as
// it was.
//
// THE CONTRACT.
//   attachHydro(S, drain, rivers)  set S.hydro = { forest, coast } and return it (or null). Called once a world by
//                                  world/waterhooks.js, after the drainage field and the rivers, before the first patch.
//   hydro.forest(S, c, b, H)       called from surface.js _forest after the water's level is set and before the paint. H holds
//                                  the parts b.h was made of: H.L (base level), H.hb (the bed and bank), H.hill (the hills'
//                                  height before `rise`), H.rise, H.sm, H.mi (the fine relief), H.rock, H.s (distance to the
//                                  water), H.w0 (the channel's half width), so b.h = H.L + H.hb + H.hill * H.rise + H.sm + H.mi
//                                  + H.rock. It may set b.h and b.lq, and c.still, c.bank, c.cap (all 0 unless set).
//   hydro.coast(S, c, hh, T)       called from the coast recipe in surface.js _generic, after the cliff and the stacks, with
//                                  the coast's height hh; returns the new hh, and MUST set c.lqC every time: the level of river
//                                  water standing in a mouth's cut, or NaN where there is none.
// eslint-disable-next-line no-unused-vars
export function attachHydro(S, drain, rivers) { return null; }
