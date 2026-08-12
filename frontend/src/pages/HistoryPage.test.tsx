import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HistoryPage } from './HistoryPage';
import { ExamSession } from '../types/exam';

const mockGetExamList = vi.fn();

vi.mock('../services/api', () => ({
  getExamList: (...args: any[]) => mockGetExamList(...args),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/history']}>
      <Routes>
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/exam-review/:sessionId" element={<div>Exam Review Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('open', vi.fn());
});

describe('HistoryPage', () => {
  it('shows an empty state when there are no exam sessions', async () => {
    mockGetExamList.mockResolvedValue([]);
    renderPage();
    await waitFor(() => expect(screen.getByText(/No exam history yet/i)).toBeInTheDocument());
  });

  it('lists completed and in-progress sessions with their real status', async () => {
    const sessions: ExamSession[] = [
      {
        id: 1, title: 'AWS SAA Full Exam', exam_mode: 'timed', status: 'completed',
        total_questions: 80, answered_questions: 80, correct_count: 68,
        score_percentage: 85, passing_percentage: 70, is_passed: 'passed',
        time_spent_seconds: 3600, current_question_index: 79,
        question_ids_order: [], start_time: '2026-01-01T00:00:00', answers: [],
      },
      {
        id: 2, title: 'Weak Topic Drill', exam_mode: 'weak_topic', status: 'in_progress',
        total_questions: 20, answered_questions: 5, correct_count: 3,
        passing_percentage: 70, time_spent_seconds: 300, current_question_index: 5,
        question_ids_order: [], start_time: '2026-01-02T00:00:00', answers: [],
      },
    ];
    mockGetExamList.mockResolvedValue(sessions);
    renderPage();

    await waitFor(() => expect(screen.getByText('AWS SAA Full Exam')).toBeInTheDocument());
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('PASSED')).toBeInTheDocument();

    expect(screen.getByText('Weak Topic Drill')).toBeInTheDocument();
    expect(screen.getByText('IN_PROGRESS')).toBeInTheDocument();
    // An in-progress session has no score to show and its Review/PDF actions are disabled.
    const reviewButtons = screen.getAllByRole('button', { name: /review/i });
    expect(reviewButtons[1]).toBeDisabled();
  });

  it('navigates to the exam review page when Review is clicked on a completed session', async () => {
    const user = userEvent.setup();
    mockGetExamList.mockResolvedValue([{
      id: 7, title: 'GCP ACE Practice', exam_mode: 'practice', status: 'completed',
      total_questions: 50, answered_questions: 50, correct_count: 40,
      score_percentage: 80, passing_percentage: 70, is_passed: 'passed',
      time_spent_seconds: 1800, current_question_index: 49,
      question_ids_order: [], start_time: '2026-01-03T00:00:00', answers: [],
    }]);
    renderPage();

    await waitFor(() => expect(screen.getByText('GCP ACE Practice')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /^review$/i }));
    await waitFor(() => expect(screen.getByText('Exam Review Page')).toBeInTheDocument());
  });

  it('opens the PDF export for a completed session in a new tab', async () => {
    const user = userEvent.setup();
    mockGetExamList.mockResolvedValue([{
      id: 7, title: 'GCP ACE Practice', exam_mode: 'practice', status: 'completed',
      total_questions: 50, answered_questions: 50, correct_count: 40,
      score_percentage: 80, passing_percentage: 70, is_passed: 'passed',
      time_spent_seconds: 1800, current_question_index: 49,
      question_ids_order: [], start_time: '2026-01-03T00:00:00', answers: [],
    }]);
    renderPage();

    await waitFor(() => expect(screen.getByText('GCP ACE Practice')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /^pdf$/i }));
    expect(window.open).toHaveBeenCalledWith('/api/v1/export/pdf/7', '_blank', 'noopener,noreferrer');
  });

  it('shows a retry-able error state on fetch failure', async () => {
    const user = userEvent.setup();
    mockGetExamList.mockRejectedValue(new Error('network error'));
    renderPage();

    await waitFor(() => expect(screen.getByText(/Failed to load exam history/i)).toBeInTheDocument());
    mockGetExamList.mockResolvedValue([]);
    await user.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(screen.getByText(/No exam history yet/i)).toBeInTheDocument());
  });
});
