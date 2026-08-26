import { describe, it, expect } from 'vitest';
import type { Coupling, ScenarioParams } from '../../types/agileMetrics';
import { COUPLINGS, laggedCouplings } from './couplings';
import { DEFAULT_PARAMS, PARAM_SPECS } from './params';
import { deploymentPopulation, simulate } from './compose';
import { flowModel } from './flowModel';

// The invariant suite. This is the executable half of the frozen design --
// every claim the specification makes about the model is asserted here rather
// than trusted, because the whole point of the sandbox is that a learner can
// believe what the charts show them.

const scenario = (overrides: Partial<ScenarioParams> = {}): ScenarioParams => ({
  ...DEFAULT_PARAMS,
  ...overrides,
});

describe("Little's Law", () => {
  it('holds across a sweep of WIP and capacity', () => {
    for (let wip = 1; wip <= 20; wip++) {
      for (let throughput = 1; throughput <= 20; throughput += 3) {
        const p = scenario({ wip, throughput, baseUnplannedDays: 0 });
        const flow = flowModel(p, 0);
        expect(flow.cycleTimeDays).toBeCloseTo(
          (wip * p.sprintLengthDays) / flow.deliveredItems,
          10,
        );
      }
    }
  });

  it('does not let WIP raise throughput', () => {
    // The single most important property in the model. Raising WIP cannot
    // make the team deliver more -- it moves cycle time and burndown shape
    // and nothing else. People reach for WIP expecting output; this is the
    // "oh, THAT's why".
    const baseline = flowModel(scenario({ wip: 1 }), 1);
    for (let wip = 1; wip <= 20; wip++) {
      const flow = flowModel(scenario({ wip }), 1);
      expect(flow.deliveredItems).toBeCloseTo(baseline.deliveredItems, 10);
      // ...while cycle time moves in direct proportion.
      expect(flow.cycleTimeDays).toBeCloseTo(baseline.cycleTimeDays * wip, 10);
    }
  });

  it('reports delivery lead time at or above cycle time', () => {
    // Same law over a wider boundary: lead time counts the backlog wait that
    // cycle time starts after.
    for (let unplanned = 0; unplanned <= 5; unplanned += 0.5) {
      const flow = flowModel(scenario(), unplanned);
      expect(flow.deliveryLeadTimeDays).toBeGreaterThanOrEqual(flow.cycleTimeDays - 1e-9);
    }
  });
});

describe('burndown, burnup and the CFD', () => {
  it('agree about completed work on every day', () => {
    for (let wip = 1; wip <= 12; wip++) {
      const flow = flowModel(scenario({ wip }), 1);
      for (let day = 0; day < flow.burnup.length; day++) {
        expect(flow.burndown[day] + flow.burnup[day]).toBeCloseTo(flow.committedItems, 10);
      }
    }
  });

  it('shows the same total delivered whatever the burndown shape', () => {
    // WIP=1 draws a near-linear burndown, WIP at capacity draws
    // flat-then-cliff. Identical totals. The shape is the lesson.
    const linear = flowModel(scenario({ wip: 1 }), 1);
    const cliff = flowModel(scenario({ wip: 20 }), 1);

    expect(cliff.deliveredItems).toBeCloseTo(linear.deliveredItems, 10);

    // The cliff sits still until the end; the linear one is already moving.
    const midpoint = Math.floor(linear.burnup.length / 2);
    expect(linear.burnup[midpoint]).toBeGreaterThan(0);
    expect(cliff.burnup[midpoint]).toBe(0);
  });

  it('keeps the CFD band equal to WIP while work remains', () => {
    const wip = 3;
    const flow = flowModel(scenario({ wip }), 1);
    for (let day = 0; day < flow.started.length; day++) {
      const band = flow.started[day] - flow.burnup[day];
      // The band collapses as the last batch lands, so only assert it where
      // there is still committed work left to start.
      if (flow.burnup[day] + wip <= flow.committedItems) {
        expect(band).toBeCloseTo(wip, 10);
      }
    }
  });
});

describe('the two recovery clocks never touch', () => {
  it('leaves incident duration and availability untouched when recovery time changes', () => {
    const a = simulate(scenario({ baseRecoveryHours: 2 }));
    const b = simulate(scenario({ baseRecoveryHours: 72 }));
    for (let i = 0; i < a.length; i++) {
      expect(a[i].reliability.downtimeHours).toBeCloseTo(b[i].reliability.downtimeHours, 10);
      expect(a[i].reliability.availability).toBeCloseTo(b[i].reliability.availability, 10);
      expect(a[i].reliability.incidentsPerSprint).toBeCloseTo(b[i].reliability.incidentsPerSprint, 10);
    }
    expect(a[0].deployment.failedDeploymentRecoveryHours).not.toBeCloseTo(
      b[0].deployment.failedDeploymentRecoveryHours,
      6,
    );
  });

  it('leaves every DORA figure untouched when incident duration changes', () => {
    const a = simulate(scenario({ incidentDurationHours: 1 }));
    const b = simulate(scenario({ incidentDurationHours: 48 }));
    for (let i = 0; i < a.length; i++) {
      expect(a[i].deployment.failedDeploymentRecoveryHours).toBeCloseTo(
        b[i].deployment.failedDeploymentRecoveryHours,
        10,
      );
      expect(a[i].deployment.deploys).toBeCloseTo(b[i].deployment.deploys, 10);
      expect(a[i].deployment.changeFailRate).toBeCloseTo(b[i].deployment.changeFailRate, 10);
      expect(a[i].deployment.deploymentReworkRate).toBeCloseTo(b[i].deployment.deploymentReworkRate, 10);
    }
    expect(a[0].reliability.availability).not.toBeCloseTo(b[0].reliability.availability, 6);
  });
});

describe('incidents', () => {
  it('does not treat a failed change deployment as an incident', () => {
    // At rate 0, failed change deployments produce no incidents at all --
    // the crossing is an assumption with a coefficient, not an identity.
    const none = simulate(scenario({ deploymentIncidentRate: 0, externalIncidentsPerSprint: 0 }));
    for (const sprint of none) {
      expect(sprint.deployment.failedChangeDeployments).toBeGreaterThan(0);
      expect(sprint.reliability.deploymentCausedIncidents).toBe(0);
      expect(sprint.reliability.incidentsPerSprint).toBe(0);
    }

    const some = simulate(scenario({ deploymentIncidentRate: 0.8, externalIncidentsPerSprint: 0 }));
    expect(some[0].reliability.deploymentCausedIncidents).toBeGreaterThan(0);
  });

  it('keeps the two incident sources separate', () => {
    const results = simulate(scenario({ baseChangeFailRate: 0, externalIncidentsPerSprint: 2 }));
    for (const sprint of results) {
      expect(sprint.reliability.incidentsPerSprint).toBeCloseTo(
        sprint.reliability.deploymentCausedIncidents + sprint.reliability.externalIncidents,
        10,
      );
      // Reliability is not purely a function of how you deploy. With a zero
      // change fail rate and real external incidents, availability is still
      // below 100%.
      expect(sprint.deployment.failedChangeDeployments).toBe(0);
      expect(sprint.reliability.availability).toBeLessThan(1);
    }
  });

  it('computes downtime under the declared non-overlap assumption', () => {
    // Asserted as a declared assumption, never as a production reliability
    // identity: real incidents overlap and real downtime is lower than this.
    const p = scenario();
    for (const sprint of simulate(p)) {
      expect(sprint.reliability.downtimeHours).toBeCloseTo(
        sprint.reliability.incidentsPerSprint * p.incidentDurationHours,
        10,
      );
    }
  });

  it('computes availability against the period in the same unit', () => {
    const p = scenario();
    for (const sprint of simulate(p)) {
      const expected = 1 - sprint.reliability.downtimeHours / (p.sprintLengthDays * 24);
      expect(sprint.reliability.availability).toBeCloseTo(Math.max(0, Math.min(1, expected)), 10);
    }
  });
});

describe('deployment rework rate', () => {
  it('is the carry-in over this sprint’s deployments', () => {
    for (const sprint of simulate(scenario())) {
      const expected =
        sprint.deployment.deploys === 0
          ? 0
          : sprint.carriedIn.unplannedDeployments / sprint.deployment.deploys;
      expect(sprint.deployment.deploymentReworkRate).toBeCloseTo(expected, 12);
    }
  });

  it('is zero in sprint 1, not NaN and not an undefined index', () => {
    const first = simulate(scenario())[0];
    expect(first.carriedIn.unplannedDeployments).toBe(0);
    expect(first.deployment.deploymentReworkRate).toBe(0);
    expect(Number.isNaN(first.deployment.deploymentReworkRate)).toBe(false);
  });

  it('keeps the numerator inside the denominator population', () => {
    for (const p of stressScenarios()) {
      for (const sprint of simulate(p)) {
        expect(sprint.carriedIn.unplannedDeployments).toBeLessThanOrEqual(
          sprint.deployment.deploys + 1e-9,
        );
      }
    }
  });

  it('stays within 0..1 across a full parameter sweep', () => {
    for (const p of stressScenarios()) {
      for (const sprint of simulate(p)) {
        expect(sprint.deployment.deploymentReworkRate).toBeGreaterThanOrEqual(0);
        expect(sprint.deployment.deploymentReworkRate).toBeLessThanOrEqual(1);
      }
    }
  });

  it('depends on the population composition, not on a clamp', () => {
    // The mutation test. Drop the carry-in from the denominator -- the
    // "simplification" that looks harmless -- and the bound must break.
    //
    // If this test ever starts passing, the 0..1 bound has stopped being
    // structural and something is clamping instead.
    const p = scenario({
      throughput: 1,
      externalIncidentsPerSprint: 10,
      reworkPerIncident: 3,
      baseDefectRate: 0,
      sprints: 6,
    });

    let sawRateAboveOne = false;
    for (const sprint of simulate(p)) {
      const mutated = deploymentPopulation(sprint.deployment.plannedDeployments, 0);
      const mutatedRate = mutated === 0 ? 0 : sprint.carriedIn.unplannedDeployments / mutated;
      if (mutatedRate > 1) sawRateAboveOne = true;

      // The real composition holds at the same corner.
      expect(sprint.deployment.deploymentReworkRate).toBeLessThanOrEqual(1);
    }

    expect(
      sawRateAboveOne,
      'the mutated population never exceeded 1, so this scenario no longer ' +
        'exercises the bound and the mutation test has stopped guarding anything',
    ).toBe(true);
  });
});

describe('cross-sprint state transfer', () => {
  it('carries sprint n outputs into sprint n+1 and nowhere else', () => {
    const results = simulate(scenario());
    expect(results[0].carriedIn).toEqual({ unplannedDeployments: 0, incidentLoadDays: 0 });
    for (let i = 1; i < results.length; i++) {
      expect(results[i].carriedIn).toEqual(results[i - 1].carriedOut);
    }
  });

  it('leaves sprint 1 identical with the loops on or off', () => {
    // Every cross-sprint transfer lags exactly one sprint, so sprint 1 is
    // always the undisturbed case and divergence can only begin at sprint 2.
    const on = simulate(scenario());
    const off = simulate(scenario({ reworkPerIncident: 0, incidentCostDays: 0 }));

    expect(on[0].flow).toEqual(off[0].flow);
    expect(on[0].quality).toEqual(off[0].quality);
    expect(on[0].deployment).toEqual(off[0].deployment);
    expect(on[0].reliability).toEqual(off[0].reliability);

    // ...and then they part company.
    expect(on[1].deployment.deploys).not.toBeCloseTo(off[1].deployment.deploys, 6);
  });

  it('never lets a sprint read its own outputs', () => {
    // Asserted over the evaluation order rather than per-edge.
    //
    // Sprint 1 is the discriminating case and the only one worth testing: its
    // carry-in is zero while its carry-out is not, so a model that read its
    // own output would consume `base + incidentLoad` and a correct one
    // consumes `base` exactly. Later sprints converge toward a fixed point
    // where carriedIn and carriedOut are numerically equal, which makes them
    // useless for telling the two apart -- an earlier version of this test
    // asserted inequality there and was failing on arithmetic coincidence
    // rather than on anything structural.
    const results = simulate(scenario());
    const first = results[0];

    expect(first.carriedOut.incidentLoadDays).toBeGreaterThan(0);
    expect(first.flow.unplannedWorkDays).toBeCloseTo(DEFAULT_PARAMS.baseUnplannedDays, 10);

    for (const sprint of results) {
      expect(sprint.flow.unplannedWorkDays).toBeCloseTo(
        DEFAULT_PARAMS.baseUnplannedDays + sprint.carriedIn.incidentLoadDays,
        10,
      );
    }
  });
});

describe('the counting convention', () => {
  it('counts one change event per delivered item and per rework item', () => {
    // Asserts internal consistency only -- never that the relationship holds
    // universally. It is a sandbox counting decision, not a definition.
    for (const sprint of simulate(scenario())) {
      expect(sprint.deployment.plannedDeployments).toBeCloseTo(
        sprint.flow.deliveredItems + sprint.quality.reworkItems,
        10,
      );
    }
  });
});

describe('the coupling ledger', () => {
  it('holds the frozen composition of 8 arithmetic, 10 assumptions, 1 convention', () => {
    // Pinned so a new edge has to declare which kind it is, instead of
    // sliding in as arithmetic by default -- which is exactly how an
    // assumption gets read as a fact.
    const byType = (t: Coupling['type']) => COUPLINGS.filter((c) => c.type === t).length;
    expect(COUPLINGS).toHaveLength(19);
    expect(byType('arithmetic')).toBe(8);
    expect(byType('assumption')).toBe(10);
    expect(byType('convention')).toBe(1);
  });

  it('declares exactly four lagged edges', () => {
    expect(laggedCouplings()).toHaveLength(4);
    for (const c of COUPLINGS) {
      expect([0, 1]).toContain(c.lagSprints);
    }
  });

  it('gives every edge a unique id, a formula, a description and a UI label', () => {
    const ids = COUPLINGS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of COUPLINGS) {
      expect(c.formula.length, `${c.id} has no formula`).toBeGreaterThan(0);
      expect(c.description.length, `${c.id} has no description`).toBeGreaterThan(0);
      expect(c.uiLabel.length, `${c.id} has no uiLabel`).toBeGreaterThan(0);
    }
  });

  it('labels every assumption and convention as one in the UI copy', () => {
    // An assumption whose callout does not say it is an assumption is an
    // assumption the learner will read as a fact.
    for (const c of COUPLINGS) {
      if (c.type === 'assumption') {
        expect(c.uiLabel, `${c.id}`).toMatch(/^Model assumption:/);
      }
      if (c.type === 'convention') {
        expect(c.uiLabel, `${c.id}`).toMatch(/^Sandbox counting convention:/);
      }
      if (c.type === 'arithmetic') {
        expect(c.uiLabel, `${c.id}`).not.toMatch(/^Model assumption:/);
      }
    }
  });

  it('declares a calibration parameter exactly where the formula uses one', () => {
    // Both directions. An undeclared coefficient reads as a measured industry
    // constant six months from now; a declared one that the formula does not
    // use puts a caption on a chart that is not true.
    const K_SYMBOLS: Record<string, keyof ScenarioParams> = {
      k1: 'wipDefectPressure',
      k2: 'batchFailPressure',
      k3: 'automationRecoveryGain',
      k4: 'overloadHappinessDecay',
    };
    const namedCalibrations = PARAM_SPECS.filter((s) => s.calibration).map((s) => s.key);

    for (const c of COUPLINGS) {
      let expected: string | null = null;
      for (const [symbol, key] of Object.entries(K_SYMBOLS)) {
        if (new RegExp(`\\b${symbol}\\b`).test(c.formula)) expected = key;
      }
      if (expected === null) {
        for (const key of namedCalibrations) {
          if (new RegExp(`\\b${key}\\b`).test(c.formula)) expected = key;
        }
      }
      expect(c.calibrationParameter, `${c.id}`).toBe(expected);
    }
  });

  it('only names calibration parameters that are actually declared as such', () => {
    const calibrationKeys = new Set(PARAM_SPECS.filter((s) => s.calibration).map((s) => s.key));
    for (const c of COUPLINGS) {
      if (c.calibrationParameter === null) continue;
      expect(
        calibrationKeys.has(c.calibrationParameter as keyof ScenarioParams),
        `${c.id} names "${c.calibrationParameter}", which is not marked calibration in PARAM_SPECS`,
      ).toBe(true);
    }
  });

  it('keeps every calibration parameter off the slider panel', () => {
    // Surfacing them invites reading them as findings rather than as teaching
    // coefficients.
    for (const spec of PARAM_SPECS) {
      if (spec.calibration) expect(spec.exposed, `${spec.key}`).toBe(false);
    }
  });
});

describe('terminology', () => {
  // Read through Vite's raw glob rather than node:fs. The app tsconfig
  // deliberately pins `types` to vite/client so node globals cannot drift
  // into browser code, and a test that needs `process` and `node:fs` would
  // force that list open for everything.
  const sources = import.meta.glob('/src/**/*.{ts,tsx}', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>;

  // The banned tokens are assembled from fragments rather than written out.
  // Spelling either one literally here would make this file trip its own
  // rule, and the obvious way out -- exempting test files, or exempting
  // comments -- is a hole someone eventually routes a real identifier
  // through. Keeping the rule absolute is worth this small awkwardness.
  const BANNED_SHORT_FORM = 'failed' + 'Deploys';
  const LEGACY_RECOVERY_TERM = 'm' + 't' + 't' + 'r';

  it('actually reads the source tree', () => {
    // Without this, a wrong glob path makes every rule below pass by scanning
    // nothing at all -- the worst possible outcome for a lint rule, because
    // it reports success.
    const files = Object.keys(sources);
    expect(files.length).toBeGreaterThan(20);
    expect(files.some((f) => f.endsWith('/services/metrics/deploymentModel.ts'))).toBe(true);
    expect(files.some((f) => f.endsWith('/services/metrics/couplings.ts'))).toBe(true);
  });

  it('uses failedChangeDeployments, never the older short form', () => {
    // A failed change deployment is not a production incident. The short name
    // erased that distinction, so it is banned outright rather than
    // discouraged.
    const banned = new RegExp(`\\b${BANNED_SHORT_FORM}\\b`);
    for (const [file, text] of Object.entries(sources)) {
      expect(banned.test(text), `${file} uses the banned identifier`).toBe(false);
    }
  });

  /**
   * Every occurrence of the legacy term that is NOT a bare all-caps word.
   *
   * The all-caps standalone form is prose ("renamed from X in 2024"); the
   * following test governs those. Anything else -- lowercase, camelCase,
   * prefixed, suffixed -- is an identifier, and an identifier is what makes a
   * stale name authoritative.
   */
  function legacyIdentifiers(text: string): string[] {
    const anyCase = new RegExp(`\\w*${LEGACY_RECOVERY_TERM}\\w*`, 'gi');
    return [...text.matchAll(anyCase)]
      .map((m) => m[0])
      .filter((token) => token !== LEGACY_RECOVERY_TERM.toUpperCase());
  }

  it('catches the legacy term in every identifier shape it could take', () => {
    // A lint rule nobody has tested is a lint rule that quietly stops
    // catching things. An earlier version of this one matched only the
    // lowercase spelling and so missed the capitalised camelCase form
    // outright -- which is the shape it is most likely to appear in.
    //
    // Every sample is assembled from fragments for the same reason the banned
    // tokens are: spelling one out would make this file trip its own rule.
    const upper = LEGACY_RECOVERY_TERM.toUpperCase();
    const capitalised = upper[0] + LEGACY_RECOVERY_TERM.slice(1);
    for (const sample of [
      LEGACY_RECOVERY_TERM,
      LEGACY_RECOVERY_TERM + 'Hours',
      'avg' + capitalised,
      'recovery' + capitalised,
    ]) {
      expect(legacyIdentifiers(`const ${sample} = 1;`), sample).toHaveLength(1);
    }
    // ...and leaves the prose form alone.
    expect(legacyIdentifiers(`renamed from ${upper} in 2024`)).toEqual([]);
  });

  it('never uses the legacy recovery term as an identifier', () => {
    // DORA renamed it Failed Deployment Recovery Time in 2024.
    for (const [file, text] of Object.entries(sources)) {
      expect(
        legacyIdentifiers(text),
        `${file} uses the legacy term as an identifier`,
      ).toEqual([]);
    }
  });

  it('marks every historical mention of the legacy term as legacy', () => {
    // The design permits historical mentions in teaching copy precisely so a
    // learner who has only ever heard the old name can find the new one. It
    // requires them to say they are historical -- an unmarked mention teaches
    // the stale name as current.
    const mention = new RegExp(LEGACY_RECOVERY_TERM.toUpperCase(), 'g');
    const marksItLegacy = /renamed|legacy|formerly|superseded|until 2024/i;

    for (const [file, text] of Object.entries(sources)) {
      for (const hit of text.matchAll(mention)) {
        const context = text.slice(Math.max(0, hit.index - 160), hit.index + 160);
        expect(
          marksItLegacy.test(context),
          `${file} mentions the legacy term without identifying it as legacy`,
        ).toBe(true);
      }
    }
  });
});

describe('determinism', () => {
  it('returns deep-equal results for equal params', () => {
    expect(simulate(scenario())).toEqual(simulate(scenario()));
  });
});

/** Corners chosen to stress the rework rate rather than the whole domain. */
function stressScenarios(): ScenarioParams[] {
  const out: ScenarioParams[] = [];
  for (const throughput of [1, 5, 20]) {
    for (const externalIncidentsPerSprint of [0, 2, 10]) {
      for (const reworkPerIncident of [0, 1.5, 3]) {
        for (const baseChangeFailRate of [0, 0.25]) {
          out.push(
            scenario({
              throughput,
              externalIncidentsPerSprint,
              reworkPerIncident,
              baseChangeFailRate,
              wip: Math.min(throughput, 20),
              sprints: 8,
            }),
          );
        }
      }
    }
  }
  return out;
}
