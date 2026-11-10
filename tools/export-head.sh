#!/usr/bin/env bash
# Export a clean copy of the last commit (no half-written files from the other role) into a directory,
# for integration checks:  tools/export-head.sh /path/to/dir && node tools/shot.mjs /index.html out.jpg --root /path/to/dir
set -eu
dir="${1:?usage: tools/export-head.sh <dir>}"
cd "$(git rev-parse --show-toplevel)"
mkdir -p "$dir"
find "$dir" -mindepth 1 -maxdepth 1 -exec rm -r {} +
git archive HEAD | tar -x -C "$dir"
echo "exported $(git rev-parse --short HEAD) to $dir"
