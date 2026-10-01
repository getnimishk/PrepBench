// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { expect, test } from './fixtures';
import { createCertification, createSheetRoadmap, pickPreparation } from './helpers';

/**
 * A workbook's extra sheets, routed by purpose.
 *
 * Roadmaps is the plan: every sheet has a tab, named after it. The Study
 * Library is what to learn now: it lists the *reference* sheets of the selected
 * preparation's roadmaps, each opening its Roadmaps tab. A plan sheet stays in
 * Roadmaps, and the learner can move a sheet either way from its tab.
 */

test('a roadmap shows a tab per sheet, and the Study Library lists only reference sheets', async ({ page, request }) => {
  const prep = await createCertification(request, 'Sheets');
  const other = await createCertification(request, 'Sheets Other');
  const mine = await createSheetRoadmap(request, prep.id, 'Mine');
  const theirs = await createSheetRoadmap(request, other.id, 'Theirs');

  await page.goto(`/roadmaps/${mine.roadmapId}`);
  await expect(page.getByRole('tab').nth(0)).toHaveText('Mine syllabus');
  await expect(page.getByRole('tab').nth(1)).toHaveText(mine.referenceName);
  await expect(page.getByRole('tab').nth(2)).toHaveText(mine.planName);
  await expect(page.getByRole('tab', { name: 'Schedule' })).toBeVisible();

  await page.goto('/');
  await pickPreparation(page, prep.name);
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Study Library', exact: true }).click();

  const panel = page.getByRole('region', { name: 'Your reference sheets' });
  await expect(panel).toBeVisible();
  await expect(panel.getByText(mine.referenceName, { exact: true })).toBeVisible();
  await expect(panel.getByText(mine.title, { exact: true })).toBeVisible();
  // Not the plan sheet, and not another preparation's reference sheet.
  await expect(panel.getByText(mine.planName)).toHaveCount(0);
  await expect(page.getByText(theirs.referenceName)).toHaveCount(0);

  // Open goes to that sheet's tab.
  await panel.getByRole('link', { name: `Open ${mine.referenceName} in ${mine.title}` }).click();
  await expect(page).toHaveURL(new RegExp(`/roadmaps/${mine.roadmapId}\\?resource=${mine.referenceId}$`));
  await expect(page.getByRole('tab', { name: mine.referenceName })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('switch', { name: 'Show in Study Library' })).toBeChecked();
});

test('turning "Show in Study Library" off takes a sheet out of the library, and on puts it back', async ({ page, request }) => {
  const prep = await createCertification(request, 'Sheets Toggle');
  const sheets = await createSheetRoadmap(request, prep.id, 'Toggle');

  await page.goto(`/roadmaps/${sheets.roadmapId}?resource=${sheets.referenceId}`);
  const toggle = page.getByRole('switch', { name: 'Show in Study Library' });
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  await expect.poll(async () => (await (await request.get(`/api/v1/roadmaps/reference-sheets?subject_id=${prep.id}`)).json()).length).toBe(0);

  // Reloading keeps it; the plan sheet's switch starts off.
  await page.reload();
  await expect(page.getByRole('switch', { name: 'Show in Study Library' })).not.toBeChecked();
  await page.goto(`/roadmaps/${sheets.roadmapId}?resource=${sheets.planId}`);
  const planToggle = page.getByRole('switch', { name: 'Show in Study Library' });
  await expect(planToggle).not.toBeChecked();

  // On the plan sheet: the library now lists it as well.
  await planToggle.click();
  await expect(planToggle).toBeChecked();
  await page.goto('/');
  await pickPreparation(page, prep.name);
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Study Library', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Your reference sheets' });
  await expect(panel.getByText(sheets.planName, { exact: true })).toBeVisible();
  await expect(panel.getByText(sheets.referenceName)).toHaveCount(0);
});

test('a link to a sheet that does not exist opens the roadmap on its first tab', async ({ page, request }) => {
  const prep = await createCertification(request, 'Sheets Missing');
  const sheets = await createSheetRoadmap(request, prep.id, 'Missing');

  await page.goto(`/roadmaps/${sheets.roadmapId}?resource=99999999`);
  await expect(page.getByRole('tab').first()).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Missing syllabus' })).toHaveAttribute('aria-selected', 'true');
});
