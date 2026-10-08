// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { UNASSIGNED_CAPABILITIES } from '../services/capabilities';
import type { WorkspaceItem, WorkspaceResponse } from '../types/portfolio';

const getWorkspace = vi.fn();
vi.mock('../services/api', () => ({ getWorkspace: (...a: any[]) => getWorkspace(...a) }));

let preparation: any;
vi.mock('../context/PreparationContext', () => ({ usePreparation: () => preparation }));

import { WorkspacePage } from './WorkspacePage';

const CAPS = { ...UNASSIGNED_CAPABILITIES, learningLabStatus: 'AVAILABLE', scenarios: true, roadmap: true, workspace: true, evidence: true };
const item = (over: Partial<WorkspaceItem>): WorkspaceItem => ({
  id: 'x', kind: 'lab_run', source: 'learning_lab', title: 'Watermark', context: null, excerpt: null, detail: null,
  href: '/lab/adf/watermark', updated_at: '2026-10-07T10:00:00', ref: {}, ...over,
});
const response = (subjectId: number | null, items: WorkspaceItem[]): WorkspaceResponse => ({ subject_id: subjectId, items });

const renderPage = () => render(<MemoryRouter><WorkspacePage /></MemoryRouter>);

beforeEach(() => {
  getWorkspace.mockReset();
  preparation = { selected: { id: 7, name: 'ADF skill' }, selectedId: 7, loading: false, capabilities: CAPS };
});

describe('WorkspacePage', () => {
  it('shows the preparation\'s own work and, apart from it, work that belongs to no preparation', async () => {
    getWorkspace.mockImplementation(async (sid: number | null) => (sid === 7
      ? response(7, [
        item({ id: 'lab_run:7:watermark:1', ref: { track: 'watermark', run: '1' }, context: 'Run 1',
          excerpt: 'The completion exit ran on failure.', detail: '4 of 4 graded stages finished' }),
        item({ id: 'attempt:s7:adf@1:1:lens:po', kind: 'scenario_notes', source: 'scenarios', title: 'The missing lots',
          context: 'PO lens', excerpt: 'Who owns the watermark?', href: '/scenarios/adf/1' }),
      ])
      : response(null, [item({ id: 'system_design:1', kind: 'system_design_answer', source: 'interview',
        title: 'Design a URL shortener', href: '/system-design/attempts/1' })])));

    renderPage();

    const own = await screen.findByRole('region', { name: 'ADF skill' });
    expect(getWorkspace).toHaveBeenCalledWith(7);
    expect(getWorkspace).toHaveBeenCalledWith(null);
    // Lab work is named by the lab's own registry, not the server's fallback.
    expect(await within(own).findByRole('heading', { level: 3, name: 'Watermark & Transient Failure' })).toBeInTheDocument();
    expect(within(own).getByText('The completion exit ran on failure.')).toBeInTheDocument();
    expect(within(own).getByRole('link', { name: 'Open The missing lots' })).toHaveAttribute('href', '/scenarios/adf/1');
    expect(within(own).queryByText('Design a URL shortener')).not.toBeInTheDocument();

    const unowned = screen.getByRole('region', { name: 'Not tied to a preparation' });
    expect(await within(unowned).findByRole('heading', { level: 3, name: 'Design a URL shortener' })).toBeInTheDocument();
    expect(within(unowned).queryByText('The missing lots')).not.toBeInTheDocument();
  });

  it('filters by kind and searches the learner\'s own words', async () => {
    const user = userEvent.setup();
    getWorkspace.mockImplementation(async (sid: number | null) => (sid === 7
      ? response(7, [
        item({ id: 'a', title: 'Alpha', excerpt: 'about watermarks' }),
        item({ id: 'b', kind: 'topic_guide', source: 'roadmap', title: 'Beta', excerpt: 'about triggers', href: '/roadmaps/1/topics/2/guide' }),
      ])
      : response(null, [])));
    renderPage();
    const own = await screen.findByRole('region', { name: 'ADF skill' });
    await within(own).findByText('Beta');

    await user.click(within(own).getByRole('button', { name: 'Topic guide (1)' }));
    expect(within(own).queryByText('Alpha')).not.toBeInTheDocument();
    expect(within(own).getByText('Beta')).toBeInTheDocument();

    await user.click(within(own).getByRole('button', { name: 'All (2)' }));
    await user.type(within(own).getByRole('textbox', { name: 'Search your work' }), 'watermarks');
    expect(within(own).getByText('Alpha')).toBeInTheDocument();
    expect(within(own).queryByText('Beta')).not.toBeInTheDocument();
  });

  it('with no preparation chosen, asks for nothing but the no-preparation scope', async () => {
    preparation = { selected: null, selectedId: null, loading: false, capabilities: UNASSIGNED_CAPABILITIES };
    getWorkspace.mockResolvedValue(response(null, []));
    renderPage();
    expect(await screen.findByText(/No preparation is chosen/)).toBeInTheDocument();
    await waitFor(() => expect(getWorkspace).toHaveBeenCalledTimes(1));
    expect(getWorkspace).toHaveBeenCalledWith(null);
    expect(screen.getByRole('region', { name: 'Not tied to a preparation' })).toBeInTheDocument();
  });

  it('explains an empty workspace with actions the preparation really has, and invents nothing', async () => {
    getWorkspace.mockResolvedValue(response(7, []));
    renderPage();
    const own = await screen.findByRole('region', { name: 'ADF skill' });
    expect(await within(own).findByText('Nothing in this workspace yet')).toBeInTheDocument();
    expect(within(own).getByRole('link', { name: 'Open the Learning Lab' })).toHaveAttribute('href', '/lab');
    expect(within(own).getByRole('link', { name: 'Work a scenario' })).toBeInTheDocument();
    expect(within(own).queryByRole('link', { name: 'Prepare an interview answer' })).not.toBeInTheDocument();
    expect(within(own).queryAllByRole('listitem')).toHaveLength(0);
  });

  it('applies only the latest preparation\'s answer when the preparation changes mid-load', async () => {
    let releaseOld!: (v: WorkspaceResponse) => void;
    getWorkspace.mockImplementation((sid: number | null) => {
      if (sid === 7) return new Promise((resolve) => { releaseOld = resolve; });
      if (sid === 8) return Promise.resolve(response(8, [item({ id: 'mine', title: 'Kafka work' })]));
      return Promise.resolve(response(null, []));
    });
    const view = renderPage();
    preparation = { selected: { id: 8, name: 'Kafka' }, selectedId: 8, loading: false, capabilities: CAPS };
    view.rerender(<MemoryRouter><WorkspacePage /></MemoryRouter>);
    const own = await screen.findByRole('region', { name: 'Kafka' });
    expect(await within(own).findByText('Kafka work')).toBeInTheDocument();

    await act(async () => { releaseOld(response(7, [item({ id: 'old', title: 'ADF work' })])); });
    expect(screen.queryByText('ADF work')).not.toBeInTheDocument();
    expect(within(own).getByText('Kafka work')).toBeInTheDocument();
  });

  it('says when work did not load, and retries', async () => {
    const user = userEvent.setup();
    // The first read (this preparation's) fails; every read after it answers.
    getWorkspace.mockImplementation(async (sid: number | null) => response(sid, []));
    getWorkspace.mockRejectedValueOnce({ response: { status: 500, data: { detail: 'Server error.' } } });
    renderPage();
    expect(await screen.findByText('This work did not load.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.queryByText('This work did not load.')).not.toBeInTheDocument());
  });
});
