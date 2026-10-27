// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { RoadmapPhase, RoadmapTopic } from '../types/roadmap';

const isOpen = (t: RoadmapTopic) => t.status !== 'completed' && t.status !== 'skipped';

/**
 * The one topic a roadmap points the learner at: a topic already in progress
 * first (wherever it sits), otherwise the first open topic in syllabus order.
 * Every "continue" action on the roadmap screen uses this, so they can never
 * name different topics.
 */
export function nextRoadmapTopic(phases: RoadmapPhase[]): { topic: RoadmapTopic; phase: RoadmapPhase } | null {
  const all = phases.flatMap((phase) => phase.topics.map((topic) => ({ topic, phase })));
  return all.find((x) => x.topic.status === 'in_progress') ?? all.find((x) => isOpen(x.topic)) ?? null;
}

/**
 * Where to go after finishing a topic: the next open topic after it in syllabus
 * order, else an open one before it, else null (nothing left to do).
 */
export function topicAfter(phases: RoadmapPhase[], topicId: number): RoadmapTopic | null {
  const all = phases.flatMap((phase) => phase.topics);
  const at = all.findIndex((t) => t.id === topicId);
  return all.slice(at + 1).find(isOpen) ?? all.slice(0, Math.max(at, 0)).find(isOpen) ?? null;
}
