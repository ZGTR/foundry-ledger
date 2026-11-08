# Examples

- `shape-actors-web/`: the ledger perf-ledger was extracted from: 35 experiments (kept and rejected)
  on a web + native 2D stage, over three days of low-end-device work. Its `results/` paths point
  into the original repository and are not copied here; the ledger and its config are.
  Try: `npx perf-ledger list --dir examples/shape-actors-web --verdict rejected`.
- `bench/before.json`, `bench/after.json`: two real runs of that project's web benchmark, for
  trying `record --ab` with the `shape-actors-web` config.
