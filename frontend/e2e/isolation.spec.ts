// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { expect, test } from '@playwright/test';
import { completedMockWithMisses, createCertification, createQuestion, pickPreparation, tag, type CreatedPreparation } from './helpers';
import { dbRow, dbRows } from './db';

/**
 * Preparation isolation, in a real browser.
 *
 * The plan's section 9 test: pick one preparation, observe what it shows, switch
 * to another, check that everything changed, switch back, check the first is
 * exactly as it was. The backend suite already proves the database half of this;
 * what only a browser can prove is that the screens actually follow the picker.
 * Until this phase they did not -- Home, Insights and Mock Exam each guessed
 * their own preparation, and switching the picker changed nothing on them.
 */

test('switching preparation changes what the Question Bank shows, and switching back restores it', async ({ page, request }) => {
  const alpha = await createCertification(request, 'Alpha');
  const beta = await createCertification(request, 'Beta');

  const t = tag();
  const alphaQuestion = `Alpha-only question ${t}`;
  const betaQuestion = `Beta-only question ${t}`;
  await createQuestion(request, alpha, alphaQuestion);
  await createQuestion(request, beta, betaQuestion);

  await page.goto('/question-bank');

  await pickPreparation(page, alpha.name);
  await expect(page.getByText(alphaQuestion)).toBeVisible();
  await expect(page.getByText(betaQuestion)).toHaveCount(0);

  await pickPreparation(page, beta.name);
  await expect(page.getByText(betaQuestion)).toBeVisible();
  await expect(page.getByText(alphaQuestion)).toHaveCount(0);

  // Back to the first: its state must be intact, not merely re-fetched into
  // something that happens to look similar.
  await pickPreparation(page, alpha.name);
  await expect(page.getByText(alphaQuestion)).toBeVisible();
  await expect(page.getByText(betaQuestion)).toHaveCount(0);
});

test('"All questions" is the one deliberate way to see across preparations', async ({ page, request }) => {
  const alpha = await createCertification(request, 'Scope');
  const beta = await createCertification(request, 'Other');

  const t = tag();
  const mine = `Mine ${t}`;
  const theirs = `Theirs ${t}`;
  await createQuestion(request, alpha, mine);
  await createQuestion(request, beta, theirs);

  await page.goto('/question-bank');
  await pickPreparation(page, alpha.name);
  await expect(page.getByText(theirs)).toHaveCount(0);

  await page.getByLabel('Showing').click();
  await page.getByRole('option', { name: 'All questions' }).click();

  await expect(page.getByText(mine)).toBeVisible();
  await expect(page.getByText(theirs)).toBeVisible();
});

test('the chosen preparation survives a hard reload', async ({ page, request }) => {
  const prep = await createCertification(request, 'Persist');

  await page.goto('/');
  await pickPreparation(page, prep.name);

  await page.reload();

  await expect(page.getByRole('button', { name: `Preparation: ${prep.name}. Change preparation` }))
    .toBeVisible();
});

test('Home describes the picked preparation rather than guessing one', async ({ page, request }) => {
  const prep = await createCertification(request, 'Homebound');

  await page.goto('/');
  await pickPreparation(page, prep.name);

  // Home's eyebrow names the preparation it is describing. Before this phase it
  // named whichever preparation had the most mocks, whatever the picker said.
  await expect(page.getByRole('main').getByText(prep.name, { exact: true }).first()).toBeVisible();
});

/**
 * Plan §24: three preparations, each with its own evidence, visited in turn and
 * the first revisited -- and nothing of one found in another's questions, scores,
 * roadmaps, review, recommendations, practice history, analytics or evidence.
 */
test('three preparations keep their own evidence on every screen, and the first is unchanged after the others', async ({ page, request }) => {
  test.setTimeout(240_000);
  page.setDefaultTimeout(20_000);
  const t = tag();

  // Two certifications with a mock each, and a skill with a drill -- a skill has no exam to sit.
  const alpha = await createCertification(request, `Iso Alpha ${t}`);
  const beta = await createCertification(request, `Iso Beta ${t}`);
  const skillName = `Iso Skill ${t}`;
  const skillCreated = await request.post('/api/v1/subjects', {
    data: { name: skillName, kind: 'skill', certification: `Iso Skill binding ${t}` },
  });
  expect(skillCreated.status(), await skillCreated.text()).toBe(201);
  const skillBody = await skillCreated.json();
  const skill: CreatedPreparation = { id: skillBody.id, name: skillName, certification: `Iso Skill binding ${t}` };

  const area = (p: CreatedPreparation) => `${p.name} area`;
  await completedMockWithMisses(request, alpha, 3, area(alpha));
  await completedMockWithMisses(request, beta, 3, area(beta));
  for (let i = 0; i < 3; i += 1) await createQuestion(request, skill, `Skill question ${i} ${t}`, area(skill));
  const drill = await request.post('/api/v1/exams', { data: { subject_id: skill.id, session_kind: 'drill', total_questions: 3 } });
  expect(drill.status(), await drill.text()).toBe(201);
  const drillId = (await drill.json()).id;
  const drillPaper = await (await request.get(`/api/v1/exams/${drillId}`)).json();
  for (const q of drillPaper.questions as { id: number; options: { id: number; option_text: string }[] }[]) {
    const wrong = q.options.find((o) => o.option_text === 'Wrong')!;
    expect((await request.post(`/api/v1/exams/${drillId}/answer`, { data: { question_id: q.id, selected_option_ids: [wrong.id] } })).status()).toBe(200);
  }
  expect((await request.post(`/api/v1/exams/${drillId}/finish`)).status()).toBe(200);

  // A roadmap each; only alpha's topic is demonstrated.
  const roadmaps: Record<number, { id: number; title: string; topicId: number }> = {};
  for (const p of [alpha, beta, skill]) {
    const title = `${p.name} roadmap`;
    const roadmap = await (await request.post('/api/v1/roadmaps', { data: { title, subject_id: p.id } })).json();
    const phase = await (await request.post(`/api/v1/roadmaps/${roadmap.id}/phases`, { data: { name: 'Phase' } })).json();
    const topic = await (await request.post(`/api/v1/roadmaps/${roadmap.id}/topics`, {
      data: { phase_id: phase.id, title: `${p.name} topic`, success_criteria: 'Explain it.' },
    })).json();
    roadmaps[p.id] = { id: roadmap.id, title, topicId: topic.id };
  }
  const demonstrated = await request.post(
    `/api/v1/roadmaps/${roadmaps[alpha.id].id}/topics/${roadmaps[alpha.id].topicId}/demonstrations`,
    { data: { response_text: 'Explained, unprompted.', self_grade: 'yes' } },
  );
  expect(demonstrated.status(), await demonstrated.text()).toBeLessThan(300);

  // --- The database: each preparation owns exactly its own rows. -------------------------
  const owned = (sql: string, id: number) => (dbRow<{ n: number }>(sql, id)?.n ?? 0);
  for (const p of [alpha, beta, skill]) {
    expect(owned('SELECT COUNT(*) AS n FROM questions WHERE subject_id = ?', p.id)).toBe(3);
    expect(owned('SELECT COUNT(*) AS n FROM roadmaps WHERE subject_id = ?', p.id)).toBe(1);
    expect(owned(`SELECT COUNT(*) AS n FROM exam_sessions WHERE subject_id = ? AND UPPER(status) = 'COMPLETED'`, p.id)).toBe(1);
    // Every answer in a preparation's sessions is to that preparation's own questions.
    expect(owned(
      `SELECT COUNT(*) AS n FROM exam_answers a JOIN exam_sessions s ON s.id = a.session_id
         JOIN questions q ON q.id = a.question_id WHERE s.subject_id = ? AND q.subject_id IS NOT s.subject_id`, p.id,
    )).toBe(0);
  }
  expect(dbRows(`SELECT session_kind FROM exam_sessions WHERE subject_id = ?`, skill.id)).toEqual([{ session_kind: 'drill' }]);
  // Evidence: the one demonstration belongs to alpha's topic, and no one else's.
  for (const p of [alpha, beta, skill]) {
    expect(owned(
      `SELECT COUNT(*) AS n FROM topic_demonstrations d JOIN roadmap_topics tp ON tp.id = d.topic_id
         JOIN roadmaps r ON r.id = tp.roadmap_id WHERE r.subject_id = ?`, p.id,
    )).toBe(p.id === alpha.id ? 1 : 0);
  }

  // --- The screens, preparation by preparation. -------------------------------------------
  const visit = async (p: CreatedPreparation) => {
    const others = [alpha, beta, skill].filter((o) => o.id !== p.id);
    const isSkill = p.id === skill.id;

    await page.goto('/');
    await pickPreparation(page, p.name);
    // Recommendations: Home's goal is this preparation's own review, or none for a skill.
    if (!isSkill) await expect(page.getByText(`questions to review today · ${p.name}`)).toBeVisible();
    await page.waitForLoadState('networkidle');
    for (const o of others) await expect(page.getByText(`questions to review today · ${o.name}`)).toHaveCount(0);

    // Questions.
    await page.goto('/question-bank');
    await expect(page.getByText(new RegExp(`${area(p)}`)).first()).toBeVisible();
    for (const o of others) await expect(page.getByText(area(o))).toHaveCount(0);

    // Roadmaps, and the evidence on them.
    await page.goto('/roadmaps');
    await expect(page.getByRole('link', { name: roadmaps[p.id].title, exact: true })).toBeVisible();
    for (const o of others) await expect(page.getByRole('link', { name: roadmaps[o.id].title, exact: true })).toHaveCount(0);
    await page.getByRole('link', { name: roadmaps[p.id].title, exact: true }).click();
    await page.getByRole('link', { name: `${p.name} topic`, exact: true }).click();
    await expect(page.getByText(p.id === alpha.id ? 'Next recheck' : 'Not started', { exact: false }).first()).toBeVisible();

    // Review: a certification's own three misses; a skill has no mocks to review.
    await page.goto('/review');
    if (isSkill) {
      await expect(page.getByText(new RegExp(`${p.name} has no exam to sit`))).toBeVisible();
    } else {
      await page.getByRole('button', { name: 'Start review' }).click();
      await expect(page.getByText(/Review today · 1 of 3/)).toBeVisible();
    }

    // Practice history: a certification's own mock; a skill has none to sit.
    await page.goto('/exam-setup');
    if (isSkill) {
      await expect(page.getByText(/no certification exam behind it/)).toBeVisible();
    } else {
      await expect(page.getByRole('table', { name: 'Previous mocks' }).getByRole('row')).toHaveCount(2);
    }

    // Analytics.
    await page.goto('/analytics');
    if (!isSkill) await expect(page.getByRole('link', { name: new RegExp(`^${area(p)}: 0%`) }).last()).toBeVisible();
    await page.waitForLoadState('networkidle');
    for (const o of others) await expect(page.getByText(area(o))).toHaveCount(0);

    // Scores, from the server: only this preparation's mock counts.
    const subject = await (await request.get(`/api/v1/subjects/${p.id}`)).json();
    expect(subject.readiness.mock_count).toBe(isSkill ? 0 : 1);
    const queue = await (await request.get(`/api/v1/review/queue?subject_id=${p.id}`)).json();
    expect(queue.total_unreviewed).toBe(isSkill ? 0 : 3);
  };

  await visit(alpha);
  await visit(beta);
  await visit(skill);
  // Back to the first: exactly as it was.
  await visit(alpha);
});
