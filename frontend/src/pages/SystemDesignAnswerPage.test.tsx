// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SystemDesignAnswerPage } from './SystemDesignAnswerPage';

const mockGetPrompt = vi.fn();
const mockSubmit = vi.fn();
const mockGetSettings = vi.fn();
const mockGetDraft = vi.fn();
const mockSaveDraft = vi.fn();

import { connection } from '../services/connection';

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
  // Edits kept on this device from one test must not appear in the next.
  localStorage.clear();
  connection.report('online');
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
      expect(screen.getByRole('button', { name: /Submit for rubric evaluation/i })).toBeDisabled());
  });

  it('submits the answer and navigates to the results page', async () => {
    const user = userEvent.setup();
    mockSubmit.mockResolvedValue({ id: 42 });
    renderPage();

    await waitFor(() => expect(screen.getByLabelText(/High-level architecture/i)).toBeInTheDocument());
    await user.type(screen.getByLabelText(/High-level architecture/i), 'Use a hash and a KV store.');
    await user.click(screen.getByRole('button', { name: /Submit for rubric evaluation/i }));

    await waitFor(() => expect(mockSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ prompt_id: 1, sections: expect.objectContaining({ architecture: 'Use a hash and a KV store.' }) })
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

      await waitFor(() => expect(screen.getByLabelText(/High-level architecture/i)).toBeInTheDocument());
      await user.type(screen.getByLabelText(/High-level architecture/i), 'Partition by tenant.');

      await vi.advanceTimersByTimeAsync(1500);
      await waitFor(() => expect(mockSaveDraft).toHaveBeenCalledWith(
        1, expect.objectContaining({ sections: expect.objectContaining({ architecture: 'Partition by tenant.' }) })
      ));
    });

    // Opening a prompt and reading it is not an edit. Saving on mount wrote a
    // draft nobody had typed and armed the leave-the-page prompt over text the
    // learner had not touched.
    it('does not write anything until something is actually changed', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      mockGetDraft.mockResolvedValue({
        prompt_id: 1, answer_text: '## High-level architecture\na previous answer', target_role: null,
        sections: { architecture: 'a previous answer' },
        updated_at: '2026-09-06T10:00:00', exists: true,
      });
      renderPage();

      await waitFor(() => expect(screen.getByLabelText(/High-level architecture/i))
        .toHaveValue('a previous answer'));
      await vi.advanceTimersByTimeAsync(3000);

      expect(mockSaveDraft).not.toHaveBeenCalled();
    });

    it('picks up where the learner left off, and says so', async () => {
      mockGetDraft.mockResolvedValue({
        prompt_id: 1,
        answer_text: '## High-level architecture\nStart with the write path: an append-only log.',
        sections: { requirements: '', architecture: 'Start with the write path: an append-only log.' },
        target_role: 'Senior Backend Engineer',
        updated_at: '2026-09-06T10:00:00',
        exists: true,
      });
      renderPage();

      await waitFor(() => expect(screen.getByLabelText(/High-level architecture/i))
        .toHaveValue('Start with the write path: an append-only log.'));
      expect(screen.getByLabelText(/Target role/i)).toHaveValue('Senior Backend Engineer');
      expect(screen.getByText(/Picked up where you left off/)).toBeInTheDocument();
    });

    it('does not claim to have resumed an empty draft', async () => {
      mockGetDraft.mockResolvedValue({
        prompt_id: 1, answer_text: '', target_role: null, updated_at: null, exists: true,
      });
      renderPage();

      await waitFor(() => expect(screen.getByLabelText(/High-level architecture/i)).toHaveValue(''));
      expect(screen.queryByText(/Picked up where you left off/)).not.toBeInTheDocument();
    });

    // A draft the server never received must not look like one it accepted --
    // silence here is precisely the failure this whole feature exists to stop.
    it('says so when a save does not reach the database', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      mockSaveDraft.mockRejectedValue(new Error('offline'));
      renderPage();

      await waitFor(() => expect(screen.getByLabelText(/High-level architecture/i)).toBeInTheDocument());
      await user.type(screen.getByLabelText(/High-level architecture/i), 'x');
      await vi.advanceTimersByTimeAsync(1500);

      expect(await screen.findByText(/have not reached the database/)).toBeInTheDocument();
    });

    it('keeps edits on this device when the server cannot take them, and sends them when it is back', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      mockSaveDraft.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({});
      renderPage();

      await waitFor(() => expect(screen.getByLabelText(/High-level architecture/i)).toBeInTheDocument());
      await user.type(screen.getByLabelText(/High-level architecture/i), 'Queue the writes.');
      await vi.advanceTimersByTimeAsync(1500);

      expect(await screen.findByText(/Saved on this device/)).toBeInTheDocument();
      const kept = JSON.parse(localStorage.getItem('prepbench.draft.systemDesign:1')!);
      expect(kept.value.sections.architecture).toBe('Queue the writes.');

      // The server answers again.
      act(() => { connection.report('unreachable'); connection.report('online'); });

      await waitFor(() => expect(mockSaveDraft).toHaveBeenCalledTimes(2));
      expect(await screen.findByText(/^Saved$|^Saved ·/)).toBeInTheDocument();
      expect(localStorage.getItem('prepbench.draft.systemDesign:1')).toBeNull();
    });

    it('restores edits kept on this device that are newer than the server draft, and sends them', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      localStorage.setItem('prepbench.draft.systemDesign:1', JSON.stringify({
        value: { sections: { requirements: '', architecture: 'Kept while offline.', data_model: '', failure_handling: '', trade_offs: '' }, targetRole: '' },
        savedAt: '2026-09-06T11:00:00.000Z',
      }));
      mockGetDraft.mockResolvedValue({
        prompt_id: 1, answer_text: '', target_role: null,
        sections: { architecture: 'Older, on the server.' },
        updated_at: '2026-09-06T10:00:00', exists: true,
      });
      renderPage();

      await waitFor(() => expect(screen.getByLabelText(/High-level architecture/i)).toHaveValue('Kept while offline.'));
      expect(screen.getByText(/Restored edits that were kept on this device/)).toBeInTheDocument();
      await vi.advanceTimersByTimeAsync(1500);
      await waitFor(() => expect(mockSaveDraft).toHaveBeenCalledWith(
        1, expect.objectContaining({ sections: expect.objectContaining({ architecture: 'Kept while offline.' }) }),
      ));
    });

    it('drops a kept copy the server has already moved past', async () => {
      localStorage.setItem('prepbench.draft.systemDesign:1', JSON.stringify({
        value: { sections: { requirements: '', architecture: 'Stale.', data_model: '', failure_handling: '', trade_offs: '' }, targetRole: '' },
        savedAt: '2026-09-06T09:00:00.000Z',
      }));
      mockGetDraft.mockResolvedValue({
        prompt_id: 1, answer_text: '', target_role: null,
        sections: { architecture: 'Newer, on the server.' },
        updated_at: '2026-09-06T10:00:00', exists: true,
      });
      renderPage();

      await waitFor(() => expect(screen.getByLabelText(/High-level architecture/i)).toHaveValue('Newer, on the server.'));
      expect(localStorage.getItem('prepbench.draft.systemDesign:1')).toBeNull();
    });

    it('still lets the learner write when the draft cannot be read', async () => {
      mockGetDraft.mockRejectedValue(new Error('offline'));
      renderPage();

      await waitFor(() => expect(screen.getByLabelText(/High-level architecture/i)).toBeInTheDocument());
      expect(screen.queryByText(/Could not load this prompt/)).not.toBeInTheDocument();
    });

    it('flushes the draft before submitting, so a failed grade loses nothing', async () => {
      const user = userEvent.setup();
      mockSubmit.mockRejectedValue(new Error('grading exploded'));
      renderPage();

      await waitFor(() => expect(screen.getByLabelText(/High-level architecture/i)).toBeInTheDocument());
      await user.type(screen.getByLabelText(/High-level architecture/i), 'A design.');
      await user.click(screen.getByRole('button', { name: /Submit for rubric evaluation/i }));

      await waitFor(() => expect(mockSaveDraft).toHaveBeenCalledWith(
        1, expect.objectContaining({ sections: expect.objectContaining({ architecture: 'A design.' }) })
      ));
      expect(await screen.findByText(/Failed to submit your answer/)).toBeInTheDocument();
      // And the words are still on the screen.
      expect(screen.getByLabelText(/High-level architecture/i)).toHaveValue('A design.');
    });
  });

  describe('sections', () => {
    it('asks for each part of a design in the order an interviewer expects', async () => {
      renderPage();

      const labels = await screen.findAllByRole('textbox');
      const names = labels.map((el) => el.getAttribute('id')).filter(Boolean);
      expect(names.length).toBeGreaterThanOrEqual(6);
      expect(screen.getByLabelText(/1\. Requirements & scale assumptions/)).toBeInTheDocument();
      expect(screen.getByLabelText(/3\. Data model & storage/)).toBeInTheDocument();
      expect(screen.getByLabelText(/4\. Failure handling/)).toBeInTheDocument();
      expect(screen.getByLabelText(/5\. Trade-offs/)).toBeInTheDocument();
    });

    it('saves every section it is given, and counts what is written', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.type(await screen.findByLabelText(/Failure handling/), 'Retry with backoff.');
      await user.type(screen.getByLabelText(/Trade-offs/), 'Latency over cost.');

      await waitFor(() => expect(mockSaveDraft).toHaveBeenCalledWith(
        1, expect.objectContaining({ sections: expect.objectContaining({ failure_handling: 'Retry with backoff.', trade_offs: 'Latency over cost.' }) }),
      ), { timeout: 4000 });
      expect(screen.getByText(/2 of 5 sections written/)).toBeInTheDocument();
    });

    it('keeps an answer written before sections existed in view, rather than dropping it', async () => {
      mockGetDraft.mockResolvedValue({
        prompt_id: 1, answer_text: 'One long answer from before.', sections: null,
        target_role: null, updated_at: '2026-08-01T10:00:00', exists: true,
      });
      renderPage();

      expect(await screen.findByText('One long answer from before.')).toBeInTheDocument();
      expect(screen.getByLabelText(/High-level architecture/i)).toHaveValue('');
    });
  });
});

