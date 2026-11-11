#!/usr/bin/env bash
# Pathspec-limited commit for the shared branch. Commits ONLY the caller's own files, so the
# roles can commit from the same working tree without ever sweeping up each other's work.
# Usage: tools/commit.sh painter|pilot|physics|coordinator "message"
set -u
role="${1:-}"; msg="${2:-}"
if [ -z "$role" ] || [ -z "$msg" ]; then echo "usage: tools/commit.sh painter|pilot|physics|coordinator \"message\"" >&2; exit 2; fi
cd "$(git rev-parse --show-toplevel)" || exit 2
case "$role" in
  painter) paths=(src/render src/world src/art src/data/looks.js gallery.html docs/notes/painter.md docs/shots/painter) ;;
  pilot) paths=(index.html src/main.js src/core src/player src/ship src/space src/ui src/audio src/data/bodies.js vendor tests README.md docs/notes/pilot.md docs/shots/pilot .nojekyll .gitignore package.json) ;;
  physics) paths=(src/physics physics-lab.html docs/notes/physics.md docs/shots/physics) ;;
  coordinator) paths=(docs/BRIEF.md docs/COORDINATOR.md tools) ;;
  *) echo "unknown role: $role" >&2; exit 2 ;;
esac
use=()
for p in "${paths[@]}"; do
  if [ -e "$p" ] || [ -n "$(git ls-files -- "$p" | head -1)" ]; then use+=("$p"); fi
done
if [ "${#use[@]}" -eq 0 ]; then echo "nothing to commit for $role"; exit 0; fi
for attempt in 1 2 3 4 5 6; do
  if git add -A -- "${use[@]}" 2>/tmp/pc-commit-$$.err; then
    if git diff --cached --quiet -- "${use[@]}"; then echo "nothing to commit for $role"; rm -f /tmp/pc-commit-$$.err; exit 0; fi
    # Commit only paths git actually knows about (an empty directory on disk is not one, and
    # naming it would make `git commit -- <paths>` fail).
    known=()
    for p in "${use[@]}"; do
      if [ -n "$(git ls-files -- "$p" | head -1)" ] || [ -n "$(git diff --cached --name-only -- "$p" | head -1)" ]; then known+=("$p"); fi
    done
    if git -c user.name="Painted Cosmos ${role^}" -c user.email="noreply@anthropic.com" \
         commit -q -m "[$role] $msg" -- "${known[@]}" 2>>/tmp/pc-commit-$$.err; then
      git log --oneline -1; rm -f /tmp/pc-commit-$$.err
      # Push the shared branch if a remote exists. Never fatal: the commit is safe locally and the
      # next commit pushes it too. (Both roles push the same local ref, so it is always a fast-forward.)
      if git remote get-url origin >/dev/null 2>&1; then
        branch="$(git branch --show-current)"
        pushed=0
        for p in 1 2 3 4; do
          if timeout 120 git push -q origin "$branch" 2>/tmp/pc-push-$$.err; then pushed=1; break; fi
          sleep $((2 ** p))
        done
        if [ "$pushed" -eq 1 ]; then echo "pushed $branch"; else echo "push failed (commit is safe locally; will go up with the next push): $(tail -1 /tmp/pc-push-$$.err 2>/dev/null)"; fi
        rm -f /tmp/pc-push-$$.err
      fi
      exit 0
    fi
  fi
  if grep -q "index.lock" /tmp/pc-commit-$$.err 2>/dev/null; then sleep $((attempt)); continue; fi
  cat /tmp/pc-commit-$$.err >&2; rm -f /tmp/pc-commit-$$.err; exit 1
done
echo "could not take the git index lock after retries" >&2; exit 1
