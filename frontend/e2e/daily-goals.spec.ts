// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { expect, test } from '@playwright/test';
import { completedMockWithMisses, createCertification, pickPreparation } from './helpers';

/**
 * Home's two daily goals, against real data.
 *
 * The goal is derived from the review queue, so the only honest way to test it
 * is to produce real misses the way a learner does -- sit a mock and get answers
 * wrong -- and then check that Home asks for exactly those reviews, for that
 * preparation and no other.
 */

test('the certification goal counts real misses, for the picked preparation only', async ({ page, request }) => {
  const withMisses = await createCertification(request, 'Goal Misses');
  const clean = await createCertification(request, 'Goal Clean');
  await completedMockWithMisses(request, withMisses, 3);

  // The server's own numbers first, so the screen is checked against them.
  const goals = await (await request.get(`/api/v1/home/daily-goals?subject_id=${withMisses.id}`)).json();
  expect(goals.certification.due_for_review).toBe(3);
  expect(goals.certification.target).toBe(3);

  await page.goto('/');
  await pickPreparation(page, withMisses.name);

  const certification = page.getByTestId('goal-certification');
  await expect(certification.getByText('0 / 3')).toBeVisible();
  await expect(certification.getByRole('button', { name: 'Start review' })).toBeVisible();

  // Another preparation's misses must not follow the picker across.
  await pickPreparation(page, clean.name);
  await expect(certification.getByText(/That is the system working, not a missed day/)).toBeVisible();
  await expect(certification.getByText('0 / 0')).toBeVisible();
});

test('the interview goal is always shown, and has no signal before anything is analysed', async ({ page }) => {
  await page.goto('/');

  const interview = page.getByTestId('goal-interview');
  await expect(interview.getByText('Interview practice')).toBeVisible();
  await expect(interview.getByText('not analysed yet')).toHaveCount(2);
});

test('"Start review" opens the same preparation\'s mistakes the goal counted, and no other', async ({ page, request }) => {
  const withMisses = await createCertification(request, 'Review Misses');
  const clean = await createCertification(request, 'Review Clean');
  await completedMockWithMisses(request, withMisses, 3);

  await page.goto('/');
  await pickPreparation(page, withMisses.name);
  await page.getByTestId('goal-certification').getByRole('button', { name: 'Start review' }).click();

  // The plan's isolation walk, on Review: observe, switch, check it changed,
  // switch back, check it is intact.
  await expect(page.getByText(/Review today · 1 of 3/)).toBeVisible();

  await pickPreparation(page, clean.name);
  await expect(page.getByText(/Nothing to review/)).toBeVisible();
  await expect(page.getByText(/Review today/)).toHaveCount(0);

  await pickPreparation(page, withMisses.name);
  await expect(page.getByText(/Review today · 1 of 3/)).toBeVisible();
});
