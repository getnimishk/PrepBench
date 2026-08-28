// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AnalyticsPage } from './AnalyticsPage';

const mockGetDomainPerformance = vi.fn();
const mockGetScoreTrends = vi.fn();
const mockGetSystemDesignAnalytics = vi.fn();
const mockGetRecordingAnalytics = vi.fn();

vi.mock('../services/api', () => ({
  getDomainPerformance: (...args: any[]) => mockGetDomainPerformance(...args),
  getScoreTrends: (...args: any[]) => mockGetScoreTrends(...args),
  getSystemDesignAnalytics: (...args: any[]) => mockGetSystemDesignAnalytics(...args),
  getRecordingAnalytics: (...args: any[]) => mockGetRecordingAnalytics(...args),
}));

// jsdom has no real <canvas> context, so Chart.js throws on any non-empty
// dataset regardless of which page renders it -- this predates this test
// file (ScoreTrendChart was never testable with real data before either).
// Mocked as an opaque leaf so this file can verify AnalyticsPage's own logic
// (tab switching, fetching, stat/empty-state rendering) without fighting an
// environment limitation unrelated to it.
vi.mock('../components/analytics/ScoreTrendChart', () => ({
  ScoreTrendChart: ({ trends }: { trends: any[] }) => (
    <div data-testid="score-trend-chart">{trends.length} points</div>
  ),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <AnalyticsPage />
    </MemoryRouter>
  );
}

const emptySdAnalytics = {
  total_attempts: 0, graded_count: 0, average_score: null,
  score_trend: [], category_averages: [], recent_attempts: [],
};

const emptyIpAnalytics = {
  total_recordings: 0, analyzed_count: 0, by_round: [], delivery_trend: [], weakest_content_category: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetDomainPerformance.mockResolvedValue([]);
  mockGetScoreTrends.mockResolvedValue([]);
  mockGetSystemDesignAnalytics.mockResolvedValue(emptySdAnalytics);
  mockGetRecordingAnalytics.mockResolvedValue(emptyIpAnalytics);
});

describe('AnalyticsPage', () => {
  it('defaults to the Exams tab and shows its empty state with zero data', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Score Trend & Rolling Average')).toBeInTheDocument());
    expect(screen.getByText(/Complete exams to see per-domain accuracy tracking/i)).toBeInTheDocument();
  });

  it('switching to System Design tab shows its empty state when there are zero graded attempts', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByRole('tab', { name: 'System Design' })).toBeInTheDocument());

    await user.click(screen.getByRole('tab', { name: 'System Design' }));
    await waitFor(() => expect(screen.getByText(/Complete a System Design practice attempt to see analytics here/i)).toBeInTheDocument());
  });

  it('switching to Interview Practice tab shows its empty state when nothing has been analyzed', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Interview Practice' })).toBeInTheDocument());

    await user.click(screen.getByRole('tab', { name: 'Interview Practice' }));
    await waitFor(() => expect(screen.getByText(/Complete and analyze an Interview Practice recording/i)).toBeInTheDocument());
  });

  it('populated System Design tab renders stats, category averages, and recent attempts', async () => {
    const user = userEvent.setup();
    mockGetSystemDesignAnalytics.mockResolvedValue({
      total_attempts: 3,
      graded_count: 2,
      average_score: 70,
      score_trend: [
        { date: 'Jan 1', score: 60, rolling_avg: 60, exam_title: 'Design a URL Shortener' },
        { date: 'Jan 2', score: 80, rolling_avg: 70, exam_title: 'Design a Rate Limiter' },
      ],
      category_averages: [
        { category: 'Requirements Clarification', score: 7, max_score: 10, feedback: 'Averaged across 2 graded attempts.' },
      ],
      recent_attempts: [
        { id: 2, prompt_title: 'Design a Rate Limiter', overall_score: 80, created_at: '2026-01-02' },
      ],
    });

    renderPage();
    await user.click(await screen.findByRole('tab', { name: 'System Design' }));

    await waitFor(() => expect(screen.getByText('70%')).toBeInTheDocument()); // average score stat
    expect(screen.getByText('3')).toBeInTheDocument(); // total attempts
    expect(screen.getByText('2', { selector: 'h4' })).toBeInTheDocument(); // graded count
    expect(screen.getByText('Requirements Clarification')).toBeInTheDocument();
    expect(screen.getByText('Design a Rate Limiter')).toBeInTheDocument();
  });

  it('populated Interview Practice tab renders per-round breakdown and weakest-category callout', async () => {
    const user = userEvent.setup();
    mockGetRecordingAnalytics.mockResolvedValue({
      total_recordings: 2,
      analyzed_count: 2,
      by_round: [
        { round_type: 'hr_screening', round_label: 'HR Screening', attempt_count: 0, avg_content_score_pct: null, avg_delivery_score_pct: null },
        { round_type: 'hiring_manager', round_label: 'Hiring Manager', attempt_count: 0, avg_content_score_pct: null, avg_delivery_score_pct: null },
        { round_type: 'system_design', round_label: 'System Design', attempt_count: 0, avg_content_score_pct: null, avg_delivery_score_pct: null },
        { round_type: 'behavioral', round_label: 'Behavioral', attempt_count: 1, avg_content_score_pct: 40, avg_delivery_score_pct: 80 },
      ],
      delivery_trend: [
        { date: 'Jan 1', score: 80, rolling_avg: 80, exam_title: 'Behavioral' },
      ],
      weakest_content_category: { category: 'STAR Structure', round_label: 'Behavioral', avg_score_pct: 40 },
    });

    renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Interview Practice' }));

    await waitFor(() => expect(screen.getByText(/Your weakest area:/i)).toBeInTheDocument());
    expect(screen.getByText('STAR Structure')).toBeInTheDocument();
    expect(screen.getAllByText('Behavioral').length).toBeGreaterThan(0); // appears in both the callout and the round card
    expect(screen.getByText('1 recording')).toBeInTheDocument();
    expect(screen.getAllByText(/Not yet graded/i).length).toBeGreaterThan(0); // the 3 rounds with no data
  });

  it('shows a retry-able error state per tab without crashing the others', async () => {
    const user = userEvent.setup();
    mockGetSystemDesignAnalytics.mockRejectedValue(new Error('network error'));

    renderPage();
    await user.click(await screen.findByRole('tab', { name: 'System Design' }));

    await waitFor(() => expect(screen.getByText(/Failed to load System Design analytics/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();

    // Exams tab (already loaded before switching) is unaffected.
    await user.click(screen.getByRole('tab', { name: 'Exams' }));
    expect(screen.getByText('Score Trend & Rolling Average')).toBeInTheDocument();
  });
});
