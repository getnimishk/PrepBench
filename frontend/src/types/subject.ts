// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

export type ReadinessState =
  | 'needs_evaluation'
  | 'developing'
  | 'almost_there'
  | 'plateau'
  | 'ready';

export type DomainState = 'needs_evaluation' | 'needs_work' | 'developing' | 'solid';

export interface DomainReadiness {
  domain: string;
  state: DomainState;
  answered: number;
  /** Null, never 0, below the reporting threshold. Too few questions to
   *  judge is not the same as a bad score. */
  score_pct?: number | null;
}

/**
 * One unmet condition of READY.
 *
 * The rule names the condition and the numbers; the surface writes the
 * sentence. Home used to invent its own explanation -- it called the
 * lowest-scoring domain "your weakest area" even when that domain was
 * comfortably above the floor, which reads as a problem where there is none.
 */
export type BlockerKind =
  | 'no_exam_profile'
  | 'more_mocks'
  | 'weak_domain'
  | 'below_pass'
  | 'stale';

export interface Blocker {
  kind: BlockerKind;
  domain?: string | null;
  value?: number | null;
  target?: number | null;
  count?: number | null;
}

/** A domain that improved between the last two mocks. */
export interface Movement {
  domain: string;
  before_pct: number;
  after_pct: number;
  points: number;
}

export interface Readiness {
  state: ReadinessState;
  /** Drills are excluded. Only full mocks under exam conditions count. */
  mock_count: number;
  pass_mark?: number | null;
  recent_scores: number[];
  latest_taken_at?: string | null;
  is_stale: boolean;
  domains: DomainReadiness[];
  weakest_domain?: string | null;
  points_per_mock?: number | null;
  /** The forecast that replaces a countdown. Null when no trend is honest. */
  mocks_to_pass_estimate?: number | null;
  /** Why this is not READY, most actionable first. Empty when it is. */
  blockers: Blocker[];
  /** The clearest gain between the last two mocks, if there was one. */
  most_improved?: Movement | null;
}

export interface Subject {
  id: number;
  name: string;
  slug: string;
  kind: 'certification' | 'skill';
  pass_mark?: number | null;
  exam_question_count?: number | null;
  exam_minutes?: number | null;
  /** False means no mock can be assembled, so readiness can never be reached. */
  has_exam_profile: boolean;
  readiness: Readiness;
  /** How many questions this subject actually has. Zero means no exam of any
   *  kind can be assembled, however complete the exam profile looks. */
  question_count: number;
}

export interface FormatCoverage {
  key: string;
  label: string;
  count: number;
  completed: number;
  /** False formats are still rendered - an empty row is how the app says
   *  a subject has no content of that kind. */
  available: boolean;
  detail: string;
}

export interface Resumable {
  session_id: number;
  title: string;
  session_kind: string;
  answered: number;
  total: number;
  seconds_remaining?: number | null;
  started_at?: string | null;
}

export interface HomeSummary {
  resumable?: Resumable | null;
  unreviewed_total: number;
  due_for_review: number;
  per_subject: { subject_id: number; unreviewed: number }[];
  /** Full mocks only. The old dashboard's accuracy averaged drills in. */
  mock_count: number;
  /** Null, never 0, when no mock has been taken. */
  mock_accuracy?: number | null;
  subjects_total: number;
  subjects_ready: number;
}

/** A practice format that has actually been used. Empty ones are omitted
 *  by the server rather than shown as zero. */
export interface OtherPreparation {
  key: string;
  label: string;
  detail: string;
  href: string;
}

export interface ActivityItem {
  kind: string;
  at?: string | null;
  title: string;
  detail: string;
  href: string;
}

/** Human labels for the states. "Needs evaluation" invites an action where
 *  a zero would just accuse. */
export const READINESS_LABELS: Record<ReadinessState, string> = {
  needs_evaluation: 'Needs evaluation',
  developing: 'Developing',
  almost_there: 'Almost there',
  plateau: 'At the line',
  ready: 'Ready',
};

export const DOMAIN_LABELS: Record<DomainState, string> = {
  needs_evaluation: 'Needs evaluation',
  needs_work: 'Needs work',
  developing: 'Developing',
  solid: 'Solid',
};
