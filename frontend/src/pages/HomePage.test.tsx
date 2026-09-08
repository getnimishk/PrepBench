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
  mockGetFocus.mockResolvedValue([]);
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

  // The evidence panel replaced the running sentence ("85% to pass · 6 full
  // mocks"), so this asserts the facts rather than the phrasing -- and asserts
  // each figure against the label that gives it meaning, which the substring
  // match it replaces did not. A bare "6" on the page is not evidence of
  // anything; "6" under "Full mocks" is.
  //
  // "93%" now legitimately appears twice: as the headline figure, and as the
  // last point's label on the trend. Each is asserted where it belongs rather
  // than by a loose text match that would pass on either.
  it('shows the evidence behind the verdict, not just the verdict', async () => {
    renderHome();

    // The headline: the score of the most recent qualifying paper.
    const latest = (await screen.findByText('Latest qualifying run')).parentElement!;
    expect(latest).toHaveTextContent('93%');

    const labelled = (label: string) => {
      const cell = screen.getByText(label).parentElement;
      expect(cell).not.toBeNull();
      return cell as HTMLElement;
    };

    // The pass mark, and the count of papers it was measured over.
    expect(labelled('Pass mark')).toHaveTextContent('85%');
    expect(labelled('Full mocks')).toHaveTextContent('6');
    expect(labelled('Last sat')).toHaveTextContent(/\d/);
  });

  // ---- the trend ---------------------------------------------------------
  //
  // Four numbers in a row say what the scores were. Only the picture says
  // whether they are going anywhere, and "am I improving" is most of why
  // anyone opens this page.

  it('draws the run of mocks, and announces every score to a screen reader', async () => {
    renderHome();

    const chart = await screen.findByRole('img', { name: /Your last 4 mocks/ });
    // The series, in full, in order -- not a decorative squiggle.
    expect(chart).toHaveAccessibleName(/70%, 83%, 88%, 93%/);
    // And the line it has to be read against.
    expect(chart).toHaveAccessibleName(/pass mark is 85%/);
  });

  it('draws the pass mark as a line, so crossing it is visible not calculated', async () => {
    const { container } = renderHome();

    await screen.findByRole('img', { name: /Your last 4 mocks/ });
    const dashed = [...container.querySelectorAll('svg line')]
      .filter((l) => l.getAttribute('stroke-dasharray'));
    expect(dashed).toHaveLength(1);
    expect(container.querySelector('svg')).toHaveTextContent('85% to pass');
  });

  it('says so rather than drawing a line through one point', async () => {
    mockGetSubjects.mockResolvedValue([{
      ...CERT,
      readiness: { ...CERT.readiness, mock_count: 1, recent_scores: [70] },
    }]);
    renderHome();

    await screen.findByRole('heading', { name: 'Almost there' });
    expect(screen.queryByRole('img', { name: /mocks/ })).not.toBeInTheDocument();
    expect(screen.getByText(/One paper is a reading, not a direction/)).toBeInTheDocument();
  });

  it('shows no evidence panel at all before the first mock', async () => {
    mockGetSubjects.mockResolvedValue([{
      ...CERT,
      readiness: {
        ...CERT.readiness, state: 'needs_evaluation' as const,
        mock_count: 0, recent_scores: [], points_per_mock: null,
      },
    }]);
    renderHome();

    await screen.findByRole('heading', { name: 'Not measured yet' });
    // An empty band of zeroes would read as failure rather than as absence.
    expect(screen.queryByText('Latest qualifying run')).not.toBeInTheDocument();
    expect(screen.queryByText('Pass mark')).not.toBeInTheDocument();
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

  // /subjects/:id was routed and linked from nowhere: the only way to reach
  // the per-domain breakdown, the plateau explanation and the READY
  // explanation was to type its URL. The subject name is the way in, and it
  // is a link rather than a button so that "exactly one continuation" below
  // keeps meaning what it says.
  it('reaches the subject page through the subject name', async () => {
    renderHome();

    const link = await screen.findByRole('link', { name: 'Scrum / PSM I' });
    expect(link).toHaveAttribute('href', '/subjects/1');
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

  // PLATEAU is a state, not a blocker kind, so `blockers[0]` describes the
  // score and never the shape of it. Home used to render "one of your last
  // three came in at 84%" over four results that were all 84%.
  it('explains a plateau as a plateau, and does not then offer another mock', async () => {
    mockGetSubjects.mockResolvedValue([{
      ...CERT,
      readiness: {
        ...CERT.readiness,
        state: 'plateau' as const,
        recent_scores: [84, 83, 84.5, 84],
        blockers: [{ kind: 'below_pass' as const, value: 84, target: 85, count: 4 }],
      },
    }]);
    mockGetHome.mockResolvedValue(summary({ unreviewed_total: 0, per_subject: [] }));
    renderHome();

    expect(await screen.findByText(/no movement across four mocks/i)).toBeInTheDocument();
    expect(screen.getByText(/exam-day variance, not knowledge/i)).toBeInTheDocument();
    // The sentence above has just said another paper will not move it.
    expect(screen.queryByRole('button', { name: /take a mock/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Another full paper is the only thing/)).not.toBeInTheDocument();
  });

  // The one blocker whose remedy is time-critical: reading a miss cannot make
  // month-old evidence current, and until a fresh paper lands the verdict is
  // about someone the learner used to be.
  it('puts a fresh mock ahead of reading when the evidence has aged out', async () => {
    mockGetSubjects.mockResolvedValue([{
      ...CERT,
      readiness: {
        ...CERT.readiness,
        is_stale: true,
        blockers: [{ kind: 'stale' as const, value: 31, target: 14 }],
      },
    }]);
    mockGetHome.mockResolvedValue(
      summary({ unreviewed_total: 40, per_subject: [{ subject_id: 1, unreviewed: 40 }] })
    );
    renderHome();

    expect(await screen.findByRole('button', { name: 'Take a mock' })).toBeInTheDocument();
    expect(screen.getByText(/Your last mock was 31 days ago/)).toBeInTheDocument();
    expect(screen.getByText(/brings the verdict back to now/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Review them' })).not.toBeInTheDocument();
  });

  it('says the work is done when the evidence supports it, and offers nothing more', async () => {
    mockGetSubjects.mockResolvedValue([{
      ...CERT,
      readiness: {
        ...CERT.readiness, state: 'ready' as const, recent_scores: [88, 90, 93], blockers: [],
      },
    }]);
    mockGetHome.mockResolvedValue(summary({ unreviewed_total: 0, per_subject: [] }));
    renderHome();

    expect(await screen.findByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('Book the exam.')).toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
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

// ---- topics to focus on -------------------------------------------------
//
// The counts come from the same query the weak-topic drill draws from, so
// this panel cannot name a topic Practice would then refuse to offer. What
// these protect is the other half: that the panel shows the evidence rather
// than the verdict alone, and that it never becomes a second call to action.

describe('HomePage topics to focus on', () => {
  it('shows each weak topic with the count that made it weak', async () => {
    mockGetFocus.mockResolvedValue([
      { topic: 'Daily Scrum', answered: 11, correct: 6, accuracy_percentage: 54.5 },
      { topic: 'Sprint Planning', answered: 6, correct: 4, accuracy_percentage: 66.7 },
    ]);
    renderHome();

    expect(await screen.findByText('Daily Scrum')).toBeInTheDocument();
    expect(screen.getByText('6 / 11')).toBeInTheDocument();
    expect(screen.getByText('Sprint Planning')).toBeInTheDocument();
    expect(screen.getByText('4 / 6')).toBeInTheDocument();
  });

  it('says where the numbers come from, because two definitions of weak existed', async () => {
    mockGetFocus.mockResolvedValue([
      { topic: 'Daily Scrum', answered: 11, correct: 6, accuracy_percentage: 54.5 },
    ]);
    renderHome();

    expect(await screen.findByText(/mocks only, over at least three answers/i))
      .toBeInTheDocument();
  });

  it('is absent rather than empty when nothing is measurably weak', async () => {
    mockGetFocus.mockResolvedValue([]);
    renderHome();

    await screen.findByRole('heading', { name: 'Almost there' });
    expect(screen.queryByText(/topics to focus on/i)).not.toBeInTheDocument();
  });

  // The rows navigate, so they are links. If they were buttons they would
  // compete with the one continuation, which is the invariant Home has held
  // since the metric wall came out.
  it('does not add a second call to action', async () => {
    mockGetHome.mockResolvedValue(
      summary({ unreviewed_total: 12, per_subject: [{ subject_id: 1, unreviewed: 12 }] })
    );
    mockGetFocus.mockResolvedValue([
      { topic: 'Daily Scrum', answered: 11, correct: 6, accuracy_percentage: 54.5 },
      { topic: 'Sprint Planning', answered: 6, correct: 4, accuracy_percentage: 66.7 },
    ]);
    renderHome();

    expect(await screen.findByRole('button', { name: 'Review them' })).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    // And the rows are still reachable, as links.
    expect(screen.getByRole('link', { name: /Practise Daily Scrum/ })).toBeInTheDocument();
  });

  it('defers the tail of a long list to Insights rather than printing all of it', async () => {
    mockGetFocus.mockResolvedValue(
      Array.from({ length: 8 }, (_, i) => ({
        topic: `Topic ${i + 1}`, answered: 6, correct: 3, accuracy_percentage: 50,
      }))
    );
    renderHome();

    // The cap is what is under test, not the number: the panel shows a set
    // worth acting on and hands the tail to Insights rather than printing all
    // eight down the side of Home.
    expect(await screen.findByText('Topic 4')).toBeInTheDocument();
    expect(screen.queryByText('Topic 5')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '4 more in Insights' })).toBeInTheDocument();
  });
});
