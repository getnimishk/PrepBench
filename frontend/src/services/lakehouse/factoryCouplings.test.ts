// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, expect, it } from 'vitest';
import { FACTORY_COUPLINGS, FACTORY_COUPLING_BY_ID } from './factoryCouplings';

// The composition is frozen. Adding an effect to the Factory without deciding
// whether it is arithmetic, an assumption or a convention fails here, so it
// can't slide in as arithmetic by default (the same guard the Agile Metrics
// ledger has).

const count = (type: string) => FACTORY_COUPLINGS.filter((c) => c.type === type).length;

describe('the Factory coupling ledger', () => {
  it('has the frozen composition: 4 arithmetic, 10 assumptions, 3 conventions', () => {
    expect(count('arithmetic')).toBe(4);
    expect(count('assumption')).toBe(10);
    expect(count('convention')).toBe(3);
    expect(FACTORY_COUPLINGS).toHaveLength(17);
  });

  it('has unique ids', () => {
    expect(FACTORY_COUPLING_BY_ID.size).toBe(FACTORY_COUPLINGS.length);
  });

  it('carries the kind in the caveat the learner reads', () => {
    for (const c of FACTORY_COUPLINGS) {
      if (c.type === 'assumption') expect(c.uiLabel, c.id).toMatch(/^Model assumption:/);
      if (c.type === 'convention') expect(c.uiLabel, c.id).toMatch(/^Sandbox counting convention:/);
      if (c.type === 'arithmetic') expect(c.uiLabel, c.id).not.toMatch(/^(Model assumption|Sandbox counting convention):/);
    }
  });

  it('writes every effect as a chain, and says something other than its caveat', () => {
    for (const c of FACTORY_COUPLINGS) {
      expect(c.effect, c.id).toMatch(/->/);
      expect(c.effect.length, c.id).toBeGreaterThan(20);
      expect(c.effect, c.id).not.toBe(c.uiLabel);
    }
  });

  it('never presents a teaching constant as a measured figure', () => {
    for (const c of FACTORY_COUPLINGS.filter((x) => x.constant)) {
      expect(c.type, `${c.id} uses a constant, so it's arithmetic on one or an assumption about one`).not.toBe('convention');
    }
    expect(FACTORY_COUPLING_BY_ID.get('cost-ratio')!.uiLabel).toMatch(/teaching constant, never a quoted price ratio/);
  });
});
