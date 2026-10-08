// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useLinkedTopics } from './useLinkedTopics';

const api = { getScopedRoadmaps: vi.fn(), getRoadmap: vi.fn() };
vi.mock('../services/api', () => ({
  getScopedRoadmaps: (...a: unknown[]) => api.getScopedRoadmaps(...a),
  getRoadmap: (...a: unknown[]) => api.getRoadmap(...a),
}));

const ch = (chapter_id: string, topic_number: number, pack_id = 'adf') => ({
  pack_id, pack_title: 'p', chapter_id, chapter_number: 1, chapter_title: chapter_id, topic_number,
});

const detail = (id: number, subject_id: number | null, topics: { id: number; title: string; mapped_chapters: unknown[] }[]) => ({
  id, title: `Roadmap ${id}`, subject_id, linked_pack_id: subject_id == null ? null : 'adf',
  phases: [{ id: 1, name: 'P', topics }],
});

beforeEach(() => {
  api.getScopedRoadmaps.mockReset();
  api.getRoadmap.mockReset();
  api.getScopedRoadmaps.mockResolvedValue([
    { id: 6, subject_id: 6, linked_pack_id: 'adf' },
    { id: 9, subject_id: null, linked_pack_id: null }, // unassigned: never read for links
  ]);
  api.getRoadmap.mockImplementation((id: number) => Promise.resolve(detail(id, 6, [
    { id: 300, title: 'Watermark Patterns', mapped_chapters: [ch('incremental', 32)] },
    { id: 301, title: 'Triggers', mapped_chapters: [ch('triggers', 40)] },
    { id: 302, title: '33', mapped_chapters: [] },
  ])));
});

describe('useLinkedTopics', () => {
  it('finds the preparation\'s own topics mapped to a scenario\'s chapter', async () => {
    const { result } = renderHook(() => useLinkedTopics(6, 'adf', { chapter: 'incremental' }));
    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0]).toMatchObject({ roadmapId: 6, topicId: 300, title: 'Watermark Patterns' });
    expect(api.getScopedRoadmaps).toHaveBeenCalledWith(6);
    expect(api.getRoadmap).toHaveBeenCalledTimes(1);
    expect(api.getRoadmap).not.toHaveBeenCalledWith(9);
  });

  it('finds topics by an experiment\'s topic numbers', async () => {
    const { result } = renderHook(() => useLinkedTopics(6, 'adf', { topicNumbers: [32, 50] }));
    await waitFor(() => expect(result.current.map((t) => t.topicId)).toEqual([300]));
  });

  it('reads nothing with no preparation -- never another preparation\'s roadmaps', async () => {
    const { result } = renderHook(() => useLinkedTopics(null, 'adf', { chapter: 'incremental' }));
    await new Promise((r) => setTimeout(r, 10));
    expect(result.current).toEqual([]);
    expect(api.getScopedRoadmaps).not.toHaveBeenCalled();
  });

  it('gives no links, not an error, when the roadmaps cannot be read', async () => {
    api.getScopedRoadmaps.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useLinkedTopics(6, 'adf', { chapter: 'incremental' }));
    await waitFor(() => expect(api.getScopedRoadmaps).toHaveBeenCalled());
    expect(result.current).toEqual([]);
  });
});
