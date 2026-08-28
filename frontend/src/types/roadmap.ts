// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

export type RoadmapTopicStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped';

export interface RoadmapTopic {
  id: number;
  roadmap_id: number;
  phase_id: number;
  order_index: number;
  title: string;
  learning_objective?: string | null;
  success_criteria?: string | null;
  estimated_hours?: number | null;
  status: RoadmapTopicStatus;
  progress_percentage: number;
  started_at?: string | null;
  completed_at?: string | null;
  evidence_notes?: string | null;
}

export interface RoadmapPhase {
  id: number;
  roadmap_id: number;
  name: string;
  order_index: number;
  topics: RoadmapTopic[];
}

export interface RoadmapResource {
  id: number;
  roadmap_id: number;
  title: string;
  order_index: number;
  columns: string[];
  rows: string[][];
}

export interface RoadmapProgress {
  total_topics: number;
  not_started_count: number;
  in_progress_count: number;
  completed_count: number;
  skipped_count: number;
  // Null -- never 0 -- when there is nothing to measure. Render an em-dash,
  // not "0%", or the UI claims progress it has no basis to report.
  completion_percentage: number | null;
  // Null unless every countable topic carries an estimate.
  hours_percentage: number | null;
  total_estimated_hours: number | null;
  completed_estimated_hours: number | null;
}

export interface RoadmapSummary {
  id: number;
  title: string;
  description?: string | null;
  source_filename?: string | null;
  start_date?: string | null;
  weekly_hours_budget?: number | null;
  is_archived: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  progress: RoadmapProgress;
}

export interface RoadmapDetail extends RoadmapSummary {
  phases: RoadmapPhase[];
  resources: RoadmapResource[];
}

export type ScheduleStatus = 'actual' | 'projected' | 'unschedulable' | 'skipped';

export interface RoadmapScheduleItem {
  topic_id: number;
  phase_id: number;
  phase_name: string;
  title: string;
  status: RoadmapTopicStatus;
  estimated_hours?: number | null;
  schedule_status: ScheduleStatus;
  start?: string | null;
  end?: string | null;
}

export interface RoadmapPhaseScheduleItem {
  phase_id: number;
  phase_name: string;
  start?: string | null;
  end?: string | null;
  schedule_status: ScheduleStatus;
}

export type ScheduleUnavailableReason =
  | 'no_topics'
  | 'no_start_date'
  | 'no_weekly_budget'
  | 'no_time_estimates';

export interface RoadmapSchedule {
  schedule_available: boolean;
  reason?: ScheduleUnavailableReason | null;
  start_date?: string | null;
  weekly_hours_budget?: number | null;
  projected_end_date?: string | null;
  unschedulable_topic_count: number;
  items: RoadmapScheduleItem[];
  phases: RoadmapPhaseScheduleItem[];
}

export interface RoadmapImportTopic {
  title: string;
  phase_name: string;
  learning_objective?: string | null;
  success_criteria?: string | null;
  estimated_hours?: number | null;
  status: RoadmapTopicStatus;
  progress_percentage: number;
  started_at?: string | null;
  completed_at?: string | null;
  evidence_notes?: string | null;
}

export interface RoadmapImportResource {
  title: string;
  columns: string[];
  rows: string[][];
}

export interface RoadmapImportPreview {
  title: string;
  description?: string | null;
  source_filename?: string | null;
  phases: string[];
  topics: RoadmapImportTopic[];
  resources: RoadmapImportResource[];
  warnings: string[];
  ignored_sheets: string[];
}

export interface RoadmapImportConfirm {
  title: string;
  description?: string | null;
  source_filename?: string | null;
  topics: RoadmapImportTopic[];
  resources: RoadmapImportResource[];
  start_date?: string | null;
  weekly_hours_budget?: number | null;
}

export interface RoadmapImportResult {
  roadmap_id: number;
  title: string;
  phase_count: number;
  topic_count: number;
  resource_count: number;
}

export interface RoadmapCreateRequest {
  title: string;
  description?: string | null;
  start_date?: string | null;
  weekly_hours_budget?: number | null;
}

export interface RoadmapUpdateRequest {
  title?: string;
  description?: string | null;
  start_date?: string | null;
  weekly_hours_budget?: number | null;
  is_archived?: boolean;
}

export interface RoadmapTopicUpdateRequest {
  title?: string;
  learning_objective?: string | null;
  success_criteria?: string | null;
  estimated_hours?: number | null;
  status?: RoadmapTopicStatus;
  progress_percentage?: number;
  evidence_notes?: string | null;
  phase_id?: number;
  order_index?: number;
}
