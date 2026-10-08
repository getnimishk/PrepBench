// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RoadmapTopicPage } from './RoadmapTopicPage';
import { TopicDemonstratePage } from './TopicDemonstratePage';
import { TopicGuidePage } from './TopicGuidePage';

const api = {
  getRoadmap: vi.fn(),
  getTopicDemonstrations: vi.fn(),
  getTopicGuide: vi.fn(),
  getContentPack: vi.fn(),
  getEvidence: vi.fn(),
  updateRoadmapTopic: vi.fn(),
};

vi.mock('../services/api', () => ({
  getRoadmap: (...a: any[]) => api.getRoadmap(...a),
  getTopicDemonstrations: (...a: any[]) => api.getTopicDemonstrations(...a),
  getTopicGuide: (...a: any[]) => api.getTopicGuide(...a),
  getContentPack: (...a: any[]) => api.getContentPack(...a),
  getEvidence: (...a: any[]) => api.getEvidence(...a),
  updateRoadmapTopic: (...a: any[]) => api.updateRoadmapTopic(...a),
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

  it('links to built-in study guide when mapped chapters are present on topic', async () => {
    const adfTopic = topic({
      title: 'What Azure Data Factory Is',
      mapped_chapters: [{
        pack_id: 'adf',
        pack_title: 'Azure Data Factory',
        chapter_id: 'what-it-is',
        chapter_number: 1,
        chapter_title: "What ADF is, and what it isn't",
        coverage: 'Full',
      }],
    });
    api.getRoadmap.mockResolvedValueOnce({
      id: 3,
      title: 'ADF Master Roadmap',
      phases: [{ id: 1, name: '1. ADF Foundations', topics: [adfTopic] }],
    });

    renderAt('/roadmaps/3/topics/7');

    expect(await screen.findByText("Ch 1 · What ADF is, and what it isn't")).toBeInTheDocument();
    expect(screen.getByText('Full Coverage')).toBeInTheDocument();
    const readBtn = screen.getByRole('link', { name: 'Read Study Guide' });
    expect(readBtn).toHaveAttribute('href', '/learn/guides/adf/what-it-is');
    expect(screen.getByRole('button', { name: 'Notes & AI draft' })).toBeInTheDocument();
  });

  it('renders built-in study guide panel and personal notes placeholder on TopicGuidePage when mapped chapters are present', async () => {
    api.getTopicGuide.mockResolvedValueOnce({
      sections: [],
      read_count: 0,
      drafting_available: false,
      drafting_unavailable_reason: 'No AI provider.',
      mapped_chapters: [{
        pack_id: 'adf',
        pack_title: 'Azure Data Factory',
        chapter_id: 'what-it-is',
        chapter_number: 1,
        chapter_title: "What ADF is, and what it isn't",
        chapter_summary: 'ADF is an orchestrator: it moves data and tells other services what to do.',
        coverage: 'Full',
        relevant_sections: 'What ADF is; The documentation example',
        learning_evidence: 'Write a one-minute ADF explanation.',
      }],
    });

    renderAt('/roadmaps/3/topics/7/guide');

    expect(await screen.findByText('Built-in Study Guide · Azure Data Factory')).toBeInTheDocument();
    expect(screen.getByText("Chapter 1 · What ADF is, and what it isn't")).toBeInTheDocument();
    expect(screen.getByText('ADF is an orchestrator: it moves data and tells other services what to do.')).toBeInTheDocument();
    expect(screen.getByText('Personal notes & AI synthesis')).toBeInTheDocument();
    expect(screen.queryByText('No study guide yet')).not.toBeInTheDocument();
    const readLink = screen.getByRole('link', { name: 'Read Chapter 1' });
    expect(readLink).toHaveAttribute('href', '/learn/guides/adf/what-it-is');
  });
});

// ---- Phase 7: a topic's curriculum links and its evidence (WP 7.7 / 7.8) -----------------------

const WATERMARK_CHAPTER = {
  pack_id: 'adf', pack_title: 'Azure Data Factory', chapter_id: 'incremental', chapter_number: 9,
  chapter_title: 'Loading only new data', topic_number: 32, topic_title: 'Watermark Patterns', coverage: 'Partial',
};

const scenario = (id: string, number: number, chapter: string, written = true) => ({
  id, number, title: `Scenario ${id}`, outcome: '', sources: '', chapter, content: written ? {} : null,
});

const ADF_PACK = {
  pack_id: 'adf', version: 1, title: 'Azure Data Factory', summary: '', docs_url: '', source_notes: '',
  chapters: [], diagnostic_questions: [],
  scenario_levels: [{
    name: 'Level 1', about: '', scenarios: [
      scenario('late-rows', 4, 'incremental'),
      scenario('planned-one', 5, 'incremental', false),
      scenario('other-chapter', 6, 'triggers'),
    ],
  }],
};

const item = (id: string, kind: string, ref: Record<string, string>, title: string, level = 'demonstrated') => ({
  id, source: kind === 'lab_stage' ? 'learning_lab' : 'scenarios', kind, level, assessed_by: 'answer_key', title,
  demonstrates: null, basis: 'Answered the check correctly', href: '/somewhere', at: '2026-10-01T10:00:00', ref,
});

const adfRoadmap = (subjectId: number | null) => ({
  id: 6, title: 'ADF Master Roadmap', subject_id: subjectId, linked_pack_id: 'adf', linked_pack_version: 1,
  phases: [{ id: 1, name: '5. Incremental loads', topics: [topic({ id: 7, title: 'Watermark Patterns', mapped_chapters: [WATERMARK_CHAPTER] })] }],
});

describe('a topic\'s curriculum links and evidence', () => {
  beforeEach(() => {
    api.getContentPack.mockResolvedValue(ADF_PACK);
    api.getEvidence.mockResolvedValue({
      items: [
        item('a', 'scenario_check', { pack_id: 'adf', scenario_id: 'late-rows', check: '0' }, 'Late rows'),
        item('b', 'scenario_check', { pack_id: 'adf', scenario_id: 'other-chapter', check: '0' }, 'Another chapter'),
        item('c', 'lab_stage', { track: 'watermark', run: '1', stage: 'apply' }, 'Watermark run'),
        item('d', 'lab_stage', { track: 'triggers', run: '1', stage: 'apply' }, 'Triggers run'),
        item('e', 'scenario_check', { pack_id: 'adls', scenario_id: 'late-rows', check: '0' }, 'Other pack'),
      ],
    });
  });

  it('links the mapped chapter, the scenarios written for it, and the experiments for its topic number', async () => {
    api.getRoadmap.mockResolvedValue(adfRoadmap(6));
    renderAt('/roadmaps/6/topics/7');

    expect(await screen.findByRole('link', { name: 'Ch 9 · Loading only new data' })).toHaveAttribute('href', '/learn/guides/adf/incremental');
    expect(screen.getByText('Partial Coverage')).toBeInTheDocument();
    // The pack is read at the version the preparation pins.
    expect(api.getContentPack).toHaveBeenCalledWith('adf', 1);
    expect(await screen.findByRole('link', { name: 'Scenario 4 · Scenario late-rows' })).toHaveAttribute('href', '/scenarios/adf/late-rows');
    // A planned (unwritten) scenario and another chapter's scenario are not linked.
    expect(screen.queryByText(/Scenario planned-one/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Scenario other-chapter/)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Explore in lab' }).nextElementSibling).toHaveTextContent('Watermark & Transient Failure');
    expect(screen.getAllByRole('link', { name: 'Watermark & Transient Failure' })[0]).toHaveAttribute('href', '/lab/adf/watermark');
    expect(screen.queryByRole('link', { name: 'Trigger Behaviour' })).not.toBeInTheDocument();
  });

  it('shows only its own preparation\'s evidence from the linked work, read-only', async () => {
    api.getRoadmap.mockResolvedValue(adfRoadmap(6));
    renderAt('/roadmaps/6/topics/7');

    const section = await screen.findByRole('region', { name: 'Evidence for this topic' });
    expect(await within(section).findByText('Late rows')).toBeInTheDocument();
    // Lab work is titled from the lab's own registry, as on the Evidence page.
    expect(within(section).getByRole('link', { name: 'Watermark & Transient Failure' })).toBeInTheDocument();
    expect(within(section).queryByText('Another chapter')).not.toBeInTheDocument();
    expect(within(section).queryByText(/Trigger Behaviour/)).not.toBeInTheDocument();
    expect(within(section).queryByText('Other pack')).not.toBeInTheDocument();
    expect(api.getEvidence).toHaveBeenCalledWith(6);
    expect(api.getEvidence).not.toHaveBeenCalledWith(null);
    // Evidence never moves the topic: the status is still the one it had.
    expect(api.updateRoadmapTopic).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 2, name: 'Not started' })).toBeInTheDocument();
  });

  it('reads no evidence for a roadmap linked to no preparation', async () => {
    api.getRoadmap.mockResolvedValue(adfRoadmap(null));
    renderAt('/roadmaps/6/topics/7');

    const section = await screen.findByRole('region', { name: 'Evidence for this topic' });
    expect(within(section).getByText(/not linked to a preparation/)).toBeInTheDocument();
    expect(api.getEvidence).not.toHaveBeenCalled();
  });

  it('says evidence could not be read rather than showing none', async () => {
    api.getRoadmap.mockResolvedValue(adfRoadmap(6));
    api.getEvidence.mockRejectedValue(UNREACHABLE);
    renderAt('/roadmaps/6/topics/7');
    const section = await screen.findByRole('region', { name: 'Evidence for this topic' });
    expect(await within(section).findByText(/could not be read/)).toBeInTheDocument();
  });

  it('links nothing for a topic with no mapped chapter -- never by its position', async () => {
    api.getRoadmap.mockResolvedValue({ ...adfRoadmap(6), phases: [{ id: 1, name: 'P', topics: [topic({ id: 7, title: '32', mapped_chapters: [] })] }] });
    renderAt('/roadmaps/6/topics/7');
    expect(await screen.findByRole('button', { name: 'Study guide' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Evidence for this topic' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Watermark/ })).not.toBeInTheDocument();
    expect(api.getEvidence).not.toHaveBeenCalled();
  });
});
