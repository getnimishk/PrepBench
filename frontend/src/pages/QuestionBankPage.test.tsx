// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuestionBankPage } from './QuestionBankPage';
import { Question } from '../types/question';

const mockGetQuestions = vi.fn();
const mockDeleteQuestion = vi.fn();
const mockCreateQuestion = vi.fn();
const mockUpdateQuestion = vi.fn();
const mockClearAllQuestions = vi.fn();
const mockAutoRefineBatch = vi.fn();
const mockConfirmImportBatch = vi.fn();
const mockBulkDeleteQuestions = vi.fn();
const mockGetQuestionFilters = vi.fn();

vi.mock('../services/api', () => ({
  getQuestions: (...args: any[]) => mockGetQuestions(...args),
  deleteQuestion: (...args: any[]) => mockDeleteQuestion(...args),
  createQuestion: (...args: any[]) => mockCreateQuestion(...args),
  updateQuestion: (...args: any[]) => mockUpdateQuestion(...args),
  clearAllQuestions: (...args: any[]) => mockClearAllQuestions(...args),
  autoRefineBatch: (...args: any[]) => mockAutoRefineBatch(...args),
  confirmImportBatch: (...args: any[]) => mockConfirmImportBatch(...args),
  bulkDeleteQuestions: (...args: any[]) => mockBulkDeleteQuestions(...args),
  getQuestionFilters: (...args: any[]) => mockGetQuestionFilters(...args),
}));

// These child components have their own substantial UI (multi-field forms,
// file upload, research panels) that isn't what these tests target -- the
// bugs guarded against here live in QuestionBankPage's own orchestration
// (fetch params, refetch-after-mutation, bulk/clear confirmation flows), not
// in how a form field renders. Minimal fakes keep the page's own logic
// testable in isolation, matching the pattern used for QuestionView in
// ExamRunnerPage.test.tsx.
vi.mock('../components/question_bank/QuestionTable', () => ({
  QuestionTable: ({ questions, mode, selectedIds, onToggleSelect, onToggleSelectAll, onRowClick, onEdit, onDelete }: any) => (
    <div>
      <div>QuestionTable mode: {mode}</div>
      {mode === 'bank' && <button onClick={() => onToggleSelectAll?.()}>Toggle Select All</button>}
      {questions.map((q: Question) => (
        <div key={q.id}>
          <span role="button" onClick={() => onRowClick(q)}>{q.text}</span>
          {mode === 'bank' && (
            <input
              type="checkbox"
              aria-label={`select-${q.id}`}
              checked={selectedIds?.has(q.id) || false}
              onChange={() => onToggleSelect?.(q.id)}
            />
          )}
          <button onClick={() => onEdit(q)}>Edit: {q.text}</button>
          <button onClick={() => onDelete(q.id)}>Delete: {q.text}</button>
        </div>
      ))}
    </div>
  ),
}));

vi.mock('../components/question_bank/QuestionEditorModal', () => ({
  QuestionEditorModal: ({ open, question, onClose, onSave }: any) =>
    open ? (
      <div>
        <div>Editor Open: {question ? `Editing ${question.text}` : 'New Question'}</div>
        <button onClick={() => onSave({ text: question ? `${question.text} (edited)` : 'Brand New Question' })}>
          Save In Editor
        </button>
        <button onClick={onClose}>Cancel Editor</button>
      </div>
    ) : null,
}));

vi.mock('../components/question_bank/ImportModal', () => ({
  ImportModal: ({ open, onClose, onOpenAuditStudio }: any) =>
    open ? (
      <div>
        <div>Import Modal Open</div>
        <button onClick={onClose}>Close Import</button>
        {/* Simulates a real import validating a file and staging its parsed
            questions for review -- the one path through ImportModal that
            actually reaches QuestionBankPage's Audit Studio branch. A plain
            object literal (not a call out to makeQuestion) because vi.mock
            factories are hoisted above the rest of the module and can only
            safely reference identifiers prefixed with "mock". */}
        <button
          onClick={() =>
            onOpenAuditStudio?.([
              {
                id: 99,
                text: 'Staged Question From Import',
                question_type: 'single_choice',
                difficulty: 'medium',
                domain: 'Security',
                topic: 'IAM',
                certification: 'AWS SAA',
                tags: [],
                created_at: '',
                updated_at: '',
                is_reviewed: false,
                options: [{ id: 991, option_text: 'Option A', is_correct: true }],
              },
            ])
          }
        >
          Simulate Staged Import
        </button>
      </div>
    ) : null,
}));

vi.mock('../components/question_bank/QuestionDetailPanel', () => ({
  QuestionDetailPanel: ({ open, question, onToggleReviewed }: any) =>
    open && question ? (
      <div>
        <div>Detail Panel: {question.text}</div>
        <button onClick={() => onToggleReviewed?.(question)}>Toggle Reviewed</button>
      </div>
    ) : null,
}));

function makeQuestion(id: number, text: string): Question {
  return {
    id,
    text,
    question_type: 'single_choice',
    difficulty: 'medium',
    domain: 'Security',
    topic: 'IAM',
    certification: 'AWS SAA',
    tags: [],
    created_at: '',
    updated_at: '',
    is_reviewed: false,
    options: [
      { id: id * 10 + 1, option_text: 'Option A', is_correct: true },
      { id: id * 10 + 2, option_text: 'Option B', is_correct: false },
    ],
  };
}

function renderPage() {
  return render(<QuestionBankPage />);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetQuestionFilters.mockResolvedValue({
    certifications: ['AWS SAA'],
    domains: ['Security'],
    topics: ['IAM'],
    difficulties: ['easy', 'medium', 'hard'],
  });
});

describe('QuestionBankPage', () => {
  it('fetches and lists questions on mount with default pagination', async () => {
    mockGetQuestions.mockResolvedValue({ items: [makeQuestion(1, 'What is IAM?')], total: 1 });
    renderPage();

    await waitFor(() => expect(screen.getByText('What is IAM?')).toBeInTheDocument());
    expect(mockGetQuestions).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, limit: 25 })
    );
    expect(screen.getByText('1 questions total')).toBeInTheDocument();
  });

  it('shows an empty state when no questions match the filters', async () => {
    mockGetQuestions.mockResolvedValue({ items: [], total: 0 });
    renderPage();
    await waitFor(() => expect(screen.getByText(/No questions match the current filters/i)).toBeInTheDocument());
  });

  it('shows a retry-able error state on fetch failure', async () => {
    const user = userEvent.setup();
    mockGetQuestions.mockRejectedValue(new Error('network error'));
    renderPage();

    await waitFor(() => expect(screen.getByText(/Failed to load questions/i)).toBeInTheDocument());

    mockGetQuestions.mockResolvedValue({ items: [makeQuestion(1, 'What is IAM?')], total: 1 });
    await user.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(screen.getByText('What is IAM?')).toBeInTheDocument());
  });

  it('refetches with the selected domain filter', async () => {
    const user = userEvent.setup();
    mockGetQuestions.mockResolvedValue({ items: [makeQuestion(1, 'What is IAM?')], total: 1 });
    renderPage();
    await waitFor(() => expect(screen.getByText('What is IAM?')).toBeInTheDocument());

    mockGetQuestions.mockClear();
    await user.click(screen.getByRole('combobox', { name: 'Domain' }));
    await user.click(await screen.findByRole('option', { name: 'Security' }));

    await waitFor(() => {
      expect(mockGetQuestions).toHaveBeenCalledWith(expect.objectContaining({ domain: 'Security' }));
    });
  });

  it('creates a new question through the editor and refreshes the list', async () => {
    const user = userEvent.setup();
    mockGetQuestions.mockResolvedValue({ items: [makeQuestion(1, 'What is IAM?')], total: 1 });
    mockCreateQuestion.mockResolvedValue(makeQuestion(2, 'Brand New Question'));
    renderPage();
    await waitFor(() => expect(screen.getByText('What is IAM?')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /create question/i }));
    await waitFor(() => expect(screen.getByText('Editor Open: New Question')).toBeInTheDocument());

    mockGetQuestions.mockResolvedValue({ items: [makeQuestion(1, 'What is IAM?'), makeQuestion(2, 'Brand New Question')], total: 2 });
    await user.click(screen.getByRole('button', { name: /save in editor/i }));

    await waitFor(() => expect(mockCreateQuestion).toHaveBeenCalledWith(expect.objectContaining({ text: 'Brand New Question' })));
    await waitFor(() => expect(screen.getByText('Brand New Question')).toBeInTheDocument());
    expect(screen.queryByText(/Editor Open/i)).not.toBeInTheDocument();
  });

  it('edits an existing question through the row Edit action and refreshes the list', async () => {
    const user = userEvent.setup();
    mockGetQuestions.mockResolvedValue({ items: [makeQuestion(1, 'What is IAM?')], total: 1 });
    mockUpdateQuestion.mockResolvedValue(makeQuestion(1, 'What is IAM? (edited)'));
    renderPage();
    await waitFor(() => expect(screen.getByText('What is IAM?')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Edit: What is IAM?' }));
    await waitFor(() => expect(screen.getByText('Editor Open: Editing What is IAM?')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /save in editor/i }));

    await waitFor(() => {
      expect(mockUpdateQuestion).toHaveBeenCalledWith(1, expect.objectContaining({ text: 'What is IAM? (edited)' }));
    });
  });

  it('deletes a single question via the row Delete action and refreshes the list', async () => {
    const user = userEvent.setup();
    mockGetQuestions.mockResolvedValue({ items: [makeQuestion(1, 'What is IAM?')], total: 1 });
    mockDeleteQuestion.mockResolvedValue({});
    renderPage();
    await waitFor(() => expect(screen.getByText('What is IAM?')).toBeInTheDocument());

    mockGetQuestions.mockResolvedValue({ items: [], total: 0 });
    await user.click(screen.getByRole('button', { name: 'Delete: What is IAM?' }));

    await waitFor(() => expect(mockDeleteQuestion).toHaveBeenCalledWith(1));
    await waitFor(() => expect(screen.getByText(/No questions match the current filters/i)).toBeInTheDocument());
  });

  it('clears the entire question bank after confirmation', async () => {
    const user = userEvent.setup();
    mockGetQuestions.mockResolvedValue({ items: [makeQuestion(1, 'What is IAM?')], total: 1 });
    mockClearAllQuestions.mockResolvedValue({});
    renderPage();
    await waitFor(() => expect(screen.getByText('What is IAM?')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /clear all/i }));
    await waitFor(() => expect(screen.getByText('Clear Question Bank?')).toBeInTheDocument());

    mockGetQuestions.mockResolvedValue({ items: [], total: 0 });
    await user.click(screen.getByRole('button', { name: /yes, delete all/i }));

    await waitFor(() => expect(mockClearAllQuestions).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(/No questions match the current filters/i)).toBeInTheDocument());
  });

  it('bulk-deletes selected questions after confirmation', async () => {
    const user = userEvent.setup();
    mockGetQuestions.mockResolvedValue({
      items: [makeQuestion(1, 'What is IAM?'), makeQuestion(2, 'What is VPC?')],
      total: 2,
    });
    mockBulkDeleteQuestions.mockResolvedValue({});
    renderPage();
    await waitFor(() => expect(screen.getByText('What is IAM?')).toBeInTheDocument());

    await user.click(screen.getByLabelText('select-1'));
    await waitFor(() => expect(screen.getByText('1 selected')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /delete selected/i }));
    await waitFor(() => expect(screen.getByText('Delete Selected Questions?')).toBeInTheDocument());

    mockGetQuestions.mockResolvedValue({ items: [makeQuestion(2, 'What is VPC?')], total: 1 });
    await user.click(screen.getByRole('button', { name: /yes, delete selected/i }));

    await waitFor(() => expect(mockBulkDeleteQuestions).toHaveBeenCalledWith([1]));
  });

  it('opens the Bulk Import modal', async () => {
    const user = userEvent.setup();
    mockGetQuestions.mockResolvedValue({ items: [makeQuestion(1, 'What is IAM?')], total: 1 });
    renderPage();
    await waitFor(() => expect(screen.getByText('What is IAM?')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /bulk import/i }));
    await waitFor(() => expect(screen.getByText('Import Modal Open')).toBeInTheDocument());
  });

  it('opens the detail panel on row click and toggles reviewed status from it', async () => {
    const user = userEvent.setup();
    const question = makeQuestion(1, 'What is IAM?');
    mockGetQuestions.mockResolvedValue({ items: [question], total: 1 });
    mockUpdateQuestion.mockResolvedValue({ ...question, is_reviewed: true });
    renderPage();
    await waitFor(() => expect(screen.getByText('What is IAM?')).toBeInTheDocument());

    await user.click(screen.getByText('What is IAM?'));
    await waitFor(() => expect(screen.getByText('Detail Panel: What is IAM?')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /toggle reviewed/i }));

    await waitFor(() => {
      expect(mockUpdateQuestion).toHaveBeenCalledWith(1, { is_reviewed: true });
    });
  });

  it('imports staged questions through the Audit Studio flow: auto-refine, then commit', async () => {
    const user = userEvent.setup();
    mockGetQuestions.mockResolvedValue({ items: [makeQuestion(1, 'What is IAM?')], total: 1 });
    mockAutoRefineBatch.mockResolvedValue([makeQuestion(99, 'Staged Question From Import (refined)')]);
    mockConfirmImportBatch.mockResolvedValue({});
    renderPage();
    await waitFor(() => expect(screen.getByText('What is IAM?')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /bulk import/i }));
    await waitFor(() => expect(screen.getByText('Import Modal Open')).toBeInTheDocument());

    // Simulates what a real import validate step does: hand staged questions
    // to onOpenAuditStudio. This is the only path that reaches
    // QuestionBankPage's staging/Audit Studio branch at all.
    await user.click(screen.getByRole('button', { name: /simulate staged import/i }));
    await waitFor(() => expect(screen.getByText(/Pre-Import Audit Studio/i)).toBeInTheDocument());
    expect(screen.getByText('Staged Question From Import')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /auto-refine entire batch/i }));
    await waitFor(() => {
      expect(mockAutoRefineBatch).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 99, text: 'Staged Question From Import' })])
      );
    });
    await waitFor(() => expect(screen.getByText('Staged Question From Import (refined)')).toBeInTheDocument());

    mockGetQuestions.mockResolvedValue({
      items: [makeQuestion(1, 'What is IAM?'), makeQuestion(99, 'Staged Question From Import (refined)')],
      total: 2,
    });
    await user.click(screen.getByRole('button', { name: /approve & commit batch/i }));

    await waitFor(() => expect(mockConfirmImportBatch).toHaveBeenCalled());
    // Staging mode exits (back to the normal bank table) once committed.
    await waitFor(() => expect(screen.queryByText(/Pre-Import Audit Studio/i)).not.toBeInTheDocument());
  });

  it('debounces the search field before refetching with the keyword', async () => {
    const user = userEvent.setup();
    mockGetQuestions.mockResolvedValue({ items: [makeQuestion(1, 'What is IAM?')], total: 1 });
    renderPage();
    await waitFor(() => expect(screen.getByText('What is IAM?')).toBeInTheDocument());

    mockGetQuestions.mockClear();
    await user.type(screen.getByPlaceholderText(/search questions/i), 'IAM');

    // Not fired immediately -- the 300ms debounce hasn't elapsed yet.
    expect(mockGetQuestions).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(mockGetQuestions).toHaveBeenCalledWith(expect.objectContaining({ keyword: 'IAM' }));
    });
  });
});
