// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

export interface QuestionHit {
  id: number;
  text: string;
  domain: string;
  topic: string;
  difficulty: string;
}

export interface GuideSectionHit {
  section_id: number;
  title: string;
  excerpt: string | null;
  /** Who wrote the section: a model's draft is labelled as one. */
  written_by: string;
  read: boolean;
  topic_id: number;
  topic_title: string;
  roadmap_id: number;
  roadmap_title: string;
}

export interface RoadmapHit {
  id: number;
  title: string;
  phase_count: number;
  topic_count: number;
  /** False for a roadmap linked to no preparation. */
  linked: boolean;
}

export interface TopicHit {
  id: number;
  title: string;
  status: string;
  phase_name: string;
  roadmap_id: number;
  roadmap_title: string;
}

export interface RecordingHit {
  id: number;
  title: string;
  question_text: string | null;
  created_at: string | null;
  duration_seconds: number | null;
  analysis_status: string | null;
}

export interface Results<T> {
  /** Every match. */
  total: number;
  /** At most the requested limit of them. */
  items: T[];
}

export interface SearchResponse {
  query: string;
  subject_id: number | null;
  subject_name: string | null;
  questions: Results<QuestionHit>;
  guides: Results<GuideSectionHit>;
  roadmaps: Results<RoadmapHit>;
  topics: Results<TopicHit>;
  /** From every preparation: a recording belongs to none. */
  recordings: Results<RecordingHit>;
}
