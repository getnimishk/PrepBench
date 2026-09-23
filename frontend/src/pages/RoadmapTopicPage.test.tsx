// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RoadmapTopicPage } from './RoadmapTopicPage';
import { TopicDemonstratePage } from './TopicDemonstratePage';
import { TopicGuidePage } from './TopicGuidePage';

const api = {
  getRoadmap: vi.fn(),
  getTopicDemonstrations: vi.fn(),
  getTopicGuide: vi.fn(),
};

vi.mock('../services/api', () => ({
  getRoadmap: (...a: any[]) => api.getRoadmap(...a),
  getTopicDemonstrations: (...a: any[]) => api.getTopicDemonstrations(...a),
  getTopicGuide: (...a: any[]) => api.getTopicGuide(...a),
  updateRoadmapTopic: vi.fn(),
  demonstrateTopic: vi.fn(),
}));

const UNREACHABLE = { isAxiosError: true, request: {} };

const topic = (over: object = {}) => ({
  id: 7, title: 'Sprint Events', status: 'not_started', progress_percentage: 0,
  learning_objective: 'Know what each event is for.', success_criteria: 'Name the five events.',
  estimated_hours: 2, evidence_notes: null, ...over,
});

const roadmap = (over: object = {}) => ({
  id: 3, title: 'PSM I plan', phases: [{ id: 1, name: 'Scrum Theory', topics: [topic(over)] }],
});

const demonstration = {
  id: 1, topic_id: 7, response_text: 'Planning, Daily Scrum, Review, Retrospective.', self_grade: 'yes',
  created_at: '2026-09-01T10:00:00', next_recheck_at: '2099-01-01T00:00:00',
};

const renderAt = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/roadmaps/:roadmapId/topics/:topicId" element={<RoadmapTopicPage />} />
      <Route path="/roadmaps/:roadmapId/topics/:topicId/demonstrate" element={<TopicDemonstratePage />} />
      <Route path="/roadmaps/:roadmapId/topics/:topicId/guide" element={<TopicGuidePage />} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.getRoadmap.mockResolvedValue(roadmap());
  api.getTopicDemonstrations.mockResolvedValue([]);
  api.getTopicGuide.mockResolvedValue({ topic_id: 7, sections: [], drafting_available: false, drafting_unavailable_reason: 'No AI provider.' });
});

describe('RoadmapTopicPage', () => {
  it('does not present a completion with no demonstration behind it as earned', async () => {
    api.getRoadmap.mockResolvedValue(roadmap({ status: 'completed', progress_percentage: 100 }));
    renderAt('/roadmaps/3/topics/7');

    expect(await screen.findByText(/Marked complete without a demonstration/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Demonstrate' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Demonstrate again' })).not.toBeInTheDocument();
  });

  it('says nothing of the kind once a demonstration exists', async () => {
    api.getRoadmap.mockResolvedValue(roadmap({ status: 'completed', progress_percentage: 100 }));
    api.getTopicDemonstrations.mockResolvedValue([demonstration]);
    renderAt('/roadmaps/3/topics/7');

    expect(await screen.findByRole('button', { name: 'Demonstrate again' })).toBeInTheDocument();
    expect(screen.queryByText(/Marked complete without a demonstration/)).not.toBeInTheDocument();
  });

  it('says why a topic did not load, and loads it on retry', async () => {
    const user = userEvent.setup();
    api.getRoadmap.mockRejectedValueOnce(UNREACHABLE);
    renderAt('/roadmaps/3/topics/7');

    expect(await screen.findByText(/Could not load this topic\. Could not reach the PrepBench server\..*Nothing was changed\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { name: 'Sprint Events', level: 1 })).toBeInTheDocument();
  });
});

describe('TopicDemonstratePage and TopicGuidePage when they cannot load', () => {
  it('the demonstration page says why, and loads on retry', async () => {
    const user = userEvent.setup();
    api.getRoadmap.mockRejectedValueOnce(UNREACHABLE);
    renderAt('/roadmaps/3/topics/7/demonstrate');

    expect(await screen.findByText(/Could not load this topic\..*Nothing was changed\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByLabelText('Explain it in your own words')).toBeInTheDocument();
  });

  it('the study guide says why, and loads on retry', async () => {
    const user = userEvent.setup();
    api.getTopicGuide.mockRejectedValueOnce(UNREACHABLE);
    renderAt('/roadmaps/3/topics/7/guide');

    expect(await screen.findByText(/Could not load this study guide\..*Nothing was changed\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('No study guide yet')).toBeInTheDocument();
  });
});
