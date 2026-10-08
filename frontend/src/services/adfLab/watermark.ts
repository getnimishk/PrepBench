// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import {
  DEFAULT_LEVERS, runPipeline, type AdfConfig, type AdfLevers, type BatchManifest, type FindingId, type Sink,
  type SourceRow, type WatermarkTiming,
} from '../lakehouse/adfModel';
import { classifyManifest, type WatermarkOutcome } from '../lakehouse/pipelineChallenges';
import { STATION_A_COUPLINGS } from '../lakehouse/pipelineCouplings';
import type { FactoryCoupling } from '../lakehouse/factoryCouplings';
import type { LeverChange } from './attempts';
import type { ExperimentDefinition, Levers, ModelRun } from './definition';
import { MODEL_PACK, loadPipelineContext, type PipelineContext } from './semiconductor';

/**
 * ADF Behaviour Lab, experiment 1: Watermark & Transient Failure (PHASE-5-CONTRACT.md, E2).
 *
 * No simulation of its own. Every outcome here is `runPipeline` from the Lakehouse Lab's ADF
 * model (services/lakehouse/adfModel.ts) over the semiconductor-v1 pack's pipeline and real
 * source index, and every effect it shows is a typed entry in STATION_A_COUPLINGS. This module
 * only chooses the scenarios the loop asks about, and reads the model's answers.
 *
 * The scenario's trigger and arrival are held still (a scheduled incremental load, no late or
 * out-of-order file); those levers are the Trigger Behaviour experiment's.
 */

export { MODEL_PACK };

/** What the learner can move here. All four are the model's own levers. */
export type WatermarkLevers = Pick<AdfLevers, 'watermark' | 'sink' | 'retries' | 'failureAtPercent'>;

/** Everything else, held still: a scheduled incremental load with nothing arriving late. */
const HELD: Omit<AdfLevers, keyof WatermarkLevers> = {
  ...DEFAULT_LEVERS, trigger: 'schedule', load: 'incremental', lateFile: false, outOfOrder: false,
};

export const levers = (w: WatermarkLevers): AdfLevers => ({ ...HELD, ...w });
export const run = (config: AdfConfig, index: SourceRow[], w: WatermarkLevers): BatchManifest =>
  runPipeline(config, index, levers(w));

// ---- Predict ------------------------------------------------------------------------------

/** The scenario the prediction is about. */
export const PRESET: WatermarkLevers = { watermark: 'completion', sink: 'append', retries: 0, failureAtPercent: 40 };

export const PREDICT = {
  prompt: 'The pipeline stores its watermark on the copy activity’s completion exit. The copy fails 40% of the way '
    + 'through and nothing retries it; the next scheduled run picks up from the stored watermark. Once it has, what '
    + 'does the destination hold for this batch?',
  options: [
    { id: 'complete', text: 'Every row, once' },
    { id: 'duplicates', text: 'Every row, and some of them twice' },
    { id: 'missing', text: 'Some rows never arrive' },
    { id: 'both', text: 'Some rows are missing and some are repeated' },
  ] as { id: WatermarkOutcome; text: string }[],
};

export const outcomeOf = (m: BatchManifest): WatermarkOutcome => classifyManifest(m);

// ---- Manipulate ---------------------------------------------------------------------------

export const WATERMARK_OPTIONS: { value: WatermarkTiming; label: string }[] = [
  { value: 'before', label: 'Before the copy' },
  { value: 'success', label: 'On the copy’s success' },
  { value: 'completion', label: 'On the copy’s completion' },
];
export const SINK_OPTIONS: { value: Sink; label: string }[] = [
  { value: 'append', label: 'Append' },
  { value: 'upsert', label: 'Upsert on the key' },
];
/** The model takes 0 to 3 retries; ADF itself allows more (see Retrieve). */
export const RETRY_OPTIONS = [0, 1, 2, 3] as const;
/** Where the one injected failure happens, as a percentage of the copy; null for none. */
export const FAILURE_OPTIONS: (number | null)[] = [null, 20, 40, 60, 80];

/** What differs from the scenario, as the server's `manipulation` record. Empty when nothing does. */
export function changesFrom(from: WatermarkLevers, to: WatermarkLevers): LeverChange {
  const out: LeverChange = {};
  (['watermark', 'sink', 'retries', 'failureAtPercent'] as const).forEach((k) => {
    if (from[k] !== to[k]) out[k] = { from: from[k], to: to[k] };
  });
  return out;
}

// ---- Observe ------------------------------------------------------------------------------

/** The scenario's result against the learner's run, in the `observed` shape the platform reads. */
export function observation(preset: BatchManifest, mine: BatchManifest) {
  const outcome = (label: string, before: number, after: number) => ({ label, before, after, unit: 'rows', precision: 0 });
  return {
    missed: outcome('Rows that never arrive', preset.missed.length, mine.missed.length),
    repeated: outcome('Rows stored more than once', preset.duplicateWrites, mine.duplicateWrites),
    result: { label: 'What the destination holds', before: outcomeOf(preset), after: outcomeOf(mine) },
  };
}

// ---- Reason -------------------------------------------------------------------------------

/**
 * The causes on offer are coupling-ledger entries, so the answer is the model's: the one(s) its
 * findings mark as the problem in the scenario. Nothing here decides which is right.
 */
export const REASON = {
  prompt: 'In the scenario you predicted, which mechanism lost or repeated the rows?',
  options: [
    { id: 'watermark-timing', text: 'The watermark was stored on a step that also runs when the copy fails, so the next run started after rows that never landed' },
    { id: 'append-repeats', text: 'The append sink stored rows that were copied twice' },
    { id: 'transient-failure', text: 'The failure removed rows that had already landed' },
    { id: 'late-file', text: 'A file arrived after the run had stored its watermark' },
  ] as { id: FindingId; text: string }[],
};

export const causesOf = (m: BatchManifest): FindingId[] =>
  [...new Set(m.findings.filter((f) => f.tone === 'problem').map((f) => f.ledgerId))];

// ---- Apply (transfer) -----------------------------------------------------------------------

/**
 * A changed constraint, not a repeat: the watermark is now fixed on completion by a shared
 * framework, the copy still fails part-way, and the learner chooses what they CAN change. The
 * grade is the model's: a choice is right when it leaves every row once.
 */
export const APPLY = {
  prompt: 'Another team’s framework fixes the watermark on the completion exit, and you cannot change that. The copy '
    + 'still fails part-way. Which change to your pipeline leaves every row exactly once?',
  options: [
    { id: 'retry-append', text: 'Retry the copy once, keep the append sink', levers: { watermark: 'completion', sink: 'append', retries: 1, failureAtPercent: 40 } },
    { id: 'retry-upsert', text: 'Retry the copy once, and upsert on the key', levers: { watermark: 'completion', sink: 'upsert', retries: 1, failureAtPercent: 40 } },
    { id: 'upsert-only', text: 'No retry, but upsert on the key', levers: { watermark: 'completion', sink: 'upsert', retries: 0, failureAtPercent: 40 } },
    { id: 'later-failure', text: 'No change: the failure will usually happen later in the copy', levers: { watermark: 'completion', sink: 'append', retries: 0, failureAtPercent: 80 } },
  ] as { id: string; text: string; levers: WatermarkLevers }[],
};

export const appliesCleanly = (config: AdfConfig, index: SourceRow[], w: WatermarkLevers) =>
  outcomeOf(run(config, index, w)) === 'complete';

// ---- Retrieve -------------------------------------------------------------------------------

/**
 * Recall of facts the ADF pack states (chapter `pipelines`, "Defaults that surprise people":
 * "Retry defaults to 0."), not of anything the model computed. Graded on the spot; no
 * scheduling of any kind is claimed.
 */
export const RETRIEVE = {
  prompt: 'In Azure Data Factory, how many times is a failed activity retried unless someone sets a retry policy?',
  options: [
    { id: '0', text: 'Not at all: retry defaults to 0' },
    { id: '1', text: 'Once' },
    { id: '3', text: 'Three times' },
    { id: '10', text: 'Ten times' },
  ],
  answer: '0',
  source: { chapter: 'pipelines', quote: 'Retry defaults to 0.' },
};

// ---- What the screen shows of the model ------------------------------------------------------

/** The coupling-ledger entries this experiment's levers touch, shown so no effect is hidden. */
const LEDGER_IDS: FindingId[] = [
  'incremental-scope', 'watermark-timing', 'transient-failure', 'append-repeats', 'recovery-run', 'delete-invisible',
];
export const COUPLINGS: FactoryCoupling[] = STATION_A_COUPLINGS.filter(
  (c) => (LEDGER_IDS as string[]).includes(c.id) || c.type === 'convention',
);

// ---- The experiment, for the shared runner ----------------------------------------------------

const asWatermark = (l: Levers): WatermarkLevers => ({
  watermark: l.watermark as WatermarkLevers['watermark'],
  sink: l.sink as WatermarkLevers['sink'],
  retries: l.retries as WatermarkLevers['retries'],
  failureAtPercent: l.failureAtPercent as number | null,
});

/** One run of the Lakehouse ADF model, in the runner's terms. */
export function modelRun(c: PipelineContext, l: Levers): ModelRun {
  const m = run(c.config, c.index, asWatermark(l));
  const o = observation(m, m);
  return {
    outcome: outcomeOf(m),
    measures: {
      missed: { label: o.missed.label, value: m.missed.length, unit: 'rows' },
      repeated: { label: o.repeated.label, value: m.duplicateWrites, unit: 'rows' },
      result: { label: o.result.label, value: outcomeOf(m) },
    },
    findings: m.findings,
  };
}

export const WATERMARK: ExperimentDefinition<PipelineContext> = {
  track: 'watermark',
  idPrefix: 'wm',
  model: MODEL_PACK,
  loadContext: loadPipelineContext,
  contextNote: (c) => c.note,
  understand: 'An incremental copy remembers how far it got in a watermark: the newest change it has copied. The next run '
    + 'copies only what is newer. When that watermark is stored, relative to a copy that can fail part-way, and whether the '
    + 'sink tolerates a row arriving twice, decide whether a batch lands complete, with gaps, or with repeats.',
  preset: { ...PRESET },
  levers: [
    { key: 'watermark', label: 'Store the watermark', options: WATERMARK_OPTIONS },
    { key: 'sink', label: 'Sink', options: SINK_OPTIONS },
    { key: 'retries', label: 'Retries after the failure', options: RETRY_OPTIONS.map((r) => ({ value: r, label: String(r) })) },
    { key: 'failureAtPercent', label: 'The copy fails at', options: FAILURE_OPTIONS.map((f) => ({ value: f, label: f === null ? 'No failure' : `${f}%` })) },
  ],
  heldNote: 'The levers start at the scenario you predicted. Change one or more, then run the model. Trigger and late '
    + 'files are held still here; they are the Trigger Behaviour experiment’s.',
  run: modelRun,
  predict: PREDICT,
  reason: REASON,
  apply: {
    prompt: APPLY.prompt,
    options: APPLY.options.map((o) => ({ ...o, levers: { ...o.levers } })),
    correct: (r) => r.outcome === 'complete',
    right: 'The model leaves every row exactly once with that change.',
    wrong: 'The model does not leave every row exactly once with that change.',
  },
  explainLabel: 'In your own words: why did rows go missing in the scenario, and when should the watermark move?',
  retrieve: RETRIEVE,
  couplings: COUPLINGS,
  ledgerIntro: 'Each effect the model applies in this experiment, and the kind of claim it is. These are the Lakehouse Lab’s own ADF model and ledger.',
};
