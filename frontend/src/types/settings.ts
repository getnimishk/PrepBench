// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

export interface AppSettings {
  theme: 'dark' | 'light';
  timer_sound_enabled: boolean;
  initial_seed_completed?: boolean;
  default_target_role: string | null;
}
