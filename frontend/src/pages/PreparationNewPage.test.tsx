// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { PreparationNewPage, packMatchingName } from './PreparationNewPage';
import type { ContentPackSummary } from '../types/contentPack';

const PACKS: ContentPackSummary[] = [
  { pack_id: 'adf', latest_version: 1, title: 'Azure Data Factory', summary: 's', chapter_count: 21, scenario_count: 18, written_scenario_count: 4 },
  { pack_id: 'adls', latest_version: 1, title: 'Azure Data Lake Storage Gen2', summary: 's', chapter_count: 11, scenario_count: 0, written_scenario_count: 0 },
];

describe('packMatchingName', () => {
  it('matches a pack whose title the typed name contains', () => {
    expect(packMatchingName(PACKS, 'Azure Data Factory')?.pack_id).toBe('adf');
  });

  it('matches case-insensitively either direction', () => {
    expect(packMatchingName(PACKS, 'adf')?.pack_id).toBe('adf');
    expect(packMatchingName(PACKS, 'my azure data lake storage gen2 prep')?.pack_id).toBe('adls');
  });

  it('preselects nothing for an unrelated name', () => {
    expect(packMatchingName(PACKS, 'Apache Kafka')).toBeNull();
  });

  it('preselects nothing for an empty name', () => {
    expect(packMatchingName(PACKS, '   ')).toBeNull();
  });
});

const api = {
  createSubject: vi.fn(), getContentPacks: vi.fn(), attachContentPack: vi.fn(),
};
vi.mock('../services/api', () => ({
  createSubject: (...a: any[]) => api.createSubject(...a),
  getContentPacks: (...a: any[]) => api.getContentPacks(...a),
  attachContentPack: (...a: any[]) => api.attachContentPack(...a),
}));

const select = vi.fn();
const refresh = vi.fn();
vi.mock('../context/PreparationContext', () => ({
  usePreparation: () => ({ select, refresh }),
}));

const renderPage = () => render(<MemoryRouter><PreparationNewPage /></MemoryRouter>);

beforeEach(() => {
  api.createSubject.mockReset().mockResolvedValue({ id: 7, name: 'Azure Data Factory' });
  api.getContentPacks.mockReset().mockResolvedValue(PACKS);
  api.attachContentPack.mockReset().mockResolvedValue({});
  refresh.mockReset().mockResolvedValue(undefined);
  select.mockReset();
});

describe('PreparationNewPage: the pack-choice step', () => {
  it('preselects the matching pack once the learner names the skill after it', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('An open-ended capability'));
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Azure Data Factory');

    const adfRadio = await screen.findByRole('radio', { name: /Azure Data Factory/ });
    expect(adfRadio).toBeChecked();
  });

  it('leaves "Start empty" selected for a name that matches no pack', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('An open-ended capability'));
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Apache Kafka');

    expect(await screen.findByRole('radio', { name: 'Start empty' })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Azure Data Factory/ })).not.toBeChecked();
  });

  it('attaches the chosen pack after creating the preparation', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('An open-ended capability'));
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Azure Data Factory');
    await screen.findByRole('radio', { name: /Azure Data Factory/, checked: true } as any);

    await user.click(screen.getByRole('button', { name: /Create preparation/ }));

    expect(api.createSubject).toHaveBeenCalledWith(expect.objectContaining({ kind: 'skill' }));
    expect(api.attachContentPack).toHaveBeenCalledWith(7, 'adf');
  });
});
