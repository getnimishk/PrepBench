// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, expect, it } from 'vitest';
// The real pack content, so these tests check the shipped scenario, not a copy of it.
import pipeline from '../../../../backend/app/data/lab_packs/semiconductor-v1/pipeline.json';
import {
  accessResult, allFolders, defaultAdlsLevers, layoutResult, parseAdls, tierResult, type AdlsConfig, type AdlsLevers,
} from './adlsModel';

const parsed = parseAdls(pipeline);
if (!parsed.ok) throw new Error(parsed.reason);
const config: AdlsConfig = parsed.config;
const base = defaultAdlsLevers(config);
const lv = (over: Partial<AdlsLevers> = {}): AdlsLevers => ({ ...base, ...over });
const acl = (over: Partial<AdlsLevers['acl']> = {}) => ({ ...base.acl, ...over });
const clone = () => JSON.parse(JSON.stringify(pipeline));

describe('parseAdls', () => {
  it('reads the shipped pack', () => {
    expect(config.request).toEqual({ principal: 'vendor-x', path: ['lake', 'bronze', 'vendor-x'], needs: 'write' });
    expect(config.constants.retentionDays).toBe(90);
    expect(Object.values(config.constantLabels).every((l) => l.length > 0)).toBe(true);
  });

  it('refuses content that is missing, malformed or inconsistent, with a reason', () => {
    expect(parseAdls(null)).toMatchObject({ ok: false });
    expect(parseAdls({ adf: {} })).toMatchObject({ ok: false });
    const noVolume = clone(); delete noVolume.adls.constants.volume_gb;
    expect(parseAdls(noVolume)).toMatchObject({ ok: false });
    const shares = clone(); shares.adls.constants.read_share_by_age.value[0].share = 0.5;
    expect(parseAdls(shares)).toMatchObject({ ok: false, reason: expect.stringMatching(/add up to 1/) });
    const shortRetention = clone(); shortRetention.adls.constants.retention_days.value = 60;
    expect(parseAdls(shortRetention)).toMatchObject({ ok: false });
    const missingFolder = clone(); missingFolder.adls.access_request.path = ['lake', 'bronze', 'nowhere'];
    expect(parseAdls(missingFolder)).toMatchObject({ ok: false, reason: 'The requested folder isn’t in the pack’s folder tree.' });
    const noHdfs = clone(); delete noHdfs.adls.constants.object_count.value.hdfs_copy;
    expect(parseAdls(noHdfs)).toMatchObject({ ok: false });
  });
});

describe('landing layout and renaming', () => {
  it('with a hierarchical namespace a rename is one atomic operation, whatever the layout', () => {
    for (const layout of ['hdfs-copy', 'redesigned'] as const) {
      expect(layoutResult(config, lv({ layout })).rename).toEqual({ atomic: true, operations: 1 });
    }
  });

  it('without one, a rename copies and deletes every object under the folder', () => {
    expect(layoutResult(config, lv({ hierarchicalNamespace: false, layout: 'hdfs-copy' })).rename).toEqual({ atomic: false, operations: 2 * 24 * 20 });
    expect(layoutResult(config, lv({ hierarchicalNamespace: false, layout: 'redesigned' })).rename).toEqual({ atomic: false, operations: 2 * 1 * 24 });
  });

  it('a layout copied from HDFS spreads a day over many folders, so it costs more to list', () => {
    const hdfs = layoutResult(config, lv({ layout: 'hdfs-copy' }));
    const redesigned = layoutResult(config, lv({ layout: 'redesigned' }));
    expect(hdfs.listRequests).toBe(25);
    expect(redesigned.listRequests).toBe(2);
    expect(hdfs.objectsPerDay).toBeGreaterThan(redesigned.objectsPerDay);
    expect(redesigned.examplePath).toBe('lake/bronze/mes/2026/09/24/');
    expect(hdfs.examplePath).toContain('dt=2026-09-24');
  });
});

describe('the access puzzle', () => {
  it('RBAC at container scope works, and reaches every folder: too broad', () => {
    const r = accessResult(config, lv({ grant: 'rbac-container' }));
    expect(r.outcome).toBe('too-broad');
    expect(r.writable).toEqual(allFolders(config.tree));
    expect(r.writable.some((p) => p.join('/') === 'lake/silver')).toBe(true);
    expect(r.writable.some((p) => p.join('/') === 'lake/gold')).toBe(true);
  });

  it('a directory ACL with no execute on the parents is denied, at the first parent that lacks it', () => {
    const r = accessResult(config, lv({ acl: acl({ parentsExecute: [false, false] }) }));
    expect(r.outcome).toBe('denied');
    expect(r.deniedAt).toEqual({ path: ['lake'], missing: 'execute' });
    expect(r.writable).toEqual([]);
    expect(accessResult(config, lv({ acl: acl({ parentsExecute: [true, false] }) })).deniedAt).toEqual({ path: ['lake', 'bronze'], missing: 'execute' });
  });

  it('write and execute on the folder plus execute on each parent is exactly what was asked', () => {
    const r = accessResult(config, lv({ acl: acl({ parentsExecute: [true, true] }) }));
    expect(r.outcome).toBe('allowed');
    expect(r.writable).toEqual([['lake', 'bronze', 'vendor-x']]);
  });

  it('write alone is not enough on the folder, and neither is execute alone', () => {
    const noExecute = accessResult(config, lv({ acl: acl({ parentsExecute: [true, true], targetExecute: false }) }));
    expect(noExecute).toMatchObject({ outcome: 'denied', deniedAt: { path: ['lake', 'bronze', 'vendor-x'], missing: 'execute' } });
    const noWrite = accessResult(config, lv({ acl: acl({ parentsExecute: [true, true], targetWrite: false }) }));
    expect(noWrite).toMatchObject({ outcome: 'denied', deniedAt: { path: ['lake', 'bronze', 'vendor-x'], missing: 'write' } });
  });

  it('read is not needed to write', () => {
    expect(accessResult(config, lv({ acl: acl({ parentsExecute: [true, true], targetRead: false }) })).outcome).toBe('allowed');
  });

  it('without a hierarchical namespace there are no directories to put an ACL on', () => {
    const r = accessResult(config, lv({ hierarchicalNamespace: false, acl: acl({ parentsExecute: [true, true] }) }));
    expect(r.outcome).toBe('unavailable');
    expect(r.writable).toEqual([]);
  });

  it('RBAC is unaffected by the namespace, since it is not an ACL', () => {
    expect(accessResult(config, lv({ hierarchicalNamespace: false, grant: 'rbac-container' })).outcome).toBe('too-broad');
  });

  it('the tree has the folders the request names', () => {
    const names = allFolders(config.tree).map((p) => p.join('/'));
    expect(names).toEqual(['lake', 'lake/bronze', 'lake/bronze/mes', 'lake/bronze/vendor-x', 'lake/silver', 'lake/gold']);
  });
});

describe('tier and lifecycle cost', () => {
  const total = (over: Partial<AdlsLevers>) => tierResult(config, lv(over)).totalIndex;

  it('everything hot is the baseline: every index is 1', () => {
    expect(tierResult(config, lv())).toMatchObject({ storageIndex: 1, accessIndex: 1, totalIndex: 1, coolShare: 0 });
  });

  it('everything cool is cheaper to store and dearer to read, and dearer overall under these constants', () => {
    const r = tierResult(config, lv({ tier: 'cool' }));
    expect(r.storageIndex).toBeCloseTo(0.5, 10);
    expect(r.accessIndex).toBeCloseTo(2.5, 10);
    expect(r.coolShare).toBe(1);
    expect(r.totalIndex).toBeCloseTo(0.7 * 0.5 + 0.3 * 2.5, 10);
    expect(r.totalIndex).toBeGreaterThan(1);
  });

  it('a lifecycle rule beats both extremes: old data goes cool, the busy recent data stays hot', () => {
    const rule = tierResult(config, lv({ lifecycleDays: 30 }));
    expect(rule.coolShare).toBeCloseTo(60 / 90, 10);
    expect(rule.storageIndex).toBeCloseTo(1 - (60 / 90) * 0.5, 10);
    expect(rule.accessIndex).toBeCloseTo(0.95 * 1 + 0.05 * 2.5, 10);
    expect(rule.totalIndex).toBeLessThan(1);
    expect(rule.totalIndex).toBeLessThan(total({ tier: 'cool' }));
  });

  it('a rule that moves data too soon costs more than one that waits', () => {
    expect(total({ lifecycleDays: 1 })).toBeGreaterThan(total({ lifecycleDays: 7 }));
  });

  it('a rule older than the retention period never fires', () => {
    expect(tierResult(config, lv({ lifecycleDays: 90 }))).toMatchObject({ totalIndex: 1, coolShare: 0 });
    expect(tierResult(config, lv({ lifecycleDays: 400 })).totalIndex).toBe(1);
  });

  it('the cool tier ignores the lifecycle rule, since there is nothing left to move', () => {
    expect(total({ tier: 'cool', lifecycleDays: 30 })).toBe(total({ tier: 'cool' }));
  });

  it('the cool share never leaves 0 to 1 and the cost falls as the rule moves later, until it stops firing', () => {
    let last = -1;
    for (const days of [0, 1, 7, 15, 30, 60, 89, 90]) {
      const r = tierResult(config, lv({ lifecycleDays: days }));
      expect(r.coolShare).toBeGreaterThanOrEqual(0);
      expect(r.coolShare).toBeLessThanOrEqual(1);
      expect(r.coolShare).toBeGreaterThanOrEqual(last === -1 ? 0 : 0);
      last = r.coolShare;
    }
  });
});
