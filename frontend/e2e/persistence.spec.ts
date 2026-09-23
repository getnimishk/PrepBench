// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { expect, test } from '@playwright/test';
import { createCertification, createQuestion, pickPreparation, tag } from './helpers';
import { dbRow } from './db';

/**
 * Plan §30: a change survives navigation and a hard reload, and is in the
 * database. The items on the plan's list that the other journeys do not already
 * reload are here: a question edit, a design review decision and topic progress.
 * The rest -- preparation selection, evidence, imported questions, practice
 * answers, the review schedule, exam progress, interview takes, the System
 * Design draft and settings -- are reloaded in their own specs.
 */

test('an edited question keeps its new wording and explanation after a reload', async ({ page, request }) => {
  const prep = await createCertification(request, 'Persist Edit');
  const t = tag();
  const before = `Before the edit ${t}: who orders the Product Backlog?`;
  const after = `After the edit ${t}: who is accountable for ordering the Product Backlog?`;
  const questionId = await createQuestion(request, prep, before);

  await page.goto('/question-bank');
  await pickPreparation(page, prep.name);
  await page.getByRole('row').filter({ hasText: before }).getByRole('button', { name: 'Edit Question' }).click();

  const editor = page.getByRole('dialog');
  await editor.getByLabel('Question stem').fill(after);
  await editor.getByLabel('Explanation', { exact: true }).fill(`The Product Owner orders it. ${t}`);
  await editor.getByRole('button', { name: 'Save changes' }).click();
  await expect(editor).toBeHidden();

  await page.reload();
  await expect(page.getByText(after)).toBeVisible();
  await expect(page.getByText(before)).toHaveCount(0);
  expect(dbRow('SELECT text, explanation FROM questions WHERE id = ?', questionId))
    .toEqual({ text: after, explanation: `The Product Owner orders it. ${t}` });
});

test('a design review decision is still there, with its reasoning, after a reload', async ({ page, request }) => {
  const { items } = await (await request.get('/api/v1/design-reviews?limit=500')).json();
  const review = items.find((r: { attempted: boolean }) => !r.attempted);
  expect(review, 'an unattempted design review').toBeTruthy();
  const reasoning = `It turns on the read-to-write ratio, so I would ask for it first. ${tag()}`;

  await page.goto(`/design-reviews/${review.id}`);
  await page.getByRole('radio', { name: /^Option B:/ }).check();
  await page.getByPlaceholder(/What is this decision actually about/).fill(reasoning);
  await page.getByRole('button', { name: /^Commit decision/ }).click();
  await expect(page.getByText('The deciding axis', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText('You said · Option B')).toBeVisible();
  await expect(page.getByText(reasoning).first()).toBeVisible();
  expect(dbRow('SELECT choice, justification FROM design_review_attempts WHERE review_id = ? ORDER BY id DESC', review.id))
    .toEqual({ choice: 'B', justification: reasoning });
});

test('topic progress set on the topic page is kept after a reload', async ({ page, request }) => {
  const roadmap = await (await request.post('/api/v1/roadmaps', { data: { title: `Persist roadmap ${tag()}` } })).json();
  const phase = await (await request.post(`/api/v1/roadmaps/${roadmap.id}/phases`, { data: { name: 'Phase' } })).json();
  const topic = await (await request.post(`/api/v1/roadmaps/${roadmap.id}/topics`, {
    data: { phase_id: phase.id, title: 'Scrum Pillars', success_criteria: 'Name the three pillars.' },
  })).json();

  await page.goto(`/roadmaps/${roadmap.id}/topics/${topic.id}`);
  await page.getByRole('button', { name: 'In progress', exact: true }).click();
  await expect(page.getByRole('button', { name: 'In progress', exact: true })).toBeDisabled();

  await page.reload();
  await expect(page.getByText('In progress', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'In progress', exact: true })).toBeDisabled();
  expect(dbRow<{ status: string }>('SELECT status FROM roadmap_topics WHERE id = ?', topic.id)?.status)
    .toMatch(/^in_progress$/i);
});
