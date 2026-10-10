// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CertificationHubPage } from './CertificationHubPage';
import { Subject } from '../types/subject';
import { getSubjectCapabilities, UNASSIGNED_CAPABILITIES } from '../services/capabilities';

const mockGetSubjects = vi.fn();
const mockGetHomeSummary = vi.fn();
const mockGetMockHistory = vi.fn();
const mockGetReviewCounts = vi.fn();
const mockPreparation = vi.fn();

vi.mock('../services/api', () => ({
  getSubjects: (...a: any[]) => mockGetSubjects(...a),
  getHomeSummary: (...a: any[]) => mockGetHomeSummary(...a),
  getMockHistory: (...a: any[]) => mockGetMockHistory(...a),
  getReviewCounts: (...a: any[]) => mockGetReviewCounts(...a),
}));

vi.mock('../context/PreparationContext', () => ({
  usePreparation: () => mockPreparation(),
}));

const PSM_SUBJECT: Subject = {
  id: 1,
  name: 'Scrum / PSM I',
  slug: 'psm-i',
  kind: 'certification',
  certification: 'PSM I - Professional Scrum Master',
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

const KAFKA_SUBJECT: Subject = {
  id: 4,
  name: 'Confluent Certified Developer for Apache Kafka',
  slug: 'confluent-certified-developer-for-apache-kafka',
  kind: 'certification',
  certification: 'CCDAK - Confluent Certified Developer for Apache Kafka',
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

const ALL_SUBJECTS = [PSM_SUBJECT, DATABRICKS_SUBJECT, KAFKA_SUBJECT, ADF_SUBJECT];

const renderCertHub = (entry = '/certification') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/certification" element={<CertificationHubPage />} />
      </Routes>
    </MemoryRouter>
  );

describe('CertificationHubPage — Phase 4 Certification Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSubjects.mockResolvedValue(ALL_SUBJECTS);
    mockGetHomeSummary.mockResolvedValue({
      per_subject: [],
      resumable: null,
    });
    mockGetMockHistory.mockResolvedValue([]);
    mockGetReviewCounts.mockResolvedValue({ spaced_due: 14, unreviewed: 2 });
  });

  it('renders PSM I with authentic certification profile, production readiness verdict, and active exam CTAs', async () => {
    mockPreparation.mockReturnValue({
      selectedId: 1,
      selected: PSM_SUBJECT,
      capabilities: getSubjectCapabilities(1),
    });

    renderCertHub();

    // 1. What certification am I preparing for?
    const q1 = await screen.findByRole('region', { name: '1. What certification am I preparing for?' });
    expect(within(q1).getByText('PSM I - Professional Scrum Master')).toBeInTheDocument();
    expect(within(q1).getByText('85% Pass Mark')).toBeInTheDocument();
    expect(within(q1).getByText('80 Questions · 60 Mins')).toBeInTheDocument();
    expect(within(q1).getByText('709 Questions Loaded')).toBeInTheDocument();

    // 2. How ready am I? & 3. What evidence supports that assessment?
    const q2 = screen.getByRole('region', {
      name: '2. How ready am I? & 3. What evidence supports that assessment?',
    });
    expect(within(q2).getByText(/Verdict:\s*NOT READY/)).toBeInTheDocument();
    expect(within(q2).getByText(/1 \/ 3 latest mocks at or above 85%/)).toBeInTheDocument();
    expect(within(q2).getByText('Managing Products with Agility')).toBeInTheDocument();
    expect(within(q2).getByText('79% (Floor: 75%)')).toBeInTheDocument();

    // 4. What should I practice next?
    const q4 = screen.getByRole('region', { name: '4. What should I practice next?' });
    expect(within(q4).getByRole('link', { name: 'Start Drill' })).toHaveAttribute(
      'href',
      '/exam-setup?kind=drill&subject=1'
    );
    expect(within(q4).getByRole('link', { name: 'Review Queue' })).toHaveAttribute(
      'href',
      '/practice/spaced?subject=1'
    );
    expect(within(q4).getByRole('link', { name: 'Open Bank' })).toHaveAttribute(
      'href',
      '/question-bank?subject=1'
    );

    // 5. Can I start an exam now?
    const q5 = screen.getByRole('region', { name: '5. Can I start an exam now?' });
    const startMockBtn = within(q5).getByRole('link', { name: 'Configure & Start Mock Exam' });
    expect(startMockBtn).toBeInTheDocument();
    expect(startMockBtn).toHaveAttribute('href', '/exam-setup?kind=mock&subject=1');
  });

  it('renders Kafka CCDAK with honest question-unavailability warning and disabled mock exam simulator', async () => {
    mockPreparation.mockReturnValue({
      selectedId: 4,
      selected: KAFKA_SUBJECT,
      capabilities: getSubjectCapabilities(4),
    });

    renderCertHub();

    // 1. What certification am I preparing for?
    const q1 = await screen.findByRole('region', { name: '1. What certification am I preparing for?' });
    expect(within(q1).getByText('CCDAK - Confluent Certified Developer for Apache Kafka')).toBeInTheDocument();
    expect(within(q1).getByText('83% Pass Mark')).toBeInTheDocument();
    expect(within(q1).getByText('60 Questions · 90 Mins')).toBeInTheDocument();
    expect(within(q1).getByText('0 Questions Loaded')).toBeInTheDocument();

    // 2. Readiness shows DATA NOT AVAILABLE
    const q2 = screen.getByRole('region', {
      name: '2. How ready am I? & 3. What evidence supports that assessment?',
    });
    expect(within(q2).getByText('Verdict: DATA NOT AVAILABLE')).toBeInTheDocument();
    expect(
      within(q2).getByText(/Certification configured, but question content is currently unavailable\./)
    ).toBeInTheDocument();

    // 5. Exam simulator locked with 0 questions loaded
    const q5 = screen.getByRole('region', { name: '5. Can I start an exam now?' });
    expect(within(q5).getByText(/Exam Simulator Locked \(0 Questions Loaded\)\./)).toBeInTheDocument();
    const disabledMockBtn = within(q5).getByRole('button', { name: 'Start Mock (0 Qs Loaded)' });
    expect(disabledMockBtn).toBeDisabled();
    expect(disabledMockBtn).toHaveAttribute('aria-disabled', 'true');

    // Header CTA also shows 0 Questions Loaded
    expect(screen.getByRole('button', { name: '0 Questions Loaded' })).toBeDisabled();
  });

  it('renders CapabilityUnavailablePage for non-certification subject (ADF) without certification readiness language', async () => {
    mockPreparation.mockReturnValue({
      selectedId: 6,
      selected: ADF_SUBJECT,
      capabilities: getSubjectCapabilities(6),
    });

    renderCertHub();

    // Strict invariant: Does NOT silently switch to PSM I!
    expect(await screen.findByText('Certification Unavailable')).toBeInTheDocument();
    expect(
      screen.getByText(/PrepBench evaluates it through practical sandboxes, incident scenarios/)
    ).toBeInTheDocument();

    // Does not display certification readiness metrics or pass mark
    expect(screen.queryByText(/Pass Mark/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Verdict:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Start Mock Exam/)).not.toBeInTheDocument();

    // Provides transparent button to switch to PSM I -- by its slug, from the live list
    expect(
      screen.getByRole('link', { name: /Switch to Scrum \/ PSM I \(Certification\)/ })
    ).toHaveAttribute('href', '/certification?subject=psm-i');
  });

  it('renders unassigned scoping guard when selectedId is null without silently defaulting to PSM I', async () => {
    mockPreparation.mockReturnValue({
      selectedId: null,
      selected: null,
      capabilities: UNASSIGNED_CAPABILITIES,
    });

    renderCertHub();

    expect(await screen.findByText('Select a Certification')).toBeInTheDocument();
    expect(screen.getByText('Certification Readiness Scoping')).toBeInTheDocument();
    expect(screen.getByText(/PrepBench certification assessments require formal subject scoping\./)).toBeInTheDocument();

    // Offers available certification tracks, by slug
    expect(screen.getByRole('link', { name: /Scrum \/ PSM I/ })).toHaveAttribute(
      'href',
      '/certification?subject=psm-i'
    );
    expect(
      screen.getByRole('link', { name: /Confluent Certified Developer for Apache Kafka/ })
    ).toHaveAttribute('href', '/certification?subject=confluent-certified-developer-for-apache-kafka');
  });

  it('links tracks by slug and reaches a preparation whose slug looks like a number, not the one holding that id', async () => {
    // A certification named "4" has the slug "4"; Kafka holds id 4.
    const NAMED_FOUR: Subject = { ...PSM_SUBJECT, id: 40, name: '4', slug: '4', certification: 'Cert Four' };
    mockGetSubjects.mockResolvedValue([...ALL_SUBJECTS, NAMED_FOUR]);
    mockPreparation.mockReturnValue({ selectedId: null, selected: null, capabilities: UNASSIGNED_CAPABILITIES });
    renderCertHub('/certification?subject=4');
    expect(await screen.findByRole('heading', { level: 1, name: /Cert Four|4/ })).toBeInTheDocument();
    expect(screen.queryByText(/Confluent Certified Developer for Apache Kafka/)).not.toBeInTheDocument();
  });

  it('says so in the chooser when no preparation is a certification', async () => {
    mockGetSubjects.mockResolvedValue([DATABRICKS_SUBJECT, ADF_SUBJECT]);
    mockPreparation.mockReturnValue({ selectedId: null, selected: null, capabilities: UNASSIGNED_CAPABILITIES });
    renderCertHub();
    expect(await screen.findByText('Select a Certification')).toBeInTheDocument();
    expect(screen.getByText('None of your preparations is a certification yet.')).toBeInTheDocument();
  });

  it('says the preparations could not be read, rather than that none is a certification', async () => {
    mockGetSubjects.mockRejectedValue(new Error('offline'));
    mockPreparation.mockReturnValue({ selectedId: null, selected: null, capabilities: UNASSIGNED_CAPABILITIES });
    renderCertHub();
    expect(await screen.findByText(/Could not load certification data/)).toBeInTheDocument();
    expect(screen.queryByText('None of your preparations is a certification yet.')).not.toBeInTheDocument();
  });

  it('enforces subject-switch isolation: PSM I -> Kafka -> PSM I guarantees Kafka shows 0 questions and never inherits PSM I content', async () => {
    // 1. Initial State: PSM I (id: 1) has 709 questions
    mockPreparation.mockReturnValue({
      selectedId: 1,
      selected: PSM_SUBJECT,
      capabilities: getSubjectCapabilities(1),
    });

    const { unmount } = renderCertHub();
    expect(await screen.findByRole('heading', { level: 1, name: 'PSM I - Professional Scrum Master' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Question Bank (709)' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start Mock Exam' })).toBeInTheDocument();
    unmount();

    // 2. Switch to Kafka (id: 4) - must show 0 questions and locked mock exam, ZERO leak from PSM I
    mockPreparation.mockReturnValue({
      selectedId: 4,
      selected: KAFKA_SUBJECT,
      capabilities: getSubjectCapabilities(4),
    });

    const { unmount: unmountKafka } = renderCertHub();
    expect(await screen.findByRole('heading', { level: 1, name: 'CCDAK - Confluent Certified Developer for Apache Kafka' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Question Bank (0)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '0 Questions Loaded' })).toBeDisabled();
    expect(screen.queryByRole('link', { name: 'Start Mock Exam' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Question Bank \(709\)/)).not.toBeInTheDocument();
    unmountKafka();

    // 3. Switch back to PSM I (id: 1) - returns cleanly to PSM I
    mockPreparation.mockReturnValue({
      selectedId: 1,
      selected: PSM_SUBJECT,
      capabilities: getSubjectCapabilities(1),
    });

    renderCertHub();
    expect(await screen.findByRole('heading', { level: 1, name: 'PSM I - Professional Scrum Master' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Question Bank (709)' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start Mock Exam' })).toBeInTheDocument();
  });
});

describe('CertificationHubPage -- the verdict comes from the readiness engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetHomeSummary.mockResolvedValue({ per_subject: [], resumable: null });
    mockGetMockHistory.mockResolvedValue([]);
    mockGetReviewCounts.mockResolvedValue({ spaced_due: 0, unreviewed: 0 });
  });

  const region = () => screen.findByRole('region', {
    name: '2. How ready am I? & 3. What evidence supports that assessment?',
  });

  it('does not call a learner ready on streak and recency alone when the engine says otherwise', async () => {
    // Three recent mocks above the pass mark -- the hub's old home-made rule
    // said READY -- but a domain is under its floor, so the engine says not yet.
    const underFloor: Subject = {
      ...PSM_SUBJECT,
      readiness: {
        ...PSM_SUBJECT.readiness,
        state: 'almost_there',
        mock_count: 3,
        recent_scores: [88, 90, 92],
        domains: [{ domain: 'Managing Products with Agility', score_pct: 60, answered: 30, state: 'needs_work' }],
      },
    };
    mockGetSubjects.mockResolvedValue([underFloor]);
    mockPreparation.mockReturnValue({ selectedId: 1, selected: underFloor, capabilities: getSubjectCapabilities(1) });
    renderCertHub();

    const q2 = await region();
    expect(within(q2).getByText(/Verdict:\s*NOT READY/)).toBeInTheDocument();
    expect(within(q2).queryByText(/Verdict:\s*READY$/)).not.toBeInTheDocument();
  });

  it('says READY only when the engine does', async () => {
    const ready: Subject = { ...PSM_SUBJECT, readiness: { ...PSM_SUBJECT.readiness, state: 'ready', mock_count: 3 } };
    mockGetSubjects.mockResolvedValue([ready]);
    mockPreparation.mockReturnValue({ selectedId: 1, selected: ready, capabilities: getSubjectCapabilities(1) });
    renderCertHub();

    expect(within(await region()).getByText(/Verdict:\s*READY/)).toBeInTheDocument();
  });

  it('says not measured yet, not "not ready", before any mock is sat', async () => {
    const unmeasured: Subject = {
      ...PSM_SUBJECT,
      readiness: { ...PSM_SUBJECT.readiness, state: 'needs_evaluation', mock_count: 0, recent_scores: [], domains: [] },
    };
    mockGetSubjects.mockResolvedValue([unmeasured]);
    mockPreparation.mockReturnValue({ selectedId: 1, selected: unmeasured, capabilities: getSubjectCapabilities(1) });
    renderCertHub();

    expect(within(await region()).getByText('Verdict: NOT MEASURED YET')).toBeInTheDocument();
  });

  it("never fills a missing exam profile with PSM I's figures", async () => {
    const noProfile: Subject = {
      ...PSM_SUBJECT, id: 42, slug: 'my-cert', name: 'My Cert', certification: 'My Cert',
      pass_mark: null, exam_question_count: null, exam_minutes: null, has_exam_profile: false, question_count: 30,
    };
    mockGetSubjects.mockResolvedValue([noProfile]);
    mockPreparation.mockReturnValue({ selectedId: 42, selected: noProfile, capabilities: getSubjectCapabilities(noProfile) });
    renderCertHub();

    const q1 = await screen.findByRole('region', { name: '1. What certification am I preparing for?' });
    expect(within(q1).getByText('No pass mark set')).toBeInTheDocument();
    expect(within(q1).getByText('No exam format set')).toBeInTheDocument();
    expect(screen.queryByText(/85%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/80 Questions/)).not.toBeInTheDocument();
    expect(screen.getByText(/No exam profile set\./)).toBeInTheDocument();
  });
});

describe('CertificationHubPage -- following its links keeps the certification it shows', () => {
  const select = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSubjects.mockResolvedValue([PSM_SUBJECT, KAFKA_SUBJECT]);
    mockGetHomeSummary.mockResolvedValue({ per_subject: [], resumable: null });
    mockGetMockHistory.mockResolvedValue([]);
    mockGetReviewCounts.mockResolvedValue({ spaced_due: 14, unreviewed: 2 });
  });

  it("makes the shown preparation the working one before opening a screen scoped by the header's", async () => {
    // Opened for PSM I from the hub's own track chooser while Kafka is in the header. Review,
    // drills and the bank read the header's preparation, so without this the PSM I hub would
    // open Kafka's (or no) cards.
    mockPreparation.mockReturnValue({
      selectedId: 4, selected: KAFKA_SUBJECT, capabilities: getSubjectCapabilities(4), select,
    });
    renderCertHub('/certification?subject=1');

    const q4 = await screen.findByRole('region', { name: '4. What should I practice next?' });
    await userEvent.click(within(q4).getByRole('link', { name: 'Review Queue' }));
    expect(select).toHaveBeenCalledWith(1);
  });

  it('changes nothing when the shown preparation already is the working one', async () => {
    mockPreparation.mockReturnValue({
      selectedId: 1, selected: PSM_SUBJECT, capabilities: getSubjectCapabilities(1), select,
    });
    renderCertHub();

    const q4 = await screen.findByRole('region', { name: '4. What should I practice next?' });
    await userEvent.click(within(q4).getByRole('link', { name: 'Start Drill' }));
    expect(select).not.toHaveBeenCalled();
  });

  it('has no tabs that switch nothing', async () => {
    mockPreparation.mockReturnValue({
      selectedId: 1, selected: PSM_SUBJECT, capabilities: getSubjectCapabilities(1), select,
    });
    renderCertHub();

    expect(await screen.findByRole('heading', { level: 1, name: 'PSM I - Professional Scrum Master' })).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });
});
