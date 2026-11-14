#!/bin/bash
# checks.sh <tree> <label>: the project's node checks, one after another; a summary to out/checks-<label>.txt
S=/home/user/.pc-scratch/physics/m4; t=$1; L=$2; o=$S/out/checks-$L.txt
cd $t
{
echo "== tree $t ($(date -u +%H:%M:%S))"
echo "== world"; node --test src/world/*.test.mjs 2>&1 | grep -E '^# (tests|pass|fail)|^not ok'
echo "== unit"; node --test tests/*.test.mjs 2>&1 | grep -E '^# (tests|pass|fail)|^not ok'
echo "== physics"; node --test src/physics/ 2>&1 | grep -E '^# (tests|pass|fail)|^not ok'
echo "== coast"; node src/physics/coast.mjs 2>&1 | grep -iE 'PASS|FAIL|Hs|white' | cut -c1-240 | head -12
echo "== ghostfield"; node docs/lead/evidence/review7/ghostfield.mjs 2>&1 | tail -30 | cut -c1-200
echo "== done ($(date -u +%H:%M:%S))"
} > $o 2>&1
cat $o
