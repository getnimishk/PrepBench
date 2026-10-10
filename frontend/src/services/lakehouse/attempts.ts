// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { WireLearningAttempt } from '../../types/learning';
import type { LabOperation, LabOperationResult } from '../../types/lakehouse';
import { apiErrorMessage, isAttemptIdTaken } from '../apiError';
import { getLearningAttempts, patchLearningAttempt, runLakehouseOperation, startLearningAttempt } from '../api';
/** Every lab challenge id starts here; Station C's are `lakehouse.c.…`, Station D's `lakehouse.d.…`, Station F's `lakehouse.f.…`. */
export const LAB_PREFIX = 'lakehouse.';

/** What an attempt needs to know about a challenge. Station C's and Station F's both have it. */
export interface LabChallengeRef {
  id: string;
  conceptId: string;
}

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
  challenge: LabChallengeRef;
}

/**
 * Stable and short enough for the server's 64 characters.
 *
 * `generation` exists because a subject id is not forever: SQLite gives a deleted preparation's
 * id out again, and that preparation's attempts stay (subject_id NULL) under ids naming it. The
 * server refuses to open one of those for this preparation (409); the next generation is tried.
 */
export function labAttemptUid(key: ChallengeKey, generation = 0): string {
  // Station C's ids keep their original short form, so attempts made before Station F existed still match.
  const slug = key.challenge.id.startsWith('lakehouse.c.')
    ? key.challenge.id.slice('lakehouse.c.'.length)
    : key.challenge.id.slice(LAB_PREFIX.length).replace('.', '-');
  const uid = `lk:${key.subjectId ?? 0}:${key.packId}@${key.packVersion}:${slug}`.slice(0, 64);
  if (generation === 0) return uid;
  const suffix = `~${generation}`;
  return `${uid.slice(0, 64 - suffix.length)}${suffix}`;
}

/** Generations tried before giving up; a real install never needs more than one or two. */
const MAX_GENERATIONS = 20;

/** The preparation an attempt is written as: none (null) when the lab runs without one. */
const scopeOf = (subjectId: number | undefined): number | null => subjectId ?? null;

/**
 * This preparation's attempt at a challenge, from a list of attempts: under any generation of its
 * id, and only if it is this preparation's (the list is unfiltered when there is no preparation).
 */
export function findLabAttempt(attempts: WireLearningAttempt[], key: ChallengeKey): WireLearningAttempt | undefined {
  const uids = new Set(Array.from({ length: MAX_GENERATIONS }, (_, g) => labAttemptUid(key, g)));
  return attempts.find((a) => uids.has(a.attempt_uid) && (a.subject_id ?? null) === scopeOf(key.subjectId));
}

export const labFingerprint = (packId: string, packVersion: number) => `pack=${packId}@${packVersion}`;

/** Is this attempt one of the lab's? Told apart by id, never by guessing. */
export const isLabAttempt = (a: Pick<WireLearningAttempt, 'challenge_id'>) => a.challenge_id.startsWith(LAB_PREFIX);

/**
 * Open the challenge's attempt, or reach the one already open. Idempotent on the id: every tab
 * walks the same generations, so they all land on the same attempt and the server's lock holds.
 * An id another preparation's attempt holds is refused by the server: try the next generation.
 */
export async function openLabAttempt(key: ChallengeKey): Promise<WireLearningAttempt> {
  for (let generation = 0; generation < MAX_GENERATIONS; generation += 1) {
    try {
      return await startLearningAttempt({
        attempt_uid: labAttemptUid(key, generation),
        challenge_id: key.challenge.id,
        concept_id: key.challenge.conceptId,
        scenario_fingerprint: labFingerprint(key.packId, key.packVersion),
        mode: 'guided',
        hint_count: 0,
        ...(key.subjectId !== undefined ? { subject_id: key.subjectId } : {}),
      });
    } catch (err) {
      if (!isAttemptIdTaken(err)) throw err;
    }
  }
  throw new Error('Could not open an attempt for this challenge. Reload the page and try again.');
}

/** Commit the prediction. Once only: the server refuses a second, different one. */
export function commitLabPrediction(
  subjectId: number | undefined, attemptUid: string, optionId: string,
): Promise<WireLearningAttempt> {
  return patchLearningAttempt(attemptUid, { prediction: optionId }, scopeOf(subjectId));
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
  }, attempt.subject_id ?? null);
}

/**
 * Close an attempt whose outcome the browser worked out itself (Station F's tiering,
 * which the model scores). Labelled in `observed` as a simulation, so it is never
 * mistaken for an engine result.
 */
export function completeLabSimulation(
  subjectId: number | undefined, attemptUid: string, correct: boolean, observed: Record<string, unknown>,
): Promise<WireLearningAttempt> {
  return patchLearningAttempt(
    attemptUid, { completed: true, correct, observed: { ...observed, source: 'simulation' } }, scopeOf(subjectId),
  );
}

/**
 * Close a Station D attempt: the learner claimed this defect and the engine result they cited
 * shows it. `correct` is true only ever from a claim stationD.checkClaim accepted -- a claim it
 * rejects is never recorded -- so it is set by the pack's ground truth and the engine, not by the
 * learner or an AI.
 */
export function completeLabClaim(
  subjectId: number | undefined, attemptUid: string, observed: Record<string, unknown>,
): Promise<WireLearningAttempt> {
  return patchLearningAttempt(
    attemptUid, { completed: true, correct: true, observed: { ...observed, source: 'engine', ok: true } }, scopeOf(subjectId),
  );
}

/** The learner's own acceptance criteria. Their words; never graded. */
export function saveLabExplanation(
  subjectId: number | undefined, attemptUid: string, text: string,
): Promise<WireLearningAttempt> {
  return patchLearningAttempt(attemptUid, { explanation_text: text }, scopeOf(subjectId));
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
