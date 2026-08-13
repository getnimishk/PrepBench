import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RoadmapListPage } from './RoadmapListPage';
import { RoadmapProgress, RoadmapSummary } from '../types/roadmap';

const mockGetRoadmaps = vi.fn();
const mockCreateRoadmap = vi.fn();
const mockDeleteRoadmap = vi.fn();
const mockUpdateRoadmap = vi.fn();

vi.mock('../services/api', () => ({
  getRoadmaps: (...args: any[]) => mockGetRoadmaps(...args),
  createRoadmap: (...args: any[]) => mockCreateRoadmap(...args),
  deleteRoadmap: (...args: any[]) => mockDeleteRoadmap(...args),
  updateRoadmap: (...args: any[]) => mockUpdateRoadmap(...args),
}));

vi.mock('../components/roadmap/RoadmapImportModal', () => ({
  RoadmapImportModal: ({ open, onImported }: any) =>
    open ? (
      <div>
        <div>Import Modal Open</div>
        <button onClick={() => onImported(77)}>Simulate Imported</button>
      </div>
    ) : null,
}));

function makeProgress(overrides: Partial<RoadmapProgress> = {}): RoadmapProgress {
  return {
    total_topics: 10,
    not_started_count: 6,
    in_progress_count: 1,
    completed_count: 3,
    skipped_count: 0,
    completion_percentage: 30,
    hours_percentage: 25,
    total_estimated_hours: 40,
    completed_estimated_hours: 10,
    ...overrides,
  };
}

function makeRoadmap(overrides: Partial<RoadmapSummary> = {}): RoadmapSummary {
  return {
    id: 1,
    title: 'Apache Kafka Mastery',
    description: null,
    source_filename: 'kafka.xlsx',
    start_date: null,
    weekly_hours_budget: null,
    is_archived: false,
    created_at: '2026-01-01T00:00:00',
    updated_at: '2026-01-01T00:00:00',
    progress: makeProgress(),
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/roadmaps']}>
      <Routes>
        <Route path="/roadmaps" element={<RoadmapListPage />} />
        <Route path="/roadmaps/:roadmapId" element={<div>Roadmap Detail Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RoadmapListPage', () => {
  it('shows an empty state listing the supported formats', async () => {
    mockGetRoadmaps.mockResolvedValue([]);
    renderPage();
    await waitFor(() => expect(screen.getByText(/No roadmaps yet/i)).toBeInTheDocument());
  });

  it('lists roadmaps with their real progress', async () => {
    mockGetRoadmaps.mockResolvedValue([makeRoadmap()]);
    renderPage();

    await waitFor(() => expect(screen.getByText('Apache Kafka Mastery')).toBeInTheDocument());
    expect(screen.getByText('30%')).toBeInTheDocument();
    expect(screen.getByText(/3 of 10 done/i)).toBeInTheDocument();
    expect(screen.getByText('10h of 40h')).toBeInTheDocument();
  });

  it('renders an em-dash and no progress bar when a roadmap has nothing to measure', async () => {
    // A roadmap with no topics is not "0% complete" -- showing 0 would assert
    // progress the backend explicitly declined to claim by returning null.
    mockGetRoadmaps.mockResolvedValue([
      makeRoadmap({
        progress: makeProgress({
          total_topics: 0, not_started_count: 0, in_progress_count: 0, completed_count: 0,
          completion_percentage: null, hours_percentage: null,
          total_estimated_hours: null, completed_estimated_hours: null,
        }),
      }),
    ]);
    renderPage();

    await waitFor(() => expect(screen.getByText('Apache Kafka Mastery')).toBeInTheDocument());
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('navigates to the detail page when a roadmap card is clicked', async () => {
    const user = userEvent.setup();
    mockGetRoadmaps.mockResolvedValue([makeRoadmap()]);
    renderPage();

    await waitFor(() => expect(screen.getByText('Apache Kafka Mastery')).toBeInTheDocument());
    await user.click(screen.getByText('Apache Kafka Mastery'));
    await waitFor(() => expect(screen.getByText('Roadmap Detail Page')).toBeInTheDocument());
  });

  it('navigates straight to a freshly imported roadmap', async () => {
    const user = userEvent.setup();
    mockGetRoadmaps.mockResolvedValue([]);
    renderPage();

    await waitFor(() => expect(screen.getByText(/No roadmaps yet/i)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /import roadmap/i }));
    await waitFor(() => expect(screen.getByText('Import Modal Open')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /simulate imported/i }));
    await waitFor(() => expect(screen.getByText('Roadmap Detail Page')).toBeInTheDocument());
  });

  it('creates a roadmap and opens it', async () => {
    const user = userEvent.setup();
    mockGetRoadmaps.mockResolvedValue([]);
    mockCreateRoadmap.mockResolvedValue({ id: 5, title: 'Rust' });
    renderPage();

    await waitFor(() => expect(screen.getByRole('button', { name: /new roadmap/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /new roadmap/i }));
    await user.type(screen.getByLabelText(/title/i), 'Rust');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => expect(mockCreateRoadmap).toHaveBeenCalledWith({ title: 'Rust' }));
    await waitFor(() => expect(screen.getByText('Roadmap Detail Page')).toBeInTheDocument());
  });

  it('requires confirmation before deleting, then refetches', async () => {
    const user = userEvent.setup();
    mockGetRoadmaps.mockResolvedValue([makeRoadmap()]);
    mockDeleteRoadmap.mockResolvedValue(undefined);
    renderPage();

    await waitFor(() => expect(screen.getByText('Apache Kafka Mastery')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /delete apache kafka mastery/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/cannot be undone/i)).toBeInTheDocument();
    expect(mockDeleteRoadmap).not.toHaveBeenCalled();

    mockGetRoadmaps.mockResolvedValue([]);
    await user.click(within(dialog).getByRole('button', { name: /^delete$/i }));

    await waitFor(() => expect(mockDeleteRoadmap).toHaveBeenCalledWith(1));
    await waitFor(() => expect(screen.getByText(/No roadmaps yet/i)).toBeInTheDocument());
  });

  it('shows a retry-able error state on fetch failure', async () => {
    const user = userEvent.setup();
    mockGetRoadmaps.mockRejectedValue(new Error('network error'));
    renderPage();

    await waitFor(() => expect(screen.getByText(/Failed to load roadmaps/i)).toBeInTheDocument());
    mockGetRoadmaps.mockResolvedValue([]);
    await user.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(screen.getByText(/No roadmaps yet/i)).toBeInTheDocument());
  });
});
