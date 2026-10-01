// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { StudyLibraryPage, chooseRoadmap, topicToContinue } from './StudyLibraryPage';
import type { RoadmapDetail, RoadmapSummary } from '../types/roadmap';
import type { Subject } from '../types/subject';

/**
 * The Study Library: what to learn next, and how to prove it has been learnt.
 *
 * Every figure here is the learner's own -- the area their readiness names as
 * weakest, the topic their roadmap leaves in progress. The page used to be two
 * links to screens already in the rail, so what these hold is that it says
 * something, and that it never says more than the data supports.
 */

const mockGetRoadmaps = vi.fn();
const mockGetRoadmap = vi.fn();
const mockGetDomainDetail = vi.fn();
const mockGetContentPack = vi.fn();
const mockGetReferenceSheets = vi.fn();
const mockPreparation = vi.fn();

vi.mock('../services/api', () => ({
  getRoadmaps: (...a: any[]) => mockGetRoadmaps(...a),
  getRoadmap: (...a: any[]) => mockGetRoadmap(...a),
  getDomainDetail: (...a: any[]) => mockGetDomainDetail(...a),
  getContentPack: (...a: any[]) => mockGetContentPack(...a),
  getReferenceSheets: (...a: any[]) => mockGetReferenceSheets(...a),
}));

vi.mock('../context/PreparationContext', () => ({
  usePreparation: () => mockPreparation(),
}));

const progress = (over: Partial<RoadmapDetail['progress']> = {}) => ({
  total_topics: 10, not_started_count: 6, in_progress_count: 1, completed_count: 3, skipped_count: 0,
  completion_percentage: 30, hours_percentage: null, total_estimated_hours: 40, completed_estimated_hours: 12,
  ...over,
});

const summary = (over: Partial<RoadmapSummary> = {}): RoadmapSummary => ({
  id: 4, title: 'PSM I syllabus', subject_id: 1, is_archived: false, updated_at: '2026-09-01T00:00:00',
  phase_count: 2, progress: progress(), ...over,
});

const topic = (over: Partial<RoadmapDetail['phases'][number]['topics'][number]> = {}) => ({
  id: 11, roadmap_id: 4, phase_id: 1, title: 'Sprint Planning', order_index: 0,
  status: 'not_started', progress_percentage: 0, estimated_hours: 3,
  learning_objective: 'Plan a Sprint from the Product Goal, with the Developers sizing the work.',
  success_criterion: 'Run one planning session end to end.', notes: null, evidence_notes: null,
  ...over,
}) as RoadmapDetail['phases'][number]['topics'][number];

const detail = (over: Partial<RoadmapDetail> = {}): RoadmapDetail => ({
  ...summary(),
  phases: [
    { id: 1, roadmap_id: 4, name: 'Foundations', order_index: 0, topics: [topic()] },
    { id: 2, roadmap_id: 4, name: 'Execution', order_index: 1, topics: [topic({ id: 12, phase_id: 2, title: 'Sprint Review', order_index: 0 })] },
  ],
  resources: [],
  ...over,
}) as RoadmapDetail;

const PSM = {
  id: 1, name: 'Scrum / PSM I', kind: 'certification', has_exam_profile: true, question_count: 709,
  readiness: {
    state: 'almost_there', mock_count: 6, pass_mark: 85, recent_scores: [83, 88, 93], is_stale: false,
    domains: [{ domain: 'Scrum Events', state: 'needs_work', answered: 40, score_pct: 63 }],
    weakest_domain: 'Scrum Events', blockers: [], rules: { domain_floor_pct: 80 },
  },
} as unknown as Subject;

const AREA = {
  domain: 'Scrum Events', question_count: 120, attempted_questions: 40, answers: 63, correct: 40,
  accuracy_percentage: 63.4, missed_questions: 17, unreviewed_misses: 4, due_now: 9,
  min_answers_per_topic: 3, topics: [], questions: [],
};

const renderPage = () => render(<MemoryRouter><StudyLibraryPage /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  mockPreparation.mockReturnValue({ selected: PSM, loading: false });
  mockGetRoadmaps.mockResolvedValue([summary()]);
  mockGetRoadmap.mockResolvedValue(detail());
  mockGetDomainDetail.mockResolvedValue(AREA);
  mockGetReferenceSheets.mockResolvedValue([]);
});

describe('StudyLibraryPage', () => {
  it('names the area to study from the preparation’s own readiness, with its figures', async () => {
    renderPage();

    const panel = await screen.findByRole('region', { name: 'Scrum Events' });
    expect(mockGetDomainDetail).toHaveBeenCalledWith(1, 'Scrum Events');
    expect(within(panel).getByText('Weakest area')).toBeInTheDocument();
    expect(await within(panel).findByText(/63% across 63 answers in this area, under the 80% floor/)).toBeInTheDocument();
    expect(within(panel).getByText('misses to read')).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'Start learning' }))
      .toHaveAttribute('href', '/analytics/area?subject=1&domain=Scrum%20Events');
    expect(within(panel).getByRole('link', { name: 'Practise instead' }))
      .toHaveAttribute('href', '/exam-setup?kind=drill&subject=1&domain=Scrum%20Events');
  });

  it('calls the lowest area the lowest area when it is not under the floor', async () => {
    mockPreparation.mockReturnValue({
      selected: {
        ...PSM,
        readiness: { ...PSM.readiness, domains: [{ domain: 'Scrum Events', state: 'developing', answered: 40, score_pct: 84 }] },
      },
      loading: false,
    });
    renderPage();

    const panel = await screen.findByRole('region', { name: 'Scrum Events' });
    expect(within(panel).getByText('Lowest area')).toBeInTheDocument();
    expect(within(panel).queryByText('Weakest area')).not.toBeInTheDocument();
    expect(await within(panel).findByText(/63% across 63 answers in this area — the clearest thing/)).toBeInTheDocument();
  });

  it('says there is nothing to recommend rather than inventing an area', async () => {
    mockPreparation.mockReturnValue({
      selected: { ...PSM, readiness: { ...PSM.readiness, mock_count: 0, weakest_domain: null } },
      loading: false,
    });
    renderPage();

    const panel = await screen.findByRole('region', { name: 'Nothing to recommend yet' });
    expect(within(panel).getByText(/Sit a full mock and the area it shows weakest is named here/)).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'Take a mock' })).toHaveAttribute('href', '/exam-setup?kind=mock&subject=1');
    expect(mockGetDomainDetail).not.toHaveBeenCalled();
  });

  it('continues the topic in progress, with both ways on', async () => {
    mockGetRoadmap.mockResolvedValue(detail({
      phases: [
        { id: 1, roadmap_id: 4, name: 'Foundations', order_index: 0, topics: [topic({ id: 11, status: 'completed', progress_percentage: 100 })] },
        { id: 2, roadmap_id: 4, name: 'Execution', order_index: 1, topics: [topic({ id: 12, phase_id: 2, title: 'Sprint Review', status: 'in_progress', progress_percentage: 40 })] },
      ],
    } as Partial<RoadmapDetail>));
    renderPage();

    const panel = await screen.findByRole('region', { name: 'Sprint Review' });
    expect(within(panel).getByText('In progress')).toBeInTheDocument();
    expect(within(panel).getByText('Execution · 3h estimated')).toBeInTheDocument();
    expect(within(panel).getByText('40% complete')).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'Continue' })).toHaveAttribute('href', '/roadmaps/4/topics/12');
    expect(within(panel).getByRole('link', { name: 'Demonstrate' })).toHaveAttribute('href', '/roadmaps/4/topics/12/demonstrate');
  });

  it('shows the roadmap’s progress and its first phases', async () => {
    renderPage();

    const panel = await screen.findByRole('region', { name: 'PSM I syllabus' });
    expect(within(panel).getByText('3 / 10 topics · 2 phases · 40h planned')).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'Foundations: 0 of 1 topics complete' })).toHaveAttribute('href', '/roadmaps/4');
    expect(within(panel).getByRole('link', { name: 'View roadmap' })).toHaveAttribute('href', '/roadmaps/4');
  });

  it('says a roadmap belonging to no preparation is not this preparation’s', async () => {
    mockGetRoadmaps.mockResolvedValue([summary({ subject_id: null })]);
    renderPage();

    const panel = await screen.findByRole('region', { name: 'PSM I syllabus' });
    expect(within(panel).getByText(/not linked to Scrum \/ PSM I/)).toBeInTheDocument();
  });

  it('invites a first roadmap rather than drawing an empty plan', async () => {
    mockGetRoadmaps.mockResolvedValue([]);
    renderPage();

    const panel = await screen.findByRole('region', { name: 'No roadmap yet' });
    expect(within(panel).getByText(/one row per topic/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Nothing in progress' })).toHaveTextContent(/Topics come from a roadmap/);
    expect(mockGetRoadmap).not.toHaveBeenCalled();
  });

  it('says the roadmap could not be read rather than calling it absent, and retries', async () => {
    const user = userEvent.setup();
    mockGetRoadmaps.mockRejectedValueOnce({ isAxiosError: true, request: {} }).mockResolvedValue([summary()]);
    renderPage();

    expect(await screen.findByText(/Could not load your roadmaps/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'No roadmap yet' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('region', { name: 'PSM I syllabus' })).toBeInTheDocument();
  });
});

describe('StudyLibraryPage: Guide panel', () => {
  it('adds nothing for a preparation with no content packs', async () => {
    renderPage();
    await screen.findByRole('region', { name: 'PSM I syllabus' });
    expect(mockGetContentPack).not.toHaveBeenCalled();
    expect(screen.queryByText(/chapters/)).not.toBeInTheDocument();
  });

  it('lists an attached pack’s chapters, at the pinned version, with a way to read each one', async () => {
    mockPreparation.mockReturnValue({
      selected: {
        ...PSM,
        content_packs: [{ pack_id: 'adf', pack_version: 1, latest_version: 2, title: 'Azure Data Factory' }],
      },
      loading: false,
    });
    mockGetContentPack.mockResolvedValue({
      pack_id: 'adf', version: 1, title: 'Azure Data Factory', summary: 's',
      docs_url: 'https://example.test', source_notes: 'n',
      chapters: [{ id: 'what-it-is', title: 'What it is', summary: 'sum', sources: '§1', blocks: [], practice_links: [] }],
      scenario_levels: [], diagnostic_questions: [],
    });
    renderPage();

    expect(await screen.findByRole('region', { name: 'Azure Data Factory' })).toBeInTheDocument();
    expect(mockGetContentPack).toHaveBeenCalledWith('adf', 1);
    expect(screen.getByRole('link', { name: 'Read chapter 1: What it is' })).toHaveAttribute('href', '/learn/guides/adf/what-it-is');
    expect(screen.getByRole('link', { name: 'All chapters' })).toHaveAttribute('href', '/learn/guides/adf');
  });
});

describe('StudyLibraryPage: Your reference sheets', () => {
  const sheet = (id: number, name: string, roadmapId = 4, roadmapTitle = 'PSM I syllabus') => ({
    resource_id: id, name, roadmap_id: roadmapId, roadmap_title: roadmapTitle,
  });

  it('lists the preparation’s reference sheets with a link to each one’s Roadmaps tab', async () => {
    mockGetReferenceSheets.mockResolvedValue([sheet(11, 'Mental Model'), sheet(12, 'Framework Comparison', 5, 'Other plan')]);
    renderPage();

    const panel = await screen.findByRole('region', { name: 'Your reference sheets' });
    expect(mockGetReferenceSheets).toHaveBeenCalledWith(1);
    expect(within(panel).getByText('Mental Model')).toBeInTheDocument();
    expect(within(panel).getByText('PSM I syllabus')).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'Open Mental Model in PSM I syllabus' }))
      .toHaveAttribute('href', '/roadmaps/4?resource=11');
    expect(within(panel).getByRole('link', { name: 'Open Framework Comparison in Other plan' }))
      .toHaveAttribute('href', '/roadmaps/5?resource=12');
  });

  it('adds no panel when the preparation has no reference sheets', async () => {
    renderPage();
    await screen.findByRole('region', { name: 'Scrum Events' });
    await waitFor(() => expect(mockGetReferenceSheets).toHaveBeenCalled());
    expect(screen.queryByRole('region', { name: 'Your reference sheets' })).not.toBeInTheDocument();
    expect(screen.queryByText('Your reference sheets')).not.toBeInTheDocument();
  });

  it('asks for nothing when no preparation is selected', async () => {
    mockPreparation.mockReturnValue({ selected: null, loading: false });
    renderPage();
    await screen.findByText('Learn');
    expect(mockGetReferenceSheets).not.toHaveBeenCalled();
  });

  it('says the sheets could not be loaded, and retries', async () => {
    const user = userEvent.setup();
    mockGetReferenceSheets.mockRejectedValueOnce(new Error('network'));
    renderPage();

    const panel = await screen.findByRole('region', { name: 'Your reference sheets' });
    expect(within(panel).getByText(/Could not load your reference sheets/)).toBeInTheDocument();

    mockGetReferenceSheets.mockResolvedValue([sheet(11, 'Mental Model')]);
    await user.click(within(panel).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Mental Model')).toBeInTheDocument();
  });

  it('shows only the latest preparation’s sheets when an earlier answer arrives late', async () => {
    const OTHER = { ...PSM, id: 2, name: 'Databricks' } as unknown as Subject;
    let releaseFirst: (v: unknown) => void = () => undefined;
    mockGetReferenceSheets.mockImplementation((id: number) => (
      id === 1
        ? new Promise((resolve) => { releaseFirst = resolve; })
        : Promise.resolve([sheet(21, 'Delta Notes', 9, 'Lakehouse plan')])
    ));

    const view = renderPage();
    await waitFor(() => expect(mockGetReferenceSheets).toHaveBeenCalledWith(1));

    // Switch preparation while the first answer is still outstanding.
    mockPreparation.mockReturnValue({ selected: OTHER, loading: false });
    view.rerender(<MemoryRouter><StudyLibraryPage /></MemoryRouter>);
    expect(await screen.findByText('Delta Notes')).toBeInTheDocument();

    // The first preparation's answer now lands, late.
    releaseFirst([sheet(11, 'Mental Model')]);
    await new Promise((r) => setTimeout(r, 20));

    expect(screen.getByText('Delta Notes')).toBeInTheDocument();
    expect(screen.queryByText('Mental Model')).not.toBeInTheDocument();
  });
});

describe('chooseRoadmap', () => {
  it('prefers this preparation’s own roadmap over one belonging to none', () => {
    const own = summary({ id: 1, subject_id: 7 });
    const orphan = summary({ id: 2, subject_id: null });
    expect(chooseRoadmap([orphan, own], 7)).toEqual({ roadmap: own, linked: true });
  });

  it('never takes another preparation’s roadmap', () => {
    const other = summary({ id: 3, subject_id: 9 });
    expect(chooseRoadmap([other], 7)).toBeNull();
  });

  it('falls back to a roadmap with no preparation, and says it is not linked', () => {
    const orphan = summary({ id: 2, subject_id: null });
    expect(chooseRoadmap([orphan], 7)).toEqual({ roadmap: orphan, linked: false });
  });

  it('prefers the one with work under way, then the one touched most recently', () => {
    const idle = summary({ id: 1, subject_id: 7, updated_at: '2026-09-09T00:00:00', progress: progress({ in_progress_count: 0, completed_count: 0 }) });
    const started = summary({ id: 2, subject_id: 7, updated_at: '2026-01-01T00:00:00', progress: progress({ in_progress_count: 2 }) });
    expect(chooseRoadmap([idle, started], 7)?.roadmap.id).toBe(2);

    const older = summary({ id: 3, subject_id: 7, updated_at: '2026-01-01T00:00:00', progress: progress({ in_progress_count: 0, completed_count: 0 }) });
    const newer = summary({ id: 4, subject_id: 7, updated_at: '2026-09-09T00:00:00', progress: progress({ in_progress_count: 0, completed_count: 0 }) });
    expect(chooseRoadmap([older, newer], 7)?.roadmap.id).toBe(4);
  });

  it('ignores archived roadmaps', () => {
    expect(chooseRoadmap([summary({ id: 5, subject_id: 7, is_archived: true })], 7)).toBeNull();
  });
});

describe('topicToContinue', () => {
  it('takes the topic in progress before any not started', () => {
    const d = detail({
      phases: [
        { id: 1, roadmap_id: 4, name: 'Foundations', order_index: 0, topics: [topic({ id: 11, status: 'not_started' })] },
        { id: 2, roadmap_id: 4, name: 'Execution', order_index: 1, topics: [topic({ id: 12, phase_id: 2, status: 'in_progress' })] },
      ],
    } as Partial<RoadmapDetail>);
    expect(topicToContinue(d)?.topic.id).toBe(12);
  });

  it('otherwise takes the first not started, in plan order', () => {
    const d = detail({
      phases: [
        { id: 2, roadmap_id: 4, name: 'Execution', order_index: 1, topics: [topic({ id: 12, phase_id: 2, status: 'not_started' })] },
        { id: 1, roadmap_id: 4, name: 'Foundations', order_index: 0, topics: [topic({ id: 11, status: 'not_started' })] },
      ],
    } as Partial<RoadmapDetail>);
    expect(topicToContinue(d)?.topic.id).toBe(11);
  });

  it('has nothing to continue when every topic is finished', () => {
    const d = detail({
      phases: [{ id: 1, roadmap_id: 4, name: 'Foundations', order_index: 0, topics: [topic({ status: 'completed' })] }],
    } as Partial<RoadmapDetail>);
    expect(topicToContinue(d)).toBeNull();
  });
});
