import type { Experiment } from './experiment.js';
import type { Learning } from './learning.js';

/** A batch of measurements that several experiments share (a checkpoint or a final A/B run). */
export interface Run {
  readonly id: string;
  readonly date: string;
  readonly title: string;
  readonly pr?: string | null;
  readonly results: readonly string[];
}

/** How new experiment ids are made (sequential `EXP-001` by default; see IdStrategy). */
export interface IdStrategy {
  next(existing: readonly string[]): string;
}

/** `EXP-001`, `EXP-002`, ...: one past the highest existing number, never reused. */
export class SequentialIds implements IdStrategy {
  constructor(private readonly prefix = 'EXP-', private readonly width = 3) {}
  next(existing: readonly string[]): string {
    let max = 0;
    for (const id of existing) {
      if (!id.startsWith(this.prefix)) continue;
      const n = Number(id.slice(this.prefix.length));
      if (Number.isInteger(n) && n > max) max = n;
    }
    return `${this.prefix}${String(max + 1).padStart(this.width, '0')}`;
  }
}

export const LEDGER_SCHEMA = 1;

export class DuplicateExperimentError extends Error {
  constructor(readonly id: string) {
    super(`${id} is already in the ledger`);
    this.name = 'DuplicateExperimentError';
  }
}

/**
 * The ledger: an append-only, ordered list of experiments (and shared runs). It owns ordering and
 * id uniqueness and nothing else; reading, writing and rendering it are other objects' jobs.
 */
export class Ledger {
  private readonly items: Experiment[];
  private readonly runList: Run[];
  private readonly learningList: Learning[];

  constructor(experiments: readonly Experiment[] = [], runs: readonly Run[] = [], readonly schema = LEDGER_SCHEMA, learnings: readonly Learning[] = []) {
    this.items = [];
    this.runList = [...runs];
    this.learningList = [];
    for (const e of experiments) this.add(e);
    for (const l of learnings) this.addLearning(l);
  }

  get experiments(): readonly Experiment[] { return this.items; }
  get runs(): readonly Run[] { return this.runList; }
  get ids(): readonly string[] { return this.items.map((e) => e.id); }
  /** Conclusions drawn from the experiments, each citing the experiments that taught it. */
  get learnings(): readonly Learning[] { return this.learningList; }
  get learningIds(): readonly string[] { return this.learningList.map((l) => l.id); }

  has(id: string): boolean { return this.items.some((e) => e.id === id); }
  find(id: string): Experiment | undefined { return this.items.find((e) => e.id === id); }

  /** Appends an experiment; an id may appear once. */
  add(experiment: Experiment): void {
    if (this.has(experiment.id)) throw new DuplicateExperimentError(experiment.id);
    this.items.push(experiment);
  }

  addRun(run: Run): void { this.runList.push(run); }

  /** Appends a learning; an id may appear once. (Whether its citations exist is checked when it is created.) */
  addLearning(learning: Learning): void {
    if (this.learningList.some((l) => l.id === learning.id)) throw new DuplicateExperimentError(learning.id);
    this.learningList.push(learning);
  }

  nextId(ids: IdStrategy): string { return ids.next(this.ids); }
  nextLearningId(ids: IdStrategy): string { return ids.next(this.learningIds); }
}
