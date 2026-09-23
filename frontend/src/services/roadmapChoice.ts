// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { RoadmapSummary } from '../types/roadmap';

const time = (iso?: string | null) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(t) ? 0 : t;
};

/**
 * The roadmap this preparation is working from.
 *
 * Its own roadmaps first; one that belongs to no preparation only when it has
 * none; never another preparation's. Within those, the one with work under way,
 * then the one touched most recently.
 */
export function chooseRoadmap(
  roadmaps: RoadmapSummary[],
  subjectId: number | null,
): { roadmap: RoadmapSummary; linked: boolean } | null {
  const live = roadmaps.filter((r) => !r.is_archived);
  const rank = (list: RoadmapSummary[]) => [...list].sort((a, b) =>
    Number(b.progress.in_progress_count > 0) - Number(a.progress.in_progress_count > 0)
    || Number(b.progress.completed_count > 0) - Number(a.progress.completed_count > 0)
    || time(b.updated_at) - time(a.updated_at)
    || b.id - a.id);
  if (subjectId != null) {
    const own = rank(live.filter((r) => r.subject_id === subjectId));
    if (own.length > 0) return { roadmap: own[0], linked: true };
  }
  const unlinked = rank(live.filter((r) => r.subject_id == null));
  if (unlinked.length > 0) return { roadmap: unlinked[0], linked: false };
  return null;
}
