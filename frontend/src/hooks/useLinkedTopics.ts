// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { useEffect, useState } from 'react';
import { getRoadmap, getScopedRoadmaps } from '../services/api';

export interface LinkedTopic {
  roadmapId: number;
  roadmapTitle: string;
  topicId: number;
  title: string;
}

/** What a page links back from: a scenario's chapter, or an experiment's topic numbers. */
export type LinkedTopicsQuery = { chapter: string } | { topicNumbers: number[] };

/**
 * The reverse of a topic's curriculum links (Phase 7, WP 7.7): the roadmap topics, in the
 * preparation's own roadmaps linked to this pack, whose mapped chapters include a scenario's
 * chapter, or whose mapped topic numbers include an experiment's. Read from the same
 * mapped_chapters the topic page shows -- one source -- so the two directions always agree.
 *
 * No preparation, or one with no roadmap linked to the pack: no topics. Another
 * preparation's roadmaps and unassigned ones are never read for this.
 */
export function useLinkedTopics(subjectId: number | null, packId: string | null, query: LinkedTopicsQuery): LinkedTopic[] {
  const [topics, setTopics] = useState<LinkedTopic[]>([]);
  const queryKey = 'chapter' in query ? `c:${query.chapter}` : `t:${[...query.topicNumbers].sort((a, b) => a - b).join(',')}`;

  useEffect(() => {
    let live = true;
    setTopics([]);
    if (subjectId == null || !packId) return () => { live = false; };
    const matches = queryKey.startsWith('c:')
      ? (ch: { chapter_id: string; topic_number?: number | null }) => ch.chapter_id === queryKey.slice(2)
      : (() => {
        const wanted = new Set(queryKey.slice(2).split(',').filter(Boolean).map(Number));
        return (ch: { chapter_id: string; topic_number?: number | null }) => ch.topic_number != null && wanted.has(ch.topic_number);
      })();
    (async () => {
      try {
        const own = (await getScopedRoadmaps(subjectId))
          .filter((r) => r.subject_id === subjectId && r.linked_pack_id === packId);
        const details = await Promise.all(own.map((r) => getRoadmap(r.id)));
        const found: LinkedTopic[] = [];
        for (const d of details) {
          for (const phase of d.phases) {
            for (const t of phase.topics) {
              if ((t.mapped_chapters ?? []).some((ch) => ch.pack_id === packId && matches(ch))) {
                found.push({ roadmapId: d.id, roadmapTitle: d.title, topicId: t.id, title: t.title });
              }
            }
          }
        }
        if (live) setTopics(found);
      } catch {
        // The links are a convenience on a page that works without them: none rather than a guess.
        if (live) setTopics([]);
      }
    })();
    return () => { live = false; };
  }, [subjectId, packId, queryKey]);

  return topics;
}
