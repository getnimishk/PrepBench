// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, expect, it } from 'vitest';

/**
 * Guard test: every spinner is either named or hidden from screen readers.
 *
 * MUI's CircularProgress renders role="progressbar", and a progressbar with no
 * name is a serious axe violation (aria-progressbar-name). Axe only sees one when
 * a page is caught mid-load, so the browser audits met this by chance: the
 * Practice tab's "Checking your bank…" spinner. Twenty-nine spinners had it.
 *
 * Which one to use:
 * - aria-hidden when visible text beside it already says what is happening
 *   ("Saving your answer…"), or when it sits inside a button -- a name there
 *   would become part of the button's name ("Loading Import").
 * - aria-label when it stands alone, saying what is loading.
 */
describe('spinner labelling guard', () => {
  it('gives every CircularProgress in src/ an aria-label, aria-labelledby or aria-hidden', () => {
    const rawFiles = import.meta.glob<string>('../../**/*.tsx', {
      query: '?raw',
      import: 'default',
      eager: true,
    });

    const violations: string[] = [];
    for (const [filePath, content] of Object.entries(rawFiles)) {
      if (filePath.includes('.test.')) continue;
      // The whole opening tag, however many lines it spans.
      for (const match of content.matchAll(/<CircularProgress\b[\s\S]*?\/?>/g)) {
        if (/aria-(label|labelledby|hidden)\b/.test(match[0])) continue;
        const line = content.slice(0, match.index).split('\n').length;
        violations.push(`${filePath.replace(/^(\.\.\/)+/, '')}:${line}: ${match[0].replace(/\s+/g, ' ')}`);
      }
    }

    expect(
      violations,
      `Found ${violations.length} spinner(s) with no name and not hidden -- axe's aria-progressbar-name:\n${violations.join('\n')}`,
    ).toEqual([]);
  });
});
