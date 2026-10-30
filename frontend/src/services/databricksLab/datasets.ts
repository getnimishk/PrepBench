// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { FactoryCoupling } from '../lakehouse/factoryCouplings';
import type { ExperimentDefinition, Finding, LabPicture, Levers, ModelRun } from '../adfLab/definition';

/**
 * Databricks Lab, experiment 3: Streaming tables and materialized views (DATABRICKS-LAB-CONTRACT.md, E3).
 *
 * A pipeline joins an append-only stream of orders to a product table. 1,000 orders have been
 * processed, 120 of them for product P7. Then something changes -- P7's category is updated, or the
 * dataset's query is changed -- and 50 more P7 orders arrive. Whether the old rows show the change
 * depends on the dataset type and on the kind of update. Pure and deterministic.
 */

export const MODEL = 'databricksLab.datasets';

export const SOURCES = ['§10'];

export type Dataset = 'streaming' | 'mv';
export type Change = 'dimension' | 'query';
export type Update = 'refresh' | 'full';

export interface DatasetsLevers {
  dataset: Dataset;
  change: Change;
  update: Update;
}

export type DatasetsOutcome = 'current' | 'stale';

export const PROCESSED = 1000;
export const P7_BEFORE = 120;
export const NEW_ORDERS = 50;

export interface DatasetsResult {
  outcome: DatasetsOutcome;
  /** Rows written before the change that now show it. */
  oldRowsUpdated: number;
  /** Rows the change should reach among those written before it. */
  oldRowsAffected: number;
  /** Source rows the update read again from the start. */
  reprocessed: number;
  findings: Finding[];
}

export function runDatasets(l: DatasetsLevers): DatasetsResult {
  const findings: Finding[] = [];
  const add = (ledgerId: string, text: string, tone: Finding['tone']) => findings.push({ ledgerId, text, tone });
  const affected = l.change === 'dimension' ? P7_BEFORE : PROCESSED;
  const what = l.change === 'dimension' ? `the ${P7_BEFORE} earlier P7 orders` : `the ${PROCESSED} earlier orders`;

  if (l.dataset === 'mv') {
    add('mv-current', `A materialized view is recomputed to match its sources’ current state, so ${what} show the change, and so do the ${NEW_ORDERS} new ones.`, 'ok');
    if (l.update === 'full') add('full-refresh-mv', 'The full refresh recomputed it from scratch; a normal refresh would have given the same result, incrementally where that is cheaper.', 'info');
    return { outcome: 'current', oldRowsUpdated: affected, oldRowsAffected: affected, reprocessed: l.update === 'full' ? PROCESSED + NEW_ORDERS : 0, findings };
  }

  add('st-once', `A streaming table processes each source row once. The ${NEW_ORDERS} new orders are processed with the change in place.`, 'info');
  if (l.update === 'full') {
    add('full-refresh-st', `The full refresh cleared the streaming table, reset its checkpoint and reprocessed all ${PROCESSED + NEW_ORDERS} source rows, so every row now reflects the change.`, 'ok');
    add('source-kept', 'Bronze still holds every order, so the rebuild is complete.', 'info');
    return { outcome: 'current', oldRowsUpdated: affected, oldRowsAffected: affected, reprocessed: PROCESSED + NEW_ORDERS, findings };
  }
  if (l.change === 'dimension') {
    add('st-no-recompute', `Joins in a streaming table don’t recompute when the dimension changes: ${what} keep the old category.`, 'problem');
  } else {
    add('st-query-change', `Rows already appended aren’t reprocessed when the query changes: ${what} keep the old logic; only new rows see it.`, 'problem');
  }
  return { outcome: 'stale', oldRowsUpdated: 0, oldRowsAffected: affected, reprocessed: 0, findings };
}

function picture(l: DatasetsLevers, r: DatasetsResult): LabPicture {
  const old = 6;
  const fresh = 2;
  const oldTone = r.outcome === 'current' ? 'good' as const : 'bad' as const;
  return {
    lanes: [{
      label: l.dataset === 'mv' ? 'materialized view' : 'streaming table',
      cells: [
        ...Array.from({ length: old }, (_, i) => ({ label: `o${i + 1}`, tone: oldTone, spoken: `earlier order ${i + 1}: ${r.outcome === 'current' ? 'shows the change' : 'old value'}` })),
        ...Array.from({ length: fresh }, (_, i) => ({ label: `n${i + 1}`, tone: 'good' as const, spoken: `new order ${i + 1}: shows the change` })),
      ],
      markers: [{ at: old, label: l.change === 'dimension' ? 'category changed' : 'query changed' }],
      note: r.outcome === 'current' ? 'Every row reflects the change.' : 'Rows before the change keep the old value; only new rows see it.',
    }],
    legend: [
      { tone: 'good', label: 'Reflects the change' },
      ...(r.outcome === 'stale' ? [{ tone: 'bad' as const, label: 'Old value' }] : []),
    ],
  };
}

const asLevers = (l: Levers): DatasetsLevers => ({ dataset: l.dataset as Dataset, change: l.change as Change, update: l.update as Update });

export function modelRun(_: unknown, levers: Levers): ModelRun {
  const l = asLevers(levers);
  const r = runDatasets(l);
  return {
    outcome: r.outcome,
    measures: {
      updated: { label: 'Earlier rows showing the change', value: r.oldRowsUpdated, unit: `of ${r.oldRowsAffected}` },
      reprocessed: { label: 'Source rows read again from the start', value: r.reprocessed },
      result: { label: 'What happens', value: r.outcome },
    },
    findings: r.findings,
    picture: picture(l, r),
  };
}

export const PRESET: DatasetsLevers = { dataset: 'streaming', change: 'dimension', update: 'refresh' };

export const DATASETS_COUPLINGS: FactoryCoupling[] = [
  {
    id: 'st-once', type: 'fact',
    formula: 'streaming table: each source row processed exactly once (append-only source)',
    uiLabel: 'From the Databricks guide (chapter 17): a streaming table processes each record exactly once, assuming an append-only source.',
    effect: 'New rows are processed with whatever is in place when they arrive.',
  },
  {
    id: 'st-no-recompute', type: 'fact',
    formula: 'streaming table joins don’t recompute when a dimension changes',
    uiLabel: 'From the Databricks guide (chapter 17): joins in a streaming table don’t recompute when a dimension changes.',
    effect: 'Rows written before the change keep the old dimension value.',
  },
  {
    id: 'st-query-change', type: 'fact',
    formula: 'rows already appended aren’t reprocessed when the query changes',
    uiLabel: 'From the Databricks guide (chapter 17): rows already appended are not reprocessed when you change the query; only new rows see the change, unless you run a full refresh.',
    effect: 'Old rows keep the old logic.',
  },
  {
    id: 'mv-current', type: 'fact',
    formula: 'materialized view: recomputed to match the source’s current state',
    uiLabel: 'From the Databricks guide (chapter 17): a materialized view’s results are recomputed as needed to match the source’s current state, incrementally when possible.',
    effect: 'Every row reflects the change after the update.',
  },
  {
    id: 'full-refresh-st', type: 'fact',
    formula: 'full refresh: streaming table cleared, checkpoints reset, all source data reprocessed',
    uiLabel: 'From the Databricks guide (chapter 17): a full refresh clears a streaming table, resets its checkpoints and reprocesses all source data.',
    effect: 'The table is rebuilt with the change applied to every row.',
  },
  {
    id: 'full-refresh-mv', type: 'fact',
    formula: 'full refresh: materialized views recompute',
    uiLabel: 'From the Databricks guide (chapter 17): on a full refresh, materialized views recompute; on a normal refresh they refresh, incrementally when cheaper.',
    effect: 'Same result, more work.',
  },
  {
    id: 'source-kept', type: 'convention',
    formula: 'bronze keeps every order',
    uiLabel: 'Teaching convention: the source still holds every order, so a full refresh can rebuild everything. If a source has lost old data, a full refresh loses that history too.',
    effect: 'The rebuilt table is complete.',
  },
];

export const DATASETS: ExperimentDefinition<null> = {
  track: 'datasets',
  idPrefix: 'dds',
  model: MODEL,
  loadContext: () => Promise.resolve(null),
  understand: 'A declarative pipeline writes two main kinds of dataset. A streaming table reads its source incrementally and '
    + 'processes each new row once, which makes it cheap and fast for ingestion. A materialized view is recomputed to '
    + 'match its sources, incrementally when it can. The difference shows when something upstream changes after rows '
    + 'have already been written.',
  preset: { ...PRESET },
  levers: [
    { key: 'dataset', label: 'The orders dataset is a', options: [{ value: 'streaming', label: 'Streaming table' }, { value: 'mv', label: 'Materialized view' }] },
    { key: 'change', label: 'What changes', options: [{ value: 'dimension', label: 'Product P7’s category is updated' }, { value: 'query', label: 'The dataset’s query is changed' }] },
    { key: 'update', label: 'The next pipeline update', options: [{ value: 'refresh', label: 'Refresh (default)' }, { value: 'full', label: 'Full refresh' }] },
  ],
  heldNote: `Held still: ${PROCESSED} orders already processed (${P7_BEFORE} for P7), ${NEW_ORDERS} new P7 orders, and an append-only bronze source that keeps every order.`,
  run: modelRun,
  predict: {
    prompt: `A streaming table joins each order to the products table. ${PROCESSED} orders are already in it, ${P7_BEFORE} of them for product P7. `
      + `P7’s category is then changed from Garden to Outdoor, and ${NEW_ORDERS} more P7 orders arrive. After a normal refresh, what category do the ${P7_BEFORE} earlier P7 orders show?`,
    options: [
      { id: 'current', text: 'Outdoor: the join is recomputed for every row' },
      { id: 'stale', text: 'Garden: rows already written keep the old category' },
      { id: 'failed', text: 'The update fails because the dimension changed under it' },
      { id: 'duplicated', text: 'Both: each earlier order now appears twice, once per category' },
    ],
  },
  reason: {
    prompt: 'In the scenario you predicted, why did the earlier orders show what they did?',
    options: [
      { id: 'st-no-recompute', text: 'A streaming table processes each row once, and its joins don’t recompute when the dimension changes' },
      { id: 'mv-current', text: 'The dataset was recomputed to match the products table' },
      { id: 'cache', text: 'The products table was cached at the start of the pipeline' },
      { id: 'st-query-change', text: 'The query had been changed' },
    ],
  },
  apply: {
    prompt: 'After a product’s category changes, every order for it, old and new, must show the new category. Which setup does it?',
    options: [
      { id: 'st-refresh', text: 'Streaming table, normal refresh', levers: { dataset: 'streaming', change: 'dimension', update: 'refresh' } },
      { id: 'mv-refresh', text: 'Materialized view, normal refresh', levers: { dataset: 'mv', change: 'dimension', update: 'refresh' } },
      { id: 'st-full', text: 'Streaming table, full refresh after each change', levers: { dataset: 'streaming', change: 'dimension', update: 'full' } },
    ],
    correct: (r) => r.outcome === 'current',
    right: 'The model shows every order with the new category.',
    wrong: 'The model shows earlier orders still with the old category.',
  },
  explainLabel: 'In your own words: when would you choose a streaming table, when a materialized view, and what does a full refresh cost you?',
  retrieve: {
    prompt: 'What does a full refresh do to a streaming table?',
    options: [
      { id: 'new-only', text: 'Processes only the records that arrived since the last update' },
      { id: 'clear-reprocess', text: 'Clears it, resets its checkpoints and reprocesses all source data' },
      { id: 'changed-rows', text: 'Recomputes only the rows whose source changed' },
      { id: 'schema-only', text: 'Refreshes its schema and keeps its rows' },
    ],
    answer: 'clear-reprocess',
    source: { chapter: 'pipelines', quote: 'streaming tables are cleared, their checkpoints reset, and all source data reprocessed' },
  },
  couplings: DATASETS_COUPLINGS,
  ledgerIntro: 'Each rule the model applies, and the kind of claim it is: a statement from the Databricks guide, or a teaching convention.',
};
