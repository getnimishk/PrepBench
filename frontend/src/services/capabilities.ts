// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { CapabilityName, SubjectCapabilityProfile, SubjectSummary } from '../types/capabilities';
import type { Subject } from '../types/subject';
import { adfLabStatus, hasAdfPack } from './adfLab/experiments';

/**
 * The slug of the preparation the Lakehouse Lab writes to (skills plan D11): the page
 * finds its subject by this slug, so the capability does too. Kept equal to
 * `SKILL_SLUG` in services/lakehouse/attempts.ts (a test holds them together).
 */
export const LAKEHOUSE_SLUG = 'databricks';
/** The slug the backend treats as owning the System Design prompts and design reviews. */
export const SYSTEM_DESIGN_SLUG = 'system-design';

/**
 * Unassigned / missing subject capabilities fallback profile.
 * When subject context is null, unselected, or invalid, capabilities strictly
 * resolve to unassigned defaults (all capability flags false, safe scratchpad defaults).
 * NEVER default to ADF or PSM I when subject context is missing!
 */
export const UNASSIGNED_CAPABILITIES: SubjectCapabilityProfile = Object.freeze({
  certification: false,
  interview: false,
  learningLab: false,
  lab: false,
  lakehouseLab: false,
  systemDesignStudio: false,
  learningLabStatus: 'UNAVAILABLE',
  workspace: true,
  evidence: true,
  roadmap: false,
  studyGuide: false,
  scenarios: false,
  questionAvailability: false,
  hasQuestionBank: false,
  questionCount: 0,
});

/**
 * Authoritative capability truth table for the 6 core PrepBench subjects.
 * Derived strictly from authentic repository data (exam_simulator.db, scenarioAttempts, lakehouse, etc.):
 *
 * 1. PSM I (id: 1): CERTIFICATION with 709 questions, 85% pass mark, 80 questions/mock. Has Roadmap (id: 3, 13 phases, 63 topics, 188h). No interview or lab.
 * 2. Databricks (id: 2): SKILL with Lakehouse System Lab (AVAILABLE in current production). No certification, interview, or roadmap.
 * 3. System Design (id: 3): SKILL with 32 architecture prompts and 10 design reviews (neither table is subject-scoped;
 *    both are System Design content by nature). Verbal rounds use the shared interview library (36 questions, none
 *    subject-scoped). Has Roadmap (id: 4) -- see the data note on roadmaps 3/4 below. No cert or lab.
 * 4. Kafka CCDAK (id: 4): CERTIFICATION profile registered with 83% pass mark, but QUESTION BANK HAS 0 LOADED QUESTIONS.
 *    Has Kafka Mastery Roadmap (id: 1).
 * 5. Agentic AI (id: 5): SKILL with Agentic AI Mastery Roadmap (id: 5). No interview questions loaded in database yet.
 * 6. ADF (id: 6): SKILL (ADF IS A SKILL, NOT A CERTIFICATION!). Supported via 18 authored incident scenarios,
 *    60 Roadmap topics, and 21 Study Guide chapters.
 *    Interview is genuine and subject-scoped: the shipped pack (backend/app/content/packs/adf/v1.json) has a
 *    Say-it question for each of 4 roles in each of its 18 scenarios (72 in all), and ScenarioPage saves the
 *    learner's answer as an interview question under this preparation (PUT /interview-questions/by-source,
 *    unique on source_ref + subject_id). It is NOT the shared, subject-less interview library, and nothing
 *    here may present that library as ADF's own.
 *
 * Data note (not fixed here; a content/data task): PSM I's roadmap (id 3) and System Design's (id 4) are both
 * "Storage FileSystems to Cloud Mastery Roadmap" with identical phases and topics -- off-topic for PSM I.
 * `roadmap: true` reflects that a roadmap row is linked, not that its content suits the subject.
 *    Learning Lab: the ADF Behaviour Lab's five experiments (Phase 5). Its status comes from the lab's registry
 *    (services/adfLab/experiments.ts adfLabStatus): AVAILABLE only while all five are built.
 */
const SUBJECT_CAPABILITY_PROFILES: Record<number, SubjectCapabilityProfile> = {
  1: Object.freeze({
    certification: true,
    interview: false,
    learningLab: false,
    lab: false,
    lakehouseLab: false,
    systemDesignStudio: false,
    learningLabStatus: 'UNAVAILABLE',
    workspace: true,
    evidence: true,
    roadmap: true, // Linked to Roadmap 3: Storage FileSystems to Cloud Mastery Roadmap (13 phases, 63 topics, 188.0h)
    studyGuide: false,
    scenarios: false,
    questionAvailability: true,
    hasQuestionBank: true,
    questionCount: 709,
  }),
  2: Object.freeze({
    certification: false,
    interview: false,
    learningLab: true,
    lab: true,
    lakehouseLab: true,
    systemDesignStudio: false,
    learningLabStatus: 'AVAILABLE', // Lakehouse simulation sandbox is live in current production
    workspace: true,
    evidence: true,
    roadmap: false,
    studyGuide: false,
    scenarios: false,
    questionAvailability: false,
    hasQuestionBank: false,
    questionCount: 0,
  }),
  3: Object.freeze({
    certification: false,
    interview: true,
    learningLab: false,
    lab: false,
    lakehouseLab: false,
    systemDesignStudio: true,
    learningLabStatus: 'UNAVAILABLE',
    workspace: true,
    evidence: true,
    roadmap: true, // Linked to Roadmap 4: Storage FileSystems to Cloud Mastery Roadmap (13 phases, 63 topics, 188.0h)
    studyGuide: false,
    scenarios: false,
    questionAvailability: false,
    hasQuestionBank: false,
    questionCount: 0,
  }),
  4: Object.freeze({
    certification: true,
    interview: false,
    learningLab: false,
    lab: false,
    lakehouseLab: false,
    systemDesignStudio: false,
    learningLabStatus: 'UNAVAILABLE',
    workspace: true,
    evidence: true,
    roadmap: true,
    studyGuide: false,
    scenarios: false,
    questionAvailability: false, // Honest data truth: 0 loaded questions in current database
    hasQuestionBank: false,
    questionCount: 0,
  }),
  5: Object.freeze({
    certification: false,
    interview: false,
    learningLab: false,
    lab: false,
    lakehouseLab: false,
    systemDesignStudio: false,
    learningLabStatus: 'UNAVAILABLE',
    workspace: true,
    evidence: true,
    roadmap: true,
    studyGuide: false,
    scenarios: false,
    questionAvailability: false,
    hasQuestionBank: false,
    questionCount: 0,
  }),
  6: Object.freeze({
    certification: false, // P0 Invariant: ADF IS A SKILL, NEVER A CERTIFICATION!
    interview: true, // Scenario Say-it questions saved under this subject (see the note above)
    learningLab: true, // The ADF Behaviour Lab (services/adfLab), five experiments
    lab: true,
    lakehouseLab: false,
    systemDesignStudio: false,
    // From the lab's own registry: AVAILABLE only while all five experiments are built
    // (adfLabStatus), INTEGRATION_PENDING the moment any one is not.
    learningLabStatus: adfLabStatus(),
    workspace: true,
    evidence: true,
    roadmap: true,
    studyGuide: true,
    scenarios: true,
    questionAvailability: false,
    hasQuestionBank: false,
    questionCount: 0,
  }),
};

/**
 * Registry of authoritative production subjects with capabilities.
 */
export const KNOWN_PRODUCTION_SUBJECTS: SubjectSummary[] = [
  {
    id: 1,
    name: 'Scrum / PSM I',
    slug: 'psm-i',
    kind: 'certification',
    certification: 'PSM I - Professional Scrum Master',
    pass_mark: 85,
    exam_question_count: 80,
    exam_minutes: 60,
    has_exam_profile: true,
    question_count: 709,
    description: 'Scrum.org Professional Scrum Master I certification track. Grounded in empiricism, values, and accountabilities.',
    capabilities: SUBJECT_CAPABILITY_PROFILES[1],
  },
  {
    id: 2,
    name: 'Databricks Data Platform',
    slug: 'databricks',
    kind: 'skill',
    certification: null,
    pass_mark: null,
    exam_question_count: null,
    exam_minutes: null,
    has_exam_profile: false,
    question_count: 0,
    description: 'Databricks Lakehouse architecture, Delta Lake engine, and Spark optimization.',
    capabilities: SUBJECT_CAPABILITY_PROFILES[2],
  },
  {
    id: 3,
    name: 'System Design',
    slug: 'system-design',
    kind: 'skill',
    certification: null,
    pass_mark: null,
    exam_question_count: null,
    exam_minutes: null,
    has_exam_profile: false,
    question_count: 0,
    description: 'System design for distributed, high-throughput, and event-driven data systems.',
    capabilities: SUBJECT_CAPABILITY_PROFILES[3],
  },
  {
    id: 4,
    name: 'Confluent Certified Developer for Apache Kafka',
    slug: 'confluent-certified-developer-for-apache-kafka',
    kind: 'certification',
    certification: 'CCDAK',
    pass_mark: 83,
    exam_question_count: 55,
    exam_minutes: 90,
    has_exam_profile: true,
    question_count: 0,
    description: 'Validates skills in Apache Kafka core APIs and distributed streaming applications.',
    capabilities: SUBJECT_CAPABILITY_PROFILES[4],
  },
  {
    id: 5,
    name: 'Agentic AI',
    slug: 'agentic-ai',
    kind: 'skill',
    certification: null,
    pass_mark: null,
    exam_question_count: null,
    exam_minutes: null,
    has_exam_profile: false,
    question_count: 0,
    description: 'Engineering agentic workflows, multi-agent orchestration, and tool routing.',
    capabilities: SUBJECT_CAPABILITY_PROFILES[5],
  },
  {
    id: 6,
    name: 'Azure Data Factory',
    slug: 'adf',
    kind: 'skill',
    certification: null,
    pass_mark: null,
    exam_question_count: null,
    exam_minutes: null,
    has_exam_profile: false,
    question_count: 0,
    description: 'Enterprise data integration, cloud ETL orchestration, pipeline concurrency tuning, and hybrid connectivity.',
    capabilities: SUBJECT_CAPABILITY_PROFILES[6],
  },
];

/**
 * Resolves a subject identifier (ID, slug, Subject object, or null/undefined)
 * to its numeric ID if recognized.
 */
function resolveSubjectId(
  subjectOrId: Subject | { id?: number; slug?: string; name?: string } | number | string | null | undefined
): number | null {
  if (subjectOrId === null || subjectOrId === undefined) {
    return null;
  }

  if (typeof subjectOrId === 'number') {
    return Number.isFinite(subjectOrId) && subjectOrId > 0 ? subjectOrId : null;
  }

  if (typeof subjectOrId === 'string') {
    const trimmed = subjectOrId.trim().toLowerCase();
    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isNaN(parsed) && String(parsed) === trimmed) {
      return parsed > 0 ? parsed : null;
    }
    // Match by slug or alias
    if (trimmed === 'psm-i' || trimmed === 'psm' || trimmed === 'scrum-psm-i' || trimmed === 'scrum') {
      return 1;
    }
    if (trimmed === 'databricks' || trimmed === 'databricks-platform' || trimmed === 'lakehouse') {
      return 2;
    }
    if (trimmed === 'system-design' || trimmed === 'sys-design' || trimmed === 'systemdesign') {
      return 3;
    }
    if (
      trimmed === 'confluent-certified-developer-for-apache-kafka' ||
      trimmed === 'kafka' ||
      trimmed === 'ccdak'
    ) {
      return 4;
    }
    if (trimmed === 'agentic-ai' || trimmed === 'agentic' || trimmed === 'agenticai') {
      return 5;
    }
    if (trimmed === 'adf' || trimmed === 'azure-data-factory' || trimmed === 'azuredatafactory') {
      return 6;
    }
    return null;
  }

  if (typeof subjectOrId === 'object') {
    if (typeof subjectOrId.id === 'number') {
      return subjectOrId.id;
    }
    if (subjectOrId.slug) {
      return resolveSubjectId(subjectOrId.slug);
    }
    if (subjectOrId.name) {
      const match = KNOWN_PRODUCTION_SUBJECTS.find(
        (s) => s.name.toLowerCase() === subjectOrId.name!.toLowerCase()
      );
      if (match) return match.id;
    }
  }

  return null;
}

/** A preparation as the server sent it, rather than a bare id or slug. */
type LiveSubject = Pick<Subject, 'id' | 'slug' | 'kind' | 'question_count'>
  & Pick<Subject, 'content_packs' | 'roadmap_count'>;

/**
 * What a preparation's curriculum really is, from its own record (Phase 7):
 *  - roadmap: an unarchived roadmap is linked to it (`roadmap_count`);
 *  - studyGuide: an attached pack has chapters;
 *  - scenarios: an attached pack has written scenarios -- so a guide-only pack such as
 *    ADLS gives a study guide and never claims scenarios.
 * A fact the record does not state (an older payload, a test fixture) is left to the
 * caller's default rather than guessed.
 */
function liveCurriculum(s: LiveSubject): Partial<Pick<SubjectCapabilityProfile, 'roadmap' | 'studyGuide' | 'scenarios'>> {
  const out: Partial<Pick<SubjectCapabilityProfile, 'roadmap' | 'studyGuide' | 'scenarios'>> = {};
  if (typeof s.roadmap_count === 'number') out.roadmap = s.roadmap_count > 0;
  const packs = s.content_packs;
  if (packs && packs.every((p) => typeof p.chapter_count === 'number')) {
    out.studyGuide = packs.some((p) => (p.chapter_count ?? 0) > 0);
    out.scenarios = packs.some((p) => (p.written_scenario_count ?? 0) > 0);
  }
  return out;
}

function isLiveSubject(value: unknown): value is LiveSubject {
  return typeof value === 'object' && value !== null
    && typeof (value as LiveSubject).id === 'number'
    && typeof (value as LiveSubject).kind === 'string'
    && typeof (value as LiveSubject).question_count === 'number';
}

/**
 * What a preparation the table above does not describe can do, read from the
 * preparation itself.
 *
 * Every preparation a learner creates or imports gets a new id, and the table is
 * keyed by the six seeded ones. Returning UNASSIGNED for the rest turned off
 * Practice, Exam and the Question Bank for a certification the learner had just
 * created and filled -- a capability shown as unavailable when it is not.
 *
 * Only what the record states is claimed: a certification is one by its kind;
 * questions by its own count; guides and scenarios by its attached packs.
 * Interview needs content of its own, and the one source a record can show is the
 * ADF pack: each of its scenarios ends with a Say-it question per role, which
 * ScenarioPage saves under whichever preparation holds the pack -- so a recreated
 * ADF keeps its rounds whatever its new slug is. Otherwise it stays off. The
 * Learning Lab is on when the ADF pack is attached: the ADF Behaviour Lab's
 * experiments are that pack's. Roadmaps are not withheld: the Roadmaps screen is
 * where any preparation's first roadmap is created or imported.
 */
function deriveCapabilities(s: LiveSubject): SubjectCapabilityProfile {
  const questions = s.question_count;
  const packs = s.content_packs?.length ?? 0;
  // The ADF Behaviour Lab is for any preparation with the ADF pack attached, not only the seeded
  // one: its experiments are the pack's, and the lab pages check for the pack themselves.
  const adfLab = hasAdfPack(s);
  return Object.freeze({
    certification: s.kind.toLowerCase() === 'certification',
    interview: adfLab,
    learningLab: adfLab,
    lab: adfLab,
    lakehouseLab: s.slug === LAKEHOUSE_SLUG,
    systemDesignStudio: s.slug === SYSTEM_DESIGN_SLUG,
    learningLabStatus: adfLab ? adfLabStatus() : 'UNAVAILABLE',
    workspace: true,
    evidence: true,
    roadmap: true,
    studyGuide: packs > 0,
    scenarios: packs > 0,
    ...liveCurriculum(s),
    questionAvailability: questions > 0,
    hasQuestionBank: questions > 0,
    questionCount: questions,
  });
}

/**
 * Returns the authoritative SubjectCapabilityProfile for a subject or subject ID.
 * Returns UNASSIGNED_CAPABILITIES if subjectOrId is null, undefined, or unrecognized.
 * NEVER defaults to ADF or PSM I when subject context is missing.
 *
 * Given the preparation itself (not just its id), two things come from the
 * record rather than the table:
 *  - the question count, so a bank imported later (Kafka's, say) is seen the
 *    moment it is there, and a static 0 can never keep a filled bank locked;
 *  - whether the table applies at all: a record that carries a slug is matched to
 *    it by that slug alone, exactly. The slug is a preparation's identity (it never
 *    changes); its id is not -- a preparation deleted and created again gets a new
 *    one, and SQLite can hand an old id to a different preparation. So a recreated
 *    System Design keeps its profile at any id, and a learner's preparation holding
 *    id 3 or 6 is read from its own record, never mistaken for System Design or ADF.
 */
export function getSubjectCapabilities(
  subjectOrId?: Subject | { id?: number; slug?: string; name?: string } | number | string | null
): SubjectCapabilityProfile {
  const live = isLiveSubject(subjectOrId) ? subjectOrId : null;
  const slug = typeof subjectOrId === 'object' && subjectOrId !== null ? subjectOrId.slug : undefined;

  let profile: SubjectCapabilityProfile | undefined;
  if (slug) {
    profile = KNOWN_PRODUCTION_SUBJECTS.find((s) => s.slug === slug)?.capabilities;
    if (!profile) return live ? deriveCapabilities(live) : UNASSIGNED_CAPABILITIES;
  } else {
    // A bare id or slug string, or a record without a slug (an older payload, a test fixture).
    const id = resolveSubjectId(subjectOrId);
    if (id === null) return UNASSIGNED_CAPABILITIES;
    profile = SUBJECT_CAPABILITY_PROFILES[id];
  }

  if (profile) {
    if (!live) return profile;
    // The table says what each seeded preparation can do; its curriculum and its
    // question count are read from the record, so a roadmap unlinked or a pack
    // attached shows at once (Phase 7, D3/D5), as an imported bank does.
    const curriculum = liveCurriculum(live);
    const sameCurriculum = Object.entries(curriculum)
      .every(([k, v]) => profile[k as keyof SubjectCapabilityProfile] === v);
    if (live.question_count === profile.questionCount && sameCurriculum) return profile;
    return Object.freeze({
      ...profile,
      ...curriculum,
      questionCount: live.question_count,
      questionAvailability: live.question_count > 0,
      hasQuestionBank: live.question_count > 0,
    });
  }

  if (live) return deriveCapabilities(live);

  // A bare id the table does not know: nothing can be claimed about it.
  return UNASSIGNED_CAPABILITIES;
}

/**
 * Checks whether a capability is in the target architecture for a subject,
 * regardless of whether production integration is pending or live.
 */
export function isTargetCapability(
  subjectOrId: Subject | { id?: number; slug?: string; name?: string } | number | string | null | undefined,
  capability: CapabilityName
): boolean {
  if (!capability) return false;
  const profile = getSubjectCapabilities(subjectOrId);
  return Boolean(profile[capability]);
}

/**
 * Checks whether a specific capability is available in genuine current production.
 * For learningLab/lab, evaluates whether learningLabStatus is 'AVAILABLE'.
 */
export function isCapabilityAvailable(
  subjectOrId: Subject | { id?: number; slug?: string; name?: string } | number | string | null | undefined,
  capability: CapabilityName
): boolean {
  if (!capability) return false;
  const profile = getSubjectCapabilities(subjectOrId);
  if (capability === 'learningLab' || capability === 'lab') {
    return profile.learningLabStatus === 'AVAILABLE';
  }
  return Boolean(profile[capability]);
}

/**
 * Filters a list of subjects by capability, or returns all known production subjects with that capability.
 */
export function getSubjectsWithCapability<T extends { id: number }>(
  subjects: T[],
  capability: CapabilityName
): T[];
export function getSubjectsWithCapability(
  capability: CapabilityName
): SubjectSummary[];
export function getSubjectsWithCapability<T extends { id: number }>(
  subjectsOrCapability: T[] | CapabilityName,
  capabilityOptional?: CapabilityName
): T[] | SubjectSummary[] {
  if (Array.isArray(subjectsOrCapability)) {
    const capability = capabilityOptional!;
    return subjectsOrCapability.filter((s) => isCapabilityAvailable(s, capability));
  }
  const capability = subjectsOrCapability;
  return KNOWN_PRODUCTION_SUBJECTS.filter((s) => isCapabilityAvailable(s.id, capability));
}
