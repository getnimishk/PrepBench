// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { FactoryCoupling } from '../lakehouse/factoryCouplings';
import type { Finding } from './definition';

/**
 * The ADF Behaviour Lab's concurrency model (PHASE-5-CONTRACT.md, E1): how pipeline runs, a
 * ForEach's batch count and a copy's parallel copies multiply into connections against a source
 * with a limit.
 *
 * Why a new model: the Lakehouse Lab's ADF model (services/lakehouse/adfModel.ts) runs one batch
 * of one pipeline and has no notion of concurrent runs, loop width or connections, so it cannot
 * express this. Same pattern as it: pure functions, no clock, no randomness, and every effect a
 * typed entry in CONCURRENCY_COUPLINGS, shown on screen.
 *
 * It is a teaching model of a planning calculation, not a measurement of Azure Data Factory.
 * In particular, the connection count is the planning UPPER BOUND the ADF guide teaches; ADF
 * decides each copy's actual parallelism, and connectors differ.
 */

/** From the ADF guide (fine-tuning, "Scale and concurrency architecture"). */
export const BATCH_COUNT = { min: 1, max: 50, default: 20 } as const;
export const PARALLEL_COPIES = { min: 1, max: 32 } as const;

export interface ConcurrencyScenario {
  runs: number;
  tables: number;
  headroomPercent: number;
  waveMinutes: number;
}

/** The scenario's teaching constants. Not measurements; each is on the ledger. */
export const SCENARIO: ConcurrencyScenario = {
  /** Pipeline runs triggered together, one per source system. */
  runs: 4,
  /** Tables each run's ForEach copies. */
  tables: 100,
  /** The share of the source's limit the plan may use, leaving the rest for its own users. */
  headroomPercent: 70,
  /** How long one wave of copies takes. */
  waveMinutes: 6,
};

export interface ConcurrencyLevers {
  /** The pipeline's concurrency setting; null when not set (no maximum by default). */
  concurrencyLimit: number | null;
  batchCount: number;
  parallelCopies: number;
  /** The most connections the source accepts. */
  poolCap: number;
}

export type ConcurrencyStatus = 'within' | 'no-headroom' | 'over-cap';

export interface ConcurrencyResult {
  status: ConcurrencyStatus;
  activeRuns: number;
  queuedRuns: number;
  copiesAtOnce: number;
  /** Connections at peak: the planning upper bound. */
  peakConnections: number;
  headroomLimit: number;
  totalCopies: number;
  failedCopies: number;
  minutes: number;
  findings: Finding[];
}

const whole = (x: number, min: number, max: number, what: string) => {
  if (!Number.isInteger(x) || x < min || x > max) throw new RangeError(`${what} must be a whole number from ${min} to ${max}; got ${x}.`);
};

export function runConcurrency(l: ConcurrencyLevers, s: ConcurrencyScenario = SCENARIO): ConcurrencyResult {
  whole(l.batchCount, BATCH_COUNT.min, BATCH_COUNT.max, 'ForEach batch count');
  whole(l.parallelCopies, PARALLEL_COPIES.min, PARALLEL_COPIES.max, 'Parallel copies');
  whole(l.poolCap, 1, 100_000, 'The source’s connection limit');
  if (l.concurrencyLimit !== null) whole(l.concurrencyLimit, 1, 1_000, 'Pipeline concurrency');

  const activeRuns = l.concurrencyLimit === null ? s.runs : Math.min(s.runs, l.concurrencyLimit);
  const queuedRuns = s.runs - activeRuns;
  const perRun = Math.min(l.batchCount, s.tables);
  const copiesAtOnce = activeRuns * perRun;
  const peakConnections = copiesAtOnce * l.parallelCopies;
  const headroomLimit = Math.floor((l.poolCap * s.headroomPercent) / 100);
  const status: ConcurrencyStatus = peakConnections <= headroomLimit ? 'within' : peakConnections <= l.poolCap ? 'no-headroom' : 'over-cap';

  // Over the limit, the copies that cannot get their connections fail; the same share in every wave.
  const fit = Math.floor(l.poolCap / l.parallelCopies);
  const failingShare = status === 'over-cap' ? Math.max(0, copiesAtOnce - fit) / copiesAtOnce : 0;
  const totalCopies = s.runs * s.tables;
  const failedCopies = Math.round(totalCopies * failingShare);
  const minutes = Math.ceil(s.runs / activeRuns) * Math.ceil(s.tables / perRun) * s.waveMinutes;

  const findings: Finding[] = [];
  const add = (ledgerId: string, text: string, tone: Finding['tone']) => findings.push({ ledgerId, text, tone });
  add('demand-product',
    `${activeRuns} run${activeRuns === 1 ? '' : 's'} × ${perRun} copies at once × ${l.parallelCopies} parallel cop${l.parallelCopies === 1 ? 'y' : 'ies'} `
    + `= ${peakConnections} connections at peak, against a limit of ${l.poolCap}.`,
    status === 'within' ? 'ok' : 'problem');
  if (status === 'no-headroom') {
    add('headroom', `That fits under ${l.poolCap}, but above the ${s.headroomPercent}% planning target of ${headroomLimit}: the source has little room left for its own users.`, 'problem');
  }
  if (status === 'over-cap') {
    add('source-refuses', `Only ${fit} copies can hold their connections at once; the rest cannot connect and fail with connection timeouts: ${failedCopies} of ${totalCopies} copies.`, 'problem');
    add('no-retry', 'Retry defaults to 0, so a copy that failed stays failed.', 'info');
  }
  if (queuedRuns > 0) {
    add('queued-runs', `Pipeline concurrency is ${l.concurrencyLimit}: ${queuedRuns} run${queuedRuns === 1 ? '' : 's'} wait in the Queued state until earlier ones finish.`, 'info');
  }
  add('wave-minutes', `${Math.ceil(s.tables / perRun)} waves of copies per run; about ${minutes} minutes in all.`, 'info');

  return { status, activeRuns, queuedRuns, copiesAtOnce, peakConnections, headroomLimit, totalCopies, failedCopies, minutes, findings };
}

export const CONCURRENCY_COUPLINGS: FactoryCoupling[] = [
  {
    id: 'demand-product', type: 'assumption',
    formula: 'peak connections ≈ concurrent runs × copies at once per run × parallel copies',
    uiLabel: 'Model assumption: peak connections are the product of concurrent runs, the ForEach batch count and parallel copies. It is the upper bound used for planning, not an exact count: ADF decides each copy’s actual parallelism, and connectors behave differently.',
    effect: 'More runs, a wider loop or more parallel copies → more connections asked of the source at once.',
  },
  {
    id: 'source-refuses', type: 'assumption',
    formula: 'beyond its limit the source refuses a connection, and a copy that cannot connect fails',
    uiLabel: 'Scenario assumption: this source refuses connections beyond its limit. The ADF guide’s example: a batch count of 50 against a 30-connection pool triggers connection timeouts.',
    effect: 'Demand over the limit → the copies that cannot connect fail.',
  },
  {
    id: 'headroom', type: 'assumption',
    formula: 'plan to use at most 70% of the source’s limit',
    uiLabel: 'Planning assumption: keep peak connections at or under 70% of the source’s limit, so its own users can still connect. A planning target, not an ADF setting.',
    effect: 'Peak between 70% and 100% of the limit → every copy succeeds, but the source is left with little room.',
  },
  {
    id: 'queued-runs', type: 'fact',
    formula: 'no maximum pipeline concurrency by default; with a limit set, further runs are Queued',
    uiLabel: 'From the ADF guide: a pipeline has no maximum concurrency by default. When a limit is set, further triggered runs wait in a Queued state until earlier runs finish.',
    effect: 'A concurrency limit → fewer runs at once → fewer connections, and a longer total time.',
  },
  {
    id: 'batch-count', type: 'fact',
    formula: 'ForEach batch count 1 to 50, default 20',
    uiLabel: 'From the ADF guide: a ForEach runs 1 to 50 iterations at once (its batch count), 20 by default.',
    effect: 'The batch count sets how many copies one run starts at once.',
  },
  {
    id: 'parallel-copies', type: 'fact',
    formula: 'parallel copies 1 to 32 threads per copy activity',
    uiLabel: 'From the ADF guide: parallel copies are the threads within one copy activity, 1 to 32.',
    effect: 'Each copy holds as many connections as it has parallel copies.',
  },
  {
    id: 'no-retry', type: 'fact',
    formula: 'retry defaults to 0',
    uiLabel: 'From the ADF guide: retry defaults to 0, so a failed copy is not tried again unless someone sets a retry policy.',
    effect: 'A copy that could not connect stays failed.',
  },
  {
    id: 'wave-minutes', type: 'convention',
    formula: 'each wave of copies takes 6 minutes; 4 runs of 100 tables each',
    uiLabel: 'Teaching constants: four runs of 100 tables each, and six minutes per wave of copies. Not measurements.',
    effect: 'Fewer copies at once → more waves → a longer run.',
  },
];
