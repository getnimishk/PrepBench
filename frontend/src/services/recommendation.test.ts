// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, expect, it } from 'vitest';
import type { Readiness, ReadinessRules, Subject } from '../types/subject';
import { explainArea, explainBlocker, explainVerdict, nextAction } from './recommendation';

// Every recommendation answers four questions -- why, on what evidence, what to
// do, and what would change it -- from what the server measured. These pin the
// ladder's order, that each rung carries all four, and that numbers are quoted
// from the rule the server sent rather than from a copy.

const RULES: ReadinessRules = {
  min_mocks_for_ready: 3, consecutive_mocks_at_pass: 3, domain_floor_pct: 80,
  recency_days: 14, plateau_min_mocks: 4, plateau_max_spread: 3, min_questions_per_domain: 10,
};

function readiness(over: Partial<Readiness> = {}): Readiness {
  return {
    state: 'developing', mock_count: 4, pass_mark: 85, recent_scores: [70, 78, 81, 83],
    latest_taken_at: '2026-09-10T10:00:00', is_stale: false,
    domains: [{ domain: 'Scrum Events', state: 'needs_work', answered: 24, score_pct: 66.7 }],
    weakest_domain: 'Scrum Events', points_per_mock: 4.3, mocks_to_pass_estimate: null,
    blockers: [], most_improved: null, rules: RULES,
    ...over,
  };
}

function subject(r: Partial<Readiness> = {}, over: Partial<Subject> = {}): Subject {
  return {
    id: 7, name: 'PSM I', slug: 'psm-i', kind: 'certification', pass_mark: 85,
    exam_question_count: 80, exam_minutes: 60, is_archived: false, display_order: 1,
    has_exam_profile: true, question_count: 300, readiness: readiness(r),
    ...over,
  };
}

const WEAK = { kind: 'weak_domain' as const, domain: 'Scrum Events', value: 66.7, target: 80, count: 24 };
const BELOW = { kind: 'below_pass' as const, value: 78, target: 85, count: 2 };
const STALE = { kind: 'stale' as const, value: 20, target: 14 };
const RESUMABLE = { session_id: 9, title: 'PSM mock', session_kind: 'mock', answered: 30, total: 80 };

describe('the next action', () => {
  it('finishes what was started before anything else', () => {
    const next = nextAction({ subject: subject({ blockers: [WEAK, STALE] }), unreviewed: 5, resumable: RESUMABLE });
    expect(next).toMatchObject({ label: 'Unfinished session', cta: 'Pick it up', to: '/exam/9' });
    expect(next.evidence).toEqual(['30 of 80 questions answered']);
  });

  it('puts out-of-date evidence ahead of reading misses', () => {
    const next = nextAction({ subject: subject({ blockers: [WEAK, STALE] }), unreviewed: 5, resumable: null });
    expect(next).toMatchObject({ label: 'Out of date', cta: 'Take a mock', to: '/exam-setup?kind=mock&subject=7' });
    expect(next.evidence).toEqual(['Last full mock: 20 days ago', 'A mock counts as evidence for 14 days']);
    expect(next.changesWhen).toMatch(/Completing a full mock/);
  });

  it('then unreviewed misses, then the weak area', () => {
    const withMisses = nextAction({ subject: subject({ blockers: [WEAK] }), unreviewed: 5, resumable: null });
    expect(withMisses).toMatchObject({ label: 'Unreviewed misses', to: '/review' });
    expect(withMisses.changesWhen).toBe('Reviewing all 5. Then this points at the next thing the evidence shows.');

    const weak = nextAction({ subject: subject({ blockers: [WEAK] }), unreviewed: 0, resumable: null });
    expect(weak).toMatchObject({
      label: 'Weak area', cta: 'Practise it', to: '/exam-setup?kind=drill&subject=7&domain=Scrum%20Events',
    });
    expect(weak.evidence).toEqual([
      'Scrum Events: 67% across your last 3 mocks, 24 questions answered',
      'Every area has to reach 80%',
    ]);
  });

  it('offers no action when the evidence says there is nothing left to do', () => {
    const ready = nextAction({
      subject: subject({ state: 'ready', blockers: [], recent_scores: [88, 90, 93] }), unreviewed: 0, resumable: null,
    });
    expect(ready).toMatchObject({ why: 'Book the exam.', cta: null, to: null });
    expect(ready.changesWhen).toBe('A new mock under 85%, an area falling under 80%, or your last mock ageing past 14 days.');

    const plateau = nextAction({
      subject: subject({ state: 'plateau', blockers: [BELOW], recent_scores: [84, 85, 84, 86] }), unreviewed: 0, resumable: null,
    });
    expect(plateau.cta).toBeNull();
    expect(plateau.changesWhen).toBe('A mock that puts your last 4 more than 3 points apart, up or down.');
  });

  it('starts a new preparation where it can actually start', () => {
    const empty = nextAction({ subject: subject({}, { question_count: 0 }), unreviewed: 0, resumable: null });
    expect(empty).toMatchObject({ cta: 'Import questions', to: '/question-bank' });

    const first = nextAction({
      subject: subject({ mock_count: 0, recent_scores: [], blockers: [{ kind: 'more_mocks', value: 0, target: 3, count: 3 }] }),
      unreviewed: 0, resumable: null,
    });
    expect(first).toMatchObject({ cta: 'Take your first mock' });
    expect(first.changesWhen).toBe('Completing your first full mock. Readiness needs 3.');
  });

  it('answers all four questions on every rung', () => {
    const cases = [
      nextAction({ subject: subject({ blockers: [BELOW] }), unreviewed: 0, resumable: null }),
      nextAction({ subject: subject({}, { has_exam_profile: false }), unreviewed: 0, resumable: null }),
      nextAction({ subject: subject({ blockers: [WEAK] }), unreviewed: 1, resumable: null }),
    ];
    for (const next of cases) {
      expect(next.why.length).toBeGreaterThan(0);
      expect(next.evidence.length).toBeGreaterThan(0);
      expect(next.changesWhen.length).toBeGreaterThan(0);
    }
  });
});

describe('quoting the rule', () => {
  it('uses the numbers the server sent', () => {
    const r = readiness({
      state: 'ready', blockers: [], recent_scores: [90, 91, 92],
      rules: { ...RULES, domain_floor_pct: 75, recency_days: 21 },
    });
    expect(explainVerdict(r)!.changesWhen).toBe(
      'A new mock under 85%, an area falling under 75%, or your last mock ageing past 21 days.',
    );
  });

  it('says it without numbers rather than guessing them when the rule is not there', () => {
    const r = readiness({ state: 'ready', blockers: [], recent_scores: [90, 91, 92], rules: undefined });
    const reading = explainVerdict(r)!;
    expect(reading.changesWhen).toBe(
      'A new mock under the pass mark, an area falling under the floor, or your evidence going out of date.',
    );
    expect(reading.evidence.join(' ')).not.toMatch(/80%/);
    expect(explainBlocker(r, WEAK)!.evidence[0]).toBe('Scrum Events: 67% across your recent mocks, 24 questions answered');
  });
});

describe('one area', () => {
  const counts = {
    domain: 'Scrum Events', answers: 40, accuracy_percentage: 62.5,
    question_count: 30, attempted_questions: 20, missed_questions: 9, due_now: 0, unreviewed_misses: 0,
  };

  it('puts misses waiting for review first, the way Home does', () => {
    const reading = explainArea({ ...counts, unreviewed_misses: 2, due_now: 3 }, readiness({ blockers: [WEAK] }));
    expect(reading.headline).toBe('2 misses here have not been reviewed.');
    expect(reading.changesWhen).toBe('Reviewing them in Review.');
    expect(reading.evidence).toContain('2 misses from mocks not reviewed yet');
  });

  it('does not call an area fine when the mocks have not asked enough to judge it', () => {
    const thin = explainArea(counts, readiness({
      domains: [{ domain: 'Scrum Events', state: 'needs_evaluation', answered: 3, score_pct: null }],
    }));
    expect(thin.headline).toBe('Your mocks have not asked enough here to judge it.');
    expect(thin.why).toBe('3 answers from mocks so far; readiness judges an area from 10.');
    expect(thin.changesWhen).toBe('Full mocks that bring this area to 10 answers.');
  });

  it('has nothing to interpret before anything is answered', () => {
    const reading = explainArea({ ...counts, answers: 0, accuracy_percentage: null, attempted_questions: 0, missed_questions: 0 }, readiness());
    expect(reading.headline).toBe('Nothing here has been measured yet.');
    expect(reading.evidence).toContain('Nothing answered in this area yet');
  });

  it('points at retrieval when the schedule has something due', () => {
    const reading = explainArea({ ...counts, due_now: 3 }, readiness());
    expect(reading.headline).toBe('Retrieval is what moves this forward.');
    expect(reading.why).toBe('3 questions here are due for review.');
  });

  it('calls an area under the floor only when the verdict does', () => {
    const under = explainArea(counts, readiness({ blockers: [WEAK] }));
    expect(under.headline).toBe('In your mocks, this area is under the 80% floor.');
    expect(under.evidence[0]).toBe('In your last 3 mocks: 67%, 24 questions answered');
    expect(under.evidence[1]).toBe('Every answer here, drills included: 63% across 40');

    // 62.5% across every answer, but fine in the mocks: not called weak.
    const fine = explainArea(counts, readiness({
      domains: [{ domain: 'Scrum Events', state: 'developing', answered: 24, score_pct: 83.3 }],
    }));
    expect(fine.headline).toBe('Nothing is waiting on you here.');
    expect(fine.why).toBe('Nothing here is due for review, and in your mocks the area is at or above the 80% floor.');
  });

  it('does not claim the floor is met when it cannot know the floor', () => {
    const reading = explainArea(counts, readiness({
      rules: undefined,
      domains: [{ domain: 'Scrum Events', state: 'developing', answered: 24, score_pct: 83.3 }],
    }));
    expect(reading.headline).toBe('Nothing is waiting on you here.');
    expect(reading.why).toBe('Nothing here is due for review.');
  });
});
