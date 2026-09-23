// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

/**
 * One wrong answer, with everything needed to understand it.
 *
 * The product could count these long before it could show them: Home said
 * "Review them", Review restated the number, and there the trail stopped.
 */
export interface ReviewOption {
  id: number;
  text: string;
  is_correct: boolean;
  why_incorrect?: string | null;
}

/**
 * One different question on the same concept.
 *
 * The check is what turns reading into evidence. Reviewing a miss used to set
 * a timestamp and nothing else -- the schedule was driven only by answering,
 * so an evening of explanations left the product's model of the learner
 * exactly where it started.
 *
 * `null` on a ReviewItem is a real answer, not a failure: a concept with one
 * question in the bank cannot be checked, and saying so beats asking about
 * something else and calling it verification.
 */
export interface CheckQuestion {
  question_id: number;
  question_text: string;
  is_multiple: boolean;
  options: ReviewOption[];
}

/** How much review is waiting, for the navigation's badge. */
export interface ReviewCounts {
  unreviewed: number;
  spaced_due: number;
}

export interface CheckResult {
  passed: boolean;
  correct_option_ids: number[];
  explanation?: string | null;
  verdict: string;
}

export interface ReviewItem {
  answer_id: number;
  session_id: number;
  question_id: number;
  session_title: string;
  taken_at?: string | null;
  domain: string;
  question_text: string;
  options: ReviewOption[];
  selected_option_ids: number[];
  explanation?: string | null;
  check?: CheckQuestion | null;
}

export interface ReviewQueue {
  items: ReviewItem[];
  /** What is behind the cap. Reported, never rendered as a debt. */
  remaining: number;
  total_unreviewed: number;
  /** Questions the spaced schedule has brought round again, in the same scope. */
  spaced_due: number;
  /** Misses whose most recent check did not transfer. */
  needs_retry?: number;
  /** Misses whose most recent check passed within the window. */
  verified_recently?: number;
  verified_window_days?: number;
}
