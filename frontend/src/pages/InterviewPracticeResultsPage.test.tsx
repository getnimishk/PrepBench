// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { InterviewPracticeResultsPage } from './InterviewPracticeResultsPage';

const mockGetRecording = vi.fn();
const mockGetAnalysis = vi.fn();
const mockAnalyze = vi.fn();
const mockGetQuestion = vi.fn();
const mockGetRecordings = vi.fn();

vi.mock('../services/api', () => ({
  getRecording: (...args: any[]) => mockGetRecording(...args),
  getRecordingAudioUrl: (id: number) => `/api/v1/recordings/${id}/audio`,
  getRecordingAnalysis: (...args: any[]) => mockGetAnalysis(...args),
  analyzeRecording: (...args: any[]) => mockAnalyze(...args),
  getInterviewQuestion: (...args: any[]) => mockGetQuestion(...args),
  getInterviewRoundTypes: () => Promise.resolve([
    { value: 'behavioral', label: 'Behavioral', target_min_seconds: 90, target_max_seconds: 180, thinking_seconds: 45 },
  ]),
  getRecordings: (...args: any[]) => mockGetRecordings(...args),
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
  mockGetQuestion.mockResolvedValue({
    id: 3, round_type: 'behavioral', question_text: 'Tell me about a mistake.', category: 'Accountability',
    is_ai_generated: false, created_at: '',
  });
  mockGetRecordings.mockResolvedValue({ items: [], skip: 0, limit: 50 });
});

const analysed = (over: object = {}) => ({
  id: 1, recording_id: 5, provider: 'gemini', transcript: 'My spoken answer.',
  communication_scores: [{ category: 'Clarity', score: 7, max_score: 10, feedback: 'Clear.' }],
  filler_word_count: 2, summary: 'Clear delivery.',
  content_scores: [
    { category: 'STAR Structure', score: 6, max_score: 10, feedback: 'Mostly there.' },
    { category: 'Outcome/Impact', score: 3, max_score: 10, feedback: 'Say what changed, with a number.' },
  ],
  content_summary: 'Decent example, vague outcome.',
  analysis_status: 'analyzed', analysis_error: null, created_at: '',
  ...over,
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

    await waitFor(() => expect(screen.getByText('What you said')).toBeInTheDocument());
    expect(screen.getByText('STAR Structure')).toBeInTheDocument();
    expect(screen.getByText('Decent example, vague outcome.')).toBeInTheDocument();
    expect(screen.getByText('How you said it')).toBeInTheDocument();
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

    await waitFor(() => expect(screen.getByText('How you said it')).toBeInTheDocument());
    expect(screen.queryByText('What you said')).not.toBeInTheDocument();
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
    expect(screen.queryByText('How you said it')).not.toBeInTheDocument();
  });

  it('offers to run the analysis again when it was not graded', async () => {
    const user = userEvent.setup({ delay: null });
    mockGetAnalysis.mockResolvedValue(analysed({
      analysis_status: 'error', analysis_error: 'Provider timed out', communication_scores: [], content_scores: [],
    }));
    mockAnalyze.mockResolvedValue(analysed());
    renderPage();

    expect(await screen.findByText(/The analysis failed: Provider timed out/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings/ai');
    await user.click(screen.getByRole('button', { name: 'Analyse again' }));

    await waitFor(() => expect(mockAnalyze).toHaveBeenCalledWith(5));
    expect(await screen.findByText('What you said')).toBeInTheDocument();
  });

  it('recommends the lowest-graded part of the answer and a retake', async () => {
    mockGetAnalysis.mockResolvedValue(analysed());
    renderPage();

    expect(await screen.findByText('Outcome/Impact · 30%')).toBeInTheDocument();
    expect(screen.getByText(/Say what changed, with a number\./, { selector: 'p' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Retake this question' })[0]).toHaveAttribute('href', '/interview-practice/3/record');
  });

  it("measures the take against the round's target length without any AI", async () => {
    mockGetAnalysis.mockResolvedValue(analysed({ analysis_status: 'unavailable', communication_scores: [], content_scores: [] }));
    renderPage();

    expect(await screen.findByText(/01:00 · short of the target length/)).toBeInTheDocument();
  });

  it('compares every take of the question, with no score where none was given', async () => {
    mockGetAnalysis.mockResolvedValue(analysed());
    mockGetRecordings.mockResolvedValue({
      items: [
        { id: 5, title: 't', mime_type: 'audio/webm', duration_seconds: 60, file_size_bytes: 1, interview_question_id: 3, created_at: '2026-09-13T10:00:00', analysis_status: 'analyzed', content_percent: 45, delivery_percent: 70 },
        { id: 4, title: 't', mime_type: 'audio/webm', duration_seconds: 100, file_size_bytes: 1, interview_question_id: 3, created_at: '2026-09-12T10:00:00', analysis_status: 'unavailable', content_percent: null, delivery_percent: null },
      ],
      skip: 0, limit: 50,
    });
    renderPage();

    const table = await screen.findByRole('table', { name: 'Takes of this question' });
    expect(within(table).getByText('This take')).toBeInTheDocument();
    expect(within(table).getByText('45%')).toBeInTheDocument();
    expect(within(table).getByText('Not graded')).toBeInTheDocument();
    expect(within(table).getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/interview-practice/recordings/4/results');
  });

  it('renders the plan vs spoken comparison section when answer_comparison is present', async () => {
    mockGetQuestion.mockResolvedValue({
      id: 3, round_type: 'behavioral', question_text: 'Tell me about a mistake.', category: 'Accountability',
      prepared_answer: 'My prepared model answer text.',
      key_talking_points: ['Admitted early', 'Proposed fix'],
      is_ai_generated: false, created_at: '',
    });
    mockGetAnalysis.mockResolvedValue(analysed({
      answer_comparison: {
        alignment_score: 85,
        key_point_matches: [
          { point: 'Admitted early', status: 'covered', evidence: 'I admitted it right away' },
          { point: 'Proposed fix', status: 'missed', evidence: 'Did not propose fix' },
        ],
        gap_analysis: 'Omitted the proposed remediation plan.',
        unplanned_additions: 'Spent too much time on background story.',
        coaching_tips: 'Focus more on the recovery action next time.',
      },
    }));
    renderPage();

    expect(await screen.findByText('Prepared Answer vs. What You Said')).toBeInTheDocument();
    expect(screen.getByText('85% Fidelity')).toBeInTheDocument();
    expect(screen.getByText('Admitted early')).toBeInTheDocument();
    expect(screen.getByText('Covered')).toBeInTheDocument();
    expect(screen.getByText('Proposed fix')).toBeInTheDocument();
    expect(screen.getByText('Missed')).toBeInTheDocument();
    expect(screen.getByText(/Omitted the proposed remediation plan\./)).toBeInTheDocument();
    expect(screen.getByText(/Spent too much time on background story\./)).toBeInTheDocument();
    expect(screen.getByText(/Focus more on the recovery action next time\./)).toBeInTheDocument();
    expect(screen.getByText('Compare Prepared Model Answer vs. Verbatim Transcript')).toBeInTheDocument();
  });
});


describe('InterviewPracticeResultsPage when the recording cannot be read', () => {
  it('says why and that nothing changed, and loads on retry', async () => {
    const user = userEvent.setup();
    mockGetRecording.mockRejectedValueOnce({ isAxiosError: true, request: {} });
    mockGetAnalysis.mockResolvedValue(analysed());
    renderPage();

    expect(await screen.findByText(/Could not load this recording\. Could not reach the PrepBench server\..*Nothing was changed\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Decent example, vague outcome.')).toBeInTheDocument();
  });
});
