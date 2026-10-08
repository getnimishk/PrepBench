// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { DEFAULT_LEVERS, runPipeline, type AdfLevers, type FindingId } from '../lakehouse/adfModel';
import { classifyManifest } from '../lakehouse/pipelineChallenges';
import { STATION_A_COUPLINGS } from '../lakehouse/pipelineCouplings';
import type { ExperimentDefinition, Levers, ModelRun } from './definition';
import { MODEL_PACK, loadPipelineContext, type PipelineContext } from './semiconductor';
import { PREDICT as WATERMARK_PREDICT } from './watermark';

/**
 * ADF Behaviour Lab, experiment 2: Trigger Behaviour (PHASE-5-CONTRACT.md, E3).
 *
 * No simulation of its own: `runPipeline` from the Lakehouse Lab's ADF model, with its trigger
 * lever (schedule / tumbling window / storage event) and its two arrival faults (one file late,
 * two files out of order), over the semiconductor-v1 pack's pipeline and source index.
 *
 * One window only. The model has no multi-window history, so nothing here simulates a backfill
 * or a tumbling window's maxConcurrency (contract S3): the experiment never claims either.
 */

export type TriggerLevers = Pick<AdfLevers, 'trigger' | 'lateFile' | 'outOfOrder' | 'sink'>;

/**
 * Everything else, held still: an incremental load whose watermark moves on the copy's success,
 * with no failure -- so what happens is down to the trigger and the arrival alone.
 */
const HELD: Omit<AdfLevers, keyof TriggerLevers> = {
  ...DEFAULT_LEVERS, load: 'incremental', watermark: 'success', retries: 0, failureAtPercent: null,
};

export const levers = (t: TriggerLevers): AdfLevers => ({ ...HELD, ...t });

const asTrigger = (l: Levers): TriggerLevers => ({
  trigger: l.trigger as TriggerLevers['trigger'],
  lateFile: Boolean(l.lateFile),
  outOfOrder: Boolean(l.outOfOrder),
  sink: l.sink as TriggerLevers['sink'],
});

export function modelRun(c: PipelineContext, l: Levers): ModelRun {
  const m = runPipeline(c.config, c.index, levers(asTrigger(l)));
  const outcome = classifyManifest(m);
  return {
    outcome,
    measures: {
      missed: { label: 'Rows that never arrive', value: m.missed.length, unit: 'rows' },
      repeated: { label: 'Rows stored more than once', value: m.duplicateWrites, unit: 'rows' },
      result: { label: 'What the destination holds', value: outcome },
    },
    findings: m.findings,
  };
}

/** The scenario the prediction is about: a tumbling window, a file landing after its run, appended. */
export const PRESET: TriggerLevers = { trigger: 'tumbling', lateFile: true, outOfOrder: false, sink: 'append' };

export const REASON_OPTIONS: { id: FindingId; text: string }[] = [
  { id: 'tumbling-reruns', text: 'The tumbling window re-ran its whole window to take in the late file, and the append sink kept both copies' },
  { id: 'late-file', text: 'The late file’s rows were older than the stored watermark, so the next run skipped them' },
  { id: 'out-of-order', text: 'Two files were loaded in the wrong order' },
  { id: 'event-per-file', text: 'An event trigger ran once per file' },
];

export const APPLY_OPTIONS: { id: string; text: string; levers: TriggerLevers }[] = [
  { id: 'event', text: 'A storage event trigger, one run per file', levers: { trigger: 'event', lateFile: false, outOfOrder: true, sink: 'append' } },
  { id: 'event-upsert', text: 'A storage event trigger, and upsert on the key', levers: { trigger: 'event', lateFile: false, outOfOrder: true, sink: 'upsert' } },
  { id: 'schedule', text: 'A schedule trigger that loads what has arrived', levers: { trigger: 'schedule', lateFile: false, outOfOrder: true, sink: 'append' } },
];

const LEDGER_IDS: FindingId[] = [
  'incremental-scope', 'late-file', 'out-of-order', 'tumbling-reruns', 'event-per-file', 'append-repeats', 'delete-invisible',
];

export const TRIGGERS: ExperimentDefinition<PipelineContext> = {
  track: 'triggers',
  idPrefix: 'tr',
  model: MODEL_PACK,
  loadContext: loadPipelineContext,
  contextNote: (c) => c.note,
  understand: 'A trigger decides when a pipeline runs and over which rows. A schedule runs on the clock and an incremental '
    + 'load takes what is newer than the stored watermark; a tumbling window copies its own window of time; a storage '
    + 'event runs once for each file that lands. The same late or out-of-order file is handled differently by each.',
  preset: { ...PRESET },
  levers: [
    { key: 'trigger', label: 'Trigger', options: [
      { value: 'schedule', label: 'Schedule' }, { value: 'tumbling', label: 'Tumbling window' }, { value: 'event', label: 'Storage event' }] },
    { key: 'lateFile', label: 'One file lands after the run', options: [{ value: true, label: 'Yes' }, { value: false, label: 'No' }] },
    { key: 'outOfOrder', label: 'Two files land in the wrong order', options: [{ value: true, label: 'Yes' }, { value: false, label: 'No' }] },
    { key: 'sink', label: 'Sink', options: [{ value: 'append', label: 'Append' }, { value: 'upsert', label: 'Upsert on the key' }] },
  ],
  heldNote: 'The levers start at the scenario you predicted. Change one or more, then run the model. The watermark moves on the '
    + 'copy’s success and nothing fails here; those are the Watermark experiment’s. One window is modelled, so there '
    + 'is no backfill of earlier windows.',
  run: modelRun,
  predict: {
    prompt: 'A tumbling window trigger loads each window. One of the window’s ten files lands after the run, and the sink '
      + 'appends. Once the window has been handled, what does the destination hold for it?',
    options: WATERMARK_PREDICT.options,
  },
  reason: { prompt: 'In the scenario you predicted, which mechanism changed what landed?', options: REASON_OPTIONS },
  apply: {
    prompt: 'A different feed: no file is late now, but two files sometimes land in the wrong order, and the sink must stay '
      + 'append. Which trigger set-up leaves every row exactly once?',
    options: APPLY_OPTIONS.map((o) => ({ ...o, levers: { ...o.levers } })),
    correct: (r) => r.outcome === 'complete',
    right: 'The model leaves every row exactly once with that set-up.',
    wrong: 'The model does not leave every row exactly once with that set-up.',
  },
  explainLabel: 'In your own words: why did the tumbling window repeat rows, and when is each trigger the right one?',
  retrieve: {
    prompt: 'How many pipelines can one tumbling window trigger start?',
    options: [
      { id: 'one', text: 'Only one; a schedule trigger can start several' },
      { id: 'several', text: 'Several, like a schedule trigger' },
      { id: 'per-file', text: 'One for each file that lands' },
      { id: 'ten', text: 'Up to ten' },
    ],
    answer: 'one',
    source: { chapter: 'triggers', quote: 'A tumbling window trigger starts only one pipeline; a schedule trigger can start several.' },
  },
  couplings: STATION_A_COUPLINGS.filter((c) => (LEDGER_IDS as string[]).includes(c.id) || c.type === 'convention'),
  ledgerIntro: 'Each effect the model applies in this experiment, and the kind of claim it is. These are the Lakehouse Lab’s own ADF model and ledger.',
};
