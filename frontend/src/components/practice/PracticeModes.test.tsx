// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

/**
 * The practice formats.
 *
 * What these hold: each panel shows what the server says the session would draw,
 * starts exactly the request it previewed, and says why when the server would
 * refuse -- before the button, not after it. Custom's controls have to change
 * the request, or they are decoration.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CustomPractice, FullMock, SpacedRepetition, WeakTopicFocus } from './PracticeModes';
import type { Subject } from '../../types/subject';
import type { ExamPreview } from '../../types/exam';

const mockPreview = vi.fn();
const mockStart = vi.fn();
const mockFocus = vi.fn();
const mockFilters = vi.fn();
const mockDeck = vi.fn();

vi.mock('../../services/api', () => ({
  previewExam: (...a: any[]) => mockPreview(...a),
  startExam: (...a: any[]) => mockStart(...a),
  getFocusTopics: (...a: any[]) => mockFocus(...a),
  getQuestionFilters: (...a: any[]) => mockFilters(...a),
  getSpacedDeck: (...a: any[]) => mockDeck(...a),
}));

const PSM: Subject = {
  id: 4,
  name: 'Scrum / PSM I',
  slug: 'psm-i',
  kind: 'certification',
  pass_mark: 85,
  exam_question_count: 80,
  exam_minutes: 60,
  has_exam_profile: true, is_archived: false, display_order: 100,
  question_count: 500,
  readiness: {
    state: 'almost_there', mock_count: 3, pass_mark: 85, recent_scores: [80, 82, 84],
    latest_taken_at: '2026-09-01T10:00:00', is_stale: false, domains: [],
    weakest_domain: null, points_per_mock: null, mocks_to_pass_estimate: null,
    blockers: [], most_improved: null,
  },
};

const SKILL: Subject = {
  ...PSM, id: 9, name: 'System Design', kind: 'skill',
  pass_mark: null, exam_question_count: null, exam_minutes: null, has_exam_profile: false,
};

const preview = (over: Partial<ExamPreview> = {}): ExamPreview => ({
  can_start: true, reason: null, available: 30, will_draw: 8,
  previously_missed: 5, due_for_review: 3, never_attempted: 20, answered_correctly: 2,
  ...over,
});

const refusal = (reason: string): ExamPreview => preview({
  can_start: false, reason, available: 0, will_draw: 0,
  previously_missed: 0, due_for_review: 0, never_attempted: 0, answered_correctly: 0,
});

const renderIn = (ui: React.ReactElement) =>
  render(
    <MemoryRouter initialEntries={['/practice']}>
      <Routes>
        <Route path="/practice" element={ui} />
        <Route path="/exam/:sessionId" element={<div>exam runner</div>} />
        <Route path="/practice/spaced" element={<div>card runner</div>} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockPreview.mockResolvedValue(preview());
  mockStart.mockResolvedValue({ id: 321 });
  mockFocus.mockResolvedValue([]);
  mockFilters.mockResolvedValue({
    certifications: [], domains: ['Scrum Events', 'Scrum Roles'], topics: [], difficulties: ['easy', 'hard'],
  });
});

describe('Weak topic focus', () => {
  it('shows what the session would draw and starts exactly that request', async () => {
    const user = userEvent.setup();
    mockFocus.mockResolvedValue([{ topic: 'Sprint Review', answered: 6, correct: 2, accuracy_percentage: 33.3 }]);
    renderIn(<WeakTopicFocus subject={PSM} />);

    expect(await screen.findByRole('heading', { name: '8 questions from your weakest topics' })).toBeInTheDocument();
    expect(screen.getByText(/5 missed before · 3 due for review · 20 never attempted/)).toBeInTheDocument();
    expect(await screen.findByText('Sprint Review')).toBeInTheDocument();
    expect(mockFocus).toHaveBeenCalledWith(PSM.id);

    await user.click(screen.getByRole('button', { name: 'Start 8 questions' }));

    const previewed = mockPreview.mock.calls[0][0];
    expect(previewed).toMatchObject({ exam_mode: 'weak_topic', subject_id: PSM.id, session_kind: 'drill' });
    expect(mockStart).toHaveBeenCalledWith(previewed);
    expect(await screen.findByText('exam runner')).toBeInTheDocument();
  });

  it('says why there is nothing to focus on instead of offering a button', async () => {
    mockPreview.mockResolvedValue(refusal('Nothing in Scrum / PSM I is measurably weak yet. Sit a mock.'));
    renderIn(<WeakTopicFocus subject={PSM} />);

    expect(await screen.findByText(/measurably weak yet/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Start/ })).not.toBeInTheDocument();
  });
});

describe('Spaced repetition', () => {
  const card = (id: number) => ({
    question_id: id, question_text: `Card ${id}`, is_multiple: false, answer: ['Right'],
    due_since: '2026-09-12T08:00:00', repetition: 1, intervals: { again: 1, hard: 6, good: 6, easy: 7 },
  });

  it("counts this preparation's due cards and opens the card runner", async () => {
    const user = userEvent.setup();
    mockDeck.mockResolvedValue({ cards: Array.from({ length: 8 }, (_, i) => card(i + 1)), due_total: 12 });
    renderIn(<SpacedRepetition subject={PSM} />);

    expect(await screen.findByText('12 due today')).toBeInTheDocument();
    expect(mockDeck).toHaveBeenCalledWith(PSM.id);
    await user.click(screen.getByRole('button', { name: 'Review 8 now' }));

    expect(await screen.findByText('card runner')).toBeInTheDocument();
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('treats nothing due as the system working', async () => {
    mockDeck.mockResolvedValue({ cards: [], due_total: 0 });
    renderIn(<SpacedRepetition subject={PSM} />);

    expect(await screen.findByText('0 due today')).toBeInTheDocument();
    expect(screen.getByText(/That is the system working, not a missed day/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Review/ })).not.toBeInTheDocument();
  });
});

describe('Custom', () => {
  it("offers this preparation's own domains", async () => {
    renderIn(<CustomPractice subject={PSM} />);

    await screen.findByText(/will be drawn from the 30 that match/);
    expect(mockFilters).toHaveBeenCalledWith(PSM.id);
  });

  it('changes the session when a filter changes, and starts the changed one', async () => {
    const user = userEvent.setup();
    renderIn(<CustomPractice subject={PSM} />);
    await screen.findByText(/will be drawn from the 30 that match/);

    mockPreview.mockResolvedValue(preview({ available: 6, will_draw: 6, never_attempted: 6, previously_missed: 0, due_for_review: 0, answered_correctly: 0 }));
    await user.click(screen.getByRole('combobox', { name: 'Domain' }));
    await user.click(await screen.findByRole('option', { name: 'Scrum Roles' }));

    expect(await screen.findByText(/will be drawn from the 6 that match/)).toBeInTheDocument();
    const last = mockPreview.mock.calls[mockPreview.mock.calls.length - 1][0];
    expect(last).toMatchObject({ domains: ['Scrum Roles'], subject_id: PSM.id, total_questions: 10 });

    await user.click(screen.getByRole('button', { name: 'Start set' }));
    expect(mockStart).toHaveBeenCalledWith(last);
  });

  it('will not start from a count it cannot use', async () => {
    const user = userEvent.setup();
    renderIn(<CustomPractice subject={PSM} />);
    await screen.findByText(/will be drawn from the 30 that match/);

    const count = screen.getByRole('spinbutton', { name: 'Question count' });
    await user.clear(count);
    await user.type(count, '500');

    expect(await screen.findByText('A whole number from 1 to 50')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start set' })).toBeDisabled();
  });

  it("shows the engine's refusal and keeps Start disabled", async () => {
    mockPreview.mockResolvedValue(refusal('No questions match those filters: Scrum / PSM I; difficulty hard.'));
    renderIn(<CustomPractice subject={PSM} />);

    expect(await screen.findByText(/No questions match those filters/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start set' })).toBeDisabled());
  });

  it('allows searching and selecting a topic from the autocomplete', async () => {
    mockFilters.mockResolvedValue({
      certifications: [],
      domains: ['Understanding and Applying the Scrum Framework'],
      topics: [
        'Anti-pattern recognition (Story Points / Sprint 0 traps)',
        'Empirical forecasting (NOT story points)',
        'Sprint Retrospective purpose',
      ],
      difficulties: ['easy', 'medium', 'hard'],
    });
    const user = userEvent.setup();
    renderIn(<CustomPractice subject={PSM} />);

    const topicInput = await screen.findByRole('combobox', { name: 'Topic' });
    await user.type(topicInput, 'story points');

    const options = await screen.findAllByRole('option');
    expect(options.length).toBe(2);
    expect(options[0].textContent).toContain('Story Points / Sprint 0 traps');

    await user.click(options[0]);
    expect(topicInput).toHaveValue('Anti-pattern recognition (Story Points / Sprint 0 traps)');

    await waitFor(() => {
      const calls = mockPreview.mock.calls;
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall).toMatchObject({
        topics: ['Anti-pattern recognition (Story Points / Sprint 0 traps)'],
        subject_id: PSM.id,
      });
    });
  });
});

describe('Full mock', () => {
  it('states the paper from the exam profile and starts it', async () => {
    const user = userEvent.setup();
    renderIn(<FullMock subject={PSM} />);

    expect(screen.getByText('80')).toBeInTheDocument();
    expect(screen.getByText('60 minutes')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Exam setup' }))
      .toHaveAttribute('href', `/exam-setup?kind=mock&subject=${PSM.id}`);

    const start = screen.getByRole('button', { name: 'Start full mock' });
    await waitFor(() => expect(start).toBeEnabled());
    await user.click(start);

    expect(mockStart).toHaveBeenCalledWith(expect.objectContaining({
      session_kind: 'mock', exam_mode: 'timed', total_questions: 80, time_allowed_minutes: 60, subject_id: PSM.id,
    }));
  });

  it('says a bank too small for the paper cannot sit it, before Start is pressed', async () => {
    mockPreview.mockResolvedValue(refusal('A Scrum / PSM I mock is 80 questions and only 12 are available.'));
    renderIn(<FullMock subject={PSM} />);

    expect(await screen.findByText(/only 12 are available/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start full mock' })).toBeDisabled();
  });

  it('has no mock for a preparation without an exam', () => {
    renderIn(<FullMock subject={SKILL} />);

    expect(screen.getByRole('heading', { name: 'System Design has no exam' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start full mock' })).not.toBeInTheDocument();
    expect(mockPreview).not.toHaveBeenCalled();
  });
});
