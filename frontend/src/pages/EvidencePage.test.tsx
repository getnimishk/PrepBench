// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { UNASSIGNED_CAPABILITIES } from '../services/capabilities';
import type { EvidenceItem, EvidenceResponse } from '../types/portfolio';

const getEvidence = vi.fn();
vi.mock('../services/api', () => ({ getEvidence: (...a: any[]) => getEvidence(...a) }));

let preparation: any;
vi.mock('../context/PreparationContext', () => ({ usePreparation: () => preparation }));

import { EvidencePage } from './EvidencePage';

const SKILL = { ...UNASSIGNED_CAPABILITIES, learningLabStatus: 'AVAILABLE', scenarios: true, workspace: true, evidence: true };
const CERT = { ...UNASSIGNED_CAPABILITIES, certification: true, questionAvailability: true, workspace: true, evidence: true };
const ev = (over: Partial<EvidenceItem>): EvidenceItem => ({
  id: 'x', source: 'learning_lab', kind: 'lab_stage', level: 'demonstrated', assessed_by: 'model', title: 'Watermark',
  demonstrates: 'Predict · run 1', basis: "Prediction checked against the model's outcome: correct",
  href: '/lab/adf/watermark', at: '2026-10-07T10:00:00', ref: {}, ...over,
});
const response = (sid: number | null, items: EvidenceItem[]): EvidenceResponse => {
  const counts = { activity: 0, completed: 0, demonstrated: 0, evidenced: 0 };
  for (const i of items) counts[i.level] += 1;
  return { subject_id: sid, counts, items };
};
const renderPage = () => render(<MemoryRouter><EvidencePage /></MemoryRouter>);

beforeEach(() => {
  getEvidence.mockReset();
  preparation = { selected: { id: 7, name: 'ADF skill' }, selectedId: 7, loading: false, capabilities: SKILL };
});

describe('EvidencePage', () => {
  it('shows each item\'s level, its basis and who judged it, counted by level', async () => {
    getEvidence.mockImplementation(async (sid: number | null) => (sid === 7
      ? response(7, [
        ev({ id: 'p', level: 'evidenced', ref: { track: 'watermark', run: '1', stage: 'predict' },
          basis: "Prediction checked against the model's outcome: correct; your explanation is recorded (not graded)" }),
        ev({ id: 'r', level: 'completed', demonstrates: 'Reason · run 1', basis: 'Diagnosis checked: not correct' }),
        ev({ id: 'd', kind: 'topic_demonstration', source: 'roadmap', level: 'completed', assessed_by: 'self',
          title: 'Watermark Patterns', demonstrates: 'ADF roadmap', basis: "Written demonstration, self-graded 'yes'" }),
      ])
      : response(null, [])));
    renderPage();

    const own = await screen.findByRole('region', { name: 'ADF skill' });
    expect(await within(own).findByRole('heading', { level: 3, name: 'Watermark & Transient Failure · Predict · run 1' })).toBeInTheDocument();
    expect(within(own).getByText(/your explanation is recorded \(not graded\)/)).toBeInTheDocument();
    expect(within(own).getAllByText('Self-assessed', { exact: false })).not.toHaveLength(0);
    // Counts come from the server's record, one figure per level.
    const metric = (label: string) => Array.from(own.querySelectorAll('strong'))
      .find((s) => s.nextElementSibling?.textContent === label)?.textContent;
    expect([metric('Evidenced'), metric('Demonstrated'), metric('Completed'), metric('Activity')]).toEqual(['1', '0', '2', '0']);
    expect(getEvidence).toHaveBeenCalledWith(7);
    expect(getEvidence).toHaveBeenCalledWith(null);
  });

  it('filters by level', async () => {
    const user = userEvent.setup();
    getEvidence.mockImplementation(async (sid: number | null) => (sid === 7
      ? response(7, [ev({ id: 'a', title: 'Alpha', level: 'evidenced' }), ev({ id: 'b', title: 'Beta', level: 'completed' })])
      : response(null, [])));
    renderPage();
    const own = await screen.findByRole('region', { name: 'ADF skill' });
    await within(own).findByText(/^Beta/);
    await user.click(within(own).getByRole('button', { name: 'Completed' }));
    expect(within(own).queryByText(/^Alpha/)).not.toBeInTheDocument();
    expect(within(own).getByText(/^Beta/)).toBeInTheDocument();
  });

  it('keeps readiness on Certification: it links there for a certification, and claims nothing itself', async () => {
    preparation = { selected: { id: 1, name: 'PSM I' }, selectedId: 1, loading: false, capabilities: CERT };
    getEvidence.mockImplementation(async (sid: number | null) => (sid === 1
      ? response(1, [ev({ id: 'm', kind: 'mock_exam', source: 'certification', assessed_by: 'exam', title: 'Mock 1',
        demonstrates: 'Exam performance under timed conditions',
        basis: 'Scored 88% on a full mock, at or above the 85% pass mark. Readiness to pass is decided on Certification, not here' })])
      : response(null, [])));
    renderPage();
    expect(await screen.findByRole('link', { name: 'Check exam readiness' })).toHaveAttribute('href', '/certification');
    expect(screen.getByText(/Evidence is not a readiness verdict/)).toBeInTheDocument();
    expect(screen.queryByText(/ready to pass\b(?!.*decided)/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\bREADY\b/)).not.toBeInTheDocument();
  });

  it('a skill gets no readiness link, and an empty preparation is told what would create evidence', async () => {
    getEvidence.mockResolvedValue(response(7, []));
    renderPage();
    const own = await screen.findByRole('region', { name: 'ADF skill' });
    expect(await within(own).findByText('No evidence yet')).toBeInTheDocument();
    expect(within(own).getByRole('link', { name: 'Run an experiment' })).toHaveAttribute('href', '/lab');
    expect(within(own).queryByRole('link', { name: 'Sit a full mock' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Check exam readiness' })).not.toBeInTheDocument();
  });

  it('does not offer a mock for a certification with no questions loaded', async () => {
    preparation = { selected: { id: 4, name: 'Kafka CCDAK' }, selectedId: 4, loading: false,
      capabilities: { ...CERT, questionAvailability: false } };
    getEvidence.mockResolvedValue(response(4, []));
    renderPage();
    const own = await screen.findByRole('region', { name: 'Kafka CCDAK' });
    expect(await within(own).findByText('No evidence yet')).toBeInTheDocument();
    expect(within(own).queryByRole('link', { name: 'Sit a full mock' })).not.toBeInTheDocument();
  });

  it('with no preparation chosen, shows only work that belongs to none', async () => {
    preparation = { selected: null, selectedId: null, loading: false, capabilities: UNASSIGNED_CAPABILITIES };
    getEvidence.mockResolvedValue(response(null, [ev({ id: 's', kind: 'system_design', source: 'interview', level: 'completed',
      assessed_by: 'ai', title: 'URL shortener', demonstrates: 'System design answer',
      basis: 'Answer submitted; graded by AI, which is not a verified grade' })]));
    renderPage();
    expect(await screen.findByText(/No preparation is chosen/)).toBeInTheDocument();
    const unowned = screen.getByRole('region', { name: 'Not tied to a preparation' });
    expect(await within(unowned).findByText('AI-assessed, not verified', { exact: false })).toBeInTheDocument();
    await waitFor(() => expect(getEvidence).toHaveBeenCalledTimes(1));
    expect(getEvidence).toHaveBeenCalledWith(null);
  });
});
