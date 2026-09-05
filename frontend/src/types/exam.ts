// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { Question } from './question';

export type ExamMode = 'practice' | 'timed' | 'custom' | 'weak_topic' | 'spaced_repetition';
export type ExamStatus = 'in_progress' | 'paused' | 'completed';
export type ConfidenceLevel = 'low' | 'medium' | 'high' | 'not_set';

export interface ExamAnswer {
  id: number;
  session_id: number;
  question_id: number;
  selected_option_ids: number[];
  is_correct?: boolean;
  time_spent_seconds: number;
  confidence_level: ConfidenceLevel;
  is_flagged: boolean;
  is_bookmarked: boolean;
  user_notes?: string;
  /** When this answer was looked at after the mock. Absent means it was not. */
  reviewed_at?: string | null;
}

/**
 * A mock measures whether you would pass; a drill closes gaps. Only a mock
 * moves readiness, which is why the distinction is carried explicitly rather
 * than inferred from the exam mode.
 */
export type SessionKind = 'mock' | 'drill';

export interface ExamSession {
  id: number;
  title: string;
  exam_mode: ExamMode;
  status: ExamStatus;
  certification?: string;
  session_kind: SessionKind;
  subject_id?: number;
  total_questions: number;
  answered_questions: number;
  correct_count: number;
  score_percentage?: number;
  passing_percentage: number;
  is_passed?: string;
  time_allowed_seconds?: number;
  time_spent_seconds: number;
  current_question_index: number;
  question_ids_order: number[];
  start_time: string;
  end_time?: string;
  answers: ExamAnswer[];
}

export interface ExamDetail extends ExamSession {
  questions: Question[];
}

export interface ExamCreateRequest {
  title?: string;
  exam_mode: ExamMode;
  certification?: string;
  topics?: string[];
  /** Exam-blueprint areas, e.g. "Managing Products with Agility". This is
   *  what "practise your weak area" actually restricts to -- the topic
   *  column holds hundreds of near-duplicate strings and cannot select a
   *  meaningful set. */
  domains?: string[];
  difficulties?: string[];
  total_questions: number;
  time_allowed_minutes?: number;
  passing_percentage: number;
  randomize_questions: boolean;
  /**
   * Which kind of evidence this session produces. Omitting it means "drill":
   * a caller that has not thought about it is not sitting an exam, and
   * readiness must only ever rise on evidence someone meant to produce.
   */
  session_kind?: SessionKind;
  /** Which subject this session belongs to, so readiness can find it. */
  subject_id?: number;
}

export interface SaveAnswerRequest {
  question_id: number;
  selected_option_ids: number[];
  time_spent_seconds: number;
  confidence_level: ConfidenceLevel;
  is_flagged: boolean;
  is_bookmarked: boolean;
  user_notes?: string;
}
