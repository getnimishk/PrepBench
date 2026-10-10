// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { InterviewHubPage } from './InterviewHubPage';
import { Subject } from '../types/subject';
import { getSubjectCapabilities, UNASSIGNED_CAPABILITIES } from '../services/capabilities';

const mockGetSubjects = vi.fn();
const mockGetInterviewRoundTypes = vi.fn();
const mockGetInterviewQuestions = vi.fn();
const mockGetSystemDesignPrompts = vi.fn();
const mockGetSystemDesignAttempts = vi.fn();
const mockGetRecordings = vi.fn();
const mockGetDesignReviews = vi.fn();
const mockPreparation = vi.fn();

vi.mock('../services/api', () => ({
  getSubjects: (...a: any[]) => mockGetSubjects(...a),
  getInterviewRoundTypes: (...a: any[]) => mockGetInterviewRoundTypes(...a),
  getInterviewQuestions: (...a: any[]) => mockGetInterviewQuestions(...a),
  getSystemDesignPrompts: (...a: any[]) => mockGetSystemDesignPrompts(...a),
  getSystemDesignAttempts: (...a: any[]) => mockGetSystemDesignAttempts(...a),
  getRecordings: (...a: any[]) => mockGetRecordings(...a),
  getDesignReviews: (...a: any[]) => mockGetDesignReviews(...a),
}));

vi.mock('../context/PreparationContext', () => ({
  usePreparation: () => mockPreparation(),
}));

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
    mock_count: 3,
    pass_mark: 85,
    recent_scores: [85, 90, 88],
    latest_taken_at: null,
    is_stale: false,
    domains: [],
    weakest_domain: null,
    blockers: [],
  },
};

const ALL_SUBJECTS = [PSM_SUBJECT, SYSTEM_DESIGN_SUBJECT, ADF_SUBJECT];

const renderInterviewHub = (entry = '/interview') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/interview" element={<InterviewHubPage />} />
      </Routes>
    </MemoryRouter>
  );

describe('InterviewHubPage — Phase 4 Interview Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSubjects.mockResolvedValue(ALL_SUBJECTS);
    mockGetInterviewRoundTypes.mockResolvedValue([
      { value: 'system_design', label: 'System Design', target_min_seconds: 90, target_max_seconds: 180 },
      { value: 'behavioral', label: 'Behavioral', target_min_seconds: 90, target_max_seconds: 180 },
    ]);
    mockGetInterviewQuestions.mockResolvedValue({
      items: [
        { id: 1, round_type: 'system_design', question_text: 'Design URL Shortener', category: 'Distributed Systems' },
        { id: 2, round_type: 'behavioral', question_text: 'Conflict resolution story', category: 'Conflict Resolution' },
      ],
      total: 2,
    });
    mockGetSystemDesignPrompts.mockResolvedValue({
      items: [
        { id: 10, title: 'Design WhatsApp Chat', category: 'Real-Time Systems', difficulty: 'medium' },
        { id: 11, title: 'Design Distributed Cache', category: 'Caching', difficulty: 'hard' },
      ],
      total: 2,
    });
    mockGetSystemDesignAttempts.mockResolvedValue({
      items: [
        { id: 101, prompt_id: 10, overall_score: 84.5, time_spent_seconds: 1800 },
      ],
      total: 1,
    });
    mockGetRecordings.mockResolvedValue({
      items: [
        { id: 201, title: 'URL Shortener Walkthrough', duration_seconds: 120, analyses: [{ id: 1, overall_score: 80 }] },
      ],
      total: 1,
    });
    // The API's own shape: a page of items and the total.
    mockGetDesignReviews.mockResolvedValue({
      items: [{ id: 301, title: 'Kafka vs Kinesis Ingestion Axis' }],
      total: 1,
    });
  });

  it('renders System Design track with Studio prompts, Tradeoff Reviews, verbal architecture round, and recordings', async () => {
    mockPreparation.mockReturnValue({
      selectedId: 3,
      selected: SYSTEM_DESIGN_SUBJECT,
      capabilities: getSubjectCapabilities(3),
    });

    renderInterviewHub();

    // 1. What kind of interview practice can I do?
    const q1 = await screen.findByRole('region', { name: '1. What kind of interview practice can I do?' });
    expect(within(q1).getByText('2 architecture prompts')).toBeInTheDocument();
    expect(within(q1).getByText('1 tradeoff review')).toBeInTheDocument();
    expect(within(q1).getByText('Spoken Architecture')).toBeInTheDocument();

    // 2. What technical capability is being assessed?
    const q2 = screen.getByRole('region', { name: '2. What technical capability is being assessed?' });
    expect(within(q2).getByText('Distributed Architecture & Tradeoff Defense')).toBeInTheDocument();
    expect(within(q2).getByText('Scale & Storage')).toBeInTheDocument();
    expect(within(q2).getByText('Failure Modes')).toBeInTheDocument();

    // 3. Which interview modes are available?
    const q3 = screen.getByRole('region', { name: '3. Which interview modes are available?' });
    expect(within(q3).getByRole('link', { name: 'Open Studio' })).toHaveAttribute('href', '/system-design');
    expect(within(q3).getByRole('link', { name: 'Open Reviews' })).toHaveAttribute('href', '/design-reviews');
    expect(within(q3).getByRole('link', { name: 'Practice Rounds' })).toHaveAttribute(
      'href',
      '/interview-practice?round=system_design'
    );
    expect(within(q3).getByRole('link', { name: 'Open Recordings' })).toHaveAttribute('href', '/recordings');

    // 4. Evidence generated
    const q4 = screen.getByRole('region', { name: '4. What evidence/results have I generated?' });
    expect(within(q4).getByText('Studio Attempts')).toBeInTheDocument();
    expect(within(q4).getByText('Audio takes, all preparations')).toBeInTheDocument();
  });

  it('renders ADF track with verbal technical rounds, incident communication, and does NOT render System Design Studio', async () => {
    mockPreparation.mockReturnValue({
      selectedId: 6,
      selected: ADF_SUBJECT,
      capabilities: getSubjectCapabilities(6),
    });

    renderInterviewHub();

    // 1. ADF formats
    const q1 = await screen.findByRole('region', { name: '1. What kind of interview practice can I do?' });
    expect(within(q1).getByText('Technical & Incident')).toBeInTheDocument();
    expect(within(q1).queryByText(/Architecture Prompts/)).not.toBeInTheDocument();

    // 2. Technical capability: Pipeline Reliability
    const q2 = screen.getByRole('region', { name: '2. What technical capability is being assessed?' });
    expect(within(q2).getByText('Pipeline Reliability & Incident Communication')).toBeInTheDocument();
    expect(within(q2).getByText('ETL / Pipeline Coupling')).toBeInTheDocument();
    expect(within(q2).getByText('Watermark CDC')).toBeInTheDocument();

    // 3. Modes: Verbal practice & Scenarios, NO System Design studio
    const q3 = screen.getByRole('region', { name: '3. Which interview modes are available?' });
    expect(within(q3).getByRole('link', { name: 'Practice Rounds' })).toHaveAttribute(
      'href',
      '/interview-practice'
    );
    expect(within(q3).getByRole('link', { name: 'Explore Scenarios' })).toHaveAttribute('href', '/scenarios');
    expect(within(q3).queryByRole('link', { name: 'Open Studio' })).not.toBeInTheDocument();
  });

  it("counts ADF's own saved questions, not the shared library, and leads with its scenarios", async () => {
    mockPreparation.mockReturnValue({
      selectedId: 6,
      selected: ADF_SUBJECT,
      capabilities: getSubjectCapabilities(6),
    });
    mockGetInterviewQuestions.mockImplementation((params: { subject_id?: number }) => Promise.resolve(
      params?.subject_id === 6 ? { items: [], total: 0 } : { items: [], total: 36 },
    ));

    renderInterviewHub();

    const q3 = await screen.findByRole('region', { name: '3. Which interview modes are available?' });
    // ADF's interview content is what its scenarios save under it: none yet.
    expect(await within(q3).findByText('0 saved')).toBeInTheDocument();
    expect(mockGetInterviewQuestions).toHaveBeenCalledWith({ subject_id: 6, limit: 1 });
    // The shared library is named as shared, never presented as ADF's own.
    expect(within(q3).getByText('36 library questions')).toBeInTheDocument();
    expect(within(q3).getByText(/shared across preparations/)).toBeInTheDocument();
    // The lead action goes to the content that is ADF's, not to the general library.
    expect(screen.getByRole('link', { name: /Practise from Azure Data Factory scenarios/ }))
      .toHaveAttribute('href', '/scenarios');
  });

  it('says a count is unavailable when it could not be read, never a stand-in number', async () => {
    mockPreparation.mockReturnValue({
      selectedId: 3,
      selected: SYSTEM_DESIGN_SUBJECT,
      capabilities: getSubjectCapabilities(3),
    });
    mockGetDesignReviews.mockRejectedValue(new Error('offline'));
    mockGetSystemDesignPrompts.mockRejectedValue(new Error('offline'));
    mockGetRecordings.mockRejectedValue(new Error('offline'));

    renderInterviewHub();

    const q1 = await screen.findByRole('region', { name: '1. What kind of interview practice can I do?' });
    expect(within(q1).getByText('Tradeoff reviews unavailable')).toBeInTheDocument();
    expect(within(q1).getByText('Architecture prompts unavailable')).toBeInTheDocument();
    // The old fallback invented ten reviews whenever the list failed to load.
    expect(screen.queryByText(/\b10\b.*review/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\b0 (architecture )?prompts?\b/i)).not.toBeInTheDocument();

    const q3 = screen.getByRole('region', { name: '3. Which interview modes are available?' });
    expect(within(q3).getByText('Recordings unavailable')).toBeInTheDocument();
    // With the prompts unread there is no "next unattempted" to recommend.
    expect(screen.queryByRole('link', { name: 'Start Architecture Answer' })).not.toBeInTheDocument();
  });

  it('renders CapabilityUnavailablePage for non-interview subject (PSM I) without silent switching', async () => {
    mockPreparation.mockReturnValue({
      selectedId: 1,
      selected: PSM_SUBJECT,
      capabilities: getSubjectCapabilities(1),
    });

    renderInterviewHub();

    expect(await screen.findByText('Interview Unavailable')).toBeInTheDocument();
    expect(screen.getByText('Interview is not configured for Scrum / PSM I')).toBeInTheDocument();
    expect(
      screen.getByText(/timed mock exam simulator, and spaced repetition queue/)
    ).toBeInTheDocument();

    // Provides explicit link to switch to System Design or ADF -- by its slug, from the live list
    expect(
      screen.getByRole('link', { name: /Switch to System Design \(Interview\)/ })
    ).toHaveAttribute('href', '/interview?subject=system-design');
  });

  it('renders unassigned scoping guard when selectedId is null without silently defaulting to System Design', async () => {
    mockPreparation.mockReturnValue({
      selectedId: null,
      selected: null,
      capabilities: UNASSIGNED_CAPABILITIES,
    });

    renderInterviewHub();

    expect(await screen.findByText('Select an Interview Track')).toBeInTheDocument();
    expect(screen.getByText('Technical Capability Rehearsal')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /System Design \(Interview Track\)/ })).toHaveAttribute(
      'href',
      '/interview?subject=system-design'
    );
    expect(screen.getByRole('link', { name: /Azure Data Factory \(Interview Track\)/ })).toHaveAttribute(
      'href',
      '/interview?subject=adf'
    );
  });
});

describe('InterviewHubPage -- tracks are offered from the live preparations, by slug, never by a reused id', () => {
  // System Design and ADF were deleted and created again (ids 33 and 66); SQLite then gave id 3
  // to an unrelated preparation. Nothing may call id 3 System Design or send the learner there.
  const KAFKA_STREAMS_AT_3: Subject = { ...SYSTEM_DESIGN_SUBJECT, id: 3, name: 'Kafka Streams', slug: 'kafka-streams' };
  const SD_AT_33: Subject = { ...SYSTEM_DESIGN_SUBJECT, id: 33 };
  const ADF_AT_66: Subject = {
    ...ADF_SUBJECT,
    id: 66,
    content_packs: [{ pack_id: 'adf', pack_version: 1, latest_version: 1, title: 'ADF', chapter_count: 21, written_scenario_count: 18 }] as Subject['content_packs'],
  };
  const RENUMBERED = [PSM_SUBJECT, KAFKA_STREAMS_AT_3, SD_AT_33, ADF_AT_66];

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetInterviewQuestions.mockResolvedValue({ items: [], total: 0 });
    mockGetSystemDesignPrompts.mockResolvedValue({ items: [], total: 0 });
    mockGetSystemDesignAttempts.mockResolvedValue({ items: [], total: 0 });
    mockGetRecordings.mockResolvedValue({ items: [] });
    mockGetDesignReviews.mockResolvedValue({ items: [], total: 0 });
  });

  const noLinkTo = (fragment: RegExp) =>
    expect(screen.queryAllByRole('link').filter((a) => fragment.test(a.getAttribute('href') ?? ''))).toEqual([]);

  it('offers the recreated System Design from the unavailable page, never the preparation now holding id 3', async () => {
    mockGetSubjects.mockResolvedValue(RENUMBERED);
    mockPreparation.mockReturnValue({ selectedId: 1, selected: PSM_SUBJECT, capabilities: getSubjectCapabilities(PSM_SUBJECT) });

    renderInterviewHub();

    expect(await screen.findByText('Interview Unavailable')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Switch to System Design \(Interview\)/ }))
      .toHaveAttribute('href', '/interview?subject=system-design');
    expect(screen.queryByText(/Kafka Streams/)).not.toBeInTheDocument();
    noLinkTo(/subject=3(\D|$)/);
  });

  it('lists the recreated tracks by slug in the chooser, and not the preparation holding id 3', async () => {
    mockGetSubjects.mockResolvedValue(RENUMBERED);
    mockPreparation.mockReturnValue({ selectedId: null, selected: null, capabilities: UNASSIGNED_CAPABILITIES });

    renderInterviewHub();

    expect(await screen.findByText('Select an Interview Track')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /System Design \(Interview Track\)/ }))
      .toHaveAttribute('href', '/interview?subject=system-design');
    expect(screen.getByRole('link', { name: /Azure Data Factory \(Interview Track\)/ }))
      .toHaveAttribute('href', '/interview?subject=adf');
    expect(screen.queryByRole('link', { name: /Kafka Streams/ })).not.toBeInTheDocument();
    noLinkTo(/subject=3(\D|$)/);
  });

  it('opens the recreated System Design from its slug link, with its studio', async () => {
    mockGetSubjects.mockResolvedValue(RENUMBERED);
    mockPreparation.mockReturnValue({ selectedId: null, selected: null, capabilities: UNASSIGNED_CAPABILITIES });

    renderInterviewHub('/interview?subject=system-design');

    expect(await screen.findByRole('link', { name: 'Open Studio' })).toHaveAttribute('href', '/system-design');
    expect(screen.queryByText('Interview Unavailable')).not.toBeInTheDocument();
  });

  it('does not present the preparation now holding id 3 as System Design when opened by that id', async () => {
    mockGetSubjects.mockResolvedValue(RENUMBERED);
    mockPreparation.mockReturnValue({ selectedId: null, selected: null, capabilities: UNASSIGNED_CAPABILITIES });

    renderInterviewHub('/interview?subject=3');

    expect(await screen.findByText('Interview Unavailable')).toBeInTheDocument();
    expect(screen.getByText('Interview is not configured for Kafka Streams')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open Studio' })).not.toBeInTheDocument();
  });

  it('reaches the preparation whose slug looks like a number, not the one holding that id', async () => {
    // A preparation named "3" has the slug "3"; the link names it, whichever preparation holds id 3.
    mockGetSubjects.mockResolvedValue([PSM_SUBJECT, KAFKA_STREAMS_AT_3, { ...ADF_AT_66, id: 40, name: 'Pipelines 3', slug: '3' }]);
    mockPreparation.mockReturnValue({ selectedId: null, selected: null, capabilities: UNASSIGNED_CAPABILITIES });

    renderInterviewHub('/interview?subject=3');

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(/Pipelines 3/);
    expect(screen.queryByText('Interview Unavailable')).not.toBeInTheDocument();
  });

  it('says so when no other preparation has interview rounds, instead of offering one it does not have', async () => {
    mockGetSubjects.mockResolvedValue([PSM_SUBJECT, KAFKA_STREAMS_AT_3]);
    mockPreparation.mockReturnValue({ selectedId: 1, selected: PSM_SUBJECT, capabilities: getSubjectCapabilities(PSM_SUBJECT) });

    renderInterviewHub();

    expect(await screen.findByText('Interview Unavailable')).toBeInTheDocument();
    expect(screen.getByText('None of your preparations has interview rounds yet.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Switch to/ })).not.toBeInTheDocument();
  });

  it('says the preparations could not be read, rather than that none has interview rounds', async () => {
    mockGetSubjects.mockRejectedValue(new Error('offline'));
    mockPreparation.mockReturnValue({ selectedId: 1, selected: PSM_SUBJECT, capabilities: getSubjectCapabilities(PSM_SUBJECT) });

    renderInterviewHub();

    expect(await screen.findByText('Interview Unavailable')).toBeInTheDocument();
    expect(screen.getByText(/Your preparations could not be read/)).toBeInTheDocument();
    expect(screen.queryByText('None of your preparations has interview rounds yet.')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Switch to/ })).not.toBeInTheDocument();
  });

  it('says so in the chooser when no preparation has interview rounds', async () => {
    mockGetSubjects.mockResolvedValue([PSM_SUBJECT, KAFKA_STREAMS_AT_3]);
    mockPreparation.mockReturnValue({ selectedId: null, selected: null, capabilities: UNASSIGNED_CAPABILITIES });

    renderInterviewHub();

    expect(await screen.findByText('Select an Interview Track')).toBeInTheDocument();
    expect(screen.getByText('None of your preparations has interview rounds yet.')).toBeInTheDocument();
  });
});

describe('InterviewHubPage -- following its scenario links keeps the preparation it shows', () => {
  it("makes the shown preparation the working one before opening its scenarios", async () => {
    const select = vi.fn();
    mockGetSubjects.mockResolvedValue(ALL_SUBJECTS);
    mockGetInterviewQuestions.mockResolvedValue({ items: [], total: 0 });
    mockGetSystemDesignPrompts.mockResolvedValue({ items: [], total: 0 });
    mockGetSystemDesignAttempts.mockResolvedValue({ items: [], total: 0 });
    mockGetRecordings.mockResolvedValue({ items: [] });
    mockGetDesignReviews.mockResolvedValue({ items: [], total: 0 });
    // Opened for ADF from the track chooser with nothing in the header: /scenarios reads the
    // header's preparation, so without this it would show no ADF scenarios at all.
    mockPreparation.mockReturnValue({
      selectedId: null, selected: null, capabilities: UNASSIGNED_CAPABILITIES, select,
    });
    renderInterviewHub('/interview?subject=6');

    await userEvent.click(await screen.findByRole('link', { name: /Practise from Azure Data Factory scenarios/ }));
    expect(select).toHaveBeenCalledWith(6);
  });
});

describe('InterviewHubPage -- Lakehouse Lab P1-1: preparations with lab interview questions', () => {
  const DATABRICKS_EMPTY: Subject = {
    id: 2, name: 'Databricks', slug: 'databricks', kind: 'skill',
    pass_mark: null, exam_question_count: null, exam_minutes: null, question_count: 0,
    has_exam_profile: false, is_archived: false, display_order: 2,
    readiness: { state: 'needs_evaluation', mock_count: 0, recent_scores: [] } as any,
    lab_interview_question_count: 0,
  };

  const DATABRICKS_WITH_LAB_QUESTIONS: Subject = {
    ...DATABRICKS_EMPTY,
    lab_interview_question_count: 1,
  };

  it('renders Interview Unavailable when Databricks has no lab questions saved', async () => {
    mockGetSubjects.mockResolvedValue([DATABRICKS_EMPTY]);
    mockPreparation.mockReturnValue({
      selectedId: 2, selected: DATABRICKS_EMPTY, capabilities: getSubjectCapabilities(DATABRICKS_EMPTY),
    });

    renderInterviewHub('/interview?subject=databricks');
    expect(await screen.findByText('Interview Unavailable')).toBeInTheDocument();
  });

  it('routes to interview-practice rather than scenarios when Databricks has saved lab questions', async () => {
    const select = vi.fn();
    mockGetSubjects.mockResolvedValue([DATABRICKS_WITH_LAB_QUESTIONS]);
    mockGetInterviewQuestions.mockResolvedValue({ items: [], total: 1 });
    mockGetSystemDesignPrompts.mockResolvedValue({ items: [], total: 0 });
    mockGetSystemDesignAttempts.mockResolvedValue({ items: [], total: 0 });
    mockGetRecordings.mockResolvedValue({ items: [] });
    mockGetDesignReviews.mockResolvedValue({ items: [], total: 0 });
    mockPreparation.mockReturnValue({
      selectedId: null, selected: null, capabilities: UNASSIGNED_CAPABILITIES, select,
    });

    renderInterviewHub('/interview?subject=databricks');

    const mainBtn = await screen.findByRole('link', { name: /Practise Databricks questions/ });
    expect(mainBtn).toHaveAttribute('href', '/interview-practice');
    expect(screen.queryByRole('link', { name: /scenarios/i })).not.toBeInTheDocument();

    expect(screen.getByText('Databricks lab interview questions')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Practise Questions' })).toHaveAttribute('href', '/interview-practice');

    await userEvent.click(mainBtn);
    expect(select).toHaveBeenCalledWith(2);
  });
});
