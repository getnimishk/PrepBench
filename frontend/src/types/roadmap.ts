// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

export type RoadmapTopicStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped';

export interface MappedGuideChapter {
  pack_id: string;
  pack_title: string;
  chapter_id: string;
  chapter_number: number;
  chapter_title: string;
  chapter_summary?: string | null;
  topic_number?: number | null;
  topic_title?: string | null;
  coverage?: string | null;
  relevant_sections?: string | null;
  learning_evidence?: string | null;
}

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
  mapped_chapters?: MappedGuideChapter[];
}

export interface RoadmapPhase {
  id: number;
  roadmap_id: number;
  name: string;
  order_index: number;
  topics: RoadmapTopic[];
}

/** What an extra sheet is for: reference material (also listed in the Study
 *  Library) or a plan sheet with hours/status/dates (Roadmaps only). */
export type RoadmapResourcePurpose = 'reference' | 'plan';

export interface RoadmapResource {
  id: number;
  roadmap_id: number;
  title: string;
  order_index: number;
  purpose: RoadmapResourcePurpose;
  columns: string[];
  rows: string[][];
}

/** One tab of the roadmap page: a sheet of the imported workbook. */
export type RoadmapSheetKind = 'syllabus' | 'tracker' | 'resource';

export interface RoadmapSheet {
  name: string;
  kind: RoadmapSheetKind;
  /** Set for kind 'resource': which RoadmapResource this sheet is. */
  resource_id?: number | null;
}

/** One reference sheet as the Study Library lists it. */
export interface ReferenceSheet {
  resource_id: number;
  name: string;
  roadmap_id: number;
  roadmap_title: string;
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
  linked_pack_id?: string | null;
  linked_pack_title?: string | null;
  /** The pinned version its chapters and scenarios come from. */
  linked_pack_version?: number | null;
}

export interface RoadmapDetail extends RoadmapSummary {
  phases: RoadmapPhase[];
  resources: RoadmapResource[];
  /** The tabs, in workbook order. Always filled in by the server. */
  sheets: RoadmapSheet[];
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
  purpose?: RoadmapResourcePurpose;
}

export interface RoadmapImportSheet {
  name: string;
  kind: RoadmapSheetKind;
}

export interface RoadmapImportPreview {
  title: string;
  description?: string | null;
  source_filename?: string | null;
  phases: string[];
  topics: RoadmapImportTopic[];
  resources: RoadmapImportResource[];
  /** Workbook order; empty for JSON/CSV/Markdown. */
  sheets: RoadmapImportSheet[];
  warnings: string[];
  ignored_sheets: string[];
}

export interface RoadmapImportConfirm {
  title: string;
  description?: string | null;
  source_filename?: string | null;
  topics: RoadmapImportTopic[];
  resources: RoadmapImportResource[];
  sheets?: RoadmapImportSheet[];
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
  /** Who originally wrote it: the learner, an AI draft, or course material. An AI
   *  draft or a course lesson keeps its source after you edit it -- `edited_at`
   *  records the edit -- so its origin is never hidden (Phase 7, D2). */
  source: 'ai' | 'learner' | 'course';
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
  mapped_chapters?: MappedGuideChapter[];
}

export interface TopicGuideSectionWrite {
  title: string;
  body: string;
  example?: string | null;
  common_mistake?: string | null;
  check_question?: string | null;
  check_answer?: string | null;
  /** Omitted: a new section is yours and an edit keeps its source. "course" marks
   *  course material -- the learner confirming that one section is a course lesson.
   *  Never "ai": only a provider's draft is an AI draft. */
  source?: 'learner' | 'course' | null;
}

/** "drafted" saved sections; "unavailable" and "failed" saved nothing. */
export interface TopicGuideDraftResult {
  status: 'drafted' | 'unavailable' | 'failed';
  message: string;
  guide: TopicGuide;
}

// ---- learner-triggered curriculum repairs (Phase 7, D1 / D2) ----

/** One topic a title repair would rename: matched by its phase and the number that is its title now. */
export interface TopicTitleRepairChange {
  topic_id: number;
  phase: string;
  number: string;
  old_title: string;
  new_title: string;
}

/** What a repair from the roadmap's workbook would change. Any problem blocks it. */
export interface TopicTitleRepairPreview {
  roadmap_id: number;
  source_filename: string;
  changes: TopicTitleRepairChange[];
  already_named: number;
  problems: string[];
  can_apply: boolean;
}

export interface TopicTitleRepairResult {
  roadmap_id: number;
  repaired: TopicTitleRepairChange[];
}

/** One section of a course lesson file, the six fields a guide section is made of. */
export interface CourseLessonSection {
  title: string;
  body: string;
  example?: string | null;
  common_mistake?: string | null;
  check_question?: string | null;
  check_answer?: string | null;
}

export interface CourseLesson {
  topic_title?: string | null;
  sections: CourseLessonSection[];
}

export interface CourseLessonMatch {
  section_id: number;
  topic_id: number;
  topic_title: string;
  section_title: string;
}

/** "Written by you" sections that are, word for word, a lesson supplied. Nothing changes until confirmed. */
export interface CourseLessonRelabelPreview {
  roadmap_id: number;
  matched: CourseLessonMatch[];
  unmatched_written_by_you: number;
  already_course: number;
  ai_drafts: number;
}

export interface CourseLessonRelabelResult {
  roadmap_id: number;
  relabelled: CourseLessonMatch[];
}
