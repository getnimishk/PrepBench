// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { type APIRequestContext, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import { createCertification, createSkillWithPack, pickPreparation, trackApi, waitForApiIdle } from './helpers';

/**
 * The ADF Behaviour Lab (Phase 5): five experiments, Fault Tolerance with two modes, against a
 * real backend. Every stage is a learning_attempts row on the ADF preparation, and the prediction
 * lock is the server's. Live now that all five are built: Home, the sidebar and the Learning Lab
 * hub lead to it, for a preparation with the ADF guide attached and no other.
 */

interface Attempt {
  attempt_uid: string; challenge_id: string; subject_id: number | null; scenario_fingerprint: string; mode: string;
  prediction: string | null; committed_at: string | null; completed_at: string | null; correct: boolean | null;
  transfer: boolean | null; manipulation: Record<string, { from: unknown; to: unknown }> | null;
  observed: Record<string, unknown> | null; explanation_text: string | null; explanation_mechanisms: string[];
}

const labRows = async (request: APIRequestContext, subjectId: number): Promise<Attempt[]> =>
  ((await (await request.get(`/api/v1/learning/attempts?subject_id=${subjectId}`)).json()) as Attempt[])
    .filter((a) => a.challenge_id.startsWith('adf.lab.'));

/** What a learner who has it right picks at each stage, per track, by what the screen says. */
interface Journey {
  track: string; path: string; title: RegExp;
  predict: string | RegExp; lever: { group: string | RegExp; button: string };
  reason: RegExp; apply: string | RegExp; retrieve: string | RegExp;
}

const JOURNEYS: Journey[] = [
  {
    track: 'watermark', path: '/lab/adf/watermark', title: /^Watermark & Transient Failure$/,
    predict: 'Some rows never arrive', lever: { group: 'Retries after the failure', button: '1' },
    reason: /stored on a step that also runs when the copy fails/, apply: 'Retry the copy once, and upsert on the key',
    retrieve: 'Not at all: retry defaults to 0',
  },
  {
    track: 'triggers', path: '/lab/adf/triggers', title: /^Trigger Behaviour$/,
    predict: 'Every row, and some of them twice', lever: { group: 'Sink', button: 'Upsert on the key' },
    reason: /re-ran its whole window/, apply: 'A schedule trigger that loads what has arrived',
    retrieve: 'Only one; a schedule trigger can start several',
  },
  {
    track: 'concurrency', path: '/lab/adf/concurrency', title: /^Concurrency Budget$/,
    predict: 'Some copies cannot get a connection and fail', lever: { group: 'ForEach batch count', button: '5' },
    reason: /The three settings multiply/, apply: 'Batch count 5, 1 parallel copy',
    retrieve: 'Up to 50; 20 by default',
  },
  {
    track: 'copy-perf', path: '/lab/adf/copy-perf', title: /^Copy Performance$/,
    predict: 'It takes no less time', lever: { group: 'Source read limit (GB an hour)', button: '240' },
    reason: /extra DIUs sit idle/, apply: '32 DIUs, 4 parallel copies',
    retrieve: 'On an Azure integration runtime',
  },
  {
    track: 'fault-tolerance.dependency', path: '/lab/adf/fault-tolerance?mode=dependency', title: /^Fault Tolerance: Dependency failure paths$/,
    predict: 'The run shows Succeeded, and the failed-run alert does not fire', lever: { group: 'Error handling around the copy', button: 'Do-if-else' },
    reason: /comes from its last steps/, apply: 'Do-if-else: an on-success and an on-failure step',
    retrieve: 'On success, on failure, on completion and on skip',
  },
  {
    track: 'fault-tolerance.bad-rows', path: '/lab/adf/fault-tolerance?mode=bad-rows', title: /^Fault Tolerance: Bad-row handling$/,
    predict: 'The run succeeds and verification passes; the skipped rows are only a count', lever: { group: /^When a row can.t be written$/, button: 'Skip it, with the session log' },
    reason: /without the session log only a count is kept/, apply: /^Skip incompatible rows and switch on the session log/,
    retrieve: /actual values and the reason it was skipped/,
  },
];

/** One run of one track, Understand through Retrieve. */
async function workThrough(page: Page, j: Journey, opts: { reloadAfterCommit?: boolean } = {}) {
  await page.goto(j.path);
  await expect(page.getByRole('heading', { level: 1, name: j.title })).toBeVisible();
  await expect(page.getByText(/Teaching simulation\. PrepBench runs a model of this pipeline/)).toBeVisible();
  await expect(page.getByText(/Nothing runs in Azure Data Factory/)).toBeVisible();
  await page.getByRole('button', { name: 'Continue to Predict' }).click();

  // The levers do not exist until the prediction is committed.
  await expect(page.getByRole('heading', { level: 2, name: 'Manipulate' })).toHaveCount(0);
  await page.getByRole('radio', { name: j.predict, exact: typeof j.predict === 'string' }).check();
  await page.getByRole('button', { name: 'Commit prediction' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Manipulate' })).toBeVisible();

  if (opts.reloadAfterCommit) {
    await page.reload();
    await expect(page.getByRole('heading', { level: 2, name: 'Manipulate' })).toBeVisible();
    const committed = page.getByRole('radio', { name: j.predict, exact: typeof j.predict === 'string' });
    await expect(committed).toBeChecked();
    await expect(committed).toBeDisabled();
  }

  await page.getByRole('group', { name: j.lever.group }).getByRole('button', { name: j.lever.button, exact: true }).click();
  await page.getByRole('button', { name: 'Run the model' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Observe' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'The scenario against your run' })).toBeVisible();
  await page.getByRole('button', { name: 'Record this observation' }).click();
  await expect(page.getByText('Your prediction matched the model.')).toBeVisible();

  await page.getByRole('radio', { name: j.reason }).check();
  await page.getByRole('button', { name: 'Submit your diagnosis' }).click();
  await expect(page.getByText('That is the mechanism the model found.')).toBeVisible();

  await page.getByRole('radio', { name: j.apply, exact: typeof j.apply === 'string' }).check();
  await page.getByRole('button', { name: 'Submit your change' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Explain' })).toBeVisible();

  await page.getByRole('textbox').fill('What the model showed, and why, in my own words.');
  await page.getByRole('button', { name: 'Save your explanation' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Retrieve' })).toBeVisible();

  await page.getByRole('radio', { name: j.retrieve, exact: typeof j.retrieve === 'string' }).check();
  await page.getByRole('button', { name: 'Check your answer' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Run complete' })).toBeVisible();
  for (const stage of ['Understand', 'Predict', 'Manipulate', 'Observe', 'Reason', 'Apply', 'Explain', 'Retrieve']) {
    await expect(page.getByRole('heading', { level: 2, name: stage, exact: true })).toBeVisible();
  }
}

test('Watermark & Transient Failure: every stage, a reload mid-run, all on the server against the ADF preparation', async ({ page, request }) => {
  test.setTimeout(180_000);
  const prep = await createSkillWithPack(request, 'ADF Lab Journey', 'adf');
  await page.goto('/');
  await pickPreparation(page, prep.name);

  await page.goto('/lab/adf');
  await expect(page.getByRole('heading', { level: 1, name: 'ADF Behaviour Lab' })).toBeVisible();
  await expect(page.getByText(/Integration in progress/)).toHaveCount(0);
  await page.getByRole('link', { name: 'Open Watermark & Transient Failure' }).click();
  await expect(page).toHaveURL('/lab/adf/watermark');

  await workThrough(page, JOURNEYS[0], { reloadAfterCommit: true });

  const rows = await labRows(request, prep.id);
  expect(rows.map((a) => a.attempt_uid).sort()).toEqual([
    `ab:${prep.id}:watermark:r1:apply`, `ab:${prep.id}:watermark:r1:predict`,
    `ab:${prep.id}:watermark:r1:reason`, `ab:${prep.id}:watermark:r1:retrieve`,
  ]);
  expect(rows.every((a) => a.subject_id === prep.id && a.completed_at)).toBe(true);
  expect(new Set(rows.map((a) => a.scenario_fingerprint))).toEqual(new Set(['adf-lab=watermark;run=1;model=semiconductor-v1']));

  const predict = rows.find((a) => a.challenge_id === 'adf.lab.watermark.predict')!;
  expect(predict).toMatchObject({ prediction: 'missing', correct: true });
  expect(predict.manipulation).toEqual({ retries: { from: 0, to: 1 } });
  expect(predict.observed).toMatchObject({ source: 'simulation', result: { before: 'missing' } });
  expect(predict.explanation_text).toContain('own words');
  expect(rows.find((a) => a.challenge_id === 'adf.lab.watermark.reason')).toMatchObject({
    prediction: 'watermark-timing', correct: true, explanation_mechanisms: ['watermark-timing'],
  });
  expect(rows.find((a) => a.challenge_id === 'adf.lab.watermark.apply')).toMatchObject({ prediction: 'retry-upsert', correct: true, transfer: true });
  expect(rows.find((a) => a.challenge_id === 'adf.lab.watermark.retrieve')).toMatchObject({ mode: 'retrieval', prediction: '0', correct: true });

  // The lock is the server's: a second, different prediction is refused.
  const refused = await request.patch(`/api/v1/learning/attempts/${encodeURIComponent(predict.attempt_uid)}`, { data: { prediction: 'complete' } });
  expect(refused.ok()).toBe(false);

  // A reload of a finished run shows it finished, and the hub agrees.
  await page.reload();
  await expect(page.getByRole('heading', { level: 2, name: 'Run complete' })).toBeVisible();
  await page.goto('/lab/adf');
  await expect(page.getByText('Run 1 complete')).toBeVisible();
});

test('all five experiments, both Fault Tolerance modes, run end to end and each run is one correlated set of rows', async ({ page, request }) => {
  test.setTimeout(420_000);
  const prep = await createSkillWithPack(request, 'ADF Lab Five', 'adf');
  await page.goto('/');
  await pickPreparation(page, prep.name);

  for (const j of JOURNEYS) await workThrough(page, j);

  const rows = await labRows(request, prep.id);
  for (const j of JOURNEYS) {
    const mine = rows.filter((a) => a.attempt_uid.startsWith(`ab:${prep.id}:${j.track}:r1:`));
    expect(mine.map((a) => a.attempt_uid.split(':').pop()).sort(), j.track).toEqual(['apply', 'predict', 'reason', 'retrieve']);
    expect(new Set(mine.map((a) => a.scenario_fingerprint)).size, j.track).toBe(1);
    expect(mine.every((a) => a.subject_id === prep.id && a.correct === true && a.completed_at), j.track).toBe(true);
  }
  expect(rows).toHaveLength(JOURNEYS.length * 4);

  await page.goto('/lab/adf');
  const list = page.getByRole('list', { name: 'Experiments' });
  await expect(list.getByText('Run 1 complete')).toHaveCount(4);
  await expect(list.getByText('Both modes complete')).toBeVisible();
});

test('live: Home, the sidebar and the Learning Lab lead to the Behaviour Lab for an ADF preparation, and nothing opens it for another', async ({ page, request }) => {
  const adf = await createSkillWithPack(request, 'ADF Lab Entry', 'adf');
  const cert = await createCertification(request, 'ADF Lab Elsewhere');
  await page.goto('/');
  await pickPreparation(page, adf.name);

  // Home: the lab CTA opens the Behaviour Lab.
  await expect(page.getByRole('link', { name: 'Open Behaviour Lab' }).first()).toHaveAttribute('href', '/lab/adf');
  // Sidebar: the Learning Lab entry is a live link; the hub has the Behaviour Lab card.
  const nav = page.getByRole('navigation', { name: 'Main' });
  await nav.getByRole('link', { name: 'All Sandboxes' }).click();
  await expect(page).toHaveURL('/lab');
  await page.getByRole('link', { name: 'Open sandbox: ADF Behaviour Lab' }).click();
  await expect(page).toHaveURL('/lab/adf');
  await expect(page.getByRole('heading', { level: 1, name: 'ADF Behaviour Lab' })).toBeVisible();
  // Databricks' lab is still the Lakehouse Lab, untouched.
  await page.goto('/lab');
  await expect(page.getByRole('link', { name: 'Open sandbox: Lakehouse Lab' })).toHaveAttribute('href', '/databricks-sandbox');

  // Another preparation, by the address: told it does not apply, for every experiment, and nothing is written.
  await pickPreparation(page, cert.name);
  for (const path of ['/lab/adf', ...JOURNEYS.map((j) => j.path)]) {
    await page.goto(path);
    await expect(page.getByText(/has no Azure Data Factory guide attached/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue to Predict' })).toHaveCount(0);
  }
  expect(await labRows(request, cert.id)).toEqual([]);
});

test('the Behaviour Lab passes axe in both themes, every stage open, and fits a 390px phone', async ({ page, request }) => {
  await trackApi(page);
  test.setTimeout(600_000);
  const prep = await createSkillWithPack(request, 'ADF Lab Axe', 'adf');
  await page.goto('/');
  await pickPreparation(page, prep.name);
  for (const j of JOURNEYS) await workThrough(page, j);

  const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
  try {
    for (const theme of ['light', 'dark'] as const) {
      await request.put('/api/v1/settings', { data: { theme } });
      for (const route of ['/lab/adf', ...JOURNEYS.map((j) => j.path)]) {
        await page.goto(route);
        await expect(page.locator('main h1').first()).toBeVisible();
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
