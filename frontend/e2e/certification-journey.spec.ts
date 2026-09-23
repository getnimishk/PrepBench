// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { pickPreparation, tag } from './helpers';
import { dbRow, dbRows } from './db';

/**
 * The release gate's journey (plan §23), for the seeded PSM I preparation:
 *
 *   Select PSM I → Home → weakest area → Learn → study guide → study the topic →
 *   practise the topic → answer incorrectly → mistake recorded → question detail →
 *   correct answer → explanation → verification → pass → review schedule →
 *   new evidence → Insights → full mock → exam review → updated readiness
 *
 * Every step is taken in the browser, the way a learner takes it, and the ones
 * that change anything are checked in the database itself (see ./db.ts), not
 * only in what the page says.
 *
 * What a working install already has is set up through the API first: a PSM I
 * question bank and one earlier mock, answered so that one area is clearly weak.
 * Without that there is no "weakest area" for Home to name. The run has no AI
 * provider, so the study guide is written by the learner, as it would be here.
 */

const PSM_I = 'Scrum / PSM I';
const EVENTS = 'Scrum Events';
const ROLES = 'Scrum Roles';
const EVENTS_EXPLANATION = 'The Sprint Retrospective is the last event of the Sprint.';

interface Question { id: number; domain: string; options: { id: number; option_text: string }[] }

/** The bank this journey starts from, imported the way a learner's bank arrives:
 *  in one batch rather than eighty round trips. */
async function importBank(
  request: APIRequestContext, certification: string, rows: { text: string; domain: string; topic: string; explanation: string }[],
): Promise<void> {
  const response = await request.post('/api/v1/imports/confirm', {
    data: rows.map(({ text, domain, topic, explanation }) => ({
      text, question_type: 'single_choice', difficulty: 'medium', domain, topic, certification, explanation,
      options: [
        { option_text: 'Right', is_correct: true, order_index: 0 },
        { option_text: 'Wrong', is_correct: false, order_index: 1 },
      ],
    })),
  });
  expect(response.status(), await response.text()).toBe(200);
  expect((await response.json()).success_count).toBe(rows.length);
}

// A string names the entry exactly; a pattern allows for what follows the label,
// as Review Queue's count of waiting review does.
const nav = (page: Page, name: string | RegExp) => page.getByRole('navigation', { name: 'Main' })
  .getByRole('link', typeof name === 'string' ? { name, exact: true } : { name });

test('the certification journey, from picking PSM I to an updated readiness, checked in the database', async ({ page, request }) => {
  test.setTimeout(600_000);
  // A long journey: a step that cannot happen should fail on its own, not use up the whole budget.
  page.setDefaultTimeout(30_000);
  const t = tag();
  const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

  // ---------------------------------------------------------------------------
  // What a working install already has.
  // ---------------------------------------------------------------------------
  const listed = await (await request.get('/api/v1/subjects')).json();
  const psm = (Array.isArray(listed) ? listed : listed.items).find((s: { name: string }) => s.name === PSM_I);
  expect(psm, 'the seeded PSM I preparation').toBeTruthy();
  expect(psm.exam_question_count).toBe(80);

  // A bank the size of the real paper: 20 questions on the Scrum events, 60 on the roles.
  await importBank(request, psm.certification, [
    ...Array.from({ length: 20 }, (_, i) => ({
      text: `E${i} ${t}: which event closes the Sprint?`, domain: EVENTS, topic: 'Sprint Events',
      explanation: EVENTS_EXPLANATION,
    })),
    ...Array.from({ length: 60 }, (_, i) => ({
      text: `R${i} ${t}: who orders the Product Backlog?`, domain: ROLES, topic: 'Accountabilities',
      explanation: 'The Product Owner orders the Product Backlog.',
    })),
  ]);

  // One earlier mock: every events question wrong, every roles question right.
  const earlier = await request.post('/api/v1/exams', { data: { subject_id: psm.id, session_kind: 'mock', total_questions: 80 } });
  expect(earlier.status(), await earlier.text()).toBe(201);
  const earlierId: number = (await earlier.json()).id;
  const paper = await (await request.get(`/api/v1/exams/${earlierId}`)).json();
  for (const q of paper.questions as Question[]) {
    const pick = q.options.find((o) => o.option_text === (q.domain === EVENTS ? 'Wrong' : 'Right'))!;
    const saved = await request.post(`/api/v1/exams/${earlierId}/answer`, { data: { question_id: q.id, selected_option_ids: [pick.id] } });
    expect(saved.status(), await saved.text()).toBe(200);
  }
  expect((await request.post(`/api/v1/exams/${earlierId}/finish`)).status()).toBe(200);
  expect(dbRows(
    `SELECT q.domain AS domain, SUM(a.is_correct) AS correct, COUNT(*) AS answered
       FROM exam_answers a JOIN questions q ON q.id = a.question_id
      WHERE a.session_id = ? GROUP BY q.domain ORDER BY q.domain`, earlierId,
  )).toEqual([
    { domain: EVENTS, correct: 0, answered: 20 },
    { domain: ROLES, correct: 60, answered: 60 },
  ]);

  // The learner's study plan for PSM I, with a topic on the events.
  const roadmapTitle = `PSM I study plan ${t}`;
  const roadmap = await (await request.post('/api/v1/roadmaps', { data: { title: roadmapTitle, subject_id: psm.id } })).json();
  const phase = await (await request.post(`/api/v1/roadmaps/${roadmap.id}/phases`, { data: { name: 'Scrum Theory' } })).json();
  const topic = await (await request.post(`/api/v1/roadmaps/${roadmap.id}/topics`, {
    data: {
      phase_id: phase.id,
      title: 'Sprint Events',
      learning_objective: 'Know what each Scrum event is for and when it happens.',
      success_criteria: 'Name the five events, their order, and what each one is for.',
      estimated_hours: 2,
    },
  })).json();

  // ---------------------------------------------------------------------------
  // 1. Select PSM I.
  // ---------------------------------------------------------------------------
  await page.goto('/');
  await pickPreparation(page, PSM_I);
  expect(await page.evaluate(() => localStorage.getItem('prepbench.selectedPreparationId'))).toBe(String(psm.id));

  // ---------------------------------------------------------------------------
  // 2. Home names what stands between the learner and the pass mark.
  // 3. The weakest area, opened.
  // ---------------------------------------------------------------------------
  await expect(page.getByRole('link', { name: 'Practise Sprint Events — 0 of 20 correct in your mocks' })).toBeVisible();
  await expect(page.getByRole('button', { name: `Practise ${EVENTS}` })).toBeVisible();
  // The same conclusion as readiness itself reaches, from the same answers.
  const reading = (await (await request.get(`/api/v1/subjects/${psm.id}`)).json()).readiness;
  expect(reading.blockers).toContainEqual(expect.objectContaining({ kind: 'weak_domain', domain: EVENTS, value: 0 }));

  await nav(page, 'Insights').click();
  await page.getByRole('link', { name: new RegExp(`^${EVENTS}: 0%`) }).last().click();
  await expect(page.getByRole('heading', { name: EVENTS, level: 1 })).toBeVisible();
  await expect(page.getByText('0 of 20 answers')).toBeVisible();

  // ---------------------------------------------------------------------------
  // 4. Learn: the study plan, and its topic on that area.
  // ---------------------------------------------------------------------------
  await nav(page, 'Study Library').click();
  await page.getByRole('link', { name: /(All roadmaps|Open Roadmaps)/ }).click();
  await page.getByRole('link', { name: roadmapTitle, exact: true }).click();
  await page.getByRole('link', { name: 'Sprint Events', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sprint Events', level: 1 })).toBeVisible();

  // ---------------------------------------------------------------------------
  // 5. The study guide: written, self-checked and read.
  // ---------------------------------------------------------------------------
  await page.getByRole('button', { name: 'Study guide' }).click();
  await page.getByRole('button', { name: 'Write a section' }).click();
  const editor = page.getByRole('dialog');
  await editor.getByLabel('Title').fill('The Retrospective ends the Sprint');
  await editor.getByLabel('Explanation').fill('Sprint Planning opens it, the Daily Scrum runs through it, the Review inspects the increment, and the Retrospective closes it.');
  await editor.getByLabel('Check question (optional)').fill('Which event is the last one in a Sprint?');
  await editor.getByLabel('Model answer (optional)').fill('The Sprint Retrospective.');
  await editor.getByRole('button', { name: 'Save section' }).click();

  await page.getByPlaceholder('Answer it before you look.').fill('The Retrospective.');
  await page.getByRole('button', { name: 'Compare with the model answer' }).click();
  await expect(page.getByText('The Sprint Retrospective.')).toBeVisible();
  await page.getByRole('button', { name: 'I have read this' }).click();
  await expect(page.getByText('1 of 1 sections read')).toBeVisible();

  const guide = dbRows<{ title: string; read_at: string | null }>(
    'SELECT title, read_at FROM topic_guide_sections WHERE topic_id = ?', topic.id,
  );
  expect(guide).toHaveLength(1);
  expect(guide[0].title).toBe('The Retrospective ends the Sprint');
  expect(guide[0].read_at).not.toBeNull();

  // ---------------------------------------------------------------------------
  // 6. Studying the topic ends in demonstrating it, graded against its standard.
  // ---------------------------------------------------------------------------
  await page.getByRole('button', { name: 'Demonstrate this topic' }).click();
  const explanation = 'Planning, Daily Scrum, Review and Retrospective, inside the Sprint that contains them; the Retrospective comes last.';
  await page.getByLabel('Explain it in your own words').fill(explanation);
  await page.getByRole('button', { name: /reveal the standard/ }).click();
  await page.getByRole('button', { name: /Yes, unprompted/ }).click();
  await expect(page).toHaveURL(new RegExp(`/roadmaps/${roadmap.id}/topics/${topic.id}`));
  await expect(page.getByRole('heading', { name: 'Completed', level: 2 })).toBeVisible();

  await expect.poll(() => dbRow('SELECT status, progress_percentage FROM roadmap_topics WHERE id = ?', topic.id))
    .toEqual({ status: expect.stringMatching(/^completed$/i), progress_percentage: 100 });
  await expect.poll(() => dbRows('SELECT self_grade, response_text FROM topic_demonstrations WHERE topic_id = ?', topic.id))
    .toEqual([{ self_grade: 'yes', response_text: explanation }]);

  // ---------------------------------------------------------------------------
  // 7. Practise the topic's area: a five-question drill, started from the area.
  // ---------------------------------------------------------------------------
  await nav(page, 'Insights').click();
  await page.getByRole('link', { name: new RegExp(`^${EVENTS}: 0%`) }).last().click();
  await page.getByRole('link', { name: /Practise this area/ }).click();
  await expect(page.getByRole('heading', { name: EVENTS, level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'More options' }).click();
  await page.getByRole('slider', { name: 'Number of questions' }).focus();
  await page.keyboard.press('Home');
  await expect(page.getByText(/^5 questions from this area alone/)).toBeVisible();
  await page.getByRole('button', { name: new RegExp(`Drill ${EVENTS}`) }).click();
  await expect(page.getByText(/Question 1 of 5/)).toBeVisible();

  const drillId = Number(/\/exam\/(\d+)/.exec(page.url())![1]);
  const drill = await (await request.get(`/api/v1/exams/${drillId}`)).json();
  const missedId: number = drill.question_ids_order[0];
  expect(dbRow('SELECT session_kind, subject_id FROM exam_sessions WHERE id = ?', drillId))
    .toEqual({ session_kind: 'drill', subject_id: psm.id });

  // ---------------------------------------------------------------------------
  // 8. Answer incorrectly -- the right answer and the explanation follow at once.
  // 9. The mistake is recorded.
  // ---------------------------------------------------------------------------
  await page.getByRole('radio', { name: 'Wrong' }).check();
  await page.getByRole('button', { name: 'Check answer' }).click();
  await expect(page.getByText('Not this time. The right answer is marked above.')).toBeVisible();
  await expect(page.getByText('Correct', { exact: true })).toBeVisible();
  await expect(page.getByText(EVENTS_EXPLANATION).first()).toBeVisible();

  await expect.poll(() => dbRow<{ is_correct: number }>(
    'SELECT is_correct FROM exam_answers WHERE session_id = ? AND question_id = ?', drillId, missedId,
  )?.is_correct).toBe(0);

  // The rest of the drill, right.
  for (let n = 2; n <= 5; n += 1) {
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByText(new RegExp(`Question ${n} of 5`))).toBeVisible();
    await page.getByRole('radio', { name: 'Right' }).check();
    await page.getByRole('button', { name: 'Check answer' }).click();
  }
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, submit' }).click();
  await expect(page).toHaveURL(new RegExp(`/exam-review/${drillId}`));
  await expect(page.getByText('4 of 5 correct')).toBeVisible();

  expect(dbRow('SELECT status, correct_count, answered_questions FROM exam_sessions WHERE id = ?', drillId))
    .toEqual({ status: expect.stringMatching(/^completed$/i), correct_count: 4, answered_questions: 5 });
  // A drill miss goes onto the spaced schedule when the drill is submitted, due from tomorrow.
  const missedSchedule = dbRow<{ repetition: number; next_review_date: string }>(
    'SELECT repetition, next_review_date FROM spaced_repetition WHERE question_id = ?', missedId,
  );
  expect(missedSchedule?.repetition).toBe(0);
  expect(missedSchedule!.next_review_date > now()).toBe(true);

  // ---------------------------------------------------------------------------
  // 10. Question detail, 11. its correct answer, 12. its explanation -- opened from the area.
  // ---------------------------------------------------------------------------
  await nav(page, 'Insights').click();
  await page.getByRole('link', { name: new RegExp(`^${EVENTS}: `) }).last().click();
  const missedText = (dbRow<{ text: string }>('SELECT text FROM questions WHERE id = ?', missedId))!.text;
  await page.getByRole('link', { name: `Open question: ${missedText.slice(0, 60)}` }).click();
  await expect(page).toHaveURL(new RegExp(`/question-bank\\?question=${missedId}`));
  await expect(page.getByText(missedText).first()).toBeVisible();
  const review = page.getByRole('dialog', { name: 'Question review' });
  await expect(review.getByText('Correct', { exact: true })).toBeVisible();
  await expect(review.getByText('Explanation', { exact: true })).toBeVisible();
  await expect(page.getByText(EVENTS_EXPLANATION).first()).toBeVisible();
  expect(dbRows('SELECT option_text FROM question_options WHERE question_id = ? AND is_correct = 1', missedId))
    .toEqual([{ option_text: 'Right' }]);
  // The detail opens over the page; it is closed before going on, as a learner would.
  await page.keyboard.press('Escape');
  await expect(review).toBeHidden();

  // ---------------------------------------------------------------------------
  // 13. Verification, 14. passed, 15. and scheduled: a miss from the mock, checked
  //     with a different question on the same idea.
  // ---------------------------------------------------------------------------
  const queueBefore = await (await request.get(`/api/v1/review/queue?subject_id=${psm.id}`)).json();
  expect(queueBefore.total_unreviewed).toBe(20);
  const reviewed = queueBefore.items[0];

  // Twenty misses wait, so the entry carries its count.
  await nav(page, /^Review Queue, \d+ waiting: 20 misses to read/).click();
  await page.getByRole('button', { name: 'Start review' }).click();
  await expect(page.getByText(/Review today · 1 of \d+/)).toBeVisible();
  await expect(page.getByText('A different question on the same idea.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Right', exact: true }).click();
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await expect(page.getByText('Checked.')).toBeVisible();

  const check = dbRow<{ question_id: number; passed: number }>(
    'SELECT question_id, passed FROM review_checks WHERE answer_id = ?', reviewed.answer_id,
  );
  expect(check?.passed).toBe(1);
  expect(check?.question_id).not.toBe(reviewed.question_id);
  expect(dbRow<{ reviewed_at: string | null }>('SELECT reviewed_at FROM exam_answers WHERE id = ?', reviewed.answer_id)?.reviewed_at)
    .not.toBeNull();
  const checkSchedule = dbRow<{ repetition: number; last_reviewed_at: string | null; next_review_date: string }>(
    'SELECT repetition, last_reviewed_at, next_review_date FROM spaced_repetition WHERE question_id = ?', check!.question_id,
  );
  expect(checkSchedule?.last_reviewed_at).not.toBeNull();
  expect(checkSchedule!.next_review_date > now()).toBe(true);

  // ---------------------------------------------------------------------------
  // 16. New evidence, 17. shown by Insights.
  // ---------------------------------------------------------------------------
  const queueAfter = await (await request.get(`/api/v1/review/queue?subject_id=${psm.id}`)).json();
  expect(queueAfter.total_unreviewed).toBe(19);

  await nav(page, 'Insights').click();
  await page.getByRole('link', { name: new RegExp(`^${EVENTS}: `) }).last().click();
  // Twenty mock answers and five drill answers, four of them right.
  await expect(page.getByText('4 of 25 answers')).toBeVisible();
  const area = await (await request.get(
    `/api/v1/analytics/domain-detail?subject_id=${psm.id}&domain=${encodeURIComponent(EVENTS)}`,
  )).json();
  expect(area).toMatchObject({ answers: 25, correct: 4, unreviewed_misses: 19 });
  expect(dbRow(
    `SELECT COUNT(*) AS answered, SUM(a.is_correct) AS correct FROM exam_answers a
       JOIN questions q ON q.id = a.question_id JOIN exam_sessions s ON s.id = a.session_id
      WHERE s.subject_id = ? AND q.domain = ?`, psm.id, EVENTS,
  )).toEqual({ answered: 25, correct: 4 });

  // ---------------------------------------------------------------------------
  // 18. A full mock, 19. its review, 20. and the readiness it moves.
  // ---------------------------------------------------------------------------
  const before = await (await request.get(`/api/v1/subjects/${psm.id}`)).json();
  expect(before.readiness.mock_count).toBe(1);

  await nav(page, 'Mock Exam').click();
  await expect(page.getByText('80 available · 80 needed')).toBeVisible();
  await page.getByRole('button', { name: 'Start mock' }).click();
  await expect(page.getByText(/Question 1 of 80/)).toBeVisible();
  const mockId = Number(/\/exam\/(\d+)/.exec(page.url())![1]);

  for (let n = 1; n <= 80; n += 1) {
    await page.getByRole('radio', { name: 'Right' }).check();
    if (n < 80) {
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(page.getByText(new RegExp(`Question ${n + 1} of 80`))).toBeVisible();
    }
  }
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, submit' }).click();

  await expect(page).toHaveURL(new RegExp(`/exam-review/${mockId}`));
  await expect(page.getByText('80 of 80 correct')).toBeVisible();
  await expect(page.getByText('Where this leaves you')).toBeVisible();

  expect(dbRow('SELECT session_kind, status, correct_count, score_percentage FROM exam_sessions WHERE id = ?', mockId))
    .toEqual({ session_kind: 'mock', status: expect.stringMatching(/^completed$/i), correct_count: 80, score_percentage: 100 });
  expect(dbRows(
    `SELECT score_percentage FROM exam_sessions WHERE subject_id = ? AND session_kind = 'mock'
        AND UPPER(status) = 'COMPLETED' ORDER BY end_time`, psm.id,
  )).toEqual([{ score_percentage: 75 }, { score_percentage: 100 }]);

  const after = await (await request.get(`/api/v1/subjects/${psm.id}`)).json();
  expect(after.readiness.mock_count).toBe(2);
  expect(after.readiness.recent_scores.slice(-2)).toEqual([75, 100]);

  // And Home, reloaded, describes the new evidence rather than the old.
  await nav(page, 'Home').click();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Practise Sprint Events — 20 of 40 correct in your mocks' })).toBeVisible();
  await expect(page.getByText('Your last 2 mocks')).toBeVisible();
});
