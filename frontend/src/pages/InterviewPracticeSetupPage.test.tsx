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
  it('renders all four round types plus General Practice', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('HR Screening')).toBeInTheDocument());
    expect(screen.getByText('Hiring Manager')).toBeInTheDocument();
    expect(screen.getByText('System Design')).toBeInTheDocument();
    expect(screen.getByText('Behavioral')).toBeInTheDocument();
    expect(screen.getByText('General Practice')).toBeInTheDocument();
  });

  it('selecting a round loads its question bank, and clicking a question navigates to record', async () => {
    const user = userEvent.setup({ delay: null });
    renderPage();
    await waitFor(() => expect(screen.getByText('Behavioral')).toBeInTheDocument());

    await user.click(screen.getByText('Behavioral'));
    await waitFor(() => expect(mockGetQuestions).toHaveBeenCalledWith(expect.objectContaining({ round_type: 'behavioral' })));
    await waitFor(() => expect(screen.getByText('Tell me about a mistake.')).toBeInTheDocument());

    await user.click(screen.getByText('Tell me about a mistake.'));
    await waitFor(() => expect(screen.getByText('Record Page')).toBeInTheDocument());
  });

  it('General Practice navigates straight to the general record route, no question fetch', async () => {
    const user = userEvent.setup({ delay: null });
    renderPage();
    await waitFor(() => expect(screen.getByText('General Practice')).toBeInTheDocument());

    await user.click(screen.getByText('General Practice'));
    await waitFor(() => expect(screen.getByRole('button', { name: /start recording/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /start recording/i }));

    await waitFor(() => expect(screen.getByText('Record Page')).toBeInTheDocument());
    expect(mockGetQuestions).not.toHaveBeenCalled();
  });

  it('shows an inline error and does not navigate when generation fails', async () => {
    const user = userEvent.setup({ delay: null });
    // Matches what the backend actually returns since the provider layer landed:
    // vendor-neutral, and pointing at the setup flow rather than one vendor's key.
    mockGenerate.mockRejectedValue({ response: { data: { detail: 'No AI provider is set up yet. Add one in Settings -> AI Providers to generate questions.' } } });
    renderPage();
    await waitFor(() => expect(screen.getByText('Behavioral')).toBeInTheDocument());
    await user.click(screen.getByText('Behavioral'));
    await waitFor(() => expect(screen.getByRole('button', { name: /generate/i })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /generate/i }));
    await waitFor(() => expect(screen.getByText(/Settings -> AI Providers/i)).toBeInTheDocument());
    expect(screen.queryByText('Record Page')).not.toBeInTheDocument();
  });

  it('links to the existing recordings library', async () => {
    const user = userEvent.setup({ delay: null });
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: /view all recordings/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /view all recordings/i }));
    await waitFor(() => expect(screen.getByText('Recordings Library')).toBeInTheDocument());
  });

  it('editing a question through the dialog updates its displayed text and does not navigate to record', async () => {
    const user = userEvent.setup({ delay: null });
    mockUpdate.mockResolvedValue({ id: 1, round_type: 'behavioral', question_text: 'Tell me about a big mistake.', category: 'Accountability', is_ai_generated: false, created_at: '' });
    renderPage();
    await waitFor(() => expect(screen.getByText('Behavioral')).toBeInTheDocument());
    await user.click(screen.getByText('Behavioral'));
    await waitFor(() => expect(screen.getByText('Tell me about a mistake.')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /^edit tell me about a mistake\.$/i }));
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
    await waitFor(() => expect(screen.getByText('Tell me about a big mistake.')).toBeInTheDocument());
    expect(screen.queryByText('Record Page')).not.toBeInTheDocument();
  });

  it('deleting a question removes its card from the list without navigating', async () => {
    const user = userEvent.setup({ delay: null });
    mockDelete.mockResolvedValue({ status: 'success', deleted_id: 1 });
    renderPage();
    await waitFor(() => expect(screen.getByText('Behavioral')).toBeInTheDocument());
    await user.click(screen.getByText('Behavioral'));
    await waitFor(() => expect(screen.getByText('Tell me about a mistake.')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /^delete tell me about a mistake\.$/i }));

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith(1));
    await waitFor(() => expect(screen.queryByText('Tell me about a mistake.')).not.toBeInTheDocument());
    expect(screen.queryByText('Record Page')).not.toBeInTheDocument();
  });

  it('opens the import modal and refreshes the question list on successful import', async () => {
    const user = userEvent.setup({ delay: null });
    mockImport.mockResolvedValue({ imported_count: 1, skipped_count: 0, errors: [] });
    renderPage();
    await waitFor(() => expect(screen.getByText('Behavioral')).toBeInTheDocument());
    await user.click(screen.getByText('Behavioral'));
    await waitFor(() => expect(screen.getByRole('button', { name: /import questions/i })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /import questions/i }));
    await waitFor(() => expect(screen.getByPlaceholderText(/One question per line/i)).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText(/One question per line/i), 'A new question.');
    const getQuestionsCallsBefore = mockGetQuestions.mock.calls.length;
    await user.click(screen.getByRole('button', { name: /^import$/i }));

    await waitFor(() => expect(mockGetQuestions.mock.calls.length).toBeGreaterThan(getQuestionsCallsBefore));
  });
});
