// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import databricksPack from '../../../../backend/app/content/packs/databricks/v2.json';
import { causesOf, type ExperimentDefinition, type Levers } from '../adfLab/definition';
import { ADF_LAB_IDS, parseStageUid, runFingerprint, stageChallenge, stageUid } from '../adfLab/attempts';
import { KAFKA_LAB_IDS } from '../kafkaLab/lab';
import { DATABRICKS_DEFINITIONS } from './definitions';
import { DATABRICKS_LAB, DATABRICKS_LAB_EXPERIMENTS, DATABRICKS_LAB_IDS, databricksLabStatus, hasDatabricksPack } from './lab';
import * as RETENTION from './retention';
import * as AUTO_LOADER from './autoLoader';
import * as DATASETS from './datasets';
import * as JOBS from './jobs';
import * as SKEW from './skew';
import * as GOVERNANCE from './governance';

interface Block { heading?: string; md?: string; table?: { head: string[]; rows: string[][] } }
const chapters = (databricksPack as { chapters: { id: string; title: string; blocks: Block[] }[] }).chapters;
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

const ALL: ExperimentDefinition<unknown>[] = Object.values(DATABRICKS_DEFINITIONS).flat();

/** Every combination of a definition's lever values. */
function everyLevers(def: ExperimentDefinition<unknown>): Levers[] {
  return def.levers.reduce<Levers[]>((acc, lever) => acc.flatMap((l) => lever.options.map((o) => ({ ...l, [lever.key]: o.value }))), [{}]);
}

describe('the Databricks Lab registry', () => {
  it('is the six experiments of the contract, every one built, so the lab is available', () => {
    expect(DATABRICKS_LAB_EXPERIMENTS.map((e) => e.slug)).toEqual(['retention', 'auto-loader', 'datasets', 'jobs', 'skew', 'governance']);
    expect(databricksLabStatus()).toBe('AVAILABLE');
    expect(databricksLabStatus(DATABRICKS_LAB_EXPERIMENTS.map((e, i) => (i === 0 ? { ...e, ready: false } : e)))).toBe('INTEGRATION_PENDING');
  });

  it('links only chapters the Databricks pack has, under their own titles', () => {
    const titles = new Map(chapters.map((c) => [c.id, c.title]));
    for (const e of DATABRICKS_LAB_EXPERIMENTS) {
      for (const c of e.chapters) expect(titles.get(c.id), `${e.slug}: ${c.id}`).toBe(c.title);
    }
  });

  it('links only topics the pack aligns with one of the experiment’s own chapters, under the pack’s titles', () => {
    for (const e of DATABRICKS_LAB_EXPERIMENTS) {
      for (const t of e.topics) {
        const found = e.chapters.map((c) => alignment.get(`${c.id}#${t.number}`)).find(Boolean);
        expect(found, `${e.slug}: topic ${t.number}`).toBe(t.title);
      }
    }
  });

  it('has a definition for every track, the Governance experiment one per mode', () => {
    for (const e of DATABRICKS_LAB_EXPERIMENTS) {
      const tracks = e.tracks ? e.tracks.map((t) => `${e.slug}.${t.id}`) : [e.slug];
      expect(DATABRICKS_DEFINITIONS[e.slug].map((d) => d.track), e.slug).toEqual(tracks);
    }
  });

  it('is for a preparation with the Databricks pack, under its own name and path, and says it is a simulation', () => {
    expect(DATABRICKS_LAB.packId).toBe('databricks');
    expect(DATABRICKS_LAB.basePath).toBe('/lab/databricks');
    expect(DATABRICKS_LAB.simulation).toMatch(/^Teaching simulation\./);
    expect(hasDatabricksPack({ content_packs: [{ pack_id: 'databricks' }] })).toBe(true);
    expect(hasDatabricksPack({ content_packs: [{ pack_id: 'adls' }] })).toBe(false);
  });
});

describe('the Databricks Lab’s attempt ids', () => {
  it('are its own, and never read as the ADF or Kafka lab’s', () => {
    const key = { subjectId: 2, track: 'governance.drop', run: 3 };
    const uid = stageUid(key, 'apply', DATABRICKS_LAB_IDS);
    expect(uid).toBe('dbl:2:governance.drop:r3:apply');
    expect(stageChallenge('skew', 'predict', DATABRICKS_LAB_IDS)).toBe('databricks.lab.skew.predict');
    expect(runFingerprint(key, 'm', DATABRICKS_LAB_IDS)).toBe('databricks-lab=governance.drop;run=3;model=m');
    expect(parseStageUid(uid, DATABRICKS_LAB_IDS)).toEqual({ ...key, stage: 'apply' });
    expect(parseStageUid(uid, ADF_LAB_IDS)).toBeNull();
    expect(parseStageUid(uid, KAFKA_LAB_IDS)).toBeNull();
    expect(parseStageUid('kb:2:log:r1:predict', DATABRICKS_LAB_IDS)).toBeNull();
    expect(parseStageUid('ab:2:watermark:r1:predict', DATABRICKS_LAB_IDS)).toBeNull();
  });
});

describe('each Databricks Lab definition', () => {
  it.each(ALL.map((d) => [d.track, d] as const))('%s: grades every answer from its own model', (_, def) => {
    const preset = def.run(null, def.preset);
    const outcomes = new Set(def.predict.options.map((o) => o.id));
    for (const levers of everyLevers(def)) {
      const r = def.run(null, levers);
      expect(outcomes.has(r.outcome), `${def.track} ${JSON.stringify(levers)} -> ${r.outcome}`).toBe(true);
      for (const f of r.findings) expect(def.couplings.some((c) => c.id === f.ledgerId), `${def.track}: ${f.ledgerId}`).toBe(true);
      expect(r.picture?.lanes.length, def.track).toBeGreaterThan(0);
      // Deterministic: the same levers give the same run.
      expect(def.run(null, levers)).toEqual(r);
    }
    expect(def.levers.every((l) => l.options.some((o) => o.value === def.preset[l.key]))).toBe(true);
    expect(def.reason.options.some((o) => causesOf(preset).includes(o.id)), def.track).toBe(true);
    const applied = def.apply.options.map((o) => def.run(null, o.levers));
    const right = applied.map((r) => def.apply.correct(r, applied));
    expect(right.some(Boolean) && right.some((x) => !x), def.track).toBe(true);
    expect(def.retrieve.options.some((o) => o.id === def.retrieve.answer)).toBe(true);
  });

  it.each(ALL.map((d) => [d.track, d] as const))('%s: every outcome the prediction names is reachable', (_, def) => {
    const reached = new Set(everyLevers(def).map((l) => def.run(null, l).outcome));
    const named = def.predict.options.map((o) => o.id).filter((id) => reached.has(id));
    // At least two outcomes, so the prediction is a real choice.
    expect(named.length, def.track).toBeGreaterThanOrEqual(2);
  });

  it.each(ALL.map((d) => [d.track, d] as const))('%s: quotes its Retrieve source word for word from the guide', (_, def) => {
    expect(chapterText(def.retrieve.source.chapter)).toContain(def.retrieve.source.quote);
  });

  it.each(ALL.map((d) => [d.track, d] as const))('%s: says where each fact is from, in a chapter that exists', (_, def) => {
    for (const c of def.couplings.filter((x) => x.type === 'fact')) {
      const m = /^From the Databricks guide \(chapter (\d+)\): /.exec(c.uiLabel);
      expect(m, `${def.track}: ${c.id}`).not.toBeNull();
      expect(Number(m![1])).toBeGreaterThanOrEqual(1);
      expect(Number(m![1])).toBeLessThanOrEqual(chapters.length);
    }
    for (const c of def.couplings.filter((x) => x.type !== 'fact')) {
      expect(c.uiLabel, `${def.track}: ${c.id}`).toMatch(/^(Teaching convention|Model assumption|Arithmetic): /);
    }
  });

  it.each(ALL.map((d) => [d.track, d] as const))('%s: never teaches a DENY statement or states a pass mark', (_, def) => {
    const text = JSON.stringify({ ...def, run: undefined, loadContext: undefined, apply: { ...def.apply, correct: undefined } });
    expect(text).not.toMatch(/pass(ing)? (mark|score)/i);
    // A DENY may appear only as a wrong Reason option, never in a fact or a finding.
    for (const c of def.couplings) expect(c.uiLabel).not.toMatch(/DENY/);
    for (const levers of everyLevers(def)) {
      for (const f of def.run(null, levers).findings) expect(f.text).not.toMatch(/DENY/);
    }
  });
});

describe('what each scenario shows (the contract’s predict answers)', () => {
  it('matches DATABRICKS-LAB-CONTRACT.md', () => {
    const outcome = (def: ExperimentDefinition<unknown>) => def.run(null, def.preset).outcome;
    expect(outcome(RETENTION.RETENTION as ExperimentDefinition<unknown>)).toBe('files-gone');
    expect(outcome(AUTO_LOADER.AUTO_LOADER as ExperimentDefinition<unknown>)).toBe('stopped');
    expect(outcome(DATASETS.DATASETS as ExperimentDefinition<unknown>)).toBe('stale');
    expect(outcome(JOBS.JOBS as ExperimentDefinition<unknown>)).toBe('duplicated');
    expect(outcome(SKEW.SKEW as ExperimentDefinition<unknown>)).toBe('skewed');
    expect(outcome(GOVERNANCE.GRANTS as ExperimentDefinition<unknown>)).toBe('denied');
    expect(outcome(GOVERNANCE.DROP as ExperimentDefinition<unknown>)).toBe('files-remain');
  });

  it('needs both retentions for time travel', () => {
    expect(RETENTION.runRetention({ age: 25, fileRetention: 7, logRetention: 60 }).outcome).toBe('files-gone');
    expect(RETENTION.runRetention({ age: 25, fileRetention: 30, logRetention: 30 }).outcome).toBe('readable');
    expect(RETENTION.runRetention({ age: 40, fileRetention: 30, logRetention: 30 }).outcome).toBe('history-gone');
    expect(RETENTION.runRetention({ age: 3, fileRetention: 7, logRetention: 30 }).outcome).toBe('readable');
  });

  it('stops addNewColumns until a restart, never stops rescue, and reloads after a deleted checkpoint', () => {
    expect(AUTO_LOADER.runAutoLoader({ mode: 'addNewColumns', restart: 'on', checkpoint: 'kept' }).outcome).toBe('new-column');
    expect(AUTO_LOADER.runAutoLoader({ mode: 'rescue', restart: 'off', checkpoint: 'kept' }).outcome).toBe('rescued');
    expect(AUTO_LOADER.runAutoLoader({ mode: 'failOnNewColumns', restart: 'on', checkpoint: 'kept' }).outcome).toBe('stopped');
    expect(AUTO_LOADER.runAutoLoader({ mode: 'rescue', restart: 'on', checkpoint: 'deleted' })).toMatchObject({ outcome: 'reloaded', duplicates: AUTO_LOADER.DAY1 });
  });

  it('keeps a materialized view current and needs a full refresh for a streaming table', () => {
    expect(DATASETS.runDatasets({ dataset: 'mv', change: 'dimension', update: 'refresh' }).outcome).toBe('current');
    expect(DATASETS.runDatasets({ dataset: 'streaming', change: 'query', update: 'refresh' }).outcome).toBe('stale');
    expect(DATASETS.runDatasets({ dataset: 'streaming', change: 'dimension', update: 'full' }).outcome).toBe('current');
  });

  it('duplicates on any rerun of an append, and never with a MERGE', () => {
    expect(JOBS.runJobs({ retries: 1, write: 'append', repair: 'no' }).outcome).toBe('duplicated');
    expect(JOBS.runJobs({ retries: 1, write: 'merge', repair: 'no' })).toMatchObject({ outcome: 'exact', manual: false });
    expect(JOBS.runJobs({ retries: 0, write: 'merge', repair: 'yes' })).toMatchObject({ outcome: 'exact', manual: true });
    expect(JOBS.runJobs({ retries: 0, write: 'append', repair: 'no' })).toMatchObject({ outcome: 'incomplete', publish: 'Upstream failed' });
  });

  it('lets AQE fix a skewed join but not a skewed groupBy, which salting fixes', () => {
    expect(SKEW.runSkew({ operation: 'join', aqe: 'on', salt: 'off' }).outcome).toBe('even');
    expect(SKEW.runSkew({ operation: 'join', aqe: 'off', salt: 'off' }).outcome).toBe('skewed');
    expect(SKEW.runSkew({ operation: 'groupBy', aqe: 'off', salt: 'on' }).outcome).toBe('even');
    expect(SKEW.runSkew({ operation: 'groupBy', aqe: 'on', salt: 'off' }).ratio).toBeGreaterThanOrEqual(1.5);
  });

  it('reads only with all three privileges, and a schema grant reaches future tables', () => {
    expect(GOVERNANCE.runGrants({ selectOn: 'table', useSchema: 'yes', useCatalog: 'no' }).outcome).toBe('denied');
    expect(GOVERNANCE.runGrants({ selectOn: 'table', useSchema: 'yes', useCatalog: 'yes' }).outcome).toBe('this-table');
    expect(GOVERNANCE.runGrants({ selectOn: 'schema', useSchema: 'yes', useCatalog: 'yes' })).toMatchObject({ outcome: 'whole-schema', future: true });
  });

  it('never deletes an external table’s files on drop, and undrops a managed one only within the recovery period', () => {
    expect(GOVERNANCE.runDrop({ type: 'external', days: 10, retain: 30 }).outcome).toBe('files-remain');
    expect(GOVERNANCE.runDrop({ type: 'managed', days: 3, retain: 7 }).outcome).toBe('undroppable');
    expect(GOVERNANCE.runDrop({ type: 'managed', days: 10, retain: 7 }).outcome).toBe('files-deleted');
    expect(GOVERNANCE.runDrop({ type: 'managed', days: 10, retain: 30 }).outcome).toBe('undroppable');
  });
});

describe('the Databricks Lab’s sources', () => {
  it('cites only sections the research notes have', () => {
    const notes = readFileSync(resolve(__dirname, '../../../../docs/research/databricks-documentation-notes.md'), 'utf8');
    const sections = new Set([...notes.matchAll(/^## (\d+)\. /gm)].map((m) => `§${m[1]}`));
    for (const sources of [RETENTION.SOURCES, AUTO_LOADER.SOURCES, DATASETS.SOURCES, JOBS.SOURCES, SKEW.SOURCES, GOVERNANCE.SOURCES]) {
      for (const s of sources) expect(sections.has(s), s).toBe(true);
    }
  });
});
