// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type {
  ChartViewId,
  FamilyId,
  ScenarioParams,
  SprintResult,
} from '../../types/agileMetrics';
import { formatParamValue, paramSpec } from './params';
import { simulate } from './compose';
import { baselineFor, whatMoved } from './whatMoved';

// The experiment catalogue.
//
// WHICH question is worth asking first is a teaching judgement, so the three
// entries below are authored. HOW FAR to move the control is not, and it used
// to be: the card said "increase WIP from 4 to 8", and a reader could
// reasonably ask why 8 and not 5. There was no answer, because a designer
// picked it.
//
// So the target is measured, against a criterion the card states out loud:
//
//   the smallest step whose effect is larger than BOTH the sprint-to-sprint
//   variation the baseline run already shows, and a tenth of the current
//   value.
//
// The second clause is not decoration. Recovery time is a flat function of
// automation, so its baseline run has zero variation -- and against a noise
// floor of zero the first clause alone accepted a 5% nudge that moved one
// chart. A relative floor is what stops "clears the noise" degenerating into
// "any step at all" on a metric that does not wobble.
//
// That is the honest bar for a teaching sandbox. Below it, the learner is
// being asked to read a difference they could not distinguish from the
// wobble that was there anyway -- which teaches them to see signal in noise,
// the single worst habit a metrics course can leave behind. Above it, the
// effect is legible on the chart without being cartoonish.
//
// `key`, `watchFirst` and `observe` are typed against the parameter table,
// the chart inventory and the model, so an experiment naming a control that
// stopped being exposed, or a chart that was renamed, fails the build.

export interface Experiment {
  id: string;
  /** The one control this experiment moves. */
  key: keyof ScenarioParams;
  /** Which way to walk the slider from its baseline value. */
  direction: 'up' | 'down';
  /** Where the first, most legible effect shows up. */
  watchFirst: ChartViewId;
  /** What the experiment is actually asking. Shown as the card's question. */
  question: string;
  /** The quantity the target is chosen to move legibly. */
  observe: (s: SprintResult, p: ScenarioParams) => number;
}

export const EXPERIMENTS: Experiment[] = [
  {
    id: 'raise-wip',
    key: 'wip',
    direction: 'up',
    watchFirst: 'cycleTime',
    question: 'Does more work in progress get more work done?',
    observe: (s) => s.flow.cycleTimeDays,
  },
  {
    id: 'automate-deploys',
    key: 'automation',
    direction: 'up',
    watchFirst: 'failedDeploymentRecoveryTime',
    question: 'What does deployment automation actually buy you?',
    observe: (s) => s.deployment.failedDeploymentRecoveryHours,
  },
  {
    id: 'external-incidents',
    key: 'externalIncidentsPerSprint',
    direction: 'up',
    watchFirst: 'unplannedWorkShare',
    question: 'What does an outage cost a team that did not cause it?',
    observe: (s, p) => s.flow.unplannedWorkDays / p.sprintLengthDays,
  },
];

export const FIRST_EXPERIMENT = EXPERIMENTS[0];

const spread = (values: number[]) =>
  values.length === 0 ? 0 : Math.max(...values) - Math.min(...values);

export interface Target {
  value: number;
  /** Why this value and not the one before it. Rendered on the card. */
  rationale: string;
  /** True when the whole slider range never clears the noise floor. */
  saturated: boolean;
}

/**
 * The smallest step whose effect clears the noise the baseline already has.
 *
 * Walks the slider one declared step at a time rather than jumping, so the
 * answer is the SMALLEST legible intervention -- the cautious version of the
 * experiment, which is what anyone would actually run against a real team.
 */
export function chooseTarget(e: Experiment, params: ScenarioParams): Target {
  const spec = paramSpec(e.key);
  const baseline = baselineFor(params);
  const baseRun = simulate(baseline);

  const observed = baseRun.map((s) => e.observe(s, baseline));
  // The variation the reader can already see without touching anything. An
  // effect smaller than this is indistinguishable from the run itself.
  const noise = spread(observed);
  const from = e.observe(baseRun[baseRun.length - 1], baseline);
  // A perfectly flat baseline has no noise to clear, so the relative floor is
  // what keeps the answer meaningful there.
  const floor = Math.max(noise, Math.abs(from) * 0.1);

  const step = e.direction === 'up' ? spec.step : -spec.step;
  const limit = e.direction === 'up' ? spec.max : spec.min;
  const steps = Math.max(1, Math.round(Math.abs(limit - baseline[e.key]) / spec.step));

  for (let i = 1; i <= steps; i++) {
    const value = Number((baseline[e.key] + step * i).toFixed(6));
    const run = simulate({ ...baseline, [e.key]: value });
    const effect = Math.abs(e.observe(run[run.length - 1], baseline) - from);
    if (effect > floor) {
      return {
        value,
        rationale:
          `Smallest legible step. Below ${formatParamValue(spec, value)} the effect is ` +
          `smaller than the sprint-to-sprint variation this scenario already shows, so ` +
          `you could not tell it apart from the run itself.`,
        saturated: false,
      };
    }
  }

  return {
    value: limit,
    rationale:
      'No step inside this slider’s range moves the watched metric further than the ' +
      'variation already present, so the experiment runs at the end of the range.',
    saturated: true,
  };
}

/** Applies an experiment on top of the baseline, leaving viewport controls alone. */
export function applyExperiment(params: ScenarioParams, e: Experiment): ScenarioParams {
  return { ...baselineFor(params), [e.key]: chooseTarget(e, params).value };
}

export interface Reach {
  /** Formatted for display: a share reads "50%", never "0.5". */
  from: string;
  to: string;
  label: string;
  /** Why the target is what it is. */
  rationale: string;
  charts: number;
  families: FamilyId[];
}

/**
 * How far an experiment reaches, measured rather than asserted.
 *
 * Runs the simulation once per candidate step plus twice for the comparison.
 * Cheap enough for three experiments per render, but callers memoise on
 * `params.sprints` because that is the only input that changes the answer.
 */
export function reachOf(e: Experiment, params: ScenarioParams): Reach {
  const spec = paramSpec(e.key);
  const baseline = baselineFor(params);
  const target = chooseTarget(e, params);
  const proposed = { ...baseline, [e.key]: target.value };
  const moved = whatMoved(simulate(proposed), proposed, simulate(baseline), baseline);

  return {
    from: formatParamValue(spec, baseline[e.key]),
    to: formatParamValue(spec, target.value),
    label: spec.label,
    rationale: target.rationale,
    charts: moved.movedViews.size,
    families: [...moved.movedFamilies],
  };
}
