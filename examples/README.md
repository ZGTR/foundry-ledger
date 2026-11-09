# Examples

- `shape-actors-web/`: the ledger foundry-performance-ledger was extracted from: 45 experiments and 38 learnings (kept,
  rejected and measured-not-a-cost) on a web + native 2D stage, from low-end-device work dated
  7–8 November 2026.
  - `ledger.json`, `LEDGER.md`: the ledger and its rendering.
  - `experiments/results/<id>/`: the raw benchmark files every entry's `results` points to.
  - `suite/`: the perf suite that produced the numbers (a reference copy: it runs inside the app's
    repository; [`suite/ORIGIN.md`](shape-actors-web/suite/ORIGIN.md) maps each tool to its entries).
  - `videos/`: before/after screen recordings from the suite's `record-open.mjs`.
  - [`LEARNINGS.md`](shape-actors-web/LEARNINGS.md): what the work taught, beyond each entry's numbers.
  Try: `npx foundry-performance-ledger list --dir examples/shape-actors-web --verdict rejected`.
- `bench/before.json`, `bench/after.json`: two real runs of that project's web benchmark, for
  trying `record --ab` with the `shape-actors-web` config.
