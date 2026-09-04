// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { QuestionDifficulty } from './question';

export type DesignReviewChoice = 'A' | 'B' | 'ask_first';

export interface FlowStage {
  label: string;
  detail?: string | null;
  /** The stage this option's cost or risk actually sits on. */
  emphasis?: boolean;
}

export interface DesignOption {
  id: number;
  label: 'A' | 'B';
  name: string;
  summary: string;
  flow: FlowStage[];
  key_choices: string[];
  holds_when: string;
  breaks_when: string;
  rough_cost: string;
}

export interface DesignReviewSummary {
  id: number;
  title: string;
  domain: string;
  difficulty: QuestionDifficulty;
  /** Which decision this review is about, without saying which way it goes. */
  axis_label?: string | null;
  concepts: string[];
  attempted: boolean;
}

export interface AxisPerformance {
  axis_label: string;
  attempts: number;
  named: number;
  partial: number;
  missed: number;
  /** Null, not zero, when nothing on this axis has been graded. */
  named_rate?: number | null;
}

export interface DesignReviewAnalytics {
  total_attempts: number;
  graded_attempts: number;
  reviews_completed: number;
  reviews_available: number;
  by_axis: AxisPerformance[];
  /** Null until there is enough graded work to name one honestly. */
  weakest_axis?: AxisPerformance | null;
}

/**
 * What the learner sees while deciding. Note what is absent: the server never
 * sends deciding_axis, reveal or elicit_answer with an unanswered review, so
 * there is no answer here to accidentally render.
 */
export interface DesignReviewDetail {
  id: number;
  title: string;
  brief: string;
  domain: string;
  difficulty: QuestionDifficulty;
  concepts: string[];
  options: DesignOption[];
}

export interface DesignReviewReveal {
  deciding_axis: string;
  reveal: string;
  elicit_answer: string;
}

export interface DesignReviewAttempt {
  id: number;
  review_id: number;
  review_title?: string | null;
  choice: DesignReviewChoice;
  justification: string;
  /** pending | graded | not_graded -- "not_graded" renders as "Not graded", never a zero. */
  grading_status: string;
  axis_verdict?: 'named' | 'partial' | 'missed' | null;
  feedback?: string | null;
  time_spent_seconds: number;
  created_at: string;
  reveal?: DesignReviewReveal | null;
}

export interface SubmitDesignReviewAttemptRequest {
  review_id: number;
  choice: DesignReviewChoice;
  justification: string;
  time_spent_seconds?: number;
}
