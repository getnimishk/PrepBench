// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { InterviewQuestion } from '../types/interviewQuestion';
import { getInterviewQuestions } from './api';

/**
 * The interview library as one preparation sees it: the shared questions, which belong
 * to no preparation, and that preparation's own (ADF's saved Say-it answers, say).
 * Never another preparation's own (Phase 8). With no preparation: the shared library.
 */
export async function getInterviewLibrary(
  subjectId: number | null,
  limit: number,
): Promise<{ items: InterviewQuestion[]; total: number }> {
  const [shared, own] = await Promise.all([
    getInterviewQuestions({ limit }),
    subjectId != null ? getInterviewQuestions({ subject_id: subjectId, limit }) : Promise.resolve(null),
  ]);
  const seen = new Set<number>();
  const items = [...(own?.items ?? []), ...shared.items].filter((q) => {
    if (seen.has(q.id)) return false;
    seen.add(q.id);
    return true;
  });
  return { items, total: shared.total + (own?.total ?? 0) };
}
