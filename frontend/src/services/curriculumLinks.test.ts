// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, expect, it } from 'vitest';
import adfPack from '../../../backend/app/content/packs/adf/v1.json';
import type { ContentPackDetail } from '../types/contentPack';
import type { EvidenceItem } from '../types/portfolio';
import type { MappedGuideChapter } from '../types/roadmap';
import { ADF_LAB_EXPERIMENTS } from './adfLab/experiments';
import { evidenceForTopic, NO_LINKS, topicLinks } from './curriculumLinks';

const ADF = adfPack as unknown as ContentPackDetail;
const scenarios = ADF.scenario_levels.flatMap((l) => l.scenarios);

const mapped = (chapterId: string, topicNumber: number, packId = 'adf'): MappedGuideChapter => {
  const ch = ADF.chapters.find((c) => c.id === chapterId);
  return {
    pack_id: packId, pack_title: 'Azure Data Factory', chapter_id: chapterId, chapter_number: ch ? ADF.chapters.indexOf(ch) + 1 : 1,
    chapter_title: ch?.title ?? chapterId, topic_number: topicNumber, coverage: 'Full',
  };
};

const item = (kind: EvidenceItem['kind'], ref: Record<string, string>): EvidenceItem => ({
  id: `${kind}:${JSON.stringify(ref)}`, source: 'scenarios', kind, level: 'completed', assessed_by: 'answer_key',
  title: 't', demonstrates: null, basis: 'b', href: '/', at: null, ref,
});

describe('topicLinks', () => {
  it('links nothing for a topic with no mapped chapter -- there is no positional fallback', () => {
    expect(topicLinks([], ADF)).toBe(NO_LINKS);
    expect(topicLinks(undefined, ADF)).toBe(NO_LINKS);
  });

  it('links exactly the written scenarios whose chapter is a mapped chapter, from the real ADF pack', () => {
    const chapter = scenarios.find((s) => s.content)!.chapter;
    const links = topicLinks([mapped(chapter, 1)], ADF);
    const expected = scenarios.filter((s) => s.content && s.chapter === chapter).map((s) => s.id);
    expect(links.scenarios.map((s) => s.id)).toEqual(expected);
    expect(expected.length).toBeGreaterThan(0);
  });

  it('links the ADF experiments whose registry topics include the mapped topic number', () => {
    for (const e of ADF_LAB_EXPERIMENTS.filter((x) => x.ready)) {
      for (const t of e.topics) {
        const links = topicLinks([mapped(e.chapters[0].id, t.number)], ADF);
        expect(links.experiments.map((x) => x.slug)).toContain(e.slug);
      }
    }
    // A topic number no experiment names links none.
    expect(topicLinks([mapped('incremental', 999)], ADF).experiments).toEqual([]);
  });

  it('never links the ADF lab from another pack, even with a matching number', () => {
    const links = topicLinks([mapped('incremental', 32, 'adls')], null);
    expect(links.experiments).toEqual([]);
    expect(links.scenarios).toEqual([]);
  });

  it('never reads scenarios from a different pack than the one the chapters came from', () => {
    const otherPack = { ...ADF, pack_id: 'adls' } as ContentPackDetail;
    expect(topicLinks([mapped('incremental', 32)], otherPack).scenarios).toEqual([]);
  });
});

describe('evidenceForTopic', () => {
  const chapter = scenarios.find((s) => s.content)!.chapter;
  const linkedScenario = scenarios.find((s) => s.content && s.chapter === chapter)!;
  const otherScenario = scenarios.find((s) => s.content && s.chapter !== chapter)!;
  const links = topicLinks([mapped(chapter, 32)], ADF);

  it('keeps only the evidence from the topic\'s own linked scenarios and experiments', () => {
    const items = [
      item('scenario_check', { pack_id: 'adf', scenario_id: linkedScenario.id, check: '0' }),
      item('scenario_lens', { pack_id: 'adf', scenario_id: linkedScenario.id, role: 'po' }),
      item('scenario_check', { pack_id: 'adf', scenario_id: otherScenario.id, check: '0' }),
      item('scenario_check', { pack_id: 'adls', scenario_id: linkedScenario.id, check: '0' }),
      item('lab_stage', { track: 'watermark', run: '1', stage: 'apply' }),
      item('lab_stage', { track: 'triggers', run: '1', stage: 'apply' }),
      item('topic_demonstration', { topic_id: '7' }),
    ];
    const kept = evidenceForTopic(items, links);
    expect(kept.map((i) => i.ref.scenario_id ?? i.ref.track)).toEqual([linkedScenario.id, linkedScenario.id, 'watermark']);
  });

  it('matches a fault-mode track to its experiment', () => {
    const ft = ADF_LAB_EXPERIMENTS.find((e) => e.slug === 'fault-tolerance')!;
    const ftLinks = topicLinks([mapped(ft.chapters[0].id, ft.topics[0].number)], ADF);
    expect(evidenceForTopic([item('lab_stage', { track: 'fault-tolerance.dependency', run: '1', stage: 'apply' })], ftLinks)).toHaveLength(1);
  });

  it('gives nothing for a topic with no links', () => {
    expect(evidenceForTopic([item('lab_stage', { track: 'watermark', run: '1', stage: 'apply' })], NO_LINKS)).toEqual([]);
  });
});
