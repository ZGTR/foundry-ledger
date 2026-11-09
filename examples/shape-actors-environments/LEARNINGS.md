# Learnings: environments, scenery and catalogue (Nov 2026)

What the work recorded in [LEDGER.md](LEDGER.md) taught, written so the next change starts from
it. Each point names the experiment that paid for it.

## Measure before you pick the fix

1. **The obvious fix was the wrong one (EXP-003, rejected).** Fetching object files per
   environment looked like the next step after splitting the scenery. Measured first: parsing all
   6.3 MB of object data cost ~45 ms, while *preparing* the 3 697 objects (inheritance, validation,
   measuring, styling, particle effects) cost ~340 ms. Splitting the bytes would have saved the small
   part and made a dozen synchronous callers asynchronous. Preparing on first use (EXP-004) took the
   big part and changed no caller.
2. **Look for work nobody sees (EXP-002).** 499 areas drew generated scenery *under* a painted scene
   that covered it; it showed only as a strip on the ground line and cost raster time every frame.
   Occluded drawing is invisible in screenshots and obvious in a per-frame op count.
3. **Art changes are performance changes (EXP-007).** Redrawing ~550 environments doubled the
   environment data (8.2 → 14.8 MB minified, 1.1 → 2.0 MB gzip) before any code changed. Measure the
   catalogue after a content PR, not only after a code PR.

## Split along what is shown, keep the rest synchronous

4. **Only one environment's scenery is on screen at a time (EXP-001).** That made scenery the right
   thing to load on demand: half the bytes, purely visual, needed by one environment. Everything a
   game rule, a door or a word list reads stayed synchronous, so no caller had to change.
5. **Lazy is an implementation detail when the API stays the same (EXP-004).** A registry that
   builds an item on first `get` kept every `catalog.blueprints.get(id)` call site as it was. The
   catalogue-wide checks a lazy build skips moved into a test, so they still run on every change.

## Prove "nothing changed" instead of eyeballing it

6. **Equivalence checks are cheap and decisive.** Merging every split scenery file back gave the
   old environment JSON for all 561 environments; the backdrop plan was identical for all 1 122 loads;
   every object, skin, particle effect and rule was identical lazy vs eager in all three art styles.
   A screenshot would have caught none of a dropped field.
7. **Byte-identical output is the proof for a refactor (E1).** Moving the drawing helpers the agents
   had copied into ten packs into one shared kit was accepted because the rebuilt catalogue was
   byte-identical, not because it looked right.

## Asynchronous loading needs a "not yet" state, handled on purpose

8. **Never show the empty state (EXP-005).** A web stage stays hidden until its scenery is here (at
   most 0.8 s); a door holds its closed iris until the next scenery is here (at most 0.6 s), and the
   fetch starts at the tap, so the wait is usually zero. Both have a cap: slow networks still get a
   world.
9. **"No store" is not "not loaded" (bug found by the existing door tests).** `store?.peek(id) ===
   undefined` is also true when there is no store, so every door waited 0.6 s on stages without
   one. Tri-state values need an explicit presence check.
10. **A loader that answers at once must count as ready at once.** Treating every source as
    asynchronous delayed scenery that was already in memory.

## Tooling and test lessons

11. **Proof scripts must follow the renderer (E2).** After the renderer started replaying only
    on-screen chunks, a proof script that moved the canvas without moving the camera drew far areas
    empty, on develop too. Scripts now point the camera at what they draw, and all 24 proof and check
    scripts load every environment's scenery up front (`ALL_DECOR`), which apps never import.
12. **Test runners need the same module features as the app.** Jest could not run a real `import()`
    (the per-environment scenery loaders); the repository's existing test-only rewrite now lists the
    generated catalogue index, guarded by its coverage test.
13. **Separate flaky from broken.** Under a full parallel run, two suites failed that pass alone, and
    two failed on plain develop too. Re-running alone and on the base branch, every time, kept real
    regressions apart from noise.
14. **Look before changing what "might" be wrong (E3).** Repeated scenery tiles were suspected of
    doubling or cutting items at their seams. Views centred on the seams of four environments showed
    neither, so the repeat logic was left alone (recorded as neutral, EXP-006).

## What was not verified

- Real devices: all timings are Node or Chromium-throttled numbers on a GPU-less 4-vCPU VM.
- The production website: deploys were blocked by the hosting account during this work.
