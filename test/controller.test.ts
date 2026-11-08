import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LedgerController } from '../src/controller/ledger-controller.js';
import { createExperiment } from '../src/domain/experiment.js';
import { Ledger, SequentialIds } from '../src/domain/ledger.js';
import { EventBus } from '../src/events.js';
import { AbSummarizer } from '../src/services/ab-summarizer.js';
import { LedgerMerger } from '../src/services/ledger-merger.js';
import { renderOnChange } from '../src/app/container.js';
import { MarkdownLedgerView } from '../src/views/markdown-view.js';
import { ListView } from '../src/views/list-view.js';
import { FakeBench, FixedClock, MemoryArtifacts, MemoryOutput, MemoryStore } from './fakes.js';

function wire(store = new MemoryStore()) {
  const events = new EventBus();
  const artifacts = new MemoryArtifacts();
  const ids = new SequentialIds();
  const bench = new FakeBench({
    'a.json': { label: 'before', rows: [{ key: 'low/drag', metrics: { dropped: 56 } }] },
    'b.json': { label: 'after', rows: [{ key: 'low/drag', metrics: { dropped: 25 } }] },
  });
  const controller = new LedgerController({ store, artifacts, bench, summarizer: new AbSummarizer([{ name: 'dropped', unit: '%' }]), merger: new LedgerMerger(ids), ids, clock: new FixedClock(), events });
  const output = new MemoryOutput();
  renderOnChange(events, new MarkdownLedgerView({ title: 'T' }), output);
  return { controller, events, store, artifacts, output };
}

const draft = { title: 'Underlay svg', decision: 'kept', area: 'web', hypothesis: 'static layers re-recorded', method: 'trace', before: 'paint 2.1 s', after: 'paint 1.1 s', evidence: 'stage-parity' };

test('record: next id, today, A/B summarised, raw files kept, saved, events announced, view re-rendered', async () => {
  const w = wire();
  const seen: string[] = [];
  w.events.on('experiment.recorded', ({ experiment }) => { seen.push(`recorded ${experiment.id}`); });
  w.events.on('ledger.changed', ({ reason }) => { seen.push(`changed: ${reason}`); });
  const e = await w.controller.record(draft, { ab: { before: 'a.json', after: 'b.json' } });
  assert.equal(e.id, 'EXP-001');
  assert.equal(e.date, '2026-11-08');
  assert.deepEqual(e.ab?.cells, [{ key: 'low/drag', text: 'dropped 56→25 %' }]);
  assert.deepEqual(e.results, ['results/EXP-001/before-a.json', 'results/EXP-001/after-b.json']);
  assert.equal(w.store.saves, 1);
  assert.deepEqual(seen, ['recorded EXP-001', 'changed: recorded EXP-001']);
  assert.match(w.output.written.get('markdown') ?? '', /\| EXP-001 \| 2026-11-08 \| web \| \*\*Underlay svg\*\*/);
});

test('record: an invalid draft saves nothing and announces nothing', async () => {
  const w = wire();
  let events = 0;
  w.events.on('ledger.changed', () => { events++; });
  await assert.rejects(w.controller.record({ ...draft, decision: '' }));
  assert.equal(w.store.saves, 0);
  assert.equal(events, 0);
});

test('merge: renumbered experiments move their kept files; the view re-renders once', async () => {
  const mine = new Ledger([createExperiment('EXP-001', '2026-11-08', { ...draft, title: 'Base entry' })]);
  const w = wire(new MemoryStore(mine));
  w.artifacts.files.set('results/EXP-001/canvas.json', 'src');
  const incoming = new MemoryStore(new Ledger([createExperiment('EXP-001', '2026-11-08', { ...draft, title: 'Other branch', results: ['results/EXP-001/canvas.json'] })]));
  let renders = 0;
  w.events.on('view.rendered', () => { renders++; });
  const r = await w.controller.merge(incoming);
  assert.deepEqual(r.renumbered.map((x) => `${x.from}->${x.to}`), ['EXP-001->EXP-002']);
  assert.ok(w.artifacts.files.has('results/EXP-002/canvas.json'));
  assert.ok(!w.artifacts.files.has('results/EXP-001/canvas.json'));
  assert.equal(renders, 1);
});

test('views: the list filters by verdict and counts', async () => {
  const w = wire();
  await w.controller.record(draft);
  await w.controller.record({ ...draft, title: 'Composed matrices', decision: 'REJECTED (no gain in the frame)' });
  const out = await w.controller.view(new ListView({ verdict: 'rejected' }));
  assert.match(out, /EXP-002 {2}rejected/);
  assert.match(out, /1 experiment\(s\): 1 rejected/);
});
