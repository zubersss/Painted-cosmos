#!/usr/bin/env bash
# A clean export of HEAD with PILOT's changed (and new) files of the working tree over it.
set -eu
dir="${1:?dir}"
cd /home/user/painted-cosmos
tools/export-head.sh "$dir" >/dev/null
for f in $(git status --porcelain -- index.html src/main.js src/core src/player src/ship src/space src/ui src/audio tests README.md docs/notes/pilot.md | awk '{print $2}'); do
  if [ -d "$f" ]; then mkdir -p "$dir/$f"; cp -r "$f"/. "$dir/$f"/; elif [ -e "$f" ]; then mkdir -p "$dir/$(dirname "$f")"; cp "$f" "$dir/$f"; else rm -f "$dir/$f"; fi
done
echo "tree $dir: HEAD $(git rev-parse --short HEAD) + $(git status --porcelain -- src tests README.md index.html | awk '{print $2}' | tr '\n' ' ')"
