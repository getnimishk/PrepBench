// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { InterviewLibraryPage } from './InterviewLibraryPage';

const mockRounds = vi.fn();
const mockQuestions = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockImport = vi.fn();

vi.mock('../services/api', () => ({
  getInterviewRoundTypes: (...a: any[]) => mockRounds(...a),
  getInterviewQuestions: (...a: any[]) => mockQuestions(...a),
  updateInterviewQuestion: (...a: any[]) => mockUpdate(...a),
  deleteInterviewQuestion: (...a: any[]) => mockDelete(...a),
  importInterviewQuestions: (...a: any[]) => mockImport(...a),
}));

const q = (id: number, round: string, text: string, practice_count = 0, category = 'Leadership') => ({
  id, round_type: round, question_text: text, category, is_ai_generated: false, created_at: '', practice_count,
});

const renderLibrary = () =>
  render(
    <MemoryRouter initialEntries={['/interview-practice/library']}>
      <Routes>
        <Route path="/interview-practice/library" element={<InterviewLibraryPage />} />
        <Route path="/interview-practice/:questionId/record" element={<div>Record Page</div>} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockRounds.mockResolvedValue([
    { value: 'behavioral', label: 'Behavioral' },
    { value: 'system_design', label: 'System Design' },
  ]);
  mockQuestions.mockResolvedValue({
    items: [q(1, 'behavioral', 'Tell me about a mistake.', 2), q(2, 'system_design', 'Design a URL shortener.')],
    total: 2, skip: 0, limit: 500,
  });
});

describe('InterviewLibraryPage', () => {
  it('lists every question by round, with how often each has been answered', async () => {
    const user = userEvent.setup({ delay: null });
    renderLibrary();

    expect(await screen.findByText('Tell me about a mistake.')).toBeInTheDocument();
    expect(screen.getByText(/Behavioral · Leadership · answered 2×/)).toBeInTheDocument();
    expect(screen.getByText(/System Design · Leadership · never answered/)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'System Design · 1' }));
    expect(screen.queryByText('Tell me about a mistake.')).not.toBeInTheDocument();
    expect(screen.getByText('Design a URL shortener.')).toBeInTheDocument();
  });

  it('practises a question from the list', async () => {
    const user = userEvent.setup({ delay: null });
    renderLibrary();

    const row = (await screen.findByText('Tell me about a mistake.')).closest('div')!.parentElement!;
    await user.click(within(row).getByRole('button', { name: 'Practise' }));
    expect(await screen.findByText('Record Page')).toBeInTheDocument();
  });

  it('edits a question and shows the saved text', async () => {
    const user = userEvent.setup({ delay: null });
    mockUpdate.mockResolvedValue({});
    renderLibrary();

    await user.click(await screen.findByRole('button', { name: 'Edit Tell me about a mistake.' }));
    const text = screen.getByLabelText('Question text');
    await user.clear(text);
    await user.type(text, 'Tell me about a big mistake.');
    mockQuestions.mockResolvedValue({
      items: [q(1, 'behavioral', 'Tell me about a big mistake.', 2)], total: 1, skip: 0, limit: 500,
    });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(1, expect.objectContaining({ question_text: 'Tell me about a big mistake.' })));
    expect(await screen.findByText('Tell me about a big mistake.')).toBeInTheDocument();
  });

  it('saves prepared answer and key talking points during edit and renders indicator', async () => {
    const user = userEvent.setup({ delay: null });
    mockUpdate.mockResolvedValue({});
    renderLibrary();

    await user.click(await screen.findByRole('button', { name: 'Edit Tell me about a mistake.' }));
    const prepInput = screen.getByPlaceholderText(/Situation: .../i);
    await user.type(prepInput, 'My prepared STAR notes');
    const pointsInput = screen.getByPlaceholderText(/Reduced database latency/i);
    await user.type(pointsInput, 'Point A\nPoint B');

    mockQuestions.mockResolvedValue({
      items: [{
        ...q(1, 'behavioral', 'Tell me about a mistake.', 2),
        prepared_answer: 'My prepared STAR notes',
        key_talking_points: ['Point A', 'Point B'],
      }],
      total: 1, skip: 0, limit: 500,
    });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(1, expect.objectContaining({
      prepared_answer: 'My prepared STAR notes',
      key_talking_points: ['Point A', 'Point B'],
    })));
    expect(await screen.findByText('Has prepared answer')).toBeInTheDocument();
  });


  it('deletes only after asking, and says the recordings are kept', async () => {
    const user = userEvent.setup({ delay: null });
    mockDelete.mockResolvedValue({ status: 'success', deleted_id: 1 });
    renderLibrary();

    await user.click(await screen.findByRole('button', { name: 'Delete Tell me about a mistake.' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Answers already recorded to it are\s+kept/)).toBeInTheDocument();
    expect(mockDelete).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith(1));
    await waitFor(() => expect(screen.queryByText('Tell me about a mistake.')).not.toBeInTheDocument());
  });

  it('imports questions and refreshes the list', async () => {
    const user = userEvent.setup({ delay: null });
    mockImport.mockResolvedValue({ imported_count: 1, skipped_count: 0, errors: [] });
    renderLibrary();
    await screen.findByText('Tell me about a mistake.');

    await user.click(screen.getByRole('button', { name: /import questions/i }));
    await user.type(await screen.findByPlaceholderText(/One question per line/i), 'A new question.');
    const before = mockQuestions.mock.calls.length;
    await user.click(screen.getByRole('button', { name: /^import$/i }));

    await waitFor(() => expect(mockQuestions.mock.calls.length).toBeGreaterThan(before));
  });

  it('renders "Opening question" badge for introductory questions', async () => {
    mockQuestions.mockResolvedValue({
      items: [
        q(1, 'behavioral', 'Tell me about yourself.', 0, 'Introduction'),
        q(2, 'behavioral', 'Describe a technical conflict.', 0, 'Teamwork'),
      ],
      total: 2, skip: 0, limit: 500,
    });
    renderLibrary();

    expect(await screen.findByText('Tell me about yourself.')).toBeInTheDocument();
    expect(screen.getByText('Opening question')).toBeInTheDocument();
    expect(screen.getAllByText('Opening question')).toHaveLength(1);
  });

  it('sorts by natural interview flow by default and allows re-sorting', async () => {
    const user = userEvent.setup({ delay: null });
    mockQuestions.mockResolvedValue({
      items: [
        q(1, 'behavioral', 'Why do you want to work here?', 0, 'Motivation & Fit'),
        q(2, 'behavioral', 'Tell me about yourself.', 5, 'Introduction'),
        q(3, 'behavioral', 'Describe a challenging project.', 1, 'Technical Depth'),
      ],
      total: 3, skip: 0, limit: 500,
    });
    renderLibrary();

    await screen.findByText('Tell me about yourself.');

    // Default flow: Introduction (q2) first, even with practice_count=5
    let items = screen.getAllByRole('button', { name: /^Edit / }).map((el) => el.getAttribute('aria-label'));
    expect(items).toEqual([
      'Edit Tell me about yourself.',
      'Edit Why do you want to work here?',
      'Edit Describe a challenging project.',
    ]);

    // Change sort to "Recently added"
    await user.click(screen.getByRole('combobox', { name: /sort by/i }));
    await user.click(screen.getByRole('option', { name: /recently added/i }));

    items = screen.getAllByRole('button', { name: /^Edit / }).map((el) => el.getAttribute('aria-label'));
    expect(items).toEqual([
      'Edit Describe a challenging project.',
      'Edit Tell me about yourself.',
      'Edit Why do you want to work here?',
    ]);

    // Change sort to "Least answered first"
    await user.click(screen.getByRole('combobox', { name: /sort by/i }));
    await user.click(screen.getByRole('option', { name: /least answered first/i }));

    items = screen.getAllByRole('button', { name: /^Edit / }).map((el) => el.getAttribute('aria-label'));
    expect(items).toEqual([
      'Edit Why do you want to work here?',
      'Edit Describe a challenging project.',
      'Edit Tell me about yourself.',
    ]);
  });
});

describe('InterviewLibraryPage when the library cannot be read', () => {
  it('says so, shows no count it does not have, and loads on retry', async () => {
    const user = userEvent.setup();
    mockQuestions.mockRejectedValueOnce({ isAxiosError: true, request: {} });
    renderLibrary();

    expect(await screen.findByText(/Could not load the question library\. Could not reach the PrepBench server\..*Nothing was changed\./)).toBeInTheDocument();
    expect(screen.getByText('Question count unavailable.')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'All' })).toBeInTheDocument();
    expect(screen.queryByText(/· 0/)).not.toBeInTheDocument();
    expect(screen.queryByText(/No questions here yet/)).not.toBeInTheDocument();
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Tell me about a mistake.')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'All · 2' })).toBeInTheDocument();
    expect(screen.getByText('2 questions across 2 rounds.')).toBeInTheDocument();
  });
});
