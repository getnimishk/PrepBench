// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from './HomePage';
import { Subject } from '../types/subject';

const mockGetSubjects = vi.fn();
const mockGetHome = vi.fn();

const mockGetActivity = vi.fn();
const mockGetOverview = vi.fn();
const mockGetTrends = vi.fn();

vi.mock('../services/api', () => ({
  getSubjects: (...a: any[]) => mockGetSubjects(...a),
  getHomeSummary: (...a: any[]) => mockGetHome(...a),
  getActivity: (...a: any[]) => mockGetActivity(...a),
  getDashboardOverview: (...a: any[]) => mockGetOverview(...a),
  getScoreTrends: (...a: any[]) => mockGetTrends(...a),
}));

// jsdom has no real canvas context, so Chart.js throws on any non-empty
// dataset. Mocked as an opaque leaf, exactly as AnalyticsPage.test.tsx does,
// so this file tests HomePage's own logic rather than fighting an
// environment limitation unrelated to it.
vi.mock('../components/analytics/ScoreTrendChart', () => ({
  ScoreTrendChart: ({ trends }: { trends: any[] }) => (
    <div data-testid="score-trend-chart">{trends.length} points</div>
  ),
}));

const CERT: Subject = {
  id: 1,
  name: 'Scrum / PSM I',
  slug: 'psm-i',
  kind: 'certification',
  pass_mark: 85,
  exam_question_count: 80,
  exam_minutes: 60,
  has_exam_profile: true,
  readiness: {
    state: 'almost_there',
    mock_count: 3,
    pass_mark: 85,
    recent_scores: [79, 82, 84],
    latest_taken_at: '2026-09-01T10:00:00',
    is_stale: false,
    domains: [],
    weakest_domain: 'Scrum Events',
    points_per_mock: 2.5,
    mocks_to_pass_estimate: 2,
  },
};

const SKILL: Subject = {
  id: 2,
  name: 'Databricks Data Platform',
  slug: 'databricks',
  kind: 'skill',
  pass_mark: null,
  exam_question_count: null,
  exam_minutes: null,
  has_exam_profile: false,
  readiness: {
    state: 'needs_evaluation',
    mock_count: 0,
    pass_mark: null,
    recent_scores: [],
    latest_taken_at: null,
    is_stale: false,
    domains: [],
    weakest_domain: null,
    points_per_mock: null,
    mocks_to_pass_estimate: null,
  },
};

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/subjects/:id" element={<div>Subject Page</div>} />
        <Route path="/exam/:sessionId" element={<div>Exam Runner</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSubjects.mockResolvedValue([CERT, SKILL]);
  mockGetHome.mockResolvedValue({
    resumable: null,
    unreviewed_total: 0,
    due_for_review: 0,
    per_subject: [],
    mock_count: 0,
    mock_accuracy: null,
    subjects_total: 2,
    subjects_ready: 0,
  });
  mockGetActivity.mockResolvedValue([]);
  mockGetTrends.mockResolvedValue([]);
  mockGetOverview.mockResolvedValue({
    total_exams: 4,
    total_questions_attempted: 240,
    overall_accuracy_percentage: 72,
    average_time_per_question_seconds: 41,
    weak_topics: [],
    strong_topics: [],
    study_streak_days: 3,
    daily_goal: 20,
    today_practiced_count: 5,
    spaced_repetition_due_count: 0,
    recent_exams: [],
  });
});

describe('HomePage', () => {
  it('lists every subject with its readiness state', async () => {
    renderHome();
    expect(await screen.findByText('Scrum / PSM I')).toBeInTheDocument();
    expect(screen.getByText('Databricks Data Platform')).toBeInTheDocument();
    expect(screen.getByText('Almost there')).toBeInTheDocument();
    expect(screen.getAllByText('Needs evaluation').length).toBeGreaterThan(0);
  });

  it('never shows a ranked list of what to do next', async () => {
    // The design decision this page exists to hold. Being told what to do
    // next was put to the user and rejected as nagging.
    renderHome();
    await screen.findByText('Scrum / PSM I');

    expect(screen.queryByText(/do this next/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/suggested/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/we recommend/i)).not.toBeInTheDocument();
  });

  it('says a subject has no mock rather than showing it as zero per cent', async () => {
    renderHome();
    await screen.findByText('Databricks Data Platform');

    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    expect(screen.getByText(/no exam profile/i)).toBeInTheDocument();
  });

  it('shows the mock evidence behind a readiness claim', async () => {
    renderHome();
    await screen.findByText('Scrum / PSM I');
    // A state with no sample size is a claim with no basis.
    expect(screen.getByText(/3 mocks/)).toBeInTheDocument();
    expect(screen.getByText(/pass mark 85%/)).toBeInTheDocument();
  });

  it('does not put a resume card on the dashboard', async () => {
    // Removed by request. An unfinished session is still reachable, but the
    // dashboard is for where you stand, not for pushing you back into a
    // session you chose to leave.
    mockGetHome.mockResolvedValue({
      resumable: {
        session_id: 42, title: 'PSM I mock 5', session_kind: 'mock',
        answered: 22, total: 80, seconds_remaining: 2280, started_at: null,
      },
      unreviewed_total: 0, due_for_review: 0, per_subject: [],
      mock_count: 0, mock_accuracy: null, subjects_total: 2, subjects_ready: 0,
    });
    renderHome();
    await screen.findByText('Where you stand');

    expect(screen.queryByRole('button', { name: /resume/i })).not.toBeInTheDocument();
    expect(screen.queryByText('PSM I mock 5')).not.toBeInTheDocument();
  });

  it('plots the score history that already exists', async () => {
    // Ten sessions of real data were being ignored. The chart is history,
    // not readiness, and the caption has to say so.
    mockGetTrends.mockResolvedValue([
      { date: 'Aug 21', score: 82, rolling_avg: 82, exam_title: 'Timed Exam' },
      { date: 'Aug 31', score: 88, rolling_avg: 85, exam_title: 'Timed Exam' },
    ]);
    renderHome();

    expect(await screen.findByText('Score history')).toBeInTheDocument();
    expect(screen.getByTestId('score-trend-chart')).toHaveTextContent('2 points');
    expect(screen.getByText(/mocks and drills together/i)).toBeInTheDocument();
  });

  it('reports unreviewed answers as a count, not an instruction', async () => {
    mockGetHome.mockResolvedValue({
      resumable: null,
      unreviewed_total: 18,
      due_for_review: 14,
      per_subject: [{ subject_id: 1, unreviewed: 18 }],
      mock_count: 3, mock_accuracy: 81.7, subjects_total: 2, subjects_ready: 0,
    });
    renderHome();

    expect(await screen.findByText('18 unreviewed')).toBeInTheDocument();
    // A count with no verb attached. No "review these now".
    expect(screen.queryByText(/review them now/i)).not.toBeInTheDocument();
  });

  it('opens the subject when a subject card is clicked', async () => {
    const user = userEvent.setup();
    renderHome();
    await user.click(await screen.findByText('Scrum / PSM I'));
    expect(await screen.findByText('Subject Page')).toBeInTheDocument();
  });

  it('invites a first subject rather than rendering an empty page', async () => {
    mockGetSubjects.mockResolvedValue([]);
    renderHome();
    expect(await screen.findByText(/no subjects yet/i)).toBeInTheDocument();
  });

  it('shows headline metrics that count mocks alone', async () => {
    mockGetHome.mockResolvedValue({
      resumable: null, unreviewed_total: 0, due_for_review: 0, per_subject: [],
      mock_count: 3, mock_accuracy: 81.7, subjects_total: 2, subjects_ready: 1,
    });
    renderHome();

    expect(await screen.findByText('Mock Accuracy')).toBeInTheDocument();
    expect(screen.getByText('81.7%')).toBeInTheDocument();
    expect(screen.getByText('Drills excluded')).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('says accuracy needs evaluation rather than showing it as zero', async () => {
    // The old dashboard averaged drills into its accuracy figure, which is
    // why it could not answer whether you would pass. An absent measurement
    // must not render as a failing one.
    renderHome();
    await screen.findByText('Mock Accuracy');

    // It appears both as the headline value and as a subject's state, which
    // is correct -- the point is that neither is rendered as a zero.
    expect(screen.getAllByText('Needs evaluation').length).toBeGreaterThan(0);
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    expect(screen.queryByText('0.0%')).not.toBeInTheDocument();
  });

  it('lists recent activity across every format', async () => {
    mockGetActivity.mockResolvedValue([
      { kind: 'mock', at: '2026-09-01T10:00:00', title: 'PSM I mock 4', detail: '84%', href: '/exam-review/4' },
      { kind: 'design_review', at: '2026-08-31T10:00:00', title: 'The warehouse that sleeps', detail: 'chose B', href: '/design-reviews/2' },
    ]);
    renderHome();

    expect(await screen.findByText('PSM I mock 4')).toBeInTheDocument();
    expect(screen.getByText('The warehouse that sleeps')).toBeInTheDocument();
  });

  it('does not claim you have no subjects when the request failed', async () => {
    // A connection error is not an empty account. Saying "no subjects yet"
    // here tells the user something false about their own data.
    mockGetSubjects.mockRejectedValue(new Error('network'));
    renderHome();

    expect(await screen.findByText(/failed to load/i)).toBeInTheDocument();
    expect(screen.queryByText(/no subjects yet/i)).not.toBeInTheDocument();
  });
});
