// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionBanner } from './ConnectionBanner';
import { connection } from '../../services/connection';
import { isUnreachable, loadFailed } from '../../services/apiError';

const mockPing = vi.fn();
vi.mock('../../services/api', () => ({
  pingServer: (...a: any[]) => mockPing(...a),
}));

beforeEach(() => {
  mockPing.mockReset();
  connection.report('online');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ConnectionBanner', () => {
  it('shows nothing while the server answers', () => {
    render(<ConnectionBanner />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says plainly that nothing is being saved while the server is gone, and when it is back', async () => {
    const user = userEvent.setup();
    mockPing.mockImplementation(async () => {
      connection.report('online');
      return true;
    });
    render(<ConnectionBanner />);

    act(() => connection.report('unreachable'));
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent("Can't reach PrepBench's server, so nothing you do now is being saved");

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(mockPing).toHaveBeenCalled();
    expect(await screen.findByText('Connected to the server again.')).toBeInTheDocument();
    expect(screen.queryByText(/Can't reach/)).not.toBeInTheDocument();
  });

  it('keeps checking on its own while the server is gone', async () => {
    vi.useFakeTimers();
    mockPing.mockResolvedValue(false);
    render(<ConnectionBanner />);

    act(() => connection.report('unreachable'));
    await act(async () => { await vi.advanceTimersByTimeAsync(11_000); });

    expect(mockPing).toHaveBeenCalledTimes(2);
  });
});

describe('failed requests, in words', () => {
  it('tells an unreachable server apart from a refusal', () => {
    expect(isUnreachable({ isAxiosError: true, request: {} })).toBe(true);
    expect(isUnreachable({ isAxiosError: true, response: { status: 500 } })).toBe(false);
    expect(isUnreachable(new TypeError('a bug of ours'))).toBe(false);
  });

  it('says what failed, why, and that nothing changed', () => {
    expect(loadFailed('Could not load your roadmaps', { isAxiosError: true, request: {} }))
      .toBe('Could not load your roadmaps. Could not reach the PrepBench server. Check that the backend is running, then try again. Nothing was changed.');
    expect(loadFailed('Could not load this roadmap', { response: { status: 404, data: { detail: 'Roadmap 9 not found' } } }))
      .toBe('Could not load this roadmap. Roadmap 9 not found. Nothing was changed.');
  });
});
