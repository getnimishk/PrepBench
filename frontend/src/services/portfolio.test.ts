// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, expect, it } from 'vitest';
import { ADF_LAB_EXPERIMENTS } from './adfLab/experiments';
import { STATION_C_CHALLENGES } from './lakehouse/stationC';
import { ASSESSED_BY_LABEL, EVIDENCE_LEVELS, LEVEL, adfTrackTitle, shortDate, titleOf } from './portfolio';

describe('naming lab work from the registries that already name it', () => {
  it('names an ADF track by its experiment, and a fault mode by its track', () => {
    for (const e of ADF_LAB_EXPERIMENTS) expect(adfTrackTitle(e.slug)).toBe(e.title);
    expect(adfTrackTitle('fault-tolerance.bad-rows')).toBe('Fault Tolerance: Bad-row handling');
    expect(adfTrackTitle('no-such-experiment')).toBeNull();
  });

  it('names Lakehouse challenges as their stations do, and keeps the server title for anything unknown', () => {
    const c = STATION_C_CHALLENGES[0];
    expect(titleOf({ title: 'fallback', ref: { challenge_id: c.id } })).toBe(c.title);
    expect(titleOf({ title: 'fallback', ref: { challenge_id: 'lakehouse.a.watermark-order' } }))
      .toBe('The watermark moves before the copy');
    expect(titleOf({ title: 'Server title', ref: { challenge_id: 'lakehouse.z.unknown' } })).toBe('Server title');
    expect(titleOf({ title: 'fallback', ref: { challenge_id: 'lakehouse.d.null-scrap' } }))
      .toBe('Reconciliation Detective: nulls written as zero');
    // Station I's two puzzles, by their own titles, never the server's fallback.
    expect(titleOf({ title: 'fallback', ref: { challenge_id: 'lakehouse.i.identity-cutover' } })).toBe('Identity at cutover');
    expect(titleOf({ title: 'fallback', ref: { challenge_id: 'lakehouse.i.governance-redesign' } })).toBe('A Ranger policy, redesigned');
    expect(titleOf({ title: 'Server title', ref: { track: 'no-such-experiment' } })).toBe('Server title');
    expect(titleOf({ title: 'The missing lots', ref: {} })).toBe('The missing lots');
  });

  it('names a Chart Sandbox concept by its canonical name', () => {
    expect(titleOf({ title: 'Wip', ref: { concept_id: 'wip' } })).not.toBe('Wip');
  });
});

describe('levels and labels', () => {
  it('orders levels strongest first and explains each', () => {
    expect(EVIDENCE_LEVELS).toEqual(['evidenced', 'demonstrated', 'completed', 'activity']);
    for (const l of EVIDENCE_LEVELS) expect(LEVEL[l].meaning.length).toBeGreaterThan(10);
  });

  it('never presents self- or AI-assessment as verified', () => {
    expect(ASSESSED_BY_LABEL.self).toBe('Self-assessed');
    expect(ASSESSED_BY_LABEL.ai).toMatch(/not verified/);
  });

  it('formats a time it can read, and nothing for one it cannot', () => {
    expect(shortDate('2026-10-01T10:00:00')).toMatch(/2026/);
    expect(shortDate(null)).toBeNull();
    expect(shortDate('not a date')).toBeNull();
  });
});
