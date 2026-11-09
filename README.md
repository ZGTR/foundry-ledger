# foundry-performance-ledger

**A ledger of performance experiments, kept _and_ rejected.**

Most performance work leaves two traces: the commits that stayed, and nothing at all for the ideas
that were measured and thrown away. Six weeks later somebody tries the same idea again. foundry-performance-ledger
is a small, dependency-free tool that records every experiment as one entry, with:

- **what** was tried and **why** (the hypothesis);
- **how** it was measured (the method: tools, runs, controls);
- **before** and **after**, in the words and units the engineer chose;
- the **decision** (kept, rejected, neutral, open, superseded) and the **evidence** (a test, a
  trace, a recording);
- optionally an **A/B**, summarised from two benchmark result files, and the raw files themselves,
  kept beside the ledger so the numbers can be re-read later.

It renders the ledger as a reviewable `LEDGER.md` (one table row per experiment, then the details),
and it **merges ledgers from parallel branches without id collisions**: two branches that both
record "the next" experiment get `EXP-034` twice; `foundry-performance-ledger merge` keeps the integration
branch's ids and renumbers the incoming one, moving exactly its result files.

It was extracted from the performance work on a web + native 2D stage for a children's learning
app, where it held 35 experiments over three days; that ledger ships as the
[example](examples/shape-actors-web/LEDGER.md), now with the suite that measured it, the raw
results, before/after recordings and [what it taught](examples/shape-actors-web/LEARNINGS.md).

## Install

```sh
npm install --save-dev foundry-performance-ledger      # or: npx foundry-performance-ledger ...
```

Node 18.18 or newer. No runtime dependencies. The command is also installed under the short name
`perf-ledger`, so `npx perf-ledger list` works too.

## Use

```sh
npx foundry-performance-ledger init                    # foundry-performance-ledger.config.json + an empty ledger + LEDGER.md

# record an experiment (the next id, today's date)
npx foundry-performance-ledger record \
  --title "Static layers paint from an underlay svg" --area web \
  --hypothesis "paint re-records the static backdrop every frame" \
  --method "layer ablation; interleaved traces x2; pixel parity" \
  --before "paint 2.09 s per drag trace" --after "paint 1.09 s" \
  --decision kept --evidence "stage-parity.mjs; stageUnderlay test" --pr "#842" \
  --ab bench/before.json,bench/after.json   # summarised into the entry; raw files kept

npx foundry-performance-ledger list --verdict rejected  # what did we already rule out?
npx foundry-performance-ledger list --grep canvas
npx foundry-performance-ledger show EXP-012
npx foundry-performance-ledger render                   # regenerate LEDGER.md
```

### Merging branches

When two branches both appended to the ledger, resolve the conflict with the tool instead of by
hand:

```sh
git show :2:perf/ledger.json > /tmp/ours.json   # this branch's ledger
git checkout --theirs perf/ledger.json          # the integration branch's ledger is the base
npx foundry-performance-ledger merge /tmp/ours.json --dir perf # ours appended; colliding ids renumbered
git add perf/
```

### Reading your benchmark's JSON

`record --ab` reads any JSON benchmark output described in the config: where the rows are, which
fields identify a row (its key), and which fields are metrics. A new tool is a config entry, not
code:

```json
{
  "bench": {
    "label": "label",
    "sources": [
      { "rows": "rows", "key": ["device", "theme", "scenario"],
        "metrics": { "dropped": "droppedPct", "input p95": "inputLatencyMs.p95" } },
      { "rows": "opens", "key": ["device", "theme"], "keySuffix": "open",
        "metrics": { "world open": "openMs" } }
    ]
  },
  "metrics": [
    { "name": "dropped", "unit": "%", "digits": 2 },
    { "name": "input p95", "unit": "ms", "digits": 1 }
  ]
}
```

A format JSON paths cannot describe gets its own `BenchReader` (see [Extending](#extending)).

## The rules the ledger encodes

These came out of the work it was built for; they are why the fields are what they are.

1. **Record the rejections.** A rejected experiment with its numbers is the cheapest result you
   will ever get: it stops the next person from spending a day on it. Two of the five experiments
   in the example's last loop were rejected, and both entries say exactly why.
2. **Compare within a run, never across days.** Shared machines drift; an A/B is two builds
   measured in the same session, interleaved, more than once. The entry says which runs it
   compares.
3. **Keep the raw numbers.** A summary is an interpretation; the files under `results/<id>/` are
   the measurement.
4. **Name the evidence.** "Faster" is not evidence; a test that is red on the old code, a trace, a
   parity check or a recording is.
5. **Say what was not verified.** "Measured on a GPU-less VM" belongs in the entry, not in
   somebody's memory.

## Architecture

Model-view-controller with ports and adapters, wired in one composition root, with events between
the use cases and their side effects. See [docs/architecture.md](docs/architecture.md).

```
  cli/main.ts ──► LedgerController (use cases) ──publishes──► EventBus
                    │ uses ports (interfaces)                  │ subscribers
                    ▼                                          ▼
   LedgerStore  ArtifactStore  BenchReader  Clock     MarkdownLedgerView ─► Output
   (JSON file)  (results/)     (JSON paths) (system)  reporter lines     ─► console
                    ▲
          domain: Experiment, Ledger, IdStrategy   services: AbSummarizer, LedgerMerger
```

## Extending

Everything the core needs is an interface in [`src/ports.ts`](src/ports.ts). Build your own
container to swap any of them:

```ts
import { LedgerController, EventBus, SequentialIds, AbSummarizer, LedgerMerger,
  MarkdownLedgerView, renderOnChange } from 'foundry-performance-ledger';

const events = new EventBus();
const ids = new SequentialIds('PERF-', 4);
const controller = new LedgerController({
  store: new MyPostgresLedgerStore(pool),        // implements LedgerStore
  artifacts: new MyS3ArtifactStore(bucket),      // implements ArtifactStore
  bench: new MyLighthouseReader(),               // implements BenchReader
  summarizer: new AbSummarizer(), merger: new LedgerMerger(ids), ids,
  clock: { today: () => new Date().toISOString().slice(0, 10) }, events,
});
renderOnChange(events, new MarkdownLedgerView(), new MyWikiOutput());   // implements Output
events.on('experiment.recorded', ({ experiment }) => postToSlack(experiment));
```

## Format

`ledger.json` is `{ "schema": 1, "experiments": [...], "runs": [...] }`, described by
[`schema/ledger.schema.json`](schema/ledger.schema.json). It is plain JSON on purpose: diffable,
greppable and readable without this tool.

## License

MIT
