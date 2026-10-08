// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, expect, it } from 'vitest';
import pipeline from '../../../../backend/app/data/lab_packs/semiconductor-v1/pipeline.json';
import adfPack from '../../../../backend/app/content/packs/adf/v1.json';
import { parseAdf, runPipeline, type AdfConfig, type SourceRow } from '../lakehouse/adfModel';
import { STATION_A_COUPLINGS } from '../lakehouse/pipelineCouplings';
import {
  APPLY, COUPLINGS, PREDICT, PRESET, REASON, RETRIEVE, appliesCleanly, causesOf, changesFrom, levers, observation,
  outcomeOf, run, type WatermarkLevers,
} from './watermark';

const parsed = parseAdf(pipeline);
if (!parsed.ok) throw new Error(parsed.reason);
const config: AdfConfig = parsed.config;

// The server's source-index shape for the defects table (as adfModel.test.ts builds it): 5,000
// rows, a thousand to a batch, time rising with id, ten deleted at the source.
const DELETED = new Set([40, 250, 480, 730, 910, 1015, 1330, 1580, 1777, 1990]);
const index: SourceRow[] = Array.from({ length: 5000 }, (_, i) => ({
  id: i + 1,
  modifiedAt: new Date(Date.UTC(2026, 2, 1) + i * 518_400).toISOString(),
  deleted: DELETED.has(i + 1),
  batch: Math.floor(i / 1000) + 1,
}));

describe('the experiment runs the Lakehouse ADF model, and nothing else', () => {
  it('is runPipeline with the trigger and arrival held still', () => {
    const w: WatermarkLevers = { watermark: 'success', sink: 'upsert', retries: 2, failureAtPercent: 60 };
    expect(run(config, index, w)).toEqual(runPipeline(config, index, levers(w)));
    expect(levers(w)).toMatchObject({ trigger: 'schedule', load: 'incremental', lateFile: false, outOfOrder: false });
  });

  it('gives the same answer for the same levers', () => {
    expect(run(config, index, PRESET)).toEqual(run(config, index, PRESET));
  });

  it('shows only effects that are coupling-ledger entries of the model', () => {
    const ids = new Set(STATION_A_COUPLINGS.map((c) => c.id));
    expect(COUPLINGS.length).toBeGreaterThan(0);
    for (const c of COUPLINGS) expect(ids.has(c.id)).toBe(true);
    for (const f of run(config, index, PRESET).findings) {
      expect(COUPLINGS.map((c) => c.id), `${f.ledgerId} is shown`).toContain(f.ledgerId);
    }
  });
});

describe('Predict: the scenario has one answer, and it is the model’s', () => {
  it('loses rows when the watermark moves on completion and nothing retries', () => {
    const m = run(config, index, PRESET);
    expect(outcomeOf(m)).toBe('missing');
    expect(m.missed.length).toBeGreaterThan(0);
    expect(m.duplicateWrites).toBe(0);
  });

  it('offers every outcome the model can produce, once', () => {
    expect(PREDICT.options.map((o) => o.id).sort()).toEqual(['both', 'complete', 'duplicates', 'missing']);
  });
});

describe('Manipulate and Observe: causal pairs the model must keep', () => {
  it('no failure: every row once, whatever the watermark timing', () => {
    for (const watermark of ['before', 'success', 'completion'] as const) {
      expect(outcomeOf(run(config, index, { ...PRESET, watermark, failureAtPercent: null }))).toBe('complete');
    }
  });

  it('a retry stops the loss, but an append sink then repeats the rows written before the failure', () => {
    expect(outcomeOf(run(config, index, { ...PRESET, retries: 1 }))).toBe('duplicates');
    expect(outcomeOf(run(config, index, { ...PRESET, retries: 1, sink: 'upsert' }))).toBe('complete');
  });

  it('an upsert sink cannot bring back rows the watermark skipped', () => {
    expect(outcomeOf(run(config, index, { ...PRESET, sink: 'upsert' }))).toBe('missing');
  });

  it('a watermark stored only on success makes the next run copy again: repeats on append, none on upsert', () => {
    expect(outcomeOf(run(config, index, { ...PRESET, watermark: 'success' }))).toBe('duplicates');
    expect(outcomeOf(run(config, index, { ...PRESET, watermark: 'success', sink: 'upsert' }))).toBe('complete');
  });

  it('records only what changed from the scenario, in the model’s own values', () => {
    expect(changesFrom(PRESET, PRESET)).toEqual({});
    expect(changesFrom(PRESET, { ...PRESET, retries: 1, sink: 'upsert' })).toEqual({
      sink: { from: 'append', to: 'upsert' }, retries: { from: 0, to: 1 },
    });
  });

  it('observes the scenario against the learner’s run, in the platform’s outcome shape', () => {
    const preset = run(config, index, PRESET);
    const mine = run(config, index, { ...PRESET, retries: 1, sink: 'upsert' });
    const o = observation(preset, mine);
    expect(o.missed).toMatchObject({ before: preset.missed.length, after: 0, unit: 'rows', precision: 0 });
    expect(o.repeated).toMatchObject({ before: 0, after: 0 });
    expect(o.result).toEqual({ label: 'What the destination holds', before: 'missing', after: 'complete' });
  });
});

describe('Reason: the cause is the model’s finding', () => {
  it('offers only coupling-ledger mechanisms', () => {
    const ids = new Set(STATION_A_COUPLINGS.map((c) => c.id));
    for (const o of REASON.options) expect(ids.has(o.id)).toBe(true);
  });

  it('blames the watermark timing in the scenario, and exactly one offered cause is right', () => {
    const causes = causesOf(run(config, index, PRESET));
    expect(causes).toEqual(['watermark-timing']);
    expect(REASON.options.filter((o) => causes.includes(o.id))).toHaveLength(1);
  });
});

describe('Apply: a changed constraint, graded by the model', () => {
  it('keeps the watermark fixed on completion in every option, unlike the scenario’s free choice', () => {
    for (const o of APPLY.options) expect(o.levers.watermark).toBe('completion');
  });

  it('has exactly one option that leaves every row once: retry and upsert', () => {
    const clean = APPLY.options.filter((o) => appliesCleanly(config, index, o.levers)).map((o) => o.id);
    expect(clean).toEqual(['retry-upsert']);
  });
});

describe('Retrieve: a fact the ADF pack states, not something the model computed', () => {
  it('quotes the pack, and its answer is the quoted fact', () => {
    const chapter = (adfPack as { chapters: { id: string; blocks: { md?: string }[] }[] }).chapters
      .find((c) => c.id === RETRIEVE.source.chapter);
    expect(chapter, 'the chapter exists').toBeDefined();
    expect(chapter!.blocks.some((b) => (b.md ?? '').includes(RETRIEVE.source.quote))).toBe(true);
    expect(RETRIEVE.options.map((o) => o.id)).toContain(RETRIEVE.answer);
    expect(RETRIEVE.answer).toBe('0');
  });
});
