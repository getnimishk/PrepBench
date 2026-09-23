// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { expect, test, type APIRequestContext } from '@playwright/test';

/**
 * System design, end to end: prompt, requirements, architecture, data model,
 * failure handling, trade-offs, submit, grading, result, improvement, retry.
 *
 * "Drafts must persist. Autosave must be real." So the test types, waits for the
 * page to say it saved, reloads, and checks the words came back from the server.
 * The test backend has no AI provider, so grading is checked as it must behave
 * without one: "Not graded", a way to grade again, and never a score.
 */

async function unusedPrompt(request: APIRequestContext): Promise<number> {
  const list = await (await request.get('/api/v1/system-design/prompts?limit=100')).json();
  for (const prompt of [...list.items].reverse()) {
    const draft = await (await request.get(`/api/v1/system-design/prompts/${prompt.id}/draft`)).json();
    if (!draft.exists) return prompt.id;
  }
  throw new Error('no untouched system design prompt in the test database');
}

test('an answer is written in sections, survives a reload, is submitted honestly, and revised', async ({ page, request }) => {
  test.setTimeout(90_000);
  const promptId = await unusedPrompt(request);

  await page.goto(`/system-design/${promptId}/answer`);
  await page.getByLabel(/1\. Requirements & scale assumptions/).fill('10M notifications an hour at peak; at-least-once.');
  await page.getByLabel(/2\. High-level architecture/).fill('API, queue, a worker pool per channel, providers.');
  await page.getByLabel(/4\. Failure handling/).fill('Dead-letter queue; bounded retries with backoff.');
  await expect(page.getByText(/^Saved · at .*\. You can leave and come back$/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/3 of 5 sections written/)).toBeVisible();

  // The draft is the server's, not the page's.
  page.on('dialog', (dialog) => dialog.accept());
  await page.reload();
  await expect(page.getByText('Picked up where you left off.')).toBeVisible();
  await expect(page.getByLabel(/4\. Failure handling/)).toHaveValue('Dead-letter queue; bounded retries with backoff.');

  await page.getByRole('button', { name: /^Submit for rubric evaluation/ }).click();

  // The result is this attempt's: its sections, and no invented grade.
  await expect(page).toHaveURL(/\/system-design\/attempts\/\d+$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Not graded' })).toBeVisible();
  await expect(page.getByText('Dead-letter queue; bounded retries with backoff.')).toBeVisible();
  await expect(page.getByText('Not written.')).toHaveCount(2);

  await page.getByRole('button', { name: 'Grade again' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Not graded' })).toBeVisible();
  await expect(page.getByText(/^\d+%$/)).toHaveCount(0);
  await expect(page.getByText(/^\d+(\.\d)? \/ 10$/)).toHaveCount(0);

  // Revise: the answer page starts from the attempt, not from blank boxes.
  await page.getByRole('link', { name: 'Revise your answer' }).first().click();
  await expect(page.getByLabel(/2\. High-level architecture/)).toHaveValue('API, queue, a worker pool per channel, providers.');
  await page.getByLabel(/3\. Data model & storage/).fill('notifications(id, user_id, channel, status), partitioned by user_id.');
  await page.getByRole('button', { name: /^Submit for rubric evaluation/ }).click();

  await expect(page).toHaveURL(/\/system-design\/attempts\/\d+$/);
  await expect(page.getByText('Your attempts at this prompt')).toBeVisible();
  await expect(page.getByText('Earlier attempt')).toBeVisible();
  await expect(page.getByText('Not written.')).toHaveCount(1);
});
