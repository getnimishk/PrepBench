// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { ScenarioParams } from '../../types/agileMetrics';
import type { Attempt, ObservedOutcome } from '../../types/learning';
import { baselineFor, keyOutcomes, type Outcome } from '../metrics/whatMoved';
import { PARAM_SPECS } from '../metrics/params';
import { simulate } from '../metrics/compose';

// The experiment, as it actually ran.
//
// Read from the live model at the moment a prediction is committed and kept
// with the attempt, so "what actually happened" is the sandbox's own numbers
// rather than a sentence about what usually happens. Nothing here is written
// back into the simulation.

type Experiment = Pick<Attempt, 'manipulation' | 'observed'>;

/** What differs from the baseline, and what the headline outcomes were before and after. */
export function recordExperiment(
  params: ScenarioParams,
  baseline: ScenarioParams,
  outcomes: Outcome[],
): Experiment {
  const manipulation: NonNullable<Attempt['manipulation']> = {};
  for (const key of Object.keys(params) as (keyof ScenarioParams)[]) {
    if (Math.abs(params[key] - baseline[key]) > 1e-9) {
      manipulation[key] = { from: baseline[key], to: params[key] };
    }
  }

  const observed: NonNullable<Attempt['observed']> = {};
  for (const o of outcomes) {
    observed[o.id] = {
      label: o.label,
      before: o.baseline,
      after: o.value,
      unit: o.unit,
      precision: o.precision,
      ...(o.percent ? { percent: true } : {}),
    };
  }

  return {
    manipulation: Object.keys(manipulation).length ? manipulation : undefined,
    observed: Object.keys(observed).length ? observed : undefined,
  };
}

/**
 * The experiment for a scenario, run directly.
 *
 * For the moment a prediction is committed and its scenario applied: the page
 * has not re-rendered with the new parameters yet, so its own outcomes still
 * describe what was on screen before. Same model, same baseline, and the same
 * numbers the page shows once it has.
 */
export function experimentFor(run: ScenarioParams): Experiment {
  const baseline = baselineFor(run);
  return recordExperiment(run, baseline, keyOutcomes(simulate(run), run, simulate(baseline), baseline));
}

function figure(o: ObservedOutcome, value: number): string {
  if (o.percent) return `${(value * 100).toFixed(o.precision)}%`;
  return value.toFixed(o.precision);
}

/** An outcome that moved, at the precision it is reported to. Rounding noise is not movement. */
export function moved(o: ObservedOutcome): boolean {
  return figure(o, o.before) !== figure(o, o.after);
}

/** "Cycle time rose from 5.2 to 9.1 days". */
export function describeOutcome(o: ObservedOutcome): string {
  const unit = o.percent || !o.unit ? '' : ` ${o.unit}`;
  if (!moved(o)) return `${o.label} stayed at ${figure(o, o.after)}${unit}`;
  const direction = o.after > o.before ? 'rose' : 'fell';
  return `${o.label} ${direction} from ${figure(o, o.before)} to ${figure(o, o.after)}${unit}`;
}

/** "WIP limit 4 → 8 items", named from the sandbox's own parameter labels. */
export function describeChange(key: string, change: { from: number; to: number }): string {
  const spec = PARAM_SPECS.find((s) => s.key === key);
  const unit = spec?.unit && spec.unit !== 'share' ? ` ${spec.unit}` : '';
  return `${spec?.label ?? key} ${change.from} → ${change.to}${unit}`;
}
