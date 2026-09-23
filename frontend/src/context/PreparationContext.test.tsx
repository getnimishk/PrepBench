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
    expect(await screen.findByRole('button', { name: /Preparation: Scrum \/ PSM I/ })).toBeInTheDocument();
  });
});
