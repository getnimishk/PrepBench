// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { tag } from './helpers';

/**
 * Interview practice, recorded for real.
 *
 * The plan's chain: prompt, record, stop, save, playback, transcript, content and
 * delivery feedback, recommendation, retry, compare. Chromium's fake microphone
 * gives the recorder a genuine audio stream, so every answer here is encoded,
 * uploaded and stored like a learner's. The test backend has no AI provider, so
 * the feedback half is checked as the plan requires it when AI is unavailable:
 * "Not graded", with a way to set one up and run the analysis again -- never a
 * score that was not given.
 */

async function importQuestions(request: APIRequestContext, category: string, lines: string[]) {
  const response = await request.post('/api/v1/interview-questions/import', {
    multipart: { default_round_type: 'behavioral', default_category: category, text: lines.join('\n') },
  });
  expect(response.status(), await response.text()).toBe(200);
}

/** Speak for a couple of seconds, then stop. The fake device supplies the sound. */
async function answer(page: Page) {
  await page.getByRole('button', { name: 'Start answering', exact: true }).click();
  const stop = page.getByRole('button', { name: 'Stop answering' });
  await expect(stop).toBeVisible();
  await page.waitForTimeout(2200);
  await stop.click();
}

test('a session is set up, answered out loud, resumed after a reload, and reported honestly', async ({ page, request }) => {
  test.setTimeout(120_000);
  const t = tag();
  const category = `E2E ${t}`;
  const first = `Tell me about a hard call ${t}`;
  const second = `Tell me about a conflict ${t}`;
  await importQuestions(request, category, [first, second]);

  // Set up: the round, this test's category, no thinking time.
  await page.goto('/interview-practice/setup');
  await page.getByRole('button', { name: 'Behavioral', exact: true }).click();
  await page.getByRole('combobox', { name: 'Category' }).click();
  await page.getByRole('option', { name: category }).click();
  await expect(page.getByText('2 questions, least-practised first')).toBeVisible();
  await page.getByRole('button', { name: 'None', exact: true }).click();
  await page.getByRole('button', { name: 'Start session' }).click();

  // The session runs on its own screen.
  await expect(page).toHaveURL(/\/interview-practice\/sessions\/\d+$/);
  await expect(page.getByText(/Question 1 of 2/)).toBeVisible();
  await answer(page);

  // Saved, measured against the round's length, and not graded without a provider.
  await expect(page.getByText(/Saved · 00:0\d · short of the target length/)).toBeVisible();
  await expect(page.locator('audio')).toHaveCount(1);
  await expect(page.getByText(/Not graded\./)).toBeVisible();

  // A reload comes back to the first question without an answer.
  await page.reload();
  await expect(page.getByText(/Question 2 of 2/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Question 1, answered' })).toBeVisible();

  await answer(page);
  await expect(page.getByText(/Not graded\./)).toBeVisible();
  await page.getByRole('button', { name: 'Finish session' }).click();

  // The report: two answers, nothing invented.
  await expect(page).toHaveURL(/\/report$/);
  await expect(page.getByText(/2 answers · 00:0\d speaking/)).toBeVisible();
  await expect(page.getByText(/saved but not graded/)).toBeVisible();
  await expect(page.getByText('0%')).toHaveCount(0);

  // One answer in full: playback, the clock's measurement, and a way to be graded.
  await page.getByRole('link', { name: 'Open' }).first().click();
  await expect(page.locator('audio')).toHaveCount(1);
  await expect(page.getByText(/short of the target length/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Analyse again' })).toBeVisible();
  await expect(page.getByRole('alert').getByRole('link', { name: 'Settings' })).toBeVisible();

  // Retry, then compare the two takes of the same question.
  await page.getByRole('link', { name: 'Retake this question' }).first().click();
  await expect(page).toHaveURL(/\/interview-practice\/\d+\/record$/);
  await answer(page);
  await expect(page).toHaveURL(/\/interview-practice\/recordings\/\d+\/results$/);
  const takes = page.getByRole('table', { name: 'Takes of this question' });
  await expect(takes).toBeVisible();
  await expect(takes.getByRole('row')).toHaveCount(3); // header + two takes
  await expect(takes.getByText('This take')).toBeVisible();
});

test('the library lists a question with how often it has been answered, and practises it', async ({ page, request }) => {
  const t = tag();
  const text = `Describe a time you changed your mind ${t}`;
  await importQuestions(request, `Library ${t}`, [text]);

  await page.goto('/interview-practice/library');
  const row = page.getByText(text).locator('xpath=ancestor::div[2]');
  await expect(page.getByText(text)).toBeVisible();
  await expect(page.getByText(new RegExp(`Library ${t} · never answered`))).toBeVisible();

  await row.getByRole('button', { name: 'Practise' }).click();
  await expect(page).toHaveURL(/\/interview-practice\/\d+\/record$/);
  await expect(page.getByRole('heading', { name: new RegExp(t) })).toBeVisible();
});
