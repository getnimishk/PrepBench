// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import kafkaPack from '../../../../backend/app/content/packs/kafka/v2.json';
import { causesOf, type ExperimentDefinition, type Levers } from '../adfLab/definition';
import { ADF_LAB_IDS, parseStageUid, runFingerprint, stageChallenge, stageUid } from '../adfLab/attempts';
import { KAFKA_DEFINITIONS } from './definitions';
import { KAFKA_LAB, KAFKA_LAB_EXPERIMENTS, KAFKA_LAB_IDS, kafkaLabStatus } from './lab';
import * as LOG from './log';
import * as KEYS from './keys';
import * as GROUPS from './groups';
import * as COMMITS from './commits';
import * as REPLICATION from './replication';
import * as FAILURES from './failures';

interface Block { heading?: string; md?: string; table?: { head: string[]; rows: string[][] } }
const chapters = (kafkaPack as { chapters: { id: string; title: string; blocks: Block[] }[] }).chapters;
const plain = (s: string) => s.replace(/\*\*|`/g, '');
const chapterText = (id: string) => plain(chapters.find((c) => c.id === id)!.blocks
  .flatMap((b) => [b.md ?? '', ...(b.table ? [b.table.head.join(' '), ...b.table.rows.map((r) => r.join(' '))] : [])])
  .join('\n'));

const ALIGNED = /-\s+\*\*Topic\s+(\d+)\s+[—–-]\s+([^*]+)\*\*/g;
const alignment = new Map<string, string>();
for (const ch of chapters) {
  for (const b of ch.blocks) {
    if (b.heading !== 'Roadmap alignment' || !b.md) continue;
    for (const m of b.md.matchAll(ALIGNED)) alignment.set(`${ch.id}#${m[1]}`, m[2].trim());
  }
}

const ALL: ExperimentDefinition<unknown>[] = Object.values(KAFKA_DEFINITIONS).flat();

/** Every combination of a definition's lever values. */
function everyLevers(def: ExperimentDefinition<unknown>): Levers[] {
  return def.levers.reduce<Levers[]>((acc, lever) => acc.flatMap((l) => lever.options.map((o) => ({ ...l, [lever.key]: o.value }))), [{}]);
}

describe('the Kafka Lab registry', () => {
  it('is the six experiments of the contract, every one built, so the lab is available', () => {
    expect(KAFKA_LAB_EXPERIMENTS.map((e) => e.slug)).toEqual(['log', 'keys', 'groups', 'commits', 'replication', 'failures']);
    expect(kafkaLabStatus()).toBe('AVAILABLE');
    expect(kafkaLabStatus(KAFKA_LAB_EXPERIMENTS.map((e, i) => (i === 0 ? { ...e, ready: false } : e)))).toBe('INTEGRATION_PENDING');
  });

  it('links only chapters the Kafka pack has, under their own titles', () => {
    const titles = new Map(chapters.map((c) => [c.id, c.title]));
    for (const e of KAFKA_LAB_EXPERIMENTS) {
      for (const c of e.chapters) expect(titles.get(c.id), `${e.slug}: ${c.id}`).toBe(c.title);
    }
  });

  it('links only topics the pack aligns with one of the experiment’s own chapters, under the pack’s titles', () => {
    for (const e of KAFKA_LAB_EXPERIMENTS) {
      for (const t of e.topics) {
        const found = e.chapters.map((c) => alignment.get(`${c.id}#${t.number}`)).find(Boolean);
        expect(found, `${e.slug}: topic ${t.number}`).toBe(t.title);
      }
    }
  });

  it('has a definition for every track, the Failures experiment one per mode', () => {
    for (const e of KAFKA_LAB_EXPERIMENTS) {
      const tracks = e.tracks ? e.tracks.map((t) => `${e.slug}.${t.id}`) : [e.slug];
      expect(KAFKA_DEFINITIONS[e.slug].map((d) => d.track), e.slug).toEqual(tracks);
    }
  });
});

describe('the Kafka Lab’s attempt ids', () => {
  it('are its own, and never read as the ADF lab’s', () => {
    const key = { subjectId: 7, track: 'failures.poison', run: 2 };
    const uid = stageUid(key, 'reason', KAFKA_LAB_IDS);
    expect(uid).toBe('kb:7:failures.poison:r2:reason');
    expect(stageChallenge('log', 'predict', KAFKA_LAB_IDS)).toBe('kafka.lab.log.predict');
    expect(runFingerprint(key, 'm', KAFKA_LAB_IDS)).toBe('kafka-lab=failures.poison;run=2;model=m');
    expect(parseStageUid(uid, KAFKA_LAB_IDS)).toEqual({ ...key, stage: 'reason' });
    expect(parseStageUid(uid, ADF_LAB_IDS)).toBeNull();
    expect(parseStageUid('ab:7:watermark:r1:predict', KAFKA_LAB_IDS)).toBeNull();
  });

  it('leave the ADF lab’s exactly as they were', () => {
    const key = { subjectId: 6, track: 'fault-tolerance.bad-rows', run: 1 };
    expect(stageUid(key, 'predict')).toBe('ab:6:fault-tolerance.bad-rows:r1:predict');
    expect(stageChallenge('watermark', 'apply')).toBe('adf.lab.watermark.apply');
    expect(runFingerprint(key, 'x')).toBe('adf-lab=fault-tolerance.bad-rows;run=1;model=x');
  });
});

describe('each Kafka Lab definition', () => {
  it.each(ALL.map((d) => [d.track, d] as const))('%s: grades every answer from its own model', (_, def) => {
    const preset = def.run(null, def.preset);
    const outcomes = new Set(def.predict.options.map((o) => o.id));
    // Every lever combination runs, and its outcome is one the prediction can name.
    for (const levers of everyLevers(def)) {
      const r = def.run(null, levers);
      expect(outcomes.has(r.outcome), `${def.track} ${JSON.stringify(levers)} -> ${r.outcome}`).toBe(true);
      for (const f of r.findings) expect(def.couplings.some((c) => c.id === f.ledgerId), `${def.track}: ${f.ledgerId}`).toBe(true);
      expect(r.picture?.lanes.length, def.track).toBeGreaterThan(0);
    }
    // The preset is one of the lever combinations, and Reason has a right answer among its options.
    expect(def.levers.every((l) => l.options.some((o) => o.value === def.preset[l.key]))).toBe(true);
    expect(def.reason.options.some((o) => causesOf(preset).includes(o.id)), def.track).toBe(true);
    // Apply has at least one right and one wrong option, and none of them is the scenario itself unchanged.
    const applied = def.apply.options.map((o) => def.run(null, o.levers));
    const right = applied.map((r) => def.apply.correct(r, applied));
    expect(right.some(Boolean) && right.some((x) => !x), def.track).toBe(true);
    expect(def.retrieve.options.some((o) => o.id === def.retrieve.answer)).toBe(true);
  });

  it.each(ALL.map((d) => [d.track, d] as const))('%s: quotes its Retrieve source word for word from the guide', (_, def) => {
    expect(chapterText(def.retrieve.source.chapter)).toContain(def.retrieve.source.quote);
  });

  it.each(ALL.map((d) => [d.track, d] as const))('%s: says where each fact is from, in a chapter that exists', (_, def) => {
    for (const c of def.couplings.filter((x) => x.type === 'fact')) {
      const m = /^From the Kafka guide \(chapter (\d+)\): /.exec(c.uiLabel);
      expect(m, `${def.track}: ${c.id}`).not.toBeNull();
      expect(Number(m![1])).toBeLessThanOrEqual(chapters.length);
    }
    for (const c of def.couplings.filter((x) => x.type !== 'fact')) {
      expect(c.uiLabel, `${def.track}: ${c.id}`).toMatch(/^(Teaching convention|Model assumption|Arithmetic): /);
    }
  });
});

describe('what each scenario shows (the contract’s predict answers)', () => {
  it('matches KAFKA-LAB-CONTRACT.md', () => {
    const outcome = (def: ExperimentDefinition<unknown>) => def.run(null, def.preset).outcome;
    expect(outcome(LOG.LOG as ExperimentDefinition<unknown>)).toBe('none');
    expect(outcome(KEYS.KEYS as ExperimentDefinition<unknown>)).toBe('hot');
    expect(outcome(GROUPS.GROUPS as ExperimentDefinition<unknown>)).toBe('falls-behind');
    expect(outcome(COMMITS.COMMITS as ExperimentDefinition<unknown>)).toBe('lost');
    expect(outcome(REPLICATION.REPLICATION as ExperimentDefinition<unknown>)).toBe('one-copy');
    expect(outcome(FAILURES.POISON as ExperimentDefinition<unknown>)).toBe('stuck');
    expect(outcome(FAILURES.RETRIES as ExperimentDefinition<unknown>)).toBe('storm');
  });

  it('teaches the mechanisms, not the hash: order keys spread, a customer key runs hot, no key breaks order', () => {
    expect(KEYS.runKeys({ key: 'order', partitions: 6, share: 'most' }).outcome).toBe('balanced');
    expect(KEYS.runKeys({ key: 'order', partitions: 12, share: 'most' }).outcome).toBe('balanced');
    expect(KEYS.runKeys({ key: 'customer', partitions: 12, share: 'third' }).outcome).toBe('hot');
    expect(KEYS.runKeys({ key: 'none', partitions: 6, share: 'most' }).outcome).toBe('unordered');
  });

  it('sees min.insync.replicas only with acks=all', () => {
    expect(REPLICATION.runReplication({ acks: '1', minIsr: 2, inSync: 0 }).outcome).toBe('one-copy');
    expect(REPLICATION.runReplication({ acks: 'all', minIsr: 2, inSync: 0 }).outcome).toBe('refused');
    expect(REPLICATION.runReplication({ acks: 'all', minIsr: 1, inSync: 0 }).outcome).toBe('one-copy');
    expect(REPLICATION.runReplication({ acks: 'all', minIsr: 2, inSync: 1 }).outcome).toBe('safe');
  });

  it('repeats work after a commit-after crash, harmlessly only when the effect checks first', () => {
    expect(COMMITS.runCommits({ commit: 'after', idempotent: false }).outcome).toBe('repeated');
    expect(COMMITS.runCommits({ commit: 'after', idempotent: true }).outcome).toBe('exact');
    expect(COMMITS.runCommits({ commit: 'auto-handoff', idempotent: true }).outcome).toBe('lost');
  });
});

describe('the Kafka Lab’s sources', () => {
  it('cites only sections the research notes have', () => {
    const notes = readFileSync(resolve(__dirname, '../../../../docs/research/kafka-documentation-notes.md'), 'utf8');
    const sections = new Set([...notes.matchAll(/^## (\d+)\. /gm)].map((m) => `§${m[1]}`));
    for (const sources of [LOG.SOURCES, KEYS.SOURCES, GROUPS.SOURCES, COMMITS.SOURCES, REPLICATION.SOURCES, FAILURES.SOURCES]) {
      for (const s of sources) expect(sections.has(s), s).toBe(true);
    }
  });

  it('is the lab of the Kafka pack, under its own name and path', () => {
    expect(KAFKA_LAB.packId).toBe('kafka');
    expect(KAFKA_LAB.basePath).toBe('/lab/kafka');
    expect(KAFKA_LAB.simulation).toMatch(/^Teaching simulation\./);
  });
});
