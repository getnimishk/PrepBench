// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { expect, test } from '@playwright/test';
import { createCertification, tag } from './helpers';

/**
 * Adding, archiving and deleting a preparation through the screens, with the
 * database checked after each step rather than trusting what the page says.
 * A toast or a redirect is not evidence that anything was saved.
 */

test('a preparation added through the form is saved, selected and listed', async ({ page, request }) => {
  const name = `Form Added ${tag()}`;

  await page.goto('/preparations/new');
  await page.getByRole('button', { name: /A named exam/ }).click();

  // By role, exact. getByLabel('Name') also matches "Certification name on your
  // questions", and an exact label match finds nothing because MUI renders the
  // required field's label as "Name *" -- the asterisk is hidden from the
  // accessible name, which is what the role query reads.
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill(name);
  await page.getByLabel('Certification name on your questions').fill(`${name} Certification`);
  await page.getByRole('button', { name: 'Create preparation' }).click();

  await expect(page).toHaveURL(/\/preparations$/);
  await expect(page.getByRole('button', { name: `Preparation: ${name}. Change preparation` }))
    .toBeVisible();

  // Saved, not just shown.
  const listed = await (await request.get('/api/v1/subjects')).json();
  const saved = listed.find((s: { name: string }) => s.name === name);
  expect(saved, 'preparation was not saved').toBeTruthy();
  expect(saved.kind).toBe('certification');
  expect(saved.pass_mark).toBe(85);
});

test('a certification without a name cannot be submitted', async ({ page }) => {
  await page.goto('/preparations/new');
  await page.getByRole('button', { name: /A named exam/ }).click();

  await expect(page.getByRole('button', { name: 'Create preparation' })).toBeDisabled();
});

test('archiving hides a preparation from the picker and restoring brings it back', async ({ page, request }) => {
  const prep = await createCertification(request, 'Archivable');

  await page.goto('/preparations');
  const row = page.locator('div').filter({ hasText: prep.name }).filter({
    has: page.getByRole('button', { name: 'Archive' }),
  }).last();
  await row.getByRole('button', { name: 'Archive' }).click();

  await expect.poll(async () => {
    const all = await (await request.get('/api/v1/subjects')).json();
    return all.find((s: { id: number }) => s.id === prep.id)?.is_archived;
  }).toBe(true);

  await page.getByRole('button', { name: /^Preparation:/ }).click();
  await expect(page.getByRole('menuitem', { name: new RegExp(prep.name) })).toHaveCount(0);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Restore' }).first().click();
  await expect.poll(async () => {
    const all = await (await request.get('/api/v1/subjects')).json();
    return all.find((s: { id: number }) => s.id === prep.id)?.is_archived;
  }).toBe(false);
});

test('delete refuses until the name is typed exactly, then really deletes', async ({ page, request }) => {
  const prep = await createCertification(request, 'Doomed');

  await page.goto(`/preparations/${prep.id}/edit`);
  await page.getByRole('button', { name: 'Delete', exact: true }).click();

  const confirm = page.getByRole('button', { name: 'Delete permanently' });
  const nameField = page.getByRole('dialog').getByRole('textbox');

  await expect(confirm).toBeDisabled();
  await nameField.fill('not the name');
  await expect(confirm).toBeDisabled();

  await nameField.fill(prep.name);
  await expect(confirm).toBeEnabled();
  await confirm.click();

  await expect(page).toHaveURL(/\/preparations$/);
  expect((await request.get(`/api/v1/subjects/${prep.id}`)).status()).toBe(404);

  // And the picker must not be left pointing at the preparation that is gone --
  // a real bug found while building this screen.
  await expect(page.getByRole('button', { name: 'Preparation: No preparation. Change preparation' }))
    .toHaveCount(0);
});
