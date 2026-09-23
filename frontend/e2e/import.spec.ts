// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { expect, test } from '@playwright/test';
import { createCertification, createQuestion, pickPreparation, tag } from './helpers';
import { dbRow, dbRows } from './db';

/**
 * Importing a question bank through the Question Bank screen.
 *
 * Two things this proves that the backend suite alone cannot. The report the
 * learner reads names real file rows and says what to do -- a bad row is shown,
 * not silently dropped. And the questions that are imported land in the
 * preparation they belong to: the import path used to skip that step, so a
 * freshly imported bank was invisible to its own preparation.
 */

const HEADER = 'text,question_type,difficulty,domain,topic,certification,explanation,option_1,option_1_correct,option_2,option_2_correct\n';

test('an import reports every row, then lands its questions in their preparation', async ({ page, request }) => {
  const prep = await createCertification(request, 'Import Target');
  const t = tag();
  const good = `Imported and owned ${t} — what is the Sprint Goal?`;

  const csv = HEADER
    // row 2: fine
    + `"${good}",single_choice,medium,Scrum,Events,${prep.certification},"It is the single objective for the Sprint.",Right,true,Wrong,false\n`
    // row 3: other cells filled but no question text -- must be reported, not dropped
    + `,single_choice,medium,Scrum,Events,${prep.certification},"x",Right,true,Wrong,false\n`
    // row 4: unrecognised difficulty -- imported, but said
    + `"Odd difficulty ${t} — who owns the Product Backlog?",single_choice,expert,Scrum,Roles,${prep.certification},"The Product Owner.",Right,true,Wrong,false\n`;

  await page.goto('/question-bank');
  await pickPreparation(page, prep.name);
  await page.getByRole('main').getByRole('button', { name: 'Import', exact: true }).click();

  await page.locator('input[type="file"]').setInputFiles({
    name: `import-${t}.csv`,
    mimeType: 'text/csv',
    buffer: Buffer.from(csv, 'utf-8'),
  });

  const dialog = page.getByRole('dialog');
  // The skipped row is listed by its spreadsheet row number, not hidden.
  await expect(dialog.getByText(/Row 3\. No question could be read from this row/)).toBeVisible();
  // Two importable rows: the clean one and the replaced-difficulty one.
  const confirm = dialog.getByRole('button', { name: 'Import 2 questions' });
  await expect(confirm).toBeVisible();

  // Open the row with the replaced value and read what to do about it.
  await dialog.getByText(/Row 4\./).click();
  await expect(dialog.getByText(/'expert' is not recognised/)).toBeVisible();
  await expect(dialog.getByText(/Use easy, medium or hard/)).toBeVisible();

  await confirm.click();

  // The regression: the imported questions must belong to the preparation.
  await expect.poll(async () => {
    const owned = await (await request.get(`/api/v1/questions?subject_id=${prep.id}&limit=50`)).json();
    return owned.total;
  }).toBe(2);

  // And they show in the preparation-scoped Question Bank after a reload.
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.getByText(good)).toBeVisible();
});

test('a JSON bank reports its duplicate and its broken question before saving, Cancel saves nothing, and Confirm saves what it said', async ({ page, request }) => {
  const prep = await createCertification(request, 'Import JSON');
  const t = tag();
  const existing = `Already in the bank ${t}: what is the purpose of a Sprint?`;
  await createQuestion(request, prep, existing);
  const owned = () => dbRow<{ n: number }>('SELECT COUNT(*) AS n FROM questions WHERE subject_id = ?', prep.id)!.n;
  expect(owned()).toBe(1);

  const item = (text: string, correct: [boolean, boolean]) => ({
    text, question_type: 'single_choice', difficulty: 'easy', domain: 'Scrum', topic: 'Accountabilities',
    certification: prep.certification, explanation: 'The Developers create the Increment.',
    options: [{ option_text: 'Developers', is_correct: correct[0] }, { option_text: 'Stakeholders', is_correct: correct[1] }],
  });
  const bank = {
    questions: [
      item(`Fresh from JSON ${t}: who creates the Increment?`, [true, false]),
      item(existing, [true, false]),
      item(`Broken in JSON ${t}: nothing is marked right`, [false, false]),
    ],
  };
  const file = { name: `bank-${t}.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bank), 'utf-8') };

  await page.goto('/question-bank');
  await pickPreparation(page, prep.name);
  await page.getByRole('main').getByRole('button', { name: 'Import', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles(file);

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Import 2 questions' })).toBeVisible();
  await dialog.getByText(new RegExp(`Broken in JSON ${t}`)).click();
  await expect(dialog.getByText('No correct answer marked for this question.')).toBeVisible();
  await dialog.getByText(new RegExp(`Already in the bank ${t}`)).first().click();
  await expect(dialog.getByText('A question with identical text already exists in your Question Bank.')).toBeVisible();

  // Cancel: the check was a dry run, and nothing was saved.
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  expect(owned()).toBe(1);

  // Confirm: the two it said it would import, and not the broken one.
  await page.getByRole('main').getByRole('button', { name: 'Import', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles(file);
  await page.getByRole('dialog').getByRole('button', { name: 'Import 2 questions' }).click();
  await expect.poll(owned).toBe(3);
  expect(dbRows('SELECT text FROM questions WHERE subject_id = ? AND text LIKE ?', prep.id, `Broken in JSON ${t}%`)).toEqual([]);

  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.getByText(`Fresh from JSON ${t}: who creates the Increment?`)).toBeVisible();
});

test('a Markdown question file is read into the preparation it names', async ({ page, request }) => {
  const prep = await createCertification(request, 'Import Markdown');
  const t = tag();
  const markdown = [
    `# Markdown pack ${t}`,
    '',
    '## Question 1',
    `Who is accountable for maximising the value of the product ${t}?`,
    '- Type: single_choice',
    '- Difficulty: medium',
    '- Domain: Scrum',
    '- Topic: Accountabilities',
    `- Certification: ${prep.certification}`,
    '',
    '### Options',
    '- [ ] The Scrum Master',
    '- [x] The Product Owner',
    '',
    '### Explanation',
    'The Product Owner is accountable for maximising the value of the product.',
    '',
  ].join('\n');

  await page.goto('/question-bank');
  await pickPreparation(page, prep.name);
  await page.getByRole('main').getByRole('button', { name: 'Import', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: `pack-${t}.md`, mimeType: 'text/markdown', buffer: Buffer.from(markdown, 'utf-8'),
  });
  await page.getByRole('dialog').getByRole('button', { name: 'Import 1 question' }).click();

  await expect.poll(() => dbRow<{ n: number }>('SELECT COUNT(*) AS n FROM questions WHERE subject_id = ?', prep.id)!.n).toBe(1);
  const saved = dbRow<{ id: number; topic: string }>('SELECT id, topic FROM questions WHERE subject_id = ?', prep.id)!;
  expect(saved.topic).toBe('Accountabilities');
  expect(dbRows('SELECT option_text FROM question_options WHERE question_id = ? AND is_correct = 1', saved.id))
    .toEqual([{ option_text: 'The Product Owner' }]);
});

test('a roadmap file is previewed, Cancel saves nothing, and an import lands in the picked preparation and survives a reload', async ({ page, request }) => {
  const prep = await createCertification(request, 'Roadmap Import');
  const t = tag();
  const title = `Scrum study plan ${t}`;
  const markdown = [
    `# ${title}`,
    '## Events',
    '- [ ] Sprint Planning (2h)',
    '- [ ] Daily Scrum (1h)',
    '## Values',
    '- [ ] Commitment (1h)',
    '- [x] Openness (1h)',
    '',
  ].join('\n');
  const file = { name: `plan-${t}.md`, mimeType: 'text/markdown', buffer: Buffer.from(markdown, 'utf-8') };
  const saved = () => dbRows<{ id: number; subject_id: number | null }>('SELECT id, subject_id FROM roadmaps WHERE title = ?', title);

  await page.goto('/roadmaps');
  await pickPreparation(page, prep.name);
  await page.getByRole('button', { name: 'Import Roadmap' }).click();
  await page.getByTestId('roadmap-file-input').setInputFiles(file);

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('4 topics')).toBeVisible();
  await expect(dialog.getByText('2 phases')).toBeVisible();
  await expect(dialog.getByRole('cell', { name: 'Daily Scrum' })).toBeVisible();

  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  expect(saved()).toEqual([]);

  await page.getByRole('button', { name: 'Import Roadmap' }).click();
  await page.getByTestId('roadmap-file-input').setInputFiles(file);
  await page.getByRole('dialog').getByRole('button', { name: 'Import Roadmap' }).click();

  await expect(page).toHaveURL(/\/roadmaps\/\d+$/);
  const rows = saved();
  expect(rows).toHaveLength(1);
  await expect.poll(() => saved()[0].subject_id).toBe(prep.id);
  expect(dbRow<{ n: number }>('SELECT COUNT(*) AS n FROM roadmap_topics WHERE roadmap_id = ?', rows[0].id)!.n).toBe(4);
  expect(dbRow<{ n: number }>('SELECT COUNT(*) AS n FROM roadmap_phases WHERE roadmap_id = ?', rows[0].id)!.n).toBe(2);

  await page.reload();
  await expect(page.getByRole('link', { name: 'Daily Scrum', exact: true })).toBeVisible();

  // Ticked in the file is not demonstrated here, and the topic says so.
  await page.getByRole('link', { name: 'Openness', exact: true }).click();
  await expect(page.getByText(/Marked complete without a demonstration/)).toBeVisible();
});

test('a JSON roadmap with nested phases imports, and a CSV with no topic column is refused before anything is saved', async ({ page, request }) => {
  const prep = await createCertification(request, 'Roadmap Formats');
  const t = tag();
  await page.goto('/roadmaps');
  await pickPreparation(page, prep.name);

  // Refused: says why, offers no import, saves nothing.
  const before = dbRow<{ n: number }>('SELECT COUNT(*) AS n FROM roadmaps')!.n;
  await page.getByRole('button', { name: 'Import Roadmap' }).click();
  await page.getByTestId('roadmap-file-input').setInputFiles({
    name: `bad-${t}.csv`, mimeType: 'text/csv', buffer: Buffer.from('Alpha,Beta\n1,2\n', 'utf-8'),
  });
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Import Roadmap' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  expect(dbRow<{ n: number }>('SELECT COUNT(*) AS n FROM roadmaps')!.n).toBe(before);

  // JSON, with its phases nested.
  const title = `Nested plan ${t}`;
  const payload = {
    title,
    phases: [
      { name: 'Basics', topics: [{ title: 'Empiricism', hours: 2 }, { title: 'Scrum Values', hours: 1 }] },
      { name: 'Events', topics: [{ title: 'The Sprint', hours: 3 }] },
    ],
  };
  await page.getByRole('button', { name: 'Import Roadmap' }).click();
  await page.getByTestId('roadmap-file-input').setInputFiles({
    name: `nested-${t}.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(payload), 'utf-8'),
  });
  await expect(page.getByRole('dialog').getByText('3 topics')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Import Roadmap' }).click();
  await expect(page).toHaveURL(/\/roadmaps\/\d+$/);

  await expect.poll(() => dbRow<{ subject_id: number }>('SELECT subject_id FROM roadmaps WHERE title = ?', title)?.subject_id).toBe(prep.id);
  const roadmap = dbRow<{ id: number }>('SELECT id FROM roadmaps WHERE title = ?', title)!;
  expect(dbRows('SELECT name FROM roadmap_phases WHERE roadmap_id = ? ORDER BY order_index', roadmap.id))
    .toEqual([{ name: 'Basics' }, { name: 'Events' }]);
});
