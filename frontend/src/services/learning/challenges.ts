import type { Challenge, ChallengeId, ConceptId } from '../../types/learning';

// Phase 1 challenges.
//
// Two rules govern every prompt in this file, and both are checked by
// integrity.test.ts rather than by review:
//
// 1. VOCABULARY. A prompt, its options and any pre-commitment hint may use
//    only terms the learner has already been given. The first WIP prediction
//    therefore asks whether the team will "finish more, about the same, or
//    fewer" -- it never says "throughput", because throughput has not been
//    named yet. The word arrives afterwards, as the name for the thing the
//    learner just watched, which is a far stronger introduction than a
//    definition card.
//
// 2. BALANCE. No option may be the only hedged one, and none may be markedly
//    longer than the rest. Both are tells that let a learner score a correct
//    prediction without reasoning, which corrupts the one signal mastery
//    actually rests on.
//
// No prompt quotes a number. Numbers come from the live model at render time
// (PRD 7.4): an authored figure in teaching copy drifts away from the
// simulation the moment a coefficient moves, and then the lesson is teaching
// something the sandbox no longer does.

export const CHALLENGES: Challenge[] = [
  // =========================================================================
  // Recognize -- find the object in the live sandbox before predicting with it
  //
  // This step exists because of the beginner problem: a learner cannot
  // generate a meaningful wrong prediction about a thing whose referent they
  // do not have. Without it we would be measuring ignorance and reporting it
  // as reasoning.
  // =========================================================================
  {
    id: 'sandbox-recognition',
    conceptId: 'sandbox-and-work',
    type: 'recognition',
    capability: 'recognize',
    difficulty: 'guided',
    scenario: 'baseline',
    prompt:
      'Along the bottom of every chart in this sandbox you will see S1, S2, S3 and so ' +
      'on. What does one of those labels stand for?',
    options: [
      { id: 'sprint', text: 'One sprint: a fixed period in which the team works' },
      { id: 'item', text: 'One work item, from the moment it was started' },
      { id: 'day', text: 'One day of the team’s working week' },
    ],
    correctOptionId: 'sprint',
    explanation:
      'Every chart here is plotted per sprint. That matters more than it looks: a ' +
      'consequence that arrives "one sprint later" is a whole label along the axis, ' +
      'not a small shift you would have to squint at.',
    explanationCouplings: [],
    hints: [
      { tier: 1, text: 'Count the labels and compare that to the Sprints control.' },
      { tier: 2, text: 'Setting Sprints to a different number changes how many appear.' },
      { tier: 3, text: 'Each label is one run of the period the team works in.' },
      { tier: 4, text: 'S3 is the third of those periods.' },
    ],
  },
  {
    id: 'wip-recognition',
    conceptId: 'wip',
    type: 'recognition',
    capability: 'recognize',
    difficulty: 'guided',
    scenario: 'baseline',
    prompt:
      'You want to see how many work items this team has open at once. Which part of ' +
      'the sandbox tells you that?',
    options: [
      { id: 'wip', text: 'The WIP limit control, and the WIP over time chart' },
      { id: 'finished', text: 'The chart counting work items the team has finished' },
      { id: 'labels', text: 'The sprint labels along the bottom of every chart' },
    ],
    correctOptionId: 'wip',
    explanation:
      'WIP is a control you can set, and a chart you can read. Almost nothing else in ' +
      'this sandbox is both — most numbers here are produced rather than chosen.',
    explanationCouplings: [],
    hints: [
      { tier: 1, text: 'Look for something you can set as well as something you can read.' },
      { tier: 2, text: 'Open the scenario controls and read the Flow group.' },
      { tier: 3, text: 'One control is about work that is open rather than work that is done.' },
      { tier: 4, text: 'It is the limit on how much can be started at once.' },
    ],
  },

  // =========================================================================
  // WIP -- the first prediction a learner ever makes
  // =========================================================================
  {
    id: 'wip-first-prediction',
    conceptId: 'wip',
    type: 'prediction',
    capability: 'predict',
    difficulty: 'guided',
    scenario: 'wip-raised',
    prompt:
      'The team starts twice as many work items at once as before, and nothing else ' +
      'about the team changes. Over the next few sprints, what happens to how many ' +
      'work items they finish?',
    options: [
      { id: 'more', text: 'More work items finish in each sprint' },
      { id: 'same', text: 'About the same number finish in each sprint' },
      { id: 'fewer', text: 'Fewer work items finish in each sprint' },
    ],
    correctOptionId: 'same',
    explanation:
      'Starting more work did not finish more work. The team can only finish what its ' +
      'capacity allows, and starting an item does not add capacity. The number of items ' +
      'finished per sprint has a name — throughput — and the WIP limit does not appear ' +
      'in it at all.',
    explanationCouplings: [],
    hints: [
      { tier: 1, text: 'Look at the chart of finished work, not at the control you moved.' },
      { tier: 2, text: 'Compare the finished-work line before and after. Did its level move?' },
      {
        tier: 3,
        text:
          'Ask what actually limits finishing: the number of things open, or how much the ' +
          'team can complete in a sprint?',
      },
      {
        tier: 4,
        text:
          'Starting work and finishing work are different acts. Only one of them is ' +
          'limited by what the team can do.',
      },
    ],
  },

  // =========================================================================
  // Throughput -- naming the thing they just watched
  // =========================================================================
  {
    id: 'throughput-reading',
    conceptId: 'throughput',
    type: 'reading',
    capability: 'read',
    difficulty: 'guided',
    scenario: 'baseline',
    prompt:
      'The Throughput chart draws two lines. One counts every work item the team ' +
      'finished. The other counts only the items that were new work rather than ' +
      'corrections. What does the gap between the two lines represent?',
    options: [
      { id: 'rework', text: 'Work the team finished that produced nothing new' },
      { id: 'unstarted', text: 'Work the team planned but never started at all' },
      { id: 'capacity', text: 'Capacity the team held back and did not use' },
    ],
    correctOptionId: 'rework',
    explanation:
      'The gap is the rework tax: real work, really finished, that moved nothing ' +
      'forward. A velocity chart shows only the upper line, which is why a team can look ' +
      'busy and productive while the gap quietly widens underneath.',
    explanationCouplings: ['rework-consumes-capacity'],
    hints: [
      { tier: 1, text: 'Both lines count finished work. Only one of them counts new work.' },
      { tier: 2, text: 'If the two lines are apart, some finished work was not new.' },
      { tier: 3, text: 'Work that fixes earlier work still costs a sprint of somebody’s time.' },
      { tier: 4, text: 'The gap is corrective work: finished, and worth nothing new.' },
    ],
  },

  // =========================================================================
  // Variation -- taught BEFORE any causal claim is permitted
  // =========================================================================
  {
    id: 'variation-flat-run',
    conceptId: 'variation',
    type: 'prediction',
    capability: 'predict',
    difficulty: 'guided',
    scenario: 'steady-team',
    prompt:
      'Capacity variation is set to zero, so this team has exactly the same capacity in ' +
      'every sprint. Nothing else is changed. What will the throughput line do across ' +
      'the run?',
    options: [
      { id: 'flat', text: 'Settle to a flat line and stay there' },
      { id: 'moving', text: 'Keep moving up and down as before' },
      { id: 'rising', text: 'Climb steadily from the first sprint' },
    ],
    correctOptionId: 'flat',
    explanation:
      'With capacity identical every sprint, the run settles and stops moving. That ' +
      'movement was never a series of events — it was the variation the system already ' +
      'had. Turn it back on and the line moves again with nothing else altered.',
    explanationCouplings: [],
    hints: [
      { tier: 1, text: 'Look at what the Capacity variation control is currently set to.' },
      { tier: 2, text: 'If capacity is identical each sprint, what could make the line move?' },
      { tier: 3, text: 'The movement you saw earlier had a source. That source is now off.' },
      { tier: 4, text: 'Nothing is left to vary, so the run goes flat.' },
    ],
  },
  {
    id: 'variation-noise-floor-rule',
    conceptId: 'variation',
    type: 'explanation',
    capability: 'explain',
    difficulty: 'developing',
    scenario: 'baseline',
    prompt:
      'With nothing changed, this run’s throughput already moves by some amount from ' +
      'sprint to sprint. You then make a change, and throughput moves by less than that ' +
      'amount. What follows?',
    options: [
      {
        id: 'inside',
        text: 'The move sits inside the variation already there, so it is not evidence',
      },
      {
        id: 'steadier',
        text: 'The move is smaller than usual, so the change made the team steadier',
      },
      {
        id: 'worked',
        text: 'The move went the way you wanted, so the change did what you hoped',
      },
    ],
    correctOptionId: 'inside',
    explanation:
      'Measure the range the system produces on its own first. That range is the noise ' +
      'floor, and an effect smaller than it cannot be told apart from the run itself. ' +
      'This is the same rule the sandbox applies when it picks an experiment for you: ' +
      'it walks the control until the effect exceeds the variation already present.',
    explanationCouplings: [],
    hints: [
      { tier: 1, text: 'First look at how much the line moves when you change nothing.' },
      { tier: 2, text: 'Compare that amount against the movement your change produced.' },
      { tier: 3, text: 'If the two are the same size, which one caused what you saw?' },
      {
        tier: 4,
        text:
          'An effect you cannot separate from the variation already present is not an ' +
          'effect you can report.',
      },
    ],
  },

  // =========================================================================
  // Cycle time -- an output, not a control
  // =========================================================================
  {
    id: 'cycle-time-is-an-output',
    conceptId: 'cycle-time',
    type: 'reading',
    capability: 'read',
    difficulty: 'guided',
    scenario: 'baseline',
    prompt:
      'Cycle time is shown with a lock beside it and there is no slider for it anywhere ' +
      'in the scenario controls. What does that tell you about cycle time?',
    options: [
      { id: 'output', text: 'It is produced by the controls; nothing sets it directly' },
      { id: 'disabled', text: 'It is a control that has been switched off in this scenario' },
      { id: 'target', text: 'It is a target the team has committed to for this sprint' },
    ],
    correctOptionId: 'output',
    explanation:
      'Cycle time is an output. It is the elapsed time a work item is open, and it ' +
      'follows from the controls rather than being set by anyone. Asking a team to ' +
      '"reduce cycle time" without changing anything that produces it is asking for a ' +
      'number, not a change.',
    explanationCouplings: ['littles-law'],
    hints: [
      { tier: 1, text: 'Look at which readouts have sliders and which have locks.' },
      { tier: 2, text: 'Everything with a lock is computed from something else.' },
      { tier: 3, text: 'Hover the lock to see the formula that produces it.' },
      { tier: 4, text: 'It is derived, so the only way to move it is to move its inputs.' },
    ],
  },

  // =========================================================================
  // Little's Law -- the first relationship that cannot be wrong
  // =========================================================================
  {
    id: 'littles-law-prediction',
    conceptId: 'littles-law',
    type: 'prediction',
    capability: 'predict',
    difficulty: 'developing',
    scenario: 'wip-raised',
    prompt:
      'You double the WIP limit and leave capacity alone. Throughput stays where it ' +
      'was. What happens to cycle time?',
    options: [
      { id: 'doubles', text: 'It roughly doubles' },
      { id: 'halves', text: 'It roughly halves' },
      { id: 'unchanged', text: 'It stays where it was' },
    ],
    correctOptionId: 'doubles',
    explanation:
      'This is arithmetic, not a behavioural claim. Cycle time is WIP divided by ' +
      'throughput, times the sprint length. Double the numerator, hold the denominator, ' +
      'and the result doubles. It is labelled Arithmetic on the chart for exactly this ' +
      'reason: unlike an assumption, it cannot be wrong.',
    explanationCouplings: ['littles-law'],
    hints: [
      { tier: 1, text: 'Open the Cycle time card and read the relationship it lists.' },
      { tier: 2, text: 'Two of the three quantities are fixed here. Only one moved.' },
      { tier: 3, text: 'The relationship is a division. Which side of it did you change?' },
      { tier: 4, text: 'Doubling the top of a fraction and holding the bottom doubles it.' },
    ],
  },
  {
    id: 'littles-law-transfer',
    conceptId: 'littles-law',
    type: 'transfer',
    capability: 'predict',
    difficulty: 'developing',
    scenario: 'tight-capacity',
    transferOf: 'littles-law-prediction',
    prompt:
      'This is a different team: smaller capacity, longer sprints, and a WIP limit ' +
      'already close to what they finish. They raise the WIP limit again and capacity ' +
      'does not change. What happens to cycle time?',
    options: [
      { id: 'rises', text: 'It rises, in proportion to the increase' },
      { id: 'falls', text: 'It falls, in proportion to the increase' },
      { id: 'flat', text: 'It holds, because the team is already at its limit' },
    ],
    correctOptionId: 'rises',
    explanation:
      'Every number here is different and the relationship is identical, because it is ' +
      'arithmetic rather than a property of this particular team. That is what makes it ' +
      'transferable: you can apply it to a system you have never seen, which is exactly ' +
      'what an interview asks you to do.',
    explanationCouplings: ['littles-law'],
    hints: [
      { tier: 1, text: 'The numbers changed. Ask whether the relationship did.' },
      { tier: 2, text: 'Check whether anything about the division itself is different here.' },
      { tier: 3, text: 'Arithmetic does not depend on which team you point it at.' },
      { tier: 4, text: 'Same relationship, different numbers, same direction of result.' },
    ],
  },

  // =========================================================================
  // The counterfactual pair -- same symptom, different mechanism
  // =========================================================================
  {
    id: 'counterfactual-wip',
    conceptId: 'wip-cycle-time-mechanism',
    type: 'counterfactual',
    capability: 'explain',
    difficulty: 'intermediate',
    scenario: 'wip-raised',
    pairedWith: 'counterfactual-incidents',
    prompt:
      'Cycle time has risen in this scenario. Two mechanisms in this model can produce ' +
      'that. Which one produced it here?',
    options: [
      { id: 'wip', text: 'More work in progress, with throughput holding where it was' },
      { id: 'incidents', text: 'Incidents that consumed capacity in the following sprint' },
      { id: 'capacity', text: 'Capacity that was reduced directly by the scenario' },
    ],
    correctOptionId: 'wip',
    explanation:
      'Here the cause is arithmetic and immediate: WIP went up, throughput did not, and ' +
      'cycle time followed in the same sprint. Check the unplanned work chart — it has ' +
      'not moved, which rules out the incident path.',
    explanationCouplings: ['littles-law'],
    hints: [
      { tier: 1, text: 'Look at more than the cycle time chart. What else moved?' },
      { tier: 2, text: 'Compare the WIP chart and the unplanned work chart.' },
      { tier: 3, text: 'One mechanism arrives the same sprint. The other arrives late.' },
      { tier: 4, text: 'Only one control was touched here, and it was not a reliability one.' },
    ],
  },
  {
    id: 'counterfactual-incidents',
    conceptId: 'wip-cycle-time-mechanism',
    type: 'counterfactual',
    capability: 'explain',
    difficulty: 'intermediate',
    scenario: 'incident-pressure',
    pairedWith: 'counterfactual-wip',
    prompt:
      'Cycle time has risen in this scenario too, and the chart looks much the same. ' +
      'Which mechanism produced it here?',
    options: [
      { id: 'wip', text: 'More work in progress, with throughput holding where it was' },
      { id: 'incidents', text: 'Incidents that consumed capacity in the following sprint' },
      { id: 'capacity', text: 'Capacity that was reduced directly by the scenario' },
    ],
    correctOptionId: 'incidents',
    explanation:
      'Same symptom, different mechanism. The WIP limit never moved. Incidents consumed ' +
      'capacity, which arrived as unplanned work a sprint LATER, which reduced what the ' +
      'team could finish — and cycle time followed. This one is a model assumption, not ' +
      'arithmetic, and it is lagged. If you can only tell these two apart by the cycle ' +
      'time chart, you cannot tell them apart at all.',
    explanationCouplings: ['incident-to-capacity'],
    hints: [
      { tier: 1, text: 'Check whether the WIP control is where it started.' },
      { tier: 2, text: 'Look at the unplanned work chart and note which sprint it rises in.' },
      { tier: 3, text: 'One mechanism here is lagged. Find the sprint the cost lands in.' },
      { tier: 4, text: 'Nothing about work in progress changed, so it cannot be that path.' },
    ],
  },
  // =========================================================================
  // CUMULATIVE FLOW: Recognize -> Read -> Relate -> Diagnose -> Counterfactual
  //
  // No prompt below names a state or a count. The workflow is configuration:
  // add a fourth state and none of this needs editing, which integrity.test.ts
  // asserts.
  //
  // Diagnose and Counterfactual exist ONLY because the model was extended to
  // carry per-state occupancy. On the Rev 8 aggregate CFD the middle band was
  // the WIP control drawn as a shape -- constant by construction -- and these
  // two would have been fiction dressed as simulation. A test asserts their
  // scenarios really do produce accumulation.
  // =========================================================================
  {
    id: 'cfd-recognize-states',
    conceptId: 'workflow-states',
    type: 'recognition',
    capability: 'recognize',
    difficulty: 'guided',
    scenario: 'baseline',
    prompt:
      'Open the Cumulative flow chart and read its legend. Apart from the not-started ' +
      'and the finished bands, what do the bands in between represent?',
    options: [
      { id: 'states', text: 'The workflow states an item passes through' },
      { id: 'sprints', text: 'The sprints the team has run so far' },
      { id: 'people', text: 'The people currently assigned to the work' },
    ],
    correctOptionId: 'states',
    explanation:
      'The legend is read from the workflow this simulated team uses, in the order work ' +
      'moves through it. Every other chart here reports one number for the whole ' +
      'system; this is the only one that shows the parts separately.',
    explanationCouplings: ['wip-across-states'],
    hints: [
      { tier: 1, text: 'Read the legend, not the shape.' },
      { tier: 2, text: 'The names are stages, and they are listed in order.' },
      { tier: 3, text: 'An item enters at the top band and leaves at the bottom one.' },
      { tier: 4, text: 'Each band in between is one stage of the work.' },
    ],
  },
  {
    id: 'cfd-read-thickness',
    conceptId: 'cfd-reading',
    type: 'reading',
    capability: 'read',
    difficulty: 'guided',
    scenario: 'baseline',
    prompt:
      'Measure one of the middle bands vertically at a single day on the Cumulative ' +
      'flow chart. What does that height tell you?',
    options: [
      { id: 'inState', text: 'How much work is sitting in that state on that day' },
      { id: 'finished', text: 'How much work that state finished on that day' },
      { id: 'capacity', text: 'The spare room that state has on that day' },
    ],
    correctOptionId: 'inState',
    explanation:
      'Height is occupancy, not rate. A thick band means a lot of work is sitting there ' +
      'right now, which says nothing on its own about how fast that state is working — ' +
      'that is the horizontal direction, not the vertical one.',
    explanationCouplings: ['wip-across-states'],
    hints: [
      { tier: 1, text: 'You are measuring vertically, at one moment.' },
      { tier: 2, text: 'A band has no time in it, so it cannot be a rate.' },
      { tier: 3, text: 'Ask what is inside that state at that instant.' },
      { tier: 4, text: 'It is the amount of work currently in that stage.' },
    ],
  },
  {
    id: 'cfd-relate-to-wip',
    conceptId: 'cfd-reading',
    type: 'prediction',
    capability: 'predict',
    difficulty: 'developing',
    scenario: 'upstream-wip-raised',
    prompt:
      'The team raises its WIP limit, and the workflow itself is unchanged — no state ' +
      'is slower than any other. What happens to the middle bands taken together?',
    options: [
      { id: 'allGrow', text: 'Every band grows, and their total grows with them' },
      { id: 'oneGrows', text: 'One band grows while the others shrink to match' },
      { id: 'noChange', text: 'Their total holds, because the workflow is unchanged' },
    ],
    correctOptionId: 'allGrow',
    explanation:
      'The middle bands add up to work in progress, so raising the WIP limit lifts all ' +
      'of them together. That is the shape to hold on to: more work in progress moves ' +
      'the TOTAL, and a slow state moves the SHARE. They look alike and they are not ' +
      'the same thing.',
    explanationCouplings: ['wip-across-states'],
    hints: [
      { tier: 1, text: 'Add the middle bands up. What have you just measured?' },
      { tier: 2, text: 'Compare that total against the WIP limit you changed.' },
      { tier: 3, text: 'Nothing about the workflow itself was touched here.' },
      { tier: 4, text: 'The total is work in progress, and you just raised it.' },
    ],
  },
  {
    id: 'cfd-diagnose-constraint',
    conceptId: 'bottleneck',
    type: 'diagnosis',
    capability: 'diagnose',
    difficulty: 'intermediate',
    scenario: 'constrained-state',
    prompt:
      'One band on this Cumulative flow chart grows steadily across the run while the ' +
      'others get thinner, and their total is unchanged. What does that tell you?',
    options: [
      {
        id: 'constrained',
        text: 'That state is the constraint: work arrives faster than it leaves',
      },
      { id: 'moreWork', text: 'The team started more work than it had started before' },
      { id: 'faster', text: 'That state is working faster than the ones around it' },
    ],
    correctOptionId: 'constrained',
    explanation:
      'Work arrives at that state faster than it leaves, so it accumulates there and ' +
      'drains from everywhere else. The total is unchanged, which rules out simply ' +
      'having started more. Effort spent on any other state changes nothing — this is ' +
      'the one that sets the pace.',
    explanationCouplings: ['wip-across-states'],
    hints: [
      { tier: 1, text: 'Compare the bands against each other across the whole run.' },
      { tier: 2, text: 'One is growing. Check whether their total grew too.' },
      { tier: 3, text: 'If the total held, the work moved rather than multiplied.' },
      { tier: 4, text: 'Work is piling up in one stage because it cannot leave fast enough.' },
    ],
  },
  {
    id: 'cfd-counterfactual-constraint',
    conceptId: 'bottleneck',
    type: 'counterfactual',
    capability: 'explain',
    difficulty: 'intermediate',
    scenario: 'constrained-state',
    pairedWith: 'cfd-counterfactual-upstream',
    prompt:
      'The bands on this Cumulative flow chart have changed shape. Two different things ' +
      'can do that. Which one happened here?',
    options: [
      { id: 'constraint', text: 'One state slowed down, so work accumulated in it' },
      { id: 'upstream', text: 'More work was started, so every band grew together' },
      { id: 'capacity', text: 'The team lost capacity, so less work finished overall' },
    ],
    correctOptionId: 'constraint',
    explanation:
      'The give-away is the total. Here the middle bands add up to the same work in ' +
      'progress as before — one band took share from the others. Nothing was started ' +
      'that was not being started already.',
    explanationCouplings: ['wip-across-states'],
    hints: [
      { tier: 1, text: 'Do not read one band. Read all of them together.' },
      { tier: 2, text: 'Add the middle bands up and compare against the baseline.' },
      { tier: 3, text: 'One cause moves the total; the other only moves the share.' },
      { tier: 4, text: 'The total held, so the work was redistributed rather than added.' },
    ],
  },
  {
    id: 'cfd-counterfactual-upstream',
    conceptId: 'bottleneck',
    type: 'counterfactual',
    capability: 'explain',
    difficulty: 'intermediate',
    scenario: 'upstream-wip-raised',
    pairedWith: 'cfd-counterfactual-constraint',
    prompt:
      'The bands here have changed shape too, and at a glance it looks much the same. ' +
      'Which one happened in this scenario?',
    options: [
      { id: 'constraint', text: 'One state slowed down, so work accumulated in it' },
      { id: 'upstream', text: 'More work was started, so every band grew together' },
      { id: 'capacity', text: 'The team lost capacity, so less work finished overall' },
    ],
    correctOptionId: 'upstream',
    explanation:
      'Same direction, different cause. Every band grew and their total grew with them, ' +
      'because the WIP limit went up and no state is slower than any other. If you can ' +
      'only tell these two apart by whether a band got thicker, you cannot tell them ' +
      'apart at all — the total is what separates them.',
    explanationCouplings: ['wip-across-states'],
    hints: [
      { tier: 1, text: 'Do not read one band. Read all of them together.' },
      { tier: 2, text: 'Add the middle bands up and compare against the baseline.' },
      { tier: 3, text: 'One cause moves the total; the other only moves the share.' },
      { tier: 4, text: 'The total went up, so more work was started.' },
    ],
  },
];

export const CHALLENGE_BY_ID = new Map<ChallengeId, Challenge>(
  CHALLENGES.map((c) => [c.id, c]),
);

export function challengesForConcept(conceptId: ConceptId): Challenge[] {
  return CHALLENGES.filter((c) => c.conceptId === conceptId);
}

/** Both halves of every counterfactual pair, deduplicated. */
export function counterfactualPairs(): [Challenge, Challenge][] {
  const pairs: [Challenge, Challenge][] = [];
  const seen = new Set<ChallengeId>();
  for (const c of CHALLENGES) {
    if (!c.pairedWith || seen.has(c.id)) continue;
    const partner = CHALLENGE_BY_ID.get(c.pairedWith);
    if (!partner) continue;
    seen.add(c.id);
    seen.add(partner.id);
    pairs.push([c, partner]);
  }
  return pairs;
}
