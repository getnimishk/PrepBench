// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HomePage } from './HomePage';
import { Subject } from '../types/subject';
import { getSubjectCapabilities, UNASSIGNED_CAPABILITIES } from '../services/capabilities';

const mockGetHomeSummary = vi.fn();
const mockGetSubjects = vi.fn();
const mockGetReviewQueue = vi.fn();
const mockGetLearningAttempts = vi.fn();
const mockGetOtherPreparation = vi.fn();
const mockGetRoadmaps = vi.fn();
const mockGetFocusTopics = vi.fn();
const mockGetDailyGoals = vi.fn();

vi.mock('../services/api', () => ({
  getHomeSummary: (...a: any[]) => mockGetHomeSummary(...a),
  getSubjects: (...a: any[]) => mockGetSubjects(...a),
  getReviewQueue: (...a: any[]) => mockGetReviewQueue(...a),
  getLearningAttempts: (...a: any[]) => mockGetLearningAttempts(...a),
  getOtherPreparation: (...a: any[]) => mockGetOtherPreparation(...a),
  getRoadmaps: (...a: any[]) => mockGetRoadmaps(...a),
  getFocusTopics: (...a: any[]) => mockGetFocusTopics(...a),
  getDailyGoals: (...a: any[]) => mockGetDailyGoals(...a),
}));

const mockContext: {
  selectedId: number | null;
  selected: Subject | null;
  capabilities: any;
} = {
  selectedId: 1,
  selected: null,
  capabilities: null,
};

vi.mock('../context/PreparationContext', () => ({
  usePreparation: () => ({
    selectedId: mockContext.selectedId,
    selected: mockContext.selected,
    capabilities: mockContext.capabilities ?? (mockContext.selectedId ? getSubjectCapabilities(mockContext.selectedId) : UNASSIGNED_CAPABILITIES),
  }),
}));

const PSM_SUBJECT: Subject = {
  id: 1,
  name: 'Scrum / PSM I',
  slug: 'psm-i',
  kind: 'certification',
  pass_mark: 85,
  exam_question_count: 80,
  exam_minutes: 60,
  question_count: 709,
  has_exam_profile: true,
  is_archived: false,
  display_order: 1,
  readiness: {
    state: 'almost_there',
    mock_count: 2,
    pass_mark: 85,
    recent_scores: [82.5, 87.5],
    latest_taken_at: '2026-10-01T12:00:00Z',
    is_stale: false,
    domains: [
      { domain: 'Managing Products with Agility', score_pct: 79, answered: 30, state: 'developing' },
      { domain: 'Scrum Framework', score_pct: 88, answered: 50, state: 'solid' },
    ],
    rules: {
      min_mocks_for_ready: 3,
      consecutive_mocks_at_pass: 3,
      domain_floor_pct: 75,
      recency_days: 14,
      plateau_min_mocks: 3,
      plateau_max_spread: 5,
      min_questions_per_domain: 10,
    },
    weakest_domain: 'Managing Products with Agility',
    blockers: [],
  },
};

const DATABRICKS_SUBJECT: Subject = {
  id: 2,
  name: 'Databricks Data Platform',
  slug: 'databricks',
  kind: 'skill',
  pass_mark: null,
  exam_question_count: null,
  exam_minutes: null,
  question_count: 0,
  has_exam_profile: false,
  is_archived: false,
  display_order: 2,
  description: 'Delta Lake lakehouse platform, Medallion architecture, and compute clusters',
  readiness: {
    state: 'needs_evaluation',
    mock_count: 0,
    pass_mark: null,
    recent_scores: [],
    latest_taken_at: null,
    is_stale: false,
    domains: [],
    weakest_domain: null,
    blockers: [],
  },
};

const SYSTEM_DESIGN_SUBJECT: Subject = {
  id: 3,
  name: 'System Design',
  slug: 'system-design',
  kind: 'skill',
  pass_mark: null,
  exam_question_count: null,
  exam_minutes: null,
  question_count: 0,
  has_exam_profile: false,
  is_archived: false,
  display_order: 3,
  readiness: {
    state: 'needs_evaluation',
    mock_count: 0,
    pass_mark: null,
    recent_scores: [],
    latest_taken_at: null,
    is_stale: false,
    domains: [],
    weakest_domain: null,
    blockers: [],
  },
};

const KAFKA_SUBJECT: Subject = {
  id: 4,
  name: 'Confluent Certified Developer for Apache Kafka',
  slug: 'confluent-certified-developer-for-apache-kafka',
  kind: 'certification',
  pass_mark: 83,
  exam_question_count: 60,
  exam_minutes: 90,
  question_count: 0,
  has_exam_profile: true,
  is_archived: false,
  display_order: 4,
  readiness: {
    state: 'needs_evaluation',
    mock_count: 0,
    pass_mark: 83,
    recent_scores: [],
    latest_taken_at: null,
    is_stale: false,
    domains: [],
    weakest_domain: null,
    blockers: [],
  },
};

const ADF_SUBJECT: Subject = {
  id: 6,
  name: 'Azure Data Factory',
  slug: 'adf',
  kind: 'skill',
  pass_mark: null,
  exam_question_count: null,
  exam_minutes: null,
  question_count: 0,
  has_exam_profile: false,
  is_archived: false,
  display_order: 6,
  readiness: {
    state: 'needs_evaluation',
    mock_count: 0,
    pass_mark: null,
    recent_scores: [],
    latest_taken_at: null,
    is_stale: false,
    domains: [],
    weakest_domain: null,
    blockers: [],
  },
};

const ALL_SUBJECTS = [PSM_SUBJECT, DATABRICKS_SUBJECT, SYSTEM_DESIGN_SUBJECT, KAFKA_SUBJECT, ADF_SUBJECT];

const renderHomePage = () =>
  render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>
  );

describe('HomePage — Phase 4 Certification, Interview & Terminology Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSubjects.mockResolvedValue(ALL_SUBJECTS);
    mockGetHomeSummary.mockResolvedValue({
      per_subject: [],
      resumable: null,
    });
    mockGetReviewQueue.mockResolvedValue({ items: [], remaining: 0, total_unreviewed: 0, spaced_due: 0 });
    mockGetLearningAttempts.mockResolvedValue([]);
    mockGetOtherPreparation.mockResolvedValue([]);
    mockGetRoadmaps.mockResolvedValue([]);
    mockGetFocusTopics.mockResolvedValue([]);
    mockGetDailyGoals.mockRejectedValue(new Error('no goals'));
  });

  describe('Databricks Terminology Regression Guard', () => {
    it('uses "Lakehouse Lab" terminology for Databricks and NEVER says "Behaviour Lab"', async () => {
      mockContext.selectedId = 2;
      mockContext.selected = DATABRICKS_SUBJECT;
      mockContext.capabilities = getSubjectCapabilities(2);

      renderHomePage();

      // Top Primary CTA must say "Open Lakehouse Lab", not "Open Behaviour Lab"
      const topCtas = await screen.findAllByRole('link', { name: 'Open Lakehouse Lab' });
      expect(topCtas[0]).toBeInTheDocument();
      expect(topCtas[0]).toHaveAttribute('href', '/databricks-sandbox');
      expect(screen.queryByRole('link', { name: 'Open Behaviour Lab' })).not.toBeInTheDocument();

      // Section 4 practice row must say "Open Lakehouse Lab" and "Lakehouse Simulation Lab"
      const panel4 = screen.getByRole('region', { name: '4. What can I practice?' });
      expect(within(panel4).getByText('Lakehouse Simulation Lab')).toBeInTheDocument();
      expect(within(panel4).getByRole('link', { name: 'Open Lakehouse Lab' })).toHaveAttribute('href', '/databricks-sandbox');

      // Section 5 Learning Lab must say "Lakehouse Sandbox" and "Open Lakehouse Lab"
      const panel5 = screen.getByRole('region', { name: '5. What can I experiment with? (Learning Lab)' });
      expect(within(panel5).getByRole('link', { name: 'Lakehouse Sandbox' })).toHaveAttribute('href', '/databricks-sandbox');
      expect(within(panel5).getByText('End-to-End Lakehouse Migration')).toBeInTheDocument();

      // Total document text assertion: "Behaviour Lab" MUST NOT appear anywhere on the Databricks home page
      expect(screen.queryByText(/Behaviour Lab/)).not.toBeInTheDocument();
    });

    it('ADF uses "Behaviour Lab": live now, and pending whenever an experiment is not built', async () => {
      mockContext.selectedId = 6;
      mockContext.selected = ADF_SUBJECT;
      mockContext.capabilities = getSubjectCapabilities(6);

      const { unmount } = renderHomePage();

      // Live: the Top Primary CTA opens the Behaviour Lab, never the Lakehouse Lab
      const live = await screen.findAllByRole('link', { name: 'Open Behaviour Lab' });
      expect(live[0]).toHaveAttribute('href', '/lab/adf');
      expect(screen.queryByText(/Lakehouse Lab/)).not.toBeInTheDocument();
      const panel4 = screen.getByRole('region', { name: '4. What can I practice?' });
      expect(within(panel4).getByText('ADF Behaviour Labs')).toBeInTheDocument();
      unmount();

      // Pending (an incomplete registry): the same name, disabled, scheduled
      mockContext.capabilities = { ...getSubjectCapabilities(6), learningLabStatus: 'INTEGRATION_PENDING' };
      renderHomePage();
      const topCta = await screen.findByRole('button', { name: 'Behaviour Lab (Integration Pending)' });
      expect(topCta).toBeDisabled();
      const pending4 = screen.getByRole('region', { name: '4. What can I practice?' });
      expect(within(pending4).getByRole('button', { name: 'Integration Pending' })).toBeDisabled();
      const panel5 = screen.getByRole('region', { name: '5. What can I experiment with? (Learning Lab)' });
      expect(within(panel5).getByText(/ADF Behaviour Labs — Scheduled for Phase 5 Integration/)).toBeInTheDocument();
    });
  });

  describe('Subject-Aware Practice & Readiness CTAs', () => {
    it('renders System Design interview CTAs and does NOT show certification exam simulator', async () => {
      mockContext.selectedId = 3;
      mockContext.selected = SYSTEM_DESIGN_SUBJECT;
      mockContext.capabilities = getSubjectCapabilities(3);

      renderHomePage();

      // Section 2: Am I ready? shows Skill Competency Tracking, not formal exam verdict
      const panel2 = await screen.findByRole('region', { name: '2. Am I ready?' });
      expect(within(panel2).getByText('Status: SKILL COMPETENCY TRACKING')).toBeInTheDocument();
      expect(within(panel2).queryByText(/Verdict: READY/)).not.toBeInTheDocument();
      expect(within(panel2).queryByText(/Verdict: NOT READY/)).not.toBeInTheDocument();

      // Section 4: What can I practice? shows System Design Studio and Verbal Practice
      const panel4 = screen.getByRole('region', { name: '4. What can I practice?' });
      expect(within(panel4).getByRole('link', { name: 'Open Studio' })).toHaveAttribute('href', '/system-design');
      expect(within(panel4).getByRole('link', { name: 'Practice Rounds' })).toHaveAttribute('href', '/interview-practice');

      // Does NOT show Mock Exam Simulator
      expect(within(panel4).queryByRole('link', { name: 'Start Mock' })).not.toBeInTheDocument();
      expect(within(panel4).queryByRole('link', { name: 'Open Bank' })).not.toBeInTheDocument();
    });

    it('renders PSM I certification exam CTAs and does NOT show interview studio', async () => {
      mockContext.selectedId = 1;
      mockContext.selected = PSM_SUBJECT;
      mockContext.capabilities = getSubjectCapabilities(1);

      renderHomePage();

      // Section 2: Am I ready? shows formal exam verdict
      const panel2 = await screen.findByRole('region', { name: '2. Am I ready?' });
      expect(within(panel2).getByText('Verdict: NOT READY')).toBeInTheDocument();

      // Section 4: What can I practice? shows Start Mock and Open Bank
      const panel4 = screen.getByRole('region', { name: '4. What can I practice?' });
      expect(within(panel4).getByRole('link', { name: 'Start Mock' })).toHaveAttribute('href', '/exam-setup?subject=1');
      expect(within(panel4).getByRole('link', { name: 'Open Bank' })).toHaveAttribute('href', '/question-bank');

      // Does NOT show System Design Studio
      expect(within(panel4).queryByRole('link', { name: 'Open Studio' })).not.toBeInTheDocument();
    });

    it('renders Kafka CCDAK with disabled 0 Qs Loaded mock exam button', async () => {
      mockContext.selectedId = 4;
      mockContext.selected = KAFKA_SUBJECT;
      mockContext.capabilities = getSubjectCapabilities(4);

      renderHomePage();

      const panel4 = await screen.findByRole('region', { name: '4. What can I practice?' });
      const mockBtn = within(panel4).getByRole('button', { name: '0 Qs Loaded' });
      expect(mockBtn).toBeDisabled();
      expect(within(panel4).queryByRole('link', { name: 'Start Mock' })).not.toBeInTheDocument();
    });
  });
});
