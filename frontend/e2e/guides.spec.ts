// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { expect, test } from '@playwright/test';
import { createCertification, createSkillWithPack, pickPreparation } from './helpers';

/**
 * Built-in guides in the Study Library (skills-and-content-packs-plan.md Phase 2).
 *
 * A learner with an ADF skill can read all 21 chapters. The version shown is
 * the one their preparation actually pinned -- so with the pack attached
 * (the normal case here), the "not attached" note must never appear.
 */

test('a preparation with the ADF pack lists its guide in the Study Library, and every chapter opens', async ({ page, request }) => {
  const prep = await createSkillWithPack(request, 'Guides ADF', 'adf');

  await page.goto('/');
  await pickPreparation(page, prep.name);
  await page.goto('/learn');

  const guidePanel = page.getByRole('region', { name: 'Azure Data Factory' });
  await expect(guidePanel.getByText('21 chapters')).toBeVisible();
  await expect(page.getByText('Not attached', { exact: false })).toHaveCount(0);

  await page.getByRole('link', { name: 'All chapters' }).click();
  await expect(page).toHaveURL('/learn/guides/adf');
  await expect(page.getByRole('heading', { name: 'Azure Data Factory' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Read chapter \d+/ })).toHaveCount(21);
  await expect(page.getByText('Not attached', { exact: false })).toHaveCount(0);

  // The longest chapter: Pitfalls, chapter 21, four tables.
  await page.getByRole('link', { name: 'Read chapter 21: Pitfalls: every trap in one place' }).click();
  await expect(page).toHaveURL('/learn/guides/adf/pitfalls');
  await expect(page.getByRole('heading', { name: /21 · Pitfalls/ })).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(4);
  await expect(page.getByText('Not attached', { exact: false })).toHaveCount(0);

  // Chapter navigation and the way back.
  await page.getByRole('link', { name: /^Previous:/ }).click();
  await expect(page).toHaveURL('/learn/guides/adf/fabric');
  await page.getByRole('link', { name: 'All chapters' }).click();
  await expect(page).toHaveURL('/learn/guides/adf');
});

test('a guide chapter shows the latest version and says so, for a preparation that has not attached the pack', async ({ page, request }) => {
  const prep = await createCertification(request, 'Guides Unattached');

  await page.goto('/');
  await pickPreparation(page, prep.name);
  await page.goto('/learn/guides/adf/what-it-is');

  await expect(page.getByText(`Not attached to ${prep.name}`, { exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: /1 · What ADF is/ })).toBeVisible();
});
