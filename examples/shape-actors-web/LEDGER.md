# Performance experiment ledger

_Generated from `ledger.json` by perf-ledger. Do not edit by hand._

Every performance experiment on a web + native 2D stage (a kids' game engine), kept or rejected, so later work starts from what was already measured. Numbers come from the project's perf suite on a 4-vCPU cloud VM with Chromium CPU throttling (6x = low-end phone, 3x = mid-range): compare within one row, not across rows run on different days.

| id | date | area | experiment | before | after | decision | evidence |
|---|---|---|---|---|---|---|---|
| EXP-001 | 2026-11-07 | native | **Native stage: per-frame picture out of React state**<br>setPicture in the stage root re-renders the whole stage tree each frame on the JS thread | 60 renders / 60 frames | 0 renders / 60 frames | kept (#763) | lib/shape-actors/__tests__/ShapeActorStage.native.perf.test.tsx (red on old file) |
| EXP-002 | 2026-11-07 | native+web | **Picker preview tiles: clock armed before onReady + freeze()**<br>start() after onReady undid the tiles' stop(): every preview animated at 60 fps | tiles ticking | time stays 0 | kept (#763) | ShapeActorStage.native.perf.test.tsx |
| EXP-003 | 2026-11-07 | engine | **Engine: gaze + hover pick once per frame**<br>2-4 pointer events per frame on 120/240 Hz screens each scan the cast | 0.89 ms (120 Hz) -> 1.42 ms (240 Hz) | flat per frame regardless of input rate | kept (#763) | node-bench rows drag-240hz |
| EXP-004 | 2026-11-07 | web | **Web: read layout once per frame (no forced sync layout)**<br>renderFeel and the particle canvas read clientWidth/Height after the frame's writes | renderFeel 1.6 s self in a 3 s drag (forced layout) | renderFeel out of the top list | kept (#763) | web-trace + CPU profile |
| EXP-005 | 2026-11-07 | web | **Web: off-screen objects visibility:hidden**<br>far objects need not be painted | market idle 100 % dropped | 3.7 % dropped (with EXP-004/006) | kept, then superseded by EXP-012 (#763) | web-bench A/B ab-base vs ab-new |
| EXP-006 | 2026-11-07 | web | **Web: adaptive quality governor (levels 1-2)**<br>on sustained slow frames drop spotlight filters, halve idle wobble | market drag-hold 21 % | ~10 % dropped | kept (#763) | web-bench dist-gov |
| EXP-007 | 2026-11-07 | native | **Skia: wash rect clipped to the view**<br>a world-wide translucent rect is expensive to raster | raster 28 ms with wash | unchanged (software-raster artefact); kept as correct | kept (neutral on CanvasKit; GPU fill pass on device) (#763) | scripts/perf node isolation, session notes |
| EXP-008 | 2026-11-07 | native | **Skia: backdrop in 1024-unit clipped tiles**<br>replaying ~9 000 backdrop ops per frame is wasteful | whole picture | up to 881 differing channels at seams after develop's richer scenery | REJECTED (replaced by EXP-009) (#763) | skia-parity FAIL on market @1024 |
| EXP-009 | 2026-11-07 | native | **Skia: backdrop as unclipped op chunks, on-screen chunks replayed**<br>chunks in paint order need no clip, so pixels are exact | all 182 market chunks replayed | 11 of 182 replayed; 0 differing channels | kept (#763) | npm run perf:parity |
| EXP-010 | 2026-11-07 | web | **Web: composite the backdrop <g> (will-change)**<br>a composited backdrop would not repaint under moving objects | Paint 6.26 s | Paint 6.46 s (no effect) | REJECTED | web-trace --css '[data-layer=backdrop]{will-change:transform}' |
| EXP-011 | 2026-11-07 | web | **Web: display:none on actor ROOTS for culling**<br>visibility:hidden still walks nodes | Paint 2.3 s | Paint 1.6 s, total unchanged; breaks scrollIntoView on far actors | REJECTED (superseded by EXP-012) | web-trace experiment |
| EXP-012 | 2026-11-07 | web | **Web: display:none on actor BODIES, root + pad kept**<br>remove far drawings from the render tree but keep a box for hit tests and scrollIntoView | RunTask 20.1 s, Paint 5.8 s (low-end market drag) | RunTask 17.1 s (-15 %), Paint 4.5 s | kept (#788) | lowEndView.webdom.test.ts |
| EXP-013 | 2026-11-07 | web | **Web: quality level 3 (idle redraw every 4th frame)**<br>idle breathing is the bulk of per-frame invalidations on low-end | idle every 2nd frame at level 2 | every 4th, staggered; busy every frame | kept (#788) | lowEndView.webdom.test.ts |
| EXP-014 | 2026-11-07 | web | **Web: skip unchanged part transforms (no strings)**<br>GC ~2.5 % of a low-end drag frame from per-part strings | GC 593 ms in a drag profile | resting parts allocate nothing | kept (#788) | CPU profile |
| EXP-015 | 2026-11-07 | startup | **Catalog: selector index for interaction validation**<br>4 444 rules x 3 697 blueprints x 2 matches per kit build | 2 351 ms | 298 ms (7.9x); 0 mismatches over 8 888 selectors | kept (develop landed the same fix in parallel, 3e82b422; develop's version merged) (#788) | node-bench startup rail |
| EXP-016 | 2026-11-07 | web | **Web: scenery raster tiles (SVG images per 1024 units)**<br>~1 500 visible scenery vectors are ~75 % of idle paint | idle paint 901 ms/3 s; market idle 98.7 % dropped | paint 232 ms (upper bound); market idle 54.5 % dropped; <= 0.003 % pixels differ | kept (#788) | scenery-tiles-parity, web-bench |
| EXP-017 | 2026-11-07 | web | **Web: word-card text via canvas measureText**<br>getComputedTextLength forces a full layout on every tap | forced layout per card | widths equal within 0.02 % | kept (#788) | session measurement |
| EXP-018 | 2026-11-07 | web | **Web: batch tap-pad getBBox reads before writes**<br>getBBox per object between writes = one full layout per object on world open | view.render 3 441 ms during open | 835 ms (with EXP-019) | kept | scripts/perf/web-bench world-open |
| EXP-019 | 2026-11-07 | web+memory | **Web: lazy scenery DOM (only near view, until its tile loads)**<br>building ~29 000 scenery nodes is the largest part of opening a world | market open 8 947 ms, 34 398 nodes, 72.3 MB heap; idle 43 % dropped | 2 301 ms (-74 %), 8 258 nodes, 68.7 MB; idle 3 % dropped | kept | web-bench l2s vs l2a; leak-check.mjs |
| EXP-020 | 2026-11-07 | memory | **Memory: world reload leak check**<br>a door or remount may leak DOM/listeners | nodes 8 251, listeners 644 | nodes 8 251, listeners 644; heap plateau (+0.17 MB 2nd half) | no leak (check added to suite) | scripts/perf/leak-check.mjs |
| EXP-021 | 2026-11-07 | native | **Skia: record backdrop chunks lazily (first time in view)**<br>a world's first frame records all ~180 backdrop chunks though ~11 are visible | first frame: market 198 ms, playground 96 ms, zoo 66 ms | first frame: market 124 ms, playground 41 ms, zoo 44 ms; scroll worst 3.6 ms/frame; parity 0 differing channels | kept | npm run perf:parity; session measurement script |
| EXP-022 | 2026-11-07 | web | **Web: nightfall cost (shade silhouettes)**<br>the night shade layer clones all scenery ops at nightfall (day_and_night is on for Dunyati) | suspected ~29 000 extra nodes | worst frame 17 ms, 0 long frames, no node growth | no action (measured: not a cost) | session measurement |
| EXP-023 | 2026-11-07 | web+native | **Paint plan memoised + numeric data-* attributes compared before formatting**<br>paintOrder/paintPlan re-sort and re-key the cast every frame (~280 ms of a low-end drag's JS), and 5 numbers per object are formatted every frame although unchanged | paintOrder+layer+paintPlan ~280 ms, f() 193 ms per 150-move drag; market drag-slow 27/31 % dropped | plan reused (same array) unless lane/depth/size/rest/riders change; market drag-slow 23/24 %; playground mixed (55/49 -> 39/49 %) | kept (modest, deterministic CPU cut; no regression) | web-bench interleaved; JS profile |
| EXP-024 | 2026-11-07 | engine (web + native) | **Engine: far objects at rest sleep (no update)**<br>the engine updates all ~90 objects every frame though ~5 are on screen; far, resting ones change nothing visible | engine p95: idle 0.41, drag-slow 0.80, drag-hold 0.51-0.69, tap-spam 0.36-0.44, swipe 0.61 ms | idle 0.12-0.16 (-65 %), drag-slow 0.41-0.52 (-40 %), drag-hold 0.24-0.28 (-55 %), tap-spam 0.12-0.20, swipe 0.56-0.61 (a swipe wakes the cast) | kept | lowEndEngine.test.ts (2 guards red on old engine); node-bench |
| EXP-025 | 2026-11-07 | native memory | **Native memory: dispose retired frame pictures and replaced backdrop chunks**<br>per-frame SkPictures are native memory the JS GC cannot size; on low-RAM Android the native heap fills between collections | every frame picture (60/s) and every old world's backdrop chunks left to GC | frame pictures disposed 2 frames after replacement; chunk pictures disposed on world change; picture on screen never disposed | kept (hygiene; device memory NOT measured here) | lib/shape-actors/__tests__/frameStore.retire.test.ts |
| EXP-026 | 2026-11-07 | engine (web + native) | **Engine: swipes, hops and scroll jiggles only move objects in reach of the view**<br>a background swipe nudged all ~90 objects, waking the whole world (swipe was the worst low-end case at 87-93 % dropped) | swipe-nudge engine p95 0.69 / 0.75 ms | 0.35 / 0.33 ms (-53 %); far objects stay asleep; browser low-end swipe (interleaved x2): market 61/75 -> 38/29 % dropped, input 86/64 -> 55/47 ms; playground 80/88 -> 74/79 %, input 95/132 -> 73/77 ms | kept | lowEndEngine.test.ts (swipe guard red on old engine) |
| EXP-027 | 2026-11-07 | web | **Web: far objects out of the render tree skip per-frame bookkeeping (refresh every 30th frame)**<br>~85 of ~90 objects are far and mostly asleep, yet the render loop did their far-check, wash, 8 state attributes and filter every frame | sum of dropped % over 12 cells: 236.3 | 203.6 (-14 %); market drag-slow 31.5/19.4 -> 24.5/17.0 %, drag-hold 8.4/2.1 -> 4.3/0.9 %; playground cells within noise both ways | kept (deterministic JS cut; state attributes of far objects at most 0.5 s behind) | web-bench interleaved |
| EXP-028 | 2026-11-08 | web | **Web: particle canvas at 1 device px per CSS px on sustained slow frames**<br>while dragging, sparkles keep the DPR-2 particle canvas redrawn and re-uploaded every frame (CSS experiment: hiding it cut a low-end drag 11.6 -> 8.5 s of main-thread work) | Commit 2 197 ms per drag trace; playground drag-slow 56/38 %, tap-spam 45/21 %, drag-hold 30/13 % | Commit 1 650 ms; playground drag-slow 25/23 % (input 102/85 -> 77/78 ms), tap-spam 14/16 %, drag-hold 16/15 %; market neutral to better (tap 24/20 -> 14/16 %) | kept (only at adaptive quality 2+; particles are small soft shapes) | web-trace --css canvas experiment; web-bench interleaved |
| EXP-029 | 2026-11-08 | web memory | **Web: remove scenery vectors once their tile covers them (not hide)**<br>scrolling across a world piles up hidden scenery vectors (swipe grew a playground DOM 9.8k -> 17.8k nodes) | nodes: market open 8 258, after swipe 10 965; playground open 7 189; swipe dropped 53 / 18 %, edge-scroll 28 / 20 % | market open 6 782, after swipe 8 702; playground open 6 409; layout objects -25 %; swipe 49 / 15 %, edge-scroll 24 / 15 %; leak-check ok | kept | web-bench; leak-check.mjs |
| EXP-030 | 2026-11-08 | web | **Web: particle canvas sized to its live particles' box (rejected)**<br>hiding the particle canvas cut a low-end market drag's compositor commit 2.2 -> 0.4 s; a canvas covering only the particles' box (vs the whole view) would upload far fewer pixels | commit: market drag 1 939 / 2 412 ms, playground drag 1 302 / 1 363 ms, playground swipe 940 / 918 ms; web-bench sum of dropped % over 20 cells x 2 runs: 672 | commit: market drag 1 877 / 1 786 ms, playground drag 1 335 / 1 399 ms, playground swipe 905 / 839 ms; dropped sum 670 (noise: before-1 vs before-2 differ up to 34 points per cell); canvas area 58 % of the view in spread cases; parity: 0 pixels outside the box, 0.37 % of channels differ (edge anti-aliasing) | rejected | results/EXP-030/traces.txt, parity.txt; on this GPU-less VM the canvas commit cost is per update, not per pixel; reverted, web-trace --profile kept. Follow-up (also rejected): particles at half rate under quality 2+ cut swipe commit only 845/804 -> 811/728 ms (market drag never reaches quality 2). CSS ablation, low-end market drag commit: visible 2 149 ms, display:none 366, visibility:hidden 393, opacity:0 435, canvas CSS-shrunk to 1 px (same bitmap) 2 255: the cost is a visible canvas layer on this VM's software compositor, independent of its area or update rate here; not pursued further without a GPU device (results/EXP-030/traces-half-rate.txt) |
| EXP-031 | 2026-11-08 | web | **Web: zone arrows bob from the stage frame, not a CSS keyframe animation**<br>a forced style recalc at the start of every frame (render's first layout read) is caused by something invalidating style between frames | forced style recalc 334/333 ms per low-end playground drag trace; total style 1 105 ms; low playground swipe 76/81 %, drag-slow 49/43 %, market swipe 40/42 %; dropped-sum 745, input-p95-sum 2 640 ms | forced 10/15 ms; low playground swipe 36/37 %, drag-slow 20/24 %, tap-spam 25/36 -> 17/24 %, market swipe 11/20 %, market drag-hold 8/17 -> 1/3 %; mid unchanged; dropped-sum 432, input-p95-sum 2 386 ms | kept | results/EXP-031/traces.txt; zoneNavBob.webdom.test.ts (red on the CSS-animation version). The infinite sa-beckon keyframe animation on the zone arrows was ticked on the main thread (will-change did not composite it here); same 6 px / 1.8 s bob now written after the view's reads. Not verified on a GPU device, where the CSS animation may composite; on a software-composited low-end device it would cost the same as here. Motion parity in the browser (arrow box sampled every frame for 3.6 s, both builds): amplitude 6 / 6 px, period 1 800 / 1 800 ms, curves within 0.11 px. Like every stage animation it pauses with the stage when off screen. Recording: docs/proof/2026-11-08-dunyati-loop3/low-end-playground (regenerate with record-ab.mjs; binaries not checked in) |
| EXP-032 | 2026-11-08 | web | **Web: part/body transforms as one composed matrix() (rejected)**<br>setAttribute is the top native main-thread cost after EXP-031 (683 ms swipe / 834 ms drag), mostly 'transform' (~26 writes a frame); a microbenchmark put one matrix() string at ~45 % less write+style time than the six-step list | swipe rAF 2 434 / 2 424 ms, style 785 / 744; drag rAF 3 934 / 3 882 ms, style 1 057 / 1 005 | swipe rAF 2 521 / 2 400 ms, style 784 / 740; drag rAF 4 084 / 3 792 ms, style 1 063 / 1 025 (no change). Parity held (0.0015 units on a 500-unit object, with inputs rounded to 0.01 as the old lists were; unrounded, a rigged object far along a world moved ~50 units) | rejected | results/EXP-032/traces.txt. The isolated gain does not carry into the stage: per-write parsing is not what the frame waits on. Reverted; web-trace --attrs kept |
| EXP-033 | 2026-11-08 | web | **Web: the world's static layers paint from an underlay svg**<br>paint (display-list recording, main thread) re-records the static backdrop and scenery every frame because they share one svg with the moving cast; layer ablation of a low-end playground drag: cast ~1.1 s, backdrop ~0.6 s, scenery ~0.5 s of 2.2 s | paint: playground drag 2 093 / 2 060 ms, swipe 1 567 / 1 534 ms, market drag 905 / 931 ms; web-bench dropped-sum 639, input-p95-sum 2 738 ms | paint: playground drag 1 091 / 1 064 ms, swipe 716 / 707 ms, market drag 671 / 687 ms; dropped-sum 462 (-28 %), input-p95-sum 2 398 ms (-12 %); e.g. low playground swipe 49/50 -> 35/28 %, low market drag-fast 12/16 -> 9/3 %, mid playground drag-slow 9/9 -> 3/5 % | kept | results/EXP-033/traces.txt; stage-parity.mjs --no-cast: 3 worlds x 3 scroll positions pixel-identical (a clientWidth-sized underlay first re-sampled the scenery by a fraction of a pixel: sized from the exact fractional box); with the cast, before-vs-after differs no more than before-vs-before. stageUnderlay.webdom.test.ts (red on the single-svg view). Photo keeps the world. Paint is main-thread display-list work, so unlike EXP-030 this does not depend on the GPU |
| EXP-034 | 2026-11-08 | web,engine | **World open: backdrop built once, shape measurements cached**<br>Opening a world (every door) built the web backdrop twice (the load, then the host's fit) and re-measured every part of every actor (SVG path parsing) and re-asked per-blueprint questions (size class, clean-up families) on every load. | web world-open total low 12362 ms / mid 6687 ms (8 worlds); node warm load sum 40.5 ms (17 worlds), worst 3.59 ms; kit build 245 ms | low 8731 ms (-29%) / mid 4550 ms (-32%), every world faster (19-43%); node sum 26.3 ms (-35%), worst 2.58 ms; kit build 175 ms. Re-measured after rebasing on develop db61cd17 (EXP-033 static underlay): low 12604 -> 8703 ms (-30.9 %), mid 6813 -> 4533 ms (-33.5 %), every world -26..-42 % (results/EXP-034/*-rebased.json) | kept | 1122 scenes identical (6740 dirt spots); backdrop pixels identical (36 states); worldOpen.webdom.test (red without the guard or the scenery mark); record-open veh-roads 2488 -> 1550 ms, playground 1216 -> 980 ms at 6x. DOM nodes after idle read higher (veh-roads 10594 -> 12588): every extra node is inside the scenery raster-tile images (removing the tile <image>s leaves 6511 vs 6529). On develop the second, redundant backdrop build discarded the tiles before the ones under the camera were rasterised (only tile 0 of veh-roads ever became an image), so the visible scenery stayed live vectors repainted every frame; now the tiles in view rasterise as designed, which is also why idle dropped frames fell (low veh-harbour 11.43 -> 4.81 %).. On the rebased tree: viewport pixels of the stage (cast, effects and the area banner hidden) identical in 20/24 states; the other 4 differ by 8-71 px on wave/hill edges at a raster-tile boundary (tile image vs live vectors) and the sun glow, the same order as a same-build control (8 and 34 px). |
| EXP-035 | 2026-11-08 | web | **Web: the moving layers drawn on a canvas by the native Skia renderer (renderer 'auto')**<br>after EXP-033 the moving cast is ~half of a low-end frame's paint: every frame the browser re-records and re-rasterises the svg of every visible object; drawing them on one canvas with the SkiaStageRenderer native already ships removes that | svg: software-compositing traces paint 1.1-1.2 s per low-end playground drag; GPU path (--gpu) dropped-sum 4 335 over 24 cells x 2 runs, input-p95-sum 9 580 ms | canvas: software path paint -65 %, rAF JS equal, but compositor commit +0.6-0.7 s (each canvas frame copied on the main thread): drag RunTask -8..10 %, idle worse. GPU path: dropped-sum 1 894 (-56 %), input-p95-sum 6 233 ms (-35 %); e.g. low playground drag-hold 99.7/99.9 -> 15/20 %, tap-spam (mid) 100/100 -> 19/18 %, low market drag-fast 95/95 -> 25/18 %; swipe small gains. Parity: <= 0.6 % px differ > 24/255 (edge AA); hit actor >= 99.95 %, part >= 99.67 %; e2e identical in both renderers | kept (renderer 'auto' default: canvas where the browser composites on a GPU, svg under software compositing / software GL) | results/EXP-035/*. On GPU-less runners the GPU path is emulated on the same CPU (SwiftShader): svg's per-frame raster competes for CPU, so the GPU-path magnitude is likely overstated vs real phone GPUs; direction agrees with the software-path paint -65 %. Not verified on a real device. Native renderer unchanged except opt-in options; native still draws a part that precedes its parent in z order nested (ostrich tuft over head) unlike the web |

## Runs

- **LOOP-1** (2026-11-07, #788): Low-end loop 1, loop start (5713f787) vs loop end (EXP-012..017). Raw: `experiments/results/LOOP-1/after-web-low.json`, `experiments/results/LOOP-1/after-web-mid.json`, `experiments/results/LOOP-1/before-web-low.json`, `experiments/results/LOOP-1/before-web-mid.json`
- **LOOP-2-CHECKPOINT** (2026-11-07, #797, #801): Loop 2 start (develop @ #791) vs after EXP-018..024 (develop @ #801): low + mid, frames, world open, memory. Raw: `experiments/results/LOOP-2-CHECKPOINT/after-web-low.json`, `experiments/results/LOOP-2-CHECKPOINT/after-web-mid.json`, `experiments/results/LOOP-2-CHECKPOINT/before-web-low.json`, `experiments/results/LOOP-2-CHECKPOINT/before-web-mid.json`
- **LOOP-2-FINAL** (2026-11-07, #803): Loop 2 start (develop @ #791) vs loop 2 end (develop @ #803), screen recordings: world open at 6x market 6 984 -> 1 965 ms; low-end playground HUD 33-53 -> 41-60 fps (20-28 -> 5-17 % dropped); mid-range market 45-60 -> steady 60 fps. Recordings regenerate with scripts/perf/record-ab.mjs and record-open.mjs (binaries are not checked in).. Raw: `experiments/results/EXP-026/before-web-low.json`, `experiments/results/EXP-026/after-web-low.json`

## Details

### EXP-001 · Native stage: per-frame picture out of React state

- **Area:** native
- **Hypothesis:** setPicture in the stage root re-renders the whole stage tree each frame on the JS thread
- **Method:** jest guard counting stage renders over 60 drag frames (one act per frame)
- **Before:** 60 renders / 60 frames
- **After:** 0 renders / 60 frames
- **Decision:** kept (#763)
- **Evidence:** lib/shape-actors/__tests__/ShapeActorStage.native.perf.test.tsx (red on old file)

### EXP-002 · Picker preview tiles: clock armed before onReady + freeze()

- **Area:** native+web
- **Hypothesis:** start() after onReady undid the tiles' stop(): every preview animated at 60 fps
- **Method:** jest: frozen preview never ticks after start()
- **Before:** tiles ticking
- **After:** time stays 0
- **Decision:** kept (#763)
- **Evidence:** ShapeActorStage.native.perf.test.tsx

### EXP-003 · Engine: gaze + hover pick once per frame

- **Area:** engine
- **Hypothesis:** 2-4 pointer events per frame on 120/240 Hz screens each scan the cast
- **Method:** node-bench drag-120hz vs drag-240hz engine p95
- **Before:** 0.89 ms (120 Hz) -> 1.42 ms (240 Hz)
- **After:** flat per frame regardless of input rate
- **Decision:** kept (#763)
- **Evidence:** node-bench rows drag-240hz
- **Raw results (checked in):** `experiments/results/EXP-003/after-node.json`, `experiments/results/EXP-003/before-node.json`

### EXP-004 · Web: read layout once per frame (no forced sync layout)

- **Area:** web
- **Hypothesis:** renderFeel and the particle canvas read clientWidth/Height after the frame's writes
- **Method:** CPU profile, low-end drag
- **Before:** renderFeel 1.6 s self in a 3 s drag (forced layout)
- **After:** renderFeel out of the top list
- **Decision:** kept (#763)
- **Evidence:** web-trace + CPU profile

### EXP-005 · Web: off-screen objects visibility:hidden

- **Area:** web
- **Hypothesis:** far objects need not be painted
- **Method:** low-end A/B, median of 3
- **Before:** market idle 100 % dropped
- **After:** 3.7 % dropped (with EXP-004/006)
- **Decision:** kept, then superseded by EXP-012 (#763)
- **Evidence:** web-bench A/B ab-base vs ab-new
- **Raw results (checked in):** `experiments/results/EXP-005/after-web-low.json`, `experiments/results/EXP-005/before-web-low.json`

### EXP-006 · Web: adaptive quality governor (levels 1-2)

- **Area:** web
- **Hypothesis:** on sustained slow frames drop spotlight filters, halve idle wobble
- **Method:** low-end A/B
- **Before:** market drag-hold 21 %
- **After:** ~10 % dropped
- **Decision:** kept (#763)
- **Evidence:** web-bench dist-gov

### EXP-007 · Skia: wash rect clipped to the view

- **Area:** native
- **Hypothesis:** a world-wide translucent rect is expensive to raster
- **Method:** CanvasKit raster isolation (drag vs drag-nofocus)
- **Before:** raster 28 ms with wash
- **After:** unchanged (software-raster artefact); kept as correct
- **Decision:** kept (neutral on CanvasKit; GPU fill pass on device) (#763)
- **Evidence:** scripts/perf node isolation, session notes

### EXP-008 · Skia: backdrop in 1024-unit clipped tiles

- **Area:** native
- **Hypothesis:** replaying ~9 000 backdrop ops per frame is wasteful
- **Method:** skia-parity (pixel diff) + raster timing
- **Before:** whole picture
- **After:** up to 881 differing channels at seams after develop's richer scenery
- **Decision:** REJECTED (replaced by EXP-009) (#763)
- **Evidence:** skia-parity FAIL on market @1024

### EXP-009 · Skia: backdrop as unclipped op chunks, on-screen chunks replayed

- **Area:** native
- **Hypothesis:** chunks in paint order need no clip, so pixels are exact
- **Method:** skia-parity, 4 worlds x 6 cameras; chunk count
- **Before:** all 182 market chunks replayed
- **After:** 11 of 182 replayed; 0 differing channels
- **Decision:** kept (#763)
- **Evidence:** npm run perf:parity

### EXP-010 · Web: composite the backdrop <g> (will-change)

- **Area:** web
- **Hypothesis:** a composited backdrop would not repaint under moving objects
- **Method:** web-trace --css, low-end market drag
- **Before:** Paint 6.26 s
- **After:** Paint 6.46 s (no effect)
- **Decision:** REJECTED
- **Evidence:** web-trace --css '[data-layer=backdrop]{will-change:transform}'

### EXP-011 · Web: display:none on actor ROOTS for culling

- **Area:** web
- **Hypothesis:** visibility:hidden still walks nodes
- **Method:** web-trace drag market 6x
- **Before:** Paint 2.3 s
- **After:** Paint 1.6 s, total unchanged; breaks scrollIntoView on far actors
- **Decision:** REJECTED (superseded by EXP-012)
- **Evidence:** web-trace experiment

### EXP-012 · Web: display:none on actor BODIES, root + pad kept

- **Area:** web
- **Hypothesis:** remove far drawings from the render tree but keep a box for hit tests and scrollIntoView
- **Method:** web-trace --css '[visibility=hidden]{display:none}' then implementation
- **Before:** RunTask 20.1 s, Paint 5.8 s (low-end market drag)
- **After:** RunTask 17.1 s (-15 %), Paint 4.5 s
- **Decision:** kept (#788)
- **Evidence:** lowEndView.webdom.test.ts
- **Raw results (checked in):** `experiments/results/EXP-012/after-web-low.json`, `experiments/results/EXP-012/before-web-low.json`

### EXP-013 · Web: quality level 3 (idle redraw every 4th frame)

- **Area:** web
- **Hypothesis:** idle breathing is the bulk of per-frame invalidations on low-end
- **Method:** lowEndView test + A/B
- **Before:** idle every 2nd frame at level 2
- **After:** every 4th, staggered; busy every frame
- **Decision:** kept (#788)
- **Evidence:** lowEndView.webdom.test.ts

### EXP-014 · Web: skip unchanged part transforms (no strings)

- **Area:** web
- **Hypothesis:** GC ~2.5 % of a low-end drag frame from per-part strings
- **Method:** CPU profile
- **Before:** GC 593 ms in a drag profile
- **After:** resting parts allocate nothing
- **Decision:** kept (#788)
- **Evidence:** CPU profile

### EXP-015 · Catalog: selector index for interaction validation

- **Area:** startup
- **Hypothesis:** 4 444 rules x 3 697 blueprints x 2 matches per kit build
- **Method:** kit build timing (node), equivalence over all selectors
- **Before:** 2 351 ms
- **After:** 298 ms (7.9x); 0 mismatches over 8 888 selectors
- **Decision:** kept (develop landed the same fix in parallel, 3e82b422; develop's version merged) (#788)
- **Evidence:** node-bench startup rail

### EXP-016 · Web: scenery raster tiles (SVG images per 1024 units)

- **Area:** web
- **Hypothesis:** ~1 500 visible scenery vectors are ~75 % of idle paint
- **Method:** web-trace --css scenery hidden (upper bound), A/B, browser pixel parity
- **Before:** idle paint 901 ms/3 s; market idle 98.7 % dropped
- **After:** paint 232 ms (upper bound); market idle 54.5 % dropped; <= 0.003 % pixels differ
- **Decision:** kept (#788)
- **Evidence:** scenery-tiles-parity, web-bench
- **Raw results (checked in):** `experiments/results/EXP-016/after-web-low.json`, `experiments/results/EXP-016/before-web-low.json`

### EXP-017 · Web: word-card text via canvas measureText

- **Area:** web
- **Hypothesis:** getComputedTextLength forces a full layout on every tap
- **Method:** width comparison svg vs canvas (AR/EN)
- **Before:** forced layout per card
- **After:** widths equal within 0.02 %
- **Decision:** kept (#788)
- **Evidence:** session measurement

### EXP-018 · Web: batch tap-pad getBBox reads before writes

- **Area:** web
- **Hypothesis:** getBBox per object between writes = one full layout per object on world open
- **Method:** world-open breakdown at 6x (market)
- **Before:** view.render 3 441 ms during open
- **After:** 835 ms (with EXP-019)
- **Decision:** kept
- **Evidence:** scripts/perf/web-bench world-open

### EXP-019 · Web: lazy scenery DOM (only near view, until its tile loads)

- **Area:** web+memory
- **Hypothesis:** building ~29 000 scenery nodes is the largest part of opening a world
- **Method:** web-bench world-open + memory, low-end, same run
- **Before:** market open 8 947 ms, 34 398 nodes, 72.3 MB heap; idle 43 % dropped
- **After:** 2 301 ms (-74 %), 8 258 nodes, 68.7 MB; idle 3 % dropped
- **Decision:** kept
- **Evidence:** web-bench l2s vs l2a; leak-check.mjs
- **Raw results (checked in):** `experiments/results/EXP-019/after-web-low.json`, `experiments/results/EXP-019/before-web-low.json`
- **A/B (loop-2 start (develop @ #791) → EXP-018 + EXP-019):**
  - low/market: world open 8947.5→2301.1 ms, heap 72.27→68.68 MB, nodes 34398→8258
  - low/playground: world open 3418.4→1726.5 ms, heap 67.54→66.44 MB, nodes 14797→7189
  - low/market/idle: dropped 43.41→3.16 %
  - low/market/drag-slow: dropped 76.92→47.46 %, input p95 169.1→107.2 ms
  - low/playground/idle: dropped 26.32→14.55 %
  - low/playground/drag-slow: dropped 67.29→65.73 %, input p95 130.6→126.9 ms

### EXP-020 · Memory: world reload leak check

- **Area:** memory
- **Hypothesis:** a door or remount may leak DOM/listeners
- **Method:** leak-check.mjs: 10 remounts + 10 door reloads, GC before each read
- **Before:** nodes 8 251, listeners 644
- **After:** nodes 8 251, listeners 644; heap plateau (+0.17 MB 2nd half)
- **Decision:** no leak (check added to suite)
- **Evidence:** scripts/perf/leak-check.mjs
- **Raw results (checked in):** `experiments/results/EXP-020/memory-baseline-web-low.json`

### EXP-021 · Skia: record backdrop chunks lazily (first time in view)

- **Area:** native
- **Hypothesis:** a world's first frame records all ~180 backdrop chunks though ~11 are visible
- **Method:** node: SkiaStageRenderer first-frame draw time per world, then a 3000-unit scroll; skia-parity
- **Before:** first frame: market 198 ms, playground 96 ms, zoo 66 ms
- **After:** first frame: market 124 ms, playground 41 ms, zoo 44 ms; scroll worst 3.6 ms/frame; parity 0 differing channels
- **Decision:** kept
- **Evidence:** npm run perf:parity; session measurement script

### EXP-022 · Web: nightfall cost (shade silhouettes)

- **Area:** web
- **Hypothesis:** the night shade layer clones all scenery ops at nightfall (day_and_night is on for Dunyati)
- **Method:** browser 6x, market: setAmbience night, 4 s of frames, DOM node count
- **Before:** suspected ~29 000 extra nodes
- **After:** worst frame 17 ms, 0 long frames, no node growth
- **Decision:** no action (measured: not a cost)
- **Evidence:** session measurement

### EXP-023 · Paint plan memoised + numeric data-* attributes compared before formatting

- **Area:** web+native
- **Hypothesis:** paintOrder/paintPlan re-sort and re-key the cast every frame (~280 ms of a low-end drag's JS), and 5 numbers per object are formatted every frame although unchanged
- **Method:** JS profile (drag, 6x); interleaved A/B x2, low-end, market + playground
- **Before:** paintOrder+layer+paintPlan ~280 ms, f() 193 ms per 150-move drag; market drag-slow 27/31 % dropped
- **After:** plan reused (same array) unless lane/depth/size/rest/riders change; market drag-slow 23/24 %; playground mixed (55/49 -> 39/49 %)
- **Decision:** kept (modest, deterministic CPU cut; no regression)
- **Evidence:** web-bench interleaved; JS profile
- **Raw results (checked in):** `experiments/results/EXP-023/after-l2c-l2c-816.json`, `experiments/results/EXP-023/before-l2c-l2a-30311.json`
- **A/B (l2a → l2c):**
  - low/market: world open 2212.9→2162.5 ms
  - low/playground: world open 1493.7→1508.3 ms
  - low/market/idle: dropped 2.62→3.19 %, heap 69.31→69.22 MB, nodes 10955→10955
  - low/market/drag-slow: dropped 27.01→22.88 %, input p95 77.8→82.6 ms, heap 70.02→70.08 MB, nodes 12226→12275
  - low/market/drag-hold: dropped 5.3→2.86 %, input p95 55.3→53.1 ms, heap 70.13→70.07 MB, nodes 10968→10968
  - low/playground/idle: dropped 12.14→7.78 %, heap 67.14→67 MB, nodes 9848→9848
  - low/playground/drag-slow: dropped 54.66→39.25 %, input p95 100.9→100.6 ms, heap 67.77→67.68 MB, nodes 12320→11492
  - low/playground/drag-hold: dropped 19.82→27.85 %, input p95 67.3→82.9 ms, heap 67.94→67.79 MB, nodes 9868→9868

### EXP-024 · Engine: far objects at rest sleep (no update)

- **Area:** engine (web + native)
- **Hypothesis:** the engine updates all ~90 objects every frame though ~5 are on screen; far, resting ones change nothing visible
- **Method:** node-bench engine p95, old vs new StageController, interleaved x2 (market, playground, zoo); lowEndEngine.test.ts
- **Before:** engine p95: idle 0.41, drag-slow 0.80, drag-hold 0.51-0.69, tap-spam 0.36-0.44, swipe 0.61 ms
- **After:** idle 0.12-0.16 (-65 %), drag-slow 0.41-0.52 (-40 %), drag-hold 0.24-0.28 (-55 %), tap-spam 0.12-0.20, swipe 0.56-0.61 (a swipe wakes the cast)
- **Decision:** kept
- **Evidence:** lowEndEngine.test.ts (2 guards red on old engine); node-bench
- **Raw results (checked in):** `experiments/results/EXP-024/before-node.json`, `experiments/results/EXP-024/after-node.json`

### EXP-025 · Native memory: dispose retired frame pictures and replaced backdrop chunks

- **Area:** native memory
- **Hypothesis:** per-frame SkPictures are native memory the JS GC cannot size; on low-RAM Android the native heap fills between collections
- **Method:** retire rule unit test (frameStore.retire.test.ts); not measurable on this VM (no device)
- **Before:** every frame picture (60/s) and every old world's backdrop chunks left to GC
- **After:** frame pictures disposed 2 frames after replacement; chunk pictures disposed on world change; picture on screen never disposed
- **Decision:** kept (hygiene; device memory NOT measured here)
- **Evidence:** lib/shape-actors/__tests__/frameStore.retire.test.ts

### EXP-026 · Engine: swipes, hops and scroll jiggles only move objects in reach of the view

- **Area:** engine (web + native)
- **Hypothesis:** a background swipe nudged all ~90 objects, waking the whole world (swipe was the worst low-end case at 87-93 % dropped)
- **Method:** node-bench swipe-nudge engine p95, old vs new, interleaved x2; lowEndEngine.test.ts swipe guard
- **Before:** swipe-nudge engine p95 0.69 / 0.75 ms
- **After:** 0.35 / 0.33 ms (-53 %); far objects stay asleep; browser low-end swipe (interleaved x2): market 61/75 -> 38/29 % dropped, input 86/64 -> 55/47 ms; playground 80/88 -> 74/79 %, input 95/132 -> 73/77 ms
- **Decision:** kept
- **Evidence:** lowEndEngine.test.ts (swipe guard red on old engine)
- **Raw results (checked in):** `experiments/results/EXP-026/after-node.json`, `experiments/results/EXP-026/after-web-low.json`, `experiments/results/EXP-026/before-node.json`, `experiments/results/EXP-026/before-web-low.json`

### EXP-027 · Web: far objects out of the render tree skip per-frame bookkeeping (refresh every 30th frame)

- **Area:** web
- **Hypothesis:** ~85 of ~90 objects are far and mostly asleep, yet the render loop did their far-check, wash, 8 state attributes and filter every frame
- **Method:** interleaved A/B x2, low-end, playground + market, idle / drag-slow / drag-hold
- **Before:** sum of dropped % over 12 cells: 236.3
- **After:** 203.6 (-14 %); market drag-slow 31.5/19.4 -> 24.5/17.0 %, drag-hold 8.4/2.1 -> 4.3/0.9 %; playground cells within noise both ways
- **Decision:** kept (deterministic JS cut; state attributes of far objects at most 0.5 s behind)
- **Evidence:** web-bench interleaved
- **Raw results (checked in):** `experiments/results/EXP-027/after-fb-l2f-9027.json`, `experiments/results/EXP-027/before-fb-l2e-13337.json`
- **A/B (l2e → l2f):**
  - low/playground: world open 1604.9→1558.1 ms
  - low/market: world open 2253.1→2251.2 ms
  - low/playground/idle: dropped 8.33→7.1 %, heap 66.9→66.88 MB, nodes 9848→9848
  - low/playground/drag-slow: dropped 52.68→58.61 %, input p95 106.2→123.4 ms, heap 67.61→67.47 MB, nodes 12243→12251
  - low/playground/drag-hold: dropped 20.57→27.42 %, input p95 61.2→69.9 ms, heap 67.71→67.69 MB, nodes 9867→9866
  - low/market/idle: dropped 0→0 %, heap 68.98→68.96 MB, nodes 10955→10955
  - low/market/drag-slow: dropped 31.51→24.46 %, input p95 89.8→76.2 ms, heap 69.69→69.66 MB, nodes 12269→12271
  - low/market/drag-hold: dropped 8.36→4.26 %, input p95 56.6→51.8 ms, heap 69.83→69.8 MB, nodes 10968→10968

### EXP-028 · Web: particle canvas at 1 device px per CSS px on sustained slow frames

- **Area:** web
- **Hypothesis:** while dragging, sparkles keep the DPR-2 particle canvas redrawn and re-uploaded every frame (CSS experiment: hiding it cut a low-end drag 11.6 -> 8.5 s of main-thread work)
- **Method:** web-trace drag playground 6x; interleaved A/B x2 low-end
- **Before:** Commit 2 197 ms per drag trace; playground drag-slow 56/38 %, tap-spam 45/21 %, drag-hold 30/13 %
- **After:** Commit 1 650 ms; playground drag-slow 25/23 % (input 102/85 -> 77/78 ms), tap-spam 14/16 %, drag-hold 16/15 %; market neutral to better (tap 24/20 -> 14/16 %)
- **Decision:** kept (only at adaptive quality 2+; particles are small soft shapes)
- **Evidence:** web-trace --css canvas experiment; web-bench interleaved
- **Raw results (checked in):** `experiments/results/EXP-028/after-l3a-l3a-23058.json`, `experiments/results/EXP-028/before-l3a-l3s-29607.json`
- **A/B (l3s → l3a):**
  - low/playground: world open 1208.3→1234 ms
  - low/market: world open 1754.4→1787.3 ms
  - low/playground/drag-slow: dropped 55.93→25.47 %, input p95 101.6→76.8 ms, heap 67.31→67.42 MB, nodes 12264→12242
  - low/playground/drag-hold: dropped 29.67→16.45 %, input p95 69.8→63.9 ms, heap 67.68→67.67 MB, nodes 9868→9868
  - low/playground/tap-spam: dropped 45→13.71 %, input p95 117.8→73.8 ms, heap 67.86→67.89 MB, nodes 9872→9896
  - low/playground/swipe-nudge: dropped 68.81→59.33 %, input p95 68.9→66.9 ms, heap 70.01→70.01 MB, nodes 17878→17857
  - low/market/drag-slow: dropped 13.32→16.31 %, input p95 67.9→69.4 ms, heap 69.53→69.55 MB, nodes 12259→12275
  - low/market/drag-hold: dropped 1.5→4.26 %, input p95 51→54 ms, heap 69.76→69.74 MB, nodes 10968→10968
  - low/market/tap-spam: dropped 24.1→13.82 %, input p95 75.3→75.2 ms, heap 66.08→65.99 MB, nodes 2789→2791
  - low/market/swipe-nudge: dropped 33.94→30.61 %, input p95 68.9→64.3 ms, heap 66.37→66.39 MB, nodes 3208→3208

### EXP-029 · Web: remove scenery vectors once their tile covers them (not hide)

- **Area:** web memory
- **Hypothesis:** scrolling across a world piles up hidden scenery vectors (swipe grew a playground DOM 9.8k -> 17.8k nodes)
- **Method:** web-bench low-end swipe + edge-scroll + world open (2 reps); leak-check
- **Before:** nodes: market open 8 258, after swipe 10 965; playground open 7 189; swipe dropped 53 / 18 %, edge-scroll 28 / 20 %
- **After:** market open 6 782, after swipe 8 702; playground open 6 409; layout objects -25 %; swipe 49 / 15 %, edge-scroll 24 / 15 %; leak-check ok
- **Decision:** kept
- **Evidence:** web-bench; leak-check.mjs
- **Raw results (checked in):** `experiments/results/EXP-029/after-l3b-l3b.json`, `experiments/results/EXP-029/before-l3b-l3a.json`
- **A/B (l3a → l3b):**
  - low/playground: world open 1235.2→1264.6 ms
  - low/market: world open 1602→1674.9 ms
  - low/playground/swipe-nudge: dropped 53.48→49.18 %, input p95 64.3→57.4 ms, heap 67.19→67.06 MB, nodes 9852→8075
  - low/playground/drag-edge-scroll: dropped 28.17→24.14 %, input p95 79.3→66.8 ms, heap 67.64→67.53 MB, nodes 11420→9442
  - low/market/swipe-nudge: dropped 17.96→14.98 %, input p95 50.5→64.7 ms, heap 69.23→69.1 MB, nodes 10965→8702
  - low/market/drag-edge-scroll: dropped 19.63→15.11 %, input p95 51.9→70.3 ms, heap 69.88→69.69 MB, nodes 11631→9287

### EXP-030 · Web: particle canvas sized to its live particles' box (rejected)

- **Area:** web
- **Hypothesis:** hiding the particle canvas cut a low-end market drag's compositor commit 2.2 -> 0.4 s; a canvas covering only the particles' box (vs the whole view) would upload far fewer pixels
- **Method:** web-trace drag/swipe interleaved x2 (commit ms); web-bench low+mid interleaved x2; browser pixel parity of 160 random particle fields
- **Before:** commit: market drag 1 939 / 2 412 ms, playground drag 1 302 / 1 363 ms, playground swipe 940 / 918 ms; web-bench sum of dropped % over 20 cells x 2 runs: 672
- **After:** commit: market drag 1 877 / 1 786 ms, playground drag 1 335 / 1 399 ms, playground swipe 905 / 839 ms; dropped sum 670 (noise: before-1 vs before-2 differ up to 34 points per cell); canvas area 58 % of the view in spread cases; parity: 0 pixels outside the box, 0.37 % of channels differ (edge anti-aliasing)
- **Decision:** rejected
- **Evidence:** results/EXP-030/traces.txt, parity.txt; on this GPU-less VM the canvas commit cost is per update, not per pixel; reverted, web-trace --profile kept. Follow-up (also rejected): particles at half rate under quality 2+ cut swipe commit only 845/804 -> 811/728 ms (market drag never reaches quality 2). CSS ablation, low-end market drag commit: visible 2 149 ms, display:none 366, visibility:hidden 393, opacity:0 435, canvas CSS-shrunk to 1 px (same bitmap) 2 255: the cost is a visible canvas layer on this VM's software compositor, independent of its area or update rate here; not pursued further without a GPU device (results/EXP-030/traces-half-rate.txt)
- **Raw results (checked in):** `experiments/results/EXP-030/after-after-2.json`, `experiments/results/EXP-030/before-before-2.json`, `experiments/results/EXP-030/parity.txt`, `experiments/results/EXP-030/traces.txt`
- **A/B (before-2 → after-2):**
  - low/playground: world open 1364.6→1338.1 ms
  - low/market: world open 1256.9→1442.6 ms
  - mid/playground: world open 725.2→677.5 ms
  - mid/market: world open 748.5→661.5 ms
  - low/playground/drag-slow: dropped 35.4→32.88 %, input p95 95.4→97.7 ms, heap 34.25→34.15 MB, nodes 10169→10161
  - low/playground/drag-hold: dropped 24.74→18.47 %, input p95 81.4→68.3 ms, heap 34.55→34.36 MB, nodes 8091→8083
  - low/playground/drag-fast: dropped 53.24→19.89 %, input p95 100.7→67.5 ms, heap 34.59→34.62 MB, nodes 8075→8077
  - low/playground/swipe-nudge: dropped 81→75.52 %, input p95 82.2→72.2 ms, heap 34.63→34.59 MB, nodes 8079→8076
  - low/playground/tap-spam: dropped 35.42→23.08 %, input p95 117.4→102.4 ms, heap 34.71→34.68 MB, nodes 8090→8087
  - low/market/drag-slow: dropped 22.67→22.45 %, input p95 76→78.4 ms, heap 34.9→34.87 MB, nodes 9958→8728
  - low/market/drag-hold: dropped 10.48→8.89 %, input p95 61.9→58.1 ms, heap 35.09→35.11 MB, nodes 7564→7564
  - low/market/drag-fast: dropped 13.39→9.49 %, input p95 57.4→60.8 ms, heap 35.26→35.16 MB, nodes 7575→7571
  - low/market/swipe-nudge: dropped 36.48→36.36 %, input p95 57.1→72.6 ms, heap 35.19→35.15 MB, nodes 7560→7562
  - low/market/tap-spam: dropped 24.22→23.93 %, input p95 112.7→97.6 ms, heap 33.01→32.99 MB, nodes 2782→2797
  - mid/playground/drag-slow: dropped 3.41→5.04 %, input p95 55.3→59.6 ms, heap 33.91→34.17 MB, nodes 10372→10384
  - mid/playground/drag-hold: dropped 1.67→2.1 %, input p95 53.1→53.1 ms, heap 34.13→34.33 MB, nodes 8546→8528
  - mid/playground/drag-fast: dropped 2.75→3.17 %, input p95 52.4→53.2 ms, heap 34.22→34.49 MB, nodes 8534→8520
  - mid/playground/swipe-nudge: dropped 28.83→34.08 %, input p95 58.6→47 ms, heap 34.19→34.59 MB, nodes 8513→8512
  - mid/playground/tap-spam: dropped 1.43→0.9 %, input p95 58.1→51.7 ms, heap 34.28→34.63 MB, nodes 8539→8540
  - mid/market/drag-slow: dropped 3.39→1.1 %, input p95 56.1→54.1 ms, heap 34.74→34.77 MB, nodes 8826→8834
  - mid/market/drag-hold: dropped 0.33→0.17 %, input p95 50.5→50.2 ms, heap 34.99→35.02 MB, nodes 7829→7825
  - mid/market/drag-fast: dropped 0.85→0.14 %, input p95 50.9→49.9 ms, heap 35.01→35.04 MB, nodes 7819→7819
  - mid/market/swipe-nudge: dropped 19.57→3.27 %, input p95 47.5→48.6 ms, heap 35.03→35.04 MB, nodes 7838→7828
  - mid/market/tap-spam: dropped 4.2→1.49 %, input p95 64.3→63.8 ms, heap 33.03→33.05 MB, nodes 2783→2783

### EXP-031 · Web: zone arrows bob from the stage frame, not a CSS keyframe animation

- **Area:** web
- **Hypothesis:** a forced style recalc at the start of every frame (render's first layout read) is caused by something invalidating style between frames
- **Method:** web-trace --stacks (forced style/layout by script); CSS ablation; web-bench low+mid, playground+market, interleaved x2
- **Before:** forced style recalc 334/333 ms per low-end playground drag trace; total style 1 105 ms; low playground swipe 76/81 %, drag-slow 49/43 %, market swipe 40/42 %; dropped-sum 745, input-p95-sum 2 640 ms
- **After:** forced 10/15 ms; low playground swipe 36/37 %, drag-slow 20/24 %, tap-spam 25/36 -> 17/24 %, market swipe 11/20 %, market drag-hold 8/17 -> 1/3 %; mid unchanged; dropped-sum 432, input-p95-sum 2 386 ms
- **Decision:** kept
- **Evidence:** results/EXP-031/traces.txt; zoneNavBob.webdom.test.ts (red on the CSS-animation version). The infinite sa-beckon keyframe animation on the zone arrows was ticked on the main thread (will-change did not composite it here); same 6 px / 1.8 s bob now written after the view's reads. Not verified on a GPU device, where the CSS animation may composite; on a software-composited low-end device it would cost the same as here. Motion parity in the browser (arrow box sampled every frame for 3.6 s, both builds): amplitude 6 / 6 px, period 1 800 / 1 800 ms, curves within 0.11 px. Like every stage animation it pauses with the stage when off screen. Recording: docs/proof/2026-11-08-dunyati-loop3/low-end-playground (regenerate with record-ab.mjs; binaries not checked in)
- **Raw results (checked in):** `experiments/results/EXP-031/after-after-2.json`, `experiments/results/EXP-031/before-before-2.json`, `experiments/results/EXP-031/traces.txt`
- **A/B (before-2 → after-2):**
  - low/playground: world open 1343.3→1217.5 ms
  - low/market: world open 1444.4→1261.8 ms
  - mid/playground: world open 698.1→691.6 ms
  - mid/market: world open 638.3→691.3 ms
  - low/playground/idle: dropped 15.29→10.73 %, heap 33.63→33.74 MB, nodes 8064→8064
  - low/playground/drag-slow: dropped 43.26→23.64 %, input p95 92.3→79.9 ms, heap 34.16→34.21 MB, nodes 10158→10159
  - low/playground/drag-hold: dropped 20.65→11.23 %, input p95 63.5→61.6 ms, heap 34.45→34.46 MB, nodes 8084→8084
  - low/playground/drag-fast: dropped 23.33→16.61 %, input p95 64.1→66.6 ms, heap 34.61→34.61 MB, nodes 8082→8085
  - low/playground/swipe-nudge: dropped 81.07→37.38 %, input p95 82.8→63.3 ms, heap 34.65→34.64 MB, nodes 8078→8067
  - low/playground/tap-spam: dropped 35.71→24.46 %, input p95 109.5→91.9 ms, heap 34.75→34.8 MB, nodes 8087→8097
  - low/market/idle: dropped 0→0 %, heap 34.27→34.27 MB, nodes 7551→7551
  - low/market/drag-slow: dropped 28.39→14.73 %, input p95 70.3→69.4 ms, heap 34.92→34.96 MB, nodes 8708→9909
  - low/market/drag-hold: dropped 16.87→2.52 %, input p95 56.3→52.3 ms, heap 35.17→35.19 MB, nodes 7564→7573
  - low/market/drag-fast: dropped 19.74→8.57 %, input p95 54→54.3 ms, heap 35.21→35.2 MB, nodes 7563→7563
  - low/market/swipe-nudge: dropped 41.94→19.88 %, input p95 58.3→54 ms, heap 35.21→35.23 MB, nodes 7558→7574
  - low/market/tap-spam: dropped 23.1→23.01 %, input p95 89.4→77.7 ms, heap 33.06→33.06 MB, nodes 2789→2799
  - mid/playground/idle: dropped 0→0 %, heap 33.55→33.51 MB, nodes 8508→8508
  - mid/playground/drag-slow: dropped 6.23→2.88 %, input p95 61.7→55.7 ms, heap 34.12→34.2 MB, nodes 10366→10451
  - mid/playground/drag-hold: dropped 0.52→0.69 %, input p95 50.6→50 ms, heap 34.36→34.36 MB, nodes 8528→8528
  - mid/playground/drag-fast: dropped 0.56→0.42 %, input p95 50.8→50 ms, heap 34.54→34.56 MB, nodes 8520→8520
  - mid/playground/swipe-nudge: dropped 30.91→22.89 %, input p95 45.9→47.5 ms, heap 34.6→34.65 MB, nodes 8519→8512
  - mid/playground/tap-spam: dropped 0→0.61 %, input p95 49.5→50.2 ms, heap 34.72→34.8 MB, nodes 8540→8531
  - mid/market/idle: dropped 0→0 %, heap 34.24→34.11 MB, nodes 7807→7807
  - mid/market/drag-slow: dropped 1.38→2.06 %, input p95 52.6→51.6 ms, heap 34.82→34.75 MB, nodes 8840→9934
  - mid/market/drag-hold: dropped 0.25→0.08 %, input p95 50.3→50 ms, heap 35.06→35.08 MB, nodes 7829→7820
  - mid/market/drag-fast: dropped 0.14→0 %, input p95 50→50 ms, heap 35.08→35.1 MB, nodes 7827→7819
  - mid/market/swipe-nudge: dropped 3.83→4.26 %, input p95 59.2→44.2 ms, heap 35.11→35.03 MB, nodes 7816→7814
  - mid/market/tap-spam: dropped 0.89→1.2 %, input p95 60.8→70.8 ms, heap 33.13→33.09 MB, nodes 2783→2783

### EXP-032 · Web: part/body transforms as one composed matrix() (rejected)

- **Area:** web
- **Hypothesis:** setAttribute is the top native main-thread cost after EXP-031 (683 ms swipe / 834 ms drag), mostly 'transform' (~26 writes a frame); a microbenchmark put one matrix() string at ~45 % less write+style time than the six-step list
- **Method:** web-trace --attrs (writes by name); microbenchmark 30 nodes x 300 frames at 6x; browser-oracle parity of 40 000 poses; web-trace swipe/drag playground interleaved x2
- **Before:** swipe rAF 2 434 / 2 424 ms, style 785 / 744; drag rAF 3 934 / 3 882 ms, style 1 057 / 1 005
- **After:** swipe rAF 2 521 / 2 400 ms, style 784 / 740; drag rAF 4 084 / 3 792 ms, style 1 063 / 1 025 (no change). Parity held (0.0015 units on a 500-unit object, with inputs rounded to 0.01 as the old lists were; unrounded, a rigged object far along a world moved ~50 units)
- **Decision:** rejected
- **Evidence:** results/EXP-032/traces.txt. The isolated gain does not carry into the stage: per-write parsing is not what the frame waits on. Reverted; web-trace --attrs kept

### EXP-033 · Web: the world's static layers paint from an underlay svg

- **Area:** web
- **Hypothesis:** paint (display-list recording, main thread) re-records the static backdrop and scenery every frame because they share one svg with the moving cast; layer ablation of a low-end playground drag: cast ~1.1 s, backdrop ~0.6 s, scenery ~0.5 s of 2.2 s
- **Method:** layer ablation (web-trace --css); in-page prototype (web-trace --eval); stage-parity.mjs; web-trace interleaved x2 (drag/swipe playground, drag market); web-bench low+mid interleaved x2
- **Before:** paint: playground drag 2 093 / 2 060 ms, swipe 1 567 / 1 534 ms, market drag 905 / 931 ms; web-bench dropped-sum 639, input-p95-sum 2 738 ms
- **After:** paint: playground drag 1 091 / 1 064 ms, swipe 716 / 707 ms, market drag 671 / 687 ms; dropped-sum 462 (-28 %), input-p95-sum 2 398 ms (-12 %); e.g. low playground swipe 49/50 -> 35/28 %, low market drag-fast 12/16 -> 9/3 %, mid playground drag-slow 9/9 -> 3/5 %
- **Decision:** kept
- **Evidence:** results/EXP-033/traces.txt; stage-parity.mjs --no-cast: 3 worlds x 3 scroll positions pixel-identical (a clientWidth-sized underlay first re-sampled the scenery by a fraction of a pixel: sized from the exact fractional box); with the cast, before-vs-after differs no more than before-vs-before. stageUnderlay.webdom.test.ts (red on the single-svg view). Photo keeps the world. Paint is main-thread display-list work, so unlike EXP-030 this does not depend on the GPU
- **Raw results (checked in):** `experiments/results/EXP-033/after-after-2.json`, `experiments/results/EXP-033/after-run1.json`, `experiments/results/EXP-033/before-before-2.json`, `experiments/results/EXP-033/before-run1.json`, `experiments/results/EXP-033/traces.txt`
- **A/B (before-2 → after-2):**
  - low/playground: world open 1369.2→1357.9 ms
  - low/market: world open 1326.7→1330.2 ms
  - mid/playground: world open 718.6→696.8 ms
  - mid/market: world open 649→629.3 ms
  - low/playground/idle: dropped 5.38→16.07 %, heap 33.65→33.66 MB, nodes 8064→8065
  - low/playground/drag-slow: dropped 33.63→38.06 %, input p95 81.8→100.1 ms, heap 34.18→34.2 MB, nodes 10217→10164
  - low/playground/drag-hold: dropped 17.14→12.33 %, input p95 63.8→69 ms, heap 34.39→34.48 MB, nodes 8084→8085
  - low/playground/drag-fast: dropped 20.7→13.95 %, input p95 64→68 ms, heap 34.64→34.59 MB, nodes 8077→8078
  - low/playground/swipe-nudge: dropped 49.68→27.76 %, input p95 65.7→56.8 ms, heap 34.76→34.68 MB, nodes 8068→8076
  - low/playground/tap-spam: dropped 35.69→17.42 %, input p95 104.2→70.5 ms, heap 34.88→34.8 MB, nodes 8087→8088
  - low/market/idle: dropped 0→0 %, heap 34.28→34.35 MB, nodes 7551→7552
  - low/market/drag-slow: dropped 20.49→11.15 %, input p95 69.6→70.7 ms, heap 34.93→34.97 MB, nodes 9909→9910
  - low/market/drag-hold: dropped 6.72→1.63 %, input p95 54.3→50.7 ms, heap 35.16→35.22 MB, nodes 7564→7565
  - low/market/drag-fast: dropped 15.9→2.91 %, input p95 60.5→51.9 ms, heap 35.2→35.27 MB, nodes 7563→7576
  - low/market/swipe-nudge: dropped 28.75→16.82 %, input p95 51.8→46.4 ms, heap 35.23→35.29 MB, nodes 7559→7570
  - low/market/tap-spam: dropped 32.82→18.24 %, input p95 108.6→72.6 ms, heap 33.05→33.08 MB, nodes 2782→2783
  - mid/playground/idle: dropped 0→0.51 %, heap 33.51→33.61 MB, nodes 8508→8509
  - mid/playground/drag-slow: dropped 9.41→4.69 %, input p95 64.6→58.6 ms, heap 34.33→34.25 MB, nodes 9871→10374
  - mid/playground/drag-hold: dropped 2.87→1.03 %, input p95 53.3→50.5 ms, heap 34.5→34.42 MB, nodes 8542→8529
  - mid/playground/drag-fast: dropped 3.46→2.01 %, input p95 51.3→53.9 ms, heap 34.54→34.49 MB, nodes 8538→8521
  - mid/playground/swipe-nudge: dropped 23.74→20.72 %, input p95 50.3→50.7 ms, heap 34.62→34.55 MB, nodes 8508→8513
  - mid/playground/tap-spam: dropped 2.93→1.8 %, input p95 58.2→57.8 ms, heap 34.72→34.77 MB, nodes 8547→8547
  - mid/market/idle: dropped 0→0 %, heap 34.15→34.16 MB, nodes 7807→7808
  - mid/market/drag-slow: dropped 1.66→0.96 %, input p95 50.9→50.5 ms, heap 34.84→34.84 MB, nodes 8831→9935
  - mid/market/drag-hold: dropped 0.17→0.08 %, input p95 50→49.9 ms, heap 35.08→35.11 MB, nodes 7820→7821
  - mid/market/drag-fast: dropped 0.71→0 %, input p95 50.2→50 ms, heap 35.25→35.09 MB, nodes 7843→7818
  - mid/market/swipe-nudge: dropped 6.85→5.62 %, input p95 47.8→44.7 ms, heap 35.19→35.11 MB, nodes 7815→7827
  - mid/market/tap-spam: dropped 2.69→1.8 %, input p95 67.3→62.5 ms, heap 33.11→33.13 MB, nodes 2783→2784

### EXP-034 · World open: backdrop built once, shape measurements cached

- **Area:** web,engine
- **Hypothesis:** Opening a world (every door) built the web backdrop twice (the load, then the host's fit) and re-measured every part of every actor (SVG path parsing) and re-asked per-blueprint questions (size class, clean-up families) on every load.
- **Method:** Web rail world-open (load to two painted frames), 8 worlds x low/mid throttle, median of 3 interleaved rounds against the develop demo build; node A/B of 17 warm-kit world loads interleaved x5; profiles (Chromium CPU at 6x, node --cpu-prof); scene fingerprint over all 561 worlds x 2 sizes; backdrop pixel compare after open, door and back.
- **Before:** web world-open total low 12362 ms / mid 6687 ms (8 worlds); node warm load sum 40.5 ms (17 worlds), worst 3.59 ms; kit build 245 ms
- **After:** low 8731 ms (-29%) / mid 4550 ms (-32%), every world faster (19-43%); node sum 26.3 ms (-35%), worst 2.58 ms; kit build 175 ms. Re-measured after rebasing on develop db61cd17 (EXP-033 static underlay): low 12604 -> 8703 ms (-30.9 %), mid 6813 -> 4533 ms (-33.5 %), every world -26..-42 % (results/EXP-034/*-rebased.json)
- **Decision:** kept
- **Evidence:** 1122 scenes identical (6740 dirt spots); backdrop pixels identical (36 states); worldOpen.webdom.test (red without the guard or the scenery mark); record-open veh-roads 2488 -> 1550 ms, playground 1216 -> 980 ms at 6x. DOM nodes after idle read higher (veh-roads 10594 -> 12588): every extra node is inside the scenery raster-tile images (removing the tile <image>s leaves 6511 vs 6529). On develop the second, redundant backdrop build discarded the tiles before the ones under the camera were rasterised (only tile 0 of veh-roads ever became an image), so the visible scenery stayed live vectors repainted every frame; now the tiles in view rasterise as designed, which is also why idle dropped frames fell (low veh-harbour 11.43 -> 4.81 %).. On the rebased tree: viewport pixels of the stage (cast, effects and the area banner hidden) identical in 20/24 states; the other 4 differ by 8-71 px on wave/hill edges at a raster-tile boundary (tile image vs live vectors) and the sun glow, the same order as a same-build control (8 and 34 px).
- **Raw results (checked in):** `experiments/results/EXP-034/after-web.json`, `experiments/results/EXP-034/before-web.json`
- **A/B (before-dist → after-dist):**
  - low/playground: world open 1789.4→1010.1 ms
  - low/market: world open 1526.4→1072.5 ms
  - low/zoo: world open 1184.7→904.8 ms
  - low/farm: world open 1475.6→1055.7 ms
  - low/veh-roads: world open 1844.1→1276.2 ms
  - low/veh-airport: world open 1922.6→1156.2 ms
  - low/veh-harbour: world open 1017.4→785.3 ms
  - low/haul-site: world open 1789.6→1270.1 ms
  - mid/playground: world open 876.2→553.1 ms
  - mid/market: world open 896.5→563.2 ms
  - mid/zoo: world open 650.4→402.1 ms
  - mid/farm: world open 811.6→550 ms
  - mid/veh-roads: world open 1083.1→722 ms
  - mid/veh-airport: world open 1027.9→642.6 ms
  - mid/veh-harbour: world open 540.3→420 ms
  - mid/haul-site: world open 914.4→861.5 ms
  - low/playground/idle: dropped 19.14→10.17 %, heap 33.63→34.05 MB, nodes 8064→9502
  - low/market/idle: dropped 0.51→0 %, heap 34.32→34.71 MB, nodes 7551→9902
  - low/zoo/idle: dropped 7.1→4.28 %, heap 33.34→33.79 MB, nodes 6989→7693
  - low/farm/idle: dropped 0→2.09 %, heap 33.6→34.18 MB, nodes 8308→9284
  - low/veh-roads/idle: dropped 3.17→2.08 %, heap 35.36→35.84 MB, nodes 10594→12588
  - low/veh-airport/idle: dropped 0→1.55 %, heap 34.66→35.27 MB, nodes 9704→11210
  - low/veh-harbour/idle: dropped 11.43→4.81 %, heap 32.71→33.33 MB, nodes 6071→6650
  - low/haul-site/idle: dropped 2.09→2.08 %, heap 34.96→35.3 MB, nodes 8721→11641
  - mid/playground/idle: dropped 1.55→0 %, heap 33.52→33.97 MB, nodes 8508→9841
  - mid/market/idle: dropped 0.51→0 %, heap 34.15→34.56 MB, nodes 7807→9941
  - mid/zoo/idle: dropped 0→0.52 %, heap 33.37→33.74 MB, nodes 7294→7963
  - mid/farm/idle: dropped 0→0 %, heap 33.62→34 MB, nodes 8623→9506
  - mid/veh-roads/idle: dropped 0→0 %, heap 35.31→35.8 MB, nodes 11248→13358
  - mid/veh-airport/idle: dropped 0→0 %, heap 34.59→34.93 MB, nodes 10465→11877
  - mid/veh-harbour/idle: dropped 0→0.52 %, heap 32.7→33.31 MB, nodes 6260→6786
  - mid/haul-site/idle: dropped 0→0 %, heap 34.84→35.21 MB, nodes 9060→11770

### EXP-035 · Web: the moving layers drawn on a canvas by the native Skia renderer (renderer 'auto')

- **Area:** web
- **Hypothesis:** after EXP-033 the moving cast is ~half of a low-end frame's paint: every frame the browser re-records and re-rasterises the svg of every visible object; drawing them on one canvas with the SkiaStageRenderer native already ships removes that
- **Method:** CanvasStage + 2D-canvas Skia adapter (own transform stack), hit test = the drawing replayed (isPointInPath) in DOM order; canvas-parity.mjs + canvas-hit-parity.mjs on frozen frames; e2e suite in both renderers; web-trace interleaved (software compositing); web-bench low+mid interleaved x2 with --gpu (GPU raster + compositing on SwiftShader)
- **Before:** svg: software-compositing traces paint 1.1-1.2 s per low-end playground drag; GPU path (--gpu) dropped-sum 4 335 over 24 cells x 2 runs, input-p95-sum 9 580 ms
- **After:** canvas: software path paint -65 %, rAF JS equal, but compositor commit +0.6-0.7 s (each canvas frame copied on the main thread): drag RunTask -8..10 %, idle worse. GPU path: dropped-sum 1 894 (-56 %), input-p95-sum 6 233 ms (-35 %); e.g. low playground drag-hold 99.7/99.9 -> 15/20 %, tap-spam (mid) 100/100 -> 19/18 %, low market drag-fast 95/95 -> 25/18 %; swipe small gains. Parity: <= 0.6 % px differ > 24/255 (edge AA); hit actor >= 99.95 %, part >= 99.67 %; e2e identical in both renderers
- **Decision:** kept (renderer 'auto' default: canvas where the browser composites on a GPU, svg under software compositing / software GL)
- **Evidence:** results/EXP-035/*. On GPU-less runners the GPU path is emulated on the same CPU (SwiftShader): svg's per-frame raster competes for CPU, so the GPU-path magnitude is likely overstated vs real phone GPUs; direction agrees with the software-path paint -65 %. Not verified on a real device. Native renderer unchanged except opt-in options; native still draws a part that precedes its parent in z order nested (ostrich tuft over head) unlike the web
- **Raw results (checked in):** `experiments/results/EXP-035/after-canvas-2.json`, `experiments/results/EXP-035/before-svg-2.json`, `experiments/results/EXP-035/canvas-parity.json`, `experiments/results/EXP-035/gpu-canvas-run1.json`, `experiments/results/EXP-035/gpu-svg-run1.json`, `experiments/results/EXP-035/hit-parity.txt`, `experiments/results/EXP-035/traces-software-compositing.txt`
- **A/B (svg-2 → canvas-2):**
  - low/playground: world open 1212.2→1265.2 ms
  - low/market: world open 1345.4→1196.1 ms
  - mid/playground: world open 683.4→668.6 ms
  - mid/market: world open 624.7→624.5 ms
  - low/playground/idle: dropped 72.13→7.78 %, heap 33.77→33.78 MB, nodes 8086→7380
  - low/playground/drag-slow: dropped 95.55→61.76 %, input p95 343.2→258.7 ms, heap 34.23→34.71 MB, nodes 9470→8797
  - low/playground/drag-hold: dropped 99.87→19.82 %, input p95 211.7→67.5 ms, heap 34.33→34.78 MB, nodes 8084→7396
  - low/playground/drag-fast: dropped 97.54→37.62 %, input p95 256.9→100.5 ms, heap 34.75→34.9 MB, nodes 8070→7393
  - low/playground/swipe-nudge: dropped 93.22→85.89 %, input p95 329.1→199.3 ms, heap 34.8→34.98 MB, nodes 8089→7393
  - low/playground/tap-spam: dropped 100→31.8 %, input p95 255.2→195.8 ms, heap 34.84→35.08 MB, nodes 8090→7401
  - low/market/idle: dropped 20.81→1.11 %, heap 34.32→34.45 MB, nodes 7552→6855
  - low/market/drag-slow: dropped 90.87→51.36 %, input p95 248.3→174.1 ms, heap 34.91→35.47 MB, nodes 8663→7970
  - low/market/drag-hold: dropped 78.08→14.04 %, input p95 106.9→66.6 ms, heap 35.23→35.42 MB, nodes 7565→6868
  - low/market/drag-fast: dropped 94.63→18.2 %, input p95 148→77.4 ms, heap 35.26→35.62 MB, nodes 7559→6868
  - low/market/swipe-nudge: dropped 89.39→83.9 %, input p95 158.9→194.1 ms, heap 35.45→35.57 MB, nodes 7577→6868
  - low/market/tap-spam: dropped 98.15→74.65 %, input p95 258.8→171.9 ms, heap 33.07→33.64 MB, nodes 2792→2570
  - mid/playground/idle: dropped 97.56→17.33 %, heap 33.63→33.71 MB, nodes 8509→7821
  - mid/playground/drag-slow: dropped 96.01→48.94 %, input p95 364.5→289 ms, heap 34.08→34.75 MB, nodes 9833→9110
  - mid/playground/drag-hold: dropped 99.87→30.43 %, input p95 234.2→87.3 ms, heap 34.23→34.87 MB, nodes 8528→7837
  - mid/playground/drag-fast: dropped 98.14→27.12 %, input p95 309.6→95.7 ms, heap 34.52→34.73 MB, nodes 8539→7834
  - mid/playground/swipe-nudge: dropped 90.98→82.07 %, input p95 261.3→178.7 ms, heap 34.76→34.84 MB, nodes 8540→7834
  - mid/playground/tap-spam: dropped 100→18.18 %, input p95 344.4→210.6 ms, heap 34.78→35.1 MB, nodes 8548→7842
  - mid/market/idle: dropped 74.12→2.23 %, heap 34.15→34.32 MB, nodes 7808→7110
  - mid/market/drag-slow: dropped 98.57→41.68 %, input p95 267.9→198 ms, heap 34.76→34.95 MB, nodes 8766→8076
  - mid/market/drag-hold: dropped 97.11→11.71 %, input p95 147.2→64.2 ms, heap 35.09→35.24 MB, nodes 7820→7123
  - mid/market/drag-fast: dropped 99.59→17.09 %, input p95 153.9→74 ms, heap 35.03→35.46 MB, nodes 7827→7123
  - mid/market/swipe-nudge: dropped 89.39→80.5 %, input p95 216.1→187.6 ms, heap 35.12→35.38 MB, nodes 7842→7123
  - mid/market/tap-spam: dropped 98.69→73.66 %, input p95 240.5→205.2 ms, heap 33.14→33.71 MB, nodes 2796→2570
