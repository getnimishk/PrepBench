import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ExamReviewPage } from './ExamReviewPage';
import { ExamDetail } from '../types/exam';

const mockGetExamDetails = vi.fn();

vi.mock('../services/api', () => ({
  getExamDetails: (...args: any[]) => mockGetExamDetails(...args),
}));

function makeExamDetail(): ExamDetail {
  const questions = [1, 2, 3].map((n) => ({
    id: n,
    text: `Question ${n} text`,
    question_type: 'single_choice' as const,
    difficulty: 'medium' as const,
    domain: 'Test Domain',
    topic: 'Test Topic',
    certification: 'Test Cert',
    tags: [],
    created_at: '',
    updated_at: '',
    is_reviewed: false,
    explanation: `Explanation for ${n}`,
    options: [
      { id: n * 10 + 1, option_text: 'Option A', is_correct: true },
      { id: n * 10 + 2, option_text: 'Option B', is_correct: false },
    ],
  }));

  return {
    id: 1,
    title: 'AWS SAA Practice Exam',
    exam_mode: 'practice',
    status: 'completed',
    total_questions: 3,
    answered_questions: 2,
    correct_count: 1,
    score_percentage: 33,
    passing_percentage: 70,
    is_passed: 'failed',
    time_spent_seconds: 300,
    current_question_index: 0,
    question_ids_order: [1, 2, 3],
    start_time: new Date().toISOString(),
    answers: [
      // Q1: answered correctly
      { id: 1, session_id: 1, question_id: 1, selected_option_ids: [11], is_correct: true, time_spent_seconds: 30, confidence_level: 'high', is_flagged: false, is_bookmarked: false },
      // Q2: answered incorrectly
      { id: 2, session_id: 1, question_id: 2, selected_option_ids: [22], is_correct: false, time_spent_seconds: 45, confidence_level: 'low', is_flagged: false, is_bookmarked: false },
      // Q3: unanswered but flagged
      { id: 3, session_id: 1, question_id: 3, selected_option_ids: [], is_correct: false, time_spent_seconds: 0, confidence_level: 'not_set', is_flagged: true, is_bookmarked: false },
    ],
    questions,
  };
}

function renderPage(sessionId = '1') {
  return render(
    <MemoryRouter initialEntries={[`/exam-review/${sessionId}`]}>
      <Routes>
        <Route path="/exam-review/:sessionId" element={<ExamReviewPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetExamDetails.mockResolvedValue(makeExamDetail());
  vi.stubGlobal('open', vi.fn());
});

describe('ExamReviewPage', () => {
  it('shows an error and skips fetching for an invalid session id', () => {
    renderPage('not-a-number');
    expect(screen.getByText(/Invalid Exam Session ID/i)).toBeInTheDocument();
    expect(mockGetExamDetails).not.toHaveBeenCalled();
  });

  it('renders the result hero with score, passing threshold, correct count and time', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('AWS SAA Practice Exam')).toBeInTheDocument());

    expect(screen.getByText('33%')).toBeInTheDocument();
    expect(screen.getByText('70%')).toBeInTheDocument();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByText(/Keep Practicing/i)).toBeInTheDocument();
  });

  it('filters the question list down to only incorrect answers', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText('Question 1 text')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /^Incorrect$/i }));

    // Q2 (wrong) and Q3 (unanswered) both count as "not correct" -- only those
    // two remain, and the currently-focused question resets to the first of them.
    expect(screen.getByText('Questions (2)')).toBeInTheDocument();
    expect(screen.getByText('Question 2 text')).toBeInTheDocument();
  });

  it('navigates between questions using the Next/Previous footer buttons', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText('Question 1 text')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await waitFor(() => expect(screen.getByText('Question 2 text')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /previous/i })).not.toBeDisabled();

    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await waitFor(() => expect(screen.getByText('Question 3 text')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /^next$/i })).toBeDisabled();
  });

  it('jumps directly to a question via the palette and shows its flagged marker', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText('Question 1 text')).toBeInTheDocument());

    await user.click(screen.getByText('3'));
    await waitFor(() => expect(screen.getByText('Question 3 text')).toBeInTheDocument());
    // "Flagged" also labels the filter toggle button, so the flagged chip on
    // the question header is the *second* match, not the only one.
    expect(screen.getAllByText('Flagged').length).toBeGreaterThanOrEqual(2);
  });

  it('opens PDF and Excel exports for this session in a new tab', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText('Question 1 text')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /pdf report/i }));
    expect(window.open).toHaveBeenCalledWith('/api/v1/export/pdf/1', '_blank', 'noopener,noreferrer');

    await user.click(screen.getByRole('button', { name: /excel report/i }));
    expect(window.open).toHaveBeenCalledWith('/api/v1/export/excel/1', '_blank', 'noopener,noreferrer');
  });

  it('shows a retry-able error state on fetch failure', async () => {
    const user = userEvent.setup();
    mockGetExamDetails.mockRejectedValue(new Error('network error'));
    renderPage();

    await waitFor(() => expect(screen.getByText(/Failed to load exam review details/i)).toBeInTheDocument());

    mockGetExamDetails.mockResolvedValue(makeExamDetail());
    await user.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(screen.getByText('Question 1 text')).toBeInTheDocument());
  });
});
