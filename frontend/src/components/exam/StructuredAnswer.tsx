// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Box, Button, MenuItem, TextField } from '@mui/material';
import type { Question } from '../../types/question';
import { Pill } from '../ui/primitives';
import { shuffledFor, storedIds, storedOrder } from '../../services/questionFormats';

/**
 * Ordering ("build list") and matching questions: the learner's input, and the answer key for the
 * screens that show it afterwards. The answer is a list of option ids; services/questionFormats.ts
 * says what each list means. Moving is by buttons, not dragging, so a keyboard and a screen reader
 * can do everything a mouse can.
 */

const ROW = {
  display: 'flex', alignItems: 'center', gap: '10px', mt: '8px', p: '10px 12px', borderRadius: '10px',
  border: '1px solid', boxSizing: 'border-box', width: '100%',
} as const;

const textOf = (q: Question) => {
  const byId = new Map(storedOrder(q).map((o, i) => [o.id ?? i, o]));
  return (id: number) => byId.get(id);
};

// ---- ordering ---------------------------------------------------------------------------------------

export const OrderingInput: React.FC<{
  question: Question;
  selected: number[];
  onChange: (ids: number[]) => void;
  /** After the answer: show where each item belongs. */
  revealed?: boolean;
}> = ({ question, selected, onChange, revealed = false }) => {
  const ids = storedIds(question);
  const answered = selected.length === ids.length;
  const order = answered ? selected : shuffledFor(question.id, ids);
  const item = textOf(question);
  const move = (from: number, to: number) => {
    const next = [...order];
    [next[from], next[to]] = [next[to], next[from]];
    onChange(next);
  };

  return (
    <Box>
      <Box component="ol" aria-label="Your order, first to last" sx={{ listStyle: 'none', p: 0, m: 0, mt: '6px' }}>
        {order.map((id, i) => {
          const text = item(id)?.option_text ?? '';
          const right = ids[i] === id;
          const tone = !revealed ? (answered ? 'primary.main' : 'divider') : right ? 'success.main' : 'error.main';
          const bg = !revealed ? 'background.paper' : right ? 'pb.successSoft' : 'pb.dangerSoft';
          return (
            <Box component="li" key={id} sx={{ ...ROW, borderColor: tone, bgcolor: bg }}>
              <Box component="span" sx={{ fontWeight: 700, minWidth: '1.6em' }}>{i + 1}.</Box>
              <Box component="span" sx={{ flex: 1, minWidth: 0, overflowWrap: 'break-word' }}>{text}</Box>
              {revealed ? (
                right ? <Pill tone="success">In place</Pill> : <Pill tone="danger">{`Belongs at ${ids.indexOf(id) + 1}`}</Pill>
              ) : (
                <Box sx={{ display: 'flex', gap: '4px', flex: '0 0 auto' }}>
                  <Button size="small" variant="outlined" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`Move “${text}” up`}>↑</Button>
                  <Button size="small" variant="outlined" disabled={i === order.length - 1} onClick={() => move(i, i + 1)} aria-label={`Move “${text}” down`}>↓</Button>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
      {!revealed && !answered && (
        <Button size="small" variant="text" sx={{ mt: '8px' }} onClick={() => onChange(order)}>
          Answer with this order
        </Button>
      )}
    </Box>
  );
};

// ---- matching ---------------------------------------------------------------------------------------

export const MatchingInput: React.FC<{
  question: Question;
  selected: number[];
  onChange: (ids: number[]) => void;
  revealed?: boolean;
}> = ({ question, selected, onChange, revealed = false }) => {
  const rows = storedOrder(question);
  const ids = storedIds(question);
  // The targets, by the id of the option each belongs to, in a shuffled order of their own.
  const targets = shuffledFor(question.id, rows.map((o, i) => ({ id: o.id ?? i, text: o.match_target ?? '' })));
  const current = ids.map((_, i) => selected[i] ?? 0);
  const targetText = new Map(targets.map((t) => [t.id, t.text]));
  const set = (row: number, value: number) => {
    const next = [...current];
    next[row] = value;
    onChange(next);
  };

  return (
    <Box sx={{ mt: '6px' }}>
      {rows.map((o, i) => {
        const chosen = current[i];
        const right = chosen === ids[i];
        const label = o.option_text;
        if (revealed) {
          return (
            <Box key={ids[i]} sx={{ ...ROW, flexWrap: 'wrap', borderColor: right ? 'success.main' : 'error.main', bgcolor: right ? 'pb.successSoft' : 'pb.dangerSoft' }}>
              <Box component="span" sx={{ fontWeight: 700, flex: '1 1 40%', minWidth: 0, overflowWrap: 'break-word' }}>{label}</Box>
              <Box component="span" sx={{ flex: '1 1 40%', minWidth: 0, overflowWrap: 'break-word' }}>
                {chosen ? targetText.get(chosen) : 'Not paired'}
                {!right && <Box component="span" sx={{ display: 'block', color: 'text.secondary' }}>{`Pairs with: ${o.match_target ?? ''}`}</Box>}
              </Box>
              <Pill tone={right ? 'success' : 'danger'}>{right ? 'Right' : 'Wrong'}</Pill>
            </Box>
          );
        }
        return (
          <TextField
            key={ids[i]} select fullWidth size="small" label={label} value={chosen || ''}
            onChange={(e) => set(i, Number(e.target.value))} sx={{ mt: '12px' }}
          >
            <MenuItem value="">Choose its pair</MenuItem>
            {targets.map((t) => <MenuItem key={t.id} value={t.id}>{t.text}</MenuItem>)}
          </TextField>
        );
      })}
    </Box>
  );
};

/** The input for a structured question, by its type. */
export const StructuredInput: React.FC<{
  question: Question;
  selected: number[];
  onChange: (ids: number[]) => void;
  revealed?: boolean;
}> = (props) => (props.question.question_type === 'ordering' ? <OrderingInput {...props} /> : <MatchingInput {...props} />);

// ---- the answer key, for screens after the answer ---------------------------------------------------

/** The right answer, and the learner's beside it when there is one. Read-only. */
export const StructuredAnswerKey: React.FC<{ question: Question; selected?: number[] }> = ({ question, selected }) => {
  const rows = storedOrder(question);
  if (question.question_type === 'ordering') {
    const ids = storedIds(question);
    const item = textOf(question);
    const mine = selected && selected.length === ids.length ? selected : null;
    return (
      <Box>
        <Box component="ol" aria-label="The right order" sx={{ pl: '1.4em', m: 0, mt: '6px' }}>
          {rows.map((o, i) => <Box component="li" key={ids[i]} sx={{ mt: '4px' }}>{o.option_text}</Box>)}
        </Box>
        {mine && (
          <Box sx={{ mt: '10px' }}>
            <Box component="p" sx={{ m: 0, fontWeight: 600 }}>Your order</Box>
            <Box component="ol" sx={{ pl: '1.4em', m: 0 }}>
              {mine.map((id, i) => (
                <Box component="li" key={id} sx={{ mt: '4px', color: ids[i] === id ? 'success.main' : 'error.main' }}>
                  {item(id)?.option_text}{ids[i] === id ? '' : ` (belongs at ${ids.indexOf(id) + 1})`}
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Box>
    );
  }
  const ids = storedIds(question);
  const target = new Map(rows.map((o, i) => [ids[i], o.match_target ?? '']));
  return (
    <Box component="ul" aria-label="The right pairs" sx={{ listStyle: 'none', p: 0, m: 0, mt: '6px' }}>
      {rows.map((o, i) => {
        const chosen = selected?.[i];
        const wrong = selected && chosen !== ids[i];
        return (
          <Box component="li" key={ids[i]} sx={{ ...ROW, flexWrap: 'wrap', borderColor: wrong ? 'error.main' : 'success.main', bgcolor: wrong ? 'pb.dangerSoft' : 'pb.successSoft' }}>
            <Box component="span" sx={{ fontWeight: 700, flex: '1 1 40%', minWidth: 0, overflowWrap: 'break-word' }}>{o.option_text}</Box>
            <Box component="span" sx={{ flex: '1 1 40%', minWidth: 0, overflowWrap: 'break-word' }}>
              {o.match_target}
              {wrong && <Box component="span" sx={{ display: 'block', color: 'text.secondary' }}>{`You paired: ${chosen ? target.get(chosen) : 'nothing'}`}</Box>}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};
