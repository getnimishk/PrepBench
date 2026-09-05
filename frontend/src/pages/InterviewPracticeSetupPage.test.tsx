// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { InterviewPracticeSetupPage } from './InterviewPracticeSetupPage';

// userEvent.setup({ delay: null }) throughout: these tests type multi-word
// strings, and the default per-keystroke await makes each character its own
// async tick plus a React re-render. Dropping the artificial pacing shaves
// real time off the run; the key events themselves are still dispatched.
// (It is not on its own what fixed this file's intermittent timeouts -- the
// suite-wide testTimeout in vite.config.ts is. See the note there.)

const mockGetRoundTypes = vi.fn();
const mockGetQuestions = vi.fn();
const mockGetCategories = vi.fn();
const mockGenerate = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockImport = vi.fn();

vi.mock('../services/api', () => ({
  getInterviewRoundTypes: (...args: any[]) => mockGetRoundTypes(...args),
  getInterviewQuestions: (...args: any[]) => mockGetQuestions(...args),
  getInterviewQuestionCategories: (...args: any[]) => mockGetCategories(...args),
  generateInterviewQuestion: (...args: any[]) => mockGenerate(...args),
  updateInterviewQuestion: (...args: any[]) => mockUpdate(...args),
  deleteInterviewQuestion: (...args: any[]) => mockDelete(...args),
  importInterviewQuestions: (...args: any[]) => mockImport(...args),
}));

// window.confirm gate on delete -- default to confirming.
vi.stubGlobal('confirm', vi.fn(() => true));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/interview-practice']}>
      <Routes>
        <Route path="/interview-practice" element={<InterviewPracticeSetupPage />} />
        <Route path="/interview-practice/:questionId/record" element={<div>Record Page</div>} />
        <Route path="/recordings" element={<div>Recordings Library</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetRoundTypes.mockResolvedValue([
    { value: 'hr_screening', label: 'HR Screening' },
    { value: 'hiring_manager', label: 'Hiring Manager' },
    { value: 'system_design', label: 'System Design' },
    { value: 'behavioral', label: 'Behavioral' },
  ]);
  mockGetCategories.mockResolvedValue(['Accountability']);
  mockGetQuestions.mockResolvedValue({
    items: [{ id: 1, round_type: 'behavioral', question_text: 'Tell me about a mistake.', category: 'Accountability', is_ai_generated: false, created_at: '' }],
    total: 1, skip: 0, limit: 100,
  });
});

describe('InterviewPracticeSetupPage', () => {
  it('opens on a question rather than on a choice of round', async () => {
    // Five icon tiles, then a blind "give me a question" button, then a wall
    // of category chips: two decisions and a content surface before anyone
    // said a word out loud.
    renderPage();

    expect(await screen.findByText(/Tell me about a mistake\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Record' })).toBeInTheDocument();
  });

  it('offers every round, quietly', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: 'HR Screening' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Hiring Manager' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'System Design' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Behavioral' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Just talk' })).toBeInTheDocument();
  });

  it('records the question it is showing', async () => {
    const user = userEvent.setup({ delay: null });
    renderPage();
    await screen.findByText(/Tell me about a mistake\./);

    await user.click(screen.getByRole('button', { name: 'Record' }));
    await waitFor(() => expect(screen.getByText('Record Page')).toBeInTheDocument());
  });

  it('going in without a question needs no question fetched', async () => {
    const user = userEvent.setup({ delay: null });
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Just talk' })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Just talk' }));
    await waitFor(() =>
      expect(screen.getByText(/record whatever you want to practise saying/i)).toBeInTheDocument()
    );
    await user.click(screen.getByRole('button', { name: 'Record' }));

    await waitFor(() => expect(screen.getByText('Record Page')).toBeInTheDocument());
  });

  it('keeps editing and deleting out of the practice flow', async () => {
    const user = userEvent.setup({ delay: null });
    renderPage();
    await screen.findByText(/Tell me about a mistake\./);

    // CRUD on every card is content maintenance, and it does not belong in
    // front of somebody about to speak.
    expect(screen.queryByRole('button', { name: /^edit /i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^delete /i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /browse questions/i }));
    expect(await screen.findByRole('button', { name: /^edit tell me about a mistake\.$/i }))
      .toBeInTheDocument();
  });

  it('shows an inline error and does not navigate when generation fails', async () => {
    const user = userEvent.setup({ delay: null });
    // Matches what the backend actually returns since the provider layer landed:
    // vendor-neutral, and pointing at the setup flow rather than one vendor's key.
    mockGenerate.mockRejectedValue({ response: { data: { detail: 'No AI provider is set up yet. Add one in Settings -> AI Providers to generate questions.' } } });
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: /write me a new one/i })).toBeInTheDocument());

    // Generation lives behind a disclosure now: writing a question is content
    // work, and the page leads with the question you came to answer.
    await user.click(screen.getByRole('button', { name: /write me a new one/i }));
    await user.click(screen.getByRole('button', { name: /write it/i }));
    await waitFor(() => expect(screen.getByText(/Settings -> AI Providers/i)).toBeInTheDocument());
    expect(screen.queryByText('Record Page')).not.toBeInTheDocument();
  });

  it('links to the existing recordings library', async () => {
    const user = userEvent.setup({ delay: null });
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: /past recordings/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /past recordings/i }));
    await waitFor(() => expect(screen.getByText('Recordings Library')).toBeInTheDocument());
  });

  it('editing a question through the dialog updates its displayed text and does not navigate to record', async () => {
    const user = userEvent.setup({ delay: null });
    mockUpdate.mockResolvedValue({ id: 1, round_type: 'behavioral', question_text: 'Tell me about a big mistake.', category: 'Accountability', is_ai_generated: false, created_at: '' });
    renderPage();
    await screen.findByText(/Tell me about a mistake\./);
    await user.click(screen.getByRole('button', { name: /browse questions/i }));

    await user.click(await screen.findByRole('button', { name: /^edit tell me about a mistake\.$/i }));
    const textbox = screen.getByLabelText(/question text/i);
    await user.clear(textbox);
    await user.type(textbox, 'Tell me about a big mistake.');

    // After saving, the page refetches -- have the refetch return the updated text.
    mockGetQuestions.mockResolvedValue({
      items: [{ id: 1, round_type: 'behavioral', question_text: 'Tell me about a big mistake.', category: 'Accountability', is_ai_generated: false, created_at: '' }],
      total: 1, skip: 0, limit: 100,
    });

    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(1, expect.objectContaining({ question_text: 'Tell me about a big mistake.' })));
    await waitFor(() => expect(screen.getAllByText(/Tell me about a big mistake\./).length).toBeGreaterThan(0));
    expect(screen.queryByText('Record Page')).not.toBeInTheDocument();
  });

  it('deleting a question removes its card from the list without navigating', async () => {
    const user = userEvent.setup({ delay: null });
    mockDelete.mockResolvedValue({ status: 'success', deleted_id: 1 });
    renderPage();
    await screen.findByText(/Tell me about a mistake\./);
    await user.click(screen.getByRole('button', { name: /browse questions/i }));

    await user.click(await screen.findByRole('button', { name: /^delete tell me about a mistake\.$/i }));

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith(1));
    await waitFor(() => expect(screen.queryByText(/Tell me about a mistake\./)).not.toBeInTheDocument());
    expect(screen.queryByText('Record Page')).not.toBeInTheDocument();
  });

  it('opens the import modal and refreshes the question list on successful import', async () => {
    const user = userEvent.setup({ delay: null });
    mockImport.mockResolvedValue({ imported_count: 1, skipped_count: 0, errors: [] });
    renderPage();
    await screen.findByText(/Tell me about a mistake\./);
    await user.click(screen.getByRole('button', { name: /browse questions/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /import questions/i })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /import questions/i }));
    await waitFor(() => expect(screen.getByPlaceholderText(/One question per line/i)).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText(/One question per line/i), 'A new question.');
    const getQuestionsCallsBefore = mockGetQuestions.mock.calls.length;
    await user.click(screen.getByRole('button', { name: /^import$/i }));

    await waitFor(() => expect(mockGetQuestions.mock.calls.length).toBeGreaterThan(getQuestionsCallsBefore));
  });
});
