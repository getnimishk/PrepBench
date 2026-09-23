// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

export type ThemePreference = 'light' | 'dark' | 'system';

export type NotificationTrigger =
  | 'review_due'
  | 'mock_below_pass'
  | 'evidence_stale'
  | 'roadmap_slipping'
  | 'import_unreviewed';

export interface AppSettings {
  /** `system` follows the operating system, and changes when it does. */
  theme: ThemePreference;
  timer_sound_enabled: boolean;
  initial_seed_completed?: boolean;
  default_target_role: string | null;
  /** The most due reviews a day's goal asks for. 1-200. It can make a day
   *  smaller but never adds work beyond what the schedule has due. */
  review_daily_cap: number;
  /** Visual only. `large` scales the whole interface's text. */
  text_size?: 'standard' | 'large';
  /** `system` follows the OS setting; `always` removes motion regardless. */
  reduce_motion?: 'system' | 'always';
  /** Keyboard shortcuts in the exam, spaced review and interview sessions. */
  shortcuts_enabled?: boolean;
  /** Every trigger, on or off. */
  notification_triggers?: Partial<Record<NotificationTrigger, boolean>>;
}
