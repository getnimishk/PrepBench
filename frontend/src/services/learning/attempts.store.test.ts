// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Attempt, WireLearningAttempt } from '../../types/learning';

vi.mock('../api', () => ({
  getLearningAttempts: vi.fn(),
  startLearningAttempt: vi.fn(),
  patchLearningAttempt: vi.fn(),
}));

import * as api from '../api';
import { CHALLENGE_BY_ID } from './challenges';
import {
  commitPrediction,
  completeAttempt,
  fetchAttempts,
  fromWire,
  importBrowserHistory,
  recordAttempt,
  startAttempt,
} from './attempts';

// The sandbox's attempts are kept on the server. What matters here is what is
// sent: a prediction exactly once, the experiment with it, the learner's real
// times -- and that a retry is never mistaken for an amendment.

const LEGACY_KEY = 'prepbench.learning.attempts.v1';

function wire(attempt: Attempt, over: Partial<WireLearningAttempt> = {}): WireLearningAttempt {
  return {
    attempt_uid: attempt.attemptId,
    challenge_id: attempt.challengeId,
    concept_id: attempt.conceptId,
    scenario_fingerprint: attempt.scenarioFingerprint,
    mode: attempt.mode,
    started_at: attempt.startedAt.replace('Z', ''),
    hint_count: attempt.hintCount,
    ...over,
  };
}

function answered(): Attempt {
  const challenge = CHALLENGE_BY_ID.get('wip-first-prediction')!;
  const started = startAttempt(challenge);
  const committed = {
    ...commitPrediction(started, challenge.correctOptionId),
    manipulation: { wip: { from: 4, to: 8 } },
    observed: { cycleTime: { label: 'Cycle time', before: 5.2, after: 9.1, unit: 'days', precision: 1 } },
  };
  return completeAttempt(committed, challenge);
}

const memoryStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    get length() {
      return data.size;
    },
  } as Storage;
};

beforeEach(() => {
  vi.mocked(api.getLearningAttempts).mockReset();
  vi.mocked(api.startLearningAttempt).mockReset();
  vi.mocked(api.patchLearningAttempt).mockReset();
  vi.stubGlobal('localStorage', memoryStorage());
});

describe('saving an attempt', () => {
  it('opens it, then records the prediction, the experiment and the result with their own times', async () => {
    const attempt = answered();
    vi.mocked(api.startLearningAttempt).mockResolvedValue(wire(attempt));
    vi.mocked(api.patchLearningAttempt).mockImplementation(async (_uid, body) => wire(attempt, {
      prediction: body.prediction as string,
      committed_at: body.committed_at as string,
      completed_at: body.completed_at as string,
      correct: body.correct as boolean,
      manipulation: body.manipulation as WireLearningAttempt['manipulation'],
      observed: body.observed as WireLearningAttempt['observed'],
    }));

    const stored = await recordAttempt(attempt);

    expect(api.startLearningAttempt).toHaveBeenCalledWith(expect.objectContaining({
      attempt_uid: attempt.attemptId,
      started_at: attempt.startedAt,
      scenario_fingerprint: attempt.scenarioFingerprint,
    }));
    const [uid, body] = vi.mocked(api.patchLearningAttempt).mock.calls[0];
    expect(uid).toBe(attempt.attemptId);
    expect(body).toMatchObject({
      prediction: attempt.prediction,
      committed_at: attempt.committedAt,
      manipulation: { wip: { from: 4, to: 8 } },
      observed: { cycleTime: { before: 5.2, after: 9.1 } },
      completed: true,
      correct: true,
      completed_at: attempt.completedAt,
    });
    expect(stored.prediction).toBe(attempt.prediction);
    expect(stored.observed?.cycleTime.after).toBe(9.1);
  });

  it('does not send a prediction or a result the server already holds', async () => {
    // A retry after a dropped response. Resending the prediction would be
    // refused as an amendment, and the save would fail for nothing.
    const attempt = { ...answered(), explanationText: 'Queues grow behind the bottleneck.' };
    vi.mocked(api.startLearningAttempt).mockResolvedValue(
      wire(attempt, { prediction: attempt.prediction, committed_at: 'x', completed_at: 'y' }),
    );
    vi.mocked(api.patchLearningAttempt).mockResolvedValue(wire(attempt));

    await recordAttempt(attempt);

    const [, body] = vi.mocked(api.patchLearningAttempt).mock.calls[0];
    expect(body).not.toHaveProperty('prediction');
    expect(body).not.toHaveProperty('completed');
    expect(body).toMatchObject({ explanation_text: 'Queues grow behind the bottleneck.' });
  });

  it('never records what happened on an attempt with no prediction', async () => {
    const challenge = CHALLENGE_BY_ID.get('wip-first-prediction')!;
    const open = { ...startAttempt(challenge), observed: { x: { label: 'X', before: 1, after: 2, unit: '', precision: 0 } } };
    vi.mocked(api.startLearningAttempt).mockResolvedValue(wire(open));
    vi.mocked(api.patchLearningAttempt).mockResolvedValue(wire(open));

    await recordAttempt(open);

    const [, body] = vi.mocked(api.patchLearningAttempt).mock.calls[0];
    expect(body).not.toHaveProperty('observed');
    expect(body).not.toHaveProperty('prediction');
  });
});

describe('reading attempts back', () => {
  it('treats the server\'s naive times as UTC and its nulls as not established', async () => {
    const attempt = answered();
    vi.mocked(api.getLearningAttempts).mockResolvedValue([
      wire(attempt, { started_at: '2026-08-01T09:00:00', committed_at: null, correct: null }),
    ]);

    const [read] = await fetchAttempts();
    expect(read.startedAt).toBe('2026-08-01T09:00:00Z');
    expect(read.committedAt).toBeUndefined();
    expect(read.correct).toBeUndefined();
  });

  it('leaves a time that already names its zone alone', () => {
    const attempt = answered();
    expect(fromWire(wire(attempt, { started_at: '2026-08-01T09:00:00+05:30' })).startedAt).toBe('2026-08-01T09:00:00+05:30');
  });
});

describe('history recorded in the browser before the server kept it', () => {
  it('is moved across with its own ids, and removed from the browser once it has landed', async () => {
    const a = answered();
    const b = answered();
    localStorage.setItem(LEGACY_KEY, JSON.stringify([a, b]));
    vi.mocked(api.startLearningAttempt).mockImplementation(async (body) => wire({ ...a, attemptId: body.attempt_uid }));
    vi.mocked(api.patchLearningAttempt).mockImplementation(async (uid) => wire({ ...a, attemptId: uid }));

    expect(await importBrowserHistory()).toEqual({ imported: 2, failed: 0 });
    expect(vi.mocked(api.startLearningAttempt).mock.calls.map(([body]) => body.attempt_uid)).toEqual([a.attemptId, b.attemptId]);
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
  });

  it('keeps in the browser only what did not land', async () => {
    const a = answered();
    const b = answered();
    localStorage.setItem(LEGACY_KEY, JSON.stringify([a, b]));
    vi.mocked(api.startLearningAttempt).mockImplementation(async (body) => {
      if (body.attempt_uid === b.attemptId) throw new Error('offline');
      return wire(a);
    });
    vi.mocked(api.patchLearningAttempt).mockResolvedValue(wire(a));

    expect(await importBrowserHistory()).toEqual({ imported: 1, failed: 1 });
    const kept = JSON.parse(localStorage.getItem(LEGACY_KEY)!) as Attempt[];
    expect(kept.map((x) => x.attemptId)).toEqual([b.attemptId]);
  });

  it('runs once when asked twice at the same time', async () => {
    const a = answered();
    localStorage.setItem(LEGACY_KEY, JSON.stringify([a]));
    vi.mocked(api.startLearningAttempt).mockResolvedValue(wire(a));
    vi.mocked(api.patchLearningAttempt).mockResolvedValue(wire(a));

    const [first, second] = await Promise.all([importBrowserHistory(), importBrowserHistory()]);

    expect(first).toEqual({ imported: 1, failed: 0 });
    expect(second).toBe(first);
    expect(api.startLearningAttempt).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
  });

  it('does nothing at all when there is nothing to move', async () => {
    expect(await importBrowserHistory()).toEqual({ imported: 0, failed: 0 });
    expect(api.startLearningAttempt).not.toHaveBeenCalled();
  });
});
