# The perf suite behind this ledger (reference copy)

These are the measuring tools every experiment in this example was run with, copied from
[`ZGTR/foundry-mobileapps`](https://github.com/ZGTR/foundry-mobileapps) at develop `3b0738e5`
(`packages/shape-actors/scripts/perf/`), plus the rig harness from `scripts/proof/perf-rig.ts`.
The "used by" column lists the entries whose method or evidence names the tool.
They import the app's engine and renderers by relative path, so they **run inside that
repository**, not from here; they are kept here so the method behind each number can be read next
to the number. [`README.md`](README.md) is the suite's own guide.

| file | what it measures | used by |
|---|---|---|
| `run.mjs` | the runner (`npm run perf`): node rails + web rail, gated against `budgets.json` / `perf-baseline.json` | EXP-009, -021 by name; it drives the two rails below |
| `node-bench.ts` | engine tick and Skia recording per frame across edge-case scenarios; startup (kit build, world open); heap | EXP-003, -015, -024, -026, -034 |
| `web-bench.mjs` | the real stage in Chromium under CPU throttling (6× low, 3× mid, 1.5× high): frame intervals, dropped frames, input latency, world open, heap, DOM nodes | EXP-005, -006, -016, -018, -019, -023, -027 … -031, -033, -034, -035 |
| `web-trace.mjs` | where one frame's time goes (Chromium trace) | EXP-004, -010, -011, -012, -016, -028, -030 … -033, -035 |
| `record-ab.mjs` / `record-open.mjs` | side-by-side screen recordings of two builds | EXP-031 / EXP-034 ([`../videos`](../videos)) |
| `leak-check.mjs` | remounts and door reloads ×10; fails on node, listener or heap growth | EXP-019, -020, -029 |
| `skia-parity.ts`, `canvas-parity.mjs`, `canvas-hit-parity.mjs`, `stage-parity.mjs` | pixel and hit-test parity of an optimised path against the plain one | EXP-008, -009, -021, -038 (Skia); -035 (canvas); -033 (stage) |
| `scenarios.ts` | the interaction edge cases (drag-slow … drop-chain) and device classes, shared by both rails | (through the rails) |
| `perf-rig.ts` | the rig under load: every carrier loaded and driven; tick, rig pass and Skia draw per frame vs the unloaded world | EXP-036, -037, -038 |
| `experiments/record-experiment.mjs` | the in-repo recorder this tool (`foundry-performance-ledger record`) was extracted from | — |

`budgets.json` and `perf-baseline.json` are the gates as they stood. The baseline was recorded on a
faster machine than the 4-vCPU VM most entries were measured on, which is why the node rail's
absolute ratchet trips on that VM for develop and for changes alike (measured 8 November 2026: 9
scenarios over on develop, 8 on the EXP-034 change): compare two builds in one run, as every entry does.
