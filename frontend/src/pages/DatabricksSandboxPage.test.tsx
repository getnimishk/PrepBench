// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { JournalEntry, LabPackDetail } from '../types/lakehouse';

vi.mock('../services/api', () => ({
  getLakehouseEngine: vi.fn(),
  getLakehousePacks: vi.fn(),
  getLakehousePack: vi.fn(),
  getLakehouseJournal: vi.fn(),
  deleteLakehouseJournalEntry: vi.fn(),
  getLakehouseJournalMarkdown: vi.fn(),
  getSubjects: vi.fn(),
  getLearningAttempts: vi.fn(),
  startLearningAttempt: vi.fn(),
  patchLearningAttempt: vi.fn(),
  runLakehouseOperation: vi.fn(),
  resetLakehousePack: vi.fn(),
  getLakehouseNotebook: vi.fn(),
}));

import * as api from '../services/api';
import { DatabricksSandboxPage } from './DatabricksSandboxPage';

const pack: LabPackDetail = {
  id: 'semiconductor-v1', version: 1, title: 'Semiconductor', summary: 'S', fictional: true, stations: ['c'],
  notebook_verified_on: null, scenario_md: '', factory: {}, defect_manifest: [],
  tables: ['bronze.defects'], dataset: { tables: {}, defects: [] },
};
const entry = (over: Partial<JournalEntry> = {}): JournalEntry => ({
  entry_uid: 'e1', pack_id: pack.id, station: 'c', source: 'real_engine', op: 'create_table', table_name: 'bronze.defects',
  result: { ok: true, version: 0 }, created_at: '2026-10-02T10:00:00', ...over,
});

const renderPage = (entry = '/databricks-sandbox') => render(
  <MemoryRouter initialEntries={[entry]}><DatabricksSandboxPage /></MemoryRouter>,
);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getLakehouseEngine).mockResolvedValue({ available: true, version: '1.6.6', install_command: 'x' });
  vi.mocked(api.getLakehousePacks).mockResolvedValue([{ ...pack }]);
  vi.mocked(api.getLakehousePack).mockResolvedValue(pack);
  vi.mocked(api.getLakehouseJournal).mockResolvedValue([entry()]);
  vi.mocked(api.getSubjects).mockResolvedValue([
    { id: 1, slug: 'psm-i' }, { id: 2, slug: 'databricks' },
  ] as never);
  vi.mocked(api.getLearningAttempts).mockResolvedValue([]);
});

describe('DatabricksSandboxPage', () => {
  it('opens on Station C with the h1, the engine status and the journal count', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { level: 1, name: 'Lakehouse Lab' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 2, name: /Station C/ })).toBeInTheDocument();
    expect(screen.getByText('Real engine · deltalake 1.6.6')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Journal (1)' })).toBeInTheDocument());
  });

  it('says the real engine is not installed, and that nothing stands in for it', async () => {
    vi.mocked(api.getLakehouseEngine).mockResolvedValue({ available: false, install_command: 'uv pip install lab' });
    renderPage();
    expect(await screen.findByText('Real engine not installed')).toBeInTheDocument();
    expect(screen.getByText('Nothing runs, and nothing stands in for it.')).toBeInTheDocument();
  });

  it('puts the lab’s attempts on the databricks preparation', async () => {
    renderPage();
    await screen.findByRole('heading', { level: 2, name: /Station C/ });
    await waitFor(() => expect(api.getLearningAttempts).toHaveBeenCalledWith({ subject_id: 2 }));
  });

  it('shows the stations that are not built yet as such, and does not pretend', async () => {
    renderPage('/databricks-sandbox?station=f');
    expect(await screen.findByText('This station isn’t built yet. It arrives in a later phase of the Lab. Station C, Delta Lake, is ready.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Station C · Delta Lake/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'F · Migration Factory (not built yet)' })).toHaveAttribute('aria-current', 'page');
  });

  it('falls back to Station C for an unknown station', async () => {
    renderPage('/databricks-sandbox?station=zzz');
    expect(await screen.findByRole('heading', { level: 2, name: /Station C/ })).toBeInTheDocument();
  });

  it('opens the journal, deletes an entry, and exports it', async () => {
    const user = userEvent.setup();
    vi.mocked(api.getLakehouseJournalMarkdown).mockResolvedValue('# journal');
    vi.mocked(api.deleteLakehouseJournalEntry).mockResolvedValue(undefined);
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Journal (1)' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Lab journal' })).toBeInTheDocument();
    expect(screen.getByText('Real engine')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Export .md' }));
    await waitFor(() => expect(api.getLakehouseJournalMarkdown).toHaveBeenCalledWith('semiconductor-v1'));

    await user.click(screen.getByRole('button', { name: /^Delete entry: create_table/ }));
    await waitFor(() => expect(api.deleteLakehouseJournalEntry).toHaveBeenCalledWith('e1'));
    expect(await screen.findByText('Nothing yet. Run something in a station.')).toBeInTheDocument();
  });

  it('says what failed to load, and retries', async () => {
    vi.mocked(api.getLakehouseEngine).mockRejectedValueOnce({ response: { status: 500, data: { detail: 'Server error.' } } });
    renderPage();
    expect(await screen.findByText('The Lakehouse Lab did not load.')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { level: 2, name: /Station C/ })).toBeInTheDocument();
  });
});
