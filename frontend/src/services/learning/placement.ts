import type {
  Attempt,
  Capability,
  ChallengeId,
  KnowledgeDepth,
  Placement,
} from '../../types/learning';
import { CAPABILITIES, KNOWLEDGE_DEPTHS } from '../../types/learning';
import { CONCEPTS, CONCEPT_LIST } from './concepts';
import { CHALLENGE_BY_ID } from './challenges';
import { masteryMap } from './mastery';

// Where the learner is, as a CELL rather than a rung.
//
// The two axes come apart badly in exactly the population this product serves.
// An engineering manager arrives knowing what DORA is and unable to diagnose
// from a chart: high depth, low capability. An analyst arrives with the
// reverse. A single "beginner / intermediate / advanced" score gives both the
// wrong entry point, and one of them quits in the first session.
//
// Placement is inferred from attempts, never asserted by the learner and never
// stored -- the same reasoning as mastery. It also has a floor: a learner with
// no history is placed at the entry cell rather than at nothing, so the
// recommender always has somewhere to start.

const ENTRY: Placement = { depth: 'vocabulary', capability: 'recognize' };

const depthRank = (d: KnowledgeDepth) => KNOWLEDGE_DEPTHS.indexOf(d);
const capabilityRank = (c: Capability) => CAPABILITIES.indexOf(c);

/**
 * The deepest concept the learner has actually demonstrated, and the highest
 * capability they have exercised unaided.
 *
 * Deliberately asymmetric in what counts. DEPTH is credited from demonstrated
 * mastery, because knowing a term is not the same as having shown you can use
 * it. CAPABILITY is credited from unaided correct answers only, because a
 * capability exercised with the answer in front of you was not exercised.
 */
export function inferPlacement(attempts: Attempt[]): Placement {
  const mastery = masteryMap(attempts);

  let depth = ENTRY.depth;
  for (const concept of CONCEPT_LIST) {
    const state = mastery[concept.id].state;
    const shown = state === 'demonstrated' || state === 'transferDemonstrated' || state === 'mastered';
    if (shown && depthRank(concept.depth) > depthRank(depth)) depth = concept.depth;
  }

  let capability = ENTRY.capability;
  for (const attempt of attempts) {
    if (attempt.correct !== true || attempt.hintCount > 0) continue;
    const challenge = CHALLENGE_BY_ID.get(attempt.challengeId);
    if (!challenge) continue;
    if (capabilityRank(challenge.capability) > capabilityRank(capability)) {
      capability = challenge.capability;
    }
  }

  return { depth, capability };
}

/**
 * The gap worth targeting next.
 *
 * A learner whose depth outruns their capability needs a task that makes them
 * USE what they know; one whose capability outruns their depth needs the
 * vocabulary to describe what they are already doing. Naming which of the two
 * is the case is the whole reason placement is a matrix.
 */
export function placementGap(placement: Placement): 'depth' | 'capability' | 'balanced' {
  const d = depthRank(placement.depth) / (KNOWLEDGE_DEPTHS.length - 1);
  const c = capabilityRank(placement.capability) / (CAPABILITIES.length - 1);
  if (Math.abs(d - c) < 0.2) return 'balanced';
  return d > c ? 'capability' : 'depth';
}

/** Concepts whose prerequisites have all been demonstrated at least once. */
export function reachableConcepts(attempts: Attempt[]) {
  const mastery = masteryMap(attempts);
  const cleared = (id: keyof typeof mastery) => {
    const state = mastery[id].state;
    return (
      state === 'developing' ||
      state === 'demonstrated' ||
      state === 'transferDemonstrated' ||
      state === 'mastered'
    );
  };

  return CONCEPT_LIST.filter((concept) =>
    CONCEPTS[concept.id].prerequisites.every((p) => cleared(p)),
  );
}

// ---------------------------------------------------------------------------
// Diagnostic placement
// ---------------------------------------------------------------------------

/**
 * The placement probe: three real challenges at rising capability.
 *
 * It TESTS rather than asks. A self-report ("how much do you know about
 * flow?") is a claim, and the two people this product most needs to place
 * correctly -- the manager who knows the vocabulary and cannot diagnose, and
 * the analyst who can diagnose and lacks the words -- both answer that
 * question badly about themselves.
 *
 * Because the probe is made of ordinary challenges, its answers are ordinary
 * attempts. No new persisted entity, no self-report to store, and placement
 * falls out of `inferPlacement` with no special case: get them right and you
 * start further along, get them wrong and you start at the beginning.
 *
 * A probe question deliberately uses vocabulary the learner may not have --
 * that is what makes it diagnostic. The UI must say so, and must offer a way
 * out that costs nothing.
 */
export const PLACEMENT_PROBE: ChallengeId[] = [
  'sandbox-recognition',
  'littles-law-prediction',
  'cfd-diagnose-constraint',
];

export interface ProbeProgress {
  done: number;
  total: number;
  next: ChallengeId | null;
  complete: boolean;
}

export function probeProgress(attempts: Attempt[]): ProbeProgress {
  const answered = new Set(
    attempts.filter((a) => a.completedAt !== undefined).map((a) => a.challengeId),
  );
  const remaining = PLACEMENT_PROBE.filter((id) => !answered.has(id));
  return {
    done: PLACEMENT_PROBE.length - remaining.length,
    total: PLACEMENT_PROBE.length,
    next: remaining[0] ?? null,
    complete: remaining.length === 0,
  };
}

/** True once the learner has answered anything at all. */
export function hasHistory(attempts: Attempt[]): boolean {
  return attempts.some((a) => a.completedAt !== undefined);
}
