// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, expect, it } from 'vitest';
import { FACTORY_COUPLINGS } from './factoryCouplings';
import { STATION_A_COUPLINGS, STATION_B_COUPLINGS } from './pipelineCouplings';

// The compositions are frozen, as Station F's and the Agile Metrics sandbox's are: adding an
// effect without deciding whether it is arithmetic, an assumption or a convention fails here,
// so it can't slide in as arithmetic by default.

const count = (list: typeof STATION_A_COUPLINGS, type: string) => list.filter((c) => c.type === type).length;

describe.each([
  ['Station A', STATION_A_COUPLINGS, { arithmetic: 3, assumption: 8, convention: 4 }],
  ['Station B', STATION_B_COUPLINGS, { arithmetic: 3, assumption: 8, convention: 2 }],
] as const)('%s coupling ledger', (_name, ledger, composition) => {
  it('has the frozen composition', () => {
    expect(count([...ledger], 'arithmetic')).toBe(composition.arithmetic);
    expect(count([...ledger], 'assumption')).toBe(composition.assumption);
    expect(count([...ledger], 'convention')).toBe(composition.convention);
    expect(ledger).toHaveLength(composition.arithmetic + composition.assumption + composition.convention);
  });

  it('has unique ids', () => {
    expect(new Set(ledger.map((c) => c.id)).size).toBe(ledger.length);
  });

  it('carries the kind in the caveat the learner reads', () => {
    for (const c of ledger) {
      if (c.type === 'assumption') expect(c.uiLabel, c.id).toMatch(/^Model assumption:/);
      if (c.type === 'convention') expect(c.uiLabel, c.id).toMatch(/^Sandbox counting convention:/);
      if (c.type === 'arithmetic') expect(c.uiLabel, c.id).not.toMatch(/^(Model assumption|Sandbox counting convention):/);
    }
  });

  it('writes every effect as a chain, and says something other than its caveat', () => {
    for (const c of ledger) {
      expect(c.effect, c.id).toMatch(/->/);
      expect(c.effect.length, c.id).toBeGreaterThan(20);
      expect(c.effect, c.id).not.toBe(c.uiLabel);
    }
  });
});

describe('the three station ledgers together', () => {
  it('never share an id, so a finding can only rest on one entry', () => {
    const ids = [...FACTORY_COUPLINGS, ...STATION_A_COUPLINGS, ...STATION_B_COUPLINGS].map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keep teaching constants out of conventions, and never present one as a price', () => {
    expect(STATION_B_COUPLINGS.find((c) => c.id === 'tier-rates')!.uiLabel).toMatch(/teaching constants, never quoted prices/);
    expect(STATION_B_COUPLINGS.find((c) => c.id === 'relative-index')!.uiLabel).toMatch(/not prices/);
  });
});
