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

vi.mock('../services/api', () => ({
  getSubjects: (...a: any[]) => mockGetSubjects(...a),
  getHomeSummary: (...a: any[]) => mockGetHome(...a),
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

  it('surfaces an unfinished session above everything', async () => {
    mockGetHome.mockResolvedValue({
      resumable: {
        session_id: 42, title: 'PSM I mock 5', session_kind: 'mock',
        answered: 22, total: 80, seconds_remaining: 2280, started_at: null,
      },
      unreviewed_total: 0, due_for_review: 0, per_subject: [],
    });
    const user = userEvent.setup();
    renderHome();

    expect(await screen.findByText('PSM I mock 5')).toBeInTheDocument();
    expect(screen.getByText(/22 of 80 answered/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /resume/i }));
    expect(await screen.findByText('Exam Runner')).toBeInTheDocument();
  });

  it('shows no resume card when nothing is unfinished', async () => {
    renderHome();
    await screen.findByText('Scrum / PSM I');
    expect(screen.queryByRole('button', { name: /resume/i })).not.toBeInTheDocument();
  });

  it('reports unreviewed answers as a count, not an instruction', async () => {
    mockGetHome.mockResolvedValue({
      resumable: null,
      unreviewed_total: 18,
      due_for_review: 14,
      per_subject: [{ subject_id: 1, unreviewed: 18 }],
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

  it('does not claim you have no subjects when the request failed', async () => {
    // A connection error is not an empty account. Saying "no subjects yet"
    // here tells the user something false about their own data.
    mockGetSubjects.mockRejectedValue(new Error('network'));
    renderHome();

    expect(await screen.findByText(/failed to load/i)).toBeInTheDocument();
    expect(screen.queryByText(/no subjects yet/i)).not.toBeInTheDocument();
  });
});
