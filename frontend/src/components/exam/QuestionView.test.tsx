// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuestionView } from './QuestionView';
import { Question } from '../../types/question';

const QUESTION: Question = {
  id: 1,
  text: 'When can a Sprint be cancelled before its timebox is over?',
  question_type: 'single_choice',
  difficulty: 'hard',
  domain: 'Understanding and Applying the Scrum Framework',
  topic: 'Sprint Cancellation: PO authority and obsolescence condition',
  certification: 'PSM I',
  tags: [],
  created_at: '',
  updated_at: '',
  is_reviewed: false,
  options: [
    { id: 11, option_text: 'Only the Product Owner has the authority', is_correct: true },
    { id: 12, option_text: 'The Scrum Master decides', is_correct: false },
  ],
};

function renderView(props: Partial<React.ComponentProps<typeof QuestionView>> = {}) {
  return render(
    <QuestionView
      question={QUESTION}
      selectedOptionIds={[]}
      onSelectOption={vi.fn()}
      confidenceLevel="not_set"
      onChangeConfidence={vi.fn()}
      {...props}
    />
  );
}

describe('QuestionView', () => {
  /**
   * The reason this is a test and not a preference.
   *
   * Readiness is computed from mock scores. A topic in this bank reads
   * "Sprint Cancellation: PO authority and obsolescence condition" -- the
   * answer, printed above the question. Every point that cue is worth is a
   * point the real exam will not award, so the cue does not merely flatter a
   * screen: it moves the verdict the whole product exists to state.
   */
  it('tells the learner nothing about the question before they answer it', () => {
    renderView();

    expect(screen.getByText(QUESTION.text)).toBeInTheDocument();
    expect(screen.queryByText(QUESTION.topic!)).not.toBeInTheDocument();
    expect(screen.queryByText(QUESTION.domain)).not.toBeInTheDocument();
    expect(screen.queryByText(/hard/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/how sure were you/i)).not.toBeInTheDocument();
  });

  it('shows where the question sat once the answer is behind you', () => {
    renderView({ revealed: true });

    expect(screen.getByText(QUESTION.topic!)).toBeInTheDocument();
    expect(screen.getByText(QUESTION.domain)).toBeInTheDocument();
    expect(screen.getByText(/how sure were you/i)).toBeInTheDocument();
  });

  // Bookmark was read by nothing -- no surface anywhere lists what you saved.
  // Flag lives in the runner's head now, beside Back and Next.
  it('offers no bookmark', () => {
    renderView();

    expect(screen.queryByText('Bookmark')).not.toBeInTheDocument();
  });

  // The radio announced its `value` -- the option's database id -- so a screen
  // reader read out "11" where the answer should have been.
  it('names its controls after what they do, not after their database ids', () => {
    renderView();

    expect(
      screen.getByRole('radio', { name: 'Only the Product Owner has the authority' })
    ).toBeInTheDocument();
  });

  it('picks an option by clicking anywhere on it, and marks the picked one', async () => {
    const onSelectOption = vi.fn();
    const { rerender } = renderView({ onSelectOption });

    await userEvent.click(screen.getByText('The Scrum Master decides'));
    expect(onSelectOption).toHaveBeenCalledWith([12]);

    rerender(
      <QuestionView
        question={QUESTION}
        selectedOptionIds={[12]}
        onSelectOption={onSelectOption}
        confidenceLevel="not_set"
        onChangeConfidence={vi.fn()}
      />
    );
    expect(screen.getByRole('radio', { name: 'The Scrum Master decides' })).toBeChecked();
  });

  it('once revealed, marks the right answer and a wrong pick, and the answer can no longer change', async () => {
    const onSelectOption = vi.fn();
    renderView({ revealed: true, selectedOptionIds: [12], onSelectOption });

    expect(screen.getByText('Correct')).toBeInTheDocument();
    expect(screen.getByText('Your answer')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Only the Product Owner has the authority' })).toBeDisabled();

    await userEvent.click(screen.getByText('Only the Product Owner has the authority'));
    expect(onSelectOption).not.toHaveBeenCalled();
  });

  it('still says when more than one option is expected', () => {
    renderView({ question: { ...QUESTION, question_type: 'multiple_choice' } });
    expect(screen.getByText('Choose all that apply')).toBeInTheDocument();
  });

  it('reports confidence once it is on screen', async () => {
    const onChangeConfidence = vi.fn();
    renderView({ revealed: true, onChangeConfidence });

    await userEvent.click(screen.getByRole('button', { name: 'High' }));
    expect(onChangeConfidence).toHaveBeenCalledWith('high');
  });
});
