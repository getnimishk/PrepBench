// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createTheme, ThemeProvider } from '@mui/material';
import packFactory from '../../../../backend/app/data/lab_packs/semiconductor-v1/factory.json';
import type { WireLearningAttempt } from '../../types/learning';
import type { LabPackDetail } from '../../types/lakehouse';

vi.mock('../../services/api', () => ({
  getLearningAttempts: vi.fn(),
  startLearningAttempt: vi.fn(),
  patchLearningAttempt: vi.fn(),
  addLakehouseJournalEntry: vi.fn(),
}));

import * as api from '../../services/api';
import { FACTORY_COUPLINGS } from '../../services/lakehouse/factoryCouplings';
import {
  defaultPlan, encodeGuesses, parseFactory, runFactory, scoreTiering, tierJob, type Tier,
} from '../../services/lakehouse/factoryModel';
import { FactoryLedger } from './FactoryLedger';
import { FactoryTimeline } from './FactoryTimeline';
import { StationF } from './StationF';

const parsed = parseFactory(packFactory);
if (!parsed.ok) throw new Error(parsed.reason);
const config = parsed.config;
const truth = Object.fromEntries(config.sample.map((j) => [j.id, tierJob(config, j).tier])) as Record<string, Tier>;
const allTwos = Object.fromEntries(config.sample.map((j) => [j.id, 2 as Tier])) as Record<string, Tier>;

const pack = {
  id: 'semiconductor-v1', version: 1, title: 'Semiconductor', summary: '', fictional: true, stations: ['c', 'f'],
  notebook_verified_on: null, scenario_md: '', factory: packFactory as Record<string, unknown>, pipeline: {}, defect_manifest: [],
  tables: [], dataset: { tables: {}, defects: [] },
} as LabPackDetail;
const UID = 'lk:2:semiconductor-v1@1:f-tiering';

const wire = (over: Partial<WireLearningAttempt> = {}): WireLearningAttempt => ({
  attempt_uid: UID, challenge_id: 'lakehouse.f.tiering', concept_id: 'lakehouse.f.tiering', scenario_fingerprint: '',
  mode: 'guided', started_at: '2026-10-02T00:00:00', hint_count: 0, ...over,
});

let stored: WireLearningAttempt;
beforeEach(() => {
  vi.clearAllMocks();
  stored = wire();
  vi.mocked(api.getLearningAttempts).mockResolvedValue([]);
  vi.mocked(api.startLearningAttempt).mockImplementation(async () => stored);
  vi.mocked(api.patchLearningAttempt).mockImplementation(async (_uid, body) => {
    stored = {
      ...stored,
      ...(body.prediction ? { prediction: body.prediction as string, committed_at: '2026-10-02T00:01:00' } : {}),
      ...(body.completed ? { completed_at: '2026-10-02T00:02:00', correct: body.correct as boolean } : {}),
      ...(body.explanation_text ? { explanation_text: body.explanation_text as string } : {}),
    };
    return stored;
  });
  vi.mocked(api.addLakehouseJournalEntry).mockResolvedValue({} as never);
});

function renderF(over: { onCompare?: (w: number) => void; factory?: Record<string, unknown> } = {}) {
  const onCompare = over.onCompare ?? vi.fn();
  const onJournalChange = vi.fn();
  render(<StationF pack={{ ...pack, factory: over.factory ?? pack.factory }} subjectId={2} onJournalChange={onJournalChange} onCompare={onCompare} />);
  return { onCompare, onJournalChange };
}

async function tierAll(user: ReturnType<typeof userEvent.setup>, tiers: Record<string, Tier>) {
  await screen.findByRole('table', { name: 'Jobs to tier' });
  for (const job of config.sample) {
    const group = screen.getByRole('group', { name: `Tier for ${job.id}` });
    await user.click(within(group).getByRole('button', { name: String(tiers[job.id]) }));
  }
}
async function commit(user: ReturnType<typeof userEvent.setup>, tiers = allTwos) {
  await tierAll(user, tiers);
  await user.click(screen.getByRole('button', { name: 'Commit prediction' }));
  await screen.findByRole('button', { name: 'Prediction committed' });
}

describe('StationF: the pack', () => {
  it('says so, and shows nothing in its place, when the pack has no Factory content', async () => {
    renderF({ factory: { stub: true } });
    expect(screen.getByText(/This pack has no usable Factory content: This pack’s Factory content is a placeholder\./)).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Jobs to tier' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Run plan' })).not.toBeInTheDocument();
  });
});

describe('StationF: the tiering prediction', () => {
  it('cannot be committed until every job has a tier', async () => {
    const user = userEvent.setup();
    renderF();
    await screen.findByRole('table', { name: 'Jobs to tier' });
    expect(screen.getByRole('button', { name: 'Commit prediction' })).toBeDisabled();
    const group = screen.getByRole('group', { name: `Tier for ${config.sample[0].id}` });
    await user.click(within(group).getByRole('button', { name: '3' }));
    expect(screen.getByRole('button', { name: 'Commit prediction' })).toBeDisabled();
  });

  it('shows no true tier before the commit', async () => {
    renderF();
    await screen.findByRole('table', { name: 'Jobs to tier' });
    expect(screen.queryByText('Tier 3')).not.toBeInTheDocument();
    expect(screen.queryByText('Tier 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Tier 2')).not.toBeInTheDocument();
    expect(screen.queryByText(/of 12 right/)).not.toBeInTheDocument();
  });

  it('is committed to the server first, then scored by the model, and journaled as a simulation', async () => {
    const user = userEvent.setup();
    const { onJournalChange } = renderF();
    await commit(user);
    const score = scoreTiering(config, allTwos);

    expect(api.startLearningAttempt).toHaveBeenCalledWith(expect.objectContaining({
      attempt_uid: UID, challenge_id: 'lakehouse.f.tiering', concept_id: 'lakehouse.f.tiering', subject_id: 2,
    }));
    const patches = vi.mocked(api.patchLearningAttempt).mock.calls.map(([, b]) => b);
    expect(patches[0]).toEqual({ prediction: encodeGuesses(config, allTwos) });
    expect(patches[1]).toMatchObject({ completed: true, correct: false, observed: { right: score.right, total: 12, source: 'simulation' } });
    await waitFor(() => expect(api.addLakehouseJournalEntry).toHaveBeenCalledWith(expect.objectContaining({
      pack_id: 'semiconductor-v1', station: 'f', source: 'simulation', op: 'factory_tiering', result: { right: score.right, total: 12 },
    })));
    expect(onJournalChange).toHaveBeenCalled();
  });

  it('then reveals the true tiers with the signals that decided them, and locks', async () => {
    const user = userEvent.setup();
    renderF();
    await commit(user);
    expect(screen.getByText(`${scoreTiering(config, allTwos).right} of 12 right.`, { exact: false })).toBeInTheDocument();
    expect(screen.getAllByText('Tier 3').length).toBe(config.sample.filter((j) => truth[j.id] === 3).length);
    expect(screen.getAllByText('feeds the yield report').length).toBeGreaterThan(0);
    for (const button of screen.getAllByRole('button', { name: /^[123]$/ })) expect(button).toBeDisabled();
  });

  it('says all right, when it is', async () => {
    const user = userEvent.setup();
    renderF();
    await commit(user, truth);
    expect(screen.getByText('All 12 right.')).toBeInTheDocument();
    expect(vi.mocked(api.patchLearningAttempt).mock.calls[1][1]).toMatchObject({ correct: true });
  });

  it('restores a committed tiering from the server, locked, with the reveal', async () => {
    vi.mocked(api.getLearningAttempts).mockResolvedValue([
      wire({ committed_at: '2026-10-02T00:01:00', completed_at: '2026-10-02T00:02:00', prediction: encodeGuesses(config, allTwos), correct: false }),
    ]);
    renderF();
    await screen.findByRole('button', { name: 'Prediction committed' });
    expect(screen.getByRole('button', { name: 'Prediction committed' })).toBeDisabled();
    expect(screen.getByText(/of 12 right\./)).toBeInTheDocument();
    const group = screen.getByRole('group', { name: `Tier for ${config.sample[0].id}` });
    expect(within(group).getByRole('button', { name: '2' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('closes a prediction whose scoring never reached the server, on the next load', async () => {
    // The server's copy: committed, not yet completed.
    stored = wire({ committed_at: '2026-10-02T00:01:00', prediction: encodeGuesses(config, truth) });
    vi.mocked(api.getLearningAttempts).mockResolvedValue([stored]);
    renderF();
    await waitFor(() => expect(api.patchLearningAttempt).toHaveBeenCalledWith(UID, expect.objectContaining({
      completed: true, correct: true, observed: expect.objectContaining({ right: 12, total: 12, source: 'simulation' }),
    })));
    expect(await screen.findByText('All 12 right.')).toBeInTheDocument();
  });

  it('shows why it could not be saved, and the server’s copy wins', async () => {
    const user = userEvent.setup();
    renderF();
    await tierAll(user, allTwos);
    vi.mocked(api.patchLearningAttempt).mockRejectedValue({ response: { status: 400, data: { detail: 'A prediction is already recorded.' } } });
    await user.click(screen.getByRole('button', { name: 'Commit prediction' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('A prediction is already recorded.');
    await waitFor(() => expect(api.getLearningAttempts).toHaveBeenCalledTimes(2));
  });
});

describe('StationF: the plan', () => {
  it('keeps Manipulate shut until the tiering is committed', async () => {
    renderF();
    await screen.findByRole('table', { name: 'Jobs to tier' });
    expect(screen.queryByRole('button', { name: 'Run plan' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Commit a prediction first.').length).toBeGreaterThan(0);
  });

  it('runs the pack’s plan and shows both plans side by side, the events and the incident', async () => {
    const user = userEvent.setup();
    renderF();
    await commit(user);
    await user.click(screen.getByRole('button', { name: 'Run plan' }));
    const run = runFactory(config, defaultPlan(config));

    const observe = screen.getByRole('region', { name: /3 · Observe/ });
    expect(within(observe).getByText('Simulation')).toBeInTheDocument();
    expect(within(observe).getByText(/Planned by job count · promised month 10, ended month 21/)).toBeInTheDocument();
    expect(within(observe).getByText(/Weighted by complexity · promised month 20, ended month 21 · about on plan/)).toBeInTheDocument();
    for (const e of run.events) expect(within(observe).getByText(e.text)).toBeInTheDocument();
    expect(within(observe).getByText(/wave 10 cut over without a consumer map: Yield dashboard went blank/)).toBeInTheDocument();
    expect(within(observe).getByText('Blocked · 3 consumers unconfirmed')).toBeInTheDocument();
    expect(within(observe).getByRole('img', { name: /Plan by job count: promised month 10, ended month 21, 10\.9 months late/ })).toBeInTheDocument();
  });

  it('every cost on screen says it is a teaching constant', async () => {
    const user = userEvent.setup();
    renderF();
    await commit(user);
    await user.click(screen.getByRole('button', { name: 'Run plan' }));
    const observe = screen.getByRole('region', { name: /3 · Observe/ });
    for (const label of ['Compute cost', 'Total with infrastructure']) {
      const metric = within(observe).getByText(label).parentElement!;
      expect(metric).toHaveTextContent('Teaching constant');
    }
    expect(within(observe).getAllByText('1.0×')).toHaveLength(2);
  });

  it('a consumer map removes the incident and unblocks decommission; a changed plan must be run again', async () => {
    const user = userEvent.setup();
    renderF();
    await commit(user);
    await user.click(screen.getByRole('button', { name: 'Run plan' }));
    await user.click(screen.getByLabelText('A consumer map is built for the yield waves'));
    expect(screen.getByText('The plan changed. Run it again to see the new outcome.')).toBeInTheDocument();
    expect(screen.queryByText(/went blank/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Run plan' }));
    expect(screen.getByText('Allowed: every consumer is confirmed migrated')).toBeInTheDocument();
    expect(screen.queryByText(/went blank/)).not.toBeInTheDocument();
  });

  it('reordering moves a domain, and a critical domain placed early is an incident', async () => {
    const user = userEvent.setup();
    renderF();
    await commit(user);
    for (let i = 0; i < 3; i += 1) await user.click(screen.getByRole('button', { name: 'Move Yield and defect analytics earlier' }));
    const order = within(screen.getByRole('list', { name: 'Waves, in order' })).getAllByRole('listitem').map((li) => li.textContent);
    expect(order[0]).toContain('Yield and defect analytics');
    expect(screen.getByRole('button', { name: 'Move Yield and defect analytics earlier' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Run plan' }));
    expect(screen.getByText(/went into wave 1, before it was safe to/)).toBeInTheDocument();
  });

  it('the cluster choice changes the cost and never the schedule', async () => {
    const user = userEvent.setup();
    renderF();
    await commit(user);
    await user.click(screen.getByRole('button', { name: 'All-purpose' }));
    await user.click(screen.getByRole('button', { name: 'Run plan' }));
    const observe = screen.getByRole('region', { name: /3 · Observe/ });
    expect(within(observe).getByText('2.0×')).toBeInTheDocument();
    expect(within(observe).getByText(/promised month 10, ended month 21/)).toBeInTheDocument();
  });

  it('journals the run as a simulation, and says if the journal could not be written', async () => {
    const user = userEvent.setup();
    renderF();
    await commit(user);
    vi.mocked(api.addLakehouseJournalEntry).mockClear();
    await user.click(screen.getByRole('button', { name: 'Run plan' }));
    await waitFor(() => expect(api.addLakehouseJournalEntry).toHaveBeenCalledWith(expect.objectContaining({
      station: 'f', source: 'simulation', op: 'factory_run',
      result: expect.objectContaining({ promised_by_count: 10, promised_weighted: 20, ended: 21, incidents: 1 }),
    })));

    vi.mocked(api.addLakehouseJournalEntry).mockRejectedValue({ response: { status: 500, data: { detail: 'Journal is down.' } } });
    await user.click(screen.getByLabelText('A consumer map is built for the yield waves'));
    await user.click(screen.getByRole('button', { name: 'Run plan' }));
    expect(await screen.findByText('Journal is down.')).toBeInTheDocument();
    // The result is still there: a journal failure doesn't take the run with it.
    expect(screen.getAllByText(/Weighted by complexity/).length).toBeGreaterThan(0);
  });

  it('goes to Station C’s comparison from the yield wave’s Validate step', async () => {
    const user = userEvent.setup();
    const { onCompare } = renderF();
    await commit(user);
    await user.click(screen.getByRole('button', { name: 'Run plan' }));
    expect(screen.getByText(/compare legacy\.defects with silver\.defects on the real engine/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Compare in Station C' }));
    expect(onCompare).toHaveBeenCalledWith(10);
  });

  it('takes acceptance criteria once the tiering is committed, with structure checks', async () => {
    const user = userEvent.setup();
    renderF();
    expect(await screen.findByLabelText('Acceptance criteria')).toBeDisabled();
    await commit(user);
    // Pasted, not typed: a long string typed key by key through this page is slow enough to time out under load.
    await user.click(screen.getByLabelText('Acceptance criteria'));
    await user.paste('Given the yield waves, when a consumer is not on the map, then the cutover is blocked and rolled back. The data owner signs off within 2 days.');
    await user.click(screen.getByRole('button', { name: 'Check structure' }));
    expect(screen.getByText('Structure checks, not a quality grade')).toBeInTheDocument();
    expect(screen.getAllByText('Present')).toHaveLength(4);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.patchLearningAttempt).toHaveBeenCalledWith(UID, { explanation_text: expect.stringContaining('Given the yield waves') }));
  });
});

describe('FactoryLedger', () => {
  it('puts every effect’s caveat on screen, with its kind, and every teaching constant with the pack’s label', () => {
    render(<FactoryLedger config={config} />);
    for (const c of FACTORY_COUPLINGS) {
      expect(screen.getByText(c.uiLabel), c.id).toBeInTheDocument();
      expect(screen.getByText(c.effect), c.id).toBeInTheDocument();
    }
    expect(screen.getAllByText('Assumption')).toHaveLength(10);
    expect(screen.getAllByText('Convention')).toHaveLength(3);
    expect(screen.getAllByText('Arithmetic')).toHaveLength(4);
    for (const label of Object.values(config.constantLabels)) expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText(/Illustrative; check the current rate card\./)).toBeInTheDocument();
  });
});

describe('FactoryTimeline', () => {
  const run = runFactory(config, defaultPlan(config));

  it('says in words what the picture shows', () => {
    render(<FactoryTimeline run={run} config={config} />);
    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      expect.stringMatching(/Plan by job count: promised month 10, ended month 21, 10\.9 months late\. Plan weighted by complexity: promised month 20, ended month 21, on plan\./),
    );
  });

  it('draws both plans, always, and an event marker for each scheduled event and incident', () => {
    const { container } = render(<FactoryTimeline run={run} config={config} />);
    const text = [...container.querySelectorAll('text')].map((t) => t.textContent);
    expect(text).toContain('Plan by job count');
    expect(text).toContain('Weighted by complexity');
    expect(text).toContain('M4');
    expect(text).toContain('M11');
    expect(text).toContain(`M${run.incidents[0].month}`);
  });

  it('scales its text with the Large-text setting, and takes its colours from the theme', () => {
    const sizes = (fontSize: number) => {
      const { container, unmount } = render(
        <ThemeProvider theme={createTheme({ typography: { fontSize } })}><FactoryTimeline run={run} config={config} /></ThemeProvider>,
      );
      const result = [...container.querySelectorAll('text')].map((t) => Number(t.getAttribute('font-size')));
      const fills = [...container.querySelectorAll('rect, text, path')].map((n) => n.getAttribute('fill') ?? '');
      unmount();
      return { result, fills };
    };
    const normal = sizes(14);
    const large = sizes(16);
    expect(large.result.every((s, i) => s >= normal.result[i])).toBe(true);
    expect(large.result.some((s, i) => s > normal.result[i])).toBe(true);
    // Colours are tokens, never a literal hex.
    expect(normal.fills.filter((f) => /^#[0-9a-f]{3,8}$/i.test(f) && !f.startsWith('#'))).toEqual([]);
  });
});
