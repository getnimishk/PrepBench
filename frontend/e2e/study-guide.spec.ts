// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { expect, test, type APIRequestContext } from '@playwright/test';
import { tag } from './helpers';

/**
 * A topic's study guide, in a real browser.
 *
 * The E2E backend runs with no AI provider (playwright.config.ts blanks the key),
 * which is exactly the state worth testing: the page must say drafting is not set
 * up rather than produce placeholder content, and a learner-written guide must
 * work end to end without it. The AI drafting path itself is covered by the
 * backend suite against a faked transport.
 */

async function roadmapTopic(request: APIRequestContext) {
  const roadmap = await (await request.post('/api/v1/roadmaps', { data: { title: `Guide E2E ${tag()}` } })).json();
  const phase = await (await request.post(`/api/v1/roadmaps/${roadmap.id}/phases`, { data: { name: 'Phase 1' } })).json();
  const topic = await (await request.post(`/api/v1/roadmaps/${roadmap.id}/topics`, {
    data: {
      phase_id: phase.id,
      title: 'Consumer Groups & Assignment',
      learning_objective: 'Understand how partitions are assigned across consumers in a group.',
      success_criteria: 'Explain max parallelism for a given partition count and group size.',
    },
  })).json();
  return { roadmapId: roadmap.id as number, topicId: topic.id as number };
}

test('with no AI set up, the guide says so and nothing is invented', async ({ page, request }) => {
  const { roadmapId, topicId } = await roadmapTopic(request);

  await page.goto(`/roadmaps/${roadmapId}/topics/${topicId}/guide`);

  await expect(page.getByText('No study guide yet')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Draft with AI' })).toBeDisabled();
  await expect(page.getByText(/No AI provider is set up for drafting study guides/)).toBeVisible();

  const guide = await (await request.get(`/api/v1/roadmaps/${roadmapId}/topics/${topicId}/guide`)).json();
  expect(guide.sections).toEqual([]);
});

test('a guide written by the learner is saved, read, and does not complete the topic', async ({ page, request }) => {
  const { roadmapId, topicId } = await roadmapTopic(request);

  await page.goto(`/roadmaps/${roadmapId}/topics/${topicId}`);
  await page.getByRole('button', { name: 'Study guide' }).click();

  await page.getByRole('button', { name: 'Write a section' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Title').fill('Parallelism is capped by partitions');
  await dialog.getByLabel('Explanation').fill('Each partition is read by at most one consumer in a group, so extra consumers sit idle.');
  await dialog.getByLabel('Check question (optional)').fill('Six partitions, eight consumers: how many are busy?');
  await dialog.getByLabel('Model answer (optional)').fill('Six. Two consumers have no partition to read.');
  await dialog.getByRole('button', { name: 'Save section' }).click();

  await expect(page.getByRole('heading', { name: 'Parallelism is capped by partitions' })).toBeVisible();
  await expect(page.getByText('Written by you')).toBeVisible();

  // The self-check reveals the model answer only after an answer is written.
  const compare = page.getByRole('button', { name: 'Compare with the model answer' });
  await expect(compare).toBeDisabled();
  await page.getByPlaceholder('Answer it before you look.').fill('Six, since each partition has one reader.');
  await compare.click();
  await expect(page.getByText('Six. Two consumers have no partition to read.')).toBeVisible();

  await page.getByRole('button', { name: 'I have read this' }).click();
  await expect(page.getByText('1 of 1 sections read')).toBeVisible();

  // Survives a reload.
  await page.reload();
  await expect(page.getByText('1 of 1 sections read')).toBeVisible();

  // Reading is not completion.
  const detail = await (await request.get(`/api/v1/roadmaps/${roadmapId}`)).json();
  const topic = detail.phases[0].topics.find((t: { id: number }) => t.id === topicId);
  expect(topic.status).not.toBe('completed');

  // The way on is demonstrating it.
  await expect(page.getByRole('button', { name: 'Demonstrate this topic' })).toBeVisible();
});
