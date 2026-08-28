// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

export type InterviewRoundType = 'hr_screening' | 'hiring_manager' | 'system_design' | 'behavioral';

export interface RoundTypeInfo {
  value: InterviewRoundType;
  label: string;
}

export interface InterviewQuestion {
  id: number;
  round_type: InterviewRoundType;
  question_text: string;
  category: string | null;
  is_ai_generated: boolean;
  created_at: string;
}

export interface GenerateInterviewQuestionRequest {
  round_type: InterviewRoundType;
  topic?: string;
  save_to_bank?: boolean;
}

export interface InterviewQuestionUpdate {
  question_text?: string;
  category?: string;
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
