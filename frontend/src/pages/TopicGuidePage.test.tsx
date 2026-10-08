// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TopicGuidePage } from './TopicGuidePage';

const api = {
  getRoadmap: vi.fn(), getTopicGuide: vi.fn(), updateTopicGuideSection: vi.fn(), addTopicGuideSection: vi.fn(),
};
vi.mock('../services/api', () => ({
  getRoadmap: (...a: unknown[]) => api.getRoadmap(...a),
  getTopicGuide: (...a: unknown[]) => api.getTopicGuide(...a),
  updateTopicGuideSection: (...a: unknown[]) => api.updateTopicGuideSection(...a),
  addTopicGuideSection: (...a: unknown[]) => api.addTopicGuideSection(...a),
  deleteTopicGuideSection: vi.fn(),
  draftTopicGuide: vi.fn(),
  setTopicGuideSectionRead: vi.fn(() => Promise.resolve({})),
}));

const section = (over: object) => ({
  id: 41, topic_id: 7, order_index: 0, title: 'What an agent is', body: 'A loop that acts.', example: null,
  common_mistake: null, check_question: null, check_answer: null, source: 'learner', generated_by: null,
  edited_at: null, read_at: null, created_at: '2026-10-01T00:00:00', updated_at: '2026-10-01T00:00:00', ...over,
});

const guide = (sections: object[]) => ({ sections, read_count: 0, drafting_available: false, drafting_unavailable_reason: 'No AI provider.', mapped_chapters: [] });

const renderPage = () => render(
  <MemoryRouter initialEntries={['/roadmaps/5/topics/7/guide']}>
    <Routes>
      <Route path="/roadmaps/:roadmapId/topics/:topicId/guide" element={<TopicGuidePage />} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.getRoadmap.mockResolvedValue({
    id: 5, title: 'Agentic AI', phases: [{ id: 1, name: 'Agents', topics: [{ id: 7, title: 'Agents', status: 'not_started', progress_percentage: 0 }] }],
  });
});

describe('TopicGuidePage -- who wrote a section (Phase 7, D2)', () => {
  it.each([
    [{ source: 'course' }, 'Course lesson'],
    [{ source: 'course', edited_at: '2026-10-02T00:00:00' }, 'Course lesson, edited by you'],
    [{ source: 'learner' }, 'Written by you'],
  ])('labels %o as "%s"', async (over, label) => {
    api.getTopicGuide.mockResolvedValue(guide([section(over)]));
    renderPage();
    expect(await screen.findByText(label)).toBeInTheDocument();
  });

  it('keeps a course lesson a course lesson when its text is edited -- source is not sent', async () => {
    const user = userEvent.setup();
    api.getTopicGuide.mockResolvedValue(guide([section({ source: 'course' })]));
    api.updateTopicGuideSection.mockResolvedValue(section({ source: 'course', edited_at: '2026-10-02T00:00:00' }));
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('checkbox', { name: /This is a course lesson/ })).toBeChecked();
    await user.type(screen.getByLabelText(/Explanation/), ' More.');
    await user.click(screen.getByRole('button', { name: 'Save section' }));

    await waitFor(() => expect(api.updateTopicGuideSection).toHaveBeenCalled());
    const payload = api.updateTopicGuideSection.mock.calls[0][3];
    expect(payload).not.toHaveProperty('source');
    expect(payload.body).toBe('A loop that acts. More.');
  });

  it('lets the learner confirm one section is a course lesson, sending only that change of label', async () => {
    const user = userEvent.setup();
    api.getTopicGuide.mockResolvedValue(guide([section({ source: 'learner' })]));
    api.updateTopicGuideSection.mockResolvedValue(section({ source: 'course' }));
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('checkbox', { name: /This is a course lesson/ }));
    await user.click(screen.getByRole('button', { name: 'Save section' }));

    await waitFor(() => expect(api.updateTopicGuideSection).toHaveBeenCalledWith(5, 7, 41, expect.objectContaining({ source: 'course' })));
  });

  it('never offers to relabel an AI draft', async () => {
    const user = userEvent.setup();
    api.getTopicGuide.mockResolvedValue(guide([section({ source: 'ai', generated_by: 'ollama' })]));
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    expect(screen.queryByRole('checkbox', { name: /This is a course lesson/ })).not.toBeInTheDocument();
    expect(screen.getByText(/drafted by AI/)).toBeInTheDocument();
  });
});
