// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { Blocker, ReadinessRules } from '../types/subject';

/**
 * The readiness rule, in English. One place, so no surface invents its own.
 *
 * The rule owns the condition and the numbers; this owns the sentence. Home
 * and Insights both explain the same verdict, and they must not explain it
 * differently -- two pages disagreeing about why you are not ready is the
 * same class of defect as two pages disagreeing about your score.
 */

export const pct = (n: number) => `${Math.round(n)}%`;

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** A count as a word, the way these sentences say it: "three", not "3". */
const word = (n: number) => WORDS[n] ?? String(n);

/**
 * The rule's counts, from the server when it sent them.
 *
 * The sentences below say "three in a row" and "four mocks" because that is the
 * rule; with `rules` they say whatever the rule is, so changing a threshold on
 * the server cannot leave this copy quoting the old one. Without `rules` they
 * read as they always have.
 */
const counts = (rules?: ReadinessRules | null) => ({
  run: word(rules?.consecutive_mocks_at_pass ?? 3),
  needed: word(rules?.min_mocks_for_ready ?? 3),
  plateau: word(rules?.plateau_min_mocks ?? 4),
});

export function blockerSentence(b: Blocker, rules?: ReadinessRules | null): string {
  const c = counts(rules);
  switch (b.kind) {
    case 'no_exam_profile':
      return 'This subject has no exam profile, so there is no pass mark to be '
        + 'ready against. Practice still counts; readiness cannot be computed.';
    case 'more_mocks': {
      const left = b.count ?? 0;
      return `${left === 1 ? 'One more full mock' : `${left} more full mocks`} before this can `
        + `mean anything. One good paper is luck; ${c.needed} is a pattern.`;
    }
    case 'weak_domain':
      return `${b.domain} is at ${pct(b.value ?? 0)}, under the ${pct(b.target ?? 0)} floor. `
        + 'The exam samples every area, so one weak one sinks the whole paper.';
    case 'below_pass': {
      const n = b.count ?? 1;
      return `${n === 1 ? `One of your last ${c.run} mocks came in` : `${n} of your last ${c.run} mocks came in`} `
        + `at ${pct(b.value ?? 0)}, under the ${pct(b.target ?? 0)} pass mark. `
        + `Ready is ${c.run} in a row at or above it.`;
    }
    case 'stale':
      return `Your last mock was ${Math.round(b.value ?? 0)} days ago. `
        + `Anything older than ${Math.round(b.target ?? 0)} days stops being evidence `
        + 'of where you are now.';
    default:
      return '';
  }
}

/**
 * What a plateau means, which is not what a blocker means.
 *
 * PLATEAU is a state rather than an unmet condition, so `blockers` describes
 * the score and never the shape of it -- "one of your last three came in at
 * 84%" is true and useless when all four came in at 84%. This sentence lived
 * only on the subject page, which was reachable by typing its URL; the one
 * reading the app owes a learner who has stopped moving was the one reading
 * nobody could get to.
 */
export const plateauSentence = (scores: number[], rules?: ReadinessRules | null) =>
  `${scores.map((s) => pct(s)).join(' · ')} — no movement across ${counts(rules).plateau} mocks. `
  + 'What is left is exam-day variance, not knowledge. Another drill will not '
  + 'change this number; sitting the paper is what is left.';

/** What the verdict says when nothing is blocking it. */
export const readySentence = (passMark: number | null | undefined, rules?: ReadinessRules | null) => {
  const run = counts(rules).run;
  return `${run.charAt(0).toUpperCase()}${run.slice(1)} consecutive mocks at or above ${pct(passMark ?? 0)}, no area under the floor, `
    + 'and the evidence is current. There is nothing further this can tell you.';
};
