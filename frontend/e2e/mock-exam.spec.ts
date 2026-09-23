// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { expect, test } from '@playwright/test';
import { createCertification, createQuestion, pickPreparation, tag } from './helpers';

/**
 * The certification mock, end to end, as the plan lists it:
 *
 *   start → answer → flag → navigate → reload → resume → submit → result →
 *   review → readiness update
 *
 * The reload is the point. Everything before it could live in the page; only a
 * paper that comes back where it was, with its answers and its flag, is one the
 * server actually kept.
 */

test('a mock survives a reload mid-paper, then submits, scores and updates readiness', async ({ page, request }) => {
  const prep = await createCertification(request, 'Mock Flow'); // 3 questions, 30 minutes, 85% to pass
  for (let i = 0; i < 3; i += 1) await createQuestion(request, prep, `Mock flow question ${i} ${tag()}`);

  const before = await (await request.get(`/api/v1/subjects/${prep.id}`)).json();
  expect(before.readiness.mock_count).toBe(0);

  // Start, from the setup page, which states the paper before it begins.
  await page.goto('/exam-setup');
  await pickPreparation(page, prep.name);
  await expect(page.getByText('3 available · 3 needed')).toBeVisible();
  await page.getByRole('button', { name: 'Start mock' }).click();
  await expect(page.getByText(/Question 1 of 3/)).toBeVisible();

  // Answer and flag the first, then move on.
  await page.getByRole('radio', { name: 'Right' }).check();
  await page.getByRole('button', { name: 'Flag', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText(/Question 2 of 3/)).toBeVisible();

  // Answer the second wrong, and reload without navigating: the pick must have
  // been saved on its own.
  await page.getByRole('radio', { name: 'Wrong' }).check();
  await page.getByRole('button', { name: 'Questions' }).click();
  await expect(page.getByRole('button', { name: /^Question 2, answered/ })).toBeVisible();
  page.on('dialog', (dialog) => dialog.accept());
  await page.reload();

  // Resume: same question, same answer, the first still answered and flagged.
  await expect(page.getByText(/Question 2 of 3/)).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Wrong' })).toBeChecked();
  await page.getByRole('button', { name: 'Questions' }).click();
  await expect(page.getByRole('button', { name: /^Question 1, answered, flagged/ })).toBeVisible();

  // Navigate by the palette, answer the last, submit.
  await page.getByRole('button', { name: /^Question 3,/ }).click();
  await expect(page.getByText(/Question 3 of 3/)).toBeVisible();
  await page.getByRole('radio', { name: 'Right' }).check();
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await expect(page.getByText(/1 flagged for another look/)).toBeVisible();
  await page.getByRole('button', { name: 'Yes, submit' }).click();

  // Result: two of three, under the preparation's 85% pass mark.
  await expect(page).toHaveURL(/\/exam-review\/\d+/);
  await expect(page.getByText('2 of 3 correct')).toBeVisible();
  await expect(page.getByText('under the 85% pass mark')).toBeVisible();
  await expect(page.getByText('1 flagged during the mock')).toBeVisible();
  await expect(page.getByText('Where this leaves you')).toBeVisible();

  // Review: the miss is one click away.
  await page.getByRole('button', { name: 'Read the 1 you got wrong' }).click();
  await expect(page.getByRole('button', { name: /Incorrect/ })).toHaveAttribute('aria-pressed', 'true');

  // Readiness moved on the server, and the setup page's history shows the paper.
  const after = await (await request.get(`/api/v1/subjects/${prep.id}`)).json();
  expect(after.readiness.mock_count).toBe(1);

  await page.goto('/exam-setup');
  const history = page.getByRole('table', { name: 'Previous mocks' });
  await expect(history.getByText('67%')).toBeVisible();
  await expect(history.getByText('Not yet')).toBeVisible();
});

test('an open mock can be resumed or discarded from the setup page', async ({ page, request }) => {
  const prep = await createCertification(request, 'Mock Open');
  for (let i = 0; i < 3; i += 1) await createQuestion(request, prep, `Open mock question ${i} ${tag()}`);
  const created = await request.post('/api/v1/exams', {
    data: { subject_id: prep.id, session_kind: 'mock', exam_mode: 'timed', total_questions: 3, time_allowed_minutes: 30 },
  });
  expect(created.status(), await created.text()).toBe(201);
  const sessionId = (await created.json()).id;

  await page.goto('/exam-setup');
  await pickPreparation(page, prep.name);
  await expect(page.getByText(/A mock is still open/)).toBeVisible();

  await page.getByRole('button', { name: 'Discard' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Discard' }).click();
  await expect(page.getByText(/A mock is still open/)).toHaveCount(0);

  expect((await request.get(`/api/v1/exams/${sessionId}`)).status()).toBe(404);
});
