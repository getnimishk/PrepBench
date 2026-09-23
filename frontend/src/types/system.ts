// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

export interface DatabaseFile {
  engine: string;
  path: string | null;
  size_bytes: number | null;
  wal_bytes: number | null;
  modified_at: string | null;
  backup_supported: boolean;
}

export interface PreparationStorage {
  subject_id: number;
  name: string;
  is_archived: boolean;
  questions: number;
  sessions: number;
  answers: number;
}

export interface StorageReport {
  database: DatabaseFile;
  counts: Record<string, number>;
  unassigned_questions: number;
  recordings: { path: string; files: number; size_bytes: number };
  preparations: PreparationStorage[];
}

export interface AboutReport {
  version: string;
  python_version: string;
  platform: string;
  database_engine: string;
  database_path: string | null;
  recordings_path: string;
  telemetry: boolean;
  providers: { name: string; is_local: boolean; is_enabled: boolean; tasks: string[] }[];
  data_leaving: { task: string; provider: string }[];
  key_storage: string[];
  license: string;
}

export interface ReviewScheduleRules {
  algorithm: string;
  starting_ease: number;
  minimum_ease: number;
  first_interval_days: number;
  second_interval_days: number;
  passing_quality: number;
  grades: Record<string, number>;
}

export interface AppNotification {
  id: string;
  trigger: string;
  severity: 'warning' | 'attention';
  title: string;
  detail: string;
  subject_id: number | null;
  subject_name: string | null;
  count: number | null;
  action_label: string;
  action_path: string;
}
