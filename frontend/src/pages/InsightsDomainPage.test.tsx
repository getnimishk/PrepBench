// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { InsightsDomainPage } from './InsightsDomainPage';
import type { DomainDetail } from '../types/analytics';

const mockDetail = vi.fn();
const mockSubjects = vi.fn();
const mockPreparation = vi.fn();

vi.mock('../services/api', () => ({
  getDomainDetail: (...a: any[]) => mockDetail(...a),
  getSubjects: (...a: any[]) => mockSubjects(...a),
}));

vi.mock('../context/PreparationContext', () => ({
  usePreparation: () => mockPreparation(),
}));

const PSM = {
  id: 1, name: 'Scrum / PSM I', slug: 'psm-i', kind: 'certification', pass_mark: 85,
  exam_question_count: 80, exam_minutes: 60, has_exam_profile: true, is_archived: false,
  display_order: 1, question_count: 500,
  readiness: {
    state: 'developing', mock_count: 4, pass_mark: 85, recent_scores: [70, 78, 81, 83],
    latest_taken_at: null, is_stale: false,
    domains: [{ domain: 'Scrum Events', state: 'needs_work', answered: 24, score_pct: 66.7 }],
    weakest_domain: 'Scrum Events', points_per_mock: null, mocks_to_pass_estimate: null,
    blockers: [{ kind: 'weak_domain', domain: 'Scrum Events', value: 66.7, target: 80, count: 24 }],
    most_improved: null,
    rules: {
      min_mocks_for_ready: 3, consecutive_mocks_at_pass: 3, domain_floor_pct: 80,
      recency_days: 14, plateau_min_mocks: 4, plateau_max_spread: 3, min_questions_per_domain: 10,
    },
  },
};

const DETAIL: DomainDetail = {
  subject_id: 1, domain: 'Scrum Events', answers: 40, correct: 25, accuracy_percentage: 62.5,
  question_count: 30, attempted_questions: 20, missed_questions: 9, due_now: 3, unreviewed_misses: 0,
  min_answers_per_topic: 3,
  topics: [
    { topic: 'Sprint Retrospective', answers: 8, correct: 3, accuracy_percentage: 37.5 },
    { topic: 'Daily Scrum', answers: 12, correct: 9, accuracy_percentage: 75 },
  ],
  questions: [
    { id: 11, text: 'Who attends the Sprint Retrospective?', topic: 'Sprint Retrospective', state: 'missed', times_answered: 2, times_correct: 1, due: true },
    { id: 12, text: 'What is the Daily Scrum for?', topic: 'Daily Scrum', state: 'unseen', times_answered: 0, times_correct: 0, due: false },
  ],
  questions_limit: 20,
};

const renderArea = (entry = '/analytics/area?subject=1&domain=Scrum%20Events') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/analytics/area" element={<InsightsDomainPage />} />
        <Route path="/analytics" element={<div>insights page</div>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockPreparation.mockReturnValue({ selectedId: 1, selected: PSM });
  mockSubjects.mockResolvedValue([PSM]);
  mockDetail.mockResolvedValue(DETAIL);
});

describe('InsightsDomainPage', () => {
  it('reads the area it was opened for, and names its population', async () => {
    renderArea();

    expect(await screen.findByRole('heading', { name: 'Scrum Events' })).toBeInTheDocument();
    expect(mockDetail).toHaveBeenCalledWith(1, 'Scrum Events');
    expect(screen.getByText('Insights · Scrum / PSM I')).toBeInTheDocument();
    expect(screen.getByText(/63% across 40 answers in this area — every session, drills included/)).toBeInTheDocument();
    expect(screen.getByText('25 of 40 answers')).toBeInTheDocument();
    expect(screen.getByText('20 attempted')).toBeInTheDocument();
  });

  it('offers practice for this area and the reviews due in it, and nothing invented', async () => {
    renderArea();

    const practise = await screen.findByRole('link', { name: /Practise this area/ });
    expect(practise).toHaveAttribute('href', '/exam-setup?kind=drill&subject=1&domain=Scrum%20Events');
    expect(screen.getByRole('link', { name: 'Verify 3 due' })).toHaveAttribute(
      'href', '/practice/spaced?domain=Scrum%20Events&from=area',
    );
    expect(screen.queryByRole('link', { name: /Review \d+ miss/ })).not.toBeInTheDocument();
  });

  it('sends misses still waiting for review to Review', async () => {
    mockDetail.mockResolvedValue({ ...DETAIL, unreviewed_misses: 2 });
    renderArea();

    expect(await screen.findByRole('link', { name: 'Review 2 misses' })).toHaveAttribute('href', '/review');
    expect(screen.getByText('2 misses here have not been reviewed.')).toBeInTheDocument();
  });

  it('interprets the area from its figures, with the working one click away', async () => {
    const user = userEvent.setup();
    renderArea();

    expect(await screen.findByText('Retrieval is what moves this forward.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Why am I seeing this?' }));
    const panel = screen.getByRole('region', { name: 'Why am I seeing this' });
    expect(within(panel).getByText('In your last 3 mocks: 67%, 24 questions answered')).toBeInTheDocument();
    expect(within(panel).getByText('9 answered wrong at least once')).toBeInTheDocument();
  });

  it('lists topics lowest first and questions with their state and a way to open them', async () => {
    renderArea();

    const topics = await screen.findByRole('region', { name: 'By topic' });
    const topicNames = within(topics).getAllByText(/Sprint Retrospective|Daily Scrum/).map((n) => n.textContent);
    expect(topicNames).toEqual(['Sprint Retrospective', 'Daily Scrum']);

    const questions = screen.getByRole('region', { name: 'Questions in this area' });
    const [missed, unseen] = within(questions).getAllByRole('listitem');
    expect(within(missed).getByText('Missed')).toBeInTheDocument();
    expect(within(missed).getByText('Due')).toBeInTheDocument();
    expect(within(missed).getByText(/answered 2×, right 1×/)).toBeInTheDocument();
    expect(within(missed).getByRole('link', { name: /Open question/ })).toHaveAttribute('href', '/question-bank?question=11');
    expect(within(unseen).getByText('Not attempted')).toBeInTheDocument();
  });

  it('says nothing is measured, rather than 0%, when nothing has been answered', async () => {
    mockDetail.mockResolvedValue({
      ...DETAIL, answers: 0, correct: 0, accuracy_percentage: null, attempted_questions: 0,
      missed_questions: 0, due_now: 0, topics: [],
      questions: [{ ...DETAIL.questions[1] }],
    });
    renderArea();

    expect(await screen.findByText('No question in this area has been answered yet.')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('Nothing here has been measured yet.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Review .* due/ })).not.toBeInTheDocument();
    expect(screen.getByText(/A topic appears here once it has 3 answers/)).toBeInTheDocument();
  });

  it('tells an area that does not exist here apart from a failure, and retries the failure', async () => {
    mockDetail.mockRejectedValueOnce({ response: { status: 404, data: { detail: 'Area not found' } } });
    const first = renderArea();
    expect(await screen.findByText('This preparation has no questions and no answers in Scrum Events.')).toBeInTheDocument();
    first.unmount();

    const user = userEvent.setup();
    mockDetail.mockRejectedValueOnce(new Error('network'));
    renderArea();
    expect(await screen.findByText(/Could not load this area/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { name: 'Scrum Events' })).toBeInTheDocument();
  });

  it('goes back to Insights when another preparation is picked', async () => {
    const view = renderArea();
    await screen.findByRole('heading', { name: 'Scrum Events' });

    mockPreparation.mockReturnValue({ selectedId: 2, selected: { ...PSM, id: 2, name: 'AWS' } });
    view.rerender(
      <MemoryRouter initialEntries={['/analytics/area?subject=1&domain=Scrum%20Events']}>
        <Routes>
          <Route path="/analytics/area" element={<InsightsDomainPage />} />
          <Route path="/analytics" element={<div>insights page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('insights page')).toBeInTheDocument();
  });
});
