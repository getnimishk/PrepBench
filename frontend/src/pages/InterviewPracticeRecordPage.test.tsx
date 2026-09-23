// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { InterviewPracticeRecordPage } from './InterviewPracticeRecordPage';

const mockGetQuestion = vi.fn();
const mockUpload = vi.fn();

vi.mock('../services/api', () => ({
  getInterviewQuestion: (...args: any[]) => mockGetQuestion(...args),
  uploadRecording: (...args: any[]) => mockUpload(...args),
  getInterviewRoundTypes: () => Promise.resolve([{
    value: 'behavioral', label: 'Behavioral', target_min_seconds: 90, target_max_seconds: 180,
    thinking_seconds: 45, plan_prompt: 'Situation → task → action → result',
    listening_for: 'A result with a number in it.', content_categories: [],
  }]),
}));

class FakeMediaRecorder {
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(public stream: any, public options: any) {}
  start() {}
  stop() {
    this.ondataavailable?.({ data: new Blob(['fake-audio'], { type: 'audio/webm' }) });
    this.onstop?.();
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  (globalThis as any).MediaRecorder = FakeMediaRecorder;
  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) },
    configurable: true,
  });
  mockGetQuestion.mockResolvedValue({
    id: 7, round_type: 'behavioral', question_text: 'Tell me about a time you failed.',
    category: 'Self-Awareness', is_ai_generated: false, created_at: '',
  });
});

function renderPage(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/interview-practice/:questionId/record" element={<InterviewPracticeRecordPage />} />
        <Route path="/interview-practice/recordings/:recordingId/results" element={<div>Results Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('InterviewPracticeRecordPage', () => {
  it('shows the question and uploads with interview_question_id set when recording stops', async () => {
    const user = userEvent.setup();
    mockUpload.mockResolvedValue({ id: 99 });
    renderPage('/interview-practice/7/record');

    await waitFor(() => expect(screen.getByText(/Tell me about a time you failed\./)).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /start answering/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /stop answering/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /stop answering/i }));

    await waitFor(() => expect(mockUpload).toHaveBeenCalled());
    const call = mockUpload.mock.calls[0];
    expect(call[3]).toBe(7); // interviewQuestionId positional arg

    await waitFor(() => expect(screen.getByText('Results Page')).toBeInTheDocument());
  });

  it('General Practice ("general") skips fetching a question and uploads with no interview_question_id', async () => {
    const user = userEvent.setup();
    mockUpload.mockResolvedValue({ id: 100 });
    renderPage('/interview-practice/general/record');

    expect(await screen.findByRole('heading', { name: 'General Practice' })).toBeInTheDocument();
    expect(mockGetQuestion).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /start answering/i }));
    await user.click(screen.getByRole('button', { name: /stop answering/i }));

    await waitFor(() => expect(mockUpload).toHaveBeenCalled());
    const call = mockUpload.mock.calls[0];
    expect(call[3]).toBeUndefined(); // no interviewQuestionId for freeform

    await waitFor(() => expect(screen.getByText('Results Page')).toBeInTheDocument());
  });

  it('keeps the plan with the answer, and shows the round\'s guidance before it starts', async () => {
    const user = userEvent.setup();
    mockUpload.mockResolvedValue({ id: 101 });
    renderPage('/interview-practice/7/record');

    expect(await screen.findByText('A result with a number in it.')).toBeInTheDocument();
    expect(screen.getByText(/runs 01:30–03:00/)).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Your plan' }), 'Outage, rollback, 40% fewer pages');

    await user.click(screen.getByRole('button', { name: /start answering/i }));
    await user.click(await screen.findByRole('button', { name: /stop answering/i }));

    await waitFor(() => expect(mockUpload).toHaveBeenCalled());
    expect(mockUpload.mock.calls[0][4]).toMatchObject({ planNote: 'Outage, rollback, 40% fewer pages' });
  });

  it('offers thinking time, and starts the answer on its own when it runs out', async () => {
    const user = userEvent.setup();
    renderPage('/interview-practice/7/record');

    await user.click(await screen.findByRole('button', { name: /take 45s to think/i }));
    expect(screen.getByText(/Thinking time/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /start answering now/i }));
    expect(await screen.findByRole('button', { name: /stop answering/i })).toBeInTheDocument();
  });

  it('keeps a take whose save failed, and saves it on a second try', async () => {
    const user = userEvent.setup();
    mockUpload.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ id: 102 });
    renderPage('/interview-practice/7/record');

    await user.click(await screen.findByRole('button', { name: /start answering/i }));
    await user.click(await screen.findByRole('button', { name: /stop answering/i }));

    expect(await screen.findByText(/nothing has been lost yet/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try saving again/i }));

    await waitFor(() => expect(screen.getByText('Results Page')).toBeInTheDocument());
    expect(mockUpload).toHaveBeenCalledTimes(2);
  });
});

describe('InterviewPracticeRecordPage when the question cannot be read', () => {
  it('says why and that nothing changed, and loads on retry', async () => {
    const user = userEvent.setup();
    mockGetQuestion.mockRejectedValueOnce({ isAxiosError: true, request: {} });
    renderPage('/interview-practice/7/record');

    expect(await screen.findByText(/Could not load this question\. Could not reach the PrepBench server\..*Nothing was changed\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText(/Tell me about a time you failed\./)).toBeInTheDocument();
  });
});
