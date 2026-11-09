/**
 * One performance experiment, kept or rejected. The ledger's unit of record.
 *
 * Free-text fields stay free text on purpose: an experiment is written by an engineer for the
 * next engineer, and forcing every result into numbers loses the caveats that make it honest
 * ("neutral on this VM; GPU fill pass on device"). The machine-readable parts are the id, the
 * date, the verdict derived from the decision, and the optional A/B comparison.
 */
export interface AbCell {
  /** What was compared, e.g. "low/playground/drag-slow". */
  readonly key: string;
  /** One line per metric, e.g. "dropped 56 -> 25 %". */
  readonly text: string;
}

export interface AbComparison {
  /** Labels of the two runs that were compared. */
  readonly before: string;
  readonly after: string;
  readonly cells: readonly AbCell[];
}

/**
 * One headline number, before and after, in its unit ("dropped", 56, 25, "%"). Free-text before
 * and after say what a reader needs; metrics let tools compare, chart and gate.
 */
export interface Metric {
  readonly name: string;
  readonly before: number;
  readonly after: number;
  readonly unit?: string;
  /** Which direction is an improvement (default "lower": times, dropped frames, bytes). */
  readonly better?: 'lower' | 'higher';
}

/** "improved", "regressed" or "unchanged", by the metric's own direction. */
export function trendOf(m: Metric): 'improved' | 'regressed' | 'unchanged' {
  if (m.after === m.before) return 'unchanged';
  const lower = (m.better ?? 'lower') === 'lower';
  return (m.after < m.before) === lower ? 'improved' : 'regressed';
}

export interface Experiment {
  readonly id: string;
  /** ISO date (YYYY-MM-DD) the experiment was recorded. */
  readonly date: string;
  readonly title: string;
  /** Where in the system: "web", "native", "engine", "startup", "memory"... */
  readonly area: string;
  /** Why it should help, measured or suspected. */
  readonly hypothesis: string;
  /** How it was measured: the tools, the runs, the controls. */
  readonly method: string;
  readonly before: string;
  readonly after: string;
  /** "kept", "rejected", "neutral", "open"... optionally followed by detail. */
  readonly decision: string;
  /** Where the proof lives: a test, a script, a trace, a recording. */
  readonly evidence: string;
  readonly commit?: string | null;
  readonly pr?: string | null;
  readonly ab?: AbComparison;
  /** Headline numbers, before and after (see Metric). */
  readonly metrics?: readonly Metric[];
  /** Raw result files kept beside the ledger, relative to it. */
  readonly results?: readonly string[];
}

/** The decision's first word, normalised: what filters and summaries group by. */
export type Verdict = 'kept' | 'rejected' | 'neutral' | 'open' | 'superseded' | 'other';

const VERDICTS: readonly Verdict[] = ['kept', 'rejected', 'neutral', 'open', 'superseded'];

export function verdictOf(experiment: Pick<Experiment, 'decision'>): Verdict {
  const word = experiment.decision.trim().toLowerCase().match(/^[a-z]+/)?.[0] ?? '';
  return (VERDICTS as readonly string[]).includes(word) ? (word as Verdict) : 'other';
}

/** What a caller supplies to record an experiment; the ledger assigns the id. */
export type ExperimentDraft = Omit<Experiment, 'id' | 'date'> & { readonly date?: string };

export class InvalidExperimentError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`invalid experiment: ${problems.join('; ')}`);
    this.name = 'InvalidExperimentError';
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Validates a draft and freezes it into an experiment with the given id and date. */
export function createExperiment(id: string, date: string, draft: ExperimentDraft): Experiment {
  const problems: string[] = [];
  if (!draft.title?.trim()) problems.push('title is required');
  if (!ISO_DATE.test(date)) problems.push(`date must be YYYY-MM-DD (got "${date}")`);
  if (!draft.decision?.trim()) problems.push('decision is required (kept, rejected, neutral, open...)');
  for (const m of draft.metrics ?? []) {
    if (!m.name?.trim()) problems.push('every metric needs a name');
    if (!Number.isFinite(m.before) || !Number.isFinite(m.after)) problems.push(`metric "${m.name}" needs numeric before and after`);
  }
  if (problems.length) throw new InvalidExperimentError(problems);
  return Object.freeze({
    id, date,
    title: draft.title.trim(), area: draft.area ?? '', hypothesis: draft.hypothesis ?? '', method: draft.method ?? '',
    before: draft.before ?? '', after: draft.after ?? '', decision: draft.decision.trim(), evidence: draft.evidence ?? '',
    commit: draft.commit ?? null, pr: draft.pr ?? null,
    ...(draft.ab ? { ab: draft.ab } : {}),
    ...(draft.metrics?.length ? { metrics: draft.metrics.map((m) => Object.freeze({ ...m })) } : {}),
    ...(draft.results?.length ? { results: [...draft.results] } : {}),
  });
}
