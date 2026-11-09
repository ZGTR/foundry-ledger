import { verdictOf, type Experiment } from '../domain/experiment.js';
import type { Ledger } from '../domain/ledger.js';

export interface CheckOptions {
  /**
   * From this experiment id on (inclusive), every entry must be complete: hypothesis, method,
   * before, after and evidence filled in, and its numbers captured as `metrics` or an `ab`
   * comparison. Older entries are history and are not judged retroactively.
   */
  readonly completeFrom?: string;
  /** The Markdown currently on disk, compared with a fresh render. */
  readonly rendered?: { readonly expected: string; readonly actual: string | undefined };
}

export interface CheckProblem {
  /** The experiment or learning the problem is about, or "ledger". */
  readonly at: string;
  readonly problem: string;
}

const numberOf = (id: string) => Number(id.match(/(\d+)$/)?.[1] ?? NaN);

/**
 * Says what is wrong with a ledger, all at once: what a CI gate or an agent runs after recording.
 * It reads only the model it is given (and the rendered text the caller passes in).
 */
export class LedgerChecker {
  check(ledger: Ledger, options: CheckOptions = {}): CheckProblem[] {
    const problems: CheckProblem[] = [];
    const ids = new Set<string>();
    for (const e of ledger.experiments) {
      if (ids.has(e.id)) problems.push({ at: e.id, problem: 'duplicate id' });
      ids.add(e.id);
      if (verdictOf(e) === 'other' && !/^(no |measured|measurement)/i.test(e.decision)) {
        problems.push({ at: e.id, problem: `decision "${e.decision}" should start with kept, rejected, neutral, open or superseded` });
      }
      if (options.completeFrom && numberOf(e.id) >= numberOf(options.completeFrom)) problems.push(...this.completeness(e));
    }
    for (const l of ledger.learnings) {
      for (const cited of l.experiments) if (!ids.has(cited)) problems.push({ at: l.id, problem: `cites ${cited}, which the ledger does not hold` });
      if (!l.experiments.length) problems.push({ at: l.id, problem: 'cites no experiment: a learning needs evidence' });
    }
    const trim = (t: string | undefined) => t?.replace(/\n+$/, '');
    if (options.rendered && trim(options.rendered.actual) !== trim(options.rendered.expected)) {
      problems.push({ at: 'ledger', problem: 'the Markdown ledger is out of date: run render' });
    }
    return problems;
  }

  private completeness(e: Experiment): CheckProblem[] {
    const out: CheckProblem[] = [];
    for (const field of ['hypothesis', 'method', 'before', 'after', 'evidence'] as const) {
      if (!e[field].trim()) out.push({ at: e.id, problem: `${field} is empty` });
    }
    if (!e.metrics?.length && !e.ab?.cells.length) out.push({ at: e.id, problem: 'no numbers: record metrics (--metric) or an A/B (--ab)' });
    return out;
  }
}
