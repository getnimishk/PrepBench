// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

/**
 * Practice: what to work on, why, and one way in.
 *
 * These are the first tests this page has had. What they hold is the part that
 * is easy to lose: the recommendation is read from the same evidence Home
 * reads, the page never shows an empty Continue, and however many things are
 * true at once there is exactly one dominant action.
 *
 * The last one is the invariant that keeps Practice from becoming a launcher.
 * Two filled buttons is not a recommendation, it is a fork -- and six of them
 * is the app drawer this page existed to replace.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PracticeHubPage, LearnHubPage } from './HubPages';
import { HomePage } from './HomePage';
import { Subject } from '../types/subject';

const mockGetSubjects = vi.fn();
const mockGetHome = vi.fn();
const mockGetOther = vi.fn();
const mockGetFocus = vi.fn();

vi.mock('../services/api', () => ({
  getSubjects: (...a: any[]) => mockGetSubjects(...a),
  getHomeSummary: (...a: any[]) => mockGetHome(...a),
  getOtherPreparation: (...a: any[]) => mockGetOther(...a),
  getFocusTopics: (...a: any[]) => mockGetFocus(...a),
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
  question_count: 709,
  readiness: {
    state: 'almost_there',
    mock_count: 6,
    pass_mark: 85,
    recent_scores: [70, 82.5, 87.5, 92.5],
    latest_taken_at: '2026-09-01T10:00:00',
    is_stale: false,
    domains: [
      { domain: 'Managing Products with Agility', state: 'developing', answered: 53, score_pct: 74.2 },
    ],
    weakest_domain: 'Managing Products with Agility',
    points_per_mock: 7.5,
    mocks_to_pass_estimate: null,
    blockers: [{ kind: 'below_pass', value: 82.5, target: 85, count: 1 }],
    most_improved: null,
  },
};

/** The same subject, with the one blocker that names a domain under the floor. */
const WEAK: Subject = {
  ...CERT,
  readiness: {
    ...CERT.readiness,
    blockers: [{
      kind: 'weak_domain',
      domain: 'Managing Products with Agility',
      value: 74.2,
      target: 80,
      count: 53,
    }],
  },
};

const summary = (over: Partial<any> = {}) => ({
  resumable: null,
  unreviewed_total: 0,
  due_for_review: 0,
  per_subject: [{ subject_id: 1, unreviewed: 0 }],
  mock_count: 6,
  mock_accuracy: 81.2,
  subjects_total: 1,
  subjects_ready: 0,
  ...over,
});

const RESUMABLE = {
  session_id: 42,
  title: 'Sprint Planning drill',
  session_kind: 'drill',
  answered: 8,
  total: 20,
  seconds_remaining: null,
  started_at: '2026-09-07T09:00:00',
};

const renderPractice = () =>
  render(
    <MemoryRouter initialEntries={['/practice']}>
      <Routes>
        <Route path="/practice" element={<PracticeHubPage />} />
        <Route path="/exam-setup" element={<div>exam setup</div>} />
      </Routes>
    </MemoryRouter>
  );

/** Every button MUI renders filled. "Dominant" is a visual claim, and this is
 *  the property that makes it one. */
const filledButtons = (root: HTMLElement) =>
  [...root.querySelectorAll('.MuiButton-contained')];

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSubjects.mockResolvedValue([CERT]);
  mockGetHome.mockResolvedValue(summary());
  mockGetOther.mockResolvedValue([]);
  mockGetFocus.mockResolvedValue([]);
});

// ---- continue ----------------------------------------------------------

describe('Practice — continue', () => {
  it('leads with the unfinished session when there is one', async () => {
    mockGetHome.mockResolvedValue(summary({ resumable: RESUMABLE }));
    renderPractice();

    expect(await screen.findByRole('heading', { name: 'Continue' })).toBeInTheDocument();
    expect(screen.getByText('Sprint Planning drill')).toBeInTheDocument();
    // What is left, from the real counts rather than a stored percentage.
    expect(screen.getByText(/12 questions remaining/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Continue/ })).toBeInTheDocument();
  });

  it('renders no Continue section at all when nothing was left unfinished', async () => {
    renderPractice();

    await screen.findByRole('heading', { name: /What should you work on/ });
    expect(screen.queryByRole('heading', { name: 'Continue' })).not.toBeInTheDocument();
    // Not an empty card, not a disabled button, not "nothing in progress".
    expect(screen.queryByRole('link', { name: /Continue/ })).not.toBeInTheDocument();
  });
});

// ---- what needs attention ----------------------------------------------

describe('Practice — what needs attention', () => {
  it('names the weak domain, its score and the floor it is under', async () => {
    mockGetSubjects.mockResolvedValue([WEAK]);
    renderPractice();

    expect(await screen.findByRole('heading', { name: 'What needs attention' })).toBeInTheDocument();
    expect(screen.getByText('Managing Products with Agility')).toBeInTheDocument();
    expect(screen.getByText('74%')).toBeInTheDocument();
    expect(screen.getByText(/Preparation floor 80%/)).toBeInTheDocument();
  });

  it('is absent when no domain is under the floor', async () => {
    renderPractice();

    await screen.findByRole('heading', { name: /What should you work on/ });
    expect(screen.queryByRole('heading', { name: 'What needs attention' })).not.toBeInTheDocument();
  });

  it('carries the domain through to the drill rather than dropping it', async () => {
    mockGetSubjects.mockResolvedValue([WEAK]);
    renderPractice();

    const cta = await screen.findByRole('link', { name: /Practise Managing Products with Agility/ });
    expect(cta).toHaveAttribute(
      'href',
      '/exam-setup?kind=drill&subject=1&domain=Managing%20Products%20with%20Agility'
    );
  });
});

// ---- one dominant action ------------------------------------------------

describe('Practice — one dominant action', () => {
  it('has exactly one filled button when a weakness is the recommendation', async () => {
    mockGetSubjects.mockResolvedValue([WEAK]);
    const { container } = renderPractice();

    await screen.findByRole('heading', { name: 'What needs attention' });
    expect(filledButtons(container)).toHaveLength(1);
  });

  it('has exactly one filled button when there is nothing to fix', async () => {
    const { container } = renderPractice();

    await screen.findByRole('heading', { name: /What should you work on/ });
    expect(filledButtons(container)).toHaveLength(1);
  });

  // Both can be true at once, and the reference draws both in blue. Two
  // dominant actions is a fork: finishing what was started wins, and the
  // weakness stays on the page as a second, quieter way in.
  it('still has exactly one filled button when both a session and a weakness exist', async () => {
    mockGetSubjects.mockResolvedValue([WEAK]);
    mockGetHome.mockResolvedValue(summary({ resumable: RESUMABLE }));
    const { container } = renderPractice();

    await screen.findByRole('heading', { name: 'Continue' });
    expect(screen.getByRole('heading', { name: 'What needs attention' })).toBeInTheDocument();
    expect(filledButtons(container)).toHaveLength(1);
    expect(filledButtons(container)[0]).toHaveAccessibleName(/Continue/);
  });
});

// ---- the alternatives ---------------------------------------------------

describe('Practice — other ways to practise', () => {
  it('keeps every practice destination reachable', async () => {
    renderPractice();

    await screen.findByRole('heading', { name: /Explore other ways to practise/ });
    const list = screen.getByRole('list', { name: /Other ways to practise/i });
    const hrefs = within(list).getAllByRole('link').map((a) => a.getAttribute('href'));

    expect(hrefs.some((h) => h?.includes('kind=drill'))).toBe(true);
    expect(hrefs).toContain('/design-reviews');
    expect(hrefs).toContain('/system-design');
    expect(hrefs).toContain('/interview-practice');
    expect(hrefs).toContain('/chart-sandbox');
  });

  it('does not offer the mock twice when it is already the recommendation', async () => {
    renderPractice();

    await screen.findByRole('heading', { name: /Explore other ways to practise/ });
    const list = screen.getByRole('list', { name: /Other ways to practise/i });
    const mocks = within(list).queryAllByRole('link', { name: /full mock/i });
    expect(mocks).toHaveLength(0);
  });

  it('offers the mock in the list when something else is the recommendation', async () => {
    mockGetSubjects.mockResolvedValue([WEAK]);
    renderPractice();

    await screen.findByRole('heading', { name: /Explore other ways to practise/ });
    const list = screen.getByRole('list', { name: /Other ways to practise/i });
    expect(within(list).getByRole('link', { name: /full mock/i })).toBeInTheDocument();
  });

  it('offers them as links, so they cannot compete with the one action', async () => {
    renderPractice();

    await screen.findByRole('heading', { name: /Explore other ways to practise/ });
    const list = screen.getByRole('list', { name: /Other ways to practise/i });
    expect(within(list).queryAllByRole('button')).toHaveLength(0);
  });
});

// ---- empty and degraded states -----------------------------------------

describe('Practice — when there is nothing to recommend', () => {
  it('still gives a usable page with no subjects at all', async () => {
    mockGetSubjects.mockResolvedValue([]);
    renderPractice();

    await screen.findByRole('heading', { name: /What should you work on/ });
    // No invented urgency, and the alternatives are still there.
    expect(screen.queryByRole('heading', { name: 'What needs attention' })).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: /Other ways to practise/i })).toBeInTheDocument();
  });

  it('says so when the evidence could not be loaded, rather than showing none', async () => {
    mockGetSubjects.mockRejectedValue(new Error('offline'));
    mockGetHome.mockRejectedValue(new Error('offline'));
    renderPractice();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: /Other ways to practise/i })).toBeInTheDocument();
  });
});

// ---- the thing that must not drift -------------------------------------

describe('Practice and Home agree', () => {
  it('names the same weakness, with the same number, from the same evidence', async () => {
    mockGetSubjects.mockResolvedValue([WEAK]);

    const home = render(
      <MemoryRouter initialEntries={['/']}>
        <Routes><Route path="/" element={<HomePage />} /></Routes>
      </MemoryRouter>
    );
    expect(
      await within(home.container).findByText(
        /Managing Products with Agility is at 74%, under the 80% floor/
      )
    ).toBeInTheDocument();
    home.unmount();

    const practice = renderPractice();
    await within(practice.container).findByRole('heading', { name: 'What needs attention' });
    expect(within(practice.container).getByText('Managing Products with Agility')).toBeInTheDocument();
    expect(within(practice.container).getByText('74%')).toBeInTheDocument();
  });
});

// ---- the page that shares this file ------------------------------------

describe('Learn', () => {
  // Practice and Learn live in one module. This is here so that reworking one
  // cannot quietly take the other with it.
  it('still lists the study material', () => {
    render(
      <MemoryRouter initialEntries={['/learn']}>
        <Routes><Route path="/learn" element={<LearnHubPage />} /></Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Learn' })).toBeInTheDocument();
    expect(screen.getByText('Roadmaps')).toBeInTheDocument();
    expect(screen.getByText('Question Bank')).toBeInTheDocument();
  });
});
