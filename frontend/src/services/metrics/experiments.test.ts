import { describe, it, expect } from 'vitest';
import type { ScenarioParams } from '../../types/agileMetrics';
import { CHART_VIEWS } from './charts';
import { DEFAULT_PARAMS, paramSpec } from './params';
import { simulate } from './compose';
import { EXPERIMENTS, chooseTarget, reachOf } from './experiments';
import { baselineFor } from './whatMoved';

// The recommendation has to be defensible.
//
// "Increase WIP from 4 to 8" was authored, and a reader could reasonably ask
// why 8 and not 5. There was no answer. The target is now measured against a
// stated rule -- the smallest step whose effect clears both the variation the
// baseline already shows and a tenth of the current value -- and this file is
// what keeps the rule honest rather than decorative.

const params: ScenarioParams = { ...DEFAULT_PARAMS };

const spread = (v: number[]) => Math.max(...v) - Math.min(...v);

describe('experiment targets', () => {
  it('names a control that is actually on the panel', () => {
    for (const e of EXPERIMENTS) {
      const spec = paramSpec(e.key);
      expect(spec.exposed, `${e.id} moves a hidden control`).toBe(true);
      expect(spec.calibration, `${e.id} moves a teaching coefficient`).toBe(false);
    }
  });

  it('names a chart that is in the inventory', () => {
    for (const e of EXPERIMENTS) {
      expect(
        CHART_VIEWS.some((v) => v.id === e.watchFirst),
        `${e.id} watches a view that does not exist`,
      ).toBe(true);
    }
  });

  it('chooses a target inside the slider range', () => {
    for (const e of EXPERIMENTS) {
      const spec = paramSpec(e.key);
      const { value } = chooseTarget(e, params);
      expect(value, e.id).toBeGreaterThanOrEqual(spec.min);
      expect(value, e.id).toBeLessThanOrEqual(spec.max);
      expect(value, `${e.id} recommends the value it already has`).not.toBe(params[e.key]);
    }
  });

  it('picks an effect the reader can actually distinguish from the run', () => {
    // The rule, asserted rather than described. If a target ever fails this,
    // the card is telling someone to look for a difference smaller than the
    // wobble already on screen -- which teaches reading signal into noise.
    for (const e of EXPERIMENTS) {
      const baseline = baselineFor(params);
      const baseRun = simulate(baseline);
      const observed = baseRun.map((s) => e.observe(s, baseline));
      const from = observed[observed.length - 1];
      const floor = Math.max(spread(observed), Math.abs(from) * 0.1);

      const { value, saturated } = chooseTarget(e, params);
      if (saturated) continue;

      const run = simulate({ ...baseline, [e.key]: value });
      const effect = Math.abs(e.observe(run[run.length - 1], baseline) - from);
      expect(effect, `${e.id} target is smaller than the noise it has to clear`).toBeGreaterThan(
        floor,
      );
    }
  });

  it('picks the SMALLEST such step, not a dramatic one', () => {
    // The cautious version of the experiment is the one anyone would actually
    // run against a real team. A rule that reached for the biggest visible
    // effect would be teaching a different, worse habit.
    for (const e of EXPERIMENTS) {
      const spec = paramSpec(e.key);
      const baseline = baselineFor(params);
      const { value, saturated } = chooseTarget(e, params);
      if (saturated) continue;

      const previous = value - (e.direction === 'up' ? spec.step : -spec.step);
      if (Math.abs(previous - baseline[e.key]) < 1e-9) continue;

      const baseRun = simulate(baseline);
      const observed = baseRun.map((s) => e.observe(s, baseline));
      const from = observed[observed.length - 1];
      const floor = Math.max(spread(observed), Math.abs(from) * 0.1);

      const run = simulate({ ...baseline, [e.key]: previous });
      const effect = Math.abs(e.observe(run[run.length - 1], baseline) - from);
      expect(effect, `${e.id} skipped a step that would already have been legible`).toBeLessThanOrEqual(
        floor,
      );
    }
  });

  it('states why that value and not the one before it', () => {
    for (const e of EXPERIMENTS) {
      const { rationale } = chooseTarget(e, params);
      expect(rationale.length, e.id).toBeGreaterThan(40);
    }
  });

  it('recommends something that actually reaches past its own family', () => {
    // An experiment that moves one chart is a slider demo. The first one in
    // particular is the page's entire argument for a coupled model.
    const reach = reachOf(EXPERIMENTS[0], params);
    expect(reach.charts).toBeGreaterThan(5);
    expect(reach.families.length).toBeGreaterThan(2);
  });
});
