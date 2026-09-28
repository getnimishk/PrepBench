// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

/**
 * A job the learner is preparing for (`backend/app/schemas/role.py`).
 *
 * No readiness field, by design: a role has no mocks, so its readiness is
 * "Needs evaluation", said on the page with the reason.
 */

import type { ScenarioRole } from './contentPack';

export type RequirementKind = 'mandatory' | 'preferred';
export type DiagnosticConfidence = 'not-yet' | 'partly' | 'confident';

export interface RoleRequirementIn {
  text: string;
  kind: RequirementKind;
  /** A Skill the learner confirmed as evidence; never a parser guess. */
  subject_id?: number | null;
}

export interface RoleRequirement extends RoleRequirementIn {
  id: number;
  order_index: number;
  subject_id: number | null;
  subject_name: string | null;
}

export interface RoleSummary {
  id: number;
  name: string;
  interview_date: string | null;
  lens: ScenarioRole;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  requirement_count: number;
  linked_count: number;
  diagnostic_count: number;
}

export interface Role {
  id: number;
  name: string;
  interview_date: string | null;
  job_description: string;
  lens: ScenarioRole;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  requirements: RoleRequirement[];
  diagnostic_count: number;
}

export interface RoleCreate {
  name: string;
  interview_date?: string | null;
  job_description: string;
  lens: ScenarioRole;
  requirements: RoleRequirementIn[];
}

export interface RoleDiagnosticItem {
  question_ref: string;
  answer: string;
  covered: number[];
  confidence: DiagnosticConfidence;
  fits_requirement: boolean;
}

export interface RoleDiagnostic {
  id: number;
  role_id: number;
  taken_at: string;
  lens: ScenarioRole;
  items: RoleDiagnosticItem[];
}
