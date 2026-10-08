// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import pipeline from '../../../../backend/app/data/lab_packs/semiconductor-v1/pipeline.json';
import type { WireLearningAttempt } from '../../types/learning';
import type { SourceRow } from '../../services/lakehouse/adfModel';

// ---- a LearningService stand-in that keeps the server's rules ------------------------------------
const store: WireLearningAttempt[] = [];
const refuse = (detail: string, status = 400) => Promise.reject({ isAxiosError: true, response: { status, data: { detail } } });
const owner = (a: WireLearningAttempt) => a.subject_id ?? null;
vi.mock('../../services/api', () => ({
  getLakehousePack: vi.fn(async () => ({ id: 'semiconductor-v1', version: 1, pipeline })),
  getLearningAttempts: vi.fn(async (p?: { subject_id?: number }) =>
    store.filter((a) => p?.subject_id === undefined || a.subject_id === p.subject_id).map((a) => ({ ...a }))),
  startLearningAttempt: vi.fn(async (b: Record<string, unknown>) => {
    const existing = store.find((a) => a.attempt_uid === b.attempt_uid);
    // A uid another preparation (or a deleted one) holds is refused, with none of its attempt.
    if (existing && owner(existing) !== (b.subject_id ?? null)) return refuse('id in use', 409);
    if (existing) return { ...existing };
    const row = { ...b, started_at: '2026-10-07T10:00:00' } as unknown as WireLearningAttempt;
    store.push(row);
    return { ...row };
  }),
  patchLearningAttempt: vi.fn(async (uid: string, body: Record<string, unknown>, subjectId: number | null) => {
    const a = store.find((x) => x.attempt_uid === uid && owner(x) === subjectId);
    if (!a) return refuse('no such attempt', 404);
    if (body.prediction !== undefined) {
      if (a.committed_at && a.prediction !== body.prediction) return refuse('prediction is write-once');
      a.prediction = body.prediction as string;
      a.committed_at = a.committed_at ?? '2026-10-07T10:01:00';
    }
    for (const f of ['manipulation', 'observed', 'explanation_text'] as const) {
      if (body[f] === undefined) continue;
      if (!a.committed_at) return refuse(`${f} before a committed prediction`);
      (a as unknown as Record<string, unknown>)[f] = body[f];
    }
    if (body.completed) {
      if (!a.committed_at) return refuse('cannot complete an uncommitted attempt');
      if (!a.completed_at) Object.assign(a, { completed_at: '2026-10-07T10:02:00', correct: body.correct, transfer: body.transfer ?? null });
    }
    return { ...a };
  }),
}));

const INDEX: SourceRow[] = Array.from({ length: 5000 }, (_, i) => ({
  id: i + 1, modifiedAt: new Date(Date.UTC(2026, 2, 1) + i * 518_400).toISOString(), deleted: false, batch: Math.floor(i / 1000) + 1,
}));
vi.mock('../../services/lakehouse/sourceIndex', () => ({ loadSourceIndex: vi.fn(async () => INDEX) }));

const mockPreparation = vi.fn();
vi.mock('../../context/PreparationContext', () => ({ usePreparation: () => mockPreparation() }));

import { AdfExperimentPage } from '../../pages/AdfExperimentPage';
import { ADF_LAB_EXPERIMENTS, tracksOf } from '../../services/adfLab/experiments';
import { DEFINITIONS } from '../../services/adfLab/definitions';
import { causesOf } from '../../services/adfLab/definition';
import { loadPipelineContext } from '../../services/adfLab/semiconductor';
import { STAGES } from '../../services/adfLab/stages';

const ADF = {
  id: 6, name: 'Azure Data Factory', slug: 'adf', kind: 'skill', is_archived: false, display_order: 100,
  has_exam_profile: false, question_count: 0, content_packs: [{ pack_id: 'adf', pack_version: 1 }],
  readiness: { state: 'needs_evaluation', mock_count: 0, recent_scores: [] },
};

beforeEach(() => {
  store.length = 0;
  mockPreparation.mockReturnValue({ selected: ADF, selectedId: 6, loading: false });
});

// Every track of every experiment, with its address.
const CASES = ADF_LAB_EXPERIMENTS.flatMap((e) => tracksOf(e).map((track, i) => ({
  experiment: e,
  def: DEFINITIONS[e.slug]![i],
  path: e.tracks ? `/lab/adf/${e.slug}?mode=${e.tracks[i].id}` : `/lab/adf/${e.slug}`,
  track,
})));

describe('all five experiments, every fault mode', () => {
  it('covers five experiments and six tracks: Fault Tolerance’s two modes are tracks of one experiment', () => {
    expect(ADF_LAB_EXPERIMENTS).toHaveLength(5);
    expect(CASES.map((c) => c.track)).toEqual(['watermark', 'triggers', 'concurrency', 'copy-perf', 'fault-tolerance.dependency', 'fault-tolerance.bad-rows']);
  });

  for (const { experiment, def, path, track } of CASES) {
    it(`${track}: exposes the eight stages and runs them all, each written through LearningService`, async () => {
      const user = userEvent.setup();
      const context = def.model === 'semiconductor-v1' ? await loadPipelineContext() : null;
      const preset = def.run(context, def.preset);

      render(
        <MemoryRouter initialEntries={[path]}>
          <Routes><Route path="/lab/adf/:slug" element={<AdfExperimentPage />} /></Routes>
        </MemoryRouter>,
      );
      expect(await screen.findByRole('heading', { level: 1, name: new RegExp(`^${experiment.title}`) })).toBeInTheDocument();
      const steps = screen.getByRole('list', { name: /^Step 1 of 8/ });
      expect(within(steps).getAllByRole('listitem').map((li) => li.textContent?.replace(/^[\d✓]+/, ''))).toEqual([...STAGES]);
      expect(screen.getByText(/Teaching simulation/)).toBeInTheDocument();

      // Understand, then Predict: nothing to manipulate before the prediction is committed.
      await user.click(screen.getByRole('button', { name: 'Continue to Predict' }));
      expect(screen.queryByRole('heading', { level: 2, name: 'Manipulate' })).not.toBeInTheDocument();
      await user.click(screen.getByRole('radio', { name: def.predict.options.find((o) => o.id === preset.outcome)!.text }));
      await user.click(screen.getByRole('button', { name: 'Commit prediction' }));

      // Manipulate: move the first lever off the scenario's value; Observe; record.
      expect(await screen.findByRole('heading', { level: 2, name: 'Manipulate' })).toBeInTheDocument();
      const first = def.levers[0];
      const other = first.options.find((o) => o.value !== def.preset[first.key])!;
      await user.click(within(screen.getByRole('group', { name: first.label })).getByRole('button', { name: other.label }));
      await user.click(screen.getByRole('button', { name: 'Run the model' }));
      expect(screen.getByRole('heading', { level: 2, name: 'Observe' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Record this observation' }));
      expect(await screen.findByText('Your prediction matched the model.')).toBeInTheDocument();

      // Reason: the model's cause.
      const cause = def.reason.options.find((o) => causesOf(preset).includes(o.id))!;
      await user.click(screen.getByRole('radio', { name: cause.text }));
      await user.click(screen.getByRole('button', { name: 'Submit your diagnosis' }));
      expect(await screen.findByText('That is the mechanism the model found.')).toBeInTheDocument();

      // Apply: the option the model says meets the changed constraint.
      const runs = def.apply.options.map((o) => def.run(context, o.levers));
      const right = def.apply.options.find((_, i) => def.apply.correct(runs[i], runs))!;
      await user.click(screen.getByRole('radio', { name: right.text }));
      await user.click(screen.getByRole('button', { name: 'Submit your change' }));

      // Explain, separate from Reason.
      expect(await screen.findByRole('heading', { level: 2, name: 'Explain' })).toBeInTheDocument();
      await user.click(screen.getByRole('textbox'));
      await user.paste('Because the model showed it.');
      await user.click(screen.getByRole('button', { name: 'Save your explanation' }));

      // Retrieve.
      expect(await screen.findByRole('heading', { level: 2, name: 'Retrieve' })).toBeInTheDocument();
      await user.click(screen.getByRole('radio', { name: def.retrieve.options.find((o) => o.id === def.retrieve.answer)!.text }));
      await user.click(screen.getByRole('button', { name: 'Check your answer' }));
      expect(await screen.findByRole('heading', { level: 2, name: 'Run complete' })).toBeInTheDocument();
      for (const stage of STAGES) expect(screen.getByRole('heading', { level: 2, name: stage })).toBeInTheDocument();

      // One run: four rows, one correlation, on the preparation, every grade right.
      expect(store.map((a) => a.attempt_uid).sort()).toEqual(
        ['apply', 'predict', 'reason', 'retrieve'].map((s) => `ab:6:${track}:r1:${s}`),
      );
      expect(new Set(store.map((a) => a.scenario_fingerprint))).toEqual(new Set([`adf-lab=${track};run=1;model=${def.model}`]));
      expect(store.every((a) => a.subject_id === 6 && a.correct === true)).toBe(true);
      expect(store.find((a) => a.attempt_uid.endsWith(':apply'))!.transfer).toBe(true);
      expect(store.find((a) => a.attempt_uid.endsWith(':retrieve'))!.mode).toBe('retrieval');
      expect(store.find((a) => a.attempt_uid.endsWith(':predict'))!.manipulation).toEqual({
        [first.key]: { from: typeof def.preset[first.key] === 'boolean' ? (def.preset[first.key] ? 'on' : 'off') : def.preset[first.key],
          to: typeof other.value === 'boolean' ? (other.value ? 'on' : 'off') : other.value },
      });
    }, 60_000);
  }

  it('keeps Fault Tolerance’s two modes apart: a run in one is not progress in the other', async () => {
    const user = userEvent.setup();
    store.push({
      attempt_uid: 'ab:6:fault-tolerance.dependency:r1:predict', challenge_id: 'adf.lab.fault-tolerance.dependency.predict',
      concept_id: 'adf.lab.fault-tolerance', scenario_fingerprint: '', mode: 'guided', started_at: '', hint_count: 0, subject_id: 6,
      prediction: 'hidden', committed_at: '2026-10-07T09:01:00',
    } as WireLearningAttempt);
    render(
      <MemoryRouter initialEntries={['/lab/adf/fault-tolerance?mode=bad-rows']}>
        <Routes><Route path="/lab/adf/:slug" element={<AdfExperimentPage />} /></Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'Fault Tolerance: Bad-row handling' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue to Predict' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Dependency failure paths' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Fault Tolerance: Dependency failure paths' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 2, name: 'Manipulate' })).toBeInTheDocument();
  });

  it('starts on the next run when a deleted preparation with this id left run 1 behind', async () => {
    // SQLite gave this preparation's id out again; the old run 1 stays, subject NULL.
    const orphan = {
      attempt_uid: 'ab:6:watermark:r1:predict', challenge_id: 'adf.lab.watermark.predict', concept_id: 'adf.lab.watermark',
      scenario_fingerprint: '', mode: 'guided', started_at: '', hint_count: 0, subject_id: null,
      prediction: 'someone-elses', committed_at: '2026-10-07T09:01:00',
    } as WireLearningAttempt;
    store.push(orphan);
    const user = userEvent.setup();
    const def = DEFINITIONS.watermark![0];
    const preset = def.run(await loadPipelineContext(), def.preset);
    render(
      <MemoryRouter initialEntries={['/lab/adf/watermark']}>
        <Routes><Route path="/lab/adf/:slug" element={<AdfExperimentPage />} /></Routes>
      </MemoryRouter>,
    );
    await user.click(await screen.findByRole('button', { name: 'Continue to Predict' }));
    await user.click(screen.getByRole('radio', { name: def.predict.options.find((o) => o.id === preset.outcome)!.text }));
    await user.click(screen.getByRole('button', { name: 'Commit prediction' }));

    // The prediction lands on run 2, on this preparation, and the run carries on from there.
    expect(await screen.findByRole('heading', { level: 2, name: 'Manipulate' })).toBeInTheDocument();
    expect(screen.queryByText(/not saved/i)).not.toBeInTheDocument();
    const mine = store.filter((a) => a.subject_id === 6);
    expect(mine.map((a) => a.attempt_uid)).toEqual(['ab:6:watermark:r2:predict']);
    expect(mine[0]).toMatchObject({ prediction: preset.outcome, scenario_fingerprint: 'adf-lab=watermark;run=2;model=semiconductor-v1' });
    // The deleted preparation's answer is neither shown nor touched.
    expect(orphan.prediction).toBe('someone-elses');
  }, 60_000);

  it('keeps a saved explanation when it is saved again, untouched, after a reload', async () => {
    // A run reloaded at Retrieve: its explanation is on the server, the page holds no edit of it.
    const row = (stage: string, extra: Partial<WireLearningAttempt> = {}) => ({
      attempt_uid: `ab:6:watermark:r1:${stage}`, challenge_id: `adf.lab.watermark.${stage}`, concept_id: 'adf.lab.watermark',
      scenario_fingerprint: 'adf-lab=watermark;run=1;model=semiconductor-v1', mode: 'guided', started_at: '', hint_count: 0,
      subject_id: 6, prediction: 'x', committed_at: '2026-10-07T09:01:00', completed_at: '2026-10-07T09:02:00', correct: true,
      ...extra,
    } as WireLearningAttempt);
    store.push(
      row('predict', { explanation_text: 'The completion exit ran on failure.' }),
      row('reason'), row('apply'),
    );
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/lab/adf/watermark']}>
        <Routes><Route path="/lab/adf/:slug" element={<AdfExperimentPage />} /></Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { level: 2, name: 'Retrieve' })).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('The completion exit ran on failure.');

    await user.click(screen.getByRole('button', { name: 'Save your explanation' }));

    // The same words were sent, nothing was erased, and the run did not fall back to Explain.
    const api = await import('../../services/api');
    const calls = vi.mocked(api.patchLearningAttempt).mock.calls;
    expect(calls[calls.length - 1]).toEqual(['ab:6:watermark:r1:predict', { explanation_text: 'The completion exit ran on failure.' }, 6]);
    expect(store.find((a) => a.attempt_uid === 'ab:6:watermark:r1:predict')!.explanation_text)
      .toBe('The completion exit ran on failure.');
    expect(await screen.findByRole('heading', { level: 2, name: 'Retrieve' })).toBeInTheDocument();
  }, 60_000);

  it('never offers a timeout lever anywhere in the lab', () => {
    for (const { def } of CASES) {
      for (const l of def.levers) {
        expect(l.key).not.toMatch(/timeout/i);
        for (const o of l.options) expect(String(o.value)).not.toMatch(/timeout/i);
      }
    }
  });
});
