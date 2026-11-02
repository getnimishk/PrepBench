// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { Question, QuestionOption, QuestionType } from '../types/question';
import type { ReviewOption } from '../types/review';

/**
 * Ordering ("build list") and matching questions, on the screen. The grading rule is the backend's
 * (backend/app/services/answer_grading.py); `gradeSelection` here is the same rule, for screens that
 * show a result without asking the server (practice reveal, the review check).
 *
 * An answer is always a list of option ids:
 *   ordering -- every option id, in the order the learner put them; right in the stored order;
 *   matching -- one entry per option, in the stored order, each the id of the option whose target
 *               the learner paired with it, 0 while unpaired; right when each option has its own.
 */

export const isStructured = (q: Pick<Question, 'question_type'>): boolean =>
  q.question_type === 'ordering' || q.question_type === 'matching';

const idOf = (o: QuestionOption, i: number): number => (o.id !== undefined ? o.id : i);

/** The options in their stored order: the answer for ordering, the rows for matching. */
export function storedOrder(q: Question): QuestionOption[] {
  return q.options
    .map((o, i) => ({ o, i }))
    .sort((a, b) => (a.o.order_index ?? a.i) - (b.o.order_index ?? b.i) || idOf(a.o, a.i) - idOf(b.o, b.i))
    .map(({ o }) => o);
}

export const storedIds = (q: Question): number[] => storedOrder(q).map((o, i) => idOf(o, i));

/** A small, seeded generator (mulberry32): the same question always shuffles the same way, on every screen. */
function generator(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0);
  };
}

/** A deterministic shuffle of `items` for question `id`, never the order given (when there are two or more). */
export function shuffledFor<T>(id: number, items: T[]): T[] {
  if (items.length < 2) return [...items];
  const next = generator(id);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = next() % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  // A shuffle that happens to give the answer is no shuffle: rotate by one.
  if (out.every((x, i) => x === items[i])) out.push(out.shift()!);
  return out;
}

/** Is this list a complete answer (one the server will grade)? */
export function isAnswered(q: Question, selected: number[]): boolean {
  return gradeSelection(q, selected) !== null;
}

/** Right, wrong, or null when not (yet) a complete answer. The backend's rule, word for word. */
export function gradeSelection(q: Question, selected: number[]): boolean | null {
  const expected = storedIds(q);
  if (q.question_type === 'ordering') {
    if (selected.length !== expected.length) return null;
    const a = [...selected].sort((x, y) => x - y);
    const b = [...expected].sort((x, y) => x - y);
    if (a.some((x, i) => x !== b[i])) return null;
    return selected.every((x, i) => x === expected[i]);
  }
  if (q.question_type === 'matching') {
    if (selected.length !== expected.length || selected.some((x) => !x)) return null;
    return selected.every((x, i) => x === expected[i]);
  }
  if (selected.length === 0) return null;
  const right = new Set(q.options.map((o, i) => (o.is_correct ? idOf(o, i) : null)).filter((x): x is number => x !== null));
  return selected.length === right.size && selected.every((x) => right.has(x));
}

/** A review screen's question, as the shape these helpers and components read. */
export function reviewQuestion(id: number, type: QuestionType | undefined, options: ReviewOption[]): Question {
  return {
    id, question_type: type ?? 'single_choice',
    options: options.map((o) => ({
      id: o.id, option_text: o.text, is_correct: o.is_correct, order_index: o.order_index, match_target: o.match_target,
    })),
  } as Question;
}

/**
 * Was a saved answer given? For a choice question, anything picked; for ordering and matching, a
 * complete answer, which is one the server graded (an incomplete one is still to do).
 */
export function answerGiven(q: Pick<Question, 'question_type'>, a: { selected_option_ids?: number[] | null; is_correct?: boolean | null } | undefined): boolean {
  if (!a) return false;
  return isStructured(q) ? a.is_correct !== null && a.is_correct !== undefined : (a.selected_option_ids?.length ?? 0) > 0;
}
