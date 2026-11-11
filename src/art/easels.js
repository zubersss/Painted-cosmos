// Painted Cosmos: the easels (pure data). OWNER: PAINTER.
// Where the painter stood for each biome's picture: [x, y, z (unit direction, body-local),
// yaw, pitch (degrees; yaw from local north toward east)]. Found by src/art/vantage.js, looked
// at, and kept, so the gallery's `cam=vista` and the evidence frames do not move when the
// search is tuned. A biome without an entry is searched afresh. Each is tested to stand on dry,
// gentle ground of its own biome (src/world/surface.test.mjs).
export const EASELS = {
  mercury: {
    ochre_basins: [-0.304839, 0.026022, -0.952048, 320, -1.8],
    obsidian_fields: [0.41076, 0.910351, 0.050371, 70, 1.9],
    crystal_gardens: [-0.60293, 0.211125, 0.769352, 10, 4.3],
    shadow_craters: [0.446494, 0.495912, -0.744791, 160, -9.8],
  },
  venus: {
    fungal_towers: [-0.994844, 0.077375, -0.065557, 310, 0.3],
    lava_rivers: [0.108532, 0.751264, 0.651017, 200, 5.6],
    acid_terraces: [0.756628, 0.196739, 0.623545, 270, 1.2],
    pale_mesas: [0.801522, 0.590077, -0.09681, 60, -5.5],
  },
  earth: {
    temperate_forest: [0.614656, 0.673585, 0.410465, 170, 3.1],
    autumn_woodland: [-0.419258, 0.807771, 0.414401, 30, 0.3],
    alpine_meadow: [-0.322039, -0.906303, 0.273688, 320, 14.2],
    sea_coast: [0.49112, -0.208896, -0.845673, 350, 10.2],
    desert_canyon: [-0.944083, -0.274621, 0.182457, 170, 10.4],
    misty_wetland: [0.670709, 0.343774, 0.657243, 170, 4.1],
  },
  mars: {
    rust_canyons: [0.836769, -0.175432, 0.518692, 50, 6.3],
    dust_dunes: [0.823076, 0.481217, -0.301621, 0, 1.5],
    polar_frost: [-0.227216, -0.967474, 0.111209, 350, -1.3],
    dry_riverbeds: [0.080467, 0.224142, 0.971229, 60, 5.8],
  },
  jupiter: {
    sky_islands: [0.725579, 0.687592, -0.027429, 130, -5],
    storm_wall: [0.558881, -0.330154, 0.760691, 210, 13.7],
    hanging_gardens: [-0.324317, -0.776218, 0.540652, 30, 14.9],
    lightning_plains: [0.545695, -0.135619, -0.826937, 60, -0.6],
  },
  saturn: {
    gold_islands: [0.044834, 0.164816, 0.985305, 230, -5.6],
    crystal_reeds: [0.4383, 0.724522, 0.531941, 150, 2.5],
    ring_shadow: [-0.447475, -0.032393, -0.893709, 110, 1.5],
    honey_mist: [0.76583, -0.586113, -0.26453, 290, 7.7],
  },
  uranus: {
    ice_shelves: [-0.074355, 0.902994, 0.423171, 150, 11.4],
    frozen_waves: [0.252224, 0.456036, -0.853472, 170, -1.3],
    pearl_fog: [-0.667573, 0.580857, 0.46578, 90, 2.6],
    teal_sinkholes: [0.921846, 0.054831, -0.383657, 80, 8.2],
  },
  neptune: {
    storm_seas: [-0.517691, 0.027898, -0.855113, 160, 5.3],
    kelp_forests: [0.287739, 0.957694, 0.00534, 60, 3.2],
    ice_spires: [-0.207175, 0.143826, 0.967674, 40, 8.4],
    aurora_tundra: [0.51429, 0.551752, 0.656564, 110, 1.2],
  },
};
