import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createExperiment, trendOf } from '../src/domain/experiment.js';
import { createLearning, InvalidLearningError } from '../src/domain/learning.js';
import { Ledger, SequentialIds } from '../src/domain/ledger.js';
import { LedgerChecker } from '../src/services/ledger-checker.js';
import { LedgerMerger } from '../src/services/ledger-merger.js';
import { main } from '../src/cli/main.js';

const full = { area: 'web', hypothesis: 'h', method: 'm', before: 'b', after: 'a', evidence: 'e' };
const exp = (id: string, title: string, extra: object = {}) => createExperiment(id, '2026-11-08', { title, decision: 'kept', ...full, ...extra });

test('a learning must cite experiments the ledger holds', () => {
  assert.throws(() => createLearning('L-001', '2026-11-08', { title: 'T', lesson: 'L', area: '', experiments: ['EXP-009'] }, ['EXP-001']), InvalidLearningError);
  const l = createLearning('L-001', '2026-11-08', { title: 'Compare within a run', lesson: 'VMs drift.', area: 'method', experiments: ['EXP-001'] }, ['EXP-001']);
  assert.deepEqual(l.experiments, ['EXP-001']);
});

test('metric trend follows its direction', () => {
  assert.equal(trendOf({ name: 'dropped', before: 56, after: 25 }), 'improved');
  assert.equal(trendOf({ name: 'fps', before: 21, after: 43, better: 'higher' }), 'improved');
  assert.equal(trendOf({ name: 'commit', before: 1.9, after: 2.4 }), 'regressed');
});

test('check: complete entries from a given id on; history is not judged; stale Markdown is flagged', () => {
  const ledger = new Ledger([
    createExperiment('EXP-001', '2026-11-08', { title: 'old, terse', decision: 'kept', area: '', hypothesis: '', method: '', before: '', after: '', evidence: '' }),
    exp('EXP-002', 'new with numbers', { metrics: [{ name: 'dropped', before: 56, after: 25, unit: '%' }] }),
    exp('EXP-003', 'new without numbers'),
    createExperiment('EXP-004', '2026-11-08', { title: 'measured only', decision: 'measured: not a cost', ...full, metrics: [{ name: 'ms', before: 17, after: 17 }] }),
  ], [], 1, [createLearning('L-001', '2026-11-08', { title: 'T', lesson: 'L', area: '', experiments: ['EXP-002'] }, ['EXP-002'])]);
  const problems = new LedgerChecker().check(ledger, { completeFrom: 'EXP-002', rendered: { expected: 'x', actual: 'y' } });
  assert.deepEqual(problems.map((p) => `${p.at}: ${p.problem}`), [
    'EXP-003: no numbers: record metrics (--metric) or an A/B (--ab)',
    'ledger: the Markdown ledger is out of date: run render',
  ]);
});

test('merge: incoming learnings follow their renumbered experiments; colliding learning ids are renumbered', () => {
  const base = new Ledger([exp('EXP-001', 'A'), exp('EXP-002', 'B')], [], 1,
    [createLearning('L-001', '2026-11-08', { title: 'base lesson', lesson: 'x', area: '', experiments: ['EXP-002'] }, ['EXP-002'])]);
  const incoming = new Ledger([exp('EXP-001', 'A'), exp('EXP-002', 'C (other branch)')], [], 1,
    [createLearning('L-001', '2026-11-08', { title: 'incoming lesson', lesson: 'y', area: '', experiments: ['EXP-002'] }, ['EXP-002'])]);
  const r = new LedgerMerger(new SequentialIds()).merge(base, incoming);
  assert.deepEqual(r.renumbered.map((x) => `${x.from}->${x.to}`), ['EXP-002->EXP-003']);
  assert.deepEqual(r.ledger.learnings.map((l) => `${l.id} ${l.title} ${l.experiments.join(',')}`), ['L-001 base lesson EXP-002', 'L-002 incoming lesson EXP-003']);
});

test('cli: record with --metric, learn, list --learnings, check fails then passes', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'foundry-performance-ledger-'));
  writeFileSync(path.join(dir, 'foundry-performance-ledger.config.json'), JSON.stringify({ completeFrom: 'EXP-001' }));
  const out: string[] = [];
  const run = (...argv: string[]) => main([...argv, '--dir', dir, '--quiet'], (s) => out.push(s));
  assert.equal(await run('record', '--title', 'Underlay', '--decision', 'kept', '--hypothesis', 'h', '--method', 'm', '--before', 'paint 2.1 s', '--after', 'paint 1.1 s', '--evidence', 'parity',
    '--metric', 'paint:2.09:1.09:s', '--metric', 'fps:43:50::higher'), 0);
  const e = JSON.parse(readFileSync(path.join(dir, 'ledger.json'), 'utf8')).experiments[0];
  assert.deepEqual(e.metrics, [{ name: 'paint', before: 2.09, after: 1.09, unit: 's' }, { name: 'fps', before: 43, after: 50, better: 'higher' }]);
  assert.equal(await run('learn', '--title', 'Split static from moving', '--lesson', 'One paint layer per lifetime.', '--from', 'EXP-001'), 0);
  assert.equal(await run('learn', '--title', 'Bad', '--lesson', 'cites nothing real', '--from', 'EXP-404').catch(() => 1), 1);
  out.length = 0;
  assert.equal(await run('list', '--learnings'), 0);
  assert.match(out.join('\n'), /L-001 {2}Split static from moving {2}\(EXP-001\)/);
  assert.match(readFileSync(path.join(dir, 'LEDGER.md'), 'utf8'), /## Learnings[\s\S]*L-001 · Split static from moving[\s\S]*Metrics:\*\* paint 2\.09 → 1\.09 s \(improved\); fps 43 → 50 \(improved\)/);
  out.length = 0;
  assert.equal(await run('check'), 0, out.join('\n'));
  writeFileSync(path.join(dir, 'LEDGER.md'), 'edited by hand\n');
  out.length = 0;
  assert.equal(await run('check'), 1);
  assert.match(out.join('\n'), /out of date/);
  assert.equal(await run('record', '--title', 'Terse', '--decision', 'kept'), 0);
  out.length = 0;
  assert.equal(await run('check'), 1);
  assert.match(out.join('\n'), /EXP-002: hypothesis is empty/);
});
