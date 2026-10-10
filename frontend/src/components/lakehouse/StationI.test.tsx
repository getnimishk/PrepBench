// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { WireLearningAttempt } from '../../types/learning';
import type { LabPackDetail } from '../../types/lakehouse';

vi.mock('../../services/api', () => ({
  getLearningAttempts: vi.fn(),
  startLearningAttempt: vi.fn(),
  patchLearningAttempt: vi.fn(),
  addLakehouseJournalEntry: vi.fn(),
  saveInterviewQuestionFromSource: vi.fn(),
  getLakehouseCriteriaFeedback: vi.fn(),
}));

import * as api from '../../services/api';
import { claimsFor } from '../../services/lakehouse/identityModel';
import { sourceById } from '../../services/lakehouse/identitySources';
import { StationI } from './StationI';

const pack = {
  id: 'semiconductor-v1', version: 1, title: 'Semiconductor', summary: '', fictional: true, stations: ['a', 'b', 'c', 'd', 'f', 'i'],
  notebook_verified_on: null, scenario_md: '', factory: {}, pipeline: {}, defect_manifest: [], tables: [], dataset: { tables: {}, defects: [] },
} as unknown as LabPackDetail;

// One stored attempt per challenge, as the server keeps them.
let stored: Record<string, WireLearningAttempt> = {};
beforeEach(() => {
  vi.clearAllMocks();
  stored = {};
  vi.mocked(api.getLearningAttempts).mockImplementation(async () => Object.values(stored));
  vi.mocked(api.startLearningAttempt).mockImplementation(async (body) => {
    const b = body as { attempt_uid: string; challenge_id: string; subject_id?: number };
    stored[b.attempt_uid] = {
      attempt_uid: b.attempt_uid, challenge_id: b.challenge_id, concept_id: b.challenge_id, scenario_fingerprint: '',
      mode: 'guided', started_at: '2026-10-10T00:00:00', hint_count: 0, subject_id: b.subject_id ?? null,
    };
    return stored[b.attempt_uid];
  });
  vi.mocked(api.patchLearningAttempt).mockImplementation(async (uid, body) => {
    stored[uid] = {
      ...stored[uid],
      ...(body.prediction ? { prediction: body.prediction as string, committed_at: '2026-10-10T00:01:00' } : {}),
      ...(body.completed ? { completed_at: '2026-10-10T00:02:00', correct: body.correct as boolean, observed: body.observed as WireLearningAttempt['observed'] } : {}),
      ...(body.explanation_text !== undefined ? { explanation_text: body.explanation_text as string } : {}),
    };
    return stored[uid];
  });
  vi.mocked(api.addLakehouseJournalEntry).mockResolvedValue({} as never);
});

const renderI = () => render(<StationI pack={pack} subjectId={2} onJournalChange={vi.fn()} />);
const observe = () => screen.getByRole('region', { name: /3 · Observe/ });

async function commit(user: ReturnType<typeof userEvent.setup>, option: RegExp | string) {
  await user.click(await screen.findByRole('radio', { name: option }));
  await user.click(screen.getByRole('button', { name: 'Commit prediction' }));
  await screen.findByRole('button', { name: 'Prediction committed' });
}

describe('StationI', () => {
  it('says it is a simulation over a fictional estate, and calls no real system', async () => {
    renderI();
    expect(await screen.findByRole('heading', { level: 2, name: 'Station I · Identity and governance' })).toBeInTheDocument();
    expect(screen.getByText(/A teaching simulation over a fictional estate\. Nothing here calls Microsoft Entra ID, a Kerberos realm, Apache Ranger or Azure Databricks\./)).toBeInTheDocument();
  });

  it('keeps the results hidden until the prediction is committed, so they cannot give it away', async () => {
    renderI();
    await screen.findByRole('radio', { name: 'svc-tool-feed' });
    expect(within(observe()).queryByText(/No token/)).not.toBeInTheDocument();
    expect(within(observe()).getByText(/Commit your prediction to see what the model finds/)).toBeInTheDocument();
  });

  it('commits the identity prediction and closes it with the model’s outcome, as a simulation', async () => {
    const user = userEvent.setup();
    renderI();
    await commit(user, 'svc-tool-feed');
    const calls = vi.mocked(api.patchLearningAttempt).mock.calls;
    expect(calls[0][1]).toEqual({ prediction: 'tool-feed' });
    expect(calls[1][1]).toMatchObject({
      completed: true, correct: true,
      observed: { failing_workload: 'svc-tool-feed', plans_that_work: 3, source: 'simulation' },
    });
    expect(await screen.findByText('Your prediction was right.')).toBeInTheDocument();
    const o = observe();
    expect(within(o).getByText('No token')).toBeInTheDocument();
    expect(within(o).getAllByText('Token from Microsoft Entra ID')).toHaveLength(2);
    expect(within(o).getByText('Token from Azure Databricks')).toBeInTheDocument();
  });

  it('says so when the prediction was the distractor, and that its token comes from Databricks', async () => {
    const user = userEvent.setup();
    renderI();
    await commit(user, 'svc-report-refresh');
    expect(vi.mocked(api.patchLearningAttempt).mock.calls[1][1]).toMatchObject({ correct: false });
    expect(await screen.findByText('Not what the model found.')).toBeInTheDocument();
    expect(within(observe()).getByText('Token from Azure Databricks')).toBeInTheDocument();
  });

  it('re-evaluates the failing workload under each other plan', async () => {
    const user = userEvent.setup();
    renderI();
    await commit(user, 'svc-tool-feed');
    await user.click(screen.getByRole('combobox', { name: /Plan for svc-tool-feed/ }));
    await user.click(await screen.findByRole('option', { name: /Entra app registration/ }));
    const o = observe();
    expect(within(o).queryByText('No token')).not.toBeInTheDocument();
    expect(within(o).getAllByText('Token from Microsoft Entra ID')).toHaveLength(3);
    expect(within(o).getByText(/Every plan can authenticate/)).toBeInTheDocument();
  });

  it('shows every identity fact and assumption, each fact with a link to its source', async () => {
    renderI();
    const panel = await screen.findByRole('region', { name: 'What this puzzle rests on' });
    for (const c of claimsFor('identity')) {
      const item = within(panel).getByText(c.text).closest('li')!;
      if (c.kind === 'fact') {
        expect(within(item).getByText(`${c.id} · From Microsoft Learn:`)).toBeInTheDocument();
        const link = within(item).getByRole('link');
        expect(link).toHaveAttribute('href', sourceById(c.sourceIds[0]).url);
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      } else {
        expect(within(item).getByText(`${c.id} · Simulation assumption:`)).toBeInTheDocument();
        expect(within(item).queryByRole('link')).not.toBeInTheDocument();
      }
    }
  });

  it('runs the governance puzzle as its own attempt, and shows each candidate against the legacy policy', async () => {
    const user = userEvent.setup();
    renderI();
    await user.click(await screen.findByRole('button', { name: 'A Ranger policy, redesigned' }));
    await commit(user, /A row filter function and a column mask function/);
    const calls = vi.mocked(api.patchLearningAttempt).mock.calls;
    expect(calls[0][0]).toContain('i-governance-redesign');
    expect(calls[1][1]).toMatchObject({ completed: true, correct: true, observed: { candidates_checked: 4, source: 'simulation' } });

    await user.click(screen.getByRole('button', { name: /An ABAC DENY policy/ }));
    const o = observe();
    const ben = within(o).getByRole('row', { name: /^ben/ });
    expect(within(ben).getByText('Differs')).toBeInTheDocument();
    expect(within(o).getByText(/This redesign does not keep the policy’s purpose/)).toBeInTheDocument();

    const panel = screen.getByRole('region', { name: 'What this puzzle rests on' });
    // F13–F15 are the Ranger wiki's; every governance fact and assumption is listed.
    expect(within(panel).getAllByText(/From the Apache Ranger wiki:/)).toHaveLength(3);
    for (const c of claimsFor('governance')) expect(within(panel).getByText(c.text)).toBeInTheDocument();
  });

  it('keeps the learner’s governance rationale as their explanation, never scored', async () => {
    const user = userEvent.setup();
    renderI();
    await user.click(await screen.findByRole('button', { name: 'A Ranger policy, redesigned' }));
    await commit(user, /A row filter function and a column mask function/);
    await user.type(screen.getByRole('textbox', { name: /Why your redesign keeps the policy’s purpose/ }), 'The rules live on the table.');
    await user.click(screen.getByRole('button', { name: 'Save rationale' }));
    const calls = vi.mocked(api.patchLearningAttempt).mock.calls;
    const last = calls[calls.length - 1];
    expect(last[1]).toEqual({ explanation_text: 'The rules live on the table.' });
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
  });
});
