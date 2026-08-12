import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ExamSetupPage } from './ExamSetupPage';

const mockStartExam = vi.fn();
const mockGetQuestionFilters = vi.fn();
const mockGetSettings = vi.fn();

vi.mock('../services/api', () => ({
  startExam: (...args: any[]) => mockStartExam(...args),
  getQuestionFilters: (...args: any[]) => mockGetQuestionFilters(...args),
  getSettings: (...args: any[]) => mockGetSettings(...args),
}));

function renderPage(initialPath = '/exam-setup') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/exam-setup" element={<ExamSetupPage />} />
        <Route path="/exam/:sessionId" element={<div>Exam Runner Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetQuestionFilters.mockResolvedValue({
    certifications: ['AWS SAA'],
    topics: ['IAM', 'VPC'],
    difficulties: ['easy', 'medium', 'hard'],
  });
  mockGetSettings.mockResolvedValue({
    default_exam_mode: 'practice',
    default_questions_count: 40,
    default_passing_percentage: 80,
    shuffle_questions: true,
    shuffle_options: true,
  });
});

describe('ExamSetupPage', () => {
  it('defaults to the mode from settings when no ?mode query param is present', async () => {
    renderPage('/exam-setup');
    // Practice mode card should be selected (highlighted) once settings load --
    // verified indirectly through the Time Limit slider, which only renders in 'timed' mode.
    await waitFor(() => expect(screen.getByText('IAM')).toBeInTheDocument());
    expect(screen.queryByText(/Time Limit:/i)).not.toBeInTheDocument();
  });

  it('respects an explicit ?mode= query param over the settings default', async () => {
    renderPage('/exam-setup?mode=timed');
    await waitFor(() => expect(screen.getByText(/Time Limit:/i)).toBeInTheDocument());
  });

  it('renders dynamic topic filters fetched from the question bank', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('IAM')).toBeInTheDocument());
    expect(screen.getByText('VPC')).toBeInTheDocument();
  });

  it('starts an exam with the selected topics/difficulties and navigates to the runner', async () => {
    const user = userEvent.setup();
    mockStartExam.mockResolvedValue({ id: 42 });
    renderPage();

    await waitFor(() => expect(screen.getByText('IAM')).toBeInTheDocument());
    await user.click(screen.getByText('IAM'));
    await user.click(screen.getByText('EASY'));

    await user.click(screen.getByRole('button', { name: /launch exam/i }));

    await waitFor(() => {
      expect(mockStartExam).toHaveBeenCalledWith(
        expect.objectContaining({
          topics: ['IAM'],
          difficulties: ['easy'],
        })
      );
    });
    await waitFor(() => expect(screen.getByText('Exam Runner Page')).toBeInTheDocument());
  });

  it('shows an inline error and does not navigate when starting the exam fails', async () => {
    const user = userEvent.setup();
    mockStartExam.mockRejectedValue({ response: { data: { detail: 'No questions match your filter criteria.' } } });
    renderPage();

    await waitFor(() => expect(screen.getByText('IAM')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /launch exam/i }));

    await waitFor(() => expect(screen.getByText('No questions match your filter criteria.')).toBeInTheDocument());
    expect(screen.queryByText('Exam Runner Page')).not.toBeInTheDocument();
  });
});
