// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ContentPackDetail } from '../types/contentPack';
import adfPack from '../../../backend/app/content/packs/adf/v1.json';
import { ScenarioSandboxPage } from './ScenarioSandboxPage';

const ADF = adfPack as unknown as ContentPackDetail;

const api = { getContentPack: vi.fn(), getLearningAttempts: vi.fn() };
vi.mock('../services/api', () => ({
  getContentPack: (...a: any[]) => api.getContentPack(...a),
  getLearningAttempts: (...a: any[]) => api.getLearningAttempts(...a),
}));

let selected: any = null;
vi.mock('../context/PreparationContext', () => ({
  usePreparation: () => ({ selected, loading: false }),
}));

const renderPage = () => render(<MemoryRouter><ScenarioSandboxPage /></MemoryRouter>);

beforeEach(() => {
  api.getContentPack.mockReset().mockResolvedValue(ADF);
  api.getLearningAttempts.mockReset().mockResolvedValue([]);
});

describe('ScenarioSandboxPage', () => {
  it('lists the attached pack\'s scenarios by level, at the pinned version, for the active skill', async () => {
    selected = { id: 7, name: 'ADF skill', kind: 'skill', content_packs: [{ pack_id: 'adf', pack_version: 1, latest_version: 1, title: 'Azure Data Factory' }] };
    api.getLearningAttempts.mockResolvedValue([{
      attempt_uid: 's7:adf@1:1:lens:po', challenge_id: 'adf/1/lens/po', concept_id: 'adf/incremental',
      scenario_fingerprint: 'pack_version=1;lens=po', mode: 'guided', started_at: 't', hint_count: 0,
      prediction: 'case-notes', committed_at: 't', completed_at: 't',
      explanation_text: `Say it: ${(ADF.scenario_levels[0].scenarios[0].content as any).lenses.po.sayIt.question}\nMy answer.`,
    }]);

    renderPage();

    expect(await screen.findByRole('heading', { level: 2, name: 'Azure Data Factory: Moving data' })).toBeInTheDocument();
    expect(api.getContentPack).toHaveBeenCalledWith('adf', 1);
    expect(api.getLearningAttempts).toHaveBeenCalledWith({ subject_id: 7 });
    expect(screen.getAllByRole('link', { name: /^Open scenario / })).toHaveLength(18);
    expect(screen.getByText('Practised · 1 role')).toBeInTheDocument();
    expect(screen.queryAllByText('Not written yet')).toHaveLength(0);
  });

  it('says why there is nothing to practise for a certification', async () => {
    selected = { id: 3, name: 'PSM I', kind: 'certification', content_packs: [] };
    renderPage();
    expect(await screen.findByText(/PSM I is a certification/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Attach a guide' })).not.toBeInTheDocument();
  });

  it('offers to attach a guide to a skill that has none', async () => {
    selected = { id: 8, name: 'Kafka', kind: 'skill', content_packs: [] };
    renderPage();
    expect(await screen.findByText(/Kafka has none attached/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Attach a guide' })).toHaveAttribute('href', '/preparations/8/edit');
  });
});

describe('ScenarioSandboxPage: a pack that will not load', () => {
  it('names it and still lists the scenarios of the packs that did load', async () => {
    selected = {
      id: 7, name: 'Data skill', kind: 'skill',
      content_packs: [
        { pack_id: 'adf', pack_version: 1, latest_version: 1, title: 'Azure Data Factory' },
        { pack_id: 'adls', pack_version: 9, latest_version: 1, title: 'ADLS Gen2' },
      ],
    };
    api.getContentPack.mockImplementation(async (id: string) => {
      if (id === 'adls') throw new Error('Request failed with status code 404');
      return ADF;
    });

    renderPage();

    expect(await screen.findByText(/Couldn.t load ADLS Gen2 \(version 9\)/)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /^Open scenario / })).toHaveLength(18);
  });
});
