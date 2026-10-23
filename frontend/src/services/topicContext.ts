// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

/**
 * The roadmap topic a Study Guide chapter was opened from. It lives only in the chapter's
 * address (`?roadmap=<id>&topic=<id>`), so a refresh keeps it and a chapter opened straight
 * from the library simply has none. It is a hint, never trusted: the chapter page checks it
 * against the topic's own mapped chapters before showing anything.
 */
export interface TopicContext {
  roadmapId: number;
  topicId: number;
}

const positiveInt = (raw: string | null): number | null => {
  if (raw === null || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};

export function readTopicContext(params: URLSearchParams): TopicContext | null {
  const roadmapId = positiveInt(params.get('roadmap'));
  const topicId = positiveInt(params.get('topic'));
  return roadmapId !== null && topicId !== null ? { roadmapId, topicId } : null;
}

/** A chapter's path, carrying the originating topic when there is one. */
export function guideChapterPath(packId: string, chapterId: string, context?: TopicContext | null): string {
  const base = `/learn/guides/${packId}/${chapterId}`;
  return context ? `${base}?roadmap=${context.roadmapId}&topic=${context.topicId}` : base;
}
