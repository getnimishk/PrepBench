// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { CONCURRENCY_COUPLINGS, SCENARIO, runConcurrency, type ConcurrencyLevers } from './concurrencyModel';
import type { ExperimentDefinition, Levers, ModelRun } from './definition';

/**
 * ADF Behaviour Lab, experiment 3: Concurrency Budget (PHASE-5-CONTRACT.md, E1), on the new
 * concurrency model. The prototype's Concurrency page is the UX reference; its constants and
 * claims are not used (no "2 to 256 DIUs", no exact connection counts, no ORA-error invented as
 * an outcome): ranges and behaviour are the ADF guide's, scenario figures are labelled constants.
 */

export const MODEL = 'concurrencyModel';

const asLevers = (l: Levers): ConcurrencyLevers => ({
  concurrencyLimit: l.concurrencyLimit as number | null,
  batchCount: l.batchCount as number,
  parallelCopies: l.parallelCopies as number,
  poolCap: l.poolCap as number,
});

export function modelRun(_: unknown, l: Levers): ModelRun {
  const r = runConcurrency(asLevers(l));
  return {
    outcome: r.status,
    measures: {
      peak: { label: 'Connections at peak (planning upper bound)', value: r.peakConnections, unit: 'connections' },
      failed: { label: 'Copies that fail', value: r.failedCopies, unit: `of ${r.totalCopies}` },
      queued: { label: 'Runs waiting in the queue', value: r.queuedRuns, unit: 'runs' },
      minutes: { label: 'Time to finish (teaching constant per wave)', value: r.minutes, unit: 'minutes' },
      result: { label: 'What happens', value: r.status },
    },
    findings: r.findings,
  };
}

/** Four runs at the ForEach default, two parallel copies each, against a 40-connection source. */
export const PRESET: ConcurrencyLevers = { concurrencyLimit: null, batchCount: 20, parallelCopies: 2, poolCap: 40 };

export const CONCURRENCY: ExperimentDefinition<null> = {
  track: 'concurrency',
  idPrefix: 'cc',
  model: MODEL,
  loadContext: () => Promise.resolve(null),
  understand: 'Concurrency stacks up in layers. A pipeline can run several times at once (it has no maximum by default); '
    + 'each run’s ForEach copies up to its batch count of tables at once; and each copy holds as many connections as it '
    + 'has parallel copies. Multiplied together, that is the load the source system sees at its busiest.',
  preset: { ...PRESET },
  levers: [
    { key: 'concurrencyLimit', label: 'Pipeline concurrency', options: [
      { value: null, label: 'Not set' }, { value: 1, label: '1' }, { value: 2, label: '2' }, { value: 4, label: '4' }] },
    { key: 'batchCount', label: 'ForEach batch count', options: [5, 10, 20, 50].map((v) => ({ value: v, label: String(v) })) },
    { key: 'parallelCopies', label: 'Parallel copies per copy', options: [1, 2, 4, 8].map((v) => ({ value: v, label: String(v) })) },
    { key: 'poolCap', label: 'Connections the source accepts', options: [30, 40, 60].map((v) => ({ value: v, label: String(v) })) },
  ],
  heldNote: `The levers start at the scenario you predicted: ${SCENARIO.runs} runs of ${SCENARIO.tables} tables, started together. `
    + 'Change one or more, then run the model.',
  run: modelRun,
  predict: {
    prompt: `Four pipeline runs start together, each copying ${SCENARIO.tables} tables with a ForEach at its default batch count `
      + 'of 20 and 2 parallel copies per copy. The source database accepts 40 connections, and pipeline concurrency is not '
      + 'set. What happens?',
    options: [
      { id: 'within', text: 'Every copy succeeds, with room to spare on the source' },
      { id: 'no-headroom', text: 'Every copy succeeds, but the source has almost no room left for its own users' },
      { id: 'over-cap', text: 'Some copies cannot get a connection and fail' },
      { id: 'queued', text: 'Some runs wait in a queue, and everything succeeds' },
    ],
  },
  reason: {
    prompt: 'In the scenario you predicted, what caused the result?',
    options: [
      { id: 'demand-product', text: 'The three settings multiply: four runs, twenty copies each at once, and two connections a copy ask for far more than forty connections' },
      { id: 'batch-count', text: 'A batch count of 20 is above the ForEach’s maximum' },
      { id: 'queued-runs', text: 'Runs waited too long in the pipeline’s queue' },
      { id: 'wave-minutes', text: 'The copies took too long to finish' },
    ],
  },
  apply: {
    prompt: 'The DBA lowers the limit to 30 connections, and all four runs must still start together (no pipeline '
      + 'concurrency limit). Which settings stay within the 70% planning target of that limit?',
    options: [
      { id: 'batch5-pc1', text: 'Batch count 5, 1 parallel copy', levers: { concurrencyLimit: null, batchCount: 5, parallelCopies: 1, poolCap: 30 } },
      { id: 'batch10-pc1', text: 'Batch count 10, 1 parallel copy', levers: { concurrencyLimit: null, batchCount: 10, parallelCopies: 1, poolCap: 30 } },
      { id: 'batch5-pc2', text: 'Batch count 5, 2 parallel copies', levers: { concurrencyLimit: null, batchCount: 5, parallelCopies: 2, poolCap: 30 } },
      { id: 'batch20-pc1', text: 'Batch count 20, 1 parallel copy', levers: { concurrencyLimit: null, batchCount: 20, parallelCopies: 1, poolCap: 30 } },
    ],
    correct: (r) => r.outcome === 'within',
    right: 'The model keeps peak connections within the planning target with those settings.',
    wrong: 'The model does not keep peak connections within the planning target with those settings.',
  },
  explainLabel: 'In your own words: how do the three settings combine into load on the source, and how would you budget them?',
  retrieve: {
    prompt: 'How many iterations can a ForEach run at once, and how many does it run by default?',
    options: [
      { id: '50-20', text: 'Up to 50; 20 by default' },
      { id: '20-10', text: 'Up to 20; 10 by default' },
      { id: 'none-20', text: 'No limit; 20 by default' },
      { id: '32-1', text: 'Up to 32; 1 by default' },
    ],
    answer: '50-20',
    source: { chapter: 'fine-tuning', quote: 'Batch count: 1 to 50 concurrent iterations; sequential if checked; default 20' },
  },
  couplings: CONCURRENCY_COUPLINGS,
  ledgerIntro: 'Each effect the concurrency model applies, and the kind of claim it is: a statement from the ADF guide, a model assumption, or a teaching convention.',
};
