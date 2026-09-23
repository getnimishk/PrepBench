// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { expect, test, type Page } from '@playwright/test';
import { createCertification, createQuestion, tag } from './helpers';

/**
 * What happens when the server stops answering, simulated by refusing every API
 * request from the browser: the app says so, work being written is kept on the
 * device and never called saved, and it is sent once the server is back.
 */

const cutOff = (page: Page) => page.route('**/api/v1/**', (route) => route.abort('connectionrefused'));
const restore = (page: Page) => page.unroute('**/api/v1/**');

test('an answer written while the server is unreachable is kept on the device, then saved when it is back', async ({ page, request }) => {
  const prompts = await (await request.get('/api/v1/system-design/prompts?limit=1')).json();
  const promptId = prompts.items[0].id;
  const words = `Queue writes behind a durable log ${tag()}`;

  await page.goto(`/system-design/${promptId}/answer`);
  const architecture = page.getByLabel(/High-level architecture/i);
  await expect(architecture).toBeVisible();

  await cutOff(page);
  await architecture.fill(words);

  // Not called saved: kept on this device, and the app says the server is gone.
  await expect(page.getByText('Saved on this device · not on the server yet')).toBeVisible();
  await expect(page.getByText(/Can't reach PrepBench's server, so nothing you do now is being saved/)).toBeVisible();
  const kept = await page.evaluate((key) => localStorage.getItem(key), `prepbench.draft.systemDesign:${promptId}`);
  expect(kept).toContain(words);

  await restore(page);
  await page.getByRole('button', { name: 'Try again' }).click();

  await expect(page.getByText('Connected to the server again.')).toBeVisible();
  await expect(page.getByText(/^Saved · at /)).toBeVisible();
  const draft = await (await request.get(`/api/v1/system-design/prompts/${promptId}/draft`)).json();
  expect(draft.sections.architecture).toBe(words);
  expect(await page.evaluate((key) => localStorage.getItem(key), `prepbench.draft.systemDesign:${promptId}`)).toBeNull();

  await page.reload();
  await expect(page.getByLabel(/High-level architecture/i)).toHaveValue(words);
});

test('edits kept on the device survive closing the tab before the server comes back', async ({ page, request }) => {
  const prompts = await (await request.get('/api/v1/system-design/prompts?limit=2')).json();
  const promptId = prompts.items[prompts.items.length - 1].id;
  const words = `Shard by region, replicate within it ${tag()}`;

  await page.goto(`/system-design/${promptId}/answer`);
  await expect(page.getByLabel(/Trade-offs/i)).toBeVisible();

  await cutOff(page);
  await page.getByLabel(/Trade-offs/i).fill(words);
  await expect(page.getByText('Saved on this device · not on the server yet')).toBeVisible();

  // The server is back, but this page is gone; the next visit restores and sends the kept edits.
  await restore(page);
  await page.goto('/');
  await page.goto(`/system-design/${promptId}/answer`);

  await expect(page.getByLabel(/Trade-offs/i)).toHaveValue(words);
  await expect(page.getByText(/Restored edits that were kept on this device/)).toBeVisible();
  await expect.poll(async () => (await (await request.get(`/api/v1/system-design/prompts/${promptId}/draft`)).json()).sections?.trade_offs).toBe(words);
});

test('a screen that cannot load says why and that nothing changed, and loads on retry', async ({ page }) => {
  await cutOff(page);
  await page.goto('/roadmaps');

  const failure = page.getByText(/Could not load your roadmaps\. Could not reach the PrepBench server\..*Nothing was changed\./);
  await expect(failure).toBeVisible();

  await restore(page);
  await page.getByRole('button', { name: 'Retry' }).first().click();
  await expect(failure).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Roadmaps', level: 1 })).toBeVisible();
});

/**
 * Screens that used to answer a failed read with a claim about the learner's
 * data: an empty list, a zero, a step still to do. Each is opened with the
 * server gone, and must say what failed and claim none of those.
 */
const SCREENS: { route: string; failure: RegExp }[] = [
  { route: '/preparations', failure: /Could not load your preparations/ },
  { route: '/exam-setup', failure: /Could not load your preparations/ },
  { route: '/practice', failure: /Could not load your preparations/ },
  { route: '/review', failure: /Could not load your review queue/ },
  { route: '/interview-practice', failure: /Could not load the interview rounds/ },
  { route: '/interview-practice/library', failure: /Could not load the question library/ },
  { route: '/settings/ai', failure: /Could not load your AI providers/ },
  { route: '/settings', failure: /Could not be read/ },
  { route: '/onboarding', failure: /could not be checked/ },
];

const CLAIMS = [
  /No preparations yet/, /No questions in this round yet/, /No questions here yet/, /No AI provider set up yet/,
  /All · 0/, /\b0 active/, /steps to go/, /Nothing to review/, /None configured/,
];

test('no screen calls data it could not read empty', async ({ page }) => {
  test.setTimeout(120_000);
  await cutOff(page);
  for (const { route, failure } of SCREENS) {
    await page.goto(route);
    const main = page.locator('main');
    await expect(main.getByText(failure).first(), route).toBeVisible();
    await page.waitForLoadState('networkidle');
    for (const claim of CLAIMS) {
      await expect(main, `${route} claims ${claim}`).not.toContainText(claim);
    }
  }
});

test('the preparation picker recovers by itself once the server answers', async ({ page }) => {
  await cutOff(page);
  await page.goto('/review');
  const picker = page.getByRole('button', { name: /^Preparation: / });
  await expect(picker).toHaveAccessibleName(/Preparations unavailable/);

  await restore(page);
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('Connected to the server again.')).toBeVisible();
  // No reload: the list is asked for again when the server answers.
  await expect(picker).not.toHaveAccessibleName(/Preparations unavailable|Loading/);
});

test('mock answers picked while the server is unreachable are kept, sent when it is back, and counted', async ({ page, request }) => {
  const prep = await createCertification(request, 'Offline Mock');
  for (let i = 0; i < 3; i += 1) await createQuestion(request, prep, `Offline mock question ${i} ${tag()}`);
  const created = await request.post('/api/v1/exams', {
    data: { subject_id: prep.id, session_kind: 'mock', exam_mode: 'timed', total_questions: 3, time_allowed_minutes: 30 },
  });
  expect(created.status(), await created.text()).toBe(201);
  const sessionId = (await created.json()).id;
  const answered = async () => {
    const detail = await (await request.get(`/api/v1/exams/${sessionId}`)).json();
    return (detail.answers as { selected_option_ids: number[] }[]).filter((a) => a.selected_option_ids.length > 0).length;
  };

  page.on('dialog', (dialog) => dialog.accept());
  await page.goto(`/exam/${sessionId}`);
  await expect(page.getByText(/Question 1 of 3/)).toBeVisible();

  // Picked with the server gone: kept on the device, still answered on screen, not called saved.
  await cutOff(page);
  await page.getByRole('radio', { name: 'Right' }).check();
  await expect(page.getByText('Saved on this device · 1 answer not on the server yet')).toBeVisible();
  await page.getByRole('button', { name: 'Questions' }).click();
  await expect(page.getByRole('button', { name: /^Question 1, answered/ })).toBeVisible();
  expect(await answered()).toBe(0);

  // Sent as soon as the server answers, without leaving the paper.
  await restore(page);
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('Saved · every answer is on the server')).toBeVisible();
  expect(await answered()).toBe(1);

  // Kept across a closed tab: picked with the server gone, restored and sent on the next visit.
  await page.getByRole('button', { name: /^Question 2,/ }).click();
  await expect(page.getByText(/Question 2 of 3/)).toBeVisible();
  await cutOff(page);
  await page.getByRole('radio', { name: 'Wrong' }).check();
  await expect(page.getByText('Saved on this device · 1 answer not on the server yet')).toBeVisible();
  await restore(page);
  await page.reload();

  await expect(page.getByText(/Question 2 of 3/)).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Wrong' })).toBeChecked();
  await expect(page.getByText('Saved · every answer is on the server')).toBeVisible();
  await expect.poll(answered).toBe(2);
});
