// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, it, expect } from 'vitest';
import type { ConceptId } from '../../types/learning';
import { CHART_BY_ID } from '../metrics/charts';
import { COUPLING_BY_ID } from '../metrics/couplings';
import { simulate } from '../metrics/compose';
import { buildChartPayload } from '../metrics/chartData';
import { validateParams } from '../metrics/params';
import { CONCEPTS, CONCEPT_LIST, conceptOrder, prerequisitesOf } from './concepts';
import { CHALLENGES, CHALLENGE_BY_ID, counterfactualPairs } from './challenges';
import { SCENARIOS, SCENARIO_LIST, fingerprint, isDistinctScenario, paramsFor } from './scenarios';
import { leakedTerms, relationshipLeakInCard, unbalancedOptions } from './vocabulary';
import { WORKFLOW } from '../metrics/workflow';

// Build-time integrity for the learning layer.
//
// The principle, stated in the PRD and worth restating here because it is the
// whole reason this file exists:
//
//   A renamed or removed simulation concept should BREAK THE LEARNING BUILD
//   rather than silently teach stale content.
//
// Where the compiler can enforce that it already does -- `Concept.charts` is
// `ChartViewId[]`, so a renamed chart fails `tsc`. Coupling ids are plain
// strings in the frozen ledger, so those are enforced here instead. The
// guarantee is the same; the mechanism is weaker, and saying so is better than
// implying a type check that does not exist.
//
// The content tests below are the ones that cannot be done by review. Every
// individual sentence in concepts.ts and challenges.ts reads fine; a leak is
// only visible when you know what the learner has and has not been told yet,
// which is a graph query, not a proofreading task.

describe('references into the frozen model', () => {
  it('resolves every chart a concept points at', () => {
    for (const concept of CONCEPT_LIST) {
      for (const chartId of concept.charts) {
        expect(CHART_BY_ID.get(chartId), `${concept.id} -> ${chartId}`).toBeDefined();
      }
    }
  });

  it('resolves every coupling a concept declares', () => {
    // Not compiler-checked: ledger ids are strings. This is the guard.
    for (const concept of CONCEPT_LIST) {
      for (const couplingId of concept.couplings) {
        expect(
          COUPLING_BY_ID.get(couplingId),
          `concept "${concept.id}" cites coupling "${couplingId}", which is not in the ledger`,
        ).toBeDefined();
      }
    }
  });

  it('resolves every coupling a challenge explanation rests on', () => {
    for (const challenge of CHALLENGES) {
      for (const couplingId of challenge.explanationCouplings) {
        expect(
          COUPLING_BY_ID.get(couplingId),
          `challenge "${challenge.id}" cites coupling "${couplingId}", which is not in the ledger`,
        ).toBeDefined();
      }
    }
  });

  it('only teaches an assumption or convention as one', () => {
    // A learning card that cites an arithmetic edge while calling it a
    // modelling choice would invert the distinction eight revisions were
    // spent establishing.
    for (const concept of CONCEPT_LIST) {
      for (const couplingId of concept.couplings) {
        const coupling = COUPLING_BY_ID.get(couplingId)!;
        expect(['arithmetic', 'assumption', 'convention']).toContain(coupling.type);
      }
    }
  });
});

describe('the concept graph', () => {
  it('resolves every prerequisite and has no cycle', () => {
    for (const concept of CONCEPT_LIST) {
      for (const prereq of concept.prerequisites) {
        expect(CONCEPTS[prereq], `${concept.id} -> ${prereq}`).toBeDefined();
      }
    }
    expect(() => conceptOrder()).not.toThrow();
  });

  it('never places a concept before one of its prerequisites', () => {
    const order = conceptOrder();
    for (const concept of CONCEPT_LIST) {
      for (const prereq of concept.prerequisites) {
        expect(
          order.indexOf(prereq),
          `${prereq} must come before ${concept.id}`,
        ).toBeLessThan(order.indexOf(concept.id));
      }
    }
  });

  it('teaches variation before any concept that makes a causal claim', () => {
    // The PRD's dependency graph puts variation early on purpose, against the
    // order most curricula use. Everything downstream of it is a causal claim,
    // and a causal claim from someone who cannot separate an effect from the
    // wobble already present is a coin flip that feels like understanding.
    const order = conceptOrder();
    const causal: ConceptId[] = ['littles-law', 'wip-cycle-time-mechanism'];
    for (const id of causal) {
      expect(order.indexOf('variation'), `variation must precede ${id}`).toBeLessThan(
        order.indexOf(id),
      );
    }
  });

  it('establishes arithmetic before asking anyone to DISTINGUISH edge types', () => {
    // Little's Law cannot be wrong. Establishing that some relationships are
    // certain is what gives the word "assumption" any meaning later.
    //
    // The bar is deliberately "before the learner must tell them apart", not
    // "before an assumption-typed edge is ever cited". Throughput's rework gap
    // rests on an assumption edge and is the best reading exercise in Phase 1;
    // it asks the learner to read a gap, not to classify a relationship. The
    // concept that asks for the classification is the counterfactual one, and
    // that is what must come later.
    const order = conceptOrder();

    const arithmeticAnchor = CONCEPT_LIST.find((c) =>
      c.couplings.some((id) => COUPLING_BY_ID.get(id)?.type === 'arithmetic'),
    );
    expect(arithmeticAnchor, 'no concept establishes an arithmetic relationship').toBeDefined();

    // Concepts that require the learner to separate one edge type from another.
    const classifying = CONCEPT_LIST.filter(
      (c) =>
        new Set(c.couplings.map((id) => COUPLING_BY_ID.get(id)?.type)).size > 1,
    );
    expect(classifying.length, 'nothing asks the learner to distinguish edge types').toBeGreaterThan(
      0,
    );

    for (const concept of classifying) {
      expect(
        order.indexOf(arithmeticAnchor!.id),
        `${concept.id} asks the learner to tell edge types apart before arithmetic is established`,
      ).toBeLessThan(order.indexOf(concept.id));
    }
  });
});

describe('name the objects, withhold the relationships', () => {
  it('never states the target relationship in the referential card', () => {
    // The rule the whole orientation layer exists to obey. A card that gives
    // the relationship away converts the next challenge into a
    // reading-comprehension exercise, and the prediction stops measuring
    // anything.
    for (const concept of CONCEPT_LIST) {
      const leaked = relationshipLeakInCard(concept.id);
      expect(
        leaked,
        `the card for "${concept.id}" contains ${JSON.stringify(leaked)}, which are the ` +
          `terms that make its target relationship relational: "${concept.targetRelationship}"`,
      ).toEqual([]);
    }
  });

  it('gives every concept a referent before it claims anything relational', () => {
    for (const concept of CONCEPT_LIST) {
      expect(concept.referentDefinition.length, concept.id).toBeGreaterThan(40);
      expect(concept.whereToSeeIt.length, concept.id).toBeGreaterThan(20);
      // A pure-vocabulary concept teaches no relationship at all, by design.
      if (concept.depth === 'vocabulary') {
        expect(concept.targetRelationship, concept.id).toBeNull();
      } else {
        expect(concept.targetRelationship, concept.id).not.toBeNull();
      }
    }
  });

  it('can detect a leak, so the check is not vacuous', () => {
    // A test that can only pass is not a test. "Throughput" belongs to a
    // concept that is not available at `wip`, so this must be caught.
    const leaks = leakedTerms('Raising WIP does not raise throughput.', 'wip');
    expect(leaks.map((l) => l.term)).toContain('throughput');

    // ...and the same sentence leaks nothing once throughput is available.
    expect(leakedTerms('Raising WIP does not raise throughput.', 'littles-law')).toEqual([]);
  });
});

describe('challenge vocabulary', () => {
  it('uses only vocabulary the learner already has, in prompt and options', () => {
    for (const challenge of CHALLENGES) {
      const surfaces = [
        ['prompt', challenge.prompt] as const,
        ...challenge.options.map((o) => [`option "${o.id}"`, o.text] as const),
      ];
      for (const [where, text] of surfaces) {
        const leaks = leakedTerms(text, challenge.conceptId);
        expect(
          leaks,
          `${challenge.id} ${where} leaks ${JSON.stringify(leaks)} — the learner has not ` +
            `reached ${JSON.stringify([...new Set(leaks.map((l) => l.from))])} yet`,
        ).toEqual([]);
      }
    }
  });

  it('keeps pre-commitment hints inside the same vocabulary', () => {
    // A hint shown before the learner commits is part of the question.
    for (const challenge of CHALLENGES) {
      for (const hint of challenge.hints) {
        const leaks = leakedTerms(hint.text, challenge.conceptId);
        expect(leaks, `${challenge.id} hint ${hint.tier} leaks ${JSON.stringify(leaks)}`).toEqual(
          [],
        );
      }
    }
  });

  it('lets the explanation use whatever it needs, because it comes after', () => {
    // Stated as a test so the asymmetry is deliberate rather than accidental:
    // the reveal is where a new term is allowed to arrive.
    const first = CHALLENGE_BY_ID.get('wip-first-prediction')!;
    expect(leakedTerms(first.prompt, first.conceptId)).toEqual([]);
    expect(first.explanation).toMatch(/throughput/i);
  });
});

describe('option construction', () => {
  it('never singles one option out by hedging or by length', () => {
    // One hedged option among absolutes is picked on instinct, and scores a
    // correct prediction from a learner who reasoned nothing -- which
    // corrupts the primary mastery signal at its source.
    for (const challenge of CHALLENGES) {
      const problems = unbalancedOptions(challenge.options.map((o) => o.text));
      expect(problems, `${challenge.id}: ${problems.join('; ')}`).toEqual([]);
    }
  });

  it('gives every challenge a correct option that exists', () => {
    for (const challenge of CHALLENGES) {
      expect(challenge.options.length, challenge.id).toBeGreaterThanOrEqual(3);
      expect(
        challenge.options.some((o) => o.id === challenge.correctOptionId),
        `${challenge.id} marks "${challenge.correctOptionId}" correct, which is not an option`,
      ).toBe(true);
      expect(new Set(challenge.options.map((o) => o.id)).size).toBe(challenge.options.length);
    }
  });

  it('offers four tiers of hint, in order, without handing over the answer first', () => {
    for (const challenge of CHALLENGES) {
      expect(challenge.hints.map((h) => h.tier), challenge.id).toEqual([1, 2, 3, 4]);
    }
  });
});

describe('scenarios are parameter sets, never model variants', () => {
  it('produces a valid, simulable parameter set for every scenario', () => {
    for (const scenario of SCENARIO_LIST) {
      const params = paramsFor(scenario.id);
      expect(validateParams(params), `${scenario.id} is not a legal scenario`).toEqual([]);
      expect(simulate(params).length, scenario.id).toBeGreaterThan(0);
    }
  });

  it('resolves every scenario a concept or challenge names', () => {
    for (const concept of CONCEPT_LIST) {
      expect(SCENARIOS[concept.liveScenario], concept.id).toBeDefined();
    }
    for (const challenge of CHALLENGES) {
      expect(SCENARIOS[challenge.scenario], challenge.id).toBeDefined();
    }
  });

  it('fingerprints a scenario stably and distinguishes different ones', () => {
    expect(fingerprint(paramsFor('baseline'))).toBe(fingerprint(paramsFor('baseline')));
    expect(isDistinctScenario('baseline', 'wip-raised')).toBe(true);
  });
});

describe('transfer and counterfactual', () => {
  it('runs every transfer challenge on a genuinely different scenario', () => {
    // A clone of the training scenario is repetition, not transfer, and
    // certifying it as transfer is how shape-matching gets marked as mastery.
    const transfers = CHALLENGES.filter((c) => c.transferOf);
    expect(transfers.length, 'no transfer challenge exists').toBeGreaterThan(0);

    for (const challenge of transfers) {
      const origin = CHALLENGE_BY_ID.get(challenge.transferOf!);
      expect(origin, `${challenge.id} transfers from an unknown challenge`).toBeDefined();
      expect(
        isDistinctScenario(challenge.scenario, origin!.scenario),
        `${challenge.id} reuses the scenario it claims to transfer from`,
      ).toBe(true);
    }
  });

  it('pairs at least one counterfactual, symmetrically', () => {
    const pairs = counterfactualPairs();
    expect(pairs.length, 'no counterfactual pair exists').toBeGreaterThan(0);

    for (const [a, b] of pairs) {
      expect(b.pairedWith, `${b.id} does not point back at ${a.id}`).toBe(a.id);
      expect(
        isDistinctScenario(a.scenario, b.scenario),
        `${a.id} and ${b.id} share a scenario, so nothing distinguishes them`,
      ).toBe(true);
      // The point of a pair: the same option set, a different right answer.
      expect(a.options.map((o) => o.id)).toEqual(b.options.map((o) => o.id));
      expect(
        a.correctOptionId,
        `${a.id} and ${b.id} have the same answer, so they teach one mechanism twice`,
      ).not.toBe(b.correctOptionId);
    }
  });

  it('makes each pair genuinely distinguishable, by mechanism or by driver', () => {
    // Two shapes of counterfactual, and both are legitimate:
    //
    //   DIFFERENT EDGES -- cycle time rising from Little's Law (arithmetic,
    //   immediate) versus from incident load (assumption, lagged).
    //
    //   SAME EDGE, DIFFERENT DRIVER -- a cumulative-flow band widening because
    //   one state slowed, versus because the WIP limit rose. One coupling, two
    //   causes, and the discriminator is whether the TOTAL moved. That is the
    //   harder pair, and refusing it would have ruled out the sharpest CFD
    //   lesson the model can now support.
    //
    // What is not allowed is a pair that differs in neither.
    for (const [a, b] of counterfactualPairs()) {
      const edgesA = a.explanationCouplings.map((id) => COUPLING_BY_ID.get(id)!.id).sort();
      const edgesB = b.explanationCouplings.map((id) => COUPLING_BY_ID.get(id)!.id).sort();
      expect(edgesA.length, a.id).toBeGreaterThan(0);
      expect(edgesB.length, b.id).toBeGreaterThan(0);

      const driversOf = (scenario: (typeof a)['scenario']) =>
        Object.keys(SCENARIOS[scenario].overrides).sort().join(',');

      const differentMechanism = JSON.stringify(edgesA) !== JSON.stringify(edgesB);
      const differentDriver = driversOf(a.scenario) !== driversOf(b.scenario);

      expect(
        differentMechanism || differentDriver,
        `${a.id} and ${b.id} share both their mechanism and their driver, so nothing ` +
          `distinguishes them`,
      ).toBe(true);
    }
  });

  it('gives the CFD pair a discriminator the learner can actually measure', () => {
    // The pair asks which of two causes produced a change in the bands. If
    // the total work in progress moved the same way in both, the question has
    // no answer and the challenge is unfair.
    const totalWip = (scenario: 'baseline' | 'constrained-state' | 'upstream-wip-raised') => {
      const params = paramsFor(scenario);
      const flow = simulate(params)[0].flow;
      const day = Math.floor(flow.stateOccupancy.length / 2);
      return flow.stateOccupancy[day].reduce((sum, v) => sum + v, 0);
    };

    const base = totalWip('baseline');
    // A constraint redistributes work. It does not create any.
    expect(totalWip('constrained-state'), 'a constraint changed the total').toBeCloseTo(base, 9);
    // Raising the WIP limit does.
    expect(totalWip('upstream-wip-raised'), 'more WIP did not raise the total').toBeGreaterThan(
      base,
    );
  });
});

describe('learning content survives a different workflow', () => {
  const learningText = () => [
    ...CONCEPT_LIST.flatMap((c) => [
      c.referentDefinition,
      c.whereToSeeIt,
      c.whyItMatters,
      c.targetRelationship ?? '',
      c.evidenceBoundary ?? '',
    ]),
    ...CHALLENGES.flatMap((c) => [
      c.prompt,
      c.explanation,
      ...c.options.map((o) => o.text),
      ...c.hints.map((h) => h.text),
    ]),
  ];

  it('never states how many workflow states there are', () => {
    // The workflow is configuration. A sentence saying "the three bands"
    // becomes a lie the day a fourth state is added, and nothing would catch
    // it -- the chart would render four bands under prose describing three.
    const counts = /\b(two|three|four|five|six)\b\s+(workflow\s+)?(states?|bands?)/i;
    for (const text of learningText()) {
      expect(counts.test(text), `learning content names a state count: "${text}"`).toBe(false);
    }
  });

  it('never hard-codes a workflow state name that the model might rename', () => {
    // Content may describe a state generically; it may not depend on one being
    // called what it is called today.
    const labels = WORKFLOW.map((s) => s.label);
    for (const text of learningText()) {
      for (const label of labels) {
        expect(
          new RegExp(`\\b${label}\\b`).test(text),
          `learning content hard-codes the state name "${label}": "${text}"`,
        ).toBe(false);
      }
    }
  });

  it('proves those two checks can actually fail', () => {
    // Both regexes above lost their word boundaries to a stray backspace
    // escape once, which made them match nothing at all -- tests that could
    // only pass. This is the guard against that happening again.
    const counts = /\b(two|three|four|five|six)\b\s+(workflow\s+)?(states?|bands?)/i;
    expect(counts.test('there are three bands in the middle')).toBe(true);
    expect(counts.test('the bands in between are the states')).toBe(false);

    const label = WORKFLOW[0].label;
    expect(new RegExp(`\\b${label}\\b`).test(`work waits in ${label} the longest`)).toBe(true);
    expect(new RegExp(`\\b${label}\\b`).test('work waits in one state the longest')).toBe(false);
  });

  it('only teaches a bottleneck where the model can actually produce one', () => {
    // The rule that kept this honest. On the Rev 8 aggregate CFD the middle
    // band was the WIP control drawn as a shape, constant by construction --
    // a bottleneck lesson on top of it would have been fiction. Every
    // accumulation challenge must run on a scenario that genuinely accumulates.
    const bottleneckChallenges = CHALLENGES.filter(
      (c) => CONCEPTS[c.conceptId].id === 'bottleneck' && c.correctOptionId === 'constrained',
    );
    expect(bottleneckChallenges.length, 'no accumulation challenge exists').toBeGreaterThan(0);

    for (const challenge of bottleneckChallenges) {
      const flow = simulate(paramsFor(challenge.scenario))[0].flow;
      const shareAt = (day: number) => {
        const total = flow.stateOccupancy[day].reduce((a, b) => a + b, 0);
        return total > 0 ? flow.stateOccupancy[day].map((v) => v / total) : [];
      };
      const early = shareAt(1);
      const late = shareAt(flow.stateOccupancy.length - 2);
      const grew = late.some((share, i) => share > early[i] + 1e-6);

      expect(
        grew,
        `${challenge.id} teaches accumulation on "${challenge.scenario}", where no state ` +
          `actually accumulates`,
      ).toBe(true);
    }
  });

  it('draws one band per state whatever the workflow contains', () => {
    const params = paramsFor('baseline');
    const payload = buildChartPayload('cumulativeFlow', simulate(params), params);
    expect(payload.series).toHaveLength(WORKFLOW.length + 2);
    expect(payload.series.slice(1, -1).map((s) => s.label)).toEqual(
      WORKFLOW.map((s) => s.label),
    );
  });
});

describe('the learning layer does not touch the model', () => {
  it('leaves scenario parameters untouched when the learning layer reads them', () => {
    // The boundary rule: learning reads simulation state; simulation never
    // reads learner state. A scenario handed to the model must come back
    // identical, or something in the learning layer is mutating its input.
    const before = paramsFor('wip-raised');
    const snapshot = fingerprint(before);
    simulate(before);
    expect(fingerprint(before)).toBe(snapshot);
    expect(fingerprint(paramsFor('wip-raised'))).toBe(snapshot);
  });

  it('keeps every concept pointed at a chart that still exists in the inventory', () => {
    const covered = new Set(CONCEPT_LIST.flatMap((c) => c.charts));
    expect(covered.size, 'Phase 1 concepts reference no charts at all').toBeGreaterThan(0);
    for (const chartId of covered) {
      expect(CHART_BY_ID.get(chartId)).toBeDefined();
    }
  });

  it('never names a prerequisite that is not reachable from the graph root', () => {
    for (const concept of CONCEPT_LIST) {
      if (concept.prerequisites.length === 0) continue;
      const reachable = prerequisitesOf(concept.id);
      expect(reachable.size, `${concept.id} has unreachable prerequisites`).toBeGreaterThan(0);
    }
  });
});
