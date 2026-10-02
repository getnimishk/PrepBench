// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { WireLearningAttempt } from '../../types/learning';
import type { LabOperation, LabOperationResult } from '../../types/lakehouse';
import { apiErrorMessage } from '../apiError';
import { getLearningAttempts, patchLearningAttempt, runLakehouseOperation, startLearningAttempt } from '../api';
import { CHALLENGE_PREFIX, type StationCChallenge } from './stationC';

// A Station C challenge's progress, kept as a learning attempt on the Lakehouse
// Lab's own subject (skills plan D11: the seeded `databricks` skill).
//
// One attempt per challenge, with a deterministic id (the same preparation, pack
// and challenge always reach the same attempt). That is what makes "your
// prediction can't be changed" true across a reload and another tab: the
// server's write-once rule on a prediction refuses a second, different answer,
// so the page does not have to be trusted to have done the refusing.
//
// The prediction is committed before any operation carries the attempt's uid,
// and the server checks that again (design §4.4): an operation naming an attempt
// with no committed prediction is refused with a 400.

export const SKILL_SLUG = 'databricks';

export interface ChallengeKey {
  subjectId?: number;
  packId: string;
  packVersion: number;
  challenge: StationCChallenge;
}

/** Stable and short enough for the server's 64 characters. */
export function labAttemptUid(key: ChallengeKey): string {
  const slug = key.challenge.id.slice(CHALLENGE_PREFIX.length);
  return `lk:${key.subjectId ?? 0}:${key.packId}@${key.packVersion}:${slug}`.slice(0, 64);
}

export const labFingerprint = (packId: string, packVersion: number) => `pack=${packId}@${packVersion}`;

/** Is this attempt one of the lab's? Told apart by id, never by guessing. */
export const isLabAttempt = (a: Pick<WireLearningAttempt, 'challenge_id'>) => a.challenge_id.startsWith(CHALLENGE_PREFIX);

/** Open the challenge's attempt, or reach the one already open. Idempotent on the id. */
export function openLabAttempt(key: ChallengeKey): Promise<WireLearningAttempt> {
  return startLearningAttempt({
    attempt_uid: labAttemptUid(key),
    challenge_id: key.challenge.id,
    concept_id: key.challenge.conceptId,
    scenario_fingerprint: labFingerprint(key.packId, key.packVersion),
    mode: 'guided',
    hint_count: 0,
    ...(key.subjectId !== undefined ? { subject_id: key.subjectId } : {}),
  });
}

/** Commit the prediction. Once only: the server refuses a second, different one. */
export function commitLabPrediction(attemptUid: string, optionId: string): Promise<WireLearningAttempt> {
  return patchLearningAttempt(attemptUid, { prediction: optionId });
}

/**
 * Close the attempt from a REAL result: correct is the prediction against what
 * the engine did. Called only with a result the engine returned.
 */
export function completeLabAttempt(
  attempt: WireLearningAttempt, readAs: string, result: LabOperationResult,
): Promise<WireLearningAttempt> {
  return patchLearningAttempt(attempt.attempt_uid, {
    completed: true,
    correct: attempt.prediction === readAs,
    observed: { result: readAs, ok: result.ok, version: result.version ?? null, rows: result.rows ?? null },
  });
}

/** The learner's own acceptance criteria. Their words; never graded. */
export function saveLabExplanation(attemptUid: string, text: string): Promise<WireLearningAttempt> {
  return patchLearningAttempt(attemptUid, { explanation_text: text });
}

/** This lab's attempts for a preparation, from the shared table. */
export async function fetchLabAttempts(subjectId?: number): Promise<WireLearningAttempt[]> {
  const all = await getLearningAttempts(subjectId !== undefined ? { subject_id: subjectId } : undefined);
  return all.filter(isLabAttempt);
}

// ---- running an operation ----------------------------------------------------------

export type RunOutcome =
  | { kind: 'result'; result: LabOperationResult }
  | { kind: 'no-engine'; message: string; installCommand: string }
  | { kind: 'error'; message: string };

interface Err {
  response?: { status?: number; data?: { detail?: unknown } };
}

/**
 * Run one operation. The three ways it can come back stay three things: the
 * engine's result (including its refusals), "the engine isn't installed" with
 * the command to install it, and an ordinary error. Nothing is made up for the
 * second or third.
 */
export async function runOperation(op: LabOperation): Promise<RunOutcome> {
  try {
    return { kind: 'result', result: await runLakehouseOperation(op) };
  } catch (err) {
    const response = (err as Err)?.response;
    const detail = response?.data?.detail;
    if (response?.status === 503 && detail && typeof detail === 'object') {
      const d = detail as { message?: unknown; install_command?: unknown };
      return {
        kind: 'no-engine',
        message: typeof d.message === 'string' ? d.message : 'The real Delta engine is not installed.',
        installCommand: typeof d.install_command === 'string' ? d.install_command : '',
      };
    }
    return { kind: 'error', message: apiErrorMessage(err, 'The operation could not be run.') };
  }
}
