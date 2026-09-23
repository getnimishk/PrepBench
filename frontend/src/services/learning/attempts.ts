// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { Attempt, Challenge, ConceptId, LearningMode, WireLearningAttempt } from '../../types/learning';
import { getLearningAttempts, patchLearningAttempt, startLearningAttempt } from '../api';
import { fingerprint, paramsFor } from './scenarios';

// The only persisted learner entity of the learning layer.
//
// Mastery, placement and recommendations are all derived from these on read
// and never stored, so the rules can be revised without migrating anybody's
// history.
//
// Kept on the server, in the learning_attempts table, like every other piece
// of evidence in this product. It began in localStorage by decision -- which
// meant the sandbox's evidence lived in one browser profile, vanished with
// cleared site data, and could be read by nothing else. The storage boundary
// was kept thin for exactly this move: the pure transitions below did not
// change, only where an attempt goes when it is saved.
//
// The server enforces the order the learning depends on: a prediction is
// write-once, and what happened cannot be recorded before it.
//
// NOTHING here is ever written back into the simulation. The learning layer
// reads model state to build a fingerprint and a record of what moved, and
// stops there; `services/metrics` has no idea this file exists.

/** Where attempts lived before the server kept them. Read once, then cleared. */
const LEGACY_STORAGE_KEY = 'prepbench.learning.attempts.v1';

/** Ordinary crypto where available, and a workable id where it is not. */
function newId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Pure transitions
// ---------------------------------------------------------------------------

export function startAttempt(challenge: Challenge, mode: LearningMode = 'guided'): Attempt {
  return {
    attemptId: newId(),
    challengeId: challenge.id,
    conceptId: challenge.conceptId,
    scenarioFingerprint: fingerprint(paramsFor(challenge.scenario)),
    mode,
    startedAt: new Date().toISOString(),
    hintCount: 0,
  };
}

/** A hint taken. Recorded, never blocked -- support is not a punishment. */
export function withHint(attempt: Attempt): Attempt {
  if (attempt.committedAt) return attempt; // hints after commitment are free
  return { ...attempt, hintCount: attempt.hintCount + 1 };
}

/**
 * Record the prediction. Once only, and before any result is visible.
 *
 * The refusal to re-commit is the integrity of the whole mastery signal: an
 * amended prediction after seeing the outcome is hindsight wearing a
 * prediction's clothes, and it would quietly turn every accuracy number in the
 * product into a measure of nothing.
 */
export function commitPrediction(attempt: Attempt, optionId: string): Attempt {
  if (attempt.committedAt) return attempt;
  return { ...attempt, prediction: optionId, committedAt: new Date().toISOString() };
}

/**
 * Close the attempt and mark it correct or not.
 *
 * Refuses to complete an uncommitted attempt. Without a recorded prediction
 * there is nothing to be right or wrong about, and scoring it would invent
 * evidence.
 */
export function completeAttempt(attempt: Attempt, challenge: Challenge): Attempt {
  if (!attempt.committedAt) return attempt;
  if (attempt.completedAt) return attempt;

  const completedAt = new Date().toISOString();
  return {
    ...attempt,
    completedAt,
    correct: attempt.prediction === challenge.correctOptionId,
    transfer: challenge.transferOf !== undefined,
    durationMs: Date.parse(completedAt) - Date.parse(attempt.startedAt),
  };
}

/** Structured reasoning coverage. Binary only, and never sourced from speech. */
export function withRubricCoverage(
  attempt: Attempt,
  coverage: Record<string, boolean>,
): Attempt {
  return { ...attempt, rubricCoverage: { ...attempt.rubricCoverage, ...coverage } };
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

function isAttempt(value: unknown): value is Attempt {
  if (typeof value !== 'object' || value === null) return false;
  const a = value as Partial<Attempt>;
  return (
    typeof a.attemptId === 'string' &&
    typeof a.challengeId === 'string' &&
    typeof a.conceptId === 'string' &&
    typeof a.hintCount === 'number'
  );
}

/**
 * Attempts from a stored payload, discarding anything unreadable.
 *
 * Exported so the guard can be tested directly. Returns an empty history
 * rather than throwing on a partial write or a hand-edited value: losing
 * progress is bad, and refusing to render the page because progress is
 * unreadable is worse.
 */
export function parseAttempts(raw: string | null): Attempt[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isAttempt);
  } catch {
    return [];
  }
}

/** `localStorage`, or null when it is absent or refuses to be used. */
function storage(): Storage | null {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return null;
    const probe = '__prepbench_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return null;
  }
}

/** A naive server timestamp is UTC; say so, so date arithmetic agrees with the client. */
const utc = (iso?: string | null): string | undefined => {
  if (!iso) return undefined;
  return /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`;
};

/** The server's shape, as the learning layer's Attempt. */
export function fromWire(w: WireLearningAttempt): Attempt {
  return {
    attemptId: w.attempt_uid,
    challengeId: w.challenge_id,
    conceptId: w.concept_id as ConceptId,
    scenarioFingerprint: w.scenario_fingerprint,
    mode: w.mode as LearningMode,
    startedAt: utc(w.started_at) ?? new Date().toISOString(),
    committedAt: utc(w.committed_at),
    completedAt: utc(w.completed_at),
    prediction: w.prediction ?? undefined,
    explanationMechanisms: w.explanation_mechanisms?.length ? w.explanation_mechanisms : undefined,
    selectedAlternativeIds: w.selected_alternative_ids?.length ? w.selected_alternative_ids : undefined,
    rubricCoverage: w.rubric_coverage && Object.keys(w.rubric_coverage).length ? w.rubric_coverage : undefined,
    correct: w.correct ?? undefined,
    transfer: w.transfer ?? undefined,
    hintCount: w.hint_count,
    durationMs: w.duration_ms ?? undefined,
    manipulation: w.manipulation ?? undefined,
    observed: w.observed ?? undefined,
    explanationText: w.explanation_text ?? undefined,
  };
}

/** Every recorded attempt, from the server. */
export async function fetchAttempts(): Promise<Attempt[]> {
  return (await getLearningAttempts()).map(fromWire);
}

/**
 * Save an attempt: open it, then record everything it has established.
 *
 * Safe to call again for the same attempt. Opening is idempotent on the id, and
 * a prediction or result the server already holds is not sent a second time --
 * the server refuses an amended prediction, and a retry is not an amendment.
 */
export async function recordAttempt(attempt: Attempt): Promise<Attempt> {
  const existing = await startLearningAttempt({
    attempt_uid: attempt.attemptId,
    challenge_id: attempt.challengeId,
    concept_id: attempt.conceptId,
    scenario_fingerprint: attempt.scenarioFingerprint,
    mode: attempt.mode,
    started_at: attempt.startedAt,
    hint_count: attempt.hintCount,
  });

  const patch: Record<string, unknown> = { hint_count: attempt.hintCount };
  if (attempt.prediction && attempt.committedAt && !existing.committed_at) {
    patch.prediction = attempt.prediction;
    patch.committed_at = attempt.committedAt;
  }
  if (attempt.committedAt) {
    if (attempt.manipulation) patch.manipulation = attempt.manipulation;
    if (attempt.observed) patch.observed = attempt.observed;
    if (attempt.explanationText) patch.explanation_text = attempt.explanationText;
  }
  if (attempt.completedAt && !existing.completed_at) {
    patch.completed = true;
    patch.correct = attempt.correct;
    patch.transfer = attempt.transfer;
    patch.completed_at = attempt.completedAt;
  }
  if (attempt.durationMs !== undefined) patch.duration_ms = attempt.durationMs;
  if (attempt.explanationMechanisms) patch.explanation_mechanisms = attempt.explanationMechanisms;
  if (attempt.selectedAlternativeIds) patch.selected_alternative_ids = attempt.selectedAlternativeIds;
  if (attempt.rubricCoverage) patch.rubric_coverage = attempt.rubricCoverage;

  return fromWire(await patchLearningAttempt(attempt.attemptId, patch));
}

/** The learner's own explanation, after seeing what happened. Their words can be reworded. */
export async function saveExplanation(attemptId: string, text: string): Promise<Attempt> {
  return fromWire(await patchLearningAttempt(attemptId, { explanation_text: text }));
}

/**
 * Bring across any history this browser recorded before the server kept it.
 *
 * Each attempt keeps its own id and times, so nothing is counted twice and the
 * record says when things really happened. Attempts that land are removed from
 * the browser; any that do not stay there, to be tried again next time rather
 * than lost.
 */
export function importBrowserHistory(): Promise<{ imported: number; failed: number }> {
  // One import at a time. The page can mount twice in quick succession (React
  // does exactly that in development), and two imports reading the same
  // browser copy would race each other's writes back into it.
  importing ??= runImport().finally(() => {
    importing = null;
  });
  return importing;
}

let importing: Promise<{ imported: number; failed: number }> | null = null;

async function runImport(): Promise<{ imported: number; failed: number }> {
  const ls = storage();
  if (!ls) return { imported: 0, failed: 0 };
  let local: Attempt[];
  try {
    local = parseAttempts(ls.getItem(LEGACY_STORAGE_KEY));
  } catch {
    return { imported: 0, failed: 0 };
  }
  if (local.length === 0) return { imported: 0, failed: 0 };

  const kept: Attempt[] = [];
  for (const attempt of local) {
    try {
      await recordAttempt(attempt);
    } catch {
      kept.push(attempt);
    }
  }
  try {
    if (kept.length === 0) ls.removeItem(LEGACY_STORAGE_KEY);
    else ls.setItem(LEGACY_STORAGE_KEY, JSON.stringify(kept));
  } catch {
    // Harmless: a later import finds every landed id already on the server.
  }
  return { imported: local.length - kept.length, failed: kept.length };
}

/** Insert or replace by id, for the page's in-memory list. */
export function upsertAttempt(all: Attempt[], attempt: Attempt): Attempt[] {
  const index = all.findIndex((a) => a.attemptId === attempt.attemptId);
  return index === -1 ? [...all, attempt] : all.map((a, i) => (i === index ? attempt : a));
}
