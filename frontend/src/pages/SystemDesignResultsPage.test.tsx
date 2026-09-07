// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SystemDesignResultsPage } from './SystemDesignResultsPage';

const mockGetAttempt = vi.fn();
const mockGetHistory = vi.fn();

vi.mock('../services/api', () => ({
  getSystemDesignAttempt: (...args: any[]) => mockGetAttempt(...args),
  getSystemDesignPromptAttempts: (...args: any[]) => mockGetHistory(...args),
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
  // One attempt: nothing to compare, so the section stays out of the way.
  mockGetHistory.mockResolvedValue({
    prompt_id: 1, prompt_title: 'Design a URL Shortener', items: [], graded_count: 0,
  });
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

  /**
   * "Am I improving at this?" was a question the product stored the answer to
   * and never asked: GET /system-design/attempts shipped with the feature and
   * no page ever called it.
   */
  describe('attempt history', () => {
    const graded = (over: Record<string, unknown> = {}) => ({
      id: 1, prompt_id: 1, answer_text: 'My answer', target_role: null,
      overall_score: 72, category_scores: [], strengths: [], improvements: [],
      summary: null, grading_status: 'graded', grading_error: null,
      time_spent_seconds: 900, created_at: '2026-09-05T10:00:00',
      prompt: { id: 1, title: 'Design a URL Shortener' },
      ...over,
    });

    it('says nothing at all when there is only one attempt', async () => {
      mockGetAttempt.mockResolvedValue(graded());
      mockGetHistory.mockResolvedValue({
        prompt_id: 1, prompt_title: 'x', graded_count: 1,
        items: [{
          attempt_id: 1, created_at: '2026-09-05T10:00:00',
          grading_status: 'graded', overall_score: 72, change_vs_previous: null,
        }],
      });
      renderPage();

      await screen.findByText('Design a URL Shortener');
      expect(screen.queryByText(/Your attempts at this prompt/)).not.toBeInTheDocument();
    });

    it('shows the change between two graded attempts', async () => {
      mockGetAttempt.mockResolvedValue(graded());
      mockGetHistory.mockResolvedValue({
        prompt_id: 1, prompt_title: 'x', graded_count: 2,
        items: [
          { attempt_id: 1, created_at: '2026-09-05T10:00:00', grading_status: 'graded', overall_score: 72, change_vs_previous: 22 },
          { attempt_id: 2, created_at: '2026-08-20T10:00:00', grading_status: 'graded', overall_score: 50, change_vs_previous: null },
        ],
      });
      renderPage();

      expect(await screen.findByText(/Your attempts at this prompt/)).toBeInTheDocument();
      expect(screen.getByText('+22 pts')).toBeInTheDocument();
      expect(screen.getByText('This one')).toBeInTheDocument();
    });

    // A line drawn through a missing number is a fabricated trend, which is
    // the same defect as a fabricated score one step further from where
    // anyone would look for it.
    it('refuses to compare when the earlier attempt was never graded', async () => {
      mockGetAttempt.mockResolvedValue(graded());
      mockGetHistory.mockResolvedValue({
        prompt_id: 1, prompt_title: 'x', graded_count: 1,
        items: [
          { attempt_id: 1, created_at: '2026-09-05T10:00:00', grading_status: 'graded', overall_score: 72, change_vs_previous: null },
          { attempt_id: 2, created_at: '2026-08-20T10:00:00', grading_status: 'error', overall_score: null, change_vs_previous: null },
        ],
      });
      renderPage();

      expect(await screen.findByText(/Your attempts at this prompt/)).toBeInTheDocument();
      expect(screen.queryByText(/pts$/)).not.toBeInTheDocument();
      expect(
        screen.getByText(/Only one of these was graded, so there is nothing to compare it with yet/)
      ).toBeInTheDocument();
    });
  });
});
