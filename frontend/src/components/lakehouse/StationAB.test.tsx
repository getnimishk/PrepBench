// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import pipeline from '../../../../backend/app/data/lab_packs/semiconductor-v1/pipeline.json';
import type { WireLearningAttempt } from '../../types/learning';
import type { LabPackDetail, SourceIndexRow } from '../../types/lakehouse';

vi.mock('../../services/api', () => ({
  getLearningAttempts: vi.fn(),
  startLearningAttempt: vi.fn(),
  patchLearningAttempt: vi.fn(),
  addLakehouseJournalEntry: vi.fn(),
  getLakehouseSourceIndex: vi.fn(),
}));

import * as api from '../../services/api';
import { DEFAULT_LEVERS } from '../../services/lakehouse/adfModel';
import { STATION_A_COUPLINGS, STATION_B_COUPLINGS } from '../../services/lakehouse/pipelineCouplings';
import { clearSourceIndexCache } from '../../services/lakehouse/sourceIndex';
import { StationA } from './StationA';
import { StationB } from './StationB';

// The source index the server sends for the defects table: 5,000 rows, a thousand to a batch.
const DELETED = new Set([40, 250, 480, 730, 910, 1015, 1330, 1580, 1777, 1990]);
const index: SourceIndexRow[] = Array.from({ length: 5000 }, (_, i) => ({
  id: i + 1, modified_at: new Date(Date.UTC(2026, 2, 1) + i * 518_400).toISOString(), deleted: DELETED.has(i + 1), batch: Math.floor(i / 1000) + 1,
}));

const pack = {
  id: 'semiconductor-v1', version: 1, title: 'Semiconductor', summary: '', fictional: true, stations: ['a', 'b', 'c', 'f'],
  notebook_verified_on: null, scenario_md: '', factory: {}, pipeline: pipeline as Record<string, unknown>, defect_manifest: [],
  tables: [], dataset: { tables: {}, defects: [] },
} as LabPackDetail;
const wire = (uid: string, challenge: string, over: Partial<WireLearningAttempt> = {}): WireLearningAttempt => ({
  attempt_uid: uid, challenge_id: challenge, concept_id: challenge, scenario_fingerprint: '', mode: 'guided',
  started_at: '2026-10-02T00:00:00', hint_count: 0, ...over,
});
const A_UID = 'lk:2:semiconductor-v1@1:a-watermark-order';
const B_UID = 'lk:2:semiconductor-v1@1:b-vendor-access';

let stored: WireLearningAttempt;
function serverAttempt(uid: string, challenge: string) {
  stored = wire(uid, challenge);
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
}

beforeEach(() => {
  vi.clearAllMocks();
  clearSourceIndexCache();
  vi.mocked(api.getLakehouseSourceIndex).mockResolvedValue(index);
  vi.mocked(api.addLakehouseJournalEntry).mockResolvedValue({} as never);
});

describe('StationA', () => {
  beforeEach(() => serverAttempt(A_UID, 'lakehouse.a.watermark-order'));

  function renderA(over: { pack?: LabPackDetail; upstream?: typeof DEFAULT_LEVERS } = {}) {
    const onUpstream = vi.fn();
    const onLoadInC = vi.fn();
    const onJournalChange = vi.fn();
    render(<StationA pack={over.pack ?? pack} subjectId={2} upstream={over.upstream ?? DEFAULT_LEVERS} onUpstream={onUpstream} onJournalChange={onJournalChange} onLoadInC={onLoadInC} />);
    return { onUpstream, onLoadInC, onJournalChange };
  }
  async function commit(user: ReturnType<typeof userEvent.setup>, option: RegExp | string) {
    await user.click(await screen.findByRole('radio', { name: option }));
    await user.click(screen.getByRole('button', { name: 'Commit prediction' }));
    await screen.findByRole('button', { name: 'Prediction committed' });
  }
  const observe = () => screen.getByRole('region', { name: /3 · Observe/ });

  it('says so, and shows nothing in its place, when the pack has no pipeline content', async () => {
    renderA({ pack: { ...pack, pipeline: {} } });
    expect(await screen.findByText(/This pack has no usable pipeline content: The pack has no pipeline content for Station A\./)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Run pipeline' })).not.toBeInTheDocument();
  });

  it('keeps Manipulate shut until a prediction is committed', async () => {
    renderA();
    await screen.findByRole('radio', { name: 'Every row, once' });
    expect(screen.queryByRole('button', { name: 'Run pipeline' })).not.toBeInTheDocument();
  });

  it('commits the prediction, closes it with the model’s outcome as a simulation, and reveals which rows were lost', async () => {
    const user = userEvent.setup();
    renderA();
    await commit(user, 'Some rows never arrive');
    expect(api.startLearningAttempt).toHaveBeenCalledWith(expect.objectContaining({ attempt_uid: A_UID, challenge_id: 'lakehouse.a.watermark-order', subject_id: 2 }));
    const patches = vi.mocked(api.patchLearningAttempt).mock.calls.map(([, b]) => b);
    expect(patches[0]).toEqual({ prediction: 'missing' });
    expect(patches[1]).toMatchObject({ completed: true, correct: true, observed: { outcome: 'missing', missed: 400, duplicated: 0, source: 'simulation' } });
    expect(await screen.findByText('Your prediction was right.')).toBeInTheDocument();
    expect(screen.getByText(/400 rows \(ids 1601–2000\) never arrive\./)).toBeInTheDocument();
    await waitFor(() => expect(api.addLakehouseJournalEntry).toHaveBeenCalledWith(expect.objectContaining({
      station: 'a', source: 'simulation', op: 'adf_prediction', result: { outcome: 'missing', missed: 400 },
    })));
  });

  it('says so when the prediction was wrong', async () => {
    const user = userEvent.setup();
    renderA();
    await commit(user, 'Every row, once');
    expect(await screen.findByText('Not what the model found.')).toBeInTheDocument();
    expect(vi.mocked(api.patchLearningAttempt).mock.calls[1][1]).toMatchObject({ correct: false });
  });

  it('runs the challenge’s scenario: the watermark moves first, and 400 rows are lost', async () => {
    const user = userEvent.setup();
    const { onUpstream } = renderA();
    await commit(user, 'Some rows never arrive');
    await user.click(screen.getByRole('button', { name: 'Use this challenge’s scenario' }));
    await user.click(screen.getByRole('button', { name: 'Run pipeline' }));
    expect(within(observe()).getByText('Simulation')).toBeInTheDocument();
    expect(within(observe()).getByText(/Batch 2: 600 of 1,000 rows landed · 400 missed \(ids 1601–2000\)\./)).toBeInTheDocument();
    const steps = within(observe()).getAllByText(/^(Lookup watermark|Update watermark|Copy|Run job)$/).map((e) => e.textContent);
    expect(steps).toEqual(['Lookup watermark', 'Update watermark', 'Copy', 'Run job']);
    expect(onUpstream).toHaveBeenCalledWith(expect.objectContaining({ watermark: 'before', failureAtPercent: 60, retries: 0 }));
  });

  it('updating the watermark only on success writes the interrupted rows twice instead', async () => {
    const user = userEvent.setup();
    renderA();
    await commit(user, 'Some rows never arrive');
    await user.click(screen.getByRole('button', { name: 'Use this challenge’s scenario' }));
    await user.click(screen.getByRole('button', { name: 'After the copy succeeds' }));
    await user.click(screen.getByRole('button', { name: 'Run pipeline' }));
    expect(within(observe()).getByText(/Batch 2: 1,000 of 1,000 rows landed · 600 written twice\./)).toBeInTheDocument();
    expect(within(observe()).getByText('Repeated writes').parentElement).toHaveTextContent('600');
  });

  it('marks a result stale when a setting changes, and won’t send a stale batch to Station C', async () => {
    const user = userEvent.setup();
    const { onLoadInC } = renderA();
    await commit(user, 'Every row, once');
    await user.click(screen.getByRole('button', { name: 'Run pipeline' }));
    expect(within(observe()).getByText('Every row landed once.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Load in Station C' }));
    expect(onLoadInC).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Upsert on the key' }));
    expect(within(observe()).getByText(/The settings changed\. Run the pipeline again/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load in Station C' })).toBeDisabled();
  });

  it('journals each run as a simulation with the settings and what they did', async () => {
    const user = userEvent.setup();
    const { onJournalChange } = renderA();
    await commit(user, 'Every row, once');
    vi.mocked(api.addLakehouseJournalEntry).mockClear();
    await user.click(screen.getByRole('button', { name: 'Use this challenge’s scenario' }));
    await user.click(screen.getByRole('button', { name: 'Run pipeline' }));
    await waitFor(() => expect(api.addLakehouseJournalEntry).toHaveBeenCalledWith(expect.objectContaining({
      station: 'a', source: 'simulation', op: 'adf_run',
      result: expect.objectContaining({ watermark: 'before', failure_at_percent: 60, expected: 1000, missed: 400, repeated_writes: 0 }),
    })));
    expect(onJournalChange).toHaveBeenCalled();
  });

  it('tells the learner that a tumbling window ignores the watermark and the load type', async () => {
    const user = userEvent.setup();
    renderA();
    await commit(user, 'Every row, once');
    await user.click(screen.getByRole('button', { name: 'Tumbling window' }));
    expect(screen.getByText('A tumbling window tracks its own window state, so the watermark isn’t used.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'After the copy succeeds' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Full' })).toBeDisabled();
  });

  it('names an orchestration choice that doesn’t match who owns what', async () => {
    const user = userEvent.setup();
    renderA();
    await commit(user, 'Every row, once');
    await user.click(screen.getByRole('combobox', { name: /The on-prem feed landing starts the pipeline/ }));
    await user.click(await screen.findByRole('option', { name: 'Lakeflow Jobs owns it' }));
    await user.click(screen.getByRole('button', { name: 'Run pipeline' }));
    expect(within(observe()).getAllByText(/Lakeflow Jobs can't listen to the on-prem feed/).length).toBeGreaterThan(0);
  });

  it('starts from the upstream Station C will use', async () => {
    const user = userEvent.setup();
    renderA({ upstream: { ...DEFAULT_LEVERS, sink: 'upsert' } });
    await commit(user, 'Every row, once');
    expect(screen.getByRole('button', { name: 'Upsert on the key' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('says why the source index could not load, and tries again', async () => {
    vi.mocked(api.getLakehouseSourceIndex).mockRejectedValueOnce({ response: { status: 500, data: { detail: 'Index is down.' } } });
    renderA();
    expect(await screen.findByText('The source index did not load.')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('radio', { name: 'Every row, once' })).toBeInTheDocument();
  });

  it('puts every effect of its ledger on screen', async () => {
    renderA();
    await screen.findByRole('radio', { name: 'Every row, once' });
    for (const c of STATION_A_COUPLINGS) {
      expect(screen.getByText(c.uiLabel), c.id).toBeInTheDocument();
      expect(screen.getByText(c.effect), c.id).toBeInTheDocument();
    }
  });
});

describe('StationB', () => {
  beforeEach(() => serverAttempt(B_UID, 'lakehouse.b.vendor-access'));

  function renderB(over: { pack?: LabPackDetail } = {}) {
    const onJournalChange = vi.fn();
    render(<StationB pack={over.pack ?? pack} subjectId={2} onJournalChange={onJournalChange} />);
    return { onJournalChange };
  }
  async function commit(user: ReturnType<typeof userEvent.setup>, option: RegExp | string) {
    await user.click(await screen.findByRole('radio', { name: option }));
    await user.click(screen.getByRole('button', { name: 'Commit prediction' }));
    await screen.findByRole('button', { name: 'Prediction committed' });
  }
  const observe = () => screen.getByRole('region', { name: /3 · Observe/ });

  it('says so, and shows nothing in its place, when the pack has no pipeline content', async () => {
    renderB({ pack: { ...pack, pipeline: {} } });
    expect(screen.getByText(/This pack has no usable pipeline content: The pack has no pipeline content for Station B\./)).toBeInTheDocument();
  });

  it('commits the access prediction and closes it with the model’s outcome as a simulation', async () => {
    const user = userEvent.setup();
    renderB();
    await commit(user, /No: it is stopped before it reaches the folder/);
    expect(vi.mocked(api.patchLearningAttempt).mock.calls[0][1]).toEqual({ prediction: 'denied' });
    expect(vi.mocked(api.patchLearningAttempt).mock.calls[1][1]).toMatchObject({ completed: true, correct: true, observed: { outcome: 'denied', source: 'simulation' } });
    expect(await screen.findByText('Your prediction was right.')).toBeInTheDocument();
    expect(screen.getByText(/needs execute on every folder above it/)).toBeInTheDocument();
  });

  it('says so when the prediction was wrong', async () => {
    const user = userEvent.setup();
    renderB();
    await commit(user, /Yes, and only there/);
    expect(await screen.findByText('Not what the model found.')).toBeInTheDocument();
  });

  it('tests the access: denied without execute on the parents, allowed exactly once they have it', async () => {
    const user = userEvent.setup();
    const { onJournalChange } = renderB();
    await commit(user, /No: it is stopped/);
    expect(within(observe()).getByText('Test the access to see whether the request is met.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Test access' }));
    expect(within(observe()).getByText('Denied')).toBeInTheDocument();
    await user.click(screen.getByLabelText('lake/', { exact: true }));
    await user.click(screen.getByLabelText('lake/bronze/', { exact: true }));
    expect(within(observe()).getByText(/The settings changed|Test the access again/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Test access' }));
    expect(within(observe()).getByText('Allowed')).toBeInTheDocument();
    expect(within(observe()).getByText(/vendor-x can write to 1 folder: lake\/bronze\/vendor-x\//)).toBeInTheDocument();
    await waitFor(() => expect(api.addLakehouseJournalEntry).toHaveBeenCalledWith(expect.objectContaining({
      station: 'b', source: 'simulation', op: 'adls_access_test', result: expect.objectContaining({ outcome: 'allowed', writable_folders: 1 }),
    })));
    expect(onJournalChange).toHaveBeenCalled();
  });

  it('keeps an access result when only the tier or the layout changes, since neither decides access', async () => {
    const user = userEvent.setup();
    renderB();
    await commit(user, /No: it is stopped/);
    await user.click(screen.getByRole('button', { name: 'Test access' }));
    expect(within(observe()).getByText('Denied')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cool' }));
    await user.click(screen.getByRole('button', { name: 'Copied from HDFS' }));
    expect(within(observe()).getByText('Denied')).toBeInTheDocument();
    expect(within(observe()).queryByText(/Test the access again/)).not.toBeInTheDocument();
  });

  it('RBAC at container scope works and is too broad; without a hierarchical namespace there is no ACL', async () => {
    const user = userEvent.setup();
    renderB();
    await commit(user, /No: it is stopped/);
    await user.click(screen.getByRole('button', { name: 'RBAC at container scope' }));
    await user.click(screen.getByRole('button', { name: 'Test access' }));
    expect(within(observe()).getByText('Allowed, too broad')).toBeInTheDocument();
    expect(within(observe()).getByText(/vendor-x can write to 6 folders/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Directory ACL' }));
    await user.click(screen.getByRole('switch', { name: 'Hierarchical namespace' }));
    await user.click(screen.getByRole('button', { name: 'Test access' }));
    expect(within(observe()).getByText('No ACL available')).toBeInTheDocument();
  });

  it('shows what the layout and namespace cost, as teaching constants', async () => {
    const user = userEvent.setup();
    renderB();
    await commit(user, /No: it is stopped/);
    expect(within(observe()).getByText('Atomic, with a hierarchical namespace')).toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: 'Hierarchical namespace' }));
    await user.click(screen.getByRole('button', { name: 'Copied from HDFS' }));
    expect(within(observe()).getByText('960')).toBeInTheDocument();
    expect(within(observe()).getByText('A copy and a delete of every object')).toBeInTheDocument();
    for (const label of ['Objects a day', 'Requests to list a day']) {
      expect(within(observe()).getByText(label).parentElement).toHaveTextContent('Teaching constant');
    }
  });

  it('a lifecycle rule brings the combined cost below keeping everything hot; cool for everything raises it', async () => {
    const user = userEvent.setup();
    renderB();
    await commit(user, /No: it is stopped/);
    const combined = () => within(observe()).getByText('Combined').parentElement!;
    expect(combined()).toHaveTextContent('1.00×');
    await user.click(screen.getByRole('combobox', { name: 'Lifecycle rule: move to cool after' }));
    await user.click(await screen.findByRole('option', { name: '30 days' }));
    expect(combined()).toHaveTextContent('0.79×');
    expect(within(observe()).getByText(/Old data is cool and the busy, recent data stays hot/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cool' }));
    expect(combined()).toHaveTextContent('1.10×');
    expect(within(observe()).getByText(/the reads cost more than the storage saves/)).toBeInTheDocument();
  });

  it('puts every effect of its ledger, and the pack’s constant labels, on screen', async () => {
    renderB();
    await screen.findByRole('radio', { name: /Yes, and only there/ });
    for (const c of STATION_B_COUPLINGS) {
      expect(screen.getByText(c.uiLabel), c.id).toBeInTheDocument();
      expect(screen.getByText(c.effect), c.id).toBeInTheDocument();
    }
    expect(screen.getByText(/Illustrative storage cost per gigabyte for each tier/)).toBeInTheDocument();
  });
});
