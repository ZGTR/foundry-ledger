#!/usr/bin/env node
// The performance experiment ledger: every experiment, kept or rejected, with its hypothesis,
// method, before/after numbers, decision and evidence, so later work can refer to it.
//
//   node packages/shape-actors/scripts/perf/experiments/record-experiment.mjs \
//     --title "…" --area web --hypothesis "…" --method "…" --decision kept|rejected|… \
//     [--before "…" --after "…"] [--evidence "…"] [--pr "#123"] \
//     [--ab before-web.json,after-web.json]      # fills before/after from two web-bench runs
//   node …/record-experiment.mjs --render          # only regenerate LEDGER.md from ledger.json
//
// ledger.json is the source of truth; LEDGER.md is generated from it (do not edit by hand).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(HERE, 'ledger.json');
const MD = path.join(HERE, 'LEDGER.md');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const ledger = JSON.parse(fs.readFileSync(FILE, 'utf8'));

/** "dropped a → b, input a → b" per cell, from two web-bench JSON files. */
function abSummary(beforeFile, afterFile) {
  const a = JSON.parse(fs.readFileSync(beforeFile, 'utf8')), b = JSON.parse(fs.readFileSync(afterFile, 'utf8'));
  const key = (r) => `${r.device}/${r.theme}/${r.scenario}`;
  const after = new Map(b.rows.map((r) => [key(r), r]));
  const cells = a.rows.filter((r) => after.has(key(r))).map((r) => {
    const n = after.get(key(r));
    return `${key(r)}: dropped ${r.droppedPct}→${n.droppedPct} %${r.scenario === 'idle' ? '' : `, input p95 ${r.inputLatencyMs.p95}→${n.inputLatencyMs.p95} ms`}${r.memory && n.memory ? `, heap ${r.memory.jsHeapMB}→${n.memory.jsHeapMB} MB, nodes ${r.memory.domNodes}→${n.memory.domNodes}` : ''}`;
  });
  const opens = (a.opens ?? []).map((o) => { const n = (b.opens ?? []).find((x) => x.device === o.device && x.theme === o.theme); return n ? `${o.device}/${o.theme}: world open ${o.openMs}→${n.openMs} ms` : ''; }).filter(Boolean);
  return { before: `${a.label ?? path.basename(beforeFile)}`, after: `${b.label ?? path.basename(afterFile)}`, cells: [...opens, ...cells] };
}

if (!process.argv.includes('--render')) {
  const title = arg('--title');
  if (!title) { console.error('need --title (or --render)'); process.exit(2); }
  const id = `EXP-${String(ledger.experiments.length + 1).padStart(3, '0')}`;
  const entry = {
    id, date: new Date().toISOString().slice(0, 10), title, area: arg('--area') ?? '', hypothesis: arg('--hypothesis') ?? '',
    method: arg('--method') ?? '', before: arg('--before') ?? '', after: arg('--after') ?? '', decision: arg('--decision') ?? 'open',
    evidence: arg('--evidence') ?? '', commit: arg('--commit') ?? null, pr: arg('--pr') ?? null,
  };
  if (arg('--ab')) {
    const [x, y] = arg('--ab').split(',');
    entry.ab = abSummary(x, y);
    // Keep the raw before/after next to the ledger, so the numbers can be re-read later.
    const dir = path.join(HERE, 'results', id); fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(x, path.join(dir, 'before-' + path.basename(x))); fs.copyFileSync(y, path.join(dir, 'after-' + path.basename(y)));
    entry.results = fs.readdirSync(dir).map((f) => `experiments/results/${id}/${f}`);
  }
  ledger.experiments.push(entry);
  fs.writeFileSync(FILE, JSON.stringify(ledger, null, 1) + '\n');
  console.log(`recorded ${id}: ${title}`);
}

const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const lines = [
  '# Performance experiment ledger', '',
  '_Generated from `ledger.json` by `record-experiment.mjs --render`. Do not edit by hand._', '',
  'Every performance experiment on the shape-actors stage (Dunyati worlds), kept or rejected, so later',
  'work starts from what was already measured. Numbers are from this repository\'s perf suite',
  '(`scripts/perf/`) on a 4-vCPU cloud VM: compare within one row, not across rows run on different days.', '',
  '| id | date | area | experiment | before | after | decision | evidence |', '|---|---|---|---|---|---|---|---|',
  ...ledger.experiments.map((e) => `| ${e.id} | ${e.date} | ${esc(e.area)} | **${esc(e.title)}**<br>${esc(e.hypothesis)} | ${esc(e.before)} | ${esc(e.after)} | ${esc(e.decision)}${e.pr ? ` (${e.pr})` : ''} | ${esc(e.evidence)} |`),
  ...(ledger.runs?.length ? ['', '## Runs', '', ...ledger.runs.map((r) => `- **${r.id}** (${r.date}, ${r.pr ?? ''}): ${r.title}. Raw: ${r.results.map((x) => `\`${x}\``).join(', ')}`)] : []),
  '', '## Details', '',
  ...ledger.experiments.flatMap((e) => [
    `### ${e.id} · ${e.title}`, '', `- **Area:** ${e.area}`, `- **Hypothesis:** ${e.hypothesis}`, `- **Method:** ${e.method}`,
    `- **Before:** ${e.before}`, `- **After:** ${e.after}`, `- **Decision:** ${e.decision}${e.pr ? ` (${e.pr})` : ''}`, `- **Evidence:** ${e.evidence}`,
    ...(e.results?.length ? [`- **Raw results (checked in):** ${e.results.map((r) => `\`${r}\``).join(', ')}`] : []),
    ...(e.ab ? [`- **A/B (${e.ab.before} → ${e.ab.after}):**`, ...e.ab.cells.map((c) => `  - ${c}`)] : []), '',
  ]),
];
fs.writeFileSync(MD, lines.join('\n'));
console.log(`LEDGER.md: ${ledger.experiments.length} experiments`);
