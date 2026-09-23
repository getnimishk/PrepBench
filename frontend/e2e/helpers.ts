// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { expect, type APIRequestContext, type Page } from '@playwright/test';

/**
 * Shared set-up for the browser tests.
 *
 * Data is created through the API rather than by clicking, for two reasons.
 * It is fast, so each test can build exactly the state it needs instead of
 * sharing fixtures. And it keeps each test about one thing: the isolation test
 * should fail because isolation broke, not because the Add Preparation form
 * moved a button.
 *
 * Every request goes through the dev server's /api proxy to the E2E backend,
 * which runs against its own throwaway database -- see playwright.config.ts.
 */

export const tag = () => Math.random().toString(36).slice(2, 8);

export interface CreatedPreparation {
  id: number;
  name: string;
  certification: string;
}

export async function createCertification(
  request: APIRequestContext,
  stem: string,
): Promise<CreatedPreparation> {
  const t = tag();
  const name = `${stem} ${t}`;
  const certification = `${stem} Certification ${t}`;
  const response = await request.post('/api/v1/subjects', {
    data: {
      name,
      kind: 'certification',
      certification,
      pass_mark: 85,
      exam_question_count: 3,
      exam_minutes: 30,
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  const body = await response.json();
  return { id: body.id, name, certification };
}

/** One question owned by `prep`, with text unique enough to find on screen. */
export async function createQuestion(
  request: APIRequestContext,
  prep: CreatedPreparation,
  text: string,
  domain = 'E2E Domain',
): Promise<number> {
  const response = await request.post('/api/v1/questions', {
    data: {
      text,
      question_type: 'single_choice',
      difficulty: 'medium',
      domain,
      topic: 'E2E Topic',
      certification: prep.certification,
      explanation: 'Created by the browser test suite.',
      options: [
        { option_text: 'Right', is_correct: true, order_index: 0 },
        { option_text: 'Wrong', is_correct: false, order_index: 1 },
      ],
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  const body = await response.json();
  // The server attributes a question to a preparation by exact certification
  // match. Asserting it here means a broken attribution fails in set-up with a
  // clear message, instead of later as a mysteriously empty question bank.
  expect(body.subject_id, 'question was not attributed to its preparation').toBe(prep.id);
  return body.id;
}

/** Choose a preparation from the header picker, the way a person would. */
export async function pickPreparation(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: /^Preparation:/ }).click();
  await page.getByRole('menuitem', { name: new RegExp(escapeRegExp(name)) }).click();
  await expect(page.getByRole('button', { name: `Preparation: ${name}. Change preparation` }))
    .toBeVisible();
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A completed mock for `prep`, with every answer wrong.
 *
 * Built through the same endpoints the exam runner uses -- create, answer,
 * finish -- rather than by writing rows, so the misses it produces are exactly
 * the ones a learner would have: in the review queue, counted by the daily goal.
 */
export async function completedMockWithMisses(
  request: APIRequestContext,
  prep: CreatedPreparation,
  questionCount: number,
  domain = 'E2E Domain',
): Promise<void> {
  for (let i = 0; i < questionCount; i += 1) {
    await createQuestion(request, prep, `Mock question ${i} ${tag()}`, domain);
  }

  const created = await request.post('/api/v1/exams', {
    data: { subject_id: prep.id, session_kind: 'mock', total_questions: questionCount },
  });
  expect(created.status(), await created.text()).toBe(201);
  const sessionId = (await created.json()).id;

  const detail = await (await request.get(`/api/v1/exams/${sessionId}`)).json();
  for (const question of detail.questions as { id: number; options: { id: number; is_correct?: boolean }[] }[]) {
    // Deliberately wrong. The detail endpoint may not reveal correctness before
    // the paper is finished, so pick an option that is not the correct one when
    // it is known and otherwise the last one; the seeded questions put the
    // correct option first.
    const wrong = question.options.find((o) => o.is_correct === false) ?? question.options[question.options.length - 1];
    const answered = await request.post(`/api/v1/exams/${sessionId}/answer`, {
      data: { question_id: question.id, selected_option_ids: [wrong.id] },
    });
    expect(answered.status(), await answered.text()).toBe(200);
  }

  const finished = await request.post(`/api/v1/exams/${sessionId}/finish`);
  expect(finished.status(), await finished.text()).toBe(200);
}
