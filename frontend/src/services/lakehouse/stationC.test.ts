// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, expect, it } from 'vitest';
import pipelineJson from '../../../../backend/app/data/lab_packs/semiconductor-v1/pipeline.json';
import { DEFAULT_LEVERS, parseAdf, runPipeline, type AdfLevers, type SourceRow } from './adfModel';
import type { CompareData, LabOperationResult } from '../../types/lakehouse';
import {
  applyResult, buildOperation, challengeById, describeUpstream, downstreamChallenge, isNotCreated, isSameOperation, reconciliationFacts, STATION_C_CHALLENGES,
} from './stationC';

const result = (over: Partial<LabOperationResult> = {}): LabOperationResult => ({
  ok: true, op: 'x', table: 'bronze.defects', version: 1, rows: 100, data: {}, journal_uid: 'j', ...over,
});
const pick = (slug: string) => challengeById(`lakehouse.c.${slug}`)!;

describe('the challenges', () => {
  it('have unique ids under the lab prefix, and a reading for every option', () => {
    const ids = STATION_C_CHALLENGES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of STATION_C_CHALLENGES) {
      expect(c.id.startsWith('lakehouse.c.')).toBe(true);
      const optionIds = c.options.map((o) => o.id);
      expect(new Set(optionIds).size).toBe(optionIds.length);
      // Every option can be the outcome, and each has something to say about it.
      for (const id of optionIds) expect(c.reveal[id], `${c.id}/${id}`).toBeTruthy();
    }
  });

  it('classify every result as one of the challenge’s own options', () => {
    const samples: LabOperationResult[] = [
      result({ ok: false, error: 'refused' }),
      result({ data: { columns: ['defect_id', 'inspector_id'], files_removed: 3 } }),
      result({ data: { columns: ['defect_id'], files_removed: 0 } }),
    ];
    for (const c of STATION_C_CHALLENGES) {
      for (const r of samples) {
        const reading = c.classify(r, { version: 1, rows: 100 });
        expect(c.options.map((o) => o.id), `${c.id}`).toContain(reading);
      }
    }
  });

  it('do not give away the outcome in the scenario', () => {
    expect(pick('schema-enforcement').scenario).not.toMatch(/refus|reject/i);
    expect(pick('replayed-batch').scenario).not.toMatch(/duplicat/i);
  });

  it('designate one allow-listed operation each', () => {
    for (const c of STATION_C_CHALLENGES) {
      expect(['append_batch', 'vacuum', 'compare_tables']).toContain(c.designated.op);
    }
  });
});

describe('classify reads only the engine’s result', () => {
  it('schema enforcement: refused, added, or dropped', () => {
    const c = pick('schema-enforcement');
    expect(c.classify(result({ ok: false, error: 'SchemaMismatchError' }), undefined)).toBe('refused');
    expect(c.classify(result({ data: { columns: ['a', 'inspector_id'] } }), undefined)).toBe('written-added');
    expect(c.classify(result({ data: { columns: ['a'] } }), undefined)).toBe('written-dropped');
  });

  it('replay: more rows than before is a duplicate, the same count is not', () => {
    const c = pick('replayed-batch');
    expect(c.classify(result({ rows: 2000 }), { version: 1, rows: 1000 })).toBe('duplicated');
    expect(c.classify(result({ rows: 1000 }), { version: 1, rows: 1000 })).toBe('unchanged');
    // With no known "before" it cannot claim a duplicate.
    expect(c.classify(result({ rows: 2000 }), undefined)).toBe('unchanged');
    expect(c.classify(result({ ok: false }), { version: 1, rows: 1000 })).toBe('refused');
  });

  it('vacuum: refused, deleted, or nothing', () => {
    const c = pick('vacuum-retention');
    expect(c.classify(result({ ok: false }), undefined)).toBe('refused');
    expect(c.classify(result({ data: { files_removed: 2 } }), undefined)).toBe('deleted');
    expect(c.classify(result({ data: { files_removed: 0 } }), undefined)).toBe('nothing');
  });

  it('reconciliation: match, counts, or rows', () => {
    const c = pick('reconciliation');
    const data = (over: Partial<CompareData>) => result({ data: { row_counts_match: true, values_match: false, ...over } });
    expect(c.classify(data({ values_match: true }), undefined)).toBe('match');
    expect(c.classify(data({ row_counts_match: false }), undefined)).toBe('counts');
    expect(c.classify(data({}), undefined)).toBe('rows');
  });
});

describe('a table that was never created', () => {
  it('is not an outcome: it is told apart from the engine’s own refusals', () => {
    expect(isNotCreated(result({ ok: false, error: 'Table bronze.defects doesn’t exist yet. Create it first.' }))).toBe(true);
    expect(isNotCreated(result({ ok: false, error: 'Cannot cast schema, number of fields does not match: 9 vs 8' }))).toBe(false);
    expect(isNotCreated(result({ ok: true }))).toBe(false);
  });
});

describe('reconciliationFacts', () => {
  const agg = (sum: string, nulls = 0) => ({ sum, min: '0', max: '9', nulls });
  const data: CompareData = {
    row_counts: { left: 10, right: 10 }, row_counts_match: true, duplicate_keys: { left: 0, right: 0 },
    only_in_left: 0, only_in_right: 0, tolerance: 0.0001, values_match: false,
    columns_compared: ['yield_pct', 'scrap_qty', 'lot'],
    aggregates: {
      yield_pct: { left: agg('10.00'), right: agg('10.00') },
      scrap_qty: { left: agg('5', 3), right: agg('5', 0) },
      lot: { left: agg('1'), right: agg('1') },
    },
    mismatches: {
      yield_pct: { count: 300, keys: [], examples: [] },
      scrap_qty: { count: 40, keys: [], examples: [] },
      lot: { count: 0, keys: [], examples: [] },
    },
  };

  it('separates what totals show from what only a row-level join finds', () => {
    const f = reconciliationFacts(data);
    expect(f.rowLevelOnly).toEqual(['yield_pct']);
    expect(f.visibleInTotals).toEqual(['scrap_qty']);
    expect(f.mismatchedRows).toEqual({ yield_pct: 300, scrap_qty: 40 });
  });
});

describe('operations', () => {
  it('buildOperation adds the pack, and the attempt only when there is one', () => {
    const t = pick('vacuum-retention').designated;
    expect(buildOperation('p', t)).toEqual({ ...t, pack_id: 'p' });
    expect(buildOperation('p', t, 'att-12345678')).toEqual({ ...t, pack_id: 'p', attempt_uid: 'att-12345678' });
  });

  it('isSameOperation ignores key order and undefined values', () => {
    expect(isSameOperation(
      { op: 'vacuum', table: 't', retention_hours: 0, dry_run: false, enforce_retention: true },
      { enforce_retention: true, op: 'vacuum', table: 't', dry_run: false, retention_hours: 0, extra: undefined } as never,
    )).toBe(true);
    expect(isSameOperation(
      { op: 'vacuum', table: 't', retention_hours: 0 },
      { op: 'vacuum', table: 't', retention_hours: 1 },
    )).toBe(false);
  });

  it('applyResult keeps what the engine reported and ignores results with no version', () => {
    const base = { 'bronze.defects': { version: 0, rows: 5 } };
    expect(applyResult(base, result({ version: 2, rows: 9 }))['bronze.defects']).toEqual({ version: 2, rows: 9 });
    expect(applyResult(base, result({ version: 3, rows: null }))['bronze.defects']).toEqual({ version: 3, rows: 5 });
    expect(applyResult(base, result({ version: null }))).toBe(base);
  });
});

describe('the downstream challenge: Station A’s batch, written for real', () => {
  const adf = parseAdf(pipelineJson);
  if (!adf.ok) throw new Error(adf.reason);
  const index: SourceRow[] = Array.from({ length: 5000 }, (_, i) => ({
    id: i + 1, modifiedAt: new Date(Date.UTC(2026, 2, 1) + i * 518_400).toISOString(), deleted: false, batch: Math.floor(i / 1000) + 1,
  }));
  const build = (over: Partial<AdfLevers> = {}) => {
    const levers = { ...DEFAULT_LEVERS, ...over };
    const manifest = runPipeline(adf.config, index, levers);
    const isDefault = JSON.stringify(levers) === JSON.stringify(DEFAULT_LEVERS);
    return { levers, manifest, challenge: downstreamChallenge(manifest, levers, isDefault) };
  };
  const compare = (data: Record<string, unknown>) => result({ data: { row_counts_match: true, values_match: false, only_in_left: 0, duplicate_keys: { left: 0, right: 0 }, ...data } });

  it('writes exactly the manifest as a setup step, then compares through the batch it is for', () => {
    const { manifest, challenge } = build({ watermark: 'before', failureAtPercent: 60 });
    expect(challenge.setup.map((s) => s.op.op)).toEqual(['create_table', 'create_table', 'append_batch']);
    const append = challenge.setup[2].op;
    expect(append).toMatchObject({ op: 'append_batch', table: 'bronze.defects', batch: 2, write: 'append', schema_mode: 'enforce' });
    expect((append as { manifest: number[] }).manifest).toEqual(manifest.landing);
    expect(challenge.designated).toEqual({ op: 'compare_tables', left: 'legacy.defects', right: 'bronze.defects', tolerance: 0.0001, through_batch: 2 });
  });

  it('an upsert upstream is written as a merge on the key', () => {
    const { challenge } = build({ sink: 'upsert', failureAtPercent: 60 });
    expect(challenge.setup[2].op).toMatchObject({ write: 'merge' });
  });

  it('reads the real comparison: missing, repeated, both, or clean', () => {
    const { challenge } = build();
    expect(challenge.classify(compare({ only_in_left: 400 }), undefined)).toBe('missing');
    expect(challenge.classify(compare({ duplicate_keys: { left: 0, right: 600 } }), undefined)).toBe('duplicated');
    expect(challenge.classify(compare({ only_in_left: 400, duplicate_keys: { left: 0, right: 600 } }), undefined)).toBe('both');
    expect(challenge.classify(compare({}), undefined)).toBe('clean');
    for (const option of ['clean', 'missing', 'duplicated', 'both']) {
      expect(challenge.options.map((o) => o.id)).toContain(option);
      expect(challenge.reveal[option]).toBeTruthy();
    }
  });

  it('does not give the outcome away in the scenario: it names the settings, never the result', () => {
    const { challenge } = build({ watermark: 'before', failureAtPercent: 60 });
    expect(challenge.scenario).toContain('the watermark updated before the copy');
    expect(challenge.scenario).toContain('a failure 60% of the way through, not retried');
    expect(challenge.scenario).not.toMatch(/missing|lost|duplicat|400/i);
  });

  it('says the default upstream is the default, and keeps a different upstream’s attempt apart from it', () => {
    const def = build().challenge;
    const other = build({ watermark: 'before', failureAtPercent: 60 }).challenge;
    expect(def.id).toBe('lakehouse.c.downstream-batch');
    expect(def.scenario).toContain('default upstream');
    expect(other.id).not.toBe(def.id);
    expect(other.id).toMatch(/^lakehouse\.c\.downstream-batch-[0-9a-f]{8}$/);
    expect(other.scenario).not.toContain('default upstream');
    expect(build({ watermark: 'before', failureAtPercent: 60 }).challenge.id).toBe(other.id);
    expect(`lk:2:semiconductor-v1@1:${other.id.slice('lakehouse.c.'.length)}`.length).toBeLessThanOrEqual(64);
  });

  it('checks the engine’s count against the model’s, and says when they differ', () => {
    const { challenge } = build({ watermark: 'before', failureAtPercent: 60 });
    const agree = challenge.crossCheck!(compare({ only_in_left: 400, duplicate_keys: { left: 0, right: 0 } }));
    expect(agree).toContain('expected 400 rows missed (ids 1601–2000) and 0 repeated');
    expect(agree).toContain('The engine found 400 and 0. They agree.');
    expect(agree).toContain('planted in the pack');
    const differ = challenge.crossCheck!(compare({ only_in_left: 390, duplicate_keys: { left: 0, right: 0 } }));
    expect(differ).toContain('They differ');
    expect(challenge.crossCheck!(result({ ok: false }))).toBeNull();
  });

  it('describes an upstream in words', () => {
    expect(describeUpstream({ ...DEFAULT_LEVERS, trigger: 'event', failureAtPercent: 65, retries: 2, lateFile: true })).toBe(
      'an event trigger, one run per file, the watermark updated when the copy succeeds, an append, a failure 65% of the way through, retried up to 2 times, one file arriving late',
    );
    expect(describeUpstream({ ...DEFAULT_LEVERS, trigger: 'tumbling' })).toContain('a tumbling-window trigger, an append, no failure');
  });
});
