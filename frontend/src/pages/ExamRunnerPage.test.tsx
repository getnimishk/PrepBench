// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ExamRunnerPage } from './ExamRunnerPage';
import { ExamDetail } from '../types/exam';
import { connection } from '../services/connection';

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
  // The runner reads Settings for the five-minute audio alert. A failed read
  // is deliberately not fatal, so the default here is the failure path.
  getSettings: () => Promise.resolve({ timer_sound_enabled: false }),
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
    session_kind: 'drill',
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

/** A mock: timed, and finished from the head at any question. */
const timedPaper = () => ({ ...makeExamDetail(), exam_mode: 'timed' as const, session_kind: 'mock' as const });

/** The palette is folded away behind "Questions", as in the prototype. */
const openPalette = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Questions' }));
};

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
    await openPalette(user);

    // Palette button for question 1 should start unanswered.
    expect(screen.getByRole('button', { name: /Question 1, unanswered/i })).toBeInTheDocument();

    await user.click(screen.getByText('Select Option A'));

    // Navigating saves at once (a pick is also autosaved shortly after, which
    // has its own test below). Navigate to question 2 to trigger it.
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
    mockGetExamDetails.mockResolvedValue(timedPaper());
    renderExamRunner();

    await waitFor(() => expect(screen.getByText('Question: Question 1')).toBeInTheDocument());
    await openPalette(user);

    // Move to the last question without answering the first (navigation
    // itself persists an empty answer for Q1, which is correct/expected).
    await user.click(screen.getByRole('button', { name: /Question 2,/i }));
    await waitFor(() => expect(screen.getByText('Question: Question 2')).toBeInTheDocument());

    await user.click(screen.getByText('Select Option A'));

    await user.click(screen.getByRole('button', { name: 'Finish' }));

    await waitFor(() => {
      expect(screen.getByText(/submit this paper/i)).toBeInTheDocument();
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
    mockGetExamDetails.mockResolvedValue(timedPaper());
    renderExamRunner();
    await waitFor(() => expect(screen.getByText('Question: Question 1')).toBeInTheDocument());

    // Establish that it warns BEFORE submitting. Without this the test passes
    // on a page whose guard never armed at all -- "stops warning" is only
    // meaningful once there is a warning to stop.
    await expectGuardArmed();

    await openPalette(user);
    await user.click(screen.getByRole('button', { name: /Question 2,/i }));
    await user.click(screen.getByText('Select Option A'));
    await user.click(screen.getByRole('button', { name: 'Finish' }));
    await waitFor(() => expect(screen.getByText(/submit this paper/i)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /yes, submit/i }));

    await waitFor(() => expect(mockFinishExam).toHaveBeenCalled());

    // Leaving after submitting is the expected outcome, not lost work.
    await waitFor(() => expect(guardCancels()).toBe(false));
  });
});

describe('ExamRunnerPage resume and autosave', () => {
  it('resumes at the question the learner was on, not question one', async () => {
    mockGetExamDetails.mockResolvedValue({ ...makeExamDetail(), current_question_index: 1 });
    renderExamRunner();

    expect(await screen.findByText('Question: Question 2')).toBeInTheDocument();
  });

  it('saves a picked option without waiting for navigation, with the position', async () => {
    const user = userEvent.setup();
    renderExamRunner();
    await screen.findByText('Question: Question 1');

    await user.click(screen.getByText('Select Option B'));

    await waitFor(() => expect(mockSaveExamAnswer).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ question_id: 1, selected_option_ids: [12], current_question_index: 0 }),
    ), { timeout: 2000 });
  });

  it('records where navigation is going, so a reload lands there', async () => {
    const user = userEvent.setup();
    renderExamRunner();
    await screen.findByText('Question: Question 1');

    await openPalette(user);
    await user.click(screen.getByRole('button', { name: /Question 2,/i }));

    await waitFor(() => expect(mockSaveExamAnswer).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ question_id: 1, current_question_index: 1 }),
    ));
  });

  it('submits the paper when a save is refused because the time has run out', async () => {
    const user = userEvent.setup();
    mockGetExamDetails.mockResolvedValue({
      ...makeExamDetail(),
      exam_mode: 'timed',
      session_kind: 'mock',
      time_allowed_seconds: 60,
      start_time: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    });
    mockSaveExamAnswer.mockRejectedValue(new Error('Time is up'));
    renderExamRunner();
    await screen.findByText('Question: Question 1');

    await openPalette(user);
    await user.click(screen.getByRole('button', { name: /Question 2,/i }));

    await waitFor(() => expect(mockFinishExam).toHaveBeenCalledWith(1));
    expect(await screen.findByText(/Time is Up/i)).toBeInTheDocument();
  });

  it('names flagged questions before submitting', async () => {
    const user = userEvent.setup();
    renderExamRunner();
    await screen.findByText('Question: Question 1');

    await user.click(screen.getByRole('button', { name: 'Flag' }));
    expect(screen.getByRole('button', { name: 'Flagged' })).toHaveAttribute('aria-pressed', 'true');
    await openPalette(user);
    await user.click(screen.getByRole('button', { name: /Question 2,/i }));
    await user.click(await screen.findByRole('button', { name: 'Finish' }));

    expect(await screen.findByText(/1 flagged for another look/)).toBeInTheDocument();
  });
});


describe('ExamRunnerPage keyboard shortcuts', () => {
  const timed = () => ({ ...makeExamDetail(), exam_mode: 'timed' as const, session_kind: 'mock' as const });

  it('chooses an answer by its number, flags with F, and moves on with the arrow', async () => {
    const user = userEvent.setup();
    mockGetExamDetails.mockResolvedValue(timed());
    renderExamRunner();
    await screen.findByText('Question: Question 1');

    await user.keyboard('2');
    await waitFor(() => expect(mockSaveExamAnswer).toHaveBeenCalledWith(
      1, expect.objectContaining({ question_id: 1, selected_option_ids: [12] }),
    ), { timeout: 2000 });

    await user.keyboard('f');
    expect(await screen.findByRole('button', { name: 'Flagged' })).toBeInTheDocument();

    await user.keyboard('{ArrowRight}');
    expect(await screen.findByText('Question: Question 2')).toBeInTheDocument();

    await user.keyboard('{ArrowLeft}');
    expect(await screen.findByText('Question: Question 1')).toBeInTheDocument();
  });

  it('never submits the paper from the keyboard', async () => {
    const user = userEvent.setup();
    mockGetExamDetails.mockResolvedValue({ ...timed(), current_question_index: 1 });
    renderExamRunner();
    await screen.findByText('Question: Question 2');

    await user.keyboard('1');
    await user.keyboard('{ArrowRight}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockFinishExam).not.toHaveBeenCalled();
  });

  it('does not move on from an unanswered question in a timed paper', async () => {
    const user = userEvent.setup();
    mockGetExamDetails.mockResolvedValue(timed());
    renderExamRunner();
    await screen.findByText('Question: Question 1');

    await user.keyboard('{ArrowRight}');

    expect(screen.getByText('Question: Question 1')).toBeInTheDocument();
  });
});

describe('ExamRunnerPage while the server cannot be reached', () => {
  const UNREACHABLE = { isAxiosError: true, request: {} };
  const KEY = 'prepbench.draft.exam:1';
  const kept = () => JSON.parse(localStorage.getItem(KEY) ?? 'null')?.value ?? null;

  beforeEach(() => {
    connection.report('online');
  });

  it('keeps a picked answer on the device, never undoes it, and sends it when the server answers', async () => {
    const user = userEvent.setup();
    mockSaveExamAnswer.mockRejectedValue(UNREACHABLE);
    renderExamRunner();
    await screen.findByText('Question: Question 1');

    await user.click(screen.getByRole('button', { name: 'Select Option A' }));
    connection.report('unreachable');

    expect(await screen.findByText('Saved on this device · 1 answer not on the server yet', {}, { timeout: 3000 })).toBeInTheDocument();
    await openPalette(user);
    expect(screen.getByRole('button', { name: /Question 1, answered/ })).toBeInTheDocument();
    expect(kept()).toEqual([expect.objectContaining({ question_id: 1, selected_option_ids: [11] })]);

    mockSaveExamAnswer.mockReset().mockResolvedValue({});
    act(() => connection.report('online'));

    expect(await screen.findByText('Saved · every answer is on the server')).toBeInTheDocument();
    expect(mockSaveExamAnswer).toHaveBeenCalledWith(1, expect.objectContaining({ question_id: 1, selected_option_ids: [11] }));
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('will not submit the paper while answers are only on this device', async () => {
    const user = userEvent.setup();
    mockSaveExamAnswer.mockRejectedValue(UNREACHABLE);
    renderExamRunner();
    await screen.findByText('Question: Question 1');

    await user.click(screen.getByRole('button', { name: 'Select Option A' }));
    await openPalette(user);
    await user.click(screen.getByRole('button', { name: /Question 2,/ }));
    await user.click(await screen.findByRole('button', { name: 'Finish' }));
    await user.click(await screen.findByRole('button', { name: 'Yes, submit' }));

    expect(await screen.findByText(/1 answer is kept on this device but not on the server yet, so the paper was not submitted/)).toBeInTheDocument();
    expect(mockFinishExam).not.toHaveBeenCalled();
  });

  it('restores answers kept on the device when the paper is reopened, and sends them', async () => {
    localStorage.setItem(KEY, JSON.stringify({
      savedAt: new Date().toISOString(),
      value: [{
        question_id: 2, selected_option_ids: [22], time_spent_seconds: 9, confidence_level: 'not_set',
        is_flagged: true, is_bookmarked: false, current_question_index: 1,
      }],
    }));
    const user = userEvent.setup();
    renderExamRunner();

    // Back where the learner was, with the kept pick on screen.
    expect(await screen.findByText('Question: Question 2')).toBeInTheDocument();
    await openPalette(user);
    expect(screen.getByRole('button', { name: /Question 2, answered, flagged/ })).toBeInTheDocument();
    await waitFor(() => expect(mockSaveExamAnswer).toHaveBeenCalledWith(
      1, expect.objectContaining({ question_id: 2, selected_option_ids: [22], is_flagged: true }),
    ));
    expect(await screen.findByText('Saved · every answer is on the server')).toBeInTheDocument();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('does not sit a submitted paper again: no clock, no time-up, no writes', async () => {
    // A finished paper opened here used to draw its clock at zero, which "ran
    // out" on arrival and sent a save and a finish for a closed session.
    mockGetExamDetails.mockResolvedValue({
      ...makeExamDetail(), status: 'completed', exam_mode: 'timed', time_allowed_seconds: 600,
      start_time: '2026-01-01T00:00:00',
    });
    renderExamRunner();

    expect(await screen.findByRole('heading', { name: 'This paper has been submitted' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See the results' })).toHaveAttribute('href', '/exam-review/1');
    expect(screen.queryByText('Time is up')).not.toBeInTheDocument();
    expect(mockSaveExamAnswer).not.toHaveBeenCalled();
    expect(mockFinishExam).not.toHaveBeenCalled();
  });

  it('says when kept answers can no longer be added, because the paper was submitted', async () => {
    localStorage.setItem(KEY, JSON.stringify({
      savedAt: new Date().toISOString(),
      value: [{
        question_id: 1, selected_option_ids: [11], time_spent_seconds: 4, confidence_level: 'not_set',
        is_flagged: false, is_bookmarked: false, current_question_index: 0,
      }],
    }));
    mockGetExamDetails.mockResolvedValue({ ...makeExamDetail(), status: 'completed' });
    renderExamRunner();

    expect(await screen.findByText('1 answer kept on this device could not be added: this paper had already been submitted.')).toBeInTheDocument();
    expect(mockSaveExamAnswer).not.toHaveBeenCalled();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('says which kept answers the server refused when it came back', async () => {
    const user = userEvent.setup();
    mockGetExamDetails.mockResolvedValue({
      ...makeExamDetail(),
      exam_mode: 'timed',
      session_kind: 'mock',
      time_allowed_seconds: 600,
    });
    mockSaveExamAnswer.mockRejectedValue(UNREACHABLE);
    renderExamRunner();
    await screen.findByText('Question: Question 1');
    await user.click(screen.getByRole('button', { name: 'Select Option A' }));
    await screen.findByText('Saved on this device · 1 answer not on the server yet', {}, { timeout: 3000 });

    // The server is back, and refuses what it is sent.
    mockSaveExamAnswer.mockReset().mockRejectedValue({
      isAxiosError: true, response: { status: 400, data: { detail: 'Time is up for this exam.' } },
    });
    connection.report('unreachable');
    act(() => connection.report('online'));

    expect(await screen.findByText(/One answer picked while the server could not be reached was not recorded\. Time is up for this exam\./)).toBeInTheDocument();
  });
});

describe('ExamRunnerPage practice flow', () => {
  it('checks an answer before moving on, then moves on', async () => {
    const user = userEvent.setup();
    renderExamRunner();
    await screen.findByText('Question: Question 1');

    // Nothing picked: the main button skips.
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();

    await user.click(screen.getByText('Select Option A'));
    await user.click(screen.getByRole('button', { name: 'Check answer' }));
    expect(await screen.findByText('Explanation')).toBeInTheDocument();
    expect(screen.getByText('Question: Question 1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Question: Question 2')).toBeInTheDocument();
  });

  it('saves the answer on screen before Save & exit leaves', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/exam/1']}>
        <Routes>
          <Route path="/exam/:sessionId" element={<ExamRunnerPage />} />
          <Route path="/practice" element={<div>Practice hub</div>} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText('Question: Question 1');

    await user.click(screen.getByText('Select Option B'));
    await user.click(screen.getByRole('button', { name: 'Save & exit' }));

    expect(await screen.findByText('Practice hub')).toBeInTheDocument();
    expect(mockSaveExamAnswer).toHaveBeenCalledWith(1, expect.objectContaining({ question_id: 1, selected_option_ids: [12] }));
  });

  it('offers no Save & exit on a timed paper, whose clock does not stop', async () => {
    mockGetExamDetails.mockResolvedValue(timedPaper());
    renderExamRunner();
    await screen.findByText('Question: Question 1');

    expect(screen.queryByRole('button', { name: 'Save & exit' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finish' })).toBeInTheDocument();
    expect(screen.getByText('0 answered · 0 flagged · 2 remaining')).toBeInTheDocument();
  });
});
