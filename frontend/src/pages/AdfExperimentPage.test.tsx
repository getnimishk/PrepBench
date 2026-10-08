// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// An experiment the registry has not marked built must say so, not open half a lab.
vi.mock('../services/adfLab/experiments', async (importOriginal) => {
  const real = await importOriginal<typeof import('../services/adfLab/experiments')>();
  return { ...real, adfLabExperiment: (slug: string | undefined) => { const e = real.adfLabExperiment(slug); return e ? { ...e, ready: false } : null; } };
});
vi.mock('../context/PreparationContext', () => ({
  usePreparation: () => ({
    selected: { id: 6, name: 'ADF', slug: 'adf', kind: 'skill', content_packs: [{ pack_id: 'adf', pack_version: 1 }] },
    selectedId: 6, loading: false,
  }),
}));

import { AdfExperimentPage } from './AdfExperimentPage';

describe('an experiment that is not built', () => {
  it('says so, and opens no stage', async () => {
    render(
      <MemoryRouter initialEntries={['/lab/adf/triggers']}>
        <Routes><Route path="/lab/adf/:slug" element={<AdfExperimentPage />} /></Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText(/This experiment is not built yet/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue to Predict' })).not.toBeInTheDocument();
  });
});
