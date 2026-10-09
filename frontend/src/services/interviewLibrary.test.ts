// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getInterviewLibrary } from './interviewLibrary';

const getInterviewQuestions = vi.fn();
vi.mock('./api', () => ({ getInterviewQuestions: (...a: unknown[]) => getInterviewQuestions(...a) }));

const q = (id: number, subject_id: number | null) => ({ id, subject_id, question_text: `Q${id}` });

beforeEach(() => {
  getInterviewQuestions.mockReset();
  getInterviewQuestions.mockImplementation((params: { subject_id?: number }) => Promise.resolve(
    params.subject_id === 6
      ? { items: [q(10, 6)], total: 1 }
      : { items: [q(1, null), q(2, null)], total: 2 },
  ));
});

describe('getInterviewLibrary (Phase 8)', () => {
  it('with no preparation is the shared library alone', async () => {
    const res = await getInterviewLibrary(null, 500);
    expect(res.items.map((x) => x.id)).toEqual([1, 2]);
    expect(getInterviewQuestions).toHaveBeenCalledTimes(1);
    expect(getInterviewQuestions).toHaveBeenCalledWith({ limit: 500 });
  });

  it('adds only the chosen preparation’s own questions, first', async () => {
    const res = await getInterviewLibrary(6, 500);
    expect(res.items.map((x) => x.id)).toEqual([10, 1, 2]);
    expect(res.total).toBe(3);
    expect(getInterviewQuestions).toHaveBeenCalledWith({ subject_id: 6, limit: 500 });
  });

  it('never lists a question twice', async () => {
    getInterviewQuestions.mockResolvedValue({ items: [q(1, null)], total: 1 });
    const res = await getInterviewLibrary(3, 500);
    expect(res.items.map((x) => x.id)).toEqual([1]);
  });
});
