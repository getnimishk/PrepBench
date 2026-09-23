// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { expect, test } from '@playwright/test';
import { completedMockWithMisses, createCertification, pickPreparation } from './helpers';

/**
 * The review loop, in a browser: miss, understand, verify, and the result kept.
 *
 * The plan's loop is Miss → Understand → Verify → Schedule → Retrieve later →
 * Update evidence, and "review scheduling must persist". So the test ends on a
 * reload: a check that only lived in the page would pass every step before it.
 */

test('a miss is read, checked with a second question, and stays checked after a reload', async ({ page, request }) => {
  const prep = await createCertification(request, 'Review Loop');
  await completedMockWithMisses(request, prep, 3);

  await page.goto('/review?start=1');
  await pickPreparation(page, prep.name);
  await expect(page.getByText(/Review today · 1 of 3/)).toBeVisible();

  // Understand: the explanation is on the card.
  await expect(page.getByText('Created by the browser test suite.').first()).toBeVisible();

  // Verify: a different question on the same idea.
  await expect(page.getByText('A different question on the same idea.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Right', exact: true }).click();
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await expect(page.getByText('Checked.')).toBeVisible();

  // Scheduled on the server, so the queue is shorter after a reload.
  const queue = await (await request.get(`/api/v1/review/queue?subject_id=${prep.id}`)).json();
  expect(queue.total_unreviewed).toBe(2);

  await page.reload();
  await expect(page.getByText(/Review today · 1 of 2/)).toBeVisible();
});
