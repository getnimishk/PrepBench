// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { type APIRequestContext } from '@playwright/test';
import { expect, test } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import { createSkillWithPack, pickPreparation, trackApi, waitForApiIdle } from './helpers';

/**
 * Phase 6: Workspace and Evidence, against a real backend. Both read rows the
 * features already keep -- here, an ADF lab run written exactly as the lab writes
 * it -- scoped to the preparation picked in the header. Another preparation on the
 * same pack sees none of it, in the page or through the API.
 */

const EXPLANATION = 'The completion exit ran on failure, so the watermark skipped rows.';

/** One ADF lab run's Predict and Apply stages, written as frontend/src/services/adfLab/attempts.ts writes them. */
async function labRun(request: APIRequestContext, sid: number): Promise<void> {
  const fp = 'adf-lab=watermark;run=1;model=semiconductor-v1';
  const scope = { subject_id: sid };
  for (const [stage, body] of [
    ['predict', { prediction: 'missing' }],
    ['apply', { prediction: 'retry-upsert' }],
  ] as const) {
    const uid = `ab:${sid}:watermark:r1:${stage}`;
    const opened = await request.post('/api/v1/learning/attempts', {
      data: { attempt_uid: uid, challenge_id: `adf.lab.watermark.${stage}`, concept_id: 'adf.lab.watermark',
        scenario_fingerprint: fp, mode: 'guided', hint_count: 0, subject_id: sid },
    });
    expect(opened.status(), await opened.text()).toBe(201);
    const path = `/api/v1/learning/attempts/${encodeURIComponent(uid)}`;
    expect((await request.patch(path, { params: scope, data: body })).status()).toBe(200);
    const done = stage === 'predict'
      ? { manipulation: { retries: { from: 0, to: 1 } }, observed: { source: 'simulation' }, completed: true, correct: true }
      : { completed: true, correct: true, transfer: true };
    expect((await request.patch(path, { params: scope, data: done })).status()).toBe(200);
  }
  const explained = await request.patch(`/api/v1/learning/attempts/${encodeURIComponent(`ab:${sid}:watermark:r1:predict`)}`,
    { params: scope, data: { explanation_text: EXPLANATION } });
  expect(explained.status()).toBe(200);
}

test('Workspace and Evidence show the chosen preparation\'s own work, survive a reload and follow the picker', async ({ page, request }) => {
  await trackApi(page);
  const mine = await createSkillWithPack(request, 'Workspace Owner', 'adf');
  const other = await createSkillWithPack(request, 'Workspace Other', 'adf');
  await labRun(request, mine.id);

  await page.goto('/');
  await pickPreparation(page, mine.name);

  // Reached from the sidebar, under its own group.
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Workspace' }).click();
  await expect(page).toHaveURL(/\/workspace$/);
  const own = page.getByRole('region', { name: mine.name });
  await expect(own.getByRole('heading', { level: 3, name: 'Watermark & Transient Failure' })).toBeVisible();
  await expect(own.getByText(EXPLANATION)).toBeVisible();
  await expect(own.getByText(/2 of 4 graded stages finished/)).toBeVisible();
  await expect(own.getByRole('link', { name: 'Open Watermark & Transient Failure' })).toHaveAttribute('href', '/lab/adf/watermark');

  // A reload keeps the preparation and the work.
  await page.reload();
  await expect(page.getByRole('region', { name: mine.name }).getByText(EXPLANATION)).toBeVisible();

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Evidence' }).click();
  await expect(page).toHaveURL(/\/evidence$/);
  const evidence = page.getByRole('region', { name: mine.name });
  await expect(evidence.getByRole('heading', { level: 3, name: 'Watermark & Transient Failure · Predict · run 1' })).toBeVisible();
  await expect(evidence.getByText(/your explanation is recorded \(not graded\)/)).toBeVisible();
  await expect(evidence.getByText(/applied to a changed constraint/)).toBeVisible();
  await expect(evidence.getByText('Evidenced', { exact: true }).first()).toBeVisible();

  // Another preparation on the same pack: nothing of the first, here or through the API.
  await pickPreparation(page, other.name);
  const theirs = page.getByRole('region', { name: other.name });
  await expect(theirs.getByText('No evidence yet')).toBeVisible();
  await expect(page.getByText(EXPLANATION)).toHaveCount(0);
  await page.goto('/workspace');
  await expect(page.getByRole('region', { name: other.name }).getByText('Nothing in this workspace yet')).toBeVisible();
  await expect(page.getByText(EXPLANATION)).toHaveCount(0);

  // Back and forward keep the chosen preparation.
  await page.goBack();
  await expect(page).toHaveURL(/\/evidence$/);
  await expect(page.getByRole('region', { name: other.name }).getByText('No evidence yet')).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/\/workspace$/);

  const api = async (path: string, sid: number | null) =>
    (await (await request.get(path, sid === null ? undefined : { params: { subject_id: sid } })).json()).items as { id: string }[];
  expect(await api('/api/v1/workspace', other.id)).toEqual([]);
  expect(await api('/api/v1/evidence', other.id)).toEqual([]);
  expect((await api('/api/v1/workspace', mine.id)).map((i) => i.id)).toEqual([`lab_run:${mine.id}:watermark:1`]);
  // No preparation is work with no owner -- never another preparation's.
  expect((await api('/api/v1/workspace', null)).some((i) => i.id.includes(`:${mine.id}:`))).toBe(false);
});

test('Workspace and Evidence pass axe in both themes, with work on them, and fit a 390px phone', async ({ page, request }) => {
  await trackApi(page);
  test.setTimeout(180_000);
  const prep = await createSkillWithPack(request, 'Workspace Axe', 'adf');
  await labRun(request, prep.id);
  await page.goto('/');
  await pickPreparation(page, prep.name);

  const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
  try {
    for (const theme of ['light', 'dark'] as const) {
      await request.put('/api/v1/settings', { data: { theme } });
      for (const route of ['/workspace', '/evidence']) {
        await page.goto(route);
        await expect(page.getByRole('region', { name: prep.name }).getByRole('heading', { level: 3 }).first()).toBeVisible();
        await waitForApiIdle(page);
        const results = await new AxeBuilder({ page }).withTags(tags).analyze();
        const violations = results.violations.map((v) => `${theme} ${route} — ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
        expect(violations, violations.join('\n')).toEqual([]);

        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(200);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${theme} ${route} scrolls sideways at 390px`).toBeLessThanOrEqual(0);
        await page.setViewportSize({ width: 1280, height: 800 });
      }
    }
  } finally {
    await request.put('/api/v1/settings', { data: { theme: 'light' } });
  }
});
