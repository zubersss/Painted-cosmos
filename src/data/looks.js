// Painted Cosmos: how every body looks. OWNER: PAINTER. Pure data (no three), safe to import in Node.
//
// The colour convention, the pigments and the helpers are in src/data/looks/common.js; each body's look
// is in its own file, src/data/looks/<body>.js. This module only assembles them and keeps the exports
// every other module has always imported from here.
export { PAPER, PIGMENTS, hexToRgb, pig, dilute, mixc, glazec } from './looks/common.js';
import earth from './looks/earth.js';
import mars from './looks/mars.js';
import saturn from './looks/saturn.js';
import mercury from './looks/mercury.js';
import venus from './looks/venus.js';
import jupiter from './looks/jupiter.js';
import uranus from './looks/uranus.js';
import neptune from './looks/neptune.js';
import moon from './looks/moon.js';
import pluto from './looks/pluto.js';

export const LOOKS = { earth, mars, saturn, mercury, venus, jupiter, uranus, neptune, moon, pluto };

export function getLook(bodyId) {
  const l = LOOKS[bodyId];
  if (!l) throw new Error('no look for body: ' + bodyId);
  return l;
}
