// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { WireLearningAttempt } from '../../types/learning';
import { getLearningAttempts, patchLearningAttempt, startLearningAttempt } from '../api';
import { isAttemptIdTaken } from '../apiError';
import type { AdfLabSlug } from './experiments';

/**
 * The ADF Behaviour Lab's learning attempts: the shared `learning_attempts` table, written only
 * through LearningService (POST / PATCH /learning/attempts). No table, store or ledger of its own.
 *
 * One graded stage is one attempt, because the server records `correct` (and `transfer`) once
 * per attempt: Predict, Reason, Apply and Retrieve each get their own row. Manipulate and Observe
 * are recorded on the Predict attempt (write-once, and only after its prediction is committed,
 * both enforced by the server); Explain is that attempt's `explanation_text`.
 *
 * A learner's run through one experiment ties its stage rows together by a deterministic
 * correlation in the existing columns:
 *
 *   attempt_uid           ab:<subjectId>:<track>:r<run>:<stage>     (the run is the prefix)
 *   scenario_fingerprint  adf-lab=<track>;run=<run>;model=<model>    (same for every stage)
 *   challenge_id          adf.lab.<track>.<stage>
 *   concept_id            adf.lab.<slug>
 *
 * A track is the experiment's slug, or slug.mode for an experiment with fault modes (Fault
 * Tolerance runs its dependency and bad-row modes as two tracks of the one experiment):
 * "watermark", "fault-tolerance.dependency", "fault-tolerance.bad-rows".
 *
 * A finished run cannot be reopened -- its predictions are on the record -- so "start again"
 * is the next run number, never an edit.
 *
 * Every write names the preparation (the server reaches only that preparation's attempts), and
 * a run whose ids a deleted preparation's attempts already hold is skipped -- see openPredict.
 */

export const ADF_LAB_PREFIX = 'adf.lab.';

export const STAGE_ATTEMPTS = ['predict', 'reason', 'apply', 'retrieve'] as const;
export type StageAttempt = typeof STAGE_ATTEMPTS[number];

/** An experiment's slug, or slug.mode for one of its fault modes. */
export type Track = AdfLabSlug | `${AdfLabSlug}.${string}`;

export interface RunKey {
  subjectId: number;
  track: Track;
  run: number;
}

export const slugOf = (track: Track): AdfLabSlug => track.split('.')[0] as AdfLabSlug;
export const runPrefix = (k: RunKey) => `ab:${k.subjectId}:${k.track}:r${k.run}:`;
export const stageUid = (k: RunKey, stage: StageAttempt) => `${runPrefix(k)}${stage}`;
export const stageChallenge = (track: Track, stage: StageAttempt) => `${ADF_LAB_PREFIX}${track}.${stage}`;
export const runFingerprint = (k: RunKey, model: string) => `adf-lab=${k.track};run=${k.run};model=${model}`;

const UID = /^ab:(\d+):([a-z][a-z.-]*):r(\d+):([a-z]+)$/;

/** The run an attempt belongs to, read from its id. Null for anything that is not one of ours. */
export function parseStageUid(uid: string): (RunKey & { stage: StageAttempt }) | null {
  const m = UID.exec(uid);
  if (!m || !(STAGE_ATTEMPTS as readonly string[]).includes(m[4])) return null;
  return { subjectId: Number(m[1]), track: m[2] as Track, run: Number(m[3]), stage: m[4] as StageAttempt };
}

/** Is this attempt one of the ADF Behaviour Lab's? Told apart by id, never by guessing. */
export const isAdfLabAttempt = (a: Pick<WireLearningAttempt, 'challenge_id' | 'attempt_uid'>) =>
  a.challenge_id.startsWith(ADF_LAB_PREFIX) && parseStageUid(a.attempt_uid) !== null;

/** This preparation's ADF lab attempts. Scoped by the server, and checked again here. */
export async function fetchAdfLabAttempts(subjectId: number): Promise<WireLearningAttempt[]> {
  const all = await getLearningAttempts({ subject_id: subjectId });
  return all.filter((a) => isAdfLabAttempt(a) && a.subject_id === subjectId
    && parseStageUid(a.attempt_uid)?.subjectId === subjectId);
}

/** The latest run of one track that has any attempt; 1 when there is none yet. */
export function latestRun(attempts: WireLearningAttempt[], subjectId: number, track: Track): number {
  const runs = attempts
    .map((a) => parseStageUid(a.attempt_uid))
    .filter((k): k is NonNullable<typeof k> => k !== null && k.subjectId === subjectId && k.track === track)
    .map((k) => k.run);
  return runs.length ? Math.max(...runs) : 1;
}

/** One run's stage attempts, by stage. */
export function runAttempts(attempts: WireLearningAttempt[], k: RunKey): Partial<Record<StageAttempt, WireLearningAttempt>> {
  const out: Partial<Record<StageAttempt, WireLearningAttempt>> = {};
  for (const a of attempts) {
    const parsed = parseStageUid(a.attempt_uid);
    if (parsed && parsed.subjectId === k.subjectId && parsed.track === k.track && parsed.run === k.run) out[parsed.stage] = a;
  }
  return out;
}

/** Open a stage's attempt, or reach the one already open. Idempotent on the id. */
export function openStage(k: RunKey, stage: StageAttempt, model: string): Promise<WireLearningAttempt> {
  return startLearningAttempt({
    attempt_uid: stageUid(k, stage),
    challenge_id: stageChallenge(k.track, stage),
    concept_id: `${ADF_LAB_PREFIX}${slugOf(k.track)}`,
    scenario_fingerprint: runFingerprint(k, model),
    mode: stage === 'retrieve' ? 'retrieval' : 'guided',
    hint_count: 0,
    subject_id: k.subjectId,
  });
}

/** Runs tried before giving up; a real install never needs more than one or two. */
const MAX_RUN_STEPS = 20;

/**
 * Open the Predict attempt that starts a run, at this run or the first free one after it.
 *
 * The ids name the preparation's id, and SQLite gives a deleted preparation's id out again: its
 * attempts stay (subject_id NULL) under the same ids, and the server refuses to open them for this
 * preparation (409). Then the run is taken -- step to the next. A run whose Predict is free has
 * none of its other stages taken either, because every run opens Predict first.
 */
export async function openPredict(k: RunKey, model: string): Promise<{ run: number; attempt: WireLearningAttempt }> {
  for (let run = k.run; run < k.run + MAX_RUN_STEPS; run += 1) {
    try {
      return { run, attempt: await openStage({ ...k, run }, 'predict', model) };
    } catch (err) {
      if (!isAttemptIdTaken(err)) throw err;
    }
  }
  throw new Error('Could not start a new run of this experiment. Reload the page and try again.');
}

/** Commit the Predict stage's prediction. The server refuses a second, different one. */
export function commitPrediction(subjectId: number, uid: string, prediction: string): Promise<WireLearningAttempt> {
  return patchLearningAttempt(uid, { prediction }, subjectId);
}

/** A lever change, from the scenario's setting to the learner's. Values are the model's own. */
export type LeverChange = Record<string, { from: string | number | null; to: string | number | null }>;

/**
 * Record what the learner changed and what the model then showed, and close the Predict
 * attempt with whether its committed prediction matched the model. One request: the server
 * refuses the record before the commit, and keeps each field write-once.
 */
export function recordObservation(
  subjectId: number, uid: string, manipulation: LeverChange, observed: Record<string, unknown>, correct: boolean,
): Promise<WireLearningAttempt> {
  return patchLearningAttempt(
    uid, { manipulation, observed: { ...observed, source: 'simulation' }, completed: true, correct }, subjectId,
  );
}

/**
 * Answer a stage that is chosen and graded at once (Reason, Apply, Retrieve): commit the
 * choice, record anything the model worked out for it, and close it with the grade.
 */
export function answerStage(subjectId: number, uid: string, body: {
  prediction: string;
  correct: boolean;
  transfer?: boolean;
  mechanisms?: string[];
  manipulation?: LeverChange;
  observed?: Record<string, unknown>;
}): Promise<WireLearningAttempt> {
  return patchLearningAttempt(uid, {
    prediction: body.prediction,
    ...(body.mechanisms ? { explanation_mechanisms: body.mechanisms } : {}),
    ...(body.manipulation ? { manipulation: body.manipulation } : {}),
    ...(body.observed ? { observed: { ...body.observed, source: 'simulation' } } : {}),
    completed: true,
    correct: body.correct,
    ...(body.transfer !== undefined ? { transfer: body.transfer } : {}),
  }, subjectId);
}

/** The learner's own explanation, on the Predict attempt. Their words; never graded. */
export function saveExplanation(subjectId: number, uid: string, text: string): Promise<WireLearningAttempt> {
  return patchLearningAttempt(uid, { explanation_text: text }, subjectId);
}
