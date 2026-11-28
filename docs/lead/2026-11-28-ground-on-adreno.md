# Why the owner's phone draws no ground (28 Nov), and what v39.5.3 does about it

The coordinator ran a focused investigation as one workflow:
- four investigators, each from a different angle:
  - is the shader text legal;
  - is it too complex for the driver;
  - does it link but draw nothing;
  - what changed since v38, construct by construct, plus draw-time errors;
- one agent to rank what they found;
- two skeptics told to knock the top suspects down: one from the files, one as an ANGLE/Adreno expert;
- one to plan the fix.

They worked from the exact shader text three.js hands the GPU, dumped headless as an emulated phone:
- v38, the last version the phone's speed test shows drawing the ground;
- v39.5.2.

Nothing here has been seen on the phone yet. The answers to the test links below decide it.

## What is known
- **The ground's program never runs on the phone.** The phone's v39.5 table (`docs/lead/bench/2026-11-24-v39.5-owner-phone.md`):
  - "no ground" and "ground one flat colour" each cost +0.4 ms, against 8.9 ms at v38;
  - the ground's fragment program has no discard and no early return, so any pixel it painted would cost full price.
- **On a refused link, three.js r187 records `runnable=false`.**
  - WebGL then refuses `useProgram` and keeps the previous program.
  - The ground's draw runs without its attributes and paints nothing.
  - That matches the owner's screenshots: grass, trees and water over the sky's haze.
- **ANGLE is not the cause.**
  - The text ANGLE's GLES backend hands Qualcomm's driver is byte-identical with every Android/Qualcomm workaround forced on.
  - Mesa, SwiftShader and desktop GPUs link that same text.
  - The one step no tested machine shares is Qualcomm's own compiler.
- **The ordinary limits are ruled out by count:**
  - 87 uniform vectors, where a far-tree program with 209 draws on the phone;
  - 12 attributes of 16;
  - about 11 of 31 varying rows;
  - 4 samplers;
  - highp everywhere.
- **Size.** Fragment instructions after inlining (SPIR-V, glslang plus spirv-opt -O, loops not unrolled):

| Program | Instructions |
| --- | --- |
| v38 ground (drew on the phone) | 9.5k |
| v39.5.2 ground | 19.2k |
| v39.5.2 ground, rock faces only (no canopy) | 15.3k |
| v39.5.2 ground, canopy only (no rock faces) | 15.2k |
| v39.5.2 ground, all four new parts out | 11.5k |
| water | 4.6k |
| sky | 3.0k |
| near ground | 2.2k |

  The canopy and the rock faces add about 3.7k each. The year's colours and the far water line add about 0.1k each.
- **One unique construct.** Only the canopy has local arrays written through out-parameters at a run-time index inside a loop (`farground.js` pcCanopyAt). No program that draws on the phone has them.

## Ranked causes (after the skeptics)
1. **Qualcomm's compiler refuses the ground's program and reports it.** Size is the likely trigger, but it is not proven: no published Adreno limit sits in this range, and v38 already linked at twice water's size. Confidence 0.3.
2. **The same refusal, caused by the canopy's arrays.** Confidence 0.15.
3. **The program links but draws nothing.** Both skeptics refuted this: the vertex position path is unchanged since v38. Kept only as the branch the tests can expose. Confidence 0.12.
4. **The rock faces' constructs on their own** (a third loop level, a return inside a loop). Dropped; their share counts toward size.
5. **The base outside the four parts.** Dropped: the base's new pieces run in the near ground, which draws.

## The fix shipped as v39.5.3: the guard ahead
`groundGuardAhead` in `src/render/materials.js`, called once from `src/render/index.js` where the chip's name is read.

When it acts:
- only when the chip's name says Adreno and the system is OpenGL ES or Android;
- not when `canopy=` or `rockfield=` is in the address (kept for the tests below).

What it does: it builds the ground from the start without the rock faces and the painted canopy, using the v39.5.2 guard's own drop path. That is about 11.8k instructions. This covers:
- causes 1 and 2;
- cause 3, if it lies in those two parts.

It works whether or not the driver reports the refusal, and the phone no longer waits through refused builds.

Every other machine returns at the first test, so its shader text is unchanged.

## The phone's tests (on v39.5.3)
Wait 20 seconds after the picture appears, then answer "ground" or "no ground" for each.
1. Everything as built, with the guard free to act; the black box is the report:
   `?look=oil&canopy=1&glerr=1`
2. All four new parts out:
   `?look=oil&canopy=0&rockfield=0&groundseason=0&farwater=0&glerr=1`
3. What the fix gives the phone. Plain `?look=oil` is the same on the phone.

What the answers mean:
- **1 ground:** the driver refused and said so, and the guard rebuilt the program. The box's "ground guard: TOOK OUT ..." tells size from the canopy's arrays:
  - stops at PC_ROCKF: size above about 15.3k, or the rock;
  - goes on to PC_CANOPY: the arrays, or size below 15.2k.
- **1 no ground, 2 ground, 3 ground:** the fault is in the canopy or the rock and is silent. Only the fix helps, and it works.
- **3 no ground, 2 ground:** the year's colours or the far water line also stop the draw silently. The fix must also leave out PC_FARWATER and PC_SEASONG.
- **2 no ground:** the cause is outside the four parts. It needs one-off cut builds.

## Lasting fixes, once the phone has answered
- **Canopy:** shrink its two inlined copies (pcCanopyAt inside the LC loop and inside pcGroundAt). Unroll its four cells into plain locals, and have pcCanopyLayers return its values instead of using inout.
- **Then:** give the parts back to the phone one at a time.
- **The guard's remaining gap:** a program that links but draws nothing. Closing it everywhere needs a one-off check draw read back at start, which must not ship before it is seen on the phone.
