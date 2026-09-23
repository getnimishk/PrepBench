// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { expect, test } from '@playwright/test';
import { completedMockWithMisses, createCertification, createQuestion, pickPreparation, tag } from './helpers';
import { dbRow, dbRows } from './db';

/**
 * The prototype's shell and the three screens that were missing from the app:
 * global search, the profile, and the roadmap plan editor. Against the real
 * backend, with the database checked where the plan asks for database state.
 */

test('the header says where you are and reaches search, import and the profile from anywhere', async ({ page, request }) => {
  const prep = await createCertification(request, 'Header');
  await page.goto('/');
  await pickPreparation(page, prep.name);

  await page.goto('/roadmaps');
  // The header's own controls: the roadmap list has an import of its own.
  const header = page.getByRole('banner');
  await expect(header.getByTestId('header-context')).toHaveText(`Roadmaps · ${prep.name}`);

  // Import opens over the screen you are on, not by sending you to the bank.
  await header.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: /Pre-Import Inspector/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/\/roadmaps$/);

  // "/" opens search from anywhere outside a paper or a recorded round.
  await page.locator('main h1').first().click();
  await page.keyboard.press('/');
  await expect(page).toHaveURL(/\/search$/);
  await expect(page.getByRole('heading', { name: `Find anything in ${prep.name}`, level: 1 })).toBeVisible();

  await header.getByRole('link', { name: /^Profile/ }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole('heading', { name: 'Profile', level: 1 })).toBeVisible();
});

test("the rail has the prototype's fourteen destinations plus the two Learning Lab entries (sixteen total), and Review Queue counts what the review page will ask for", async ({ page, request }) => {
  const prep = await createCertification(request, 'Rail');
  await completedMockWithMisses(request, prep, 3, 'Rail Area');
  const counts = await (await request.get(`/api/v1/review/counts?subject_id=${prep.id}`)).json();
  expect(counts.unreviewed).toBe(3);

  await page.goto('/');
  await pickPreparation(page, prep.name);
  const nav = page.getByRole('navigation', { name: 'Main' });
  // 14 prototype destinations + 2 Learning Lab entries (All Sandboxes + Agile Metrics) = 16.
  await expect(nav.getByRole('link')).toHaveCount(16);
  await nav.getByRole('link', { name: 'Roadmaps' }).click();
  await expect(page).toHaveURL(/\/roadmaps$/);
  await expect(nav.getByRole('link', { name: 'Roadmaps' })).toHaveAttribute('aria-current', 'page');

  const waiting = counts.unreviewed + counts.spaced_due;
  const review = nav.getByRole('link', { name: new RegExp(`^Review Queue, ${waiting} waiting: 3 misses to read`) });
  await expect(review).toBeVisible();

  // Reading the misses clears the count on the next screen.
  const queue = await (await request.get(`/api/v1/review/queue?subject_id=${prep.id}`)).json();
  for (const item of queue.items) {
    const marked = await request.post(`/api/v1/exams/${item.session_id}/answers/${item.question_id}/reviewed`);
    expect(marked.ok(), await marked.text()).toBeTruthy();
  }
  await page.goto('/question-bank');
  const after = await (await request.get(`/api/v1/review/counts?subject_id=${prep.id}`)).json();
  expect(after.unreviewed).toBe(0);
  await expect(nav.getByRole('link', { name: after.spaced_due ? /^Review Queue, / : 'Review Queue', exact: !after.spaced_due }))
    .toBeVisible();
});

test('search finds questions, roadmap topics and guide sections in the picked preparation, and nothing from another', async ({ page, request }) => {
  const token = `srch${tag()}`;
  const mine = await createCertification(request, 'Search Mine');
  const theirs = await createCertification(request, 'Search Theirs');
  for (let i = 0; i < 8; i += 1) await createQuestion(request, mine, `Question ${i} about ${token}`);
  await createQuestion(request, theirs, `Their question about ${token}`);

  const roadmap = await (await request.post('/api/v1/roadmaps', { data: { title: `Plan ${tag()}`, subject_id: mine.id } })).json();
  const phase = await (await request.post(`/api/v1/roadmaps/${roadmap.id}/phases`, { data: { name: 'Basics' } })).json();
  const topic = await (await request.post(`/api/v1/roadmaps/${roadmap.id}/topics`, {
    data: { phase_id: phase.id, title: `Topic on ${token}`, success_criteria: 'Explain it.' },
  })).json();
  const section = await request.post(`/api/v1/roadmaps/${roadmap.id}/topics/${topic.id}/guide/sections`, {
    data: { title: 'Why it matters', body: `The ${token} is what this whole section is about.` },
  });
  expect(section.status(), await section.text()).toBe(201);

  await page.goto('/');
  await pickPreparation(page, mine.name);
  // The header's link: Home also lists this preparation, whose name starts "Search".
  await page.getByRole('banner').getByRole('link', { name: 'Search', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search' }).fill(token);

  await expect(page.getByText(`10 matches for “${token}”`)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Questions 8' })).toBeVisible();
  await expect(page.getByText('Their question about')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Guides' }).getByText(`The ${token} is what this whole section is about.`)).toBeVisible();

  // The address holds the search, so a reload opens the same results.
  await page.reload();
  await expect(page.getByText(`10 matches for “${token}”`)).toBeVisible();

  // "See all" lands on the bank showing the same number.
  await page.getByRole('link', { name: 'See all 8 in the Question Bank' }).click();
  await expect(page).toHaveURL(/\/question-bank\?keyword=/);
  await expect(page.getByText(/^8 of \d+ questions$/)).toBeVisible();

  await page.goBack();
  await page.getByRole('region', { name: 'Roadmaps' }).getByRole('link', { name: `Open topic Topic on ${token}` }).click();
  await expect(page).toHaveURL(new RegExp(`/roadmaps/${roadmap.id}/topics/${topic.id}$`));
});

test('the profile keeps a name and email, draws the initials, and counts from the data', async ({ page, request }) => {
  const before = await (await request.get('/api/v1/profile')).json();
  try {
    await page.goto('/profile');
    await expect(page.getByRole('button', { name: /sign out/i })).toHaveCount(0);

    await page.getByLabel('Display name').fill('Grace Hopper');
    await page.getByLabel('Email').fill('not an email');
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
    await page.getByLabel('Email').fill('grace@example.com');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();

    await expect(page.getByRole('banner').getByRole('link', { name: 'Profile: Grace Hopper' })).toHaveText('GH');
    const stored = dbRow<{ display_name: string; email: string }>('SELECT display_name, email FROM app_settings WHERE id = 1');
    expect(stored).toEqual({ display_name: 'Grace Hopper', email: 'grace@example.com' });

    await page.reload();
    await expect(page.getByLabel('Display name')).toHaveValue('Grace Hopper');
    const totals = page.getByRole('region', { name: 'Across all preparations' });
    const questions = dbRow<{ n: number }>('SELECT COUNT(*) AS n FROM questions')!.n;
    await expect(totals.getByText(questions.toLocaleString('en-US'), { exact: true }).first()).toBeVisible();
  } finally {
    await request.put('/api/v1/profile', { data: { display_name: before.display_name ?? '', email: before.email ?? '' } });
  }
});

test('the plan editor reshapes a roadmap without deleting a topic or changing its status', async ({ page, request }) => {
  const prep = await createCertification(request, 'Planner');
  const roadmap = await (await request.post('/api/v1/roadmaps', { data: { title: `Kafka ${tag()}`, subject_id: prep.id } })).json();
  const phaseIds: Record<string, number> = {};
  const topicIds: Record<string, number> = {};
  for (const [name, topics] of [['Basics', [['Topics', 3]]], ['Streams', [['KStreams', 4]]], ['Extras', [['Connect', 2], ['Schema registry', 1]]]] as const) {
    const phase = await (await request.post(`/api/v1/roadmaps/${roadmap.id}/phases`, { data: { name } })).json();
    phaseIds[name] = phase.id;
    for (const [title, hours] of topics) {
      const created = await (await request.post(`/api/v1/roadmaps/${roadmap.id}/topics`, {
        data: { phase_id: phase.id, title, estimated_hours: hours, success_criteria: 'Explain it unprompted.' },
      })).json();
      topicIds[title] = created.id;
    }
  }
  const demonstrated = await request.post(`/api/v1/roadmaps/${roadmap.id}/topics/${topicIds.Connect}/demonstrations`, {
    data: { response_text: 'Connectors move data in and out of Kafka without custom code.', self_grade: 'yes' },
  });
  expect(demonstrated.ok(), await demonstrated.text()).toBeTruthy();

  await page.goto(`/roadmaps/${roadmap.id}`);
  await page.getByRole('link', { name: 'Edit plan' }).click();
  await expect(page.getByRole('heading', { name: 'Edit plan', level: 1 })).toBeVisible();

  await page.getByLabel('Phase 1 name').fill('Foundations');
  await page.getByRole('button', { name: 'Move Streams up' }).click();
  await page.getByRole('button', { name: 'Remove Extras' }).click();
  const dialog = page.getByRole('dialog', { name: 'Remove Extras?' });
  await dialog.getByLabel('Move the topics to').click();
  await page.getByRole('option', { name: 'Foundations' }).click();
  await dialog.getByRole('button', { name: 'Remove and move topics' }).click();
  await expect(page.getByText('Extras (its 2 topics move to Foundations)')).toBeVisible();

  await page.getByLabel('Weekly hours budget').fill('5');
  await page.getByLabel('Start date').fill('2099-01-04');
  await expect(page.getByRole('status').filter({ hasText: 'at 5h a week' })).toContainText('8h of estimated work left');

  await page.getByRole('button', { name: 'Save plan' }).click();
  await expect(page.getByText('Plan saved.')).toBeVisible();

  const phases = dbRows<{ id: number; name: string; order_index: number }>(
    'SELECT id, name, order_index FROM roadmap_phases WHERE roadmap_id = ? ORDER BY order_index', roadmap.id,
  );
  expect(phases.map((p) => p.name)).toEqual(['Streams', 'Foundations']);
  const connect = dbRow<{ phase_id: number; status: string }>('SELECT phase_id, status FROM roadmap_topics WHERE id = ?', topicIds.Connect);
  expect(connect).toEqual({ phase_id: phaseIds.Basics, status: 'COMPLETED' });
  expect(dbRow<{ n: number }>('SELECT COUNT(*) AS n FROM roadmap_topics WHERE roadmap_id = ?', roadmap.id)!.n).toBe(4);
  expect(dbRow<{ n: number }>('SELECT COUNT(*) AS n FROM topic_demonstrations WHERE topic_id = ?', topicIds.Connect)!.n).toBe(1);
  expect(dbRow('SELECT weekly_hours_budget, start_date FROM roadmaps WHERE id = ?', roadmap.id))
    .toEqual({ weekly_hours_budget: 5, start_date: '2099-01-04' });

  // And the editor reopens on what was saved.
  await page.getByRole('link', { name: 'Edit plan' }).click();
  await expect(page.getByLabel('Phase 2 name')).toHaveValue('Foundations');
  await expect(page.getByLabel('Weekly hours budget')).toHaveValue('5');
});
