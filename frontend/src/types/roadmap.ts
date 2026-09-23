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
  /** The preparation this roadmap serves. Null means not linked to one yet --
   *  roadmaps imported before preparations existed are all in that state, by
   *  design, rather than matched to a preparation by guessing at the title. */
  subject_id?: number | null;
  start_date?: string | null;
  weekly_hours_budget?: number | null;
  is_archived: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  /** Phases in the plan, empty ones included. */
  phase_count?: number;
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
  /** Estimated hours not yet done, less progress already made. Null when no
   *  topic has an estimate. Reported even when no schedule can be projected. */
  remaining_estimated_hours?: number | null;
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
  subject_id?: number | null;
}

/** One phase as the plan editor leaves it; its position in the list is its order. */
export interface RoadmapPlanPhase {
  /** Null for a phase added in the editor. */
  id: number | null;
  name: string;
}

export interface RoadmapPlanRemoval {
  id: number;
  /** A position in `phases` for the removed phase's topics. Required when it holds any. */
  move_topics_to?: number | null;
}

/** The plan editor's save: all of it, or none of it. */
export interface RoadmapPlanRequest {
  title: string;
  start_date: string | null;
  weekly_hours_budget: number | null;
  phases: RoadmapPlanPhase[];
  removed_phases: RoadmapPlanRemoval[];
}

export interface RoadmapUpdateRequest {
  title?: string;
  description?: string | null;
  start_date?: string | null;
  weekly_hours_budget?: number | null;
  is_archived?: boolean;
  /** Link to a preparation, or send null to unlink. */
  subject_id?: number | null;
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

/** How the learner graded themselves against the success criterion. */
export type DemonstrationGrade = 'not_yet' | 'partial' | 'yes';

/** One attempt to meet a topic's success criterion unprompted. Append-only:
 *  the newest carries the current recheck schedule. */
export interface TopicDemonstration {
  id: number;
  topic_id: number;
  response_text: string;
  self_grade: DemonstrationGrade;
  repetition: number;
  interval_days: number;
  ease_factor: number;
  next_recheck_at: string;
  created_at: string;
}

export interface TopicDemonstrationResult {
  demonstration: TopicDemonstration;
  topic: RoadmapTopic;
}

/** One section of a topic's study guide. */
export interface TopicGuideSection {
  id: number;
  topic_id: number;
  order_index: number;
  title: string;
  body: string;
  example?: string | null;
  common_mistake?: string | null;
  check_question?: string | null;
  check_answer?: string | null;
  /** Who originally wrote it. An AI draft stays "ai" after you edit it --
   *  `edited_at` records the edit -- so its origin is never hidden. */
  source: 'ai' | 'learner';
  generated_by?: string | null;
  edited_at?: string | null;
  /** Reading is recorded, but it is not evidence: a topic is completed only by
   *  demonstrating it. */
  read_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TopicGuide {
  sections: TopicGuideSection[];
  read_count: number;
  drafting_available: boolean;
  drafting_unavailable_reason?: string | null;
}

export interface TopicGuideSectionWrite {
  title: string;
  body: string;
  example?: string | null;
  common_mistake?: string | null;
  check_question?: string | null;
  check_answer?: string | null;
}

/** "drafted" saved sections; "unavailable" and "failed" saved nothing. */
export interface TopicGuideDraftResult {
  status: 'drafted' | 'unavailable' | 'failed';
  message: string;
  guide: TopicGuide;
}
