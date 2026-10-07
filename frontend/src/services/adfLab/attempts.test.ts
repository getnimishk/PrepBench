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
  answerStage, commitPrediction, fetchAdfLabAttempts, isAdfLabAttempt, latestRun, openStage, parseStageUid,
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
    await commitPrediction('u', 'missing');
    expect(api.patchLearningAttempt).toHaveBeenLastCalledWith('u', { prediction: 'missing' });
    await recordObservation('u', { retries: { from: 0, to: 1 } }, { missed: { before: 1, after: 0 } }, true);
    expect(api.patchLearningAttempt).toHaveBeenLastCalledWith('u', {
      manipulation: { retries: { from: 0, to: 1 } },
      observed: { missed: { before: 1, after: 0 }, source: 'simulation' },
      completed: true,
      correct: true,
    });
  });

  it('answers a graded stage in one write, with transfer only where it applies', async () => {
    await answerStage('u', { prediction: 'retry-upsert', correct: true, transfer: true });
    expect(api.patchLearningAttempt).toHaveBeenLastCalledWith('u', {
      prediction: 'retry-upsert', completed: true, correct: true, transfer: true,
    });
    await answerStage('v', { prediction: 'watermark-timing', correct: true, mechanisms: ['watermark-timing'] });
    expect(api.patchLearningAttempt).toHaveBeenLastCalledWith('v', {
      prediction: 'watermark-timing', explanation_mechanisms: ['watermark-timing'], completed: true, correct: true,
    });
    await saveExplanation('u', 'Because');
    expect(api.patchLearningAttempt).toHaveBeenLastCalledWith('u', { explanation_text: 'Because' });
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
