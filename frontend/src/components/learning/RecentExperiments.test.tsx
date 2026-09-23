// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { Attempt } from '../../types/learning';
import { CHALLENGE_BY_ID } from '../../services/learning/challenges';
import { RecentExperiments } from './RecentExperiments';

// The learner's record, read back: what they said, what the model showed, and
// their own words -- newest first, and nothing that was never committed.

const challenge = CHALLENGE_BY_ID.get('wip-first-prediction')!;

function attempt(over: Partial<Attempt>): Attempt {
  return {
    attemptId: `a-${Math.random().toString(36).slice(2, 10)}`,
    challengeId: challenge.id,
    conceptId: challenge.conceptId,
    scenarioFingerprint: '',
    mode: 'guided',
    startedAt: '2026-09-01T09:00:00Z',
    hintCount: 0,
    ...over,
  };
}

describe('RecentExperiments', () => {
  it('says there is nothing yet, rather than showing an empty list', () => {
    render(<RecentExperiments attempts={[attempt({})]} />);
    expect(screen.getByText(/None yet/)).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('shows what was said, what moved and the explanation, newest first', () => {
    render(
      <RecentExperiments
        attempts={[
          attempt({
            committedAt: '2026-09-01T09:01:00Z',
            prediction: 'more',
            correct: false,
          }),
          attempt({
            committedAt: '2026-09-02T09:01:00Z',
            prediction: 'same',
            correct: true,
            observed: {
              cycleTime: { label: 'Cycle time', before: 5.2, after: 9.1, unit: 'days', precision: 1 },
              throughput: { label: 'Realised throughput', before: 11.5, after: 11.5, unit: 'items/sprint', precision: 1 },
            },
            explanationText: 'Starting more does not add capacity.',
          }),
        ]}
      />,
    );

    const [newest, older] = screen.getAllByRole('listitem');
    expect(within(newest).getByText(/You said: About the same number finish in each sprint/)).toHaveTextContent('matches the model');
    // Only what moved is named; what stayed put is not news.
    expect(within(newest).getByText('Cycle time rose from 5.2 to 9.1 days')).toBeInTheDocument();
    expect(within(newest).queryByText(/Realised throughput/)).not.toBeInTheDocument();
    expect(within(newest).getByText('Your explanation: Starting more does not add capacity.')).toBeInTheDocument();

    expect(within(older).getByText(/You said: More work items finish in each sprint/)).toHaveTextContent('not what the model does');
    // No experiment was kept for it, so nothing is claimed about what happened.
    expect(within(older).queryByText(/rose|fell|Nothing moved/)).not.toBeInTheDocument();
  });
});
