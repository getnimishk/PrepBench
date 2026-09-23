// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Attempt } from '../../types/learning';
import { LearningPanel } from './LearningPanel';
import { CHALLENGE_BY_ID } from '../../services/learning/challenges';
import { CONCEPTS } from '../../services/learning/concepts';
import { recommendNext } from '../../services/learning/recommendations';

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
    onAttemptSaved: (a: Attempt): Promise<unknown> | void => {
      saved.push(a);
    },
    onSkip: vi.fn(),
    ...over,
  };
  render(<LearningPanel {...props} />);
  return { challenge, saved, props };
}

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

  it('has the sandbox running the scenario a reading question is about before it is answered', () => {
    // The ACT step: the learner watches the real model respond, not a picture
    // of one. A question about reading a chart needs the chart showing.
    const { challenge, props } = panelFor('throughput-reading', { conceptSeen: false });
    expect(challenge.type).toBe('reading');

    expect(props.onApplyScenario).toHaveBeenCalledWith(challenge.scenario);
    expect(screen.getByText(challenge.prompt)).toBeInTheDocument();
    // Named in the learner's terms rather than as a taxonomy chip.
    expect(screen.getByText(/The sandbox is running:/)).toBeInTheDocument();
  });

  it('runs the change a prediction is about only after the prediction is committed', async () => {
    // Predict, commit, then manipulate and observe. With the changed model on
    // screen while the question is open, the answer would sit beside it and
    // the prediction would record nothing.
    const user = userEvent.setup();
    const { challenge, props } = panelFor('wip-first-prediction');
    expect(challenge.type).toBe('prediction');
    const apply = vi.mocked(props.onApplyScenario);

    expect(apply).toHaveBeenCalledWith('baseline');
    expect(apply).not.toHaveBeenCalledWith(challenge.scenario);
    expect(screen.getByText(/Predict first; then it runs:/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: challenge.options[0].text }));

    expect(apply).toHaveBeenLastCalledWith(challenge.scenario);
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

describe('the experiment and the explanation', () => {
  const experiment = () => ({
    manipulation: { wip: { from: 4, to: 8 } },
    observed: {
      cycleTime: { label: 'Cycle time', before: 5.2, after: 9.1, unit: 'days', precision: 1 },
      throughput: { label: 'Realised throughput', before: 11.5, after: 11.5, unit: 'items/sprint', precision: 1 },
    },
  });

  it('keeps what the sandbox showed at the moment of commitment, and shows those numbers', async () => {
    const user = userEvent.setup();
    const observe = vi.fn(experiment);
    const { challenge, saved } = panelFor('wip-first-prediction', { observe });

    // Nothing is read before the learner commits.
    expect(observe).not.toHaveBeenCalled();
    expect(screen.queryByText('What actually happened')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: challenge.options[0].text }));

    // Read for the scenario the question is about, which runs only now.
    expect(observe).toHaveBeenCalledTimes(1);
    expect(observe).toHaveBeenCalledWith(challenge.scenario);
    expect(saved[0].prediction).toBe(challenge.options[0].id);
    expect(saved[0].manipulation).toEqual({ wip: { from: 4, to: 8 } });
    expect(saved[0].observed?.cycleTime.after).toBe(9.1);

    expect(screen.getByText('What actually happened')).toBeInTheDocument();
    expect(screen.getByText('Cycle time rose from 5.2 to 9.1 days')).toBeInTheDocument();
    // What stayed put is named once, not listed as if it were news.
    expect(screen.getByText('Unchanged: Realised throughput')).toBeInTheDocument();
    expect(screen.getByText(/Changed from the baseline: WIP limit 4 → 8 items/)).toBeInTheDocument();
  });

  it('says so in one line when nothing was changed and nothing moved', async () => {
    const user = userEvent.setup();
    const still = () => ({
      observed: {
        cycleTime: { label: 'Cycle time', before: 4, after: 4, unit: 'days', precision: 1 },
        throughput: { label: 'Realised throughput', before: 10.1, after: 10.1, unit: 'items/sprint', precision: 1 },
      },
    });
    const { challenge } = panelFor('throughput-reading', { observe: still });
    await user.click(screen.getByRole('button', { name: challenge.options[0].text }));

    const happened = screen.getByLabelText('What actually happened');
    expect(happened).toHaveTextContent('Nothing was changed from the baseline.');
    expect(happened).toHaveTextContent('None of the headline figures moved.');
    expect(screen.queryByText(/stayed at/)).not.toBeInTheDocument();
  });

  it('claims nothing happened when there was no experiment to read', async () => {
    const user = userEvent.setup();
    const { challenge } = panelFor('wip-first-prediction');
    await user.click(screen.getByRole('button', { name: challenge.options[0].text }));
    expect(screen.queryByText('What actually happened')).not.toBeInTheDocument();
  });

  it('saves the learner\'s own explanation with the attempt, and does not score it', async () => {
    const user = userEvent.setup();
    const { challenge, saved } = panelFor('wip-first-prediction', { observe: experiment });
    await user.click(screen.getByRole('button', { name: challenge.options[0].text }));

    const save = screen.getByRole('button', { name: 'Save explanation' });
    expect(save).toBeDisabled();

    await user.type(screen.getByLabelText('Your explanation'), 'More WIP queues behind the bottleneck.');
    await user.click(save);

    await waitFor(() => expect(screen.getByText('Saved with this attempt. Not scored.')).toBeInTheDocument());
    const last = saved[saved.length - 1];
    expect(last.explanationText).toBe('More WIP queues behind the bottleneck.');
    // The prediction travels unchanged with it.
    expect(last.prediction).toBe(saved[0].prediction);
    expect(last.committedAt).toBe(saved[0].committedAt);
    expect(screen.getByRole('button', { name: 'Save new wording' })).toBeDisabled();
  });

  it('says an unsaved answer does not count yet, and saves it on request', async () => {
    const user = userEvent.setup();
    const attempts: Attempt[] = [];
    const onAttemptSaved = vi.fn((a: Attempt) => {
      attempts.push(a);
      return attempts.length === 1
        ? Promise.reject({ response: { data: { detail: 'Database is locked.' } } })
        : Promise.resolve();
    });
    const { challenge } = panelFor('wip-first-prediction', { onAttemptSaved });

    await user.click(screen.getByRole('button', { name: challenge.options[0].text }));

    const alert = (await screen.findByText(/Your answer was not saved, so it does not count yet/)).closest('[role="alert"]')!;
    expect(alert).toHaveTextContent('Database is locked.');

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(screen.queryByText(/Your answer was not saved/)).not.toBeInTheDocument());
    // The same attempt, not a second one.
    expect(attempts[1].attemptId).toBe(attempts[0].attemptId);
    expect(attempts[1].prediction).toBe(attempts[0].prediction);
  });
});
