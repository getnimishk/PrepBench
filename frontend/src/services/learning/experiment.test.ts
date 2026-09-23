// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS } from '../metrics/params';
import { simulate } from '../metrics/compose';
import { baselineFor, keyOutcomes } from '../metrics/whatMoved';
import { describeChange, describeOutcome, experimentFor, moved, recordExperiment } from './experiment';
import { paramsFor } from './scenarios';

// "What actually happened" is the model's own numbers. These pin that the
// record is built from a real run, not from a sentence.

describe('recording the experiment', () => {
  it('names only what differs from the baseline, and every headline outcome before and after', () => {
    const params = { ...DEFAULT_PARAMS, wip: 10 };
    const baseline = baselineFor(params);
    const outcomes = keyOutcomes(simulate(params), params, simulate(baseline), baseline);

    const { manipulation, observed } = recordExperiment(params, baseline, outcomes);

    expect(manipulation).toEqual({ wip: { from: DEFAULT_PARAMS.wip, to: 10 } });
    expect(Object.keys(observed!)).toEqual(outcomes.map((o) => o.id));
    for (const o of outcomes) {
      expect(observed![o.id]).toMatchObject({ label: o.label, before: o.baseline, after: o.value });
    }
    // The experiment changed something real in the model.
    expect(Object.values(observed!).some(moved)).toBe(true);
  });

  it('records no manipulation at the baseline, and nothing moved', () => {
    const params = { ...DEFAULT_PARAMS };
    const outcomes = keyOutcomes(simulate(params), params, simulate(params), params);

    const { manipulation, observed } = recordExperiment(params, params, outcomes);

    expect(manipulation).toBeUndefined();
    expect(Object.values(observed!).some(moved)).toBe(false);
  });
});

describe('a scenario run on its own', () => {
  it('records the same experiment the page shows once it has re-rendered with that scenario', () => {
    const run = { ...paramsFor('wip-raised'), sprints: DEFAULT_PARAMS.sprints };
    const baseline = baselineFor(run);
    const onScreen = recordExperiment(run, baseline, keyOutcomes(simulate(run), run, simulate(baseline), baseline));

    const direct = experimentFor(run);

    expect(direct).toEqual(onScreen);
    expect(direct.manipulation?.wip.to).toBe(run.wip);
    expect(Object.values(direct.observed!).some(moved)).toBe(true);
  });
});

describe('describing it', () => {
  const cycle = { label: 'Cycle time', before: 5.21, after: 9.14, unit: 'days', precision: 1 };

  it('says which way it went, at the precision it is reported to', () => {
    expect(describeOutcome(cycle)).toBe('Cycle time rose from 5.2 to 9.1 days');
    expect(describeOutcome({ ...cycle, before: 9.14, after: 5.21 })).toBe('Cycle time fell from 9.1 to 5.2 days');
  });

  it('does not call rounding noise a movement', () => {
    const still = { ...cycle, before: 5.21, after: 5.24 };
    expect(moved(still)).toBe(false);
    expect(describeOutcome(still)).toBe('Cycle time stayed at 5.2 days');
  });

  it('shows shares as percentages', () => {
    const share = { label: 'Flow efficiency', before: 0.4, after: 0.25, unit: '', precision: 1, percent: true };
    expect(describeOutcome(share)).toBe('Flow efficiency fell from 40.0% to 25.0%');
  });

  it('names a change with the sandbox\'s own label', () => {
    expect(describeChange('wip', { from: 4, to: 8 })).toBe('WIP limit 4 → 8 items');
  });
});
