# PAINTER notes

Branch: `cosmos` (shared with PILOT and PHYSICS, one working tree).

## Status

INTEGRATION: ready (first usable commit; see `git log --grep "\[painter\]"` for the latest)

- `src/render/index.js`: `createPainter(renderer)`, `RENDERER_OPTIONS`, `makeWashMaterial`. Works.
- `src/world/index.js`: `createWorld(scene)` with all ten bodies (earth detailed, the rest are
  rough placeholders that already have 4 biomes each), `world.sun`, `sampleSurface`, `getSpawn`,
  `getVistas`, `setTime`, `setVistaFound`. Works.
- `src/art/models.js`: `createExplorer()`, `createShip()`: placeholder shapes, contract-correct
  (sizes, origins, `userData.seat`, `userData.hatch`, `animate`).
- `gallery.html`: free-fly camera, pickers, URL parameters (below).
- M1 focus now: the temperate forest (flora, stream, light) until it passes the freeze-frame test.

Known rough edges right now: no flora yet (next commit), explorer and ship are placeholders,
other planets are noise spheres with palettes, space is a first-pass wash.

## How to use my modules (PILOT)

```js
import { createPainter, RENDERER_OPTIONS, makeWashMaterial } from './src/render/index.js';
import { createWorld } from './src/world/index.js';
import { createExplorer, createShip } from './src/art/models.js';

const renderer = new THREE.WebGLRenderer({ canvas, ...RENDERER_OPTIONS });
const painter = createPainter(renderer);        // sets autoClear=false, pixelRatio=1
const world = createWorld(scene);               // adds body roots, the sun holder and the sky
painter.resize(drawingBufferWidth, drawingBufferHeight);   // physical pixels; I size the canvas buffer
// per frame (C6): place world.sun and every world.bodies root, update camera, then
world.update(dt, camera.position, activeBodyId);
painter.setMood({ bodyId, timeOfDay, altitude01, inSpace01, speed01 });
painter.render(scene, camera, dt);
```

- Do not add lights; do not set `scene.background` (harmless, but ignored).
- `world.busy` (number) is how many terrain / flora build jobs are pending: use it for the
  first-frame wait (`while (world.busy) world.update(0, pos, id)` with `world.setBuildBudget(60)`,
  then set the budget back to about 5 ms). See the warm-up in `src/art/gallery.js`.
- `world.getLighting()` -> `{ bodyId, sunElevation, hours, dayness, altitude, space01 }` for the
  body the camera is on (local solar time in `hours`, which you can pass to `setMood.timeOfDay`).
- The sheet's day/night grade comes from the real sun elevation at the camera, so you normally
  do not need to pass `timeOfDay` at all.
- Foreign objects (C9): any `Object3D` with a non-painter material is painted with a wash
  stand-in made from its `material.color` (Mesh, Line, Points; Sprite gets a billboard wash using
  its map's alpha). For anything you want to look right, use
  `makeWashMaterial({ color, wet, dry, scale, id, flat, vertexColors, side })`.
- Near/far: I write my own linear depth, so any near/far works. Reversed depth and the log-depth
  fallback are both handled.

## Gallery URL parameters (C13)

`gallery.html?body=earth&biome=temperate_forest&time=12&quality=1&cam=stream`

- `cam`: `stream` (bank, looking along the water), `trees`, `canopy` (looking up), `jet` (30 m),
  `high` (420 m), `orbit`
- `t=0` freezes wind and drift at that time in seconds (deterministic frames); `ui=0` hides the panel
- `view=1..5` debug buffers (scene colour, wetness, normal+depth, regions, abstraction)
- `dx, dy, dz` (metres right / up / forward), `yaw`, `pitch` (degrees) nudge the preset camera
- `scale` render scale, `fov`, `models=1` shows the explorer and ship, `look=pooling:1,granulation:1,...`
- `window.__pcReady` is set once terrain and flora have settled and three frames are painted.

## Decisions

- **Colour model.** Every colour in the scene pass is the transmittance of a wash over paper:
  (1,1,1) is bare paper. Layering multiplies. The last pass multiplies by the paper colour
  (#F4EFE4). So nothing can be brighter than paper and "fade to paper" is "fade to 1".
- **Pipeline** (4 full-screen passes after the scene): scene MRT (colour+wetness, normal+log
  depth+region id) at internal resolution -> half-res prep (mean colour and luma variance;
  wetness-weighted colour; both mipmapped) -> abstraction at internal resolution (8-sector
  Kuwahara read from mips, about 9 fetches, plus wet-in-wet bleed) -> sheet at output resolution
  (paper wobble, pigment pooling, granulation, graphite, ragged border, paper). Paper grain,
  wobble and the border are the only screen-anchored things.
- **In the materials, not on top:** value-stepped light (4 soft steps), cool glaze shadows,
  pigment-density turbulence, dry-brush sparkle, banded aerial perspective and dappled light are
  all computed per material in body-local space (3D noise texture + triplanar stroke atlas, both
  generated in code at start-up).
- **Dappled light without shadow maps:** a leaf-shadow pattern projected along the sun direction
  in body-local space; ground, trunks and foliage share it, so it reads as cast shade and moves
  with the sun. No hard shadows anywhere.
- **Terrain:** cube-sphere quadtree, 32x32-cell patches, CDLOD-style geomorph to the parent mesh
  (no popping), skirts, time-sliced generation (coarse and near first). Height, biome weights,
  ground colour and flora density all come from one pure function (`src/world/surface.js`).
- **Biomes:** hand-placed sites per body, warped Voronoi with smooth blending (about 280 m).
  Liquid keeps its true level; a low berm closes it off at the edge of its biome group.
- **Stream:** the zero contour of a warped noise field, normalised by its gradient so the brook
  is about 5 m wide; hills only rise away from it, so it always sits in a valley.
- Earth's first site (38N, 10E) is the home forest; `getSpawn('earth')` searches it for a flat,
  open spot about 13 m from the stream and clears the trees around it (radius 11 m) for the ship.
- Time of day: `setTime(bodyId, h)` puts the sun where local solar time `h` would have it at the
  camera (6 = east horizon, 12 = high, tilted 32 degrees toward the equator, 18 = west).

## Needs from the other

- PILOT: none blocking. When you integrate, tell me which `near`/`far` you run at ground level
  and in orbit, and whether you call `setTime` at all.
- PHYSICS: none yet. I will keep the flora sway behind one function in the vertex shader so your
  field can replace it (see Answers).

## Answers to the other

- PILOT (C7): `RENDERER_OPTIONS` is exported as specified. (C8) `setRenderScale(s)` multiplies
  the tier's internal scale (tiers: 0.62 / 0.80 / 1.00); the sheet pass is always at output size.
- PHYSICS (C14): `world.setPhysics(physics)` exists and stores the object; nothing reads it yet.
  Flora sway is a single block at the top of the prop vertex shader (`src/render/materials.js`,
  PROP_VERT) driven by `uTime`/`uWind`; that block is where your GLSL chunk will go.

## Ideas and critique

- (to PILOT) The painter is costly per pixel by design; drive `setRenderScale` before dropping a
  quality tier: the paper pass keeps the frame looking sharp even at 0.6 scale.

## Tests

- `node --test src/world/*.test.mjs` (9 tests of pure logic: noise, cube-sphere, biome coverage, sampleSurface purity, spawn, liquid, vistas, patch edges and mesh/sample agreement).
