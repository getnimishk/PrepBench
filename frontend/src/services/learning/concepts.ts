import type { Concept, ConceptId } from '../../types/learning';

// The concept graph for Phase 1.
//
// Ordered by the PRD's dependency graph, which puts VARIATION before cycle
// time -- deliberately, and against the order most curricula use. Everything
// downstream of variation is a causal claim, and a causal claim made by
// someone who cannot separate an effect from the wobble already present is a
// coin flip that feels like understanding.
//
// The one rule this file exists to obey:
//
//   NAME THE OBJECTS. WITHHOLD THE RELATIONSHIPS.
//
// `referentDefinition`, `whereToSeeIt` and `whyItMatters` may say what a thing
// IS. They may not say what it DOES to anything else. The relationship lives
// in `targetRelationship`, which is shown only at the reveal step -- and
// integrity.test.ts checks the card text against it, so a card that gives the
// game away fails the build rather than quietly turning the next challenge
// into a reading-comprehension exercise.
//
// `introducedVocabulary` is load-bearing for the same reason. It is the set of
// terms a concept LICENSES, and a challenge may only use terms licensed by its
// own concept or a transitive prerequisite. That is what stops a distractor
// naming the answer.

export const CONCEPTS: Record<ConceptId, Concept> = {
  // -------------------------------------------------------------------------
  'sandbox-and-work': {
    id: 'sandbox-and-work',
    canonicalName: 'Work, and how this sandbox shows it',
    depth: 'vocabulary',
    prerequisites: [],
    introducedVocabulary: [
      'simulation',
      'sandbox',
      'work item',
      'item',
      'start',
      'started',
      'finish',
      'finished',
      'sprint',
      'team',
      'control',
    ],
    referentDefinition:
      'This is a simulation of a delivery team, not a report about a real one. It runs ' +
      'in sprints: fixed periods in which the team starts work items and finishes them.',
    whereToSeeIt:
      'Every chart in the sandbox is plotted per sprint, labelled S1, S2, S3 and so on.',
    whyItMatters:
      'Because it is a simulation, the same settings always produce the same result. ' +
      'You can change one thing, run it again, and know that nothing else moved.',
    targetRelationship: null,
    charts: ['wipOverTime'],
    couplings: [],
    liveScenario: 'baseline',
    evidenceBoundary:
      'A simulation can tell you what its own rules produce. It cannot tell you that ' +
      'those rules describe your team.',
  },

  // -------------------------------------------------------------------------
  wip: {
    id: 'wip',
    canonicalName: 'Work in progress (WIP)',
    depth: 'meaning',
    prerequisites: ['sandbox-and-work'],
    introducedVocabulary: ['work in progress', 'wip', 'in progress', 'wip limit'],
    referentDefinition:
      'Work in progress is work that has started but has not finished. If four items ' +
      'are open right now, WIP is four.',
    whereToSeeIt:
      'The WIP limit is a control you can set. WIP over time plots it for each sprint.',
    // Says it is settable. Does NOT say what setting it does to anything.
    whyItMatters:
      'It is one of the few things about a delivery system a team can decide directly, ' +
      'today, without hiring anybody or changing any tooling.',
    targetRelationship:
      'Raising the WIP limit does not raise how much the team finishes.',
    charts: ['wipOverTime'],
    couplings: [],
    liveScenario: 'baseline',
    evidenceBoundary:
      'The sandbox sets WIP as a number. A real team’s WIP has to be counted from a ' +
      'board, and the count depends on which columns you decide are "in progress".',
  },

  // -------------------------------------------------------------------------
  throughput: {
    id: 'throughput',
    canonicalName: 'Throughput',
    depth: 'meaning',
    prerequisites: ['sandbox-and-work', 'wip'],
    introducedVocabulary: ['throughput', 'completions', 'delivered', 'capacity'],
    referentDefinition:
      'Throughput is how many work items the team actually finishes in a sprint. It is ' +
      'counted at the finish line, not at the start.',
    whereToSeeIt:
      'The Throughput chart, one point per sprint. Capacity is a separate control: what ' +
      'the team could finish with a clear sprint.',
    whyItMatters:
      'It is the number that answers "how much did we actually get done", and it is the ' +
      'one most often confused with how busy everybody looked.',
    targetRelationship:
      'Throughput follows capacity, not the WIP limit. WIP does not appear in it.',
    charts: ['throughput', 'velocity'],
    couplings: ['rework-consumes-capacity'],
    liveScenario: 'baseline',
    evidenceBoundary:
      'The sandbox counts an item as an item. Real items differ in size, so a real ' +
      'throughput count changes meaning the moment the team starts splitting work ' +
      'differently.',
  },

  // -------------------------------------------------------------------------
  variation: {
    id: 'variation',
    canonicalName: 'Variation, and the noise floor',
    depth: 'relationship',
    prerequisites: ['sandbox-and-work', 'throughput'],
    // Deliberately excludes generic words like "range" and "effect": a term
    // that appears in ordinary prose makes the leakage test fire on text that
    // leaks nothing, and a test that cries wolf gets switched off.
    introducedVocabulary: ['variation', 'vary', 'varies', 'noise floor', 'spread'],
    referentDefinition:
      'Results move from sprint to sprint even when nothing has been changed. The size ' +
      'of that movement is the variation the system already has — its noise floor.',
    whereToSeeIt:
      'Turn Capacity variation down to zero and a run goes flat. Turn it back up and ' +
      'the same run moves again, with nothing else altered.',
    whyItMatters:
      'It is the reason two runs of an unchanged system do not look identical, and the ' +
      'first number you need before you can say anything about a change.',
    targetRelationship:
      'A movement smaller than the noise floor is not evidence of an effect. Measure ' +
      'the range the system already produces, and require the change to exceed it.',
    charts: ['throughput', 'velocity'],
    couplings: [],
    liveScenario: 'steady-team',
    evidenceBoundary:
      'This sandbox is deterministic, so its variation comes from a fixed profile and ' +
      'repeats exactly. Real variation is larger, and does not repeat — so a real ' +
      'noise floor has to be measured again, not assumed.',
  },

  // -------------------------------------------------------------------------
  'cycle-time': {
    id: 'cycle-time',
    canonicalName: 'Cycle time',
    depth: 'meaning',
    prerequisites: ['sandbox-and-work', 'wip', 'throughput'],
    introducedVocabulary: ['cycle time', 'elapsed time', 'elapsed', 'waiting', 'queue'],
    referentDefinition:
      'Cycle time is how long a work item is open: the elapsed days from when it starts ' +
      'to when it finishes. Some of that is being worked on and some of it is waiting.',
    whereToSeeIt:
      'The Cycle time chart, in days. It also appears as a locked readout — there is no ' +
      'slider for it.',
    whyItMatters:
      'It is what a customer actually experiences, and it is the number most often ' +
      'quoted as a target by people who cannot set it.',
    targetRelationship:
      'Cycle time is an output. Nothing sets it directly; it follows from WIP and ' +
      'throughput.',
    charts: ['cycleTime', 'cycleTimeDistribution'],
    couplings: ['littles-law'],
    liveScenario: 'baseline',
    evidenceBoundary:
      'The sandbox knows exactly when each item started. Most real trackers record a ' +
      'status change, which is not the same event, and the gap between them is invisible ' +
      'in the data.',
  },

  // -------------------------------------------------------------------------
  'littles-law': {
    id: 'littles-law',
    canonicalName: 'Little’s Law',
    depth: 'relationship',
    prerequisites: ['wip', 'throughput', 'cycle-time', 'variation'],
    introducedVocabulary: ['little’s law', "little's law", 'arithmetic'],
    referentDefinition:
      'Little’s Law is the arithmetic that ties WIP, throughput and cycle time ' +
      'together. It is a consequence of how the three are defined, not a claim about how ' +
      'teams behave.',
    whereToSeeIt:
      'On the Cycle time card, labelled Arithmetic rather than Model assumption, with ' +
      'its formula.',
    whyItMatters:
      'It is the first relationship in this sandbox that cannot be wrong. Everything ' +
      'labelled an assumption later is a weaker kind of claim, and this is the reference ' +
      'point for that difference.',
    targetRelationship:
      'cycle time = WIP ÷ throughput × sprint length. Raise WIP without raising ' +
      'throughput and cycle time rises in exact proportion.',
    charts: ['cycleTime', 'flowEfficiency', 'deliveryLeadTime'],
    couplings: ['littles-law'],
    liveScenario: 'baseline',
    evidenceBoundary:
      'The arithmetic holds anywhere the three quantities are counted consistently. ' +
      'Whether your organisation counts them consistently is a separate question, and ' +
      'usually the harder one.',
  },

  // -------------------------------------------------------------------------
  'wip-cycle-time-mechanism': {
    id: 'wip-cycle-time-mechanism',
    canonicalName: 'Two ways elapsed time rises',
    depth: 'mechanism',
    prerequisites: ['littles-law', 'variation'],
    introducedVocabulary: [
      'mechanism',
      'alternative explanation',
      'incident',
      'incidents',
      'unplanned work',
      'lagged',
    ],
    referentDefinition:
      'A chart shows a symptom, not a cause. The same rise in elapsed time can be ' +
      'produced by more than one mechanism, and the picture alone does not say which.',
    whereToSeeIt:
      'Each chart lists the relationships it depends on, typed as arithmetic, model ' +
      'assumption or counting convention.',
    whyItMatters:
      'Naming the wrong cause confidently is worse in an interview than saying you would ' +
      'need to check, and the chart shape is the same either way.',
    targetRelationship:
      'Rising cycle time from higher WIP is arithmetic and immediate. Rising cycle time ' +
      'from incidents is an assumption and arrives a sprint late. Distinguishing them ' +
      'requires looking at what else moved.',
    charts: ['cycleTime', 'unplannedWorkShare', 'incidentsPerSprint'],
    couplings: ['littles-law', 'incident-to-capacity'],
    liveScenario: 'incident-pressure',
    evidenceBoundary:
      'The sandbox declares which mechanism it used. A real system does not, which is ' +
      'why the alternative explanation has to be ruled out with evidence rather than ' +
      'assumed away.',
  },

  // ======================= CUMULATIVE FLOW ================================
  //
  // These three exist only because the model was extended to carry per-state
  // occupancy. Before that, the CFD's middle band was the WIP control drawn
  // as a shape -- constant by construction -- and a bottleneck lesson on top
  // of it would have been fiction dressed as simulation.
  //
  // Nothing below names a state or a count. The workflow is configuration,
  // and a fourth state must not require a content edit.
  // -------------------------------------------------------------------------
  'workflow-states': {
    id: 'workflow-states',
    canonicalName: 'Workflow states, and the bands that show them',
    depth: 'meaning',
    prerequisites: ['sandbox-and-work', 'wip'],
    introducedVocabulary: [
      'workflow state',
      'workflow',
      'band',
      'bands',
      'cumulative flow',
      'cumulative flow diagram',
      'cfd',
    ],
    referentDefinition:
      'A workflow state is a stage a work item passes through between starting and ' +
      'finishing. A cumulative flow diagram draws one band per state, with ' +
      'not-yet-started at the top and finished at the bottom.',
    whereToSeeIt:
      'The Cumulative flow chart. Its legend lists the states this simulated team uses, ' +
      'in the order work moves through them.',
    whyItMatters:
      'Almost every other chart in this sandbox reports one number for the whole ' +
      'system. This one is the only place you can see the parts separately.',
    targetRelationship:
      'The bands between not-started and finished add up to work in progress. Each ' +
      'band is the work sitting in that one state.',
    charts: ['cumulativeFlow'],
    couplings: ['wip-across-states'],
    liveScenario: 'baseline',
    evidenceBoundary:
      'This sandbox declares its states. A real board’s columns are a choice somebody ' +
      'made, and two teams calling a column the same thing may not mean the same thing ' +
      'by it.',
  },

  'cfd-reading': {
    id: 'cfd-reading',
    canonicalName: 'Reading a cumulative flow diagram',
    depth: 'relationship',
    prerequisites: ['workflow-states', 'throughput'],
    introducedVocabulary: ['thickness', 'thicker', 'thinner', 'stacked'],
    referentDefinition:
      'The thickness of a band is how much work is sitting in that state at that ' +
      'moment. The total thickness of all the state bands is the work in progress.',
    whereToSeeIt:
      'On the Cumulative flow chart, measure vertically at any day: each band’s height ' +
      'is that state’s share.',
    whyItMatters:
      'It is the difference between knowing a system is busy and knowing which part of ' +
      'it is busy — and only one of those tells you where to go.',
    targetRelationship:
      'Total band thickness equals work in progress. Change the WIP limit and every ' +
      'band changes together; change one state’s speed and only its share moves.',
    charts: ['cumulativeFlow'],
    couplings: ['wip-across-states'],
    liveScenario: 'baseline',
    evidenceBoundary:
      'Reading thickness assumes items are comparable. A board where one column holds ' +
      'epics and another holds one-line fixes has bands that cannot be compared by ' +
      'height at all.',
  },

  bottleneck: {
    id: 'bottleneck',
    canonicalName: 'Accumulation, and where a system is constrained',
    depth: 'mechanism',
    prerequisites: ['cfd-reading', 'variation'],
    introducedVocabulary: [
      'bottleneck',
      'accumulate',
      'accumulating',
      'accumulation',
      'widening',
      'widens',
      'narrowing',
      'narrows',
      'constrained',
      'constraint',
    ],
    referentDefinition:
      'A state is constrained when work arrives at it faster than it leaves. A ' +
      'constraint is a property of one part of a system, not of the whole of it.',
    whereToSeeIt:
      'On the Cumulative flow chart, compare each band against the others across the ' +
      'run rather than at a single moment.',
    whyItMatters:
      'It is the difference between an answer an interviewer can follow — naming one ' +
      'part of the system and saying why — and one they cannot, which is that things ' +
      'feel slow.',
    targetRelationship:
      'A band that widens over time is accumulating: that state is the constraint, and ' +
      'effort spent anywhere else changes nothing. A widening that affects every band ' +
      'at once is more work in progress, not a constraint.',
    charts: ['cumulativeFlow', 'wipOverTime'],
    couplings: ['wip-across-states'],
    liveScenario: 'constrained-state',
    evidenceBoundary:
      'This sandbox knows which state it slowed down. A real board does not tell you ' +
      '— you infer it from the bands, and the inference is wrong if items are being ' +
      'reclassified or the columns do not match how work actually moves.',
  },
};

export const CONCEPT_LIST: Concept[] = Object.values(CONCEPTS);

/** Every prerequisite of `id`, transitively, excluding `id` itself. */
export function prerequisitesOf(id: ConceptId): Set<ConceptId> {
  const seen = new Set<ConceptId>();
  const walk = (current: ConceptId) => {
    for (const p of CONCEPTS[current].prerequisites) {
      if (seen.has(p)) continue;
      seen.add(p);
      walk(p);
    }
  };
  walk(id);
  return seen;
}

/**
 * Concepts in an order that never places one before a prerequisite.
 *
 * Used by the recommender and by the vocabulary tests. Throws on a cycle
 * rather than returning a plausible-looking partial order.
 */
export function conceptOrder(): ConceptId[] {
  const ordered: ConceptId[] = [];
  const placed = new Set<ConceptId>();
  const remaining = new Set<ConceptId>(CONCEPT_LIST.map((c) => c.id));

  while (remaining.size > 0) {
    const ready = [...remaining].filter((id) =>
      CONCEPTS[id].prerequisites.every((p) => placed.has(p)),
    );
    if (ready.length === 0) {
      throw new Error(`concept graph has a cycle among: ${[...remaining].join(', ')}`);
    }
    for (const id of ready) {
      ordered.push(id);
      placed.add(id);
      remaining.delete(id);
    }
  }
  return ordered;
}
