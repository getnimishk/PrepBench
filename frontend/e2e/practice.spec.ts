// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { expect, test } from '@playwright/test';
import { completedMockWithMisses, createCertification, createQuestion, pickPreparation, tag } from './helpers';

/**
 * Practice, end to end: a format is chosen, its controls change the session, the
 * session runs, the result is scored, and the answers come back as evidence the
 * next session is described by.
 */

test('custom practice changes what is drawn, runs to a result, and its answers become evidence', async ({ page, request }) => {
  const prep = await createCertification(request, 'Custom');
  const t = tag();
  for (let i = 0; i < 3; i += 1) await createQuestion(request, prep, `Events question ${i} ${t}`, 'Scrum Events');
  for (let i = 0; i < 2; i += 1) await createQuestion(request, prep, `Roles question ${i} ${t}`, 'Scrum Roles');

  await page.goto('/practice?tab=custom');
  await pickPreparation(page, prep.name);

  await expect(page.getByText(/will be drawn from the 5 that match/)).toBeVisible();
  await expect(page.getByText(/5 never attempted/)).toBeVisible();

  // The control has to change the session, or it is decoration.
  await page.getByRole('combobox', { name: 'Domain' }).click();
  await page.getByRole('option', { name: 'Scrum Roles' }).click();
  await expect(page.getByText(/2 questions will be drawn from the 2 that match/)).toBeVisible();

  await page.getByRole('button', { name: 'Start set' }).click();
  await expect(page.getByText(/Question 1 of 2/)).toBeVisible();
  // Only the chosen domain reached the runner.
  await expect(page.getByText(new RegExp(`Roles question \\d ${t}`))).toBeVisible();

  await page.getByRole('radio', { name: 'Right' }).check();
  await page.getByRole('button', { name: 'Check answer' }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText(/Question 2 of 2/)).toBeVisible();
  await page.getByRole('radio', { name: 'Right' }).check();
  await page.getByRole('button', { name: 'Check answer' }).click();
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, submit' }).click();

  await expect(page).toHaveURL(/\/exam-review\/\d+/);
  await expect(page.getByText('2 of 2 correct')).toBeVisible();
  await expect(page.getByText(/A drill closes gaps/)).toBeVisible();

  // Back in Practice, the pool is described by what just happened.
  await page.goto('/practice?tab=custom');
  await expect(page.getByText(/3 never attempted · 2 right every time so far/)).toBeVisible();
});

test('the formats follow the picked preparation', async ({ page, request }) => {
  const withBank = await createCertification(request, 'Formats Bank');
  const empty = await createCertification(request, 'Formats Empty');
  await createQuestion(request, withBank, `Formats question ${tag()}`);

  await page.goto('/practice?tab=custom');
  await pickPreparation(page, withBank.name);
  await expect(page.getByText(/will be drawn from the 1 that match/)).toBeVisible();

  await pickPreparation(page, empty.name);
  await expect(page.getByText(new RegExp(`${empty.name} has no questions yet`))).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start set' })).toBeDisabled();

  await pickPreparation(page, withBank.name);
  await expect(page.getByText(/will be drawn from the 1 that match/)).toBeVisible();
});

test('nothing due on the spaced schedule is stated as the system working', async ({ page, request }) => {
  const prep = await createCertification(request, 'Spaced');
  // Misses enter the schedule a day out, so nothing is due yet.
  await completedMockWithMisses(request, prep, 3);

  await page.goto('/practice?tab=spaced');
  await pickPreparation(page, prep.name);

  await expect(page.getByText('0 due today')).toBeVisible();
  await expect(page.getByText(/That is the system working, not a missed day/)).toBeVisible();

  // The card runner, reached directly, says the same rather than inventing a deck.
  await page.goto('/practice/spaced');
  await expect(page.getByText(/Practising ahead of schedule does not strengthen recall/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show answer' })).toHaveCount(0);
});

test('a full mock the bank cannot fill says so before Start', async ({ page, request }) => {
  const prep = await createCertification(request, 'Short Bank');
  await createQuestion(request, prep, `Only question ${tag()}`);

  await page.goto('/practice?tab=mock');
  await pickPreparation(page, prep.name);

  await expect(page.getByText(/mock is 3 questions and only 1 are available/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start full mock' })).toBeDisabled();
});
