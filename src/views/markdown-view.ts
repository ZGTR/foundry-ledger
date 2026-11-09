import type { Experiment } from '../domain/experiment.js';
import type { Ledger } from '../domain/ledger.js';

/** A view: the ledger in, text out. Views never load, save or decide anything. */
export interface LedgerView {
  readonly name: string;
  render(ledger: Ledger): string;
}

export interface MarkdownOptions {
  readonly title?: string;
  /** A paragraph under the title: what is measured, on what machine, how to compare rows. */
  readonly intro?: string;
  /** Shown in the "generated" notice so nobody edits the output by hand. */
  readonly source?: string;
}

const cell = (s: unknown) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const decision = (e: Experiment) => `${e.decision}${e.pr ? ` (${e.pr})` : ''}`;

/** LEDGER.md: a one-line-per-experiment table, then every experiment in full. */
export class MarkdownLedgerView implements LedgerView {
  readonly name = 'markdown';
  constructor(private readonly options: MarkdownOptions = {}) {}

  render(ledger: Ledger): string {
    const o = this.options;
    const lines = [
      `# ${o.title ?? 'Performance experiment ledger'}`, '',
      `_Generated from \`${o.source ?? 'ledger.json'}\` by foundry-performance-ledger. Do not edit by hand._`, '',
      ...(o.intro ? [o.intro, ''] : []),
      '| id | date | area | experiment | before | after | decision | evidence |',
      '|---|---|---|---|---|---|---|---|',
      ...ledger.experiments.map((e) =>
        `| ${e.id} | ${e.date} | ${cell(e.area)} | **${cell(e.title)}**<br>${cell(e.hypothesis)} | ${cell(e.before)} | ${cell(e.after)} | ${cell(decision(e))} | ${cell(e.evidence)} |`),
      ...(ledger.runs.length
        ? ['', '## Runs', '', ...ledger.runs.map((r) => `- **${r.id}** (${r.date}${r.pr ? `, ${r.pr}` : ''}): ${r.title}. Raw: ${r.results.map((x) => `\`${x}\``).join(', ')}`)]
        : []),
      '', '## Details', '',
      ...ledger.experiments.flatMap((e) => this.details(e)),
    ];
    return lines.join('\n');
  }

  private details(e: Experiment): string[] {
    return [
      `### ${e.id} · ${e.title}`, '',
      `- **Area:** ${e.area}`, `- **Hypothesis:** ${e.hypothesis}`, `- **Method:** ${e.method}`,
      `- **Before:** ${e.before}`, `- **After:** ${e.after}`, `- **Decision:** ${decision(e)}`, `- **Evidence:** ${e.evidence}`,
      ...(e.commit ? [`- **Commit:** ${e.commit}`] : []),
      ...(e.results?.length ? [`- **Raw results (checked in):** ${e.results.map((r) => `\`${r}\``).join(', ')}`] : []),
      ...(e.ab ? [`- **A/B (${e.ab.before} → ${e.ab.after}):**`, ...e.ab.cells.map((c) => `  - ${c.key ? `${c.key}: ` : ''}${c.text}`)] : []),
      '',
    ];
  }
}
