import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { BenchReader, BenchRow, BenchRun } from '../ports.js';

/** One list of rows inside a bench tool's JSON, and how to read a key and metrics from each row. */
export interface RowSource {
  /** Dot path to the array of rows, e.g. "rows" or "results.cells". */
  readonly rows: string;
  /** Fields whose values, joined by "/", identify a row, e.g. ["device", "theme", "scenario"]. */
  readonly key: readonly string[];
  /** Appended to the key, so two sources never collide (e.g. "open"). */
  readonly keySuffix?: string;
  /** Metric name -> dot path in the row, e.g. { dropped: "droppedPct", "input p95": "inputLatencyMs.p95" }. */
  readonly metrics: Readonly<Record<string, string>>;
}

/** How to read one bench tool's JSON output. */
export interface JsonBenchFormat {
  /** Dot path to the run's label (defaults to the file name). */
  readonly label?: string;
  readonly sources: readonly RowSource[];
}

const at = (obj: unknown, dotPath: string): unknown =>
  dotPath.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj);

/**
 * Reads any JSON benchmark output described by a JsonBenchFormat. Supporting a new tool is a
 * config entry, not a code change (open/closed); a format that JSON cannot describe gets its own
 * BenchReader adapter instead.
 */
export class JsonBenchReader implements BenchReader {
  constructor(private readonly format: JsonBenchFormat) {}

  async read(file: string): Promise<BenchRun> {
    const data = JSON.parse(await readFile(file, 'utf8')) as unknown;
    const label = this.format.label ? at(data, this.format.label) : undefined;
    const rows: BenchRow[] = [];
    for (const src of this.format.sources) {
      const list = at(data, src.rows);
      if (!Array.isArray(list)) continue;
      for (const r of list) {
        const key = [...src.key.map((k) => String(at(r, k) ?? '')), ...(src.keySuffix ? [src.keySuffix] : [])].join('/');
        const metrics: Record<string, number | undefined> = {};
        for (const [name, p] of Object.entries(src.metrics)) {
          const v = at(r, p);
          metrics[name] = typeof v === 'number' && Number.isFinite(v) ? v : undefined;
        }
        rows.push({ key, metrics });
      }
    }
    return { label: typeof label === 'string' && label ? label : path.basename(file), rows };
  }
}
