// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, expect, it } from 'vitest';
// The real pack content, so these tests check the shipped scenario, not a copy of it.
import pipeline from '../../../../backend/app/data/lab_packs/semiconductor-v1/pipeline.json';
import {
  DEFAULT_LEVERS, FILES, leversKey, parseAdf, parseLevers, ranges, runPipeline,
  type AdfConfig, type AdfLevers, type BatchManifest, type SourceRow,
} from './adfModel';
import { STATION_A_COUPLINGS } from './pipelineCouplings';

const parsed = parseAdf(pipeline);
if (!parsed.ok) throw new Error(parsed.reason);
const config: AdfConfig = parsed.config;

// Same shape as the server's source index for the defects table: 5,000 rows, ids 1 to 5,000, a
// thousand to a batch, time rising with id, ten deleted at the source (in batches 1 and 2). The
// backend's tests pin the real index's shape; the engine suite measures what a manifest really does.
const DELETED = new Set([40, 250, 480, 730, 910, 1015, 1330, 1580, 1777, 1990]);
const index: SourceRow[] = Array.from({ length: 5000 }, (_, i) => ({
  id: i + 1,
  modifiedAt: new Date(Date.UTC(2026, 2, 1) + i * 518_400).toISOString(),
  deleted: DELETED.has(i + 1),
  batch: Math.floor(i / 1000) + 1,
}));
const idsIn = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
const run = (over: Partial<AdfLevers> = {}) => runPipeline(config, index, { ...DEFAULT_LEVERS, ...over });
const WINDOW = idsIn(1001, 2000);

describe('parseAdf', () => {
  it('reads the shipped pack', () => {
    expect(config).toMatchObject({ table: 'defects', windowBatch: 2, filesPerWindow: 10, lateFileIndex: 5, outOfOrderPair: [6, 7] });
    expect(config.orchestration.externalFeed.correctOwner).toBe('adf');
    expect(config.orchestration.jobDependency.correctOwner).toBe('lakeflow');
  });

  it('refuses missing or malformed content, with a reason', () => {
    expect(parseAdf(null)).toMatchObject({ ok: false });
    expect(parseAdf({})).toMatchObject({ ok: false });
    const clone = () => JSON.parse(JSON.stringify(pipeline));
    const badLate = clone(); badLate.adf.late_file_index = 10;
    expect(parseAdf(badLate)).toMatchObject({ ok: false, reason: 'The pack’s Station A settings are incomplete.' });
    const samePair = clone(); samePair.adf.out_of_order_pair = [3, 3];
    expect(parseAdf(samePair)).toMatchObject({ ok: false });
    const noOwner = clone(); delete noOwner.adf.orchestration.job_dependency;
    expect(parseAdf(noOwner)).toMatchObject({ ok: false });
    const firstBatch = clone(); firstBatch.adf.window_batch = 1;
    expect(parseAdf(firstBatch)).toMatchObject({ ok: false });
  });
});

describe('the default upstream', () => {
  it('is a clean load: every row of the window lands once, and nothing else', () => {
    const m = run();
    expect(m.expected).toEqual(WINDOW);
    expect(m.landing).toEqual(WINDOW);
    expect(m.missed).toEqual([]);
    expect(m.duplicated).toEqual([]);
    expect(m.duplicateWrites).toBe(0);
    expect(m.staleDeletes).toEqual([]);
    expect(m.write).toBe('append');
    expect(m.watermark).toEqual({ before: 1000, after: 2000 });
    expect(m.findings.map((f) => f.text)).toContain('Every row landed once.');
    expect(m.orchestrationIssues).toEqual([]);
  });

  it('is deterministic', () => {
    const levers = { ...DEFAULT_LEVERS, watermark: 'before' as const, failureAtPercent: 60, lateFile: true };
    expect(JSON.stringify(runPipeline(config, index, levers))).toBe(JSON.stringify(runPipeline(config, index, levers)));
  });
});

describe('the watermark and a failed copy (incremental, scheduled, append, no retry)', () => {
  const failing = { failureAtPercent: 60 as const };

  it('moving the watermark before the copy loses the rows after the failure', () => {
    const m = run({ ...failing, watermark: 'before' });
    expect(m.landing).toEqual(idsIn(1001, 1600));
    expect(m.missed).toEqual(idsIn(1601, 2000));
    expect(m.duplicated).toEqual([]);
    expect(m.findings.find((f) => f.ledgerId === 'watermark-timing')!.text).toMatch(/400 rows are lost \(ids 1601–2000\)/);
  });

  it('moving it on the completion exit, which runs when the copy fails, loses them too', () => {
    const m = run({ ...failing, watermark: 'completion' });
    expect(m.missed).toEqual(idsIn(1601, 2000));
    expect(m.duplicated).toEqual([]);
  });

  it('moving it only on success loses nothing, and writes the interrupted rows twice', () => {
    const m = run({ ...failing, watermark: 'success' });
    expect(m.missed).toEqual([]);
    expect(m.duplicated).toEqual(idsIn(1001, 1600));
    expect(m.duplicateWrites).toBe(600);
    expect(m.landing).toHaveLength(600 + 1000);
  });

  it('an upsert sink makes the repeat harmless, and says to write it as a merge', () => {
    const m = run({ ...failing, watermark: 'success', sink: 'upsert' });
    expect(m.duplicated).toEqual([]);
    expect(m.duplicateWrites).toBe(0);
    expect(m.write).toBe('merge');
    expect(m.landing).toHaveLength(1600); // the repeats are still in the manifest; the sink collapses them
  });

  it('an upsert does not bring back rows the watermark skipped', () => {
    expect(run({ ...failing, watermark: 'before', sink: 'upsert' }).missed).toEqual(idsIn(1601, 2000));
  });

  it('a retry recovers the copy under every timing, and repeats the rows already written', () => {
    for (const watermark of ['before', 'success', 'completion'] as const) {
      const m = run({ ...failing, watermark, retries: 1 });
      expect(m.missed, watermark).toEqual([]);
      expect(m.duplicated, watermark).toEqual(idsIn(1001, 1600));
    }
  });

  it('the failure point sets how many rows are affected', () => {
    expect(run({ failureAtPercent: 20, watermark: 'before' }).missed).toEqual(idsIn(1201, 2000));
    expect(run({ failureAtPercent: 90, watermark: 'success' }).duplicated).toEqual(idsIn(1001, 1900));
  });

  it('without a failure the timing makes no difference', () => {
    for (const watermark of ['before', 'success', 'completion'] as const) {
      expect(run({ watermark }).missed).toEqual([]);
      expect(run({ watermark }).duplicated).toEqual([]);
    }
  });
});

describe('full against incremental', () => {
  it('a full load copies the earlier batches again, and an append stores them twice', () => {
    const m = run({ load: 'full' });
    expect(m.landing).toHaveLength(2000);
    expect(m.duplicated).toEqual(idsIn(1, 1000));
    expect(m.duplicateWrites).toBe(1000);
    expect(m.missed).toEqual([]);
  });

  it('an upsert makes a full load safe to repeat', () => {
    const m = run({ load: 'full', sink: 'upsert' });
    expect(m.duplicated).toEqual([]);
    expect(m.write).toBe('merge');
  });

  it('a failed full load is repeated whole by the next full run', () => {
    const m = run({ load: 'full', failureAtPercent: 50, watermark: 'before' });
    expect(m.missed).toEqual([]);                       // the next full run copies everything
    // Half of the 2,000 rows were written before the failure, then all 2,000 again: the first
    // thousand are stored three times, the second thousand once.
    expect(m.duplicated).toEqual(idsIn(1, 1000));
    expect(m.duplicateWrites).toBe(2000);
  });
});

describe('late and out-of-order files', () => {
  const late = idsIn(1501, 1600);                       // the sixth of ten files

  it('a late file is lost to a scheduled incremental load for good', () => {
    const m = run({ lateFile: true });
    expect(m.missed).toEqual(late);
    expect(m.landing).not.toContain(1550);
    expect(m.findings.find((f) => f.ledgerId === 'late-file')!.tone).toBe('problem');
  });

  it('a full load picks it up next time, so it is pending, not lost', () => {
    const m = run({ lateFile: true, load: 'full' });
    expect(m.missed).toEqual([]);
    expect(m.pendingLate).toEqual(late);
  });

  it('a tumbling window re-runs the whole window when the late file lands, so nothing is lost and an append repeats', () => {
    const m = run({ lateFile: true, trigger: 'tumbling' });
    expect(m.missed).toEqual([]);
    expect(m.duplicated).toEqual(WINDOW.filter((id) => !late.includes(id)));
    expect(run({ lateFile: true, trigger: 'tumbling', sink: 'upsert' }).duplicated).toEqual([]);
  });

  it('an event trigger loses the late file as well, since the watermark has moved past it', () => {
    expect(run({ lateFile: true, trigger: 'event' }).missed).toEqual(late);
  });

  it('files out of order lose rows only under an event trigger', () => {
    const swapped = idsIn(1601, 1700);                  // the seventh file lands after the eighth
    expect(run({ outOfOrder: true, trigger: 'event' }).missed).toEqual(swapped);
    expect(run({ outOfOrder: true, trigger: 'schedule' }).missed).toEqual([]);
    expect(run({ outOfOrder: true, trigger: 'tumbling' }).missed).toEqual([]);
  });

  it('the files are a tenth of the window each, in id order', () => {
    const files = FILES(config, WINDOW);
    expect(files).toHaveLength(10);
    expect(files.every((f) => f.length === 100)).toBe(true);
    expect(files[5]).toEqual(late);
  });
});

describe('the trigger sets the blast radius of a failure', () => {
  it('a failure under an event trigger repeats only the rows of the file it hit', () => {
    const m = run({ trigger: 'event', failureAtPercent: 65, watermark: 'success' });
    expect(m.missed).toEqual([]);
    expect(m.duplicated).toEqual(idsIn(1601, 1650));
    expect(m.duplicateWrites).toBe(50);
  });

  it('under a schedule the same failure repeats everything written before it', () => {
    expect(run({ trigger: 'schedule', failureAtPercent: 65, watermark: 'success' }).duplicateWrites).toBe(650);
  });

  it('a tumbling window ignores the watermark lever: a failed window is re-run whole', () => {
    const a = run({ trigger: 'tumbling', failureAtPercent: 60, watermark: 'before' });
    const b = run({ trigger: 'tumbling', failureAtPercent: 60, watermark: 'success' });
    expect(a.missed).toEqual([]);
    expect(a.landing).toEqual(b.landing);
    expect(a.duplicated).toEqual(idsIn(1001, 1600));
  });
});

describe('deletes at the source', () => {
  it('a watermark can’t see them: they stay in the destination', () => {
    const m = run({ deletes: 'watermark-only' });
    expect(m.staleDeletes).toEqual([...DELETED].sort((a, b) => a - b));
    expect(m.findings.find((f) => f.ledgerId === 'delete-invisible')!.tone).toBe('problem');
  });

  it('a soft-delete flag handles them', () => {
    const m = run({ deletes: 'soft-delete-flag' });
    expect(m.staleDeletes).toEqual([]);
  });

  it('only the deleted rows the destination holds count', () => {
    const m = run({ deletes: 'watermark-only', failureAtPercent: 60, watermark: 'before' });
    expect(m.staleDeletes).not.toContain(1777);         // lost before it landed
    expect(m.staleDeletes).toContain(1015);
  });
});

describe('orchestration', () => {
  it('names a choice that doesn’t match who owns what, with the pack’s reason', () => {
    const wrong = run({ owners: { externalFeed: 'lakeflow', jobDependency: 'adf' } });
    expect(wrong.orchestrationIssues).toHaveLength(2);
    expect(wrong.orchestrationIssues[0]).toContain(config.orchestration.externalFeed.why);
    expect(wrong.findings.some((f) => f.ledgerId === 'owner-effects')).toBe(true);
    expect(run().orchestrationIssues).toEqual([]);
  });

  it('puts the watermark update where the lever says, and the job under its owner', () => {
    expect(run({ watermark: 'before' }).steps.map((s) => s.id)).toEqual(['lookup', 'update', 'copy', 'job']);
    expect(run({ watermark: 'success' }).steps.map((s) => s.id)).toEqual(['lookup', 'copy', 'job', 'update']);
    expect(run().steps.find((s) => s.id === 'job')!.owner).toBe('lakeflow');
    expect(run({ owners: { externalFeed: 'adf', jobDependency: 'adf' } }).steps.find((s) => s.id === 'job')!.owner).toBe('adf');
  });
});

describe('invariants over every combination of levers', () => {
  const all: AdfLevers[] = [];
  for (const load of ['incremental', 'full'] as const) {
    for (const watermark of ['before', 'success', 'completion'] as const) {
      for (const sink of ['append', 'upsert'] as const) {
        for (const trigger of ['schedule', 'tumbling', 'event'] as const) {
          for (const retries of [0, 1, 3] as const) {
            for (const failureAtPercent of [null, 20, 60, 95]) {
              for (const lateFile of [false, true]) {
                for (const outOfOrder of [false, true]) {
                  all.push({ ...DEFAULT_LEVERS, load, watermark, sink, trigger, retries, failureAtPercent, lateFile, outOfOrder });
                }
              }
            }
          }
        }
      }
    }
  }

  // Each combination is run once and shared by every check below: 1,152 runs, not a few thousand.
  const runs = new Map<string, BatchManifest>();
  const manifestOf = (levers: AdfLevers): BatchManifest => {
    const key = leversKey(levers);
    let m = runs.get(key);
    if (!m) { m = runPipeline(config, index, levers); runs.set(key, m); }
    return m;
  };
  const known = new Set(index.filter((r) => r.batch !== null && r.batch <= 2).map((r) => r.id));

  it('accounts for every expected row exactly once: landed, missed or pending, never none and never two', () => {
    for (const levers of all) {
      const m = manifestOf(levers);
      const landed = new Set(m.landing);
      const missed = new Set(m.missed);
      const pending = new Set(m.pendingLate);
      for (const id of m.expected) {
        const states = (landed.has(id) ? 1 : 0) + (missed.has(id) ? 1 : 0) + (pending.has(id) ? 1 : 0);
        // A late row picked up by a failed run's recovery is landed and not pending, so exactly one holds.
        if (states !== 1) expect(states, `${leversKey(levers)} id ${id}`).toBe(1);
      }
    }
  });

  it('only ever writes rows the source has, and only from batches up to the window', () => {
    for (const levers of all) {
      const m = manifestOf(levers);
      if (!m.landing.every((id) => known.has(id))) expect(m.landing.every((id) => known.has(id)), leversKey(levers)).toBe(true);
    }
  });

  it('counts repeats the way an independent tally does', () => {
    for (const levers of all) {
      const m = manifestOf(levers);
      // Batch 1 is in the table once. Then the load writes: an append adds each id it is given, an upsert keeps one.
      const writes = new Map<number, number>();
      for (const id of m.landing) writes.set(id, (writes.get(id) ?? 0) + 1);
      let extra = 0;
      for (const [id, n] of writes) {
        const before = id <= 1000 ? 1 : 0;
        extra += levers.sink === 'upsert' ? 0 : before + n - 1;
      }
      expect(m.duplicateWrites, leversKey(levers)).toBe(extra);
      expect(m.duplicated.length > 0, leversKey(levers)).toBe(extra > 0);
    }
  });

  it('never loses or repeats anything when nothing goes wrong, whatever the settings', () => {
    for (const levers of all.filter((l) => l.failureAtPercent === null && !l.lateFile && !l.outOfOrder && l.load === 'incremental')) {
      const m = manifestOf(levers);
      expect(m.missed, leversKey(levers)).toEqual([]);
      expect(m.duplicated, leversKey(levers)).toEqual([]);
    }
  });

  it('an upsert never leaves a repeat, and loses exactly what the same load with an append loses', () => {
    for (const levers of all.filter((l) => l.sink === 'upsert')) {
      expect(manifestOf(levers).duplicated, leversKey(levers)).toEqual([]);
      expect(manifestOf({ ...levers, sink: 'append' }).missed, leversKey(levers)).toEqual(manifestOf(levers).missed);
    }
  });

  it('every finding rests on an entry in the ledger', () => {
    const ids = new Set(STATION_A_COUPLINGS.map((c) => c.id));
    for (const levers of all.filter((_, i) => i % 7 === 0)) {
      for (const f of manifestOf({ ...levers, owners: { externalFeed: 'lakeflow', jobDependency: 'adf' }, deletes: 'watermark-only' }).findings) {
        expect(ids.has(f.ledgerId), `${f.ledgerId}`).toBe(true);
      }
    }
  });
});

describe('levers kept between visits', () => {
  it('round-trip, and anything unreadable becomes the default upstream rather than an error', () => {
    const levers: AdfLevers = { ...DEFAULT_LEVERS, load: 'full', watermark: 'before', retries: 2, failureAtPercent: 40, lateFile: true, owners: { externalFeed: 'lakeflow', jobDependency: 'adf' } };
    expect(parseLevers(JSON.parse(JSON.stringify(levers)))).toEqual(levers);
    expect(parseLevers(null)).toEqual(DEFAULT_LEVERS);
    expect(parseLevers('nonsense')).toEqual(DEFAULT_LEVERS);
    expect(parseLevers({ load: 'bogus', retries: 9, failureAtPercent: 400, owners: 7 })).toEqual(DEFAULT_LEVERS);
    expect(leversKey(levers)).not.toBe(leversKey(DEFAULT_LEVERS));
  });
});

describe('ranges', () => {
  it('reads ids as compact ranges', () => {
    expect(ranges([1601, 1602, 1603, 1700])).toBe('1601–1603, 1700');
    expect(ranges([5, 6])).toBe('5, 6');
    expect(ranges([9, 1, 2, 3, 3])).toBe('1–3, 9');
    expect(ranges([])).toBe('');
    expect(ranges([1, 3, 5, 7, 9, 11, 13, 15])).toBe('1, 3, 5, 7, 9, 11 and 2 more ranges');
  });
});
