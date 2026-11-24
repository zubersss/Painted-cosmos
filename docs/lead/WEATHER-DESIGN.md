# THE WEATHER: clouds, wind, storms and rain as one system

Group D's joint design, 24 November 2026, on branch `design-weather` (which is `look-proto`, which is the live
`main` at v37). **This is a design. No game code was changed.** Three build sessions follow it: CLOUDS, WIND, and
STORMS AND RAIN FALLING (section 8).

How to read the numbers in it:

- **MEASURED** means computed here, in Node or in the page, by the script named.
- **SEEN** means a still of this game that I took and opened. They are in `docs/shots/physics/weather-design/`.
- **PHONE COST** is *derived* from the owner's own v37 speed table (S23 Ultra, Adreno 740, picture 936 x 372 =
  348,192 pixels, tier 1, lighter paint, script 12.9 ms, 226 calls, 2,077k triangles, settled as set about 89 ms).
  The arithmetic is shown beside each one. This machine draws in software and has been wrong about the phone three
  times, so **nothing here is a phone measurement**. Every piece comes with the speed-test row that will measure it.

---

## 0. In plain words

**What is wrong today, seen and measured.**

1. **The clouds are painted on a dome behind everything.** They are one flat layer at 440 m above sea level, drawn
   last, at the back of the picture. So no cloud is ever in front of a hill. From the air there is never a cloud
   below you. The 968 m peaks never go into the cloud.
2. **The cloud layer sits inside the mountains.** With the oil look's taller peaks, 36 per cent of the alpine
   meadow's ground is above that layer, so up there the clouds simply do not exist. Measured: alpine ground median
   319 m, 95th percentile 716 m, highest 983 m.
3. **The weather is switched off above 400 to 496 m above sea level.** That is 25 per cent of the alpine meadow,
   which never gets cloud, rain or a storm. That is the opposite of what the owner asked for ("how storms would form
   over natural areas like mountains").
4. **The sky turns into outer space between 440 and 920 m above the ground.** At 1 km over the wood or the coast it
   is a black starfield at noon (SEEN, stills 07, 15, 19). The owner wants to fly "up to a mile".
5. **The whole sky is one weather.** The sky's cloud is a single number taken from the weather where you stand. A
   storm 2 km away cannot be seen. You only find out about it when it is over you. The clouds also drift one fixed
   way whatever the wind does.
6. **No storm is born from the land.** Earth's 22 weather systems are placed at random and drift with the
   prevailing wind. The one rule that grows storms from the ground needs a biome wetter than any of Earth's.
7. **Lightning has no bolt.** The whole picture just whitens. Lightning is only worked out for the storm directly
   overhead.
8. **Three things break the look's own rules.** The storm sky and the rain veil are soft, smudged noise (the
   owner's first rule is no blur). The night sky's cyan streaks are painted on top of storm clouds at dusk (SEEN,
   still 17). And near the horizon there is never a cloud: they fade out below about 11 degrees, where real clouds
   pile up.

**What is good today and is kept.** The wind's own physics is careful and real: prevailing bands, slow eddies,
gusts you can see travel across a meadow, sideways swings, the lee of trees, plants that sway at their own rates.
The weather systems are a pure function of place and time, so the weather is the same on every visit. Wetness and
fresh snow build up and dry out. The cloud's three painted tones at a low sun (still 13) are the best thing in
today's sky.

**What this design does, in one breath.** It reads the land once (heights, valleys, ridges, which slopes the sun
heats). From that it makes a **wind map** for the whole planet: wind that is funnelled down valleys, speeds over
passes, goes calm in the lee, runs up sunny slopes by day and down them at night, and lifts air where it is forced
up a mountain. The lift and the heat say where clouds build. In the afternoon, storms are born over the peaks and
hot basins, then drift with the wind over the wood or the coast. This makes a **cloud and rain map** for the whole
planet. The picture paints from that map:

- real 3D cumulus and storm towers, at real heights over the land, lit on top and shaded below, leaning in the wind;
- a cloud deck you can be under, in, or above, with the peaks standing out of it;
- streaks of high cloud;
- low cloud lying in the valleys at dawn;
- cloud shadows moving over the land;
- rain shafts hanging under distant storms, and lightning bolts;
- a rainbow after the rain.

The water group gets the rain map: how hard it rains at every place on the planet and over time. The plants get the
wind map past the 256 m they feel today, so waves of wind roll across a far forest seen from the air.

**What it costs the phone (derived, to be measured).** In fair weather about 0.8 ms of drawing and 0.5 ms of script
a frame. With a storm overhead, about 2.6 ms of drawing and 0.8 ms of script. That is out of the 33 ms target
(section 7). Every piece is behind its own switch and has a speed-test row.

**What needs a decision from others** (section 8.4). The sky must stay blue to about 3 km above the land. That is a
line in `world/index.js`, the look director's file. A handful of hook lines go into other groups' files. And
`render/kitmat.js` holds the rain's paint but is listed under the trees group.

---

## 1. Today: what the code does, and what the stills show

### 1.1 The stills (SEEN; all with `look=oil`, the painter's gallery, 960 x 540)

| still | where, when, weather | what it shows |
| --- | --- | --- |
| `01_wood_fair_ground` | autumn wood, ground, 16:30, fair | Sky a pale cream through the crowns. No cloud to be seen. |
| `02_wood_fair_150m` | autumn wood, 150 m, 16:30, fair | The whole sky is two flat gold bands, with a flat cream band at the horizon. No cloud. |
| `03_alpine_fair_ground` | alpine meadow, ground, 16:30, fair | Pale, soft-edged cloud patches, low contrast, barely there. |
| `05_alpine_building_150m` | alpine meadow, 150 m, 16:30, cloud 0.55 | **Eye 554 m above sea level, cloud layer at 440 m (MEASURED): the eye is above the clouds and they are hidden by the land.** Sky in gold bands, no cloud. |
| `06_wood_building_ground_up` | wood, by the stream, 13:00, cloud 0.55 | Clouds as marbled flat patches with lilac shadows on blue. Crisp, but no volume, no lit top, no sense of height. |
| `07_wood_building_1km` | wood, 1 km above the ground, 13:00 | **A black starfield with nebulae at noon.** The peaks wear a soft white haze. |
| `08_wood_storm_ground` | wood, storm (forced) | A closed sky of soft mottled noise blobs. No structure, and the edges are smudged. |
| `09_wood_storm_150m` | wood, 150 m, storm | The same mottled deck, with soft grey streaks below it (the rain veil). Flat grey band at the horizon. No storm cell, no tower. |
| `10_coast_rain_ground`, `11_coast_rain_150m` | coast, rain | The same deck. The sea stays a bright summer blue under it (the water group's matter). |
| `12_spawn_storm_physics_ground` | the spawn's real thunderstorm, physics on, 23.7 mm/h, 11 m/s wind | Rain as sparse thin white slanting strokes. It reads as a light shower, not a downpour. Leaves blow well. |
| `13_wood_lowsun_clouds_ground` | wood, 17:36, cloud 0.5 | The best of today: flat cloud shapes in three tones, orange-lit and lilac-shaded, crisp. Still flat, like marbled paper, with no lit top against a shaded belly. |
| `14_wood_building_420m` | wood, 420 m (eye at the cloud layer's height) | The cloud layer seen exactly edge-on: a scalloped ribbon along the top of the frame, and below it a big empty grey band down to the land. |
| `15_alpine_building_720m` | alpine meadow, 720 m above the ground | Space at noon above a smeared cloud ribbon. |
| `17_wood_storm_flash_dusk_150m` | wood, 150 m, 19:12, storm with lightning forced | **The night sky's cyan streaks painted over the storm deck.** No bolt anywhere. |
| `18_wood_building_lowsun_150m` | wood, 150 m, 16:30, cloud 0.55 | A gold mottled ceiling, then a big empty beige band down to the hills. No cloud ever near the horizon. |
| `19_coast_building_1km` | coast, 1 km | Space, and the planet's curve below. |

### 1.2 Clouds (read in `src/world/sky.js`, `src/world/index.js`, `src/world/orbit.js`)

- **One layer, one height.** The cloud shell's radius is set at `world/index.js:790` to `body.radius +
  atmosphereHeight * 0.55`. On Earth that is 440 m above the datum. It is drawn inside the full-screen sky triangle
  at the far plane (`SKY_VERT`). So it is behind every piece of land, always.
- **One cover for the whole sky**, from the eleven sky numbers at the eye (`world/index.js:789`). There is no
  cloud map.
- **Shapes from 3D noise on the shell** (`sky.js` about 444-485): two octaves, a second read toward the sun for the
  lit side, three nested tone steps, scalloped lobes, and "lanes".
  - The drift is a fixed vector, `vec3(uTime*w, 0, uTime*w*0.6)`, so every cloud on every world goes the same way
    whatever the wind does.
  - The lanes run along the fixed axis `(0.83, 0.21, -0.52)`.
- **Faded out below about 11 degrees** (`smoothstep(0.015, 0.20, e)`). Hence the empty band at the horizon in
  stills 14 and 18.
- **The storm deck** is a wash darkened by noise (`mass = dens(...)`). It has soft edges, which breaks the
  crispness rule.
- **The rain veil** is soft drags of noise low in the sky. Same problem.
- **Seen from space** there is a separate shell at `deck.height` 560 m (`orbit.js makeCloudShell`). It does not
  agree with the 440 m one.
- **The night streaks** (`sky.js` about 640-670) are weighted by `nightK = (1 - dayness) * (1 - space01) *
  smoothstep(...)`, with no cloud or overcast term. That is the bug in still 17.

### 1.3 Wind (read in `src/physics/wind.js`, `air.js`, `flora.js`, `flora.glsl.js`)

- **Large scale.** Prevailing zonal bands (Earth: 3 bands, 5.5 m/s), plus slow synoptic eddies about 0.38 of the
  planet across that change over 7 minutes (`windLarge`).
- **Gusts.** Four octaves (90, 34, 13 and 5 m) carried at exactly the wind's speed (frozen turbulence), a lateral
  part three quarters as strong, and three sub-second octaves at a point. The weights are fitted to Kaimal's
  spectra (`wind.test.mjs` holds them). This is good physics and it stays.
- **Terrain: only inside the 256 m wind grid round the player** (`AirGrid`, 17 x 17 nodes 16 m apart):
  - shelter from higher ground upwind (a 120 m search, Winstral's Sx);
  - speed-up and lee from the ground's slope (`slopeFactor`);
  - the wakes of trees.
- **Beyond 256 m there is no terrain at all.** There is no channelling down valleys, no gap wind in a pass, no
  thermal winds, and no vertical motion anywhere.
- **Plants.** `FloraField` holds bend and wind on 32 x 32 cells of 8 m (256 m). `pcPhysBend` in `flora.glsl.js`
  clamps to the edge texel, so every plant beyond 128 m reads the edge's value. The far forest leans and sways as
  one block.
- **Weather and the wind.** Cells raise the mean wind, add their own wind (`blow`), and add a gust-front outflow
  ring (`weatherWind`). This exists and is used near the player.

### 1.4 Storms and rain (read in `src/physics/weather.js`, `sky.js`, `particles.js`, `physics/three/kits.js`, `render/kitmat.js`, `render/post.js`)

- **Earth: 22 cells** of radius 500-1300 m, living 600-1500 game seconds. Each is born at a hashed latitude and
  longitude, drifts at 1.6 times the prevailing wind, and has a hashed kind (cloud, drizzle, rain, shower, storm,
  fog). The weather is a pure function of (world, seed, time).
- **Storms of a place's own making** (`ownStorm01`) only start where a biome's `moist` is over 1.2. Earth's highest
  is the misty wetland at exactly 1.2 (`physics/ground.js`), so on Earth this never fires.
- **The weather lives below `atmosphereHeight * 0.5..0.62` above the DATUM** (`weatherAt`: `below = 1 -
  smoothstep(400, 496, altitude)`, with the altitude the focus height above the base radius).
  - MEASURED over 200,000 points of Earth's oil-look ground (`heights.mjs`, below): **36.3 % of the alpine meadow
    is above 400 m and 24.7 % above 496 m**, where cloud, rain and storm are all zero.
  - Every other Earth biome is under 434 m.
- **Lightning.** `lightningFor` runs only for the strongest cell whose core covers the focus. A flash is a single
  number, `flash01`, and `post.js` turns it into a whitening of the whole picture. Thunder comes with its true delay
  (audio).
- **Rain near the player.** Particles in a box 48 m across and 18 m high round the focus. Capacity is 700 / 1600 /
  3200 by tier (the phone is tier 1: 1600). Drag gives the correct slant and lag. The marks are drawn as broad pale
  strokes "lifted" out of the background (`kitmat.js` `rain`).
- **Far rain** is the sky's soft veil, and nothing else.

### 1.5 How these numbers were measured

- **Land heights per biome.** `heights.mjs` in this session's scratch: 200,000 uniform points through
  `sampleSurfacePure` with `MODE.oil` and `overlayOil` applied.

  | biome | land height p5 / 50 / 95 / highest (m) | share above 400 m | above 496 m |
  | --- | --- | --- | --- |
  | alpine meadow | 45 / 319 / 716 / 983 | 36.3 % | 24.7 % |
  | autumn wood | 24 / 35 / 71 / 434 | 0 | 0 |
  | sea coast | 1 / 51 / 79 / 386 | 0 | 0 |
  | temperate forest | 22 / 33 / 65 / 412 | 0 | 0 |

  Without the oil overlay the alpine maximum is 506 m: the doubled peaks of 19 November are what put the meadow
  through the weather's ceiling and through the cloud layer.

- **Eye heights in the page.** At the alpine 150 m station the eye stood at 554 m above the datum over ground at
  404 m. The cloud layer was at 440 m.
- **The sky's space fraction** (`world/index.js:631`): `space01 = smoothstep(alt, 440, 920)`, where `alt` is the
  eye's height above the land under it (the mountain-air fix). So the sky is 26 % space at 600 m, 84 % at 800 m,
  and all space from 920 m.
- **CPU cost of a planet weather map** (`cost.mjs`, Node on this machine, warm).

  | per full update of the planet | 32 cells a face (6,144) | 64 a face (24,576) |
  | --- | --- | --- |
  | today's `gather` called once per texel (every cell re-derived per point) | 20.4 ms | 82-87 ms |
  | cells derived once, then distance tests per texel | **0.35 ms** | 1.25 ms |
  | `windLarge` per texel | 1.5 ms | 6.0 ms |

- **`sampleSurfacePure`**: 7.8 microseconds a call here, warm (24,576 calls in 192 ms).

---

## 2. The idea: one machine in four layers

```
 LAND (static, once per world)        heights at three scales, valleys and ridges, passes, land or water,
    |                                 which ground heats (rock and meadow more, forest less, water least)
    v
 WIND MAP (dynamic, 1 Hz)             wind at 10 m and aloft, funnelled, sped up, sheltered, thermal winds,
    |  \                              LIFT (vertical air motion) and TRIGGER (how readily convection starts)
    |   \---> plants far off (FLORA far field), water far off (roughness), near wind grid (AirGrid's base)
    v
 CLOUD AND RAIN MAP (dynamic, 2 Hz)   weather cells (today's, kept) + storms born at TRIGGER sites in the
    |  \                              afternoon + lift making cumulus over sunny slopes and ridges + rain
    |   \---> RAIN FIELD to the water group (CPU arrays, pure functions, a GPU channel)
    v
 PICTURE (per frame)                  3D cumulus and storm towers, the deck, high streaks, valley cloud,
                                      cloud shadow map, rain shafts, bolts, rainbow, the sky that stays blue
```

**A day on Earth with all of it on.**

- **Dawn:** rags of white cloud lie in the wood's hollows and along the river, where cold air drained in the night.
  This is the aerial references' "low white cloud in rags in the hollows".
- **Morning:** the rags burn off. Small flat-bottomed cumulus appear over the sunny faces of the alpine range. Over
  the sea the sky stays clear.
- **Early afternoon:** the cumulus over the peaks grow into towers that lean downwind. Their shadows cross the
  meadow.
- **Mid-afternoon:** one or two towers become thunderstorms, with an anvil spreading downwind, a dark base, rain
  shafts and lightning. The storm drifts over the autumn wood. A gust front runs ahead of it and bends the wood
  before the rain arrives.
- **Evening:** the storm decays. Its anvil stays high and catches the last sun after the ground is in shadow. On
  a planet of 4 km radius a cloud top 2 km up sees the sun until it is 48 degrees below the ground's horizon (acos
  4000/6000), which is about 3.3 game minutes after sunset. The ground is wet. If the sun comes out under the
  deck's edge with rain ahead, a rainbow appears.
- **Night:** clear and still, and cold air drains down the slopes again.

The weather stays a pure function of (world, seed, time): every visit sees the same afternoon, and the water group
can integrate rain over any past interval.

---

## 3. The vertical scale (Earth; every height is above the LAND smoothed over 1.2 km, called H2, unless said)

The planet is 4 km in radius. The player and the trees are real size; the mountains are about 1 km. Clouds at real
cumulus heights then sit just over the peaks, which is exactly what makes a mountain make weather.

| what | base | top | notes |
| --- | --- | --- | --- |
| valley cloud (radiation fog, rags in hollows) | the valley floor | 20 to 60 m over it | dawn and after rain; where H2 minus the land is negative (valleys) |
| fair cumulus | 300 m (morning) to 380 m (late afternoon) | 120 to 300 m thick | over the range H2 is 500 to 650 m, so bases reach 800 to 1,030 m above the datum: **the 983 m peaks touch them and wear caps** |
| towering cumulus | 280 m | 500 to 900 m thick | lean downwind with the shear |
| thunderstorm | 220 m | 1,600 to 2,000 m thick (tops 2,000 to 2,600 m above the datum) | anvil at the top, 1.2 to 2 km downwind; seen from most of the planet's near side |
| rain or snow deck | 180 to 260 m | 300 to 600 m thick | under a raining system |
| altocumulus | 900 to 1,200 m | thin | patches, from the sky pass |
| cirrus | 1,800 to 2,500 m | streaks | wind-aligned strokes, from the sky pass |
| **the sky stays blue** | | up to **2,800 m** above the land, space complete by 6,000 m | today 440 and 920 m |

These are dials in the data (`looks/earth.js` `weather: { ... }`, new). Each world sets its own. A world without
weather keeps today's sky exactly.

---

## 4. A. CLOUDS

### 4.1 Today and its gaps

See 1.2 and the stills. In short:

- clouds that are flat, uniform across the sky, behind everything, and in the wrong place relative to the land;
- no layers, no lit tops against shaded bellies, no cloud shadows;
- no cloud near the horizon, no change across the sky, no drift with the wind;
- soft storm decks;
- space at 1 km.

### 4.2 The change, piece by piece

**A1. The sky ceiling (the precondition for everything above 440 m).**

- The SKY's space fraction is taken from the eye's height above the land, starting at 2,800 m and complete at
  6,000 m (`?skyceil=2800,6000`; `?skyceil=0` gives today's 440/920). In the oil look only.
- This is computed in `world/index.js` (the look director's file; touch T1 in section 8.4) and handed to the sky
  as `uAtmo.x`. The aurora, the night key and the stars follow the same number.
- The ground's own air (`air01`) is the look director's and the far-view group's call. It should move on the same
  scale so the land and sky agree. The rule learned on 23 November applies: "when one half of a pair is moved onto
  a new measure, go and look at the other half".
- The orbit shell (`orbit.js`) moves to the same field (A8) and takes over above 2,800 m as the 3D clouds fade.

**A2. 3D cumulus and storm towers: real clouds over the land (new `src/world/clouds.js`).**

- **Form.** A cloud is a cluster of rounded LOBES: low-poly spheres, 80 triangles near and 20 far, each displaced a
  little by noise so no lobe is a perfect ball. They are stacked as a painter builds a cumulus:
  - a flat base;
  - a domed middle;
  - smaller lobes heaped on top;
  - for a tower, columns of lobes;
  - for a thunderstorm, an anvil of flattened lobes spread downwind at the top.
- **Drawing.** One instanced draw per level of detail. Opaque, depth-written, no discard. The lobes are sorted
  front to back by cloud, so early depth rejection works. That is the opposite of the trees' tiny cutout cards,
  which the table found to be the phone's real cost.
- **Painted, not rendered.** Each lobe's normal is blended toward the direction from its cloud's centroid. The
  whole cloud is then lit as one rounded mass, and the lobes read as bumps on it rather than as balls.

  Four flat tones with crisp borders (`fwidth`), as the sky's three are today:

  | tone | what it is |
  | --- | --- |
  | lit top | the references' neutral grey-white 0.78, with a breath of the hour's light |
  | half-tone | the sky's middle colour mixed in |
  | belly | blue-violet grey; deeper the lower in the cloud, so the base reads flat and dark |
  | rim | thin bright edges where the cloud is thin and the sun is behind it, which makes "edges catching the low sun" |

  - The borders between tones are broken by stroke-shaped dabs from the look's own stroke texture (`uStrokeTex`).
    The strokes run around the form: tangential on the dome, level along the base. Their size is held at 6 to 15
    pixels on screen, as the floor's is.
  - The sky's ceiling (`pcSkyCap`) applies, so nothing goes paper-white but the sun.
- **Placement.** Cloud slots on a planet-anchored lattice about 160 m apart, stretched along the wind into streets.
  Each slot's cloud is born, grows, lives and decays on its own clock, which is hashed from (slot, generation). It
  drifts with the wind aloft, read from the wind map at its birth.
  - Its size and height at any moment follow the cloud map where it now is. A cloud drifting over a sunny ridge
    grows; one drifting over the cold lake shrinks and dies.
  - Thunderstorms are not slots: they are the convective cells of the cloud map (C2). There are at most four
    near the eye, each built from more lobes, with an anvil and a shelf cloud along its gust front.
- **The wind on them.** Lobes are offset downwind in proportion to their height above the base, scaled by the
  shear from the wind map, so towers lean. Anvils spread downwind. Ragged scud tears off the deck in a gale.
- **Near the eye and inside.** Lobes fade out within 60 m of the camera. The share of cloud at the eye
  (`eyeInCloud01`, from the cloud map plus the nearest lobes) is handed to the look director's near air
  (`G.uAirNear`, which already does this for dust), so flying into a cloud whites out and flying out of it clears.
- **Light.** Each cloud tests whether the sun is above its own horizon (planet shadow, analytic). Tops stay lit
  after sunset at the ground. When the sun is below the cloud's level the undersides are lit orange from beneath.
  Lightning lights the lobes within 400 m of a flash from inside, at the flash's position and strength (C4).
- **What carries over from today.** The sky pass keeps the far background: altocumulus, cirrus and the pale band
  at the horizon. The 3D clouds are where a cloud must have depth.

**A3. The deck: stratiform cloud you can be under, in, or above (in `clouds.js`, a shell mesh).**

- A cube-sphere shell of 6 x 24 x 24 quads (6,912 triangles). Each vertex is set at the deck's base height from
  the cloud map (H2 plus the base). Where the map's cover is low the shell is pulled up above the visible cap and
  culled per face patch, so it costs nothing in fair weather.
- **From below.** A painted ceiling in flat tones, with rolls across the wind (stratocumulus) and crisp blue gaps
  where the cover breaks. This replaces today's soft mottled storm wash, which removes the crispness breach.
- **From above.** A lit top heaped with cumulus lobes from A2, and the peaks standing out of it: the "sea of
  cloud" of the owner's Aloft reference. It is depth-tested real geometry, so a mountain goes through it with a
  crisp line.
- Because it is drawn before the sky triangle, the sky's own (heavy) shader is skipped behind it by early depth
  rejection.

**A4. High cloud in the sky pass (`sky.js`).**

- Cirrus as long tapered strokes, the existing `pcSkyStrokes` construction, aligned to the wind aloft. The family
  axis comes from the wind map's aloft direction at the eye, so mare's tails lie the way the high wind blows.
- Altocumulus as small scalloped patches in the existing shell code, at its height. The cover comes from the cloud
  map's `mid` and `high` channels along the view ray, not one number for the sky.
- At golden hour the cirrus is lit pink and gold from below while the low cloud is already in shade.

**A5. Valley cloud.**

- Rags of white lying in hollows, flat-topped, crisp-edged, at dawn and after rain.
- Drawn as a second, low shell mesh (the deck's code at a valley-fill height of H2 minus 40 m). It shows only where
  the land is below it and the map's `valley` channel (radiation mist plus wetness, from the weather's own mist law)
  says so.
- The land cuts it with a crisp line where the slopes rise out of it.

**A6. The cloud shadow map (in `clouds.js`).**

- An orthographic render, along the sun, of the lobes and the deck into a 256 x 256 one-channel target over the
  visible cap (6 km: 23 m a texel). Every second frame.
- The look director's light model or `post.js` samples it at each pixel's world position (touch T3). The result:
  moving cloud shadows whose shapes ARE the clouds in the sky, thresholded crisply.
- Painterly rule, the look director's to tune: a cloud shadow is a cool glaze that compresses the lit values toward
  the shaded ones. It is not plain dimming.
- The same map can gate the light shafts in `post.js`, giving rays through cloud gaps at golden hour (the clip's
  shafts at kilometre scale). That is a phase-two option for the look director.

**A7. Colour by hour and weather.**

- All tones are built from the world's own keys (`uCloudShade`, `uSkyHorizon`, the storm pigment), as today's
  three are. So every world keeps its own palette and the hour still sets it.
- Weather sets the tones:

  | weather | tones |
  | --- | --- |
  | fair | white-lit, few clouds |
  | building | taller, half-tone bellies |
  | storm | indigo bellies, a sunlit flank on the tower against the dark deck |
  | clearing | broken deck, fast-moving gaps, gold under-lighting on the deck's edge |

**A8. From space.**

- `orbit.js makeCloudShell` reads the same field texture. The storms seen from orbit are the storms on the ground,
  and the 440/560 m disagreement goes away.

**A9. Rainbow (`sky.js`).**

- A flat-stroked arc 40.5 to 42.5 degrees from the antisolar point, with a faint secondary at 51 degrees.
- Only when the sun shines at the eye (no overcast there), the sun is under 42 degrees high, and the cloud map
  says rain 1.5 km along the view.
- One field look-up per sky pixel in a band.

**A10. Two small fixes in `sky.js`.**

- The night streaks take `(1 - oc) * (1 - cloud)`.
- The fade below 11 degrees is replaced by the 3D clouds and the far deck. With the sky-pass shell kept as the
  fallback, the fade drops to about 3 degrees so the horizon has a cloud bank.

### 4.3 Files, functions, data

- **New `src/world/clouds.js`:**
  - `createClouds(scene)` and `update(dt, camL, root, sun, fields, uniforms)`;
  - the lobe geometry (built in code, as `beastkit.js` builds animals);
  - the cloud material (`makeCloudMaterial`, registered for `lab.mjs swap`);
  - the deck and valley shells;
  - the shadow map render (`renderShadow(renderer)`).
- **New `src/world/wxfield.js`:** turns the physics maps into textures and shared uniforms (`WX`) at 2 Hz, and
  exports `WXFIELD_GLSL`: `pcWxField(dir)`, `pcRainAt(dir)`, `pcWindAt(dir)`, `pcCloudShadow(bodyPos)`. Every group
  that needs weather in a shader includes this one string (section 9).
- **`src/world/sky.js`:** A1 (`uAtmo.x` as handed in), A4, A9, A10. The cover becomes per view ray from
  `pcWxField`.
- **`src/world/orbit.js`:** `makeCloudShell` only (A8).
- **`src/data/looks/earth.js` (data):** `weather: { cumulus: 1, base: [300, 380], towers: 1, deck: [180, 260],
  valley: 1, ceiling: [2800, 6000] }`, with the other worlds' rows following after Earth is judged.

### 4.4 The look, and how it is judged

**Stations.** All with `look=oil` and the clouds' switches on. The address forms are in section 11.

| station | where | what it is for |
| --- | --- | --- |
| W-G | autumn wood, by the stream, pitch +18 degrees | cumulus overhead and at the horizon |
| W-150 | autumn wood, 150 m | the wood under drifting cloud shadows, a storm over the range |
| W-1K | autumn wood, 1 km | beside the cumulus tops, the deck below, the sky blue |
| A-G | alpine valley floor, facing the peaks | caps on the peaks, towers building |
| A-150 and A-1K | alpine, 150 m and 1 km | through the cloud base, the peaks out of the deck |
| C-G, C-150, C-1K | coast | clear over the sea, cumulus over land, a storm offshore at night with in-cloud lightning |

**Hours.** 07:00 (valley cloud), 13:00, 16:30 (golden), 19:12 (afterglow on the anvil), 23:00 (night: no cloud
lit as if by day).

**Weathers.** Fair, building, storm overhead, storm at a distance, clearing. Each with `physics=1&wtime=` for
real sequences, and forced for A/B.

**Measured criteria, so it is not judged by feel alone:**

1. The share of sky pixels in cloud follows the map at the eye: fair at most 25 %, building 30 to 60 %, storm
   overhead 90 % or more.
2. Each cloud carries 3 to 4 distinct value steps (a histogram of a mask of the cloud).
3. Edge width at a cloud's silhouette is at most 1.5 pixels (`tests/stations.mjs`' sharpness measure applied to a
   mask of the cloud).
4. No pixel over 0.85 except within 6 degrees of the sun (the sky cap rule).
5. In a building sky at W-150, between 50 and 100 % of the cloud cover fraction of the ground is in cloud shadow.
6. At 1 km and at 2 km the sky's top half is blue by day: its median value is within the noon keys of the ground
   station.
7. Nothing compiles with an error, and the watercolour game is bit-identical. The same render with the look off:
   0 pixels differ.

The look director reviews every still before a merge.

### 4.5 Phone cost, derived

- **Reference.** The table's ground row: removing the whole ground saves 4.8 ms. In the test's view (the spawn
  wood, held still; my still 01 is a like view) the ground is about 40 to 50 % of the 348,192 pixels. So a heavy
  painted surface costs about **24 to 34 ns per pixel**, vertex work and the near strokes included.
- **The cloud shader** does about a third of that work: two stroke reads, one noise read and banding, against the
  ground's ten-odd reads. So call it **about 8 to 10 ns per pixel**. That is an assumption, flagged.
- **Fair or building, level view.** Clouds about 15 % of the frame (stills 06 and 13) x 348k x 1.3 lobe overdraw x
  9 ns = **0.6 ms**.
- **Storm with a tower in view.** Tower plus deck about 55 % x 348k x 1.3 x 9 ns = 2.2 ms gross. The deck stands in
  front of the sky triangle, whose shader is of the ground's class, so behind the deck the sky's own cost is removed.
  **Net, I put it at 1.0 to 1.5 ms.** I cannot settle the sky's own cost: no row has ever measured the sky.
- **Vertices.** Up to about 120k triangles of large lobes, against 2,077k mostly tiny leaf triangles today. That
  is 6 % of the count. The table found the trees' cost in tiny triangles with discard, which lobes are not. At most
  0.3 ms, unknown until measured.
- **Shadow map.** Render: at most 0.1 ms (65k texels, a few thousand triangles). Sampling: one read per pixel in an
  existing pass, about 0.2 ms.
- **CPU.** The cloud slots are placed at 10 Hz (at most 400 slots, positions on a sphere), and the shader
  extrapolates the drift between updates: about 0.05 ms here, so at most 0.15 ms on the phone (assuming the phone
  three times slower than this machine's Node, which is unverified). The texture upload at 2 Hz is 2 x 6 KB.

**Budget for lane CLOUDS:** fair at most 0.6 ms GPU, storm at most 1.8 ms GPU, CPU at most 0.2 ms.

**Speed-test rows** (section 7): `weather: no clouds drawn` (fair and storm), `weather: clouds as before` (the sky
pass only), `weather: no cloud shadows`.

### 4.6 Risks

- **Lobes read as balls or as CG.** The centroid-normal blend and the stroke borders are what prevent it, and the
  first stills decide. The fallback is the sky-pass shell with per-ray cover from the map (A4), at tier 0 and
  behind `?clouds3d=0`.
- **Overdraw** when a tower fills the screen near the eye. Mitigated by the near fade and the front-to-back sort;
  the row measures it.
- **The sky ceiling** touches the night, the aurora, the limb and the climb to orbit, on every world. It is one
  switch, and each world must be looked at once.
- **A cloud field that disagrees with the sky numbers at the eye** (raining from a clear sky). The physics reads
  the same map at the focus (C5), and a test holds them together.

### 4.7 Switches

`?clouds3d=0|1|2` (2 adds towers and the shelf), `?skyceil=a,b`, `?deck=0`, `?valleycloud=0`, `?cloudshadow=0..1`,
`?rainbow=0`, `?cirrus=0`. All are inside `LOOK.oil` / `MODE.oil`. With the look off the game is untouched.

---

## 5. B. WIND

### 5.1 Today and its gaps

See 1.3. The physics at a point is excellent. **The gaps are all at the scale of the land:**

- no flow over and round ridges beyond 256 m;
- no gust in a pass, no calm in a big lee;
- no valley channelling;
- no thermal winds (up the sunny slopes by day, draining down at night);
- no lake or sea breeze;
- no vertical motion at all, so nothing can say "air is forced up here, so cloud forms here";
- far plants frozen to one block;
- clouds that ignore the wind's direction.

### 5.2 The change

**B1. The land, read once (new `src/physics/windmap.js`, static part).**

On the cube-sphere grid at 32 a face (196 m on Earth; 6,144 texels), plus a finer 64 a face height grid where the
water group's drainage field already has one (read it, do not rebuild it).

| quantity | what it is |
| --- | --- |
| `h` | mean land height of the texel (4 samples, or the drainage grid) |
| `H1`, `H2` | smoothed heights at about 400 m and 1.2 km (two passes of a 3 x 3 Gaussian on the grid, then four) |
| `relief = h - H2` | ridges and peaks positive, valleys and basins negative |
| `grad1 = grad H1` | the slope at 400 m |
| `axis` | the valley axis: the smaller-curvature eigenvector of H1's Hessian; `confine = clamp(-relief / 80 m)` |
| `saddle` | passes: relief low between two higher neighbours across one axis and lower along the other |
| `water` | share of the texel under liquid (`liquidRadius > radius`) |
| `heat` | heating capacity from the biome and cover: rock 1.0, meadow 0.9, desert 1.1, forest 0.55, wetland 0.4, water 0.1, snow 0.2 (data, per biome: `physics/ground.js` gains a `heat` column, or windmap keeps the table) |
| `sites` | the world's convection sites: local maxima of `relief x heat` over sunny-aspect slopes, plus hot basins; at most about 40 a world, each with a weight |

Cost: 6,144 x 4 = 24,576 `sampleSurfacePure` calls, MEASURED at 192 ms here when warm, or zero if the drainage grid
is there. Done under the arrival veil, as the drainage field already is (79 ms on Earth), or in background slices
of 2 ms a frame. The phone, at three times slower (unverified), needs about 0.6 s once per world.

**B2. The wind map, every second (`windmap.js`, dynamic part).** Per texel:

- `U0 = windLarge(...) x weather multiplier`. `windLarge` is evaluated on a 16 a face lattice (1,536 points) and
  interpolated. MEASURED: 1.5 ms per full 32 a face here; the lattice is a quarter of that.
- **Over and round** (Jackson and Hunt, and Winstral at the map's scale):
  - speed factor `s = 1 + 0.9 relief+/L - 0.8 lee`, where `lee` is how far the land rises upwind, along the wind,
    within 600 m;
  - in a confined valley the cross-valley part is removed: `U = U0 - confine (U0 . n) n`. The wind runs along the
    valley and speeds up where the valley narrows (`/ width ratio`, bounded at 1.6);
  - through a `saddle` aligned with the wind, add a gap jet: `x (1 + 0.6 saddle)`.
- **Thermal**, all from the global hour (the world's clock is one hour everywhere: `world/index.js sunDirection`
  builds the sun in each place's own frame), so it is pure in t:
  - anabatic up `grad1` by day, in proportion to `sun01 x heat x |grad1|`;
  - katabatic down it at night, in proportion to `(1 - dayness) x |grad1|`, gathering in valleys. That feeds the
    weather's own mist law, which is where valley cloud (A5) comes from;
  - a sea or lake breeze across the smoothed water edge: onshore by day, offshore at night.
- **Outflow.** The gust fronts of active cells, as `weatherWind` already computes them, added here so the far wood
  sees the front.
- **Vertical motion at cloud base**, `lift` in m/s:
  - orographic `U . grad H1` (the wind forced up a slope);
  - plus thermal `k sun01 heat (1 - shade)`, where `shade` is the cloud map's cover last update, so a clouded slope
    stops boiling;
  - plus convergence `-div U` (anabatic flows meeting over a ridge top; a sea-breeze front).
- **`trigger` (0 to 1)** = `smoothstep` of `lift+` times the afternoon's built-up heat (an analytic curve of the
  hour, rising from 10:00, peak 15:00, gone by 19:30), times moisture (the biome's `moist`, plus recent rain from
  the rain field).
- **Aloft wind** = `U0 x aloftFactor(z cloud)` with a tenth of the terrain terms. That is what clouds drift with,
  and `aloft - U10` is the shear that leans towers.
- **Slices.** 1/30 of the texels a frame. MEASURED basis about 0.7 ms per full update here (lattice plus per-texel
  terms), about 2.1 ms on the phone, so **about 0.07 ms a frame**.

**B3. The near grid takes its base from the map (`air.js`).**

- `AirGrid`'s 3 x 3 weather lattice (`_sup`) reads `windmap.at()` in place of `windLarge`. Near and far then
  agree.
- The grid's own shelter and slope factors stay, for scales under 400 m. The map carries 400 m and over, so
  nothing is counted twice: the map's `s` uses H1 (400 m) and the grid's shelter uses the 120 m search.

**B4. What the wind gives the plants (`physics/flora.js`, `flora.glsl.js`).**

- **New `FloraField.far`:** a planar 64 x 64 texture of 32 m texels (2,048 m across) in the same physics frame as
  today's fields, resampled from the wind map at 1 Hz.

  | channel | contents |
  | --- | --- |
  | RG | wind at canopy height (m/s, east and north) |
  | B | gust-wave amplitude (`I x U`) |
  | A | turbulence |

- **`pcPhysBend` and `pcPhysBendLite`** read the near field inside 128 m (as today) and blend to the far field
  beyond it. Out there the existing travelling wave trains (`uPhysWave`, three trains, already coherent and
  wind-carried) are scaled by the far field's local speed and amplitude.
- The result: **gust waves roll across a forest seen from the air, and the gust front of a storm bends the far wood
  as it passes.**
- **No edit in the trees' or the flora group's files**: they already call `pcPhysBend`. The look director's
  `render/shared.js` gains two uniforms in `PHYS` (touch T4).

**B5. What the wind gives the water (through `wxfield.js`).**

- The wind map's speed and direction at any point (`pcWindAt`), so the water group can paint glassy calm in a lee,
  cat's-paws where gusts touch (inside 256 m from `uPhysWind`'s gust channel, which exists), and wind lanes along
  the wind over 3 m/s on far lakes.
- The sea map's fetch stays the water group's.

**B6. What the wind gives the clouds** (lane CLOUDS reads `fields.wind.aloft` at the eye and per cloud):

- drift;
- streets along the wind;
- leaning towers and anvils;
- cirrus direction;
- lenticular clouds downwind of the range when the wind over it exceeds 12 m/s: stationary lens-shaped lobes,
  read from `relief` and the wind's speed. A landmark in high wind;
- banner clouds off the peaks.

**B7. How storms form over natural areas** (lane STORMS uses `trigger` and `sites`; section 6.2 C2):

- air forced up a mountain (orographic lift);
- heated over sunny rock and meadow (thermal);
- meeting over ridge tops (convergence).

This makes cumulus by late morning and storms in the afternoon where the land says so. Over cold water the lift is
negative, so clouds die there and the sea stays clear by day. The windward side of the range gets more rain
(orographic enhancement: rain times `1 + 0.8 lift+/1 m/s`) and the lee side less (a rain shadow).

### 5.3 Files

- **New `src/physics/windmap.js`** and `windmap.test.mjs`.
- `src/physics/wind.js`: helpers only (`aloftFactor` moves here from `air.js` if needed).
- `src/physics/air.js` (B3).
- `src/physics/atmosphere.js`: the lifting condensation level from temperature and moisture, for the cloud base;
  lapse helpers.
- `src/physics/flora.js` and `flora.glsl.js` (B4).
- `src/physics/ground.js`: the `heat` column, or a table in `windmap.js` to keep `ground.js` untouched.
- **Shared:** `src/physics/index.js` wiring (section 8.4).

### 5.4 The look, and how it is judged

The wind is judged in Node first. These are tests, each failing on today's code:

1. Along a valley the wind's direction is within 20 degrees of the axis where `confine` > 0.6.
2. Speed at the crest of the alpine range is at least 1.3 times the plain's.
3. The lee is calmer than the plain over 70 % of a ridge's lee texels.
4. By day `lift` > 0 on 70 % of sunny slopes steeper than 8 degrees; at night the flow points downhill in valleys.
5. The integral of `lift` is negative over open sea by day.
6. Near and far agree: `AirGrid` and the map within 10 % at the grid's centre.

The plants are judged in stills and, by the owner, on the phone in motion. Stills cannot show a wave:

- **W-150 and W-1K:** the far wood is no longer all leaning one way. Measure the screen-space displacement field
  of the far crowns between two frames 0.5 s apart; it must vary across the view with a wavelength of 60 to 200 m.
- A storm's gust front crossing the wood (`physics=1`, the spawn storm).

### 5.5 Phone cost, derived

- **CPU.** About 0.07 ms a frame for the map (B2). The near grid is unchanged in cost (it looks up the map where
  it called `windLarge` for 9 nodes, which is cheaper). The far flora texture: 4,096 texels resampled at 1 Hz,
  about 0.01 ms a frame. **Budget: at most 0.25 ms a frame**, the margin being for the thermal and convergence
  terms.
- **GPU.** The plants' vertex shaders read the far texture beyond 128 m where today they read the clamped edge of
  the near one, so it is one read for one read. The blend is a uniform-driven `mix` with no branch. **At most 0.1
  ms.**
- **Speed-test rows:** `weather: no far wind on plants`, and `weather: wind and cloud maps frozen`, which stops
  their updates so the script time's change is their CPU cost.

### 5.6 Risks

- **Valley axes noisy on bumpy land.** Mitigated by H1 smoothing and by `confine` gating; the tests catch it.
- **Changes to the near wind ripple into what is tuned against it:** the flora tests, `coast.mjs`' fetch judgement,
  dust and drifting snow. Behind `?windmap=0` the near grid reads `windLarge` exactly as today, and all existing
  tests run with it off by default until judged.
- **The thermal winds' timing** depends on the world's clock. A test pins the hour to t.

### 5.7 Switches

`?windmap=0|1`, `?farwind=0|1`, `?thermal=0|1`, `?lenticular=0|1`.

---

## 6. C. STORMS AND RAIN FALLING

### 6.1 Today and its gaps

See 1.4. Storms are real in the numbers but:

- invisible until overhead;
- born at random, never from the land;
- switched off above 400 to 496 m;
- no tower, no anvil, no rain shaft, no bolt;
- the near rain sparse for its rate (still 12: 23.7 mm/h reads as a light shower);
- the far rain soft (a breach of the crispness rule).

### 6.2 The change

**C1. The cloud and rain map (new `src/physics/cloudfield.js`).**

The single source of where cloud is and how hard it rains, for the whole planet. It is the 32 a face grid of the
wind map. Per texel:

| field | meaning |
| --- | --- |
| `low` | low cloud cover, 0 to 1 |
| `conv` | share of `low` that is cumuliform |
| `base`, `top` | metres above the datum |
| `mid`, `high` | altocumulus and cirrus and anvil, 0 to 1 |
| `valley` | valley cloud, 0 to 1 |
| `rain` | mm/h of liquid at the ground |
| `snow` | mm/h of water equivalent, frozen |
| `storm` | 0 to 1 |

- Made from today's cells (their cover, rate and storm, kept exactly as `gather` computes them, but derived once
  per update and then tested by distance per texel: MEASURED 0.35 ms per full update here against 20.4 ms the way
  `gather` is structured today); plus the convective cells (C2); plus `lift` from the wind map (cumulus where lift
  and moisture allow, rain enhanced on the windward side and reduced in the lee).
- **Bases** from the lifting condensation level above H2 (`atmosphere.js`). Snow where the land is high enough to
  be below freezing (`airTemperature` with the lapse rate at the land's own height), so storms on the peaks snow
  while the valleys get rain.
- **Updated at 2 Hz in slices** (1/15 of the texels a frame at 30 a second). With the extra terms, about 1 ms per
  full update here, about 3 ms on the phone (assuming three times slower), so **about 0.2 ms a frame**.

**C2. Storms born from the land (`src/physics/weather.js`).**

- Earth's random `storm` and `shower` kinds give way to **convective cells born at the wind map's `sites`**:
  - On game day d, site j fires at a time hashed from (d, j). The time lies inside its afternoon window, and the
    chance is `p_j` (the site's weight) times the day's instability, a slow hashed weather of the days, so some
    days are calm.
  - A fired site grows a cell through four stages, each a share of its life:

    | stage | share of life | what it does |
    | --- | --- | --- |
    | cumulus | 0 to 0.2 | no rain |
    | towering | 0.2 to 0.4 | showers start at the end |
    | mature thunderstorm | 0.4 to 0.75 | heavy rain, hail at the core, lightning, gust front, anvil |
    | decaying | 0.75 to 1 | light rain, anvil left, outflow fading |

  - Life 600 to 1,200 game seconds. The cell drifts with the wind ALOFT from its site, so it leaves the range and
    crosses the wood or the coast.
- **Kept pure.** Every cell is a function of (world, seed, t), so the weather is the same every visit and can be
  asked about at any time (the water group's integrals need this).
- **The other kinds stay as they are:** cloud, drizzle, rain, fog, and the slow frontal systems. They gain the
  orographic enhancement from the map.
- **The spawn's promise is kept.** The first day at the home forest is fair and the first thunderstorm crosses it
  at the second noon (`REGIMES.earth.epoch`, `weather.test.mjs`). The born-from-the-land cells skip the spawn's
  first 1,230 s, and a test holds it.
- **The ceiling goes.** `below` becomes "below this place's cloud top" from the map (C1), not "below 400 to 496 m
  above the datum". You are above the weather when you fly above the deck or the storm's top. Standing on a peak,
  you are in it.

**C3. What the storm looks like from afar** (new `src/world/storms.js`, painter side of this lane):

- **The tower** is lane CLOUDS' (A2), built from this lane's cell list (shape, top, anvil direction).
- **Rain shafts.** Under every cell with `rain` > 2 mm/h, a curtain from the base to the ground: a ring of 8 to 12
  vertical quads. They slant downwind by the ratio of the wind to the fall speed and curl at the bottom where the
  outflow pushes them.
  - Painted as many thin tapered vertical strokes, each fully opaque where it lies: dense at the core, ragged at
    the edges, in the deck's wet wash (lifted pale against dark land, deepened against bright sky).
  - The land behind shows between the strokes, never through a blur. This replaces the soft sky veil, which
    removes the crispness breach.
- **The shelf cloud** along the gust front (built by lane CLOUDS from the front's arc in the cell list): a low dark
  wedge of flattened lobes, 120 to 200 m over the land, leading the storm.

**C4. Lightning you can see.**

- **The list.** `lightningFor` runs for every mature cell within 4 km of the eye, not only the one overhead. It
  writes a list of recent and next flashes: time, ground point, base height, kind (cloud to ground, or in cloud),
  seed, distance.
- **The bolt** (`storms.js`). A crisp jagged ribbon from the cloud base to the ground: 2 to 4 pixels, tapering,
  with 1 to 3 branches, all from the flash's seed. White-violet core, no glow halo. It lives through the physics'
  existing return-stroke shape (3 to 4 strokes in a third of a second).
- **In-cloud flashes** light the lobes near the flash from inside (lane CLOUDS reads the list). At dusk a far storm
  flickers inside its anvil.
- **The scene.** The whole-picture lift in `post.js` (the look director's) becomes directional and weaker with
  distance: `flash01`'s existing distance falloff, plus the bolt's direction.
- **Thunder** keeps its true delay (`thunderIn`). The audio may play distant flashes from the list (PILOT's
  `audio.js`; optional).

**C5. The sky numbers stay the eye's.** `physics/sky.js` keeps its eleven numbers (they drive the colour keys in
`world/index.js`), computed from the exact gather at the focus as today. It gains `cloudBase`, `cloudTop` and
`inCloud01`. A test holds the map at the focus within 0.1 of the exact numbers, so the sky drawn and the light
painted cannot disagree.

**C6. Rain falling near the player (`physics/particles.js`, `physics/three/kits.js`, the rain shape in `render/kitmat.js`).**

- **Same count**: 1,600 marks at tier 1. Each mark is drawn longer, along its velocity over one game frame plus a
  painter's length (0.6 to 1.2 m). So a downpour reads as a downpour without more marks. The mark already sizes
  itself from the physics' `extinction`.
- **The box's rain follows the map.** At a shower's edge, half the box rains: the rate is read at the box's four
  corners from the map and blended across it.
- The canopy's catch, the drip after rain, and splash rings near the focus (the events ring) stay. The rings are
  the water group's to draw on water.
- **Snow, sleet and hail** follow the frozen share per place (C1). A storm on the peaks snows; in the valley it
  rains.

**C7. THE RAIN FIELD handed to the water group (exact).** See section 9.3 for the shapes.

- **On the CPU:**
  - `physics.fields.rain`: `rate` and `snow` (Float32Array, mm/h, 32 a face), refreshed at 2 Hz, with `version`
    and `t`;
  - `rainAt(bodyId, ux, uy, uz, t)`: exact at any place and time;
  - `rainBetween(bodyId, ux, uy, uz, t0, t1)`: mm that fell, the same quadrature `moistureAt` uses;
  - `throughfall(canopy01, wet01)`: the share that reaches the ground under trees (0.25 dry, 0.75 soaked, as
    `particles.js` has it).
- **On the GPU:** the B channel of `uWxField` is `sqrt(rate / 40 mm/h)`, with `pcRainAt(dir)` returning mm/h at any
  point of the planet, for rings, puddles and darkened ground at any distance.
- **What the water group does with it** (their design, not this one): runoff into the drainage field, ponds
  filling, rivers rising, rain rings on water.

### 6.3 Files

- `src/physics/weather.js` and `weather.test.mjs` (C2, C4).
- **New `src/physics/cloudfield.js`** and `cloudfield.test.mjs` (C1, C7).
- `src/physics/sky.js` (C5).
- `src/physics/particles.js` (C6).
- `src/physics/three/kits.js` (the rain marks' length and density).
- **New `src/world/storms.js`** (rain shafts, bolts).
- **Touches:** `render/kitmat.js` (the `rain` and `snow` shape strings only), `physics/index.js` (wiring, after
  WIND), `world/index.js` (creating and updating `storms.js`), and `core/bench.js` rows. See section 8.4.

### 6.4 The look, and how it is judged

- **Node tests first.** Each fails on today's code where it is about new behaviour.
  1. Over 50 game days, at least 60 % of convective cells are born on the alpine range's sites, and between
     14:00 and 17:30 for at least 70 % of them.
  2. A storm occurs within 1.5 km of the spawn on 1 day in 3, within a tolerance.
  3. The upper alpine meadow (above 500 m) gets rain: total over 10 days at least 0.8 times the valley's. Today it
     is 0.
  4. The windward side's rain is at least 1.3 times the lee side's.
  5. The rain map's total over the planet is continuous in t (no step over 5 % in one 0.5 s update).
  6. `rainBetween` agrees with the sum of `rainAt` to 2 %.
  7. Flashes in the list: every mature cell within 4 km yields them at its `flash` rate (to 20 %).
  8. The spawn's first-day rule and epoch tests pass unchanged.
- **Stills at the stations:**
  - a storm over the range from W-150, with tower, anvil, shafts, and a bolt (forced at a flash time);
  - the gust front arriving at W-G;
  - the downpour at W-G with physics on, against today's still 12: the share of pixels covered by rain marks at
    least doubled at the same rate;
  - a storm offshore at night from C-G, with the in-cloud flicker in a pair of frames 0.1 s apart;
  - clearing at W-G, with the rainbow.
- **The owner on the phone:** the storm's life in motion, and the rain's feel.

### 6.5 Phone cost, derived

- **Rain marks.** 1,600 marks drawn about three times longer: about 40 pixels each, so 64k fragments. Each reads
  the scene colour behind it (`uSceneCol`) plus about ten operations, so call it 6 ns per fragment. That gives
  **about 0.4 ms in a downpour**, and zero otherwise (no marks).
- **Rain shafts.** At most 5 % of the frame in a distant storm x 348k x 8 ns = **0.14 ms**. Up to 0.5 ms if one
  stands in front of you; inside the storm you see the marks instead and the near shaft is faded.
- **Bolts.** A few hundred triangles for a third of a second: nothing.
- **CPU.** Cloud map about 0.2 ms a frame (C1). Cells and flashes about 0.02 ms (22 cells a frame plus the slot
  hashing). The particle change is about zero (four corner reads).
- **Budget for lane STORMS:** storm at most 0.7 ms GPU, fair 0; CPU at most 0.3 ms.
- **Speed-test rows:** `weather: a storm overhead` (forced: the total cost of a storm), then inside it `storm: no
  rain drawn` and `storm: no rain shafts or bolts`.

### 6.6 Risks

- **Storms on the same peak every day** look scripted. Mitigated by day-hashed sites, instability and drift; test 1
  allows 40 % elsewhere.
- **The water group builds on the rain field.** Its shape must be frozen in this lane's first commit (section 8.2),
  even while the values are still today's cells.
- **Storms that are too frequent annoy, too rare go unseen.** One number, `stormDays`, decided with the owner
  (section 10).
- **Sitting on the spawn's tuned storm:** kept by the test.
- **`coast.mjs` judges the coast against the strongest storm in the first 9,000 s.** Behind `?stormland=0` the old
  kinds stay. The coast's judgement is re-run when it is turned on, and the water group is told.

### 6.7 Switches

`?stormland=0|1`, `?wxceil=0|1` (the old 400/496 ceiling), `?rainshaft=0`, `?bolts=0`, `?rainlen=` (mark length),
`?rainmap=0` (the box rains uniformly, as today).

---

## 7. The phone budget and the speed-test rows

**Budget at the 30-a-second target** (S23 Ultra at its own settings, tier 1). These are *derived* ceilings, not
measurements:

| piece | fair GPU | storm overhead GPU | CPU a frame |
| --- | --- | --- | --- |
| clouds (3D, deck, sky changes) | 0.5 | 1.5 | 0.15 |
| cloud shadow map (render + sample) | 0.3 | 0.3 | 0 |
| wind (far plant field) | 0.0 to 0.1 | 0.0 to 0.1 | 0.1 (map and far texture) |
| storms and rain (marks, shafts, bolts) | 0 | 0.6 | 0.25 (cloud map, cells, flashes) |
| **total** | **about 0.8** | **about 2.5** | **about 0.5** |

That is 2.5 to 7.5 % of the 33 ms frame. **If the rows come back over these numbers, the lane cuts before it
ships.** The order of the cuts is in each lane's brief: lobe count and distance first, then the deck's resolution,
then the shadow map's rate.

**Rows for `src/core/bench.js`** (PILOT's file; each lane adds its own, the coordinator orders them). The test holds
the game still at the weather of the moment, so the storm must be FORCED to measure its worst case. That needs a
new `physics.forceWeather(o|null)` (lane STORMS) and `world.setWeather` (which exists), both honoured by the cloud
map near the eye.

```
['weather: a storm overhead',            forceStorm(true),  forceStorm(false)]     // total cost of a storm
['storm: no clouds drawn',               hide /^pc-cloud/,  show]                   // inside the forced storm
['storm: no rain drawn',                 hide /^pc-kit-rain/, show]
['storm: no rain shafts or bolts',       hide /^pc-storm/,  show]
['storm: no cloud shadows',              WX.uCloudShadowK=0, =1]
[AS, unforce]
['weather: no clouds drawn (fair)',      hide /^pc-cloud/,  show]
['weather: clouds as before',            setSwitch clouds3d 0, 1]                  // today's sky shell
['weather: no far wind on plants',       PHYS.uPhysFarOn=0, =1]
['weather: wind and cloud maps frozen',  physics.freezeMaps(true), false]          // read the script ms
```

---

## 8. Three build lanes on disjoint files

### 8.1 Who owns what

| lane | owns (writes) | new files |
| --- | --- | --- |
| **W1 CLOUDS** (painter side) | `src/world/sky.js`, `src/world/orbit.js` (`makeCloudShell` only), the `weather:` rows of `src/data/looks/*.js` | `src/world/clouds.js`, `src/world/wxfield.js`, `docs/shots/clouds/` |
| **W2 WIND** (physics) | `src/physics/wind.js`, `air.js`, `atmosphere.js`, `flora.js`, `flora.glsl.js` (and `ground.js`'s `heat` column if used) | `src/physics/windmap.js` (+ test) |
| **W3 STORMS AND RAIN FALLING** (physics, plus its painter side) | `src/physics/weather.js`, `src/physics/sky.js`, `src/physics/particles.js`, `src/physics/three/kits.js` | `src/physics/cloudfield.js` (+ test), `src/world/storms.js` |

No two lanes write the same file. `src/physics/index.js` is shared; it is ordered in 8.4.

### 8.2 The first commit of each lane is its interface

Each lane's first commit lands the shapes in section 9 with a trivial filling, so the others can build against real
objects from the first day.

- **W2 first:** `windmap.js` with `fields.wind` filled from `windLarge` alone (no terrain yet). Plus its wiring
  lines in `physics/index.js`.
- **W3 next:** `cloudfield.js` with `fields.cloud` and `fields.rain` filled from today's cells (per-texel distance
  tests, exactly today's numbers), plus `forceWeather`. Plus its wiring lines, on top of W2's.
- **W1 at once, in parallel:** `wxfield.js` uploading whatever `fields.cloud` / `fields.wind` hold (zeros before
  W2 and W3 land), with `WXFIELD_GLSL` returning those. Then the clouds against it.

After the three first commits the lanes run in parallel to the end.

### 8.3 The connections (what is written where, read by whom, how often)

| value | written by (file) | read by | rate |
| --- | --- | --- | --- |
| land descriptors `h, H1, H2, relief, axis, confine, saddle, water, heat, sites` | W2 `windmap.js` (static) | W2 itself; W3 (`sites` for storm births); W1 (`H2` for heights) | once per world |
| wind at 10 m `e10, n10`, `shelter`, `lift`, `trigger`, aloft `aloftE, aloftN` | W2 `windmap.js` | W2 `air.js` (near grid base), W2 `flora.js` (far field), W3 `cloudfield.js` (lift, trigger), W1 `clouds.js` (aloft, shear), E through `wxfield.js` | 1 Hz, 1/30 a frame |
| `FloraField.far` texture and `uPhysFarMap` | W2 `flora.js` | every plant via `FLORA_GLSL` (groups A, B: no edit) through `render/shared.js` `PHYS` | 1 Hz |
| cloud map `low, conv, base, top, mid, high, valley, storm` | W3 `cloudfield.js` | W1 (all of it), W3 `weather.js` (focus check), F (via the shadow map, not directly) | 2 Hz, 1/15 a frame |
| `cells[]` (convective: centre, radius, stage, top, anvil direction, front arc) | W3 `weather.js` | W1 (towers, shelf), W3 `storms.js` (shafts) | per frame |
| `flashes[]` (time, point, base, kind, seed, distance) | W3 `weather.js` | W3 `storms.js` (bolts), W1 (in-cloud light), F `post.js` (directional lift), PILOT `audio.js` (optional) | per frame |
| rain field `rate, snow` + `rainAt`, `rainBetween`, `throughfall` | W3 `cloudfield.js` | **E** (runoff, ponds, rivers, rings), W3 `particles.js` (box corners) | 2 Hz arrays; functions any time |
| `uWxField`, `uWxField2` textures + `WXFIELD_GLSL` | W1 `wxfield.js` | W1 shaders, **E** (water: `pcRainAt`, `pcWindAt`), **F** (`pcCloudShadow` in post or light), C (through F) | upload at 2 Hz; uniforms per frame |
| cloud shadow map `uCloudShadow` + `uCloudShadowM` | W1 `clouds.js` | **F** (light or post glaze, shafts), **E** (water) | every 2nd frame |
| sky numbers (eleven) + `cloudBase, cloudTop, inCloud01` | W3 `physics/sky.js` | F `world/index.js` (keys), W1 | per frame |
| `eyeInCloud01` | W1 `clouds.js` | F (`G.uAirNear`) | per frame |
| sky ceiling `skySpace01` | F `world/index.js` (touch T1) | W1 `sky.js` (`uAtmo.x`), aurora, night key | per frame |

### 8.4 Where a lane must touch another group's file (for the coordinator to order)

| # | file (owner) | lane | what, exactly | order |
| --- | --- | --- | --- | --- |
| T1 | `src/world/index.js` (F) | W1 | (a) `const skySpace01 = LOOK.oil && SKYCEIL ? smoothstep(alt, c0, c1) : space01`, handed to `skyU.uAtmo.x` and to the aurora and night key in place of `space01` (about 6 lines); (b) create `clouds.js` with the scene and call `clouds.update(...)` beside the sky uniforms (about 6 lines); (c) `wxfield.update(physics.fields)` once a frame (2 lines); (d) `G.uAirNear` takes `max(dust, eyeInCloud01)` (1 line) | before W1's first still above 440 m; ask F to review the night and aurora |
| T2 | `src/world/index.js` (F) | W3 | create `storms.js` and call `storms.update(...)` (about 4 lines) | after T1 |
| T3 | `src/render/post.js` or `src/render/chunks.js` (F) | W1 supplies, F implements | the cloud shadow as a cool glaze from `pcCloudShadow` (include `WXFIELD_GLSL`, about 10 lines); optional shafts through cloud gaps; the directional, weaker lightning lift from `flashes[]` | after W1's shadow map lands; F's design call |
| T4 | `src/render/shared.js` (F) | W2 | `PHYS.uPhysFar` (DataTexture) and `PHYS.uPhysFarMap` (vec4), filled in `syncPhysFlora` from `F.far` (about 5 lines) | with W2's far field |
| T5 | `src/render/index.js` (F) | W1 | before the main render: `if (world.clouds) world.clouds.renderShadow(renderer)` (2 lines) | with W1's shadow map |
| T6 | `src/physics/index.js` (physics, shared with E) | W2 then W3 | W2: create the wind map, run its slice in `update`, publish `fields.wind`. W3: create the cloud map, run its slice, publish `fields.cloud` and `fields.rain`, `forceWeather`, and `weatherAt`'s `below` from the map | **W2 then W3 then E**; each a separate commit, rebased |
| T7 | `src/render/kitmat.js` (listed under A, the trees) | W3 | the `rain` and `snow` entries of `SHAPES` only (two strings). **The file holds rain, snow, dust, leaves and fire marks and nothing of the trees. The coordinator should rule whether A's listing was meant for it.** | either way, W3 touches only those two strings |
| T8 | `src/render/materials.js` (E's water part) | E consumes | E includes `WXFIELD_GLSL` for rain rings, puddles and far wind roughness, and reflects the deck and cloud cover along the reflected ray (`pcWxField` at the layer's height: the lakes "that mirror the sky with cloud shapes in them") | after W1's `wxfield.js` lands (it carries zeros until W3) |
| T9 | `src/core/bench.js` (PILOT) | W1, W2, W3 | the rows of section 7 | each lane's own rows with its own merge |
| T10 | `src/audio/audio.js` (PILOT) | W3, optional | thunder for distant flashes from `flashes[]` | last |
| T11 | `src/data/looks/earth.js` (shared data) | W1 | a new `weather:` block only; nobody else edits that key | any time |

**Groups B (flora) and A (trees)** need no edit at all for the far wind: `pcPhysBend` is theirs to call and already
called. They should know that beyond 128 m their plants now move (B4), and judge it in their own stills.

**Group C (far view)** shares T1's decision. The far ground's air should move on the same vertical scale as the sky
ceiling, and the cloud shadow glaze (T3) lands on their ground. Their stills from the air will change when the
clouds and shadows come in. The order should be: the sky ceiling first, judged by C and F together.

**Group E (water)** gets the rain field (C7) and the wind map (B5), both frozen in shape by the first commits
(8.2). They should build against the shapes in section 9, not against values.

---

## 9. The contracts (exact)

### 9.1 `physics.fields.wind` (W2)

```js
{
  N: 32, version, t,                 // texel k = (face * N + j) * N + i; the faces as cubesphere.js orders them
  // per texel, body-local, each along the texel's own east = normalize(Y x up), north = up x east:
  e10, n10,            // Float32Array: wind at 10 m over open ground (m/s), terrain and thermal included
  aloftE, aloftN,      // Float32Array: wind at the cloud layer (m/s): what clouds drift with
  lift,                // Float32Array: vertical air motion at cloud base (m/s, up +)
  trigger,             // Float32Array: 0..1, how readily convection starts here now
  shelter,             // Float32Array: 0.2 (deep lee) .. 1.6 (crest, gap) speed factor of the land
  land: { h, H1, H2, relief, axisE, axisN, confine, saddle, water, heat },   // Float32Array each, static
  sites: [{ x, y, z, w, kind: 'peak' | 'ridge' | 'basin' }],               // static, at most about 40
  at(ux, uy, uz, out),   // bilinear: out.e10, out.n10, out.aloftE, out.aloftN, out.lift, out.trigger, out.shelter
}
```

### 9.2 `physics.fields.cloud` (W3)

```js
{
  N: 32, version, t,
  low, conv, base, top, mid, high, valley, storm,   // Float32Array each (units in 6.2 C1)
  cells: [{ id, gen, x, y, z, r, stage: 'cu' | 'tcu' | 'cb' | 'decay', age01, base, top,
            anvilR, anvilE, anvilN, frontR, frontW, rain, w }],
  flashes: [{ t, x, y, z, base, kind: 'cg' | 'ic', seed, distance, flash01 }],
  at(ux, uy, uz, out),
}
```

### 9.3 `physics.fields.rain` and the pure functions (W3, for the water group)

```js
fields.rain = { N: 32, version, t, rate /* mm/h liquid */, snow /* mm/h water eq. */, at(ux, uy, uz, out) }
rainAt(bodyId, ux, uy, uz, t, seed?)        -> { rate, snow }          // exact, any place, any time
rainBetween(bodyId, ux, uy, uz, t0, t1, seed?) -> { mm, mmSnow }       // what fell, LAGS-style quadrature
throughfall(canopy01, wet01)                -> 0.25 .. 0.75             // share reaching the ground under trees
```

### 9.4 The GPU side (W1 `src/world/wxfield.js`)

```js
export const WX = {
  uWxField:  { value: DataTexture },  // atlas 6*(N+2) x (N+2), RGBA8, one padded border per face:
                                      //   R low cover, G (top-base)/2500 m, B sqrt(rain/40 mm/h), A storm
  uWxField2: { value: DataTexture },  //   R base/2500 m above datum, G high cover, B wind speed/30 m/s, A wind dir/2pi
  uWxN: { value: 32 },
  uCloudShadow: { value: Texture },   // 256 x 256, R: 0 lit .. 1 shadow (smooth: threshold it in the caller)
  uCloudShadowM: { value: Matrix4 },  // body-local -> shadow map uv
  uCloudShadowK: { value: 1 },        // 0: no cloud shadow (the speed-test row)
};
export const WXFIELD_GLSL = `...
  vec4  pcWxField(vec3 dirL);     // the four channels of uWxField at a body-local direction
  float pcRainAt(vec3 dirL);      // mm/h
  vec2  pcWindAt(vec3 dirL);      // m/s along the place's own east and north
  float pcCloudShadow(vec3 posL); // 0..1, smooth
`;
```

### 9.5 The plants' far field (W2, through `render/shared.js`)

`FloraField.far` is a Float32Array 64 x 64 x 4 (RG wind at canopy height m/s, B gust-wave amplitude, A turbulence),
in the same frame as the near fields. `uniforms.uPhysFarMap` is (centre east, centre north, 1/size, 64).
`pcPhysBend(p, stiff)` blends near into far between 112 and 128 m from the near field's centre.

---

## 10. What I could not settle

- **Every phone cost.** They are derived from three rows (the ground, the water, the sharpness) by the share of
  pixels and the length of the shader. The sky's own cost, which the deck saves, has never been measured. The CPU
  figures assume the phone runs this machine's Node three times slower, which is a guess. The rows in section 7
  settle them.
- **Lobes against impostor cards** on the Adreno 740. I chose opaque lobes because the table found tiny cutout
  cards to be the trees' cost. One extra row, `clouds as cards`, would settle it, if lane W1 builds both cheaply.
- **How the 3D clouds look in motion,** the wind waves across a far wood, and a storm's life. A still cannot show
  motion and this machine cannot run the game at speed. Only the owner's phone can judge it.
- **The sky ceiling's effect on the climb to orbit** and on the other nine worlds' skies. Each world needs one look
  when T1 lands.
- **How often storms come.** The design says a storm over the range on about 2 days in 3, reaching the wood on
  about 1 in 3. That is the owner's taste, one number (`stormDays`), to ask them.
- **Whether `atmosphereHeight` (800 m, physics' density contract) should rise** to match a 2.8 km sky. I left it
  alone: it changes the flight's feel and the far field's air, which belong to others. The weather now has its own
  vertical frame (the land and the cloud map), so it does not need the change.
- **Not seen today:** a still from above a cloud. There is none to take, because the sky becomes space before you
  are above anything.

---

## 11. Stations (addresses for the gallery, `node tools/serve.mjs 8080`)

Today's stills were taken with these. The build lanes use the same ones, plus their own switches.

| station | address (after `/gallery.html?body=earth&look=oil&ui=0&t=30&`) |
| --- | --- |
| W-G | `biome=autumn_woodland&cam=stream&pitch=18` |
| W-150 | `biome=autumn_woodland&cam=jet&dy=120&pitch=10` |
| W-420 | `biome=autumn_woodland&cam=high&pitch=14` |
| W-1K | `biome=autumn_woodland&cam=high&dy=580&pitch=12` |
| A-G | `biome=alpine_meadow&cam=vista&pitch=12` (looks into a slope; lane W1 should find a valley-floor station facing the peaks, with `dx`/`dz`/`yaw`) |
| A-150 | `biome=alpine_meadow&cam=jet&dy=120&pitch=10` |
| A-1K | `biome=alpine_meadow&cam=high&dy=580&pitch=14` |
| C-G | `biome=sea_coast&cam=stream&pitch=8` |
| C-150 | `biome=sea_coast&cam=jet&dy=120&pitch=8` |
| C-1K | `biome=sea_coast&cam=high&dy=580&pitch=14` |

Plus `time=` (07, 13, 16.5, 19.2, 23) and `wx=fair|overcast|rain|storm|after` or `sky=cloud:0.55,haze:0.9`. For
real weather: `physics=1&wtime=<s>&pre=15`. The spawn's thunderstorm is at `wtime=1690..1850` at the spawn with no
`biome=`: 23.7 mm/h and 11 m/s at 1760, MEASURED in the page.

The lab (`tools/lab.mjs`) loads the gallery in about 40 s on this machine, and each still after the shaders are
built takes 5 to 30 s. Moving the camera by `eval` (setting `state.pos`) left the page drawing one call, so a black
frame; reloading by address is the reliable way.
