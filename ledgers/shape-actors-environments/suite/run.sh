#!/usr/bin/env bash
# One measurement session over several foundry-mobileapps checkouts, interleaved, on one machine.
#   bash run.sh <out-dir> <label>=<checkout> [<label>=<checkout> …]
# Each checkout needs node_modules (a symlink to a sibling checkout's is fine). Writes per checkout:
#   startup-<label>-r<n>.json (2 interleaved rounds), bundle-<label>.json, frames-<label>.json
set -euo pipefail
out=$(realpath -m "$1"); shift
here=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$out"
uname -a > "$out/machine.txt"; nproc >> "$out/machine.txt"; node -v >> "$out/machine.txt"
for round in 1 2; do
  for pair in "$@"; do
    label=${pair%%=*}; ck=$(realpath "${pair#*=}")
    (cd "$ck" && NODE_PATH=node_modules npx tsx "$here/startup.ts" "$ck" --reps 9 > "$out/startup-$label-r$round.json")
  done
done
for pair in "$@"; do
  label=${pair%%=*}; ck=$(realpath "${pair#*=}")
  node "$here/bundle.mjs" "$ck" > "$out/bundle-$label.json"
  # The repo's own native frame bench (engine, Skia record and raster per frame), heavy worlds.
  (cd "$ck" && NODE_PATH=node_modules npx tsx packages/shape-actors/scripts/perf/node-bench.ts \
     --themes market,supermarket,farm,playground,kitchen,egypt-giza,zoo,soccer --out "$out/frames-$label.json" > "$out/frames-$label.log" 2>&1)
done
echo "done → $out"
