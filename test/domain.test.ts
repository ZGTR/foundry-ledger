import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createExperiment, InvalidExperimentError, verdictOf } from '../src/domain/experiment.js';
import { DuplicateExperimentError, Ledger, SequentialIds } from '../src/domain/ledger.js';

const draft = { title: 'Lazy scenery', decision: 'kept', area: 'web', hypothesis: '', method: '', before: '', after: '', evidence: '' };

test('an experiment needs a title, a decision and an ISO date', () => {
  assert.throws(() => createExperiment('EXP-001', '2026-11-08', { ...draft, title: ' ' }), InvalidExperimentError);
  assert.throws(() => createExperiment('EXP-001', '2026-11-08', { ...draft, decision: '' }), InvalidExperimentError);
  assert.throws(() => createExperiment('EXP-001', '8/11/2026', draft), /YYYY-MM-DD/);
  const e = createExperiment('EXP-001', '2026-11-08', draft);
  assert.equal(e.id, 'EXP-001');
  assert.ok(Object.isFrozen(e));
});

test('the verdict is the decision\'s first word, so free-text decisions still group', () => {
  assert.equal(verdictOf({ decision: 'kept (#763)' }), 'kept');
  assert.equal(verdictOf({ decision: 'REJECTED (replaced by EXP-009)' }), 'rejected');
  assert.equal(verdictOf({ decision: 'no leak (check added)' }), 'other');
});

test('ids are one past the highest, never reused, and other prefixes are ignored', () => {
  const ids = new SequentialIds();
  assert.equal(ids.next([]), 'EXP-001');
  assert.equal(ids.next(['EXP-001', 'EXP-007', 'RUN-099']), 'EXP-008');
  assert.equal(new SequentialIds('PERF-', 4).next(['PERF-0009']), 'PERF-0010');
});

test('the ledger keeps order and refuses a duplicate id', () => {
  const l = new Ledger([createExperiment('EXP-001', '2026-11-08', draft)]);
  assert.throws(() => l.add(createExperiment('EXP-001', '2026-11-08', draft)), DuplicateExperimentError);
  l.add(createExperiment('EXP-002', '2026-11-08', { ...draft, title: 'Second' }));
  assert.deepEqual(l.ids, ['EXP-001', 'EXP-002']);
  assert.equal(l.nextId(new SequentialIds()), 'EXP-003');
});
