// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { ChartViewMeta, Provenance } from '../../types/agileMetrics';

// Where a chart's lineage caption comes from.
//
// This module exists because the UI is not allowed to author a lineage. A
// mockup review proposed labelling every card "Jira: <something>" -- which
// would have called Throughput "Jira: Velocity Chart" (a different chart in a
// different family) and Cycle time "Jira: Control Chart" (only the cycle-time
// DISTRIBUTION carries that analogue). Both are exactly the false equivalence
// `externalAnalogues` was written to prevent, and neither is detectable by
// reading the component: hand-authored copy has no source of truth to drift
// from.
//
// So the caption is derived. Two separate facts, never merged:
//
//   TRADITION   `provenance` -- where the metric CONCEPT came from. Prefixed
//               by the kind of claim it is, because "DORA defines this" and
//               "Kanban practice does this" are not the same weight of
//               statement, and "Jira draws this" is weaker than both.
//   ANALOGUES   `externalAnalogues` -- reports that RESEMBLE this view. Never
//               "also known as": our cycle-time distribution is not Jira's
//               Control Chart, which plots a rolling average.
//
// A Jira-shaped caption on all 27 would also quietly reframe Jira as the
// reference standard everything else is measured against -- so a view with no
// Jira analogue reads as "N/A", as though flow efficiency were a missing
// feature rather than a Lean measure that predates the tool.

interface Tradition {
  /** What kind of claim naming this tradition makes. */
  prefix: string;
  name: string;
  /** Read on hover. Says what the tradition is and what it is not. */
  note: string;
}

/**
 * Every provenance the inventory can carry. Exhaustive by type, so adding a
 * tradition to `Provenance` without deciding how it is described fails the
 * build rather than rendering a raw enum at a learner.
 */
const TRADITIONS: Record<Provenance, Tradition> = {
  dora: {
    prefix: 'Standard',
    name: 'DORA',
    note:
      'One of the five metrics defined by the DORA research programme. The ' +
      'definition is external to this sandbox; only the numbers are modelled.',
  },
  sre: {
    prefix: 'Practice',
    name: 'Site reliability engineering',
    note:
      'An SRE measure. SLOs and error budgets come from that practice, not ' +
      'from any agile framework.',
  },
  'lean-flow': {
    prefix: 'Practice',
    name: 'Lean flow',
    note:
      'A Lean measure of how work moves. It predates the tools that draw it, ' +
      'and most issue trackers do not report it at all.',
  },
  'kanban-flow': {
    prefix: 'Practice',
    name: 'Kanban flow',
    note:
      'A Kanban flow measure. Read from the board itself rather than from a ' +
      'sprint commitment.',
  },
  'scrum-practice': {
    prefix: 'Practice',
    name: 'Scrum',
    note: 'A Scrum artefact. Defined by the framework, not by any tool.',
  },
  qa: {
    prefix: 'Practice',
    name: 'Software QA',
    note:
      'A quality-engineering measure. Definitions vary between organisations ' +
      'far more than the flow measures do.',
  },
  'devops-literature': {
    prefix: 'Literature',
    name: 'DevOps',
    note:
      'Described in the DevOps literature rather than standardised. Expect ' +
      'the definition to differ between sources.',
  },
  jira: {
    prefix: 'Tool',
    name: 'Jira',
    note:
      'Jira ships a report of this shape. That makes it a tool convention, ' +
      'not an industry definition — another tracker may compute it differently.',
  },
  'jira-align': {
    prefix: 'Tool',
    name: 'Jira Align',
    note:
      'A portfolio-level report from Jira Align. A tool convention rather ' +
      'than an industry definition.',
  },
  'ops-tooling': {
    prefix: 'Tool',
    name: 'Operations tooling',
    note:
      'Comes from incident and deployment tooling rather than from a ' +
      'framework or a standard.',
  },
  ours: {
    prefix: '',
    name: 'Sandbox view',
    note:
      'No standard chart exists for this. It is drawn here because the ' +
      'concept matters, not because a tool reports it.',
  },
};

export interface Lineage {
  /** "Standard: DORA", "Practice: Lean flow", "Sandbox view". */
  label: string;
  /** Hover text for the label. */
  labelNote: string;
  /**
   * "External analogue: Cycle Time Run Chart", or null when nothing
   * resembles it. Never rendered as "N/A" — an absent analogue is a fact
   * about the tools, not a gap in the view.
   *
   * "External analogue" rather than "Similar to" because the softer phrasing
   * is still readable as "this is basically the Jira chart". The word
   * ANALOGUE carries the disclaimer in the label itself, where the hover
   * text cannot be skipped past.
   */
  analogues: string | null;
  /** Hover text for the analogues line. */
  analoguesNote: string;
}

export function traditionFor(provenance: Provenance): Tradition {
  return TRADITIONS[provenance];
}

export function lineageFor(view: ChartViewMeta): Lineage {
  const tradition = TRADITIONS[view.provenance];
  const label = tradition.prefix ? `${tradition.prefix}: ${tradition.name}` : tradition.name;

  return {
    label,
    labelNote: tradition.note,
    analogues:
      view.externalAnalogues.length > 0
        ? `${view.externalAnalogues.length === 1 ? 'External analogue' : 'External analogues'}: ${view.externalAnalogues.join(' · ')}`
        : null,
    analoguesNote:
      view.externalAnalogues.length > 0
        ? 'Analogues, not equivalents. These reports resemble this view; they do not ' +
          'compute the same thing.'
        : 'No standard chart exists for this.',
  };
}
