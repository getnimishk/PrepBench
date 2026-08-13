import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { DashboardPage } from './DashboardPage';
import { DashboardOverview } from '../types/analytics';

const mockGetDashboardOverview = vi.fn();
const mockGetSettings = vi.fn();

vi.mock('../services/api', () => ({
  getDashboardOverview: (...args: any[]) => mockGetDashboardOverview(...args),
  getSettings: (...args: any[]) => mockGetSettings(...args),
}));

function makeOverview(overrides: Partial<DashboardOverview> = {}): DashboardOverview {
  return {
    total_exams: 5,
    total_questions_attempted: 200,
    overall_accuracy_percentage: 82,
    average_time_per_question_seconds: 45,
    weak_topics: [],
    strong_topics: [],
    study_streak_days: 3,
    daily_goal: 20,
    today_practiced_count: 5,
    spaced_repetition_due_count: 0,
    recent_exams: [],
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/exam-setup" element={<div>Exam Setup Page</div>} />
        <Route path="/exam-review/:sessionId" element={<div>Exam Review Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSettings.mockResolvedValue({ default_passing_percentage: 70 });
});

describe('DashboardPage', () => {
  it('renders KPI metrics once dashboard data loads', async () => {
    mockGetDashboardOverview.mockResolvedValue(makeOverview());
    renderPage();

    await waitFor(() => expect(screen.getByText('Total Exams Completed')).toBeInTheDocument());

    // Each value is scoped to its own MetricCard -- title and value are
    // unlinked sibling nodes in the DOM, so asserting the bare numbers exist
    // anywhere on the page wouldn't catch two metrics' values being swapped.
    const examsCard = screen.getByText('Total Exams Completed').closest('.MuiCard-root') as HTMLElement;
    expect(within(examsCard).getByText('5')).toBeInTheDocument();

    const questionsCard = screen.getByText('Questions Attempted').closest('.MuiCard-root') as HTMLElement;
    expect(within(questionsCard).getByText('200')).toBeInTheDocument();

    const accuracyCard = screen.getByText('Overall Accuracy').closest('.MuiCard-root') as HTMLElement;
    expect(within(accuracyCard).getByText('82%')).toBeInTheDocument();
    expect(within(accuracyCard).getByText('Passing threshold: 70%')).toBeInTheDocument();

    const paceCard = screen.getByText('Avg Time / Question').closest('.MuiCard-root') as HTMLElement;
    expect(within(paceCard).getByText('45s')).toBeInTheDocument();
  });

  it('shows the empty-state message when there are no recent exam sessions', async () => {
    mockGetDashboardOverview.mockResolvedValue(makeOverview({ recent_exams: [] }));
    renderPage();

    await waitFor(() => expect(screen.getByText(/No recent exam sessions yet/i)).toBeInTheDocument());
  });

  it('lists recent exams and navigates to the review page on click', async () => {
    const user = userEvent.setup();
    mockGetDashboardOverview.mockResolvedValue(makeOverview({
      recent_exams: [
        { id: 9, title: 'AWS SAA Practice', score_percentage: 88, is_passed: 'passed', date: '2026-01-01', duration_minutes: 30 },
      ],
    }));
    renderPage();

    await waitFor(() => expect(screen.getByText('AWS SAA Practice')).toBeInTheDocument());
    expect(screen.getByText('PASSED')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /review answers/i }));
    await waitFor(() => expect(screen.getByText('Exam Review Page')).toBeInTheDocument());
  });

  it('shows a retry-able error state on fetch failure', async () => {
    const user = userEvent.setup();
    mockGetDashboardOverview.mockRejectedValue(new Error('network error'));
    renderPage();

    await waitFor(() => expect(screen.getByText(/Failed to load dashboard data/i)).toBeInTheDocument());

    mockGetDashboardOverview.mockResolvedValue(makeOverview());
    await user.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(screen.getByText('Total Exams Completed')).toBeInTheDocument());
  });

  it('fails the whole dashboard load if only the settings request fails, even though overview succeeded', async () => {
    // Promise.all([getDashboardOverview(), getSettings()]) shares one catch --
    // a settings-only outage blanks the entire dashboard rather than just
    // omitting the passing-threshold subtitle.
    mockGetDashboardOverview.mockResolvedValue(makeOverview());
    mockGetSettings.mockRejectedValue(new Error('settings network error'));
    renderPage();

    await waitFor(() => expect(screen.getByText(/Failed to load dashboard data/i)).toBeInTheDocument());
    expect(screen.queryByText('Total Exams Completed')).not.toBeInTheDocument();
  });

  it('navigates to exam setup from the hero buttons, including weak-topic mode', async () => {
    const user = userEvent.setup();
    mockGetDashboardOverview.mockResolvedValue(makeOverview());
    renderPage();

    await waitFor(() => expect(screen.getByText('Welcome back to PrepBench')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /weak topic practice/i }));
    await waitFor(() => expect(screen.getByText('Exam Setup Page')).toBeInTheDocument());
  });

  it('surfaces the spaced-repetition adaptive tip when questions are due, ahead of other tip branches', async () => {
    mockGetDashboardOverview.mockResolvedValue(makeOverview({
      spaced_repetition_due_count: 4,
      weak_topics: [{ topic: 'IAM', domain: 'Security', total_attempted: 10, correct_count: 3, accuracy_percentage: 30 }],
    }));
    renderPage();

    await waitFor(() => expect(screen.getByText(/queued in Spaced Repetition/i)).toBeInTheDocument());
    expect(screen.queryByText(/On a weak spot like/i)).not.toBeInTheDocument();
  });

  it('recommends the specific weakest topic when nothing is due for spaced repetition', async () => {
    mockGetDashboardOverview.mockResolvedValue(makeOverview({
      spaced_repetition_due_count: 0,
      weak_topics: [{ topic: 'IAM', domain: 'Security', total_attempted: 10, correct_count: 4, accuracy_percentage: 40 }],
    }));
    renderPage();

    await waitFor(() => expect(screen.getByText(/On a weak spot like "IAM" \(40%\)/i)).toBeInTheDocument());
  });

  it('suggests starting small when nothing has been practiced today and there is no streak yet', async () => {
    mockGetDashboardOverview.mockResolvedValue(makeOverview({
      today_practiced_count: 0,
      study_streak_days: 0,
    }));
    renderPage();

    await waitFor(() => expect(screen.getByText(/Start small: 10-15 questions a day/i)).toBeInTheDocument());
  });

  it('reminds to keep the streak going when nothing has been practiced today but a streak exists', async () => {
    mockGetDashboardOverview.mockResolvedValue(makeOverview({
      today_practiced_count: 0,
      study_streak_days: 4,
    }));
    renderPage();

    await waitFor(() => expect(screen.getByText(/keeps today's streak and your spaced-repetition schedule on track/i)).toBeInTheDocument());
  });

  it('highlights that a first exam calibrates everything when none have been taken yet', async () => {
    mockGetDashboardOverview.mockResolvedValue(makeOverview({
      total_exams: 0,
      today_practiced_count: 5,
    }));
    renderPage();

    await waitFor(() => expect(screen.getByText(/Your first exam is what calibrates everything else/i)).toBeInTheDocument());
  });

  it('suggests a full timed exam when nothing is due and no weak areas remain', async () => {
    mockGetDashboardOverview.mockResolvedValue(makeOverview());
    renderPage();

    await waitFor(() => expect(screen.getByText(/try a full timed exam under real conditions/i)).toBeInTheDocument());
  });
});
