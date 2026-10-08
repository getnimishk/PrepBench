// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, expect, it } from 'vitest';
import adfPack from '../../../../backend/app/content/packs/adf/v1.json';
import { BATCH_COUNT, CONCURRENCY_COUPLINGS, PARALLEL_COPIES, SCENARIO, runConcurrency, type ConcurrencyLevers } from './concurrencyModel';
import { CONCURRENCY, PRESET } from './concurrency';
import { causesOf } from './definition';

const run = (over: Partial<ConcurrencyLevers> = {}) => runConcurrency({ ...PRESET, ...over });
const packText = JSON.stringify(adfPack);

describe('the concurrency model', () => {
  it('is deterministic', () => {
    expect(run()).toEqual(run());
  });

  it('multiplies runs, loop width and parallel copies into the planning upper bound', () => {
    expect(run().peakConnections).toBe(SCENARIO.runs * 20 * 2);
    expect(run({ batchCount: 5, parallelCopies: 1 }).peakConnections).toBe(20);
    expect(run({ concurrencyLimit: 1 }).peakConnections).toBe(40);
  });

  it('never asks for more copies at once than a run has tables', () => {
    expect(runConcurrency({ ...PRESET, batchCount: 50 }, { ...SCENARIO, tables: 10 }).copiesAtOnce).toBe(SCENARIO.runs * 10);
  });

  it('classifies against the limit and the planning target', () => {
    expect(run({ batchCount: 5, parallelCopies: 1 }).status).toBe('within'); // 20 <= 28
    expect(run({ concurrencyLimit: 1 }).status).toBe('no-headroom'); // 40: at the limit, over 28
    expect(run().status).toBe('over-cap'); // 160 > 40
  });

  it('fails only when over the limit, and more as demand grows', () => {
    expect(run({ concurrencyLimit: 1 }).failedCopies).toBe(0);
    const over = run().failedCopies;
    expect(over).toBeGreaterThan(0);
    expect(run({ batchCount: 50 }).failedCopies).toBeGreaterThan(over);
    expect(run().failedCopies).toBeLessThanOrEqual(run().totalCopies);
  });

  it('queues runs past a concurrency limit, and takes longer for it', () => {
    const limited = run({ concurrencyLimit: 2, batchCount: 5, parallelCopies: 1 });
    expect(limited.queuedRuns).toBe(2);
    expect(limited.minutes).toBeGreaterThan(run({ batchCount: 5, parallelCopies: 1 }).minutes);
  });

  it('refuses settings outside the ranges the ADF guide states', () => {
    expect(() => run({ batchCount: 0 })).toThrow(RangeError);
    expect(() => run({ batchCount: 51 })).toThrow(RangeError);
    expect(() => run({ batchCount: 2.5 })).toThrow(RangeError);
    expect(() => run({ parallelCopies: 33 })).toThrow(RangeError);
    expect(() => run({ concurrencyLimit: 0 })).toThrow(RangeError);
    expect(BATCH_COUNT).toEqual({ min: 1, max: 50, default: 20 });
    expect(PARALLEL_COPIES).toEqual({ min: 1, max: 32 });
  });

  it('grounds every stated ADF fact in the pack', () => {
    expect(packText).toContain('Batch count: 1 to 50 concurrent iterations; sequential if checked; default 20');
    expect(packText).toContain('no maximum concurrency by default');
    expect(packText).toContain('(1 to 32)');
    expect(packText).toContain('Retry defaults to 0.');
    expect(packText).toContain('Connection pool exhausted');
  });

  it('reports only effects on its ledger, and every assumption on the ledger is used or bounds a lever', () => {
    const ledger = new Set(CONCURRENCY_COUPLINGS.map((c) => c.id));
    const used = new Set<string>();
    for (const concurrencyLimit of [null, 1, 2, 4]) for (const batchCount of [5, 10, 20, 50])
      for (const parallelCopies of [1, 2, 4, 8]) for (const poolCap of [30, 40, 60]) {
        for (const f of runConcurrency({ concurrencyLimit, batchCount, parallelCopies, poolCap }).findings) {
          expect(ledger.has(f.ledgerId), f.ledgerId).toBe(true);
          used.add(f.ledgerId);
        }
      }
    for (const id of ledger) expect(used.has(id) || ['batch-count', 'parallel-copies'].includes(id), id).toBe(true);
  });

  it('is labelled a planning upper bound and makes no universal DIU claim', () => {
    expect(CONCURRENCY_COUPLINGS.find((c) => c.id === 'demand-product')!.uiLabel).toMatch(/upper bound/);
    expect(JSON.stringify(CONCURRENCY_COUPLINGS)).not.toMatch(/DIU|256/);
  });
});

describe('the questions it asks, answered by the model', () => {
  it('predicts failures: 160 connections at peak against 40', () => {
    expect(CONCURRENCY.run(null, CONCURRENCY.preset).outcome).toBe('over-cap');
  });

  it('has exactly one right cause among its options, the model’s finding', () => {
    const causes = causesOf(CONCURRENCY.run(null, CONCURRENCY.preset));
    expect(causes).toContain('demand-product');
    expect(CONCURRENCY.reason.options.filter((o) => causes.includes(o.id)).map((o) => o.id)).toEqual(['demand-product']);
  });

  it('applies to a lower limit with all runs together, with exactly one right setting', () => {
    const runs = CONCURRENCY.apply.options.map((o) => CONCURRENCY.run(null, o.levers));
    for (const o of CONCURRENCY.apply.options) expect(o.levers).toMatchObject({ poolCap: 30, concurrencyLimit: null });
    expect(CONCURRENCY.apply.options.filter((_, i) => CONCURRENCY.apply.correct(runs[i], runs)).map((o) => o.id)).toEqual(['batch5-pc1']);
  });

  it('retrieves a fact the pack states', () => {
    const chapter = (adfPack as { chapters: { id: string; blocks: { md?: string }[] }[] }).chapters.find((c) => c.id === CONCURRENCY.retrieve.source.chapter)!;
    expect(chapter.blocks.some((b) => (b.md ?? '').includes(CONCURRENCY.retrieve.source.quote))).toBe(true);
  });
});
