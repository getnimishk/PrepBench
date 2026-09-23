// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { RoadmapEditorPage } from './RoadmapEditorPage';

const api = {
  getRoadmap: vi.fn(),
  getDraftRoadmapSchedule: vi.fn(),
  saveRoadmapPlan: vi.fn(),
};
vi.mock('../services/api', () => ({
  getRoadmap: (...a: unknown[]) => api.getRoadmap(...a),
  getDraftRoadmapSchedule: (...a: unknown[]) => api.getDraftRoadmapSchedule(...a),
  saveRoadmapPlan: (...a: unknown[]) => api.saveRoadmapPlan(...a),
}));

const topic = (id: number, status = 'not_started', hours: number | null = 2) => ({
  id, title: `Topic ${id}`, status, estimated_hours: hours, progress_percentage: 0,
});

const ROADMAP = {
  id: 3,
  title: 'Kafka plan',
  source_filename: 'Kafka.xlsx',
  subject_id: 1,
  start_date: null,
  weekly_hours_budget: null,
  is_archived: false,
  progress: { total_topics: 3 },
  resources: [],
  phases: [
    { id: 10, roadmap_id: 3, name: 'Basics', order_index: 0, topics: [topic(1, 'completed'), topic(2)] },
    { id: 11, roadmap_id: 3, name: 'Streams', order_index: 1, topics: [topic(3, 'not_started', null)] },
    { id: 12, roadmap_id: 3, name: 'Empty', order_index: 2, topics: [] },
  ],
};

const Where: React.FC = () => {
  const location = useLocation();
  return <div data-testid="where">{location.pathname}|{(location.state as { notice?: string } | null)?.notice}</div>;
};

const renderEditor = () => render(
  <MemoryRouter initialEntries={['/roadmaps/3/edit']}>
    <Routes>
      <Route path="/roadmaps/:roadmapId/edit" element={<RoadmapEditorPage />} />
      <Route path="/roadmaps/:roadmapId" element={<Where />} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.getRoadmap.mockResolvedValue(ROADMAP);
  api.getDraftRoadmapSchedule.mockResolvedValue({
    schedule_available: false, reason: 'no_start_date', remaining_estimated_hours: 2,
    unschedulable_topic_count: 1, items: [], phases: [],
  });
  api.saveRoadmapPlan.mockResolvedValue(ROADMAP);
});

const phaseRows = () => within(screen.getByRole('list', { name: 'Phases in order' })).getAllByRole('listitem');

describe('RoadmapEditorPage', () => {
  it('shows the plan as saved, with what each phase holds', async () => {
    renderEditor();

    expect(await screen.findByRole('heading', { name: 'Edit plan', level: 1 })).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Kafka plan');
    expect(screen.getByLabelText('Source file')).toHaveValue('Kafka.xlsx');
    const rows = phaseRows();
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText('2 topics · 4h')).toBeInTheDocument();
    expect(within(rows[0]).getByText('1 of 2 complete')).toBeInTheDocument();
    expect(screen.getByText(/1 topic has no hours estimate/)).toBeInTheDocument();
    // Nothing changed yet, so nothing to save.
    expect(screen.getByRole('button', { name: 'Save plan' })).toBeDisabled();
  });

  it("projects the unsaved budget through the server, and says what is missing instead of assuming a pace", async () => {
    const user = userEvent.setup();
    renderEditor();

    expect(await screen.findByText('2h of estimated work left. Set a start date to project a finish date.')).toBeInTheDocument();

    api.getDraftRoadmapSchedule.mockResolvedValue({
      schedule_available: true, reason: null, start_date: '2099-01-05', weekly_hours_budget: 7,
      projected_end_date: '2099-01-18', remaining_estimated_hours: 14, unschedulable_topic_count: 0, items: [], phases: [],
    });
    await user.type(screen.getByLabelText('Weekly hours budget'), '7');

    await waitFor(() => expect(api.getDraftRoadmapSchedule).toHaveBeenLastCalledWith(3, { start_date: null, weekly_hours_budget: 7 }));
    expect(await screen.findByText(/^14h of estimated work left at 7h a week: about 2 weeks, finishing/)).toBeInTheDocument();
  });

  it('refuses a weekly budget no week can hold', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.type(await screen.findByLabelText('Weekly hours budget'), '200');

    expect(screen.getByText('More than 0 and at most 168 hours a week.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save plan' })).toBeDisabled();
  });

  it('saves renames, a new order and a new phase in one request', async () => {
    const user = userEvent.setup();
    renderEditor();

    const first = await screen.findByLabelText('Phase 1 name');
    await user.clear(first);
    await user.type(first, 'Foundations');
    await user.click(screen.getByRole('button', { name: 'Move Streams up' }));
    await user.click(screen.getByRole('button', { name: 'Add phase' }));
    await user.type(screen.getByLabelText('Phase 4 name'), 'Operations');
    await user.click(screen.getByRole('button', { name: 'Save plan' }));

    await waitFor(() => expect(api.saveRoadmapPlan).toHaveBeenCalledWith(3, {
      title: 'Kafka plan',
      start_date: null,
      weekly_hours_budget: null,
      phases: [
        { id: 11, name: 'Streams' },
        { id: 10, name: 'Foundations' },
        { id: 12, name: 'Empty' },
        { id: null, name: 'Operations' },
      ],
      removed_phases: [],
    }));
    expect(await screen.findByTestId('where')).toHaveTextContent('/roadmaps/3|Plan saved.');
  });

  it('removes an empty phase at once, and a phase with topics only once they have somewhere to go', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(await screen.findByRole('button', { name: 'Remove Empty' }));
    expect(phaseRows()).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Remove Basics' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remove Basics?' });
    expect(within(dialog).getByText(/It holds 2 topics\. They move to the phase you choose/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Remove and move topics' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    expect(phaseRows()).toHaveLength(1);
    expect(screen.getByText(/2 more moving here from Basics/)).toBeInTheDocument();
    expect(screen.getByText(/its 2 topics move to Streams/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save plan' }));
    await waitFor(() => expect(api.saveRoadmapPlan).toHaveBeenCalledWith(3, expect.objectContaining({
      phases: [{ id: 11, name: 'Streams' }],
      removed_phases: [{ id: 12, move_topics_to: null }, { id: 10, move_topics_to: 0 }],
    })));
  });

  it('puts a removed phase back with Keep', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(await screen.findByRole('button', { name: 'Remove Empty' }));
    await user.click(screen.getByRole('button', { name: 'Keep Empty' }));

    expect(phaseRows()).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Save plan' })).toBeDisabled();
  });

  it('says when the plan changed elsewhere, and offers to reload', async () => {
    const user = userEvent.setup();
    api.saveRoadmapPlan.mockRejectedValue({
      response: { status: 409, data: { detail: "This roadmap's phases changed after the editor opened it. Nothing was saved. Reload the editor to work on the current plan." } },
    });
    renderEditor();

    const title = await screen.findByLabelText('Title');
    await user.type(title, ' v2');
    await user.click(screen.getByRole('button', { name: 'Save plan' }));

    expect(await screen.findByText(/phases changed after the editor opened it/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reload' }));
    await waitFor(() => expect(api.getRoadmap).toHaveBeenCalledTimes(2));
    expect(await screen.findByLabelText('Title')).toHaveValue('Kafka plan');
  });

  it('asks before throwing away unsaved changes', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.type(await screen.findByLabelText('Title'), ' v2');
    await user.click(screen.getByRole('button', { name: '← Cancel' }));
    const dialog = await screen.findByRole('dialog', { name: 'Discard your changes?' });
    await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Title')).toHaveValue('Kafka plan v2');

    await user.click(screen.getByRole('button', { name: '← Cancel' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Discard' }));
    expect(await screen.findByTestId('where')).toHaveTextContent('/roadmaps/3|');
    expect(api.saveRoadmapPlan).not.toHaveBeenCalled();
  });
});
