# Recordings

Screen recordings made by the suite's `record-open.mjs` (see [`../suite`](../suite)): the same world
opened in two builds under the same Chromium CPU throttle, stitched side by side with a clock
burned in. They show the time between "load the world" and "two painted frames".

| file | experiment | throttle | before → after |
|---|---|---|---|
| `EXP-034-world-open-veh-roads-6x.mp4` | [EXP-034](../LEDGER.md) world open: backdrop built once | 6× (low-end phone) | 2 488 ms → 1 550 ms |
| `EXP-034-world-open-playground-6x.mp4` | [EXP-034](../LEDGER.md) | 6× | 1 216 ms → 980 ms |

Left is the develop build of the day, right is the change. Both builds were measured in the same
session (rule 2 of the ledger: compare within a run, never across days).

Regenerate, from a checkout of the app repository with two demo builds:

```sh
node packages/shape-actors/scripts/perf/record-open.mjs \
  --before <before-demo-dist> --after <after-demo-dist> --out <dir> \
  --theme veh-roads --cpu 6 --labels "develop,this change"
```

Not recorded: the native (Skia) door experiments (EXP-036 to EXP-038) run headless on CanvasKit;
their evidence is the per-frame JSON under `experiments/results/` and the tests named in each entry.
