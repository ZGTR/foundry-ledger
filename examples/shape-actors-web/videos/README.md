# Recordings

Screen recordings made by the suite's `record-open.mjs` (see [`../suite`](../suite)): the same world
opened in two builds under the same Chromium CPU throttle, stitched side by side with a clock
burned in. They show the time between "load the world" and "two painted frames".

| file | experiment | throttle | before → after |
|---|---|---|---|
| `EXP-034-world-open-veh-roads-6x.mp4` | [EXP-034](../LEDGER.md) world open: backdrop built once | 6× (low-end phone) | 2 488 ms → 1 550 ms |
| `EXP-034-world-open-playground-6x.mp4` | [EXP-034](../LEDGER.md) | 6× | 1 216 ms → 980 ms |
| `EXP-049-world-open-farm-6x.mp4` | [EXP-049](../LEDGER.md) objects prepared on first use (+ EXP-046) | 6× | 1 535 ms → 1 248 ms (0.23 → 0.25) |
| `EXP-047-drag-market-6x.mp4` | [EXP-047](../LEDGER.md) painted scenes skip generated scenery (+ EXP-046) | 6× | HUD mid-drag: 41 fps / 21 % dropped → 60 fps / 2 % (0.23 → 0.24; a moment, not a statistic: the bench is in the entry) |
| `EXP-052-art-farm-before-after.mp4` | [EXP-052](../LEDGER.md) the redraw itself (what the bytes bought) | none | old art (top) → new art (bottom), native renderer, app look |
| `EXP-052-art-kitchen-before-after.mp4` | [EXP-052](../LEDGER.md) | none | blank panels → cabinets, hood, counters |
| `EXP-052-art-supermarket-before-after.mp4` | [EXP-052](../LEDGER.md) | none | flat shelves → stocked, layered aisles |

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

EXP-047 and EXP-049 were recorded with `record-ab.mjs` and `record-open.mjs` on demo builds of
three checkpoints measured in one session (0.23.3, 0.24.0, 0.25.0). The demo bundles into a single
file, so these show the CPU side (preparing and parsing), not the download savings of EXP-046,
which are in [`experiments/results/ENV-LOOP-2026-11-09`](../experiments/results/ENV-LOOP-2026-11-09).
The EXP-052 videos come from the app repository's `env-videos.ts` (the native Skia renderer,
camera through the areas with taps and drags), before the redraw on top and after it below.
