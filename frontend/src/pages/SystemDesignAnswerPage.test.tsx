import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SystemDesignAnswerPage } from './SystemDesignAnswerPage';

const mockGetPrompt = vi.fn();
const mockSubmit = vi.fn();

vi.mock('../services/api', () => ({
  getSystemDesignPrompt: (...args: any[]) => mockGetPrompt(...args),
  submitSystemDesignAttempt: (...args: any[]) => mockSubmit(...args),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/system-design/1/answer']}>
      <Routes>
        <Route path="/system-design/:promptId/answer" element={<SystemDesignAnswerPage />} />
        <Route path="/system-design/attempts/:attemptId" element={<div>Results Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetPrompt.mockResolvedValue({
    id: 1,
    title: 'Design a URL Shortener',
    prompt_text: 'Design a URL shortener that scales.',
    category: 'Distributed Systems',
    difficulty: 'easy',
    is_ai_generated: false,
    created_at: '',
  });
});

describe('SystemDesignAnswerPage', () => {
  it('blocks submission when the answer is empty', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Design a URL Shortener')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /submit for feedback/i })).toBeDisabled();
  });

  it('submits the answer and navigates to the results page', async () => {
    const user = userEvent.setup();
    mockSubmit.mockResolvedValue({ id: 42, grading_status: 'graded' });
    renderPage();
    await waitFor(() => expect(screen.getByText('Design a URL Shortener')).toBeInTheDocument());

    await user.type(screen.getByLabelText('Your Answer'), 'A thorough design answer.');
    const submitBtn = screen.getByRole('button', { name: /submit for feedback/i });
    expect(submitBtn).not.toBeDisabled();
    await user.click(submitBtn);

    await waitFor(() => expect(screen.getByText('Results Page')).toBeInTheDocument());
    expect(mockSubmit).toHaveBeenCalledWith(expect.objectContaining({
      prompt_id: 1,
      answer_text: 'A thorough design answer.',
    }));
  });
});
