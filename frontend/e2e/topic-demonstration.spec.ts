// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { expect, test, type APIRequestContext } from '@playwright/test';
import { tag } from './helpers';

/**
 * A roadmap topic, learnt and demonstrated, in a real browser.
 *
 * Plan section 11's chain -- topic, objective, demonstration, evidence,
 * completion -- walked end to end, with the database checked after each step
 * rather than the page's word taken for it.
 */

async function roadmapWithTopic(request: APIRequestContext) {
  const roadmap = await (await request.post('/api/v1/roadmaps', { data: { title: `E2E Roadmap ${tag()}` } })).json();
  const phase = await (await request.post(`/api/v1/roadmaps/${roadmap.id}/phases`, { data: { name: 'Core Foundations' } })).json();
  const topic = await (await request.post(`/api/v1/roadmaps/${roadmap.id}/topics`, {
    data: {
      phase_id: phase.id,
      title: 'Topics, Partitions, Offsets',
      learning_objective: "Understand Kafka's append-only log storage model.",
      success_criteria: 'Explain partition ordering guarantees and how offsets work.',
      estimated_hours: 3,
    },
  })).json();
  return { roadmapId: roadmap.id as number, topicId: topic.id as number };
}

async function topicStatus(request: APIRequestContext, roadmapId: number, topicId: number) {
  const detail = await (await request.get(`/api/v1/roadmaps/${roadmapId}`)).json();
  for (const phase of detail.phases) {
    const found = phase.topics.find((t: { id: number }) => t.id === topicId);
    if (found) return found;
  }
  throw new Error('topic not found');
}

test('a topic is completed by demonstrating it, and the evidence is kept', async ({ page, request }) => {
  const { roadmapId, topicId } = await roadmapWithTopic(request);
  const answer = 'Ordering holds within a partition because it is an append-only log; offsets are positions in it.';

  await page.goto(`/roadmaps/${roadmapId}/topics/${topicId}`);
  await expect(page.getByRole('heading', { name: 'Topics, Partitions, Offsets', level: 1 })).toBeVisible();
  await expect(page.getByText('Explain partition ordering guarantees and how offsets work.')).toBeVisible();

  // No shortcut to completion anywhere on the page.
  await expect(page.getByRole('button', { name: /^Completed$/ })).toHaveCount(0);

  await page.getByRole('button', { name: 'Demonstrate', exact: true }).click();

  // The standard cannot be revealed before an answer is written.
  const reveal = page.getByRole('button', { name: /reveal the standard/ });
  await expect(reveal).toBeDisabled();
  await page.getByLabel('Explain it in your own words').fill(answer);
  await expect(reveal).toBeEnabled();

  // And the grading choices do not exist until it is.
  await expect(page.getByRole('button', { name: /complete it/ })).toHaveCount(0);
  await reveal.click();

  await page.getByRole('button', { name: /Yes, unprompted/ }).click();

  await expect(page).toHaveURL(new RegExp(`/roadmaps/${roadmapId}/topics/${topicId}$`));
  await expect(page.getByText(answer)).toBeVisible();

  // The database, not the page.
  const saved = await topicStatus(request, roadmapId, topicId);
  expect(saved.status).toBe('completed');
  expect(saved.progress_percentage).toBe(100);

  const history = await (await request.get(`/api/v1/roadmaps/${roadmapId}/topics/${topicId}/demonstrations`)).json();
  expect(history).toHaveLength(1);
  expect(history[0].self_grade).toBe('yes');
  expect(history[0].response_text).toBe(answer);
});

test('the roadmap table will not complete a topic from the status menu', async ({ page, request }) => {
  const { roadmapId, topicId } = await roadmapWithTopic(request);

  await page.goto(`/roadmaps/${roadmapId}`);
  await page.getByLabel('Status for Topics, Partitions, Offsets').click();
  await expect(page.getByRole('option', { name: /demonstrate the topic to complete it/ })).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Escape');

  // And the API refuses it too, so the rule is not only a disabled menu item.
  const refused = await request.patch(`/api/v1/roadmaps/${roadmapId}/topics/${topicId}`, { data: { status: 'completed' } });
  expect(refused.status()).toBe(400);
  expect((await topicStatus(request, roadmapId, topicId)).status).toBe('not_started');
});
