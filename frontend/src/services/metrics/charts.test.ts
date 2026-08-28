// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, it, expect } from 'vitest';
import type { ChartPrimitive, ChartViewId, FamilyId } from '../../types/agileMetrics';
import { CHART_VIEWS, FAMILIES, chartsConsuming, chartsInFamily } from './charts';
import { COUPLINGS, COUPLING_BY_ID } from './couplings';

describe('the chart inventory', () => {
  it('holds twenty-seven views across six families', () => {
    expect(CHART_VIEWS).toHaveLength(27);
    expect(FAMILIES).toHaveLength(6);
  });

  it('distributes them as the frozen inventory specifies', () => {
    const expected: Record<FamilyId, number> = {
      flow: 8,
      predictability: 5,
      quality: 3,
      teamHealth: 2,
      dora: 5,
      reliability: 4,
    };
    for (const [family, count] of Object.entries(expected)) {
      expect(chartsInFamily(family as FamilyId), family).toHaveLength(count);
    }
  });

  it('gives every view a unique id and a canonical name', () => {
    const ids = CHART_VIEWS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CHART_VIEWS) {
      expect(c.canonicalName.length, c.id).toBeGreaterThan(0);
    }
  });

  it('draws everything with the four primitives, and uses all four', () => {
    // Renderers are named after primitives, not after charts: a burndown and
    // a burnup are one line renderer given different series. A fifth
    // primitive appearing here means a chart earned its own component, which
    // is the thing this constraint exists to prevent.
    const allowed: ChartPrimitive[] = ['line', 'bar', 'stackedArea', 'scatter'];
    const used = new Set(CHART_VIEWS.map((c) => c.primitive));
    for (const c of CHART_VIEWS) {
      expect(allowed, c.id).toContain(c.primitive);
    }
    for (const primitive of allowed) {
      expect(used.has(primitive), `${primitive} is declared but never used`).toBe(true);
    }
  });

  it('puts every family in exactly one tier, and every view in its family’s tier', () => {
    const tierOf = new Map(FAMILIES.map((f) => [f.id, f.tier]));
    for (const c of CHART_VIEWS) {
      expect(tierOf.get(c.family), c.id).toBe(c.tier);
    }
  });

  it('phases the engineering extension behind the core', () => {
    // DORA is P1 as a whole family, Reliability P2. Core is P0 apart from
    // defect density, which the design explicitly defers.
    for (const c of chartsInFamily('dora')) expect(c.phase, c.id).toBe('P1');
    for (const c of chartsInFamily('reliability')) expect(c.phase, c.id).toBe('P2');
    for (const c of CHART_VIEWS.filter((v) => v.tier === 'core')) {
      expect(c.phase, c.id).toBe(c.id === 'defectDensity' ? 'P2' : 'P0');
    }
  });
});

describe('provenance', () => {
  it('claims exactly one view as ours, and it is the one with no standard chart', () => {
    // The provenance table exists because "Deployment rework rate" was nearly
    // shipped as an invention of this sandbox when it is DORA's fifth metric.
    // Anything labelled `ours` has to genuinely have no lineage.
    const ours = CHART_VIEWS.filter((c) => c.provenance === 'ours');
    expect(ours.map((c) => c.id)).toEqual(['sprintGoal']);
    expect(ours[0].externalAnalogues).toEqual([]);
  });

  it('names a direct Jira report for exactly five views', () => {
    // The claim, stated precisely: five of the 27 views have a named Jira
    // report as their canonical analogue. This is NOT a claim about how many
    // reports Jira has -- its catalogue is considerably larger.
    const jira = CHART_VIEWS.filter((c) => c.provenance === 'jira').map((c) => c.id);
    expect(jira.sort()).toEqual(
      ['burndown', 'burnup', 'cumulativeFlow', 'cycleTimeDistribution', 'velocity'].sort(),
    );
  });

  it('gives every view except the one that is ours at least one external analogue', () => {
    for (const c of CHART_VIEWS) {
      if (c.provenance === 'ours') continue;
      expect(c.externalAnalogues.length, `${c.id} claims no lineage`).toBeGreaterThan(0);
    }
  });

  it('carries all five DORA metrics, not the four everyone remembers', () => {
    expect(chartsInFamily('dora').map((c) => c.id).sort()).toEqual(
      [
        'changeFailRate',
        'changeLeadTime',
        'deploymentFrequency',
        'deploymentReworkRate',
        'failedDeploymentRecoveryTime',
      ].sort(),
    );
  });
});

describe('coverage of the original eight', () => {
  // A standing gate. Rev 2 of the design dropped this table and lost Team
  // happiness as a direct result -- the metric vanished from the inventory
  // and nothing caught it, because the check that would have caught it was
  // deleted in the same edit. It does not get deleted again.
  const ORIGINAL_EIGHT: Record<string, ChartViewId[]> = {
    Velocity: ['velocity'],
    Predictability: ['sayDoRatio'],
    Burndown: ['burndown'],
    'Escaped defects': ['escapedDefects'],
    'Sprint Goal achievement': ['sprintGoal'],
    'Team happiness': ['teamHappiness'],
    'Lead Time': ['deliveryLeadTime'],
    'Cycle Time': ['cycleTime', 'cycleTimeDistribution'],
  };

  it('has a home for every metric that was asked for', () => {
    const present = new Set(CHART_VIEWS.map((c) => c.id));
    for (const [metric, views] of Object.entries(ORIGINAL_EIGHT)) {
      for (const view of views) {
        expect(present.has(view), `${metric} has no chart: "${view}" is missing`).toBe(true);
      }
    }
  });

  it('still covers all eight', () => {
    expect(Object.keys(ORIGINAL_EIGHT)).toHaveLength(8);
  });
});

describe('ledger wiring', () => {
  it('only consumes couplings that exist', () => {
    for (const c of CHART_VIEWS) {
      for (const id of c.consumes) {
        expect(COUPLING_BY_ID.has(id), `${c.id} consumes unknown coupling "${id}"`).toBe(true);
      }
    }
  });

  it('does not list the same coupling twice on one view', () => {
    for (const c of CHART_VIEWS) {
      expect(new Set(c.consumes).size, c.id).toBe(c.consumes.length);
    }
  });

  it('routes every assumption and convention to at least one chart', () => {
    // The completeness gate. An assumption that reaches no chart reaches no
    // learner -- and an unlabelled assumption is read as a fact. Arithmetic
    // edges are exempt: they follow from definitions and need no caveat.
    for (const coupling of COUPLINGS) {
      if (coupling.type === 'arithmetic') continue;
      const charts = chartsConsuming(coupling.id);
      expect(
        charts.length,
        `"${coupling.id}" (${coupling.type}) reaches no chart, so its caveat ` +
          `"${coupling.uiLabel}" is never shown to anyone`,
      ).toBeGreaterThan(0);
    }
  });

  it('derives the reverse direction consistently', () => {
    for (const coupling of COUPLINGS) {
      for (const chart of chartsConsuming(coupling.id)) {
        expect(chart.consumes).toContain(coupling.id);
      }
    }
  });
});
