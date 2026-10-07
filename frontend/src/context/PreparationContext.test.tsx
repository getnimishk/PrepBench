// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { PreparationProvider, usePreparation } from './PreparationContext';
import { PreparationPicker } from '../components/common/PreparationPicker';
import { connection } from '../services/connection';

const mockGetSubjects = vi.fn();
vi.mock('../services/api', () => ({
  getSubjects: (...a: any[]) => mockGetSubjects(...a),
}));

const PSM = {
  id: 1, name: 'Scrum / PSM I', kind: 'certification', is_archived: false, question_count: 709, pass_mark: 85,
  readiness: { recent_scores: [], mock_count: 0 },
};

const Count: React.FC = () => {
  const { preparations, loading, error } = usePreparation();
  if (loading) return <p>loading</p>;
  return <p>{error ? `error: ${error}` : `${preparations.length} preparation(s)`}</p>;
};

beforeEach(() => {
  mockGetSubjects.mockReset();
  connection.report('online');
  localStorage.clear();
});

afterEach(() => {
  connection.report('online');
});

describe('PreparationProvider', () => {
  it('asks for the list again as soon as the server answers', async () => {
    mockGetSubjects.mockRejectedValueOnce({ isAxiosError: true, request: {} }).mockResolvedValue([PSM]);
    // What the request interceptors report when a request gets no answer.
    connection.report('unreachable');
    render(<PreparationProvider><Count /></PreparationProvider>);

    expect(await screen.findByText(/error: Could not load your preparations\./)).toBeInTheDocument();

    act(() => connection.report('online'));
    expect(await screen.findByText('1 preparation(s)')).toBeInTheDocument();
    expect(mockGetSubjects).toHaveBeenCalledTimes(2);
  });

  it('does not keep asking once the list has been read', async () => {
    mockGetSubjects.mockResolvedValue([PSM]);
    render(<PreparationProvider><Count /></PreparationProvider>);
    expect(await screen.findByText('1 preparation(s)')).toBeInTheDocument();

    act(() => connection.report('unreachable'));
    act(() => connection.report('online'));
    expect(mockGetSubjects).toHaveBeenCalledTimes(1);
  });
});

describe('PreparationPicker with the list unread', () => {
  it('says the preparations are unavailable rather than that there are none, and can try again', async () => {
    const user = userEvent.setup();
    mockGetSubjects.mockRejectedValueOnce({ isAxiosError: true, request: {} }).mockResolvedValue([PSM]);
    render(
      <MemoryRouter>
        <PreparationProvider><PreparationPicker /></PreparationProvider>
      </MemoryRouter>,
    );

    const picker = await screen.findByRole('button', { name: /Preparation: Preparations unavailable/ });
    await user.click(picker);
    expect(screen.getByText(/Could not load your preparations/)).toBeInTheDocument();
    expect(screen.queryByText(/No preparations yet/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: 'Try again' }));
    // The list is readable now, but nothing was ever chosen: the picker says so
    // rather than choosing the first preparation on the learner's behalf.
    expect(await screen.findByRole('button', { name: /Preparation: No preparation/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Preparation: No preparation/ }));
    expect(screen.getByRole('menuitem', { name: /Scrum \/ PSM I/ })).toBeInTheDocument();
  });
});

describe('Which preparation is selected when none has been chosen', () => {
  const ADF = {
    id: 6, name: 'ADF', kind: 'skill', is_archived: false, question_count: 0,
    readiness: { recent_scores: [], mock_count: 0 },
  };
  const KEY = 'prepbench.selectedPreparationId';

  const Probe: React.FC = () => {
    const { selectedId, selected, loading, capabilities, select, refresh } = usePreparation();
    if (loading) return <p>loading</p>;
    return (
      <div>
        <span data-testid="selected-id">{String(selectedId)}</span>
        <span data-testid="selected-name">{selected?.name ?? 'none'}</span>
        <span data-testid="cert">{String(capabilities.certification)}</span>
        <button onClick={() => select(6)}>Pick ADF</button>
        <button onClick={() => void refresh()}>Refresh</button>
      </div>
    );
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it('is nobody on a first load, not the first preparation in the list', async () => {
    mockGetSubjects.mockResolvedValue([PSM, ADF]);
    render(<PreparationProvider><Probe /></PreparationProvider>);

    expect(await screen.findByTestId('selected-id')).toHaveTextContent('null');
    expect(screen.getByTestId('selected-name')).toHaveTextContent('none');
    expect(screen.getByTestId('cert')).toHaveTextContent('false');
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('is nobody when the stored choice no longer exists, and forgets the stale id', async () => {
    localStorage.setItem(KEY, '99');
    mockGetSubjects.mockResolvedValue([PSM, ADF]);
    render(<PreparationProvider><Probe /></PreparationProvider>);

    expect(await screen.findByTestId('selected-id')).toHaveTextContent('null');
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('keeps a stored choice that still exists', async () => {
    localStorage.setItem(KEY, '6');
    mockGetSubjects.mockResolvedValue([PSM, ADF]);
    render(<PreparationProvider><Probe /></PreparationProvider>);

    expect(await screen.findByTestId('selected-id')).toHaveTextContent('6');
    expect(screen.getByTestId('selected-name')).toHaveTextContent('ADF');
  });

  it('keeps a manual choice across a refresh of the list, and stores it', async () => {
    const user = userEvent.setup();
    mockGetSubjects.mockResolvedValue([PSM, ADF]);
    render(<PreparationProvider><Probe /></PreparationProvider>);
    expect(await screen.findByTestId('selected-id')).toHaveTextContent('null');

    await user.click(screen.getByRole('button', { name: 'Pick ADF' }));
    expect(screen.getByTestId('selected-id')).toHaveTextContent('6');
    expect(localStorage.getItem(KEY)).toBe('6');

    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(await screen.findByTestId('selected-id')).toHaveTextContent('6');
    expect(mockGetSubjects).toHaveBeenCalledTimes(2);
  });

  it('becomes nobody, not the first preparation, when the chosen one disappears on a refresh', async () => {
    const user = userEvent.setup();
    localStorage.setItem(KEY, '6');
    mockGetSubjects.mockResolvedValueOnce([PSM, ADF]).mockResolvedValue([PSM]);
    render(<PreparationProvider><Probe /></PreparationProvider>);
    expect(await screen.findByTestId('selected-id')).toHaveTextContent('6');

    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(await screen.findByTestId('selected-id')).toHaveTextContent('null');
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});

describe('PreparationContext Capabilities & Missing Subject Context', () => {
  const ADF = {
    id: 6,
    name: 'Azure Data Factory',
    kind: 'skill',
    is_archived: false,
    question_count: 0,
    readiness: { recent_scores: [], mock_count: 0 },
  };

  const CapabilityProbe: React.FC = () => {
    const { capabilities, selectedId, select } = usePreparation();
    return (
      <div>
        <span data-testid="selected-id">{String(selectedId)}</span>
        <span data-testid="cert">{String(capabilities.certification)}</span>
        <span data-testid="interview">{String(capabilities.interview)}</span>
        <span data-testid="lab">{String(capabilities.learningLab)}</span>
        <span data-testid="workspace">{String(capabilities.workspace)}</span>
        <button onClick={() => select(6)}>Select ADF</button>
        <button onClick={() => select(1)}>Select PSM</button>
        <button onClick={() => select(null)}>Select Unassigned</button>
      </div>
    );
  };

  it('connects capabilities to PreparationContext and exposes them via usePreparation()', async () => {
    const user = userEvent.setup();
    mockGetSubjects.mockResolvedValue([PSM, ADF]);

    render(
      <PreparationProvider>
        <CapabilityProbe />
      </PreparationProvider>,
    );

    // Nothing chosen yet: unassigned, never the first preparation in the list.
    expect(await screen.findByTestId('selected-id')).toHaveTextContent('null');
    expect(screen.getByTestId('cert')).toHaveTextContent('false');

    // Pick PSM I (id: 1)
    await user.click(screen.getByRole('button', { name: 'Select PSM' }));
    expect(screen.getByTestId('selected-id')).toHaveTextContent('1');
    expect(screen.getByTestId('cert')).toHaveTextContent('true');
    expect(screen.getByTestId('interview')).toHaveTextContent('false');
    expect(screen.getByTestId('lab')).toHaveTextContent('false');
    expect(screen.getByTestId('workspace')).toHaveTextContent('true');

    // Switch to ADF (id: 6)
    await user.click(screen.getByRole('button', { name: 'Select ADF' }));
    expect(screen.getByTestId('selected-id')).toHaveTextContent('6');
    expect(screen.getByTestId('cert')).toHaveTextContent('false'); // ADF is a skill, NOT certification
    expect(screen.getByTestId('interview')).toHaveTextContent('true');
    expect(screen.getByTestId('lab')).toHaveTextContent('true');

    // Switch to Unassigned / null subject context
    await user.click(screen.getByRole('button', { name: 'Select Unassigned' }));
    expect(screen.getByTestId('selected-id')).toHaveTextContent('null');
    // Evaluates strictly to unassigned capabilities, NEVER defaulting to ADF or PSM I
    expect(screen.getByTestId('cert')).toHaveTextContent('false');
    expect(screen.getByTestId('interview')).toHaveTextContent('false');
    expect(screen.getByTestId('lab')).toHaveTextContent('false');
    expect(screen.getByTestId('workspace')).toHaveTextContent('true'); // safe unassigned default
  });
});

