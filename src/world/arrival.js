// Painted Cosmos: when is a frame an ARRIVAL (the picture is held as bare paper while the land is laid, and then
// comes up out of the paper as one; world/index.js `veil`)? OWNER: PAINTER. Pure: safe to import in Node.
//
// The eye is somewhere it was not a frame ago: the first frame over a world, or a leap. A leap was "more than 60 m
// in a frame", which a fast ship makes at a low frame rate: 265 m/s at four frames a second (software rendering),
// 900 m/s at fifteen (the pulse lets go at 820 to 995 m/s three kilometres up), and the picture went to bare paper in
// mid-flight and stayed there for as long as the ship was fast (PAINTER 15's own-side 1; measured by PAINTER 17 at
// 0.25 s steps: laid 0 from 265 m/s on). Flight is one leap after another of about the same length; an arrival is
// a leap the frame before does not explain.
//   leap: m the eye moved since the last frame; leapPrev: m it moved in the frame before (0 when unknown);
//   seenLastFrame: this world was the active one a frame ago.
export const ARRIVAL_LEAP = 60;
export function isArrival(leap, leapPrev, seenLastFrame) {
  if (!seenLastFrame) return true;
  if (!(leap > ARRIVAL_LEAP)) return false;
  return !(leap < 2.5 * (leapPrev > 0 ? leapPrev : 0) + 30);
}
