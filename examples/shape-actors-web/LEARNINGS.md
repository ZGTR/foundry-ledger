# Learnings from the shape-actors performance work

What the experiments in [`LEDGER.md`](LEDGER.md) taught, beyond each entry's own numbers. Each
point names the entries it comes from. The general rules are in the
[repository README](../../README.md#the-rules-the-ledger-encodes); these are the specific ones.

The same lessons are also recorded in the ledger itself (`learn`), as L-001 to L-038, each citing the
entries it rests on, so `check` refuses a learning whose evidence is missing. They render at the top
of [`LEDGER.md`](LEDGER.md); this page is the longer prose.

## Measuring

1. **One machine, one session, interleaved, more than once.** On the shared 4-vCPU VM the same
   build's numbers moved by about 30 % between consecutive runs, and a perf run with a test suite
   beside it doubled draw times. Every A/B that held up was before/after/before/after in one
   session, reported as a median (EXP-034: 5 interleaved node rounds, 3 web rounds; re-measured
   after a rebase, because develop had moved under it).
2. **A committed baseline from another machine is a ratchet, not a verdict.** The node rail's
   absolute gate failed on this VM for develop and for the change alike (9 vs 8 scenarios over);
   only the same-run comparison said anything about the change.
3. **The "where" before the "what".** The rig looked like the suspect for door stutter; measuring
   it alone (EXP-036) showed ≤0.14 ms a frame, and the worst-frame report pointed at the door
   frame instead, in loaded and unloaded worlds alike (EXP-037).
4. **Profile with the tool that sees the code.** An in-process inspector session attributed a whole
   synchronous loop to `post`; `node --cpu-prof` saw it. Transpiled single-line modules hide line
   ticks, so read the inclusive function tree instead.
5. **Name the frame, not the average.** p95 hid every door: frames were 1–3 ms at p95 while one
   frame per door cost 50–324 ms (EXP-037). The worst-frame list (frame number, tick, draw) is what
   found it.

## Proving nothing changed

6. **A speed-up is only kept with an identity check that could have failed.** EXP-034 fingerprinted
   all 561 worlds at two sizes (1 122 scenes: every actor's position, scale, pivots, floor, lane and
   6 740 dirt spots) against the base build: 0 differences, on the original base and again after
   the merge.
7. **Make sure the check can see the thing.** After develop moved the backdrop into an underlay
   SVG (EXP-033), a whole-world element screenshot came back uniformly blank in both builds and
   "matched" perfectly. Check that a capture has content (its standard deviation) before trusting
   a zero diff, and capture what the user sees (the visible stage), not an element that no longer
   holds the pixels.
8. **Run a same-build control before calling a pixel difference real.** Two captures of one build
   differed by 8–34 px (sun glow, drifting dust); the change's 8–71 px differences were that, plus
   anti-aliasing at a raster-tile edge.
9. **Hide what is meant to move.** A fading area-name banner caught at different moments was the
   largest "difference" until it was hidden.
10. **Mutation-test the regression test.** Every test added here was run red against the reverted
    fix (reversed merge order for EXP-037; the iris skip or the warm-up removed for EXP-038; the
    rebuild guard or the scenery mark removed for EXP-034).

## What was slow, and why it was cheap to fix

11. **Look for work done twice.** The web world open built the whole backdrop twice: once on load,
    once in the host's `fit()` (EXP-034, −31 % on low-end). The second build also threw away raster
    tiles before they finished, so the visible scenery stayed live vectors. A metric that *rose*
    (DOM nodes +10–35 %) was those tiles finally rasterising: it counts the nodes inside each tile
    image's SVG document. Explain a regression in a side metric before shipping, and say so in the
    entry.
12. **Per-object facts are computed once per object.** Shape boxes (SVG path parsing), part pivots,
    size class and clean-up families were recomputed on every load for every actor (EXP-034); a
    linear first-match scan over ~4 400 interaction rules ran per new pair of actors (EXP-037).
    Catalogue objects are frozen, so a `WeakMap` keyed by the object is safe; the index must keep
    the original rule order, which its test pins.
13. **Spread one-off work over frames nobody is watching.** A door waits ~45 frames while its iris
    closes, and a fully closed iris hides the whole scene. The next world's paths are built in
    ≤1 ms slices during the wait, nothing but the iris is drawn under a closed iris, so the load
    and the first draw land on different frames (EXP-038).
14. **Parallel sessions converge.** Develop landed lazy backdrop chunks (EXP-021) and catalog
    selector indexing (EXP-015) while the same ideas were in flight elsewhere. Rebase before
    claiming a gain, and re-measure against the new base: EXP-038's recorded gain is only the part
    develop did not already have.

## Test-suite hygiene seen along the way

15. **Separate flakes from failures by rerunning alone.** In each full run under 4 workers, 2–5
    suites failed once and then passed 3/3 alone; the real failures failed alone too.
16. **A stale `node_modules` looks like a code bug.** Seven build-CLI test failures were one missing
    plugin package; `npm ci` fixed them, not a commit.

## Environments, scenery and catalogue (EXP-046 … EXP-053, Nov 2026)

Redrawing every environment, then paying back what the richer art cost. Recorded with `learn` as
L-039 to L-048; the suite is [`suite/environments`](suite/environments).


### Measure before you pick the fix

17. **The obvious fix was the wrong one (EXP-048, rejected).** Fetching object files per
   environment looked like the next step after splitting the scenery. Measured first: parsing all
   6.3 MB of object data cost ~45 ms, while *preparing* the 3 697 objects (inheritance, validation,
   measuring, styling, particle effects) cost ~340 ms. Splitting the bytes would have saved the small
   part and made a dozen synchronous callers asynchronous. Preparing on first use (EXP-049) took the
   big part and changed no caller.
18. **Look for work nobody sees (EXP-047).** 499 areas drew generated scenery *under* a painted scene
   that covered it; it showed only as a strip on the ground line and cost raster time every frame.
   Occluded drawing is invisible in screenshots and obvious in a per-frame op count.
19. **Art changes are performance changes (EXP-052).** Redrawing ~550 environments doubled the
   environment data (8.2 → 14.8 MB minified, 1.1 → 2.0 MB gzip) before any code changed. Measure the
   catalogue after a content PR, not only after a code PR.

### Split along what is shown, keep the rest synchronous

20. **Only one environment's scenery is on screen at a time (EXP-046).** That made scenery the right
   thing to load on demand: half the bytes, purely visual, needed by one environment. Everything a
   game rule, a door or a word list reads stayed synchronous, so no caller had to change.
21. **Lazy is an implementation detail when the API stays the same (EXP-049).** A registry that
   builds an item on first `get` kept every `catalog.blueprints.get(id)` call site as it was. The
   catalogue-wide checks a lazy build skips moved into a test, so they still run on every change.

### Prove "nothing changed" instead of eyeballing it

22. **Equivalence checks are cheap and decisive.** Merging every split scenery file back gave the
   old environment JSON for all 561 environments; the backdrop plan was identical for all 1 122 loads;
   every object, skin, particle effect and rule was identical lazy vs eager in all three art styles.
   A screenshot would have caught none of a dropped field.
23. **Byte-identical output is the proof for a refactor (EXP-053).** Moving the drawing helpers the agents
   had copied into ten packs into one shared kit was accepted because the rebuilt catalogue was
   byte-identical, not because it looked right.

### Asynchronous loading needs a "not yet" state, handled on purpose

24. **Never show the empty state (EXP-050).** A web stage stays hidden until its scenery is here (at
   most 0.8 s); a door holds its closed iris until the next scenery is here (at most 0.6 s), and the
   fetch starts at the tap, so the wait is usually zero. Both have a cap: slow networks still get a
   world.
25. **"No store" is not "not loaded" (bug found by the existing door tests).** `store?.peek(id) ===
   undefined` is also true when there is no store, so every door waited 0.6 s on stages without
   one. Tri-state values need an explicit presence check.
26. **A loader that answers at once must count as ready at once.** Treating every source as
    asynchronous delayed scenery that was already in memory.

### Tooling and test lessons

27. **Proof scripts must follow the renderer (EXP-046).** After the renderer started replaying only
    on-screen chunks, a proof script that moved the canvas without moving the camera drew far areas
    empty, on develop too. Scripts now point the camera at what they draw, and all 24 proof and check
    scripts load every environment's scenery up front (`ALL_DECOR`), which apps never import.
28. **Test runners need the same module features as the app.** Jest could not run a real `import()`
    (the per-environment scenery loaders); the repository's existing test-only rewrite now lists the
    generated catalogue index, guarded by its coverage test.
29. **Separate flaky from broken.** Under a full parallel run, two suites failed that pass alone, and
    two failed on plain develop too. Re-running alone and on the base branch, every time, kept real
    regressions apart from noise.
30. **Look before changing what "might" be wrong (EXP-051).** Repeated scenery tiles were suspected of
    doubling or cutting items at their seams. Views centred on the seams of four environments showed
    neither, so the repeat logic was left alone (recorded as neutral, EXP-051).

### What was not verified

- Real devices: all timings are Node or Chromium-throttled numbers on a GPU-less 4-vCPU VM.
- The production website: deploys were blocked by the hosting account during this work.
