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
  it('shows the referent card first when the concept is new', () => {
    // A learner cannot generate a meaningful wrong prediction about a thing
    // whose referent they do not have. Without this we would be measuring
    // ignorance and reporting it as reasoning.
    const { challenge } = panelFor('wip-first-prediction', { conceptSeen: false });
    const concept = CONCEPTS[challenge.conceptId];

    expect(screen.getByText(concept.canonicalName)).toBeInTheDocument();
    expect(screen.getByText(concept.referentDefinition)).toBeInTheDocument();
    // ...and the question is not on screen yet.
    expect(screen.queryByText(challenge.prompt)).not.toBeInTheDocument();
  });

  it('never shows the relationship on the referent card', () => {
    // The rule the orientation layer exists for. The card names the object;
    // the challenge is where the relationship is discovered.
    const { challenge } = panelFor('wip-first-prediction', { conceptSeen: false });
    const concept = CONCEPTS[challenge.conceptId];
    expect(concept.targetRelationship).not.toBeNull();
    expect(screen.queryByText(concept.targetRelationship!)).not.toBeInTheDocument();
  });

  it('applies the challenge scenario to the sandbox when the learner starts', async () => {
    // The ACT step: the learner watches the real model respond, not a picture
    // of one.
    const user = userEvent.setup();
    const { challenge, props } = panelFor('wip-first-prediction', { conceptSeen: false });

    await user.click(screen.getByRole('button', { name: /Got it/ }));

    expect(props.onApplyScenario).toHaveBeenCalledWith(challenge.scenario);
    expect(screen.getByText(challenge.prompt)).toBeInTheDocument();
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
