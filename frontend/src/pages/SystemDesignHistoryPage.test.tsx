import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SystemDesignHistoryPage } from './SystemDesignHistoryPage';

const mockGetAttempts = vi.fn();

vi.mock('../services/api', () => ({
  getSystemDesignAttempts: (...args: any[]) => mockGetAttempts(...args),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/system-design/history']}>
      <Routes>
        <Route path="/system-design/history" element={<SystemDesignHistoryPage />} />
        <Route path="/system-design/attempts/:attemptId" element={<div>Results Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SystemDesignHistoryPage', () => {
  it('shows an empty state when there are no attempts', async () => {
    mockGetAttempts.mockResolvedValue({ items: [], total: 0, skip: 0, limit: 200 });
    renderPage();
    await waitFor(() => expect(screen.getByText(/No System Design attempts yet/i)).toBeInTheDocument());
  });

  it('lists graded and ungraded attempts with their real status, not a fabricated score', async () => {
    mockGetAttempts.mockResolvedValue({
      total: 2,
      skip: 0,
      limit: 200,
      items: [
        {
          id: 2,
          prompt_id: 1,
          answer_text: '...',
          target_role: 'Staff SRE',
          overall_score: 78,
          category_scores: [],
          strengths: [],
          improvements: [],
          summary: null,
          grading_status: 'graded',
          grading_error: null,
          time_spent_seconds: 600,
          created_at: '2026-01-02T00:00:00',
          prompt: { id: 1, title: 'Design a URL Shortener', prompt_text: '', category: 'Distributed Systems', difficulty: 'easy', is_ai_generated: false, created_at: '' },
        },
        {
          id: 1,
          prompt_id: 3,
          answer_text: '...',
          overall_score: null,
          category_scores: [],
          strengths: [],
          improvements: [],
          summary: null,
          grading_status: 'unavailable',
          grading_error: null,
          time_spent_seconds: 300,
          created_at: '2026-01-01T00:00:00',
          prompt: { id: 3, title: 'Design a Rate Limiter', prompt_text: '', category: 'Distributed Systems', difficulty: 'medium', is_ai_generated: false, created_at: '' },
        },
      ],
    });
    renderPage();

    await waitFor(() => expect(screen.getByText('Design a URL Shortener')).toBeInTheDocument());
    expect(screen.getByText('78%')).toBeInTheDocument();
    expect(screen.getByText('Staff SRE')).toBeInTheDocument();

    expect(screen.getByText('Design a Rate Limiter')).toBeInTheDocument();
    expect(screen.getByText('Not Graded')).toBeInTheDocument();
    // The ungraded row must not show a fabricated percentage anywhere.
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('navigates to the attempt Results page when View is clicked', async () => {
    const user = userEvent.setup();
    mockGetAttempts.mockResolvedValue({
      total: 1,
      skip: 0,
      limit: 200,
      items: [{
        id: 5,
        prompt_id: 1,
        answer_text: '...',
        overall_score: 90,
        category_scores: [],
        strengths: [],
        improvements: [],
        summary: null,
        grading_status: 'graded',
        grading_error: null,
        time_spent_seconds: 120,
        created_at: '2026-01-03T00:00:00',
        prompt: { id: 1, title: 'Design a Chat App', prompt_text: '', category: 'Real-Time', difficulty: 'hard', is_ai_generated: false, created_at: '' },
      }],
    });
    renderPage();

    await waitFor(() => expect(screen.getByText('Design a Chat App')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /view/i }));
    await waitFor(() => expect(screen.getByText('Results Page')).toBeInTheDocument());
  });

  it('shows a retry-able error state on fetch failure', async () => {
    const user = userEvent.setup();
    mockGetAttempts.mockRejectedValue(new Error('network error'));
    renderPage();

    await waitFor(() => expect(screen.getByText(/Failed to load System Design history/i)).toBeInTheDocument());
    mockGetAttempts.mockResolvedValue({ items: [], total: 0, skip: 0, limit: 200 });
    await user.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(screen.getByText(/No System Design attempts yet/i)).toBeInTheDocument());
  });
});
