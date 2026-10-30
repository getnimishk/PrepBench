// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { FactoryCoupling } from '../lakehouse/factoryCouplings';
import type { ExperimentDefinition, Finding, LabPicture, Levers, ModelRun } from '../adfLab/definition';

/**
 * Databricks Lab, experiment 5: Shuffle, skew and AQE (DATABRICKS-LAB-CONTRACT.md, E5).
 *
 * A stage shuffles 10 million rows into 200 partitions by seller. One seller has 200,000 rows, all of
 * which land in one partition. Whether that partition makes one task far slower than the rest depends
 * on the operation (a sort-merge join or a groupBy aggregation), on adaptive query execution, and on
 * salting the aggregation. Pure and deterministic.
 */

export const MODEL = 'databricksLab.skew';

export const SOURCES = ['§9'];

export type Operation = 'join' | 'groupBy';
export type Aqe = 'on' | 'off';
export type Salt = 'off' | 'on';

export interface SkewLevers {
  operation: Operation;
  aqe: Aqe;
  salt: Salt;
}

export type SkewOutcome = 'skewed' | 'even';

export const PARTITIONS = 200;
export const ROWS = 10_000_000;
export const HOT_ROWS = 200_000;
export const SALTS = 16;
/** Rows in every partition but the hot one's extra: the other sellers, spread evenly. */
export const BASE = (ROWS - HOT_ROWS) / PARTITIONS;

export interface SkewResult {
  outcome: SkewOutcome;
  maxRows: number;
  p75Rows: number;
  /** Max over the 75th percentile, as a ratio. */
  ratio: number;
  findings: Finding[];
}

/** The 75th percentile of a list of task sizes (nearest rank). */
function p75(sizes: number[]): number {
  const sorted = [...sizes].sort((a, b) => a - b);
  return sorted[Math.ceil(0.75 * sorted.length) - 1];
}

/** Task sizes, in rows, for one run. */
export function taskSizes(l: SkewLevers): number[] {
  const sizes = Array.from({ length: PARTITIONS }, () => BASE);
  if (l.operation === 'groupBy' && l.salt === 'on') {
    // The hot seller's rows are spread over SALTS partitions by a random salt.
    for (let i = 0; i < SALTS; i++) sizes[i] += HOT_ROWS / SALTS;
    return sizes;
  }
  sizes[0] += HOT_ROWS;
  if (l.operation === 'join' && l.aqe === 'on') {
    // AQE splits the skewed partition into pieces no bigger than the median.
    const pieces = Math.ceil(sizes[0] / BASE);
    const piece = sizes[0] / pieces;
    sizes.splice(0, 1, ...Array.from({ length: pieces }, () => piece));
  }
  return sizes;
}

export function runSkew(l: SkewLevers): SkewResult {
  const findings: Finding[] = [];
  const add = (ledgerId: string, text: string, tone: Finding['tone']) => findings.push({ ledgerId, text, tone });
  const sizes = taskSizes(l);
  const maxRows = Math.max(...sizes);
  const p = p75(sizes);
  const ratio = maxRows / p;
  const skewed = ratio >= 1.5;
  const fmt = (n: number) => Math.round(n).toLocaleString('en-GB');

  add('shuffle-by-key', `The ${l.operation === 'join' ? 'join' : 'groupBy'} shuffles rows so each seller’s rows are in one partition, processed by one task.`, 'info');

  if (l.operation === 'groupBy' && l.salt === 'on') {
    add('salting', `Salting split the big seller into ${SALTS} keys, so its rows spread over ${SALTS} tasks; a second, tiny aggregation combines their partial results.`, 'ok');
  } else {
    add('hot-key', `The big seller’s ${fmt(HOT_ROWS)} rows all went to one partition: that partition’s task has ${fmt(HOT_ROWS + BASE)} rows before any fix, against ${fmt(BASE)} for a typical one.`, l.operation === 'join' && l.aqe === 'on' ? 'info' : 'problem');
    if (l.operation === 'join' && l.aqe === 'on') {
      add('aqe-splits-joins', 'Adaptive query execution saw the oversized partition at the shuffle and split it into smaller pieces for the sort-merge join.', 'ok');
    } else if (l.operation === 'groupBy' && l.aqe === 'on') {
      add('aqe-joins-only', 'AQE is on, but it splits skewed partitions in sort-merge and shuffle-hash joins, not in aggregations. The groupBy’s hot partition stays whole.', 'problem');
    } else {
      add('aqe-off', 'AQE is off, so nothing adjusts the partitions at run time.', 'info');
    }
    if (l.operation === 'join' && l.salt === 'on') add('salt-agg-only', 'Salting in this model is the two-stage aggregation, so it changes nothing for the join.', 'info');
  }

  add(skewed ? 'skew-signal' : 'no-skew', skewed
    ? `The slowest task has ${fmt(maxRows)} rows against a 75th percentile of ${fmt(p)}: ${ratio.toFixed(1)}×. That is skew: one task holds up the whole stage.`
    : `The slowest task has ${fmt(maxRows)} rows against a 75th percentile of ${fmt(p)}: ${ratio.toFixed(2)}×, under the 1.5× that signals skew.`, skewed ? 'info' : 'ok');
  return { outcome: skewed ? 'skewed' : 'even', maxRows, p75Rows: p, ratio, findings };
}

function picture(l: SkewLevers, r: SkewResult): LabPicture {
  const sizes = [...taskSizes(l)].sort((a, b) => b - a).slice(0, 8);
  const tone = (n: number) => (n >= 1.5 * r.p75Rows ? 'bad' as const : n > r.p75Rows ? 'warn' as const : 'neutral' as const);
  return {
    lanes: [{
      label: 'largest 8 of the stage’s tasks (thousand rows)',
      cells: sizes.map((n, i) => ({ label: `${Math.round(n / 1000)}k`, tone: tone(n), spoken: `task ${i + 1}: ${Math.round(n).toLocaleString('en-GB')} rows` })),
      note: r.outcome === 'skewed' ? 'One task is far larger than the rest.' : 'The largest tasks are close to the rest.',
    }],
    legend: [
      { tone: 'neutral', label: 'Typical task' },
      { tone: 'warn', label: 'Above the 75th percentile' },
      ...(r.outcome === 'skewed' ? [{ tone: 'bad' as const, label: '1.5× the 75th percentile or more' }] : []),
    ],
  };
}

const asLevers = (l: Levers): SkewLevers => ({ operation: l.operation as Operation, aqe: l.aqe as Aqe, salt: l.salt as Salt });

export function modelRun(_: unknown, levers: Levers): ModelRun {
  const l = asLevers(levers);
  const r = runSkew(l);
  return {
    outcome: r.outcome,
    measures: {
      max: { label: 'Rows in the slowest task', value: Math.round(r.maxRows) },
      p75: { label: 'Rows at the 75th percentile', value: Math.round(r.p75Rows) },
      ratio: { label: 'Slowest task over the 75th percentile', value: Math.round(r.ratio * 100), unit: '%' },
      result: { label: 'What happens', value: r.outcome },
    },
    findings: r.findings,
    picture: picture(l, r),
  };
}

export const PRESET: SkewLevers = { operation: 'groupBy', aqe: 'on', salt: 'off' };

export const SKEW_COUPLINGS: FactoryCoupling[] = [
  {
    id: 'shuffle-by-key', type: 'fact',
    formula: 'a shuffle regroups rows by key across partitions; one task per partition',
    uiLabel: 'From the Databricks guide (chapter 12): group-bys and most joins shuffle, redistributing rows so they are grouped by key across partitions, with one task per partition.',
    effect: 'All of one seller’s rows meet in one partition.',
  },
  {
    id: 'hot-key', type: 'fact',
    formula: 'a few partitions holding far more data than the rest is skew',
    uiLabel: 'From the Databricks guide (chapter 19): skew is a few partitions holding far more data than the rest.',
    effect: 'One task takes far longer; the stage waits for it.',
  },
  {
    id: 'aqe-splits-joins', type: 'fact',
    formula: 'AQE splits skewed partitions in sort-merge and shuffle-hash joins',
    uiLabel: 'From the Databricks guide (chapter 19): AQE, on by default, splits skewed join partitions at run time.',
    effect: 'The join’s hot partition becomes several normal-sized tasks.',
  },
  {
    id: 'aqe-joins-only', type: 'fact',
    formula: 'AQE doesn’t split skewed aggregations',
    uiLabel: 'From the Databricks guide (chapter 19): AQE splits skewed join partitions, but not skewed aggregations, so a skewed groupBy needs salting.',
    effect: 'The groupBy stays skewed with AQE on.',
  },
  {
    id: 'aqe-off', type: 'fact',
    formula: 'with AQE off, partitions are not adjusted at run time',
    uiLabel: 'From the Databricks guide (chapter 19): AQE, at each shuffle or broadcast exchange, re-plans using the real sizes of the data so far.',
    effect: 'Nothing splits the hot partition.',
  },
  {
    id: 'salting', type: 'fact',
    formula: 'salt the hot key and aggregate in two stages',
    uiLabel: 'From the Databricks guide (chapter 19): salt the hot key and aggregate in two stages to spread a skewed aggregation.',
    effect: 'The big seller’s rows spread over several tasks.',
  },
  {
    id: 'skew-signal', type: 'fact',
    formula: 'max task duration ≥ 1.5 × the 75th percentile',
    uiLabel: 'From the Databricks guide (chapter 19): skew shows in a stage’s Summary Metrics as a max task duration 50% or more above the 75th percentile.',
    effect: 'The stage reads as skewed.',
  },
  {
    id: 'no-skew', type: 'fact',
    formula: 'max task duration under 1.5 × the 75th percentile',
    uiLabel: 'From the Databricks guide (chapter 19): skew is a max task duration 50% or more above the 75th percentile; below that, the tasks are close.',
    effect: 'The stage isn’t held up by one task.',
  },
  {
    id: 'rows-are-time', type: 'convention',
    formula: 'task time ∝ rows; AQE pieces ≤ the median; 16 salts',
    uiLabel: 'Teaching convention: a task’s time is proportional to its rows, AQE splits a skewed partition into pieces no bigger than a typical one, and salting uses 16 values. Real thresholds and sizes differ.',
    effect: 'Rows stand in for task duration.',
  },
  {
    id: 'salt-agg-only', type: 'convention',
    formula: 'salting is modelled for the aggregation only',
    uiLabel: 'Teaching convention: this model’s salting lever is the two-stage aggregation the guide describes, so it applies to the groupBy only.',
    effect: 'For the join, the lever has no effect here.',
  },
];

export const SKEW: ExperimentDefinition<null> = {
  track: 'skew',
  idPrefix: 'dsk',
  model: MODEL,
  loadContext: () => Promise.resolve(null),
  understand: 'Spark runs a stage as many tasks, one per partition. Joins and aggregations shuffle rows so that equal keys meet '
    + 'in the same partition. If one key has far more rows than the others, one task gets far more work, and the whole stage '
    + 'waits for it: that is skew. Adaptive query execution (AQE) adjusts some of this at run time, and salting spreads a hot key by hand.',
  preset: { ...PRESET },
  levers: [
    { key: 'operation', label: 'The stage’s operation', options: [{ value: 'groupBy', label: 'groupBy(seller).agg(sum)' }, { value: 'join', label: 'Sort-merge join on seller' }] },
    { key: 'aqe', label: 'Adaptive query execution', options: [{ value: 'on', label: 'On (default)' }, { value: 'off', label: 'Off' }] },
    { key: 'salt', label: 'Salted two-stage aggregation', options: [{ value: 'off', label: 'Off' }, { value: 'on', label: `On, ${SALTS} salts` }] },
  ],
  heldNote: `Held still: ${(ROWS / 1e6).toFixed(0)} million rows, ${PARTITIONS} shuffle partitions, one seller with ${HOT_ROWS.toLocaleString('en-GB')} rows.`,
  run: modelRun,
  predict: {
    prompt: `A daily job sums sales per seller with a groupBy over ${(ROWS / 1e6).toFixed(0)} million rows. One seller has ${HOT_ROWS.toLocaleString('en-GB')} of them. `
      + 'AQE is on, as it is by default. In the stage’s Summary Metrics, what does the slowest task look like?',
    options: [
      { id: 'even', text: 'Close to the others: AQE splits the big seller’s partition' },
      { id: 'skewed', text: 'Far above the 75th percentile: one task has the big seller’s rows' },
      { id: 'failed', text: 'The stage fails because one partition is too large' },
    ],
  },
  reason: {
    prompt: 'In the scenario you predicted, why did the slowest task look as it did?',
    options: [
      { id: 'aqe-joins-only', text: 'AQE splits skewed partitions in joins, not in aggregations' },
      { id: 'hot-key', text: 'All the big seller’s rows were shuffled to one partition, processed by one task' },
      { id: 'too-few-workers', text: 'The cluster had too few workers' },
      { id: 'broadcast', text: 'The groupBy broadcast the big seller to every worker' },
    ],
  },
  apply: {
    prompt: 'The daily per-seller aggregation must not have one task far slower than the rest. Which setup does it?',
    options: [
      { id: 'salt', text: 'groupBy, AQE on, salted two-stage aggregation', levers: { operation: 'groupBy', aqe: 'on', salt: 'on' } },
      { id: 'aqe-only', text: 'groupBy, AQE on, no salting', levers: { operation: 'groupBy', aqe: 'on', salt: 'off' } },
      { id: 'aqe-off', text: 'groupBy, AQE off, no salting', levers: { operation: 'groupBy', aqe: 'off', salt: 'off' } },
    ],
    correct: (r) => r.outcome === 'even',
    right: 'The model shows the slowest task close to the rest.',
    wrong: 'The model still shows one task far slower than the rest.',
  },
  explainLabel: 'In your own words: how do you recognise skew in the Spark UI, and why does AQE fix a skewed join but not a skewed groupBy?',
  retrieve: {
    prompt: 'In a stage’s Summary Metrics, what signals skew?',
    options: [
      { id: 'spill', text: 'Any spill on the stage' },
      { id: 'many-tasks', text: 'More than 200 tasks' },
      { id: 'max-75', text: 'Max task duration 50% or more above the 75th percentile' },
      { id: 'min-zero', text: 'A minimum task duration of zero' },
    ],
    answer: 'max-75',
    source: { chapter: 'performance', quote: 'Max task duration is 50% or more above the 75th percentile' },
  },
  couplings: SKEW_COUPLINGS,
  ledgerIntro: 'Each rule the model applies, and the kind of claim it is: a statement from the Databricks guide, or a teaching convention.',
};
