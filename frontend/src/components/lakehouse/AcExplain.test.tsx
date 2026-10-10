// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AcExplain } from './AcExplain';
import * as api from '../../services/api';

vi.mock('../../services/api', () => ({
  getLakehouseCriteriaFeedback: vi.fn(),
}));

const SAMPLE_CRITERIA = 'Given a batch with bad rows, when appended, then reject.';

describe('AcExplain with AI feedback (P1-6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Get AI feedback button, disabled when not enabled or criteria is empty', () => {
    const onCriteria = vi.fn();
    const onCheck = vi.fn();
    const onSave = vi.fn();

    const { rerender } = render(
      <AcExplain
        enabled={false}
        placeholder="Given ..."
        criteria=""
        onCriteria={onCriteria}
        checked={null}
        onCheck={onCheck}
        saveState="idle"
        onSave={onSave}
      />
    );

    const aiButton = screen.getByRole('button', { name: /get ai feedback/i });
    expect(aiButton).toBeDisabled();

    rerender(
      <AcExplain
        enabled={true}
        placeholder="Given ..."
        criteria=""
        onCriteria={onCriteria}
        checked={null}
        onCheck={onCheck}
        saveState="idle"
        onSave={onSave}
      />
    );
    expect(screen.getByRole('button', { name: /get ai feedback/i })).toBeDisabled();

    rerender(
      <AcExplain
        enabled={true}
        placeholder="Given ..."
        criteria={SAMPLE_CRITERIA}
        onCriteria={onCriteria}
        checked={null}
        onCheck={onCheck}
        saveState="idle"
        onSave={onSave}
      />
    );
    expect(screen.getByRole('button', { name: /get ai feedback/i })).toBeEnabled();
  });

  it('fetches AI feedback and renders advice with Explanation without score or verdict', async () => {
    const user = userEvent.setup();
    const mockFeedback = vi.mocked(api.getLakehouseCriteriaFeedback);
    mockFeedback.mockResolvedValueOnce({
      status: 'feedback',
      points: [
        'Clarify which schema error triggers rejection.',
        'Define the allowable latency before timeout.',
      ],
      reason: null,
    });

    render(
      <AcExplain
        enabled={true}
        placeholder="Given ..."
        criteria={SAMPLE_CRITERIA}
        onCriteria={vi.fn()}
        checked={null}
        onCheck={vi.fn()}
        saveState="idle"
        onSave={vi.fn()}
      />
    );

    const button = screen.getByRole('button', { name: /get ai feedback/i });
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText('AI feedback')).toBeInTheDocument();
    });

    expect(screen.getByText('Clarify which schema error triggers rejection.')).toBeInTheDocument();
    expect(screen.getByText('Define the allowable latency before timeout.')).toBeInTheDocument();

    // Invariant: no score, no 0%, no verdict, no correct indicator
    expect(screen.queryByText(/score/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/0%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/passed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/verdict/i)).not.toBeInTheDocument();
  });

  it('renders Not Graded and reason when provider is unavailable', async () => {
    const user = userEvent.setup();
    const mockFeedback = vi.mocked(api.getLakehouseCriteriaFeedback);
    mockFeedback.mockResolvedValueOnce({
      status: 'not_graded',
      points: [],
      reason: 'No AI provider configured for acceptance criteria feedback.',
    });

    render(
      <AcExplain
        enabled={true}
        placeholder="Given ..."
        criteria={SAMPLE_CRITERIA}
        onCriteria={vi.fn()}
        checked={null}
        onCheck={vi.fn()}
        saveState="idle"
        onSave={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /get ai feedback/i }));

    await waitFor(() => {
      expect(screen.getByText('Not Graded')).toBeInTheDocument();
    });
    expect(screen.getByText('No AI provider configured for acceptance criteria feedback.')).toBeInTheDocument();

    // Invariant: never a 0, a score, or an empty pass
    expect(screen.queryByText(/0%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/0\/100/)).not.toBeInTheDocument();
  });

  it('clears feedback when the criteria text is edited', async () => {
    const user = userEvent.setup();
    const mockFeedback = vi.mocked(api.getLakehouseCriteriaFeedback);
    mockFeedback.mockResolvedValueOnce({
      status: 'feedback',
      points: ['Initial advice point.'],
      reason: null,
    });

    let currentText = SAMPLE_CRITERIA;
    const onCriteria = vi.fn((next) => {
      currentText = next;
    });

    const { rerender } = render(
      <AcExplain
        enabled={true}
        placeholder="Given ..."
        criteria={currentText}
        onCriteria={onCriteria}
        checked={null}
        onCheck={vi.fn()}
        saveState="idle"
        onSave={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /get ai feedback/i }));
    await waitFor(() => {
      expect(screen.getByText('Initial advice point.')).toBeInTheDocument();
    });

    // Learner edits criteria
    const input = screen.getByLabelText(/acceptance criteria/i);
    await user.type(input, ' more words');

    // Rerender with updated criteria
    rerender(
      <AcExplain
        enabled={true}
        placeholder="Given ..."
        criteria={currentText}
        onCriteria={onCriteria}
        checked={null}
        onCheck={vi.fn()}
        saveState="idle"
        onSave={vi.fn()}
      />
    );

    expect(screen.queryByText('Initial advice point.')).not.toBeInTheDocument();
  });

  it('shows only the latest answer when requests overlap in flight', async () => {
    const user = userEvent.setup();
    const mockFeedback = vi.mocked(api.getLakehouseCriteriaFeedback);

    let resolveFirst!: (val: any) => void;
    let resolveSecond!: (val: any) => void;

    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    const secondPromise = new Promise((resolve) => {
      resolveSecond = resolve;
    });

    mockFeedback
      .mockImplementationOnce(() => firstPromise as any)
      .mockImplementationOnce(() => secondPromise as any);

    let currentCriteria = SAMPLE_CRITERIA;
    const onCriteria = vi.fn((next) => {
      currentCriteria = next;
    });

    const { rerender } = render(
      <AcExplain
        enabled={true}
        placeholder="Given ..."
        criteria={currentCriteria}
        onCriteria={onCriteria}
        checked={null}
        onCheck={vi.fn()}
        saveState="idle"
        onSave={vi.fn()}
      />
    );

    const button = screen.getByRole('button', { name: /get ai feedback/i });

    // First request
    await user.click(button);
    expect(screen.getByRole('button', { name: /getting feedback/i })).toBeDisabled();

    // Learner edits criteria, which cancels/resets in-flight and allows requesting for the new text
    const input = screen.getByLabelText(/acceptance criteria/i);
    await user.type(input, ' v2');
    rerender(
      <AcExplain
        enabled={true}
        placeholder="Given ..."
        criteria={currentCriteria}
        onCriteria={onCriteria}
        checked={null}
        onCheck={vi.fn()}
        saveState="idle"
        onSave={vi.fn()}
      />
    );

    const buttonV2 = screen.getByRole('button', { name: /get ai feedback/i });
    expect(buttonV2).toBeEnabled();
    // Second request
    await user.click(buttonV2);
    expect(screen.getByRole('button', { name: /getting feedback/i })).toBeDisabled();

    // Resolve second request first
    await act(async () => {
      resolveSecond({
        status: 'feedback',
        points: ['Second request feedback'],
        reason: null,
      });
    });

    expect(await screen.findByText('Second request feedback')).toBeInTheDocument();

    // Now resolve the older first request
    await act(async () => {
      resolveFirst({
        status: 'feedback',
        points: ['First request feedback'],
        reason: null,
      });
    });

    // Older request must NOT override the newer request
    expect(screen.queryByText('First request feedback')).not.toBeInTheDocument();
    expect(screen.getByText('Second request feedback')).toBeInTheDocument();
  });
});
