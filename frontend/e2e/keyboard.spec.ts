// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { expect, test } from '@playwright/test';
import { createCertification, createQuestion, escapeRegExp, pickPreparation, tag } from './helpers';

/**
 * The app without a mouse: skipping to the page, seeing where focus is, a
 * dialog that holds focus and gives it back, and answering a paper from the
 * keyboard alone.
 */

test('the first Tab offers a way past the navigation, straight to the page', async ({ page }) => {
  await page.goto('/settings');
  await page.keyboard.press('Tab');

  const skip = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();

  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();

  // The next Tab lands inside the page, not back in the header.
  await page.keyboard.press('Tab');
  const inMain = await page.evaluate(() => !!document.activeElement?.closest('main'));
  expect(inMain).toBe(true);
});

test('focus is always visible on the navigation and on buttons', async ({ page }) => {
  await page.goto('/settings');
  const home = page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Home' });
  await home.focus();
  // :focus-visible needs keyboard modality; a Tab round-trip sets it.
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(home).toBeFocused();
  const outline = await home.evaluate((el) => {
    const s = getComputedStyle(el);
    return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
  });
  expect(outline.style).not.toBe('none');
  expect(outline.width).toBeGreaterThanOrEqual(2);
});

test('a dialog takes focus, closes on Escape, and gives focus back', async ({ page }) => {
  await page.goto('/settings/data');
  const trigger = page.getByRole('button', { name: 'Reset the application' });
  await trigger.focus();
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog', { name: 'Reset everything?' });
  await expect(dialog).toBeVisible();
  const inside = await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
  expect(inside).toBe(true);

  // Tabbing does not escape the dialog.
  for (let i = 0; i < 6; i += 1) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('a paper can be answered, flagged and moved through from the keyboard alone', async ({ page, request }) => {
  const prep = await createCertification(request, `Keyboard ${tag()}`);
  for (let i = 0; i < 3; i += 1) {
    await createQuestion(request, prep, `Keyboard question ${i} ${tag()}`);
  }
  const created = await request.post('/api/v1/exams', {
    // Timed, as a real mock is: in practice mode → first reveals the explanation.
    data: { subject_id: prep.id, session_kind: 'mock', exam_mode: 'timed', total_questions: 3 },
  });
  expect(created.status(), await created.text()).toBe(201);
  const examId = (await created.json()).id;

  await page.goto(`/exam/${examId}`);
  // The palette opens on "Questions"; the keyboard keeps working with it open.
  await page.getByRole('button', { name: 'Questions' }).click();
  await expect(page.getByRole('button', { name: 'Question 1, unanswered, current' })).toBeVisible();

  await page.keyboard.press('1');
  await expect(page.getByRole('button', { name: /^Question 1, answered, current$/ })).toBeVisible();

  await page.keyboard.press('f');
  await expect(page.getByRole('button', { name: 'Flagged', exact: true })).toHaveAttribute('aria-pressed', 'true');

  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: /^Question 2, unanswered, current$/ })).toBeVisible();

  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('button', { name: /^Question 1, answered, flagged, current$/ })).toBeVisible();
});

test('a roadmap, a design review and a question each open from their lists without a mouse', async ({ page, request }) => {
  // Each list used to open its items only on a click of the card or the row.
  const title = `Keyboard roadmap ${tag()}`;
  const roadmap = await (await request.post('/api/v1/roadmaps', { data: { title } })).json();
  await page.goto('/roadmaps');
  await page.getByRole('link', { name: title, exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/roadmaps/${roadmap.id}$`));

  const { items } = await (await request.get('/api/v1/design-reviews?limit=1')).json();
  await page.goto('/design-reviews');
  await page.getByRole('link', { name: items[0].title, exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/design-reviews/${items[0].id}$`));

  const prep = await createCertification(request, `Keyboard Bank ${tag()}`);
  const text = `Opened from the keyboard ${tag()}`;
  await createQuestion(request, prep, text);
  await page.goto('/question-bank');
  await pickPreparation(page, prep.name);
  await page.getByRole('button', { name: new RegExp(escapeRegExp(text)) }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Question review' })).toBeVisible();
});
