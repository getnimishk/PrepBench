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

export interface QuestionOption {
  id?: number;
  option_text: string;
  is_correct: boolean;
  explanation_why_incorrect?: string;
  order_index?: number;
}

export interface Question {
  id: number;
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
