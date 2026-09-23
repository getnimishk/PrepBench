// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

/**
 * Practice: what to work on, why, and one way in.
 *
 * What these hold is the part that is easy to lose: the recommendation is read
 * from the same evidence Home reads, the page never shows an empty Continue,
 * and however many things are true at once there is exactly one dominant
 * action -- the prototype's "Recommended now", beside what else is ready.
 *
 * The last one is the invariant that keeps Practice from becoming a launcher.
 * Two filled buttons is not a recommendation, it is a fork -- and six of them
 * is the app drawer this page existed to replace.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PracticeHubPage } from './HubPages';
import { HomePage } from './HomePage';
import { Subject } from '../types/subject';

const mockGetSubjects = vi.fn();
const mockGetHome = vi.fn();
const mockGetOther = vi.fn();
const mockGetFocus = vi.fn();
const mockReviewCounts = vi.fn();
const mockPreparation = vi.fn();

// No provider by default, as before: nothing picked, so the page infers.
vi.mock('../context/PreparationContext', () => ({
  usePreparation: () => mockPreparation(),
}));

vi.mock('../services/api', () => ({
  getSubjects: (...a: any[]) => mockGetSubjects(...a),
  getHomeSummary: (...a: any[]) => mockGetHome(...a),
  getOtherPreparation: (...a: any[]) => mockGetOther(...a),
  getFocusTopics: (...a: any[]) => mockGetFocus(...a),
  getReviewCounts: (...a: any[]) => mockReviewCounts(...a),
  getRoadmaps: () => Promise.resolve([]),
  // This suite renders Home to compare it with Practice; the goals are not what
  // it is comparing, so they are simply unavailable here.
  getDailyGoals: () => Promise.reject(new Error('not under test')),
  // The format panels have their own suite; here they only need to render.
  previewExam: () => new Promise(() => {}),
  getSpacedDeck: () => new Promise(() => {}),
  getQuestionFilters: () => new Promise(() => {}),
  startExam: () => new Promise(() => {}),
}));

const CERT: Subject = {
  id: 1,
  name: 'Scrum / PSM I',
  slug: 'psm-i',
  kind: 'certification',
  pass_mark: 85,
  exam_question_count: 80,
  exam_minutes: 60,
  has_exam_profile: true, is_archived: false, display_order: 100,
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

const renderPractice = (entry = '/practice') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
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

const recommended = () => screen.findByRole('region', { name: 'Recommended now' });

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSubjects.mockResolvedValue([CERT]);
  mockGetHome.mockResolvedValue(summary());
  mockGetOther.mockResolvedValue([]);
  mockGetFocus.mockResolvedValue([]);
  mockReviewCounts.mockResolvedValue({ unreviewed: 0, spaced_due: 8 });
  mockPreparation.mockReturnValue({ selectedId: null, selected: null });
});

// ---- continue ----------------------------------------------------------

describe('Practice — continue', () => {
  it('leads with the unfinished session when there is one', async () => {
    mockGetHome.mockResolvedValue(summary({ resumable: RESUMABLE }));
    renderPractice();

    const panel = await recommended();
    expect(within(panel).getByRole('heading', { name: 'Sprint Planning drill' })).toBeInTheDocument();
    // What is left, from the real counts rather than a stored percentage.
    expect(within(panel).getByText(/12 questions remaining · 8 of 20 answered/)).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'Continue' })).toHaveAttribute('href', '/exam/42');
  });

  it('offers no Continue at all when nothing was left unfinished', async () => {
    renderPractice();

    await recommended();
    // Not an empty card, not a disabled button, not "nothing in progress".
    expect(screen.queryByRole('link', { name: /Continue/ })).not.toBeInTheDocument();
  });
});

// ---- a weakness ----------------------------------------------------------

describe('Practice — a weak area', () => {
  it('names the weak domain, its score and the floor it is under', async () => {
    mockGetSubjects.mockResolvedValue([WEAK]);
    renderPractice();

    const panel = await recommended();
    expect(within(panel).getByRole('heading', { name: 'Managing Products with Agility' })).toBeInTheDocument();
    expect(within(panel).getByText(/74% in your qualifying mocks, under the 80% floor/)).toBeInTheDocument();
  });

  it('is not the recommendation when no domain is under the floor', async () => {
    renderPractice();

    const panel = await recommended();
    expect(within(panel).queryByText(/under the \d+% floor/)).not.toBeInTheDocument();
    expect(within(panel).getByRole('heading', { name: 'Ready for a mock' })).toBeInTheDocument();
  });

  it('carries the domain through to the drill rather than dropping it', async () => {
    mockGetSubjects.mockResolvedValue([WEAK]);
    renderPractice();

    const panel = await recommended();
    expect(within(panel).getByRole('link', { name: 'Start focused drill' })).toHaveAttribute(
      'href',
      '/exam-setup?kind=drill&subject=1&domain=Managing%20Products%20with%20Agility'
    );
  });
});

describe('Practice — recommendations show their working', () => {
  it('opens the evidence behind a weakness, and what would clear it', async () => {
    const user = userEvent.setup();
    mockGetSubjects.mockResolvedValue([WEAK]);
    renderPractice();

    const panel = await recommended();
    await user.click(within(panel).getByRole('button', { name: 'Why am I seeing this?' }));

    const why = screen.getByRole('region', { name: 'Why am I seeing this' });
    expect(within(why).getByText(/Managing Products with Agility: 74% across/)).toBeInTheDocument();
    expect(within(why).getByText(/only a mock moves this figure/)).toBeInTheDocument();
  });
});

// ---- one dominant action ------------------------------------------------

describe('Practice — one dominant action', () => {
  it('has exactly one filled button when a weakness is the recommendation', async () => {
    mockGetSubjects.mockResolvedValue([WEAK]);
    const { container } = renderPractice();

    await recommended();
    expect(filledButtons(container)).toHaveLength(1);
  });

  it('has exactly one filled button when there is nothing to fix', async () => {
    const { container } = renderPractice();

    await recommended();
    expect(filledButtons(container)).toHaveLength(1);
  });

  // Both can be true at once. Two dominant actions is a fork: finishing what
  // was started wins, and the weakness stays on the page as a quieter way in.
  it('still has exactly one filled button when both a session and a weakness exist', async () => {
    mockGetSubjects.mockResolvedValue([WEAK]);
    mockGetHome.mockResolvedValue(summary({ resumable: RESUMABLE }));
    const { container } = renderPractice();

    await recommended();
    expect(filledButtons(container)).toHaveLength(1);
    expect(filledButtons(container)[0]).toHaveAccessibleName('Continue');

    const also = screen.getByRole('region', { name: 'Also available' });
    expect(within(also).getByText('Managing Products with Agility is under the floor')).toBeInTheDocument();
    expect(within(also).getByRole('button', { name: 'Start weak topic focus' })).toBeInTheDocument();
  });
});

// ---- the alternatives ---------------------------------------------------

describe('Practice — also available, and other ways to practise', () => {
  it('keeps every practice destination reachable', async () => {
    renderPractice();

    await recommended();
    const list = screen.getByRole('list', { name: /Other ways to practise/i });
    const hrefs = within(list).getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/design-reviews');
    expect(hrefs).toContain('/system-design');
    expect(hrefs).toContain('/interview-practice');
    expect(hrefs).toContain('/chart-sandbox');

    // The formats of this preparation's own practice are a tab away.
    const tabs = screen.getByRole('tablist', { name: 'Practice formats' });
    expect(within(tabs).getByRole('tab', { name: 'Weak topic focus' })).toBeInTheDocument();
    expect(within(tabs).getByRole('tab', { name: 'Full mock' })).toBeInTheDocument();
  });

  it('says how many cards spaced repetition has due, and leaves an unread count unsaid', async () => {
    renderPractice();
    const also = await screen.findByRole('region', { name: 'Also available' });
    expect(await within(also).findByText('8 questions due')).toBeInTheDocument();
  });

  it('does not offer the mock twice when it is already the recommendation', async () => {
    renderPractice();

    await recommended();
    const also = screen.getByRole('region', { name: 'Also available' });
    expect(within(also).queryByRole('button', { name: 'Start a full mock' })).not.toBeInTheDocument();
  });

  it('offers the mock beside the recommendation when something else leads, and opens its format', async () => {
    const user = userEvent.setup();
    mockGetSubjects.mockResolvedValue([WEAK]);
    renderPractice();

    await recommended();
    const also = screen.getByRole('region', { name: 'Also available' });
    await user.click(within(also).getByRole('button', { name: 'Start a full mock' }));
    expect(screen.getByRole('tab', { name: 'Full mock' })).toHaveAttribute('aria-selected', 'true');
  });

  it('offers the other ways as links, so they cannot compete with the one action', async () => {
    renderPractice();

    await recommended();
    const list = screen.getByRole('list', { name: /Other ways to practise/i });
    expect(within(list).queryAllByRole('button')).toHaveLength(0);
  });
});

// ---- empty and degraded states -----------------------------------------

describe('Practice — when there is nothing to recommend', () => {
  it('still gives a usable page with no subjects at all', async () => {
    mockGetSubjects.mockResolvedValue([]);
    renderPractice();

    const panel = await recommended();
    // No invented urgency, and the alternatives are still there.
    expect(within(panel).getByRole('heading', { name: 'Nothing to recommend yet' })).toBeInTheDocument();
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
      (await within(home.container).findAllByText(/Managing Products with Agility is at 74%, under the 80% floor/)).length
    ).toBeGreaterThan(0);
    home.unmount();

    renderPractice();
    const panel = await recommended();
    expect(within(panel).getByRole('heading', { name: 'Managing Products with Agility' })).toBeInTheDocument();
    expect(within(panel).getByText(/74% in your qualifying mocks/)).toBeInTheDocument();
  });
});

// ---- the picked preparation ---------------------------------------------

describe('Practice follows the picker', () => {
  const DATABRICKS: Subject = {
    ...CERT,
    id: 2,
    name: 'Databricks Data Engineer',
    slug: 'databricks',
    exam_question_count: 45,
    exam_minutes: 90,
    question_count: 120,
    readiness: { ...CERT.readiness, mock_count: 0, blockers: [] },
  };

  beforeEach(() => {
    mockGetSubjects.mockResolvedValue([CERT, DATABRICKS]);
    mockPreparation.mockReturnValue({ selectedId: 2, selected: DATABRICKS });
  });

  // It used to lead with the subject with the most mocks whatever was picked:
  // Databricks in the header, a PSM I mock on the page.
  it('recommends for the picked preparation, not the one with the most evidence', async () => {
    renderPractice();

    const panel = await recommended();
    expect(within(panel).getByRole('heading', { name: 'Ready for a mock' })).toBeInTheDocument();
    expect(screen.getByText('Databricks Data Engineer')).toBeInTheDocument();
    expect(within(panel).getByText(/45 questions, 90 minutes, timed/)).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'Take a mock' }))
      .toHaveAttribute('href', '/exam-setup?kind=mock&subject=2');
    expect(mockReviewCounts).toHaveBeenCalledWith(2);
  });

  it("does not offer another preparation's unfinished session", async () => {
    mockGetHome.mockResolvedValue(summary({
      resumable: RESUMABLE,
      per_subject: [
        { subject_id: 1, unreviewed: 0, resumable: RESUMABLE },
        { subject_id: 2, unreviewed: 0, resumable: null },
      ],
    }));
    renderPractice();

    const panel = await recommended();
    expect(within(panel).getByRole('heading', { name: 'Ready for a mock' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Continue' })).not.toBeInTheDocument();
  });

  it("offers the picked preparation's own unfinished session", async () => {
    mockGetHome.mockResolvedValue(summary({
      resumable: null,
      per_subject: [
        { subject_id: 1, unreviewed: 0, resumable: null },
        { subject_id: 2, unreviewed: 0, resumable: { ...RESUMABLE, title: 'Delta Lake drill' } },
      ],
    }));
    renderPractice();

    const panel = await recommended();
    expect(within(panel).getByRole('heading', { name: 'Delta Lake drill' })).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'Continue' })).toBeInTheDocument();
  });
});

// ---- the formats -------------------------------------------------------------

describe('Practice formats', () => {
  it('offers the five formats the prototype does', async () => {
    renderPractice();

    const tabs = await screen.findByRole('tablist', { name: 'Practice formats' });
    expect(within(tabs).getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Recommended', 'Weak topic focus', 'Spaced repetition', 'Custom', 'Full mock',
    ]);
    expect(within(tabs).getByRole('tab', { name: 'Recommended' })).toHaveAttribute('aria-selected', 'true');
  });

  it('opens the format named in the address, so it can be linked to and reloaded', async () => {
    renderPractice('/practice?tab=mock');

    expect(await screen.findByRole('tab', { name: 'Full mock' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'practice-panel-mock');
  });

  it('switches format on a click', async () => {
    const user = userEvent.setup();
    renderPractice();

    await user.click(await screen.findByRole('tab', { name: 'Full mock' }));

    expect(screen.getByRole('tab', { name: 'Full mock' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('region', { name: 'Recommended now' })).not.toBeInTheDocument();
  });
});
