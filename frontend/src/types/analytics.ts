// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

export interface TopicMasteryItem {
  topic: string;
  domain: string;
  total_attempted: number;
  correct_count: number;
  accuracy_percentage: number;
}

export interface DomainMasteryItem {
  domain: string;
  total_attempted: number;
  correct_count: number;
  accuracy_percentage: number;
}

export interface ScoreTrendPoint {
  date: string;
  score: number;
  rolling_avg: number;
  exam_title: string;
}

export interface RecentExamItem {
  id: number;
  title: string;
  score_percentage: number;
  is_passed: string;
  date: string;
  duration_minutes: number;
}

export interface DashboardOverview {
  total_exams: number;
  total_questions_attempted: number;
  overall_accuracy_percentage: number;
  average_time_per_question_seconds: number;
  weak_topics: TopicMasteryItem[];
  strong_topics: TopicMasteryItem[];
  study_streak_days: number;
  daily_goal: number;
  today_practiced_count: number;
  spaced_repetition_due_count: number;
  recent_exams: RecentExamItem[];
}
