#!/usr/bin/env bash
# The round's checks on a tree, one suite at a time: world, unit, physics, coast (both stands), ghostfield.
set -u
root="${1:?root}"; cd "$root"
echo "== world"; node --test src/world/*.test.mjs 2>&1 | grep -E '^# (pass|fail)'
echo "== unit"; node --test tests/*.test.mjs 2>&1 | grep -E '^# (pass|fail)|^not ok'
echo "== physics"; node --test src/physics/ 2>&1 | grep -E '^# (pass|fail)|^not ok'
echo "== coast"; node src/physics/coast.mjs 2>&1 | grep -E "=>|PASS|FAIL" | tail -6
echo "== ghostfield"; node docs/lead/evidence/review7/ghostfield.mjs 2>&1 | tail -6
