/**
 * File-system adapters for the ports. The only module (with the CLI) that imports node:fs.
 */
import { copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { AbCell, Experiment } from '../domain/experiment.js';
import type { Learning } from '../domain/learning.js';
import { Ledger, LEDGER_SCHEMA, type Run } from '../domain/ledger.js';
import type { ArtifactStore, Clock, LedgerStore, Output } from '../ports.js';

interface LedgerFile { schema: number; experiments: Experiment[]; runs?: Run[]; learnings?: Learning[] }

/** ledger.json: `{ schema, experiments, runs }`, written with one-space indent and a trailing newline. */
export class JsonFileLedgerStore implements LedgerStore {
  constructor(private readonly file: string) {}

  async load(): Promise<Ledger> {
    if (!existsSync(this.file)) return new Ledger();
    const data = JSON.parse(await readFile(this.file, 'utf8')) as LedgerFile;
    if (data.schema !== LEDGER_SCHEMA) throw new Error(`${this.file}: ledger schema ${data.schema} is not supported (expected ${LEDGER_SCHEMA})`);
    return new Ledger((data.experiments ?? []).map(upgradeCells), data.runs ?? [], data.schema, data.learnings ?? []);
  }

  async save(ledger: Ledger): Promise<void> {
    const data: LedgerFile = { schema: ledger.schema, experiments: [...ledger.experiments], runs: [...ledger.runs], ...(ledger.learnings.length ? { learnings: [...ledger.learnings] } : {}) };
    await mkdir(path.dirname(this.file), { recursive: true });
    await writeFile(this.file, `${JSON.stringify(data, null, 1)}\n`);
  }
}

/**
 * Early ledgers wrote A/B cells as plain strings ("low/market/idle: dropped 98→54 %"): read them as
 * { key, text }, split at the first ": ". The saved file then carries the structured form.
 */
function upgradeCells(e: Experiment): Experiment {
  if (!e.ab) return e;
  const cells = (e.ab.cells as readonly unknown[]).map((c) => {
    if (typeof c !== 'string') return c as AbCell;
    const at = c.indexOf(': ');
    return at < 0 ? { key: '', text: c } : { key: c.slice(0, at), text: c.slice(at + 2) };
  });
  return { ...e, ab: { ...e.ab, cells } };
}

/**
 * Keeps files under `<resultsDir>/<id>/` and reports them relative to `relativeTo` (the directory
 * the ledger's paths are written from), e.g. `results/EXP-012/before-web.json`.
 */
export class FsArtifactStore implements ArtifactStore {
  constructor(private readonly resultsDir: string, private readonly relativeTo: string) {}

  async keep(experimentId: string, files: readonly { source: string; as: string }[]): Promise<string[]> {
    const dir = path.join(this.resultsDir, experimentId);
    await mkdir(dir, { recursive: true });
    const out: string[] = [];
    for (const f of files) {
      const target = path.join(dir, f.as);
      await copyFile(f.source, target);
      out.push(this.relative(target));
    }
    return out;
  }

  async move(files: readonly { from: string; to: string }[]): Promise<void> {
    for (const f of files) {
      const from = path.resolve(this.relativeTo, f.from), to = path.resolve(this.relativeTo, f.to);
      if (!existsSync(from)) continue; // never kept here (another checkout's artifact)
      await mkdir(path.dirname(to), { recursive: true });
      await rename(from, to);
    }
  }

  private relative(file: string): string {
    return path.relative(this.relativeTo, file).split(path.sep).join('/');
  }
}

export class SystemClock implements Clock {
  today(): string { return new Date().toISOString().slice(0, 10); }
}

/** Writes each named output to a file in `dir` (e.g. markdown -> LEDGER.md). */
export class FileOutput implements Output {
  constructor(private readonly files: Readonly<Record<string, string>>) {}
  async write(name: string, content: string): Promise<void> {
    const file = this.files[name];
    if (!file) return;
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content.endsWith('\n') ? content : `${content}\n`);
  }
}

export class ConsoleOutput implements Output {
  constructor(private readonly log: (line: string) => void = (l) => process.stdout.write(`${l}\n`)) {}
  async write(_name: string, content: string): Promise<void> { this.log(content); }
}
