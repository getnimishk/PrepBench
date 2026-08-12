import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecordingsPage } from './RecordingsPage';

const mockGetRecordings = vi.fn();
const mockUpload = vi.fn();
const mockDelete = vi.fn();
const mockGetProviders = vi.fn();
const mockAnalyze = vi.fn();
const mockGetAnalysis = vi.fn();

vi.mock('../services/api', () => ({
  getRecordings: (...args: any[]) => mockGetRecordings(...args),
  uploadRecording: (...args: any[]) => mockUpload(...args),
  deleteRecording: (...args: any[]) => mockDelete(...args),
  getRecordingAudioUrl: (id: number) => `/api/v1/recordings/${id}/audio`,
  getRecordingProviders: (...args: any[]) => mockGetProviders(...args),
  analyzeRecording: (...args: any[]) => mockAnalyze(...args),
  getRecordingAnalysis: (...args: any[]) => mockGetAnalysis(...args),
}));

// jsdom implements neither getUserMedia nor MediaRecorder -- fake both so the
// "start/stop recording" flow can be exercised without a real microphone.
class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = [];
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(public stream: any, public options: any) {
    FakeMediaRecorder.instances.push(this);
  }
  start() {}
  stop() {
    this.ondataavailable?.({ data: new Blob(['fake-audio'], { type: 'audio/webm' }) });
    this.onstop?.();
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  FakeMediaRecorder.instances = [];
  (global as any).MediaRecorder = FakeMediaRecorder;

  Object.defineProperty(global.navigator, 'mediaDevices', {
    value: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }],
      }),
    },
    configurable: true,
  });

  mockGetRecordings.mockResolvedValue({ items: [], skip: 0, limit: 100 });
  mockGetProviders.mockResolvedValue([{ name: 'gemini', is_available: true }]);
});

describe('RecordingsPage', () => {
  it('records and uploads audio when start/stop is clicked', async () => {
    const user = userEvent.setup();
    mockUpload.mockResolvedValue({ id: 1, title: 'Test', mime_type: 'audio/webm', duration_seconds: 1, file_size_bytes: 10, interview_question_id: null, created_at: '' });

    render(<RecordingsPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /start recording/i })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /start recording/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /stop recording/i })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /stop recording/i }));

    await waitFor(() => expect(mockUpload).toHaveBeenCalled());
  });

  it('regression: the freeform library flow never passes an interview_question_id', async () => {
    // Interview Practice reuses uploadRecording's 4th (interviewQuestionId)
    // param -- this page must keep calling it with exactly 3 args (or an
    // explicit undefined), proving this flow stays freeform/unlinked even
    // after Interview Practice added that param to the shared function.
    const user = userEvent.setup();
    mockUpload.mockResolvedValue({ id: 2, title: 'Test', mime_type: 'audio/webm', duration_seconds: 1, file_size_bytes: 10, interview_question_id: null, created_at: '' });

    render(<RecordingsPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /start recording/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /start recording/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /stop recording/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /stop recording/i }));

    await waitFor(() => expect(mockUpload).toHaveBeenCalled());
    const call = mockUpload.mock.calls[0];
    expect(call[3]).toBeUndefined();
  });

  it('renders past recordings with a working audio player', async () => {
    mockGetRecordings.mockResolvedValue({
      items: [{ id: 5, title: 'My Practice Answer', mime_type: 'audio/webm', duration_seconds: 30, file_size_bytes: 1000, created_at: '' }],
      skip: 0,
      limit: 100,
    });

    render(<RecordingsPage />);
    await waitFor(() => expect(screen.getByText('My Practice Answer')).toBeInTheDocument());

    const audioEl = document.querySelector('audio');
    expect(audioEl).toBeTruthy();
    expect(audioEl?.getAttribute('src')).toBe('/api/v1/recordings/5/audio');
  });

  it('shows no score UI when analysis is unavailable', async () => {
    const user = userEvent.setup();
    mockGetRecordings.mockResolvedValue({
      items: [{ id: 5, title: 'My Practice Answer', mime_type: 'audio/webm', duration_seconds: 30, file_size_bytes: 1000, created_at: '' }],
      skip: 0,
      limit: 100,
    });
    mockAnalyze.mockResolvedValue({
      id: 1, recording_id: 5, provider: 'gemini', transcript: null,
      communication_scores: [], filler_word_count: null, summary: null,
      analysis_status: 'unavailable', analysis_error: null, created_at: '',
    });

    render(<RecordingsPage />);
    await waitFor(() => expect(screen.getByText('My Practice Answer')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /^analyze$/i }));

    await waitFor(() => expect(screen.getByText(/not analyzed/i)).toBeInTheDocument());
    expect(screen.queryByText(/filler words/i)).not.toBeInTheDocument();
  });

  it('shows transcript and scores when analyzed', async () => {
    const user = userEvent.setup();
    mockGetRecordings.mockResolvedValue({
      items: [{ id: 5, title: 'My Practice Answer', mime_type: 'audio/webm', duration_seconds: 30, file_size_bytes: 1000, created_at: '' }],
      skip: 0,
      limit: 100,
    });
    mockAnalyze.mockResolvedValue({
      id: 1, recording_id: 5, provider: 'gemini',
      transcript: 'This is what I said out loud.',
      communication_scores: [{ category: 'Clarity', score: 8, max_score: 10, feedback: 'Very clear.' }],
      filler_word_count: 2,
      summary: 'Solid delivery overall.',
      analysis_status: 'analyzed', analysis_error: null, created_at: '',
    });

    render(<RecordingsPage />);
    await waitFor(() => expect(screen.getByText('My Practice Answer')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /^analyze$/i }));

    await waitFor(() => expect(screen.getByText('Solid delivery overall.')).toBeInTheDocument());
    expect(screen.getByText('Clarity')).toBeInTheDocument();
    expect(screen.getByText('2 filler words')).toBeInTheDocument();
  });
});
