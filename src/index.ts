/** Public API: the model, the ports, the services, the views, the controller and the wiring. */
export { createExperiment, verdictOf, InvalidExperimentError, type Experiment, type ExperimentDraft, type AbComparison, type AbCell, type Verdict } from './domain/experiment.js';
export { Ledger, SequentialIds, DuplicateExperimentError, LEDGER_SCHEMA, type IdStrategy, type Run } from './domain/ledger.js';
export type { LedgerStore, ArtifactStore, BenchReader, BenchRun, BenchRow, Clock, Output } from './ports.js';
export { EventBus, type LedgerEvents } from './events.js';
export { AbSummarizer, type MetricFormat } from './services/ab-summarizer.js';
export { LedgerMerger, renumber, type MergeResult, type Renumbering } from './services/ledger-merger.js';
export { MarkdownLedgerView, type LedgerView, type MarkdownOptions } from './views/markdown-view.js';
export { ListView, type ListFilter } from './views/list-view.js';
export { LedgerController, type ControllerDeps, type RecordOptions } from './controller/ledger-controller.js';
export { JsonFileLedgerStore, FsArtifactStore, SystemClock, FileOutput, ConsoleOutput } from './adapters/fs.js';
export { JsonBenchReader, type JsonBenchFormat, type RowSource } from './adapters/json-bench-reader.js';
export { loadConfig, STARTER_CONFIG, CONFIG_FILE, type LedgerConfig, type ResolvedConfig } from './app/config.js';
export { createContainer, renderOnChange, type Container } from './app/container.js';
