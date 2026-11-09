/**
 * The composition root: the one place that chooses concrete classes and wires them together
 * (inversion of control). Everything else receives its collaborators; nothing else calls `new`
 * on an adapter. To run the same use cases against other storage, another bench format or test
 * fakes, build a different container, not a different controller.
 */
import path from 'node:path';
import { ConsoleOutput, FileOutput, FsArtifactStore, JsonFileLedgerStore, SystemClock } from '../adapters/fs.js';
import { JsonBenchReader } from '../adapters/json-bench-reader.js';
import { LedgerController } from '../controller/ledger-controller.js';
import { SequentialIds } from '../domain/ledger.js';
import { EventBus } from '../events.js';
import type { Output } from '../ports.js';
import { AbSummarizer } from '../services/ab-summarizer.js';
import { LedgerMerger } from '../services/ledger-merger.js';
import { LedgerChecker } from '../services/ledger-checker.js';
import { MarkdownLedgerView, type LedgerView } from '../views/markdown-view.js';
import type { ResolvedConfig } from './config.js';

export interface Container {
  readonly controller: LedgerController;
  readonly events: EventBus;
  readonly console: Output;
  /** The Markdown view as configured (what `check` compares the file on disk with). */
  readonly markdown: MarkdownLedgerView;
}

/** Subscribes `view` to ledger changes: every change re-renders it to `output`. */
export function renderOnChange(events: EventBus, view: LedgerView, output: Output): () => void {
  return events.on('ledger.changed', async ({ ledger }) => {
    await output.write(view.name, view.render(ledger));
    await events.publish('view.rendered', { view: view.name, experiments: ledger.experiments.length });
  });
}

export function createContainer(config: ResolvedConfig, options: { quiet?: boolean } = {}): Container {
  const events = new EventBus();
  const ids = new SequentialIds(config.raw.ids?.prefix, config.raw.ids?.width);
  const learningIds = new SequentialIds('L-');
  const controller = new LedgerController({
    store: new JsonFileLedgerStore(config.ledgerFile),
    artifacts: new FsArtifactStore(config.resultsDir, config.dir),
    bench: new JsonBenchReader(config.raw.bench ?? { sources: [] }),
    summarizer: new AbSummarizer(config.raw.metrics),
    merger: new LedgerMerger(ids, learningIds),
    ids,
    learningIds,
    checker: new LedgerChecker(),
    clock: new SystemClock(),
    events,
  });
  const console = new ConsoleOutput();
  // Subscribers: the Markdown view follows every change; the reporter narrates.
  const source = path.relative(config.dir, config.ledgerFile).split(path.sep).join('/');
  const markdown = new MarkdownLedgerView({ title: config.raw.title, intro: config.raw.intro, source });
  renderOnChange(events, markdown, new FileOutput({ markdown: config.markdownFile }));
  if (!options.quiet) {
    events.on('experiment.recorded', ({ experiment }) => console.write('report', `recorded ${experiment.id}: ${experiment.title}`));
    events.on('learning.recorded', ({ learning }) => console.write('report', `learned ${learning.id}: ${learning.title}`));
    events.on('experiment.renumbered', ({ from, to }) => console.write('report', `renumbered ${from} -> ${to}`));
    events.on('view.rendered', ({ view, experiments }) => console.write('report', `${view}: ${experiments} experiments`));
  }
  return { controller, events, console, markdown };
}
