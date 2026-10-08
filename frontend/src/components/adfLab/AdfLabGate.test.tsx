// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// An incomplete registry: one experiment not built makes the lab INTEGRATION_PENDING again.
vi.mock('../../services/adfLab/experiments', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../services/adfLab/experiments')>();
  const incomplete = real.ADF_LAB_EXPERIMENTS.map((e, i) => (i === 0 ? { ...e, ready: false } : e));
  return { ...real, ADF_LAB_EXPERIMENTS: incomplete, adfLabStatus: () => real.adfLabStatus(incomplete) };
});

import { IntegrationNotice } from './AdfLabGate';
import { getSubjectCapabilities } from '../../services/capabilities';
import type { Subject } from '../../types/subject';

const ADF = {
  id: 6, name: 'Azure Data Factory', slug: 'adf', kind: 'skill', is_archived: false, display_order: 100,
  has_exam_profile: false, question_count: 0, content_packs: [{ pack_id: 'adf', pack_version: 1 }],
  readiness: { state: 'needs_evaluation', mock_count: 0, recent_scores: [] },
} as unknown as Subject;

describe('the lab while an experiment is not built', () => {
  it('is INTEGRATION_PENDING, for the seeded ADF preparation and a learner’s own with the ADF pack', () => {
    expect(getSubjectCapabilities(ADF).learningLabStatus).toBe('INTEGRATION_PENDING');
    expect(getSubjectCapabilities({ ...ADF, id: 42, slug: 'my-adf' }).learningLabStatus).toBe('INTEGRATION_PENDING');
  });

  it('says so on its pages', () => {
    render(<IntegrationNotice prep={ADF} />);
    expect(screen.getByText(/Integration in progress/)).toBeInTheDocument();
  });
});
