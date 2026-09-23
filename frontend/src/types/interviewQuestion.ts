// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

export type InterviewRoundType = 'hr_screening' | 'hiring_manager' | 'system_design' | 'behavioral';

export interface RoundTypeInfo {
  value: InterviewRoundType;
  label: string;
  /** How long a good answer to this round runs, in seconds. */
  target_min_seconds?: number;
  target_max_seconds?: number;
  /** Suggested thinking time before answering. */
  thinking_seconds?: number;
  /** A shape to plan the answer with. */
  plan_prompt?: string;
  /** What the interviewer is listening for. Guidance, not a grade. */
  listening_for?: string;
  /** The rubric an analysis grades content against. */
  content_categories?: string[];
}

export interface InterviewQuestion {
  id: number;
  round_type: InterviewRoundType;
  question_text: string;
  category: string | null;
  prepared_answer?: string | null;
  key_talking_points?: string[] | null;
  is_ai_generated: boolean;
  created_at: string;
  /** Takes recorded of this question. Filled by the list endpoint. */
  practice_count?: number;
}

export interface GenerateInterviewQuestionRequest {
  round_type: InterviewRoundType;
  topic?: string;
  save_to_bank?: boolean;
}

export interface InterviewQuestionUpdate {
  question_text?: string;
  category?: string;
  prepared_answer?: string | null;
  key_talking_points?: string[] | null;
}

export interface InterviewQuestionImportResult {
  imported_count: number;
  skipped_count: number;
  errors: string[];
}

export interface ImportInterviewQuestionsRequest {
  defaultRoundType: InterviewRoundType;
  defaultCategory?: string;
  file?: File;
  text?: string;
}
