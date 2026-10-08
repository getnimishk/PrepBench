// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, expect, it } from 'vitest';
import pipeline from '../../../../backend/app/data/lab_packs/semiconductor-v1/pipeline.json';
import adfPack from '../../../../backend/app/content/packs/adf/v1.json';
import { DEFAULT_LEVERS, parseAdf, runPipeline, type SourceRow } from '../lakehouse/adfModel';
import {
  FAULT_TOLERANCE_COUPLINGS, WHEN_MAIN_STEP_FAILS, runBadRows, runDependency, type FailureKind, type Pattern,
} from './faultToleranceModel';
import { FAULT_TOLERANCE_BAD_ROWS, FAULT_TOLERANCE_DEPENDENCY } from './faultTolerance';
import { causesOf } from './definition';

const pack = adfPack as { chapters: { id: string; blocks: { md?: string; table?: { rows: string[][] } }[] }[] };
const chapter = (id: string) => pack.chapters.find((c) => c.id === id)!;
const PATTERNS: Pattern[] = ['none', 'try-catch', 'do-if-else', 'do-if-skip-else'];

describe('mode A, dependency failure paths', () => {
  it('reports exactly the ADF guide’s table when the main step fails', () => {
    const table = chapter('monitoring').blocks.find((b) => b.table)!.table!.rows;
    expect(table).toEqual([
      ['Try-catch: only an on-failure step after it', 'Succeeded'],
      ['Do-if-else: an on-success and an on-failure step', 'Failed'],
      ['Do-if-skip-else: plus a dummy on-skip step', 'Succeeded'],
    ]);
    expect(WHEN_MAIN_STEP_FAILS['try-catch']).toBe(table[0][1]);
    expect(WHEN_MAIN_STEP_FAILS['do-if-else']).toBe(table[1][1]);
    expect(WHEN_MAIN_STEP_FAILS['do-if-skip-else']).toBe(table[2][1]);
    for (const pattern of PATTERNS) {
      expect(runDependency({ pattern, failureKind: 'type-conversion', retries: 0 }).status).toBe(WHEN_MAIN_STEP_FAILS[pattern]);
    }
  });

  it('hides a failure exactly when the run is green over a failed step', () => {
    expect(runDependency({ pattern: 'try-catch', failureKind: 'type-conversion', retries: 3 }).outcome).toBe('hidden');
    expect(runDependency({ pattern: 'do-if-else', failureKind: 'type-conversion', retries: 0 }).outcome).toBe('visible');
    expect(runDependency({ pattern: 'none', failureKind: 'type-conversion', retries: 0 })).toMatchObject({ outcome: 'visible', handlerRan: false });
  });

  it('retries a transient failure to success, and never a type-conversion error', () => {
    for (const pattern of PATTERNS) {
      expect(runDependency({ pattern, failureKind: 'transient', retries: 1 }).outcome).toBe('recovered');
      expect(runDependency({ pattern, failureKind: 'transient', retries: 0 }).outcome).not.toBe('recovered');
      expect(runDependency({ pattern, failureKind: 'type-conversion', retries: 3 }).outcome).not.toBe('recovered');
    }
  });

  it('keeps the Lakehouse ADF model’s retry semantics: a retried transient copy completes, an unretried one does not', () => {
    const parsed = parseAdf(pipeline);
    if (!parsed.ok) throw new Error(parsed.reason);
    const index: SourceRow[] = Array.from({ length: 5000 }, (_, i) => ({
      id: i + 1, modifiedAt: new Date(Date.UTC(2026, 2, 1) + i * 518_400).toISOString(), deleted: false, batch: Math.floor(i / 1000) + 1,
    }));
    const copy = (retries: 0 | 1) => runPipeline(parsed.config, index, {
      ...DEFAULT_LEVERS, load: 'incremental', trigger: 'schedule', watermark: 'success', sink: 'upsert', failureAtPercent: 40, retries,
    });
    // Both models: one retry rescues a transient failure; none leaves it failed.
    expect(copy(1).findings.some((f) => /retried and succeeds/.test(f.text))).toBe(true);
    expect(runDependency({ pattern: 'none', failureKind: 'transient', retries: 1 }).mainStep).toBe('succeeded-after-retry');
    expect(copy(0).findings.some((f) => /retried and succeeds/.test(f.text))).toBe(false);
    expect(runDependency({ pattern: 'none', failureKind: 'transient', retries: 0 }).mainStep).toBe('failed');
  });

  it('refuses a retry count the model does not take', () => {
    expect(() => runDependency({ pattern: 'none', failureKind: 'transient', retries: 4 as 3 })).toThrow(RangeError);
  });

  it('never simulates a timeout: no lever, no outcome, only a stated fact', () => {
    const keys = FAULT_TOLERANCE_DEPENDENCY.levers.map((l) => l.key);
    expect(keys).toEqual(['pattern', 'failureKind', 'retries']);
    const kinds = FAULT_TOLERANCE_DEPENDENCY.levers.find((l) => l.key === 'failureKind')!.options.map((o) => o.value as FailureKind);
    expect(kinds).not.toContain('timeout');
    expect(FAULT_TOLERANCE_COUPLINGS.find((c) => c.id === 'timeout-not-modelled')!.uiLabel).toMatch(/Not modelled here/);
  });

  it('asks questions the model answers: one right cause, one right pattern', () => {
    const preset = FAULT_TOLERANCE_DEPENDENCY.run(null, FAULT_TOLERANCE_DEPENDENCY.preset);
    expect(preset.outcome).toBe('hidden');
    const causes = causesOf(preset);
    expect(FAULT_TOLERANCE_DEPENDENCY.reason.options.filter((o) => causes.includes(o.id)).map((o) => o.id)).toEqual(['leaves-decide']);
    const runs = FAULT_TOLERANCE_DEPENDENCY.apply.options.map((o) => FAULT_TOLERANCE_DEPENDENCY.run(null, o.levers));
    expect(FAULT_TOLERANCE_DEPENDENCY.apply.options.filter((_, i) => FAULT_TOLERANCE_DEPENDENCY.apply.correct(runs[i], runs)).map((o) => o.id)).toEqual(['do-if-else']);
  });
});

describe('mode B, bad-row handling', () => {
  it('stops by default, and says how far it got is not modelled', () => {
    expect(runBadRows({ handling: 'fail', verification: true })).toMatchObject({ status: 'Failed', rowsCopied: null, outcome: 'stops', verification: 'not-reached' });
  });

  it('skips without a record unless the session log is on', () => {
    expect(runBadRows({ handling: 'skip', verification: false })).toMatchObject({ status: 'Succeeded', record: 'count', outcome: 'silent' });
    expect(runBadRows({ handling: 'skip-log', verification: false })).toMatchObject({ record: 'session-log', outcome: 'logged' });
  });

  it('passes verification with skipped rows: it checks counts, not values', () => {
    const r = runBadRows({ handling: 'skip', verification: true });
    expect(r.verification).toBe('passes');
    expect(r.rowsCopied! + r.rowsSkipped).toBe(20_000);
  });

  it('warns that the session log holds the rows’ actual values', () => {
    expect(runBadRows({ handling: 'skip-log', verification: false }).findings.map((f) => f.ledgerId)).toContain('sensitive-log');
  });

  it('asks questions the model answers: one right cause, one right setting', () => {
    const preset = FAULT_TOLERANCE_BAD_ROWS.run(null, FAULT_TOLERANCE_BAD_ROWS.preset);
    expect(preset.outcome).toBe('silent');
    const causes = causesOf(preset);
    expect(FAULT_TOLERANCE_BAD_ROWS.reason.options.filter((o) => causes.includes(o.id)).map((o) => o.id)).toEqual(['skip-without-log']);
    const runs = FAULT_TOLERANCE_BAD_ROWS.apply.options.map((o) => FAULT_TOLERANCE_BAD_ROWS.run(null, o.levers));
    expect(FAULT_TOLERANCE_BAD_ROWS.apply.options.filter((_, i) => FAULT_TOLERANCE_BAD_ROWS.apply.correct(runs[i], runs)).map((o) => o.id)).toEqual(['skip-log']);
  });
});

describe('the ledger and the guide', () => {
  it('reports only effects on its ledger, across every lever value of both modes', () => {
    const ledger = new Set(FAULT_TOLERANCE_COUPLINGS.map((c) => c.id));
    for (const pattern of PATTERNS) for (const failureKind of ['transient', 'type-conversion'] as const) for (const retries of [0, 1, 2, 3] as const) {
      for (const f of runDependency({ pattern, failureKind, retries }).findings) expect(ledger.has(f.ledgerId), f.ledgerId).toBe(true);
    }
    for (const handling of ['fail', 'skip', 'skip-log'] as const) for (const verification of [true, false]) {
      for (const f of runBadRows({ handling, verification }).findings) expect(ledger.has(f.ledgerId), f.ledgerId).toBe(true);
    }
  });

  it('grounds every stated fact, and both modes’ retrieval answers, in the pack', () => {
    const text = JSON.stringify(adfPack);
    for (const phrase of [
      'Every activity has four exits', 'it succeeds only if every one of them succeeded', 'failed pipeline runs greater than 0',
      'will never succeed on retry', 'Retry defaults to 0.', 'Timeout defaults to 12 hours', 'the copy stops and fails',
      'Skipping and logging are two separate settings.', 'with their actual values', 'For tables it only checks the row count',
    ]) expect(text, phrase).toContain(phrase);
    for (const def of [FAULT_TOLERANCE_DEPENDENCY, FAULT_TOLERANCE_BAD_ROWS]) {
      expect(chapter(def.retrieve.source.chapter).blocks.some((b) => (b.md ?? '').includes(def.retrieve.source.quote))).toBe(true);
    }
  });

  it('is one experiment: two tracks of fault-tolerance, sharing one model and one concept', () => {
    expect(FAULT_TOLERANCE_DEPENDENCY.track).toBe('fault-tolerance.dependency');
    expect(FAULT_TOLERANCE_BAD_ROWS.track).toBe('fault-tolerance.bad-rows');
    expect(FAULT_TOLERANCE_DEPENDENCY.model).toBe(FAULT_TOLERANCE_BAD_ROWS.model);
  });
});
