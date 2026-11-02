// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { FactoryCoupling } from '../lakehouse/factoryCouplings';
import type { ExperimentDefinition, Finding, LabPicture, Levers, ModelRun } from '../adfLab/definition';

/**
 * Databricks Lab, experiment 2: Auto Loader, schema changes and the checkpoint (DATABRICKS-LAB-CONTRACT.md, E2).
 *
 * Day 1: six JSON files land and Auto Loader loads them into bronze. Day 2: two more land, the second
 * with a field nobody has seen. What day 2 loads depends on the schema evolution mode, on whether the
 * job restarts the stream after a failure, and on whether the checkpoint survived. Pure and deterministic.
 */

export const MODEL = 'databricksLab.autoLoader';

export const SOURCES = ['§7', '§8', '§11', '§23'];

export type Mode = 'addNewColumns' | 'rescue' | 'failOnNewColumns';
export type Restart = 'off' | 'on';
export type Checkpoint = 'kept' | 'deleted';

export interface AutoLoaderLevers {
  mode: Mode;
  restart: Restart;
  checkpoint: Checkpoint;
}

export type AutoLoaderOutcome = 'stopped' | 'new-column' | 'rescued' | 'reloaded';

export const DAY1 = 6;
export const DAY2 = 2;

export interface AutoLoaderResult {
  outcome: AutoLoaderOutcome;
  /** Files loaded on day 2, counting a file loaded again as loaded. */
  loadedDay2: number;
  /** Day-1 files loaded a second time. */
  duplicates: number;
  /** Where the new field's value ended up. */
  newField: 'column' | '_rescued_data' | 'not loaded';
  findings: Finding[];
}

export function runAutoLoader(l: AutoLoaderLevers): AutoLoaderResult {
  const findings: Finding[] = [];
  const add = (ledgerId: string, text: string, tone: Finding['tone']) => findings.push({ ledgerId, text, tone });

  let duplicates = 0;
  if (l.checkpoint === 'deleted') {
    duplicates = DAY1;
    add('checkpoint-memory', `The checkpoint was deleted, so the stream started fresh with no record of the ${DAY1} files it had already loaded.`, 'problem');
    add('fresh-includes-existing', `Starting fresh, its first micro-batch read the folder from the beginning: day 1’s ${DAY1} files were loaded into bronze a second time.`, 'info');
  } else {
    add('checkpoint-memory', `The checkpoint remembers the ${DAY1} files loaded on day 1, so only day 2’s ${DAY2} new files are read.`, 'ok');
  }

  const result = (outcome: AutoLoaderOutcome, loaded: number, newField: AutoLoaderResult['newField']): AutoLoaderResult => ({
    // A deleted checkpoint wins: whatever happens to day 2's files, day 1's were loaded twice.
    outcome: duplicates > 0 ? 'reloaded' : outcome, loadedDay2: loaded + duplicates, duplicates, newField, findings,
  });

  if (l.mode === 'rescue') {
    add('rescue', 'In rescue mode the schema never changes and the stream never fails: the new field’s value goes into the _rescued_data column.', 'info');
    return result('rescued', DAY2, '_rescued_data');
  }
  if (l.mode === 'failOnNewColumns') {
    add('fail-on-new', 'failOnNewColumns stops the stream on the new field and keeps failing until the schema or the file is fixed. Restarting doesn’t help.', 'problem');
    return result('stopped', 0, 'not loaded');
  }
  add('add-new-columns', 'addNewColumns records the new field in the schema location, then fails the stream with an unknown-field error, on purpose.', 'info');
  if (l.restart === 'off') {
    add('no-restart', 'Nothing restarts the stream after that failure, so day 2’s files wait, unloaded, until someone reruns the job.', 'problem');
    return result('stopped', 0, 'not loaded');
  }
  add('restart-picks-up', 'The task’s retry restarts the stream, which resumes with the new schema: day 2’s files load and the field is a new column.', 'ok');
  return result('new-column', DAY2, 'column');
}

function picture(r: AutoLoaderResult): LabPicture {
  const day1 = Array.from({ length: DAY1 }, (_, i) => ({
    label: `d1-${i + 1}`,
    tone: (r.duplicates > 0 ? 'warn' : 'neutral') as 'warn' | 'neutral',
    spoken: `day 1 file ${i + 1}${r.duplicates > 0 ? ', loaded twice' : ', loaded once on day 1'}`,
  }));
  const loaded = r.outcome !== 'stopped';
  const day2 = Array.from({ length: DAY2 }, (_, i) => ({
    label: `d2-${i + 1}`,
    tone: (loaded ? (i === 1 && r.newField === '_rescued_data' ? 'accent' : 'good') : 'bad') as 'accent' | 'good' | 'bad',
    spoken: `day 2 file ${i + 1}${loaded ? ', loaded' : ', not loaded'}${i === 1 ? ', has the new field' : ''}`,
  }));
  return {
    lanes: [{
      label: 'landing folder',
      cells: [...day1, ...day2],
      markers: [{ at: DAY1, label: 'day 2 starts' }],
      note: r.outcome === 'stopped' ? 'The stream stopped on the new field; day 2’s files wait.'
        : r.outcome === 'reloaded' ? 'A fresh checkpoint read every file again.'
          : r.newField === '_rescued_data' ? 'Loaded; the new field’s value is in _rescued_data.' : 'Loaded; the new field is a column.',
    }],
    legend: [
      { tone: 'neutral', label: 'Loaded once, on day 1' },
      ...(r.duplicates > 0 ? [{ tone: 'warn' as const, label: 'Loaded a second time' }] : []),
      ...(loaded ? [{ tone: 'good' as const, label: 'Loaded on day 2' }] : [{ tone: 'bad' as const, label: 'Not loaded' }]),
      ...(r.newField === '_rescued_data' ? [{ tone: 'accent' as const, label: 'Loaded, new field in _rescued_data' }] : []),
    ],
  };
}

const asLevers = (l: Levers): AutoLoaderLevers => ({ mode: l.mode as Mode, restart: l.restart as Restart, checkpoint: l.checkpoint as Checkpoint });

export function modelRun(_: unknown, levers: Levers): ModelRun {
  const r = runAutoLoader(asLevers(levers));
  return {
    outcome: r.outcome,
    measures: {
      loaded: { label: 'Files loaded into bronze on day 2', value: r.loadedDay2 },
      duplicates: { label: 'Day-1 files loaded again', value: r.duplicates },
      field: { label: 'Where the new field went', value: r.newField },
      result: { label: 'What happens', value: r.outcome },
    },
    findings: r.findings,
    picture: picture(r),
  };
}

export const PRESET: AutoLoaderLevers = { mode: 'addNewColumns', restart: 'off', checkpoint: 'kept' };

export const AUTO_LOADER_COUPLINGS: FactoryCoupling[] = [
  {
    id: 'checkpoint-memory', type: 'fact',
    formula: 'the checkpoint records the files already processed',
    uiLabel: 'From the Databricks guide (chapter 15): Auto Loader keeps the files it has discovered in its checkpoint location, which gives exactly-once processing and lets a stopped stream resume where it left off.',
    effect: 'With the checkpoint, only new files are read; without it, the record is gone.',
  },
  {
    id: 'fresh-includes-existing', type: 'convention',
    formula: 'a fresh start reads the files already in the folder, in its first micro-batch',
    uiLabel: 'Teaching convention: this stream is set to include files already in the folder when it starts with a new checkpoint, and reads them in its first micro-batch, before day 2’s. Auto Loader can optionally include existing files (the guide doesn’t state the default), and it never guarantees file order, so the model fixes both.',
    effect: 'A deleted checkpoint makes day 1’s files load again.',
  },
  {
    id: 'add-new-columns', type: 'fact',
    formula: 'addNewColumns: record the column, fail, resume with it on restart',
    uiLabel: 'From the Databricks guide (chapter 15): addNewColumns, the default without a given schema, fails the stream after recording the new column and resumes with it on restart.',
    effect: 'The first run on day 2 fails by design.',
  },
  {
    id: 'no-restart', type: 'fact',
    formula: 'without an automatic restart, the stop lasts until someone acts',
    uiLabel: 'From the Databricks guide (chapter 15): because addNewColumns fails on purpose, Databricks recommends running Auto Loader as a Lakeflow Job that restarts automatically.',
    effect: 'With no retry, day 2’s files aren’t loaded.',
  },
  {
    id: 'restart-picks-up', type: 'fact',
    formula: 'a retry restarts the stream with the new schema',
    uiLabel: 'From the Databricks guide (chapter 18): a task retry policy reruns a failed task; here the rerun is the restart addNewColumns needs.',
    effect: 'Day 2’s files load with the new column.',
  },
  {
    id: 'rescue', type: 'fact',
    formula: 'rescue: never evolve, never fail; unexpected values go to _rescued_data',
    uiLabel: 'From the Databricks guide (chapter 15): in rescue mode the schema never evolves and the stream never fails; new columns’ values go to the rescued data column.',
    effect: 'Day 2 loads, and the new field is in _rescued_data.',
  },
  {
    id: 'fail-on-new', type: 'fact',
    formula: 'failOnNewColumns: fail until the schema or the file is fixed',
    uiLabel: 'From the Databricks guide (chapter 15): failOnNewColumns fails the stream until the schema is updated or the file is fixed.',
    effect: 'Retries fail the same way; nothing loads.',
  },
];

export const AUTO_LOADER: ExperimentDefinition<null> = {
  track: 'auto-loader',
  idPrefix: 'dal',
  model: MODEL,
  loadContext: () => Promise.resolve(null),
  understand: 'Auto Loader is a streaming source that loads new files as they land in cloud storage. It remembers which files '
    + 'it has loaded in its checkpoint, so each file is loaded once. It infers the files’ schema, and a setting called '
    + 'cloudFiles.schemaEvolutionMode decides what happens when a file brings a field the schema doesn’t have.',
  preset: { ...PRESET },
  levers: [
    { key: 'mode', label: 'cloudFiles.schemaEvolutionMode', options: [{ value: 'addNewColumns', label: 'addNewColumns (default)' }, { value: 'rescue', label: 'rescue' }, { value: 'failOnNewColumns', label: 'failOnNewColumns' }] },
    { key: 'restart', label: 'Task retry after a failure', options: [{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }] },
    { key: 'checkpoint', label: 'The checkpoint before day 2', options: [{ value: 'kept', label: 'Kept' }, { value: 'deleted', label: 'Deleted' }] },
  ],
  heldNote: 'Held still: six files on day 1, two on day 2, the second with a new field. The levers start at the scenario you predicted.',
  run: modelRun,
  predict: {
    prompt: 'Auto Loader loaded six JSON files into bronze yesterday, with the schema inferred and every setting at its default. '
      + 'The job has no retry set. Today two files land, one with a field nobody has seen before. What does today’s run load?',
    options: [
      { id: 'new-column', text: 'Both files, with the new field as a new column' },
      { id: 'rescued', text: 'Both files, with the new field’s value in _rescued_data' },
      { id: 'stopped', text: 'Neither: the stream stops on the new field and stays stopped' },
      { id: 'reloaded', text: 'All eight files, because a new field resets the stream' },
    ],
  },
  reason: {
    prompt: 'In the scenario you predicted, why did today’s files load as they did?',
    options: [
      { id: 'no-restart', text: 'addNewColumns fails on purpose and nothing restarted the stream' },
      { id: 'fail-on-new', text: 'The stream will fail until someone fixes the file' },
      { id: 'checkpoint-memory', text: 'The checkpoint had forgotten yesterday’s files' },
      { id: 'json-strings', text: 'JSON columns are inferred as strings, so the new field can’t be read' },
    ],
  },
  apply: {
    prompt: 'Today’s two files must be loaded once, with the new field as a column of its own, without anyone stepping in. Which setup does it?',
    options: [
      { id: 'add-restart', text: 'addNewColumns, task retry on, checkpoint kept', levers: { mode: 'addNewColumns', restart: 'on', checkpoint: 'kept' } },
      { id: 'rescue-restart', text: 'rescue, task retry on, checkpoint kept', levers: { mode: 'rescue', restart: 'on', checkpoint: 'kept' } },
      { id: 'add-fresh', text: 'addNewColumns, task retry on, checkpoint deleted to clear the error', levers: { mode: 'addNewColumns', restart: 'on', checkpoint: 'deleted' } },
      { id: 'fail-restart', text: 'failOnNewColumns, task retry on, checkpoint kept', levers: { mode: 'failOnNewColumns', restart: 'on', checkpoint: 'kept' } },
    ],
    correct: (r) => r.outcome === 'new-column',
    right: 'The model loads today’s files once, with the new field as a column.',
    wrong: 'The model doesn’t load today’s files once with the new field as a column.',
  },
  explainLabel: 'In your own words: why does Auto Loader’s default mode stop on a new column, and what does the checkpoint protect you from?',
  retrieve: {
    prompt: 'Which schema evolution mode does Auto Loader use by default when you don’t give it a schema?',
    options: [
      { id: 'rescue', text: 'rescue' },
      { id: 'none', text: 'none' },
      { id: 'addNewColumns', text: 'addNewColumns' },
      { id: 'failOnNewColumns', text: 'failOnNewColumns' },
    ],
    answer: 'addNewColumns',
    source: { chapter: 'auto-loader', quote: 'addNewColumns (default without a given schema)' },
  },
  couplings: AUTO_LOADER_COUPLINGS,
  ledgerIntro: 'Each rule the model applies, and the kind of claim it is: a statement from the Databricks guide, or a teaching convention.',
};
