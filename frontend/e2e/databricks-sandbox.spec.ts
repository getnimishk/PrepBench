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

test('Station A: predict the lost rows, run the pipeline, and hand the batch to Station C', async ({ page }) => {
  await page.goto('/databricks-sandbox?station=a');
  await expect(page.getByRole('heading', { level: 2, name: /Station A/ })).toBeVisible();

  // Write-once: a run in this worker's database may have committed it already.
  if (await page.getByRole('button', { name: 'Commit prediction' }).count() > 0) {
    await page.getByRole('radio', { name: 'Some rows never arrive' }).check();
    await page.getByRole('button', { name: 'Commit prediction' }).click();
  }
  await expect(page.getByRole('button', { name: 'Prediction committed' })).toBeVisible();
  await expect(page.getByText(/Your prediction was right\.|Not what the model found\./)).toBeVisible();
  await expect(page.getByText(/400 rows \(ids 1601\u20132000\) never arrive\./)).toBeVisible();

  // The same scenario, run: the watermark moved before the copy, so 400 rows are lost.
  await page.getByRole('button', { name: 'Use this challenge\u2019s scenario' }).click();
  await page.getByRole('button', { name: 'Run pipeline' }).click();
  const observe = page.locator('section[aria-labelledby="a-observe"]');
  await expect(observe.getByText('Simulation', { exact: true })).toBeVisible();
  await expect(observe.getByText(/Batch 2: 600 of 1,000 rows landed \u00b7 400 missed \(ids 1601\u20132000\)\./)).toBeVisible();

  // Move the watermark to after the copy succeeds: nothing is lost, and the interrupted rows are written twice.
  await page.getByRole('button', { name: 'After the copy succeeds' }).click();
  await expect(observe.getByText(/The settings changed\. Run the pipeline again/)).toBeVisible();
  await page.getByRole('button', { name: 'Run pipeline' }).click();
  await expect(observe.getByText(/Batch 2: 1,000 of 1,000 rows landed \u00b7 600 written twice\./)).toBeVisible();

  // A mistake made here is what Station C writes. Without the engine it says so, and shows no result.
  await page.getByRole('button', { name: 'Load in Station C' }).click();
  await expect(page).toHaveURL(/station=c&challenge=downstream-batch&from=a/);
  await expect(page.getByRole('heading', { level: 2, name: /Station C/ })).toBeVisible();
  await expect(page.getByText(/Opened from Station A \u00b7 load this batch/)).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Challenge' })).toContainText('Load Station A\u2019s batch');
  await expect(page.getByText('Using the upstream you last ran in Station A.')).toBeVisible();
  const cObserve = page.locator('section[aria-labelledby="c-observe"]');
  await expect(cObserve.getByText('Real engine not installed')).toBeVisible();
  await expect(cObserve).not.toContainText(/Real engine run|Repeated rows|Keys in one table only/);
});

test('Station B: predict the access, fix it with execute on the parents, and see what the layout and tier cost', async ({ page }) => {
  await page.goto('/databricks-sandbox?station=b');
  await expect(page.getByRole('heading', { level: 2, name: /Station B/ })).toBeVisible();
  if (await page.getByRole('button', { name: 'Commit prediction' }).count() > 0) {
    await page.getByRole('radio', { name: /No: it is stopped before it reaches the folder/ }).check();
    await page.getByRole('button', { name: 'Commit prediction' }).click();
  }
  await expect(page.getByRole('button', { name: 'Prediction committed' })).toBeVisible();
  await expect(page.getByText(/Your prediction was right\.|Not what the model found\./)).toBeVisible();

  const observe = page.locator('section[aria-labelledby="b-observe"]');
  await page.getByRole('button', { name: 'Test access' }).click();
  await expect(observe.getByText('Denied', { exact: true })).toBeVisible();
  await page.getByLabel('lake/', { exact: true }).check();
  await page.getByLabel('lake/bronze/', { exact: true }).check();
  await page.getByRole('button', { name: 'Test access' }).click();
  await expect(observe.getByText('Allowed', { exact: true })).toBeVisible();
  await expect(observe.getByText(/vendor-x can write to 1 folder: lake\/bronze\/vendor-x\//)).toBeVisible();

  // The layout and the tier, each a teaching constant.
  await page.getByRole('switch', { name: 'Hierarchical namespace' }).uncheck();
  await page.getByRole('button', { name: 'Copied from HDFS' }).click();
  await expect(observe.getByText('A copy and a delete of every object')).toBeVisible();
  await page.getByRole('combobox', { name: 'Lifecycle rule: move to cool after' }).click();
  await page.getByRole('option', { name: '30 days' }).click();
  await expect(observe.getByText('Combined', { exact: true }).locator('..')).toContainText('0.79\u00d7');
  await expect(observe.getByText('Teaching constant').first()).toBeVisible();
});

test('Station C still opens from the rail, and the notebook is marked Unverified', async ({ page }) => {
  await page.goto('/databricks-sandbox?station=a');
  await page.getByRole('button', { name: 'C \u00b7 Delta Lake' }).click();
  await expect(page).toHaveURL(/station=c/);
  await expect(page.getByText('Unverified', { exact: true })).toBeVisible();
});
