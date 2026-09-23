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

/** The numbers the verdict was computed with, served beside it. */
export interface ReadinessRules {
  min_mocks_for_ready: number;
  consecutive_mocks_at_pass: number;
  domain_floor_pct: number;
  recency_days: number;
  plateau_min_mocks: number;
  plateau_max_spread: number;
  min_questions_per_domain: number;
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
  /** What it would take to change the verdict is said from these. Always sent by
   *  the server; optional so a surface without them words it without numbers. */
  rules?: ReadinessRules;
}

export interface Subject {
  id: number;
  name: string;
  /** Stable. Derived from the name on create and deliberately never regenerated
   *  when the name changes, so links keep working. */
  slug: string;
  kind: 'certification' | 'skill';
  /** The one-line description under the name on Home and in the picker. */
  description?: string | null;
  /** The string that binds questions to this preparation, by exact match only. */
  certification?: string | null;
  pass_mark?: number | null;
  exam_question_count?: number | null;
  exam_minutes?: number | null;
  /** ISO date. Null is a real answer, not a missing one: a skill has no exam and
   *  a certification may not be booked yet. */
  target_exam_date?: string | null;
  /** Hidden from the picker, everything kept. Distinct from deletion. */
  is_archived: boolean;
  display_order: number;
  /** False means no mock can be assembled, so readiness can never be reached. */
  has_exam_profile: boolean;
  readiness: Readiness;
  /** How many questions this subject actually has. Zero means no exam of any
   *  kind can be assembled, however complete the exam profile looks.
   *
   *  Counted from the same column the exam engine draws from, which is the whole
   *  point of it -- a count sourced differently can offer an exam the engine
   *  then refuses. */
  question_count: number;
}

/** Create payload. No `slug`: the server derives it from the name.
 *
 *  A certification must carry all three exam-profile fields and a skill must
 *  carry none of them -- the API refuses both halves of that with a 422, because
 *  a certification without a pass mark cannot be measured and a pass mark on a
 *  skill can never be measured against. */
export interface SubjectCreate {
  name: string;
  kind: 'certification' | 'skill';
  description?: string | null;
  certification?: string | null;
  pass_mark?: number | null;
  exam_question_count?: number | null;
  exam_minutes?: number | null;
  target_exam_date?: string | null;
  display_order?: number;
}

/** Update payload. Omitted fields are left alone, so a form that changes one
 *  field cannot clobber the rest.
 *
 *  `slug` and `kind` are absent on purpose. The slug is the preparation's stable
 *  identity; switching kind would strand a pass mark and orphan the evidence
 *  measured against it. */
export interface SubjectUpdate {
  name?: string;
  description?: string | null;
  certification?: string | null;
  pass_mark?: number | null;
  exam_question_count?: number | null;
  exam_minutes?: number | null;
  target_exam_date?: string | null;
  display_order?: number;
  is_archived?: boolean;
}

/** What deleting a preparation actually did.
 *
 *  Reported so a surface can state the outcome rather than repeat what it
 *  promised beforehand. Note the asymmetry: questions and exam sessions are
 *  destroyed, roadmaps and learning attempts are only unlinked. */
export interface SubjectDeleteResult {
  deleted_subject_id: number;
  deleted_subject_name: string;
  questions_deleted: number;
  exam_sessions_deleted: number;
  roadmaps_unlinked: number;
  learning_attempts_unlinked: number;
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
  /** Per preparation. `resumable` here is that preparation's own unfinished
   *  session; the top-level one is the newest across all of them. */
  per_subject: { subject_id: number; unreviewed: number; resumable?: Resumable | null }[];
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

/**
 * One weak topic, with the evidence behind it.
 *
 * Comes from the same query the weak-topic drill draws from, so Home can
 * never name a topic that Practice would then refuse to offer.
 */
export interface FocusTopic {
  topic: string;
  answered: number;
  correct: number;
  accuracy_percentage: number;
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

/** Today's certification review goal for one preparation.
 *
 *  `target` is min(daily_cap, due_for_review + done), so it follows what the
 *  schedule actually has due. It is never a quota: a target of 0 with state
 *  "nothing_due" is the system working, not a missed day. */
export interface CertificationGoal {
  subject_id: number;
  subject_name: string;
  target: number;
  done: number;
  remaining: number;
  due_for_review: number;
  /** Due reviews beyond today's cap, so they are named rather than hidden. */
  queued_beyond_today: number;
  daily_cap: number;
  state: 'nothing_due' | 'not_started' | 'in_progress' | 'done';
  /** From the readiness rules. Null when there is no evidence to call anything
   *  weak -- never a guess. */
  weakest_area?: string | null;
}

/** Today's interview goal: a flat target, not tied to a preparation.
 *
 *  Signals are null until an answer has actually been analysed. Null is never
 *  0 -- an unavailable AI provider produced no signal, and 0% would blame the
 *  learner for a missing API key. */
export interface InterviewGoal {
  target: number;
  done: number;
  remaining: number;
  recorded_today: number;
  state: 'not_started' | 'done';
  latest_content_signal?: number | null;
  latest_delivery_signal?: number | null;
  latest_analysed_at?: string | null;
  /** The round practised longest ago, or never. A recency fact -- deliberately
   *  not a recommendation, because nothing models which round has gone stale. */
  longest_since_round?: string | null;
  longest_since_round_never_practised: boolean;
}

export interface DailyGoals {
  /** Null when no preparation is selected. */
  certification: CertificationGoal | null;
  interview: InterviewGoal;
}
