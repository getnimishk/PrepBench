// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import { createSkillWithPack, trackApi, waitForApiIdle } from './helpers';

/**
 * A job you want (skills-and-content-packs-plan.md Phase 4), end to end: paste
 * the fictional sample job description, confirm the requirements and one
 * suggested Skill link, create the role, take the diagnostic, retake it, and
 * see before and after -- with readiness still "Needs evaluation".
 */

/** Answer every question of the diagnostic that is open, rating each `confidence`. */
async function answerDiagnostic(page: Page, confidence: 'Not yet' | 'Confident', ticks: number) {
  for (let i = 1; i <= 10; i += 1) {
    await expect(page.getByText(`Diagnostic · question ${i} of 10`)).toBeVisible();
    await page.getByLabel('Your answer, in your own words').fill(`My answer to question ${i}.`);
    await page.getByRole('button', { name: 'Compare with the key points' }).click();
    const boxes = page.getByRole('checkbox');
    for (let t = 0; t < ticks; t += 1) await boxes.nth(t).check();
    await page.getByRole('button', { name: confidence, exact: true }).click();
    await page.getByRole('button', { name: i === 10 ? 'Finish and save' : 'Next question' }).click();
  }
}

test('a role is created from a job description, linked to a confirmed skill, diagnosed twice with a before/after view', async ({ page, request }) => {
  test.setTimeout(240_000);
  const skill = await createSkillWithPack(request, 'Roles ADF', 'adf');

  await page.goto('/preparations/new');
  await page.getByRole('button', { name: /A job you want/ }).click();
  await expect(page).toHaveURL('/preparations/roles/new');
  await page.getByRole('button', { name: 'Use a fictional sample' }).click();
  await page.getByRole('button', { name: 'Read requirements' }).click();

  // Nothing is linked until the learner chooses it. (Whether a suggestion is
  // offered depends on how many Skills the requirement names -- the shared e2e
  // database holds other specs' ADF Skills, so that rule is tested in
  // jdParse.test.ts and RolePages.test.tsx, not here.)
  const adfEvidence = page.getByLabel('Evidence for: Azure Data Factory (ADF), ADLS, Delta Lake');
  await expect(adfEvidence).toHaveValue('');
  await adfEvidence.selectOption(String(skill.id));
  await expect(adfEvidence).toHaveValue(String(skill.id));
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText(/1 of 13 requirements are linked to a Skill/)).toBeVisible();
  await page.getByRole('button', { name: 'Create role preparation' }).click();

  await expect(page).toHaveURL(/\/preparations\/roles\/\d+$/);
  const roleId = Number(page.url().split('/').pop());
  await expect(page.getByText('Needs evaluation')).toBeVisible();
  await expect(page.getByLabel('Evidence for: Azure Data Factory (ADF), ADLS, Delta Lake')).toHaveValue(String(skill.id));
  const role = await (await request.get(`/api/v1/roles/${roleId}`)).json();
  expect(role.requirements.filter((r: { subject_id: number | null }) => r.subject_id !== null)).toHaveLength(1);
  expect(Object.keys(role).some((k) => /readiness|score/.test(k))).toBe(false);

  // First attempt.
  await page.getByRole('link', { name: 'Take it' }).click();
  await expect(page.getByText(/10 interview questions: \d+ fit this job's requirements, the rest are core topics/)).toBeVisible();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await answerDiagnostic(page, 'Not yet', 1);
  await expect(page).toHaveURL(`/preparations/roles/${roleId}`);
  await expect(page.getByRole('heading', { name: 'Diagnostic: your starting point' })).toBeVisible();

  // The server refuses a retake with different questions.
  const first = (await (await request.get(`/api/v1/roles/${roleId}/diagnostics`)).json())[0];
  const swapped = first.items.map((i: { question_ref: string }, n: number) => ({
    ...i, question_ref: n === 0 ? 'adls@1/diagnostic/lake-resilience' : i.question_ref,
  }));
  const refused = await request.post(`/api/v1/roles/${roleId}/diagnostics`, { data: { lens: first.lens, items: swapped } });
  expect(refused.status()).toBe(400);

  // The retake asks the same questions, in the same lens.
  await page.getByRole('link', { name: 'Retake' }).click();
  await expect(page.getByRole('button', { name: 'Product Owner' })).toBeDisabled();
  await page.getByRole('button', { name: 'Start the retake' }).click();
  await answerDiagnostic(page, 'Confident', 3);

  await expect(page.getByRole('heading', { name: 'Diagnostic: before and after' })).toBeVisible();
  await expect(page.getByText('Confident on 0 → 10 of 10 questions.')).toBeVisible();
  const results = page.getByRole('region', { name: 'Diagnostic results, scrollable' });
  await expect(results.getByText('Not yet → Confident')).toHaveCount(10);
  await expect(page.getByText('Needs evaluation')).toBeVisible();

  // Listed with the other preparations, without a readiness figure.
  await page.goto('/preparations');
  const jobs = page.getByRole('region', { name: "Jobs you're preparing for" });
  await expect(jobs.getByText(/1 of 13 requirements linked to a Skill · diagnostic taken 2 times/)).toBeVisible();
});

for (const theme of ['light', 'dark'] as const) {
  test(`the role pages, with a before/after table, pass axe in the ${theme} theme and fit a 390px phone`, async ({ page, request }) => {
    await trackApi(page);
    test.setTimeout(180_000);
    const skill = await createSkillWithPack(request, `Roles Axe ${theme}`, 'adf');
    const created = await request.post('/api/v1/roles', {
      data: {
        name: `Axe role ${theme}`, job_description: 'SAMPLE (fictional)', lens: 'po',
        requirements: [{ text: 'Data reconciliation for migrations', kind: 'mandatory', subject_id: skill.id }, { text: 'Power BI', kind: 'preferred' }],
      },
    });
    const roleId = (await created.json()).id;
    const item = (ref: string, confidence: string, covered: number[]) => ({ question_ref: ref, answer: 'a', covered, confidence, fits_requirement: true });
    for (const [confidence, covered] of [['not-yet', [0]], ['confident', [0, 1, 2]]] as const) {
      const res = await request.post(`/api/v1/roles/${roleId}/diagnostics`, {
        data: { lens: 'po', items: [item('adf@1/diagnostic/reconciliation', confidence, [...covered]), item('adf@1/scenario/1/lens/po', confidence, [...covered])] },
      });
      expect(res.status(), await res.text()).toBe(201);
    }

    await request.put('/api/v1/settings', { data: { theme } });
    try {
      const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
      for (const route of [`/preparations/roles/${roleId}`, `/preparations/roles/${roleId}/diagnostic`, '/preparations/roles/new', '/preparations']) {
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto(route);
        await expect(page.locator('main h1').first()).toBeVisible();
        await waitForApiIdle(page);
        const results = await new AxeBuilder({ page }).withTags(tags).analyze();
        const violations = results.violations.map((v) => `${route} — ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
        expect(violations, violations.join('\n')).toEqual([]);

        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(200);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${route} scrolls sideways at 390px`).toBeLessThanOrEqual(0);
      }
      // Step 2 of the new-role flow: the requirements table with its evidence selects.
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/preparations/roles/new');
      await page.getByRole('button', { name: 'Use a fictional sample' }).click();
      await page.getByRole('button', { name: 'Read requirements' }).click();
      const step2 = await new AxeBuilder({ page }).withTags(tags).analyze();
      expect(step2.violations.map((v) => `step 2 — ${v.id}`)).toEqual([]);
    } finally {
      await request.put('/api/v1/settings', { data: { theme: 'light' } });
    }
  });
}
