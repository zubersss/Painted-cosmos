#!/usr/bin/env bash
# the verifier's slope2 sections on a tree: <root> <out>
root=$1; out=$2; : > $out
for cfg in "9.0 4.2 down 30" "9.0 4.2 across 30" "9.0 4.2 up 60" "9.0 6.5 up 30" "9.0 4.2 up 30" "4.6 4.2 up 30" "2.2 4.2 up 30" "1.4 4.2 up 30" "4.6 4.2 down 30" "1.4 4.2 down 30" "9.0 6.5 down 30" "9.0 4.2 down 60" "2.2 4.2 down 30" "9.0 6.5 across 30"; do
  node slope2.mjs $root $cfg | sed "1s|^# [^ ]*|# |" >> $out
done
