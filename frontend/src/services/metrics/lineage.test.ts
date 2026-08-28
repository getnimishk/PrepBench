// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, it, expect } from 'vitest';
import type { Provenance } from '../../types/agileMetrics';
import { CHART_VIEWS } from './charts';
import { lineageFor, traditionFor } from './lineage';

// The caption guard.
//
// A UI review proposed labelling every card "Jira: <report>". Applied, that
// would have called Throughput "Jira: Velocity Chart" -- a different chart in
// a different family -- and Cycle time "Jira: Control Chart", when only the
// cycle-time DISTRIBUTION carries that analogue. Both are the false
// equivalence `externalAnalogues` exists to prevent, and neither is visible
// by reading the component: hand-authored copy has nothing to drift from.
//
// So the caption is derived, and this file asserts the derivation cannot
// reintroduce those two claims by accident.

const ALL_PROVENANCES: Provenance[] = [
  'jira',
  'jira-align',
  'kanban-flow',
  'lean-flow',
  'qa',
  'scrum-practice',
  'devops-literature',
  'dora',
  'ops-tooling',
  'sre',
  'ours',
];

describe('lineage captions', () => {
  it('describes every provenance the type allows', () => {
    // A tradition added to the union without a description would render a raw
    // enum -- "kanban-flow" -- at a learner.
    for (const p of ALL_PROVENANCES) {
      const t = traditionFor(p);
      expect(t, p).toBeDefined();
      expect(t.name.length, p).toBeGreaterThan(0);
      expect(t.note.length, p).toBeGreaterThan(20);
    }
  });

  it('says what KIND of claim naming a tradition makes', () => {
    // "DORA defines this" and "Jira draws this" are not the same weight of
    // statement, and flattening them is how a tool convention gets quoted in
    // an interview as an industry definition.
    expect(traditionFor('dora').prefix).toBe('Standard');
    expect(traditionFor('sre').prefix).toBe('Practice');
    expect(traditionFor('lean-flow').prefix).toBe('Practice');
    expect(traditionFor('jira').prefix).toBe('Tool');
    expect(traditionFor('ops-tooling').prefix).toBe('Tool');
    // The one view with no lineage at all reads as itself, not as a gap.
    expect(traditionFor('ours').prefix).toBe('');
    expect(traditionFor('ours').name).toBe('Sandbox view');
  });

  it('never labels a view with a tool report it does not have', () => {
    // The two specific regressions. Throughput is not Jira's Velocity Chart,
    // and Cycle time is not the Control Chart -- the distribution is.
    const throughput = lineageFor(CHART_VIEWS.find((v) => v.id === 'throughput')!);
    expect(throughput.analogues).toBe('External analogue: Throughput Run Chart');
    expect(throughput.analogues).not.toMatch(/Velocity/);
    expect(throughput.label).toBe('Practice: Kanban flow');

    const cycleTime = lineageFor(CHART_VIEWS.find((v) => v.id === 'cycleTime')!);
    expect(cycleTime.analogues).not.toMatch(/Control Chart/);

    const distribution = lineageFor(CHART_VIEWS.find((v) => v.id === 'cycleTimeDistribution')!);
    expect(distribution.analogues).toMatch(/Jira Control Chart/);
  });

  it('carries the analogue caveat wherever an analogue is named', () => {
    // The word ANALOGUE is doing the work, and it is in the label rather than
    // only in the hover on purpose: "Similar to: Jira Control Chart" is still
    // readable as "this is basically the Jira chart", and a hover the reader
    // never opens cannot correct that. Analogue names the relationship.
    for (const view of CHART_VIEWS) {
      const lineage = lineageFor(view);
      if (lineage.analogues === null) continue;
      expect(lineage.analogues, view.id).toMatch(/^External analogues?: /);
      expect(lineage.analoguesNote, view.id).toMatch(/not equivalents/i);
    }
  });

  it('never presents an absent analogue as a missing feature', () => {
    // "Jira: N/A" would frame Jira as the reference standard everything else
    // is measured against, and flow efficiency as a gap rather than a Lean
    // measure that predates the tool.
    for (const view of CHART_VIEWS) {
      const lineage = lineageFor(view);
      expect(lineage.label, view.id).not.toMatch(/N\/A/);
      expect(lineage.analogues ?? '', view.id).not.toMatch(/N\/A/);
      // ...and no caption is Jira-shaped unless the view's provenance is Jira.
      if (view.provenance !== 'jira' && view.provenance !== 'jira-align') {
        expect(lineage.label, view.id).not.toMatch(/^Tool: Jira/);
      }
    }
  });

  it('keeps the multi-lineage taxonomy visible rather than collapsing to one tool', () => {
    // Six or more distinct captions across 27 views. Collapsing them to
    // "Jira / not Jira" is the failure this guards.
    const labels = new Set(CHART_VIEWS.map((v) => lineageFor(v).label));
    expect(labels.size).toBeGreaterThanOrEqual(6);
  });
});
