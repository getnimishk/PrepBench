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

/** A topic group inside one area, with the answers behind its figure. */
export interface DomainTopicItem {
  topic: string;
  answers: number;
  correct: number;
  accuracy_percentage: number;
}

export interface DomainQuestionItem {
  id: number;
  text: string;
  topic: string;
  /** unseen: never answered. missed: answered wrong at least once. correct: never wrong. */
  state: 'unseen' | 'missed' | 'correct';
  times_answered: number;
  times_correct: number;
  due: boolean;
}

/** One area of one preparation, from every answer given in it (drills included). */
export interface DomainDetail {
  subject_id: number;
  domain: string;
  answers: number;
  correct: number;
  /** Null, never 0, when nothing in the area has been answered. */
  accuracy_percentage: number | null;
  question_count: number;
  attempted_questions: number;
  missed_questions: number;
  due_now: number;
  /** Wrong answers from mocks here that are still in the review queue. */
  unreviewed_misses: number;
  min_answers_per_topic: number;
  topics: DomainTopicItem[];
  /** Missed first, then due, then unseen, then correct. At most `questions_limit`. */
  questions: DomainQuestionItem[];
  questions_limit: number;
}
