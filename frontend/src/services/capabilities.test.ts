// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, expect, it } from 'vitest';
import {
  getSubjectCapabilities,
  getSubjectsWithCapability,
  isCapabilityAvailable,
  isTargetCapability,
  KNOWN_PRODUCTION_SUBJECTS,
  UNASSIGNED_CAPABILITIES,
} from './capabilities';
import type { Subject } from '../types/subject';

describe('Subject Capabilities Foundation (Phase 1)', () => {
  describe('Capability Truth for Core 6 Subjects', () => {
    it('ADF (id: 6): certification = false (ADF IS A SKILL, NOT A CERTIFICATION)', () => {
      const caps = getSubjectCapabilities(6);
      expect(caps.certification).toBe(false);
      expect(caps.interview).toBe(true);
      expect(caps.learningLab).toBe(true);
      expect(caps.lab).toBe(true);
      expect(caps.learningLabStatus).toBe('INTEGRATION_PENDING');
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
      // ADF: Target capability has learningLab, but production availability is pending Phase 5
      expect(isCapabilityAvailable(6, 'certification')).toBe(false);
      expect(isCapabilityAvailable(6, 'interview')).toBe(true);
      expect(isTargetCapability(6, 'learningLab')).toBe(true);
      expect(isTargetCapability(6, 'lab')).toBe(true);
      expect(isCapabilityAvailable(6, 'learningLab')).toBe(false); // Integration pending until Phase 5
      expect(isCapabilityAvailable(6, 'lab')).toBe(false);
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

      // Learning Lab in production: Databricks is AVAILABLE; ADF is INTEGRATION_PENDING (Phase 5)
      const labSubjects = getSubjectsWithCapability(mockList, 'learningLab');
      expect(labSubjects.map((s) => s.id)).toEqual([2]);

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

      // Learning Lab in production: Databricks is AVAILABLE; ADF is INTEGRATION_PENDING (Phase 5)
      const labSubjects = getSubjectsWithCapability('learningLab');
      expect(labSubjects.map((s) => s.id)).toEqual([2]);

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
