// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { type APIRequestContext } from '@playwright/test';
import { expect, test } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import { createSkillWithPack, pickPreparation, tag, trackApi, waitForApiIdle } from './helpers';

/**
 * Phase 7: the curriculum layer, against a real backend. A roadmap topic links to the
 * guide chapters its pack maps to it, the scenarios written for those chapters and the ADF
 * experiments for its topic number -- and back from the scenario and the experiment. Its
 * Evidence is its own preparation's, read-only. A roadmap belongs to a preparation only
 * through a link the learner confirms, and unlinking it changes what that preparation claims.
 */

/** An ADF-style roadmap with one real topic name, linked to `sid` when given. */
async function adfRoadmap(request: APIRequestContext, sid: number | null): Promise<{ rid: number; tid: number; title: string }> {
  const title = `ADF Roadmap ${tag()}`;
  const made = await request.post('/api/v1/roadmaps/import/confirm', {
    data: {
      title, source_filename: 'ADF_Master_Roadmap.xlsx',
      topics: [
        { title: 'Watermark Patterns', phase_name: '4. Incremental loads', success_criteria: 'Explain a watermark unprompted.' },
        { title: 'A topic no chapter covers', phase_name: '4. Incremental loads' },
      ],
    },
  });
  expect(made.status(), await made.text()).toBe(201);
  const rid = (await made.json()).roadmap_id as number;
  if (sid !== null) expect((await request.put(`/api/v1/roadmaps/${rid}`, { data: { subject_id: sid } })).status()).toBe(200);
  const detail = await (await request.get(`/api/v1/roadmaps/${rid}`)).json();
  const tid = detail.phases[0].topics.find((t: { title: string }) => t.title === 'Watermark Patterns').id as number;
  return { rid, tid, title };
}

/** One finished Predict stage of a watermark lab run, as services/adfLab/attempts.ts writes it. */
async function labStage(request: APIRequestContext, sid: number): Promise<void> {
  const uid = `ab:${sid}:watermark:r1:predict`;
  const opened = await request.post('/api/v1/learning/attempts', {
    data: { attempt_uid: uid, challenge_id: 'adf.lab.watermark.predict', concept_id: 'adf.lab.watermark',
      scenario_fingerprint: 'adf-lab=watermark;run=1;model=semiconductor-v1', mode: 'guided', hint_count: 0, subject_id: sid },
  });
  expect(opened.status(), await opened.text()).toBe(201);
  const path = `/api/v1/learning/attempts/${encodeURIComponent(uid)}`;
  const scope = { subject_id: sid };
  expect((await request.patch(path, { params: scope, data: { prediction: 'missing' } })).status()).toBe(200);
  expect((await request.patch(path, {
    params: scope,
    data: { manipulation: { retries: { from: 0, to: 1 } }, observed: { source: 'simulation' }, completed: true, correct: true },
  })).status()).toBe(200);
}

test('a topic links to its chapters, scenarios and experiments, shows its own evidence, and is linked back', async ({ page, request }) => {
  await trackApi(page);
  const mine = await createSkillWithPack(request, 'Curriculum ADF', 'adf');
  const other = await createSkillWithPack(request, 'Curriculum Other', 'adf');
  const { rid, tid } = await adfRoadmap(request, mine.id);
  await labStage(request, mine.id);
  await labStage(request, other.id); // another preparation's run: never shown on mine's topic

  await page.goto('/');
  await pickPreparation(page, mine.name);
  await page.goto(`/roadmaps/${rid}/topics/${tid}`);

  // Read: the chapter the pack maps to the topic, by its title.
  await expect(page.getByRole('link', { name: /^Ch \d+ · Loading only new data$/ })).toHaveAttribute('href', '/learn/guides/adf/incremental');
  // Practise: the written scenario on that chapter. Explore: the experiment for topic 32.
  await expect(page.getByRole('link', { name: 'Scenario 1 · The missing lots' })).toHaveAttribute('href', '/scenarios/adf/1');
  const lab = page.getByRole('heading', { name: 'Explore in lab' }).locator('xpath=following-sibling::ul[1]');
  await expect(lab.getByRole('link', { name: 'Watermark & Transient Failure' })).toHaveAttribute('href', '/lab/adf/watermark');

  // Evidence: this preparation's own lab work, read-only; the topic is still not started.
  const evidence = page.getByRole('region', { name: 'Evidence for this topic' });
  await expect(evidence.getByRole('link', { name: /Watermark & Transient Failure/ })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 2, name: 'Not started' })).toBeVisible();
  const topic = await (await request.get(`/api/v1/roadmaps/${rid}`)).json();
  expect(topic.phases[0].topics.find((t: { id: number }) => t.id === tid).status).toBe('not_started');

  // A refresh keeps it; a topic no chapter covers links nothing, never by its position.
  await page.reload();
  await expect(page.getByRole('region', { name: 'Evidence for this topic' })).toBeVisible();
  const uncovered = topic.phases[0].topics.find((t: { title: string }) => t.title === 'A topic no chapter covers').id;
  await page.goto(`/roadmaps/${rid}/topics/${uncovered}`);
  await expect(page.getByRole('button', { name: 'Study guide' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Evidence for this topic' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Watermark/ })).toHaveCount(0);
  await page.goBack();
  await expect(page.getByRole('region', { name: 'Evidence for this topic' })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('button', { name: 'Study guide' })).toBeVisible();

  // Back from the scenario and from the experiment to the topic.
  await page.goto('/scenarios/adf/1');
  const backLink = page.getByRole('link', { name: 'Watermark Patterns' });
  await expect(backLink).toHaveAttribute('href', `/roadmaps/${rid}/topics/${tid}`);
  await page.goto('/lab/adf/watermark');
  await expect(page.getByText('Your roadmap topics:')).toBeVisible();
  await page.getByRole('link', { name: 'Watermark Patterns' }).click();
  await expect(page).toHaveURL(new RegExp(`/roadmaps/${rid}/topics/${tid}$`));

  // Another preparation has no roadmap: its lab page names the topics without linking mine.
  await pickPreparation(page, other.name);
  await page.goto('/lab/adf/watermark');
  await expect(page.getByText(/Roadmap topics: 32 Watermark Patterns/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Watermark Patterns' })).toHaveCount(0);
});

test('a roadmap belongs to a preparation only by a confirmed link, and unlinking it withdraws the claim', async ({ page, request }) => {
  await trackApi(page);
  const prep = await createSkillWithPack(request, 'Curriculum Link', 'adls');
  const { title } = await adfRoadmap(request, prep.id);
  const loose = await adfRoadmap(request, null);
  const count = async () => (await (await request.get(`/api/v1/subjects/${prep.id}`)).json()).roadmap_count as number;
  expect(await count()).toBe(1);

  // No preparation chosen: only roadmaps that belong to none are listed.
  await page.goto('/roadmaps');
  await expect(page.getByText(/No preparation is chosen/)).toBeVisible();
  await expect(page.getByRole('link', { name: loose.title, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: title, exact: true })).toHaveCount(0);

  await pickPreparation(page, prep.name);
  await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible();
  await page.getByRole('button', { name: `Unlink ${title} from ${prep.name}` }).click();
  const dialog = page.getByRole('dialog', { name: 'Unlink this roadmap?' });
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  expect(await count()).toBe(1); // cancelled: nothing changed

  await page.getByRole('button', { name: `Unlink ${title} from ${prep.name}` }).click();
  await page.getByRole('dialog', { name: 'Unlink this roadmap?' }).getByRole('button', { name: 'Unlink' }).click();
  const unlinked = page.getByRole('region', { name: 'Not linked to a preparation' });
  await expect(unlinked.getByRole('link', { name: title, exact: true })).toBeVisible();
  expect(await count()).toBe(0);
  await expect(page.getByText(`${prep.name} has no roadmap yet`, { exact: false })).toBeVisible();
});

test('the topic page and roadmap list pass axe in both themes and fit a 390px phone', async ({ page, request }) => {
  test.setTimeout(180_000);
  await trackApi(page);
  const prep = await createSkillWithPack(request, 'Curriculum Axe', 'adf');
  const { rid, tid } = await adfRoadmap(request, prep.id);
  await labStage(request, prep.id);
  await page.goto('/');
  await pickPreparation(page, prep.name);

  const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
  try {
    for (const theme of ['light', 'dark'] as const) {
      await request.put('/api/v1/settings', { data: { theme } });
      for (const route of [`/roadmaps/${rid}/topics/${tid}`, '/roadmaps', `/roadmaps/${rid}`]) {
        await page.goto(route);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
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
