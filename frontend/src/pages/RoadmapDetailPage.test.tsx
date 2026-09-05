// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RoadmapDetailPage } from './RoadmapDetailPage';
import { RoadmapDetail, RoadmapSchedule, RoadmapTopic } from '../types/roadmap';

const mockGetRoadmap = vi.fn();
const mockGetRoadmapSchedule = vi.fn();
const mockUpdateRoadmapTopic = vi.fn();
const mockUpdateRoadmap = vi.fn();

vi.mock('../services/api', () => ({
  getRoadmap: (...args: any[]) => mockGetRoadmap(...args),
  getRoadmapSchedule: (...args: any[]) => mockGetRoadmapSchedule(...args),
  updateRoadmapTopic: (...args: any[]) => mockUpdateRoadmapTopic(...args),
  updateRoadmap: (...args: any[]) => mockUpdateRoadmap(...args),
}));

function makeTopic(id: number, overrides: Partial<RoadmapTopic> = {}): RoadmapTopic {
  return {
    id,
    roadmap_id: 1,
    phase_id: 1,
    order_index: id,
    title: `Topic ${id}`,
    learning_objective: null,
    success_criteria: null,
    estimated_hours: 3,
    status: 'not_started',
    progress_percentage: 0,
    started_at: null,
    completed_at: null,
    evidence_notes: null,
    ...overrides,
  };
}

function makeDetail(overrides: Partial<RoadmapDetail> = {}): RoadmapDetail {
  return {
    id: 1,
    title: 'Apache Kafka Mastery',
    description: null,
    source_filename: 'kafka.xlsx',
    start_date: '2026-01-01',
    weekly_hours_budget: 10,
    is_archived: false,
    created_at: '2026-01-01T00:00:00',
    updated_at: '2026-01-01T00:00:00',
    progress: {
      total_topics: 2,
      not_started_count: 1,
      in_progress_count: 0,
      completed_count: 1,
      skipped_count: 0,
      completion_percentage: 50,
      hours_percentage: 50,
      total_estimated_hours: 6,
      completed_estimated_hours: 3,
    },
    phases: [
      {
        id: 1, roadmap_id: 1, name: 'Core Foundations', order_index: 0,
        topics: [makeTopic(1, { status: 'completed', progress_percentage: 100 }), makeTopic(2)],
      },
    ],
    resources: [],
    ...overrides,
  };
}

function makeSchedule(overrides: Partial<RoadmapSchedule> = {}): RoadmapSchedule {
  return {
    schedule_available: true,
    reason: null,
    start_date: '2026-01-01',
    weekly_hours_budget: 10,
    projected_end_date: '2026-02-15',
    unschedulable_topic_count: 0,
    items: [
      { topic_id: 1, phase_id: 1, phase_name: 'Core Foundations', title: 'Topic 1', status: 'completed', estimated_hours: 3, schedule_status: 'actual', start: '2026-01-01', end: '2026-01-03' },
      { topic_id: 2, phase_id: 1, phase_name: 'Core Foundations', title: 'Topic 2', status: 'not_started', estimated_hours: 3, schedule_status: 'projected', start: '2026-01-04', end: '2026-01-06' },
    ],
    phases: [
      { phase_id: 1, phase_name: 'Core Foundations', start: '2026-01-01', end: '2026-01-06', schedule_status: 'projected' },
    ],
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/roadmaps/1']}>
      <Routes>
        <Route path="/roadmaps/:roadmapId" element={<RoadmapDetailPage />} />
        <Route path="/roadmaps" element={<div>Roadmap List Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetRoadmap.mockResolvedValue(makeDetail());
  mockGetRoadmapSchedule.mockResolvedValue(makeSchedule());
});

describe('RoadmapDetailPage', () => {
  it('renders the table view with phases and topics by default', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Apache Kafka Mastery')).toBeInTheDocument());
    expect(screen.getByText('Core Foundations')).toBeInTheDocument();
    expect(screen.getByText('Topic 1')).toBeInTheDocument();
    expect(screen.getByText('Topic 2')).toBeInTheDocument();
  });

  it('updates a topic status and refreshes progress without a full reload', async () => {
    const user = userEvent.setup();
    mockUpdateRoadmapTopic.mockResolvedValue(makeTopic(2, { status: 'completed' }));
    renderPage();

    await waitFor(() => expect(screen.getByText('Topic 2')).toBeInTheDocument());

    mockGetRoadmap.mockResolvedValue(makeDetail({
      progress: { ...makeDetail().progress, completed_count: 2, completion_percentage: 100 },
    }));

    await user.click(screen.getByLabelText('Status for Topic 2'));
    await user.click(await screen.findByRole('option', { name: 'Completed' }));

    await waitFor(() => {
      expect(mockUpdateRoadmapTopic).toHaveBeenCalledWith(1, 2, { status: 'completed' });
    });
    // The progress line, not a KPI card: three bordered tiles used to sit
    // above the table and two of them said the same thing. What matters here
    // is unchanged -- the figure moves without a page reload.
    await waitFor(() => expect(screen.getByText(/100% of the topics/)).toBeInTheDocument());
    expect(screen.getByText(/2 of 2 done/)).toBeInTheDocument();
  });

  it('switches to the journey view and marks the current phase', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText('Apache Kafka Mastery')).toBeInTheDocument());

    await user.click(screen.getByRole('tab', { name: /journey/i }));
    await waitFor(() => expect(screen.getByText('You are here')).toBeInTheDocument());
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('renders the gantt with a projected finish date', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText('Apache Kafka Mastery')).toBeInTheDocument());

    await user.click(screen.getByRole('tab', { name: /schedule/i }));
    await waitFor(() => expect(screen.getByText(/Projected finish: 2026-02-15/)).toBeInTheDocument());
    expect(screen.getByText('Completed (actual dates)')).toBeInTheDocument();
  });

  it('explains why the schedule is unavailable instead of drawing an empty chart', async () => {
    const user = userEvent.setup();
    mockGetRoadmapSchedule.mockResolvedValue(makeSchedule({
      schedule_available: false,
      reason: 'no_weekly_budget',
      projected_end_date: null,
      items: [],
      phases: [],
    }));
    renderPage();

    await waitFor(() => expect(screen.getByText('Apache Kafka Mastery')).toBeInTheDocument());
    await user.click(screen.getByRole('tab', { name: /schedule/i }));

    await waitFor(() =>
      expect(screen.getByText(/Set how many hours a week you plan to study/i)).toBeInTheDocument()
    );
    // Offers the fix rather than leaving the user to guess what is missing.
    expect(screen.getByRole('button', { name: /set schedule/i })).toBeInTheDocument();
  });

  it('places the today marker when today falls inside the charted range', async () => {
    // Regression: `new Date('2026-08-13')` parses a date-only string as UTC
    // midnight while `new Date()` is local, so in any timezone ahead of UTC
    // local-midnight-today sorted *before* a bar starting today. The marker
    // silently disappeared and every bar could sit a day off.
    const user = userEvent.setup();
    const toIso = (offsetDays: number) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + offsetDays);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    mockGetRoadmapSchedule.mockResolvedValue(makeSchedule({
      items: [{
        topic_id: 1, phase_id: 1, phase_name: 'Core Foundations', title: 'Topic 1',
        status: 'not_started', estimated_hours: 3, schedule_status: 'projected',
        start: toIso(0), end: toIso(6),
      }],
      phases: [{
        phase_id: 1, phase_name: 'Core Foundations',
        start: toIso(0), end: toIso(6), schedule_status: 'projected',
      }],
    }));
    renderPage();

    await waitFor(() => expect(screen.getByText('Apache Kafka Mastery')).toBeInTheDocument());
    await user.click(screen.getByRole('tab', { name: /schedule/i }));

    await waitFor(() => expect(screen.getByText('Today')).toBeInTheDocument());
    // The legend label always renders; the marker itself is the 2px rule, so
    // assert on the element rather than the caption.
    const markers = document.querySelectorAll('div[class*="MuiBox"]');
    const todayRule = Array.from(markers).find(
      (el) => (el as HTMLElement).style.width === '2px' || getComputedStyle(el).width === '2px'
    );
    expect(todayRule).toBeTruthy();
  });

  it('reports topics with no hours estimate rather than assuming a duration', async () => {
    const user = userEvent.setup();
    mockGetRoadmapSchedule.mockResolvedValue(makeSchedule({ unschedulable_topic_count: 2 }));
    renderPage();

    await waitFor(() => expect(screen.getByText('Apache Kafka Mastery')).toBeInTheDocument());
    await user.click(screen.getByRole('tab', { name: /schedule/i }));

    await waitFor(() =>
      expect(screen.getByText(/2 topic\(s\) have no hours estimate/i)).toBeInTheDocument()
    );
  });

  it('shows an em-dash for an hours percentage the backend declined to compute', async () => {
    mockGetRoadmap.mockResolvedValue(makeDetail({
      progress: {
        ...makeDetail().progress,
        hours_percentage: null, total_estimated_hours: null, completed_estimated_hours: null,
      },
    }));
    renderPage();

    await waitFor(() => expect(screen.getByText('Apache Kafka Mastery')).toBeInTheDocument());
    expect(screen.getByText(/Some topics have no hours estimate/i)).toBeInTheDocument();
  });

  it('saves evidence notes against a topic', async () => {
    const user = userEvent.setup();
    mockUpdateRoadmapTopic.mockResolvedValue(makeTopic(2, { evidence_notes: 'Built a cluster' }));
    renderPage();

    await waitFor(() => expect(screen.getByText('Topic 2')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /notes for topic 2/i }));

    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/what did you build/i), 'Built a cluster');
    await user.click(within(dialog).getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockUpdateRoadmapTopic).toHaveBeenCalledWith(1, 2, { evidence_notes: 'Built a cluster' });
    });
  });

  it('saves schedule settings', async () => {
    const user = userEvent.setup();
    mockUpdateRoadmap.mockResolvedValue(makeDetail());
    renderPage();

    await waitFor(() => expect(screen.getByText('Apache Kafka Mastery')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /schedule settings/i }));

    const dialog = await screen.findByRole('dialog');
    const hours = within(dialog).getByLabelText(/study hours per week/i);
    await user.clear(hours);
    await user.type(hours, '12');
    await user.click(within(dialog).getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockUpdateRoadmap).toHaveBeenCalledWith(1, expect.objectContaining({ weekly_hours_budget: 12 }));
    });
  });

  it('shows a retry-able error state on fetch failure', async () => {
    const user = userEvent.setup();
    mockGetRoadmap.mockRejectedValue(new Error('network error'));
    renderPage();

    await waitFor(() => expect(screen.getByText(/Failed to load this roadmap/i)).toBeInTheDocument());

    mockGetRoadmap.mockResolvedValue(makeDetail());
    await user.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(screen.getByText('Apache Kafka Mastery')).toBeInTheDocument());
  });
});
