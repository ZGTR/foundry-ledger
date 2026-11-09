/**
 * A learning: what a set of experiments taught, stated so the next engineer can act on it
 * ("compare builds within one run", "a micro-benchmark is not the frame"). Experiments are the
 * evidence; learnings are the conclusions, each pointing back at the experiments it came from.
 */
export interface Learning {
  readonly id: string;
  readonly date: string;
  /** The rule, in one line. */
  readonly title: string;
  /** Why it holds and how to apply it. */
  readonly lesson: string;
  readonly area: string;
  /** Ids of the experiments that taught it. */
  readonly experiments: readonly string[];
}

export type LearningDraft = Omit<Learning, 'id' | 'date'> & { readonly date?: string };

export class InvalidLearningError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`invalid learning: ${problems.join('; ')}`);
    this.name = 'InvalidLearningError';
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates and freezes a learning. `known` lists the experiment ids it may cite: a learning
 * that cites an experiment the ledger does not hold is evidence nobody can follow.
 */
export function createLearning(id: string, date: string, draft: LearningDraft, known: readonly string[]): Learning {
  const problems: string[] = [];
  if (!draft.title?.trim()) problems.push('title is required');
  if (!draft.lesson?.trim()) problems.push('lesson is required');
  if (!ISO_DATE.test(date)) problems.push(`date must be YYYY-MM-DD (got "${date}")`);
  const missing = (draft.experiments ?? []).filter((e) => !known.includes(e));
  if (missing.length) problems.push(`cites experiments the ledger does not hold: ${missing.join(', ')}`);
  if (problems.length) throw new InvalidLearningError(problems);
  return Object.freeze({
    id, date, title: draft.title.trim(), lesson: draft.lesson.trim(), area: draft.area ?? '',
    experiments: Object.freeze([...(draft.experiments ?? [])]),
  });
}
