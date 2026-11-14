#!/usr/bin/env bash
# A clean tree for checks while the head holds the coordinator's "WIP snapshot" commits (the
# other roles' half-written files):
#
#   tests/cleantree.sh <dir> <painter-commit> [<pilot-commit>=HEAD] [<physics-commit>]
#
# Everything as of <painter-commit> (PAINTER's own last commit), then PILOT's own paths as of
# <pilot-commit>, then (if given) PHYSICS' own paths as of <physics-commit>. Find each role's
# last own commit with:  git log --format='%h %an: %s' -12   (never one named "WIP snapshot").
# Then:  cd <dir> && node tests/all.mjs      (or any browser check; one browser at a time)
set -eu
dir="${1:?dir}"; base="${2:?painter commit}"; mine="${3:-HEAD}"
cd "$(git rev-parse --show-toplevel)"
mkdir -p "$dir"
find "$dir" -mindepth 1 -maxdepth 1 -exec rm -r {} +
git archive "$base" | tar -x -C "$dir"
git archive "$mine" -- index.html src/main.js src/core src/player src/ship src/ui src/audio src/data/bodies.js tests README.md | tar -x -C "$dir"
echo "exported $(git rev-parse --short "$base") with PILOT's files of $(git rev-parse --short "$mine") to $dir"
if [ -n "${4:-}" ]; then
  rm -r "$dir/src/physics" "$dir/physics-lab.html"
  git archive "$4" -- src/physics physics-lab.html | tar -x -C "$dir"
  echo "  with PHYSICS' files of $(git rev-parse --short "$4")"
fi
