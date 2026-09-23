// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

export type QuestionType =
  | 'single_choice'
  | 'multiple_choice'
  | 'true_false'
  | 'scenario'
  | 'case_study'
  | 'image'
  | 'code'
  | 'drag_and_drop';

export type QuestionDifficulty = 'easy' | 'medium' | 'hard';

/** What the learner's own answers say about a question, by the one server-side definition. */
export type QuestionOutcome = 'missed' | 'due' | 'correct' | 'unattempted';

export interface QuestionEvidence {
  answered: number;
  correct: number;
  missed: boolean;
  due: boolean;
}

/** The Question Bank's figures, for one preparation's questions or all of them. */
export interface QuestionBankSummary {
  subject_id?: number | null;
  questions: number;
  attempted: number;
  never_attempted: number;
  answers: number;
  correct_answers: number;
  /** Null, never 0, when nothing has been answered. */
  correct_percentage: number | null;
  review_due: number;
  missed_at_least_once: number;
  flagged_reviewed: number;
}

export interface QuestionOption {
  id?: number;
  option_text: string;
  is_correct: boolean;
  explanation_why_incorrect?: string;
  order_index?: number;
}

export interface Question {
  id: number;
  /** Present when the listing was asked for it. */
  evidence?: QuestionEvidence;
  text: string;
  question_type: QuestionType;
  difficulty: QuestionDifficulty;
  domain: string;
  topic: string;
  subtopic?: string;
  certification: string;
  source?: string;
  tags: string[];
  code_snippet?: string;
  case_study_text?: string;
  image_url?: string;
  explanation?: string;
  reference_url?: string;
  created_at: string;
  updated_at: string;
  is_reviewed: boolean;
  options: QuestionOption[];
}
