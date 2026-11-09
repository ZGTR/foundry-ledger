import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { JsonBenchFormat } from '../adapters/json-bench-reader.js';
import type { MetricFormat } from '../services/ab-summarizer.js';

/** foundry-performance-ledger.config.json. Paths are relative to the config file. */
export interface LedgerConfig {
  /** The ledger data (default "ledger.json"). */
  readonly ledger?: string;
  /** The generated Markdown (default "LEDGER.md"). */
  readonly markdown?: string;
  /** Where raw results are kept, one directory per experiment (default "results"). */
  readonly results?: string;
  /** Experiment id prefix and digits (default "EXP-", 3). */
  readonly ids?: { readonly prefix?: string; readonly width?: number };
  readonly title?: string;
  readonly intro?: string;
  /** How to read your benchmark tool's JSON for `record --ab`. */
  readonly bench?: JsonBenchFormat;
  /** How each metric is written in an A/B cell. */
  readonly metrics?: readonly MetricFormat[];
  /**
   * `check` requires complete entries (hypothesis, method, before, after, evidence, and metrics
   * or an A/B) from this experiment id on. Set it to the first id recorded under the rule, so
   * history is not judged retroactively.
   */
  readonly completeFrom?: string;
}

export const CONFIG_FILE = 'foundry-performance-ledger.config.json';

export interface ResolvedConfig {
  readonly dir: string;
  readonly ledgerFile: string;
  readonly markdownFile: string;
  readonly resultsDir: string;
  readonly raw: LedgerConfig;
}

/** Reads the config (or defaults) from `dir`, resolving every path against it. */
export function loadConfig(dir: string, file = CONFIG_FILE): ResolvedConfig {
  const at = path.resolve(dir, file);
  const raw: LedgerConfig = existsSync(at) ? JSON.parse(readFileSync(at, 'utf8')) as LedgerConfig : {};
  const base = path.dirname(at);
  return {
    dir: base,
    ledgerFile: path.resolve(base, raw.ledger ?? 'ledger.json'),
    markdownFile: path.resolve(base, raw.markdown ?? 'LEDGER.md'),
    resultsDir: path.resolve(base, raw.results ?? 'results'),
    raw,
  };
}

/** A starter config for `foundry-performance-ledger init`: a generic rows-of-cells bench format. */
export const STARTER_CONFIG: LedgerConfig = {
  ledger: 'ledger.json',
  markdown: 'LEDGER.md',
  results: 'results',
  title: 'Performance experiment ledger',
  intro: 'Every performance experiment, kept or rejected, so later work starts from what was already measured. Compare numbers within one row: different rows may come from different machines and days.',
  bench: { label: 'label', sources: [{ rows: 'rows', key: ['device', 'scenario'], metrics: { p95: 'p95Ms', dropped: 'droppedPct' } }] },
  metrics: [{ name: 'p95', unit: 'ms', digits: 1 }, { name: 'dropped', unit: '%', digits: 2 }],
};
