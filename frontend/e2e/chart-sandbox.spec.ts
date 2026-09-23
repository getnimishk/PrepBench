// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { expect, test, type APIRequestContext } from '@playwright/test';
import { tag } from './helpers';

/**
 * The Chart Sandbox's evidence, end to end: a prediction committed, the model's
 * own numbers shown as what actually happened, the learner's explanation saved
 * -- all of it on the server, and all of it still there after a reload.
 */

interface WireAttempt {
  attempt_uid: string;
  prediction: string | null;
  committed_at: string | null;
  completed_at: string | null;
  started_at: string;
  hint_count: number;
  observed: Record<string, { before: number; after: number }> | null;
  explanation_text: string | null;
}

const LEGACY_KEY = 'prepbench.learning.attempts.v1';

async function attempts(request: APIRequestContext): Promise<WireAttempt[]> {
  return (await request.get('/api/v1/learning/attempts')).json();
}

test('a prediction, what the model showed and the explanation are kept, and survive a reload', async ({ page, request }) => {
  await page.goto('/chart-sandbox');

  const prediction = page.getByRole('group', { name: 'Your prediction' });
  await expect(prediction).toBeVisible();
  await prediction.getByRole('button').first().click();

  const happened = page.getByRole('region', { name: 'What actually happened' });
  await expect(happened).toBeVisible();
  await expect(happened).toContainText(/Changed from the baseline|Nothing was changed from the baseline/);

  const words = `More work started means more waiting behind the constraint ${tag()}`;
  await page.getByLabel('Your explanation').fill(words);
  await page.getByRole('button', { name: 'Save explanation' }).click();
  await expect(page.getByText('Saved with this attempt. Not scored.')).toBeVisible();

  // On the server: one attempt, with its prediction, its result and the model's figures.
  const saved = (await attempts(request)).filter((a) => a.explanation_text === words);
  expect(saved).toHaveLength(1);
  expect(saved[0].prediction).toBeTruthy();
  expect(saved[0].committed_at).toBeTruthy();
  expect(saved[0].completed_at).toBeTruthy();
  expect(Object.keys(saved[0].observed ?? {})).toContain('cycleTime');

  // And on the page, after a reload.
  await page.reload();
  await page.getByRole('button', { name: 'How you are getting on' }).click();
  const recent = page.getByRole('region', { name: 'Your recent experiments' });
  await expect(recent.getByText(`Your explanation: ${words}`)).toBeVisible();
});

test('answers kept only in this browser are moved to the server once, with their own times', async ({ page, request }) => {
  const uid = `legacy-${tag()}-${tag()}`;
  const legacy = [{
    attemptId: uid,
    challengeId: 'wip-first-prediction',
    conceptId: 'wip',
    scenarioFingerprint: 'wip=8',
    mode: 'guided',
    startedAt: '2026-08-01T09:00:00.000Z',
    committedAt: '2026-08-01T09:01:00.000Z',
    completedAt: '2026-08-01T09:01:05.000Z',
    prediction: 'more',
    correct: false,
    transfer: false,
    hintCount: 1,
    durationMs: 65000,
  }];

  // Written the way the old client wrote it, before the sandbox is opened.
  await page.goto('/');
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [LEGACY_KEY, JSON.stringify(legacy)]);

  await page.goto('/chart-sandbox');
  await expect(page.getByRole('group', { name: 'Your prediction' })).toBeVisible();

  const imported = (await attempts(request)).filter((a) => a.attempt_uid === uid);
  expect(imported).toHaveLength(1);
  expect(imported[0].started_at).toMatch(/^2026-08-01T09:00:00/);
  expect(imported[0].committed_at).toMatch(/^2026-08-01T09:01:00/);
  expect(imported[0].prediction).toBe('more');
  expect(imported[0].hint_count).toBe(1);
  expect(await page.evaluate((key) => localStorage.getItem(key), LEGACY_KEY)).toBeNull();

  // A second visit brings nothing across twice.
  await page.reload();
  await expect(page.getByRole('group', { name: 'Your prediction' })).toBeVisible();
  expect((await attempts(request)).filter((a) => a.attempt_uid === uid)).toHaveLength(1);
});
