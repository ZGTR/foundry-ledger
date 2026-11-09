import type { Experiment } from '../domain/experiment.js';
import { Ledger, SequentialIds, type IdStrategy } from '../domain/ledger.js';

export interface Renumbering {
  readonly from: string;
  readonly to: string;
  /** The renumbered experiment's kept files, old path -> new path. */
  readonly files: readonly { from: string; to: string }[];
}

export interface MergeResult {
  readonly ledger: Ledger;
  /** Incoming experiments that were given a new id because theirs already used it. */
  readonly renumbered: readonly Renumbering[];
  /** Incoming experiments already in the base (shared history), left as they are. */
  readonly shared: readonly string[];
  /** Incoming learnings given a new id because the base already used theirs. */
  readonly renumberedLearnings: readonly { readonly from: string; readonly to: string }[];
}

/**
 * Merges two ledgers that grew apart on two branches, which plain text merges get wrong: both
 * branches append "the next" id, so they collide (two different EXP-034s), and a conflict-free
 * merge can even keep both under one id.
 *
 * The base (usually the integration branch) keeps every entry and id. Each incoming entry is:
 * shared history if the base has the same id with the same title; appended as is if its id is
 * free; otherwise renumbered to the next free id (and every other field that names its id, such
 * as its result paths, follows).
 */
export class LedgerMerger {
  constructor(private readonly ids: IdStrategy, private readonly learningIds: IdStrategy = new SequentialIds('L-')) {}

  merge(base: Ledger, incoming: Ledger): MergeResult {
    const out = new Ledger(base.experiments, base.runs, base.schema, base.learnings);
    const renumbered: Renumbering[] = [];
    const shared: string[] = [];
    for (const e of incoming.experiments) {
      const there = out.find(e.id);
      if (there && there.title === e.title) { shared.push(e.id); continue; }
      if (!there) { out.add(e); continue; }
      const to = out.nextId(this.ids);
      const moved = renumber(e, to);
      out.add(moved);
      renumbered.push({ from: e.id, to, files: (e.results ?? []).map((f, i) => ({ from: f, to: moved.results![i] })).filter((m) => m.from !== m.to) });
    }
    const runIds = new Set(out.runs.map((r) => r.id));
    for (const r of incoming.runs) if (!runIds.has(r.id)) out.addRun(r);
    // Learnings: the same rules, and citations follow renumbered experiments.
    const moved = new Map(renumbered.map((r) => [r.from, r.to]));
    const renumberedLearnings: { from: string; to: string }[] = [];
    for (const l of incoming.learnings) {
      const cites = l.experiments.map((id) => moved.get(id) ?? id);
      const there = out.learnings.find((x) => x.id === l.id);
      if (there && there.title === l.title) continue;
      const id = there ? out.nextLearningId(this.learningIds) : l.id;
      if (there) renumberedLearnings.push({ from: l.id, to: id });
      out.addLearning(Object.freeze({ ...l, id, experiments: Object.freeze(cites) }));
    }
    return { ledger: out, renumbered, shared, renumberedLearnings };
  }
}

/** The same experiment under a new id: its result paths (which embed the id) follow it. */
export function renumber(e: Experiment, to: string): Experiment {
  const swap = (s: string) => s.split(e.id).join(to);
  return Object.freeze({ ...e, id: to, ...(e.results ? { results: e.results.map(swap) } : {}) });
}
