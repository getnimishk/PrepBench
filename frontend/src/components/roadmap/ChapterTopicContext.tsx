// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import { getRoadmap } from '../../services/api';
import type { TopicContext } from '../../services/topicContext';
import type { RoadmapDetail } from '../../types/roadmap';
import { Actions, Detail, Eyebrow, Panel } from '../ui/primitives';

/**
 * A compact strip above a chapter opened from a roadmap topic: which topic the reader is
 * studying for, its objective, and the ways out -- back to the topic, its demonstration, the
 * roadmap, the next topic. Reading the chapter changes nothing here: only a demonstration
 * completes a topic, and the strip says so.
 *
 * Shown only when the topic exists in that roadmap AND the roadmap's own mapping lists this
 * chapter for it. Any other address (a stale link, a topic the chapter does not cover, a
 * roadmap that cannot be read) shows nothing, so a chapter never wears another topic's name.
 */
export const ChapterTopicContext: React.FC<{ packId: string; chapterId: string; context: TopicContext }> = ({
  packId, chapterId, context,
}) => {
  const { roadmapId, topicId } = context;
  const [roadmap, setRoadmap] = useState<RoadmapDetail | null>(null);

  useEffect(() => {
    let live = true;
    setRoadmap(null);
    getRoadmap(roadmapId).then((r) => { if (live) setRoadmap(r); }).catch(() => { if (live) setRoadmap(null); });
    return () => { live = false; };
  }, [roadmapId]);

  const found = useMemo(() => {
    if (!roadmap) return null;
    const ordered = roadmap.phases.flatMap((p) => p.topics);
    const index = ordered.findIndex((t) => t.id === topicId);
    if (index < 0) return null;
    const topic = ordered[index];
    const entries = (topic.mapped_chapters ?? []).filter((m) => m.pack_id === packId && m.chapter_id === chapterId);
    if (entries.length === 0) return null;
    const sections = [...new Set(entries.map((m) => m.relevant_sections).filter((s): s is string => Boolean(s)))];
    return { topic, index, count: ordered.length, next: ordered[index + 1] ?? null, sections };
  }, [roadmap, topicId, packId, chapterId]);

  if (!found) return null;
  const { topic, index, count, next, sections } = found;
  const topicPath = `/roadmaps/${roadmapId}/topics/${topic.id}`;

  return (
    <Panel soft component="nav" aria-label="Roadmap topic" sx={{ mb: '16px', p: '12px 16px' }}>
      <Eyebrow>Reading for roadmap topic {index + 1} of {count}</Eyebrow>
      <Box sx={{ fontWeight: 700, mt: '2px' }}>{topic.title}</Box>
      {topic.learning_objective && <Detail sx={{ mt: '4px' }}>{topic.learning_objective}</Detail>}
      {sections.length > 0 && <Detail sx={{ mt: '4px' }}><strong>Relevant sections:</strong> {sections.join('; ')}</Detail>}
      <Actions sx={{ mt: '10px' }}>
        <Button variant="outlined" size="small" component={RouterLink} to={topicPath}>Back to topic</Button>
        {topic.success_criteria && (
          <Button variant="outlined" size="small" color="ink" component={RouterLink} to={`${topicPath}/demonstrate`}>
            Demonstrate mastery
          </Button>
        )}
        <Button variant="text" size="small" component={RouterLink} to={`/roadmaps/${roadmapId}`}>Roadmap</Button>
        {next && (
          <Button variant="text" size="small" component={RouterLink} to={`/roadmaps/${roadmapId}/topics/${next.id}`}>
            Next topic: {next.title}
          </Button>
        )}
      </Actions>
      <Detail sx={{ mt: '8px' }}>
        Reading does not complete the topic — a demonstration does. Keep reading, or demonstrate when you are ready.
      </Detail>
    </Panel>
  );
};
