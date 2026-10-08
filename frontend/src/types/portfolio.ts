// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

/**
 * Workspace and Evidence, as GET /workspace and GET /evidence send them.
 *
 * Both are read models over rows the features already keep (learning attempts,
 * roadmap topics, interview questions, recordings, mocks). Nothing here is stored
 * by the browser. See docs/implementation/PHASE-6-CONTRACT.md.
 */

export type WorkspaceKind =
  | 'lab_run' | 'lakehouse_challenge' | 'scenario_notes' | 'interview_answer' | 'recording'
  | 'topic_guide' | 'topic_note' | 'system_design_answer' | 'design_review_call' | 'sandbox_run';

export type PortfolioSource = 'learning_lab' | 'scenarios' | 'interview' | 'roadmap' | 'certification';

export interface WorkspaceItem {
  id: string;
  kind: WorkspaceKind;
  source: Exclude<PortfolioSource, 'certification'>;
  title: string;
  context: string | null;
  excerpt: string | null;
  detail: string | null;
  href: string;
  updated_at: string | null;
  ref: Record<string, string>;
}

export interface WorkspaceResponse {
  /** The scope answered: a preparation, or null for work that belongs to none. */
  subject_id: number | null;
  items: WorkspaceItem[];
}

/** activity < completed < demonstrated < evidenced. */
export type EvidenceLevel = 'activity' | 'completed' | 'demonstrated' | 'evidenced';
export type AssessedBy = 'model' | 'answer_key' | 'exam' | 'self' | 'ai' | 'not_assessed';
export type EvidenceKind =
  | 'lab_stage' | 'lakehouse_challenge' | 'scenario_check' | 'scenario_lens' | 'sandbox_prediction'
  | 'learning_attempt' | 'topic_demonstration' | 'mock_exam' | 'recording' | 'system_design' | 'design_review';

export interface EvidenceItem {
  id: string;
  source: PortfolioSource;
  kind: EvidenceKind;
  level: EvidenceLevel;
  assessed_by: AssessedBy;
  title: string;
  demonstrates: string | null;
  /** Exactly what in the record supports the level. */
  basis: string;
  href: string;
  at: string | null;
  ref: Record<string, string>;
}

export interface EvidenceResponse {
  subject_id: number | null;
  counts: Record<EvidenceLevel, number>;
  items: EvidenceItem[];
}
