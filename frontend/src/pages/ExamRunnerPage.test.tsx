// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ExamRunnerPage } from './ExamRunnerPage';
import { ExamDetail } from '../types/exam';

// QuestionView's internal MUI radio/checkbox rendering isn't what these tests
// are targeting -- the bugs being guarded against live in ExamRunnerPage's own
// state derivation (paletteAnswers, the finish-confirm flow), not in how an
// option gets visually selected. A minimal fake keeps the tests focused and
// avoids fragile deep-DOM interaction with MUI form controls.
vi.mock('../components/exam/QuestionView', () => ({
  QuestionView: ({ question, onSelectOption }: any) => (
    <div>
      <div>Question: {question.text}</div>
      {question.options.map((opt: any) => (
        <button key={opt.id} onClick={() => onSelectOption([opt.id])}>
          Select {opt.option_text}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('../components/exam/ExplanationDrawer', () => ({
  ExplanationDrawer: () => <div>Explanation</div>,
}));

vi.mock('../components/exam/ExamTimer', () => ({
  ExamTimer: () => <div>Timer</div>,
}));

const mockGetExamDetails = vi.fn();
const mockSaveExamAnswer = vi.fn();
const mockFinishExam = vi.fn();

vi.mock('../services/api', () => ({
  getExamDetails: (...args: any[]) => mockGetExamDetails(...args),
  saveExamAnswer: (...args: any[]) => mockSaveExamAnswer(...args),
  finishExam: (...args: any[]) => mockFinishExam(...args),
}));

function makeExamDetail(): ExamDetail {
  const questions = [1, 2].map((n) => ({
    id: n,
    text: `Question ${n}`,
    question_type: 'single_choice' as const,
    difficulty: 'medium' as const,
    domain: 'Test Domain',
    topic: 'Test Topic',
    certification: 'Test Cert',
    tags: [],
    created_at: '',
    updated_at: '',
    is_reviewed: false,
    options: [
      { id: n * 10 + 1, option_text: 'Option A', is_correct: true },
      { id: n * 10 + 2, option_text: 'Option B', is_correct: false },
    ],
  }));

  return {
    id: 1,
    title: 'Test Exam',
    exam_mode: 'practice',
    status: 'in_progress',
    total_questions: 2,
    answered_questions: 0,
    correct_count: 0,
    passing_percentage: 70,
    time_spent_seconds: 0,
    current_question_index: 0,
    question_ids_order: [1, 2],
    start_time: new Date().toISOString(),
    answers: [], // Nothing answered yet at load time -- both bugs this session
                 // hinged on stale data derived from this snapshot.
    questions,
  };
}

function renderExamRunner() {
  return render(
    <MemoryRouter initialEntries={['/exam/1']}>
      <Routes>
        <Route path="/exam/:sessionId" element={<ExamRunnerPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetExamDetails.mockResolvedValue(makeExamDetail());
  mockSaveExamAnswer.mockResolvedValue({});
  mockFinishExam.mockResolvedValue({});
});

describe('ExamRunnerPage question palette', () => {
  it('marks a question answered in the palette immediately after selecting an option, even though it was unanswered in the initial snapshot', async () => {
    // Regression test: paletteAnswers used to be derived by mapping over
    // examDetail.answers (the snapshot from initial load), so a question
    // answered for the first time during the session -- never present in
    // that snapshot -- never showed up as "answered" in the navigator.
    const user = userEvent.setup();
    renderExamRunner();

    await waitFor(() => expect(screen.getByText('Question: Question 1')).toBeInTheDocument());

    // Palette button for question 1 should start unanswered.
    expect(screen.getByRole('button', { name: /Question 1, unanswered/i })).toBeInTheDocument();

    await user.click(screen.getByText('Select Option A'));

    // Selecting an option only updates local state -- persistAnswer (and the
    // answeredMap it feeds) fires on navigation, matching the app's real
    // auto-save-on-navigate design. Navigate to question 2 to trigger it.
    await user.click(screen.getByRole('button', { name: /Question 2,/i }));

    await waitFor(() => {
      expect(mockSaveExamAnswer).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ question_id: 1, selected_option_ids: [11] })
      );
    });

    // The palette must now report question 1 as answered.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Question 1, answered/i })).toBeInTheDocument();
    });
  });
});

describe('ExamRunnerPage finish confirmation', () => {
  it('persists the current answer before showing the finish-confirm dialog, so the unanswered count is accurate', async () => {
    // Regression test: clicking "Submit & Finish" on the last question used to
    // call setConfirmFinish(true) directly without persisting the
    // just-selected answer first, so the confirmation dialog's "answered"
    // count was stale by one and incorrectly warned about an unanswered
    // question that had, in fact, just been answered.
    const user = userEvent.setup();
    renderExamRunner();

    await waitFor(() => expect(screen.getByText('Question: Question 1')).toBeInTheDocument());

    // Move to the last question without answering the first (navigation
    // itself persists an empty answer for Q1, which is correct/expected).
    await user.click(screen.getByRole('button', { name: /Question 2,/i }));
    await waitFor(() => expect(screen.getByText('Question: Question 2')).toBeInTheDocument());

    await user.click(screen.getByText('Select Option A'));

    await user.click(screen.getByRole('button', { name: /submit & finish/i }));

    await waitFor(() => {
      expect(screen.getByText(/finish & submit exam/i)).toBeInTheDocument();
    });

    // The just-answered last question must be reflected in the dialog's count
    // -- only question 1 (genuinely skipped) should be unanswered.
    expect(screen.getByText(/you have answered 1 of 2 questions/i)).toBeInTheDocument();
    expect(screen.getByText(/1 unanswered/i)).toBeInTheDocument();

    // And crucially: saveExamAnswer must have been called for question 2's
    // real selection *before* the dialog appeared, not just as a side effect
    // of confirming.
    expect(mockSaveExamAnswer).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ question_id: 2, selected_option_ids: [21] })
    );
  });
});

describe('ExamRunnerPage unsaved-work guard', () => {
  // Dispatch a fresh beforeunload and report whether the guard cancelled it.
  //
  // Fresh every time on purpose: a cancelled event stays cancelled, so reusing
  // one across polls would make the second attempt pass without the guard
  // doing anything.
  const guardCancels = () => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  };

  // The guard arms on examDetail.status, which loads separately from the
  // question text -- so waiting for the question proves the page rendered, not
  // that the listener is attached. Asserting straight after that wait is a
  // race, and it lost on a busy CI runner.
  const expectGuardArmed = () => waitFor(() => expect(guardCancels()).toBe(true));

  it('warns before the tab is closed mid-exam', async () => {
    // Answers persist on navigation, so only the question currently on screen
    // is unsaved -- and there is no way to recover it once the tab is gone.
    renderExamRunner();
    await waitFor(() => expect(screen.getByText('Question: Question 1')).toBeInTheDocument());

    await expectGuardArmed();
  });

  it('stops warning once the exam has been submitted', async () => {
    const user = userEvent.setup();
    renderExamRunner();
    await waitFor(() => expect(screen.getByText('Question: Question 1')).toBeInTheDocument());

    // Establish that it warns BEFORE submitting. Without this the test passes
    // on a page whose guard never armed at all -- "stops warning" is only
    // meaningful once there is a warning to stop.
    await expectGuardArmed();

    await user.click(screen.getByRole('button', { name: /Question 2,/i }));
    await user.click(screen.getByText('Select Option A'));
    await user.click(screen.getByRole('button', { name: /submit & finish/i }));
    await waitFor(() => expect(screen.getByText(/finish & submit exam/i)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /yes, submit/i }));

    await waitFor(() => expect(mockFinishExam).toHaveBeenCalled());

    // Leaving after submitting is the expected outcome, not lost work.
    await waitFor(() => expect(guardCancels()).toBe(false));
  });
});
