// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useParams } from 'react-router-dom';
import { InterviewPracticeSetupPage } from './InterviewPracticeSetupPage';

// userEvent.setup({ delay: null }) throughout: the default per-keystroke await
// makes each character its own async tick plus a React re-render.

const mockGetRoundTypes = vi.fn();
const mockGetQuestions = vi.fn();
const mockGenerate = vi.fn();
const mockGetRecordings = vi.fn();

vi.mock('../services/api', () => ({
  getInterviewRoundTypes: (...args: any[]) => mockGetRoundTypes(...args),
  getInterviewQuestions: (...args: any[]) => mockGetQuestions(...args),
  generateInterviewQuestion: (...args: any[]) => mockGenerate(...args),
  getRecordings: (...args: any[]) => mockGetRecordings(...args),
}));

const RecordStub = () => <div>Record Page {useParams().questionId}</div>;

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/interview-practice']}>
      <Routes>
        <Route path="/interview-practice" element={<InterviewPracticeSetupPage />} />
        <Route path="/interview-practice/:questionId/record" element={<RecordStub />} />
      </Routes>
    </MemoryRouter>
  );
}

const MISTAKE = {
  id: 1, round_type: 'behavioral', question_text: 'Tell me about a mistake.', category: 'Accountability',
  is_ai_generated: false, created_at: '', practice_count: 2,
};
const WHY_US = {
  id: 2, round_type: 'hr_screening', question_text: 'Why us?', category: 'Motivation',
  is_ai_generated: false, created_at: '', practice_count: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetRoundTypes.mockResolvedValue([
    { value: 'hr_screening', label: 'HR Screening', target_min_seconds: 45, target_max_seconds: 105 },
    { value: 'hiring_manager', label: 'Hiring Manager' },
    { value: 'system_design', label: 'System Design' },
    { value: 'behavioral', label: 'Behavioral', target_min_seconds: 90, target_max_seconds: 180 },
  ]);
  mockGetQuestions.mockResolvedValue({ items: [MISTAKE, WHY_US], total: 2, skip: 0, limit: 500 });
  mockGetRecordings.mockResolvedValue({ items: [{ id: 1 }, { id: 2 }, { id: 3 }], total: 3, skip: 0, limit: 200 });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('InterviewPracticeSetupPage', () => {
  it('shows every question as a card whose one way in is recording a take', async () => {
    const user = userEvent.setup({ delay: null });
    renderPage();

    const card = await screen.findByRole('article', { name: 'Tell me about a mistake.' });
    expect(within(card).getByText('Behavioral')).toBeInTheDocument();
    expect(within(card).getByText('Accountability')).toBeInTheDocument();
    // Least practised first: the question never answered leads.
    const cards = screen.getAllByRole('article');
    expect(cards[0]).toHaveAccessibleName('Why us?');

    await user.click(within(card).getByRole('button', { name: 'Record a take: Tell me about a mistake.' }));
    expect(await screen.findByText('Record Page 1')).toBeInTheDocument();
  });

  it('files the questions under their rounds, with counts', async () => {
    const user = userEvent.setup({ delay: null });
    renderPage();
    await screen.findByRole('article', { name: 'Why us?' });

    expect(screen.getByRole('tab', { name: 'All questions (2)' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Hiring Manager (0)' })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Behavioral (1)' }));
    expect(screen.getByRole('article', { name: 'Tell me about a mistake.' })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Why us?' })).not.toBeInTheDocument();
    // A whole session, for the round on screen.
    expect(screen.getByRole('link', { name: 'Set up a session' })).toHaveAttribute('href', '/interview-practice/setup?round=behavioral');

    await user.click(screen.getByRole('tab', { name: 'Hiring Manager (0)' }));
    expect(screen.getByText(/No questions in this round yet/)).toBeInTheDocument();
  });

  it('picks a quick random question from the round on screen', async () => {
    const user = userEvent.setup({ delay: null });
    vi.spyOn(Math, 'random').mockReturnValue(0);
    renderPage();
    await screen.findByRole('article', { name: 'Why us?' });

    await user.click(screen.getByRole('tab', { name: 'Behavioral (1)' }));
    await user.click(screen.getByRole('button', { name: '● Quick random practice' }));
    expect(await screen.findByText('Record Page 1')).toBeInTheDocument();
  });

  it('goes in without a question when you just want to talk', async () => {
    const user = userEvent.setup({ delay: null });
    renderPage();
    const justTalk = await screen.findByRole('region', { name: 'Just talk' });

    await user.click(within(justTalk).getByRole('button', { name: 'Record' }));
    expect(await screen.findByText('Record Page general')).toBeInTheDocument();
  });

  it('keeps editing, deleting and importing out of the practice page', async () => {
    renderPage();
    await screen.findByRole('article', { name: 'Why us?' });

    // Content maintenance lives in the question library, not in front of
    // somebody about to speak.
    expect(screen.queryByRole('button', { name: /^edit /i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^delete /i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /import questions/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Question library' })).toHaveAttribute('href', '/interview-practice/library');
  });

  it('links to the recordings library with how many takes it holds', async () => {
    renderPage();
    expect(await screen.findByRole('link', { name: 'Recordings library (3)' })).toHaveAttribute('href', '/recordings');
  });

  it('shows an inline error and does not navigate when generation fails', async () => {
    const user = userEvent.setup({ delay: null });
    // Matches what the backend actually returns since the provider layer landed:
    // vendor-neutral, and pointing at the setup flow rather than one vendor's key.
    mockGenerate.mockRejectedValue({ response: { data: { detail: 'No AI provider is set up yet. Add one in Settings -> AI Providers to generate questions.' } } });
    renderPage();
    const panel = await screen.findByRole('region', { name: 'Write me a new one' });

    await user.click(within(panel).getByRole('button', { name: 'Write a question' }));
    await user.click(await within(panel).findByRole('button', { name: /write it/i }));
    await waitFor(() => expect(screen.getByText(/Settings -> AI Providers/i)).toBeInTheDocument());
    expect(mockGenerate).toHaveBeenCalledWith(expect.objectContaining({ save_to_bank: true }));
    expect(screen.queryByText(/Record Page/)).not.toBeInTheDocument();
  });
});

describe('InterviewPracticeSetupPage when the server does not answer', () => {
  it('does not offer to write a question for rounds it could not read, and recovers on retry', async () => {
    const user = userEvent.setup({ delay: null });
    mockGetRoundTypes.mockRejectedValueOnce({ isAxiosError: true, request: {} });
    renderPage();

    expect(await screen.findByText(/Could not load the interview rounds\..*Nothing was changed\./)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Write me a new one' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('region', { name: 'Write me a new one' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Behavioral (1)' })).toBeInTheDocument();
  });

  it('does not call a round empty when its questions could not be read', async () => {
    const user = userEvent.setup({ delay: null });
    mockGetQuestions.mockRejectedValueOnce({ isAxiosError: true, request: {} });
    renderPage();

    expect(await screen.findByText(/Could not load interview questions\..*Nothing was changed\./)).toBeInTheDocument();
    expect(screen.queryByText(/No questions in this round yet/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('article', { name: 'Tell me about a mistake.' })).toBeInTheDocument();
  });

  it('leaves the recordings count unsaid when it could not be read', async () => {
    mockGetRecordings.mockRejectedValue(new Error('down'));
    renderPage();
    await screen.findByRole('article', { name: 'Why us?' });
    expect(screen.getByRole('link', { name: 'Recordings library' })).toBeInTheDocument();
  });
});
