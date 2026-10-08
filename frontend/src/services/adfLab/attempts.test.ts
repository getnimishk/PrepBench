// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WireLearningAttempt } from '../../types/learning';

vi.mock('../api', () => ({
  getLearningAttempts: vi.fn(),
  startLearningAttempt: vi.fn(),
  patchLearningAttempt: vi.fn(),
}));

import * as api from '../api';
import {
  answerStage, commitPrediction, fetchAdfLabAttempts, isAdfLabAttempt, latestRun, openPredict, openStage, parseStageUid,
  recordObservation, runAttempts, runFingerprint, runPrefix, saveExplanation, stageChallenge, stageUid,
} from './attempts';

const K = { subjectId: 7, track: 'watermark' as const, run: 2 };

const wire = (over: Partial<WireLearningAttempt>): WireLearningAttempt => ({
  attempt_uid: 'x', challenge_id: 'x', concept_id: 'x', scenario_fingerprint: '', mode: 'guided',
  started_at: '2026-10-07T10:00:00', hint_count: 0, ...over,
});

beforeEach(() => {
  vi.mocked(api.startLearningAttempt).mockReset().mockImplementation(async (b) => wire({ ...b }));
  vi.mocked(api.patchLearningAttempt).mockReset().mockImplementation(async (uid) => wire({ attempt_uid: uid }));
  vi.mocked(api.getLearningAttempts).mockReset();
});

describe('one run, many stage rows, one deterministic correlation', () => {
  it('shares the run prefix and the fingerprint across every stage of a run', () => {
    const uids = (['predict', 'reason', 'apply', 'retrieve'] as const).map((s) => stageUid(K, s));
    expect(uids).toEqual(['ab:7:watermark:r2:predict', 'ab:7:watermark:r2:reason', 'ab:7:watermark:r2:apply', 'ab:7:watermark:r2:retrieve']);
    for (const uid of uids) expect(uid.startsWith(runPrefix(K))).toBe(true);
    expect(runFingerprint(K, 'semiconductor-v1')).toBe('adf-lab=watermark;run=2;model=semiconductor-v1');
  });

  it('is the same every time it is built, and fits the server’s 64 characters', () => {
    expect(stageUid(K, 'apply')).toBe(stageUid({ ...K }, 'apply'));
    expect(stageUid({ subjectId: 999999, track: 'fault-tolerance.dependency', run: 999 }, 'retrieve').length)
      .toBeLessThanOrEqual(64);
  });

  it('reads the run back from an id, and nothing from anyone else’s', () => {
    expect(parseStageUid('ab:7:watermark:r2:reason')).toEqual({ subjectId: 7, track: 'watermark', run: 2, stage: 'reason' });
    expect(parseStageUid('ab:7:fault-tolerance.bad-rows:r1:apply')).toEqual({ subjectId: 7, track: 'fault-tolerance.bad-rows', run: 1, stage: 'apply' });
    expect(parseStageUid('lk:2:semiconductor-v1@1:a-watermark-order')).toBeNull();
    expect(parseStageUid('s6:adf@1:2:c0')).toBeNull();
    expect(parseStageUid('ab:7:watermark:r2:explain')).toBeNull();
  });

  it('groups a run’s rows and finds the latest run, per preparation and experiment', () => {
    const rows = [
      wire({ attempt_uid: 'ab:7:watermark:r1:predict', challenge_id: stageChallenge('watermark', 'predict') }),
      wire({ attempt_uid: 'ab:7:watermark:r2:predict', challenge_id: stageChallenge('watermark', 'predict') }),
      wire({ attempt_uid: 'ab:7:watermark:r2:reason', challenge_id: stageChallenge('watermark', 'reason') }),
      wire({ attempt_uid: 'ab:8:watermark:r5:predict', challenge_id: stageChallenge('watermark', 'predict') }),
      wire({ attempt_uid: 'ab:7:triggers:r9:predict', challenge_id: stageChallenge('triggers', 'predict') }),
    ];
    expect(latestRun(rows, 7, 'watermark')).toBe(2);
    expect(latestRun(rows, 9, 'watermark')).toBe(1);
    expect(Object.keys(runAttempts(rows, K)).sort()).toEqual(['predict', 'reason']);
  });
});

describe('every write goes through LearningService, on the chosen preparation', () => {
  it('opens a stage on the preparation, with the run’s correlation', async () => {
    await openStage(K, 'predict', 'semiconductor-v1');
    expect(api.startLearningAttempt).toHaveBeenCalledWith({
      attempt_uid: 'ab:7:watermark:r2:predict',
      challenge_id: 'adf.lab.watermark.predict',
      concept_id: 'adf.lab.watermark',
      scenario_fingerprint: 'adf-lab=watermark;run=2;model=semiconductor-v1',
      mode: 'guided',
      hint_count: 0,
      subject_id: 7,
    });
  });

  it('opens Retrieve as a retrieval attempt, with no schedule of any kind', async () => {
    await openStage(K, 'retrieve', 'semiconductor-v1');
    const body = vi.mocked(api.startLearningAttempt).mock.calls[0][0];
    expect(body.mode).toBe('retrieval');
    expect(JSON.stringify(body)).not.toMatch(/interval|next_review|due/);
  });

  it('commits a prediction alone, then records the run and the grade in one write', async () => {
    await commitPrediction(7, 'u', 'missing');
    expect(api.patchLearningAttempt).toHaveBeenLastCalledWith('u', { prediction: 'missing' }, 7);
    await recordObservation(7, 'u', { retries: { from: 0, to: 1 } }, { missed: { before: 1, after: 0 } }, true);
    expect(api.patchLearningAttempt).toHaveBeenLastCalledWith('u', {
      manipulation: { retries: { from: 0, to: 1 } },
      observed: { missed: { before: 1, after: 0 }, source: 'simulation' },
      completed: true,
      correct: true,
    }, 7);
  });

  it('answers a graded stage in one write, with transfer only where it applies', async () => {
    await answerStage(7, 'u', { prediction: 'retry-upsert', correct: true, transfer: true });
    expect(api.patchLearningAttempt).toHaveBeenLastCalledWith('u', {
      prediction: 'retry-upsert', completed: true, correct: true, transfer: true,
    }, 7);
    await answerStage(7, 'v', { prediction: 'watermark-timing', correct: true, mechanisms: ['watermark-timing'] });
    expect(api.patchLearningAttempt).toHaveBeenLastCalledWith('v', {
      prediction: 'watermark-timing', explanation_mechanisms: ['watermark-timing'], completed: true, correct: true,
    }, 7);
    await saveExplanation(7, 'u', 'Because');
    expect(api.patchLearningAttempt).toHaveBeenLastCalledWith('u', { explanation_text: 'Because' }, 7);
  });

  it('starts a run at the first run whose ids no other preparation holds', async () => {
    // A deleted preparation with this id left runs 2 and 3 behind: the server refuses those (409).
    const taken = new Set(['ab:7:watermark:r2:predict', 'ab:7:watermark:r3:predict']);
    vi.mocked(api.startLearningAttempt).mockImplementation(async (b) => {
      if (taken.has(b.attempt_uid)) throw { response: { status: 409, data: { detail: 'taken' } } };
      return wire({ ...b });
    });
    const opened = await openPredict(K, 'semiconductor-v1');
    expect(opened.run).toBe(4);
    expect(opened.attempt.attempt_uid).toBe('ab:7:watermark:r4:predict');
    expect(opened.attempt.scenario_fingerprint).toBe('adf-lab=watermark;run=4;model=semiconductor-v1');
  });

  it('keeps the run it was given when that run is free, and does not step past any other failure', async () => {
    expect((await openPredict(K, 'semiconductor-v1')).run).toBe(2);
    vi.mocked(api.startLearningAttempt).mockRejectedValue({ response: { status: 500, data: { detail: 'down' } } });
    await expect(openPredict(K, 'semiconductor-v1')).rejects.toMatchObject({ response: { status: 500 } });
    expect(api.startLearningAttempt).toHaveBeenCalledTimes(2);
  });

  it('reads only this preparation’s ADF lab attempts, even if the server sent more', async () => {
    vi.mocked(api.getLearningAttempts).mockResolvedValue([
      wire({ attempt_uid: 'ab:7:watermark:r1:predict', challenge_id: 'adf.lab.watermark.predict', subject_id: 7 }),
      wire({ attempt_uid: 'ab:8:watermark:r1:predict', challenge_id: 'adf.lab.watermark.predict', subject_id: 8 }),
      wire({ attempt_uid: 'lk:7:semiconductor-v1@1:a-watermark-order', challenge_id: 'lakehouse.a.watermark-order', subject_id: 7 }),
      wire({ attempt_uid: 's7:adf@1:1:c0', challenge_id: 'adf/1/check/0', subject_id: 7 }),
    ]);
    const mine = await fetchAdfLabAttempts(7);
    expect(api.getLearningAttempts).toHaveBeenCalledWith({ subject_id: 7 });
    expect(mine.map((a) => a.attempt_uid)).toEqual(['ab:7:watermark:r1:predict']);
    expect(isAdfLabAttempt({ challenge_id: 'adf/1/check/0', attempt_uid: 's7:adf@1:1:c0' })).toBe(false);
  });
});
