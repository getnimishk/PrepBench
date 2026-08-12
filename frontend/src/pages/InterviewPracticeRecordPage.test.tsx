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
  (global as any).MediaRecorder = FakeMediaRecorder;
  Object.defineProperty(global.navigator, 'mediaDevices', {
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

    await waitFor(() => expect(screen.getByText('Tell me about a time you failed.')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /start recording/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /stop recording/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /stop recording/i }));

    await waitFor(() => expect(mockUpload).toHaveBeenCalled());
    const call = mockUpload.mock.calls[0];
    expect(call[3]).toBe(7); // interviewQuestionId positional arg

    await waitFor(() => expect(screen.getByText('Results Page')).toBeInTheDocument());
  });

  it('General Practice ("general") skips fetching a question and uploads with no interview_question_id', async () => {
    const user = userEvent.setup();
    mockUpload.mockResolvedValue({ id: 100 });
    renderPage('/interview-practice/general/record');

    await waitFor(() => expect(screen.getByText(/General Practice/)).toBeInTheDocument());
    expect(mockGetQuestion).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /start recording/i }));
    await user.click(screen.getByRole('button', { name: /stop recording/i }));

    await waitFor(() => expect(mockUpload).toHaveBeenCalled());
    const call = mockUpload.mock.calls[0];
    expect(call[3]).toBeUndefined(); // no interviewQuestionId for freeform

    await waitFor(() => expect(screen.getByText('Results Page')).toBeInTheDocument());
  });
});
