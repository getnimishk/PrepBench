// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WireLearningAttempt } from '../../types/learning';

vi.mock('../api', () => ({
  getLearningAttempts: vi.fn(),
  startLearningAttempt: vi.fn(),
  patchLearningAttempt: vi.fn(),
  runLakehouseOperation: vi.fn(),
}));

import * as api from '../api';
import {
  commitLabPrediction, completeLabAttempt, fetchLabAttempts, findLabAttempt, isLabAttempt, labAttemptUid, openLabAttempt,
  runOperation, saveLabExplanation,
} from './attempts';
import { challengeById } from './stationC';
import { isChartSandboxAttempt } from '../learning/attempts';

const challenge = challengeById('lakehouse.c.schema-enforcement')!;
const key = { subjectId: 2, packId: 'semiconductor-v1', packVersion: 1, challenge };
const wire = (over: Partial<WireLearningAttempt> = {}): WireLearningAttempt => ({
  attempt_uid: 'u', challenge_id: challenge.id, concept_id: challenge.conceptId, scenario_fingerprint: '',
  mode: 'guided', started_at: '2026-10-02T00:00:00', hint_count: 0, ...over,
});

beforeEach(() => vi.clearAllMocks());

describe('lab attempts', () => {
  it('have a deterministic id that fits the server’s 64 characters', () => {
    expect(labAttemptUid(key)).toBe('lk:2:semiconductor-v1@1:schema-enforcement');
    expect(labAttemptUid(key)).toBe(labAttemptUid({ ...key }));
    expect(labAttemptUid({ ...key, subjectId: 3 })).not.toBe(labAttemptUid(key));
    expect(labAttemptUid({ ...key, packId: 'x'.repeat(100) }).length).toBeLessThanOrEqual(64);
  });

  it('open on the lab’s subject with the lab’s concept, and without a subject when there is none', async () => {
    vi.mocked(api.startLearningAttempt).mockResolvedValue(wire());
    await openLabAttempt(key);
    expect(vi.mocked(api.startLearningAttempt).mock.calls[0][0]).toMatchObject({
      attempt_uid: 'lk:2:semiconductor-v1@1:schema-enforcement', challenge_id: challenge.id,
      concept_id: challenge.conceptId, subject_id: 2, scenario_fingerprint: 'pack=semiconductor-v1@1',
    });
    await openLabAttempt({ ...key, subjectId: undefined });
    expect(vi.mocked(api.startLearningAttempt).mock.calls[1][0]).not.toHaveProperty('subject_id');
  });

  it('send the prediction alone when committing, as the preparation the attempt belongs to', async () => {
    vi.mocked(api.patchLearningAttempt).mockResolvedValue(wire());
    await commitLabPrediction(2, 'u', 'refused');
    expect(api.patchLearningAttempt).toHaveBeenCalledWith('u', { prediction: 'refused' }, 2);
    await saveLabExplanation(undefined, 'v', 'criteria');
    expect(api.patchLearningAttempt).toHaveBeenLastCalledWith('v', { explanation_text: 'criteria' }, null);
    await completeLabAttempt(wire({ prediction: 'refused', subject_id: 2 }), 'refused',
      { ok: true, op: 'history', data: {}, journal_uid: 'j' });
    expect(vi.mocked(api.patchLearningAttempt).mock.calls[2][2]).toBe(2);
  });

  it('step to the next id when a deleted preparation’s attempt holds this one, and find it again', async () => {
    const first = labAttemptUid(key);
    expect(labAttemptUid(key, 1)).toBe(`${first}~1`);
    expect(labAttemptUid({ ...key, packId: 'x'.repeat(100) }, 12).length).toBeLessThanOrEqual(64);
    vi.mocked(api.startLearningAttempt).mockImplementation(async (b) => {
      if (b.attempt_uid === first) throw { response: { status: 409, data: { detail: 'taken' } } };
      return wire({ attempt_uid: b.attempt_uid, subject_id: b.subject_id });
    });
    const opened = await openLabAttempt(key);
    expect(opened.attempt_uid).toBe(`${first}~1`);

    // Read back from the preparation's own list -- under either id, and only its own.
    expect(findLabAttempt([opened], key)).toBe(opened);
    expect(findLabAttempt([wire({ attempt_uid: first, subject_id: 2 })], key)?.attempt_uid).toBe(first);
    expect(findLabAttempt([wire({ attempt_uid: first, subject_id: null })], key)).toBeUndefined();
    expect(findLabAttempt([wire({ attempt_uid: first, subject_id: 3 })], key)).toBeUndefined();
    const none = { ...key, subjectId: undefined };
    expect(findLabAttempt([wire({ attempt_uid: labAttemptUid(none), subject_id: null })], none)).toBeDefined();
  });

  it('do not step past a failure that is not a taken id', async () => {
    vi.mocked(api.startLearningAttempt).mockRejectedValue({ response: { status: 500, data: { detail: 'down' } } });
    await expect(openLabAttempt(key)).rejects.toMatchObject({ response: { status: 500 } });
    expect(api.startLearningAttempt).toHaveBeenCalledTimes(1);
  });

  it('are marked correct by comparing the committed prediction with what the engine did', async () => {
    vi.mocked(api.patchLearningAttempt).mockResolvedValue(wire());
    const result = { ok: false, op: 'append_batch', table: 'bronze.defects', version: 1, rows: null, data: {}, journal_uid: 'j' };
    await completeLabAttempt(wire({ prediction: 'refused' }), 'refused', result);
    await completeLabAttempt(wire({ prediction: 'written-added' }), 'refused', result);
    const calls = vi.mocked(api.patchLearningAttempt).mock.calls;
    expect(calls[0][1]).toMatchObject({ completed: true, correct: true });
    expect(calls[1][1]).toMatchObject({ completed: true, correct: false });
  });

  it('are the lab’s alone: kept out of the Chart Sandbox’s mastery, and the only ones the lab reads', async () => {
    expect(isLabAttempt(wire())).toBe(true);
    expect(isLabAttempt(wire({ challenge_id: 'adf@1/scenario/1/check/0' }))).toBe(false);
    expect(isChartSandboxAttempt({ conceptId: challenge.conceptId as never })).toBe(false);
    vi.mocked(api.getLearningAttempts).mockResolvedValue([wire(), wire({ challenge_id: 'wip-1', attempt_uid: 'v' })]);
    expect(await fetchLabAttempts(2)).toHaveLength(1);
    expect(api.getLearningAttempts).toHaveBeenCalledWith({ subject_id: 2 });
  });
});

describe('runOperation', () => {
  const op = { op: 'history', pack_id: 'p', table: 'bronze.defects' } as const;

  it('returns the engine’s result, a refusal included', async () => {
    const refused = { ok: false, op: 'history', error: 'boom', data: {}, journal_uid: 'j' };
    vi.mocked(api.runLakehouseOperation).mockResolvedValue(refused);
    expect(await runOperation(op)).toEqual({ kind: 'result', result: refused });
  });

  it('turns a 503 into "no engine" with the install command, and invents nothing', async () => {
    vi.mocked(api.runLakehouseOperation).mockRejectedValue({
      response: { status: 503, data: { detail: { message: 'Not installed.', install_command: 'uv pip install x' } } },
    });
    expect(await runOperation(op)).toEqual({ kind: 'no-engine', message: 'Not installed.', installCommand: 'uv pip install x' });
  });

  it('reports any other failure as an error, in words', async () => {
    vi.mocked(api.runLakehouseOperation).mockRejectedValue({ response: { status: 400, data: { detail: 'No such table.' } } });
    expect(await runOperation(op)).toEqual({ kind: 'error', message: 'No such table.' });
  });
});
