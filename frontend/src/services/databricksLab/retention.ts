// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { FactoryCoupling } from '../lakehouse/factoryCouplings';
import type { ExperimentDefinition, Finding, LabPicture, Levers, ModelRun } from '../adfLab/definition';

/**
 * Databricks Lab, experiment 1: Versions, retention and VACUUM (DATABRICKS-LAB-CONTRACT.md, E1).
 *
 * A table is written once a day by a MERGE and VACUUM runs every day. Someone asks for the table as
 * it was some days ago. Whether they get it depends on two retentions: the log's (is the version still
 * in history?) and the deleted files' (are its data files still there?). Pure: no clock, no randomness;
 * every effect is an entry in RETENTION_COUPLINGS.
 */

export const MODEL = 'databricksLab.retention';

/** The research-notes sections this model's facts come from (checked by lab.test.ts). */
export const SOURCES = ['§2'];

export type Age = 3 | 10 | 25 | 40;
export type FileRetention = 7 | 30;
export type LogRetention = 30 | 60;

export interface RetentionLevers {
  age: Age;
  fileRetention: FileRetention;
  logRetention: LogRetention;
}

export type RetentionOutcome = 'readable' | 'files-gone' | 'history-gone';

export interface RetentionResult {
  outcome: RetentionOutcome;
  inHistory: boolean;
  filesPresent: boolean;
  findings: Finding[];
}

export function runRetention(l: RetentionLevers): RetentionResult {
  const findings: Finding[] = [];
  const add = (ledgerId: string, text: string, tone: Finding['tone']) => findings.push({ ledgerId, text, tone });

  add('version-needs-both', `Reading the version from ${l.age} days ago needs two things: its entry in the transaction log and the data files that entry points to.`, 'info');
  add('daily-rewrite', 'In this model each day’s MERGE rewrites the table’s files, so a version’s files stop being referenced the day after it was written.', 'info');

  if (l.age > l.logRetention) {
    add('log-cleaned', `The log keeps history for ${l.logRetention} days (delta.logRetentionDuration). A ${l.age}-day-old entry has been cleaned up, so DESCRIBE HISTORY no longer lists the version at all.`, 'problem');
    return { outcome: 'history-gone', inHistory: false, filesPresent: false, findings };
  }
  if (l.age > l.fileRetention) {
    add('files-vacuumed', `History still lists the version, but its files have been unreferenced for longer than ${l.fileRetention} days (delta.deletedFileRetentionDuration), so the daily VACUUM deleted them.`, 'problem');
    add('blocked-read', 'Recent runtimes block time travel to a version older than the deleted-file retention, so the query fails instead of returning part of the table.', 'info');
    return { outcome: 'files-gone', inHistory: true, filesPresent: false, findings };
  }
  add('readable', `The version is within both retentions: its log entry and its files are still there, so VERSION AS OF or TIMESTAMP AS OF returns it.`, 'ok');
  return { outcome: 'readable', inHistory: true, filesPresent: true, findings };
}

const AGES: Age[] = [40, 25, 10, 3];

function picture(l: RetentionLevers): LabPicture {
  const cells = AGES.map((age) => {
    const r = runRetention({ ...l, age });
    const tone = r.outcome === 'readable' ? 'good' as const : r.outcome === 'files-gone' ? 'warn' as const : 'muted' as const;
    const state = r.outcome === 'readable' ? 'readable' : r.outcome === 'files-gone' ? 'in history, files vacuumed' : 'gone from history';
    return { label: `${age}d`, tone, spoken: `version from ${age} days ago: ${state}` };
  });
  cells.push({ label: 'now', tone: 'good', spoken: 'the current version' });
  return {
    lanes: [
      {
        label: 'versions, by age',
        cells,
        markers: [{ at: AGES.indexOf(l.age), label: 'the version asked for' }],
        note: `Files kept ${l.fileRetention} days after they stop being referenced; history kept ${l.logRetention} days.`,
      },
    ],
    legend: [
      { tone: 'good', label: 'Readable: log entry and files' },
      { tone: 'warn', label: 'Listed in history, files vacuumed' },
      { tone: 'muted', label: 'Gone from history' },
    ],
  };
}

const asLevers = (l: Levers): RetentionLevers => ({
  age: Number(l.age) as Age, fileRetention: Number(l.fileRetention) as FileRetention, logRetention: Number(l.logRetention) as LogRetention,
});

export function modelRun(_: unknown, levers: Levers): ModelRun {
  const l = asLevers(levers);
  const r = runRetention(l);
  return {
    outcome: r.outcome,
    measures: {
      history: { label: 'Listed in DESCRIBE HISTORY', value: r.inHistory ? 'yes' : 'no' },
      files: { label: 'Its data files still there', value: r.filesPresent ? 'yes' : 'no' },
      result: { label: 'What happens', value: r.outcome },
    },
    findings: r.findings,
    picture: picture(l),
  };
}

export const PRESET: RetentionLevers = { age: 10, fileRetention: 7, logRetention: 30 };

export const RETENTION_COUPLINGS: FactoryCoupling[] = [
  {
    id: 'version-needs-both', type: 'fact',
    formula: 'a readable version = its log entry + its data files',
    uiLabel: 'From the Databricks guide (chapter 4): time travel needs both the version’s entry in the log and its data files.',
    effect: 'Losing either one makes the version unreadable.',
  },
  {
    id: 'log-cleaned', type: 'fact',
    formula: 'history kept for delta.logRetentionDuration (default 30 days)',
    uiLabel: 'From the Databricks guide (chapter 4): table history is kept for delta.logRetentionDuration, 30 days by default; log files are cleaned up automatically after checkpoints.',
    effect: 'A version older than the log retention is no longer in history.',
  },
  {
    id: 'files-vacuumed', type: 'fact',
    formula: 'VACUUM deletes files unreferenced for longer than delta.deletedFileRetentionDuration (default 7 days)',
    uiLabel: 'From the Databricks guide (chapter 4): VACUUM deletes data files no longer referenced by the table and older than the retention threshold, 7 days by default.',
    effect: 'A version older than the file retention has lost its files.',
  },
  {
    id: 'blocked-read', type: 'fact',
    formula: 'time travel older than the file retention is blocked on recent runtimes',
    uiLabel: 'From the Databricks guide (chapter 4): recent runtimes block time travel to a version older than deletedFileRetentionDuration.',
    effect: 'The read fails rather than returning an incomplete table.',
  },
  {
    id: 'readable', type: 'fact',
    formula: 'within both retentions → VERSION AS OF / TIMESTAMP AS OF works',
    uiLabel: 'From the Databricks guide (chapter 4): a version whose log entry and files are kept can be read with VERSION AS OF or TIMESTAMP AS OF.',
    effect: 'The version is returned as it was.',
  },
  {
    id: 'daily-rewrite', type: 'convention',
    formula: 'each version’s files are unreferenced from the next day',
    uiLabel: 'Teaching convention: every daily MERGE here rewrites all the table’s files, so a version’s files stop being referenced the day after it was written. A real MERGE rewrites only the files it touches.',
    effect: 'A version’s age is how long its files have been unreferenced.',
  },
  {
    id: 'daily-vacuum', type: 'convention',
    formula: 'VACUUM runs every day',
    uiLabel: 'Teaching convention: VACUUM runs daily (predictive optimization runs it automatically on Unity Catalog managed tables), so files are deleted as soon as they pass the retention.',
    effect: 'There is no gap between passing the retention and being deleted.',
  },
];

export const RETENTION: ExperimentDefinition<null> = {
  track: 'retention',
  idPrefix: 'dr',
  model: MODEL,
  loadContext: () => Promise.resolve(null),
  understand: 'Every write to a Delta table adds a new version to its transaction log: a small file saying which data files '
    + 'were added and which were removed. Removed files are not deleted at once, so older versions can still be read: '
    + 'that is time travel. Two settings decide how far back that works. The log keeps history for a while, and VACUUM '
    + 'deletes data files once they have been unreferenced for longer than their own retention.',
  preset: { ...PRESET },
  levers: [
    { key: 'age', label: 'Version asked for', options: [3, 10, 25, 40].map((v) => ({ value: v, label: `${v} days ago` })) },
    { key: 'fileRetention', label: 'delta.deletedFileRetentionDuration', options: [{ value: 7, label: '7 days (default)' }, { value: 30, label: '30 days' }] },
    { key: 'logRetention', label: 'delta.logRetentionDuration', options: [{ value: 30, label: '30 days (default)' }, { value: 60, label: '60 days' }] },
  ],
  heldNote: 'Held still: one MERGE a day, and VACUUM every day. The levers start at the scenario you predicted. Change one or more, then run the model.',
  run: modelRun,
  predict: {
    prompt: 'A table is written by a MERGE every day, and VACUUM runs every day. Both retention settings are at their defaults. '
      + 'An analyst asks for the table as it was 10 days ago. What happens?',
    options: [
      { id: 'readable', text: 'The version is returned' },
      { id: 'files-gone', text: 'History lists the version, but it can’t be read: its files are gone' },
      { id: 'history-gone', text: 'The version is no longer in history at all' },
      { id: 'restored', text: 'Databricks restores the files from its own backup and returns the version' },
    ],
  },
  reason: {
    prompt: 'In the scenario you predicted, why did the read turn out as it did?',
    options: [
      { id: 'files-vacuumed', text: 'The version’s files had been unreferenced for more than 7 days, so VACUUM deleted them' },
      { id: 'log-cleaned', text: 'The log had cleaned up the version’s entry' },
      { id: 'optimize', text: 'OPTIMIZE had changed the version’s results' },
      { id: 'merge-locks', text: 'The daily MERGE locked older versions' },
    ],
  },
  apply: {
    prompt: 'Auditors need to read the table exactly as it was 25 days ago. Which settings make that possible?',
    options: [
      { id: 'defaults', text: 'File retention 7 days, log retention 30 days', levers: { age: 25, fileRetention: 7, logRetention: 30 } },
      { id: 'files-30', text: 'File retention 30 days, log retention 30 days', levers: { age: 25, fileRetention: 30, logRetention: 30 } },
      { id: 'log-60', text: 'File retention 7 days, log retention 60 days', levers: { age: 25, fileRetention: 7, logRetention: 60 } },
      { id: 'both', text: 'File retention 30 days, log retention 60 days', levers: { age: 25, fileRetention: 30, logRetention: 60 } },
    ],
    correct: (r) => r.outcome === 'readable',
    right: 'The model returns the version from 25 days ago with those settings.',
    wrong: 'The model can’t return the version from 25 days ago with those settings.',
  },
  explainLabel: 'In your own words: why does history list versions that time travel can’t read, and what would you set for a table auditors depend on?',
  retrieve: {
    prompt: 'By default, how long are a Delta table’s removed data files kept before VACUUM may delete them?',
    options: [
      { id: '24h', text: '24 hours' },
      { id: '7d', text: '7 days' },
      { id: '30d', text: '30 days' },
      { id: '90d', text: '90 days' },
    ],
    answer: '7d',
    source: { chapter: 'history', quote: 'the data files, kept 7 days by default' },
  },
  couplings: RETENTION_COUPLINGS,
  ledgerIntro: 'Each rule the model applies, and the kind of claim it is: a statement from the Databricks guide, or a teaching convention.',
};
