// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { InterviewRoundType } from './interviewQuestion';

/** A question a session would ask, least-practised first. */
export interface PlannedQuestion {
  id: number;
  question_text: string;
  category?: string | null;
  practice_count: number;
  last_practised_at?: string | null;
}

/** One recorded answer in a session, with only what the analysis actually said. */
export interface SessionTake {
  recording_id: number;
  interview_question_id?: number | null;
  duration_seconds?: number | null;
  created_at: string;
  /** Null until analysed; then 'analyzed' | 'unavailable' | 'error'. */
  analysis_status?: string | null;
  /** 0-100, null unless analysed. Never 0 for "no provider". */
  content_percent?: number | null;
  delivery_percent?: number | null;
}

export interface SessionQuestion extends PlannedQuestion {
  takes: SessionTake[];
}

export interface InterviewSession {
  id: number;
  round_type: InterviewRoundType;
  round_label: string;
  category?: string | null;
  thinking_seconds: number;
  target_min_seconds: number;
  target_max_seconds: number;
  plan_prompt: string;
  listening_for: string;
  created_at: string;
  ended_at?: string | null;
  questions: SessionQuestion[];
}

export interface InterviewSessionCreate {
  round_type: InterviewRoundType;
  category?: string;
  question_count: number;
  thinking: boolean;
}

/** A session summarised from the latest take of each question. */
export interface InterviewSessionReport {
  session: InterviewSession;
  total_questions: number;
  answered: number;
  analysed: number;
  spoken_seconds: number;
  content_percent?: number | null;
  delivery_percent?: number | null;
  weakest_category?: string | null;
  weakest_category_percent?: number | null;
  not_graded_reason?: string | null;
}
