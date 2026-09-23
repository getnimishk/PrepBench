// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { ScoreTrendPoint } from './analytics';

export interface PracticeRecording {
  id: number;
  title: string;
  mime_type: string;
  duration_seconds: number | null;
  file_size_bytes: number;
  interview_question_id: number | null;
  session_id?: number | null;
  plan_note?: string | null;
  created_at: string;
  /** List endpoint only. Percentages stay null unless the analysis succeeded. */
  analysis_status?: string | null;
  content_percent?: number | null;
  delivery_percent?: number | null;
}

export interface RecordingCommunicationScore {
  category: string;
  score: number;
  max_score: number;
  feedback: string;
}

export interface KeyPointMatch {
  point: string;
  status: 'covered' | 'partial' | 'missed';
  evidence: string;
}

export interface AnswerComparison {
  alignment_score: number;
  key_point_matches: KeyPointMatch[];
  gap_analysis?: string | null;
  unplanned_additions?: string | null;
  coaching_tips?: string | null;
}

export type AnalysisStatus = 'analyzed' | 'unavailable' | 'error';

export interface RecordingAnalysis {
  id: number;
  recording_id: number;
  provider: string | null;
  transcript: string | null;
  communication_scores: RecordingCommunicationScore[];
  filler_word_count: number | null;
  summary: string | null;
  content_scores: RecordingCommunicationScore[];
  content_summary: string | null;
  answer_comparison?: AnswerComparison | null;
  analysis_status: AnalysisStatus;
  analysis_error: string | null;
  created_at: string;
}

export interface ProviderInfo {
  name: string;
  is_available: boolean;
}

export interface RoundAnalyticsItem {
  round_type: string;
  round_label: string;
  attempt_count: number;
  avg_content_score_pct: number | null;
  avg_delivery_score_pct: number | null;
}

export interface WeakestContentCategory {
  category: string;
  round_label: string;
  avg_score_pct: number;
}

export interface RecordingAnalytics {
  total_recordings: number;
  analyzed_count: number;
  by_round: RoundAnalyticsItem[];
  delivery_trend: ScoreTrendPoint[];
  weakest_content_category: WeakestContentCategory | null;
}
