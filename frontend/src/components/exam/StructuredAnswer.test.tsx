// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Question } from '../../types/question';
import { gradeSelection, isAnswered, shuffledFor, storedIds } from '../../services/questionFormats';
import { QuestionView } from './QuestionView';
import { StructuredAnswerKey } from './StructuredAnswer';

const ordering = {
  id: 41, question_type: 'ordering', text: 'Put the steps of an acks=all write in order.', domain: 'D', topic: 'T',
  options: ['Write to the leader', 'Followers fetch it', 'The high watermark advances', 'Consumers can read it']
    .map((t, i) => ({ id: 100 + i, option_text: t, is_correct: true, order_index: i })),
} as unknown as Question;

const matching = {
  id: 42, question_type: 'matching', text: 'Match each acks setting to what the producer waits for.', domain: 'D', topic: 'T',
  options: [['acks=0', 'Nothing'], ['acks=1', 'The leader only'], ['acks=all', 'All in-sync replicas']]
    .map(([a, b], i) => ({ id: 200 + i, option_text: a, match_target: b, is_correct: true, order_index: i })),
} as unknown as Question;

const Harness: React.FC<{ question: Question; revealed?: boolean; start?: number[] }> = ({ question, revealed, start = [] }) => {
  const [ids, setIds] = useState<number[]>(start);
  return (
    <>
      <QuestionView question={question} selectedOptionIds={ids} onSelectOption={setIds} confidenceLevel="not_set" onChangeConfidence={() => {}} revealed={revealed} />
      <output data-testid="answer">{ids.join(',')}</output>
    </>
  );
};

describe('the grading rule, as the backend has it', () => {
  it('rights an ordering only in the stored order, and leaves an incomplete one ungraded', () => {
    const right = storedIds(ordering);
    expect(gradeSelection(ordering, right)).toBe(true);
    expect(gradeSelection(ordering, [...right].reverse())).toBe(false);
    expect(gradeSelection(ordering, right.slice(1))).toBeNull();
  });

  it('rights a matching only when every item has its own pair', () => {
    expect(gradeSelection(matching, [200, 201, 202])).toBe(true);
    expect(gradeSelection(matching, [201, 200, 202])).toBe(false);
    expect(isAnswered(matching, [200, 0, 202])).toBe(false);
  });

  it('shuffles the same way every time, and never into the answer', () => {
    for (let id = 1; id < 200; id++) {
      const items = [1, 2, 3, 4];
      const once = shuffledFor(id, items);
      expect(shuffledFor(id, items)).toEqual(once);
      expect(once).not.toEqual(items);
      expect([...once].sort()).toEqual(items);
    }
  });
});

describe('answering on screen', () => {
  it('orders with buttons, a keyboard’s way, and answers with the full order', async () => {
    const user = userEvent.setup();
    render(<Harness question={ordering} />);
    expect(screen.getByText('Put these in order, first to last')).toBeInTheDocument();
    expect(screen.getByTestId('answer')).toHaveTextContent('');
    const list = screen.getByRole('list', { name: 'Your order, first to last' });
    const first = within(list).getAllByRole('listitem')[0];
    await user.click(within(first).getByRole('button', { name: /down$/ }));
    const answer = screen.getByTestId('answer').textContent!.split(',').map(Number);
    expect(answer).toHaveLength(4);
    expect([...answer].sort()).toEqual(storedIds(ordering));
  });

  it('pairs each item from a list of the targets', async () => {
    const user = userEvent.setup();
    render(<Harness question={matching} />);
    await user.click(screen.getByRole('combobox', { name: 'acks=1' }));
    await user.click(await screen.findByRole('option', { name: 'The leader only' }));
    expect(screen.getByTestId('answer')).toHaveTextContent('0,201,0');
  });

  it('shows where each item belonged once revealed', () => {
    render(<Harness question={ordering} revealed start={[101, 100, 102, 103]} />);
    expect(screen.getAllByText('In place')).toHaveLength(2);
    expect(screen.getByText('Belongs at 1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /up$|down$/ })).not.toBeInTheDocument();
  });

  it('gives the answer key with the learner’s pairs beside it', () => {
    render(<StructuredAnswerKey question={matching} selected={[201, 200, 202]} />);
    const pairs = screen.getByRole('list', { name: 'The right pairs' });
    expect(within(pairs).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('You paired: The leader only')).toBeInTheDocument();
  });
});
