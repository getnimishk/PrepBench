import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InterviewQuestionImportModal } from './InterviewQuestionImportModal';

// userEvent.setup({ delay: null }) throughout: these tests type multi-word
// strings, and the default per-keystroke await makes each character its own
// async tick plus a React re-render. Dropping the artificial pacing shaves
// real time off the run; the key events themselves are still dispatched.
// (It is not on its own what fixed this file's intermittent timeouts -- the
// suite-wide testTimeout in vite.config.ts is. See the note there.)

const mockImport = vi.fn();

vi.mock('../../services/api', () => ({
  importInterviewQuestions: (...args: any[]) => mockImport(...args),
}));

const roundTypes: { value: 'hr_screening' | 'behavioral'; label: string }[] = [
  { value: 'hr_screening', label: 'HR Screening' },
  { value: 'behavioral', label: 'Behavioral' },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('InterviewQuestionImportModal', () => {
  it('paste-text import shows the success count', async () => {
    const user = userEvent.setup({ delay: null });
    const onSuccess = vi.fn();
    mockImport.mockResolvedValue({ imported_count: 2, skipped_count: 0, errors: [] });

    render(
      <InterviewQuestionImportModal
        open={true}
        onClose={vi.fn()}
        onSuccess={onSuccess}
        roundTypes={roundTypes}
        defaultRoundType="behavioral"
      />
    );

    await user.type(screen.getByPlaceholderText(/One question per line/i), 'Question one.\nQuestion two.');
    await user.click(screen.getByRole('button', { name: /^import$/i }));

    await waitFor(() => expect(screen.getByText(/Imported 2 questions/i)).toBeInTheDocument());
    expect(onSuccess).toHaveBeenCalled();
    expect(mockImport).toHaveBeenCalledWith(expect.objectContaining({
      defaultRoundType: 'behavioral',
      text: 'Question one.\nQuestion two.',
    }));
  });

  it('shows skipped rows and error details, not hidden', async () => {
    const user = userEvent.setup({ delay: null });
    mockImport.mockResolvedValue({
      imported_count: 1,
      skipped_count: 2,
      errors: ['Row 2: empty question text, skipped.', "Row 3: unrecognized round_type 'xyz', skipped."],
    });

    render(
      <InterviewQuestionImportModal
        open={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        roundTypes={roundTypes}
        defaultRoundType="behavioral"
      />
    );

    await user.type(screen.getByPlaceholderText(/One question per line/i), 'Something');
    await user.click(screen.getByRole('button', { name: /^import$/i }));

    await waitFor(() => expect(screen.getByText(/Imported 1 question, skipped 2/i)).toBeInTheDocument());
    expect(screen.getByText(/empty question text/i)).toBeInTheDocument();
    expect(screen.getByText(/unrecognized round_type/i)).toBeInTheDocument();
  });

  it('shows an inline error and does not call onSuccess when the import request fails', async () => {
    const user = userEvent.setup({ delay: null });
    const onSuccess = vi.fn();
    mockImport.mockRejectedValue({ response: { data: { detail: 'Failed to import questions. Please check backend connection.' } } });

    render(
      <InterviewQuestionImportModal
        open={true}
        onClose={vi.fn()}
        onSuccess={onSuccess}
        roundTypes={roundTypes}
        defaultRoundType="behavioral"
      />
    );

    await user.type(screen.getByPlaceholderText(/One question per line/i), 'Something');
    await user.click(screen.getByRole('button', { name: /^import$/i }));

    await waitFor(() => expect(screen.getByText(/Failed to import questions/i)).toBeInTheDocument());
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('switching to the file tab and selecting a file enables Import without pasted text', async () => {
    const user = userEvent.setup({ delay: null });
    mockImport.mockResolvedValue({ imported_count: 1, skipped_count: 0, errors: [] });

    render(
      <InterviewQuestionImportModal
        open={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        roundTypes={roundTypes}
        defaultRoundType="hr_screening"
      />
    );

    await user.click(screen.getByRole('tab', { name: /upload file/i }));
    expect(screen.getByRole('button', { name: /^import$/i })).toBeDisabled();

    const file = new File(['[]'], 'questions.json', { type: 'application/json' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    expect(screen.getByRole('button', { name: /^import$/i })).not.toBeDisabled();
    await user.click(screen.getByRole('button', { name: /^import$/i }));

    await waitFor(() => expect(mockImport).toHaveBeenCalledWith(expect.objectContaining({
      defaultRoundType: 'hr_screening',
      file,
    })));
  });
});
