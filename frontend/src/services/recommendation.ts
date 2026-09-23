// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { Blocker, Readiness, Resumable, Subject } from '../types/subject';
import { pct } from './readinessText';

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const capitalised = (n: number) => {
  const w = WORDS[n] ?? String(n);
  return w.charAt(0).toUpperCase() + w.slice(1);
};

/**
 * Every recommendation, with its working shown.
 *
 * A suggestion the learner cannot interrogate is asking to be taken on faith.
 * Each one here answers four questions: why am I seeing this (`why`), what
 * evidence caused it (`evidence`, each item with its number), what should I do
 * (`cta` and `to`), and what would change it (`changesWhen`).
 *
 * Built only from what the server measured: readiness and its blockers, the
 * review queue, the unfinished session. The rule's thresholds come from the
 * blocker that carries them or from `readiness.rules` -- never from a copy of
 * the numbers kept here, which would drift the first time one is changed. When
 * a number is not available, the sentence says it without one.
 */
export interface Explanation {
  why: string;
  evidence: string[];
  changesWhen: string;
}

export interface NextAction extends Explanation {
  label: string;
  cta: string | null;
  to: string | null;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

const mockHref = (subject: Subject) => `/exam-setup?kind=mock&subject=${subject.id}`;

export const drillHref = (subject: Subject, domain: string) =>
  `/exam-setup?kind=drill&subject=${subject.id}&domain=${encodeURIComponent(domain)}`;

/** Where one area of one preparation is read in full. */
export const areaHref = (subjectId: number, domain: string) =>
  `/analytics/area?subject=${subjectId}&domain=${encodeURIComponent(domain)}`;

/** The scores, oldest to newest, the way the verdict reads them. */
const scoreRun = (scores: number[]) => scores.map((s) => pct(s)).join(' → ');

/** "your last 3 mocks", from the rule when it is known. */
function lastMocks(readiness: Readiness): string {
  const window = readiness.rules?.consecutive_mocks_at_pass;
  if (!window) return 'your recent mocks';
  const n = Math.min(window, readiness.mock_count);
  return `your last ${n} ${plural(n, 'mock', 'mocks')}`;
}

/** Something left running. Finishing it outranks starting anything new. */
export function explainResumable(resumable: Resumable): Explanation {
  return {
    why: `You stopped at question ${resumable.answered + 1} of ${resumable.total}.`,
    evidence: [`${resumable.answered} of ${resumable.total} questions answered`],
    changesWhen: 'Finishing that session, or discarding it from Mock Exam setup.',
  };
}

/** One unmet condition of READY, read as evidence and a way out. */
export function explainBlocker(readiness: Readiness, blocker: Blocker): Explanation | null {
  switch (blocker.kind) {
    case 'weak_domain': {
      const domain = blocker.domain ?? '';
      const answered = blocker.count;
      return {
        why: `${domain} is the one area under the floor, at ${pct(blocker.value ?? 0)}.`,
        evidence: [
          `${domain}: ${pct(blocker.value ?? 0)} across ${lastMocks(readiness)}`
            + (answered != null ? `, ${answered} ${plural(answered, 'question', 'questions')} answered` : ''),
          `Every area has to reach ${pct(blocker.target ?? 0)}`,
        ],
        changesWhen: `${domain} reaching ${pct(blocker.target ?? 0)} in the mocks that decide readiness. `
          + 'Drills help you get there; only a mock moves this figure.',
      };
    }
    case 'stale': {
      const days = Math.round(blocker.target ?? 0);
      return {
        why: 'Your last mock is too old to say where you are now.',
        evidence: [
          `Last full mock: ${Math.round(blocker.value ?? 0)} days ago`,
          `A mock counts as evidence for ${days} days`,
        ],
        changesWhen: `Completing a full mock. The verdict then rests on evidence from the last ${days} days again.`,
      };
    }
    case 'below_pass': {
      const n = blocker.count ?? 1;
      const run = readiness.rules?.consecutive_mocks_at_pass;
      return {
        why: 'Recent mocks came in under the pass mark.',
        evidence: [
          `${n} of ${lastMocks(readiness)} under ${pct(blocker.target ?? 0)}, the lowest at ${pct(blocker.value ?? 0)}`,
          `Last ${readiness.recent_scores.length} mocks: ${scoreRun(readiness.recent_scores)}`,
        ],
        changesWhen: run
          ? `${run} mocks in a row at or above ${pct(blocker.target ?? 0)}.`
          : `Mocks in a row at or above ${pct(blocker.target ?? 0)}.`,
      };
    }
    case 'more_mocks': {
      const left = blocker.count ?? 0;
      return {
        why: 'There are not yet enough mocks to call a pattern.',
        evidence: [
          `Full mocks sat: ${readiness.mock_count}`,
          `Needed before readiness means anything: ${readiness.mock_count + left}`,
        ],
        changesWhen: `${left === 1 ? 'One more full mock' : `${left} more full mocks`}.`,
      };
    }
    case 'no_exam_profile':
      return {
        why: 'There is no exam to be ready against.',
        evidence: ['No pass mark, question count or time is set'],
        changesWhen: 'Giving the preparation an exam profile under Preparations.',
      };
    default:
      return null;
  }
}

/**
 * What the verdict rests on, and what would move it.
 *
 * For Insights' "what is holding you back": the same blockers the verdict was
 * computed from, read as evidence rather than as a sentence.
 */
export function explainVerdict(readiness: Readiness): Explanation | null {
  const rules = readiness.rules;
  const recent = readiness.recent_scores;
  const passMark = readiness.pass_mark;
  const scores = recent.length ? [`Last ${recent.length} mocks: ${scoreRun(recent)}`] : [];
  const passLine = passMark != null ? [`Pass mark: ${pct(passMark)}`] : [];

  if (readiness.state === 'plateau') {
    return {
      why: 'Your recent mocks have stopped moving.',
      evidence: [...scores, ...passLine],
      changesWhen: rules
        ? `A mock that puts your last ${rules.plateau_min_mocks} more than ${rules.plateau_max_spread} points apart, up or down.`
        : 'A mock that moves clearly away from the last few, up or down.',
    };
  }

  const blocker = readiness.blockers[0] ?? null;
  if (blocker) return explainBlocker(readiness, blocker);
  if (readiness.state !== 'ready') return null;

  return {
    why: 'Nothing is blocking the verdict.',
    evidence: [
      ...scores,
      ...passLine,
      ...(rules ? [`No area under ${pct(rules.domain_floor_pct)}`] : []),
    ],
    changesWhen: rules
      ? `A new mock under ${pct(passMark ?? 0)}, an area falling under ${pct(rules.domain_floor_pct)}, `
        + `or your last mock ageing past ${rules.recency_days} days.`
      : 'A new mock under the pass mark, an area falling under the floor, or your evidence going out of date.',
  };
}

/**
 * The one action, chosen from the evidence rather than offered as a menu.
 *
 * The ladder Home has always used, moved here so its reasoning can be shown and
 * so no other page works out its own version of it.
 */
export function nextAction({
  subject,
  unreviewed,
  resumable,
}: {
  subject: Subject;
  unreviewed: number;
  resumable: Resumable | null;
}): NextAction {
  const r = subject.readiness;
  const weak = r.blockers.find((b) => b.kind === 'weak_domain');
  const stale = r.blockers.find((b) => b.kind === 'stale');

  if (resumable) {
    return {
      label: 'Unfinished session',
      ...explainResumable(resumable),
      cta: 'Pick it up',
      to: `/exam/${resumable.session_id}`,
    };
  }
  // Stale evidence outranks reading, and only here. Everywhere else in this
  // ladder understanding a miss beats sitting another paper -- but when the
  // last mock has aged out, the page is stating a verdict it no longer has
  // the evidence for, and no amount of reading restores that. This is the
  // one blocker whose remedy is time-critical.
  if (stale) {
    const reading = explainBlocker(r, stale)!;
    return {
      label: 'Out of date',
      // Deliberately does not restate the number: "Why not ready" has just
      // given it, and this block owes the remedy rather than the reading.
      why: 'A fresh paper is the only thing that brings the verdict back to now. '
        + 'Reading old misses is still worth doing; it cannot make old evidence current.',
      evidence: reading.evidence,
      changesWhen: reading.changesWhen,
      cta: 'Take a mock',
      to: mockHref(subject),
    };
  }
  if (unreviewed > 0) {
    return {
      label: 'Unreviewed misses',
      why: `${unreviewed} wrong answer${unreviewed === 1 ? '' : 's'} you have not read `
        + 'the explanation for. Understanding a miss is what changes the next score; '
        + 'answering another new question is not.',
      evidence: [
        `${unreviewed} wrong ${plural(unreviewed, 'answer', 'answers')} from your mocks with no review recorded`,
      ],
      changesWhen: `Reviewing ${unreviewed === 1 ? 'it' : `all ${unreviewed}`}. `
        + 'Then this points at the next thing the evidence shows.',
      cta: 'Review them',
      to: '/review',
    };
  }
  if (weak) {
    return {
      label: 'Weak area',
      ...explainBlocker(r, weak)!,
      cta: 'Practise it',
      to: drillHref(subject, weak.domain ?? ''),
    };
  }
  // A fresh install has subjects and no questions. Offering a mock that
  // the engine will refuse to assemble makes the only action on a new
  // user's Home an error message.
  if (subject.question_count === 0) {
    return {
      label: 'Next',
      why: `There are no ${subject.name} questions yet. Import a bank and `
        + 'PrepBench can start measuring where you stand.',
      evidence: [`Questions in ${subject.name}: 0`],
      changesWhen: `Importing or adding questions for ${subject.name}.`,
      cta: 'Import questions',
      to: '/question-bank',
    };
  }
  if (!subject.has_exam_profile) {
    return {
      label: 'Next',
      why: 'There is no exam to sit for this one, so practice is the whole of it.',
      evidence: [`${subject.name} has no pass mark, question count or time`],
      changesWhen: `Giving ${subject.name} an exam profile under Preparations.`,
      cta: 'Practise',
      to: '/practice',
    };
  }
  if (r.mock_count === 0) {
    const needed = r.rules?.min_mocks_for_ready;
    return {
      label: 'Next',
      why: 'A full paper under exam conditions calibrates everything else — the '
        + 'weak-area detection, the review schedule, and whether you would actually pass.',
      evidence: [
        'Full mocks sat: 0',
        `Questions available in ${subject.name}: ${subject.question_count}`,
      ],
      changesWhen: needed
        ? `Completing your first full mock. Readiness needs ${needed}.`
        : 'Completing your first full mock.',
      cta: 'Take your first mock',
      to: mockHref(subject),
    };
  }
  if (r.state === 'ready') {
    const reading = explainVerdict(r)!;
    return {
      label: 'Next',
      why: 'Book the exam.',
      evidence: reading.evidence,
      changesWhen: reading.changesWhen,
      cta: null,
      to: null,
    };
  }
  // At a plateau with nothing left to read, "another full paper is the only
  // thing that moves the verdict" contradicts the sentence directly above
  // it, which has just said that another paper will not move it. The honest
  // continuation is the decision, not more practice.
  if (r.state === 'plateau') {
    const reading = explainVerdict(r)!;
    return {
      label: 'Next',
      why: `There is nothing further this can measure. ${capitalised(r.rules?.plateau_min_mocks ?? 4)} papers at the same `
        + 'mark is the answer: book the exam, or find the gap somewhere other '
        + 'than in more questions.',
      evidence: reading.evidence,
      changesWhen: reading.changesWhen,
      cta: null,
      to: null,
    };
  }
  const reading = explainVerdict(r);
  return {
    label: 'Next',
    why: 'Another full paper is the only thing that moves the verdict.',
    evidence: reading?.evidence ?? [`Full mocks sat: ${r.mock_count}`],
    changesWhen: reading?.changesWhen ?? 'Completing another full mock.',
    cta: 'Take a mock',
    to: mockHref(subject),
  };
}

/** One area's counts, as the domain-detail endpoint reports them. */
export interface AreaCounts {
  domain: string;
  answers: number;
  accuracy_percentage: number | null;
  question_count: number;
  attempted_questions: number;
  missed_questions: number;
  due_now: number;
  unreviewed_misses: number;
}

/**
 * What one area's figures mean, and what would change them.
 *
 * Two populations meet on this page and neither is allowed to impersonate the
 * other. Whether the area is under the floor is readiness's call, from mocks
 * only -- the same verdict Home and Practice read, so this page cannot call an
 * area weak that they call fine. Everything else is every answer given in the
 * area, drills included, and says so.
 */
export function explainArea(
  detail: AreaCounts,
  readiness: Readiness | null,
): Explanation & { headline: string } {
  const inMocks = readiness?.domains.find((d) => d.domain === detail.domain) ?? null;
  const floor = readiness?.rules?.domain_floor_pct ?? null;
  const underFloor = readiness?.blockers.some(
    (b) => b.kind === 'weak_domain' && b.domain === detail.domain,
  ) || (inMocks?.score_pct != null && floor != null && inMocks.score_pct < floor);

  const evidence = [
    ...(inMocks
      ? [inMocks.score_pct != null
        ? `In ${lastMocks(readiness!)}: ${pct(inMocks.score_pct)}, ${inMocks.answered} ${plural(inMocks.answered, 'question', 'questions')} answered`
        : `In ${lastMocks(readiness!)}: ${inMocks.answered} answered, too few to judge`]
      : []),
    detail.answers > 0
      ? `Every answer here, drills included: ${pct(detail.accuracy_percentage ?? 0)} across ${detail.answers}`
      : 'Nothing answered in this area yet',
    `${detail.attempted_questions} of ${detail.question_count} ${plural(detail.question_count, 'question', 'questions')} attempted`,
    `${detail.missed_questions} answered wrong at least once`,
    `${detail.unreviewed_misses} ${plural(detail.unreviewed_misses, 'miss', 'misses')} from mocks not reviewed yet`,
    `${detail.due_now} due for review now`,
  ];
  const minForVerdict = readiness?.rules?.min_questions_per_domain ?? null;

  if (detail.answers === 0) {
    return {
      headline: 'Nothing here has been measured yet.',
      why: 'No question in this area has been answered, so there is no figure to read.',
      evidence,
      changesWhen: 'Answering questions in this area, in a drill or a mock.',
    };
  }
  // Understanding a miss is what changes the next score -- the same order Home's
  // ladder puts it in.
  if (detail.unreviewed_misses > 0) {
    const n = detail.unreviewed_misses;
    return {
      headline: `${n === 1 ? 'A miss' : `${n} misses`} here ${n === 1 ? 'has' : 'have'} not been reviewed.`,
      why: `${n === 1 ? 'One wrong answer' : `${n} wrong answers`} from your mocks in this area `
        + `${n === 1 ? 'is' : 'are'} still waiting in the review queue.`,
      evidence,
      changesWhen: `Reviewing ${n === 1 ? 'it' : 'them'} in Review.`,
    };
  }
  if (detail.due_now > 0) {
    return {
      headline: 'Retrieval is what moves this forward.',
      why: `${detail.due_now} ${plural(detail.due_now, 'question here is', 'questions here are')} due for review.`,
      evidence,
      changesWhen: 'Reviewing them. A correct recall moves each one further out; reading an explanation does not.',
    };
  }
  if (underFloor && floor != null) {
    return {
      headline: `In your mocks, this area is under the ${pct(floor)} floor.`,
      why: 'Readiness needs every area at the floor, and this one is not.',
      evidence,
      changesWhen: `This area reaching ${pct(floor)} in the mocks that decide readiness. `
        + 'Practising here helps; only a mock moves that figure.',
    };
  }
  // Too few mock answers for the verdict to judge the area. Saying "nothing is
  // waiting" over three wrong answers would be true by the rule and wrong to read.
  if (!inMocks || inMocks.score_pct == null) {
    return {
      headline: 'Your mocks have not asked enough here to judge it.',
      why: inMocks
        ? `${inMocks.answered} ${plural(inMocks.answered, 'answer', 'answers')} from mocks so far`
          + (minForVerdict ? `; readiness judges an area from ${minForVerdict}.` : '.')
        : 'No mock that decides readiness has asked about this area yet.',
      evidence,
      changesWhen: minForVerdict
        ? `Full mocks that bring this area to ${minForVerdict} answers.`
        : 'More full mocks that include this area.',
    };
  }
  return {
    headline: 'Nothing is waiting on you here.',
    why: floor != null && inMocks?.score_pct != null && inMocks.score_pct >= floor
      ? `Nothing here is due for review, and in your mocks the area is at or above the ${pct(floor)} floor.`
      : 'Nothing here is due for review.',
    evidence,
    changesWhen: 'A new miss in this area, or a review coming due.',
  };
}
