// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { AcCheck } from '../../types/lakehouse';

// Structure checks on the acceptance criteria a learner writes after an
// outcome (design §4.8, PRD P0-9).
//
// These look for the SHAPE of a defensible criterion, not its quality: a
// Given/When/Then, a number to test against, what happens when it fails, and
// who signs it off. They are labelled "structure checks" on screen and never
// produce a grade -- there is no AI in v1 (P1-6 adds it, with "Not Graded"
// when no provider is configured).

const GIVEN = /\bgiven\b/i;
const WHEN = /\bwhen\b/i;
const THEN = /\bthen\b/i;

// A figure with a unit, or a comparison word next to a figure.
const UNIT_FIGURE = /\d[\d,]*(\.\d+)?\s*(%|\b(percent|rows?|records?|files?|ms|seconds?|minutes?|hours?|days?|decimal places?|dp)\b)/i;
const COMPARED_FIGURE = /\b(tolerance|within|at most|at least|no more than|no fewer than|under|over|exceeds?|less than|greater than|more than|fewer than|equals?)\b[^.\n]{0,24}\d|[<>]=?\s*\d/i;

const FAILURE = /\b(fail(s|ed|ure)?|roll(s|ed)?[ -]?back|revert(s|ed)?|restore[sd]?|abort(s|ed)?|halt(s|ed)?|stops?|blocks?|blocked|rejects?|rejected|refus(es|ed)|escalat\w*|quarantin\w*|do(es)? not proceed)\b/i;

const OWNER = /\b(owner|sign[ -]?off|signed off|approv(es|ed|al|er)|accountable|responsible|steward|sponsor)\b/i;

/** The four structure checks on a piece of acceptance-criteria text. */
export function acChecks(text: string): AcCheck[] {
  const t = text ?? '';
  const g = t.search(GIVEN);
  const w = t.search(WHEN);
  const th = t.search(THEN);
  const gwt = g >= 0 && w > g && th > w;
  return [
    {
      check: 'gwt',
      passed: gwt,
      hint: gwt ? 'It has a Given, a When and a Then, in that order.' : 'Write it as Given … When … Then …, in that order.',
    },
    {
      check: 'threshold',
      passed: UNIT_FIGURE.test(t) || COMPARED_FIGURE.test(t),
      hint: 'Name a number to test against, such as a tolerance, a row count or a percentage.',
    },
    {
      check: 'failure',
      passed: FAILURE.test(t),
      hint: 'Say what happens when the check fails: roll back, stop, block or escalate.',
    },
    {
      check: 'owner',
      passed: OWNER.test(t),
      hint: 'Name who signs it off. For a data domain, that is the business data owner, not only engineering QA.',
    },
  ];
}

export const AC_CHECK_LABELS: Record<AcCheck['check'], string> = {
  gwt: 'Given / When / Then',
  threshold: 'A number to test against',
  failure: 'What happens on failure',
  owner: 'Who signs it off',
};
