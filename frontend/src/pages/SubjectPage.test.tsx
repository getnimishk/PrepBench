// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { SubjectPage } from './SubjectPage';
import type { Readiness, ReadinessRules, Subject } from '../types/subject';

const mockGetSubject = vi.fn();
const mockGetSubjectCoverage = vi.fn();

vi.mock('../services/api', () => ({
  getSubject: (...args: unknown[]) => mockGetSubject(...args),
  getSubjectCoverage: (...args: unknown[]) => mockGetSubjectCoverage(...args),
  // The overview's facts: none, so the page renders without them.
  getRoadmaps: () => Promise.resolve([]),
  getReviewCounts: () => Promise.resolve(null),
  getQuestionBankSummary: () => Promise.resolve(null),
}));

// The readiness and next-action blocks have their own data and their own
// tests; what is under test here is the page's own loading.
vi.mock('../components/preparation/PreparationOverview', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../components/preparation/PreparationOverview')>()),
  ReadinessBlock: () => <div>Readiness</div>,
  RecommendedBlock: () => <div>Next action</div>,
}));

const RULES: ReadinessRules = {
  min_mocks_for_ready: 3, consecutive_mocks_at_pass: 3, domain_floor_pct: 80,
  recency_days: 14, plateau_min_mocks: 4, plateau_max_spread: 3, min_questions_per_domain: 10,
};

function readiness(over: Partial<Readiness> = {}): Readiness {
  return {
    state: 'needs_evaluation', mock_count: 0, pass_mark: 85, recent_scores: [],
    latest_taken_at: null, is_stale: false, domains: [], weakest_domain: null,
    points_per_mock: null, mocks_to_pass_estimate: null, blockers: [], most_improved: null, rules: RULES,
    ...over,
  };
}

function subject(id: number, name: string): Subject {
  return {
    id, name, slug: name.toLowerCase().replace(/\s+/g, '-'), kind: 'certification', pass_mark: 85,
    exam_question_count: 80, exam_minutes: 60, is_archived: false, display_order: id,
    has_exam_profile: true, question_count: 10, readiness: readiness(),
  };
}

/** A link inside the page's router, so a test can move between preparations the way the app does. */
const GoTo: React.FC<{ to: string }> = ({ to }) => {
  const navigate = useNavigate();
  return <button onClick={() => navigate(to)}>go {to}</button>;
};

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/subjects/:subjectId" element={<><SubjectPage /><GoTo to="/subjects/2" /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSubjectCoverage.mockResolvedValue([]);
});

describe('SubjectPage', () => {
  it('shows the preparation its address names', async () => {
    mockGetSubject.mockResolvedValue(subject(1, 'PSM I'));
    renderAt('/subjects/1');
    expect(await screen.findByRole('heading', { level: 1, name: 'PSM I' })).toBeInTheDocument();
    expect(mockGetSubject).toHaveBeenCalledWith(1);
  });

  it('says so, with a retry, when the preparation cannot be loaded', async () => {
    mockGetSubject.mockRejectedValueOnce(new Error('network down')).mockResolvedValue(subject(1, 'PSM I'));
    renderAt('/subjects/1');
    const retry = await screen.findByRole('button', { name: 'Retry' });
    expect(screen.getByText(/Could not load this preparation/)).toBeInTheDocument();
    act(() => retry.click());
    expect(await screen.findByRole('heading', { level: 1, name: 'PSM I' })).toBeInTheDocument();
  });

  it('keeps the new preparation when the previous one\'s answer arrives after it', async () => {
    // Opened on preparation 1, whose answer is held back; moved on to
    // preparation 2, whose answer comes straight away. When preparation 1's
    // answer finally lands it must not replace preparation 2 on its page.
    let answerFirst!: (value: Subject) => void;
    mockGetSubject.mockImplementation((id: number) => (id === 1
      ? new Promise<Subject>((resolve) => { answerFirst = resolve; })
      : Promise.resolve(subject(2, 'Azure Data Engineer'))));
    renderAt('/subjects/1');

    act(() => screen.getByRole('button', { name: 'go /subjects/2' }).click());
    expect(await screen.findByRole('heading', { level: 1, name: 'Azure Data Engineer' })).toBeInTheDocument();

    await act(async () => { answerFirst(subject(1, 'PSM I')); });
    await waitFor(() => expect(mockGetSubject).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('heading', { level: 1, name: 'PSM I' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Azure Data Engineer' })).toBeInTheDocument();
  });
});
