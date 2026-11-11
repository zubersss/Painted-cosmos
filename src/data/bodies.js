// Painted Cosmos: physical data per body.
// OWNER: PILOT. Seeded by the coordinator at bootstrap so that both sessions could start at once.
// Pilot may tune or add anything here. `id` and `radius` are read by Painter's terrain: changing
// a radius is a contract change (note it in docs/notes/pilot.md so Painter sees it).
//
// Units: metres, seconds, radians. Body-local frame: +Y is the north pole (spin axis).

export const SUN = { id: 'sun', name: 'Sun', radius: 8000 };

export const BODY_IDS = [
  'mercury', 'venus', 'earth', 'moon', 'mars',
  'jupiter', 'saturn', 'uranus', 'neptune', 'pluto',
];

// orbitRadius: distance from parent centre (the sun unless `parent` is set).
// orbitPeriod / dayLength: seconds for one revolution / one spin. orbitPhase: starting angle.
// atmosphereHeight: height above `radius` where the atmosphere ends (0 = airless feel).
// spaceAltitude (optional): overrides the ATMOSPHERE/SPACE boundary (see spaceAltitude() below);
// set on the Moon and Pluto because their painted mountains reach 250 m and more.
export const BODIES = {
  mercury: { id: 'mercury', name: 'Mercury', radius: 2200, gravity: 4.4, atmosphereHeight: 180,
    parent: null, orbitRadius: 90e3, orbitPeriod: 5400, orbitPhase: 0.6, dayLength: 2400, axialTilt: 0.02 },
  venus: { id: 'venus', name: 'Venus', radius: 3600, gravity: 8.6, atmosphereHeight: 900,
    parent: null, orbitRadius: 150e3, orbitPeriod: 9000, orbitPhase: 2.3, dayLength: 2100, axialTilt: 0.05 },
  earth: { id: 'earth', name: 'Earth', radius: 4000, gravity: 9.0, atmosphereHeight: 800,
    parent: null, orbitRadius: 220e3, orbitPeriod: 14400, orbitPhase: 0.0, dayLength: 1500, axialTilt: 0.41 },
  moon: { id: 'moon', name: 'Moon', radius: 1400, gravity: 2.2, atmosphereHeight: 0, spaceAltitude: 420,
    parent: 'earth', orbitRadius: 30e3, orbitPeriod: 3600, orbitPhase: 1.1, dayLength: 3600, axialTilt: 0.03 },
  mars: { id: 'mars', name: 'Mars', radius: 3000, gravity: 4.6, atmosphereHeight: 450,
    parent: null, orbitRadius: 300e3, orbitPeriod: 21600, orbitPhase: 4.1, dayLength: 1560, axialTilt: 0.44 },
  jupiter: { id: 'jupiter', name: 'Jupiter', radius: 5000, gravity: 11.5, atmosphereHeight: 1400,
    parent: null, orbitRadius: 460e3, orbitPeriod: 43200, orbitPhase: 5.2, dayLength: 900, axialTilt: 0.05 },
  saturn: { id: 'saturn', name: 'Saturn', radius: 4600, gravity: 9.6, atmosphereHeight: 1300,
    parent: null, orbitRadius: 640e3, orbitPeriod: 64800, orbitPhase: 1.7, dayLength: 960, axialTilt: 0.47 },
  uranus: { id: 'uranus', name: 'Uranus', radius: 4200, gravity: 8.2, atmosphereHeight: 1000,
    parent: null, orbitRadius: 820e3, orbitPeriod: 90000, orbitPhase: 3.4, dayLength: 1200, axialTilt: 1.2 },
  neptune: { id: 'neptune', name: 'Neptune', radius: 4200, gravity: 10.2, atmosphereHeight: 1000,
    parent: null, orbitRadius: 1000e3, orbitPeriod: 120000, orbitPhase: 0.9, dayLength: 1140, axialTilt: 0.49 },
  pluto: { id: 'pluto', name: 'Pluto', radius: 1600, gravity: 1.4, atmosphereHeight: 120, spaceAltitude: 420,
    parent: null, orbitRadius: 1180e3, orbitPeriod: 160000, orbitPhase: 2.8, dayLength: 3000, axialTilt: 0.3 },
};

// Height above `radius` where flight stops being "in the atmosphere" and becomes space: the
// ATMOSPHERE/SPACE boundary of the state machine and the top of the ground (co-rotating) flight
// frame. Airless bodies still get a near-surface zone so landing has room to work.
// Terrain (including floating islands) should stay below radius + 0.8 * spaceAltitude(body).
export function spaceAltitude(body) {
  return body.spaceAltitude || Math.max(body.atmosphereHeight || 0, body.radius * 0.2);
}

// Radius of the sphere inside which a ship flies in this body's own frame (it follows the body
// along its orbit). No two spheres overlap at any time (tests/orbits.test.mjs).
export function soiRadius(body) {
  return body.soiRadius || body.radius * 4;
}

export function getBody(id) {
  const b = BODIES[id];
  if (!b) throw new Error('unknown body id: ' + id);
  return b;
}
