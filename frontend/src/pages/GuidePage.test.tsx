// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { GuidePage } from './GuidePage';

const api = { getContentPack: vi.fn() };
vi.mock('../services/api', () => ({
  getContentPack: (...a: any[]) => api.getContentPack(...a),
}));

let selected: any = null;
vi.mock('../context/PreparationContext', () => ({
  usePreparation: () => ({ selected }),
}));

const PACK_V1 = {
  pack_id: 'adf', version: 1, title: 'Azure Data Factory', summary: 's',
  docs_url: 'https://example.test/adf', source_notes: 'n',
  chapters: [{ id: 'what-it-is', title: 'What it is', summary: 'sum', sources: '§1', blocks: [], practice_links: [] }],
  scenario_levels: [], diagnostic_questions: [],
};
const PACK_V2 = { ...PACK_V1, version: 2 };

const renderPage = () => render(
  <MemoryRouter initialEntries={['/learn/guides/adf']}>
    <Routes><Route path="/learn/guides/:packId" element={<GuidePage />} /></Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  api.getContentPack.mockReset();
  selected = null;
});

describe('GuidePage: version selection', () => {
  it('fetches the preparation-pinned version and shows no "not attached" note', async () => {
    selected = { id: 1, name: 'Audit Skill', content_packs: [{ pack_id: 'adf', pack_version: 1, latest_version: 2, title: 'Azure Data Factory' }] };
    api.getContentPack.mockResolvedValue(PACK_V1);

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Azure Data Factory' })).toBeInTheDocument();
    expect(api.getContentPack).toHaveBeenCalledWith('adf', 1);
    expect(screen.queryByText(/Not attached/)).not.toBeInTheDocument();
  });

  it('fetches the latest version and says so when the preparation has no link', async () => {
    selected = { id: 1, name: 'Audit Skill', content_packs: [] };
    api.getContentPack.mockResolvedValue(PACK_V2);

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Azure Data Factory' })).toBeInTheDocument();
    expect(api.getContentPack).toHaveBeenCalledWith('adf', undefined);
    expect(await screen.findByText(/Not attached to Audit Skill/)).toBeInTheDocument();
  });

  it('fetches the latest version and says so when no preparation is selected', async () => {
    selected = null;
    api.getContentPack.mockResolvedValue(PACK_V2);

    renderPage();

    expect(await screen.findByText(/No preparation selected/)).toBeInTheDocument();
  });
});
