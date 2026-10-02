// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, expect, it } from 'vitest';
import { acChecks } from './acChecks';

const passed = (text: string) => Object.fromEntries(acChecks(text).map((c) => [c.check, c.passed]));

describe('acChecks', () => {
  it('passes all four on a complete criterion', () => {
    const text = 'Given the legacy and migrated yield tables, when they are compared by lot key, '
      + 'then no row differs by more than 0.0001. If any row does, the cutover rolls back. '
      + 'The business data owner signs it off.';
    expect(passed(text)).toEqual({ gwt: true, threshold: true, failure: true, owner: true });
  });

  it('fails all four on an empty or vague one, with a hint each', () => {
    for (const text of ['', 'It should work well.']) {
      const checks = acChecks(text);
      expect(checks.map((c) => c.passed)).toEqual([false, false, false, false]);
      expect(checks.every((c) => c.hint.length > 0)).toBe(true);
    }
  });

  it('wants Given, When and Then in that order', () => {
    expect(passed('Then it passes. When run. Given data.').gwt).toBe(false);
    expect(passed('GIVEN a table WHEN compared THEN equal').gwt).toBe(true);
  });

  it.each([
    ['300 rows', true], ['within 0.5', true], ['at most 3', true], ['< 5', true], ['5%', true],
    ['no numbers here', false], ['version 3', false],
  ])('threshold: %s', (text, expected) => expect(passed(text).threshold).toBe(expected));

  it('does not match words that merely contain a keyword', () => {
    // "owner" inside "downer", "stop" inside "stoppage" are not the words.
    expect(passed('a downer').owner).toBe(false);
    expect(passed('no stoppage').failure).toBe(false);
  });

  it.each(['rolls back', 'roll-back the load', 'quarantine the batch', 'escalate to the owner'])('failure: %s', (text) => {
    expect(passed(text).failure).toBe(true);
  });
});
