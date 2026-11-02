// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { FactoryCoupling } from '../lakehouse/factoryCouplings';
import type { ExperimentDefinition, Finding, LabPicture, Levers, ModelRun } from '../adfLab/definition';

/**
 * Databricks Lab, experiment 4: Retries, repair and duplicates (DATABRICKS-LAB-CONTRACT.md, E4).
 *
 * A nightly job: ingest, then transform, then publish, with a cleanup task set to Run if "All done".
 * Transform writes 10,000 rows to silver and, on its first attempt, fails transiently after writing
 * half of them. Retries, the way transform writes, and whether someone repairs the run decide whether
 * silver ends complete, short or duplicated. Pure and deterministic.
 */

export const MODEL = 'databricksLab.jobs';

export const SOURCES = ['§4', '§11', '§19', '§23'];

export type Retries = 0 | 1;
export type Write = 'append' | 'merge';
export type Repair = 'no' | 'yes';

export interface JobsLevers {
  retries: Retries;
  write: Write;
  repair: Repair;
}

export type JobsOutcome = 'duplicated' | 'exact' | 'incomplete';

export const ROWS = 10000;
export const WRITTEN_BEFORE_FAILURE = 5000;

export interface JobsResult {
  outcome: JobsOutcome;
  silverRows: number;
  duplicates: number;
  manual: boolean;
  publish: 'Succeeded' | 'Upstream failed';
  findings: Finding[];
}

export function runJobs(l: JobsLevers): JobsResult {
  const findings: Finding[] = [];
  const add = (ledgerId: string, text: string, tone: Finding['tone']) => findings.push({ ledgerId, text, tone });

  add('half-written', `Transform’s first attempt wrote ${WRITTEN_BEFORE_FAILURE.toLocaleString('en-GB')} of its ${ROWS.toLocaleString('en-GB')} rows to silver, then failed on a transient error.`, 'info');
  add('cleanup-all-done', 'Cleanup runs whatever happened upstream, because its Run if condition is All done.', 'info');

  let reran = false;
  let manual = false;
  if (l.retries === 1) {
    add('retry-reruns', 'Transform has a retry policy, so it ran again straight away and succeeded. Nobody had to act, and publish ran.', 'info');
    if (l.repair === 'yes') add('nothing-to-repair', 'The run succeeded after the retry, so there was nothing to repair.', 'info');
    reran = true;
  } else {
    add('upstream-failed', 'Transform has no retries, so the run failed: publish was marked Upstream failed and didn’t run.', 'info');
    if (l.repair === 'yes') {
      add('repair-reruns', 'Someone fixed nothing (the error was transient) and repaired the run: only transform and publish ran again.', 'info');
      reran = true;
      manual = true;
    }
  }

  if (!reran) {
    add('left-short', `Silver holds ${WRITTEN_BEFORE_FAILURE.toLocaleString('en-GB')} of ${ROWS.toLocaleString('en-GB')} rows and publish never ran, until someone acts.`, 'problem');
    return { outcome: 'incomplete', silverRows: WRITTEN_BEFORE_FAILURE, duplicates: 0, manual, publish: 'Upstream failed', findings };
  }
  add('restarts-from-start', 'A task that runs again starts from the beginning: Lakeflow Jobs doesn’t make it idempotent or remember what it wrote.', 'info');
  if (l.write === 'append') {
    add('append-duplicates', `Transform appends, so the second run added all ${ROWS.toLocaleString('en-GB')} rows on top of the ${WRITTEN_BEFORE_FAILURE.toLocaleString('en-GB')} the failed attempt left: ${WRITTEN_BEFORE_FAILURE.toLocaleString('en-GB')} rows are in silver twice.`, 'problem');
    return { outcome: 'duplicated', silverRows: ROWS + WRITTEN_BEFORE_FAILURE, duplicates: WRITTEN_BEFORE_FAILURE, manual, publish: 'Succeeded', findings };
  }
  add('merge-idempotent', 'Transform MERGEs on the order key, so the rows the failed attempt wrote were matched and updated, not added again.', 'ok');
  return { outcome: 'exact', silverRows: ROWS, duplicates: 0, manual, publish: 'Succeeded', findings };
}

function picture(r: JobsResult): LabPicture {
  const blocks = 10;
  const per = ROWS / blocks;
  const filled = Math.round(Math.min(r.silverRows, ROWS) / per);
  const dupBlocks = Math.round(r.duplicates / per);
  return {
    lanes: [
      {
        label: 'tasks',
        cells: [
          { label: 'ingest', tone: 'good', spoken: 'ingest: succeeded' },
          { label: 'transform', tone: r.outcome === 'incomplete' ? 'bad' : 'good', spoken: `transform: ${r.outcome === 'incomplete' ? 'failed' : 'succeeded'}` },
          { label: 'publish', tone: r.publish === 'Succeeded' ? 'good' : 'muted', spoken: `publish: ${r.publish}` },
          { label: 'cleanup', tone: 'good', spoken: 'cleanup: ran (All done)' },
        ],
      },
      {
        label: 'silver, in blocks of 1,000 rows',
        cells: [
          ...Array.from({ length: blocks }, (_, i) => (i < filled
            ? { label: `${i + 1}`, tone: 'good' as const, spoken: `rows ${i * per + 1} to ${(i + 1) * per}` }
            : { label: `${i + 1}`, tone: 'muted' as const, spoken: `rows ${i * per + 1} to ${(i + 1) * per}: missing` })),
          ...Array.from({ length: dupBlocks }, (_, i) => ({ label: `${i + 1}′`, tone: 'warn' as const, spoken: `duplicate of rows ${i * per + 1} to ${(i + 1) * per}` })),
        ],
        note: r.outcome === 'duplicated' ? 'Half the rows are in silver twice.' : r.outcome === 'incomplete' ? 'Half the rows are missing.' : 'Every row once.',
      },
    ],
    legend: [
      { tone: 'good', label: 'Done / present once' },
      ...(r.outcome === 'incomplete' ? [{ tone: 'bad' as const, label: 'Failed' }, { tone: 'muted' as const, label: 'Didn’t run / missing' }] : []),
      ...(r.duplicates > 0 ? [{ tone: 'warn' as const, label: 'Duplicate rows' }] : []),
    ],
  };
}

const asLevers = (l: Levers): JobsLevers => ({ retries: Number(l.retries) as Retries, write: l.write as Write, repair: l.repair as Repair });

export function modelRun(_: unknown, levers: Levers): ModelRun {
  const r = runJobs(asLevers(levers));
  return {
    outcome: r.outcome,
    measures: {
      rows: { label: 'Rows in silver', value: r.silverRows, unit: `for ${ROWS.toLocaleString('en-GB')} orders` },
      duplicates: { label: 'Duplicate rows', value: r.duplicates },
      publish: { label: 'Publish', value: r.publish },
      manual: { label: 'A person had to step in', value: r.manual ? 'yes' : 'no' },
      result: { label: 'What happens', value: r.outcome },
    },
    findings: r.findings,
    picture: picture(r),
  };
}

export const PRESET: JobsLevers = { retries: 0, write: 'append', repair: 'yes' };

export const JOBS_COUPLINGS: FactoryCoupling[] = [
  {
    id: 'cleanup-all-done', type: 'fact',
    formula: 'Run if All done: runs whatever the upstream result',
    uiLabel: 'From the Databricks guide (chapter 18): a task whose Run if condition is All done runs when every upstream task has finished, whatever the result.',
    effect: 'Cleanup runs even when transform fails.',
  },
  {
    id: 'upstream-failed', type: 'fact',
    formula: 'All succeeded not met → Upstream failed',
    uiLabel: 'From the Databricks guide (chapter 18): with the default Run if condition, All succeeded, a task whose upstream failed is marked Upstream failed.',
    effect: 'Publish doesn’t run after transform fails.',
  },
  {
    id: 'retry-reruns', type: 'fact',
    formula: 'a retry policy reruns a failed task',
    uiLabel: 'From the Databricks guide (chapter 18): each task can have a retry policy (count and interval); the guide says to set it explicitly rather than rely on a default.',
    effect: 'A transient failure is retried without anyone acting.',
  },
  {
    id: 'repair-reruns', type: 'fact',
    formula: 'repair re-runs only unsuccessful tasks and their dependents',
    uiLabel: 'From the Databricks guide (chapter 18): repair re-runs only the unsuccessful tasks and their dependents, with the current settings.',
    effect: 'Transform and publish run again; ingest doesn’t.',
  },
  {
    id: 'restarts-from-start', type: 'fact',
    formula: 'a task run again starts from the beginning; jobs don’t make tasks idempotent',
    uiLabel: 'From the Databricks guide (chapter 18): Lakeflow Jobs doesn’t make tasks idempotent; a repaired task restarts from the beginning.',
    effect: 'Whatever the failed attempt wrote is still there when the task runs again.',
  },
  {
    id: 'append-duplicates', type: 'fact',
    formula: 'an appending task run again duplicates what it already wrote',
    uiLabel: 'From the Databricks guide (chapter 18): if a task appended half its output before failing, running it again appends it all again, and you have duplicate rows.',
    effect: 'Silver holds the first half twice.',
  },
  {
    id: 'merge-idempotent', type: 'fact',
    formula: 'a key-based MERGE makes a rerun harmless',
    uiLabel: 'From the Databricks guide (chapter 18): write tasks so a rerun is harmless, for example with an insert-only or key-based MERGE.',
    effect: 'Rows already written are matched, not added again.',
  },
  {
    id: 'half-written', type: 'convention',
    formula: 'the first attempt fails after writing half the rows; the second succeeds',
    uiLabel: 'Teaching convention: transform fails once, transiently, after writing exactly half its rows, and any second attempt succeeds. A retry here runs the task from its start, as a repair does.',
    effect: 'The only question is what the second run does with the first run’s rows.',
  },
  {
    id: 'left-short', type: 'convention',
    formula: 'a failed run with no retry and no repair stays failed',
    uiLabel: 'Teaching convention: nobody reruns the job in this model, so a failed run stays as it ended.',
    effect: 'Silver stays half-loaded.',
  },
  {
    id: 'nothing-to-repair', type: 'fact',
    formula: 'repair applies to failed or cancelled runs',
    uiLabel: 'From the Databricks guide (chapter 18): repair is for a multi-task run that failed or was cancelled.',
    effect: 'A run that succeeded after a retry has nothing to repair.',
  },
];

export const JOBS: ExperimentDefinition<null> = {
  track: 'jobs',
  idPrefix: 'djb',
  model: MODEL,
  loadContext: () => Promise.resolve(null),
  understand: 'A Lakeflow job runs tasks in order, as a graph: a task starts when its upstream tasks finish and its Run if '
    + 'condition is met. A task can retry when it fails, and a failed run can be repaired: only the failed tasks and the '
    + 'tasks after them run again. Neither one knows what the failed attempt already wrote. That is up to how the task writes.',
  preset: { ...PRESET },
  levers: [
    { key: 'retries', label: 'Transform’s retry policy', options: [{ value: 0, label: 'No retries' }, { value: 1, label: '1 retry' }] },
    { key: 'write', label: 'How transform writes to silver', options: [{ value: 'append', label: 'Append' }, { value: 'merge', label: 'MERGE on the order key' }] },
    { key: 'repair', label: 'If the run fails, someone repairs it', options: [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }] },
  ],
  heldNote: `Held still: transform fails once, transiently, after writing ${WRITTEN_BEFORE_FAILURE.toLocaleString('en-GB')} of ${ROWS.toLocaleString('en-GB')} rows; cleanup runs on All done.`,
  run: modelRun,
  predict: {
    prompt: `A nightly job runs ingest, then transform, then publish. Transform appends ${ROWS.toLocaleString('en-GB')} rows to silver and has no retries. `
      + `Tonight it fails on a transient error after writing half of them. In the morning an engineer clicks Repair run without changing anything. What is in silver afterwards?`,
    options: [
      { id: 'exact', text: `Exactly ${ROWS.toLocaleString('en-GB')} rows: repair carries on from where the task failed` },
      { id: 'duplicated', text: `${(ROWS + WRITTEN_BEFORE_FAILURE).toLocaleString('en-GB')} rows: the first half is in silver twice` },
      { id: 'incomplete', text: `${WRITTEN_BEFORE_FAILURE.toLocaleString('en-GB')} rows: repair can’t rerun a task that has already written data` },
      { id: 'rolled-back', text: `${ROWS.toLocaleString('en-GB')} rows: repair first rolls back the failed attempt’s writes` },
    ],
  },
  reason: {
    prompt: 'In the scenario you predicted, why did silver end up as it did?',
    options: [
      { id: 'append-duplicates', text: 'The repaired task started from the beginning and appended everything again on top of what the failed attempt wrote' },
      { id: 'repair-everything', text: 'Repair re-ran every task in the job, including ingest' },
      { id: 'left-short', text: 'The failed attempt’s rows were lost' },
      { id: 'publish-twice', text: 'Publish wrote its output to silver as well' },
    ],
  },
  apply: {
    prompt: 'Silver must end complete, with every row once, without anyone having to step in. Which setup does it?',
    options: [
      { id: 'retry-merge', text: '1 retry, MERGE on the order key', levers: { retries: 1, write: 'merge', repair: 'no' } },
      { id: 'retry-append', text: '1 retry, append', levers: { retries: 1, write: 'append', repair: 'no' } },
      { id: 'repair-merge', text: 'No retries, MERGE on the order key, and repair the run in the morning', levers: { retries: 0, write: 'merge', repair: 'yes' } },
      { id: 'merge-only', text: 'No retries, MERGE on the order key', levers: { retries: 0, write: 'merge', repair: 'no' } },
    ],
    correct: (r) => r.outcome === 'exact' && r.measures.manual?.value === 'no',
    right: 'The model ends with every row once, and nobody had to act.',
    wrong: 'The model doesn’t end with every row once without someone stepping in.',
  },
  explainLabel: 'In your own words: why can a retry or a repair duplicate data, and how do you write a task so that rerunning it is harmless?',
  retrieve: {
    prompt: 'When you repair a failed multi-task run, which tasks run again?',
    options: [
      { id: 'all', text: 'Every task in the job' },
      { id: 'failed-dependents', text: 'Only the unsuccessful tasks and their dependents' },
      { id: 'first', text: 'Only the first task' },
      { id: 'cluster', text: 'Only tasks that ran on the same cluster' },
    ],
    answer: 'failed-dependents',
    source: { chapter: 'jobs', quote: 'repair re-runs only the unsuccessful tasks and their dependents' },
  },
  couplings: JOBS_COUPLINGS,
  ledgerIntro: 'Each rule the model applies, and the kind of claim it is: a statement from the Databricks guide, or a teaching convention.',
};
