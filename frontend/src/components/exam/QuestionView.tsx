// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { Box, Typography, Card, CardContent, Checkbox, Radio, RadioGroup, FormControlLabel, Chip, Paper } from '@mui/material';
import { Question } from '../../types/question';
import { ConfidenceLevel } from '../../types/exam';
import { Code, BookOpen, Bookmark, Flag } from 'lucide-react';

interface QuestionViewProps {
  question: Question;
  selectedOptionIds: number[];
  onSelectOption: (optionIds: number[]) => void;
  isFlagged: boolean;
  isBookmarked: boolean;
  onToggleFlag: () => void;
  onToggleBookmark: () => void;
  confidenceLevel: ConfidenceLevel;
  onChangeConfidence: (level: ConfidenceLevel) => void;
}

export const QuestionView: React.FC<QuestionViewProps> = ({
  question,
  selectedOptionIds,
  onSelectOption,
  isFlagged,
  isBookmarked,
  onToggleFlag,
  onToggleBookmark,
  confidenceLevel,
  onChangeConfidence,
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
      {/* Header Chips & Action Icons */}
      {/* Wraps as a whole. The metadata chips wrapped and the two action
          chips did not, so on a 375px phone Flag and Bookmark were pushed
          past the right edge with nothing to scroll -- clipped, not
          reachable. */}
      <Box sx={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 1, flexWrap: 'wrap',
      }}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', minWidth: 0 }}>
          {/* Where this sits in the syllabus, and nothing else.
              Three more chips stood here:

                HARD          difficulty is a property of the bank, not of
                              the exam. The real paper does not tell you
                              which questions are hard, and being told
                              changes how one is answered. It is on the
                              review screen afterwards, where it explains
                              instead of priming.
                SINGLE CHOICE the QuestionType enum, saying what the radio
                              buttons below already say.
                PRACTICE      the ExamMode enum, in caps, telling the learner
                              the mode they chose on the previous screen. */}
          <Chip label={question.domain} size="small" color="primary" sx={{ fontWeight: 600 }} />
          <Chip label={question.topic} size="small" variant="outlined" />
          {isMultiple && (
            // Load-bearing: it changes how the question is answered.
            <Chip label="Choose all that apply" size="small" sx={{ bgcolor: 'action.hover' }} />
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
          <Chip
            icon={<Flag size={16} color={isFlagged ? '#FB7185' : undefined} />}
            label="Flag"
            size="small"
            clickable
            color={isFlagged ? 'error' : 'default'}
            variant={isFlagged ? 'filled' : 'outlined'}
            onClick={onToggleFlag}
            sx={{ borderRadius: '8px' }}
          />
          <Chip
            icon={<Bookmark size={16} color={isBookmarked ? '#FBBF24' : undefined} />}
            label="Bookmark"
            size="small"
            clickable
            color={isBookmarked ? 'warning' : 'default'}
            variant={isBookmarked ? 'filled' : 'outlined'}
            onClick={onToggleBookmark}
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
                    control={<Radio checked={isSelected} />}
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

      {/* Optional, and it now looks it.
          This sat in a filled panel between the last option and Save & Next
          -- the only filled container on the screen, so it read as a
          required step and outweighed the answers themselves. It has been
          used zero times across 549 answers in the working database: every
          stored value is NOT_SET.

          It is kept because it is wired: SM2Service reads it to decide how
          soon a question comes back. Answering it makes the schedule better;
          skipping it costs nothing, which is exactly what the layout should
          have been saying all along. The label says what it is for instead
          of naming the field. */}
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
    </Box>
  );
};
