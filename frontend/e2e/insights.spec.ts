// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { expect, test } from '@playwright/test';
import { completedMockWithMisses, createCertification, pickPreparation, tag } from './helpers';

/**
 * Insights, against real answers: one preparation's areas and no other's, an
 * area opened to its misses and questions, a recommendation's working shown,
 * and a question opened from the list.
 */

test("Insights shows the picked preparation's areas only, and opens one to what was answered in it", async ({ page, request }) => {
  const mine = await createCertification(request, 'Insights Mine');
  const theirs = await createCertification(request, 'Insights Theirs');
  const myArea = `Mine Area ${tag()}`;
  const theirArea = `Their Area ${tag()}`;
  await completedMockWithMisses(request, mine, 3, myArea);
  await completedMockWithMisses(request, theirs, 3, theirArea);

  await page.goto('/analytics');
  await pickPreparation(page, mine.name);

  const row = page.getByRole('link', { name: new RegExp(`^${myArea}: 0%`) }).last();
  await expect(row).toBeVisible();
  // The other preparation's area is not on this preparation's page.
  await expect(page.getByText(theirArea)).toHaveCount(0);

  // What the verdict rests on, and what would change it.
  await page.getByRole('button', { name: 'Why am I seeing this?' }).first().click();
  await expect(page.getByRole('region', { name: 'Why am I seeing this' }).first()).toContainText('What would change it');

  await row.click();
  await expect(page).toHaveURL(new RegExp(`/analytics/area\\?subject=${mine.id}&domain=`));
  await expect(page.getByRole('heading', { name: myArea })).toBeVisible();
  await expect(page.getByText('0 of 3 answers')).toBeVisible();
  await expect(page.getByText('answered wrong at least once')).toBeVisible();
  await expect(page.getByRole('link', { name: /Practise this area/ })).toHaveAttribute(
    'href', `/exam-setup?kind=drill&subject=${mine.id}&domain=${encodeURIComponent(myArea)}`,
  );

  // The server said the same thing the page shows.
  const detail = await (await request.get(
    `/api/v1/analytics/domain-detail?subject_id=${mine.id}&domain=${encodeURIComponent(myArea)}`,
  )).json();
  expect(detail).toMatchObject({ answers: 3, correct: 0, missed_questions: 3, question_count: 3 });

  const questions = page.getByRole('region', { name: 'Questions in this area' });
  await expect(questions.getByText('Missed', { exact: true })).toHaveCount(3);

  // Open one: the Question Bank shows it.
  const first = detail.questions[0];
  await questions.getByRole('link', { name: /Open question/ }).first().click();
  await expect(page).toHaveURL(new RegExp(`/question-bank\\?question=${first.id}`));
  await expect(page.getByText(first.text).first()).toBeVisible();
});

test('picking another preparation on an area page goes back to Insights for that preparation', async ({ page, request }) => {
  const one = await createCertification(request, 'Area One');
  const two = await createCertification(request, 'Area Two');
  const oneArea = `One Area ${tag()}`;
  const twoArea = `Two Area ${tag()}`;
  await completedMockWithMisses(request, one, 3, oneArea);
  await completedMockWithMisses(request, two, 3, twoArea);

  await page.goto('/analytics');
  await pickPreparation(page, one.name);
  await page.getByRole('link', { name: new RegExp(`^${oneArea}: 0%`) }).last().click();
  await expect(page.getByRole('heading', { name: oneArea })).toBeVisible();

  await pickPreparation(page, two.name);

  await expect(page).toHaveURL(/\/analytics$/);
  await expect(page.getByRole('link', { name: new RegExp(`^${twoArea}: 0%`) }).last()).toBeVisible();
  await expect(page.getByText(oneArea)).toHaveCount(0);
});
