# Environments suite (EXP-046 … EXP-053)

The scripts behind the environments, scenery and catalogue experiments: redrawing every environment,
then paying back what the richer art cost. Each takes a **checkout of the app repository**
(foundry-mobileapps) as an argument, so one session can measure several builds side by side
(rule 2: compare within a run). A checkout needs `node_modules`; a symlink to a sibling
checkout's is enough.

| script | measures | used by |
|---|---|---|
| `run.sh <out> A=<checkout> B=<checkout> …` | the whole session: start-up ×2 rounds interleaved, bundle, native frame bench | EXP-046, 047, 049 |
| `startup.ts <checkout>` | kit start-up per look, kit + opening the market, catalogue `JSON.parse` (median of 9) | EXP-046, 049 |
| `bundle.mjs <checkout>` | builds the package; JS loaded up front vs per-environment scenery chunks (raw + gzip) | EXP-046 |
| `kitprof.ts` | where kit start-up goes: object parse vs styling vs catalogue build | EXP-048 |
| `decor-eq.ts <old-catalog-dir>` | backdrop plan of every environment, old inline catalogue vs split + eager scenery | EXP-046 |
| `seam.ts <out.png> theme:zone,…` | the view centred exactly on a scenery repeat seam | EXP-051 |
| `sheet.ts <out.png> id,…` | objects/people side by side in one appearance | EXP-052 visual checks |
| `startup-video.mjs` | browser time-to-world per build at a CPU throttle (alternative to `../record-open.mjs`) | — |

The native frame bench is the suite's own `../node-bench.ts` (engine, Skia record, raster per
frame); the recordings are `../record-open.mjs` (world open) and `../record-ab.mjs` (drag).

## The session in the ledger

```sh
# three checkpoints of foundry-mobileapps, each a worktree with node_modules linked
#   A = develop before EXP-046 (0.23.3), B = after EXP-046/047 (0.24.0), C = after EXP-049 (0.25.0)
bash run.sh ../../experiments/results/ENV-LOOP-2026-11-09 A=<ckA> B=<ckB> C=<ckC>
```

Results: [`experiments/results/ENV-LOOP-2026-11-09`](../../experiments/results/ENV-LOOP-2026-11-09)
(4-vCPU VM, Node 22). Frames ran once per checkout (not interleaved), so a 5–10 % spread between B
and C on raster time is the machine, not the change: B and C draw the same.
