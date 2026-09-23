// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

/**
 * Interview sessions in the browser: set up, answer, report.
 *
 * What these hold: the setup shows the server's own plan and starts that session;
 * the session resumes at the first unanswered question, saves each answer under
 * the session, and says "Not graded" rather than inventing a score; nothing can be
 * pressed mid-answer that would lose the take; and the report says what was and
 * was not graded.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { InterviewSessionSetupPage } from './InterviewSessionSetupPage';
import { InterviewSessionPage } from './InterviewSessionPage';
import { InterviewSessionReportPage } from './InterviewSessionReportPage';
import type { InterviewSession, InterviewSessionReport } from '../types/interviewSession';

const mockRounds = vi.fn();
const mockCategories = vi.fn();
const mockPlan = vi.fn();
const mockCreate = vi.fn();
const mockGet = vi.fn();
const mockFinish = vi.fn();
const mockReport = vi.fn();
const mockUpload = vi.fn();
const mockAnalyze = vi.fn();

vi.mock('../services/api', () => ({
  getInterviewRoundTypes: (...a: any[]) => mockRounds(...a),
  getInterviewQuestionCategories: (...a: any[]) => mockCategories(...a),
  planInterviewSession: (...a: any[]) => mockPlan(...a),
  createInterviewSession: (...a: any[]) => mockCreate(...a),
  getInterviewSession: (...a: any[]) => mockGet(...a),
  finishInterviewSession: (...a: any[]) => mockFinish(...a),
  getInterviewSessionReport: (...a: any[]) => mockReport(...a),
  uploadRecording: (...a: any[]) => mockUpload(...a),
  analyzeRecording: (...a: any[]) => mockAnalyze(...a),
  getRecordingAudioUrl: (id: number) => `/api/v1/recordings/${id}/audio`,
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

const ROUNDS = [
  { value: 'behavioral', label: 'Behavioral', target_min_seconds: 90, target_max_seconds: 180, thinking_seconds: 45, plan_prompt: 'S → T → A → R', listening_for: 'A result with a number.', content_categories: [] },
  { value: 'hr_screening', label: 'HR Screening', target_min_seconds: 45, target_max_seconds: 105, thinking_seconds: 20, plan_prompt: '', listening_for: '', content_categories: [] },
];

const session = (over: Partial<InterviewSession> = {}): InterviewSession => ({
  id: 9, round_type: 'behavioral', round_label: 'Behavioral', category: null, thinking_seconds: 45,
  target_min_seconds: 90, target_max_seconds: 180, plan_prompt: 'S → T → A → R', listening_for: 'A result with a number.',
  created_at: '2026-09-13T10:00:00', ended_at: null,
  questions: [
    { id: 1, question_text: 'Tell me about a mistake.', category: 'Accountability', practice_count: 1, takes: [
      { recording_id: 50, interview_question_id: 1, duration_seconds: 120, created_at: '2026-09-13T10:05:00', analysis_status: 'unavailable', content_percent: null, delivery_percent: null },
    ] },
    { id: 2, question_text: 'Tell me about a conflict.', category: 'Conflict', practice_count: 0, takes: [] },
  ],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  (globalThis as any).MediaRecorder = FakeMediaRecorder;
  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) },
    configurable: true,
  });
  mockRounds.mockResolvedValue(ROUNDS);
  mockCategories.mockResolvedValue(['Accountability', 'Conflict']);
  mockPlan.mockResolvedValue([
    { id: 2, question_text: 'Tell me about a conflict.', category: 'Conflict', practice_count: 0 },
    { id: 1, question_text: 'Tell me about a mistake.', category: 'Accountability', practice_count: 1 },
  ]);
  mockCreate.mockResolvedValue(session());
  mockGet.mockResolvedValue(session());
  mockFinish.mockResolvedValue(session({ ended_at: '2026-09-13T10:20:00' }));
  mockUpload.mockResolvedValue({ id: 61, title: 'x', mime_type: 'audio/webm', duration_seconds: 100, file_size_bytes: 1, interview_question_id: 2, session_id: 9, created_at: '' });
  mockAnalyze.mockResolvedValue({
    id: 1, recording_id: 61, provider: null, transcript: null, communication_scores: [], filler_word_count: null,
    summary: null, content_scores: [], content_summary: null, analysis_status: 'unavailable', analysis_error: null, created_at: '',
  });
});

describe('Session setup', () => {
  const renderSetup = () => render(
    <MemoryRouter initialEntries={['/interview-practice/setup']}>
      <Routes>
        <Route path="/interview-practice/setup" element={<InterviewSessionSetupPage />} />
        <Route path="/interview-practice/sessions/:sessionId" element={<div>Session Screen</div>} />
      </Routes>
    </MemoryRouter>
  );

  it('previews the server\'s plan, least-practised first, and starts that session', async () => {
    const user = userEvent.setup({ delay: null });
    renderSetup();

    expect(await screen.findByText('2 questions, least-practised first')).toBeInTheDocument();
    expect(screen.getByText(/Conflict · never answered/)).toBeInTheDocument();
    expect(mockPlan).toHaveBeenLastCalledWith({ round_type: 'behavioral', category: undefined, question_count: 3 });

    await user.click(screen.getByRole('button', { name: '5' }));
    await user.click(screen.getByRole('button', { name: 'None' }));
    await waitFor(() => expect(mockPlan).toHaveBeenLastCalledWith(expect.objectContaining({ question_count: 5 })));
    await user.click(screen.getByRole('button', { name: 'Start session' }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith({
      round_type: 'behavioral', category: undefined, question_count: 5, thinking: false,
    }));
    expect(await screen.findByText('Session Screen')).toBeInTheDocument();
  });

  it('will not start a session with no questions to ask', async () => {
    mockPlan.mockResolvedValue([]);
    renderSetup();

    expect(await screen.findByText(/No questions in this round/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start session' })).toBeDisabled();
  });
});

describe('Session screen', () => {
  const renderSession = () => render(
    <MemoryRouter initialEntries={['/interview-practice/sessions/9']}>
      <Routes>
        <Route path="/interview-practice/sessions/:sessionId" element={<InterviewSessionPage />} />
        <Route path="/interview-practice/sessions/:sessionId/report" element={<div>Report Screen</div>} />
      </Routes>
    </MemoryRouter>
  );

  it('resumes at the first question without an answer', async () => {
    renderSession();

    expect(await screen.findByText(/Tell me about a conflict\./)).toBeInTheDocument();
    expect(screen.getByText(/Question 2 of 2/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Question 1, answered' })).toBeInTheDocument();
  });

  it('saves the answer under the session and says it was not graded, instead of scoring it', async () => {
    const user = userEvent.setup({ delay: null });
    renderSession();
    await screen.findByText(/Tell me about a conflict\./);

    await user.click(screen.getByRole('button', { name: /^Start answering$/ }));
    // Mid-answer, nothing that would throw the take away can be pressed.
    expect(await screen.findByRole('button', { name: /stop answering/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'End session' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /stop answering/i }));

    await waitFor(() => expect(mockUpload).toHaveBeenCalled());
    expect(mockUpload.mock.calls[0][3]).toBe(2);
    expect(mockUpload.mock.calls[0][4]).toMatchObject({ sessionId: 9 });

    expect(await screen.findByText(/Not graded\./)).toBeInTheDocument();
    expect(screen.queryByText(/Content \d+%/)).not.toBeInTheDocument();
    expect(mockAnalyze).toHaveBeenCalledWith(61);
  });

  it('ends after asking, and goes to the report', async () => {
    const user = userEvent.setup({ delay: null });
    renderSession();
    await screen.findByText(/Tell me about a conflict\./);

    await user.click(screen.getByRole('button', { name: 'End session' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/1 question has no answer/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'End session' }));

    await waitFor(() => expect(mockFinish).toHaveBeenCalledWith(9));
    expect(await screen.findByText('Report Screen')).toBeInTheDocument();
  });
});

describe('Session report', () => {
  const report = (over: Partial<InterviewSessionReport> = {}): InterviewSessionReport => ({
    session: session(), total_questions: 2, answered: 1, analysed: 0, spoken_seconds: 120,
    content_percent: null, delivery_percent: null, weakest_category: null, weakest_category_percent: null,
    not_graded_reason: 'No AI provider that can analyse audio is set up, so these answers are saved but not graded.',
    ...over,
  });

  const renderReport = () => render(
    <MemoryRouter initialEntries={['/interview-practice/sessions/9/report']}>
      <Routes>
        <Route path="/interview-practice/sessions/:sessionId/report" element={<InterviewSessionReportPage />} />
      </Routes>
    </MemoryRouter>
  );

  it('says "Not graded" and why, and never shows a zero', async () => {
    mockReport.mockResolvedValue(report());
    renderReport();

    expect(await screen.findByText(/1 answer · 02:00 speaking/)).toBeInTheDocument();
    expect(screen.getAllByText('Not graded').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/saved but not graded/)).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    expect(screen.getByText('Not answered')).toBeInTheDocument();
  });

  it('names the weakest category when answers were analysed', async () => {
    mockReport.mockResolvedValue(report({
      analysed: 1, content_percent: 62, delivery_percent: 74, weakest_category: 'Outcome/Impact',
      weakest_category_percent: 40, not_graded_reason: null,
    }));
    renderReport();

    expect(await screen.findByText('Outcome/Impact')).toBeInTheDocument();
    expect(screen.getByText('62%')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Work on it' })).toHaveAttribute('href', '/interview-practice/setup?round=behavioral');
  });
});
