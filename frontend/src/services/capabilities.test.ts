// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, expect, it } from 'vitest';
import type { ContentPackDetail } from '../types/contentPack';
import adfPack from '../../../backend/app/content/packs/adf/v1.json';
import {
  getSubjectCapabilities,
  getSubjectsWithCapability,
  isCapabilityAvailable,
  isTargetCapability,
  KNOWN_PRODUCTION_SUBJECTS,
  LAKEHOUSE_SLUG,
  UNASSIGNED_CAPABILITIES,
} from './capabilities';
import { SKILL_SLUG } from './lakehouse/attempts';
import type { Subject } from '../types/subject';

describe('Subject Capabilities Foundation (Phase 1)', () => {
  describe('Capability Truth for Core 6 Subjects', () => {
    it('ADF (id: 6): certification = false (ADF IS A SKILL, NOT A CERTIFICATION)', () => {
      const caps = getSubjectCapabilities(6);
      expect(caps.certification).toBe(false);
      expect(caps.interview).toBe(true);
      expect(caps.learningLab).toBe(true);
      expect(caps.lab).toBe(true);
      // All five Behaviour Lab experiments are built, so the registry makes it AVAILABLE.
      expect(caps.learningLabStatus).toBe('AVAILABLE');
      expect(caps.workspace).toBe(true);
      expect(caps.evidence).toBe(true);
      expect(caps.roadmap).toBe(true);
      expect(caps.studyGuide).toBe(true);
      expect(caps.scenarios).toBe(true);
      expect(caps.questionAvailability).toBe(false);
      expect(caps.hasQuestionBank).toBe(false);
      expect(caps.questionCount).toBe(0);
    });

    it('Kafka CCDAK (id: 4): certification = true with question availability = false (0 questions in bank)', () => {
      const caps = getSubjectCapabilities(4);
      expect(caps.certification).toBe(true);
      expect(caps.questionAvailability).toBe(false);
      expect(caps.hasQuestionBank).toBe(false);
      expect(caps.questionCount).toBe(0);
      expect(caps.interview).toBe(false);
      expect(caps.learningLab).toBe(false);
      expect(caps.lab).toBe(false);
      expect(caps.workspace).toBe(true);
      expect(caps.evidence).toBe(true);
      expect(caps.roadmap).toBe(true);
      expect(caps.studyGuide).toBe(false);
      expect(caps.scenarios).toBe(false);
    });

    it('PSM I (id: 1): certification = true, interview = false, learningLab = false, roadmap = true', () => {
      const caps = getSubjectCapabilities(1);
      expect(caps.certification).toBe(true);
      expect(caps.interview).toBe(false);
      expect(caps.learningLab).toBe(false);
      expect(caps.lab).toBe(false);
      expect(caps.learningLabStatus).toBe('UNAVAILABLE');
      expect(caps.workspace).toBe(true);
      expect(caps.evidence).toBe(true);
      expect(caps.roadmap).toBe(true); // Genuinely usable: Roadmap 3 (13 phases, 63 topics, 188h)
      expect(caps.questionAvailability).toBe(true);
      expect(caps.hasQuestionBank).toBe(true);
      expect(caps.questionCount).toBe(709);
    });

    it('System Design (id: 3): certification = false, interview = true, learningLab = false, roadmap = true', () => {
      const caps = getSubjectCapabilities(3);
      expect(caps.certification).toBe(false);
      expect(caps.interview).toBe(true);
      expect(caps.learningLab).toBe(false);
      expect(caps.lab).toBe(false);
      expect(caps.learningLabStatus).toBe('UNAVAILABLE');
      expect(caps.workspace).toBe(true);
      expect(caps.evidence).toBe(true);
      expect(caps.roadmap).toBe(true); // Genuinely usable: Roadmap 4 (13 phases, 63 topics, 188h)
      expect(caps.studyGuide).toBe(false);
      expect(caps.scenarios).toBe(false);
    });

    it('Databricks (id: 2): certification = false, interview = false, learningLab = true', () => {
      const caps = getSubjectCapabilities(2);
      expect(caps.certification).toBe(false);
      expect(caps.interview).toBe(false);
      expect(caps.learningLab).toBe(true);
      expect(caps.lab).toBe(true);
      expect(caps.learningLabStatus).toBe('AVAILABLE');
      expect(caps.workspace).toBe(true);
      expect(caps.evidence).toBe(true);
      expect(caps.roadmap).toBe(false);
      expect(caps.studyGuide).toBe(false);
      expect(caps.scenarios).toBe(false);
    });

    it('Agentic AI (id: 5): certification = false, interview = false, learningLab = false, roadmap = true', () => {
      const caps = getSubjectCapabilities(5);
      expect(caps.certification).toBe(false);
      expect(caps.interview).toBe(false);
      expect(caps.learningLab).toBe(false);
      expect(caps.lab).toBe(false);
      expect(caps.workspace).toBe(true);
      expect(caps.evidence).toBe(true);
      expect(caps.roadmap).toBe(true);
      expect(caps.studyGuide).toBe(false);
      expect(caps.scenarios).toBe(false);
    });
  });

  describe('Missing Subject Context & Fallback Safety', () => {
    it('returns UNASSIGNED_CAPABILITIES when passed null (never defaulting to ADF or PSM I)', () => {
      const caps = getSubjectCapabilities(null);
      expect(caps).toEqual(UNASSIGNED_CAPABILITIES);
      expect(caps.certification).toBe(false);
      expect(caps.interview).toBe(false);
      expect(caps.learningLab).toBe(false);
      expect(caps.lab).toBe(false);
      expect(caps.roadmap).toBe(false);
      expect(caps.studyGuide).toBe(false);
      expect(caps.scenarios).toBe(false);
      expect(caps.questionAvailability).toBe(false);
      // Workspace and Evidence remain safe unassigned defaults
      expect(caps.workspace).toBe(true);
      expect(caps.evidence).toBe(true);
    });

    it('returns UNASSIGNED_CAPABILITIES when passed undefined', () => {
      const caps = getSubjectCapabilities(undefined);
      expect(caps).toEqual(UNASSIGNED_CAPABILITIES);
    });

    it('returns UNASSIGNED_CAPABILITIES when passed an invalid ID or unknown string', () => {
      expect(getSubjectCapabilities(999)).toEqual(UNASSIGNED_CAPABILITIES);
      expect(getSubjectCapabilities(0)).toEqual(UNASSIGNED_CAPABILITIES);
      expect(getSubjectCapabilities(-1)).toEqual(UNASSIGNED_CAPABILITIES);
      expect(getSubjectCapabilities('unknown-subject-slug')).toEqual(UNASSIGNED_CAPABILITIES);
    });

    it('resolves subject by slug and alias strings correctly', () => {
      expect(getSubjectCapabilities('adf').interview).toBe(true);
      expect(getSubjectCapabilities('azure-data-factory').interview).toBe(true);
      expect(getSubjectCapabilities('psm-i').certification).toBe(true);
      expect(getSubjectCapabilities('scrum-psm-i').certification).toBe(true);
      expect(getSubjectCapabilities('databricks').learningLab).toBe(true);
      expect(getSubjectCapabilities('system-design').interview).toBe(true);
      expect(getSubjectCapabilities('kafka').certification).toBe(true);
      expect(getSubjectCapabilities('agentic-ai').roadmap).toBe(true);
    });

    it('resolves subject from a Subject or object reference', () => {
      const adfSubject = { id: 6, name: 'Azure Data Factory', slug: 'adf' };
      expect(getSubjectCapabilities(adfSubject).learningLab).toBe(true);
      expect(getSubjectCapabilities(adfSubject).certification).toBe(false);

      const psmSubject = { id: 1, name: 'Scrum / PSM I', slug: 'psm-i' };
      expect(getSubjectCapabilities(psmSubject).certification).toBe(true);
      expect(getSubjectCapabilities(psmSubject).interview).toBe(false);
    });
  });

  describe('isCapabilityAvailable and isTargetCapability', () => {
    it('returns true only for genuinely supported capabilities and respects production availability', () => {
      // ADF: the Behaviour Lab is live now that all five experiments are built
      expect(isCapabilityAvailable(6, 'certification')).toBe(false);
      expect(isCapabilityAvailable(6, 'interview')).toBe(true);
      expect(isTargetCapability(6, 'learningLab')).toBe(true);
      expect(isTargetCapability(6, 'lab')).toBe(true);
      expect(isCapabilityAvailable(6, 'learningLab')).toBe(true);
      expect(isCapabilityAvailable(6, 'lab')).toBe(true);
      expect(isCapabilityAvailable(6, 'workspace')).toBe(true);
      expect(isCapabilityAvailable(6, 'evidence')).toBe(true);

      // PSM I
      expect(isCapabilityAvailable(1, 'certification')).toBe(true);
      expect(isCapabilityAvailable(1, 'interview')).toBe(false);
      expect(isCapabilityAvailable(1, 'learningLab')).toBe(false);

      // System Design
      expect(isCapabilityAvailable(3, 'certification')).toBe(false);
      expect(isCapabilityAvailable(3, 'interview')).toBe(true);
      expect(isCapabilityAvailable(3, 'learningLab')).toBe(false);

      // PSM I
      expect(isCapabilityAvailable(1, 'certification')).toBe(true);
      expect(isCapabilityAvailable(1, 'interview')).toBe(false);
      expect(isCapabilityAvailable(1, 'learningLab')).toBe(false);
      expect(isCapabilityAvailable(1, 'roadmap')).toBe(true);

      // System Design
      expect(isCapabilityAvailable(3, 'certification')).toBe(false);
      expect(isCapabilityAvailable(3, 'interview')).toBe(true);
      expect(isCapabilityAvailable(3, 'learningLab')).toBe(false);
      expect(isCapabilityAvailable(3, 'roadmap')).toBe(true);

      // Databricks
      expect(isCapabilityAvailable(2, 'certification')).toBe(false);
      expect(isCapabilityAvailable(2, 'learningLab')).toBe(true);
      expect(isCapabilityAvailable(2, 'interview')).toBe(false);
      expect(isCapabilityAvailable(2, 'roadmap')).toBe(false); // Databricks has no roadmap in database

      // Kafka
      expect(isCapabilityAvailable(4, 'certification')).toBe(true);
      expect(isCapabilityAvailable(4, 'interview')).toBe(false);
      expect(isCapabilityAvailable(4, 'learningLab')).toBe(false);
      expect(isCapabilityAvailable(4, 'roadmap')).toBe(true);

      // Agentic AI
      expect(isCapabilityAvailable(5, 'certification')).toBe(false);
      expect(isCapabilityAvailable(5, 'roadmap')).toBe(true);
    });

    it('returns false for null or undefined subject on non-unassigned capabilities', () => {
      expect(isCapabilityAvailable(null, 'certification')).toBe(false);
      expect(isCapabilityAvailable(null, 'interview')).toBe(false);
      expect(isCapabilityAvailable(null, 'learningLab')).toBe(false);
      expect(isCapabilityAvailable(null, 'lab')).toBe(false);
      expect(isCapabilityAvailable(null, 'roadmap')).toBe(false);
      expect(isCapabilityAvailable(null, 'studyGuide')).toBe(false);
      expect(isCapabilityAvailable(null, 'scenarios')).toBe(false);
      // Safe scratchpad defaults
      expect(isCapabilityAvailable(null, 'workspace')).toBe(true);
      expect(isCapabilityAvailable(null, 'evidence')).toBe(true);
    });
  });

  describe('getSubjectsWithCapability', () => {
    it('filters a given subjects array by capability', () => {
      const mockList: Subject[] = [
        { id: 1, name: 'PSM I', slug: 'psm-i', kind: 'certification', is_archived: false, display_order: 1, has_exam_profile: true, question_count: 709, readiness: {} as any },
        { id: 2, name: 'Databricks', slug: 'databricks', kind: 'skill', is_archived: false, display_order: 2, has_exam_profile: false, question_count: 0, readiness: {} as any },
        { id: 3, name: 'System Design', slug: 'system-design', kind: 'skill', is_archived: false, display_order: 3, has_exam_profile: false, question_count: 0, readiness: {} as any },
        { id: 6, name: 'ADF', slug: 'adf', kind: 'skill', is_archived: false, display_order: 6, has_exam_profile: false, question_count: 0, readiness: {} as any },
      ];

      const certSubjects = getSubjectsWithCapability(mockList, 'certification');
      expect(certSubjects.map((s) => s.id)).toEqual([1]);

      // Learning Lab in production: Databricks (Lakehouse Lab) and ADF (Behaviour Lab) are both AVAILABLE
      const labSubjects = getSubjectsWithCapability(mockList, 'learningLab');
      expect(labSubjects.map((s) => s.id)).toEqual([2, 6]);

      // Target architecture capability covers both Databricks and ADF
      const targetLabSubjects = mockList.filter((s) => isTargetCapability(s, 'learningLab'));
      expect(targetLabSubjects.map((s) => s.id)).toEqual([2, 6]);

      const interviewSubjects = getSubjectsWithCapability(mockList, 'interview');
      expect(interviewSubjects.map((s) => s.id)).toEqual([3, 6]);

      const roadmapSubjects = getSubjectsWithCapability(mockList, 'roadmap');
      expect(roadmapSubjects.map((s) => s.id)).toEqual([1, 3, 6]);
    });

    it('returns known production subjects with the specified capability when called without an array', () => {
      const certSubjects = getSubjectsWithCapability('certification');
      expect(certSubjects.map((s) => s.id)).toEqual([1, 4]);

      // Learning Lab in production: Databricks (Lakehouse Lab) and ADF (Behaviour Lab) are both AVAILABLE
      const labSubjects = getSubjectsWithCapability('learningLab');
      expect(labSubjects.map((s) => s.id)).toEqual([2, 6]);

      // Target architecture capability covers both Databricks and ADF
      const targetLabSubjects = KNOWN_PRODUCTION_SUBJECTS.filter((s) => isTargetCapability(s.id, 'learningLab'));
      expect(targetLabSubjects.map((s) => s.id)).toEqual([2, 6]);

      const interviewSubjects = getSubjectsWithCapability('interview');
      expect(interviewSubjects.map((s) => s.id)).toEqual([3, 6]);

      const roadmapSubjects = getSubjectsWithCapability('roadmap');
      expect(roadmapSubjects.map((s) => s.id)).toEqual([1, 3, 4, 5, 6]);

      const studyGuideSubjects = getSubjectsWithCapability('studyGuide');
      expect(studyGuideSubjects.map((s) => s.id)).toEqual([6]);
    });
  });

  describe('Authoritative KNOWN_PRODUCTION_SUBJECTS list', () => {
    it('contains all 6 core subjects with exact IDs and capabilities', () => {
      expect(KNOWN_PRODUCTION_SUBJECTS).toHaveLength(6);
      const ids = KNOWN_PRODUCTION_SUBJECTS.map((s) => s.id);
      expect(ids).toEqual([1, 2, 3, 4, 5, 6]);
    });
  });
});

describe('Interview capability is backed by subject-scoped content', () => {
  // ADF keeps `interview: true` only because its own content exists: each
  // scenario in the shipped pack ends with a Say-it question per role, and
  // ScenarioPage saves the learner's answer as an interview question under the
  // ADF preparation. If the pack stops shipping them, this flag is a claim
  // about nothing and must go false.
  it('ADF ships a Say-it question for every role of every written scenario', () => {
    const pack = adfPack as unknown as ContentPackDetail;
    const written = pack.scenario_levels.flatMap((l) => l.scenarios).filter((sc) => sc.content);
    const sayIt = written.flatMap((sc) =>
      Object.values(sc.content!.lenses).map((lens) => lens.sayIt.question.trim()),
    );
    expect(written.length).toBeGreaterThan(0);
    expect(sayIt.every((q) => q.length > 0)).toBe(true);
    expect(getSubjectCapabilities(6).interview).toBe(true);
  });

  it('a subject with no interview content of its own has no interview capability', () => {
    // Agentic AI and Databricks have neither prompts nor scenario questions of their own;
    // the shared library is not theirs.
    expect(getSubjectCapabilities(5).interview).toBe(false);
    expect(getSubjectCapabilities(2).interview).toBe(false);
    expect(isCapabilityAvailable(null, 'interview')).toBe(false);
  });
});

describe('Capabilities read from the preparation itself', () => {
  const record = (over: Partial<Subject>): Subject => ({
    id: 42, name: 'My AZ-900', slug: 'my-az-900', kind: 'certification', is_archived: false,
    display_order: 100, has_exam_profile: true, question_count: 120, content_packs: [],
    readiness: { state: 'needs_evaluation', mock_count: 0, recent_scores: [] } as unknown as Subject['readiness'],
    ...over,
  });

  it("gives a learner's own certification its certification capability, not UNASSIGNED", () => {
    const caps = getSubjectCapabilities(record({}));
    expect(caps.certification).toBe(true);
    expect(caps.questionAvailability).toBe(true);
    expect(caps.questionCount).toBe(120);
    expect(caps.interview).toBe(false);
    expect(caps.learningLabStatus).toBe('UNAVAILABLE');
  });

  it("claims guides and scenarios for a learner's skill only when it has packs attached", () => {
    expect(getSubjectCapabilities(record({ kind: 'skill', question_count: 0 })).studyGuide).toBe(false);
    const withPack = record({
      kind: 'skill', question_count: 0,
      content_packs: [{ pack_id: 'adls', pack_version: 1 } as unknown as NonNullable<Subject['content_packs']>[number]],
    });
    expect(getSubjectCapabilities(withPack).studyGuide).toBe(true);
    expect(getSubjectCapabilities(withPack).certification).toBe(false);
  });

  it('sees questions imported into Kafka later, instead of keeping the bank locked at a static 0', () => {
    const kafka = record({ id: 4, slug: 'confluent-certified-developer-for-apache-kafka', question_count: 0 });
    expect(getSubjectCapabilities(kafka).questionAvailability).toBe(false);
    const filled = { ...kafka, question_count: 55 };
    expect(getSubjectCapabilities(filled).questionAvailability).toBe(true);
    expect(getSubjectCapabilities(filled).questionCount).toBe(55);
    expect(getSubjectCapabilities(filled).certification).toBe(true);
  });

  it("does not mistake a learner's preparation that reuses a seeded id for that seeded subject", () => {
    // On another install, id 6 can be anything. Only the slug says it is ADF.
    const notAdf = record({ id: 6, slug: 'my-az-900' });
    const caps = getSubjectCapabilities(notAdf);
    expect(caps.certification).toBe(true);
    expect(caps.learningLabStatus).toBe('UNAVAILABLE');
    expect(caps.scenarios).toBe(false);
  });

  it('still knows nothing about a bare id it does not describe', () => {
    expect(getSubjectCapabilities(42)).toBe(UNASSIGNED_CAPABILITIES);
  });
});

describe('Curriculum capabilities follow the live record (Phase 7)', () => {
  const pack = (pack_id: string, chapter_count: number, written_scenario_count: number) =>
    ({ pack_id, pack_version: 1, latest_version: 1, title: pack_id, chapter_count, written_scenario_count });
  const seeded = (id: number, over: Partial<Subject> = {}): Subject => {
    const known = KNOWN_PRODUCTION_SUBJECTS.find((s) => s.id === id)!;
    return {
      id, name: known.name, slug: known.slug, kind: known.kind, is_archived: false, display_order: id,
      has_exam_profile: false, question_count: getSubjectCapabilities(id).questionCount, content_packs: [],
      readiness: { state: 'needs_evaluation', mock_count: 0, recent_scores: [] } as unknown as Subject['readiness'],
      ...over,
    } as Subject;
  };

  it('claims a roadmap only while one is linked: PSM I and System Design lose it when theirs is unlinked (D3)', () => {
    expect(getSubjectCapabilities(seeded(1, { roadmap_count: 1 })).roadmap).toBe(true);
    expect(getSubjectCapabilities(seeded(1, { roadmap_count: 0 })).roadmap).toBe(false);
    expect(getSubjectCapabilities(seeded(3, { roadmap_count: 0 })).roadmap).toBe(false);
    // ...and Databricks gains one when the lakehouse roadmap is linked to it.
    expect(getSubjectCapabilities(seeded(2, { roadmap_count: 1 })).roadmap).toBe(true);
  });

  it('claims a study guide from attached packs, and scenarios only from written ones (D5)', () => {
    const adls = getSubjectCapabilities(seeded(2, { content_packs: [pack('adls', 11, 0)] as Subject['content_packs'] }));
    expect(adls.studyGuide).toBe(true);
    expect(adls.scenarios).toBe(false);
    const none = getSubjectCapabilities(seeded(2, { content_packs: [] }));
    expect(none.studyGuide).toBe(false);
    const adf = getSubjectCapabilities(seeded(6, { content_packs: [pack('adf', 21, 18)] as Subject['content_packs'] }));
    expect(adf.studyGuide && adf.scenarios).toBe(true);
  });

  it('leaves a fact the record does not state to the table, never guessing it', () => {
    // An older payload without the counts: the table stands.
    const caps = getSubjectCapabilities(seeded(6, { content_packs: [{ pack_id: 'adf', pack_version: 1 }] as unknown as Subject['content_packs'] }));
    expect(caps.studyGuide).toBe(getSubjectCapabilities(6).studyGuide);
  });

  it('gives the Lakehouse Lab to the Databricks preparation by its slug, the one the lab keeps its work under', () => {
    expect(LAKEHOUSE_SLUG).toBe(SKILL_SLUG);
    expect(getSubjectCapabilities(seeded(2)).lakehouseLab).toBe(true);
    expect(getSubjectCapabilities(seeded(6)).lakehouseLab).toBe(false);
    const learnerSkill = { ...seeded(2), id: 77, slug: 'my-spark-skill' };
    expect(getSubjectCapabilities(learnerSkill).lakehouseLab).toBe(false);
    expect(UNASSIGNED_CAPABILITIES.lakehouseLab).toBe(false);
  });
});
