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
import { commitPrediction, completeAttempt, fetchAttempts, fromWire, startAttempt } from './attempts';
import { interviewReadiness, masteryMap } from './mastery';
import { hasHistory, inferPlacement, probeProgress } from './placement';
import { recommendNext } from './recommendations';

// The learning_attempts table is shared with the Learning Lab's scenarios
// (skills plan Phase 3). The Chart Sandbox derives every figure it shows from
// the list fetchAttempts() returns, so a scenario attempt reaching that list
// would move them. This pins that it can't.

function toWire(a: Attempt): WireLearningAttempt {
  return {
    attempt_uid: a.attemptId,
    challenge_id: a.challengeId,
    concept_id: a.conceptId,
    scenario_fingerprint: a.scenarioFingerprint,
    mode: a.mode,
    started_at: a.startedAt,
    committed_at: a.committedAt ?? null,
    completed_at: a.completedAt ?? null,
    prediction: a.prediction ?? null,
    correct: a.correct ?? null,
    transfer: a.transfer ?? null,
    hint_count: a.hintCount,
  };
}

function agileAttempt(challengeId: string, right: boolean): WireLearningAttempt {
  const challenge = CHALLENGE_BY_ID.get(challengeId)!;
  const option = right ? challenge.correctOptionId : challenge.options.find((o) => o.id !== challenge.correctOptionId)!.id;
  return toWire(completeAttempt(commitPrediction(startAttempt(challenge), option), challenge));
}

/** What a scenario records: two check answers and a completed role lens. */
const SCENARIO_ATTEMPTS: WireLearningAttempt[] = [
  {
    attempt_uid: 's7:adf@1:1:c0', challenge_id: 'adf/1/check/0', concept_id: 'adf/incremental',
    scenario_fingerprint: 'pack_version=1', mode: 'guided', started_at: '2026-09-27T10:00:00',
    committed_at: '2026-09-27T10:00:05', completed_at: '2026-09-27T10:00:05', prediction: '1', correct: true, hint_count: 0,
  },
  {
    attempt_uid: 's7:adf@1:1:c1', challenge_id: 'adf/1/check/1', concept_id: 'adf/incremental',
    scenario_fingerprint: 'pack_version=1', mode: 'guided', started_at: '2026-09-27T10:01:00',
    committed_at: '2026-09-27T10:01:05', completed_at: '2026-09-27T10:01:05', prediction: '0', correct: false, hint_count: 0,
  },
  {
    attempt_uid: 's7:adf@1:1:lens:po', challenge_id: 'adf/1/lens/po', concept_id: 'adf/incremental',
    scenario_fingerprint: 'pack_version=1;lens=po', mode: 'guided', started_at: '2026-09-27T10:05:00',
    committed_at: '2026-09-27T10:15:00', completed_at: '2026-09-27T10:15:00', prediction: 'case-notes',
    explanation_text: 'a) Why?\nBecause.', rubric_coverage: { 0: true, 1: false }, hint_count: 0,
  },
];

/** Every figure the Chart Sandbox shows, from a list of attempts. */
function figures(attempts: Attempt[]) {
  return {
    mastery: masteryMap(attempts),
    readiness: interviewReadiness(attempts),
    placement: inferPlacement(attempts),
    probe: probeProgress(attempts),
    hasHistory: hasHistory(attempts),
    next: recommendNext(attempts),
  };
}

beforeEach(() => {
  vi.mocked(api.getLearningAttempts).mockReset();
});

describe('the Chart Sandbox and Learning Lab scenarios share a table, not figures', () => {
  it('a scenario attempt changes no Agile mastery, placement or recommendation figure', async () => {
    const agile = [agileAttempt('wip-first-prediction', true), agileAttempt('wip-first-prediction', false)];

    vi.mocked(api.getLearningAttempts).mockResolvedValue(agile);
    const before = figures(await fetchAttempts());

    vi.mocked(api.getLearningAttempts).mockResolvedValue([...agile, ...SCENARIO_ATTEMPTS]);
    const withScenarios = await fetchAttempts();

    expect(withScenarios.map((a) => a.attemptId)).toEqual(agile.map((a) => a.attempt_uid));
    expect(figures(withScenarios)).toEqual(before);
  });

  it('a learner who has only practised scenarios still gets the placement probe', async () => {
    vi.mocked(api.getLearningAttempts).mockResolvedValue(SCENARIO_ATTEMPTS);
    const attempts = await fetchAttempts();

    expect(attempts).toEqual([]);
    expect(figures(attempts)).toEqual(figures([]));
    // Without the filter the sandbox would believe it had history and skip placement.
    expect(hasHistory(SCENARIO_ATTEMPTS.map(fromWire))).toBe(true);
  });
});
