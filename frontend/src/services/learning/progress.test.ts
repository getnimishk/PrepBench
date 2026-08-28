import { describe, it, expect, beforeEach } from 'vitest';
import type { Attempt, ConceptId } from '../../types/learning';
import { CHALLENGE_BY_ID, CHALLENGES } from './challenges';
import { fingerprint, paramsFor } from './scenarios';
import {
  commitPrediction,
  completeAttempt,
  clearAttempts,
  loadAttempts,
  parseAttempts,
  saveAttempt,
  startAttempt,
  withHint,
} from './attempts';
import { interviewReadiness, masteryFor, masteryMap } from './mastery';
import { inferPlacement, placementGap } from './placement';
import { recommendNext } from './recommendations';

// Mastery, placement and recommendation are all DERIVED. These tests pin the
// rules rather than the numbers -- a stored grade would freeze whatever rule
// was in force when it was written, and the whole point of recomputing is that
// the rule below is the only rule that has ever applied.

function attemptOn(challengeId: string, over: Partial<Attempt> = {}): Attempt {
  const challenge = CHALLENGE_BY_ID.get(challengeId)!;
  return {
    attemptId: `test-${challengeId}-${Math.random().toString(36).slice(2, 8)}`,
    challengeId,
    conceptId: challenge.conceptId,
    scenarioFingerprint: fingerprint(paramsFor(challenge.scenario)),
    mode: 'guided',
    startedAt: '2026-01-01T00:00:00.000Z',
    committedAt: '2026-01-01T00:00:10.000Z',
    completedAt: '2026-01-01T00:00:20.000Z',
    prediction: challenge.correctOptionId,
    correct: true,
    hintCount: 0,
    ...over,
  };
}

describe('the attempt lifecycle', () => {
  it('refuses to score an attempt that was never committed', () => {
    // Without a recorded prediction there is nothing to be right or wrong
    // about. Scoring it would invent evidence, and every accuracy number
    // downstream would be measuring nothing.
    const challenge = CHALLENGE_BY_ID.get('wip-first-prediction')!;
    const started = startAttempt(challenge);
    const closed = completeAttempt(started, challenge);

    expect(closed.completedAt).toBeUndefined();
    expect(closed.correct).toBeUndefined();
  });

  it('refuses to amend a prediction once it is committed', () => {
    // An amended prediction after seeing the outcome is hindsight wearing a
    // prediction's clothes.
    const challenge = CHALLENGE_BY_ID.get('wip-first-prediction')!;
    const committed = commitPrediction(startAttempt(challenge), 'more');
    const amended = commitPrediction(committed, 'same');

    expect(amended.prediction).toBe('more');
    expect(amended.committedAt).toBe(committed.committedAt);
  });

  it('scores against the model’s answer and marks transfer from the challenge', () => {
    const challenge = CHALLENGE_BY_ID.get('littles-law-transfer')!;
    const done = completeAttempt(
      commitPrediction(startAttempt(challenge), challenge.correctOptionId),
      challenge,
    );

    expect(done.correct).toBe(true);
    expect(done.transfer).toBe(true);
  });

  it('counts hints taken before commitment, and stops counting after', () => {
    // Hints are support, not punishment -- but a hint taken before you commit
    // is part of how you answered, and one taken afterwards is just reading.
    const challenge = CHALLENGE_BY_ID.get('wip-first-prediction')!;
    const hinted = withHint(withHint(startAttempt(challenge)));
    expect(hinted.hintCount).toBe(2);

    const after = withHint(commitPrediction(hinted, 'same'));
    expect(after.hintCount).toBe(2);
  });
});

describe('attempt storage', () => {
  beforeEach(() => clearAttempts());

  it('round-trips an attempt', () => {
    const attempt = attemptOn('wip-recognition');
    saveAttempt(attempt);
    expect(loadAttempts().map((a) => a.attemptId)).toContain(attempt.attemptId);
  });

  it('replaces by id rather than appending a duplicate', () => {
    const attempt = attemptOn('wip-recognition', { correct: false });
    saveAttempt(attempt);
    saveAttempt({ ...attempt, correct: true });

    const stored = loadAttempts().filter((a) => a.attemptId === attempt.attemptId);
    expect(stored).toHaveLength(1);
    expect(stored[0].correct).toBe(true);
  });

  it('discards an unreadable payload instead of throwing', () => {
    // A private window, cleared site data or a partial write. Losing progress
    // is bad; refusing to render the page because progress is unreadable is
    // worse.
    expect(parseAttempts('{not json')).toEqual([]);
    expect(parseAttempts(null)).toEqual([]);
    expect(parseAttempts('{"not":"an array"}')).toEqual([]);
    // ...and a half-written record is dropped without taking the rest with it.
    const good = attemptOn('wip-recognition');
    expect(parseAttempts(JSON.stringify([good, { attemptId: 'partial' }]))).toEqual([good]);
  });

  it('keeps the session alive when the browser gives us no storage at all', () => {
    // jsdom provides none, and so does a browser set to block site data. The
    // alternative is a learner whose every answer vanishes as they give it.
    const attempt = attemptOn('sandbox-recognition');
    saveAttempt(attempt);
    expect(loadAttempts().map((a) => a.attemptId)).toContain(attempt.attemptId);
  });
});

describe('mastery inference', () => {
  it('starts every concept at notStarted', () => {
    const map = masteryMap([]);
    for (const state of Object.values(map)) {
      expect(state.state).toBe('notStarted');
      expect(state.nextEvidenceNeeded.length).toBeGreaterThan(0);
    }
  });

  it('does not credit a correct answer that needed hints as unaided', () => {
    const hinted = masteryFor('wip', [
      attemptOn('wip-recognition', { hintCount: 2 }),
      attemptOn('wip-first-prediction', { hintCount: 1 }),
    ]);
    expect(hinted.correct).toBe(2);
    expect(hinted.unaidedCorrect).toBe(0);
    expect(hinted.state).toBe('developing');
    expect(hinted.hintDependence).toBe(1.5);
  });

  it('reaches demonstrated on unaided answers, and stops there without transfer', () => {
    // Transfer is mandatory. A repeated clone of the training scenario is
    // repetition, and certifying it as understanding is exactly how
    // shape-matching gets marked as reasoning.
    const state = masteryFor('wip', [
      attemptOn('wip-recognition'),
      attemptOn('wip-first-prediction'),
    ]);
    expect(state.state).toBe('demonstrated');
    expect(state.transferDemonstrated).toBe(false);
    expect(state.nextEvidenceNeeded).toContain(
      'the same principle applied to a different scenario',
    );
  });

  it('requires transfer, a mechanism and a second scenario before mastered', () => {
    const conceptId: ConceptId = 'littles-law';
    const withoutMechanism = masteryFor(conceptId, [
      attemptOn('littles-law-prediction'),
      attemptOn('littles-law-transfer'),
      attemptOn('littles-law-prediction', { attemptId: 'again' }),
    ]);
    expect(withoutMechanism.transferDemonstrated).toBe(true);
    expect(withoutMechanism.mechanismDemonstrated).toBe(false);
    expect(withoutMechanism.state).toBe('transferDemonstrated');
    expect(withoutMechanism.nextEvidenceNeeded).toContain(
      'naming the mechanism, not only the outcome',
    );
  });

  it('reaches mastered only with every kind of evidence present', () => {
    const state = masteryFor('wip-cycle-time-mechanism', [
      attemptOn('counterfactual-wip'),
      attemptOn('counterfactual-incidents'),
      attemptOn('counterfactual-wip', { attemptId: 'again', transfer: true }),
    ]);
    expect(state.mechanismDemonstrated).toBe(true);
    expect(state.distinctScenarios).toBe(2);
    expect(state.unaidedCorrect).toBe(3);
    expect(state.state).toBe('mastered');
    expect(state.nextEvidenceNeeded).toEqual([]);
  });
});

describe('interview readiness is gated, and the gate is closed in Phase 1', () => {
  it('cannot be reached by prediction accuracy alone', () => {
    // The non-negotiable rule, asserted while the feature that would satisfy
    // it does not exist. Building the gate and holding it closed is the only
    // way this survives the phase it cannot be met in.
    const perfect = CHALLENGES.map((c) => attemptOn(c.id));
    const readiness = interviewReadiness(perfect);

    expect(readiness.ready).toBe(false);
    expect(readiness.blockedBy.join(' ')).toMatch(/articulation is not implemented/i);
  });

  it('says why, rather than failing silently', () => {
    expect(interviewReadiness([]).blockedBy.length).toBeGreaterThan(0);
  });
});

describe('placement is a cell, not a rung', () => {
  it('places a learner with no history at the entry cell', () => {
    expect(inferPlacement([])).toEqual({ depth: 'vocabulary', capability: 'recognize' });
  });

  it('credits capability only for unaided work', () => {
    const hinted = inferPlacement([attemptOn('littles-law-prediction', { hintCount: 3 })]);
    expect(hinted.capability).toBe('recognize');

    const unaided = inferPlacement([attemptOn('littles-law-prediction')]);
    expect(unaided.capability).toBe('predict');
  });

  it('names which axis is behind, because that decides what to do next', () => {
    // High depth with low capability is the engineering manager; the reverse
    // is the analyst. A single score gives both the wrong entry point.
    expect(placementGap({ depth: 'systemBehaviour', capability: 'recognize' })).toBe('capability');
    expect(placementGap({ depth: 'vocabulary', capability: 'intervene' })).toBe('depth');
    expect(placementGap({ depth: 'vocabulary', capability: 'recognize' })).toBe('balanced');
  });
});

describe('the recommender', () => {
  it('starts a new learner at the first concept in the graph', () => {
    const next = recommendNext([]);
    expect(next).not.toBeNull();
    expect(next!.conceptId).toBe('sandbox-and-work');
    expect(next!.challengeId).toBe('sandbox-recognition');
  });

  it('never asks for a prediction before the object has been recognised', () => {
    // The beginner rule, enforced by ordering rather than by hope: a learner
    // cannot generate a meaningful wrong prediction about a thing whose
    // referent they do not have.
    const next = recommendNext([])!;
    expect(CHALLENGE_BY_ID.get(next.challengeId)!.type).toBe('recognition');
  });

  it('moves on once a step is settled unaided, and not before', () => {
    const afterRecognition = recommendNext([attemptOn('sandbox-recognition')])!;
    expect(afterRecognition.conceptId).toBe('wip');

    // A hinted answer is not settled, so it comes back around.
    const hintedOnly = recommendNext([attemptOn('sandbox-recognition', { hintCount: 2 })])!;
    expect(hintedOnly.challengeId).toBe('sandbox-recognition');
  });

  it('explains itself, and says what the task would establish', () => {
    // A recommendation that cannot explain itself is an instruction, and an
    // instruction teaches compliance.
    const next = recommendNext([])!;
    expect(next.rationale.length).toBeGreaterThan(30);
    expect(next.expectedEvidence.length).toBeGreaterThan(0);
  });

  it('never recommends an articulation challenge, because Phase 1 has none', () => {
    let attempts: Attempt[] = [];
    for (let i = 0; i < CHALLENGES.length + 2; i++) {
      const next = recommendNext(attempts);
      if (!next) break;
      expect(CHALLENGE_BY_ID.get(next.challengeId)!.type).not.toBe('articulation');
      attempts = [...attempts, attemptOn(next.challengeId, { attemptId: `seq-${i}` })];
    }
  });

  it('runs out of recommendations once everything is settled', () => {
    const everything = CHALLENGES.flatMap((c, i) => [
      attemptOn(c.id, { attemptId: `a-${i}` }),
      attemptOn(c.id, { attemptId: `b-${i}` }),
      attemptOn(c.id, { attemptId: `c-${i}` }),
    ]);
    expect(recommendNext(everything)).toBeNull();
  });
});

describe('Phase 1 scope is enforced, not just intended', () => {
  it('declares no articulation challenge anywhere', () => {
    // Articulation is Phase 2. The type exists so the architecture is ready;
    // the absence is asserted so it cannot drift back in unnoticed.
    expect(CHALLENGES.filter((c) => c.type === 'articulation')).toEqual([]);
  });

  it('never records audio, a speech score or an interview question', () => {
    const attempt = attemptOn('wip-first-prediction');
    const keys = Object.keys(attempt);
    for (const banned of ['audio', 'recording', 'speechScore', 'interviewQuestionId']) {
      expect(keys.some((k) => k.toLowerCase().includes(banned.toLowerCase())), banned).toBe(false);
    }
  });
});
