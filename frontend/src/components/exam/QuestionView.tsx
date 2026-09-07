// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Box, Typography, Card, CardContent, Checkbox, Radio, RadioGroup, FormControlLabel, Chip, Paper } from '@mui/material';
import { Question } from '../../types/question';
import { ConfidenceLevel } from '../../types/exam';
import { Code, BookOpen, Flag } from 'lucide-react';

interface QuestionViewProps {
  question: Question;
  selectedOptionIds: number[];
  onSelectOption: (optionIds: number[]) => void;
  isFlagged: boolean;
  onToggleFlag: () => void;
  confidenceLevel: ConfidenceLevel;
  onChangeConfidence: (level: ConfidenceLevel) => void;
  /**
   * True once the answer is behind the learner and the explanation is on
   * screen -- practice mode, after Save & Next. Everything that would prime
   * an answer is held back until then, so in a timed mock it never appears.
   */
  revealed?: boolean;
}

export const QuestionView: React.FC<QuestionViewProps> = ({
  question,
  selectedOptionIds,
  onSelectOption,
  isFlagged,
  onToggleFlag,
  confidenceLevel,
  onChangeConfidence,
  revealed = false,
}) => {
  const isMultiple = question.question_type === 'multiple_choice';

  const handleOptionToggle = (optionId: number) => {
    if (isMultiple) {
      if (selectedOptionIds.includes(optionId)) {
        onSelectOption(selectedOptionIds.filter((id) => id !== optionId));
      } else {
        onSelectOption([...selectedOptionIds, optionId]);
      }
    } else {
      onSelectOption([optionId]);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* What is on screen before the answer, and what is not.
          Three chips used to stand here:

            HARD          difficulty is a property of the bank, not of the
                          exam. The real paper does not tell you which
                          questions are hard, and being told changes how one
                          is answered.
            SINGLE CHOICE the QuestionType enum, saying what the radio
                          buttons below already say.
            PRACTICE      the ExamMode enum, in caps, telling the learner the
                          mode they chose on the previous screen.

          The domain and topic chips have now followed them, for the reason
          the difficulty chip was removed and with more force. A topic in this
          bank reads "Sprint Cancellation: PO authority and obsolescence
          condition", or "Product Backlog and Refinement (max 10% capacity
          rule)": it names the area, the sub-facets, and often the answer,
          printed directly above the question. Every point that cue is worth
          is a point the real exam will not award -- and mock scores are what
          readiness is computed from, so the cue does not merely flatter a
          screen, it moves the verdict. Both chips appear here once the answer
          is behind you, and on the review screen afterwards, where they
          explain instead of priming.

          Bookmark stood beside Flag and looked identical to it. Flag is read
          by the palette during the sitting, which is what "come back to this
          before you submit" means; bookmark was read by nothing -- zero rows
          in 549 answers, and no surface anywhere that lists what you saved.
          The job it was reaching for is already done, better, by the review
          queue and the spaced-repetition schedule, and a third queue that
          nothing renders is a promise the product does not keep. */}
      <Box sx={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 1, flexWrap: 'wrap',
      }}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', minWidth: 0 }}>
          {isMultiple && (
            // Load-bearing: it changes how the question is answered.
            <Chip label="Choose all that apply" size="small" sx={{ bgcolor: 'action.hover' }} />
          )}
          {revealed && (
            <>
              <Chip label={question.domain} size="small" color="primary" sx={{ fontWeight: 600 }} />
              {question.topic && <Chip label={question.topic} size="small" variant="outlined" />}
            </>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
          <Chip
            icon={<Flag size={16} color={isFlagged ? '#FB7185' : undefined} />}
            label="Flag"
            // A clickable Chip renders a div with role=button whose contents
            // are two spans; it reads as an unnamed button to anything not
            // looking at it. Same lesson as Home's rows.
            aria-label={isFlagged ? 'Unflag this question' : 'Flag this question'}
            size="small"
            clickable
            color={isFlagged ? 'error' : 'default'}
            variant={isFlagged ? 'filled' : 'outlined'}
            onClick={onToggleFlag}
            sx={{ borderRadius: '8px' }}
          />
        </Box>
      </Box>

      {/* Case Study Panel if present */}
      {question.case_study_text && (
        <Paper sx={{ p: 2, bgcolor: 'background.paper', borderLeft: 4, borderColor: 'secondary.main' }}>
          <Typography variant="subtitle2" color="secondary" sx={{ fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <BookOpen size={16} /> Case Study Context
          </Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
            {question.case_study_text}
          </Typography>
        </Paper>
      )}

      {/* Question Text */}
      <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.6 }}>
        {question.text}
      </Typography>

      {/* Code Snippet if present */}
      {question.code_snippet && (
        <Box className="code-block">
          <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Code size={14} /> Code Snippet
          </Typography>
          <pre style={{ margin: 0 }}><code>{question.code_snippet}</code></pre>
        </Box>
      )}

      {/* Options List */}
      {isMultiple ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
          {question.options.map((option, idx) => {
            const optId = option.id !== undefined ? option.id : idx;
            const isSelected = selectedOptionIds.includes(optId);
            return (
              <Card
                key={option.id !== undefined ? `opt-id-${option.id}-${idx}` : `opt-idx-${idx}`}
                sx={{
                  cursor: 'pointer',
                  border: '1px solid',
                  borderColor: isSelected ? 'primary.main' : 'divider',
                  bgcolor: isSelected ? 'action.selected' : 'background.paper',
                  borderRadius: '12px',
                  boxShadow: 'none',
                  transition: 'background-color 0.2s ease',
                  '&:hover': {
                    bgcolor: isSelected ? 'action.selected' : 'action.hover',
                  }
                }}
                onClick={() => handleOptionToggle(optId)}
              >
                <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 }, display: 'flex', alignItems: 'center' }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={isSelected}
                        onChange={(e) => { e.stopPropagation(); handleOptionToggle(optId); }}
                        // Named from the option itself. Without this the
                        // control announces its `value` -- the option's
                        // database id -- so a screen reader read out "2687"
                        // where the answer should be.
                        slotProps={{ input: { 'aria-label': option.option_text } }}
                      />
                    }
                    label={
                      <Typography variant="body1" sx={{ fontWeight: isSelected ? 600 : 400 }}>
                        <span style={{ fontWeight: 700, marginRight: 8 }}>{String.fromCharCode(65 + idx)}.</span>
                        {option.option_text}
                      </Typography>
                    }
                    sx={{ margin: 0, width: '100%' }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </CardContent>
              </Card>
            );
          })}
        </Box>
      ) : (
        <RadioGroup
          value={selectedOptionIds[0]?.toString() ?? ''}
          onChange={(e) => handleOptionToggle(Number(e.target.value))}
          sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}
        >
          {question.options.map((option, idx) => {
            const optId = option.id !== undefined ? option.id : idx;
            const isSelected = selectedOptionIds.includes(optId);
            return (
              <Card
                key={option.id !== undefined ? `opt-id-${option.id}-${idx}` : `opt-idx-${idx}`}
                sx={{
                  cursor: 'pointer',
                  border: '1px solid',
                  borderColor: isSelected ? 'primary.main' : 'divider',
                  bgcolor: isSelected ? 'action.selected' : 'background.paper',
                  borderRadius: '12px',
                  boxShadow: 'none',
                  transition: 'background-color 0.2s ease',
                  '&:hover': {
                    bgcolor: isSelected ? 'action.selected' : 'action.hover',
                  }
                }}
                onClick={() => handleOptionToggle(optId)}
              >
                <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 }, display: 'flex', alignItems: 'center' }}>
                  <FormControlLabel
                    value={optId.toString()}
                    control={
                      <Radio
                        checked={isSelected}
                        // Named from the option itself; otherwise the control
                        // announces its `value`, which is the option's
                        // database id.
                        slotProps={{ input: { 'aria-label': option.option_text } }}
                      />
                    }
                    label={
                      <Typography variant="body1" sx={{ fontWeight: isSelected ? 600 : 400 }}>
                        <span style={{ fontWeight: 700, marginRight: 8 }}>{String.fromCharCode(65 + idx)}.</span>
                        {option.option_text}
                      </Typography>
                    }
                    sx={{ margin: 0, width: '100%' }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </CardContent>
              </Card>
            );
          })}
        </RadioGroup>
      )}

      {/* Asked once the answer is behind you, and never during a timed mock.
          It sat between the last option and Save and Next, where it is a
          second decision per question under a clock -- which is why it has
          been used zero times across 549 answers: every stored value is
          NOT_SET.

          That matters more than a tidy screen. SM2Service reads this to
          decide how soon a question comes back, so with NOT_SET on
          everything the schedule has run at one setting for the whole
          history of this database. Moving the question to a moment where it
          costs nothing is how it starts getting an answer; the review check
          asks it too, for the same reason. */}
      {revealed && (
        <Box sx={{
          mt: 2, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap',
        }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            How sure were you? Optional — it decides how soon this comes back.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {(['low', 'medium', 'high'] as ConfidenceLevel[]).map((level) => {
              const isSelected = confidenceLevel === level;
              const solidColor = level === 'high' ? 'success.main'
                : level === 'medium' ? 'warning.main'
                  : 'error.main';
              return (
                <Chip
                  key={level}
                  label={level.toUpperCase()}
                  clickable
                  sx={{
                    borderRadius: '100px',
                    bgcolor: isSelected ? solidColor : 'transparent',
                    color: isSelected ? '#fff' : 'text.primary',
                    border: isSelected ? 'none' : '1px solid',
                    borderColor: 'divider',
                    fontWeight: isSelected ? 700 : 500,
                  }}
                  onClick={() => onChangeConfidence(level)}
                />
              );
            })}
          </Box>
        </Box>
      )}
    </Box>
  );
};
