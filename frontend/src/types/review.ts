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
}

export interface ReviewQueue {
  items: ReviewItem[];
  /** What is behind the cap. Reported, never rendered as a debt. */
  remaining: number;
  total_unreviewed: number;
}
