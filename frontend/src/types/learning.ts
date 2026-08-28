// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { ChartViewId, ScenarioParams } from './agileMetrics';

// Types for the learning layer.
//
// The governing rule, from the PRD's source-of-truth hierarchy: the learning
// layer READS the frozen simulation model and never writes to it. Nothing in
// this file may appear in a signature under services/metrics.
//
// Where a reference can be checked by the compiler it is a typed id, so a
// renamed chart breaks the build rather than silently teaching stale content.
// Coupling ids are plain strings in the frozen ledger, so those are checked by
// integrity.test.ts instead -- the guarantee is the same, the mechanism is
// weaker, and the difference is stated rather than hidden.

// ---------------------------------------------------------------------------
// Learner state: two axes, never collapsed into one score
// ---------------------------------------------------------------------------

/**
 * What the learner KNOWS about a concept.
 *
 * Ordered. `relationship` is the first depth at which a learner may be asked
 * to reason about how two things interact.
 */
export type KnowledgeDepth =
  | 'vocabulary'
  | 'meaning'
  | 'relationship'
  | 'mechanism'
  | 'systemBehaviour';

/** What the learner can DO. Ordered. */
export type Capability =
  | 'recognize'
  | 'read'
  | 'predict'
  | 'explain'
  | 'diagnose'
  | 'intervene';

export const KNOWLEDGE_DEPTHS: KnowledgeDepth[] = [
  'vocabulary',
  'meaning',
  'relationship',
  'mechanism',
  'systemBehaviour',
];

export const CAPABILITIES: Capability[] = [
  'recognize',
  'read',
  'predict',
  'explain',
  'diagnose',
  'intervene',
];

/**
 * Learner placement is a CELL, not a rung.
 *
 * An engineering manager arrives with high knowledge depth (knows what DORA
 * is) and low capability (cannot diagnose from a chart). An analyst arrives
 * with the reverse. A single linear level gives both the wrong entry point.
 */
export interface Placement {
  depth: KnowledgeDepth;
  capability: Capability;
}

// ---------------------------------------------------------------------------
// Concepts
// ---------------------------------------------------------------------------

export type ConceptId =
  | 'sandbox-and-work'
  | 'wip'
  | 'throughput'
  | 'variation'
  | 'cycle-time'
  | 'littles-law'
  | 'wip-cycle-time-mechanism'
  | 'workflow-states'
  | 'cfd-reading'
  | 'bottleneck';

/**
 * An atom of understanding. NOT a chart -- several concepts point at the same
 * chart, and one concept can span several.
 */
export interface Concept {
  id: ConceptId;
  canonicalName: string;
  /** The depth this concept is introduced AT. */
  depth: KnowledgeDepth;
  prerequisites: ConceptId[];

  /**
   * Terms this concept licenses for downstream use, lowercase.
   *
   * This is the mechanism behind the vocabulary-leakage test: a challenge may
   * only use terms introduced by its own concept or by a transitive
   * prerequisite. Everything else is a leak.
   */
  introducedVocabulary: string[];

  // -- Referential content: "what is this?" ---------------------------------
  /** Names the object. Must not state what it does to anything else. */
  referentDefinition: string;
  whereToSeeIt: string;
  whyItMatters: string;

  /**
   * The relationship the learner is meant to DISCOVER, stated here for the
   * reveal step and for the leakage test to check the card against.
   *
   * Null for pure-vocabulary concepts, which teach no relationship at all.
   */
  targetRelationship: string | null;

  // -- Bindings into the frozen model ---------------------------------------
  /** Compile-time checked. */
  charts: ChartViewId[];
  /** Runtime checked in integrity.test.ts -- ledger ids are plain strings. */
  couplings: string[];
  /** The scenario a concept card renders its example FROM. Never authored. */
  liveScenario: ScenarioId;

  /**
   * What this concept can never establish about a real organisation.
   *
   * The sixth move of a defensible answer, and the only one the frozen model
   * cannot supply raw material for -- so it is authored per concept and
   * taught explicitly.
   */
  evidenceBoundary: string | null;
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

export type ScenarioId =
  | 'baseline'
  | 'wip-raised'
  | 'tight-capacity'
  | 'incident-pressure'
  | 'steady-team'
  | 'constrained-state'
  | 'upstream-wip-raised';

/**
 * A named parameter set. Never a model variant.
 *
 * Two models would mean two truths, and the oracle stops being an oracle.
 * `overrides` is applied on top of DEFAULT_PARAMS and nothing else.
 */
export interface Scenario {
  id: ScenarioId;
  label: string;
  /** Why this parameterisation exists, for the challenge author and for tests. */
  intent: string;
  overrides: Partial<ScenarioParams>;
}

// ---------------------------------------------------------------------------
// Challenges
// ---------------------------------------------------------------------------

/**
 * PHASE 1 SCOPE NOTE -- articulation is DEFERRED.
 *
 * `articulation` stays in this union so the architecture is ready for the
 * Phase 2 handoff and nothing has to be reshaped later. It is not implemented:
 * no challenge declares it, no audio is captured, no speech is scored, and no
 * interview-question row is created. A test asserts the absence rather than
 * trusting it.
 *
 * Phase 1 implements everything the learner can do INSIDE the sandbox:
 * Orient -> Recognize -> Commit -> Act -> Compare -> Explain -> Generalise.
 * Turning that reasoning into a defensible spoken answer is Phase 2.
 */
export type ChallengeType =
  | 'recognition'
  | 'reading'
  | 'prediction'
  | 'explanation'
  | 'diagnosis'
  | 'counterfactual'
  | 'experimentSelection'
  | 'experimentInterpretation'
  | 'transfer'
  | 'articulation';

export type Difficulty = 'guided' | 'developing' | 'intermediate' | 'advanced' | 'expert';

/**
 * One prediction option.
 *
 * Balanced construction is a testable property, not a style note: a single
 * hedged option among absolutes is picked on instinct, and scores a correct
 * prediction from a learner who reasoned nothing.
 */
export interface PredictionOption {
  id: string;
  text: string;
}

/** Support, not answer delivery. Tiered, and every one taken is recorded. */
export interface Hint {
  tier: 1 | 2 | 3 | 4;
  /** observation -> relationship -> mechanism -> principle */
  text: string;
}

export type ChallengeId = string;

export interface Challenge {
  id: ChallengeId;
  conceptId: ConceptId;
  type: ChallengeType;
  /** The capability this challenge exercises. */
  capability: Capability;
  difficulty: Difficulty;
  scenario: ScenarioId;

  /** Shown before commitment. Subject to the vocabulary rule. */
  prompt: string;
  options: PredictionOption[];
  correctOptionId: string;

  /** Shown only after commitment. NOT subject to the vocabulary rule. */
  explanation: string;
  /** Ledger edges the explanation rests on. Runtime checked. */
  explanationCouplings: string[];

  hints: Hint[];

  /**
   * Set when this challenge tests the same principle on a materially
   * different scenario. A clone of the training scenario is not transfer.
   */
  transferOf?: ChallengeId;
  /**
   * Set when this challenge is one half of a counterfactual pair: two
   * scenarios with a similar visible symptom and different mechanisms.
   */
  pairedWith?: ChallengeId;
}

// ---------------------------------------------------------------------------
// Attempts -- the ONLY new persisted learner entity
// ---------------------------------------------------------------------------

export type LearningMode = 'guided' | 'explore' | 'blind' | 'fast-path';

/**
 * Evidence of one pass at a challenge.
 *
 * Mastery, progress and recommendations are all DERIVED from these on read
 * and never stored, so the mastery rule can be tightened later without
 * migrating anybody's history.
 */
export interface Attempt {
  attemptId: string;
  challengeId: ChallengeId;
  conceptId: ConceptId;

  /** Identifies the parameterisation, so transfer can be checked mechanically. */
  scenarioFingerprint: string;
  mode: LearningMode;

  startedAt: string;
  committedAt?: string;
  completedAt?: string;

  /** The option id the learner committed to, before seeing any result. */
  prediction?: string;
  explanationMechanisms?: string[];
  selectedAlternativeIds?: string[];
  /**
   * Binary coverage of structured reasoning. Never a speech-quality score, and
   * in Phase 1 never sourced from speech at all -- it records which parts of a
   * defensible answer the learner selected inside the sandbox.
   */
  rubricCoverage?: Record<string, boolean>;

  correct?: boolean;
  transfer?: boolean;
  hintCount: number;
  durationMs?: number;
}

/** Mastery states. Deliberately labels, not a single unvalidated score. */
export type MasteryState =
  | 'notStarted'
  | 'introduced'
  | 'practiced'
  | 'developing'
  | 'demonstrated'
  | 'transferDemonstrated'
  | 'mastered';

/**
 * Interview readiness is a SEPARATE state from concept mastery, and in Phase 1
 * it is permanently unreachable: the gate requires a qualifying articulation
 * attempt, and articulation is not implemented.
 *
 * The gate is built and held closed rather than omitted, because the rule it
 * enforces -- that no amount of prediction accuracy makes anyone
 * interview-ready -- is exactly the rule that gets quietly dropped when the
 * feature satisfying it is missing.
 */
export interface InterviewReadiness {
  ready: boolean;
  /** Why not. Always non-empty in Phase 1. */
  blockedBy: string[];
}

export const MASTERY_ORDER: MasteryState[] = [
  'notStarted',
  'introduced',
  'practiced',
  'developing',
  'demonstrated',
  'transferDemonstrated',
  'mastered',
];
