// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

/** The clock PrepBench keeps days by: this computer's. */
export interface ProfileTimezone {
  name: string;
  utc_offset_minutes: number;
}

export interface ProfileStats {
  preparations: number;
  questions: number;
  mocks_taken: number;
  days_active: number;
  active_since: string | null;
  interview_answers?: number;
  study_hours?: number | null;
}

export interface Profile {
  display_name: string | null;
  email: string | null;
  timezone: ProfileTimezone;
  stats: ProfileStats;
  storage: { database_bytes: number | null; recordings_bytes: number };
}

/** Blank clears a field; an omitted one is left as it is. */
export interface ProfileUpdate {
  display_name?: string;
  email?: string;
}
