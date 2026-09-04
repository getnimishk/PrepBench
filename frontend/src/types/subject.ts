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
