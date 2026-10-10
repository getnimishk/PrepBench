// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, expect, it } from 'vitest';
import {
  defaultQuestionText,
  extractTalkingPoints,
  labInterviewSourceRef,
} from './labInterviewQuestion';

describe('labInterviewSourceRef', () => {
  it('formats with lab/ prefix, pack, version, station, and challengeId under 150 chars', () => {
    const ref = labInterviewSourceRef('semiconductor-v1', 1, 'c', 'duplicate-keys');
    expect(ref).toBe('lab/semiconductor-v1@1/station/c/duplicate-keys');
    expect(ref.startsWith('lab/')).toBe(true);
    expect(ref.length).toBeLessThanOrEqual(150);
  });

  it('names the station by its letter, never its display name, so refs carry no spaces', () => {
    for (const station of ['a', 'b', 'c', 'd', 'f'] as const) {
      const ref = labInterviewSourceRef('semiconductor-v1', 1, station, 'x');
      expect(ref).toBe(`lab/semiconductor-v1@1/station/${station}/x`);
      expect(ref).not.toMatch(/\s/);
    }
  });
});

describe('extractTalkingPoints', () => {
  it('returns empty array when observed is null, undefined, or empty', () => {
    expect(extractTalkingPoints(null)).toEqual([]);
    expect(extractTalkingPoints(undefined)).toEqual([]);
    expect(extractTalkingPoints({})).toEqual([]);
  });

  it('extracts Station C result, version, rows, and status', () => {
    const points = extractTalkingPoints({
      result: 'duplicate-keys',
      ok: true,
      version: 2,
      rows: 50,
    });
    expect(points).toContain('Observed result: duplicate-keys');
    expect(points).toContain('Operation status: Succeeded');
    expect(points).toContain('Delta table version: 2');
    expect(points).toContain('Affected rows: 50');
  });

  it('extracts Station A outcome, missed, and duplicated values', () => {
    const points = extractTalkingPoints({
      outcome: 'missing',
      missed: 400,
      duplicated: 0,
      source: 'simulation',
    });
    expect(points).toContain('Observed outcome: missing');
    expect(points).toContain('Missed records: 400');
    expect(points).toContain('Duplicated records: 0');
    expect(points).toContain('Execution source: simulation');
  });

  it('extracts Station D claim, basis, and op values', () => {
    const points = extractTalkingPoints({
      claim: 'duplicate_keys',
      basis: 'Primary key conflict on batch merge',
      ok: true,
      source: 'engine',
    });
    expect(points).toContain('Defect identified: duplicate_keys');
    expect(points).toContain('Observation basis: Primary key conflict on batch merge');
    expect(points).toContain('Operation status: Succeeded');
    expect(points).toContain('Execution source: engine');
  });

  it('extracts Station F score and source', () => {
    const points = extractTalkingPoints({
      right: 12,
      total: 12,
      source: 'simulation',
    });
    expect(points).toContain('Classification score: 12 of 12 correct');
    expect(points).toContain('Execution source: simulation');
  });

  it('skips values that are not plain scalars, instead of writing [object Object]', () => {
    const points = extractTalkingPoints({ rows: 3, detail: { nested: true }, list: [1, 2] });
    expect(points).toEqual(['Affected rows: 3']);
    expect(points.join(' ')).not.toContain('[object');
  });

  it('extracts custom keys formatted factually', () => {
    const points = extractTalkingPoints({
      conflict_mode: 'isolation_level_write_serializable',
    });
    expect(points).toContain('Conflict mode: isolation_level_write_serializable');
  });
});

describe('defaultQuestionText', () => {
  it('asks about what the learner found, without claiming what Delta Lake does', () => {
    const text = defaultQuestionText('d', 'Precision loss');
    expect(text).toContain('Precision loss');
    expect(text).toContain('Station D');
    expect(text).not.toMatch(/Delta Lake handle/);
  });
});
