import { verdictOf, type Verdict } from '../domain/experiment.js';
import type { Ledger } from '../domain/ledger.js';
import type { LedgerView } from './markdown-view.js';

export interface ListFilter {
  readonly verdict?: Verdict;
  /** Matches when the experiment's area contains this text. */
  readonly area?: string;
  /** Matches the title, hypothesis, decision or evidence (case-insensitive). */
  readonly text?: string;
  /** List the learnings instead of the experiments. */
  readonly learnings?: boolean;
}

/** A terminal list: id, verdict, area, title. What `foundry-performance-ledger list` prints. */
export class ListView implements LedgerView {
  readonly name = 'list';
  constructor(private readonly filter: ListFilter = {}) {}

  render(ledger: Ledger): string {
    const f = this.filter;
    const text = f.text?.toLowerCase();
    if (f.learnings) {
      const rows = ledger.learnings.filter((l) => (!f.area || l.area.includes(f.area)) && (!text || `${l.title} ${l.lesson}`.toLowerCase().includes(text)));
      return [...rows.map((l) => `${l.id}  ${l.title}  (${l.experiments.join(', ')})`), `${rows.length} learning(s)`].join('\n');
    }
    const rows = ledger.experiments.filter((e) =>
      (!f.verdict || verdictOf(e) === f.verdict)
      && (!f.area || e.area.includes(f.area))
      && (!text || [e.title, e.hypothesis, e.decision, e.evidence].some((s) => s.toLowerCase().includes(text))));
    const counts = new Map<Verdict, number>();
    for (const e of rows) counts.set(verdictOf(e), (counts.get(verdictOf(e)) ?? 0) + 1);
    return [
      ...rows.map((e) => `${e.id}  ${verdictOf(e).padEnd(10)} ${e.area.padEnd(12)} ${e.title}`),
      `${rows.length} experiment(s)${counts.size ? `: ${[...counts].map(([v, n]) => `${n} ${v}`).join(', ')}` : ''}`,
    ].join('\n');
  }
}
