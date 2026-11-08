import { createExperiment, type AbComparison, type Experiment, type ExperimentDraft } from '../domain/experiment.js';
import type { IdStrategy, Ledger } from '../domain/ledger.js';
import type { EventBus } from '../events.js';
import type { ArtifactStore, BenchReader, Clock, LedgerStore } from '../ports.js';
import type { AbSummarizer } from '../services/ab-summarizer.js';
import type { LedgerMerger, MergeResult } from '../services/ledger-merger.js';
import type { LedgerView } from '../views/markdown-view.js';

/** Everything the controller needs, injected (see app/container.ts). */
export interface ControllerDeps {
  readonly store: LedgerStore;
  readonly artifacts: ArtifactStore;
  readonly bench: BenchReader;
  readonly summarizer: AbSummarizer;
  readonly merger: LedgerMerger;
  readonly ids: IdStrategy;
  readonly clock: Clock;
  readonly events: EventBus;
}

/** What `record` accepts beyond the experiment's own fields. */
export interface RecordOptions {
  /** Two benchmark result files: summarised into the entry and kept beside the ledger. */
  readonly ab?: { readonly before: string; readonly after: string };
  /** Further files to keep as this experiment's evidence. */
  readonly attach?: readonly string[];
}

/**
 * The use cases, and only them: each loads the model through a port, changes it, saves it, and
 * announces what happened. Rendering, printing and file layout are subscribers' and adapters' jobs.
 */
export class LedgerController {
  constructor(private readonly deps: ControllerDeps) {}

  /** Records a new experiment under the next id; returns it. */
  async record(draft: ExperimentDraft, options: RecordOptions = {}): Promise<Experiment> {
    const { store, artifacts, bench, summarizer, ids, clock, events } = this.deps;
    const ledger = await store.load();
    const id = ledger.nextId(ids);
    let ab: AbComparison | undefined = draft.ab;
    const keep: { source: string; as: string }[] = [];
    if (options.ab) {
      const [before, after] = await Promise.all([bench.read(options.ab.before), bench.read(options.ab.after)]);
      ab = summarizer.compare(before, after);
      keep.push({ source: options.ab.before, as: `before-${basename(options.ab.before)}` }, { source: options.ab.after, as: `after-${basename(options.ab.after)}` });
    }
    for (const file of options.attach ?? []) keep.push({ source: file, as: basename(file) });
    const results = keep.length ? await artifacts.keep(id, keep) : draft.results;
    const experiment = createExperiment(id, draft.date ?? clock.today(), { ...draft, ab, results });
    ledger.add(experiment);
    await store.save(ledger);
    await events.publish('experiment.recorded', { experiment, ledger });
    await events.publish('ledger.changed', { ledger, reason: `recorded ${id}` });
    return experiment;
  }

  /** Re-renders every view from the saved ledger (views subscribe to ledger.changed). */
  async render(): Promise<Ledger> {
    const ledger = await this.deps.store.load();
    await this.deps.events.publish('ledger.changed', { ledger, reason: 'render' });
    return ledger;
  }

  /** The ledger through one view (a list, a single experiment's details), without saving. */
  async view(view: LedgerView): Promise<string> {
    return view.render(await this.deps.store.load());
  }

  async show(id: string): Promise<Experiment | undefined> {
    return (await this.deps.store.load()).find(id);
  }

  /**
   * Merges another ledger's experiments into this one (this one is the base and keeps its ids).
   * Colliding incoming experiments are renumbered and their kept artifacts move with them.
   */
  async merge(incoming: LedgerStore): Promise<MergeResult> {
    const { store, artifacts, merger, events } = this.deps;
    const result = merger.merge(await store.load(), await incoming.load());
    for (const r of result.renumbered) {
      if (r.files.length) await artifacts.move(r.files);
      await events.publish('experiment.renumbered', { from: r.from, to: r.to });
    }
    await store.save(result.ledger);
    await events.publish('ledger.changed', { ledger: result.ledger, reason: `merged (${result.renumbered.length} renumbered)` });
    return result;
  }
}

function basename(file: string): string {
  return file.split(/[\\/]/).pop() ?? file;
}
