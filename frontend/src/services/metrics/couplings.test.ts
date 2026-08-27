import { describe, it, expect } from 'vitest';
import { COUPLINGS, COUPLING_BY_ID } from './couplings';
import { chartsConsuming } from './charts';

// The label guard on the ledger.
//
// `uiLabel` and `effect` answer different questions, and usability testing
// found the page answering only the first. `uiLabel` states the modelling
// claim -- "incidents cost capacity in the following sprint" -- which is
// honest and reads as timing mechanics. `effect` states what the edge DID, as
// the chain it actually travels.
//
// The distinction is not cosmetic. A reader who meets the same single-clause
// caveat under cycle time, throughput and flow efficiency concludes that
// incidents cause cycle time directly. They do not: they cost capacity next
// sprint, which reduces delivery, which moves everything downstream. The
// arrows are what stop three hops collapsing into one false cause.
//
// The composition of the ledger itself -- 8 arithmetic, 10 assumptions, 1
// convention, 4 lagged -- is asserted in invariants.test.ts. This file is
// only about what reaches the learner.

describe('coupling labels', () => {
  it('says what every edge did, not only what it assumes', () => {
    for (const c of COUPLINGS) {
      expect(c.effect.length, `${c.id} has no effect`).toBeGreaterThan(20);
      expect(c.effect, `${c.id} restates its uiLabel`).not.toBe(c.uiLabel);
      // The effect is the learner-facing half, so it must not open by
      // announcing its own category -- that is the caveat line's job, and
      // printing it twice is what made the original card read as mechanics.
      expect(c.effect, c.id).not.toMatch(/^(Model assumption|Sandbox counting convention)/);
    }
  });

  it('writes every edge as a chain rather than a claim', () => {
    for (const c of COUPLINGS) {
      expect(c.effect, `${c.id} states no chain`).toMatch(/->/);
    }
  });

  it('spells out the indirection on the edge that reaches the most charts', () => {
    // This one caveat appears on most of the flow family. Written as a single
    // hop it is the likeliest source of a wrong causal story in the whole UI,
    // so it names the intermediate steps and says outright that the effect is
    // indirect.
    const c = COUPLING_BY_ID.get('incident-to-capacity')!;
    expect(chartsConsuming('incident-to-capacity').length).toBeGreaterThan(3);
    expect(c.effect.split('->').length - 1, 'not enough hops to read as a chain')
      .toBeGreaterThanOrEqual(3);
    expect(c.effect).toMatch(/indirect/i);
  });

  it('keeps the typed caveat on every assumption and convention', () => {
    // Unchanged contract: `effect` explains, `uiLabel` still carries the
    // category. Adding the first must not quietly retire the second.
    for (const c of COUPLINGS) {
      if (c.type === 'assumption') expect(c.uiLabel, c.id).toMatch(/^Model assumption:/);
      if (c.type === 'convention') expect(c.uiLabel, c.id).toMatch(/^Sandbox counting convention:/);
      if (c.type === 'arithmetic') expect(c.uiLabel, c.id).not.toMatch(/^Model assumption:/);
    }
  });
});
