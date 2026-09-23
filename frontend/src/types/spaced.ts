// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

/** How well a card came back. The server maps these to SM-2 quality. */
export type SpacedGrade = 'again' | 'hard' | 'good' | 'easy';

/** One due question, as a card. `answer` and `explanation` must not be rendered
 *  before the learner asks to see them: the card is for recall. */
export interface SpacedCard {
  question_id: number;
  question_text: string;
  domain?: string | null;
  topic?: string | null;
  is_multiple: boolean;
  answer: string[];
  explanation?: string | null;
  due_since: string;
  repetition: number;
  /** Days each grade would schedule, from the same SM-2 step grading runs. */
  intervals: Record<SpacedGrade, number>;
}

export interface SpacedDeck {
  cards: SpacedCard[];
  due_total: number;
}

export interface SpacedGradeResult {
  question_id: number;
  grade: SpacedGrade;
  interval_days: number;
  next_review_date: string;
}
