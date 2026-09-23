// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ExamSetupPage } from './ExamSetupPage';
import { Subject } from '../types/subject';
import type { ExamPreview } from '../types/exam';

const mockStartExam = vi.fn();
const mockGetFilters = vi.fn();
const mockGetSubjects = vi.fn();
const mockPreview = vi.fn();
const mockHome = vi.fn();
const mockQueue = vi.fn();
const mockRoadmaps = vi.fn();
const mockHistory = vi.fn();
const mockDiscard = vi.fn();
const mockPreparation = vi.fn();

vi.mock('../services/api', () => ({
  startExam: (...a: any[]) => mockStartExam(...a),
  getQuestionFilters: (...a: any[]) => mockGetFilters(...a),
  getSubjects: (...a: any[]) => mockGetSubjects(...a),
  previewExam: (...a: any[]) => mockPreview(...a),
  getHomeSummary: (...a: any[]) => mockHome(...a),
  getReviewQueue: (...a: any[]) => mockQueue(...a),
  getRoadmaps: (...a: any[]) => mockRoadmaps(...a),
  getMockHistory: (...a: any[]) => mockHistory(...a),
  discardExam: (...a: any[]) => mockDiscard(...a),
}));

vi.mock('../context/PreparationContext', () => ({
  usePreparation: () => mockPreparation(),
}));

const CERT: Subject = {
  id: 1,
  name: 'Scrum / PSM I',
  slug: 'psm-i',
  kind: 'certification',
  pass_mark: 85,
  exam_question_count: 80,
  exam_minutes: 60,
  has_exam_profile: true, is_archived: false, display_order: 100, question_count: 500,
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
  pass_mark: null, exam_question_count: null, exam_minutes: null, has_exam_profile: false, is_archived: false, display_order: 100, question_count: 500,
};

const preview = (over: Partial<ExamPreview> = {}): ExamPreview => ({
  can_start: true, reason: null, available: 500, will_draw: 80,
  previously_missed: 90, due_for_review: 40, never_attempted: 300, answered_correctly: 70,
  domain_plan: [
    { domain: 'Scrum Framework', available: 300, will_draw: 48 },
    { domain: 'Scrum Team', available: 200, will_draw: 32 },
  ],
  ...over,
});

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
  mockPreparation.mockReturnValue({ selectedId: null, selected: null });
  mockGetSubjects.mockResolvedValue([CERT, SKILL]);
  mockGetFilters.mockResolvedValue({
    certifications: [], topics: ['Scrum Events', 'Daily Scrum'], difficulties: ['easy', 'hard'],
  });
  mockStartExam.mockResolvedValue({ id: 77 });
  mockPreview.mockImplementation((req: any) => Promise.resolve(
    req.question_source === 'unseen' ? preview({ available: 120 }) : preview(),
  ));
  mockHome.mockResolvedValue({ per_subject: [{ subject_id: 1, unreviewed: 3, resumable: null }] });
  mockQueue.mockResolvedValue({ items: [], remaining: 0, total_unreviewed: 3, spaced_due: 12 });
  mockRoadmaps.mockResolvedValue([]);
  mockHistory.mockResolvedValue([
    { session_id: 41, title: 'PSM I — full mock', taken_at: '2026-09-05T10:00:00', score_percentage: 87.5,
      passed: true, correct_count: 70, total_questions: 80, time_spent_seconds: 2851 },
  ]);
  mockDiscard.mockResolvedValue(undefined);
});

describe('Mock Exam setup', () => {
  it('sends session_kind and the exam profile, so the browser records a real mock', async () => {
    // The defect this page existed inside of: the API had carried
    // session_kind and subject_id for a while, and no screen sent either, so
    // every session the app could create was a drill and readiness could
    // never leave "needs evaluation" through normal use.
    const user = userEvent.setup();
    renderSetup('/exam-setup?kind=mock');

    const start = await screen.findByRole('button', { name: 'Start mock' });
    await waitFor(() => expect(start).toBeEnabled());
    await user.click(start);

    await waitFor(() => expect(mockStartExam).toHaveBeenCalled());
    expect(mockStartExam.mock.calls[0][0]).toMatchObject({
      session_kind: 'mock', subject_id: 1, exam_mode: 'timed',
      total_questions: 80, time_allowed_minutes: 60, passing_percentage: 85, question_source: 'all',
    });
    expect(await screen.findByText('exam runner')).toBeInTheDocument();
  });

  it('states the profile, the pass line and where the paper comes from', async () => {
    renderSetup();

    expect(await screen.findByRole('heading', { name: 'Exam Setup' })).toBeInTheDocument();
    expect(screen.getByText('68')).toBeInTheDocument(); // to pass: ceil(80 × 85%)
    expect(await screen.findByText('500 available · 80 needed')).toBeInTheDocument();
    expect(screen.getByText('3 unread misses · 12 due from memory')).toBeInTheDocument();
    expect(screen.getByText('No roadmap linked to this preparation')).toBeInTheDocument();

    const weights = screen.getByRole('table', { name: 'Questions per domain' });
    expect(within(weights).getByText('Scrum Framework')).toBeInTheDocument();
    expect(within(weights).getByText('48')).toBeInTheDocument();
  });

  it('draws from the chosen source, with that source\'s own count', async () => {
    const user = userEvent.setup();
    renderSetup();

    const unseen = await screen.findByRole('button', { name: /Unseen only/ });
    expect(await within(unseen).findByText(/120 questions/)).toBeInTheDocument();
    await user.click(unseen);
    expect(unseen).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Start mock' }));

    await waitFor(() => expect(mockStartExam).toHaveBeenCalled());
    expect(mockStartExam.mock.calls[0][0]).toMatchObject({ question_source: 'unseen' });
  });

  it('will not start a paper the bank cannot fill, and says why first', async () => {
    mockPreview.mockResolvedValue(preview({
      can_start: false, reason: 'A Scrum / PSM I mock is 80 questions and only 12 are available.',
      available: 0, will_draw: 0, domain_plan: [],
    }));
    renderSetup();

    expect((await screen.findAllByText(/only 12 are available/)).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Start mock' })).toBeDisabled();
  });

  it('offers to resume an open mock, and discards it only after asking', async () => {
    const user = userEvent.setup();
    mockHome.mockResolvedValue({
      per_subject: [{
        subject_id: 1, unreviewed: 0,
        resumable: { session_id: 55, title: 'Open', session_kind: 'mock', answered: 23, total: 80, seconds_remaining: 1902 },
      }],
    });
    renderSetup();

    expect(await screen.findByText(/23 of 80 answered · .* remaining/)).toBeInTheDocument();
    const start = screen.getByRole('button', { name: 'Start mock' });
    await waitFor(() => expect(start).toBeEnabled());
    await user.click(start);

    const dialog = await screen.findByRole('dialog');
    expect(mockDiscard).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Discard and start' }));

    await waitFor(() => expect(mockDiscard).toHaveBeenCalledWith(55));
    expect(mockStartExam).toHaveBeenCalled();
  });

  it('lists previous mocks judged against the pass mark', async () => {
    renderSetup();

    const table = await screen.findByRole('table', { name: 'Previous mocks' });
    expect(within(table).getByText('88%')).toBeInTheDocument();
    expect(within(table).getByText('Pass')).toBeInTheDocument();
    expect(within(table).getByText('47:31')).toBeInTheDocument();
    expect(within(table).getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/exam-review/41');
  });

  it('has no mock for a preparation without an exam', async () => {
    mockGetSubjects.mockResolvedValue([SKILL]);
    renderSetup('/exam-setup?kind=mock');

    expect(await screen.findByRole('heading', { name: 'System Design is a skill, not an exam' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start mock' })).not.toBeInTheDocument();
  });

  it('follows the preparation picked in the header, not the address', async () => {
    mockPreparation.mockReturnValue({ selectedId: 3, selected: SKILL });
    renderSetup('/exam-setup?kind=mock&subject=1');

    expect(await screen.findByRole('heading', { name: 'System Design is a skill, not an exam' })).toBeInTheDocument();
  });
});

describe('Drill setup', () => {
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

  // Home's topic rows link here with ?topic=. The topic used to be dropped the
  // same way the domain once was.
  it('actually drills the topic it was sent to drill', async () => {
    const user = userEvent.setup();
    renderSetup('/exam-setup?kind=drill&subject=1&topic=Daily%20Scrum');

    expect(await screen.findByRole('heading', { name: 'Daily Scrum' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Drill Daily Scrum/ }));

    await waitFor(() => expect(mockStartExam).toHaveBeenCalled());
    expect(mockStartExam.mock.calls[0][0]).toMatchObject({ topics: ['Daily Scrum'], subject_id: 1 });
  });

  it('leads with intent rather than with configuration', async () => {
    renderSetup('/exam-setup?kind=drill');

    await screen.findByRole('button', { name: /Practise/ });
    // Question count, difficulty and topic are all reachable, and none of
    // them is on screen until asked for.
    expect(screen.queryByText('Scrum Events')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Number of questions')).not.toBeInTheDocument();
  });

  it('narrows a drill by topic and difficulty when asked', async () => {
    const user = userEvent.setup();
    renderSetup('/exam-setup?kind=drill');

    await user.click(await screen.findByRole('button', { name: /More options/ }));
    await user.click(await screen.findByText('Scrum Events'));
    await user.click(screen.getByText('hard'));
    await user.click(screen.getByRole('button', { name: /Practise/ }));

    await waitFor(() => expect(mockStartExam).toHaveBeenCalled());
    expect(mockStartExam.mock.calls[0][0]).toMatchObject({
      topics: ['Scrum Events'], difficulties: ['hard'],
    });
    expect(mockGetFilters).toHaveBeenCalledWith(1);
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
