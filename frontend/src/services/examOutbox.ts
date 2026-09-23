// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import type { SaveAnswerRequest } from '../types/exam';
import { clearLocalDraft, readLocalDraft, writeLocalDraft } from './localDrafts';

/**
 * Answers picked while the server could not take them, kept until it can.
 *
 * One entry per question, because only an answer as it finally stands is worth
 * sending: picking B after A replaces A. Entries stay in the order they were
 * last changed, and the list is copied to this device so a closed tab does not
 * lose them. It is never the record of the paper -- the server is -- so an
 * answer here is "saved on this device", and the runner says exactly that.
 */

const key = (sessionId: number) => `exam:${sessionId}`;

/** Add one question's answer, replacing any earlier one for that question. */
export function withAnswer(kept: SaveAnswerRequest[], answer: SaveAnswerRequest): SaveAnswerRequest[] {
  return [...kept.filter((k) => k.question_id !== answer.question_id), answer];
}

/** Copy the list to this device. False when the browser refuses storage. */
export function storeKeptAnswers(sessionId: number, kept: SaveAnswerRequest[]): boolean {
  if (kept.length === 0) {
    clearLocalDraft(key(sessionId));
    return true;
  }
  return writeLocalDraft(key(sessionId), kept);
}

export function readKeptAnswers(sessionId: number): SaveAnswerRequest[] {
  const draft = readLocalDraft<SaveAnswerRequest[]>(key(sessionId));
  if (!Array.isArray(draft?.value)) return [];
  return draft.value.filter((a) => typeof a?.question_id === 'number' && Array.isArray(a.selected_option_ids));
}

export function clearKeptAnswers(sessionId: number): void {
  clearLocalDraft(key(sessionId));
}

export const answersWord = (n: number) => `${n} ${n === 1 ? 'answer' : 'answers'}`;

/**
 * What the kept list holds, in the learner's terms. A save goes out on every
 * move between questions, so most entries can carry only a position or a flag;
 * those are sent too, but "3 answers" for one question answered would be false.
 */
export function describeKept(kept: SaveAnswerRequest[]): string {
  const answers = kept.filter((k) => k.selected_option_ids.length > 0).length;
  return answers > 0 ? answersWord(answers) : 'your latest changes';
}
