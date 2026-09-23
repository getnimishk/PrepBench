// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { PreparationsPage } from './PreparationsPage';

const api = {
  getSubjects: vi.fn(), archiveSubject: vi.fn(),
  getRoadmaps: vi.fn(), getReviewCounts: vi.fn(), getQuestionBankSummary: vi.fn(),
};
vi.mock('../services/api', () => ({
  getSubjects: (...a: any[]) => api.getSubjects(...a),
  archiveSubject: (...a: any[]) => api.archiveSubject(...a),
  getRoadmaps: (...a: any[]) => api.getRoadmaps(...a),
  getReviewCounts: (...a: any[]) => api.getReviewCounts(...a),
  getQuestionBankSummary: (...a: any[]) => api.getQuestionBankSummary(...a),
}));

const refresh = vi.fn();
vi.mock('../context/PreparationContext', () => ({
  usePreparation: () => ({ selectedId: 1, select: vi.fn(), refresh }),
}));

const READINESS = {
  state: 'almost_there', mock_count: 6, pass_mark: 85, recent_scores: [83, 88, 93], is_stale: false,
  domains: [{ domain: 'Scrum Events', state: 'needs_work', answered: 40, score_pct: 71 }],
  weakest_domain: 'Scrum Events', blockers: [],
};
const PSM = {
  id: 1, name: 'Scrum / PSM I', kind: 'certification', description: 'Professional Scrum Master I', is_archived: false,
  question_count: 709, exam_question_count: 80, exam_minutes: 60, pass_mark: 85, has_exam_profile: true,
  readiness: READINESS,
};
const SKILL = {
  ...PSM, id: 2, name: 'System Design', kind: 'skill', description: null, pass_mark: null, question_count: 12,
  has_exam_profile: false, readiness: { ...READINESS, state: 'needs_evaluation', mock_count: 0, recent_scores: [], domains: [], weakest_domain: null },
};

const renderPage = () => render(<MemoryRouter><PreparationsPage /></MemoryRouter>);

beforeEach(() => {
  api.getSubjects.mockReset();
  api.archiveSubject.mockReset();
  api.getRoadmaps.mockReset().mockResolvedValue([
    {
      id: 4, title: 'PSM I syllabus', subject_id: 1, is_archived: false, updated_at: '2026-09-01T00:00:00',
      progress: { total_topics: 42, not_started_count: 5, in_progress_count: 6, completed_count: 31, skipped_count: 0, completion_percentage: 74, hours_percentage: null, total_estimated_hours: null, completed_estimated_hours: null },
    },
  ]);
  api.getReviewCounts.mockReset().mockResolvedValue({ unreviewed: 12, spaced_due: 8 });
  api.getQuestionBankSummary.mockReset().mockResolvedValue({ questions: 709, missed_at_least_once: 71 });
  refresh.mockReset().mockResolvedValue(undefined);
});

describe('PreparationsPage', () => {
  it('says the list could not be read instead of calling it empty, and loads on retry', async () => {
    const user = userEvent.setup();
    api.getSubjects.mockRejectedValueOnce({ isAxiosError: true, request: {} }).mockResolvedValue([PSM]);
    renderPage();

    expect(await screen.findByText(/Could not load your preparations\. Could not reach the PrepBench server\..*Nothing was changed\./)).toBeInTheDocument();
    expect(screen.queryByText('No preparations yet')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect((await screen.findAllByText('Scrum / PSM I')).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Could not load your preparations/)).not.toBeInTheDocument();
  });

  it('calls an empty list empty only when it was read', async () => {
    api.getSubjects.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('No preparations yet')).toBeInTheDocument();
  });

  it('says an archive that failed changed nothing', async () => {
    const user = userEvent.setup();
    api.getSubjects.mockResolvedValue([PSM, SKILL]);
    api.archiveSubject.mockRejectedValue({ isAxiosError: true, request: {} });
    renderPage();

    await screen.findAllByText('System Design');
    await user.click(screen.getAllByRole('button', { name: 'Archive' })[1]);
    expect(await screen.findByText(/Could not archive System Design\. Could not reach the PrepBench server\..*Nothing was changed\./)).toBeInTheDocument();
  });

  it('does not deny an archive that was made when the list then fails to refresh', async () => {
    const user = userEvent.setup();
    api.getSubjects.mockResolvedValueOnce([PSM, SKILL]).mockRejectedValue({ isAxiosError: true, request: {} });
    api.archiveSubject.mockResolvedValue({ ...SKILL, is_archived: true });
    renderPage();

    await screen.findAllByText('System Design');
    await user.click(screen.getAllByRole('button', { name: 'Archive' })[1]);
    expect(await screen.findByText('System Design was archived, but the list could not be refreshed. Reload to see it.')).toBeInTheDocument();
    expect(screen.queryByText(/Could not archive/)).not.toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it('opens the current preparation under the cards, with what is inside it', async () => {
    api.getSubjects.mockResolvedValue([PSM, SKILL]);
    renderPage();

    const card = await screen.findByRole('button', { name: 'Scrum / PSM I: Almost there · 93%' });
    expect(card).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'System Design: Practised, not certified' })).toHaveAttribute('aria-pressed', 'false');

    const panel = screen.getByRole('region', { name: 'Scrum / PSM I' });
    expect(within(panel).getByText('Almost there')).toBeInTheDocument();
    expect(within(panel).getByText('93% latest evidence · 85% pass mark')).toBeInTheDocument();
    expect(within(panel).getByText('71% · clearest gap')).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'Open overview' })).toHaveAttribute('href', '/subjects/1');
    expect(await within(panel).findByText('31 / 42 topics · roadmap, guides and demonstrations')).toBeInTheDocument();
    expect(within(panel).getByText('12 misses to read · 8 due for retrieval')).toBeInTheDocument();
    expect(within(panel).getByText('709 questions · 71 missed at least once')).toBeInTheDocument();
  });

  it('leaves a figure unsaid when it could not be read', async () => {
    api.getSubjects.mockResolvedValue([PSM]);
    api.getReviewCounts.mockRejectedValue(new Error('down'));
    api.getQuestionBankSummary.mockRejectedValue(new Error('down'));
    renderPage();

    const panel = await screen.findByRole('region', { name: 'Scrum / PSM I' });
    expect(await within(panel).findByText('Missed concepts followed by verification checks')).toBeInTheDocument();
    expect(within(panel).getByText('709 questions')).toBeInTheDocument();
  });
});
