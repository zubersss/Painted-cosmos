// Painted Cosmos physics: the switches of the second weather (group D: the planet wind map, the cloud and rain map,
// storms born from the land). OWNER: PHYSICS (group D). See docs/lead/WEATHER-DESIGN.md.
//
// EVERY SWITCH IS OFF BY DEFAULT: with none of them in the address the physics is what it was at v37, to the last digit.
// The address is read only where there is one, guarded exactly as fauna.js reads its dials, so the Node tests see the
// defaults; a test or a page may also set the fields directly (the object is not frozen for that reason).
//   ?wx2=1        every piece of the second weather built so far (the owner's link); a piece's own switch wins
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
const Q = (typeof location !== 'undefined' && location && location.search) ? new URLSearchParams(location.search) : null;
const flag = (k, d) => (Q && Q.has(k) ? Q.get(k) !== '0' && Q.get(k) !== 'false' : d);
const ALL = flag('wx2', false);

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
  // (the speed test's row 'weather: wind map frozen': the map stops refreshing, so the script's change is its cost)
  freeze: false,
};
// (the near grid and the far plants need the map: asking for either asks for it)
if (WX2.nearmap || WX2.farwind) WX2.windmap = true;
// (storms born from the land need the map's sites, and the weather's own top needs the cloud map)
if (WX2.stormland) { WX2.windmap = true; WX2.cloudmap = true; }
if (WX2.rainshaft || WX2.bolts) WX2.cloudmap = true;
