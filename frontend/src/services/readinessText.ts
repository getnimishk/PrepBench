// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { Blocker } from '../types/subject';

/**
 * The readiness rule, in English. One place, so no surface invents its own.
 *
 * The rule owns the condition and the numbers; this owns the sentence. Home
 * and Insights both explain the same verdict, and they must not explain it
 * differently -- two pages disagreeing about why you are not ready is the
 * same class of defect as two pages disagreeing about your score.
 */

export const pct = (n: number) => `${Math.round(n)}%`;

export function blockerSentence(b: Blocker): string {
  switch (b.kind) {
    case 'no_exam_profile':
      return 'This subject has no exam profile, so there is no pass mark to be '
        + 'ready against. Practice still counts; readiness cannot be computed.';
    case 'more_mocks': {
      const left = b.count ?? 0;
      return `${left === 1 ? 'One more full mock' : `${left} more full mocks`} before this can `
        + 'mean anything. One good paper is luck; three is a pattern.';
    }
    case 'weak_domain':
      return `${b.domain} is at ${pct(b.value ?? 0)}, under the ${pct(b.target ?? 0)} floor. `
        + 'The exam samples every area, so one weak one sinks the whole paper.';
    case 'below_pass': {
      const n = b.count ?? 1;
      return `${n === 1 ? 'One of your last three mocks came in' : `${n} of your last three mocks came in`} `
        + `at ${pct(b.value ?? 0)}, under the ${pct(b.target ?? 0)} pass mark. `
        + 'Ready is three in a row at or above it.';
    }
    case 'stale':
      return `Your last mock was ${Math.round(b.value ?? 0)} days ago. `
        + `Anything older than ${Math.round(b.target ?? 0)} days stops being evidence `
        + 'of where you are now.';
    default:
      return '';
  }
}

/** What the verdict says when nothing is blocking it. */
export const readySentence = (passMark: number | null | undefined) =>
  `Three consecutive mocks at or above ${pct(passMark ?? 0)}, no area under the floor, `
  + 'and the evidence is current. There is nothing further this can tell you.';
