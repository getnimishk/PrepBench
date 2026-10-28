// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, expect, it } from 'vitest';
import { nextRoadmapTopic, openTopicAfter } from './roadmapNext';
import type { RoadmapPhase, RoadmapTopicStatus } from '../types/roadmap';

type Spec = RoadmapTopicStatus | [RoadmapTopicStatus, string];

const phases = (...groups: Spec[][]): RoadmapPhase[] => {
  let id = 0;
  return groups.map((g, i) => ({
    id: i + 1,
    name: `P${i + 1}`,
    topics: g.map((spec) => {
      const [status, completed_at] = Array.isArray(spec) ? spec : [spec, null];
      id += 1;
      return { id, status, title: `T${id}`, completed_at };
    }),
  })) as unknown as RoadmapPhase[];
};

describe('nextRoadmapTopic', () => {
  it('prefers an in-progress topic even in a later phase', () => {
    const r = nextRoadmapTopic(phases(['not_started'], ['in_progress']));
    expect(r?.topic.id).toBe(2);
    expect(r?.phase.id).toBe(2);
  });
  it('with nothing completed, takes the first open topic, skipping skipped ones', () => {
    expect(nextRoadmapTopic(phases(['skipped'], ['not_started']))?.topic.id).toBe(2);
  });
  it('moves on from the topic completed most recently, not back to the start', () => {
    // A learner who jumped ahead to topic 4 and demonstrated it is offered topic 5, not topic 1.
    const r = nextRoadmapTopic(phases(
      ['not_started', 'not_started'],
      [['completed', '2026-10-01T10:00:00'], ['completed', '2026-10-20T10:00:00'], 'not_started'],
    ));
    expect(r?.topic.id).toBe(5);
  });
  it('wraps round to an earlier open topic once the end is reached', () => {
    expect(nextRoadmapTopic(phases(['not_started', 'completed'], [['completed', '2026-10-20T10:00:00']]))?.topic.id).toBe(1);
  });
  it('falls back to the first open topic when no completion is dated', () => {
    expect(nextRoadmapTopic(phases(['not_started', 'completed', 'not_started']))?.topic.id).toBe(1);
  });
  it('is null for no phases, empty phases, or nothing open', () => {
    expect(nextRoadmapTopic([])).toBeNull();
    expect(nextRoadmapTopic(phases([], []))).toBeNull();
    expect(nextRoadmapTopic(phases([['completed', '2026-10-20T10:00:00'], 'skipped']))).toBeNull();
  });
});

describe('openTopicAfter', () => {
  it('skips completed and skipped topics, across phases', () => {
    expect(openTopicAfter(phases(['not_started', 'completed'], ['skipped', 'not_started']), 1)?.topic.id).toBe(4);
  });
  it('wraps round, never returns the topic itself, and is null for an unknown id', () => {
    expect(openTopicAfter(phases(['not_started', 'completed', 'not_started']), 3)?.topic.id).toBe(1);
    expect(openTopicAfter(phases(['not_started']), 1)).toBeNull();
    expect(openTopicAfter(phases(['not_started']), 99)).toBeNull();
  });
});
