// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, expect, it } from 'vitest';
import { nextRoadmapTopic } from './roadmapNext';
import type { RoadmapPhase, RoadmapTopicStatus } from '../types/roadmap';

const phases = (...groups: RoadmapTopicStatus[][]): RoadmapPhase[] => {
  let id = 0;
  return groups.map((g, i) => ({
    id: i + 1,
    name: `P${i + 1}`,
    topics: g.map((status) => ({ id: ++id, status, title: `T${id}` })),
  })) as unknown as RoadmapPhase[];
};

describe('nextRoadmapTopic', () => {
  it('prefers an in-progress topic even in a later phase', () => {
    const r = nextRoadmapTopic(phases(['not_started'], ['in_progress']));
    expect(r?.topic.id).toBe(2);
    expect(r?.phase.id).toBe(2);
  });
  it('otherwise takes the first open topic, skipping completed and skipped', () => {
    expect(nextRoadmapTopic(phases(['completed', 'skipped'], ['not_started']))?.topic.id).toBe(3);
  });
  it('goes back to an earlier open topic rather than calling the roadmap done', () => {
    expect(nextRoadmapTopic(phases(['not_started', 'completed'], ['completed']))?.topic.id).toBe(1);
  });
  it('is null for no phases, empty phases, or nothing open', () => {
    expect(nextRoadmapTopic([])).toBeNull();
    expect(nextRoadmapTopic(phases([], []))).toBeNull();
    expect(nextRoadmapTopic(phases(['completed', 'skipped']))).toBeNull();
  });
});
