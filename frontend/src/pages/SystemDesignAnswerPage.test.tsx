// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SystemDesignAnswerPage } from './SystemDesignAnswerPage';

const mockGetPrompt = vi.fn();
const mockSubmit = vi.fn();
const mockGetSettings = vi.fn();
const mockGetDraft = vi.fn();
const mockSaveDraft = vi.fn();

vi.mock('../services/api', () => ({
  getSystemDesignPrompt: (...args: any[]) => mockGetPrompt(...args),
  submitSystemDesignAttempt: (...args: any[]) => mockSubmit(...args),
  getSettings: (...args: any[]) => mockGetSettings(...args),
  getSystemDesignDraft: (...args: any[]) => mockGetDraft(...args),
  saveSystemDesignDraft: (...args: any[]) => mockSaveDraft(...args),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/system-design/1/answer']}>
      <Routes>
        <Route path="/system-design/:promptId/answer" element={<SystemDesignAnswerPage />} />
        <Route path="/system-design/attempts/:attemptId" element={<div>Results Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetPrompt.mockResolvedValue({
    id: 1,
    title: 'Design a URL Shortener',
    prompt_text: 'Design a URL shortener that scales.',
    category: 'Distributed Systems',
    difficulty: 'easy',
    is_ai_generated: false,
    created_at: '',
  });
  mockGetSettings.mockResolvedValue({ default_target_role: null });
  mockGetDraft.mockResolvedValue({
    prompt_id: 1, answer_text: '', target_role: null, updated_at: null, exists: false,
  });
  mockSaveDraft.mockResolvedValue({});
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SystemDesignAnswerPage', () => {
  it('blocks submission when the answer is empty', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Submit for feedback/i })).toBeDisabled());
  });

  it('submits the answer and navigates to the results page', async () => {
    const user = userEvent.setup();
    mockSubmit.mockResolvedValue({ id: 42 });
    renderPage();

    await waitFor(() => expect(screen.getByLabelText(/Your answer/i)).toBeInTheDocument());
    await user.type(screen.getByLabelText(/Your answer/i), 'Use a hash and a KV store.');
    await user.click(screen.getByRole('button', { name: /Submit for feedback/i }));

    await waitFor(() => expect(mockSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ prompt_id: 1, answer_text: 'Use a hash and a KV store.' })
    ));
    expect(await screen.findByText('Results Page')).toBeInTheDocument();
  });

  it('pre-fills Target Role from the default_target_role setting on a new attempt', async () => {
    mockGetSettings.mockResolvedValue({ default_target_role: 'Staff Engineer, fintech' });
    renderPage();

    await waitFor(() =>
      expect(screen.getByLabelText(/Target role/i)).toHaveValue('Staff Engineer, fintech'));
  });

  /**
   * The defect this page existed with for its whole life.
   *
   * The answer lived in React state and nowhere else: no autosave, no
   * localStorage, no beforeunload guard. Forty minutes of design work was one
   * stray sidebar click from being gone, and nothing on the screen suggested
   * otherwise -- while the exam runner two routes away had warned before
   * unloading since it was written.
   */
  describe('drafts', () => {
    it('saves what is typed without being asked', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderPage();

      await waitFor(() => expect(screen.getByLabelText(/Your answer/i)).toBeInTheDocument());
      await user.type(screen.getByLabelText(/Your answer/i), 'Partition by tenant.');

      await vi.advanceTimersByTimeAsync(1500);
      await waitFor(() => expect(mockSaveDraft).toHaveBeenCalledWith(
        1, expect.objectContaining({ answer_text: 'Partition by tenant.' })
      ));
    });

    // Opening a prompt and reading it is not an edit. Saving on mount wrote a
    // draft nobody had typed and armed the leave-the-page prompt over text the
    // learner had not touched.
    it('does not write anything until something is actually changed', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      mockGetDraft.mockResolvedValue({
        prompt_id: 1, answer_text: 'a previous answer', target_role: null,
        updated_at: '2026-09-06T10:00:00', exists: true,
      });
      renderPage();

      await waitFor(() => expect(screen.getByLabelText(/Your answer/i))
        .toHaveValue('a previous answer'));
      await vi.advanceTimersByTimeAsync(3000);

      expect(mockSaveDraft).not.toHaveBeenCalled();
    });

    it('picks up where the learner left off, and says so', async () => {
      mockGetDraft.mockResolvedValue({
        prompt_id: 1,
        answer_text: 'Start with the write path: an append-only log.',
        target_role: 'Senior Backend Engineer',
        updated_at: '2026-09-06T10:00:00',
        exists: true,
      });
      renderPage();

      await waitFor(() => expect(screen.getByLabelText(/Your answer/i))
        .toHaveValue('Start with the write path: an append-only log.'));
      expect(screen.getByLabelText(/Target role/i)).toHaveValue('Senior Backend Engineer');
      expect(screen.getByText(/Picked up where you left off/)).toBeInTheDocument();
    });

    it('does not claim to have resumed an empty draft', async () => {
      mockGetDraft.mockResolvedValue({
        prompt_id: 1, answer_text: '', target_role: null, updated_at: null, exists: true,
      });
      renderPage();

      await waitFor(() => expect(screen.getByLabelText(/Your answer/i)).toHaveValue(''));
      expect(screen.queryByText(/Picked up where you left off/)).not.toBeInTheDocument();
    });

    // A draft the server never received must not look like one it accepted --
    // silence here is precisely the failure this whole feature exists to stop.
    it('says so when a save does not reach the database', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      mockSaveDraft.mockRejectedValue(new Error('offline'));
      renderPage();

      await waitFor(() => expect(screen.getByLabelText(/Your answer/i)).toBeInTheDocument());
      await user.type(screen.getByLabelText(/Your answer/i), 'x');
      await vi.advanceTimersByTimeAsync(1500);

      expect(await screen.findByText(/have not reached the database/)).toBeInTheDocument();
    });

    it('still lets the learner write when the draft cannot be read', async () => {
      mockGetDraft.mockRejectedValue(new Error('offline'));
      renderPage();

      await waitFor(() => expect(screen.getByLabelText(/Your answer/i)).toBeInTheDocument());
      expect(screen.queryByText(/Failed to load prompt/)).not.toBeInTheDocument();
    });

    it('flushes the draft before submitting, so a failed grade loses nothing', async () => {
      const user = userEvent.setup();
      mockSubmit.mockRejectedValue(new Error('grading exploded'));
      renderPage();

      await waitFor(() => expect(screen.getByLabelText(/Your answer/i)).toBeInTheDocument());
      await user.type(screen.getByLabelText(/Your answer/i), 'A design.');
      await user.click(screen.getByRole('button', { name: /Submit for feedback/i }));

      await waitFor(() => expect(mockSaveDraft).toHaveBeenCalledWith(
        1, expect.objectContaining({ answer_text: 'A design.' })
      ));
      expect(await screen.findByText(/Failed to submit your answer/)).toBeInTheDocument();
      // And the words are still on the screen.
      expect(screen.getByLabelText(/Your answer/i)).toHaveValue('A design.');
    });
  });
});
