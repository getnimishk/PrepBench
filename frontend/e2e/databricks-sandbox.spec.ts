// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { expect, test } from './fixtures';

/**
 * The Lakehouse Lab's Station C with the real Delta engine ABSENT, which is the
 * default (the engine is an optional install, and CI's browser job doesn't have
 * it). The point of the spec is the honesty rule: with no engine the page says so
 * and shows no result of any kind -- no number, no rows, nothing "expected".
 * The engine-present flow is covered by the backend engine suite and by the
 * component tests; it's checked by hand on the disposable second server.
 */

test('without the engine, Station C says so and shows no result, and the rest still works', async ({ page, request }) => {
  const status = await (await request.get('/api/v1/lab/lakehouse/engine')).json();
  test.skip(status.available === true, 'The real Delta engine is installed here; this spec covers it being absent.');

  await page.goto('/databricks-sandbox?station=c');
  await expect(page.getByRole('heading', { level: 1, name: 'Lakehouse Lab' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: /Station C/ })).toBeVisible();
  await expect(page.getByText('Real engine not installed').first()).toBeVisible();

  // Predict: write-once, so a run in this worker's database may have committed it already.
  const refused = page.getByRole('radio', { name: /The write is refused/ });
  if (await refused.isEnabled()) {
    await refused.check();
    await page.getByRole('button', { name: 'Commit prediction' }).click();
  }
  await expect(page.getByRole('button', { name: 'Prediction committed' })).toBeVisible();
  for (const radio of await page.getByRole('radio').all()) await expect(radio).toBeDisabled();

  // Manipulate and Observe: nothing can run, and nothing stands in for a run.
  await expect(page.getByRole('button', { name: 'Run on engine' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Set up the tables' })).toBeDisabled();
  const observe = page.locator('section[aria-labelledby="c-observe"]');
  await expect(observe.getByText('Real engine not installed')).toBeVisible();
  await expect(observe.getByText(/uv pip install/)).toBeVisible();
  await expect(observe.getByText(/Your prediction is saved/)).toBeVisible();
  await expect(observe).not.toContainText(/Real engine run|Table at version|\d+ rows|Refused by the engine|Done/);
  await expect(page.getByText(/Your prediction was right|Not what you predicted/)).toHaveCount(0);

  // Explain still works: structure checks on the learner's own acceptance criteria.
  await page.getByLabel('Acceptance criteria').fill(
    'Given a batch with a new column, when it is appended, then it is rejected and nothing is written. '
    + 'If it is not, the load rolls back. The data owner signs off within 1 day.',
  );
  await page.getByRole('button', { name: 'Check structure' }).click();
  await expect(page.getByText('Structure checks, not a quality grade')).toBeVisible();
  await expect(page.getByText('Present')).toHaveCount(4);

  // The journal has nothing in it: no operation reached the engine.
  await page.getByRole('button', { name: /^Journal/ }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Lab journal' })).toBeVisible();
  await expect(page.getByText('Nothing yet. Run something in a station.')).toBeVisible();
});


test('Station F: tier the jobs, run the plan, see the count plan fail, and go to Station C’s comparison', async ({ page }) => {
  await page.goto('/databricks-sandbox');
  // The programme comes first.
  await expect(page.getByRole('heading', { level: 2, name: /Station F/ })).toBeVisible();

  const table = page.getByRole('table', { name: 'Jobs to tier' });
  await expect(table).toBeVisible();
  // Write-once: a run in this worker's database may have committed it already.
  if (await page.getByRole('button', { name: 'Commit prediction' }).count() > 0) {
    for (const row of await table.locator('tbody tr').all()) {
      await row.getByRole('group').getByRole('button', { name: '2', exact: true }).click();
    }
    await page.getByRole('button', { name: 'Commit prediction' }).click();
  }
  await expect(page.getByRole('button', { name: 'Prediction committed' })).toBeVisible();
  // The true tiers are shown now, and never before.
  await expect(page.getByText(/of 12 right\.|All 12 right\./)).toBeVisible();

  await page.getByRole('button', { name: 'Run plan' }).click();
  const observe = page.locator('section[aria-labelledby="f-observe"]');
  await expect(observe.getByText('Simulation', { exact: true })).toBeVisible();
  await expect(observe.getByText(/Planned by job count · promised month \d+, ended month \d+ · [\d.]+ months late/)).toBeVisible();
  await expect(observe.getByText(/Weighted by complexity · promised month \d+, ended month \d+ · (about )?on plan/)).toBeVisible();
  await expect(observe.getByText(/cut over without a consumer map: Yield dashboard went blank/)).toBeVisible();
  await expect(observe.getByText(/Blocked · 3 consumers unconfirmed/)).toBeVisible();
  // Every cost says what it is.
  await expect(observe.getByText('Teaching constant, relative to job clusters')).toHaveCount(2);

  // A consumer map unblocks decommission, after the plan is run again.
  await page.getByLabel('A consumer map is built for the yield waves').check();
  await expect(observe.getByText('The plan changed. Run it again to see the new outcome.')).toBeVisible();
  await page.getByRole('button', { name: 'Run plan' }).click();
  await expect(observe.getByText(/Allowed: every consumer is confirmed migrated/)).toBeVisible();

  // The yield wave's Validate step leads to the real comparison in Station C.
  await page.getByRole('button', { name: 'Compare in Station C' }).click();
  await expect(page).toHaveURL(/station=c&challenge=reconciliation&from=f&wave=10/);
  await expect(page.getByRole('heading', { level: 2, name: /Station C/ })).toBeVisible();
  await expect(page.getByText(/Opened from Station F · wave 10 Validate/)).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Challenge' })).toContainText('Does the migrated table match the legacy one?');
});

test('the stations that are not built yet say so, and the notebook is marked Unverified', async ({ page }) => {
  await page.goto('/databricks-sandbox?station=a');
  await expect(page.getByText(/This station isn’t built yet/)).toBeVisible();
  await page.getByRole('button', { name: 'Open Station C' }).click();
  await expect(page).toHaveURL(/station=c/);
  await expect(page.getByText('Unverified', { exact: true })).toBeVisible();
});
