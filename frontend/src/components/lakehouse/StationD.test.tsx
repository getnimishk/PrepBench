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
}));

import * as api from '../../services/api';
import { StationD } from './StationD';

const MANIFEST = [
  { id: 'precision', kind: 'precision', table: 'defects', column: 'yield_pct', about: 'x', keys: [3, 5, 8], count: 3 },
  { id: 'tz-shift', kind: 'timezone', table: 'defects', column: 'inspected_at', about: 'x', keys: [2, 4], count: 2 },
  { id: 'cdc', kind: 'cdc', table: 'defects', about: 'x', updates: [1, 2, 3], deletes: [4], inserts: [5, 6], keys: [], count: 6 },
];
const pack = {
  id: 'semiconductor-v1', version: 1, title: 'Semiconductor', summary: '', fictional: true, stations: ['c', 'd'],
  notebook_verified_on: null, scenario_md: '', factory: {}, pipeline: {}, defect_manifest: MANIFEST,
  tables: ['legacy.defects', 'bronze.defects', 'silver.defects'], dataset: { tables: { defects: { batches: 5 } }, defects: [] },
} as unknown as LabPackDetail;
const engine: EngineStatus = { available: true, version: '1.6.6', install_command: 'uv pip install lab' };

const PRECISION_UID = 'lk:2:semiconductor-v1@1:d-precision';
const wire = (over: Partial<WireLearningAttempt> = {}): WireLearningAttempt => ({
  attempt_uid: PRECISION_UID, challenge_id: 'lakehouse.d.precision', concept_id: 'lakehouse.d.precision', scenario_fingerprint: '',
  mode: 'guided', started_at: '2026-10-09T00:00:00', hint_count: 0, subject_id: 2, ...over,
});

const compareResult = (column: string, count: number, keys: number[]): LabOperationResult => ({
  ok: true, op: 'compare_tables', table: null, journal_uid: 'j1',
  data: {
    row_counts: { left: 5000, right: 5000 }, row_counts_match: true, duplicate_keys: { left: 0, right: 0 },
    only_in_left: 0, only_in_right: 0, aggregates: {}, columns_compared: [column], tolerance: 0.0001, values_match: count === 0,
    through_batch: null, mismatches: { [column]: { count, keys, examples: [] } },
  },
});

let stored: WireLearningAttempt;
beforeEach(() => {
  vi.clearAllMocks();
  stored = wire();
  vi.mocked(api.getLearningAttempts).mockResolvedValue([]);
  vi.mocked(api.startLearningAttempt).mockImplementation(async (body) => ({ ...stored, attempt_uid: body.attempt_uid, challenge_id: body.challenge_id }));
  vi.mocked(api.patchLearningAttempt).mockImplementation(async (_uid, body) => {
    stored = {
      ...stored,
      ...(body.prediction ? { prediction: body.prediction as string, committed_at: '2026-10-09T00:01:00' } : {}),
      ...(body.completed ? { completed_at: '2026-10-09T00:02:00', correct: body.correct as boolean, observed: body.observed as WireLearningAttempt['observed'] } : {}),
      ...(body.explanation_text ? { explanation_text: body.explanation_text as string } : {}),
    };
    return stored;
  });
  vi.mocked(api.runLakehouseOperation).mockResolvedValue(compareResult('yield_pct', 3, [3, 5, 8]));
});

function renderD(over: { engine?: EngineStatus } = {}) {
  const onJournalChange = vi.fn();
  render(<StationD pack={pack} engine={over.engine ?? engine} subjectId={2} onJournalChange={onJournalChange} />);
  return { onJournalChange };
}

async function run(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Run on the engine' }));
  await screen.findByRole('radio', { name: /Compare two tables|Compare legacy\.defects/ });
}

async function claim(user: ReturnType<typeof userEvent.setup>, defect: string) {
  await user.click(screen.getByRole('combobox', { name: 'Defect' }));
  await user.click(await screen.findByRole('option', { name: new RegExp(defect) }));
  await user.click(screen.getByRole('button', { name: 'Claim this defect' }));
}

describe('StationD', () => {
  it('says what it is, and scores found against the manifest’s own count', async () => {
    renderD();
    expect(await screen.findByRole('heading', { level: 2, name: /Station D · Reconciliation Detective/ })).toBeInTheDocument();
    expect(screen.getByText(/fictional scenario/i)).toBeInTheDocument();
    expect(screen.getByText(/not a real Hadoop or Databricks system/i)).toBeInTheDocument();
    expect(await screen.findByText('0 of 3')).toBeInTheDocument();
  });

  it('puts its attempts on the preparation, and shows a defect already found', async () => {
    vi.mocked(api.getLearningAttempts).mockResolvedValue([wire({ prediction: 'precision', committed_at: 'c', completed_at: 'd', correct: true })]);
    renderD();
    expect(await screen.findByText('1 of 3')).toBeInTheDocument();
    expect(api.getLearningAttempts).toHaveBeenCalledWith({ subject_id: 2 });
    expect(screen.getByRole('list', { name: 'Defects found' })).toHaveTextContent('decimal precision');
  });

  it('does not count a defect whose attempt was never closed as correct', async () => {
    vi.mocked(api.getLearningAttempts).mockResolvedValue([wire({ prediction: 'precision', committed_at: 'c' })]);
    renderD();
    expect(await screen.findByText('0 of 3')).toBeInTheDocument();
  });

  it('counts a claim backed by a matching result, and records it as correct with the result it rests on', async () => {
    const user = userEvent.setup();
    const { onJournalChange } = renderD();
    await run(user);
    expect(onJournalChange).toHaveBeenCalled();
    await claim(user, 'decimal precision');

    expect(await screen.findByText('1 of 3')).toBeInTheDocument();
    expect(api.startLearningAttempt).toHaveBeenCalledWith(expect.objectContaining({
      challenge_id: 'lakehouse.d.precision', concept_id: 'lakehouse.d.precision', subject_id: 2,
    }));
    const patches = vi.mocked(api.patchLearningAttempt).mock.calls.map((c) => c[1]);
    expect(patches[0]).toEqual({ prediction: 'precision' });
    expect(patches[1]).toMatchObject({ completed: true, correct: true, observed: { claim: 'precision', ok: true, op: 'compare_tables' } });
    expect(vi.mocked(api.patchLearningAttempt).mock.calls[0][2]).toBe(2);
  });

  it('does not count, or record, a claim the cited result does not show', async () => {
    const user = userEvent.setup();
    renderD();
    await run(user);
    await claim(user, 'timezone shift'); // the result is about yield_pct
    expect(await screen.findByText(/inspected_at matches in this comparison|Not counted/)).toBeInTheDocument();
    expect(screen.getByText('0 of 3')).toBeInTheDocument();
    expect(api.startLearningAttempt).not.toHaveBeenCalled();
    expect(api.patchLearningAttempt).not.toHaveBeenCalled();
  });

  it('cannot claim before anything has been run', async () => {
    renderD();
    expect(await screen.findByRole('button', { name: 'Claim this defect' })).toBeDisabled();
    expect(screen.getByText(/Run an operation first/)).toBeInTheDocument();
  });

  it('says the engine is not installed and runs nothing, with no result standing in', async () => {
    renderD({ engine: { available: false, install_command: 'uv pip install lab' } });
    expect(await screen.findByText('Real engine not installed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run on the engine' })).toBeDisabled();
    expect(api.runLakehouseOperation).not.toHaveBeenCalled();
  });

  it('shows the engine’s refusal as it came, and can cite nothing from a run that did not happen', async () => {
    vi.mocked(api.runLakehouseOperation).mockRejectedValue({ response: { status: 500, data: { detail: 'engine fell over' } } });
    const user = userEvent.setup();
    renderD();
    await user.click(await screen.findByRole('button', { name: 'Run on the engine' }));
    expect(await screen.findByText(/engine fell over/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Claim this defect' })).toBeDisabled();
  });

  it('keeps the learner’s explanation of a found defect, as their words', async () => {
    vi.mocked(api.getLearningAttempts).mockResolvedValue([wire({ prediction: 'precision', committed_at: 'c', completed_at: 'd', correct: true })]);
    const user = userEvent.setup();
    renderD();
    const found = await screen.findByRole('list', { name: 'Defects found' });
    await user.type(within(found).getByRole('textbox', { name: /Explain what happened/ }), 'Legacy cast to two decimals.');
    await user.click(within(found).getByRole('button', { name: 'Save explanation' }));
    await waitFor(() => expect(api.patchLearningAttempt).toHaveBeenCalledWith(PRECISION_UID, { explanation_text: 'Legacy cast to two decimals.' }, 2));
  });

  it('says so when the pack plants nothing to find, rather than showing a score', async () => {
    render(<StationD pack={{ ...pack, defect_manifest: [] }} engine={engine} subjectId={2} onJournalChange={vi.fn()} />);
    expect(await screen.findByText(/plants no defects/i)).toBeInTheDocument();
    expect(screen.queryByText(/ of /)).not.toBeInTheDocument();
  });
});
