// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from './HomePage';
import { Subject } from '../types/subject';

const mockGetSubjects = vi.fn();
const mockGetHome = vi.fn();
const mockGetOther = vi.fn();

vi.mock('../services/api', () => ({
  getSubjects: (...a: any[]) => mockGetSubjects(...a),
  getHomeSummary: (...a: any[]) => mockGetHome(...a),
  getOtherPreparation: (...a: any[]) => mockGetOther(...a),
}));

const CERT: Subject = {
  id: 1,
  name: 'Scrum / PSM I',
  slug: 'psm-i',
  kind: 'certification',
  pass_mark: 85,
  exam_question_count: 80,
  exam_minutes: 60,
  has_exam_profile: true, question_count: 500,
  readiness: {
    state: 'almost_there',
    mock_count: 6,
    pass_mark: 85,
    recent_scores: [70, 82.5, 87.5, 92.5],
    latest_taken_at: '2026-09-01T10:00:00',
    is_stale: false,
    domains: [
      { domain: 'Managing Products with Agility', state: 'developing', answered: 53, score_pct: 84.9 },
    ],
    weakest_domain: 'Managing Products with Agility',
    points_per_mock: 7.5,
    mocks_to_pass_estimate: null,
    blockers: [{ kind: 'below_pass', value: 82.5, target: 85, count: 1 }],
    most_improved: null,
  },
};

const SKILL: Subject = {
  id: 3,
  name: 'System Design',
  slug: 'system-design',
  kind: 'skill',
  pass_mark: null,
  exam_question_count: null,
  exam_minutes: null,
  has_exam_profile: false, question_count: 500,
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
    blockers: [{ kind: 'no_exam_profile' }],
    most_improved: null,
  },
};

const summary = (over: Partial<any> = {}) => ({
  resumable: null,
  unreviewed_total: 0,
  due_for_review: 0,
  per_subject: [{ subject_id: 1, unreviewed: 0 }],
  mock_count: 6,
  mock_accuracy: 81.2,
  subjects_total: 3,
  subjects_ready: 0,
  ...over,
});

const renderHome = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/exam-setup" element={<div>exam setup</div>} />
        <Route path="/review" element={<div>review page</div>} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSubjects.mockResolvedValue([CERT, SKILL]);
  mockGetHome.mockResolvedValue(summary());
  mockGetOther.mockResolvedValue([]);
});

describe('HomePage', () => {
  it('leads with the verdict, with the subject as context above it', async () => {
    renderHome();

    // The state is the answer to the question someone opens Home with; the
    // subject name is the one fact they already know.
    const verdict = await screen.findByRole('heading', { name: 'Almost there' });
    expect(verdict).toBeInTheDocument();
    expect(screen.getByText('Scrum / PSM I')).toBeInTheDocument();
  });

  it('shows the evidence behind the verdict, not just the verdict', async () => {
    renderHome();

    expect(await screen.findByText('70%')).toBeInTheDocument();
    expect(screen.getByText('83%')).toBeInTheDocument();
    expect(screen.getByText('93%')).toBeInTheDocument();
    expect(screen.getByText('85% to pass')).toBeInTheDocument();
    expect(screen.getByText(/6 full mocks/)).toBeInTheDocument();
  });

  it('explains why it is not ready from the unmet condition, in numbers', async () => {
    renderHome();

    expect(await screen.findByText('Why not ready')).toBeInTheDocument();
    expect(
      screen.getByText(/One of your last three mocks came in at 83%, under the 85% pass mark/)
    ).toBeInTheDocument();
  });

  it('does not call a domain a weakness when it is above the floor', async () => {
    renderHome();

    await screen.findByRole('heading', { name: 'Almost there' });
    // The lowest-scoring domain sits five points above the floor. Naming it
    // "your weakest area" invented a problem, and a learner cannot tell an
    // invented problem from a real one.
    expect(screen.queryByText(/weakest area/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Managing Products with Agility')).not.toBeInTheDocument();
  });

  it('names the weak area only when it is genuinely under the floor', async () => {
    mockGetSubjects.mockResolvedValue([{
      ...CERT,
      readiness: {
        ...CERT.readiness,
        blockers: [{
          kind: 'weak_domain' as const,
          domain: 'Managing Products with Agility',
          value: 71.4,
          target: 80,
          count: 53,
        }],
      },
    }]);
    renderHome();

    expect(
      await screen.findByText(/Managing Products with Agility is at 71%, under the 80% floor/)
    ).toBeInTheDocument();
  });

  it('offers exactly one continuation, not a list of things owed', async () => {
    mockGetHome.mockResolvedValue(
      summary({ unreviewed_total: 12, per_subject: [{ subject_id: 1, unreviewed: 12 }] })
    );
    renderHome();

    expect(await screen.findByRole('button', { name: 'Review them' })).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('prefers finishing what was started over starting something new', async () => {
    mockGetHome.mockResolvedValue(summary({
      unreviewed_total: 12,
      per_subject: [{ subject_id: 1, unreviewed: 12 }],
      resumable: {
        session_id: 42, title: 'PSM I mock', session_kind: 'mock',
        answered: 46, total: 80, seconds_remaining: 900, started_at: '2026-09-04T10:00:00',
      },
    }));
    renderHome();

    expect(await screen.findByText(/question 47 of 80/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pick it up' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Review them' })).not.toBeInTheDocument();
  });

  it('says nothing is measured yet rather than showing zero per cent', async () => {
    mockGetSubjects.mockResolvedValue([{
      ...CERT,
      readiness: {
        ...CERT.readiness,
        state: 'needs_evaluation' as const,
        mock_count: 0,
        recent_scores: [],
        blockers: [{ kind: 'more_mocks' as const, value: 0, target: 3, count: 3 }],
      },
    }]);
    mockGetHome.mockResolvedValue(summary({ mock_count: 0, mock_accuracy: null }));
    renderHome();

    expect(await screen.findByRole('heading', { name: 'Not measured yet' })).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Take your first mock' })).toBeInTheDocument();
  });

  it('offers an import, not a mock, when the question bank is empty', async () => {
    // A fresh install seeds three subjects and no exam questions, so the one
    // action on a new user's Home was "Take your first mock" against a bank
    // the engine correctly refuses to draw from. The only thing the product
    // offered a new user was an error message.
    mockGetSubjects.mockResolvedValue([{
      ...CERT,
      question_count: 0,
      readiness: {
        ...CERT.readiness,
        state: 'needs_evaluation' as const,
        mock_count: 0,
        recent_scores: [],
        blockers: [{ kind: 'more_mocks' as const, value: 0, target: 3, count: 3 }],
      },
    }]);
    mockGetHome.mockResolvedValue(summary({ mock_count: 0, mock_accuracy: null }));
    renderHome();

    expect(await screen.findByRole('button', { name: 'Import questions' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mock/i })).not.toBeInTheDocument();
  });

  it('reports what the last stretch of work bought when something moved', async () => {
    mockGetSubjects.mockResolvedValue([{
      ...CERT,
      readiness: {
        ...CERT.readiness,
        most_improved: {
          domain: 'Understanding and Applying the Scrum Framework',
          before_pct: 84.8, after_pct: 93, points: 8.2,
        },
      },
    }]);
    renderHome();

    expect(await screen.findByText('Recent learning')).toBeInTheDocument();
    expect(
      screen.getByText(/Scrum Framework went from 85% to 93% between your last two mocks/)
    ).toBeInTheDocument();
  });

  it('lists only the formats that have actually been used', async () => {
    mockGetOther.mockResolvedValue([
      { key: 'system_design', label: 'System Design', detail: '4 attempts', href: '/system-design' },
    ]);
    renderHome();

    expect(await screen.findByText('System Design')).toBeInTheDocument();
    expect(screen.getByText('4 attempts')).toBeInTheDocument();
    // The server omits an unused format rather than reporting it as zero.
    expect(screen.queryByText(/0 attempts/)).not.toBeInTheDocument();
  });

  it('has no streak, no daily goal and no backlog total', async () => {
    mockGetHome.mockResolvedValue(summary({ unreviewed_total: 90, due_for_review: 315 }));
    renderHome();

    await screen.findByRole('heading', { name: 'Almost there' });
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/daily goal|practice goal/i)).not.toBeInTheDocument();
    expect(screen.queryByText('405')).not.toBeInTheDocument();
    expect(screen.queryByText('315')).not.toBeInTheDocument();
  });

  it('does not claim a count of ready subjects it cannot support', async () => {
    renderHome();

    await screen.findByRole('heading', { name: 'Almost there' });
    // Two of the three subjects can never be ready, so "0 / 3" described an
    // achievement that does not exist.
    expect(screen.queryByText('0 / 3')).not.toBeInTheDocument();
  });

  it('invites a first subject rather than rendering an empty page', async () => {
    mockGetSubjects.mockResolvedValue([]);
    renderHome();

    expect(await screen.findByText(/Import a question bank/)).toBeInTheDocument();
  });

  it('reports a failed load as a failure, not as an empty account', async () => {
    mockGetSubjects.mockRejectedValue(new Error('offline'));
    renderHome();

    expect(await screen.findByText(/Could not reach/)).toBeInTheDocument();
    expect(screen.queryByText(/Import a question bank/)).not.toBeInTheDocument();
    // And says what has not happened. "Nothing has been lost" is the
    // difference between a failure and a bereavement on a local-first app.
    expect(screen.getByText(/Nothing has been lost/)).toBeInTheDocument();
    // An error you can only look at is a dead end, on the first screen.
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
