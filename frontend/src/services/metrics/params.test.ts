// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, it, expect } from 'vitest';
import type { ScenarioParams } from '../../types/agileMetrics';
import { DEFAULT_PARAMS, PARAM_SPECS, assertParams, paramSpec, validateParams } from './params';
import { simulate } from './compose';

// The guardrail suite.
//
// Several formulas in this model are calibration assumptions with a limited
// domain: push them far enough and they emit a change fail rate above 100% or
// a negative recovery clock, both of which are meaningless rather than merely
// extreme. The model does not clamp them. Instead the declared parameter
// ranges are chosen so the domain is UNREACHABLE, and this file is what makes
// that a fact rather than an intention.
//
// The corner sweep below is the load-bearing test. If someone widens a slider
// range, it fails here rather than surfacing as a plausible-looking chart with
// a 130% failure rate on it.

/** The parameters that participate in a domain constraint. */
const DOMAIN_KEYS: (keyof ScenarioParams)[] = [
  'baseChangeFailRate',
  'batchFailPressure',
  'wip',
  'throughput',
  'automation',
  'automationRecoveryGain',
  'baseUnplannedDays',
  'sprintLengthDays',
];

/** Every corner of the reachable space, over the domain-relevant axes. */
function corners(): ScenarioParams[] {
  let combos: ScenarioParams[] = [{ ...DEFAULT_PARAMS, sprints: 6 }];
  for (const key of DOMAIN_KEYS) {
    const spec = paramSpec(key);
    const next: ScenarioParams[] = [];
    for (const base of combos) {
      next.push({ ...base, [key]: spec.min });
      next.push({ ...base, [key]: spec.max });
    }
    combos = next;
  }
  return combos;
}

describe('parameter ranges', () => {
  it('accepts the default scenario', () => {
    expect(validateParams(DEFAULT_PARAMS)).toEqual([]);
  });

  it('declares a spec for every parameter the model reads', () => {
    // Guards the reverse drift: a parameter added to ScenarioParams but never
    // given a range is unvalidated, and its formula silently loses its domain.
    const specified = new Set(PARAM_SPECS.map((s) => s.key));
    for (const key of Object.keys(DEFAULT_PARAMS) as (keyof ScenarioParams)[]) {
      expect(specified.has(key), `no ParamSpec declared for "${key}"`).toBe(true);
    }
  });

  it('exposes only genuine scenario controls as sliders', () => {
    // Pinned by name, not by count. A count alone would happily pass if a
    // calibration coefficient were exposed on the same commit that hid a real
    // control -- and Rev 8 is explicit that deploymentIncidentRate and
    // reworkPerIncident stay model internals, because a slider invites
    // reading a teaching constant as a measured finding.
    const exposed = PARAM_SPECS.filter((s) => s.exposed).map((s) => s.key).sort();
    expect(exposed).toEqual(
      [
        'automation',
        'avgPointsPerItem',
        'baseChangeFailRate',
        'baseDefectRate',
        'baseHappiness',
        'baseRecoveryHours',
        'baseUnplannedDays',
        'capacityVariation',
        'escapeRate',
        'externalIncidentsPerSprint',
        'incidentDurationHours',
        'slo',
        'sprintLengthDays',
        'sprints',
        'throughput',
        'wip',
      ].sort(),
    );

    // Every calibration coefficient is hidden, and every hidden parameter is
    // a calibration coefficient. Both directions, so neither list can drift.
    for (const spec of PARAM_SPECS) {
      expect(spec.exposed, `${spec.key}`).toBe(!spec.calibration);
    }
  });

  it('rejects a value outside its declared range', () => {
    const violations = validateParams({ ...DEFAULT_PARAMS, wip: 999 });
    expect(violations.some((v) => v.kind === 'range' && v.subject === 'wip')).toBe(true);
  });

  it('reports the range and the domain breach separately when one value causes both', () => {
    // WIP of 999 is out of range AND drives the change fail rate to 5.1. The
    // two checks are independent on purpose: the range check says which
    // control is wrong, the domain check says which derived value stopped
    // meaning anything. Collapsing them would lose half of that.
    const violations = validateParams({ ...DEFAULT_PARAMS, wip: 999 });
    expect(violations.filter((v) => v.kind === 'range').map((v) => v.subject)).toEqual(['wip']);
    expect(violations.filter((v) => v.kind === 'domain').map((v) => v.subject)).toEqual([
      'changeFailRate',
    ]);
  });

  it('rejects a non-finite value rather than propagating NaN into a chart', () => {
    const violations = validateParams({ ...DEFAULT_PARAMS, throughput: NaN });
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toMatch(/finite/i);
  });

  it('names the offending parameter and its bounds when it throws', () => {
    // A validation error nobody can act on is barely better than a NaN.
    expect(() => assertParams({ ...DEFAULT_PARAMS, slo: 2 })).toThrow(/Availability SLO/);
    expect(() => assertParams({ ...DEFAULT_PARAMS, slo: 2 })).toThrow(/0\.9\.\.0\.9999/);
  });
});

describe('domain constraints', () => {
  it('flags a change fail rate driven above 100%', () => {
    // Individually legal values that combine into nonsense. This is the case
    // the range table is tuned to make unreachable -- constructed by hand here
    // because the sliders cannot produce it.
    const violations = validateParams({
      ...DEFAULT_PARAMS,
      baseChangeFailRate: 0.25,
      batchFailPressure: 0.15,
      wip: 20,
      sprintLengthDays: 10,
      baseUnplannedDays: 0,
    });
    // Exactly 1.00 at the worst corner, which is inside the domain.
    expect(violations.filter((v) => v.subject === 'changeFailRate')).toHaveLength(0);

    // Nudging k2 past its declared max is what breaks it.
    const broken = validateParams({
      ...DEFAULT_PARAMS,
      baseChangeFailRate: 0.25,
      batchFailPressure: 0.2,
      wip: 20,
    });
    expect(broken.some((v) => v.subject === 'changeFailRate')).toBe(true);
  });

  it('flags a negative recovery clock', () => {
    const violations = validateParams({
      ...DEFAULT_PARAMS,
      automation: 1,
      automationRecoveryGain: 1.5,
    });
    expect(violations.some((v) => v.subject === 'failedDeploymentRecoveryHours')).toBe(true);
  });

  it('flags unplanned work exceeding the sprint it is drawn from', () => {
    const violations = validateParams({
      ...DEFAULT_PARAMS,
      sprintLengthDays: 5,
      baseUnplannedDays: 5,
    });
    expect(violations.filter((v) => v.subject === 'baseUnplannedDays')).toHaveLength(0);

    // Only reachable by going outside the declared range, which the range
    // check catches first -- both fire, which is correct.
    const broken = validateParams({
      ...DEFAULT_PARAMS,
      sprintLengthDays: 5,
      baseUnplannedDays: 8,
    });
    expect(broken.some((v) => v.subject === 'baseUnplannedDays')).toBe(true);
  });
});

describe('the declared ranges make the domain unreachable', () => {
  const space = corners();

  it('sweeps every corner without a domain violation', () => {
    // 256 corners. If this fails, a slider range and a formula have drifted
    // apart and the UI can now produce a meaningless number.
    for (const p of space) {
      const violations = validateParams(p);
      expect(
        violations,
        `corner produced violations:\n${JSON.stringify(p, null, 2)}\n${violations
          .map((v) => v.message)
          .join('\n')}`,
      ).toEqual([]);
    }
  });

  it('never produces a change fail rate above 100% anywhere in the sweep', () => {
    for (const p of space) {
      for (const sprint of simulate(p)) {
        expect(sprint.deployment.changeFailRate).toBeGreaterThanOrEqual(0);
        expect(sprint.deployment.changeFailRate).toBeLessThanOrEqual(1);
      }
    }
  });

  it('never produces a negative recovery clock anywhere in the sweep', () => {
    for (const p of space) {
      for (const sprint of simulate(p)) {
        expect(sprint.deployment.failedDeploymentRecoveryHours).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('never produces a NaN or Infinity anywhere in the sweep', () => {
    // Degenerate corners are real: throughput 1 with a full sprint of
    // unplanned work delivers nothing, and every ratio downstream has a zero
    // denominator. None of them may reach a chart axis as NaN.
    for (const p of space) {
      for (const sprint of simulate(p)) {
        for (const [path, value] of numericLeaves(sprint)) {
          expect(Number.isFinite(value), `${path} was ${value}`).toBe(true);
        }
      }
    }
  });
});

/** Every number reachable from `node`, with a dotted path for the failure message. */
function numericLeaves(node: unknown, prefix = ''): [string, number][] {
  if (typeof node === 'number') return [[prefix || '(root)', node]];
  if (Array.isArray(node)) {
    return node.flatMap((child, i) => numericLeaves(child, `${prefix}[${i}]`));
  }
  if (node && typeof node === 'object') {
    return Object.entries(node).flatMap(([key, child]) =>
      numericLeaves(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [];
}
