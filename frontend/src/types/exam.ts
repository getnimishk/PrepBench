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
}

export interface ExamSession {
  id: number;
  title: string;
  exam_mode: ExamMode;
  status: ExamStatus;
  certification?: string;
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
  difficulties?: string[];
  total_questions: number;
  time_allowed_minutes?: number;
  passing_percentage: number;
  randomize_questions: boolean;
  randomize_options: boolean;
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
