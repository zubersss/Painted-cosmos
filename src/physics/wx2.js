// Painted Cosmos physics: the switches of the second weather (group D: the planet wind map, the cloud and rain map,
// storms born from the land). OWNER: PHYSICS (group D). See docs/lead/WEATHER-DESIGN.md.
//
// THE NEW WEATHER IS THE OIL LOOK'S DEFAULT (the coordinator's flip, applied once the clouds lane passed review): in a
// page of the oil look (?look=oil, read exactly as render/shared.js LOOK.oil reads it) every switch below is on unless
// the address turns it off, and ONE opt-out, ?weather=old, gives the weather as it was at v37, to the last digit. The
// watercolour game keeps the old weather (the coordinator: the watercolour game identical) unless a switch is named.
// Where there is no page (the Node tests) every switch is off, as before, so a test sees the old weather unless it sets
// a field itself (the object is not frozen for that reason).
//   ?weather=old  the old weather: every switch below off (a piece's own switch still wins)
//   ?wx2=0        the same, as the switches' own master
//   ?windmap=1    the planet wind map (windmap.js): the land read once, wind, lift and the convection trigger each second
//   ?thermal=0    ... without the thermal winds (up the sunny slopes by day, down them at night, the lake and sea breeze)
//   ?nearmap=1    the near wind grid (air.js) takes its large-scale wind from the map instead of windLarge
//   ?farwind=1    the plants beyond the near field read the map (flora.js FloraField.far, flora.glsl.js)
//   ?cloudmap=1   the cloud and rain map of the whole world, and the rain field for the water group (cloudfield.js)
//   ?stormland=1  storms born from the land: afternoon storms at the wind map's convection sites (weather.js STORMLAND),
//                 the weather living under its own cloud top, more rain windward and less in the lee
//   ?rainlook=1   a downpour reads as one: more of the box's drops drawn the harder it rains, nearer the eye, longer
//   ?rainshaft=1  rain shafts hanging under every raining storm in view (world/storms.js; needs the cloud map)
//   ?bolts=1      lightning bolts, cloud to ground (world/storms.js; needs the cloud map)
//   ?rainmap=1    the rain box follows the map: its drops placed by the rate at its four corners (needs the cloud map)
//   ?gustbands=1  gusts seen from the air: pale bands travelling with the wind over the grass (and the far crowns);
//                 only its own switch turns it on, not ?wx2=1 (the coordinator, 24 Nov: out of the flip's defaults until
//                 the look director passes it over grass and woods)
//   ?stormswing=0 (with ?stormland) the land storms as W3.2 laid them: 1 to 3 a day, drifting with the usual wind aloft
const Q = (typeof location !== 'undefined' && location && location.search) ? new URLSearchParams(location.search) : null;
const flag = (k, d) => (Q && Q.has(k) ? Q.get(k) !== '0' && Q.get(k) !== 'false' : d);
const PAGE = typeof location !== 'undefined' && !!location;
const OLD = !!(Q && Q.get('weather') === 'old');
const OIL = !!(Q && Q.get('look') === 'oil');          // (as render/shared.js LOOK.oil; read here, never imported)
const ALL = flag('wx2', PAGE && OIL && !OLD);

export const WX2 = {
  windmap: flag('windmap', ALL),
  thermal: flag('thermal', true),
  nearmap: flag('nearmap', ALL),
  farwind: flag('farwind', ALL),
  cloudmap: flag('cloudmap', ALL),
  stormland: flag('stormland', ALL),
  rainlook: flag('rainlook', ALL),
  rainshaft: flag('rainshaft', ALL),
  bolts: flag('bolts', ALL),
  // (W3.3's last part: the rain box's drops placed by the rain map read at the box's four corners, not one rate for all)
  rainmap: flag('rainmap', false),            // (off even in the new weather: its effect is too small to see, W3.7)
  // (gusts seen from the air: bands travelling across the grass and the crowns, flora.js GUSTBAND, flora.glsl.js pcGustBand;
  //  its own switch only, never ?wx2=1 nor the flip, until the look director passes it)
  gustbands: flag('gustbands', false),
  // (with ?stormland: every site its own chance, and the wind aloft swinging from day to day; ?stormswing=0 is W3.2's)
  stormswing: flag('stormswing', true),
  // (the speed test's row 'weather: wind map frozen': the map stops refreshing, so the script's change is its cost)
  freeze: false,
};
// (the near grid and the far plants need the map: asking for either asks for it)
if (WX2.nearmap || WX2.farwind) WX2.windmap = true;
// (storms born from the land need the map's sites, and the weather's own top needs the cloud map)
if (WX2.stormland) { WX2.windmap = true; WX2.cloudmap = true; }
if (WX2.rainshaft || WX2.bolts || WX2.rainmap) WX2.cloudmap = true;
// (the clouds lane, W1: the look director's ?clouds3d=1 draws the 3D clouds, which read the cloud map and the wind map,
//  so the owner needs one switch, not three. Any value over 0 turns both maps on.)
if (Q && Q.has('clouds3d') && +Q.get('clouds3d') > 0) { WX2.cloudmap = true; WX2.windmap = true; }
