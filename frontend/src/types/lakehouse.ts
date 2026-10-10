// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

// Wire shapes of the Lakehouse Lab API, mirroring backend/app/schemas/lab.py.
// `apiContract.check.ts` is where the generated types are compared with these.

export type LabStation = 'a' | 'b' | 'c' | 'd' | 'f' | 'i';
export type JournalSource = 'real_engine' | 'simulation';

export interface EngineStatus {
  available: boolean;
  version?: string | null;
  install_command: string;
  detail?: string | null;
}

export interface LabPackSummary {
  id: string;
  version: number;
  title: string;
  summary: string;
  fictional: boolean;
  stations: string[];
  /** Set by hand once someone has run the exported notebook on Databricks Free Edition. */
  notebook_verified_on?: string | null;
}

export interface LabColumnSpec {
  name: string;
  type: string;
}

export interface LabTableSpec {
  key: string;
  rows: number;
  batches: number;
  columns: LabColumnSpec[];
}

export interface LabDefectSpec {
  id: string;
  kind: string;
  table: string;
  about: string;
  column?: string | null;
  batch?: number | null;
  from_batch?: number | null;
  from_batches?: number[] | null;
  files?: number | null;
}

export interface LabPackDetail extends LabPackSummary {
  scenario_md: string;
  dataset: { tables: Record<string, LabTableSpec>; defects: LabDefectSpec[] };
  factory: Record<string, unknown>;
  /** Stations A and B: the ADF settings and the ADLS teaching constants. */
  pipeline: Record<string, unknown>;
  /** Every table name an operation may use, e.g. `bronze.defects`. */
  tables: string[];
  defect_manifest: Record<string, unknown>[];
}

// ---- operations --------------------------------------------------------------------

interface OpBase {
  pack_id: string;
  attempt_uid?: string;
  /** The preparation the attempt belongs to: another preparation's attempt does not count. */
  subject_id?: number;
}

export type LabOperation =
  | (OpBase & { op: 'create_table'; table: string })
  | (OpBase & {
    op: 'append_batch'; table: string; batch: number;
    write?: 'append' | 'merge'; schema_mode?: 'enforce' | 'merge'; small_files?: boolean;
    /** Station A's batch manifest: the ids to write, in order. A repeated id lands twice on an append. */
    manifest?: number[];
  })
  | (OpBase & { op: 'merge_cdc'; table: string })
  | (OpBase & { op: 'history'; table: string })
  | (OpBase & { op: 'read_version'; table: string; version: number; sample?: number })
  | (OpBase & { op: 'restore'; table: string; version: number })
  | (OpBase & { op: 'compact'; table: string; z_order?: string[] })
  | (OpBase & {
    op: 'vacuum'; table: string; retention_hours: number; dry_run?: boolean; enforce_retention?: boolean;
  })
  | (OpBase & { op: 'compare_tables'; left: string; right: string; tolerance?: number; through_batch?: number });

export type LabOpName = LabOperation['op'];

export interface LabOperationResult {
  ok: boolean;
  op: string;
  table?: string | null;
  version?: number | null;
  rows?: number | null;
  files?: number | null;
  /** The engine's own words. Shown verbatim, never reworded. */
  error?: string | null;
  data: Record<string, unknown>;
  journal_uid: string;
}

/** One source row, as the simulations need it: no values, just who, when, deleted, and which batch. */
export interface SourceIndexRow {
  id: number;
  modified_at: string;
  deleted: boolean;
  batch?: number | null;
}

export interface LabResetResult {
  pack_id: string;
  removed: boolean;
}

// ---- compare_tables, as the server's `data` ---------------------------------------

export interface CompareAggregate {
  sum?: string | null;
  min?: string | null;
  max?: string | null;
  nulls: number;
}

export interface CompareMismatch {
  count: number;
  keys: number[];
  examples: { k: number; left_value: string | null; right_value: string | null }[];
  largest_difference?: string | null;
  difference_unit?: string | null;
}

export interface CompareData {
  row_counts: { left: number; right: number };
  row_counts_match: boolean;
  duplicate_keys: { left: number; right: number };
  only_in_left: number;
  only_in_right: number;
  aggregates: Record<string, { left: CompareAggregate; right: CompareAggregate }>;
  mismatches: Record<string, CompareMismatch>;
  columns_compared: string[];
  tolerance: number;
  values_match: boolean;
  /** Set when only batches 1..N were compared. */
  through_batch?: number | null;
}

// ---- journal -----------------------------------------------------------------------

export interface JournalEntry {
  entry_uid: string;
  pack_id: string;
  station: string;
  source: JournalSource;
  op: string;
  table_name?: string | null;
  result: Record<string, unknown>;
  attempt_uid?: string | null;
  created_at: string;
}

/** What a simulation station sends to be journaled. It is always a simulation. */
export interface JournalEntryIn {
  pack_id: string;
  station: LabStation;
  source?: 'simulation';
  op: string;
  table_name?: string | null;
  result?: Record<string, unknown>;
  attempt_uid?: string | null;
}

/** Structure checks on the acceptance criteria a learner writes (design §4.8). */
export interface AcCheck {
  check: 'gwt' | 'threshold' | 'failure' | 'owner';
  passed: boolean;
  hint: string;
}

/** AI feedback on acceptance criteria (P1-6). Advice only, no score or verdict. */
export interface CriteriaFeedbackResponse {
  status: 'feedback' | 'not_graded';
  points?: string[];
  reason?: string | null;
}
