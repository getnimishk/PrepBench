// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { RoadmapPhase, RoadmapTopic } from '../types/roadmap';

const isOpen = (t: RoadmapTopic) => t.status !== 'completed' && t.status !== 'skipped';

const time = (iso?: string | null) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(t) ? null : t;
};

/**
 * The first open topic after `topicId` in syllabus order, wrapping round to the
 * start; null when nothing else is open. "The topic that follows this one", for any
 * screen that offers it.
 */
export function openTopicAfter(phases: RoadmapPhase[], topicId: number): { topic: RoadmapTopic; phase: RoadmapPhase } | null {
  const all = phases.flatMap((phase) => phase.topics.map((topic) => ({ topic, phase })));
  const at = all.findIndex((x) => x.topic.id === topicId);
  if (at < 0) return null;
  return [...all.slice(at + 1), ...all.slice(0, at)].find((x) => isOpen(x.topic)) ?? null;
}

/**
 * The one topic a roadmap points the learner at:
 *  1. a topic already in progress, wherever it sits;
 *  2. otherwise the first open topic after the one completed most recently, so a
 *     learner who works out of order moves on from where they are, not back to the
 *     start (wrapping round once the end is reached);
 *  3. otherwise, with no dated completion, the first open topic.
 * Every "continue" action -- Home, the roadmap's panel and phase rows, a finished
 * topic's next step, the Study Library -- uses this, so they never name different topics.
 */
export function nextRoadmapTopic(phases: RoadmapPhase[]): { topic: RoadmapTopic; phase: RoadmapPhase } | null {
  const all = phases.flatMap((phase) => phase.topics.map((topic) => ({ topic, phase })));
  const active = all.find((x) => x.topic.status === 'in_progress');
  if (active) return active;
  let latest: { id: number; at: number } | null = null;
  for (const { topic } of all) {
    const at = topic.status === 'completed' ? time(topic.completed_at) : null;
    if (at !== null && (latest === null || at > latest.at)) latest = { id: topic.id, at };
  }
  if (latest) return openTopicAfter(phases, latest.id);
  return all.find((x) => isOpen(x.topic)) ?? null;
}
