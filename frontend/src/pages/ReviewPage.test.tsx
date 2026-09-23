// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ReviewPage } from './ReviewPage';
import { ReviewItem } from '../types/review';

const mockQueue = vi.fn();
const mockActivity = vi.fn();
const mockPreparation = vi.fn();
const mockMarkReviewed = vi.fn();
const mockSubmitCheck = vi.fn();

vi.mock('../services/api', () => ({
  getReviewQueue: (...a: any[]) => mockQueue(...a),
  getActivity: (...a: any[]) => mockActivity(...a),
  markAnswerReviewed: (...a: any[]) => mockMarkReviewed(...a),
  submitReviewCheck: (...a: any[]) => mockSubmitCheck(...a),
}));

vi.mock('../context/PreparationContext', () => ({
  usePreparation: () => mockPreparation(),
}));

/** One different question on the same concept. */
const check = () => ({
  question_id: 233,
  question_text: 'True or False: the Definition of Done can be adapted during the Retrospective.',
  is_multiple: false,
  options: [
    { id: 890, text: 'True', is_correct: true },
    { id: 891, text: 'False', is_correct: false },
  ],
});

const item = (over: Partial<ReviewItem> = {}): ReviewItem => ({
  answer_id: 470,
  session_id: 13,
  question_id: 124,
  session_title: 'Timed Exam — PSM I',
  taken_at: '2026-08-31T09:25:22',
  domain: 'Understanding and Applying the Scrum Framework',
  question_text: 'Who is required to participate in the Sprint Retrospective?',
  options: [
    { id: 1, text: 'The Product Owner', is_correct: true },
    { id: 2, text: 'The Project Sponsor', is_correct: false, why_incorrect: 'Sponsors do not attend.' },
  ],
  selected_option_ids: [2],
  explanation: 'The entire Scrum Team participates.',
  ...over,
});

const renderReview = (path = '/review') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/practice/spaced" element={<div>card runner</div>} />
      </Routes>
    </MemoryRouter>
  );

/** The queue is listed first; its reader opens on Start review, as in the prototype. */
const startReview = async () => {
  await userEvent.click(await screen.findByRole('button', { name: 'Start review' }));
};

beforeEach(() => {
  vi.clearAllMocks();
  mockQueue.mockResolvedValue({ items: [item()], remaining: 89, total_unreviewed: 90, spaced_due: 0 });
  mockPreparation.mockReturnValue({ selectedId: null, selected: null });
  mockActivity.mockResolvedValue([]);
  mockMarkReviewed.mockResolvedValue({ status: 'ok' });
  mockSubmitCheck.mockResolvedValue({
    passed: true,
    correct_option_ids: [890],
    explanation: 'The Definition of Done can be adapted at any time.',
    verdict: 'That one transferred.',
  });
});

describe('ReviewPage', () => {
  it('shows the question, the answer given, the right one and why', async () => {
    renderReview();
    await startReview();

    expect(await screen.findByText(/Who is required to participate/)).toBeInTheDocument();
    expect(screen.getByText('The Product Owner')).toBeInTheDocument();
    expect(screen.getByText(/you chose this/)).toBeInTheDocument();
    expect(screen.getByText('Why')).toBeInTheDocument();
    expect(screen.getByText('The entire Scrum Team participates.')).toBeInTheDocument();
  });

  it('opens the reader at once when "Start review" was pressed elsewhere', async () => {
    // Home's goal already says "Start review"; arriving should not ask again.
    renderReview('/review?start=1');

    expect(await screen.findByRole('button', { name: 'Done' })).toBeInTheDocument();
    expect(screen.getByText('The entire Scrum Team participates.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start review' })).not.toBeInTheDocument();
  });

  it('arriving to start with nothing to read says so, rather than opening an empty reader', async () => {
    mockQueue.mockResolvedValue({ items: [], remaining: 0, total_unreviewed: 0 });
    renderReview('/review?start=1');

    expect(
      await screen.findByText(/Every wrong answer from your mocks has been read/)
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
  });

  it('marks an answer read so the count can actually go down', async () => {
    // The defect this page replaces: the endpoint existed, nothing called it,
    // and the unreviewed total could only ever rise.
    const user = userEvent.setup();
    renderReview();
    await startReview();

    await user.click(await screen.findByRole('button', { name: 'Done' }));

    expect(mockMarkReviewed).toHaveBeenCalledWith(13, 124);
  });

  it('closes on what was covered, not on what is owed', async () => {
    const user = userEvent.setup();
    renderReview();
    await startReview();

    await user.click(await screen.findByRole('button', { name: 'Done' }));

    expect(await screen.findByText(/That is today's review read/)).toBeInTheDocument();
    expect(
      screen.getByText('1 from Understanding and Applying the Scrum Framework')
    ).toBeInTheDocument();
  });

  it('never renders the whole backlog as a headline', async () => {
    renderReview();

    await screen.findByText(/Who is required to participate/);
    // "315 overdue" and "90 unreviewed" were the two numbers on this page,
    // and neither could be cleared.
    expect(screen.queryByText(/90 wrong answers/)).not.toBeInTheDocument();
    expect(screen.queryByText(/overdue/i)).not.toBeInTheDocument();
  });

  it('says so plainly when there is nothing to review', async () => {
    mockQueue.mockResolvedValue({ items: [], remaining: 0, total_unreviewed: 0 });
    renderReview();

    expect(
      await screen.findByText(/Every wrong answer from your mocks has been read/)
    ).toBeInTheDocument();
  });

  it('does not credit reading that never happened when no mock has been sat', async () => {
    mockQueue.mockResolvedValue({ items: [], remaining: 0, total_unreviewed: 0 });
    mockPreparation.mockReturnValue({
      selectedId: 4, selected: { id: 4, name: 'New Cert', has_exam_profile: true, readiness: { mock_count: 0 } },
    });
    renderReview();

    expect(await screen.findByText(/Nothing to review yet\. Review reads the wrong answers from mocks, and you have not sat one for New Cert\./)).toBeInTheDocument();
    expect(screen.queryByText(/Every wrong answer from your mocks has been read/)).not.toBeInTheDocument();
  });

  it('says a skill has no mocks to review rather than that they were all read', async () => {
    mockQueue.mockResolvedValue({ items: [], remaining: 0, total_unreviewed: 0 });
    mockPreparation.mockReturnValue({
      selectedId: 5, selected: { id: 5, name: 'System Design', has_exam_profile: false, readiness: { mock_count: 0 } },
    });
    renderReview();

    expect(await screen.findByText(/System Design has no exam to sit/)).toBeInTheDocument();
  });

  /**
   * The check is the whole difference between reading and learning.
   *
   * Reviewing a miss used to set a timestamp and nothing else: the schedule
   * was driven only by answering, so an evening of explanations left the
   * product's model of the learner exactly where it started.
   */
  describe('the check', () => {
    it('asks a different question on the same concept after the explanation', async () => {
      mockQueue.mockResolvedValue({
        items: [item({ check: check() })], remaining: 0, total_unreviewed: 1,
      });
      renderReview();
      await startReview();

      expect(await screen.findByText(check().question_text)).toBeInTheDocument();
      expect(
        screen.getByText(/A different question on the same idea/)
      ).toBeInTheDocument();
      // Not the question that was just explained.
      expect(screen.queryByRole('button', { name: 'The Product Owner' })).not.toBeInTheDocument();
    });

    it('will not accept a check with nothing selected', async () => {
      mockQueue.mockResolvedValue({
        items: [item({ check: check() })], remaining: 0, total_unreviewed: 1,
      });
      renderReview();
      await startReview();

      expect(await screen.findByRole('button', { name: 'Check' })).toBeDisabled();
    });

    it('records the answer and says what it proved', async () => {
      const user = userEvent.setup();
      mockQueue.mockResolvedValue({
        items: [item({ check: check() })], remaining: 0, total_unreviewed: 1,
      });
      renderReview();
      await startReview();

      await user.click(await screen.findByRole('button', { name: 'True' }));
      await user.click(screen.getByRole('button', { name: 'Check' }));

      expect(mockSubmitCheck).toHaveBeenCalledWith({
        answer_id: 470, question_id: 233, selected_option_ids: [890],
      });
      expect(await screen.findByText('Checked.')).toBeInTheDocument();
      expect(screen.getByText('That one transferred.')).toBeInTheDocument();
    });

    it('shows the explanation for a check that did not land', async () => {
      const user = userEvent.setup();
      mockSubmitCheck.mockResolvedValue({
        passed: false,
        correct_option_ids: [890],
        explanation: 'The Definition of Done can be adapted at any time.',
        verdict: 'It did not transfer yet.',
      });
      mockQueue.mockResolvedValue({
        items: [item({ check: check() })], remaining: 0, total_unreviewed: 1,
      });
      renderReview();
      await startReview();

      await user.click(await screen.findByRole('button', { name: 'False' }));
      await user.click(screen.getByRole('button', { name: 'Check' }));

      expect(await screen.findByText('Not yet.')).toBeInTheDocument();
      expect(screen.getByText('It did not transfer yet.')).toBeInTheDocument();
      expect(
        screen.getByText(/The Definition of Done can be adapted at any time/)
      ).toBeInTheDocument();
    });

    // A check the server never received must not look like one it accepted.
    // The evidence is the point; a silent failure would be a fabricated pass.
    it('says a failed submission failed rather than moving on', async () => {
      const user = userEvent.setup();
      mockSubmitCheck.mockRejectedValue(new Error('offline'));
      mockQueue.mockResolvedValue({
        items: [item({ check: check() })], remaining: 0, total_unreviewed: 1,
      });
      renderReview();
      await startReview();

      await user.click(await screen.findByRole('button', { name: 'True' }));
      await user.click(screen.getByRole('button', { name: 'Check' }));

      expect(await screen.findByText(/has not been recorded/)).toBeInTheDocument();
      expect(screen.queryByText('Checked.')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Check' })).toBeInTheDocument();
    });

    it('closes the session on what was learnt, not on what was read', async () => {
      const user = userEvent.setup();
      mockQueue.mockResolvedValue({
        items: [item({ check: check() })], remaining: 3, total_unreviewed: 4,
      });
      renderReview();
      await startReview();

      await user.click(await screen.findByRole('button', { name: 'True' }));
      await user.click(screen.getByRole('button', { name: 'Check' }));
      await user.click(await screen.findByRole('button', { name: 'Done' }));

      expect(
        await screen.findByText(/1 of 1 checked question came back right/)
      ).toBeInTheDocument();
    });

    // A concept with one question in the bank cannot be checked. Asking about
    // something else and calling it verification would be the kind of claim
    // this product refuses everywhere else.
    it('says there is nothing to check against rather than inventing one', async () => {
      mockQueue.mockResolvedValue({
        items: [item({ check: null })], remaining: 0, total_unreviewed: 1,
      });
      renderReview();
      await startReview();

      expect(
        await screen.findByText(/No second question on this concept in your bank/)
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Check' })).not.toBeInTheDocument();
    });
  });

  it('opens the card runner directly instead of a setup form', async () => {
    // "Start today's review" used to navigate to the exam setup screen, which
    // is not what the button said it would do.
    const user = userEvent.setup();
    mockQueue.mockResolvedValue({ items: [], remaining: 0, total_unreviewed: 0, spaced_due: 40 });
    renderReview();

    expect(await screen.findByText(/40 questions the schedule has brought/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Review from memory' }));

    expect(await screen.findByText('card runner')).toBeInTheDocument();
  });

  describe('for the picked preparation', () => {
    const databricks = { id: 7, name: 'Databricks Data Engineer' };

    beforeEach(() => {
      mockPreparation.mockReturnValue({ selectedId: 7, selected: databricks });
    });

    // Unscoped, Home said "nothing due" for one preparation and Review then
    // listed another's mistakes.
    it('asks for that preparation\'s queue and sessions, and says whose they are', async () => {
      renderReview();
      await startReview();

      expect(await screen.findByText(item().question_text)).toBeInTheDocument();
      expect(mockQueue).toHaveBeenCalledWith(7);
      expect(mockActivity).toHaveBeenCalledWith(8, 7);
      expect(screen.getByText('Databricks Data Engineer')).toBeInTheDocument();
      expect(screen.getByText('Your Databricks Data Engineer sessions')).toBeInTheDocument();
    });

    it("counts that preparation's due cards, not every preparation's", async () => {
      mockQueue.mockResolvedValue({ items: [], remaining: 0, total_unreviewed: 0, spaced_due: 3 });
      renderReview();

      expect(await screen.findByText(/3 questions the schedule has brought/)).toBeInTheDocument();
      expect(mockQueue).toHaveBeenCalledWith(7);
    });

    // The count comes from the same scoped response as the queue, so another
    // preparation's schedule cannot offer a drill here that the engine refuses.
    it('offers no memory review when nothing of this preparation is due', async () => {
      mockQueue.mockResolvedValue({ items: [], remaining: 0, total_unreviewed: 0, spaced_due: 0 });
      renderReview();

      expect(await screen.findByText(/Nothing to review/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Review from memory' })).not.toBeInTheDocument();
    });
  });
});
