# Shape-actors performance suite

One rerunnable suite for the stage every Dunyati world runs on (`ShapeActorStage`: the Skia
renderer on iOS/Android, the SVG view on web). It measures the same interaction edge cases on
every rail, projects them onto low-, mid- and high-end devices, and gates them against budgets.

```sh
npm run perf            # everything: node rails + web rail (3 reps, low/mid/high), gated
npm run perf:quick      # fast local check: 3 themes, low-end web only, 1 rep
npm run perf:parity     # pixel parity of the chunked Skia backdrop (exit 1 on any difference)
node packages/shape-actors/scripts/perf/stage-parity.mjs --before <dist> --after <dist> --no-cast   # web: static world identical
node packages/shape-actors/scripts/perf/canvas-parity.mjs        # web canvas vs svg renderer, same frozen frame
node packages/shape-actors/scripts/perf/canvas-hit-parity.mjs    # presses land on the same actor/part in both renderers
node packages/shape-actors/scripts/perf/web-bench.mjs --renderer canvas --gpu   # also web-trace / record-ab (--renderers): pick the renderer; --gpu = GPU compositing path
npm run perf -- --only node --all                       # engine + Skia over every theme
npm run perf -- --only web --devices low --themes market --scenarios drag-slow,drag-hold
npm run perf -- --only web --dist /path/to/other/demo-dist   # A/B another build
npm run perf -- --update-baseline                        # record the web ratchet baseline
npm run perf -- --strict                                 # also gate absolute targets/projections
node packages/shape-actors/scripts/perf/web-trace.mjs drag market 6   # where a frame's time goes (+ forced style/layout)
node packages/shape-actors/scripts/perf/web-trace.mjs swipe playground 6 --profile --stacks   # JS self time; which script forced a layout
node packages/shape-actors/scripts/perf/record-ab.mjs --before <demo-dist> --after <demo-dist> --out <dir>
node packages/shape-actors/scripts/perf/record-open.mjs --before <demo-dist> --after <demo-dist> --out <dir>   # world-open recording
node packages/shape-actors/scripts/perf/leak-check.mjs --theme market               # memory leak check (exit 1 on growth)
node packages/shape-actors/scripts/perf/experiments/record-experiment.mjs --title … --ab before.json,after.json …
```

**Memory** is measured on every run: the web rail reads JS heap, DOM nodes and layout objects
after each scenario (after a forced GC) and times **world open** (load → two painted frames);
the node rails report heap held by one kit and by one loaded world. `leak-check.mjs` remounts
the stage and reloads the world 10× each and fails if nodes or listeners grow or the heap does
not plateau.

**Experiment ledger** (`experiments/`): every experiment, kept or rejected, with hypothesis,
method, before/after, decision and evidence. `ledger.json` is the source, `LEDGER.md` is
generated, and raw before/after bench JSON is checked in under `experiments/results/<id>/`.
Record each new experiment with `record-experiment.mjs` (`--ab` copies the two bench files in).

`record-ab.mjs` makes the screen recordings: the same real-touch script on two builds under the
same CPU throttle, with a live fps / dropped-frame HUD and a finger marker, stitched side by side
(needs ffmpeg). Build a demo with `node packages/shape-actors/scripts/build-demo.mjs --minify`
in each checkout (for example a `git worktree` of the base commit) to get the two `demo-dist`s.

If Playwright's pinned Chromium is not installed, point `SHAPE_ACTORS_CHROMIUM` at any Chromium
binary. Reports land in `perf-results/<stamp>/report.md` (git-ignored) with the raw JSON beside
them. Exit 0 = within budget, 1 = over budget, 3 = a rail could not run (a named skip, never a pass).

## Rails

| rail | file | what it measures |
|---|---|---|
| engine | `node-bench.ts` | every pointer event of a frame + one `StageController.tick` (the JS behind a frame) |
| Skia recording | `node-bench.ts` | `SkiaStageRenderer.draw()` into a picture on headless CanvasKit: the per-frame JS of the native stage, with canvas calls and Skia allocations per frame (each is a JSI crossing on device) |
| Skia raster | `node-bench.ts` | replaying that picture into a phone-sized surface (informational: CanvasKit rasterises in software) |
| web | `web-bench.mjs` | the real demo stage in Chromium with DevTools CPU throttling (low 6×, mid 3×, high 1.5×), real CDP touch (phones) or mouse (desktop): frame interval p50/p95/p99, dropped frames, long animation frames, input→next-frame latency |
| native React | `lib/shape-actors/__tests__/ShapeActorStage.native.perf.test.tsx` | a frame must repaint the Skia picture with **zero** re-renders of the stage tree, even mid-drag; a frozen preview never ticks |
| parity | `skia-parity.ts` | chunked backdrop = every op painted directly, pixel for pixel (exit 1 on any difference) |

## Edge cases (`scenarios.ts`, mirrored by name in `web-bench.mjs`)

`idle` · `drag-slow` (2 px/frame, hover + spotlight on) · `drag-fast` (40 px/frame zigzag) ·
`drag-120hz` / `drag-240hz` (2 / 4 pointer events per frame: ProMotion phones, iPad pencil) ·
`drag-over-targets` (hover target changes every visit) · `drag-hold` (6 s nearly still:
spotlight + beckon pulses) · `throw-spam` (grab-flick-release every 18 frames) ·
`drag-with-taps` (reactions + particles while dragging) · `drag-scroll` / `drag-edge-scroll`
(world scrolls under the finger) · `tap-spam` (10 taps/s) · `swipe-nudge` (whole cast reacts) ·
`drop-chain` (snaps, stacks, celebrations).

Default themes are the Dunyati worlds' environments plus the heaviest catalogue scenes
(`playground, market, library, museum, music, mosque, close-garden-potting, close-job-vet,
in-toolbox, zoo, farm, kitchen`); `--all` runs all of them.

## Budgets (`budgets.json`)

Every rail ratchets against `perf-baseline.json` (`--update-baseline` records it): a scenario
that gets slower than the baseline beyond a tolerance and an absolute noise floor fails. The
absolute numbers are reported on every run and gated with `--strict`: node rails project the
measured p95 × device slowdown onto a 16.7 ms frame (engine ≤ 6 ms and Skia recording ≤ 8 ms on
a low-end phone), the web rail has per-device dropped-frame and input-lag targets. A shared
GPU-less VM is neither a phone CPU nor a phone GPU, so on it those are reported, not gated.
Absolute numbers drift between runs on a shared VM: compare builds in the SAME run (`--dist`).

## What it found and what was fixed (November 2026)

See `docs/plans/2026-11-07-dunyati-drag-performance.md` and `docs/plans/2026-11-07-dunyati-low-end-loop.md`
(loops 1–3) for the measured before/after.
