// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { expect, test } from './fixtures';
import { pickPreparation, tag } from './helpers';
import { dbRow } from './db';

/**
 * Plan §33, the frontend half: the screens that grow with a learner's data,
 * opened with a lot of it -- a 2,000-row import through the dialog, the Question
 * Bank over that bank, a 300-topic roadmap, and Insights across twenty areas.
 *
 * Budgets are for the production build these tests run against (vite preview;
 * see playwright.config.ts), measured on 2026-09-30 where this test actually
 * runs: in a full suite on four workers, sharing the machine with three other
 * browsers, backends and frontends. Each is double the slower of two such runs,
 * rounded up to the next half second, with a one-second floor so a busy machine
 * does not fail a step that normally takes 200 ms. They catch a screen that
 * grinds, not a few milliseconds. Each measurement is attached to the report.
 * The backend's own timings and query counts are in backend/scripts/perf_gate.py.
 *
 * Measured in two four-worker full-suite runs (ms): import checked 5894/4959,
 * import saved 2599/2529, question bank 910/1740, syllabus 3470/3384, phase
 * overview 467/651, schedule 1345/1790, insights 2071/1979, home 2276/2024 --
 * 1.5 to 2.8 times what the same steps took with the suite on one worker, which
 * is the contention, not the screens. Four is the most contended setting
 * supported (PREPBENCH_E2E_WORKERS); at the default two these budgets have more
 * room. Re-measure the same way before raising the worker count past four.
 */

const BUDGETS_MS: Record<string, number> = {
  'import: 2,000 rows checked': 12_000,
  'import: 2,000 rows saved': 5_500,
  'question bank: first page of 2,000': 3_500,
  // The 300-topic syllabus is the heaviest render in the app -- 300 rows, each
  // with a link, a status control and a progress bar.
  'roadmap: 300 topics, syllabus': 7_000,
  'roadmap: 300 topics, phase overview': 1_500,
  'roadmap: 300 topics, schedule': 4_000,
  'insights: twenty areas': 4_500,
  'home: with the mock': 5_000,
};

test('screens stay usable with a large bank, a large roadmap and many areas', async ({ page, request }, testInfo) => {
  test.setTimeout(420_000);
  page.setDefaultTimeout(60_000);
  const t = tag();
  const timings: Record<string, number> = {};
  const timed = async (name: string, work: () => Promise<unknown>) => {
    const started = Date.now();
    await work();
    timings[name] = Date.now() - started;
  };

  // A certification whose paper is 100 questions, so one mock spans every area.
  const name = `Large Bank ${t}`;
  const certification = `Large Bank Certification ${t}`;
  const created = await request.post('/api/v1/subjects', {
    data: { name, kind: 'certification', certification, pass_mark: 85, exam_question_count: 100, exam_minutes: 90 },
  });
  expect(created.status(), await created.text()).toBe(201);
  const prepId = (await created.json()).id;

  // 1. A 2,000-row file, through the import dialog.
  const header = 'text,question_type,difficulty,domain,topic,certification,explanation,option_1,option_1_correct,option_2,option_2_correct';
  const rows = Array.from({ length: 2000 }, (_, i) =>
    `"Large bank ${t} question ${i}: which of these holds in area ${i % 20}?",single_choice,medium,Area ${i % 20},Topic ${i % 60},${certification},"Explanation ${i}.",Right,true,Wrong,false`);
  await page.goto('/question-bank');
  await pickPreparation(page, name);
  await page.getByRole('main').getByRole('button', { name: 'Import', exact: true }).click();
  await timed('import: 2,000 rows checked', async () => {
    await page.locator('input[type="file"]').setInputFiles({
      name: `large-${t}.csv`, mimeType: 'text/csv', buffer: Buffer.from([header, ...rows].join('\n'), 'utf-8'),
    });
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Import 2000 questions' })).toBeVisible({ timeout: 60_000 });
  });
  await timed('import: 2,000 rows saved', async () => {
    await page.getByRole('dialog').getByRole('button', { name: 'Import 2000 questions' }).click();
    await expect.poll(() => dbRow<{ n: number }>('SELECT COUNT(*) AS n FROM questions WHERE subject_id = ?', prepId)!.n, { timeout: 60_000 }).toBe(2000);
  });

  // 2. The Question Bank over 2,000 questions. Measured as a move within the open
  // app, not a cold page load: a cold load adds fetching the bundle, which is the
  // server's time and not the screen's.
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.getByText(new RegExp(`Large bank ${t} question \\d+`)).first()).toBeVisible({ timeout: 60_000 });
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Study Library', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Learn', level: 1 })).toBeVisible();
  await timed('question bank: first page of 2,000', async () => {
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Question Bank', exact: true }).click();
    await expect(page.getByText(new RegExp(`Large bank ${t} question \\d+`)).first()).toBeVisible({ timeout: 60_000 });
  });

  // 3. A 300-topic roadmap, in every view.
  const topics = Array.from({ length: 300 }, (_, i) => ({ title: `Large topic ${i}`, phase_name: `Phase ${Math.floor(i / 15)}`, estimated_hours: 2 }));
  const imported = await request.post('/api/v1/roadmaps/import/confirm', {
    data: { title: `Large roadmap ${t}`, topics, resources: [], weekly_hours_budget: 10, start_date: '2026-09-01' },
  });
  expect(imported.status(), await imported.text()).toBe(201);
  const roadmapId = (await imported.json()).roadmap_id;
  await page.goto(`/roadmaps/${roadmapId}`);
  await expect(page.getByRole('link', { name: 'Large topic 299', exact: true })).toBeAttached({ timeout: 60_000 });
  await page.getByRole('tab', { name: 'Phase overview' }).click();
  await expect(page.getByRole('button', { name: 'Open Phase 19' })).toBeAttached({ timeout: 60_000 });
  await timed('roadmap: 300 topics, syllabus', async () => {
    await page.getByRole('tab', { name: 'Syllabus' }).click();
    await expect(page.getByRole('link', { name: 'Large topic 299', exact: true })).toBeAttached({ timeout: 60_000 });
  });
  for (const view of ['Phase overview', 'Schedule']) {
    await timed(`roadmap: 300 topics, ${view.toLowerCase()}`, async () => {
      await page.getByRole('tab', { name: new RegExp(view) }).click();
      await expect(page.getByRole('tab', { name: new RegExp(view) })).toHaveAttribute('aria-selected', 'true');
      if (view === 'Phase overview') {
        // One row a phase; the last one drawn means the view is done.
        await expect(page.getByRole('button', { name: 'Open Phase 19' })).toBeAttached({ timeout: 60_000 });
      } else {
        // The schedule opens on one bar per phase, and can be switched to one per topic.
        await expect(page.getByText('Phase 19', { exact: true })).toBeAttached({ timeout: 60_000 });
        await page.getByRole('button', { name: 'Topics' }).click();
        await expect(page.getByText('Large topic 299', { exact: true })).toBeAttached({ timeout: 60_000 });
      }
    });
  }

  // 4. Insights across twenty areas, from a 100-question mock.
  const mock = await request.post('/api/v1/exams', { data: { subject_id: prepId, session_kind: 'mock', total_questions: 100 } });
  expect(mock.status(), await mock.text()).toBe(201);
  const mockId = (await mock.json()).id;
  const paper = await (await request.get(`/api/v1/exams/${mockId}`)).json();
  for (const [i, q] of (paper.questions as { id: number; options: { id: number; option_text: string }[] }[]).entries()) {
    const pick = q.options.find((o) => o.option_text === (i % 3 === 0 ? 'Wrong' : 'Right'))!;
    await request.post(`/api/v1/exams/${mockId}/answer`, { data: { question_id: q.id, selected_option_ids: [pick.id] } });
  }
  expect((await request.post(`/api/v1/exams/${mockId}/finish`)).status()).toBe(200);
  await timed('insights: twenty areas', async () => {
    await page.goto('/analytics');
    await expect(page.getByRole('link', { name: /^Area \d+: \d+%/ })).toHaveCount(20, { timeout: 60_000 });
  });
  await timed('home: with the mock', async () => {
    await page.goto('/');
    await expect(page.locator('main h1').first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('Your last 1 mock')).toBeVisible({ timeout: 60_000 });
  });

  await testInfo.attach('timings', { body: JSON.stringify(timings, null, 2), contentType: 'application/json' });
  console.log('Frontend timings (ms, production build):', JSON.stringify(timings));
  // Every step measured has a budget, and every budget was measured: a renamed or
  // new step fails here rather than going unchecked.
  expect(Object.keys(timings).sort()).toEqual(Object.keys(BUDGETS_MS).sort());
  for (const [step, ms] of Object.entries(timings)) {
    expect(ms, `${step} took ${ms} ms (budget ${BUDGETS_MS[step]} ms)`).toBeLessThan(BUDGETS_MS[step]);
  }
});
