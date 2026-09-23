// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { expect, test, type APIRequestContext } from '@playwright/test';

/**
 * A design review, end to end: scenario, options, choice, justification, commit,
 * the deciding axis revealed, reasoning compared, feedback, next exercise.
 *
 * With no AI provider in the test backend, the verdict is the honest one: none,
 * with a way to be graded later. The reveal itself is the review's, and shows
 * either way -- what must never appear is a verdict nobody reached.
 */

async function unattemptedReview(request: APIRequestContext): Promise<number> {
  const { items } = await (await request.get('/api/v1/design-reviews?limit=500')).json();
  const fresh = items.find((r: { attempted: boolean }) => !r.attempted);
  if (!fresh) throw new Error('every seeded design review has been attempted already');
  return fresh.id;
}

test('a decision is committed, the axis revealed, the reasoning compared, and the next review opened', async ({ page, request }) => {
  const reviewId = await unattemptedReview(request);

  await page.goto(`/design-reviews/${reviewId}`);
  await page.getByRole('radio', { name: /^Option A:/ }).check();
  await page.getByPlaceholder(/What is this decision actually about/).fill(
    'It turns on how often the system is actually busy: ask for the peak and the idle hours first.',
  );
  await page.getByRole('button', { name: /^Commit decision/ }).click();

  await expect(page.getByText('The deciding axis', { exact: true })).toBeVisible();
  // Headed by the axis in a word, now that it is the learner's to see.
  await expect(page.getByRole('heading', { level: 1, name: /^The deciding axis was / })).toBeVisible();
  await expect(page.getByText('Not graded', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Grade again' })).toBeVisible();
  // No verdict was reached, so none is shown.
  await expect(page.getByText(/You named the deciding axis|Partly there|Missed the axis/)).toHaveCount(0);

  await expect(page.getByText('Compare your reasoning')).toBeVisible();
  await expect(page.getByText('You said · Option A')).toBeVisible();

  // The commit is the server's: the review now reads as attempted.
  const after = await (await request.get('/api/v1/design-reviews?limit=500')).json();
  expect(after.items.find((r: { id: number }) => r.id === reviewId).attempted).toBe(true);

  await page.getByRole('button', { name: /^Next review/ }).click();
  await expect(page).not.toHaveURL(new RegExp(`/design-reviews/${reviewId}$`));
  await expect(page).toHaveURL(/\/design-reviews\/\d+$/);
  await expect(page.getByRole('button', { name: /^Commit decision/ })).toBeVisible();
});
