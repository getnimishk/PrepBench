// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ExamSetupPage } from './ExamSetupPage';
import { Subject } from '../types/subject';

const mockStartExam = vi.fn();
const mockGetFilters = vi.fn();
const mockGetSubjects = vi.fn();

vi.mock('../services/api', () => ({
  startExam: (...a: any[]) => mockStartExam(...a),
  getQuestionFilters: (...a: any[]) => mockGetFilters(...a),
  getSubjects: (...a: any[]) => mockGetSubjects(...a),
}));

const CERT: Subject = {
  id: 1,
  name: 'Scrum / PSM I',
  slug: 'psm-i',
  kind: 'certification',
  pass_mark: 85,
  exam_question_count: 80,
  exam_minutes: 60,
  has_exam_profile: true, question_count: 500,
  readiness: {
    state: 'almost_there', mock_count: 6, pass_mark: 85,
    recent_scores: [82.5, 87.5, 92.5], latest_taken_at: null, is_stale: false,
    domains: [], weakest_domain: null, points_per_mock: null,
    mocks_to_pass_estimate: null, blockers: [], most_improved: null,
  },
};

const SKILL: Subject = {
  ...CERT,
  id: 3, name: 'System Design', slug: 'system-design', kind: 'skill',
  pass_mark: null, exam_question_count: null, exam_minutes: null, has_exam_profile: false, question_count: 500,
};

const renderSetup = (entry = '/exam-setup') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/exam-setup" element={<ExamSetupPage />} />
        <Route path="/exam/:sessionId" element={<div>exam runner</div>} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSubjects.mockResolvedValue([CERT, SKILL]);
  mockGetFilters.mockResolvedValue({
    certifications: [], topics: ['Scrum Events'], difficulties: ['easy', 'hard'],
  });
  mockStartExam.mockResolvedValue({ id: 77 });
});

describe('ExamSetupPage', () => {
  it('sends session_kind so the browser can actually record a mock', async () => {
    // The defect this page existed inside of: the API had carried
    // session_kind and subject_id for a while, and no screen sent either, so
    // every session the app could create was a drill and readiness could
    // never leave "needs evaluation" through normal use.
    const user = userEvent.setup();
    renderSetup('/exam-setup?kind=mock');

    await user.click(await screen.findByRole('button', { name: /Take a mock/ }));

    await waitFor(() => expect(mockStartExam).toHaveBeenCalled());
    expect(mockStartExam.mock.calls[0][0]).toMatchObject({ session_kind: 'mock', subject_id: 1 });
  });

  it('takes a mock’s shape from the subject’s exam profile, not from the learner', async () => {
    const user = userEvent.setup();
    renderSetup('/exam-setup?kind=mock');

    await user.click(await screen.findByRole('button', { name: /Take a mock/ }));

    await waitFor(() => expect(mockStartExam).toHaveBeenCalled());
    expect(mockStartExam.mock.calls[0][0]).toMatchObject({
      exam_mode: 'timed', total_questions: 80, time_allowed_minutes: 60, passing_percentage: 85,
    });
  });

  it('records a drill as a drill, untimed', async () => {
    const user = userEvent.setup();
    renderSetup('/exam-setup?kind=drill');

    await user.click(await screen.findByRole('button', { name: /Practise/ }));

    await waitFor(() => expect(mockStartExam).toHaveBeenCalled());
    const sent = mockStartExam.mock.calls[0][0];
    expect(sent.session_kind).toBe('drill');
    // Timing is what makes a mock a measurement. A drill has none.
    expect(sent.time_allowed_minutes).toBeUndefined();
  });

  it('actually drills the domain it was sent to drill', async () => {
    // "Practise Managing Products with Agility" used to land here on generic
    // practice with the domain dropped, so the sentence on the previous
    // screen was false and nothing anywhere said so.
    const user = userEvent.setup();
    renderSetup('/exam-setup?kind=drill&subject=1&domain=Managing%20Products%20with%20Agility');

    expect(await screen.findByRole('heading', { name: 'Managing Products with Agility' }))
      .toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Drill Managing Products with Agility/ }));

    await waitFor(() => expect(mockStartExam).toHaveBeenCalled());
    expect(mockStartExam.mock.calls[0][0]).toMatchObject({
      domains: ['Managing Products with Agility'],
      session_kind: 'drill',
    });
  });

  it('leads with intent rather than with configuration', async () => {
    renderSetup('/exam-setup?kind=drill');

    await screen.findByRole('button', { name: /Practise/ });
    // Question count, difficulty and topic are all reachable, and none of
    // them is on screen until asked for.
    expect(screen.queryByText('Scrum Events')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Number of questions')).not.toBeInTheDocument();
  });

  it('will not offer a mock for a subject with no exam profile', async () => {
    mockGetSubjects.mockResolvedValue([SKILL]);
    renderSetup('/exam-setup?kind=mock');

    await screen.findByRole('button', { name: /Practise/ });
    expect(screen.queryByRole('button', { name: /Take a mock/ })).not.toBeInTheDocument();
  });

  it('narrows a drill by topic and difficulty when asked', async () => {
    const user = userEvent.setup();
    renderSetup('/exam-setup?kind=drill');

    await user.click(await screen.findByRole('button', { name: /More options/ }));
    await user.click(screen.getByText('Scrum Events'));
    await user.click(screen.getByText('hard'));
    await user.click(screen.getByRole('button', { name: /Practise/ }));

    await waitFor(() => expect(mockStartExam).toHaveBeenCalled());
    expect(mockStartExam.mock.calls[0][0]).toMatchObject({
      topics: ['Scrum Events'], difficulties: ['hard'],
    });
  });

  it('shows the backend’s reason when a selection matches nothing', async () => {
    const user = userEvent.setup();
    mockStartExam.mockRejectedValue({
      response: { data: { detail: 'No questions match those filters: Scrum Events; difficulty hard.' } },
    });
    renderSetup('/exam-setup?kind=drill');

    await user.click(await screen.findByRole('button', { name: /Practise/ }));

    expect(await screen.findByText(/No questions match those filters/)).toBeInTheDocument();
    expect(screen.queryByText('exam runner')).not.toBeInTheDocument();
  });

  it('navigates to the runner once a session exists', async () => {
    const user = userEvent.setup();
    renderSetup('/exam-setup?kind=drill');

    await user.click(await screen.findByRole('button', { name: /Practise/ }));

    expect(await screen.findByText('exam runner')).toBeInTheDocument();
  });
});
