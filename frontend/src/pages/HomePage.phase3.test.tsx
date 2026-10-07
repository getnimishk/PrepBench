// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HomePage } from './HomePage';
import { getSubjectCapabilities, UNASSIGNED_CAPABILITIES } from '../services/capabilities';
import type { Subject } from '../types/subject';
import type { SubjectCapabilityProfile } from '../types/capabilities';

// API mocks
const mockGetSubjects = vi.fn();
const mockGetHomeSummary = vi.fn();
const mockGetOtherPreparation = vi.fn();
const mockGetFocusTopics = vi.fn();
const mockGetDailyGoals = vi.fn();
const mockGetRoadmaps = vi.fn();

vi.mock('../services/api', () => ({
  getSubjects: (...a: unknown[]) => mockGetSubjects(...a),
  getHomeSummary: (...a: unknown[]) => mockGetHomeSummary(...a),
  getOtherPreparation: (...a: unknown[]) => mockGetOtherPreparation(...a),
  getFocusTopics: (...a: unknown[]) => mockGetFocusTopics(...a),
  getDailyGoals: (...a: unknown[]) => mockGetDailyGoals(...a),
  getRoadmaps: (...a: unknown[]) => mockGetRoadmaps(...a),
}));

// Preparation context mock
interface MockPrepContext {
  selectedId: number | null;
  selected: Subject | null;
  capabilities: SubjectCapabilityProfile;
  select: (id: number | null) => void;
  loading: boolean;
}

const mockSelect = vi.fn();
const mockContext: MockPrepContext = {
  selectedId: 1,
  selected: null,
  capabilities: getSubjectCapabilities(1),
  select: (...a: unknown[]) => mockSelect(...a),
  loading: false,
};

vi.mock('../context/PreparationContext', () => ({
  usePreparation: () => mockContext,
}));

// Test subjects fixtures
const PSM1_SUBJECT: Subject = {
  id: 1,
  name: 'Professional Scrum Master I',
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
    mock_count: 7,
    pass_mark: 85,
    recent_scores: [83.8, 71.2, 70.0, 82.5, 87.5, 92.5, 60.0],
    latest_taken_at: '2026-09-01T12:00:00Z',
    is_stale: false,
    domains: [
      { domain: 'Managing Products with Agility', state: 'developing', answered: 148, score_pct: 78.5 },
      { domain: 'Developing People and Teams', state: 'solid', answered: 162, score_pct: 88.0 },
    ],
    weakest_domain: 'Managing Products with Agility',
    points_per_mock: 2.1,
    blockers: [{ kind: 'below_pass', value: 82.5, target: 85, count: 1 }],
  },
};

const KAFKA_SUBJECT: Subject = {
  id: 4,
  name: 'Kafka CCDAK',
  slug: 'kafka-ccdak',
  kind: 'certification',
  pass_mark: 83,
  exam_question_count: 55,
  exam_minutes: 90,
  question_count: 0, // 0 loaded questions in DB!
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
    blockers: [{ kind: 'no_exam_profile' }],
  },
};

const ADF_SUBJECT: Subject = {
  id: 6,
  name: 'Azure Data Factory',
  slug: 'azure-data-factory',
  kind: 'skill',
  pass_mark: null,
  exam_question_count: null,
  exam_minutes: null,
  question_count: 0,
  has_exam_profile: false,
  is_archived: false,
  display_order: 6,
  description: 'Enterprise data integration pipelines, orchestration, and monitoring',
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

const DATABRICKS_SUBJECT: Subject = {
  id: 2,
  name: 'Databricks Lakehouse',
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
  description: 'Distributed architectures, scaling, consensus, and fault tolerance',
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

const AGENTIC_AI_SUBJECT: Subject = {
  id: 5,
  name: 'Agentic AI',
  slug: 'agentic-ai',
  kind: 'skill',
  pass_mark: null,
  exam_question_count: null,
  exam_minutes: null,
  question_count: 0,
  has_exam_profile: false,
  is_archived: false,
  display_order: 5,
  description: 'Autonomous multi-agent architectures, tool use, and cognitive workflows',
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

const ALL_SUBJECTS = [
  PSM1_SUBJECT,
  DATABRICKS_SUBJECT,
  SYSTEM_DESIGN_SUBJECT,
  KAFKA_SUBJECT,
  AGENTIC_AI_SUBJECT,
  ADF_SUBJECT,
];

const renderHomePage = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/preparations" element={<div>Preparations Workspace</div>} />
        <Route path="/exam-setup" element={<div>Exam Setup</div>} />
        <Route path="/lab" element={<div>Learning Lab</div>} />
        <Route path="/interview-practice" element={<div>Interview Practice</div>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockSelect.mockReset();
  mockGetSubjects.mockResolvedValue(ALL_SUBJECTS);
  mockGetHomeSummary.mockResolvedValue({
    resumable: null,
    unreviewed_total: 0,
    due_for_review: 0,
    per_subject: [{ subject_id: 1, unreviewed: 0 }],
    mock_count: 7,
    mock_accuracy: 78.5,
    subjects_total: 6,
    subjects_ready: 0,
  });
  mockGetOtherPreparation.mockResolvedValue([]);
  mockGetFocusTopics.mockResolvedValue([]);
  mockGetRoadmaps.mockResolvedValue([]);
  mockGetDailyGoals.mockRejectedValue(new Error('no goals'));
});

describe('Phase 3 — Unified Home & Certification Readiness Integration', () => {
  it('correctly renders PSM I: separates formal verdict (NOT READY) from coaching note (Almost there)', async () => {
    mockContext.selectedId = 1;
    mockContext.selected = PSM1_SUBJECT;
    mockContext.capabilities = getSubjectCapabilities(1);

    renderHomePage();

    // Subject context in eyebrow and section 1
    expect(await screen.findByRole('heading', { name: 'Almost there' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Professional Scrum Master I' })).toBeInTheDocument();

    // Section 1: What am I preparing for?
    const panel1 = screen.getByRole('region', { name: '1. What am I preparing for?' });
    expect(within(panel1).getByText('Active Focus · Certification Track')).toBeInTheDocument();
    expect(within(panel1).getByText(/Pass Mark:\s*85%/)).toBeInTheDocument();
    expect(within(panel1).getByText(/Scrum Master · Agile Coach · Delivery Lead/)).toBeInTheDocument();

    // Section 2: Am I ready? Formal Verdict vs Coaching Note
    const panel2 = screen.getByRole('region', { name: '2. Am I ready?' });
    expect(within(panel2).getByText('Verdict: NOT READY')).toBeInTheDocument();
    expect(within(panel2).getByText(/Coaching Note:\s*Almost there/)).toBeInTheDocument();

    // Sourced from real production readiness engine:
    expect(within(panel2).getByText('Managing Products with Agility (148 questions answered)')).toBeInTheDocument();
    expect(within(panel2).getByText(/79%\s*· Developing/)).toBeInTheDocument();
    expect(within(panel2).getByText('Developing People and Teams (162 questions answered)')).toBeInTheDocument();

    // Section 4: What can I practice?
    const panel4 = screen.getByRole('region', { name: '4. What can I practice?' });
    expect(within(panel4).getByRole('link', { name: 'Start Mock' })).toBeInTheDocument();
    expect(within(panel4).getByRole('link', { name: 'Open Bank' })).toBeInTheDocument();

    // Section 5: Learning Lab informative fallback for PSM I
    const panel5 = screen.getByRole('region', { name: '5. What can I experiment with? (Learning Lab)' });
    expect(within(panel5).getByText('Learning Lab Not Configured for Professional Scrum Master I')).toBeInTheDocument();
  });

  it('correctly renders Kafka CCDAK: formal verdict DATA NOT AVAILABLE, mock button disabled with 0 Qs alert', async () => {
    mockContext.selectedId = 4;
    mockContext.selected = KAFKA_SUBJECT;
    mockContext.capabilities = getSubjectCapabilities(4);

    renderHomePage();

    // Section 1: Kafka details
    const panel1 = await screen.findByRole('region', { name: '1. What am I preparing for?' });
    expect(within(panel1).getByText(/Kafka CCDAK/)).toBeInTheDocument();
    expect(within(panel1).getByText(/0 Questions loaded in current dataset/)).toBeInTheDocument();

    // Section 2: Formal verdict DATA NOT AVAILABLE
    const panel2 = screen.getByRole('region', { name: '2. Am I ready?' });
    expect(within(panel2).getByText('Verdict: DATA NOT AVAILABLE')).toBeInTheDocument();

    // Section 4: Mock exam CTA is disabled because bank is empty
    const panel4 = screen.getByRole('region', { name: '4. What can I practice?' });
    const mockBtn = within(panel4).getByRole('button', { name: '0 Qs Loaded' });
    expect(mockBtn).toBeDisabled();

    // Top primary CTA is disabled
    const topDisabledBtn = screen.getByRole('button', { name: '0 Questions Loaded' });
    expect(topDisabledBtn).toBeDisabled();
  });

  it('correctly renders ADF: Skill track with SKILL COMPETENCY TRACKING, pending lab state, and no exam simulator', async () => {
    mockContext.selectedId = 6;
    mockContext.selected = ADF_SUBJECT;
    mockContext.capabilities = getSubjectCapabilities(6);

    renderHomePage();

    // Section 1: ADF is a Skill Track
    const panel1 = await screen.findByRole('region', { name: '1. What am I preparing for?' });
    expect(within(panel1).getByText(/Azure Data Factory/)).toBeInTheDocument();
    expect(within(panel1).getByText('Active Focus · Professional Skill Track')).toBeInTheDocument();
    expect(within(panel1).getByText(/Skill Track · Continuous competency evaluation/)).toBeInTheDocument();

    // Section 2: Status is SKILL COMPETENCY TRACKING
    const panel2 = screen.getByRole('region', { name: '2. Am I ready?' });
    expect(within(panel2).getByText('Status: SKILL COMPETENCY TRACKING')).toBeInTheDocument();
    expect(within(panel2).queryByText(/Verdict: READY/)).not.toBeInTheDocument();

    // Top CTA is disabled pending integration
    const topCta = screen.getByRole('button', { name: 'Behaviour Lab (Integration Pending)' });
    expect(topCta).toBeDisabled();

    // Section 4: Practice formats include Scenarios and pending Behaviour Labs, but NO mock exam simulator
    const panel4 = screen.getByRole('region', { name: '4. What can I practice?' });
    expect(within(panel4).getByRole('button', { name: 'Integration Pending' })).toBeDisabled();
    expect(within(panel4).getByRole('link', { name: 'Explore Scenarios' })).toHaveAttribute('href', '/scenarios');
    expect(within(panel4).queryByRole('button', { name: 'Start Mock' })).not.toBeInTheDocument();

    // Section 5: Learning Lab informative integration pending view
    const panel5 = screen.getByRole('region', { name: '5. What can I experiment with? (Learning Lab)' });
    expect(within(panel5).getByText('ADF Behaviour Labs — Scheduled for Phase 5 Integration')).toBeInTheDocument();
    expect(within(panel5).getByText('Concurrency & Parallelism Budget (Phase 5)')).toBeInTheDocument();
    expect(within(panel5).getByText('Watermark CDC & Fault Tolerance (Phase 5)')).toBeInTheDocument();
  });

  it('correctly renders Databricks Lakehouse: Lakehouse Lab CTA, System Lab experiment, no cert exam', async () => {
    mockContext.selectedId = 2;
    mockContext.selected = DATABRICKS_SUBJECT;
    mockContext.capabilities = getSubjectCapabilities(2);

    renderHomePage();

    // Top CTA opens Lakehouse Lab (never Behaviour Lab)
    const labLinks = await screen.findAllByRole('link', { name: 'Open Lakehouse Lab' });
    expect(labLinks[0]).toHaveAttribute('href', '/databricks-sandbox');
    expect(screen.queryByRole('link', { name: 'Open Behaviour Lab' })).not.toBeInTheDocument();

    // Section 1: Databricks details
    const panel1 = screen.getByRole('region', { name: '1. What am I preparing for?' });
    expect(within(panel1).getByText(/Databricks Lakehouse/)).toBeInTheDocument();
    expect(within(panel1).getByText(/Data Platform Engineer · Lakehouse Architect/)).toBeInTheDocument();

    // Section 5: End-to-End Lakehouse Migration
    const panel5 = screen.getByRole('region', { name: '5. What can I experiment with? (Learning Lab)' });
    expect(within(panel5).getByText('End-to-End Lakehouse Migration')).toBeInTheDocument();
    expect(within(panel5).getByRole('link', { name: 'Open Lakehouse Lab' })).toHaveAttribute('href', '/databricks-sandbox');
  });

  it('correctly renders System Design: Interview CTAs, System Design studio, and no cert exam', async () => {
    mockContext.selectedId = 3;
    mockContext.selected = SYSTEM_DESIGN_SUBJECT;
    mockContext.capabilities = getSubjectCapabilities(3);

    renderHomePage();

    // Top CTA is Practice Interview
    const interviewLink = await screen.findByRole('link', { name: 'Practice Interview' });
    expect(interviewLink).toHaveAttribute('href', '/interview-practice');

    // Section 4: Practice includes System Design Studio & Verbal Interview
    const panel4 = screen.getByRole('region', { name: '4. What can I practice?' });
    expect(within(panel4).getByRole('link', { name: 'Open Studio' })).toHaveAttribute('href', '/system-design');
    expect(within(panel4).getByRole('link', { name: 'Practice Rounds' })).toHaveAttribute('href', '/interview-practice');
    expect(within(panel4).queryByRole('button', { name: 'Start Mock' })).not.toBeInTheDocument();
  });

  it('correctly renders Agentic AI: Skill track with Roadmap curriculum', async () => {
    mockContext.selectedId = 5;
    mockContext.selected = AGENTIC_AI_SUBJECT;
    mockContext.capabilities = getSubjectCapabilities(5);

    renderHomePage();

    const panel1 = await screen.findByRole('region', { name: '1. What am I preparing for?' });
    expect(within(panel1).getByText(/Focus Track:\s*Agentic AI/)).toBeInTheDocument();
    expect(within(panel1).getByText(/AI Systems Engineer · Agentic Workflow Architect/)).toBeInTheDocument();
  });

  it('correctly renders Unassigned state when selectedId is null, without defaulting silently to PSM I or ADF', async () => {
    mockContext.selectedId = null;
    mockContext.selected = null;
    mockContext.capabilities = UNASSIGNED_CAPABILITIES;

    renderHomePage();

    // Renders the dedicated Unassigned view
    expect(await screen.findByRole('heading', { name: 'Choose Your Focus Area' })).toBeInTheDocument();
    expect(screen.getByText('Registered Subjects & Skill Tracks')).toBeInTheDocument();

    // Lists all subjects with direct selection action
    expect(screen.getByText('Select Professional Scrum Master I')).toBeInTheDocument();
    expect(screen.getByText('Select Azure Data Factory')).toBeInTheDocument();
    expect(screen.getByText('Select Databricks Lakehouse')).toBeInTheDocument();

    // Clicking select triggers select(id)
    fireEvent.click(screen.getByText('Select Azure Data Factory'));
    expect(mockSelect).toHaveBeenCalledWith(6);
  });

  describe('Phase 3 Learning Lab Production Availability Hardening (Phase Gate Invariants)', () => {
    it('Regression 1: ADF Learning Lab is not presented as fully AVAILABLE before Phase 5', async () => {
      mockContext.selectedId = 6;
      mockContext.selected = ADF_SUBJECT;
      mockContext.capabilities = getSubjectCapabilities(6);

      renderHomePage();

      // Target capability exists in registry, but production availability is INTEGRATION_PENDING
      expect(mockContext.capabilities.learningLab).toBe(true);
      expect(mockContext.capabilities.learningLabStatus).toBe('INTEGRATION_PENDING');

      // Section 5: Must show explicit integration pending state, not claiming experiments are live
      const panel5 = await screen.findByRole('region', { name: '5. What can I experiment with? (Learning Lab)' });
      expect(within(panel5).getByText('ADF Behaviour Labs — Scheduled for Phase 5 Integration')).toBeInTheDocument();
      expect(within(panel5).getByText('Integration Pending · Phase 5')).toBeInTheDocument();
      expect(within(panel5).getByText('Integration Pending (Phase 5)')).toBeInTheDocument();

      // No active "Launch Experiment" or "Open Behaviour Lab" links
      expect(within(panel5).queryByRole('link', { name: 'Launch Experiment' })).not.toBeInTheDocument();
      expect(within(panel5).queryByRole('link', { name: 'Open Behaviour Lab' })).not.toBeInTheDocument();

      // Section 4 Practice: Shows pending status
      const panel4 = screen.getByRole('region', { name: '4. What can I practice?' });
      expect(within(panel4).getByText('Phase 5')).toBeInTheDocument();
      const practiceLabBtn = within(panel4).getByRole('button', { name: 'Integration Pending' });
      expect(practiceLabBtn).toBeDisabled();
    });

    it('Regression 2: ADF Home CTA does not launch an unavailable ADF experiment', async () => {
      mockContext.selectedId = 6;
      mockContext.selected = ADF_SUBJECT;
      mockContext.capabilities = getSubjectCapabilities(6);

      renderHomePage();

      // Top Primary CTA must be disabled and indicate integration pending
      const topCta = await screen.findByRole('button', { name: 'Behaviour Lab (Integration Pending)' });
      expect(topCta).toBeInTheDocument();
      expect(topCta).toBeDisabled();
      expect(topCta).toHaveAttribute('aria-disabled', 'true');
      expect(topCta).toHaveAttribute('title', 'ADF Behaviour Lab integration pending (Phase 5)');

      // Must not have an href pointing to /lab or launch any unavailable experiment
      expect(topCta).not.toHaveAttribute('href');
      expect(screen.queryByRole('link', { name: 'Open Behaviour Lab' })).not.toBeInTheDocument();
    });

    it('Regression 3: Databricks Learning Lab remains AVAILABLE', async () => {
      mockContext.selectedId = 2;
      mockContext.selected = DATABRICKS_SUBJECT;
      mockContext.capabilities = getSubjectCapabilities(2);

      renderHomePage();

      // Databricks has genuine current production availability
      expect(mockContext.capabilities.learningLab).toBe(true);
      expect(mockContext.capabilities.learningLabStatus).toBe('AVAILABLE');

      // Top Primary CTA is active and navigates directly to the Lakehouse sandbox
      const topCtas = await screen.findAllByRole('link', { name: 'Open Lakehouse Lab' });
      const topCta = topCtas[0];
      expect(topCta).toBeInTheDocument();
      expect(topCta).toHaveAttribute('href', '/databricks-sandbox');

      // Regression: Databricks MUST NOT be called "Behaviour Lab"
      expect(screen.queryByRole('link', { name: 'Open Behaviour Lab' })).not.toBeInTheDocument();

      // Section 4 practice row is active
      const panel4 = screen.getByRole('region', { name: '4. What can I practice?' });
      expect(within(panel4).getByRole('link', { name: 'Open Lakehouse Lab' })).toHaveAttribute('href', '/databricks-sandbox');

      // Section 5 experiment card is active
      const panel5 = screen.getByRole('region', { name: '5. What can I experiment with? (Learning Lab)' });
      expect(within(panel5).getByText('End-to-End Lakehouse Migration')).toBeInTheDocument();
      expect(within(panel5).getByRole('link', { name: 'Open Lakehouse Lab' })).toHaveAttribute('href', '/databricks-sandbox');
      expect(within(panel5).getByRole('link', { name: 'Lakehouse Sandbox' })).toHaveAttribute('href', '/databricks-sandbox');
    });

    it('Regression 4: Changing ADF state to AVAILABLE (in Phase 5) automatically enables the CTA without redesigning Home', async () => {
      mockContext.selectedId = 6;
      mockContext.selected = ADF_SUBJECT;
      // Simulate Phase 5 activation of ADF Behaviour Lab:
      mockContext.capabilities = {
        ...getSubjectCapabilities(6),
        learningLabStatus: 'AVAILABLE',
      };

      renderHomePage();

      // Home immediately reflects the live state without requiring any architectural changes:
      // 1. Top primary CTA becomes active link to /lab
      const topCta = await screen.findByRole('link', { name: 'Open Behaviour Lab' });
      expect(topCta).toBeInTheDocument();
      expect(topCta).toHaveAttribute('href', '/lab');

      // 2. Section 4 Practice opens active lab link
      const panel4 = screen.getByRole('region', { name: '4. What can I practice?' });
      expect(within(panel4).getByRole('link', { name: 'Open Lab' })).toHaveAttribute('href', '/lab');

      // 3. Section 5 renders active experiment cards with Launch Experiment buttons linking to /lab
      const panel5 = screen.getByRole('region', { name: '5. What can I experiment with? (Learning Lab)' });
      const launchButtons = within(panel5).getAllByRole('link', { name: 'Launch Experiment' });
      expect(launchButtons).toHaveLength(2);
      expect(launchButtons[0]).toHaveAttribute('href', '/lab');
      expect(launchButtons[1]).toHaveAttribute('href', '/lab');
      expect(within(panel5).getByRole('link', { name: 'All Lab Sandboxes' })).toHaveAttribute('href', '/lab');
    });
  });
});
