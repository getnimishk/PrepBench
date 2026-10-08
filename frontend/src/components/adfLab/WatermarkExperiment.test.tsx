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

// ---- a LearningService stand-in that keeps the server's rules ---------------------------------
const store: WireLearningAttempt[] = [];
const refuse = (detail: string) => Promise.reject({ isAxiosError: true, response: { status: 400, data: { detail } } });

vi.mock('../../services/api', () => ({
  getLakehousePack: vi.fn(async () => ({ id: 'semiconductor-v1', version: 1, pipeline })),
  getLearningAttempts: vi.fn(async (p?: { subject_id?: number }) =>
    store.filter((a) => p?.subject_id === undefined || a.subject_id === p.subject_id).map((a) => ({ ...a }))),
  startLearningAttempt: vi.fn(async (b: Record<string, unknown>) => {
    const existing = store.find((a) => a.attempt_uid === b.attempt_uid);
    if (existing) return { ...existing };
    const row = { ...b, started_at: '2026-10-07T10:00:00' } as unknown as WireLearningAttempt;
    store.push(row);
    return { ...row };
  }),
  patchLearningAttempt: vi.fn(async (uid: string, body: Record<string, unknown>) => {
    const a = store.find((x) => x.attempt_uid === uid);
    if (!a) return refuse('no such attempt');
    if (body.prediction !== undefined) {
      if (a.committed_at && a.prediction !== body.prediction) return refuse('prediction is write-once');
      a.prediction = body.prediction as string;
      a.committed_at = a.committed_at ?? '2026-10-07T10:01:00';
    }
    for (const f of ['manipulation', 'observed'] as const) {
      if (body[f] === undefined) continue;
      if (!a.committed_at) return refuse(`${f} before a committed prediction`);
      (a as unknown as Record<string, unknown>)[f] = body[f];
    }
    if (body.explanation_text !== undefined) {
      if (!a.committed_at) return refuse('explanation before a committed prediction');
      a.explanation_text = body.explanation_text as string;
    }
    if (body.explanation_mechanisms) a.explanation_mechanisms = body.explanation_mechanisms as string[];
    if (body.completed) {
      if (!a.committed_at) return refuse('cannot complete an uncommitted attempt');
      if (!a.completed_at) {
        a.completed_at = '2026-10-07T10:02:00';
        a.correct = body.correct as boolean;
        a.transfer = (body.transfer as boolean | undefined) ?? null;
      }
    }
    return { ...a };
  }),
}));

// The server's source-index shape for the defects table, as adfModel.test.ts builds it.
const DELETED = new Set([40, 250, 480, 730, 910, 1015, 1330, 1580, 1777, 1990]);
const INDEX: SourceRow[] = Array.from({ length: 5000 }, (_, i) => ({
  id: i + 1, modifiedAt: new Date(Date.UTC(2026, 2, 1) + i * 518_400).toISOString(), deleted: DELETED.has(i + 1), batch: Math.floor(i / 1000) + 1,
}));
vi.mock('../../services/lakehouse/sourceIndex', () => ({ loadSourceIndex: vi.fn(async () => INDEX) }));

const mockPreparation = vi.fn();
vi.mock('../../context/PreparationContext', () => ({ usePreparation: () => mockPreparation() }));

import * as api from '../../services/api';
import { AdfExperimentPage } from '../../pages/AdfExperimentPage';
import { AdfLabPage } from '../../pages/AdfLabPage';
import { STAGES } from '../../services/adfLab/stages';

const ADF = {
  id: 6, name: 'Azure Data Factory', slug: 'adf', kind: 'skill', is_archived: false, display_order: 100,
  has_exam_profile: false, question_count: 0, content_packs: [{ pack_id: 'adf', pack_version: 1 }],
  readiness: { state: 'needs_evaluation', mock_count: 0, recent_scores: [] },
};
const PSM = { ...ADF, id: 1, name: 'Scrum / PSM I', slug: 'psm-i', kind: 'certification', content_packs: [] };

const renderAt = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/lab/adf" element={<AdfLabPage />} />
      <Route path="/lab/adf/:slug" element={<AdfExperimentPage />} />
    </Routes>
  </MemoryRouter>,
);
const steps = () => screen.getByRole('list', { name: /^Step|^All/ });
const stageNow = () => within(steps()).getAllByRole('listitem').find((li) => li.getAttribute('aria-current') === 'step')?.textContent;
const lever = (name: string) => screen.getByRole('group', { name });
const lastPatch = () => { const calls = vi.mocked(api.patchLearningAttempt).mock.calls; return calls[calls.length - 1]; };

beforeEach(() => {
  store.length = 0;
  vi.mocked(api.startLearningAttempt).mockClear();
  vi.mocked(api.patchLearningAttempt).mockClear();
  mockPreparation.mockReturnValue({ selected: ADF, selectedId: 6, loading: false });
});

describe('the eight-stage loop', () => {
  it('exposes all eight stages, in order', async () => {
    renderAt('/lab/adf/watermark');
    await screen.findByRole('heading', { level: 1, name: 'Watermark & Transient Failure' });
    const names = within(steps()).getAllByRole('listitem').map((li) => li.textContent?.replace(/^[\d✓]+/, ''));
    expect(names).toEqual(['Understand', 'Predict', 'Manipulate', 'Observe', 'Reason', 'Apply', 'Explain', 'Retrieve']);
    expect(STAGES).toHaveLength(8);
    expect(stageNow()).toMatch(/Understand$/);
  });

  it('runs every stage end to end, each written through LearningService on the ADF preparation', async () => {
    const user = userEvent.setup();
    renderAt('/lab/adf/watermark');

    // Understand
    expect(await screen.findByRole('heading', { level: 2, name: 'Understand' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Loading only new data' })).toHaveAttribute('href', '/learn/guides/adf/incremental');
    await user.click(screen.getByRole('button', { name: 'Continue to Predict' }));

    // Predict: nothing can be manipulated before the prediction is committed.
    expect(screen.getByRole('heading', { level: 2, name: 'Predict' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Manipulate' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Sink' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Some rows never arrive' }));
    await user.click(screen.getByRole('button', { name: 'Commit prediction' }));
    expect(api.startLearningAttempt).toHaveBeenCalledWith(expect.objectContaining({
      attempt_uid: 'ab:6:watermark:r1:predict', challenge_id: 'adf.lab.watermark.predict', subject_id: 6, mode: 'guided',
    }));
    expect(api.patchLearningAttempt).toHaveBeenLastCalledWith('ab:6:watermark:r1:predict', { prediction: 'missing' }, 6);

    // Manipulate: the levers open, and the prediction is locked.
    expect(await screen.findByRole('heading', { level: 2, name: 'Manipulate' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Some rows never arrive' })).toBeDisabled();
    expect(stageNow()).toMatch(/Manipulate$/);
    await user.click(within(lever('Retries after the failure')).getByRole('button', { name: '1' }));
    await user.click(within(lever('Sink')).getByRole('button', { name: 'Upsert on the key' }));
    await user.click(screen.getByRole('button', { name: 'Run the model' }));

    // Observe: the model's result, then the record and the grade in one write.
    expect(screen.getByRole('heading', { level: 2, name: 'Observe' })).toBeInTheDocument();
    expect(stageNow()).toMatch(/Observe$/);
    expect(screen.getByRole('table', { name: 'The scenario against your run' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Record this observation' }));
    const recorded = lastPatch()!;
    expect(recorded[0]).toBe('ab:6:watermark:r1:predict');
    expect(recorded[1]).toMatchObject({
      manipulation: { sink: { from: 'append', to: 'upsert' }, retries: { from: 0, to: 1 } },
      observed: { result: { before: 'missing', after: 'complete' }, source: 'simulation' },
      completed: true, correct: true,
    });
    expect(await screen.findByText('Your prediction matched the model.')).toBeInTheDocument();

    // Reason: a structured choice of mechanism, graded by the model's finding.
    expect(screen.getByRole('heading', { level: 2, name: 'Reason' })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /stored on a step that also runs when the copy fails/ }));
    await user.click(screen.getByRole('button', { name: 'Submit your diagnosis' }));
    expect(api.patchLearningAttempt).toHaveBeenLastCalledWith('ab:6:watermark:r1:reason', {
      prediction: 'watermark-timing', explanation_mechanisms: ['watermark-timing'], completed: true, correct: true,
    }, 6);
    expect(await screen.findByText('That is the mechanism the model found.')).toBeInTheDocument();

    // Apply: a changed constraint, graded by running the model; transfer recorded.
    expect(screen.getByRole('heading', { level: 2, name: 'Apply' })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Retry the copy once, and upsert on the key' }));
    await user.click(screen.getByRole('button', { name: 'Submit your change' }));
    expect(lastPatch()).toEqual(['ab:6:watermark:r1:apply', expect.objectContaining({
      prediction: 'retry-upsert', correct: true, transfer: true, completed: true,
    }), 6]);

    // Explain: separate from Reason, the learner's own words on the run's Predict attempt.
    expect(await screen.findByRole('heading', { level: 2, name: 'Explain' })).toBeInTheDocument();
    await user.click(screen.getByRole('textbox'));
    await user.paste('The completion exit ran on failure, so the watermark skipped rows.');
    await user.click(screen.getByRole('button', { name: 'Save your explanation' }));
    expect(api.patchLearningAttempt).toHaveBeenLastCalledWith('ab:6:watermark:r1:predict', {
      explanation_text: 'The completion exit ran on failure, so the watermark skipped rows.',
    }, 6);

    // Retrieve: a recall check, recorded as its own retrieval attempt, with no schedule.
    expect(await screen.findByRole('heading', { level: 2, name: 'Retrieve' })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Not at all: retry defaults to 0' }));
    await user.click(screen.getByRole('button', { name: 'Check your answer' }));
    expect(api.startLearningAttempt).toHaveBeenLastCalledWith(expect.objectContaining({
      attempt_uid: 'ab:6:watermark:r1:retrieve', mode: 'retrieval', subject_id: 6,
    }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Run complete' })).toBeInTheDocument();
    expect(screen.getByText(/nothing is scheduled/)).toBeInTheDocument();

    // One run, four rows, one correlation.
    expect(store.map((a) => a.attempt_uid).sort()).toEqual([
      'ab:6:watermark:r1:apply', 'ab:6:watermark:r1:predict', 'ab:6:watermark:r1:reason', 'ab:6:watermark:r1:retrieve',
    ]);
    expect(new Set(store.map((a) => a.scenario_fingerprint))).toEqual(new Set(['adf-lab=watermark;run=1;model=semiconductor-v1']));
    expect(store.every((a) => a.subject_id === 6)).toBe(true);
  }, 60_000); // one journey through all eight stages: long by design, and slower under a full-suite load

  it('will not record an observation until a lever has changed from the scenario', async () => {
    const user = userEvent.setup();
    renderAt('/lab/adf/watermark');
    await user.click(await screen.findByRole('button', { name: 'Continue to Predict' }));
    await user.click(screen.getByRole('radio', { name: 'Every row, once' }));
    await user.click(screen.getByRole('button', { name: 'Commit prediction' }));
    await user.click(await screen.findByRole('button', { name: 'Run the model' }));
    expect(screen.getByRole('button', { name: 'Record this observation' })).toBeDisabled();
    expect(screen.getByText(/Change at least one lever/)).toBeInTheDocument();
  });

  it('records a wrong prediction as wrong, from the model', async () => {
    const user = userEvent.setup();
    renderAt('/lab/adf/watermark');
    await user.click(await screen.findByRole('button', { name: 'Continue to Predict' }));
    await user.click(screen.getByRole('radio', { name: 'Every row, once' }));
    await user.click(screen.getByRole('button', { name: 'Commit prediction' }));
    await user.click(within(await screen.findByRole('group', { name: 'Sink' })).getByRole('button', { name: 'Upsert on the key' }));
    await user.click(screen.getByRole('button', { name: 'Run the model' }));
    await user.click(screen.getByRole('button', { name: 'Record this observation' }));
    expect(lastPatch()![1]).toMatchObject({ correct: false });
    expect(await screen.findByText('Not what the model found.')).toBeInTheDocument();
  });
});

describe('state comes back from the server', () => {
  const seed = (over: Partial<WireLearningAttempt>) => store.push({
    challenge_id: 'adf.lab.watermark.predict', concept_id: 'adf.lab.watermark', mode: 'guided', hint_count: 0,
    scenario_fingerprint: 'adf-lab=watermark;run=1;model=semiconductor-v1', started_at: '2026-10-07T09:00:00',
    subject_id: 6, attempt_uid: 'ab:6:watermark:r1:predict', ...over,
  } as WireLearningAttempt);

  it('reopens at Manipulate with the prediction still committed after a reload', async () => {
    seed({ prediction: 'missing', committed_at: '2026-10-07T09:01:00' });
    renderAt('/lab/adf/watermark');
    expect(await screen.findByRole('heading', { level: 2, name: 'Manipulate' })).toBeInTheDocument();
    expect(stageNow()).toMatch(/Manipulate$/);
    expect(screen.getByRole('radio', { name: 'Some rows never arrive' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Some rows never arrive' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Commit prediction' })).not.toBeInTheDocument();
  });

  it('reopens at Reason once the observation is on the record, showing what was recorded', async () => {
    seed({
      prediction: 'missing', committed_at: '2026-10-07T09:01:00', completed_at: '2026-10-07T09:02:00', correct: true,
      manipulation: { retries: { from: 0, to: 1 } } as never,
      observed: { result: { label: 'What the destination holds', before: 'missing', after: 'duplicates' } } as never,
    });
    renderAt('/lab/adf/watermark');
    expect(await screen.findByRole('heading', { level: 2, name: 'Reason' })).toBeInTheDocument();
    expect(stageNow()).toMatch(/Reason$/);
    expect(screen.getByText(/Recorded: retries 0 → 1/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Run the model' })).not.toBeInTheDocument();
  });

  it('starts a new run, on new rows, after a complete one -- the finished run is never edited', async () => {
    const user = userEvent.setup();
    const done = { committed_at: '2026-10-07T09:01:00', completed_at: '2026-10-07T09:02:00', correct: true };
    seed({ ...done, prediction: 'missing', explanation_text: 'Because.' });
    seed({ ...done, attempt_uid: 'ab:6:watermark:r1:reason', challenge_id: 'adf.lab.watermark.reason', prediction: 'watermark-timing' });
    seed({ ...done, attempt_uid: 'ab:6:watermark:r1:apply', challenge_id: 'adf.lab.watermark.apply', prediction: 'retry-upsert' });
    seed({ ...done, attempt_uid: 'ab:6:watermark:r1:retrieve', challenge_id: 'adf.lab.watermark.retrieve', prediction: '0', mode: 'retrieval' });
    renderAt('/lab/adf/watermark');
    expect(await screen.findByRole('heading', { level: 2, name: 'Run complete' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'All 8 steps done' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Start a new run' }));
    expect(screen.getByText('Run 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue to Predict' }));
    await user.click(screen.getByRole('radio', { name: 'Some rows never arrive' }));
    await user.click(screen.getByRole('button', { name: 'Commit prediction' }));
    expect(api.startLearningAttempt).toHaveBeenLastCalledWith(expect.objectContaining({ attempt_uid: 'ab:6:watermark:r2:predict' }));
    expect(store.find((a) => a.attempt_uid === 'ab:6:watermark:r1:predict')?.prediction).toBe('missing');
  });

  it('ignores another preparation’s attempts', async () => {
    seed({ subject_id: 9, attempt_uid: 'ab:9:watermark:r1:predict', prediction: 'missing', committed_at: '2026-10-07T09:01:00' });
    renderAt('/lab/adf/watermark');
    expect(await screen.findByRole('button', { name: 'Continue to Predict' })).toBeInTheDocument();
    expect(stageNow()).toMatch(/Understand$/);
  });
});

describe('who it is for, and what it claims', () => {
  it('asks for a preparation when none is chosen, and picks none', async () => {
    mockPreparation.mockReturnValue({ selected: null, selectedId: null, loading: false });
    renderAt('/lab/adf/watermark');
    expect(await screen.findByText(/Pick one from the header first/)).toBeInTheDocument();
    expect(api.getLakehousePack).not.toHaveBeenCalledWith('anything');
    expect(screen.queryByRole('button', { name: 'Continue to Predict' })).not.toBeInTheDocument();
  });

  it('does not open for a preparation without the ADF guide, by its address or otherwise', async () => {
    mockPreparation.mockReturnValue({ selected: PSM, selectedId: 1, loading: false });
    renderAt('/lab/adf/watermark');
    expect(await screen.findByText(/has no Azure Data Factory guide attached/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Predict' })).not.toBeInTheDocument();
    expect(api.startLearningAttempt).not.toHaveBeenCalled();
  });

  it('says it is a teaching simulation, never Azure Data Factory running, with no pending notice now the lab is live', async () => {
    renderAt('/lab/adf/watermark');
    expect(await screen.findByText(/Teaching simulation\. PrepBench runs a model of this pipeline/)).toBeInTheDocument();
    expect(screen.getByText(/Nothing runs in Azure Data Factory/)).toBeInTheDocument();
    expect(screen.queryByText(/Integration in progress/)).not.toBeInTheDocument();
    // ADF's lab is the Behaviour Lab. "Lakehouse Lab" appears only as provenance (whose model and
    // pack this reuses), never as this page's name or a way into it.
    expect(screen.getByText('Azure Data Factory · ADF Behaviour Lab')).toBeInTheDocument();
    expect(screen.queryByText(/Open Lakehouse Lab/)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Lakehouse/ })).not.toBeInTheDocument();
  });
});

describe('the hub and its addresses', () => {
  it('lists the five experiments, opens every one, and shows each one’s progress from the server', async () => {
    store.push({
      attempt_uid: 'ab:6:watermark:r1:predict', challenge_id: 'adf.lab.watermark.predict', concept_id: 'adf.lab.watermark',
      scenario_fingerprint: '', mode: 'guided', started_at: '', hint_count: 0, subject_id: 6,
      prediction: 'missing', committed_at: '2026-10-07T09:01:00',
    } as WireLearningAttempt);
    renderAt('/lab/adf');
    expect(await screen.findByRole('heading', { level: 1, name: 'ADF Behaviour Lab' })).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Experiments' });
    expect(within(list).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Watermark & Transient Failure', 'Trigger Behaviour', 'Concurrency Budget', 'Copy Performance', 'Fault Tolerance',
    ]);
    for (const [title, slug] of [['Watermark & Transient Failure', 'watermark'], ['Trigger Behaviour', 'triggers'],
      ['Concurrency Budget', 'concurrency'], ['Copy Performance', 'copy-perf'], ['Fault Tolerance', 'fault-tolerance']]) {
      expect(within(list).getByRole('link', { name: `Open ${title}` })).toHaveAttribute('href', `/lab/adf/${slug}`);
    }
    expect(within(list).queryByRole('button', { name: 'Not built yet' })).not.toBeInTheDocument();
    expect(await within(list).findByText('Run 1 · Manipulate')).toBeInTheDocument();
    expect(within(list).getAllByText('Not started')).toHaveLength(4);
  });

  it('knows no sixth experiment', async () => {
    renderAt('/lab/adf/dependencies');
    expect(await screen.findByRole('heading', { level: 1, name: 'No such experiment' })).toBeInTheDocument();
  });
});
