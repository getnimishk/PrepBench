import { QuestionDifficulty } from './question';
import { ScoreTrendPoint } from './analytics';

export interface CategoryScore {
  category: string;
  score: number;
  max_score: number;
  feedback: string;
}

export interface SystemDesignPrompt {
  id: number;
  title: string;
  prompt_text: string;
  category: string;
  difficulty: QuestionDifficulty;
  is_ai_generated: boolean;
  created_at: string;
}

export interface GeneratePromptRequest {
  topic?: string;
  difficulty?: QuestionDifficulty;
  save_to_bank?: boolean;
}

export interface SubmitAttemptRequest {
  prompt_id: number;
  answer_text: string;
  target_role?: string;
  time_spent_seconds?: number;
}

export type GradingStatus = 'graded' | 'unavailable' | 'error';

export interface SystemDesignAttempt {
  id: number;
  prompt_id: number;
  answer_text: string;
  target_role?: string;
  overall_score: number | null;
  category_scores: CategoryScore[];
  strengths: string[];
  improvements: string[];
  summary: string | null;
  grading_status: GradingStatus;
  grading_error: string | null;
  time_spent_seconds: number;
  created_at: string;
  prompt?: SystemDesignPrompt;
}

export interface RecentAttemptItem {
  id: number;
  prompt_title: string;
  overall_score: number | null;
  created_at: string;
}

export interface SystemDesignAnalytics {
  total_attempts: number;
  graded_count: number;
  average_score: number | null;
  score_trend: ScoreTrendPoint[];
  category_averages: CategoryScore[];
  recent_attempts: RecentAttemptItem[];
}
