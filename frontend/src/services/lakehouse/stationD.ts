// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { LabOperation, LabOperationResult } from '../../types/lakehouse';
import type { LabChallengeRef } from './attempts';

// Station D, the Reconciliation Detective: the legacy and migrated totals disagree, and the
// learner finds each planted defect with real engine results.
//
// Grading is deterministic and lives here, against the pack's own ground truth (the server's
// `defect_manifest`). A claim names a defect and cites a result the learner ran; it counts only
// when that result is one the defect can produce. No AI, no estimate, and a claim with no
// supporting result is simply not counted (CLAUDE.md hard rule 2).

export const STATION_D_PREFIX = 'lakehouse.d.';

export const defectChallenge = (defectId: string): LabChallengeRef => ({
  id: `${STATION_D_PREFIX}${defectId}`, conceptId: `${STATION_D_PREFIX}${defectId}`,
});

/** What the pack plants, as the server's manifest states it. Only the fields a kind uses are set. */
export interface DefectTruth {
  id: string;
  kind: string;
  table: string;
  column?: string;
  keys: number[];
  count: number;
  batch?: number;
  fromBatch?: number;
  files?: number;
  updates?: number;
  deletes?: number;
  inserts?: number;
}

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const len = (v: unknown): number | undefined => (Array.isArray(v) ? v.length : undefined);

/** The manifest, typed. An entry without an id, a kind and a table is not a defect and is dropped. */
export function parseDefects(manifest: Record<string, unknown>[]): DefectTruth[] {
  const out: DefectTruth[] = [];
  for (const m of manifest) {
    if (!m || typeof m.id !== 'string' || typeof m.kind !== 'string' || typeof m.table !== 'string') continue;
    out.push({
      id: m.id, kind: m.kind, table: m.table,
      column: typeof m.column === 'string' ? m.column : undefined,
      keys: Array.isArray(m.keys) ? m.keys.filter((k): k is number => typeof k === 'number') : [],
      count: num(m.count) ?? 0,
      batch: num(m.batch), fromBatch: num(m.from_batch), files: num(m.files),
      updates: len(m.updates), deletes: len(m.deletes), inserts: len(m.inserts),
    });
  }
  return out;
}

/** An operation the learner ran, and the engine's answer to it. */
export interface Cited {
  request: LabOperation;
  result: LabOperationResult;
}

export type Verdict = { supported: true; basis: string } | { supported: false; reason: string };

const no = (reason: string): Verdict => ({ supported: false, reason });
const yes = (basis: string): Verdict => ({ supported: true, basis });

const baseOf = (qualified: string) => qualified.split('.').slice(1).join('.');
const record = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

/** A compare of the two copies of the defect's own table. */
function comparedTable(truth: DefectTruth, cited: Cited): Extract<LabOperation, { op: 'compare_tables' }> | null {
  const r = cited.request;
  if (r.op !== 'compare_tables' || !cited.result.ok) return null;
  return baseOf(r.left) === truth.table && baseOf(r.right) === truth.table ? r : null;
}

/**
 * Does this result show this defect? Each kind has the one reading the engine can give it:
 * a column that differs on planted rows, a batch's own columns, the change batch's counts,
 * repeated keys, rows missing from an earlier load, or the number of small files.
 */
export function checkClaim(truth: DefectTruth, cited: Cited): Verdict {
  const { request, result } = cited;
  const data = record(result.data);

  switch (truth.kind) {
    case 'precision':
    case 'timezone':
    case 'null_handling': {
      const column = truth.column ?? '';
      if (!comparedTable(truth, cited)) {
        return no(`Compare the legacy and migrated copies of ${truth.table}. This result is not that.`);
      }
      const m = record(record(data.mismatches)[column]);
      const count = num(m.count) ?? 0;
      const keys = Array.isArray(m.keys) ? m.keys : [];
      if (count === 0) return no(`${column} matches in this comparison, so it does not show this defect.`);
      if (!keys.every((k) => truth.keys.includes(k as number))) {
        return no(`${column} differs here, but on rows this defect did not touch.`);
      }
      return yes(`${column} differs on ${count} rows`);
    }
    case 'schema_drift': {
      if (request.op !== 'append_batch' || baseOf(request.table) !== truth.table) {
        return no(`Load a batch into ${truth.table}. This result is not that.`);
      }
      if (truth.batch !== undefined && request.batch < truth.batch) {
        return no(`Batch ${request.batch} comes before the change. Try a later batch.`);
      }
      const column = truth.column ?? '';
      const seen = [...list(data.batch_columns), ...list(data.columns)];
      return seen.includes(column)
        ? yes(`batch ${request.batch} carries ${column}`)
        : no(`${column} is not among this batch's columns.`);
    }
    case 'cdc': {
      if (request.op !== 'merge_cdc' || !result.ok || baseOf(request.table) !== truth.table) {
        return no('Merge the change batch. This result is not that.');
      }
      const batch = record(data.batch);
      return batch.I === truth.inserts && batch.U === truth.updates && batch.D === truth.deletes
        ? yes(`${truth.inserts} inserts, ${truth.updates} updates, ${truth.deletes} deletes`)
        : no('These counts are not the change batch the pack plants.');
    }
    case 'replay': {
      if (!comparedTable(truth, cited)) {
        return no(`Compare the legacy and migrated copies of ${truth.table}. This result is not that.`);
      }
      const dup = num(record(data.duplicate_keys).right) ?? 0;
      if (dup === 0) return no('No key repeats in the migrated table here.');
      return dup <= truth.count
        ? yes(`${dup} keys repeat`)
        : no('More keys repeat than one replayed batch holds, so something else is repeating too.');
    }
    case 'late_arrival': {
      const cmp = comparedTable(truth, cited);
      if (!cmp) return no(`Compare the legacy and migrated copies of ${truth.table}. This result is not that.`);
      const through = cmp.through_batch;
      if (through === undefined || (truth.fromBatch !== undefined && through < truth.fromBatch)
        || (truth.batch !== undefined && through >= truth.batch)) {
        return no('Compare through the batch before the late rows arrive, so they are missing.');
      }
      const missing = num(data.only_in_left) ?? 0;
      if (missing === 0) return no('Nothing is missing through that batch.');
      return missing <= truth.count ? yes(`${missing} rows missing through batch ${through}`) : no('More is missing than the late rows account for.');
    }
    case 'small_files': {
      if (baseOf('table' in request ? request.table : '') !== truth.table) {
        return no(`Use ${truth.table}. This result is not about it.`);
      }
      const files = truth.files ?? 0;
      if (request.op === 'append_batch' && request.small_files && request.batch === truth.batch && result.ok) {
        return num(data.writes) === files ? yes(`landed as ${files} writes`) : no('That load did not land as the pack plants it.');
      }
      if (request.op === 'compact' && result.ok) {
        const before = num(data.files_before) ?? 0;
        return before >= files ? yes(`${before} files before compacting`) : no('Too few files before compacting.');
      }
      return no('Load the batch as small files, or compact the table. This result is not that.');
    }
    default:
      return no('Station D has no way to check this kind of defect.');
  }
}

/** Found against planted. Planted is the manifest's own count; a defect counts once. */
export function scoreDefects(planted: DefectTruth[], foundIds: Iterable<string>): { found: number; planted: number } {
  const ids = new Set(planted.map((d) => d.id));
  const found = new Set<string>();
  for (const id of foundIds) if (ids.has(id)) found.add(id);
  return { found: found.size, planted: ids.size };
}

const NAMES: Record<string, string> = {
  precision: 'decimal precision',
  'tz-shift': 'timezone shift',
  'null-scrap': 'nulls written as zero',
  drift: 'schema drift',
  cdc: 'change data capture',
  replay: 'replayed batch',
  late: 'late-arriving data',
  'small-files': 'small files',
};

/** A defect's name, for the picker. Only a name: nothing that says where it is. */
export const defectName = (id: string): string => NAMES[id] ?? id.replace(/-/g, ' ');

/** The title Workspace and Evidence show for a Station D challenge; null for any other. */
export function defectTitle(challengeId: string): string | null {
  return challengeId.startsWith(STATION_D_PREFIX)
    ? `Reconciliation Detective: ${defectName(challengeId.slice(STATION_D_PREFIX.length))}`
    : null;
}
