import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createExperiment } from '../src/domain/experiment.js';
import { Ledger, SequentialIds } from '../src/domain/ledger.js';
import { AbSummarizer } from '../src/services/ab-summarizer.js';
import { LedgerMerger } from '../src/services/ledger-merger.js';

const exp = (id: string, title: string, results?: string[]) =>
  createExperiment(id, '2026-11-08', { title, decision: 'kept', area: 'web', hypothesis: '', method: '', before: '', after: '', evidence: '', results });

test('A/B: one cell per key in both runs, one phrase per metric in both rows, formatted', () => {
  const s = new AbSummarizer([{ name: 'dropped', unit: '%', digits: 1 }, { name: 'p95', label: 'input p95', unit: 'ms', digits: 0 }]);
  const ab = s.compare(
    { label: 'svg', rows: [{ key: 'low/drag', metrics: { dropped: 56.04, p95: 102.4 } }, { key: 'low/only-before', metrics: { dropped: 1 } }] },
    { label: 'canvas', rows: [{ key: 'low/drag', metrics: { dropped: 25.01, p95: undefined } }] },
  );
  assert.deepEqual(ab, { before: 'svg', after: 'canvas', cells: [{ key: 'low/drag', text: 'dropped 56→25 %' }] });
});

test('merge: the base keeps its ids; shared history stays once; a colliding id is renumbered with its files', () => {
  // Two branches each recorded "the next" experiment: both called it EXP-034 (it happened).
  const base = new Ledger([exp('EXP-033', 'Underlay'), exp('EXP-034', 'World open: backdrop built once', ['results/EXP-034/after-web.json'])]);
  const incoming = new Ledger([exp('EXP-033', 'Underlay'), exp('EXP-034', 'Canvas stage', ['results/EXP-034/after-canvas.json', 'results/EXP-034/hit-parity.txt'])]);
  const r = new LedgerMerger(new SequentialIds()).merge(base, incoming);
  assert.deepEqual(r.ledger.experiments.map((e) => `${e.id} ${e.title}`), ['EXP-033 Underlay', 'EXP-034 World open: backdrop built once', 'EXP-035 Canvas stage']);
  assert.deepEqual(r.shared, ['EXP-033']);
  assert.deepEqual(r.renumbered, [{ from: 'EXP-034', to: 'EXP-035', files: [
    { from: 'results/EXP-034/after-canvas.json', to: 'results/EXP-035/after-canvas.json' },
    { from: 'results/EXP-034/hit-parity.txt', to: 'results/EXP-035/hit-parity.txt' },
  ] }]);
  assert.deepEqual(r.ledger.find('EXP-035')?.results, ['results/EXP-035/after-canvas.json', 'results/EXP-035/hit-parity.txt']);
  // The base's own entry is untouched.
  assert.deepEqual(r.ledger.find('EXP-034')?.results, ['results/EXP-034/after-web.json']);
});

test('merge: an incoming experiment with a free id is appended as is', () => {
  const r = new LedgerMerger(new SequentialIds()).merge(new Ledger([exp('EXP-001', 'A')]), new Ledger([exp('EXP-001', 'A'), exp('EXP-002', 'B')]));
  assert.deepEqual(r.ledger.ids, ['EXP-001', 'EXP-002']);
  assert.equal(r.renumbered.length, 0);
});
