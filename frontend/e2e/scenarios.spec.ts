// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createSkillWithPack, pickPreparation } from './helpers';

/**
 * The Learning Lab's scenario sandbox (skills-and-content-packs-plan.md Phase 3),
 * end to end on a Skill with the ADF pack: answer the check, write the case
 * notes, open the debrief, write the Say-it answer, save it -- and find it in
 * Interview → Question library as a Technical question. Everything is on the
 * server: the check's first answer locks there, not just on the page.
 *
 * The crawl specs visit /scenarios with a certification selected (the empty
 * state); the full scenario, with every section open, is audited here.
 */

interface WireAttempt {
  challenge_id: string;
  subject_id: number | null;
  prediction: string | null;
  completed_at: string | null;
  explanation_text: string | null;
}

async function attemptsFor(request: APIRequestContext, subjectId: number): Promise<WireAttempt[]> {
  return (await request.get(`/api/v1/learning/attempts?subject_id=${subjectId}`)).json();
}

/** Scenario 1, practised as a Product Owner up to the Say-it step. */
async function workThroughScenarioOne(page: Page) {
  await page.goto('/scenarios');
  await page.getByRole('link', { name: /^Open scenario 1:/ }).click();
  await expect(page).toHaveURL('/scenarios/adf/1');
  await expect(page.getByRole('heading', { level: 1, name: /^1 · / })).toBeVisible();
  await expect(page.getByText('Answer the check first.')).toBeVisible();

  const groups = page.getByRole('radiogroup');
  await expect(groups).toHaveCount(4);
  for (let i = 0; i < 4; i += 1) {
    // The first option: some right, some wrong -- both are recorded as given.
    await groups.nth(i).getByRole('radio').first().check();
    await expect(groups.nth(i).getByRole('radio').first()).toBeDisabled();
  }
  await expect(page.getByText(/of 4 right · practice only/)).toBeVisible();

  const notes = page.getByRole('textbox', { name: /^[a-d]\) / });
  await expect(notes).toHaveCount(4);
  for (let i = 0; i < 4; i += 1) await notes.nth(i).fill(`My note ${i + 1}.`);
  await page.getByRole('button', { name: 'Show the debrief' }).click();
  await expect(page.getByRole('heading', { name: '4 · Debrief' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '5 · Say it' })).toBeVisible();
}

test('a scenario is worked end to end as a Product Owner and its Say-it question lands in the interview library', async ({ page, request }) => {
  test.setTimeout(180_000);
  const prep = await createSkillWithPack(request, 'Scenarios ADF', 'adf');

  await page.goto('/');
  await pickPreparation(page, prep.name);
  await workThroughScenarioOne(page);

  // The notes are committed with the debrief and don't change after it.
  await expect(page.getByRole('textbox', { name: /^a\) / })).toHaveAttribute('readonly', '');

  const sayIt = page.getByRole('heading', { level: 3, name: /^".+"$/ });
  const question = (await sayIt.textContent())!.replace(/^"|"$/g, '');
  await page.getByLabel(/Your answer, in your own words/).fill('A watermark that only moves after the copy succeeds, a count check on every run, and a merge on the key.');
  await page.getByRole('checkbox').first().check();
  await page.getByRole('button', { name: 'Add to my interview question library' }).click();
  await expect(page.getByText(/Added to your interview question library as a Technical question/)).toBeVisible();

  // On the server: four locked check answers and one completed lens, all on the skill.
  const recorded = await attemptsFor(request, prep.id);
  const checks = recorded.filter((a) => /^adf\/1\/check\/\d$/.test(a.challenge_id));
  expect(checks).toHaveLength(4);
  expect(checks.every((a) => a.prediction === '0' && a.completed_at)).toBe(true);
  const lens = recorded.find((a) => a.challenge_id === 'adf/1/lens/po')!;
  expect(lens.prediction).toBe('case-notes');
  expect(lens.explanation_text).toContain('My note 1.');
  expect(lens.explanation_text).toContain('A watermark that only moves');

  // A second, different answer to a locked check is refused by the server.
  const refused = await request.patch(
    `/api/v1/learning/attempts/${encodeURIComponent(`s${prep.id}:adf@1:1:c0`)}`, { data: { prediction: '1' } },
  );
  expect(refused.ok()).toBe(false);

  // Saving again updates the same question, not a copy.
  await page.getByRole('button', { name: 'Update it in my interview question library' }).click();
  await expect(page.getByText(/Updated in your interview question library/)).toBeVisible();
  const saved = await (await request.get(`/api/v1/interview-questions?source_ref=${encodeURIComponent('adf@1/scenario/1/lens/po')}`)).json();
  expect(saved.total).toBe(1);
  expect(saved.items[0].round_type).toBe('technical');
  expect(saved.items[0].subject_id).toBe(prep.id);

  // …and it is in the library, under the Technical round.
  await page.goto('/interview-practice/library');
  await page.getByRole('tab', { name: /^Technical/ }).click();
  await expect(page.getByText(question, { exact: false }).first()).toBeVisible();

  // The sandbox list says it was practised; a reload keeps everything.
  await page.goto('/scenarios');
  await expect(page.getByText('Practised · 1 role')).toBeVisible();
  await page.goto('/scenarios/adf/1');
  await expect(page.getByRole('heading', { name: '4 · Debrief' })).toBeVisible();
  await expect(page.getByLabel(/Your answer, in your own words/)).toHaveValue(/A watermark that only moves/);
});

test('the guide chapter a scenario practises links to it', async ({ page, request }) => {
  const prep = await createSkillWithPack(request, 'Scenarios Guide Link', 'adf');
  await page.goto('/');
  await pickPreparation(page, prep.name);
  await page.goto('/learn/guides/adf/incremental');
  await page.getByRole('link', { name: 'Practise this' }).click();
  await expect(page).toHaveURL('/scenarios/adf/1');
});

for (const theme of ['light', 'dark'] as const) {
  test(`a fully open scenario passes axe in the ${theme} theme and fits a 390px phone`, async ({ page, request }) => {
    test.setTimeout(180_000);
    const prep = await createSkillWithPack(request, `Scenarios Axe ${theme}`, 'adf');
    await request.put('/api/v1/settings', { data: { theme } });
    try {
      await page.goto('/');
      await pickPreparation(page, prep.name);
      await workThroughScenarioOne(page);

      const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
      for (const route of ['/scenarios', '/scenarios/adf/1']) {
        await page.goto(route);
        await expect(page.locator('main h1').first()).toBeVisible();
        await page.waitForLoadState('networkidle');
        const results = await new AxeBuilder({ page }).withTags(tags).analyze();
        const violations = results.violations.map((v) => `${route} — ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
        expect(violations, violations.join('\n')).toEqual([]);

        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(200);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${route} scrolls sideways at 390px`).toBeLessThanOrEqual(0);
        await page.setViewportSize({ width: 1280, height: 800 });
      }
    } finally {
      await request.put('/api/v1/settings', { data: { theme: 'light' } });
    }
  });
}
