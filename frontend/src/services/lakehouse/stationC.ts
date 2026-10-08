// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { CompareData, LabOpName, LabOperation, LabOperationResult } from '../../types/lakehouse';
import { leversKey, ranges, type AdfLevers, type BatchManifest } from './adfModel';

// Station C's challenges: a prediction, the operation that settles it, and how
// the engine's REAL result is read back as one of the prediction's options.
//
// Nothing here knows an outcome in advance. `classify` looks only at what the
// engine returned, so a prediction is marked right or wrong by the engine and
// never by this file -- and with no engine there is no result, so no mark.
// (CLAUDE.md hard rule 2: never a fabricated result.)
//
// These are deliberately NOT in services/learning/challenges.ts. That registry
// is the Chart Sandbox's: a concept registered there joins its mastery,
// placement and recommendations. A lab attempt shares the learning_attempts
// table but is told apart by its `lakehouse.c.` ids (see attempts.ts).

type Distribute<T> = T extends unknown ? Omit<T, 'pack_id' | 'attempt_uid'> : never;
/** An operation without the parts the page fills in: the pack and the attempt. */
export type OpTemplate = Distribute<LabOperation>;

export interface TableState {
  version: number | null;
  rows: number | null;
}
export type TableStates = Record<string, TableState>;

export interface SetupStep {
  label: string;
  op: OpTemplate;
}

export interface PredictionOption {
  id: string;
  text: string;
}

export interface FollowUp {
  label: string;
  why: string;
  op: OpTemplate;
}

export interface StationCChallenge {
  id: string;
  /** The id of the concept its attempts are recorded under. */
  conceptId: string;
  title: string;
  /** What is about to happen, before the prediction. */
  scenario: string;
  prompt: string;
  options: PredictionOption[];
  /** Brings the tables to the state the question is about. Run in the Manipulate step. */
  setup: SetupStep[];
  /** The operation whose result settles the prediction. */
  designated: OpTemplate;
  /** Which option the engine's result amounts to. `before` is the table's state before the run. */
  classify: (result: LabOperationResult, before: TableState | undefined) => string;
  /** What each reading means. Said after the result, never before. */
  reveal: Record<string, string>;
  followUps: FollowUp[];
  /** After the designated result: a sentence comparing what a browser model said with what the engine found. */
  crossCheck?: (result: LabOperationResult) => string | null;
}

/** The form's starting point for each operation. Every field a request needs is set. */
export function defaultTemplate(op: LabOpName, table: string, otherTable: string): OpTemplate {
  switch (op) {
    case 'create_table': return { op, table };
    case 'append_batch': return { op, table, batch: 2, write: 'append', schema_mode: 'enforce', small_files: false };
    case 'merge_cdc': return { op, table };
    case 'history': return { op, table };
    case 'read_version': return { op, table, version: 0, sample: 5 };
    case 'restore': return { op, table, version: 0 };
    case 'compact': return { op, table, z_order: [] };
    case 'vacuum': return { op, table, retention_hours: 168, dry_run: true, enforce_retention: true };
    case 'compare_tables': return { op, left: table, right: otherTable, tolerance: 0.0001 };
  }
}

export const CHALLENGE_PREFIX = 'lakehouse.c.';
export const challengeId = (slug: string) => `${CHALLENGE_PREFIX}${slug}`;

const columnsOf = (result: LabOperationResult): string[] =>
  Array.isArray(result.data.columns) ? (result.data.columns as unknown[]).map(String) : [];

const filesRemoved = (result: LabOperationResult) => Number(result.data.files_removed ?? 0);

// ---- reconciliation facts, read from compare_tables' data --------------------------

export interface ReconciliationFacts {
  /** Columns whose totals (sum, min, max or nulls) differ between the tables. */
  visibleInTotals: string[];
  /** Columns with mismatched rows but identical totals: only a row-level join finds them. */
  rowLevelOnly: string[];
  mismatchedRows: Record<string, number>;
}

export function reconciliationFacts(data: CompareData): ReconciliationFacts {
  const visibleInTotals: string[] = [];
  const rowLevelOnly: string[] = [];
  const mismatchedRows: Record<string, number> = {};
  for (const column of data.columns_compared) {
    const agg = data.aggregates[column];
    const count = data.mismatches[column]?.count ?? 0;
    const sameTotals = Boolean(agg)
      && agg.left.sum === agg.right.sum && agg.left.min === agg.right.min
      && agg.left.max === agg.right.max && agg.left.nulls === agg.right.nulls;
    if (agg && !sameTotals) visibleInTotals.push(column);
    if (count > 0) {
      mismatchedRows[column] = count;
      if (sameTotals) rowLevelOnly.push(column);
    }
  }
  return { visibleInTotals, rowLevelOnly, mismatchedRows };
}

/**
 * The server's answer when the table the operation names hasn't been created.
 * That is a missing set-up step, not something the engine did to the data, so it
 * is never read as the outcome of a challenge: marking "refused" right because a
 * table was missing would be a result nobody earned.
 */
export const isNotCreated = (result: LabOperationResult): boolean =>
  !result.ok && /doesn['’]t exist yet/i.test(result.error ?? '');

const asCompare = (result: LabOperationResult) => result.data as unknown as CompareData;

export const STATION_C_CHALLENGES: StationCChallenge[] = [
  {
    id: challengeId('schema-enforcement'),
    conceptId: challengeId('schema-enforcement'),
    title: 'A batch arrives with a new column',
    scenario:
      'The defects table has batches 1 and 2. From batch 3 the source system adds an inspector_id column. '
      + 'Schema enforcement is on, which is the default.',
    prompt: 'What happens when batch 3 is appended to bronze.defects?',
    options: [
      { id: 'written-added', text: 'The rows are written, and inspector_id is added to the table' },
      { id: 'written-dropped', text: 'The rows are written, and inspector_id is dropped' },
      { id: 'refused', text: 'The write is refused, and the table is unchanged' },
    ],
    setup: [
      { label: 'Create bronze.defects from batch 1', op: { op: 'create_table', table: 'bronze.defects' } },
      { label: 'Append batch 2', op: { op: 'append_batch', table: 'bronze.defects', batch: 2 } },
    ],
    designated: { op: 'append_batch', table: 'bronze.defects', batch: 3, write: 'append', schema_mode: 'enforce' },
    classify: (result) => {
      if (!result.ok) return 'refused';
      return columnsOf(result).includes('inspector_id') ? 'written-added' : 'written-dropped';
    },
    reveal: {
      refused: 'Schema enforcement refused the write and the table kept its version. A bad batch stops at the door instead of changing the table; the engine’s own message is above.',
      'written-added': 'The table took the new column. Schema evolution is not the default, so check whether enforcement was turned off.',
      'written-dropped': 'The rows were written and the new column was lost. Check the mode that was used.',
    },
    followUps: [
      {
        label: 'Append batch 3 with schema evolution',
        why: 'Evolution accepts the new column. Compare the version and columns with the refused run.',
        op: { op: 'append_batch', table: 'bronze.defects', batch: 3, write: 'append', schema_mode: 'merge' },
      },
    ],
  },
  {
    id: challengeId('replayed-batch'),
    conceptId: challengeId('replayed-batch'),
    title: 'A batch is delivered twice',
    scenario:
      'After a retry, the source delivers batch 2 of the defects table a second time. The table already holds batch 2, '
      + 'loaded with a plain append.',
    prompt: 'What happens when batch 2 is appended again?',
    options: [
      { id: 'unchanged', text: 'The table is unchanged: the engine recognises the repeat' },
      { id: 'duplicated', text: 'The rows are written a second time' },
      { id: 'refused', text: 'The write is refused' },
    ],
    setup: [
      { label: 'Create bronze.defects from batch 1', op: { op: 'create_table', table: 'bronze.defects' } },
      { label: 'Append batch 2', op: { op: 'append_batch', table: 'bronze.defects', batch: 2 } },
    ],
    designated: { op: 'append_batch', table: 'bronze.defects', batch: 2, write: 'append', schema_mode: 'enforce' },
    classify: (result, before) => {
      if (!result.ok) return 'refused';
      if (before?.rows != null && result.rows != null && result.rows > before.rows) return 'duplicated';
      return 'unchanged';
    },
    reveal: {
      duplicated: 'A plain append has no idea the rows were already there. The same defect ids now appear twice, and any count or sum over the table is inflated.',
      unchanged: 'The row count did not move, so this append did not duplicate anything.',
      refused: 'The engine refused this append; read its message above.',
    },
    followUps: [
      {
        label: 'Merge batch 2 on the key instead',
        why: 'A MERGE on the business key updates matching rows and inserts only new ones, so a replay changes nothing.',
        op: { op: 'append_batch', table: 'bronze.defects', batch: 2, write: 'merge', schema_mode: 'enforce' },
      },
    ],
  },
  {
    id: challengeId('vacuum-retention'),
    conceptId: challengeId('vacuum-retention'),
    title: 'Vacuum with no retention',
    scenario:
      'The defects table has two versions, so it holds files that only an older version uses. '
      + 'Someone runs VACUUM with a retention of 0 hours to reclaim the space, with the safety check left on.',
    prompt: 'What does the engine do?',
    options: [
      { id: 'deleted', text: 'It deletes the old files straight away' },
      { id: 'refused', text: 'It refuses, because 0 hours is shorter than its safety check allows' },
      { id: 'nothing', text: 'Nothing: there are no old files to remove' },
    ],
    setup: [
      { label: 'Create bronze.defects from batch 1', op: { op: 'create_table', table: 'bronze.defects' } },
      { label: 'Append batch 2', op: { op: 'append_batch', table: 'bronze.defects', batch: 2 } },
    ],
    designated: { op: 'vacuum', table: 'bronze.defects', retention_hours: 0, dry_run: false, enforce_retention: true },
    classify: (result) => {
      if (!result.ok) return 'refused';
      return filesRemoved(result) > 0 ? 'deleted' : 'nothing';
    },
    reveal: {
      refused: 'The retention check is there so a vacuum cannot remove files that a reader or a time-travel query may still need.',
      deleted: 'The files are gone. Versions that depended on them can no longer be read, so check what the retention check was set to.',
      nothing: 'No file was removed by this run.',
    },
    followUps: [
      {
        label: 'Dry run with the check off',
        why: 'A dry run lists what would be deleted without deleting it. Nothing is removed.',
        op: { op: 'vacuum', table: 'bronze.defects', retention_hours: 0, dry_run: true, enforce_retention: false },
      },
      {
        label: 'Vacuum for real with the check off',
        why: 'Then try reading version 0. This is the destructive step, and the result says the check was off.',
        op: { op: 'vacuum', table: 'bronze.defects', retention_hours: 0, dry_run: false, enforce_retention: false },
      },
      {
        label: 'Read version 0',
        why: 'Time travel needs the old files. Run it after the real vacuum to see whether version 0 can still be read.',
        op: { op: 'read_version', table: 'bronze.defects', version: 0 },
      },
    ],
  },
  {
    id: challengeId('reconciliation'),
    conceptId: challengeId('reconciliation'),
    title: 'Does the migrated table match the legacy one?',
    scenario:
      'The legacy yield data and its migrated copy are both loaded, with the same number of rows. '
      + 'The two are compared on the business key with a tolerance of 0.0001.',
    prompt: 'What does the comparison find?',
    options: [
      { id: 'match', text: 'The tables match on every check' },
      { id: 'counts', text: 'The row counts differ' },
      { id: 'rows', text: 'The row counts match, but individual rows differ' },
    ],
    setup: [
      { label: 'Create legacy.defects', op: { op: 'create_table', table: 'legacy.defects' } },
      { label: 'Create silver.defects', op: { op: 'create_table', table: 'silver.defects' } },
    ],
    designated: { op: 'compare_tables', left: 'legacy.defects', right: 'silver.defects', tolerance: 0.0001 },
    classify: (result) => {
      const data = asCompare(result);
      if (!result.ok) return 'counts';
      if (data.values_match) return 'match';
      return data.row_counts_match ? 'rows' : 'counts';
    },
    reveal: {
      match: 'Every column agreed, row by row, within the tolerance.',
      counts: 'The tables do not even hold the same number of rows.',
      rows: 'Matching row counts did not mean matching data. The table below says which columns differ, and which of those show up only when rows are compared by key.',
    },
    followUps: [],
  },
];

export const challengeById = (id: string) => STATION_C_CHALLENGES.find((c) => c.id === id);

/** The page's record of each table, kept up to date from the engine's own results. */
export function applyResult(states: TableStates, result: LabOperationResult): TableStates {
  const table = result.table;
  if (!table || result.version == null) return states;
  const prev = states[table];
  return { ...states, [table]: { version: result.version, rows: result.rows ?? prev?.rows ?? null } };
}

/**
 * A template as a request: the pack, and the attempt once its prediction is committed --
 * named with its preparation, since only that preparation's prediction counts.
 */
export function buildOperation(
  packId: string, template: OpTemplate, attemptUid?: string, subjectId?: number,
): LabOperation {
  const attempt = attemptUid
    ? { attempt_uid: attemptUid, ...(subjectId !== undefined ? { subject_id: subjectId } : {}) }
    : {};
  return { ...template, pack_id: packId, ...attempt } as LabOperation;
}

/** Whether `a` is the same request as `b`, ignoring the pack and the attempt. */
export function isSameOperation(a: OpTemplate, b: OpTemplate): boolean {
  const canon = (op: object) => JSON.stringify(
    Object.entries(op).filter(([, v]) => v !== undefined).sort(([x], [y]) => x.localeCompare(y)),
  );
  return canon(a) === canon(b);
}

// ---- the downstream challenge: Station A's batch, written for real ------------------------------

/** 32-bit FNV-1a as hex: short and stable, to tell one upstream's attempt from another's. */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export const DOWNSTREAM_SLUG = 'downstream-batch';
export const DOWNSTREAM_PARAM = DOWNSTREAM_SLUG;

/** The upstream, in a sentence a person reads. It is about the settings, never the outcome. */
export function describeUpstream(l: AdfLevers): string {
  const parts = [
    l.trigger === 'schedule' ? `a scheduled ${l.load} load` : l.trigger === 'tumbling' ? 'a tumbling-window trigger' : 'an event trigger, one run per file',
    l.trigger === 'tumbling' ? null
      : `the watermark updated ${l.watermark === 'before' ? 'before the copy' : l.watermark === 'success' ? 'when the copy succeeds' : 'when the copy completes'}`,
    l.sink === 'upsert' ? 'an upsert on the key' : 'an append',
    l.failureAtPercent === null ? 'no failure' : `a failure ${l.failureAtPercent}% of the way through, ${l.retries === 0 ? 'not retried' : `retried up to ${l.retries} time${l.retries === 1 ? '' : 's'}`}`,
    l.lateFile ? 'one file arriving late' : null,
    l.outOfOrder ? 'two files out of order' : null,
  ];
  return parts.filter(Boolean).join(', ');
}

export type DownstreamOutcome = 'clean' | 'missing' | 'duplicated' | 'both';

/** Station C's fifth challenge: write what Station A produced, and let the real engine measure it. */
export function downstreamChallenge(manifest: BatchManifest, levers: AdfLevers, isDefault: boolean): StationCChallenge {
  const id = isDefault ? challengeId(DOWNSTREAM_SLUG) : challengeId(`${DOWNSTREAM_SLUG}-${fnv1a(leversKey(levers))}`);
  const batch = manifest.batch;
  return {
    id,
    conceptId: id,
    title: 'Load Station A’s batch',
    scenario:
      `Station A ran with ${describeUpstream(levers)}. Its manifest is written to bronze.defects, which already holds batch 1, `
      + `and the table is then compared with the legacy copy through batch ${batch}.`
      + (isDefault ? ' (Station A hasn’t been run, so this is its default upstream.)' : ''),
    prompt: 'What does the real comparison find?',
    options: [
      { id: 'clean', text: 'The table has every row, once' },
      { id: 'missing', text: 'Rows are missing from the table' },
      { id: 'duplicated', text: 'Some rows are in the table twice' },
      { id: 'both', text: 'Rows are missing and some are repeated' },
    ],
    setup: [
      { label: 'Create legacy.defects', op: { op: 'create_table', table: 'legacy.defects' } },
      { label: 'Create bronze.defects from batch 1', op: { op: 'create_table', table: 'bronze.defects' } },
      {
        label: `Write Station A’s manifest (${manifest.landing.length.toLocaleString('en-GB')} rows, ${manifest.write === 'merge' ? 'merged on the key' : 'appended'})`,
        op: { op: 'append_batch', table: 'bronze.defects', batch, write: manifest.write, schema_mode: 'enforce', manifest: manifest.landing },
      },
    ],
    designated: { op: 'compare_tables', left: 'legacy.defects', right: 'bronze.defects', tolerance: 0.0001, through_batch: batch },
    classify: (result) => {
      const data = asCompare(result);
      const missing = data.only_in_left > 0;
      const repeated = (data.duplicate_keys?.right ?? 0) > 0;
      if (missing && repeated) return 'both';
      if (missing) return 'missing';
      if (repeated) return 'duplicated';
      return 'clean';
    },
    reveal: {
      clean: 'Every row of the window is in the table once.',
      missing: 'The rows Station A’s choices lost never reached the table. The engine counted them: nothing in the destination can bring them back.',
      duplicated: 'A repeated copy was written twice. The same ids are in the table two times, and every count and sum over it is inflated.',
      both: 'Some rows never arrived, and others arrived more than once.',
    },
    followUps: [],
    crossCheck: (result) => {
      if (!result.ok) return null;
      const data = asCompare(result);
      const foundMissing = data.only_in_left;
      const foundRepeated = data.duplicate_keys?.right ?? 0;
      const agrees = foundMissing === manifest.missed.length && foundRepeated === manifest.duplicateWrites;
      return `Station A’s model expected ${manifest.missed.length.toLocaleString('en-GB')} rows missed`
        + `${manifest.missed.length ? ` (ids ${ranges(manifest.missed)})` : ''} and ${manifest.duplicateWrites.toLocaleString('en-GB')} repeated. `
        + `The engine found ${foundMissing.toLocaleString('en-GB')} and ${foundRepeated.toLocaleString('en-GB')}. ${agrees ? 'They agree.' : 'They differ: the model and the table disagree, which is worth looking into.'}`
        + ' (Any value differences listed above are the legacy job’s, planted in the pack. They are not from Station A.)';
    },
  };
}
