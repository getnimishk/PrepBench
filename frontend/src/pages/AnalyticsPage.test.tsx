// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AnalyticsPage } from './AnalyticsPage';

const mockGetDomainPerformance = vi.fn();
const mockGetScoreTrends = vi.fn();
const mockGetSystemDesignAnalytics = vi.fn();
const mockGetRecordingAnalytics = vi.fn();
const mockGetSubjects = vi.fn();
const mockPreparation = vi.fn();

vi.mock('../context/PreparationContext', () => ({
  usePreparation: () => mockPreparation(),
}));

vi.mock('../services/api', () => ({
  getDomainPerformance: (...args: any[]) => mockGetDomainPerformance(...args),
  getScoreTrends: (...args: any[]) => mockGetScoreTrends(...args),
  getSystemDesignAnalytics: (...args: any[]) => mockGetSystemDesignAnalytics(...args),
  getRecordingAnalytics: (...args: any[]) => mockGetRecordingAnalytics(...args),
  getSubjects: (...args: any[]) => mockGetSubjects(...args),
}));

/** A subject with enough evidence for the exam tab to have a reading. */
const MEASURED = {
  id: 1, name: 'Scrum / PSM I', slug: 'psm-i', kind: 'certification' as const,
  pass_mark: 85, exam_question_count: 80, exam_minutes: 60, has_exam_profile: true, is_archived: false, display_order: 100, question_count: 500,
  readiness: {
    state: 'almost_there' as const, mock_count: 6, pass_mark: 85,
    recent_scores: [70, 82.5, 87.5, 92.5], latest_taken_at: null, is_stale: false,
    domains: [
      {
        domain: 'Managing Products with Agility',
        state: 'needs_work' as const, answered: 53, score_pct: 71.4,
      },
    ],
    weakest_domain: 'Managing Products with Agility', points_per_mock: 7.5,
    mocks_to_pass_estimate: null,
    blockers: [{
      kind: 'weak_domain' as const, domain: 'Managing Products with Agility',
      value: 71.4, target: 80, count: 53,
    }],
    most_improved: null,
  },
};

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
  mockGetSubjects.mockResolvedValue([]);
  // Nothing picked: the page falls back to the preparation with the most mocks.
  mockPreparation.mockReturnValue({ selectedId: null, selected: null });
});

describe('AnalyticsPage', () => {
  it('defaults to the Exams tab and says plainly that nothing is measured yet', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/Nothing measured yet/i)).toBeInTheDocument()
    );
    // No chart of an empty dataset and no card containing the words "no
    // data" -- the page says what is true and stops.
    expect(screen.queryByTestId('score-trend-chart')).not.toBeInTheDocument();
  });

  it('leads with the reading and puts the evidence under it', async () => {
    mockGetSubjects.mockResolvedValue([MEASURED]);
    renderPage();

    expect(await screen.findByText('What changed')).toBeInTheDocument();
    expect(screen.getByText(/rising about 7.5 points a mock/)).toBeInTheDocument();
    expect(screen.getByText('What is holding you back')).toBeInTheDocument();
    expect(
      screen.getByText(/Managing Products with Agility is at 71%, under the 80% floor/)
    ).toBeInTheDocument();
  });

  it('explains why its domain numbers differ from the ones on Home', async () => {
    // Both figures were right and neither said which population it counted,
    // so the two pages appeared to disagree about the same domain.
    mockGetSubjects.mockResolvedValue([MEASURED]);
    mockGetDomainPerformance.mockResolvedValue([
      {
        domain: 'Managing Products with Agility',
        total_attempted: 117, correct_count: 96, accuracy_percentage: 82.1,
      },
    ]);
    renderPage();

    expect(await screen.findByText('Everything you have ever answered')).toBeInTheDocument();
    expect(screen.getByText(/every Scrum \/ PSM I session, drills included/i)).toBeInTheDocument();
  });

  it('reads only the described preparation, and reads again when another is picked', async () => {
    const OTHER = { ...MEASURED, id: 2, name: 'AWS Solutions Architect', readiness: { ...MEASURED.readiness, mock_count: 1 } };
    mockGetSubjects.mockResolvedValue([MEASURED, OTHER]);
    mockPreparation.mockReturnValue({ selectedId: 1, selected: MEASURED });
    const view = renderPage();

    expect(await screen.findByText('What changed')).toBeInTheDocument();
    expect(mockGetDomainPerformance).toHaveBeenLastCalledWith(1);
    expect(mockGetScoreTrends).toHaveBeenLastCalledWith(1);
    expect(screen.getByText('Scrum / PSM I')).toBeInTheDocument();

    mockPreparation.mockReturnValue({ selectedId: 2, selected: OTHER });
    view.rerender(
      <MemoryRouter>
        <AnalyticsPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetDomainPerformance).toHaveBeenLastCalledWith(2));
    expect(mockGetScoreTrends).toHaveBeenLastCalledWith(2);
    expect(await screen.findByText('AWS Solutions Architect')).toBeInTheDocument();
  });

  it('opens an area from either list, for the preparation being described', async () => {
    mockGetSubjects.mockResolvedValue([MEASURED]);
    mockGetDomainPerformance.mockResolvedValue([
      { domain: 'Scrum Events', total_attempted: 40, correct_count: 30, accuracy_percentage: 75 },
    ]);
    renderPage();

    const row = await screen.findByRole('link', { name: /Scrum Events: 75%/ });
    expect(row).toHaveAttribute('href', '/analytics/area?subject=1&domain=Scrum%20Events');
    const verdictRow = screen.getByRole('link', { name: /Managing Products with Agility: 71%/ });
    expect(verdictRow).toHaveAttribute('href', '/analytics/area?subject=1&domain=Managing%20Products%20with%20Agility');
  });

  it('shows what the verdict rests on and what would change it', async () => {
    const user = userEvent.setup();
    mockGetSubjects.mockResolvedValue([MEASURED]);
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Why am I seeing this?' }));
    const panel = screen.getByRole('region', { name: 'Why am I seeing this' });
    expect(within(panel).getByText(/Managing Products with Agility: 71% across your recent mocks, 53 questions answered/)).toBeInTheDocument();
    expect(within(panel).getByText(/reaching 80% in the mocks that decide readiness/)).toBeInTheDocument();
  });

  it('switching to System Design tab shows its empty state when there are zero graded attempts', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByRole('tab', { name: 'System Design' })).toBeInTheDocument());

    await user.click(screen.getByRole('tab', { name: 'System Design' }));
    await waitFor(() => expect(screen.getByText(/Nothing graded yet/i)).toBeInTheDocument());
  });

  it('switching to Interview Practice tab shows its empty state when nothing has been analyzed', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Interview' })).toBeInTheDocument());

    await user.click(screen.getByRole('tab', { name: 'Interview' }));
    await waitFor(() => expect(screen.getByText(/Nothing analysed yet/i)).toBeInTheDocument());
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

    // The three KPI tiles are gone; the same facts are one sentence.
    await waitFor(() =>
      expect(screen.getByText(/2 of 3 attempts graded, averaging 7.0 \/ 10/)).toBeInTheDocument()
    );
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
    await user.click(await screen.findByRole('tab', { name: 'Interview' }));

    await waitFor(() => expect(screen.getByText('What is holding you back')).toBeInTheDocument());
    expect(screen.getByText(/STAR Structure in Behavioral rounds, averaging 40%/)).toBeInTheDocument();
    expect(screen.getByText(/1 recording/)).toBeInTheDocument();
    expect(screen.getAllByText(/not graded/i).length).toBeGreaterThan(0); // the 3 rounds with no data
  });

  it('shows a retry-able error state per tab without crashing the others', async () => {
    const user = userEvent.setup();
    mockGetSystemDesignAnalytics.mockRejectedValue(new Error('network error'));

    renderPage();
    await user.click(await screen.findByRole('tab', { name: 'System Design' }));

    await waitFor(() => expect(screen.getByText(/Could not load System Design insights\..*Nothing was changed\./i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();

    // Exams tab (already loaded before switching) is unaffected.
    await user.click(screen.getByRole('tab', { name: 'Exams' }));
    expect(screen.getByText(/Nothing measured yet/i)).toBeInTheDocument();
  });
});
