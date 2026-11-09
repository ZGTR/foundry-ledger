#!/usr/bin/env node
/**
 * The command line: parses arguments into controller calls. It holds no rules of its own.
 *
 *   foundry-performance-ledger init
 *   foundry-performance-ledger record --title "..." --decision kept [--area web] [--hypothesis ...] [--method ...]
 *                      [--before ...] [--after ...] [--evidence ...] [--pr "#123"] [--commit sha]
 *                      [--ab before.json,after.json] [--attach file1,file2]
 *                      [--metric "name:before:after[:unit[:higher]]"]...   (repeatable)
 *   foundry-performance-ledger learn --title "..." --lesson "..." --from EXP-003,EXP-012 [--area web]
 *   foundry-performance-ledger check [--complete-from EXP-043]
 *   foundry-performance-ledger render
 *   foundry-performance-ledger list [--verdict kept|rejected|neutral|open|superseded] [--area web] [--grep text]
 *   foundry-performance-ledger show EXP-012
 *   foundry-performance-ledger merge <incoming-ledger.json>
 *
 * Options for every command: --dir <dir with foundry-performance-ledger.config.json> (default: cwd), --quiet.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { CONFIG_FILE, loadConfig, STARTER_CONFIG } from '../app/config.js';
import { createContainer } from '../app/container.js';
import { JsonFileLedgerStore } from '../adapters/fs.js';
import type { Metric, Verdict } from '../domain/experiment.js';
import { ListView } from '../views/list-view.js';

export interface ParsedArgs { readonly command: string; readonly positional: readonly string[]; readonly flags: ReadonlyMap<string, string | true>; readonly repeated: ReadonlyMap<string, readonly string[]> }

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const [command = 'help', ...rest] = argv;
  const flags = new Map<string, string | true>();
  const positional: string[] = [];
  const repeated = new Map<string, string[]>();
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (!a.startsWith('--')) { positional.push(a); continue; }
    const next = rest[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      flags.set(a.slice(2), next);
      repeated.set(a.slice(2), [...(repeated.get(a.slice(2)) ?? []), next]);
      i++;
    } else flags.set(a.slice(2), true);
  }
  return { command, positional, flags, repeated };
}

const USAGE = `foundry-performance-ledger: a ledger of performance experiments, kept or rejected.

  init                         write ${CONFIG_FILE} and an empty ledger here
  record --title T --decision D [--area --hypothesis --method --before --after --evidence --pr --commit]
         [--ab before.json,after.json] [--attach a,b]   record the next experiment
         [--metric name:before:after[:unit[:higher]]]...      headline numbers (repeatable)
  learn --title T --lesson L --from EXP-001,EXP-002 [--area A]   record a learning
  check [--complete-from EXP-043]                      what is wrong with the ledger (exit 1)
  render                       regenerate the Markdown ledger
  list [--verdict V] [--area A] [--grep text] [--learnings]   list experiments (or learnings)
  show <id>                    print one experiment as JSON
  merge <incoming-ledger.json> merge another branch's ledger into this one (renumbers collisions)

  --dir <path>  the directory holding ${CONFIG_FILE} (default: current directory)
  --quiet       no progress lines`;

export async function main(argv: readonly string[], log: (s: string) => void = (s) => process.stdout.write(`${s}\n`)): Promise<number> {
  const args = parseArgs(argv);
  const str = (k: string) => { const v = args.flags.get(k); return typeof v === 'string' ? v : undefined; };
  const dir = path.resolve(str('dir') ?? process.cwd());
  if (args.command === 'help' || args.flags.has('help')) { log(USAGE); return 0; }
  if (args.command === 'init') {
    const file = path.join(dir, CONFIG_FILE);
    if (existsSync(file)) { log(`${CONFIG_FILE} already exists`); return 1; }
    writeFileSync(file, `${JSON.stringify(STARTER_CONFIG, null, 2)}\n`);
    log(`wrote ${CONFIG_FILE}`);
  }
  const config = loadConfig(dir);
  const { controller, markdown } = createContainer(config, { quiet: args.flags.has('quiet') });
  switch (args.command) {
    case 'init':
    case 'render':
      await controller.render();
      return 0;
    case 'record': {
      const title = str('title'), decision = str('decision');
      if (!title || !decision) { log('record needs --title and --decision'); return 2; }
      const ab = str('ab')?.split(',');
      await controller.record(
        { title, decision, area: str('area') ?? '', hypothesis: str('hypothesis') ?? '', method: str('method') ?? '', before: str('before') ?? '', after: str('after') ?? '', evidence: str('evidence') ?? '', pr: str('pr') ?? null, commit: str('commit') ?? null, date: str('date'),
          metrics: (args.repeated.get('metric') ?? []).map(parseMetric) },
        { ab: ab && ab.length === 2 ? { before: ab[0], after: ab[1] } : undefined, attach: str('attach')?.split(',') },
      );
      return 0;
    }
    case 'list':
      log(await controller.view(new ListView({ verdict: str('verdict') as Verdict | undefined, area: str('area'), text: str('grep'), learnings: args.flags.has('learnings') })));
      return 0;
    case 'learn': {
      const title = str('title'), lesson = str('lesson');
      if (!title || !lesson) { log('learn needs --title and --lesson (and --from EXP-..., the experiments it came from)'); return 2; }
      await controller.learn({ title, lesson, area: str('area') ?? '', experiments: str('from')?.split(',').map((s) => s.trim()).filter(Boolean) ?? [], date: str('date') });
      return 0;
    }
    case 'check': {
      const current = existsSync(config.markdownFile) ? readFileSync(config.markdownFile, 'utf8') : undefined;
      const problems = await controller.check({ completeFrom: str('complete-from') ?? config.raw.completeFrom, render: { view: markdown, current } });
      for (const p of problems) log(`${p.at}: ${p.problem}`);
      log(problems.length ? `${problems.length} problem(s)` : 'ledger ok');
      return problems.length ? 1 : 0;
    }
    case 'show': {
      const e = await controller.show(args.positional[0] ?? '');
      if (!e) { log(`no experiment ${args.positional[0] ?? ''}`); return 1; }
      log(JSON.stringify(e, null, 2));
      return 0;
    }
    case 'merge': {
      const incoming = args.positional[0];
      if (!incoming) { log('merge needs the incoming ledger file'); return 2; }
      const r = await controller.merge(new JsonFileLedgerStore(path.resolve(incoming)));
      log(`merged: ${r.renumbered.length} renumbered, ${r.shared.length} shared`);
      return 0;
    }
    default:
      log(`unknown command "${args.command}"\n\n${USAGE}`);
      return 2;
  }
}

/** "dropped:56:25:%" or "fps:21:43::higher" -> a Metric. */
export function parseMetric(spec: string): Metric {
  const [name, before, after, unit, better] = spec.split(':');
  const m: Metric = { name: name ?? '', before: Number(before), after: Number(after), ...(unit ? { unit } : {}), ...(better === 'higher' ? { better: 'higher' as const } : {}) };
  if (!m.name || !Number.isFinite(m.before) || !Number.isFinite(m.after)) throw new Error(`--metric "${spec}": expected name:before:after[:unit[:higher]]`);
  return m;
}

const invokedDirectly = process.argv[1] && /performance-ledger|perf-ledger|main\.js$/.test(path.basename(process.argv[1]));
if (invokedDirectly) main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (e: Error) => { process.stderr.write(`foundry-performance-ledger: ${e.message}\n`); process.exitCode = 1; });
