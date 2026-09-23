// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, expect, it } from 'vitest';
import type { ReadinessRules } from '../types/subject';
import { blockerSentence, plateauSentence, readySentence } from './readinessText';

// The verdict's sentences quote the rule. With the rule the server sent they say
// whatever it is; without it they read as they always have.

const RULES: ReadinessRules = {
  min_mocks_for_ready: 3, consecutive_mocks_at_pass: 3, domain_floor_pct: 80,
  recency_days: 14, plateau_min_mocks: 4, plateau_max_spread: 3, min_questions_per_domain: 10,
};

describe('the verdict in words', () => {
  it('reads the same as ever with today\'s rule, sent or not', () => {
    const below = { kind: 'below_pass' as const, value: 82, target: 85, count: 1 };
    const expected = 'One of your last three mocks came in at 82%, under the 85% pass mark. Ready is three in a row at or above it.';
    expect(blockerSentence(below)).toBe(expected);
    expect(blockerSentence(below, RULES)).toBe(expected);
    expect(readySentence(85, RULES)).toMatch(/^Three consecutive mocks at or above 85%/);
    expect(plateauSentence([84, 85, 84, 85], RULES)).toMatch(/no movement across four mocks/);
  });

  it('follows the rule when the rule changes', () => {
    const stricter = { ...RULES, consecutive_mocks_at_pass: 5, min_mocks_for_ready: 5, plateau_min_mocks: 6 };
    expect(blockerSentence({ kind: 'below_pass', value: 82, target: 85, count: 2 }, stricter))
      .toBe('2 of your last five mocks came in at 82%, under the 85% pass mark. Ready is five in a row at or above it.');
    expect(blockerSentence({ kind: 'more_mocks', count: 2 }, stricter)).toMatch(/One good paper is luck; five is a pattern\.$/);
    expect(readySentence(85, stricter)).toMatch(/^Five consecutive mocks/);
    expect(plateauSentence([84, 85], stricter)).toMatch(/no movement across six mocks/);
  });
});
