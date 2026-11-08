/**
 * The ports: every dependency the core needs, as an interface. The core (domain, services,
 * controller) never touches a file, a clock or a console directly; the composition root
 * (app/container.ts) injects adapters, and tests inject in-memory fakes.
 */
import type { Ledger } from './domain/ledger.js';

/** Loads and saves the ledger (adapters: a JSON file; tests: memory). */
export interface LedgerStore {
  load(): Promise<Ledger>;
  save(ledger: Ledger): Promise<void>;
}

/**
 * Keeps raw result files beside the ledger, per experiment, so the numbers behind an entry can be
 * re-read later. Returns the kept files' paths, relative to the ledger.
 */
export interface ArtifactStore {
  keep(experimentId: string, files: readonly { source: string; as: string }[]): Promise<string[]>;
  /**
   * Moves kept files to new paths (a merge renumbered their experiment). Exactly the listed files
   * move: two branches' experiments that shared an id can share a directory, and the base's files
   * must stay where they are. Paths are relative to the ledger.
   */
  move(files: readonly { from: string; to: string }[]): Promise<void>;
}

/** A row of a benchmark run: the cell it measures and its numbers. */
export interface BenchRow {
  /** Identifies the cell, e.g. "low/playground/drag-slow". */
  readonly key: string;
  readonly metrics: Readonly<Record<string, number | undefined>>;
}

/** A benchmark run as the ledger understands it, whatever tool produced it. */
export interface BenchRun {
  readonly label: string;
  readonly rows: readonly BenchRow[];
}

/** Reads one benchmark tool's output into a BenchRun (one adapter per tool's format). */
export interface BenchReader {
  read(file: string): Promise<BenchRun>;
}

/** Today's date, injected so tests are deterministic. */
export interface Clock {
  today(): string;
}

/** Writes rendered views somewhere (a file, stdout). */
export interface Output {
  write(name: string, content: string): Promise<void>;
}
