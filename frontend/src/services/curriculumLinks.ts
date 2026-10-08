// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { ContentPackDetail } from '../types/contentPack';
import type { EvidenceItem } from '../types/portfolio';
import type { MappedGuideChapter } from '../types/roadmap';
import { ADF_LAB_EXPERIMENTS } from './adfLab/experiments';

/**
 * A roadmap topic's links into the rest of the curriculum (Phase 7, WP 7.7), derived --
 * never stored -- from relationships the content already states:
 *
 *   topic      -> chapters     the pack's own "Roadmap alignment" (the server's mapped_chapters,
 *                              matched by the topic's title or the number its title states)
 *   chapters   -> scenarios    each written scenario's `chapter`
 *   topic      -> experiments  the ADF lab registry's `topics` numbers, for the ADF pack's topics
 *
 * Nothing is guessed: a topic with no mapped chapter has no links, and nothing is matched
 * by position or by a word that happens to appear in a title.
 */
export interface TopicLinks {
  packId: string | null;
  chapters: { id: string; number: number; title: string; coverage: string | null }[];
  scenarios: { id: string; number: number; title: string }[];
  experiments: { slug: string; title: string; href: string }[];
  /** The topic numbers its chapters were mapped under (the pack's own numbering). */
  topicNumbers: number[];
}

export const NO_LINKS: TopicLinks = { packId: null, chapters: [], scenarios: [], experiments: [], topicNumbers: [] };

export function topicLinks(mapped: MappedGuideChapter[] | undefined, pack: ContentPackDetail | null): TopicLinks {
  if (!mapped || mapped.length === 0) return NO_LINKS;
  const packId = mapped[0].pack_id;
  const chapters: TopicLinks['chapters'] = [];
  for (const c of mapped) {
    if (c.pack_id !== packId || chapters.some((x) => x.id === c.chapter_id)) continue;
    chapters.push({ id: c.chapter_id, number: c.chapter_number, title: c.chapter_title, coverage: c.coverage || null });
  }
  const chapterIds = new Set(chapters.map((c) => c.id));
  const topicNumbers = [...new Set(mapped.map((c) => c.topic_number).filter((n): n is number => typeof n === 'number'))];

  const scenarios = pack && pack.pack_id === packId
    ? pack.scenario_levels.flatMap((level) => level.scenarios)
      .filter((s) => s.content && chapterIds.has(s.chapter))
      .map((s) => ({ id: s.id, number: s.number, title: s.title }))
    : [];

  // The ADF lab's experiments are the ADF pack's: they link only to that pack's topics.
  const experiments = packId === 'adf'
    ? ADF_LAB_EXPERIMENTS
      .filter((e) => e.ready && e.topics.some((t) => topicNumbers.includes(t.number)))
      .map((e) => ({ slug: e.slug, title: e.title, href: `/lab/adf/${e.slug}` }))
    : [];

  return { packId, chapters, scenarios, experiments, topicNumbers };
}

/**
 * The Phase 6 Evidence that belongs to a topic: the items from its linked scenarios and
 * experiments, in the topic's own preparation. Read-only -- the same items, levels and
 * links as on the Evidence page; a topic's status never changes from them (D4).
 */
export function evidenceForTopic(items: EvidenceItem[], links: TopicLinks): EvidenceItem[] {
  if (!links.packId) return [];
  const scenarioIds = new Set(links.scenarios.map((s) => s.id));
  const slugs = new Set(links.experiments.map((e) => e.slug));
  return items.filter((item) => {
    if (item.kind === 'scenario_check' || item.kind === 'scenario_lens') {
      return item.ref.pack_id === links.packId && scenarioIds.has(item.ref.scenario_id);
    }
    if (item.kind === 'lab_stage') return slugs.has((item.ref.track ?? '').split('.')[0]);
    return false;
  });
}
