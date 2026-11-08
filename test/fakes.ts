/** In-memory adapters for the ports: the controller runs unchanged against them (dependency injection). */
import { Ledger } from '../src/domain/ledger.js';
import type { ArtifactStore, BenchReader, BenchRun, Clock, LedgerStore, Output } from '../src/ports.js';

export class MemoryStore implements LedgerStore {
  saves = 0;
  constructor(public ledger = new Ledger()) {}
  async load(): Promise<Ledger> { return new Ledger(this.ledger.experiments, this.ledger.runs, this.ledger.schema); }
  async save(ledger: Ledger): Promise<void> { this.ledger = ledger; this.saves++; }
}

export class MemoryArtifacts implements ArtifactStore {
  readonly files = new Map<string, string>(); // path -> source
  async keep(id: string, files: readonly { source: string; as: string }[]): Promise<string[]> {
    return files.map((f) => { const p = `results/${id}/${f.as}`; this.files.set(p, f.source); return p; });
  }
  async move(files: readonly { from: string; to: string }[]): Promise<void> {
    for (const f of files) { const src = this.files.get(f.from); if (src === undefined) continue; this.files.delete(f.from); this.files.set(f.to, src); }
  }
}

export class FakeBench implements BenchReader {
  constructor(private readonly runs: Readonly<Record<string, BenchRun>>) {}
  async read(file: string): Promise<BenchRun> {
    const run = this.runs[file];
    if (!run) throw new Error(`no fake run ${file}`);
    return run;
  }
}

export class FixedClock implements Clock {
  constructor(private readonly date = '2026-11-08') {}
  today(): string { return this.date; }
}

export class MemoryOutput implements Output {
  readonly written = new Map<string, string>();
  async write(name: string, content: string): Promise<void> { this.written.set(name, content); }
}
