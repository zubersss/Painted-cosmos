// Painted Cosmos: RIVERS DRAWN FROM THE DRAINAGE FIELD'S OWN FLOW TREE (?rivers=tree). OWNER: PAINTER (the water group,
// lane W1). docs/lead/WATER-DESIGN.md, section 3.2.
//
// LANE 0'S STUB: the contract the hooks call. Until lane W1 fills it in, attachRivers attaches nothing and the game draws
// its rivers as before (surface.js _riversOil).
//
// THE CONTRACT.
//   attachRivers(S, drain)   build the network for surface S from its drainage field and set S.rivers = net; return net
//                            (or null: nothing attached). Called once a world by world/waterhooks.js, before its first patch.
//   net.sample(S, c)         called from surface.js _base for every sample once attached, with c.x, c.y, c.z (the unit
//                            direction) and c.L (the wood's base level) set. It MUST set, every time: c.pool (0..1, how much
//                            of a widened pool this is), c.bar (0..1, a sand bar), c.fu, c.fv (the current, a unit vector in
//                            this place's two tangent axes, the axes _riversOil uses; 0, 0 where there is no current), and
//                            may set c.still (0..1), c.swell (0..1), c.L (the base level, graded toward the river) and c.lvR
//                            (the water level, used by _forest in place of the staircase; NaN to leave it). It RETURNS the
//                            distance to the nearest water in the terms _riversOil returns it (under the nominal half width
//                            2.5 m inside a channel; beyond, metres from the water's edge), which _forest reads as c.s.
//   net.mouths               [{ end, lip, width, levelTop, levelSea, dir }]   (for world/hydro.js: a river's mouth at a coast)
//   net.lakes                [{ level, sill, out, nodes }]                    (for world/hydro.js: the basins the field fills)
// eslint-disable-next-line no-unused-vars
export function attachRivers(S, drain) { return null; }
