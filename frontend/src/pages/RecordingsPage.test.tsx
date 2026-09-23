// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { RecordingsPage } from './RecordingsPage';
import type { PracticeRecording } from '../types/recording';

// Recording, playback, analysis and the transcript live on the record and
// results screens, which have their own tests. This page is the library: every
// take kept on this machine, and the way into each.

const mockGetRecordings = vi.fn();
const mockDelete = vi.fn();

vi.mock('../services/api', () => ({
  getRecordings: (...args: any[]) => mockGetRecordings(...args),
  deleteRecording: (...args: any[]) => mockDelete(...args),
}));

const take = (over: Partial<PracticeRecording> = {}): PracticeRecording => ({
  id: 7, title: 'Tell me about yourself', mime_type: 'audio/webm', duration_seconds: 95, file_size_bytes: 2048,
  interview_question_id: 3, created_at: new Date().toISOString(),
  analysis_status: 'analyzed', content_percent: 79.4, delivery_percent: 68,
  ...over,
});

const renderPage = () => render(<MemoryRouter><RecordingsPage /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetRecordings.mockResolvedValue({ items: [], total: 0, skip: 0, limit: 200 });
});

describe('RecordingsPage', () => {
  it('lists each take with when, how long, its content and delivery, and the way into it', async () => {
    mockGetRecordings.mockResolvedValue({ items: [take()], total: 1, skip: 0, limit: 200 });
    renderPage();

    const takes = await screen.findByRole('region', { name: 'Your takes' });
    expect(within(takes).getByRole('link', { name: 'Tell me about yourself' })).toHaveAttribute('href', '/recordings/7');
    expect(within(takes).getByText('Today · 1:35 · content 79% · delivery 68%')).toBeInTheDocument();
    expect(within(takes).getByText('Analysed')).toBeInTheDocument();
    expect(within(takes).getByRole('link', { name: 'Open Tell me about yourself' })).toHaveAttribute('href', '/recordings/7');
  });

  it('never shows a score for a take that was not analysed, and says why', async () => {
    mockGetRecordings.mockResolvedValue({
      items: [
        take({ id: 1, title: 'Failed one', analysis_status: 'error', content_percent: null, delivery_percent: null }),
        take({ id: 2, title: 'No provider', analysis_status: 'unavailable', content_percent: null, delivery_percent: null }),
        take({ id: 3, title: 'Never run', analysis_status: null, content_percent: null, delivery_percent: null }),
      ],
      total: 3, skip: 0, limit: 200,
    });
    renderPage();

    expect(await screen.findByText('Analysis failed')).toBeInTheDocument();
    expect(screen.getByText('Not graded')).toBeInTheDocument();
    expect(screen.getByText('Not analysed')).toBeInTheDocument();
    expect(screen.queryByText(/content \d/)).not.toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('shows an empty library as empty, with the way to fill it and no example takes', async () => {
    renderPage();

    expect(await screen.findByText('No takes yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Record your first take' })).toHaveAttribute('href', '/interview-practice');
    // The prototype's "example takes" are not drawn: rows that look like the
    // learner's own work and are not would be invented evidence.
    expect(screen.queryByRole('link', { name: /^Open / })).not.toBeInTheDocument();
  });

  it('says the library could not be read rather than calling it empty, and retries', async () => {
    const user = userEvent.setup();
    mockGetRecordings.mockRejectedValueOnce({ isAxiosError: true, request: {} })
      .mockResolvedValue({ items: [take()], total: 1, skip: 0, limit: 200 });
    renderPage();

    expect(await screen.findByText(/Could not load your recordings/)).toBeInTheDocument();
    expect(screen.queryByText('No takes yet')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('link', { name: 'Tell me about yourself' })).toBeInTheDocument();
  });

  it('deletes a take, and says so when the delete did not happen', async () => {
    const user = userEvent.setup();
    mockGetRecordings.mockResolvedValue({
      items: [take(), take({ id: 8, title: 'Why this role' })], total: 2, skip: 0, limit: 200,
    });
    mockDelete.mockResolvedValueOnce(undefined).mockRejectedValueOnce({ isAxiosError: true, request: {} });
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Delete Tell me about yourself' }));
    expect(mockDelete).toHaveBeenCalledWith(7);
    expect(await screen.findByRole('link', { name: 'Why this role' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Tell me about yourself' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete Why this role' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Could not/);
    expect(screen.getByRole('link', { name: 'Why this role' })).toBeInTheDocument();
  });
});
