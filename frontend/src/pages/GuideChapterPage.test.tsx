// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { GuideChapterPage } from './GuideChapterPage';

const api = { getContentPack: vi.fn() };
vi.mock('../services/api', () => ({
  getContentPack: (...a: any[]) => api.getContentPack(...a),
}));

let selected: any = null;
vi.mock('../context/PreparationContext', () => ({
  usePreparation: () => ({ selected }),
}));

const PACK = {
  pack_id: 'adf', version: 2, title: 'Azure Data Factory', summary: 's',
  docs_url: 'https://example.test/adf', source_notes: 'n',
  chapters: [
    { id: 'what-it-is', title: 'What it is', summary: 'sum', sources: '§1', blocks: [{ md: 'Some text.' }], practice_links: [] },
    { id: 'building-blocks', title: 'Building blocks', summary: 'sum2', sources: '§2', blocks: [{ md: 'More text.' }], practice_links: [] },
  ],
  scenario_levels: [], diagnostic_questions: [],
};

const renderPage = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes><Route path="/learn/guides/:packId/:chapterId" element={<GuideChapterPage />} /></Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  api.getContentPack.mockReset().mockResolvedValue(PACK);
  selected = null;
});

describe('GuideChapterPage: version selection', () => {
  it('fetches the pinned version when the preparation has attached the pack', async () => {
    selected = { id: 1, name: 'Audit Skill', content_packs: [{ pack_id: 'adf', pack_version: 2, latest_version: 2, title: 'Azure Data Factory' }] };

    renderPage('/learn/guides/adf/what-it-is');

    expect(await screen.findByRole('heading', { name: /1 · What it is/ })).toBeInTheDocument();
    expect(api.getContentPack).toHaveBeenCalledWith('adf', 2);
    expect(screen.queryByText(/Not attached/)).not.toBeInTheDocument();
  });

  it('says the pack is not attached when the preparation has no link, and still shows the chapter', async () => {
    selected = { id: 1, name: 'Audit Skill', content_packs: [] };

    renderPage('/learn/guides/adf/what-it-is');

    expect(await screen.findByText(/Not attached to Audit Skill/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /1 · What it is/ })).toBeInTheDocument();
  });

  it('shows "Chapter not found" for an unknown chapter id, with a way back', async () => {
    renderPage('/learn/guides/adf/no-such-chapter');

    expect(await screen.findByRole('heading', { name: 'Chapter not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to Azure Data Factory/ })).toBeInTheDocument();
  });
});
