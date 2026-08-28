import type { Attempt, Challenge, LearningMode } from '../../types/learning';
import { fingerprint, paramsFor } from './scenarios';

// The only new persisted learner entity.
//
// Mastery, placement and recommendations are all derived from these on read
// and never stored, so the rules can be revised without migrating anybody's
// history.
//
// Phase 1 persists to localStorage where the browser allows it, and to an
// in-session fallback where it does not. There is no backend change in this
// phase by decision, and the app is offline-first anyway -- but the storage
// boundary is deliberately thin so a later move to the backend touches this
// file and nothing else.
//
// NOTHING here is ever written back into the simulation. The learning layer
// reads model state to build a fingerprint and stops there; `services/metrics`
// has no idea this file exists.

const STORAGE_KEY = 'prepbench.learning.attempts.v1';

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

/**
 * Session-only history, used when the browser gives us no storage.
 *
 * Not a test convenience. A private window, a browser set to block site data,
 * or a full quota all produce the same situation, and the alternative is a
 * learner whose every answer vanishes the instant they give it. Progress does
 * not survive a reload in that state, which is the honest outcome -- but it
 * survives the session, which is the difference between a usable product and
 * a broken one.
 */
let sessionFallback: Attempt[] | null = null;

/**
 * `localStorage`, or null when it is absent or refuses to be used.
 *
 * Probed rather than presence-checked: some browsers expose the object and
 * throw on the first write, and jsdom does not provide it at all.
 */
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

/** Every recorded attempt. */
export function loadAttempts(): Attempt[] {
  const ls = storage();
  if (!ls) return sessionFallback ?? [];
  try {
    return parseAttempts(ls.getItem(STORAGE_KEY));
  } catch {
    return sessionFallback ?? [];
  }
}

function persist(attempts: Attempt[]): void {
  const ls = storage();
  if (!ls) {
    sessionFallback = attempts;
    return;
  }
  try {
    ls.setItem(STORAGE_KEY, JSON.stringify(attempts));
  } catch {
    // Quota, most likely. Keep the session alive in memory rather than
    // failing a learning interaction over a storage limit.
    sessionFallback = attempts;
  }
}

/** Insert or replace by id, so an in-progress attempt can be updated. */
export function saveAttempt(attempt: Attempt): Attempt[] {
  const all = loadAttempts();
  const index = all.findIndex((a) => a.attemptId === attempt.attemptId);
  const next = index === -1 ? [...all, attempt] : all.map((a, i) => (i === index ? attempt : a));
  persist(next);
  return next;
}

export function clearAttempts(): void {
  sessionFallback = null;
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    // Nothing readable to clear.
  }
}
