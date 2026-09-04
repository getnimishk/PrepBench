// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { DesignReviewPage } from './DesignReviewPage';

const mockGetReview = vi.fn();
const mockGetLatest = vi.fn();
const mockSubmit = vi.fn();

vi.mock('../services/api', () => ({
  getDesignReview: (...args: any[]) => mockGetReview(...args),
  getLatestDesignReviewAttempt: (...args: any[]) => mockGetLatest(...args),
  submitDesignReviewAttempt: (...args: any[]) => mockSubmit(...args),
}));

const REVIEW = {
  id: 2,
  title: 'The warehouse that sleeps',
  brief: 'A BI dashboard used by about 200 analysts queries a 4TB fact table.',
  domain: 'data_platform',
  difficulty: 'medium',
  concepts: ['Duty cycle', 'Auto-stop'],
  options: [
    {
      id: 10,
      label: 'A' as const,
      name: 'Serverless SQL warehouse',
      summary: 'Scales to zero when idle.',
      flow: [{ label: 'Analyst query' }, { label: 'Serverless', detail: 'scales to zero', emphasis: true }],
      key_choices: ['Pay per second of query'],
      holds_when: 'The duty cycle is genuinely low.',
      breaks_when: 'The warehouse is busy most of the working day.',
      rough_cost: 'Scales with query-hours.',
    },
    {
      id: 11,
      label: 'B' as const,
      name: 'Provisioned warehouse with auto-stop',
      summary: 'Fixed size, running business hours.',
      flow: [{ label: 'Analyst query' }, { label: 'Provisioned', detail: 'fixed size', emphasis: true }],
      key_choices: ['Same bill every month'],
      holds_when: 'Utilisation is high enough.',
      breaks_when: 'You pay full rate through the 2pm lull.',
      rough_cost: 'Ten hours a day at the peak size.',
    },
  ],
};

const ATTEMPT = {
  id: 77,
  review_id: 2,
  review_title: REVIEW.title,
  choice: 'B' as const,
  justification: 'Utilisation looks high enough that serverless would cost more.',
  grading_status: 'not_graded',
  axis_verdict: null,
  feedback: null,
  time_spent_seconds: 300,
  created_at: '2026-09-01T10:00:00',
  reveal: {
    deciding_axis: 'Duty cycle -- what fraction of each paid hour is actually spent computing.',
    reveal: 'Serverless is not automatically cheaper at high utilisation.',
    elicit_answer: 'What are the actual query-hours per day?',
  },
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/design-reviews/2']}>
      <Routes>
        <Route path="/design-reviews/:reviewId" element={<DesignReviewPage />} />
        <Route path="/design-reviews" element={<div>List Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetReview.mockResolvedValue(REVIEW);
  mockGetLatest.mockResolvedValue(null);
  mockSubmit.mockResolvedValue(ATTEMPT);
});

describe('DesignReviewPage', () => {
  it('shows both options before anything is answered', async () => {
    renderPage();
    expect(await screen.findByText('Serverless SQL warehouse')).toBeInTheDocument();
    expect(screen.getByText('Provisioned warehouse with auto-stop')).toBeInTheDocument();
  });

  it('hides the answer until the learner commits', async () => {
    renderPage();
    await screen.findByText('Serverless SQL warehouse');

    // Holds/breaks/cost are the reasoning the learner is here to do. Showing
    // them beside the question would hand it over.
    expect(screen.queryByText(REVIEW.options[0].holds_when)).not.toBeInTheDocument();
    expect(screen.queryByText(REVIEW.options[1].breaks_when)).not.toBeInTheDocument();
    expect(screen.queryByText(ATTEMPT.reveal.deciding_axis)).not.toBeInTheDocument();
  });

  it('will not accept a choice with no reasoning', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Serverless SQL warehouse');

    await user.click(screen.getByText('Serverless SQL warehouse'));
    expect(screen.getByRole('button', { name: /commit and see the reveal/i })).toBeDisabled();

    await user.type(screen.getByPlaceholderText(/two or three sentences/i), 'Duty cycle decides it.');
    expect(screen.getByRole('button', { name: /commit and see the reveal/i })).toBeEnabled();
  });

  it('will not accept reasoning with no choice', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Serverless SQL warehouse');

    await user.type(screen.getByPlaceholderText(/two or three sentences/i), 'Some reasoning.');
    expect(screen.getByRole('button', { name: /commit and see the reveal/i })).toBeDisabled();
  });

  it('reveals the deciding axis and both failure modes after committing', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Serverless SQL warehouse');

    await user.click(screen.getByText('Provisioned warehouse with auto-stop'));
    await user.type(screen.getByPlaceholderText(/two or three sentences/i), 'Utilisation looks high.');
    await user.click(screen.getByRole('button', { name: /commit and see the reveal/i }));

    expect(await screen.findByText(ATTEMPT.reveal.deciding_axis)).toBeInTheDocument();
    expect(screen.getByText(ATTEMPT.reveal.elicit_answer)).toBeInTheDocument();
    // Including for the option the learner picked -- not only the one they rejected.
    expect(screen.getByText(REVIEW.options[1].breaks_when)).toBeInTheDocument();
    expect(screen.getByText(REVIEW.options[0].breaks_when)).toBeInTheDocument();
  });

  it('says "Not graded" rather than showing a zero when nothing graded the answer', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Serverless SQL warehouse');

    await user.click(screen.getByText('Serverless SQL warehouse'));
    await user.type(screen.getByPlaceholderText(/two or three sentences/i), 'Reasoning.');
    await user.click(screen.getByRole('button', { name: /commit and see the reveal/i }));

    expect(await screen.findByText('Not graded')).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('offers "neither" as a real answer', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Serverless SQL warehouse');

    await user.click(screen.getByText(/neither — I would ask something first/i));
    await user.type(screen.getByPlaceholderText(/what would you ask/i), 'What are the query-hours?');
    await user.click(screen.getByRole('button', { name: /commit and see the reveal/i }));

    await waitFor(() =>
      expect(mockSubmit).toHaveBeenCalledWith(expect.objectContaining({ choice: 'ask_first' }))
    );
  });

  it('asks for the question up front when declining to choose', async () => {
    // The server rejects a "neither" that names no question, so the prompt has
    // to say that before submission rather than after.
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Serverless SQL warehouse');

    expect(screen.getByPlaceholderText(/two or three sentences/i)).toBeInTheDocument();
    await user.click(screen.getByText(/neither — I would ask something first/i));
    expect(screen.getByPlaceholderText(/what would you ask/i)).toBeInTheDocument();
  });

  it('surfaces the server complaint when a "neither" names no question', async () => {
    const user = userEvent.setup();
    mockSubmit.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 422,
        data: {
          detail: [{
            msg: 'Declining to choose is a strong answer only when it names the question.',
            loc: ['body'],
          }],
        },
      },
    });
    renderPage();
    await screen.findByText('Serverless SQL warehouse');

    await user.click(screen.getByText(/neither — I would ask something first/i));
    await user.type(screen.getByPlaceholderText(/what would you ask/i), 'I dislike both.');
    await user.click(screen.getByRole('button', { name: /commit and see the reveal/i }));

    expect(
      await screen.findByText(/only when it names the question/i)
    ).toBeInTheDocument();
  });

  it('shows a previous answer and its reveal when the review is reopened', async () => {
    mockGetLatest.mockResolvedValue(ATTEMPT);
    renderPage();

    expect(await screen.findByDisplayValue(ATTEMPT.justification)).toBeInTheDocument();
    expect(screen.getByText(ATTEMPT.reveal.deciding_axis)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /commit and see the reveal/i })).not.toBeInTheDocument();
  });

  it('surfaces a load failure instead of rendering an empty review', async () => {
    mockGetReview.mockRejectedValue(new Error('network'));
    renderPage();
    expect(await screen.findByText(/failed to load this design review/i)).toBeInTheDocument();
  });

  it('shows the verdict and its feedback when the answer was graded', async () => {
    mockGetLatest.mockResolvedValue({
      ...ATTEMPT,
      grading_status: 'graded',
      axis_verdict: 'named',
      feedback: 'You went straight to duty cycle rather than assuming serverless is cheaper.',
    });
    renderPage();

    expect(await screen.findByText('You named the deciding axis')).toBeInTheDocument();
    expect(screen.getByText(/you went straight to duty cycle/i)).toBeInTheDocument();
    expect(screen.queryByText('Not graded')).not.toBeInTheDocument();
  });

  it('says the axis was missed, not that the answer was wrong', async () => {
    // The option they picked may well be the one a strong candidate picks --
    // the verdict is about the reasoning, and the wording has to hold that line.
    mockGetLatest.mockResolvedValue({
      ...ATTEMPT,
      grading_status: 'graded',
      axis_verdict: 'missed',
      feedback: 'Cost never came up.',
    });
    renderPage();

    expect(await screen.findByText('Missed the axis')).toBeInTheDocument();
    expect(screen.queryByText(/wrong/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/incorrect/i)).not.toBeInTheDocument();
  });

  it('shows no verdict at all when nothing graded the answer', async () => {
    mockGetLatest.mockResolvedValue(ATTEMPT); // not_graded
    renderPage();

    await screen.findByText('Not graded');
    expect(screen.queryByText('Missed the axis')).not.toBeInTheDocument();
    expect(screen.queryByText('Partly there')).not.toBeInTheDocument();
    expect(screen.queryByText('You named the deciding axis')).not.toBeInTheDocument();
  });
});
