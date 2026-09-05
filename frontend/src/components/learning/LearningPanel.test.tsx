// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Attempt } from '../../types/learning';
import { LearningPanel } from './LearningPanel';
import { CHALLENGE_BY_ID } from '../../services/learning/challenges';
import { CONCEPTS } from '../../services/learning/concepts';
import { recommendNext } from '../../services/learning/recommendations';
import { clearAttempts } from '../../services/learning/attempts';

// The guided loop, tested where it can actually break.
//
// The two properties worth protecting are both structural. The prediction must
// be recorded BEFORE any result is visible, and the explanation must arrive
// AFTER. Reverse either and the product still looks fine, still renders, and
// stops measuring anything: an explanation shown first turns the sandbox into
// an illustration, and a prediction taken afterwards is hindsight.

function panelFor(challengeId: string, over: Partial<Parameters<typeof LearningPanel>[0]> = {}) {
  const challenge = CHALLENGE_BY_ID.get(challengeId)!;
  const saved: Attempt[] = [];
  const props = {
    recommendation: {
      conceptId: challenge.conceptId,
      challengeId: challenge.id,
      rationale: 'because the test says so',
      expectedEvidence: ['evidence'],
      difficulty: challenge.difficulty,
    },
    conceptSeen: true,
    onApplyScenario: vi.fn(),
    onAttemptSaved: (a: Attempt) => saved.push(a),
    onSkip: vi.fn(),
    ...over,
  };
  render(<LearningPanel {...props} />);
  return { challenge, saved, props };
}

beforeEach(() => clearAttempts());

describe('the guided loop', () => {
  it('leads with the question, and keeps the referent within reach', async () => {
    // A learner cannot generate a meaningful wrong prediction about a thing
    // whose referent they do not have -- so the referent stays available.
    //
    // It is no longer a gate. It used to be a full-width card between the
    // learner and the question, explaining what a sprint is and that the
    // charts are plotted per sprint: framing for reading the charts, not for
    // answering the question, and the first thing a first-time visitor was
    // made to read.
    const user = userEvent.setup();
    const { challenge } = panelFor('wip-first-prediction', { conceptSeen: false });
    const concept = CONCEPTS[challenge.conceptId];

    expect(screen.getByText(challenge.prompt)).toBeInTheDocument();
    expect(screen.queryByText(concept.referentDefinition)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /What the sandbox is showing/ }));
    expect(screen.getByText(concept.referentDefinition)).toBeInTheDocument();
  });

  it('drops the referent offer once the learner has met the concept by doing', () => {
    panelFor('wip-first-prediction', { conceptSeen: true });

    expect(
      screen.queryByRole('button', { name: /What the sandbox is showing/ }),
    ).not.toBeInTheDocument();
  });

  it('never shows the relationship on the referent card', async () => {
    // The rule the orientation layer exists for, and it survives the card
    // moving: naming the object is legitimate, giving away the relationship
    // turns the prediction into reading comprehension.
    const user = userEvent.setup();
    const { challenge } = panelFor('wip-first-prediction', { conceptSeen: false });
    const concept = CONCEPTS[challenge.conceptId];
    expect(concept.targetRelationship).not.toBeNull();

    await user.click(screen.getByRole('button', { name: /What the sandbox is showing/ }));
    expect(screen.queryByText(concept.targetRelationship!)).not.toBeInTheDocument();
  });

  it('has the sandbox running the challenge scenario before the question is answered', () => {
    // The ACT step: the learner watches the real model respond, not a picture
    // of one. It used to be tied to dismissing the orientation card, which
    // made the sandbox's state depend on a button whose only job was to get
    // out of the way.
    const { challenge, props } = panelFor('wip-first-prediction', { conceptSeen: false });

    expect(props.onApplyScenario).toHaveBeenCalledWith(challenge.scenario);
    expect(screen.getByText(challenge.prompt)).toBeInTheDocument();
    // Named in the learner's terms rather than as a taxonomy chip.
    expect(screen.getByText(/The sandbox is running:/)).toBeInTheDocument();
  });

  it('hides the answer and the explanation until a prediction is committed', () => {
    const { challenge } = panelFor('wip-first-prediction');

    expect(screen.getByText(challenge.prompt)).toBeInTheDocument();
    expect(screen.queryByText(challenge.explanation)).not.toBeInTheDocument();
    expect(screen.queryByText('Why')).not.toBeInTheDocument();
  });

  it('commits a prediction in one click, and reveals the explanation only then', async () => {
    // Two clicks and under two seconds is the constraint. If committing costs
    // a form, nobody does it, and the loop degrades into a dashboard with tips.
    const user = userEvent.setup();
    const { challenge, saved } = panelFor('wip-first-prediction');
    const correct = challenge.options.find((o) => o.id === challenge.correctOptionId)!;

    await user.click(screen.getByRole('button', { name: correct.text }));

    expect(saved).toHaveLength(1);
    expect(saved[0].prediction).toBe(correct.id);
    expect(saved[0].correct).toBe(true);
    expect(saved[0].hintCount).toBe(0);
    expect(screen.getByText(challenge.explanation)).toBeInTheDocument();
  });

  it('shows what the learner said next to what the model does, when they differ', async () => {
    const user = userEvent.setup();
    const { challenge } = panelFor('wip-first-prediction');
    const wrong = challenge.options.find((o) => o.id !== challenge.correctOptionId)!;
    const right = challenge.options.find((o) => o.id === challenge.correctOptionId)!;

    await user.click(screen.getByRole('button', { name: wrong.text }));

    expect(screen.getByText('You said')).toBeInTheDocument();
    expect(screen.getByText(wrong.text)).toBeInTheDocument();
    expect(screen.getByText('The model does this')).toBeInTheDocument();
    expect(screen.getByText(right.text)).toBeInTheDocument();
  });

  it('records hints taken before commitment, without blocking the answer', async () => {
    // Support, not punishment. Taking a hint is legitimate; it just stops the
    // attempt counting as unaided evidence.
    const user = userEvent.setup();
    const { challenge, saved } = panelFor('wip-first-prediction');

    await user.click(screen.getByRole('button', { name: /Take a hint/ }));
    expect(screen.getByText(challenge.hints[0].text)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Another hint/ }));

    const correct = challenge.options.find((o) => o.id === challenge.correctOptionId)!;
    await user.click(screen.getByRole('button', { name: correct.text }));

    expect(saved[0].hintCount).toBe(2);
    expect(saved[0].correct).toBe(true);
  });

  it('names what the sandbox cannot establish about a real organisation', async () => {
    // The one move of a defensible answer the frozen model cannot supply raw
    // material for, so it is taught explicitly rather than left implied.
    const user = userEvent.setup();
    const { challenge } = panelFor('wip-first-prediction');
    const concept = CONCEPTS[challenge.conceptId];

    await user.click(
      screen.getByRole('button', {
        name: challenge.options.find((o) => o.id === challenge.correctOptionId)!.text,
      }),
    );

    expect(screen.getByText(/What this cannot tell you/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(concept.evidenceBoundary!.slice(0, 40)))).toBeInTheDocument();
  });

  it('shows the mechanism typed as the ledger types it', async () => {
    // arithmetic / assumption / convention, never flattened into "the formula
    // says". The counterfactual pair is where that distinction earns its keep.
    const user = userEvent.setup();
    const { challenge } = panelFor('counterfactual-incidents');

    await user.click(
      screen.getByRole('button', {
        name: challenge.options.find((o) => o.id === challenge.correctOptionId)!.text,
      }),
    );

    expect(screen.getByText(/^assumption:/)).toBeInTheDocument();
  });
});

describe('what a new learner meets first', () => {
  it('is a recognition task on the first concept, not a prediction', () => {
    const next = recommendNext([])!;
    const challenge = CHALLENGE_BY_ID.get(next.challengeId)!;

    panelFor(next.challengeId, { conceptSeen: true });

    expect(challenge.type).toBe('recognition');
    expect(screen.getByText(challenge.prompt)).toBeInTheDocument();
  });
});
