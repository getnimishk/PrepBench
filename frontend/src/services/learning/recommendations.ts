import type { Attempt, Challenge, ChallengeType, ConceptId, Difficulty } from '../../types/learning';
import { CONCEPTS, conceptOrder } from './concepts';
import { CHALLENGES, challengesForConcept } from './challenges';
import { masteryMap, type ConceptMastery } from './mastery';
import { inferPlacement, placementGap, reachableConcepts } from './placement';

// What to do next, and why.
//
// A recommendation that cannot explain itself is an instruction, and an
// instruction teaches compliance. Every recommendation here resolves to the
// evidence that is missing and the reason this particular task supplies it --
// which is also what makes it debuggable when it picks something odd.
//
// The ordering inside a concept follows the loop the product teaches:
// recognise the object, read the chart, predict, explain the mechanism, then
// transfer. That is not an arbitrary sequence; each step is the prerequisite
// evidence for the next one's mastery claim.

const TYPE_ORDER: ChallengeType[] = [
  'recognition',
  'reading',
  'prediction',
  'explanation',
  'counterfactual',
  'diagnosis',
  'experimentSelection',
  'experimentInterpretation',
  'transfer',
  // 'articulation' is deliberately absent: Phase 2.
];

export interface Recommendation {
  conceptId: ConceptId;
  challengeId: string;
  /** Why this, now. Shown to the learner verbatim. */
  rationale: string;
  /** What completing it would establish. */
  expectedEvidence: string[];
  difficulty: Difficulty;
}

/** Attempts on a specific challenge, most recent last. */
const attemptsOn = (attempts: Attempt[], challengeId: string) =>
  attempts.filter((a) => a.challengeId === challengeId);

/** Solved cleanly already -- no reason to recommend it again. */
function alreadySettled(attempts: Attempt[], challenge: Challenge): boolean {
  return attemptsOn(attempts, challenge.id).some((a) => a.correct === true && a.hintCount === 0);
}

function orderChallenges(list: Challenge[]): Challenge[] {
  return [...list].sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type));
}

/**
 * The next challenge worth doing.
 *
 * Walks the concept graph in dependency order and stops at the first concept
 * that is reachable and not yet mastered. Within it, takes the earliest step
 * of the loop the learner has not settled -- so a learner who can already
 * predict is not sent back to recognise the object, and one who has never seen
 * the object is not asked to predict with it.
 */
export function recommendNext(attempts: Attempt[]): Recommendation | null {
  const mastery = masteryMap(attempts);
  const reachable = new Set(reachableConcepts(attempts).map((c) => c.id));
  const placement = inferPlacement(attempts);
  const gap = placementGap(placement);

  for (const conceptId of conceptOrder()) {
    if (!reachable.has(conceptId)) continue;
    if (mastery[conceptId].state === 'mastered') continue;

    const candidates = orderChallenges(challengesForConcept(conceptId)).filter(
      (c) => !alreadySettled(attempts, c),
    );
    if (candidates.length === 0) continue;

    const challenge = candidates[0];
    return {
      conceptId,
      challengeId: challenge.id,
      rationale: explainChoice(challenge, mastery[conceptId], gap),
      expectedEvidence: evidenceFrom(challenge),
      difficulty: challenge.difficulty,
    };
  }

  return null;
}

function explainChoice(
  challenge: Challenge,
  mastery: ConceptMastery,
  gap: 'depth' | 'capability' | 'balanced',
): string {
  const concept = CONCEPTS[challenge.conceptId];

  if (mastery.state === 'notStarted') {
    return `${concept.canonicalName} has not been introduced yet, and everything after it depends on it.`;
  }

  if (challenge.transferOf) {
    return (
      `You have answered this correctly on one scenario. This is the same principle on a ` +
      `different team, which is what separates understanding it from remembering the picture.`
    );
  }

  if (challenge.type === 'counterfactual') {
    return (
      `You can predict what happens. This asks something harder: two mechanisms produce ` +
      `the same symptom here, and the chart alone does not say which.`
    );
  }

  const missing = mastery.nextEvidenceNeeded[0];
  if (missing) {
    return `${concept.canonicalName} still needs ${missing}. This task supplies it.`;
  }

  if (gap === 'capability') {
    return `You know the terms for ${concept.canonicalName}. This asks you to use them.`;
  }
  if (gap === 'depth') {
    return `You can already do this. This names what you are doing, so you can say it.`;
  }

  return `The next step for ${concept.canonicalName}.`;
}

function evidenceFrom(challenge: Challenge): string[] {
  const evidence: string[] = [];
  switch (challenge.type) {
    case 'recognition':
      evidence.push('you can find the object in the live sandbox');
      break;
    case 'reading':
      evidence.push('you can read the shape rather than only the number');
      break;
    case 'prediction':
      evidence.push('you can say what will happen before it happens');
      break;
    case 'explanation':
    case 'diagnosis':
      evidence.push('you can name the mechanism, not only the outcome');
      break;
    case 'counterfactual':
      evidence.push('you can separate two mechanisms that look identical on a chart');
      break;
    case 'transfer':
      evidence.push('the principle survives a scenario you have not seen');
      break;
    default:
      evidence.push('progress on this concept');
  }
  if (challenge.transferOf) evidence.push('transfer, which mastery requires');
  return evidence;
}

/** Every challenge, for the "explore freely" surface. Nothing is ever locked. */
export function allChallenges(): Challenge[] {
  return orderChallenges(CHALLENGES);
}
