// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

/**
 * Built-in content packs: guides and scenarios for a Skill preparation.
 *
 * A pack is a versioned, read-only file the server ships
 * (`backend/app/content/packs/<pack_id>/v<version>.json`); a subject's own
 * link to one (pinned version, offered upgrades) is `SubjectContentPack` in
 * `types/subject.ts`, kept there next to the rest of the subject shape.
 */

/** One row of `GET /content-packs`: enough to offer a pack, not read it. */
export interface ContentPackSummary {
  pack_id: string;
  latest_version: number;
  title: string;
  summary: string;
  chapter_count: number;
  scenario_count: number;
  written_scenario_count: number;
}

export interface GuideTable {
  head: string[];
  rows: string[][];
}

export interface GuideBlock {
  heading?: string | null;
  /** Rendered with components/common/Explanation.tsx: paragraphs, **bold**,
   *  `code`, - bullets, 1. numbers. Never dangerouslySetInnerHTML. */
  md?: string | null;
  table?: GuideTable | null;
}

export interface PracticeLink {
  scenario_id: string;
  label: string;
}

export interface Chapter {
  id: string;
  title: string;
  summary: string;
  sources: string;
  blocks: GuideBlock[];
  practice_links: PracticeLink[];
}

/** The prototype's `UnitContent` (services/adf/units.ts): a scenario's check
 *  questions, case study, per-role lenses and Say-it prompt. Opaque here --
 *  the shape a scenario page (Phase 3) will read, not the pack API's own
 *  concern. */
export type ScenarioContent = Record<string, unknown>;

export interface Scenario {
  id: string;
  number: number;
  title: string;
  outcome: string;
  sources: string;
  chapter: string;
  /** Absent for a *planned* scenario: listed, but can't be opened. */
  content?: ScenarioContent | null;
}

export interface ScenarioLevel {
  name: string;
  about: string;
  scenarios: Scenario[];
}

export interface DiagnosticQuestion {
  id: string;
  topic: string;
  question: string;
  points: string[];
  keywords: string[];
  chapter: string;
}

/** The full pack, `GET /content-packs/{pack_id}`. */
export interface ContentPackDetail {
  pack_id: string;
  version: number;
  title: string;
  summary: string;
  docs_url: string;
  source_notes: string;
  chapters: Chapter[];
  scenario_levels: ScenarioLevel[];
  diagnostic_questions: DiagnosticQuestion[];
}
