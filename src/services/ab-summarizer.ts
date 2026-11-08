import type { AbCell, AbComparison } from '../domain/experiment.js';
import type { BenchRun } from '../ports.js';

/** How a metric is written in a cell: its label, unit and decimals. */
export interface MetricFormat {
  readonly name: string;
  readonly label?: string;
  readonly unit?: string;
  readonly digits?: number;
}

/**
 * Turns two benchmark runs into the A/B lines an experiment keeps: one cell per key present in
 * both runs, one "label a -> b unit" phrase per metric present in both rows. It reads no files and
 * knows no tool: BenchReaders turn a tool's output into BenchRuns first.
 */
export class AbSummarizer {
  private readonly formats: Map<string, MetricFormat>;

  constructor(formats: readonly MetricFormat[] = []) {
    this.formats = new Map(formats.map((f) => [f.name, f]));
  }

  compare(before: BenchRun, after: BenchRun): AbComparison {
    const byKey = new Map(after.rows.map((r) => [r.key, r]));
    const cells: AbCell[] = [];
    for (const row of before.rows) {
      const other = byKey.get(row.key);
      if (!other) continue;
      const parts: string[] = [];
      for (const [name, a] of Object.entries(row.metrics)) {
        const b = other.metrics[name];
        if (a === undefined || b === undefined) continue;
        parts.push(this.phrase(name, a, b));
      }
      if (parts.length) cells.push({ key: row.key, text: parts.join(', ') });
    }
    return { before: before.label, after: after.label, cells };
  }

  private phrase(name: string, a: number, b: number): string {
    const f = this.formats.get(name);
    const digits = f?.digits ?? 2;
    const n = (v: number) => String(Math.round(v * 10 ** digits) / 10 ** digits);
    return `${f?.label ?? name} ${n(a)}→${n(b)}${f?.unit ? ` ${f.unit}` : ''}`;
  }
}
