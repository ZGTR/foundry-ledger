#!/usr/bin/env node
/**
 * The command line: parses arguments into controller calls. It holds no rules of its own.
 *
 *   perf-ledger init
 *   perf-ledger record --title "..." --decision kept [--area web] [--hypothesis ...] [--method ...]
 *                      [--before ...] [--after ...] [--evidence ...] [--pr "#123"] [--commit sha]
 *                      [--ab before.json,after.json] [--attach file1,file2]
 *   perf-ledger render
 *   perf-ledger list [--verdict kept|rejected|neutral|open|superseded] [--area web] [--grep text]
 *   perf-ledger show EXP-012
 *   perf-ledger merge <incoming-ledger.json>
 *
 * Options for every command: --dir <dir with perf-ledger.config.json> (default: cwd), --quiet.
 */
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { CONFIG_FILE, loadConfig, STARTER_CONFIG } from '../app/config.js';
import { createContainer } from '../app/container.js';
import { JsonFileLedgerStore } from '../adapters/fs.js';
import type { Verdict } from '../domain/experiment.js';
import { ListView } from '../views/list-view.js';

export interface ParsedArgs { readonly command: string; readonly positional: readonly string[]; readonly flags: ReadonlyMap<string, string | true> }

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const [command = 'help', ...rest] = argv;
  const flags = new Map<string, string | true>();
  const positional: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (!a.startsWith('--')) { positional.push(a); continue; }
    const next = rest[i + 1];
    if (next !== undefined && !next.startsWith('--')) { flags.set(a.slice(2), next); i++; } else flags.set(a.slice(2), true);
  }
  return { command, positional, flags };
}

const USAGE = `perf-ledger: a ledger of performance experiments, kept or rejected.

  init                         write ${CONFIG_FILE} and an empty ledger here
  record --title T --decision D [--area --hypothesis --method --before --after --evidence --pr --commit]
         [--ab before.json,after.json] [--attach a,b]   record the next experiment
  render                       regenerate the Markdown ledger
  list [--verdict V] [--area A] [--grep text]          list experiments
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
  const { controller } = createContainer(config, { quiet: args.flags.has('quiet') });
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
        { title, decision, area: str('area') ?? '', hypothesis: str('hypothesis') ?? '', method: str('method') ?? '', before: str('before') ?? '', after: str('after') ?? '', evidence: str('evidence') ?? '', pr: str('pr') ?? null, commit: str('commit') ?? null, date: str('date') },
        { ab: ab && ab.length === 2 ? { before: ab[0], after: ab[1] } : undefined, attach: str('attach')?.split(',') },
      );
      return 0;
    }
    case 'list':
      log(await controller.view(new ListView({ verdict: str('verdict') as Verdict | undefined, area: str('area'), text: str('grep') })));
      return 0;
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

const invokedDirectly = process.argv[1] && /perf-ledger|main\.js$/.test(path.basename(process.argv[1]));
if (invokedDirectly) main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (e: Error) => { process.stderr.write(`perf-ledger: ${e.message}\n`); process.exitCode = 1; });
