// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type {
  Coupling,
  FamilyId,
  ModelId,
  ScenarioParams,
} from '../../types/agileMetrics';
import { COUPLING_BY_ID } from './couplings';
import { PARAM_SPECS, type ParamSpec } from './params';

// Which relationships answer "why did THIS move, THIS time".
//
// `ChartViewMeta.consumes` is a standing declaration: these are the edges this
// chart depends on, always, regardless of what the learner just did. That is
// the right thing for the completeness gate -- an assumption that reaches no
// chart reaches no learner -- and the wrong thing for an explanation.
//
// The failure it produced was concrete. Raise WIP, and the cycle time card
// explained the move with `incident-to-capacity`: incidents cost capacity next
// sprint. True, standing, and not why cycle time doubled. It doubled because
// cycle time is WIP over throughput. (That edge was missing from the ledger
// entirely, which is a separate bug, now fixed -- but even with it declared,
// a static list shows both and leads with whichever comes first.)
//
// So the callouts are ordered by ORIGIN: an edge whose source model is one the
// learner just touched led to what they are looking at; an edge from a model
// they did not touch is background. Ordering, never hiding -- every assumption
// still renders, because demoting a caveat out of sight is how it gets read as
// a fact.

const EPSILON = 1e-6;

/** Exposed controls whose value differs from the baseline. */
export function changedSpecs(params: ScenarioParams, baseline: ScenarioParams): ParamSpec[] {
  return PARAM_SPECS.filter(
    (s) => s.exposed && Math.abs(params[s.key] - baseline[s.key]) > EPSILON,
  );
}

/**
 * The models the learner reached into.
 *
 * `simulation` is excluded: the sprint count changes how much of the run is on
 * screen, not how any model behaves, so it must never mark an edge as the
 * reason something moved.
 */
export function changedModels(params: ScenarioParams, baseline: ScenarioParams): Set<ModelId> {
  const models = new Set<ModelId>();
  for (const spec of changedSpecs(params, baseline)) {
    if (spec.model !== 'simulation') models.add(spec.model);
  }
  return models;
}

export interface RankedCoupling {
  coupling: Coupling;
  /** True when this edge starts in a model the learner just changed. */
  drivenByChange: boolean;
}

/**
 * A chart's declared edges, the ones the current change set in motion first.
 *
 * Stable within each group, so a chart's callouts keep their authored order
 * when nothing has been changed.
 */
export function rankCouplings(consumes: string[], changed: Set<ModelId>): RankedCoupling[] {
  const ranked = consumes
    .map((id) => COUPLING_BY_ID.get(id))
    .filter((c): c is Coupling => c !== undefined)
    .map((coupling) => ({ coupling, drivenByChange: changed.has(coupling.source) }));

  return [
    ...ranked.filter((r) => r.drivenByChange),
    ...ranked.filter((r) => !r.drivenByChange),
  ];
}

/**
 * Which model each family reads from.
 *
 * Predictability maps to `flow` because a burndown, a velocity bar and a
 * say/do ratio are all flow-model outputs sliced differently -- so "you moved
 * a flow control and the predictability charts moved" is arithmetic, not a
 * discovery, and badging it as one would spend the signal on the obvious.
 */
export const FAMILY_MODEL: Record<FamilyId, ModelId> = {
  flow: 'flow',
  predictability: 'flow',
  quality: 'quality',
  teamHealth: 'team',
  dora: 'deployment',
  reliability: 'reliability',
};

/**
 * The families it is not surprising to see move.
 *
 * Everything else is the payoff: a flow control reaching quality is the reason
 * a coupled model exists, and it is the only thing worth interrupting the
 * reader for.
 */
export function homeFamilies(changed: Set<ModelId>): Set<FamilyId> {
  const home = new Set<FamilyId>();
  for (const [family, model] of Object.entries(FAMILY_MODEL) as [FamilyId, ModelId][]) {
    if (changed.has(model)) home.add(family);
  }
  return home;
}
