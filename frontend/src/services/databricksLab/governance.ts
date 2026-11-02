// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { FactoryCoupling } from '../lakehouse/factoryCouplings';
import type { ExperimentDefinition, Finding, LabPicture, Levers, ModelRun } from '../adfLab/definition';

/**
 * Databricks Lab, experiment 6: Privileges and dropped tables (DATABRICKS-LAB-CONTRACT.md, E6), in two
 * modes, each its own track through the eight stages:
 *   grants -- analysts need to read one table; where SELECT is granted and whether the usage privileges
 *             above it are granted decide whether they are denied, read that table, or read the schema;
 *   drop   -- a table is dropped; its type, how long ago, and the recovery period decide whether it can
 *             be undropped, whether its files are gone, or whether they were never deleted.
 * Pure and deterministic.
 */

export const SOURCES = ['§6'];

// ---- grants ---------------------------------------------------------------------------------------

export const GRANTS_MODEL = 'databricksLab.governance.grants';

export type SelectOn = 'table' | 'schema';
export type YesNo = 'no' | 'yes';

export interface GrantsLevers {
  selectOn: SelectOn;
  useSchema: YesNo;
  useCatalog: YesNo;
}

export type GrantsOutcome = 'denied' | 'this-table' | 'whole-schema';

export interface GrantsResult {
  outcome: GrantsOutcome;
  /** Tables in sales.retail the analysts can read, of the two there today. */
  readable: number;
  /** Whether a table created tomorrow would be readable too. */
  future: boolean;
  findings: Finding[];
}

export function runGrants(l: GrantsLevers): GrantsResult {
  const findings: Finding[] = [];
  const add = (ledgerId: string, text: string, tone: Finding['tone']) => findings.push({ ledgerId, text, tone });

  add('starts-with-nothing', 'The analysts start with no access in Unity Catalog: they have exactly what is granted to their group.', 'info');
  const missing = [l.useCatalog === 'no' ? 'USE CATALOG on sales' : null, l.useSchema === 'no' ? 'USE SCHEMA on sales.retail' : null].filter(Boolean);
  if (missing.length) {
    add('missing-usage', `SELECT is granted on the ${l.selectOn === 'table' ? 'table' : 'schema'}, but ${missing.join(' and ')} ${missing.length > 1 ? 'are' : 'is'} missing. Without the usage privileges above it, SELECT gives them nothing: INSUFFICIENT_PERMISSIONS.`, 'problem');
    return { outcome: 'denied', readable: 0, future: false, findings };
  }
  add('three-privileges', 'They have USE CATALOG, USE SCHEMA and SELECT, the three privileges reading a table needs.', 'ok');
  if (l.selectOn === 'schema') {
    add('schema-inherits', 'SELECT on the schema covers every table in it, today’s and any created later: the analysts can read sales.retail.returns too, and whatever comes next.', 'info');
    return { outcome: 'whole-schema', readable: 2, future: true, findings };
  }
  add('table-only', 'SELECT on the one table: the analysts read sales.retail.orders and nothing else in the schema.', 'ok');
  return { outcome: 'this-table', readable: 1, future: false, findings };
}

function grantsPicture(l: GrantsLevers, r: GrantsResult): LabPicture {
  const can = (ok: boolean) => (ok ? 'good' as const : 'bad' as const);
  return {
    lanes: [
      {
        label: 'the analysts’ path',
        cells: [
          { label: 'sales', tone: l.useCatalog === 'yes' ? 'good' : 'bad', spoken: `catalog sales: USE CATALOG ${l.useCatalog === 'yes' ? 'granted' : 'missing'}` },
          { label: 'retail', tone: l.useSchema === 'yes' ? 'good' : 'bad', spoken: `schema retail: USE SCHEMA ${l.useSchema === 'yes' ? 'granted' : 'missing'}` },
        ],
      },
      {
        label: 'tables in sales.retail',
        cells: [
          { label: 'orders', tone: can(r.readable >= 1), spoken: `orders: ${r.readable >= 1 ? 'readable' : 'denied'}` },
          { label: 'returns', tone: can(r.readable >= 2), spoken: `returns: ${r.readable >= 2 ? 'readable' : 'not readable'}` },
          { label: 'next', tone: r.future ? 'warn' : 'muted', spoken: `a table created later: ${r.future ? 'readable too' : 'not readable'}` },
        ],
        note: r.outcome === 'denied' ? 'Blocked before reaching any table.' : r.outcome === 'whole-schema' ? 'Every table, including future ones.' : 'Only the orders table.',
      },
    ],
    legend: [
      { tone: 'good', label: 'Granted / readable' },
      { tone: 'bad', label: 'Missing / denied' },
      ...(r.future ? [{ tone: 'warn' as const, label: 'Readable when it is created' }] : [{ tone: 'muted' as const, label: 'A table created later' }]),
    ],
  };
}

export function grantsRun(_: unknown, levers: Levers): ModelRun {
  const l: GrantsLevers = { selectOn: levers.selectOn as SelectOn, useSchema: levers.useSchema as YesNo, useCatalog: levers.useCatalog as YesNo };
  const r = runGrants(l);
  return {
    outcome: r.outcome,
    measures: {
      readable: { label: 'Tables in sales.retail the analysts can read', value: r.readable, unit: 'of 2 today' },
      future: { label: 'Tables created later readable too', value: r.future ? 'yes' : 'no' },
      result: { label: 'What happens', value: r.outcome },
    },
    findings: r.findings,
    picture: grantsPicture(l, r),
  };
}

export const GRANTS_COUPLINGS: FactoryCoupling[] = [
  {
    id: 'starts-with-nothing', type: 'fact',
    formula: 'users start with no access',
    uiLabel: 'From the Databricks guide (chapter 10): Unity Catalog starts from no access; users have what is granted to them or their groups.',
    effect: 'Nothing is readable until it is granted.',
  },
  {
    id: 'missing-usage', type: 'fact',
    formula: 'SELECT without USE SCHEMA and USE CATALOG gives nothing',
    uiLabel: 'From the Databricks guide (chapter 10): USE CATALOG and USE SCHEMA give no data by themselves, but a table owner who grants SELECT has given nothing until someone also grants the usage privileges above it.',
    effect: 'The query fails with INSUFFICIENT_PERMISSIONS.',
  },
  {
    id: 'three-privileges', type: 'fact',
    formula: 'read = SELECT + USE SCHEMA + USE CATALOG',
    uiLabel: 'From the Databricks guide (chapter 10): reading a table needs USE CATALOG, USE SCHEMA and SELECT.',
    effect: 'The analysts can read what SELECT covers.',
  },
  {
    id: 'schema-inherits', type: 'fact',
    formula: 'a grant on a schema covers current and future objects in it',
    uiLabel: 'From the Databricks guide (chapter 10): grants on a catalog or schema inherit to current and future objects inside it.',
    effect: 'Every table in the schema is readable, including ones created later.',
  },
  {
    id: 'table-only', type: 'fact',
    formula: 'SELECT on a table covers that table',
    uiLabel: 'From the Databricks guide (chapter 10): SELECT granted on a table lets the grantee read that table, given the usage privileges above it.',
    effect: 'Only the one table is readable.',
  },
];

export const GRANTS: ExperimentDefinition<null> = {
  track: 'governance.grants',
  idPrefix: 'dgg',
  model: GRANTS_MODEL,
  loadContext: () => Promise.resolve(null),
  understand: 'Unity Catalog organises data as catalog.schema.table and starts everyone with no access. To read a table, a '
    + 'user needs a privilege on the table and the right to enter the schema and the catalog that hold it. A privilege '
    + 'granted on a schema or catalog also covers everything inside it, including what is created later.',
  preset: { selectOn: 'table', useSchema: 'no', useCatalog: 'no' },
  levers: [
    { key: 'selectOn', label: 'SELECT is granted on', options: [{ value: 'table', label: 'The table sales.retail.orders' }, { value: 'schema', label: 'The schema sales.retail' }] },
    { key: 'useSchema', label: 'USE SCHEMA on sales.retail', options: [{ value: 'no', label: 'Not granted' }, { value: 'yes', label: 'Granted' }] },
    { key: 'useCatalog', label: 'USE CATALOG on sales', options: [{ value: 'no', label: 'Not granted' }, { value: 'yes', label: 'Granted' }] },
  ],
  heldNote: 'Held still: the analysts’ group, and a schema holding two tables today, orders and returns. All grants go to the group.',
  run: grantsRun,
  predict: {
    prompt: 'The owner of sales.retail.orders runs GRANT SELECT ON TABLE sales.retail.orders TO `analysts`. Nothing else is granted to the analysts. '
      + 'An analyst queries the table. What happens?',
    options: [
      { id: 'this-table', text: 'The query returns the table’s rows' },
      { id: 'denied', text: 'The query fails with INSUFFICIENT_PERMISSIONS' },
      { id: 'whole-schema', text: 'The analyst can now read every table in the schema' },
    ],
  },
  reason: {
    prompt: 'In the scenario you predicted, why did the query turn out as it did?',
    options: [
      { id: 'missing-usage', text: 'SELECT alone isn’t enough: USE SCHEMA and USE CATALOG were missing' },
      { id: 'owner-only', text: 'Only a metastore admin can grant SELECT' },
      { id: 'deny', text: 'A DENY on the schema overrode the grant' },
      { id: 'schema-inherits', text: 'The schema’s grants replaced the table’s' },
    ],
  },
  apply: {
    prompt: 'The analysts must read sales.retail.orders, and nothing else in the schema, now or later. Which grants do it?',
    options: [
      { id: 'table-both', text: 'SELECT on the table, USE SCHEMA on sales.retail, USE CATALOG on sales', levers: { selectOn: 'table', useSchema: 'yes', useCatalog: 'yes' } },
      { id: 'schema-both', text: 'SELECT on the schema, USE SCHEMA on sales.retail, USE CATALOG on sales', levers: { selectOn: 'schema', useSchema: 'yes', useCatalog: 'yes' } },
      { id: 'table-schema', text: 'SELECT on the table and USE SCHEMA on sales.retail', levers: { selectOn: 'table', useSchema: 'yes', useCatalog: 'no' } },
      { id: 'table-catalog', text: 'SELECT on the table and USE CATALOG on sales', levers: { selectOn: 'table', useSchema: 'no', useCatalog: 'yes' } },
    ],
    correct: (r) => r.outcome === 'this-table',
    right: 'The model lets the analysts read that table and nothing else.',
    wrong: 'The model either blocks the analysts or lets them read more than that table.',
  },
  explainLabel: 'In your own words: why can a table owner’s SELECT grant give nothing, and when would you grant at schema level instead of table level?',
  retrieve: {
    prompt: 'Which privileges does reading a Unity Catalog table need?',
    options: [
      { id: 'select', text: 'SELECT on the table' },
      { id: 'three', text: 'USE CATALOG, USE SCHEMA and SELECT' },
      { id: 'browse', text: 'BROWSE on the catalog and SELECT' },
      { id: 'modify', text: 'MODIFY on the table' },
    ],
    answer: 'three',
    source: { chapter: 'access', quote: 'Reading a table needs USE CATALOG, USE SCHEMA and SELECT' },
  },
  couplings: GRANTS_COUPLINGS,
  ledgerIntro: 'Each rule the model applies, and the kind of claim it is: a statement from the Databricks guide.',
};

// ---- drop -----------------------------------------------------------------------------------------

export const DROP_MODEL = 'databricksLab.governance.drop';

export type TableType = 'managed' | 'external';
export type Days = 3 | 10;
export type Retain = 7 | 30;

export interface DropLevers {
  type: TableType;
  days: Days;
  retain: Retain;
}

export type DropOutcome = 'undroppable' | 'files-deleted' | 'files-remain';

export interface DropResult {
  outcome: DropOutcome;
  inCatalog: boolean;
  filesInStorage: boolean;
  findings: Finding[];
}

export function runDrop(l: DropLevers): DropResult {
  const findings: Finding[] = [];
  const add = (ledgerId: string, text: string, tone: Finding['tone']) => findings.push({ ledgerId, text, tone });

  if (l.type === 'external') {
    add('external-metadata-only', `It was an external table: DROP TABLE removed its entry from Unity Catalog and left its files at their path in storage. ${l.days} days on, they are all still there, and still costing storage.`, 'problem');
    if (l.retain !== 7) add('retain-managed', 'The recovery period (RETAIN DROPPED) governs when a managed table’s files are deleted; an external table’s files are never deleted by a drop.', 'info');
    return { outcome: 'files-remain', inCatalog: false, filesInStorage: true, findings };
  }
  add('managed-lifecycle', 'It was a managed table: Unity Catalog manages its files, and deletes them automatically once the recovery period after the drop ends.', 'info');
  if (l.days <= l.retain) {
    add('undrop-window', `It was dropped ${l.days} days ago and the recovery period is ${l.retain} days, so UNDROP TABLE brings it back, files and all.`, 'ok');
    return { outcome: 'undroppable', inCatalog: false, filesInStorage: true, findings };
  }
  add('recovery-over', `It was dropped ${l.days} days ago and the recovery period is ${l.retain} days: its files have been deleted and UNDROP TABLE can no longer bring it back.`, 'problem');
  return { outcome: 'files-deleted', inCatalog: false, filesInStorage: false, findings };
}

function dropPicture(l: DropLevers, r: DropResult): LabPicture {
  return {
    lanes: [
      {
        label: 'Unity Catalog',
        cells: [{ label: 'entry', tone: 'muted', spoken: 'the table’s catalog entry: dropped' }],
        note: r.outcome === 'undroppable' ? 'Dropped, recoverable with UNDROP TABLE.' : 'Dropped.',
      },
      {
        label: `storage (${l.type === 'managed' ? 'managed location' : 'external location'})`,
        cells: Array.from({ length: 4 }, (_, i) => ({
          label: `file ${i + 1}`,
          tone: r.filesInStorage ? (r.outcome === 'files-remain' ? 'warn' as const : 'good' as const) : 'muted' as const,
          spoken: `data file ${i + 1}: ${r.filesInStorage ? 'still in storage' : 'deleted'}`,
        })),
        note: r.outcome === 'files-remain' ? 'Never deleted by the drop.' : r.outcome === 'undroppable' ? 'Kept until the recovery period ends.' : 'Deleted after the recovery period.',
      },
    ],
    legend: [
      { tone: 'muted', label: 'Dropped or deleted' },
      ...(r.outcome === 'undroppable' ? [{ tone: 'good' as const, label: 'Kept, recoverable' }] : []),
      ...(r.outcome === 'files-remain' ? [{ tone: 'warn' as const, label: 'Still in storage, outside the catalog' }] : []),
    ],
  };
}

export function dropRun(_: unknown, levers: Levers): ModelRun {
  const l: DropLevers = { type: levers.type as TableType, days: Number(levers.days) as Days, retain: Number(levers.retain) as Retain };
  const r = runDrop(l);
  return {
    outcome: r.outcome,
    measures: {
      catalog: { label: 'In Unity Catalog', value: r.inCatalog ? 'yes' : 'no (dropped)' },
      files: { label: 'Data files in storage', value: r.filesInStorage ? 'yes' : 'no' },
      result: { label: 'What happens', value: r.outcome },
    },
    findings: r.findings,
    picture: dropPicture(l, r),
  };
}

export const DROP_COUPLINGS: FactoryCoupling[] = [
  {
    id: 'external-metadata-only', type: 'fact',
    formula: 'external table: DROP removes the metadata, leaves the files',
    uiLabel: 'From the Databricks guide (chapter 9): for an external table, DROP TABLE removes the metadata and leaves the files; the data is still in your storage account.',
    effect: 'Dropping an external table frees no storage.',
  },
  {
    id: 'managed-lifecycle', type: 'fact',
    formula: 'managed table: files deleted automatically after the recovery period',
    uiLabel: 'From the Databricks guide (chapter 9): a managed table’s files are deleted automatically after DROP TABLE, once a recovery period ends (default 7 days).',
    effect: 'The files stay through the recovery period, then go.',
  },
  {
    id: 'undrop-window', type: 'fact',
    formula: 'within the recovery period, UNDROP TABLE brings the table back',
    uiLabel: 'From the Databricks guide (chapter 9): within the recovery period, UNDROP TABLE brings a dropped managed table back.',
    effect: 'A mistaken drop is undone.',
  },
  {
    id: 'recovery-over', type: 'fact',
    formula: 'after the recovery period, the files are gone',
    uiLabel: 'From the Databricks guide (chapter 9): the recovery period is 7 days by default, settable to 0 or 7-30 days per catalog or schema with RETAIN DROPPED; after it, the files are deleted.',
    effect: 'The table can’t be undropped.',
  },
  {
    id: 'retain-managed', type: 'fact',
    formula: 'RETAIN DROPPED sets the managed tables’ recovery period',
    uiLabel: 'From the Databricks guide (chapter 9): RETAIN DROPPED sets the recovery period after which a dropped managed table’s files are deleted.',
    effect: 'It doesn’t change what happens to an external table’s files.',
  },
];

export const DROP: ExperimentDefinition<null> = {
  track: 'governance.drop',
  idPrefix: 'dgd',
  model: DROP_MODEL,
  loadContext: () => Promise.resolve(null),
  understand: 'A Unity Catalog table is either managed or external. For a managed table, Unity Catalog manages the files too: '
    + 'it stores them, optimises them, and deletes them after the table is dropped, once a recovery period has passed. For '
    + 'an external table, it manages only the table’s entry; the files live at a path you chose and stay yours.',
  preset: { type: 'external', days: 3, retain: 7 },
  levers: [
    { key: 'type', label: 'The table was', options: [{ value: 'external', label: 'External' }, { value: 'managed', label: 'Managed' }] },
    { key: 'days', label: 'Dropped', options: [{ value: 3, label: '3 days ago' }, { value: 10, label: '10 days ago' }] },
    { key: 'retain', label: 'Recovery period (RETAIN DROPPED)', options: [{ value: 7, label: '7 days (default)' }, { value: 30, label: '30 days' }] },
  ],
  heldNote: 'Held still: one table of four data files, dropped with DROP TABLE.',
  run: dropRun,
  predict: {
    prompt: 'To cut storage costs, a team drops an old external table nobody queries. Three days later, what is true?',
    options: [
      { id: 'files-deleted', text: 'Its files have been deleted, and storage costs have fallen' },
      { id: 'files-remain', text: 'It is gone from the catalog, but its files are all still in storage' },
      { id: 'undroppable', text: 'Its files are kept for the recovery period and then deleted' },
    ],
  },
  reason: {
    prompt: 'In the scenario you predicted, why are the files where they are?',
    options: [
      { id: 'external-metadata-only', text: 'For an external table, DROP removes only the metadata; the files stay at their path' },
      { id: 'recovery-over', text: 'The recovery period had ended' },
      { id: 'vacuum', text: 'VACUUM hadn’t run yet' },
      { id: 'managed-lifecycle', text: 'Unity Catalog deletes dropped tables’ files after seven days' },
    ],
  },
  apply: {
    prompt: 'A managed table was dropped by mistake. In which situation does UNDROP TABLE bring it back?',
    options: [
      { id: 'm3-7', text: 'Dropped 3 days ago, recovery period 7 days', levers: { type: 'managed', days: 3, retain: 7 } },
      { id: 'm10-7', text: 'Dropped 10 days ago, recovery period 7 days', levers: { type: 'managed', days: 10, retain: 7 } },
      { id: 'm10-30', text: 'Dropped 10 days ago, recovery period 30 days', levers: { type: 'managed', days: 10, retain: 30 } },
    ],
    correct: (r) => r.outcome === 'undroppable',
    right: 'The model shows the table recoverable with UNDROP TABLE.',
    wrong: 'The model shows the table’s files already deleted.',
  },
  explainLabel: 'In your own words: what does dropping a managed table do compared with an external one, and how would you free an external table’s storage safely?',
  retrieve: {
    prompt: 'What does DROP TABLE do to an external table?',
    options: [
      { id: 'both', text: 'Removes the metadata and deletes the files' },
      { id: 'metadata', text: 'Removes the metadata and leaves the files' },
      { id: 'later', text: 'Removes the metadata and deletes the files after 7 days' },
      { id: 'refuse', text: 'Refuses: external tables can’t be dropped' },
    ],
    answer: 'metadata',
    source: { chapter: 'tables-storage', quote: 'DROP TABLE removes the metadata and leaves the files.' },
  },
  couplings: DROP_COUPLINGS,
  ledgerIntro: 'Each rule the model applies, and the kind of claim it is: a statement from the Databricks guide.',
};
