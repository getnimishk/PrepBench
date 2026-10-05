// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TopicDemonstratePage } from './TopicDemonstratePage';
import type { RoadmapDetail } from '../types/roadmap';

const mockApi = {
  getRoadmap: vi.fn(),
  getTopicDemonstrations: vi.fn(),
  getQuestions: vi.fn(),
  demonstrateTopic: vi.fn(),
};

vi.mock('../services/api', () => ({
  getRoadmap: (...a: any[]) => mockApi.getRoadmap(...a),
  getTopicDemonstrations: (...a: any[]) => mockApi.getTopicDemonstrations(...a),
  getQuestions: (...a: any[]) => mockApi.getQuestions(...a),
  demonstrateTopic: (...a: any[]) => mockApi.demonstrateTopic(...a),
}));

vi.mock('../context/PreparationContext', () => ({
  usePreparation: () => ({
    selected: { id: 1, name: 'Kafka Architecture' },
    preparations: [{ id: 1, name: 'Kafka Architecture' }],
    loading: false,
  }),
}));

const mockRoadmap: RoadmapDetail = {
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
      topics: [
        {
          id: 10,
          roadmap_id: 1,
          phase_id: 1,
          order_index: 0,
          title: 'Kafka Producer Internals',
          learning_objective: 'Understand batching, acks, and linger.ms in producer configurations.',
          success_criteria: 'Configure a producer for zero data loss and explain each setting unprompted.',
          estimated_hours: 4,
          status: 'not_started',
          progress_percentage: 0,
          started_at: null,
          completed_at: null,
          evidence_notes: null,
          mapped_chapters: [],
        },
      ],
    },
  ],
  resources: [],
  sheets: [{ name: 'Syllabus', kind: 'syllabus' }],
};

const renderPage = (initialEntries: (string | { pathname: string; state?: any; search?: string })[] = ['/roadmaps/1/topics/10/demonstrate']) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/roadmaps/:roadmapId/topics/:topicId/demonstrate" element={<TopicDemonstratePage />} />
        <Route path="/roadmaps" element={<div>Roadmaps List</div>} />
        <Route path="/roadmaps/:roadmapId" element={<div>Roadmap Detail</div>} />
        <Route path="/roadmaps/:roadmapId/topics/:topicId" element={<div>Topic Detail</div>} />
        <Route path="/learn" element={<div>Study Library Page</div>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getRoadmap.mockResolvedValue(mockRoadmap);
  mockApi.getTopicDemonstrations.mockResolvedValue([]);
  mockApi.getQuestions.mockResolvedValue({ items: [], total: 0 });
});

describe('TopicDemonstratePage breadcrumbs and navigation', () => {
  it('standardizes breadcrumbs hierarchy to Roadmaps → Roadmap → Topic → Demonstrate', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Kafka Producer Internals', level: 1 })).toBeInTheDocument();

    const breadcrumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(breadcrumbs).toBeInTheDocument();

    // 1. Root is Roadmaps and links to /roadmaps
    const rootLink = within(breadcrumbs).getByRole('link', { name: 'Roadmaps' });
    expect(rootLink).toHaveAttribute('href', '/roadmaps');

    // 2. Roadmap link
    const roadmapLink = within(breadcrumbs).getByRole('link', { name: 'Apache Kafka Mastery' });
    expect(roadmapLink).toHaveAttribute('href', '/roadmaps/1');

    // 3. Topic link
    const topicLink = within(breadcrumbs).getByRole('link', { name: 'Kafka Producer Internals' });
    expect(topicLink).toHaveAttribute('href', '/roadmaps/1/topics/10');

    // 4. Current leaf is Demonstrate (plain text, not a link)
    expect(within(breadcrumbs).getByText('Demonstrate')).toBeInTheDocument();
    expect(within(breadcrumbs).queryByRole('link', { name: 'Demonstrate' })).not.toBeInTheDocument();

    // Contextual Back to Study Library should NOT be shown when not entered from Study Library
    expect(screen.queryByRole('link', { name: 'Back to Study Library' })).not.toBeInTheDocument();
  });

  it('renders contextual "Back to Study Library" action when entered with state from: /learn', async () => {
    renderPage([{ pathname: '/roadmaps/1/topics/10/demonstrate', state: { from: '/learn' } }]);

    expect(await screen.findByRole('heading', { name: 'Kafka Producer Internals', level: 1 })).toBeInTheDocument();

    // Breadcrumbs root STILL remains Roadmaps (structural hierarchy preserved)
    const breadcrumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(breadcrumbs).getByRole('link', { name: 'Roadmaps' })).toHaveAttribute('href', '/roadmaps');

    // Contextual journey action appears in PageHead actions
    const backBtn = screen.getByRole('link', { name: 'Back to Study Library' });
    expect(backBtn).toBeInTheDocument();
    expect(backBtn).toHaveAttribute('href', '/learn');
  });

  it('renders contextual "Back to Study Library" action when query param ?from=learn is present', async () => {
    renderPage(['/roadmaps/1/topics/10/demonstrate?from=learn']);

    expect(await screen.findByRole('heading', { name: 'Kafka Producer Internals', level: 1 })).toBeInTheDocument();

    const backBtn = screen.getByRole('link', { name: 'Back to Study Library' });
    expect(backBtn).toBeInTheDocument();
    expect(backBtn).toHaveAttribute('href', '/learn');
  });
});
