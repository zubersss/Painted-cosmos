#!/bin/bash
# kept.sh <tree-abs-path> <label>: the measured sets of P22-P26 (to out/kept-<label>.txt), boulderrun's replay (out/t8b-<label>.txt),
# wallrun / runfield / ghostfield at every place of PILOT's lists (out/wallrun-<label>-*.txt ...)
S=/home/user/.pc-scratch/physics/m4; t=$1; L=$2; o=$S/out/kept-$L.txt
{
echo "== knife 60"; ROOT=$t node $S/s/p26-knife.mjs 7.4 60
echo "== knife 30"; ROOT=$t node $S/s/p26-knife.mjs 7.4 30
echo "== rows"; node $S/s/p26-rowloss2.mjs $t
echo "== mbv"; ROOT=$t node $S/s/p26-mbv.mjs
echo "== mbv old"; OLD=1 ROOT=$t node $S/s/p26-mbv.mjs
echo "== hill43 60"; node $S/s/p26-hill43.mjs $t 35,43 7.4 60
echo "== hill43 30"; node $S/s/p26-hill43.mjs $t 35,43 7.4 30
for g in 1.62 3.71 9.81; do for v in 4.2 7.4; do for hz in 60 20; do echo "== field $g $v $hz"; node $S/s/p26-field.mjs $t $g $v $hz 1; done; done; done
echo "== p17 60"; node $S/s/p26-p17.mjs $t
echo "== p17 30"; node $S/s/p26-p17.mjs $t 2.2,3.7,9 0,0.3,0.5,0.55 30
} > $o 2>&1
(cd $t && ROOT=$t node $S/s/p26-trace8b.mjs $S/../p26/site.json > $S/out/t8b-$L.txt 2>&1)
for pl in "earth desert_canyon" "earth alpine_meadow" "earth sea_coast" "mars rust_canyons" "neptune ice_spires" "neptune storm_seas" "mercury spawn" "pluto lilac_mountains"; do set -- $pl; node $S/s/p26-wallrun.mjs $t $1 $2 > $S/out/wallrun-$L-$1-$2.txt 2>&1; done
for pl in "moon crater_fields" "moon spawn" "mars rust_canyons" "earth desert_canyon" "pluto spawn" "mercury spawn" "earth spawn"; do set -- $pl; node $S/s/p26-runfield.mjs $t $1 $2 > $S/out/runfield-$L-$1-$2.txt 2>&1; done
(cd $t && node $S/s/p26-ghostfield.mjs $t > $S/out/ghostfield-$L.txt 2>&1)
echo done $L
