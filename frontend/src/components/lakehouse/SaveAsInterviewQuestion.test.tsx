// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { SaveAsInterviewQuestion } from './SaveAsInterviewQuestion';
import * as api from '../../services/api';
import type { WireLearningAttempt } from '../../types/learning';

const theme = createTheme();

vi.mock('../../services/api', () => ({
  saveInterviewQuestionFromSource: vi.fn(),
}));

const mockAttempt: WireLearningAttempt = {
  attempt_uid: 'lk:2:semiconductor-v1@1:duplicate-keys',
  challenge_id: 'lakehouse.c.duplicate-keys',
  concept_id: 'delta-lake',
  scenario_fingerprint: 'pack=semiconductor-v1@1',
  started_at: '2026-10-10T00:00:00',
  mode: 'guided',
  hint_count: 0,
  prediction: 'duplicate-keys',
  completed_at: '2026-10-10T00:00:00',
  correct: true,
  observed: {
    result: 'duplicate-keys',
    ok: true,
    version: 2,
    rows: 50,
  } as unknown as WireLearningAttempt['observed'],
  subject_id: 2,
};

describe('SaveAsInterviewQuestion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (props: Partial<React.ComponentProps<typeof SaveAsInterviewQuestion>> = {}) =>
    render(
      <ThemeProvider theme={theme}>
        <SaveAsInterviewQuestion
          subjectId={2}
          packId="semiconductor-v1"
          packVersion={1}
          station="Station C"
          challengeId="duplicate-keys"
          challengeTitle="Duplicate keys"
          attempt={mockAttempt}
          {...props}
        />
      </ThemeProvider>,
    );

  it('renders nothing to save when attempt has no observations', () => {
    const emptyAttempt: WireLearningAttempt = {
      ...mockAttempt,
      observed: null,
    };
    renderComponent({ attempt: emptyAttempt });
    expect(screen.getByText(/No observations recorded yet/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save as interview question/ })).not.toBeInTheDocument();
  });

  it('populates talking points strictly from observed values', () => {
    renderComponent();
    expect(screen.getByRole('button', { name: /Save as interview question/i })).toBeInTheDocument();
    const pointsInput = screen.getByLabelText(/Key talking points/i) as HTMLTextAreaElement;
    expect(pointsInput.value).toContain('Observed result: duplicate-keys');
    expect(pointsInput.value).toContain('Operation status: Succeeded');
    expect(pointsInput.value).toContain('Delta table version: 2');
    expect(pointsInput.value).toContain('Affected rows: 50');
  });

  it('prepared answer defaults to empty unless written', () => {
    renderComponent();
    const answerInput = screen.getByLabelText(/Prepared answer/i) as HTMLTextAreaElement;
    expect(answerInput.value).toBe('');
  });

  it('saves via PUT /interview-questions/by-source and shows success note', async () => {
    const user = userEvent.setup();
    vi.mocked(api.saveInterviewQuestionFromSource).mockResolvedValueOnce({
      created: true,
      question: {
        id: 99,
        round_type: 'technical' as any,
        question_text: 'How does Delta Lake handle Duplicate keys in production (Station C)?',
        category: 'Databricks Lakehouse',
        prepared_answer: 'My rehearsed answer.',
        key_talking_points: ['Observed result: duplicate-keys', 'Operation status: Succeeded'],
      } as any,
    });

    renderComponent();

    const answerInput = screen.getByLabelText(/Prepared answer/i);
    await user.type(answerInput, 'My rehearsed answer.');

    const saveBtn = screen.getByRole('button', { name: /Save as interview question/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(api.saveInterviewQuestionFromSource).toHaveBeenCalledWith(
        expect.objectContaining({
          source_ref: 'lab/semiconductor-v1@1/station/station c/duplicate-keys',
          subject_id: 2,
          round_type: 'technical',
          prepared_answer: 'My rehearsed answer.',
        }),
      );
    });

    expect(await screen.findByText(/Added to your interview question library/i)).toBeInTheDocument();
  });

  it('re-saving updates the question and shows update confirmation', async () => {
    const user = userEvent.setup();
    vi.mocked(api.saveInterviewQuestionFromSource).mockResolvedValueOnce({
      created: false,
      question: {
        id: 99,
        round_type: 'technical' as any,
        question_text: 'How does Delta Lake handle Duplicate keys in production (Station C)?',
        category: 'Databricks Lakehouse',
      } as any,
    });

    renderComponent();
    const saveBtn = screen.getByRole('button', { name: /Save as interview question/i });
    await user.click(saveBtn);

    expect(await screen.findByText(/Updated in your interview question library/i)).toBeInTheDocument();
  });
});
