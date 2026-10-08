// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { FactoryCoupling } from '../lakehouse/factoryCouplings';
import type { Finding } from './definition';

/**
 * The ADF Behaviour Lab's fault-tolerance model (PHASE-5-CONTRACT.md, E5): one experiment, two
 * fault modes, both taught in the ADF guide and neither in any production model (the Lakehouse
 * Lab's ADF model has one injected copy failure, but no activity graph and no row validity).
 *
 *   A. Dependency failure paths -- the guide's own table of what a pipeline reports when its
 *      main step fails under each error-handling pattern (chapter `monitoring`, "A green run can
 *      hide a failure"), and its rule that the result comes from the last steps.
 *   B. Bad-row handling -- the copy's documented default (stop and fail), skipping, and the
 *      session log as a separate setting (chapter `bad-rows`), with its sensitive values
 *      (chapter `sensitive-data`).
 *
 * Retry follows the Lakehouse ADF model's semantics: a transient failure is retried and the step
 * then succeeds; with no retry it stays failed. The guide adds that a type-conversion error never
 * succeeds on retry. Timeout is NOT simulated: no production model has it, so it appears only as
 * a stated fact on the ledger.
 *
 * Pure and deterministic, every effect on FAULT_TOLERANCE_COUPLINGS. A teaching model; nothing
 * runs in Azure Data Factory.
 */

// ---- A. Dependency failure paths ---------------------------------------------------------------

export type Pattern = 'none' | 'try-catch' | 'do-if-else' | 'do-if-skip-else';
export type FailureKind = 'transient' | 'type-conversion';

export interface DependencyLevers {
  pattern: Pattern;
  failureKind: FailureKind;
  retries: 0 | 1 | 2 | 3;
}

export type RunStatus = 'Succeeded' | 'Failed';
export type DependencyOutcome = 'visible' | 'hidden' | 'recovered';

export interface DependencyResult {
  mainStep: 'failed' | 'succeeded-after-retry';
  handlerRan: boolean;
  status: RunStatus;
  /** The guide's recommended first alert: failed pipeline runs greater than 0. */
  failedRunAlert: boolean;
  outcome: DependencyOutcome;
  findings: Finding[];
}

/** The guide's table: when the main step fails, the pipeline shows… */
export const WHEN_MAIN_STEP_FAILS: Record<Pattern, RunStatus> = {
  // Not in the table: with no handler the only last step is the failed one, and the guide's rule
  // ("it succeeds only if every one of them succeeded") makes the run Failed.
  none: 'Failed',
  'try-catch': 'Succeeded',
  'do-if-else': 'Failed',
  'do-if-skip-else': 'Succeeded',
};

const PATTERN_TEXT: Record<Pattern, string> = {
  none: 'No error handling',
  'try-catch': 'Try-catch: only an on-failure step after it',
  'do-if-else': 'Do-if-else: an on-success and an on-failure step',
  'do-if-skip-else': 'Do-if-skip-else: plus a dummy on-skip step',
};

export function runDependency(l: DependencyLevers): DependencyResult {
  if (![0, 1, 2, 3].includes(l.retries)) throw new RangeError(`Retries must be 0 to 3 in this model; got ${l.retries}.`);
  const recovers = l.failureKind === 'transient' && l.retries > 0;
  const mainStep = recovers ? 'succeeded-after-retry' : 'failed';
  const handlerRan = !recovers && l.pattern !== 'none';
  const status: RunStatus = recovers ? 'Succeeded' : WHEN_MAIN_STEP_FAILS[l.pattern];
  const outcome: DependencyOutcome = recovers ? 'recovered' : status === 'Failed' ? 'visible' : 'hidden';

  const findings: Finding[] = [];
  const add = (ledgerId: string, text: string, tone: Finding['tone']) => findings.push({ ledgerId, text, tone });
  if (recovers) {
    add('retry-transient', `The transient failure is retried and the step succeeds (${l.retries} retr${l.retries === 1 ? 'y' : 'ies'} set).`, 'ok');
    add('success-assumed', 'The main step succeeded, so no error-handling step runs and the run shows Succeeded.', 'info');
  } else {
    if (l.failureKind === 'type-conversion' && l.retries > 0) {
      add('retry-permanent', `A type-conversion error never succeeds on retry: ${l.retries} retr${l.retries === 1 ? 'y' : 'ies'} only delay the failure.`, 'info');
    } else if (l.retries === 0) {
      add('no-retry', 'Retry defaults to 0, so the failed step is not tried again.', 'info');
    }
    add('pattern-table', `${PATTERN_TEXT[l.pattern]}: when the main step fails, the pipeline shows ${status}.`, 'info');
    if (status === 'Succeeded') {
      add('leaves-decide', 'The pipeline’s result comes from its last steps, and the error handler succeeded: the run shows Succeeded although the main step failed.', 'problem');
    }
  }
  add('failed-run-alert', status === 'Failed'
    ? 'An alert on failed pipeline runs fires.'
    : 'An alert on failed pipeline runs does not fire: there is no failed run to count.', status === 'Failed' || recovers ? 'ok' : 'problem');
  return { mainStep, handlerRan, status, failedRunAlert: status === 'Failed', outcome, findings };
}

// ---- B. Bad-row handling -------------------------------------------------------------------------

export type Handling = 'fail' | 'skip' | 'skip-log';

export interface BadRowLevers {
  handling: Handling;
  verification: boolean;
}

/** Teaching constants for the scenario's table. Not measurements. */
export const BAD_ROW_SCENARIO = { rows: 20_000, incompatible: 37 } as const;

export type BadRowOutcome = 'stops' | 'silent' | 'logged';

export interface BadRowResult {
  status: RunStatus;
  /** Null when the model does not know: the guide says the copy stops, not how far it got. */
  rowsCopied: number | null;
  rowsSkipped: number;
  record: 'none' | 'count' | 'session-log';
  verification: 'off' | 'not-reached' | 'passes';
  outcome: BadRowOutcome;
  findings: Finding[];
}

export function runBadRows(l: BadRowLevers, s: typeof BAD_ROW_SCENARIO = BAD_ROW_SCENARIO): BadRowResult {
  const findings: Finding[] = [];
  const add = (ledgerId: string, text: string, tone: Finding['tone']) => findings.push({ ledgerId, text, tone });

  if (l.handling === 'fail') {
    add('fail-default', `The first of ${s.incompatible} incompatible rows stops the copy, and the run fails.`, 'info');
    if (l.verification) add('verify-counts', 'Verification is not reached: the copy failed first.', 'info');
    add('rows-not-modelled', 'How many rows landed before the stop is not modelled.', 'info');
    return {
      status: 'Failed', rowsCopied: null, rowsSkipped: 0, record: 'none',
      verification: l.verification ? 'not-reached' : 'off', outcome: 'stops', findings,
    };
  }

  const copied = s.rows - s.incompatible;
  add('skip-rows', `${s.incompatible} incompatible rows are skipped; ${copied} rows are copied, and the run succeeds.`, 'info');
  if (l.handling === 'skip') {
    add('skip-without-log', `Without the session log only the count is kept: ${s.incompatible} rows skipped, and nothing to find or reload them by.`, 'problem');
  } else {
    add('session-log', 'The session log keeps each skipped row with the reason, ready to fix and reload.', 'ok');
    add('sensitive-log', 'The session log holds the skipped rows’ actual values: it needs the same protection and retention rules as the source.', 'info');
  }
  if (l.verification) {
    add('verify-counts', `Verification passes: rows read (${s.rows}) equal rows copied plus rows skipped. It checks counts, not values.`, 'info');
  }
  return {
    status: 'Succeeded', rowsCopied: copied, rowsSkipped: s.incompatible,
    record: l.handling === 'skip' ? 'count' : 'session-log',
    verification: l.verification ? 'passes' : 'off',
    outcome: l.handling === 'skip' ? 'silent' : 'logged', findings,
  };
}

// ---- The ledger ------------------------------------------------------------------------------------

export const FAULT_TOLERANCE_COUPLINGS: FactoryCoupling[] = [
  {
    id: 'pattern-table', type: 'fact',
    formula: 'main step fails: try-catch → Succeeded; do-if-else → Failed; do-if-skip-else → Succeeded',
    uiLabel: 'From the ADF guide: when the main step fails, a try-catch (only an on-failure step) shows Succeeded, a do-if-else (an on-success and an on-failure step) shows Failed, and a do-if-skip-else (plus a dummy on-skip step) shows Succeeded.',
    effect: 'The error-handling pattern decides what the run reports, not whether the step failed.',
  },
  {
    id: 'leaves-decide', type: 'fact',
    formula: 'a pipeline succeeds only if every last step succeeded',
    uiLabel: 'From the ADF guide: a pipeline’s result comes from its last steps; it succeeds only if every one of them succeeded. So an error handler can turn a failure green.',
    effect: 'A handler that succeeds as a last step → a green run over a failed step.',
  },
  {
    id: 'failed-run-alert', type: 'fact',
    formula: 'recommended first alert: failed pipeline runs greater than 0',
    uiLabel: 'From the ADF guide: the recommended first alert is failed pipeline runs greater than 0.',
    effect: 'A run that shows Succeeded → that alert never fires.',
  },
  {
    id: 'retry-transient', type: 'assumption',
    formula: 'a transient failure, retried, then succeeds',
    uiLabel: 'Model assumption, as in the Lakehouse Lab’s ADF model: a transient failure (a brief network blip) succeeds when it is retried.',
    effect: 'One retry or more → the step recovers and no handler runs.',
  },
  {
    id: 'retry-permanent', type: 'fact',
    formula: 'a type-conversion error never succeeds on retry',
    uiLabel: 'From the ADF guide: a value that cannot convert (a string into an integer) will never succeed on retry; retries only delay the failure.',
    effect: 'Retries against a type-conversion error → the same failure, later.',
  },
  {
    id: 'no-retry', type: 'fact',
    formula: 'retry defaults to 0',
    uiLabel: 'From the ADF guide: retry defaults to 0, so a failed activity is not tried again unless someone sets a retry policy.',
    effect: 'No retry → a transient blip fails the step.',
  },
  {
    id: 'success-assumed', type: 'assumption',
    formula: 'main step succeeds → the run shows Succeeded under every pattern',
    uiLabel: 'Model assumption: when the main step succeeds, the run shows Succeeded whatever the pattern. The guide’s table covers only the failing case.',
    effect: 'A recovered step → a green run with no handler involved.',
  },
  {
    id: 'timeout-not-modelled', type: 'fact',
    formula: 'activity timeout defaults to 12 hours; not simulated',
    uiLabel: 'From the ADF guide: an activity times out after 12 hours by default. Not modelled here: this experiment never makes a step time out.',
    effect: 'None: timeout is knowledge here, not a lever.',
  },
  {
    id: 'fail-default', type: 'fact',
    formula: 'by default the copy stops and fails at a row it cannot write',
    uiLabel: 'From the ADF guide: by default the copy stops and fails when a row can’t be written to the sink.',
    effect: 'One incompatible row → the whole copy fails.',
  },
  {
    id: 'rows-not-modelled', type: 'convention',
    formula: 'rows landed before a stop: not modelled',
    uiLabel: 'Model convention: how many rows landed before the copy stopped is not modelled; the guide does not say.',
    effect: 'Shown as "not modelled", never as a number.',
  },
  {
    id: 'skip-rows', type: 'fact',
    formula: 'fault tolerance skips incompatible rows; the run reports rows copied and rows skipped',
    uiLabel: 'From the ADF guide: with fault tolerance on, incompatible rows are skipped (a type mismatch, a wrong column count, a primary-key violation on some sinks), and the run reports rows copied and rows skipped.',
    effect: 'Skipping → the copy succeeds with fewer rows.',
  },
  {
    id: 'skip-without-log', type: 'fact',
    formula: 'skipping and logging are two separate settings',
    uiLabel: 'From the ADF guide: skipping and logging are two separate settings. Without the session log you get a count and nothing to reload.',
    effect: 'Skip without the log → a green run and rows you cannot find.',
  },
  {
    id: 'session-log', type: 'fact',
    formula: 'the session log writes skipped rows with the reason, to Blob or ADLS Gen2',
    uiLabel: 'From the ADF guide: with the session log on, skipped rows are written down with the reason, in Blob or ADLS Gen2 storage.',
    effect: 'Skip with the log → every skipped row can be found, fixed and reloaded.',
  },
  {
    id: 'sensitive-log', type: 'fact',
    formula: 'the session log holds the skipped rows’ actual values',
    uiLabel: 'From the ADF guide: skipped rows are written to the session log with their actual values, so card numbers can end up in a CSV in a storage account that needs the source’s protection and retention rules.',
    effect: 'A session log of sensitive data → a second copy of it to protect.',
  },
  {
    id: 'verify-counts', type: 'fact',
    formula: 'for tables, verification checks rows read = rows copied + rows skipped',
    uiLabel: 'From the ADF guide: for tables, data consistency verification only checks the row count (rows read equal rows copied plus rows skipped); nothing compares column values.',
    effect: 'Skipped rows still add up → verification passes.',
  },
  {
    id: 'scenario-rows', type: 'convention',
    formula: '20,000 rows, 37 of them incompatible',
    uiLabel: 'Teaching constants: a 20,000-row table with 37 incompatible rows. Not measurements.',
    effect: 'The counts illustrate; the behaviour is the lesson.',
  },
];
