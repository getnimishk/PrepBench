// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type {
  Attempt,
  ConceptId,
  InterviewReadiness,
  MasteryState,
} from '../../types/learning';
import { CONCEPT_LIST } from './concepts';
import { CHALLENGE_BY_ID } from './challenges';

// Mastery, inferred from attempts. Never stored.
//
// That is a deliberate architectural choice, not an optimisation. A stored
// grade freezes whatever rule was in force when it was written, so tightening
// the rule later means migrating everybody's history or living with two
// standards. Recomputing means the rule below is the only rule that has ever
// applied.
//
// What is explicitly NOT mastery: lessons completed, charts viewed, time
// spent, attempts made. Every one of those is satisfiable without
// understanding anything, and a product that certified them would be lying to
// the person it is meant to be preparing.

/** An attempt solved with no hint taken. The primary signal. */
const isUnaided = (a: Attempt) => a.correct === true && a.hintCount === 0;

/** Challenge types that demonstrate a MECHANISM rather than an outcome. */
const MECHANISM_TYPES = new Set(['explanation', 'counterfactual', 'diagnosis']);

export const MASTERY_RULE = {
  /** Unaided correct answers required before a concept is "demonstrated". */
  demonstratedUnaided: 2,
  /** Unaided correct answers required for "mastered". */
  masteredUnaided: 3,
  /** Distinct parameterisations required for "mastered". */
  masteredScenarios: 2,
} as const;

export interface ConceptMastery {
  conceptId: ConceptId;
  state: MasteryState;
  attempts: number;
  completed: number;
  correct: number;
  unaidedCorrect: number;
  /** Distinct scenario fingerprints the learner has been correct on. */
  distinctScenarios: number;
  /** A correct answer on a challenge explicitly marked as transfer. */
  transferDemonstrated: boolean;
  /** A correct answer on an explanation, counterfactual or diagnosis task. */
  mechanismDemonstrated: boolean;
  /** Mean hints taken on correct answers. Null when nothing is correct yet. */
  hintDependence: number | null;
  /**
   * What is still missing, in plain language.
   *
   * This is the honest replacement for a percentage bar: "73% complete" tells
   * a learner nothing they can act on, and naming the missing evidence tells
   * them exactly what to do next.
   */
  nextEvidenceNeeded: string[];
}

export function masteryFor(conceptId: ConceptId, all: Attempt[]): ConceptMastery {
  const attempts = all.filter((a) => a.conceptId === conceptId);
  const completed = attempts.filter((a) => a.completedAt !== undefined);
  const correct = completed.filter((a) => a.correct === true);
  const unaided = completed.filter(isUnaided);

  const distinctScenarios = new Set(correct.map((a) => a.scenarioFingerprint)).size;

  const transferDemonstrated = correct.some(
    (a) => a.transfer === true || CHALLENGE_BY_ID.get(a.challengeId)?.transferOf !== undefined,
  );
  const mechanismDemonstrated = correct.some((a) => {
    const type = CHALLENGE_BY_ID.get(a.challengeId)?.type;
    return type !== undefined && MECHANISM_TYPES.has(type);
  });

  const hintDependence =
    correct.length === 0
      ? null
      : correct.reduce((sum, a) => sum + a.hintCount, 0) / correct.length;

  const state = deriveState({
    attempts: attempts.length,
    completed: completed.length,
    correct: correct.length,
    unaidedCorrect: unaided.length,
    distinctScenarios,
    transferDemonstrated,
    mechanismDemonstrated,
  });

  return {
    conceptId,
    state,
    attempts: attempts.length,
    completed: completed.length,
    correct: correct.length,
    unaidedCorrect: unaided.length,
    distinctScenarios,
    transferDemonstrated,
    mechanismDemonstrated,
    hintDependence,
    nextEvidenceNeeded: missingEvidence({
      state,
      unaidedCorrect: unaided.length,
      distinctScenarios,
      transferDemonstrated,
      mechanismDemonstrated,
    }),
  };
}

interface Evidence {
  attempts: number;
  completed: number;
  correct: number;
  unaidedCorrect: number;
  distinctScenarios: number;
  transferDemonstrated: boolean;
  mechanismDemonstrated: boolean;
}

function deriveState(e: Evidence): MasteryState {
  if (e.attempts === 0) return 'notStarted';
  if (e.completed === 0) return 'introduced';
  if (e.correct === 0) return 'practiced';

  const demonstrated = e.unaidedCorrect >= MASTERY_RULE.demonstratedUnaided;
  if (!demonstrated) return 'developing';

  if (!e.transferDemonstrated) return 'demonstrated';

  // Transfer is mandatory before mastery: a repeated clone of the training
  // scenario is repetition, and certifying it as understanding is exactly how
  // shape-matching gets marked as reasoning.
  const mastered =
    e.mechanismDemonstrated &&
    e.unaidedCorrect >= MASTERY_RULE.masteredUnaided &&
    e.distinctScenarios >= MASTERY_RULE.masteredScenarios;

  return mastered ? 'mastered' : 'transferDemonstrated';
}

function missingEvidence(e: {
  state: MasteryState;
  unaidedCorrect: number;
  distinctScenarios: number;
  transferDemonstrated: boolean;
  mechanismDemonstrated: boolean;
}): string[] {
  if (e.state === 'mastered') return [];

  const needed: string[] = [];
  if (e.unaidedCorrect < MASTERY_RULE.masteredUnaided) {
    needed.push(
      `${MASTERY_RULE.masteredUnaided - e.unaidedCorrect} more correct answer(s) without hints`,
    );
  }
  if (!e.transferDemonstrated) {
    needed.push('the same principle applied to a different scenario');
  }
  if (!e.mechanismDemonstrated) {
    needed.push('naming the mechanism, not only the outcome');
  }
  if (e.distinctScenarios < MASTERY_RULE.masteredScenarios) {
    needed.push('evidence from a second parameterisation');
  }
  return needed;
}

export function masteryMap(attempts: Attempt[]): Record<ConceptId, ConceptMastery> {
  const map = {} as Record<ConceptId, ConceptMastery>;
  for (const concept of CONCEPT_LIST) {
    map[concept.id] = masteryFor(concept.id, attempts);
  }
  return map;
}

/**
 * Interview readiness. PHASE 1: always blocked.
 *
 * The rule this enforces is the one most likely to be quietly dropped while
 * the feature that satisfies it is missing, so it is built and held closed
 * rather than omitted: no amount of prediction accuracy makes anyone
 * interview-ready. That requires a qualifying articulation attempt, and
 * articulation is Phase 2.
 */
export function interviewReadiness(attempts: Attempt[]): InterviewReadiness {
  const blockedBy: string[] = [
    'Articulation is not implemented yet (Phase 2). Interview readiness requires a ' +
      'qualifying articulation attempt, so it cannot be reached in this phase.',
  ];

  const map = masteryMap(attempts);
  const unmastered = CONCEPT_LIST.filter((c) => map[c.id].state !== 'mastered');
  if (unmastered.length > 0) {
    blockedBy.push(
      `${unmastered.length} concept(s) not yet mastered: ` +
        unmastered.map((c) => c.canonicalName).join(', '),
    );
  }

  return { ready: false, blockedBy };
}
