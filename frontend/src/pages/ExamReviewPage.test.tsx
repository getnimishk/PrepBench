// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ExamReviewPage } from './ExamReviewPage';
import { ExamDetail } from '../types/exam';

const mockGetExamDetails = vi.fn();
const mockMarkReviewed = vi.fn();
const mockGetSubject = vi.fn();

vi.mock('../services/api', () => ({
  getExamDetails: (...args: any[]) => mockGetExamDetails(...args),
  getSubject: (...args: any[]) => mockGetSubject(...args),
  markAnswerReviewed: (...args: any[]) => mockMarkReviewed(...args),
}));

/** The subject whose exam profile decides what "passed" means. */
const SUBJECT = {
  id: 1, name: 'Scrum / PSM I', slug: 'psm-i', kind: 'certification' as const,
  pass_mark: 85, exam_question_count: 80, exam_minutes: 60,
  has_exam_profile: true, question_count: 500,
  readiness: {
    state: 'almost_there' as const, mock_count: 6, pass_mark: 85,
    recent_scores: [87.5], latest_taken_at: null, is_stale: false, domains: [],
    weakest_domain: null, points_per_mock: null, mocks_to_pass_estimate: null,
    blockers: [], most_improved: null,
  },
};

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
    session_kind: 'drill',
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
  mockMarkReviewed.mockResolvedValue({ status: 'ok' });
  mockGetSubject.mockResolvedValue(SUBJECT);
  mockGetExamDetails.mockResolvedValue(makeExamDetail());
  vi.stubGlobal('open', vi.fn());
});

describe('ExamReviewPage', () => {
  it('shows an error and skips fetching for an invalid session id', () => {
    renderPage('not-a-number');
    expect(screen.getByText(/Invalid Exam Session ID/i)).toBeInTheDocument();
    expect(mockGetExamDetails).not.toHaveBeenCalled();
  });

  it('passes no verdict on a drill', async () => {
    // A drill is targeted practice, not a measurement. Scoring it against a
    // pass mark is the category error the whole mock/drill split exists to
    // prevent -- and it used to paint the page red for failing one.
    renderPage();

    expect(await screen.findByText(/33% on this drill/)).toBeInTheDocument();
    expect(screen.getByText(/not scored against a pass mark/i)).toBeInTheDocument();
    expect(screen.getByText('33%')).toBeInTheDocument();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.queryByText(/Keep Practicing/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Pass mark')).not.toBeInTheDocument();
  });

  it('judges a mock against the exam profile, not the threshold stored on it', async () => {
    // Session 12 in the working database scored 87.5% and carried
    // passing_percentage 95.0 -- the app's default the day it was sat, never
    // the PSM I pass mark. Home counted it as clearing 85%; this page called
    // it a failure. Two pages, one paper, opposite verdicts.
    mockGetExamDetails.mockResolvedValue({
      ...makeExamDetail(),
      session_kind: 'mock',
      subject_id: 1,
      score_percentage: 87.5,
      passing_percentage: 95,
      is_passed: 'failed',
    });
    renderPage();

    expect(await screen.findByText(/88% — above the pass mark/)).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
    // The stored threshold is shown rather than quietly dropped.
    expect(screen.getByText(/Sat with a 95% threshold set at the time/)).toBeInTheDocument();
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

  it('records a wrong answer as reviewed when it is put on screen', async () => {
    // The count on Home used to have no way down: the endpoint existed, the
    // column existed, and nothing in the browser ever called it. Reading the
    // explanation IS the review -- asking for a confirming click would be the
    // bookkeeping that produced the backlog in the first place.
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText('Question 1 text')).toBeInTheDocument());

    // Question 1 was answered correctly, so nothing is marked yet -- there is
    // no explanation to be behind on for an answer that was right.
    expect(mockMarkReviewed).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /^Incorrect$/i }));

    // Question 2 is the first wrong answer, and it is now on screen.
    await waitFor(() => expect(mockMarkReviewed).toHaveBeenCalledWith(1, 2));
  });
});
