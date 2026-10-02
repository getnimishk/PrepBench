// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { WireLearningAttempt } from '../../types/learning';
import type { EngineStatus, LabOperationResult, LabPackDetail } from '../../types/lakehouse';

vi.mock('../../services/api', () => ({
  getLearningAttempts: vi.fn(),
  startLearningAttempt: vi.fn(),
  patchLearningAttempt: vi.fn(),
  runLakehouseOperation: vi.fn(),
  resetLakehousePack: vi.fn(),
  getLakehouseNotebook: vi.fn(),
}));

import * as api from '../../services/api';
import { StationC } from './StationC';

const pack: LabPackDetail = {
  id: 'semiconductor-v1', version: 1, title: 'Semiconductor', summary: '', fictional: true, stations: ['c'],
  notebook_verified_on: null, scenario_md: '', factory: {}, defect_manifest: [],
  tables: ['legacy.defects', 'bronze.defects', 'silver.defects'],
  dataset: { tables: { defects: { key: 'defect_id', rows: 5000, batches: 5, columns: [] } }, defects: [] },
};
const engineOn: EngineStatus = { available: true, version: '1.6.6', install_command: 'uv pip install x' };
const engineOff: EngineStatus = { available: false, install_command: 'uv pip install --system-certs lab' };
const UID = 'lk:2:semiconductor-v1@1:schema-enforcement';

const wire = (over: Partial<WireLearningAttempt> = {}): WireLearningAttempt => ({
  attempt_uid: UID, challenge_id: 'lakehouse.c.schema-enforcement', concept_id: 'lakehouse.c.schema-enforcement',
  scenario_fingerprint: '', mode: 'guided', started_at: '2026-10-02T00:00:00', hint_count: 0, ...over,
});
const result = (over: Partial<LabOperationResult> = {}): LabOperationResult => ({
  ok: true, op: 'create_table', table: 'bronze.defects', version: 0, rows: 1000, files: 1, data: {}, journal_uid: 'j', ...over,
});

const opsRun = () => vi.mocked(api.runLakehouseOperation).mock.calls.map((c) => c[0]);

function renderStation(engine = engineOn, onJournalChange = vi.fn()) {
  render(<StationC pack={pack} engine={engine} subjectId={2} onJournalChange={onJournalChange} />);
  return onJournalChange;
}

async function commitFirst(user: ReturnType<typeof userEvent.setup>, optionName: RegExp) {
  await user.click(await screen.findByRole('radio', { name: optionName }));
  await user.click(screen.getByRole('button', { name: 'Commit prediction' }));
  await screen.findByRole('button', { name: 'Prediction committed' });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getLearningAttempts).mockResolvedValue([]);
  // The server's copy of the attempt: patches merge into it, like the real one.
  let stored = wire();
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
});

describe('StationC without the engine', () => {
  it('saves the prediction, runs nothing, and shows no result', async () => {
    const user = userEvent.setup();
    renderStation(engineOff);
    await commitFirst(user, /refused/);

    expect(api.startLearningAttempt).toHaveBeenCalledWith(expect.objectContaining({
      attempt_uid: UID, challenge_id: 'lakehouse.c.schema-enforcement', subject_id: 2,
    }));
    expect(api.patchLearningAttempt).toHaveBeenCalledWith(UID, { prediction: 'refused' });
    expect(screen.getByRole('button', { name: 'Run on engine' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Set up the tables' })).toBeDisabled();
    expect(screen.getByText('Real engine not installed')).toBeInTheDocument();
    expect(screen.getByText('uv pip install --system-certs lab')).toBeInTheDocument();
    expect(screen.queryByText('Real engine run')).not.toBeInTheDocument();
    expect(api.runLakehouseOperation).not.toHaveBeenCalled();
    // Nothing was run, so nothing is marked right or wrong.
    expect(vi.mocked(api.patchLearningAttempt).mock.calls.some(([, b]) => 'completed' in b)).toBe(false);
  });

  it('still takes the acceptance criteria and checks their structure', async () => {
    const user = userEvent.setup();
    renderStation(engineOff);
    await commitFirst(user, /refused/);
    await user.type(screen.getByLabelText('Acceptance criteria'), 'Given a new column, when loaded, then reject it. The owner signs off within 1 day.');
    await user.click(screen.getByRole('button', { name: 'Check structure' }));
    expect(screen.getByText('Structure checks, not a quality grade')).toBeInTheDocument();
    expect(screen.getAllByText('Present').length).toBeGreaterThanOrEqual(3);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.patchLearningAttempt).toHaveBeenCalledWith(UID, { explanation_text: expect.stringContaining('Given a new column') }));
  });
});

describe('StationC with the engine', () => {
  it('sets up, runs the challenge’s operation, and marks the prediction against what the engine did', async () => {
    const user = userEvent.setup();
    const onJournal = renderStation();
    await commitFirst(user, /refused/);

    vi.mocked(api.runLakehouseOperation)
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result({ op: 'append_batch', version: 1, rows: 2000, data: { columns: ['defect_id'] } }))
      .mockResolvedValueOnce(result({ ok: false, op: 'append_batch', version: 1, rows: null, files: null, error: 'Cannot cast schema, number of fields does not match: 9 vs 8' }));

    await user.click(screen.getByRole('button', { name: 'Set up the tables' }));
    await screen.findByText(/Append batch 2 — done/);
    // Setup operations carry the attempt, so the server can check the prediction came first.
    expect(opsRun()).toEqual([
      expect.objectContaining({ op: 'create_table', table: 'bronze.defects', attempt_uid: UID }),
      expect.objectContaining({ op: 'append_batch', table: 'bronze.defects', batch: 2, attempt_uid: UID }),
    ]);

    await user.click(screen.getByRole('button', { name: 'Run on engine' }));
    await screen.findByText('Refused by the engine');
    expect(screen.getByText('Cannot cast schema, number of fields does not match: 9 vs 8')).toBeInTheDocument();
    expect(opsRun()[2]).toMatchObject({ op: 'append_batch', batch: 3, write: 'append', schema_mode: 'enforce', attempt_uid: UID });
    expect(await screen.findByText('Your prediction was right.')).toBeInTheDocument();
    expect(api.patchLearningAttempt).toHaveBeenCalledWith(UID, expect.objectContaining({ completed: true, correct: true }));
    expect(onJournal).toHaveBeenCalled();
  });

  it('says so when the prediction was wrong', async () => {
    const user = userEvent.setup();
    renderStation();
    await commitFirst(user, /inspector_id is added/);
    vi.mocked(api.runLakehouseOperation).mockResolvedValue(result({ ok: false, op: 'append_batch', error: 'boom' }));
    await user.click(screen.getByRole('button', { name: 'Run on engine' }));
    expect(await screen.findByText(/Not what you predicted/)).toBeInTheDocument();
    expect(api.patchLearningAttempt).toHaveBeenCalledWith(UID, expect.objectContaining({ completed: true, correct: false }));
  });

  it('does not mark the prediction when the table was never set up', async () => {
    const user = userEvent.setup();
    renderStation();
    await commitFirst(user, /refused/);
    vi.mocked(api.runLakehouseOperation).mockResolvedValue(
      result({ ok: false, op: 'append_batch', error: 'Table bronze.defects doesn’t exist yet. Create it first.' }),
    );
    await user.click(screen.getByRole('button', { name: 'Run on engine' }));
    await screen.findByText('Refused by the engine');
    expect(screen.queryByText('Your prediction was right.')).not.toBeInTheDocument();
    expect(screen.queryByText(/Not what you predicted/)).not.toBeInTheDocument();
    expect(vi.mocked(api.patchLearningAttempt).mock.calls.some(([, b]) => b.completed)).toBe(false);
  });

  it('keeps the learner from running anything while the set-up is still going', async () => {
    const user = userEvent.setup();
    renderStation();
    await commitFirst(user, /refused/);
    let release: (r: LabOperationResult) => void = () => undefined;
    vi.mocked(api.runLakehouseOperation).mockReturnValueOnce(new Promise<LabOperationResult>((resolve) => { release = resolve; }));
    await user.click(screen.getByRole('button', { name: 'Set up the tables' }));
    expect(screen.getByRole('button', { name: 'Run on engine' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Set up the tables' })).toBeDisabled();
    vi.mocked(api.runLakehouseOperation).mockResolvedValue(result());
    release(result());
    await screen.findByText(/Append batch 2 — done/);
    expect(screen.getByRole('button', { name: 'Run on engine' })).toBeEnabled();
  });

  it('records the result against the attempt once: a second run does not complete it again', async () => {
    const user = userEvent.setup();
    renderStation();
    await commitFirst(user, /refused/);
    vi.mocked(api.runLakehouseOperation).mockResolvedValue(result({ ok: false, op: 'append_batch', error: 'boom' }));
    await user.click(screen.getByRole('button', { name: 'Run on engine' }));
    await screen.findByText('Your prediction was right.');
    await user.click(screen.getByRole('button', { name: 'Run on engine' }));
    await waitFor(() => expect(api.runLakehouseOperation).toHaveBeenCalledTimes(2));
    const completions = vi.mocked(api.patchLearningAttempt).mock.calls.filter(([, b]) => b.completed);
    expect(completions).toHaveLength(1);
  });

  it('runs a follow-up as written, without marking the prediction', async () => {
    const user = userEvent.setup();
    renderStation();
    await commitFirst(user, /refused/);
    vi.mocked(api.runLakehouseOperation).mockResolvedValue(result({ op: 'append_batch', version: 2, rows: 2000, data: { columns: ['defect_id', 'inspector_id'] } }));
    await user.click(screen.getByRole('button', { name: 'Run on engine' }));
    await screen.findByText(/Try next/);
    vi.mocked(api.patchLearningAttempt).mockClear();
    await user.click(screen.getByRole('button', { name: 'Run' }));
    await waitFor(() => expect(opsRun()[opsRun().length - 1]).toMatchObject({ op: 'append_batch', schema_mode: 'merge' }));
    expect(vi.mocked(api.patchLearningAttempt).mock.calls.some(([, b]) => b.completed)).toBe(false);
  });

  it('shows an engine 503 as not installed, not as a made-up result', async () => {
    const user = userEvent.setup();
    renderStation();
    await commitFirst(user, /refused/);
    vi.mocked(api.runLakehouseOperation).mockRejectedValue({
      response: { status: 503, data: { detail: { message: 'Gone.', install_command: 'uv pip install again' } } },
    });
    await user.click(screen.getByRole('button', { name: 'Run on engine' }));
    expect(await screen.findByText('uv pip install again')).toBeInTheDocument();
    expect(screen.queryByText('Real engine run')).not.toBeInTheDocument();
  });

  it('ignores a result that arrives after the learner moved to another challenge', async () => {
    const user = userEvent.setup();
    renderStation();
    await commitFirst(user, /refused/);
    let release: (r: LabOperationResult) => void = () => undefined;
    vi.mocked(api.runLakehouseOperation).mockReturnValue(new Promise<LabOperationResult>((resolve) => { release = resolve; }));
    await user.click(screen.getByRole('button', { name: 'Run on engine' }));

    await user.click(screen.getByRole('combobox', { name: 'Challenge' }));
    await user.click(screen.getByRole('option', { name: /A batch is delivered twice/ }));
    release(result({ ok: false, op: 'append_batch', error: 'late answer for the old challenge' }));

    await waitFor(() => expect(screen.getByRole('heading', { level: 3, name: '1 · Predict' })).toBeInTheDocument());
    expect(screen.queryByText('late answer for the old challenge')).not.toBeInTheDocument();
    expect(screen.queryByText('Real engine run')).not.toBeInTheDocument();
  });
});

describe('StationC and what is already on record', () => {
  it('restores a committed prediction locked, and the saved criteria', async () => {
    vi.mocked(api.getLearningAttempts).mockResolvedValue([
      wire({ committed_at: '2026-10-02T00:01:00', prediction: 'written-added', explanation_text: 'Given x, when y, then z.' }),
    ]);
    renderStation();
    const radio = await screen.findByRole('radio', { name: /inspector_id is added/ });
    expect(radio).toBeChecked();
    expect(radio).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Prediction committed' })).toBeDisabled();
    expect(screen.getByLabelText('Acceptance criteria')).toHaveValue('Given x, when y, then z.');
  });

  it('only reads the lab’s own attempts from the shared table', async () => {
    vi.mocked(api.getLearningAttempts).mockResolvedValue([
      wire({ attempt_uid: 'other-1', challenge_id: 'adf@1/scenario/1/check/0', committed_at: '2026-10-02T00:01:00', prediction: '0' }),
    ]);
    renderStation();
    const radio = await screen.findByRole('radio', { name: /refused/ });
    expect(radio).toBeEnabled();
  });

  it('shows why a prediction could not be saved, and what the server holds wins', async () => {
    const user = userEvent.setup();
    renderStation();
    await user.click(await screen.findByRole('radio', { name: /refused/ }));
    vi.mocked(api.patchLearningAttempt).mockRejectedValue({ response: { status: 400, data: { detail: 'A prediction is already recorded.' } } });
    await user.click(screen.getByRole('button', { name: 'Commit prediction' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('A prediction is already recorded.');
    await waitFor(() => expect(api.getLearningAttempts).toHaveBeenCalledTimes(2));
  });

  it('offers the notebook marked Unverified until someone has run it', async () => {
    renderStation();
    const row = (await screen.findByText('Databricks notebook')).closest('div')!.parentElement!;
    expect(within(row).getByText('Unverified')).toBeInTheDocument();
  });

  it('says when the attempts did not load, and retries', async () => {
    vi.mocked(api.getLearningAttempts).mockRejectedValueOnce({ response: { status: 500, data: { detail: 'Server error.' } } });
    renderStation();
    expect(await screen.findByText('Your lab attempts did not load.')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('radio', { name: /refused/ })).toBeInTheDocument();
  });
});
