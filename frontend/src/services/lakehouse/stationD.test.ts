// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, expect, it } from 'vitest';
import type { LabOperation, LabOperationResult } from '../../types/lakehouse';
import { labAttemptUid } from './attempts';
import {
  checkClaim, defectChallenge, defectTitle, parseDefects, scoreDefects, STATION_D_PREFIX, type Cited, type DefectTruth,
} from './stationD';

// The shape of the semiconductor pack's `defect_manifest` (the server's ground truth).
const MANIFEST: Record<string, unknown>[] = [
  { id: 'precision', kind: 'precision', table: 'defects', column: 'yield_pct', about: 'x', keys: [3, 5, 8], count: 3 },
  { id: 'tz-shift', kind: 'timezone', table: 'defects', column: 'inspected_at', about: 'x', keys: [2, 4], count: 2 },
  { id: 'null-scrap', kind: 'null_handling', table: 'defects', column: 'scrap_qty', about: 'x', keys: [9, 10], count: 2 },
  { id: 'drift', kind: 'schema_drift', table: 'defects', about: 'x', batch: 3, column: 'inspector_id', keys: [1], count: 1 },
  { id: 'cdc', kind: 'cdc', table: 'defects', about: 'x', updates: [1, 2, 3], deletes: [4], inserts: [5, 6], keys: [], count: 6 },
  { id: 'replay', kind: 'replay', table: 'defects', about: 'x', batch: 2, keys: [], count: 1000 },
  { id: 'late', kind: 'late_arrival', table: 'telemetry', about: 'x', batch: 3, from_batch: 2, keys: [], count: 120 },
  { id: 'small-files', kind: 'small_files', table: 'telemetry', about: 'x', batch: 4, files: 50, keys: [], count: 0 },
];
const D = parseDefects(MANIFEST);
const defect = (id: string): DefectTruth => D.find((d) => d.id === id)!;

const result = (op: string, data: Record<string, unknown>, ok = true): LabOperationResult => ({
  ok, op, data, journal_uid: 'j',
});
const compare = (
  data: Record<string, unknown>, over: Partial<Extract<LabOperation, { op: 'compare_tables' }>> = {},
): Cited => ({
  request: { op: 'compare_tables', pack_id: 'p', left: 'legacy.defects', right: 'bronze.defects', tolerance: 0.0001, ...over },
  result: result('compare_tables', data),
});
const mismatches = (column: string, count: number, keys: number[]) => ({
  mismatches: { [column]: { count, keys, examples: [] } }, duplicate_keys: { left: 0, right: 0 }, only_in_left: 0, only_in_right: 0,
});

describe('parseDefects', () => {
  it('reads the server ground truth, and drops anything that is not a defect', () => {
    expect(D.map((d) => d.id)).toEqual(['precision', 'tz-shift', 'null-scrap', 'drift', 'cdc', 'replay', 'late', 'small-files']);
    expect(parseDefects([{ id: 7 }, { kind: 'cdc' }, null as never, ...MANIFEST.slice(0, 1)]).map((d) => d.id)).toEqual(['precision']);
  });
});

describe('checkClaim: the three value defects are shown by the compared column', () => {
  it('counts a compare whose column mismatches only on planted keys', () => {
    expect(checkClaim(defect('precision'), compare(mismatches('yield_pct', 3, [3, 5, 8]))).supported).toBe(true);
    expect(checkClaim(defect('tz-shift'), compare(mismatches('inspected_at', 2, [2, 4]))).supported).toBe(true);
    expect(checkClaim(defect('null-scrap'), compare(mismatches('scrap_qty', 1, [9]))).supported).toBe(true);
  });

  it('does not count the wrong column, no mismatch, or keys the pack never planted', () => {
    expect(checkClaim(defect('precision'), compare(mismatches('scrap_qty', 2, [9, 10]))).supported).toBe(false);
    expect(checkClaim(defect('precision'), compare(mismatches('yield_pct', 0, []))).supported).toBe(false);
    expect(checkClaim(defect('precision'), compare(mismatches('yield_pct', 2, [3, 99]))).supported).toBe(false);
  });

  it('does not count a compare of another table, another operation, or a refused run', () => {
    expect(checkClaim(defect('precision'), compare(mismatches('yield_pct', 3, [3]), { left: 'legacy.telemetry', right: 'bronze.telemetry' })).supported).toBe(false);
    const history: Cited = { request: { op: 'history', pack_id: 'p', table: 'bronze.defects' }, result: result('history', {}) };
    expect(checkClaim(defect('precision'), history).supported).toBe(false);
    const refused = { ...compare(mismatches('yield_pct', 3, [3])), result: result('compare_tables', mismatches('yield_pct', 3, [3]), false) };
    expect(checkClaim(defect('precision'), refused).supported).toBe(false);
  });

  it('says why a result does not show the defect', () => {
    const v = checkClaim(defect('precision'), compare(mismatches('scrap_qty', 2, [9, 10])));
    expect(v.supported).toBe(false);
    expect(!v.supported && v.reason).toMatch(/yield_pct/);
  });
});

describe('checkClaim: batch patterns', () => {
  const append = (batch: number, data: Record<string, unknown>, ok = true): Cited => ({
    request: { op: 'append_batch', pack_id: 'p', table: 'bronze.defects', batch, write: 'append', schema_mode: 'enforce' },
    result: result('append_batch', data, ok),
  });

  it('schema drift: the batch own columns, from the refusal or the evolved table', () => {
    expect(checkClaim(defect('drift'), append(3, { batch: 3, batch_columns: ['defect_id', 'inspector_id'] }, false)).supported).toBe(true);
    expect(checkClaim(defect('drift'), append(3, { batch: 3, columns: ['defect_id', 'inspector_id'] })).supported).toBe(true);
    expect(checkClaim(defect('drift'), append(2, { batch: 2, batch_columns: ['defect_id'] }, false)).supported).toBe(false);
    expect(checkClaim(defect('drift'), append(3, { batch: 3, columns: ['defect_id'] })).supported).toBe(false);
  });

  it('CDC: the change batch own insert, update and delete counts', () => {
    const merge = (batch: Record<string, number>): Cited => ({
      request: { op: 'merge_cdc', pack_id: 'p', table: 'bronze.defects' }, result: result('merge_cdc', { batch }),
    });
    expect(checkClaim(defect('cdc'), merge({ I: 2, U: 3, D: 1 })).supported).toBe(true);
    expect(checkClaim(defect('cdc'), merge({ I: 2, U: 3, D: 9 })).supported).toBe(false);
  });

  it('replay: repeated keys in the table, no more than the replayed batch holds', () => {
    expect(checkClaim(defect('replay'), compare({ ...mismatches('x', 0, []), duplicate_keys: { left: 0, right: 1000 } })).supported).toBe(true);
    expect(checkClaim(defect('replay'), compare({ ...mismatches('x', 0, []), duplicate_keys: { left: 0, right: 0 } })).supported).toBe(false);
    expect(checkClaim(defect('replay'), compare({ ...mismatches('x', 0, []), duplicate_keys: { left: 0, right: 2000 } })).supported).toBe(false);
  });

  it('late arrival: rows missing from the table through the earlier batch', () => {
    const on = (through: number | undefined, only: number) => compare(
      { ...mismatches('x', 0, []), only_in_left: only },
      { left: 'legacy.telemetry', right: 'bronze.telemetry', through_batch: through },
    );
    expect(checkClaim(defect('late'), on(2, 120)).supported).toBe(true);
    expect(checkClaim(defect('late'), on(2, 0)).supported).toBe(false);
    expect(checkClaim(defect('late'), on(3, 120)).supported).toBe(false); // the batch that carries them is loaded
    expect(checkClaim(defect('late'), on(undefined, 120)).supported).toBe(false);
  });

  it('small files: the planted number of writes, or that many files found by compacting', () => {
    const land = (writes: number, small = true): Cited => ({
      request: { op: 'append_batch', pack_id: 'p', table: 'bronze.telemetry', batch: 4, write: 'append', schema_mode: 'enforce', small_files: small },
      result: result('append_batch', { batch: 4, writes }),
    });
    const compact = (before: number): Cited => ({
      request: { op: 'compact', pack_id: 'p', table: 'bronze.telemetry' }, result: result('compact', { files_before: before, files_after: 1 }),
    });
    expect(checkClaim(defect('small-files'), land(50)).supported).toBe(true);
    expect(checkClaim(defect('small-files'), land(1, false)).supported).toBe(false);
    expect(checkClaim(defect('small-files'), compact(52)).supported).toBe(true);
    expect(checkClaim(defect('small-files'), compact(3)).supported).toBe(false);
  });
});

describe('scoreDefects: found against planted in the manifest', () => {
  it('is found over the manifest count, never an estimate', () => {
    expect(scoreDefects(D, ['precision', 'cdc'])).toEqual({ found: 2, planted: 8 });
    expect(scoreDefects(D, [])).toEqual({ found: 0, planted: 8 });
  });

  it('counts a defect once, and not one the manifest never planted', () => {
    expect(scoreDefects(D, ['precision', 'precision', 'made-up'])).toEqual({ found: 1, planted: 8 });
  });

  it('follows a pack that plants fewer', () => {
    expect(scoreDefects(D.slice(0, 3), ['precision', 'cdc'])).toEqual({ found: 1, planted: 3 });
  });
});

describe('challenge ids', () => {
  it('are lakehouse.d.<defect>, with a short, distinct attempt id per defect', () => {
    expect(defectChallenge('null-scrap')).toEqual({ id: `${STATION_D_PREFIX}null-scrap`, conceptId: 'lakehouse.d.null-scrap' });
    const uids = D.map((d) => labAttemptUid({ subjectId: 2, packId: 'semiconductor-v1', packVersion: 1, challenge: defectChallenge(d.id) }));
    expect(new Set(uids).size).toBe(D.length);
    expect(uids.every((u) => u.length <= 64)).toBe(true);
  });

  it('are titled for Workspace and Evidence, and only for Station D', () => {
    expect(defectTitle('lakehouse.d.tz-shift')).toBe('Reconciliation Detective: timezone shift');
    expect(defectTitle('lakehouse.c.reconciliation')).toBeNull();
  });
});
