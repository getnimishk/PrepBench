// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ContentPackDetail, ScenarioContent } from '../types/contentPack';
import type { WireLearningAttempt } from '../types/learning';
import adfPack from '../../../backend/app/content/packs/adf/v1.json';
import { ScenarioPage } from './ScenarioPage';

const ADF = adfPack as unknown as ContentPackDetail;
const S1 = ADF.scenario_levels[0].scenarios[0];
const C1 = S1.content as ScenarioContent;

// A small in-memory stand-in for the learning attempts API that keeps the one
// rule that matters here: a committed prediction is write-once.
let rows: Map<string, WireLearningAttempt>;
const refusal = () => Object.assign(new Error('Request failed with status code 409'), {
  isAxiosError: true,
  response: { status: 409, data: { detail: 'This attempt already has a committed prediction.' } },
});

const api = {
  getContentPack: vi.fn(),
  getLearningAttempts: vi.fn(async () => [...rows.values()]),
  startLearningAttempt: vi.fn(async (b: any) => {
    if (!rows.has(b.attempt_uid)) rows.set(b.attempt_uid, { ...b, started_at: '2026-09-27T10:00:00' });
    return rows.get(b.attempt_uid)!;
  }),
  patchLearningAttempt: vi.fn(async (uid: string, p: any) => {
    const a = { ...rows.get(uid)! };
    if (p.prediction !== undefined) {
      if (a.committed_at && a.prediction !== p.prediction) throw refusal();
      a.prediction = p.prediction;
      a.committed_at ??= '2026-09-27T10:01:00';
    }
    if (p.explanation_text !== undefined) a.explanation_text = p.explanation_text;
    if (p.rubric_coverage !== undefined) a.rubric_coverage = p.rubric_coverage;
    if (p.completed) { a.completed_at ??= '2026-09-27T10:02:00'; a.correct = p.correct ?? null; }
    rows.set(uid, a);
    return a;
  }),
  getInterviewQuestions: vi.fn(async () => ({ items: [], total: 0, skip: 0, limit: 1 })),
  saveInterviewQuestionFromSource: vi.fn(async (b: any) => ({
    question: { id: 9, round_type: 'technical', question_text: b.question_text, category: b.category, is_ai_generated: false, created_at: 'now' },
    created: true,
  })),
};
vi.mock('../services/api', () => ({
  getContentPack: (...a: any[]) => api.getContentPack(...a),
  getLearningAttempts: (...a: any[]) => (api.getLearningAttempts as any)(...a),
  startLearningAttempt: (...a: any[]) => (api.startLearningAttempt as any)(...a),
  patchLearningAttempt: (...a: any[]) => (api.patchLearningAttempt as any)(...a),
  getInterviewQuestions: (...a: any[]) => (api.getInterviewQuestions as any)(...a),
  saveInterviewQuestionFromSource: (...a: any[]) => (api.saveInterviewQuestionFromSource as any)(...a),
}));

let selected: any = null;
vi.mock('../context/PreparationContext', () => ({
  usePreparation: () => ({ selected, loading: false }),
}));

const SKILL = {
  id: 7, name: 'ADF skill', kind: 'skill',
  content_packs: [{ pack_id: 'adf', pack_version: 1, latest_version: 1, title: 'Azure Data Factory' }],
};

const renderPage = () => render(
  <MemoryRouter initialEntries={['/scenarios/adf/1']}>
    <Routes><Route path="/scenarios/:packId/:scenarioId" element={<ScenarioPage />} /></Routes>
  </MemoryRouter>,
);

const checkGroup = (i: number) => screen.getByRole('radiogroup', { name: new RegExp(`^${i + 1}\\. `) });

async function answerAllChecks(user: ReturnType<typeof userEvent.setup>, pick = (i: number) => C1.check[i].answer) {
  for (let i = 0; i < C1.check.length; i += 1) {
    const group = await waitFor(() => checkGroup(i));
    await user.click(within(group).getByRole('radio', { name: C1.check[i].options[pick(i)] }));
    await waitFor(() => expect(within(checkGroup(i)).getAllByRole('radio')[0]).toBeDisabled());
  }
}

beforeEach(() => {
  rows = new Map();
  Object.values(api).forEach((f) => (f as any).mockClear?.());
  api.getContentPack.mockReset().mockResolvedValue(ADF);
  selected = SKILL;
});

describe('ScenarioPage', () => {
  it('says where scenarios are practised when the preparation hasn\'t attached the pack', async () => {
    selected = { id: 3, name: 'PSM I', kind: 'certification', content_packs: [] };
    renderPage();
    expect(await screen.findByText(/PSM I doesn't have it/)).toBeInTheDocument();
    expect(api.getContentPack).toHaveBeenCalledWith('adf', undefined);
    expect(api.startLearningAttempt).not.toHaveBeenCalled();
  });

  it('records each check answer on the skill and locks it', async () => {
    const user = userEvent.setup({ delay: null });
    renderPage();
    const group = await waitFor(() => checkGroup(0));
    await user.click(within(group).getByRole('radio', { name: C1.check[0].options[C1.check[0].answer] }));

    await waitFor(() => expect(api.patchLearningAttempt).toHaveBeenCalledWith(
      's7:adf@1:1:c0', { prediction: String(C1.check[0].answer), completed: true, correct: true },
    ));
    expect(api.startLearningAttempt).toHaveBeenCalledWith(expect.objectContaining({ subject_id: 7, challenge_id: 'adf/1/check/0' }));
    await waitFor(() => within(checkGroup(0)).getAllByRole('radio').forEach((r) => expect(r).toBeDisabled()));
    expect(screen.getByText(/^Right\./)).toBeInTheDocument();
  });

  it('shows the server\'s locked answer when a second, different answer is refused', async () => {
    const user = userEvent.setup({ delay: null });
    renderPage();
    const group = await waitFor(() => checkGroup(0));
    // Answered in another tab after this page loaded.
    rows.set('s7:adf@1:1:c0', {
      attempt_uid: 's7:adf@1:1:c0', subject_id: 7, challenge_id: 'adf/1/check/0', concept_id: 'adf/incremental',
      scenario_fingerprint: 'pack_version=1', mode: 'guided', started_at: 't', hint_count: 0,
      prediction: '0', committed_at: 't', completed_at: 't', correct: C1.check[0].answer === 0,
    });
    await user.click(within(group).getByRole('radio', { name: C1.check[0].options[2] }));

    expect(await screen.findByText(/Your answer wasn't saved/)).toBeInTheDocument();
    await waitFor(() => expect(within(checkGroup(0)).getByRole('radio', { name: C1.check[0].options[0] })).toBeChecked());
  });

  it('keeps the case until the check is done, then commits the notes with the debrief', async () => {
    const user = userEvent.setup({ delay: null });
    renderPage();
    expect(await screen.findByText(/Answer the check first/)).toBeInTheDocument();
    await answerAllChecks(user);

    const tasks = [...C1.caseStudy.tasks, ...C1.lenses.po.tasks];
    const show = await screen.findByRole('button', { name: 'Show the debrief' });
    expect(show).toBeDisabled();
    for (let i = 0; i < tasks.length; i += 1) {
      await user.click(screen.getByLabelText(`${String.fromCharCode(97 + i)}) ${tasks[i]}`));
      await user.paste(`note ${i}`);
    }
    await user.click(show);

    await waitFor(() => expect(api.patchLearningAttempt).toHaveBeenCalledWith('s7:adf@1:1:lens:po', expect.objectContaining({
      prediction: 'case-notes', completed: true, explanation_text: expect.stringContaining(`a) ${tasks[0]}\nnote 0`),
    })));
    expect(await screen.findByRole('heading', { name: '4 · Debrief' })).toBeInTheDocument();
    // The notes are what the debrief is compared with: they no longer change.
    expect(screen.getByLabelText(`a) ${tasks[0]}`)).toHaveAttribute('readonly');
    expect(screen.queryByRole('button', { name: 'Show the debrief' })).not.toBeInTheDocument();
  });

  it('saves the Say-it answer to the question library as a technical question, then offers to update it', async () => {
    const user = userEvent.setup({ delay: null });
    renderPage();
    await answerAllChecks(user);
    const tasks = [...C1.caseStudy.tasks, ...C1.lenses.po.tasks];
    for (let i = 0; i < tasks.length; i += 1) {
      await user.click(screen.getByLabelText(`${String.fromCharCode(97 + i)}) ${tasks[i]}`));
      await user.paste('n');
    }
    await user.click(screen.getByRole('button', { name: 'Show the debrief' }));

    const answer = await screen.findByLabelText(/Your answer, in your own words/);
    await user.click(answer);
    await user.paste('Watermark on success, a count check, and a merge on the key.');
    await user.click(screen.getByRole('checkbox', { name: C1.lenses.po.sayIt.points[0] }));
    await user.click(screen.getByRole('button', { name: 'Add to my interview question library' }));

    await waitFor(() => expect(api.saveInterviewQuestionFromSource).toHaveBeenCalledWith({
      source_ref: 'adf@1/scenario/1/lens/po',
      subject_id: 7,
      round_type: 'technical',
      question_text: C1.lenses.po.sayIt.question,
      category: 'Azure Data Factory',
      prepared_answer: 'Watermark on success, a count check, and a merge on the key.',
      key_talking_points: C1.lenses.po.sayIt.points,
    }));
    expect(await screen.findByText(/Added to your interview question library as a Technical question/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update it in my interview question library' })).toBeInTheDocument();

    const lens = rows.get('s7:adf@1:1:lens:po')!;
    expect(lens.explanation_text).toContain(`Say it: ${C1.lenses.po.sayIt.question}\nWatermark on success`);
    expect(lens.rubric_coverage).toMatchObject({ 0: true, 1: false });
  });

  it('keeps each role\'s work separately', async () => {
    const user = userEvent.setup({ delay: null });
    renderPage();
    await answerAllChecks(user);
    await user.type(screen.getByLabelText(`a) ${C1.caseStudy.tasks[0]}`), 'as the PO');

    await user.click(screen.getByRole('button', { name: 'Delivery Manager' }));
    expect(screen.getByLabelText(`a) ${C1.caseStudy.tasks[0]}`)).toHaveValue('');
    expect(screen.getByLabelText(`c) ${C1.lenses.dm.tasks[0]}`)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Product Owner' }));
    expect(screen.getByLabelText(`a) ${C1.caseStudy.tasks[0]}`)).toHaveValue('as the PO');
  });
});
