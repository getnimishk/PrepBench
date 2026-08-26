import type { FlowResult, QualityResult, ScenarioParams } from '../../types/agileMetrics';

// The quality model.
//
// One coupling here is a model assumption, not arithmetic: WIP pressure
// raising defect injection (k1). It is a plausible teaching claim -- more
// context switching, longer feedback delay, more defects -- and it is NOT an
// identity. The ledger types it `assumption` and the UI says so on the chart.
//
// Everything downstream of the injected count is arithmetic: a defect either
// escapes to production or is caught and reworked inside the sprint, and the
// two shares sum to one by construction.

export function qualityModel(p: ScenarioParams, flow: FlowResult): QualityResult {
  // ASSUMPTION -- k1 is a pedagogical calibration parameter, not a measured
  // industry constant. `wipPressure` is bounded 0..1 by construction, so the
  // multiplier lands in 1..(1 + k1) and the defect rate cannot run away.
  const defectRate = p.baseDefectRate * (1 + flow.wipPressure * p.wipDefectPressure);

  const defectsInjected = flow.deliveredItems * defectRate;

  // Escaped and reworked are complements of the same population, so they can
  // never double-count a defect. Escaped defects reach production and drive
  // nothing in the deployment model -- they are the metric that punishes a
  // team for shipping fast without shipping well.
  const escapedDefects = defectsInjected * p.escapeRate;
  const reworkItems = defectsInjected * (1 - p.escapeRate);

  // Per POINT, not per item. Rate already measures per item, and dividing
  // both by the same denominator made the two charts render byte-identical
  // series -- two of the quality views a learner had no way to tell apart.
  // Under uniform item size they stay proportional; they separate as soon as
  // the team's average item size moves, which is the point of measuring both.
  const defectDensity = flow.deliveredPoints > 0 ? defectsInjected / flow.deliveredPoints : 0;

  // ASSUMPTION -- rework consumes capacity. Redoing an item is real work that
  // produced no new value, so net new delivery is gross delivery less the
  // rework. Deliberately computed HERE rather than fed back into the flow
  // model: flow runs before quality, and letting quality reduce flow's
  // capacity in the same sprint would make the two mutually dependent with
  // no well-founded evaluation order.
  const netNewItems = Math.max(0, flow.deliveredItems - reworkItems);

  return { defectRate, defectsInjected, reworkItems, escapedDefects, defectDensity, netNewItems };
}
