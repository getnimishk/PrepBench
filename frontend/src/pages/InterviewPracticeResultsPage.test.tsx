import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { InterviewPracticeResultsPage } from './InterviewPracticeResultsPage';

const mockGetRecording = vi.fn();
const mockGetAnalysis = vi.fn();
const mockAnalyze = vi.fn();

vi.mock('../services/api', () => ({
  getRecording: (...args: any[]) => mockGetRecording(...args),
  getRecordingAudioUrl: (id: number) => `/api/v1/recordings/${id}/audio`,
  getRecordingAnalysis: (...args: any[]) => mockGetAnalysis(...args),
  analyzeRecording: (...args: any[]) => mockAnalyze(...args),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/interview-practice/recordings/5/results']}>
      <Routes>
        <Route path="/interview-practice/recordings/:recordingId/results" element={<InterviewPracticeResultsPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetRecording.mockResolvedValue({
    id: 5, title: 'Behavioral: Tell me about a mistake', mime_type: 'audio/webm',
    duration_seconds: 60, file_size_bytes: 1000, interview_question_id: 3, created_at: '',
  });
});

describe('InterviewPracticeResultsPage', () => {
  it('shows both Content and Delivery sections when the recording was linked to a question', async () => {
    mockGetAnalysis.mockResolvedValue({
      id: 1, recording_id: 5, provider: 'gemini',
      transcript: 'My spoken answer.',
      communication_scores: [{ category: 'Clarity', score: 7, max_score: 10, feedback: 'Clear.' }],
      filler_word_count: 2,
      summary: 'Clear delivery.',
      content_scores: [{ category: 'STAR Structure', score: 6, max_score: 10, feedback: 'Mostly there.' }],
      content_summary: 'Decent example, vague outcome.',
      analysis_status: 'analyzed', analysis_error: null, created_at: '',
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('Content -- What You Said')).toBeInTheDocument());
    expect(screen.getByText('STAR Structure')).toBeInTheDocument();
    expect(screen.getByText('Decent example, vague outcome.')).toBeInTheDocument();
    expect(screen.getByText('Delivery -- How You Said It')).toBeInTheDocument();
    expect(screen.getByText('Clarity')).toBeInTheDocument();

    // Should not have re-triggered analysis -- an existing analysis was found.
    expect(mockAnalyze).not.toHaveBeenCalled();
  });

  it('shows Delivery only (no Content section) for a freeform recording with empty content_scores', async () => {
    mockGetAnalysis.mockResolvedValue({
      id: 2, recording_id: 5, provider: 'gemini',
      transcript: 'Just practicing.',
      communication_scores: [{ category: 'Pacing', score: 8, max_score: 10, feedback: 'Good pace.' }],
      filler_word_count: 0,
      summary: 'Confident delivery.',
      content_scores: [],
      content_summary: null,
      analysis_status: 'analyzed', analysis_error: null, created_at: '',
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('Delivery -- How You Said It')).toBeInTheDocument());
    expect(screen.queryByText('Content -- What You Said')).not.toBeInTheDocument();
  });

  it('auto-triggers analysis when no existing analysis is found', async () => {
    mockGetAnalysis.mockRejectedValue(new Error('404'));
    mockAnalyze.mockResolvedValue({
      id: 3, recording_id: 5, provider: 'gemini', transcript: 'x',
      communication_scores: [], filler_word_count: 0, summary: 'ok',
      content_scores: [], content_summary: null,
      analysis_status: 'analyzed', analysis_error: null, created_at: '',
    });

    renderPage();

    await waitFor(() => expect(mockAnalyze).toHaveBeenCalledWith(5));
  });

  it('shows an unavailable alert with no score UI when analysis_status is unavailable', async () => {
    mockGetAnalysis.mockResolvedValue({
      id: 4, recording_id: 5, provider: null, transcript: null,
      communication_scores: [], filler_word_count: null, summary: null,
      content_scores: [], content_summary: null,
      analysis_status: 'unavailable', analysis_error: null, created_at: '',
    });

    renderPage();

    await waitFor(() => expect(screen.getByText(/no AI provider is set up yet/i)).toBeInTheDocument());
    // Points at the setup flow, not at one vendor's environment variable --
    // a local model is an equally valid answer since the provider layer landed.
    expect(screen.getByText(/Settings -> AI Providers/i)).toBeInTheDocument();
    expect(screen.queryByText('Delivery -- How You Said It')).not.toBeInTheDocument();
  });
});
