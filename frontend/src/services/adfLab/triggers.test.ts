// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, expect, it } from 'vitest';
import pipeline from '../../../../backend/app/data/lab_packs/semiconductor-v1/pipeline.json';
import adfPack from '../../../../backend/app/content/packs/adf/v1.json';
import { parseAdf, runPipeline, type SourceRow } from '../lakehouse/adfModel';
import { STATION_A_COUPLINGS } from '../lakehouse/pipelineCouplings';
import { causesOf } from './definition';
import type { PipelineContext } from './semiconductor';
import { PRESET, TRIGGERS, levers, modelRun, type TriggerLevers } from './triggers';

const parsed = parseAdf(pipeline);
if (!parsed.ok) throw new Error(parsed.reason);
// The server's source-index shape for the defects table (as adfModel.test.ts builds it).
const DELETED = new Set([40, 250, 480, 730, 910, 1015, 1330, 1580, 1777, 1990]);
const index: SourceRow[] = Array.from({ length: 5000 }, (_, i) => ({
  id: i + 1, modifiedAt: new Date(Date.UTC(2026, 2, 1) + i * 518_400).toISOString(), deleted: DELETED.has(i + 1), batch: Math.floor(i / 1000) + 1,
}));
const c: PipelineContext = { config: parsed.config, index };
const run = (t: Partial<TriggerLevers>) => modelRun(c, { ...PRESET, ...t });

describe('Trigger Behaviour runs the Lakehouse ADF model, and nothing else', () => {
  it('is runPipeline with the watermark on success and no failure held still', () => {
    const t: TriggerLevers = { trigger: 'event', lateFile: true, outOfOrder: false, sink: 'upsert' };
    expect(modelRun(c, { ...t }).findings).toEqual(runPipeline(c.config, index, levers(t)).findings);
    expect(levers(t)).toMatchObject({ load: 'incremental', watermark: 'success', retries: 0, failureAtPercent: null });
  });

  it('is deterministic', () => {
    expect(run({})).toEqual(run({}));
  });

  it('shows every effect it can apply in the ledger, and only the model’s own', () => {
    const ids = new Set(STATION_A_COUPLINGS.map((x) => x.id));
    const shown = TRIGGERS.couplings.map((x) => x.id);
    for (const id of shown) expect(ids.has(id)).toBe(true);
    for (const trigger of ['schedule', 'tumbling', 'event'] as const) {
      for (const [lateFile, outOfOrder] of [[false, false], [true, false], [false, true]] as const) {
        for (const sink of ['append', 'upsert'] as const) {
          for (const f of run({ trigger, lateFile, outOfOrder, sink }).findings) expect(shown, f.ledgerId).toContain(f.ledgerId);
        }
      }
    }
  });
});

describe('what each trigger does with a late or out-of-order file, as the model has it', () => {
  it('a clean arrival lands every row once, whatever the trigger', () => {
    for (const trigger of ['schedule', 'tumbling', 'event'] as const) {
      expect(run({ trigger, lateFile: false }).outcome).toBe('complete');
    }
  });

  it('a late file: the watermark skips it on a schedule or an event; the tumbling window re-runs and repeats on append', () => {
    expect(run({ trigger: 'schedule' }).outcome).toBe('missing');
    expect(run({ trigger: 'event' }).outcome).toBe('missing');
    expect(run({ trigger: 'tumbling' }).outcome).toBe('duplicates');
    expect(run({ trigger: 'tumbling', sink: 'upsert' }).outcome).toBe('complete');
    expect(run({ trigger: 'schedule', sink: 'upsert' }).outcome).toBe('missing'); // an upsert cannot bring back a skipped row
  });

  it('out of order: only the event trigger, a run per file against the watermark, loses rows', () => {
    expect(run({ trigger: 'event', lateFile: false, outOfOrder: true }).outcome).toBe('missing');
    expect(run({ trigger: 'schedule', lateFile: false, outOfOrder: true }).outcome).toBe('complete');
    expect(run({ trigger: 'tumbling', lateFile: false, outOfOrder: true }).outcome).toBe('complete');
  });
});

describe('the questions it asks, answered by the model', () => {
  it('predicts repeats: the tumbling window re-runs the whole window into an append sink', () => {
    expect(TRIGGERS.run(c, TRIGGERS.preset).outcome).toBe('duplicates');
  });

  it('has one right cause, the model’s finding, among ledger mechanisms only', () => {
    const causes = causesOf(TRIGGERS.run(c, TRIGGERS.preset));
    expect(causes).toEqual(['tumbling-reruns']);
    expect(TRIGGERS.reason.options.filter((o) => causes.includes(o.id))).toHaveLength(1);
    const ids = new Set(STATION_A_COUPLINGS.map((x) => x.id));
    for (const o of TRIGGERS.reason.options) expect(ids.has(o.id)).toBe(true);
  });

  it('applies to a changed feed (out of order, not late) with exactly one right set-up', () => {
    const runs = TRIGGERS.apply.options.map((o) => TRIGGERS.run(c, o.levers));
    for (const o of TRIGGERS.apply.options) expect(o.levers).toMatchObject({ lateFile: false, outOfOrder: true });
    const right = TRIGGERS.apply.options.filter((_, i) => TRIGGERS.apply.correct(runs[i], runs)).map((o) => o.id);
    expect(right).toEqual(['schedule']);
  });

  it('retrieves a fact the pack states, and claims no backfill anywhere', () => {
    const chapter = (adfPack as { chapters: { id: string; blocks: { md?: string }[] }[] }).chapters
      .find((x) => x.id === TRIGGERS.retrieve.source.chapter)!;
    expect(chapter.blocks.some((b) => (b.md ?? '').includes(TRIGGERS.retrieve.source.quote))).toBe(true);
    const copy = JSON.stringify({ ...TRIGGERS, couplings: [], loadContext: null, run: null });
    expect(copy).not.toMatch(/maxConcurrency/i);
    expect(copy.replace('so there is no backfill of earlier windows', '')).not.toMatch(/backfill/i);
  });
});
