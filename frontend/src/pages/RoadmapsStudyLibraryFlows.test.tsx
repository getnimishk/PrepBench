// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RoadmapListPage } from './RoadmapListPage';
import { RoadmapDetailPage } from './RoadmapDetailPage';
import { RoadmapTopicPage } from './RoadmapTopicPage';
import { TopicGuidePage } from './TopicGuidePage';
import { TopicDemonstratePage } from './TopicDemonstratePage';
import { StudyLibraryPage } from './StudyLibraryPage';
import type { RoadmapDetail, RoadmapSchedule, RoadmapSummary } from '../types/roadmap';
import type { Subject } from '../types/subject';
import adfRoadmap from '../test/fixtures/adfSampleRoadmap.json';
import adfPack from '../../../backend/app/content/packs/adf/v1.json';

const mockApi = {
  getRoadmaps: vi.fn(),
  getRoadmap: vi.fn(),
  getRoadmapSchedule: vi.fn(),
  updateRoadmapTopic: vi.fn(),
  updateRoadmap: vi.fn(),
  updateRoadmapResource: vi.fn(),
  getTopicDemonstrations: vi.fn(),
  getTopicGuide: vi.fn(),
  demonstrateTopic: vi.fn(),
  getDomainDetail: vi.fn(),
  getContentPack: vi.fn(),
  getReferenceSheets: vi.fn(),
  getQuestions: vi.fn(),
  getEvidence: vi.fn(),
};

vi.mock('../services/api', () => ({
  getScopedRoadmaps: (...a: any[]) => mockApi.getRoadmaps(...a),
  getRoadmap: (...a: any[]) => mockApi.getRoadmap(...a),
  getRoadmapSchedule: (...a: any[]) => mockApi.getRoadmapSchedule(...a),
  updateRoadmapTopic: (...a: any[]) => mockApi.updateRoadmapTopic(...a),
  updateRoadmap: (...a: any[]) => mockApi.updateRoadmap(...a),
  updateRoadmapResource: (...a: any[]) => mockApi.updateRoadmapResource(...a),
  getTopicDemonstrations: (...a: any[]) => mockApi.getTopicDemonstrations(...a),
  getTopicGuide: (...a: any[]) => mockApi.getTopicGuide(...a),
  demonstrateTopic: (...a: any[]) => mockApi.demonstrateTopic(...a),
  getDomainDetail: (...a: any[]) => mockApi.getDomainDetail(...a),
  getContentPack: (...a: any[]) => mockApi.getContentPack(...a),
  getReferenceSheets: (...a: any[]) => mockApi.getReferenceSheets(...a),
  getQuestions: (...a: any[]) => mockApi.getQuestions(...a),
  getEvidence: (...a: any[]) => mockApi.getEvidence(...a),
  createRoadmap: vi.fn(),
  deleteRoadmap: vi.fn(),
}));

let currentPreparation: any = null;
vi.mock('../context/PreparationContext', () => ({
  usePreparation: () => ({ selected: currentPreparation, preparations: currentPreparation ? [currentPreparation] : [], loading: false }),
}));

const mockTopic = {
  id: 10,
  roadmap_id: 1,
  phase_id: 1,
  order_index: 0,
  title: 'Kafka Producer Internals',
  learning_objective: 'Understand batching, acks, and linger.ms in producer configurations.',
  success_criteria: 'Configure a producer for zero data loss and explain each setting unprompted.',
  estimated_hours: 4,
  status: 'not_started' as const,
  progress_percentage: 0,
  started_at: null,
  completed_at: null,
  evidence_notes: null,
  mapped_chapters: [],
};

const mockRoadmapDetail: RoadmapDetail = {
  id: 1,
  title: 'Apache Kafka Mastery',
  description: 'Enterprise event streaming curriculum',
  source_filename: 'kafka.xlsx',
  subject_id: 1,
  start_date: '2026-01-01',
  weekly_hours_budget: 8,
  is_archived: false,
  created_at: '2026-01-01T00:00:00',
  updated_at: '2026-01-01T00:00:00',
  phase_count: 1,
  progress: {
    total_topics: 1,
    not_started_count: 1,
    in_progress_count: 0,
    completed_count: 0,
    skipped_count: 0,
    completion_percentage: 0,
    hours_percentage: 0,
    total_estimated_hours: 4,
    completed_estimated_hours: 0,
  },
  phases: [
    {
      id: 1,
      roadmap_id: 1,
      name: 'Producers & Consumers',
      order_index: 0,
      topics: [mockTopic],
    },
  ],
  resources: [
    {
      id: 11,
      roadmap_id: 1,
      title: 'Mental Model',
      order_index: 0,
      purpose: 'reference',
      columns: ['Concept', 'Analogy'],
      rows: [['Log compaction', 'Key-value snapshots']],
    },
  ],
  sheets: [
    { name: 'Syllabus', kind: 'syllabus' },
    { name: 'Mental Model', kind: 'resource', resource_id: 11 },
  ],
};

const mockSummary: RoadmapSummary = {
  id: 1,
  title: 'Apache Kafka Mastery',
  description: 'Enterprise event streaming curriculum',
  source_filename: 'kafka.xlsx',
  subject_id: 1,
  is_archived: false,
  phase_count: 1,
  progress: mockRoadmapDetail.progress,
};

const mockSchedule: RoadmapSchedule = {
  schedule_available: true,
  start_date: '2026-01-01',
  weekly_hours_budget: 8,
  projected_end_date: '2026-02-01',
  unschedulable_topic_count: 0,
  items: [],
  phases: [],
};

const mockPreparationSubject: Subject = {
  id: 1,
  name: 'Kafka Architecture',
  kind: 'skill',
  has_exam_profile: true,
  question_count: 150,
  readiness: {
    state: 'developing',
    mock_count: 3,
    pass_mark: 80,
    recent_scores: [72, 75],
    is_stale: false,
    domains: [
      { domain: 'Producer Internals', state: 'needs_work', answered: 25, score_pct: 64 },
    ],
    weakest_domain: 'Producer Internals',
    blockers: [],
    rules: { domain_floor_pct: 75 },
  },
} as unknown as Subject;

const renderApp = (initialRoute: string) => render(
  <MemoryRouter initialEntries={[initialRoute]}>
    <Routes>
      <Route path="/roadmaps" element={<RoadmapListPage />} />
      <Route path="/roadmaps/:roadmapId" element={<RoadmapDetailPage />} />
      <Route path="/roadmaps/:roadmapId/topics/:topicId" element={<RoadmapTopicPage />} />
      <Route path="/roadmaps/:roadmapId/topics/:topicId/guide" element={<TopicGuidePage />} />
      <Route path="/roadmaps/:roadmapId/topics/:topicId/demonstrate" element={<TopicDemonstratePage />} />
      <Route path="/learn" element={<StudyLibraryPage />} />
      <Route path="/learn/guides/:packId" element={<div>Guide Pack Detail</div>} />
      <Route path="/learn/guides/:packId/:chapterId" element={<div>Guide Chapter Detail</div>} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  vi.clearAllMocks();
  currentPreparation = mockPreparationSubject;
  mockApi.getRoadmaps.mockResolvedValue([mockSummary]);
  mockApi.getRoadmap.mockResolvedValue(mockRoadmapDetail);
  mockApi.getEvidence.mockResolvedValue({ items: [] });
  mockApi.getRoadmapSchedule.mockResolvedValue(mockSchedule);
  mockApi.getTopicDemonstrations.mockResolvedValue([]);
  mockApi.getTopicGuide.mockResolvedValue({
    sections: [
      {
        id: 1,
        topic_id: 10,
        order_index: 0,
        title: 'Producer Acks and Durability',
        body: 'When acks=all, every in-sync replica must acknowledge.',
        example: 'props.put("acks", "all");',
        common_mistake: 'Assuming acks=1 guarantees zero loss during broker failure.',
        check_question: 'What happens when min.insync.replicas is not met?',
        check_answer: 'The producer receives NotEnoughReplicasException.',
        source: 'ai',
        read_at: null,
        created_at: '2026-01-01T00:00:00',
        updated_at: '2026-01-01T00:00:00',
      },
    ],
    read_count: 0,
    drafting_available: true,
    mapped_chapters: [],
  });
  mockApi.getDomainDetail.mockResolvedValue({
    domain: 'Producer Internals',
    question_count: 45,
    attempted_questions: 25,
    answers: 30,
    correct: 19,
    accuracy_percentage: 63.3,
    missed_questions: 11,
    unreviewed_misses: 3,
    due_now: 5,
    min_answers_per_topic: 2,
    topics: [],
    questions: [],
  });
  mockApi.getReferenceSheets.mockResolvedValue([
    {
      resource_id: 11,
      name: 'Mental Model',
      roadmap_id: 1,
      roadmap_title: 'Apache Kafka Mastery',
    },
  ]);
  mockApi.getQuestions.mockResolvedValue({ items: [], total: 0 });
});

describe('PrepBench Core Learning & Planning Flows', () => {
  it('Flow A: Roadmaps → Roadmap → Topic → Study Guide → Demonstrate', async () => {
    const user = userEvent.setup();
    renderApp('/roadmaps');

    // 1. Roadmaps planning workspace
    expect(await screen.findByRole('heading', { name: 'Roadmaps', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Planning Workspace')).toBeInTheDocument();
    const roadmapCard = await screen.findByText('Apache Kafka Mastery');
    await user.click(roadmapCard);

    // 2. Roadmap Detail (Planning workspace with syllabus and phases)
    expect(await screen.findByRole('heading', { name: 'Apache Kafka Mastery', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Planning Workspace · Roadmap')).toBeInTheDocument();
    const topicLink = await screen.findByRole('link', { name: 'Kafka Producer Internals' });
    await user.click(topicLink);

    // 3. Topic Page (Mastery definition)
    expect(await screen.findByRole('heading', { name: 'Kafka Producer Internals', level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/Configure a producer for zero data loss/)).toBeInTheDocument();
    expect(screen.getByText('Mastery Definition · Producers & Consumers')).toBeInTheDocument();

    // Navigate to Study Guide
    const studyGuideBtn = screen.getByRole('button', { name: 'Study guide' });
    await user.click(studyGuideBtn);

    // 4. Study Guide Page (Learning content)
    expect(await screen.findByRole('heading', { name: 'Kafka Producer Internals', level: 1 })).toBeInTheDocument();
    expect(screen.getAllByText(/Producer Acks and Durability/).length).toBeGreaterThan(0);
    expect(screen.getByText(/When acks=all, every in-sync replica must acknowledge/)).toBeInTheDocument();

    // From study guide, navigate to Demonstrate
    const demonstrateBtn = screen.getByRole('button', { name: 'Demonstrate' });
    await user.click(demonstrateBtn);

    // 5. Demonstrate Page (Evidence proof)
    expect(await screen.findByRole('heading', { name: 'Kafka Producer Internals', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('The criterion you are meeting')).toBeInTheDocument();
    expect(screen.getByLabelText('Explain it in your own words')).toBeInTheDocument();

    const breadcrumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(breadcrumbs).getByRole('link', { name: 'Roadmaps' })).toHaveAttribute('href', '/roadmaps');
    expect(within(breadcrumbs).getByRole('link', { name: 'Kafka Producer Internals' })).toHaveAttribute('href', '/roadmaps/1/topics/10');
    expect(within(breadcrumbs).getByText('Demonstrate')).toBeInTheDocument();
  });

  it('Flow B: Study Library → Recommended → Topic → Study Guide → Demonstrate', async () => {
    const user = userEvent.setup();
    renderApp('/learn');

    // 1. Study Library learning workspace
    expect(await screen.findByRole('heading', { name: 'Study Library', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Kafka Architecture · Learning Workspace')).toBeInTheDocument();

    // Recommended panel highlights weakest area mapped to roadmap
    const recommendedPanel = await screen.findByRole('region', { name: 'Producer Internals' });
    expect(within(recommendedPanel).getByText('Weakest area')).toBeInTheDocument();
    expect(within(recommendedPanel).getByText(/63% across 30 answers in this area/)).toBeInTheDocument();

    // Continue learning panel offers immediate action
    const continuePanel = await screen.findByRole('region', { name: 'Kafka Producer Internals' });
    expect(within(continuePanel).getByRole('link', { name: 'Continue' })).toHaveAttribute(
      'href',
      '/roadmaps/1/topics/10',
    );
    expect(within(continuePanel).getByRole('link', { name: 'Demonstrate' })).toHaveAttribute(
      'href',
      '/roadmaps/1/topics/10/demonstrate',
    );

    // Click Continue to navigate to topic
    await user.click(within(continuePanel).getByRole('link', { name: 'Continue' }));

    // 2. Topic page
    expect(await screen.findByRole('heading', { name: 'Kafka Producer Internals', level: 1 })).toBeInTheDocument();
    const guideBtn = screen.getByRole('button', { name: 'Study guide' });
    await user.click(guideBtn);

    // 3. Study guide
    expect(await screen.findByRole('heading', { name: 'Kafka Producer Internals', level: 1 })).toBeInTheDocument();
    const demoBtn = screen.getByRole('button', { name: 'Demonstrate' });
    await user.click(demoBtn);

    // 4. Demonstrate page
    expect(await screen.findByLabelText('Explain it in your own words')).toBeInTheDocument();
  });

  it('Flow C: Study Library → Reference Material → Reference Sheet in Roadmap', async () => {
    const user = userEvent.setup();
    renderApp('/learn');

    // 1. Reference Material section in Study Library
    const refPanel = await screen.findByRole('region', { name: 'Your reference sheets' });
    expect(within(refPanel).getByText('Mental Model')).toBeInTheDocument();
    expect(within(refPanel).getByText('Reference Sheet')).toBeInTheDocument();

    const openBtn = within(refPanel).getByRole('link', { name: 'Open Mental Model in Apache Kafka Mastery' });
    expect(openBtn).toHaveAttribute('href', '/roadmaps/1?resource=11');

    await user.click(openBtn);

    // 2. Roadmap Detail on the resource tab
    expect(await screen.findByRole('heading', { name: 'Apache Kafka Mastery', level: 1 })).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Mental Model table' })).toBeInTheDocument();
    expect(screen.getByLabelText('Show in Study Library')).toBeChecked();
    expect(screen.getByText('Reference Material · Available in Study Library')).toBeInTheDocument();
  });

  it('Flow D: ADF Repulled 60-Topic Roadmap with 12 Phases, Multi-Sheet Reference Classification, and Aligned Study Guide', async () => {
    const user = userEvent.setup();
    const adfSubject: Subject = {
      id: 6,
      name: 'ADF',
      slug: 'adf',
      kind: 'skill',
      has_exam_profile: true,
      question_count: 60,
      display_order: 1,
      is_archived: false,
      readiness: {
        state: 'developing',
        mock_count: 2,
        pass_mark: 80,
        recent_scores: [68, 74],
        is_stale: false,
        domains: [{ domain: 'What Azure Data Factory Is', state: 'needs_work', answered: 20, score_pct: 60 }],
        weakest_domain: 'What Azure Data Factory Is',
        blockers: [],
        rules: { domain_floor_pct: 75, min_mocks_for_ready: 3, consecutive_mocks_at_pass: 2, recency_days: 14, plateau_min_mocks: 3, plateau_max_spread: 5, min_questions_per_domain: 15 },
      },
      content_packs: [{ pack_id: 'adf', pack_version: 1, latest_version: 1, title: 'Azure Data Factory' }],
    };

    currentPreparation = adfSubject;
    mockApi.getRoadmaps.mockResolvedValue([
      {
        id: 6,
        title: adfRoadmap.title,
        subject_id: 6,
        is_archived: false,
        phase_count: adfRoadmap.phases.length,
        progress: adfRoadmap.progress,
      },
    ]);
    mockApi.getRoadmap.mockResolvedValue(adfRoadmap);
    mockApi.getContentPack.mockResolvedValue(adfPack);
    mockApi.getReferenceSheets.mockResolvedValue(
      adfRoadmap.resources
        .filter((r: any) => r.purpose === 'reference')
        .map((r: any) => ({
          resource_id: r.id,
          name: r.title,
          roadmap_id: 6,
          roadmap_title: 'ADF Master Roadmap',
        }))
    );
    mockApi.getDomainDetail.mockResolvedValue({
      domain: 'What Azure Data Factory Is',
      question_count: 25,
      attempted_questions: 20,
      answers: 20,
      correct: 12,
      accuracy_percentage: 60.0,
      missed_questions: 8,
      unreviewed_misses: 2,
      due_now: 3,
      min_answers_per_topic: 3,
      topics: [],
      questions: [],
    });

    renderApp('/learn');

    // 1. Verify Study Library displays the repulled ADF data
    expect(await screen.findByRole('heading', { name: 'What Azure Data Factory Is', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('Weakest area')).toBeInTheDocument();

    // 2. Verify Continue learning shows Topic 1 in progress
    const continueEyebrow = screen.getByText('Continue learning');
    const continuePanel = continueEyebrow.closest('section')!;
    expect(within(continuePanel).getByText('1. ADF Foundations · 2h estimated')).toBeInTheDocument();
    expect(within(continuePanel).getByText('In progress')).toBeInTheDocument();

    // 3. Verify Reference Material lists the 4 reference sheets (and excludes the plan sheet)
    const refPanel = screen.getByRole('region', { name: 'Your reference sheets' });
    expect(within(refPanel).getByText('Architecture & Decision Model')).toBeInTheDocument();
    expect(within(refPanel).getByText('Suggested Resources')).toBeInTheDocument();
    expect(within(refPanel).getByText('Mental Model')).toBeInTheDocument();
    expect(within(refPanel).getByText('Study Guide Crosswalk')).toBeInTheDocument();
    expect(within(refPanel).queryByText('Portfolio & Scenarios')).not.toBeInTheDocument();

    // 4. Verify Relevant Guide renders ADF content pack with 21 chapters
    expect(screen.getByRole('heading', { name: 'Azure Data Factory', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('21 chapters · Shared study reference material')).toBeInTheDocument();

    // 5. Navigate to Roadmap Detail to verify 60 topics and multi-sheet tabs
    const viewRoadmapBtn = screen.getByRole('link', { name: 'View roadmap' });
    await user.click(viewRoadmapBtn);

    expect(await screen.findByRole('heading', { name: 'ADF Master Roadmap', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Estimated effort')).toBeInTheDocument();
    expect(screen.getByText('176h')).toBeInTheDocument();
    expect(screen.getByText('Phases')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Weekly budget')).toBeInTheDocument();
    expect(screen.getByText('12h')).toBeInTheDocument();
  }, 15000);

  it('Flow E: Topic with PR #73 Mapped Curriculum → Read Study Guide → Demonstrate', async () => {
    const user = userEvent.setup();
    const topicWithCurriculum = {
      ...mockTopic,
      mapped_chapters: [{
        pack_id: 'adf',
        pack_title: 'Azure Data Factory',
        chapter_id: 'what-it-is',
        chapter_number: 1,
        chapter_title: "What ADF is, and what it isn't",
        coverage: 'Full',
      }],
    };
    mockApi.getRoadmap.mockResolvedValue({
      ...mockRoadmapDetail,
      phases: [{
        id: 1,
        roadmap_id: 1,
        name: 'Producers & Consumers',
        order_index: 0,
        topics: [topicWithCurriculum],
      }],
    });

    renderApp('/roadmaps/1/topics/10');

    // 1. Topic page displays PR #73 mapped chapter panel
    expect(await screen.findByText("Ch 1 · What ADF is, and what it isn't")).toBeInTheDocument();
    expect(screen.getByText('Full Coverage')).toBeInTheDocument();

    const readGuideLink = screen.getByRole('link', { name: 'Read Study Guide' });
    expect(readGuideLink).toHaveAttribute('href', '/learn/guides/adf/what-it-is');

    // 2. Click Demonstrate mastery to go directly to demonstration
    const demoBtn = screen.getByRole('button', { name: 'Demonstrate mastery' });
    await user.click(demoBtn);

    expect(await screen.findByRole('heading', { name: 'Kafka Producer Internals', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('The criterion you are meeting')).toBeInTheDocument();
  });

  it('Flow F: Study Library Continue / Demonstrate Section → Demonstrate Page (with Back to Study Library)', async () => {
    const user = userEvent.setup();
    renderApp('/learn');

    // 1. From Study Library Section 6 (Demonstrate Section)
    const demoSectionBtn = await screen.findByRole('link', { name: 'Demonstrate now' });
    await user.click(demoSectionBtn);

    // 2. Demonstrate Page
    expect(await screen.findByRole('heading', { name: 'Kafka Producer Internals', level: 1 })).toBeInTheDocument();

    // Breadcrumb hierarchy is strictly Roadmaps
    const breadcrumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(breadcrumbs).getByRole('link', { name: 'Roadmaps' })).toHaveAttribute('href', '/roadmaps');
    expect(within(breadcrumbs).getByRole('link', { name: 'Kafka Producer Internals' })).toHaveAttribute('href', '/roadmaps/1/topics/10');
    expect(within(breadcrumbs).getByText('Demonstrate')).toBeInTheDocument();

    // Contextual journey action links back to Study Library
    const backBtn = screen.getByRole('link', { name: 'Back to Study Library' });
    expect(backBtn).toHaveAttribute('href', '/learn');

    // Click back to Study Library
    await user.click(backBtn);
    expect(await screen.findByRole('heading', { name: 'Study Library', level: 1 })).toBeInTheDocument();
  });
});
