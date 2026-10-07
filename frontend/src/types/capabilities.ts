// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

export type CapabilityName =
  | 'certification'
  | 'interview'
  | 'learningLab'
  | 'lab'
  | 'workspace'
  | 'evidence'
  | 'roadmap'
  | 'studyGuide'
  | 'scenarios';

export type CapabilityStatus = 'AVAILABLE' | 'INTEGRATION_PENDING' | 'UNAVAILABLE';

/**
 * Authoritative capability availability profile for a PrepBench subject.
 * Reflects genuine current production content, distinguishing between target architecture
 * and current production availability.
 */
export interface SubjectCapabilityProfile {
  /** Certification exam & mock readiness capability */
  certification: boolean;
  /** Technical / incident / role interview capability */
  interview: boolean;
  /** Interactive simulation & behavioral learning lab capability (target architecture) */
  learningLab: boolean;
  /** Direct alias for learningLab */
  lab: boolean;
  /**
   * Current production availability status for Learning Lab:
   * - 'AVAILABLE': Fully implemented and active in current production (e.g. Databricks Lakehouse Lab)
   * - 'INTEGRATION_PENDING': Target capability in architecture, but production experiments scheduled for future integration phase (e.g. ADF Behaviour Labs scheduled for Phase 5)
   * - 'UNAVAILABLE': Not configured or supported for this subject
   */
  learningLabStatus: CapabilityStatus;
  /** Engineering scratchpad, notes, and artifact workspace */
  workspace: boolean;
  /** Demonstration, proof, and traceability evidence */
  evidence: boolean;
  /** Multi-phase structured mastery curriculum */
  roadmap: boolean;
  /** Topic and chapter study guides */
  studyGuide: boolean;
  /** Applied technical scenarios */
  scenarios: boolean;
  /**
   * Question availability status.
   * True if certification questions are loaded and available in the bank.
   * False if registered/configured with 0 loaded questions (e.g., Kafka CCDAK).
   */
  questionAvailability: boolean;
  /** Alias matching question bank readiness */
  hasQuestionBank: boolean;
  /** Exact loaded question count in the authoritative question bank */
  questionCount: number;
}

export interface SubjectSummary {
  id: number;
  name: string;
  slug: string;
  kind: 'certification' | 'skill';
  description?: string;
  certification?: string | null;
  pass_mark?: number | null;
  exam_question_count?: number | null;
  exam_minutes?: number | null;
  has_exam_profile: boolean;
  question_count: number;
  capabilities: SubjectCapabilityProfile;
}
