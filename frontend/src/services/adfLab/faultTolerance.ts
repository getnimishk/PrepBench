// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import {
  BAD_ROW_SCENARIO, FAULT_TOLERANCE_COUPLINGS, runBadRows, runDependency, type BadRowLevers, type DependencyLevers,
} from './faultToleranceModel';
import type { ExperimentDefinition, Levers, ModelRun } from './definition';

/**
 * ADF Behaviour Lab, experiment 5: Fault Tolerance (PHASE-5-CONTRACT.md, E5). One experiment
 * with two fault modes, each run through all eight stages as its own track of the experiment
 * (fault-tolerance.dependency, fault-tolerance.bad-rows). Not two experiments, and no sixth:
 * Retry is a lever of the dependency mode; timeout is never simulated.
 */

export const MODEL = 'faultToleranceModel';

const ledger = (ids: string[]) => FAULT_TOLERANCE_COUPLINGS.filter((c) => ids.includes(c.id));

// ---- A. Dependency failure paths ---------------------------------------------------------------

const asDependency = (l: Levers): DependencyLevers => ({
  pattern: l.pattern as DependencyLevers['pattern'],
  failureKind: l.failureKind as DependencyLevers['failureKind'],
  retries: l.retries as DependencyLevers['retries'],
});

export function dependencyRun(_: unknown, l: Levers): ModelRun {
  const r = runDependency(asDependency(l));
  return {
    outcome: r.outcome,
    measures: {
      mainStep: { label: 'The copy step', value: r.mainStep === 'failed' ? 'Failed' : 'Succeeded after a retry' },
      handler: { label: 'The on-failure step', value: r.handlerRan ? 'Ran' : 'Did not run' },
      status: { label: 'What the pipeline run shows', value: r.status },
      alert: { label: 'Alert on failed runs', value: r.failedRunAlert ? 'Fires' : 'Does not fire' },
      result: { label: 'What it adds up to', value: r.outcome },
    },
    findings: r.findings,
  };
}

/** A try-catch with an on-failure email, around a copy that hits a type-conversion error, retried 3 times. */
export const DEPENDENCY_PRESET: DependencyLevers = { pattern: 'try-catch', failureKind: 'type-conversion', retries: 3 };

export const FAULT_TOLERANCE_DEPENDENCY: ExperimentDefinition<null> = {
  track: 'fault-tolerance.dependency',
  idPrefix: 'ftd',
  model: MODEL,
  loadContext: () => Promise.resolve(null),
  understand: 'Every activity has four exits: on success, on failure, on completion (either way) and on skip (an earlier step '
    + 'failed, so this one never ran). Error handling is built from them. But a pipeline’s result comes from its last '
    + 'steps, so how the handler is wired decides whether a failure shows on the run board at all. Activities also time out '
    + '(after 12 hours by default); that is not simulated here.',
  preset: { ...DEPENDENCY_PRESET },
  levers: [
    { key: 'pattern', label: 'Error handling around the copy', options: [
      { value: 'none', label: 'None' }, { value: 'try-catch', label: 'Try-catch' },
      { value: 'do-if-else', label: 'Do-if-else' }, { value: 'do-if-skip-else', label: 'Do-if-skip-else' }] },
    { key: 'failureKind', label: 'What goes wrong', options: [
      { value: 'type-conversion', label: 'A type-conversion error' }, { value: 'transient', label: 'A brief network blip' }] },
    { key: 'retries', label: 'Retries', options: [0, 1, 2, 3].map((v) => ({ value: v, label: String(v) })) },
  ],
  heldNote: 'The levers start at the scenario you predicted. Change one or more, then run the model. No step times out here.',
  run: dependencyRun,
  predict: {
    prompt: 'A copy step is wrapped in a try-catch: an on-failure step after it sends the team an email. The copy hits a '
      + 'type-conversion error (text in a number column) and is retried three times. What does the pipeline run show, and '
      + 'does an alert on failed pipeline runs fire?',
    options: [
      { id: 'visible', text: 'The run shows Failed, and the failed-run alert fires' },
      { id: 'hidden', text: 'The run shows Succeeded, and the failed-run alert does not fire' },
      { id: 'recovered', text: 'A retry succeeds, so nothing failed' },
    ],
  },
  reason: {
    prompt: 'In the scenario you predicted, why does the run show what it shows?',
    options: [
      { id: 'leaves-decide', text: 'The pipeline’s result comes from its last steps, and the on-failure step succeeded' },
      { id: 'retry-transient', text: 'The retries got the copy through' },
      { id: 'success-assumed', text: 'The copy was never run' },
    ],
  },
  apply: {
    prompt: 'Operations now watch only for failed pipeline runs, and the on-failure email must stay. The copy still hits a '
      + 'type-conversion error, with no retries. Which error handling makes the failure show as a failed run while the '
      + 'email is still sent?',
    options: [
      { id: 'try-catch', text: 'Try-catch: only an on-failure step', levers: { pattern: 'try-catch', failureKind: 'type-conversion', retries: 0 } },
      { id: 'do-if-else', text: 'Do-if-else: an on-success and an on-failure step', levers: { pattern: 'do-if-else', failureKind: 'type-conversion', retries: 0 } },
      { id: 'do-if-skip-else', text: 'Do-if-skip-else: add a dummy on-skip step', levers: { pattern: 'do-if-skip-else', failureKind: 'type-conversion', retries: 0 } },
      { id: 'none', text: 'Remove the error handling', levers: { pattern: 'none', failureKind: 'type-conversion', retries: 0 } },
    ],
    correct: (r) => r.measures.status.value === 'Failed' && r.measures.handler.value === 'Ran',
    right: 'In the model the run shows Failed and the on-failure email still runs.',
    wrong: 'In the model that does not give both a failed run and the email.',
  },
  explainLabel: 'In your own words: how can a pipeline report success over a failed step, and how would you make failures visible?',
  retrieve: {
    prompt: 'Which exits does every ADF activity have?',
    options: [
      { id: 'four', text: 'On success, on failure, on completion and on skip' },
      { id: 'timeout', text: 'On success, on failure, on timeout and on retry' },
      { id: 'start-end', text: 'On start, on success, on failure and on end' },
      { id: 'two', text: 'On success and on failure only' },
    ],
    answer: 'four',
    source: { chapter: 'pipelines', quote: 'Every activity has four exits' },
  },
  couplings: ledger(['pattern-table', 'leaves-decide', 'failed-run-alert', 'retry-transient', 'retry-permanent', 'no-retry', 'success-assumed', 'timeout-not-modelled']),
  ledgerIntro: 'Each effect the fault-tolerance model applies in this mode, and the kind of claim it is. The pipeline results are the ADF guide’s own table.',
};

// ---- B. Bad-row handling ------------------------------------------------------------------------

const asBadRows = (l: Levers): BadRowLevers => ({ handling: l.handling as BadRowLevers['handling'], verification: Boolean(l.verification) });

export function badRowRun(_: unknown, l: Levers): ModelRun {
  const r = runBadRows(asBadRows(l));
  return {
    outcome: r.outcome,
    measures: {
      status: { label: 'What the pipeline run shows', value: r.status },
      copied: r.rowsCopied === null
        ? { label: 'Rows copied', value: 'Not modelled' }
        : { label: 'Rows copied', value: r.rowsCopied, unit: 'rows' },
      skipped: { label: 'Rows skipped', value: r.rowsSkipped, unit: 'rows' },
      record: { label: 'What is kept of the skipped rows', value: r.record === 'session-log' ? 'Each row and its reason' : r.record === 'count' ? 'A count only' : 'Nothing skipped' },
      verification: { label: 'Data consistency verification', value: r.verification === 'passes' ? 'Passes' : r.verification === 'not-reached' ? 'Not reached' : 'Off' },
      result: { label: 'What it adds up to', value: r.outcome },
    },
    findings: r.findings,
  };
}

export const BAD_ROWS_PRESET: BadRowLevers = { handling: 'skip', verification: true };

export const FAULT_TOLERANCE_BAD_ROWS: ExperimentDefinition<null> = {
  track: 'fault-tolerance.bad-rows',
  idPrefix: 'ftb',
  model: MODEL,
  loadContext: () => Promise.resolve(null),
  understand: 'By default a copy stops and fails when a row can’t be written to the sink. Fault tolerance can skip '
    + 'incompatible rows instead, but skipping and logging are two separate settings: only the session log keeps the rows '
    + 'themselves, and it keeps their actual values. Data consistency verification, for tables, only checks that the counts '
    + 'add up.',
  preset: { handling: BAD_ROWS_PRESET.handling, verification: BAD_ROWS_PRESET.verification },
  levers: [
    { key: 'handling', label: 'When a row can’t be written', options: [
      { value: 'fail', label: 'Stop and fail (the default)' }, { value: 'skip', label: 'Skip it' },
      { value: 'skip-log', label: 'Skip it, with the session log' }] },
    { key: 'verification', label: 'Data consistency verification', options: [{ value: true, label: 'On' }, { value: false, label: 'Off' }] },
  ],
  heldNote: `The levers start at the scenario you predicted: a ${BAD_ROW_SCENARIO.rows.toLocaleString('en-GB')}-row payments table, `
    + `${BAD_ROW_SCENARIO.incompatible} rows with text in a number column. Change one or more, then run the model.`,
  run: badRowRun,
  predict: {
    prompt: `A copy of a payments table is set to skip incompatible rows. The session log is off, and data consistency `
      + `verification is on. ${BAD_ROW_SCENARIO.incompatible} rows have text in a number column. What does the run report, and `
      + 'what can you reload afterwards?',
    options: [
      { id: 'stops', text: 'The copy stops and the run fails' },
      { id: 'silent', text: 'The run succeeds and verification passes; the skipped rows are only a count' },
      { id: 'logged', text: 'The run succeeds, and the skipped rows are kept with their reasons to reload' },
      { id: 'verify-fails', text: 'Verification notices the skipped rows and fails the run' },
    ],
  },
  reason: {
    prompt: 'In the scenario you predicted, why is there nothing to reload?',
    options: [
      { id: 'skip-without-log', text: 'Skipping and logging are separate settings: without the session log only a count is kept' },
      { id: 'verify-counts', text: 'Verification compared each value with the source and dropped the bad rows' },
      { id: 'fail-default', text: 'The copy stopped at the first bad row' },
    ],
  },
  apply: {
    prompt: 'Auditors now require that every skipped row can be found and reloaded, and one bad row must not stop the load. '
      + 'The table holds card numbers. Which setting?',
    options: [
      { id: 'fail', text: 'Leave the default: stop and fail', levers: { handling: 'fail', verification: true } },
      { id: 'skip', text: 'Skip incompatible rows, with verification on', levers: { handling: 'skip', verification: true } },
      { id: 'skip-log', text: 'Skip incompatible rows and switch on the session log, protected like the source', levers: { handling: 'skip-log', verification: true } },
    ],
    correct: (r) => r.outcome === 'logged',
    right: 'In the model the load completes and every skipped row is kept, with its reason, to reload. Its values sit in the log, so the log needs the source’s protection.',
    wrong: 'In the model that does not both keep the load going and keep the skipped rows.',
  },
  explainLabel: 'In your own words: why did the run look healthy, and what would you change so skipped rows are never lost?',
  retrieve: {
    prompt: 'With fault tolerance and the session log on, what does the log hold for each skipped row?',
    options: [
      { id: 'values', text: 'The row’s actual values and the reason it was skipped' },
      { id: 'count', text: 'Only a count of skipped rows' },
      { id: 'masked', text: 'The row’s key, masked' },
      { id: 'nothing', text: 'Nothing: the log is for activity runs' },
    ],
    answer: 'values',
    source: { chapter: 'sensitive-data', quote: 'Card numbers can end up in a CSV in a storage account, which then needs the same protection and retention rules as the source.' },
  },
  couplings: ledger(['fail-default', 'rows-not-modelled', 'skip-rows', 'skip-without-log', 'session-log', 'sensitive-log', 'verify-counts', 'scenario-rows']),
  ledgerIntro: 'Each effect the fault-tolerance model applies in this mode, and the kind of claim it is.',
};
