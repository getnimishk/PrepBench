// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SessionBreakdown } from './SessionBreakdown';
import type { ExamDetail } from '../../types/exam';

/** Four questions over two domains: one right, one wrong, one wrong, one skipped. */
const exam = (over: Partial<ExamDetail> = {}): ExamDetail => {
  const q = (id: number, domain: string, topic: string) => ({
    id, text: `Q${id}`, question_type: 'single_choice' as const, difficulty: 'medium' as const,
    domain, topic, certification: 'C', tags: [], created_at: '', updated_at: '', is_reviewed: false,
    options: [{ id: id * 10 + 1, option_text: 'A', is_correct: true }],
  });
  const a = (question_id: number, selected: number[], is_correct: boolean) => ({
    id: question_id, session_id: 1, question_id, selected_option_ids: selected, is_correct,
    time_spent_seconds: 10, confidence_level: 'not_set' as const, is_flagged: false, is_bookmarked: false,
  });
  return {
    id: 1, title: 'Drill', exam_mode: 'practice', session_kind: 'drill', status: 'completed',
    total_questions: 4, answered_questions: 3, correct_count: 1, score_percentage: 25,
    passing_percentage: 70, time_spent_seconds: 40, current_question_index: 0,
    question_ids_order: [1, 2, 3, 4], start_time: '2026-09-13T10:00:00',
    questions: [q(1, 'Events', 'Sprint Review'), q(2, 'Events', 'Daily Scrum'), q(3, 'Roles', 'Product Owner'), q(4, 'Roles', 'Developers')],
    answers: [a(1, [11], true), a(2, [99], false), a(3, [99], false), a(4, [], false)],
    ...over,
  };
};

const renderBreakdown = (e: ExamDetail) =>
  render(<MemoryRouter><SessionBreakdown exam={e} /></MemoryRouter>);

describe('SessionBreakdown', () => {
  it('counts the session from its own answers, and a skip is not a miss', () => {
    renderBreakdown(exam());

    expect(screen.getByText('1 / 4')).toBeInTheDocument();
    expect(screen.getByText('1 skipped')).toBeInTheDocument();
    // Two answered wrong; the skipped one is not counted as missed.
    const missed = screen.getByText('Missed').parentElement!;
    expect(within(missed).getByText('2')).toBeInTheDocument();
    expect(screen.getByText('+3')).toBeInTheDocument();
  });

  it('breaks the answered questions down by domain and topic, worst first', () => {
    renderBreakdown(exam());

    const domains = screen.getByText('By domain').parentElement!;
    const rows = within(domains).getAllByText(/ of \d+ · \d+%/).map((el) => el.textContent);
    // Roles: 0 of 1 answered (the skip is left out); Events: 1 of 2.
    expect(rows).toEqual(['0 of 1 · 0%', '1 of 2 · 50%']);
    expect(within(screen.getByText('By topic').parentElement!).getByText('Sprint Review')).toBeInTheDocument();
  });

  it('sends a drill\'s misses to the spaced schedule and a mock\'s to review', () => {
    const { unmount } = renderBreakdown(exam());
    expect(screen.getByRole('link', { name: 'Spaced repetition' })).toHaveAttribute('href', '/practice?tab=spaced');
    expect(screen.getByText(/Understand the 2 misses before practising again/)).toBeInTheDocument();
    unmount();

    renderBreakdown(exam({ session_kind: 'mock' }));
    expect(screen.getByRole('link', { name: 'Open review' })).toHaveAttribute('href', '/review');
    expect(screen.getByText('now in your review queue')).toBeInTheDocument();
  });

  it("reports a mock's time and flags, because it was sat against a clock", () => {
    const e = exam({ session_kind: 'mock', time_spent_seconds: 2851 });
    renderBreakdown({ ...e, answers: e.answers.map((a, i) => ({ ...a, is_flagged: i < 2 })) });

    expect(screen.getByText('Time used')).toBeInTheDocument();
    expect(screen.getByText(/47:\s*31/)).toBeInTheDocument();
    expect(screen.getByText('2 flagged during the mock')).toBeInTheDocument();
    expect(screen.queryByText('Evidence')).not.toBeInTheDocument();
  });

  it('says nothing was missed only when something was answered', () => {
    const e = exam();
    renderBreakdown({
      ...e,
      answers: e.answers.map((a) => ({ ...a, selected_option_ids: [], is_correct: false })),
    });

    expect(screen.getByText(/Nothing was answered/)).toBeInTheDocument();
    expect(screen.queryByText(/Nothing missed in this set/)).not.toBeInTheDocument();
    expect(screen.queryByText('By domain')).not.toBeInTheDocument();
  });
});
