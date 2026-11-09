import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../src/cli/main.js';
import { JsonFileLedgerStore } from '../src/adapters/fs.js';
import { MarkdownLedgerView } from '../src/views/markdown-view.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const fixtures = path.join(repo, 'test/fixtures');

test('compatibility: a ledger written by the original tool loads, and renders the same table and details', async () => {
  const ledger = await new JsonFileLedgerStore(path.join(fixtures, 'original-ledger.json')).load();
  assert.ok(ledger.experiments.length >= 35);
  const ours = new MarkdownLedgerView().render(ledger).split('\n');
  const theirs = readFileSync(path.join(fixtures, 'original-LEDGER.md'), 'utf8').split('\n');
  // Every table row and every detail line the original rendered, we render identically (the
  // header prose differs by design: it is configurable).
  const rows = (lines: string[]) => lines.filter((l) => l.startsWith('| EXP-') || l.startsWith('### ') || l.startsWith('- **') || l.startsWith('  - '));
  assert.deepEqual(rows(ours), rows(theirs));
});

test('cli: init, record with an A/B, list, show, render, merge, end to end in a temp dir', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'foundry-performance-ledger-'));
  cpSync(path.join(repo, 'examples/shape-actors-web/foundry-performance-ledger.config.json'), path.join(dir, 'foundry-performance-ledger.config.json'));
  const out: string[] = [];
  const run = (...argv: string[]) => main([...argv, '--dir', dir], (s) => out.push(s));
  assert.equal(await run('render'), 0);
  assert.equal(await run('record', '--title', 'Zone arrows from the stage frame', '--decision', 'kept', '--area', 'web',
    '--ab', `${path.join(repo, 'examples/bench/before.json')},${path.join(repo, 'examples/bench/after.json')}`), 0);
  const ledger = JSON.parse(readFileSync(path.join(dir, 'ledger.json'), 'utf8'));
  const e = ledger.experiments[0];
  assert.equal(e.id, 'EXP-001');
  assert.ok(e.ab.cells.some((c: { key: string; text: string }) => c.key === 'low/playground/swipe-nudge' && /^dropped 81\.07→37\.38 %/.test(c.text)), JSON.stringify(e.ab.cells.slice(0, 3)));
  assert.ok(e.ab.cells.some((c: { key: string }) => c.key === 'low/playground/open'));
  for (const f of e.results) assert.ok(existsSync(path.join(dir, f)), f);
  assert.match(readFileSync(path.join(dir, 'LEDGER.md'), 'utf8'), /\| EXP-001 \|/);
  out.length = 0;
  assert.equal(await run('list', '--verdict', 'kept'), 0);
  assert.match(out.join('\n'), /EXP-001 {2}kept/);
  assert.equal(await run('show', 'EXP-001'), 0);
  // Another branch recorded its own EXP-001 meanwhile: merge renumbers ours... here, theirs comes in.
  const other = path.join(dir, 'other.json');
  writeFileSync(other, JSON.stringify({ schema: 1, experiments: [{ ...e, title: 'Another branch\'s experiment', results: [] }], runs: [] }));
  out.length = 0;
  assert.equal(await run('merge', other), 0);
  assert.match(out.join('\n'), /merged: 1 renumbered/);
  const merged = JSON.parse(readFileSync(path.join(dir, 'ledger.json'), 'utf8'));
  assert.deepEqual(merged.experiments.map((x: { id: string }) => x.id), ['EXP-001', 'EXP-002']);
});
