# Changelog

## 0.2.0

- **Learnings**: `learn --title --lesson --from EXP-...`; rendered first in LEDGER.md; `list
  --learnings`; merges renumber colliding learning ids and follow renumbered experiments.
- **Metrics**: `record --metric name:before:after[:unit[:higher]]` (repeatable), shown with their
  trend (improved / regressed / unchanged).
- **check**: complete entries from `completeFrom` on (hypothesis, method, before, after,
  evidence, numbers), learnings cite real experiments, LEDGER.md up to date. Exit 1 on any
  problem: for CI and agents.
- Example `shape-actors-web`: three more entries (EXP-036 rig cost measured, EXP-037 rule-lookup
  index, EXP-038 door load and first draw on separate frames); the raw results every entry points
  to; the perf suite that produced them (`suite/`); before/after recordings (`videos/`); and
  `LEARNINGS.md`.

## 0.1.0

- First release, extracted from the performance work on a web + native 2D stage (35 experiments).
- `init`, `record` (with `--ab` summaries from any JSON benchmark output and kept raw files),
  `render`, `list`, `show`, `merge` (renumbers id collisions between branches).
- Reads ledgers written by the original in-repo script, including its string-form A/B cells.
