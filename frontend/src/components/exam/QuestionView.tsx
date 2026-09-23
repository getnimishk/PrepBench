// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { Question } from '../../types/question';
import { ConfidenceLevel } from '../../types/exam';
import { Eyebrow, Note, Pill } from '../ui/primitives';

interface QuestionViewProps {
  question: Question;
  selectedOptionIds: number[];
  onSelectOption: (optionIds: number[]) => void;
  confidenceLevel: ConfidenceLevel;
  onChangeConfidence: (level: ConfidenceLevel) => void;
  /**
   * True once the answer is behind the learner and the explanation is on
   * screen -- practice mode, after Check answer. Everything that would prime
   * an answer is held back until then, so in a timed mock it never appears.
   */
  revealed?: boolean;
}

/**
 * The input covers its whole choice, unseen: a click anywhere on the box lands
 * on the radio itself, and the box around it is what shows the state.
 */
const INPUT_OVER_CHOICE = {
  position: 'absolute', inset: 0, width: '100%', height: '100%', m: 0, opacity: 0,
  cursor: 'inherit', zIndex: 1,
} as const;

const CONFIDENCE: { level: ConfidenceLevel; label: string }[] = [
  { level: 'low', label: 'Low' },
  { level: 'medium', label: 'Medium' },
  { level: 'high', label: 'High' },
];

/**
 * One question, as the prototype's runner draws it: the question in 18px, then
 * each option as a bordered choice -- "A. …" -- that takes the accent when
 * picked. The radio or checkbox is still there for keyboards and screen
 * readers; it is the box around it that shows the state.
 *
 * What is on screen before the answer, and what is not: no difficulty, no
 * domain and no topic. A topic in this bank reads "Sprint Cancellation: PO
 * authority and obsolescence condition" -- it names the area and often the
 * answer, printed directly above the question. Every point that cue is worth is
 * a point the real exam will not award, and mock scores are what readiness is
 * computed from. Both appear once the answer is behind you, where they explain
 * instead of priming.
 */
export const QuestionView: React.FC<QuestionViewProps> = ({
  question,
  selectedOptionIds,
  onSelectOption,
  confidenceLevel,
  onChangeConfidence,
  revealed = false,
}) => {
  const isMultiple = question.question_type === 'multiple_choice';
  const groupName = `question-${question.id}`;

  const toggle = (optionId: number) => {
    if (revealed) return;
    if (isMultiple) {
      onSelectOption(selectedOptionIds.includes(optionId)
        ? selectedOptionIds.filter((id) => id !== optionId)
        : [...selectedOptionIds, optionId]);
    } else {
      onSelectOption([optionId]);
    }
  };

  return (
    <Box>
      {(isMultiple || revealed) && (
        <Box sx={{ display: 'flex', gap: '6px', flexWrap: 'wrap', mb: '12px' }}>
          {isMultiple && <Pill tone="accent">Choose all that apply</Pill>}
          {revealed && (
            <>
              <Pill>{question.domain}</Pill>
              {question.topic && <Pill>{question.topic}</Pill>}
            </>
          )}
        </Box>
      )}

      {question.case_study_text && (
        <Note sx={{ mb: '14px' }}>
          <Eyebrow>Case study</Eyebrow>
          <Box component="p" sx={{ m: 0, mt: '6px', whiteSpace: 'pre-line' }}>{question.case_study_text}</Box>
        </Note>
      )}

      <Typography
        component="h2"
        sx={{ fontSize: (t) => t.typography.pxToRem(18), fontWeight: 640, lineHeight: 1.5, m: 0, overflowWrap: 'break-word' }}
      >
        {question.text}
      </Typography>

      {question.code_snippet && (
        <Box className="code-block" sx={{ mt: '12px' }}>
          <pre style={{ margin: 0 }}><code>{question.code_snippet}</code></pre>
        </Box>
      )}

      <Box
        role={isMultiple ? 'group' : 'radiogroup'}
        aria-label={isMultiple ? 'Options, choose all that apply' : 'Options'}
        sx={{ mt: '6px' }}
      >
        {question.options.map((option, idx) => {
          const optId = option.id !== undefined ? option.id : idx;
          const picked = selectedOptionIds.includes(optId);
          // Once revealed: the right options in green, a wrong pick in red.
          const right = revealed && option.is_correct;
          const wrongPick = revealed && picked && !option.is_correct;
          const border = right ? 'success.main' : wrongPick ? 'error.main' : picked ? 'primary.main' : 'divider';
          const background = right ? 'pb.successSoft' : wrongPick ? 'pb.dangerSoft' : picked ? 'pb.accentSoft' : 'background.paper';
          return (
            <Box
              component="label"
              key={option.id !== undefined ? `opt-id-${option.id}-${idx}` : `opt-idx-${idx}`}
              sx={{
                position: 'relative',
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px',
                width: '100%', mt: '8px', p: '13px', borderRadius: '10px', border: '1px solid',
                borderColor: border, bgcolor: background, color: 'text.primary',
                cursor: revealed ? 'default' : 'pointer', textAlign: 'left', boxSizing: 'border-box',
                transition: 'border-color .12s ease, background-color .12s ease',
                '&:hover': revealed ? undefined : { borderColor: 'primary.main' },
                '&:has(input:focus-visible)': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '2px' },
              }}
            >
              <Box
                component="input"
                type={isMultiple ? 'checkbox' : 'radio'}
                name={groupName}
                checked={picked}
                disabled={revealed}
                onChange={() => toggle(optId)}
                aria-label={option.option_text}
                sx={INPUT_OVER_CHOICE}
              />
              <Box component="span" sx={{ minWidth: 0, overflowWrap: 'break-word' }}>
                <Box component="span" sx={{ fontWeight: 700, mr: '6px' }}>{String.fromCharCode(65 + idx)}.</Box>
                {option.option_text}
              </Box>
              {right && <Pill tone="success" sx={{ flex: '0 0 auto' }}>Correct</Pill>}
              {wrongPick && <Pill tone="danger" sx={{ flex: '0 0 auto' }}>Your answer</Pill>}
            </Box>
          );
        })}
      </Box>

      {/* Asked once the answer is behind you, and never during a timed mock.
          Between the last option and Next it is a second decision per question
          under a clock -- which is why it had been used zero times across 549
          answers. SM2Service reads it to decide how soon a question comes back. */}
      {revealed && (
        <Box sx={{ mt: '16px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <Typography id={`${groupName}-confidence`} variant="caption" sx={{ color: 'text.secondary' }}>
            How sure were you? Optional — it decides how soon this comes back.
          </Typography>
          <Box role="group" aria-labelledby={`${groupName}-confidence`} sx={{ display: 'flex', gap: '6px' }}>
            {CONFIDENCE.map(({ level, label }) => (
              <Button
                key={level}
                size="small"
                variant={confidenceLevel === level ? 'contained' : 'outlined'}
                aria-pressed={confidenceLevel === level}
                onClick={() => onChangeConfidence(level)}
              >
                {label}
              </Button>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};
