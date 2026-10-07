// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, expect, it } from 'vitest';
import adfPack from '../../../../backend/app/content/packs/adf/v1.json';
import { COPY_PERF_COUPLINGS, runCopy, type CopyLevers } from './copyPerfModel';
import { COPY_PERF, PRESET } from './copyPerf';
import { causesOf } from './definition';

const run = (over: Partial<CopyLevers> = {}) => runCopy({ ...PRESET, ...over });

describe('the copy-performance model', () => {
  it('is deterministic', () => {
    expect(run()).toEqual(run());
  });

  it('runs at its slowest link', () => {
    expect(run({ dius: 8, sourceGbPerHour: 240 })).toMatchObject({ ratePerHour: 32, bottleneck: 'diu-capacity' });
    expect(run({ dius: 64, parallelCopies: 1, sourceGbPerHour: 240 })).toMatchObject({ ratePerHour: 40, bottleneck: 'thread-ceiling' });
    expect(run({ dius: 64, parallelCopies: 16, sourceGbPerHour: 120 })).toMatchObject({ ratePerHour: 120, bottleneck: 'source-ceiling' });
  });

  it('helps with DIUs while they are the limit, and only then', () => {
    expect(run({ dius: 8, sourceGbPerHour: 240 }).minutes).toBeGreaterThan(run({ dius: 16, sourceGbPerHour: 240 }).minutes);
    expect(run({ dius: 32 }).minutes).toBe(run({ dius: 64 }).minutes); // the source binds
  });

  it('still counts idle DIUs: a copy no faster costs more', () => {
    expect(run({ dius: 64 }).diuHours).toBeGreaterThan(run({ dius: 32 }).diuHours);
    expect(run({ dius: 64 }).findings.find((f) => f.tone === 'problem')?.text).toMatch(/sit idle and are still paid for/);
  });

  it('refuses settings outside what the ADF guide states', () => {
    expect(() => run({ dius: 0 })).toThrow(RangeError);
    expect(() => run({ dius: 257 })).toThrow(RangeError);
    expect(() => run({ parallelCopies: 33 })).toThrow(RangeError);
    expect(() => run({ sourceGbPerHour: 0 })).toThrow(RangeError);
  });

  it('reports only effects on its ledger, and claims no measurement or universal DIU range', () => {
    const ledger = new Set(COPY_PERF_COUPLINGS.map((c) => c.id));
    const used = new Set<string>();
    for (const dius of [4, 8, 16, 32, 64]) for (const parallelCopies of [1, 2, 4, 8, 16]) for (const sourceGbPerHour of [60, 120, 240]) {
      for (const f of runCopy({ dius, parallelCopies, sourceGbPerHour }).findings) {
        expect(ledger.has(f.ledgerId), f.ledgerId).toBe(true);
        used.add(f.ledgerId);
      }
    }
    for (const id of ledger) expect(used.has(id) || ['diu-availability', 'not-measured'].includes(id), id).toBe(true);
    const text = JSON.stringify(COPY_PERF_COUPLINGS);
    expect(text).not.toMatch(/2 to 256|4 to 256/);
    expect(text).toMatch(/Not a measurement/);
  });
});

describe('the questions it asks, answered by the model', () => {
  it('predicts no gain: the source already binds at the baseline', () => {
    expect(COPY_PERF.run(null, COPY_PERF.preset).outcome).toBe('same');
  });

  it('has exactly one right cause among its options, the model’s finding', () => {
    const causes = causesOf(COPY_PERF.run(null, COPY_PERF.preset));
    expect(causes).toEqual(['source-ceiling']);
    expect(COPY_PERF.reason.options.filter((o) => causes.includes(o.id))).toHaveLength(1);
  });

  it('applies to a raised source limit and a deadline, with exactly one right setting', () => {
    const runs = COPY_PERF.apply.options.map((o) => COPY_PERF.run(null, o.levers));
    for (const o of COPY_PERF.apply.options) expect(o.levers).toMatchObject({ sourceGbPerHour: 240 });
    expect(COPY_PERF.apply.options.filter((_, i) => COPY_PERF.apply.correct(runs[i], runs)).map((o) => o.id)).toEqual(['d32-pc4']);
  });

  it('retrieves a fact the pack states', () => {
    const chapter = (adfPack as { chapters: { id: string; blocks: { md?: string }[] }[] }).chapters.find((c) => c.id === COPY_PERF.retrieve.source.chapter)!;
    expect(chapter.blocks.some((b) => (b.md ?? '').includes(COPY_PERF.retrieve.source.quote))).toBe(true);
  });
});
