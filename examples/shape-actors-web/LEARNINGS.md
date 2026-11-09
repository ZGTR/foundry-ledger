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
