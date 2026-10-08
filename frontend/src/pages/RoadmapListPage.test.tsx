// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

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
const mockPreparation = vi.fn();
const mockRefresh = vi.fn();

vi.mock('../services/api', () => ({
  getScopedRoadmaps: (...args: any[]) => mockGetRoadmaps(...args),
  createRoadmap: (...args: any[]) => mockCreateRoadmap(...args),
  deleteRoadmap: (...args: any[]) => mockDeleteRoadmap(...args),
  updateRoadmap: (...args: any[]) => mockUpdateRoadmap(...args),
}));

vi.mock('../context/PreparationContext', () => ({
  usePreparation: () => mockPreparation(),
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
  mockRefresh.mockResolvedValue(undefined);
  mockPreparation.mockReturnValue({ selected: null, refresh: mockRefresh });
});

const DATABRICKS = { id: 2, name: 'Databricks', kind: 'skill' };
const PSM = { id: 1, name: 'PSM I', kind: 'certification' };

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
    expect(screen.getByText(/3 of 10 complete/)).toHaveTextContent(/· 30% · 10h of 40h/);
    expect(screen.getByRole('progressbar', { name: /30% of the topics marked done/ })).toBeInTheDocument();
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
    expect(screen.getByText('No topics yet')).toBeInTheDocument();
    expect(screen.queryByText(/0%/)).not.toBeInTheDocument();
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

    await waitFor(() => expect(screen.getByText(/Could not load your roadmaps\..*Nothing was changed\./i)).toBeInTheDocument());
    mockGetRoadmaps.mockResolvedValue([]);
    await user.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(screen.getByText(/No roadmaps yet/i)).toBeInTheDocument());
  });

  it('with no preparation chosen, asks only for roadmaps that belong to none', async () => {
    mockGetRoadmaps.mockResolvedValue([makeRoadmap({ subject_id: null })]);
    renderPage();
    await waitFor(() => expect(screen.getByText('Apache Kafka Mastery')).toBeInTheDocument());
    expect(mockGetRoadmaps).toHaveBeenCalledWith(null);
    expect(screen.queryByRole('button', { name: /unlink/i })).not.toBeInTheDocument();
  });

  it('asks for the chosen preparation\'s roadmaps, and unlinks one only after confirming', async () => {
    const user = userEvent.setup();
    mockPreparation.mockReturnValue({ selected: DATABRICKS, refresh: mockRefresh });
    mockGetRoadmaps.mockResolvedValue([makeRoadmap({ id: 3, title: 'Storage FileSystems', subject_id: 2 })]);
    mockUpdateRoadmap.mockResolvedValue({});
    renderPage();

    await waitFor(() => expect(screen.getByText('Storage FileSystems')).toBeInTheDocument());
    expect(mockGetRoadmaps).toHaveBeenCalledWith(2);
    await user.click(screen.getByRole('button', { name: /unlink storage filesystems/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/will no longer belong to Databricks/i)).toBeInTheDocument();
    expect(mockUpdateRoadmap).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: /^unlink$/i }));
    await waitFor(() => expect(mockUpdateRoadmap).toHaveBeenCalledWith(3, { subject_id: null }));
    // The preparation's roadmap capability is re-read from the server, never assumed.
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  it('cancelling the unlink changes nothing', async () => {
    const user = userEvent.setup();
    mockPreparation.mockReturnValue({ selected: DATABRICKS, refresh: mockRefresh });
    mockGetRoadmaps.mockResolvedValue([makeRoadmap({ id: 3, title: 'Storage FileSystems', subject_id: 2 })]);
    renderPage();

    await waitFor(() => expect(screen.getByText('Storage FileSystems')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /unlink storage filesystems/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mockUpdateRoadmap).not.toHaveBeenCalled();
  });

  it('shows the latest preparation\'s roadmaps when an earlier answer arrives late', async () => {
    let releaseFirst: (v: RoadmapSummary[]) => void = () => {};
    mockGetRoadmaps
      .mockImplementationOnce(() => new Promise((r) => { releaseFirst = r; }))
      .mockResolvedValueOnce([makeRoadmap({ id: 9, title: 'PSM plan', subject_id: 1 })]);
    mockPreparation.mockReturnValue({ selected: DATABRICKS, refresh: mockRefresh });
    const view = renderPage();
    mockPreparation.mockReturnValue({ selected: PSM, refresh: mockRefresh });
    view.rerender(
      <MemoryRouter initialEntries={['/roadmaps']}>
        <Routes>
          <Route path="/roadmaps" element={<RoadmapListPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('PSM plan')).toBeInTheDocument());
    releaseFirst([makeRoadmap({ id: 3, title: 'Storage FileSystems', subject_id: 2 })]);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText('Storage FileSystems')).not.toBeInTheDocument();
    expect(screen.getByText('PSM plan')).toBeInTheDocument();
  });
});
