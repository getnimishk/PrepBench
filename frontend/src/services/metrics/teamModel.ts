// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { FlowResult, ScenarioParams, TeamResult } from '../../types/agileMetrics';

// The team health model.
//
// Team happiness is the one metric of the original eight that is not derived
// from work items at all -- it is a survey reading. Modelling it as a
// deterministic function of load is a teaching simplification and nothing
// more, which is why k4 is calibration only and the coupling is typed
// `assumption` in the ledger.
//
// It earns its place because the sandbox otherwise teaches that you can run
// a team at permanent overload and read the consequences entirely off the
// delivery charts. You cannot; the cost shows up in a survey first.

export function teamModel(p: ScenarioParams, flow: FlowResult): TeamResult {
  // Two pressures, each already bounded 0..1, averaged so `overload` is
  // bounded 0..1 by construction: capacity eaten by unplanned work, and WIP
  // held above what the team can flow.
  const capacityPressure = 1 - flow.availableCapacityFraction;
  const overload = (capacityPressure + flow.wipPressure) / 2;

  // ASSUMPTION -- k4 is calibration only. The 1..5 clamp is the survey scale
  // itself rather than a modelling fudge: a happiness reading outside its own
  // scale is not a reading.
  const happiness = Math.max(1, Math.min(5, p.baseHappiness - overload * p.overloadHappinessDecay));

  return { happiness, overload };
}
