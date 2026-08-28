// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { ChartViewId } from '../../types/agileMetrics';

// What to do about a chart, one chart at a time.
//
// This file exists because of a specific failure. The callouts under every
// flow chart are generated from the coupling ledger, and most of the flow
// family declares the same edge -- so six cards in a row explained themselves
// with "incidents cost capacity next sprint". The content was correct and the
// EFFECT was that the product looked like it had one explanation template
// glued to twenty-seven pictures.
//
// The ledger cannot fix that on its own: it records how the MODEL is wired,
// and a chart's reasoning is a different question from its dependencies. So
// each view gets its own two answers:
//
//   dependsOn  the real-world factors that move this number. Not the model's
//              couplings -- the things a team would actually go and look at.
//              Deliberately includes factors this sandbox does not simulate
//              (blocked time, handoffs, review queues), because a learner who
//              leaves thinking cycle time has four inputs has learned the
//              model rather than the subject.
//
//   action     the conditional. "If X while Y, inspect Z." A chart that tells
//              you what happened and not what to do with it is a report; the
//              conditional is what makes it an instrument.
//
// Keyed by an exhaustive Record, so a view added to the inventory without its
// own reasoning fails the build instead of silently inheriting a neighbour's.

export interface Guidance {
  /** The factors that move this number, in the world rather than in the model. */
  dependsOn: string[];
  /** One conditional: if this pattern, inspect that. */
  action: string;
}

export const GUIDANCE: Record<ChartViewId, Guidance> = {
  // ------------------------------- FLOW ----------------------------------
  throughput: {
    dependsOn: ['arrival rate', 'capacity', 'WIP', 'interruptions', 'rework'],
    action:
      'If arrivals exceed completions for several sprints running, look at WIP ' +
      'accumulation before asking for more capacity.',
  },
  cycleTime: {
    dependsOn: ['WIP', 'queue time', 'blocked time', 'work item size'],
    action:
      'If this rises while throughput stays flat, the extra time is queue. ' +
      'Inspect what work is waiting on, not how fast people are working.',
  },
  cycleTimeDistribution: {
    dependsOn: ['work item size variation', 'blocked time', 'expedite requests'],
    action:
      'Quote the 85th percentile, never the average. If the tail is stretching ' +
      'while the median holds, a subset of work is getting stuck.',
  },
  deliveryLeadTime: {
    dependsOn: ['backlog wait', 'prioritisation cadence', 'cycle time'],
    action:
      'If lead time grows while cycle time is flat, the delay is upstream of the ' +
      'team. Look at how long requests sit before anyone starts them.',
  },
  flowEfficiency: {
    dependsOn: ['waiting states', 'blocked time', 'handoffs', 'review queues'],
    action:
      'If this falls while cycle time rises, investigate waiting rather than ' +
      'adding capacity. More people will not shorten a queue you have not found.',
  },
  cumulativeFlow: {
    dependsOn: ['arrival rate', 'departure rate', 'WIP per state'],
    action:
      'Find the band that is thickening. That state is the constraint, and it is ' +
      'the only place adding effort changes the outcome.',
  },
  agingWip: {
    dependsOn: ['blocked time', 'work item size', 'WIP', 'priority changes'],
    action:
      'Work the oldest item first, not the newest. Anything past the 85th ' +
      'percentile is already behind what you would have forecast for it.',
  },
  wipOverTime: {
    dependsOn: ['the WIP limit you set', 'work-splitting policy'],
    action:
      'Nothing downstream of this chart can be fixed without changing this ' +
      'number or the capacity it is measured against.',
  },

  // ---------------------------- PREDICTABILITY ----------------------------
  burndown: {
    dependsOn: ['batch size', 'scope changes', 'unplanned work'],
    action:
      'A flat line then a cliff is a batching problem, not an effort problem. ' +
      'Split work smaller before assuming the team started late.',
  },
  burnup: {
    dependsOn: ['scope changes', 'completion rate'],
    action:
      'If the scope line is climbing, stop reading the completion line as a ' +
      'performance signal. Fix the intake before discussing velocity.',
  },
  velocity: {
    dependsOn: ['estimation practice', 'capacity', 'unplanned work', 'item sizing'],
    action:
      'Use the range across sprints for forecasting, never the single latest ' +
      'number. Comparing it between teams measures their estimation habits.',
  },
  sayDoRatio: {
    dependsOn: ['commitment practice', 'unplanned work', 'forecast accuracy'],
    action:
      'A sustained 100% means under-commitment. If it swings sprint to sprint, ' +
      'fix intake variability before asking anyone to commit harder.',
  },
  sprintGoal: {
    dependsOn: ['goal definition', 'scope discipline', 'unplanned work'],
    action:
      'Read this against the say/do ratio. Missing the goal while hitting the ' +
      'ratio means the goal was made of the wrong items.',
  },

  // -------------------------------- QUALITY --------------------------------
  defectRate: {
    dependsOn: ['WIP', 'review depth', 'test coverage', 'domain complexity'],
    action:
      'If this rises with WIP, the cheapest fix is less concurrent work, not ' +
      'more testing at the end.',
  },
  escapedDefects: {
    dependsOn: ['test coverage', 'review depth', 'release batch size'],
    action:
      'The only quality number a user experiences. If it rises while the defect ' +
      'rate holds, the problem is detection, not injection.',
  },
  defectDensity: {
    dependsOn: ['work item size', 'estimation practice', 'defect rate'],
    action:
      'Compare against the defect rate. If they separate, item sizing changed -- ' +
      'which quietly changes what every other per-item metric means.',
  },

  // ------------------------------ TEAM HEALTH ------------------------------
  teamHappiness: {
    dependsOn: ['sustained overload', 'unplanned work', 'WIP above capacity'],
    action:
      'This turns before the delivery charts do. If it is falling while ' +
      'throughput holds, the delivery is being paid for out of the team.',
  },
  unplannedWorkShare: {
    dependsOn: ['incident load', 'interruptions', 'support rota'],
    action:
      'Read the sprint AFTER a bad one. If this is high, the sprint that missed ' +
      'was paying for the sprint before it.',
  },

  // --------------------------------- DORA ---------------------------------
  deploymentFrequency: {
    dependsOn: ['batch size', 'pipeline automation', 'release approval process'],
    action:
      'Check the rework rate alongside it. Frequency rising because things keep ' +
      'breaking is not the improvement it looks like.',
  },
  changeLeadTime: {
    dependsOn: ['batch size', 'release cadence', 'cycle time', 'approval waits'],
    action:
      'The gap above cycle time is batch wait. Shrink the batch before asking ' +
      'anyone to work faster.',
  },
  changeFailRate: {
    dependsOn: ['batch size', 'test coverage', 'deployment automation'],
    action:
      'This counts interventions, not outages. Pair it with the reliability ' +
      'family before concluding anything about user impact.',
  },
  failedDeploymentRecoveryTime: {
    dependsOn: ['deployment automation', 'rollback capability', 'on-call readiness'],
    action:
      'Scoped to recovery from a DEPLOYMENT. If incidents last longer than this, ' +
      'the gap is detection and diagnosis, not the deploy pipeline.',
  },
  deploymentReworkRate: {
    dependsOn: ['change fail rate', 'escaped defects', 'incident load'],
    action:
      'A rising share means capacity is going to corrective work. Compare it ' +
      'with throughput before celebrating a deployment frequency increase.',
  },

  // ------------------------------ RELIABILITY ------------------------------
  incidentsPerSprint: {
    dependsOn: ['change fail rate', 'external dependencies', 'infrastructure'],
    action:
      'Split the two sources before acting. Driving your own change failures to ' +
      'zero still leaves the external band untouched.',
  },
  incidentDuration: {
    dependsOn: ['detection time', 'diagnosis time', 'rollback capability'],
    action:
      'If total downtime rises while per-incident duration holds, you have more ' +
      'incidents, not slower recovery. They need opposite fixes.',
  },
  availabilityVsSlo: {
    dependsOn: ['incident count', 'incident duration', 'the SLO you chose'],
    action:
      'Being far above the line is not free. A team that never spends its error ' +
      'budget is usually shipping too slowly.',
  },
  errorBudgetBurn: {
    dependsOn: ['availability', 'the SLO you chose', 'incident load'],
    action:
      'Above 1, the next conversation is about slowing down. Below 0.5 for a ' +
      'quarter, it is about whether the SLO is set too loose to mean anything.',
  },
};

export function guidanceFor(viewId: ChartViewId): Guidance {
  return GUIDANCE[viewId];
}
