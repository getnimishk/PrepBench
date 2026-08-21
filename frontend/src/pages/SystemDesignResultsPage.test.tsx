import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SystemDesignResultsPage } from './SystemDesignResultsPage';

const mockGetAttempt = vi.fn();

vi.mock('../services/api', () => ({
  getSystemDesignAttempt: (...args: any[]) => mockGetAttempt(...args),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/system-design/attempts/1']}>
      <Routes>
        <Route path="/system-design/attempts/:attemptId" element={<SystemDesignResultsPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SystemDesignResultsPage', () => {
  it('renders full scores, strengths, and improvements when graded', async () => {
    mockGetAttempt.mockResolvedValue({
      id: 1,
      prompt_id: 1,
      answer_text: 'My answer',
      target_role: null,
      overall_score: 72,
      category_scores: [
        { category: 'Requirements Clarification', score: 7, max_score: 10, feedback: 'Good clarity.' },
      ],
      strengths: ['Clear structure'],
      improvements: ['Discuss scaling more'],
      summary: 'Solid attempt.',
      grading_status: 'graded',
      grading_error: null,
      time_spent_seconds: 120,
      created_at: '',
      prompt: { id: 1, title: 'Design a URL Shortener', prompt_text: '', category: 'Distributed Systems', difficulty: 'easy', is_ai_generated: false, created_at: '' },
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('72%')).toBeInTheDocument());
    expect(screen.getByText('Requirements Clarification')).toBeInTheDocument();
    expect(screen.getByText('Clear structure')).toBeInTheDocument();
    expect(screen.getByText('Discuss scaling more')).toBeInTheDocument();
    expect(screen.getByText('Solid attempt.')).toBeInTheDocument();
  });

  it('shows an unavailable alert and no score UI when ungraded', async () => {
    mockGetAttempt.mockResolvedValue({
      id: 2,
      prompt_id: 1,
      answer_text: 'My answer',
      target_role: null,
      overall_score: null,
      category_scores: [],
      strengths: [],
      improvements: [],
      summary: null,
      grading_status: 'unavailable',
      grading_error: 'No AI provider is set up yet. Add one in Settings -> AI Providers to get feedback.',
      time_spent_seconds: 30,
      created_at: '',
      prompt: { id: 1, title: 'Design a URL Shortener', prompt_text: '', category: 'Distributed Systems', difficulty: 'easy', is_ai_generated: false, created_at: '' },
    });

    renderPage();

    await waitFor(() => expect(screen.getByText(/not graded/i)).toBeInTheDocument());
    // No fabricated score UI anywhere.
    expect(screen.queryByText('%')).not.toBeInTheDocument();
    expect(screen.queryByText('Category Breakdown')).not.toBeInTheDocument();
  });
});
