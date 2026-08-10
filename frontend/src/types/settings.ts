export interface AppSettings {
  theme: 'dark' | 'light';
  timer_sound_enabled: boolean;
  default_exam_mode: string;
  default_questions_count: number;
  default_passing_percentage: number;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  daily_practice_goal: number;
  initial_seed_completed?: boolean;
}
