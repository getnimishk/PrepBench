// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

/**
 * The card runner: recall, reveal, grade.
 *
 * What these hold is the part that makes it retrieval rather than recognition --
 * the answer is not on the page until it is asked for -- and the part that makes
 * it honest: a grade the server did not record does not move the deck on.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SpacedReviewPage } from './SpacedReviewPage';
import type { SpacedCard } from '../types/spaced';

const mockDeck = vi.fn();
const mockGrade = vi.fn();
const mockPreparation = vi.fn();

vi.mock('../services/api', () => ({
  getSpacedDeck: (...a: any[]) => mockDeck(...a),
  gradeSpacedCard: (...a: any[]) => mockGrade(...a),
}));

vi.mock('../context/PreparationContext', () => ({
  usePreparation: () => mockPreparation(),
}));

const card = (id: number, over: Partial<SpacedCard> = {}): SpacedCard => ({
  question_id: id,
  question_text: `Who owns the Product Backlog? (${id})`,
  domain: 'Scrum Roles',
  topic: 'Product Owner',
  is_multiple: false,
  answer: ['The Product Owner'],
  explanation: 'The Product Owner is accountable for the Product Backlog.',
  due_since: '2026-09-10T08:00:00',
  repetition: 2,
  intervals: { again: 1, hard: 8, good: 15, easy: 17 },
  ...over,
});

const renderRunner = (entry = '/practice/spaced') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/practice/spaced" element={<SpacedReviewPage />} />
        <Route path="/review" element={<div>review page</div>} />
        <Route path="/practice" element={<div>practice page</div>} />
        <Route path="/analytics/area" element={<div>area page</div>} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockPreparation.mockReturnValue({ selectedId: 4, selected: { id: 4, name: 'Scrum / PSM I' } });
  mockDeck.mockResolvedValue({ cards: [card(1), card(2)], due_total: 5 });
  mockGrade.mockImplementation((question_id: number, grade: string) => Promise.resolve({
    question_id, grade, interval_days: grade === 'again' ? 1 : 15, next_review_date: '2026-09-28T08:00:00',
  }));
});

describe('SpacedReviewPage', () => {
  it("loads the picked preparation's deck", async () => {
    renderRunner();

    expect(await screen.findByText('Who owns the Product Backlog? (1)')).toBeInTheDocument();
    expect(mockDeck).toHaveBeenCalledWith(4);
    expect(screen.getByText('Spaced repetition · Scrum / PSM I')).toBeInTheDocument();
    expect(screen.getByText('Card 1 of 2')).toBeInTheDocument();
  });

  it('keeps the answer off the page until it is asked for', async () => {
    const user = userEvent.setup();
    renderRunner();

    await screen.findByText('Who owns the Product Backlog? (1)');
    expect(screen.queryByText('The Product Owner')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Good/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show answer' }));

    expect(screen.getByText('The Product Owner')).toBeInTheDocument();
    expect(screen.getByText('The Product Owner is accountable for the Product Backlog.')).toBeInTheDocument();
    // Each grade says what it will do, in the server's numbers.
    expect(screen.getByRole('button', { name: 'Again — back in 1 day' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Good — back in 15 days' })).toBeInTheDocument();
  });

  it('records a grade and moves to the next card, then closes on where each one went', async () => {
    const user = userEvent.setup();
    renderRunner();

    await user.click(await screen.findByRole('button', { name: 'Show answer' }));
    await user.click(screen.getByRole('button', { name: /^Good/ }));
    expect(mockGrade).toHaveBeenCalledWith(1, 'good');
    expect(await screen.findByText('Who owns the Product Backlog? (2)')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show answer' }));
    await user.click(screen.getByRole('button', { name: /^Again/ }));
    expect(mockGrade).toHaveBeenCalledWith(2, 'again');

    expect(await screen.findByRole('heading', { name: '2 concepts retrieved' })).toBeInTheDocument();
    expect(screen.getByText(/1 comes back tomorrow/)).toBeInTheDocument();
    expect(screen.getByText(/3 more are still due/)).toBeInTheDocument();

    mockDeck.mockResolvedValue({ cards: [card(3)], due_total: 3 });
    await user.click(screen.getByRole('button', { name: 'Continue reviewing' }));
    expect(await screen.findByText('Who owns the Product Backlog? (3)')).toBeInTheDocument();
  });

  it('does not move on when the grade was not saved', async () => {
    const user = userEvent.setup();
    mockGrade.mockRejectedValue(new Error('offline'));
    renderRunner();

    await user.click(await screen.findByRole('button', { name: 'Show answer' }));
    await user.click(screen.getByRole('button', { name: /^Hard/ }));

    expect(await screen.findByText(/this card has not moved/)).toBeInTheDocument();
    expect(screen.getByText('Card 1 of 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Skip card' }));
    expect(await screen.findByText('Who owns the Product Backlog? (2)')).toBeInTheDocument();
  });

  it('says nothing is due rather than inventing a deck', async () => {
    mockDeck.mockResolvedValue({ cards: [], due_total: 0 });
    renderRunner();

    expect(await screen.findByText(/Practising ahead of schedule does not strengthen recall/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show answer' })).not.toBeInTheDocument();
  });

  it('exits back to Review when it was opened from Review', async () => {
    const user = userEvent.setup();
    renderRunner('/practice/spaced?from=review');

    await user.click(await screen.findByRole('button', { name: '← Exit' }));
    expect(await screen.findByText('review page')).toBeInTheDocument();
  });

  it('narrows to one area when opened from it, says so, and exits back to it', async () => {
    const user = userEvent.setup();
    renderRunner('/practice/spaced?domain=Scrum%20Events&from=area');

    expect(await screen.findByText('Who owns the Product Backlog? (1)')).toBeInTheDocument();
    expect(mockDeck).toHaveBeenCalledWith(4, undefined, 'Scrum Events');
    expect(screen.getByText('Spaced repetition · Scrum / PSM I · Scrum Events')).toBeInTheDocument();
    expect(screen.getByText(/Only questions in Scrum Events/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Review everything due' })).toHaveAttribute('href', '/practice/spaced');

    await user.click(screen.getByRole('button', { name: '← Exit' }));
    expect(await screen.findByText('area page')).toBeInTheDocument();
  });

  it('says nothing in the area is due, rather than nothing at all', async () => {
    mockDeck.mockResolvedValue({ cards: [], due_total: 0 });
    renderRunner('/practice/spaced?domain=Scrum%20Events&from=area');

    expect(await screen.findByText(/Nothing in Scrum Events is due today/)).toBeInTheDocument();
  });
});

describe('SpacedReviewPage keyboard shortcuts', () => {
  it('shows the answer with Space and grades with 1 to 4, but only once revealed', async () => {
    const user = userEvent.setup();
    renderRunner();
    await screen.findByText('Who owns the Product Backlog? (1)');

    // A grade before the answer is shown would be a recognition, not a recall.
    await user.keyboard('3');
    expect(mockGrade).not.toHaveBeenCalled();

    await user.keyboard(' ');
    expect(await screen.findByText('The Product Owner')).toBeInTheDocument();

    await user.keyboard('3');
    await vi.waitFor(() => expect(mockGrade).toHaveBeenCalledWith(1, 'good'));
    expect(await screen.findByText('Who owns the Product Backlog? (2)')).toBeInTheDocument();
  });
});
